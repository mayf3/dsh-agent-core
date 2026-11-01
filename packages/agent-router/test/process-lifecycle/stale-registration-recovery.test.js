/**
 * WORKFLOW_546_D1 — stale agent-process registration must never keep serving
 * admission after exact process-death evidence exists (Product #546, incident
 * 2026-10-21: "router 进程注册持续指向已退出的 gen 27" — every scheduler slot
 * for 5.5h failed against the same dead generation across deployment windows;
 * repeated `RPC initialize rejected: AGENT_PROCESS_EXITED`).
 *
 * Review-reconciliation r2 (PR #547 findings 1+3, 2026-10-22): death evidence
 * is FAIL-CLOSED and the REAP fence is untouchable from admission.
 *   - P1-1: a `ChildProcess.kill(0)` / `kill(0) === false` result is NOT death
 *     evidence — signal delivery fails for EPERM (a LIVE process this uid may
 *     not signal) exactly as it fails for ESRCH. Only an explicit OS
 *     not-found verdict on the exact pid (process.kill(pid, 0) throwing
 *     code=ESRCH) is death; every probe failure and every ambiguous probe
 *     surface fail closed. PID reuse can only ever make a dead child look
 *     alive — never a live child look dead.
 *   - P1-3: a REAP fence ALWAYS rejects admission (V4 C-007). The exact
 *     REAP->EMPTY cleanup stays owned by the process exit sequence
 *     (C-009: real exit + reconciliation visible -> exact identity CAS);
 *     admission never deletes a fence and never mints a parallel generation.
 *   - Death evidence that IS mechanical: observed real exit on the process
 *     and the terminal EXITED state (reachable with `exit` unset on the
 *     logical no-child path) invalidate a READY registration through the
 *     ordinary EMPTY -> STARTUP rebuild.
 * Negative: LIVE processes keep the exact current semantics (reuse, REAP
 * rejects) — no premature invalidation, fail-closed preserved.
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../../agent-definition/src/config.js'
import { AgentProcess } from '../../src/process.js'
import { hasExactDeathEvidence } from '../../src/process-registry.js'
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
 * FakeChildAgentProcess with the exact cleanup-failure seam:
 * `blockCasEmpty: the exact REAP->EMPTY cleanup CAS always fails (the
 * missed-cleanup wedge — exitPromise never settles). The fence's fate is
 * then the process-owned cleanup order's business — NEVER admission's.
 */
class ProbeChildAgentProcess extends AgentProcess {
  spawn() {
    this.counters.spawnAttempts += 1
    fakePidSeq += 1
    const child = makeFakeChild({ pid: fakePidSeq })
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
async function freshRig(t, dir, agentIds, { blockCasEmpty = false } = {}) {
  const definition = await writeRoster(dir, agentIds)
  const spawned = []
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
      proc.blockCasEmpty = blockCasEmpty
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

/**
 * Bounded rejection assertion: admission must settle with AGENT_PROCESS_REAPING.
 * A promise that neither resolves nor rejects (a minted startup hanging on its
 * initialize) is itself the defect — reported as a clean failure, not a hang.
 */
async function assertRejectsReaping(promise, label = 'admission') {
  const outcome = await Promise.race([
    promise.then(
      (value) => new Error(`${label}: expected AGENT_PROCESS_REAPING rejection, got a resolved generation ${value?.processGeneration}`),
      (error) => error,
    ),
    new Promise((resolve) => setTimeout(() => resolve(new Error(`${label}: neither resolved nor rejected within 2s (an admission path side effect ran)`)), 2000)),
  ])
  assert.ok(outcome instanceof Error, `${label}: rejection shape`)
  assert.equal(outcome.code, 'AGENT_PROCESS_REAPING', `${label}: expected AGENT_PROCESS_REAPING, got: ${outcome.message}`)
}

/**
 * A REAL OS child (real ChildProcess instance) that stays alive until
 * explicitly killed; `await realExit` resolves after its true OS exit.
 */
async function realOsChild(t) {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1e6)'], { stdio: 'ignore' })
  const realExit = new Promise((resolve) => child.once('exit', resolve))
  const ownedKill = child.kill.bind(child) // Tests may replace child.kill to model EPERM.
  t.after(() => { try { ownedKill('SIGKILL') } catch { /* already gone */ } })
  await tick()
  assert.ok(child.pid > 0, 'the real child has an OS pid')
  return { child, realExit }
}

// ---------------------------------------------------------------------------
// P1-1: the death probe is ESRCH-exact and fails closed (unit level).
// ---------------------------------------------------------------------------

test('P1-1 a kill(0) === false on a REAL ChildProcess (the EPERM shape: live process, undeliverable signal) is NOT death evidence', async (t) => {
  const { child } = await realOsChild(t)
  // Model exactly the finding: signal 0 could not be delivered (EPERM — the
  // process exists but is not ours to signal); ChildProcess.kill() reports
  // that identically to ESRCH, as `false`.
  child.kill = () => false
  assert.equal(hasExactDeathEvidence({ pid: child.pid, child }), false,
    'an undeliverable probe on a live process is never death evidence')
})

test('P1-1 an EPERM probe failure is never death evidence (fail closed)', async (t) => {
  const { child } = await realOsChild(t)
  t.mock.method(process, 'kill', (pid, signal) => {
    assert.equal(pid, child.pid)
    assert.equal(signal, 0)
    throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' })
  })
  assert.equal(hasExactDeathEvidence({ pid: child.pid, child }), false,
    'EPERM means the OS process EXISTS — fail closed')
})

test('P1-1 a kill(0) === false on a duck-typed (non-ChildProcess) child is NOT evidence', () => {
  // The exact pre-fix defect shape: any object with a kill() surface returning
  // false was read as ESRCH. Without a REAL OS child identity there is no OS
  // evidence at all.
  const fake = makeFakeChild({ pid: 424242 })
  fake.kill = () => false
  assert.equal(hasExactDeathEvidence({ pid: 424242, child: fake }), false)
})

test('P1-1 an explicit OS not-found verdict (ESRCH) IS death evidence', async (t) => {
  const { child, realExit } = await realOsChild(t)
  child.kill('SIGKILL')
  await realExit
  assert.equal(hasExactDeathEvidence({ pid: child.pid, child }), true,
    'ESRCH on the exact pid is mechanically proven death')
})

test('P1-1 any other probe throw is never death evidence; no probe surface or bad pid is never evidence', async (t) => {
  const { child } = await realOsChild(t)
  t.mock.method(process, 'kill', () => { throw new Error('probe exploded') })
  assert.equal(hasExactDeathEvidence({ pid: child.pid, child }), false)
  assert.equal(hasExactDeathEvidence({ pid: child.pid }), false, 'no child object: no OS evidence')
  assert.equal(hasExactDeathEvidence({ pid: 0, child }), false, 'pid 0 is not an exact child identity')
  assert.equal(hasExactDeathEvidence({ pid: -3, child }), false)
})

// ---------------------------------------------------------------------------
// P1-3: REAP fences always reject admission (C-007); the exact cleanup stays
// with the process exit sequence (C-009). Admission never deletes a fence.
// ---------------------------------------------------------------------------

test('D1-a a REAP fence whose cleanup CAS was missed still rejects admission — no fence deletion, no parallel generation (fail closed)', async (t) => {
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

  // V4 C-007: EVERY REAP admission rejects. Admission never turns a still-REAP
  // slot into EMPTY — even over a proven-dead process — because the exact
  // REAP->EMPTY identity CAS (after real exit AND reconciliation visibility)
  // is the cleanup order's alone (C-009).
  await assertRejectsReaping(router.ensureRunning(AGT_ID), 'ensureRunning')
  await assertRejectsReaping(router.ensureRunning(AGT_ID), 'repeated ensureRunning')
  const viaRoute = await router.ensureRunningForRoute(AGT_ID)
  assert.deepEqual(viaRoute, { status: 'reaping', generation: dead.processGeneration },
    'the route gate reports the same fence')
  assert.equal(spawned.length, 1, 'no parallel generation was ever minted')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'REAP', 'the fence still stands')
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

test('D1-c an OS-proven dead child (exact-pid ESRCH) in a READY slot rebuilds exactly once, then stable reuse', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stale-reg-esrch-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { router, spawned } = await freshRig(t, dir, [AGT_ID])
  const dead = await startAgent(router, spawned, AGT_ID, 1)
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')

  // Attach the REAL OS death evidence to the READY registration: the actual
  // child object of a truly exited OS process (observed-exit flag NOT set —
  // the missed-exit-callback incident shape).
  const { child, realExit } = await realOsChild(t)
  child.kill('SIGKILL')
  await realExit
  dead.child = child
  dead.pid = child.pid

  // Repeated admissions (the every-slot retry) must observe the exact death
  // evidence once and rebuild — never hand out the same dead generation again.
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
  const { router, spawned } = await freshRig(t, dir, [AGT_ID])
  const live = await startAgent(router, spawned, AGT_ID, 1)

  // READY + no death evidence: reuse (zero new generations).
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
  const { router, spawned } = await freshRig(t, dir, [AGT_ID])
  const dead = await startAgent(router, spawned, AGT_ID, 1)

  // Rebuild via the terminal-EXITED evidence (D1-b shape).
  dead.transition('DRAINING')
  dead.transition('EXITED')
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
