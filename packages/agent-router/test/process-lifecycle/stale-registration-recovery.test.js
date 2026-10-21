/**
 * WORKFLOW_546_D1 — stale agent-process registration must never keep serving
 * admission after exact process-death evidence exists (Product #546, incident
 * 2026-10-21: "router 进程注册持续指向已退出的 gen 27" — every scheduler slot
 * for 5.5h failed against the same dead generation across deployment windows;
 * repeated `RPC initialize rejected: AGENT_PROCESS_EXITED`).
 *
 * The registry's reuse gates trusted ONLY the observed-exit flag. Three exact
 * death evidences must mechanically invalidate the dead registration and
 * rebuild through the EXISTING CAS admission path (no second registry, no
 * watcher, no timers, and no EMPTY window before real exit — V4 C-006..C-009):
 *   a. a REAP fence whose processRef carries observed exit but whose exit
 *      callback never completed the REAP->EMPTY cleanup (exitPromise never
 *      settles — the registryCleanupBlocked shape) — admission stayed pinned
 *      to AGENT_PROCESS_REAPING forever;
 *   b. a process in the terminal EXITED state reachable with exit unset
 *      (logical no-child EXITED shape) sitting in a READY slot — admission
 *      kept reusing the dead registration;
 *   c. an OS-proven dead child (kill(0) === false ⇒ ESRCH) with the exit
 *      callback not yet observed — the 2026-10-21 pin: the same dead
 *      generation was handed out on every attempt.
 * Negative: a LIVE process (no death evidence) must keep the exact current
 * semantics — REAP still rejects, READY still reuses (fail-closed preserved).
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../../agent-definition/src/config.js'
import { AgentProcess } from '../../src/process.js'
import { makeFakeChild } from '../helpers/fake-child.js'
import { apply as applyRouter } from '../../src/index.js'

const AGT_ID = 'agt_stale-reg'

let fakePidSeq = 9100

function fakeCtx(services) {
  const provided = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => { const dispose = fn(); disposers.push(dispose); return () => dispose?.() },
    disposers,
  }
}

function stubBootstrap() {
  return {
    resolveWorkspace: (agentId) => join('/tmp/ws', agentId),
    resolveDshHome: (agentId) => join('/tmp/home', agentId),
    ensure: async () => ({ workspace: '/tmp/ws', dshHome: '/tmp/home' }),
  }
}

/**
 * FakeChildAgentProcess with controllable evidence seams:
 *   - osProbe(spawnIndex): what child.kill(0) reports for THIS spawn
 *     (undefined = legacy fake behavior — no evidence; false = ESRCH,
 *     OS-proven dead; true = alive);
 *   - blockCasEmpty: the exact REAP->EMPTY cleanup CAS always fails (the
 *     missed-cleanup wedge — exitPromise never settles).
 */
class ProbeChildAgentProcess extends AgentProcess {
  spawn() {
    this.counters.spawnAttempts += 1
    fakePidSeq += 1
    const child = makeFakeChild({ pid: fakePidSeq })
    const probe = this.osProbe?.(this.spawnIndex ?? 0)
    const rawKill = child.kill.bind(child)
    child.kill = (signal) => {
      rawKill(signal)
      if (signal === 0) return probe
      return undefined
    }
    if (this.blockCasEmpty === true) {
      // The exact REAP->EMPTY CAS fails WITHOUT consuming the fence (the
      // stale/foreign-identity shape): the fence stays installed forever.
      this.registryIntegration.casEmpty = () => false
    }
    this.fakeChild = child
    return this.attachChild(child)
  }
}

async function writeRoster(dir, agentIds) {
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: agentIds[0],
    agents: agentIds.map(id => ({ id, name: `Stale Reg ${id}` })),
  })
  return new AgentDefinition({ configFile })
}

/** Router rig on the REAL registry + route gate (fake OS children). */
async function freshRig(t, dir, agentIds, { osProbe, blockCasEmpty = false } = {}) {
  const definition = await writeRoster(dir, agentIds)
  const spawned = []
  let spawnIndex = 0
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentDefinition', {
      listAgents: () => definition.listAgents(),
      getAgent: (id) => definition.getAgent(id),
      getDefaultAgent: () => definition.getDefaultAgent(),
      resolveAgentRef: (ref) => definition.resolveAgentRef(ref),
    }],
  ]))
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, `bindings-${Math.random().toString(16).slice(2)}.json`),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-production',
    defaultAgentId: agentIds[0],
    processFactory: (opts) => {
      const proc = new ProbeChildAgentProcess(opts)
      proc.osProbe = osProbe
      proc.blockCasEmpty = blockCasEmpty
      proc.spawnIndex = spawnIndex
      spawnIndex += 1
      spawned.push(proc)
      return proc
    },
    provisionHome: () => {},
  })
  return { router, spawned, ctx }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

async function answerInitialize(proc) {
  const child = proc.fakeChild
  const write = [...child.writes].reverse().find(candidate => candidate.method === 'initialize')
  assert.ok(write !== undefined, 'initialize request written')
  child.stdout.handler(`${JSON.stringify({ id: write.id, result: { registeredProviders: [proc.provider] } })}\n`)
}

/** Start the agent to a genuinely READY slot and return the live process. */
async function startAgent(router, spawned, agentId, wantedGeneration) {
  const pending = router.ensureRunning(agentId)
  await tick()
  await answerInitialize(spawned.at(-1))
  const proc = await pending
  if (wantedGeneration !== undefined) {
    assert.equal(proc.processGeneration, wantedGeneration)
  }
  return proc
}

/** Rebuild through the ordinary admission path after a fix: expect READY. */
async function admitAgain(router, spawned, agentId) {
  const pending = router.ensureRunning(agentId)
  await tick()
  await answerInitialize(spawned.at(-1))
  return pending
}

test('D1-a blocked REAP cleanup over a proven-dead generation rebuilds through the existing admission path', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stale-reg-reap-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], { blockCasEmpty: true })
  const dead = await startAgent(router, spawned, AGT_ID, 1)
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')

  // Exact process-exit evidence, but the exit callback's registry cleanup is
  // blocked (casEmpty false) — the slot stays a REAP fence whose exitPromise
  // never settles (the C-020 order stops before EXITED on the blocked path).
  dead.fakeChild.handlers.exit?.(1, null)
  await tick()
  assert.equal(dead.exit?.code, 1, 'exit evidence recorded on the process')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'REAP')

  // Incident shape: admission pinned to the dead generation forever. The fix
  // must invalidate the stale fence on the exact exit evidence and rebuild a
  // fresh generation through the same CAS path (no pre-exit EMPTY window —
  // real exit is already proven).
  const rebuilt = await admitAgain(router, spawned, AGT_ID)
  assert.equal(rebuilt.processGeneration, dead.processGeneration + 1, 'a NEW generation serves admission')
  assert.equal(rebuilt, spawned.at(-1))
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
  assert.notEqual(rebuilt, dead, 'the dead registration never serves admission again')
  // Route-gate entry (the scheduler chain path) agrees with the same rebuild.
  const viaRoute = await router.ensureRunningForRoute(AGT_ID)
  assert.equal(viaRoute.status, 'ready')
  assert.equal(viaRoute.proc, rebuilt, 'the rebuilt generation is reused, not re-spawned')

})

test('D1-b a terminal-EXITED process in a READY slot never serves admission again', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stale-reg-exited-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { router, spawned } = await freshRig(t, dir, [AGT_ID])
  const dead = await startAgent(router, spawned, AGT_ID, 1)

  // Exact terminal-state death evidence with the observed-exit flag unset
  // (logical no-child EXITED shape: READY -> DRAINING -> EXITED): the slot
  // must not keep exposing the dead registration.
  dead.transition('DRAINING')
  dead.transition('EXITED')
  assert.equal(dead.state, 'EXITED')
  assert.equal(dead.exit, undefined)
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')

  const rebuilt = await admitAgain(router, spawned, AGT_ID)
  assert.equal(rebuilt.processGeneration, dead.processGeneration + 1)
  assert.notEqual(rebuilt, dead)

})

test('D1-c OS-proven dead child (kill(0) ESRCH) invalidates the pinned registration — repeated attempts never see the dead generation again', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stale-reg-esrch-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  // First spawn reports ESRCH (dead, exit callback unobserved — the
  // 2026-10-21 pinned-generation shape); rebuilt generations are alive.
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], {
    osProbe: (index) => (index === 0 ? false : true),
  })
  const dead = await startAgent(router, spawned, AGT_ID, 1)
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).generation, 1)

  // Repeated admissions (the every-slot retry) must observe the exact death
  // evidence once and rebuild — never hand out the same dead generation again.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const proc = await admitAgain(router, spawned, AGT_ID)
    assert.notEqual(proc, dead, `attempt ${attempt}: the dead generation is never reused`)
    assert.equal(proc.processGeneration, 2, `attempt ${attempt}: one rebuild, then stable reuse`)
  }
  // The route gate (scheduler path) carries the identical semantics.
  const viaRoute = await router.ensureRunningForRoute(AGT_ID)
  assert.equal(viaRoute.status, 'ready')
  assert.equal(viaRoute.proc.processGeneration, 2)

})

test('D1-negative a LIVE process keeps the exact current semantics (no premature invalidation)', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stale-reg-live-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], { osProbe: () => true })
  const live = await startAgent(router, spawned, AGT_ID, 1)

  // READY + alive probe + no exit evidence: reuse (zero new generations).
  const reused = await router.ensureRunning(AGT_ID)
  assert.equal(reused, live)
  const viaRoute = await router.ensureRunningForRoute(AGT_ID)
  assert.equal(viaRoute.status, 'ready')
  assert.equal(viaRoute.proc, live)
  assert.equal(spawned.length, 1, 'no rebuild was triggered by a live process')

  // A REAP fence over a LIVE process still rejects immediately (C-007) —
  // no death evidence, so no rebuild may happen.
  void live.fatal('test_fatal')
  await tick()
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'REAP')
  await assert.rejects(() => router.ensureRunning(AGT_ID), (error) => error?.code === 'AGENT_PROCESS_REAPING')
  const reaping = await router.ensureRunningForRoute(AGT_ID)
  assert.deepEqual(reaping, { status: 'reaping', generation: live.processGeneration })
  assert.equal(spawned.length, 1, 'live REAP never spawns a new generation')

})

test('D1-stale the dead old generation stays audit-only after rebuild (no slot mutation)', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stale-reg-audit-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], {
    osProbe: (index) => (index === 0 ? false : true),
  })
  const dead = await startAgent(router, spawned, AGT_ID, 1)
  const rebuilt = await admitAgain(router, spawned, AGT_ID)
  assert.equal(rebuilt.processGeneration, 2)

  const auditsBefore = router.staleSlotAuditsSnapshot().length
  // Late old-generation exit callback: must never touch the new slot.
  dead.fakeChild.handlers.exit?.(0, null)
  await tick()
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).generation, 2, 'the rebuilt slot is untouched')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
  assert.ok(router.staleSlotAuditsSnapshot().length >= auditsBefore)
  const stillServed = await router.ensureRunning(AGT_ID)
  assert.equal(stillServed, rebuilt, 'admission continues on the rebuilt generation')

})
