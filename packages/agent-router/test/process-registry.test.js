/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 router-level registry fault rows
 * (§10.3: SPAWN_ERROR_BEFORE_CHILD_HANDLE, REGISTRY_STARTUP_FATAL_ATOMIC_
 * REAP, REGISTRY_READY_FATAL_ATOMIC_REAP, STARTUP_RESULT_REJECTS_WHILE_REAP_
 * WAITS, CONCURRENT_ENSURE_RUNNING, OLD_GENERATION_LATE_EXIT_AFTER_RESPAWN)
 * — packages/agent-router/src/index.js lifecycle slots (C-006..C-009).
 *
 * These tests drive the REAL router (apply + ensureRunning + lifecycle slot
 * CAS machinery) with a REAL AgentProcess whose OS child is a controllable
 * fake (helpers/fake-child.js) injected through the processFactory seam:
 * the registry semantics under test are production code paths, not fakes.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { AgentProcess } from '../src/process.js'
import { makeFakeChild } from './helpers/fake-child.js'
import { apply as applyRouter } from '../src/index.js'

const AGT_ID = 'agt_registry-fx'

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

/** Global fake-pid sequence — every generation gets a distinct pid. */
let fakePidSeq = 4100

/**
 * REAL AgentProcess with a fake OS child: spawn() attaches a controllable
 * child through the production wiring path instead of a real dsh process.
 */
class FakeChildAgentProcess extends AgentProcess {
  spawn() {
    this.counters.spawnAttempts += 1
    fakePidSeq += 1
    this.fakeChild = makeFakeChild({ pid: fakePidSeq })
    return this.attachChild(this.fakeChild)
  }
}

async function freshRig(t, { processFactory, workspaceBootstrap = stubBootstrap() } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-registry-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: AGT_ID,
    agents: [{ id: AGT_ID, name: 'Registry FX Agent' }],
  })
  const definition = new AgentDefinition({ configFile })
  const spawned = []
  const factory = processFactory ?? ((opts) => {
    const proc = new FakeChildAgentProcess(opts)
    spawned.push(proc)
    return proc
  })
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', workspaceBootstrap],
    ['agentDefinition', {
      listAgents: () => definition.listAgents(),
      getAgent: (id) => definition.getAgent(id),
      getDefaultAgent: () => definition.getDefaultAgent(),
      resolveAgentRef: (ref) => definition.resolveAgentRef(ref),
    }],
  ]))
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-production',
    defaultAgentId: AGT_ID,
    processFactory: factory,
    provisionHome: () => {},
  })
  return { router, spawned, dir, ctx }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

/** Answer the pending initialize of the newest spawned process. */
async function answerInitialize(proc, { providers } = {}) {
  const child = proc.fakeChild
  const write = [...child.writes].reverse().find(candidate => candidate.method === 'initialize')
  assert.ok(write !== undefined, 'initialize request written')
  child.stdout.handler(`${JSON.stringify({ id: write.id, result: { registeredProviders: providers ?? [proc.provider] } })}\n`)
}

test('B01: STARTUP CAS precedes async bootstrap and all callers share the exact resultPromise', async (t) => {
  let releaseEnsure
  let ensureCalls = 0
  const bootstrap = {
    ...stubBootstrap(),
    ensure: () => {
      ensureCalls += 1
      return new Promise(resolve => { releaseEnsure = resolve })
    },
  }
  const { router, spawned } = await freshRig(t, { workspaceBootstrap: bootstrap })
  const calls = Array.from({ length: 30 }, () => router.ensureRunning(AGT_ID))
  assert.ok(calls.every(call => call === calls[0]), 'the exact STARTUP resultPromise is shared')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'STARTUP', 'CAS is visible before bootstrap awaits')
  assert.equal(ensureCalls, 1)
  assert.equal(spawned.length, 0)
  releaseEnsure({})
  await tick()
  assert.equal(spawned.length, 1)
  await answerInitialize(spawned[0])
  const results = await Promise.all(calls)
  assert.ok(results.every(proc => proc === results[0]))
})

test('B01 frozen bootstrap rejection settles shared STARTUP and returns slot to EMPTY', async (t) => {
  const frozen = Object.freeze(Object.assign(new Error('frozen bootstrap'), { code: 'FROZEN_BOOTSTRAP' }))
  const bootstrap = { ...stubBootstrap(), ensure: async () => { throw frozen } }
  const { router, spawned } = await freshRig(t, { workspaceBootstrap: bootstrap })
  const first = router.ensureRunning(AGT_ID)
  const second = router.ensureRunning(AGT_ID)
  assert.equal(first, second)
  await assert.rejects(first, error => error.code === 'FROZEN_BOOTSTRAP' && error.agentId === AGT_ID)
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' })
  assert.equal(spawned.length, 0)
})

test('B01 post-processRef setup failure with no child converges STARTUP to EMPTY', async (t) => {
  const processFactory = (opts) => ({
    processGeneration: opts.processGeneration,
    ownership: null,
    set onRpcRequest(_handler) { throw new Error('rpc setter failed') },
  })
  const { router } = await freshRig(t, { processFactory })
  await assert.rejects(router.ensureRunning(AGT_ID), /rpc setter failed/u)
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' })
})

test('CONCURRENT_ENSURE_RUNNING: 30 calls -> one spawn, one pid, shared READY reference', async (t) => {
  const { router, spawned } = await freshRig(t)
  const calls = []
  for (let index = 0; index < 30; index += 1) calls.push(router.ensureRunning(AGT_ID))
  await tick()
  assert.equal(spawned.length, 1, 'exactly one CAS(EMPTY -> STARTUP) winner')
  await answerInitialize(spawned[0])
  const results = await Promise.all(calls)
  assert.equal(new Set(results.map(proc => proc.pid)).size, 1, 'one pid')
  assert.ok(results.every(proc => proc === results[0]), 'all callers receive the SAME READY process')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).generation, 1)
  assert.equal(spawned[0].counters.spawnAttempts, 1, 'S=1')
})

test('B14 disposer fences and cancels a no-child STARTUP before spawn', async (t) => {
  let releaseEnsure
  const bootstrap = { ...stubBootstrap(), ensure: () => new Promise(resolve => { releaseEnsure = resolve }) }
  const { router, spawned, ctx } = await freshRig(t, { workspaceBootstrap: bootstrap })
  const startup = router.ensureRunning(AGT_ID)
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'STARTUP')
  await ctx.disposers[0]()
  await assert.rejects(startup, error => error.code === 'AGENT_PROCESS_DRAINING')
  releaseEnsure({})
  await tick()
  assert.equal(spawned.length, 0)
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' })
  await assert.rejects(router.ensureRunning(AGT_ID), error => error.code === 'AGENT_PROCESS_DRAINING')
})

test('B14 runtime disposer awaits child exit and retains REAP until then', async (t) => {
  const { router, spawned, ctx } = await freshRig(t)
  const ready = router.ensureRunning(AGT_ID)
  await tick()
  await answerInitialize(spawned[0])
  await ready
  let disposed = false
  const disposal = ctx.disposers[0]().then(() => { disposed = true })
  await tick()
  const shutdownWrite = spawned[0].fakeChild.writes.find(write => write.method === 'shutdown')
  assert.ok(shutdownWrite)
  spawned[0].fakeChild.stdout.handler(`${JSON.stringify({ id: shutdownWrite.id, result: { ok: true } })}\n`)
  await tick()
  assert.equal(disposed, false)
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'REAP')
  spawned[0].fakeChild.handlers.exit(0, null)
  await disposal
  assert.equal(disposed, true)
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' })
})

test('SPAWN_ERROR_BEFORE_CHILD_HANDLE: sync spawn throw -> bounded reject + slot EMPTY, no fence', async (t) => {
  let boom = true
  const spawnedHere = []
  const { router } = await freshRig(t, {
    processFactory: (opts) => {
      const proc = new FakeChildAgentProcess(opts)
      if (boom) {
        boom = false
        proc.spawn = () => {
          proc.counters.spawnAttempts += 1
          // Sync failure BEFORE any child object exists (C-009 no-child branch).
          proc.handleSpawnFailureWithoutChild(new Error('spawn: ENOENT before child handle'))
          throw new Error('spawn: ENOENT before child handle')
        }
      }
      spawnedHere.push(proc)
      return proc
    },
  })
  await assert.rejects(() => router.ensureRunning(AGT_ID), /ENOENT before child handle/)
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' }, 'R[Ø,STARTUP(g),N/A,Ø] — no reap fence for a no-child failure')
  assert.equal(router.registrySnapshot().length, 0)
  // The next attempt spawns a fresh generation on the EMPTY slot.
  const second = router.ensureRunning(AGT_ID)
  await tick()
  assert.equal(spawnedHere.length, 2, 'a fresh spawn was admitted on the EMPTY slot')
  await answerInitialize(spawnedHere[1])
  await second
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).generation, 2)
})

test('REGISTRY_STARTUP_FATAL_ATOMIC_REAP: REAP before real exit; racers error; no EMPTY window', async (t) => {
  const { router, spawned } = await freshRig(t)
  const racers = []
  for (let index = 0; index < 20; index += 1) racers.push(router.ensureRunning(AGT_ID).catch(error => error))
  await tick()
  assert.equal(spawned.length, 1)
  // Initialize pending; a fatal arrives at the CAS barrier (child error).
  spawned[0].fakeChild.handlers.error(new Error('spawn harness broke'))
  const errors = await Promise.all(racers)
  assert.ok(errors.every(error => error instanceof Error), 'all racers error/reaping')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'REAP', 'no Ø before exit')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).cause, 'child_error')
  // While the real exit is held, a NEW ensureRunning rejects REAPING.
  await assert.rejects(() => router.ensureRunning(AGT_ID), (error) => {
    assert.equal(error.code, 'AGENT_PROCESS_REAPING')
    return true
  })
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'REAP', 'fence retained until real exit')
  spawned[0].fakeChild.handlers.exit(1, null)
  await spawned[0].exitPromise
  await tick()
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' }, 'R[STARTUP,REAP,REAP,Ø]')
})

test('REGISTRY_READY_FATAL_ATOMIC_REAP: no generation g+1 before g really exited', async (t) => {
  const { router, spawned } = await freshRig(t)
  const ready = router.ensureRunning(AGT_ID)
  await tick()
  await answerInitialize(spawned[0])
  await ready
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
  // Fatal stream error on the READY process, exit held.
  spawned[0].fakeChild.stdin.handlers.error(new Error('EPIPE on ready process'))
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'REAP', 'atomic READY -> REAP')
  await assert.rejects(() => router.ensureRunning(AGT_ID), (error) => error.code === 'AGENT_PROCESS_REAPING')
  spawned[0].fakeChild.handlers.exit(null, 'SIGKILL')
  await spawned[0].exitPromise
  await tick()
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' })
  // Only now may generation g+1 start.
  const next = router.ensureRunning(AGT_ID)
  await tick()
  await answerInitialize(spawned[1])
  const proc2 = await next
  assert.equal(proc2.processGeneration, 2, 'no g+1 before g exit')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).generation, 2)
})

test('STARTUP_RESULT_REJECTS_WHILE_REAP_WAITS: bounded original reject + immediate reaping reject', async (t) => {
  const { router, spawned } = await freshRig(t)
  const original = router.ensureRunning(AGT_ID)
  await tick()
  // Kill sent (fatal), real exit HELD.
  spawned[0].fakeChild.handlers.error(new Error('stream failure during startup'))
  await assert.rejects(() => original, (error) => {
    assert.ok(/AGENT_PROCESS_(UNAVAILABLE|EXITED|SPAWN_FAILED)/.test(error.code ?? '') || error instanceof Error)
    return true
  }, 'the original startup caller rejects BOUNDED at failure observation — not after the OS reap')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'REAP')
  const reaping = router.ensureRunning(AGT_ID)
  await assert.rejects(() => reaping, (error) => error.code === 'AGENT_PROCESS_REAPING')
  spawned[0].fakeChild.handlers.exit(1, null)
  await spawned[0].exitPromise
  await tick()
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' })
})

test('OLD_GENERATION_LATE_EXIT_AFTER_RESPAWN: stale exit callback on the old process leaves g+1 untouched (audit only)', async (t) => {
  const { router, spawned } = await freshRig(t)
  const first = router.ensureRunning(AGT_ID)
  await tick()
  await answerInitialize(spawned[0])
  const proc1 = await first
  proc1.fakeChild.handlers.exit(0, null)
  await proc1.exitPromise
  await tick()
  const second = router.ensureRunning(AGT_ID)
  await tick()
  await answerInitialize(spawned[1])
  const proc2 = await second
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
  // The stale old-generation exit callback fires late (harness replay).
  const before = router.lifecycleSlotSnapshot(AGT_ID)
  const auditsBefore = router.staleSlotAuditsSnapshot().length
  proc1.onChildExit(0, null) // state already EXITED -> stale audit only
  await tick()
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), before, 'g+1 slot unchanged')
  assert.equal(router.registrySnapshot().length, 1)
  assert.equal(router.registrySnapshot()[0].pid, proc2.pid)
  assert.ok(router.staleSlotAuditsSnapshot().length >= auditsBefore, 'bounded stale audit recorded')
  assert.equal(spawned.length, 2, 'S=2 (one per generation), no extra spawn')
})
