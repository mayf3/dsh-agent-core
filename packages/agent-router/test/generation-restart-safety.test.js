/**
 * DURABLE_GENERATION_RESTART_SAFETY — deterministic acceptance for
 * ROUTER_DURABLE_GENERATION_RESTART_SAFETY_V1.
 *
 * Root cause under test: the process-generation allocator was pure in-memory
 * state (`(last ?? 0) + 1`), so every runtime restart reset it to 1 while the
 * durable reconciliation store keeps issuance history across restarts; the
 * next mint then extended an OLD generation's seq range past a newer one and
 * the store failed closed at its next load (overlapping durable issuance
 * generation ranges). The fix floors every allocation above the agent's
 * highest durably recorded generation via a single read-only store accessor.
 *
 * Every test drives the REAL router (applyRouter + ensureRunning + lifecycle
 * slot CAS) with a REAL persistent TurnReconciliationStore and a fake OS
 * child through the production processFactory seam. No store is ever
 * repaired/rewritten by the allocator; poisoned stores must stay fail-closed.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { AgentProcess } from '../src/process.js'
import { makeFakeChild } from './helpers/fake-child.js'
import { apply as applyRouter } from '../src/index.js'
import { TurnReconciliationStore } from '../src/reconciliation/store.js'
import { readDurableRecoveryStore } from '../src/reconciliation/durable-file.js'

const AGT_ID = 'agt_gen-safety'
const AGT_ID_B = 'agt_gen-safety-b'

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

class FakeChildAgentProcess extends AgentProcess {
  spawn() {
    this.counters.spawnAttempts += 1
    fakePidSeq += 1
    this.fakeChild = makeFakeChild({ pid: fakePidSeq })
    return this.attachChild(this.fakeChild)
  }
}

async function writeRoster(dir, agentIds) {
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: agentIds[0],
    agents: agentIds.map(id => ({ id, name: `Gen Safety ${id}` })),
  })
  return new AgentDefinition({ configFile })
}

/** Router rig on a REAL persistent reconciliation store. */
async function freshRig(t, dir, agentIds, storeFile) {
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
    reconciliationStoreFile: storeFile,
    processFactory: (opts) => {
      const proc = new FakeChildAgentProcess(opts)
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

async function startAgent(router, spawned, agentId) {
  const pending = router.ensureRunning(agentId)
  await tick()
  await answerInitialize(spawned.at(-1))
  return pending
}

/** Simulate an in-epoch process crash + reap so the next ensure mints g+1. */
async function crashProcess(router, spawned) {
  spawned.at(-1).fakeChild.stdin.handlers.error(new Error('EPIPE on ready process'))
  await assert.rejects(() => router.ensureRunning(spawned.at(-1).agentId ?? AGT_ID), () => true)
  spawned.at(-1).fakeChild.handlers.exit(1, null)
  await spawned.at(-1).exitPromise
  await tick()
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'EMPTY')
}

/** Record a durable issuance generation the way a real turn would. */
function seedDurableGeneration(storeFile, agentId, generation) {
  const store = new TurnReconciliationStore({ persistenceFile: storeFile, runtimeEpoch: `seed-${generation}-${Math.random().toString(16).slice(2)}` })
  try {
    store.mintTurnExecution({ agentId, processGeneration: generation, sessionId: null })
  } finally {
    store.persistDurable()
  }
}

async function makeDir(t, name) {
  const dir = await mkdtemp(join(tmpdir(), name))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

test('T1 fresh store: first runtime mints generation 1', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t1-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  const proc = await startAgent(router, spawned, AGT_ID)
  assert.equal(proc.processGeneration, 1)
})

test('T2 same-runtime respawn: generations 1 -> 2 -> 3', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t2-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  const p1 = await startAgent(router, spawned, AGT_ID)
  assert.equal(p1.processGeneration, 1)
  await crashProcess(router, spawned)
  const p2 = await startAgent(router, spawned, AGT_ID)
  assert.equal(p2.processGeneration, 2)
  await crashProcess(router, spawned)
  const p3 = await startAgent(router, spawned, AGT_ID)
  assert.equal(p3.processGeneration, 3)
})

test('T3 REGRESSION runtime restart above durable history: fresh allocator mints strictly above the collision boundary (RED on the in-memory-only allocator)', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t3-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  // A previous runtime epoch already recorded generations 1 and 2 durably.
  seedDurableGeneration(storeFile, AGT_ID, 1)
  seedDurableGeneration(storeFile, AGT_ID, 2)
  // Restart: a brand-new runtime (fresh in-memory allocator Map) must mint
  // strictly above the durable history — generation 1 here is exactly the
  // poisoned-store bug (gen1 range extends over gen2's).
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  const proc = await startAgent(router, spawned, AGT_ID)
  assert.equal(proc.processGeneration, 3, 'allocator must floor above durable generations 1..2')
  // And the durable store must still load clean under the production validator.
  const store = readDurableRecoveryStore(storeFile)
  assert.ok(store !== null)
  const ranges = [...store.issuance.get(AGT_ID).generations.values()].sort((a, b) => a.minSeq - b.minSeq)
  assert.ok(ranges.every((range, index) => index === 0 || range.minSeq > ranges[index - 1].maxSeq), 'no overlapping issuance ranges')
})

test('T4 multiple restarts: consecutive restarts never reissue a durable generation', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t4-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  for (const previousGeneration of [1, 2, 3]) {
    seedDurableGeneration(storeFile, AGT_ID, previousGeneration)
    const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
    const proc = await startAgent(router, spawned, AGT_ID)
    assert.equal(proc.processGeneration, previousGeneration + 1, `restart ${previousGeneration}: mint strictly above durable gen ${previousGeneration}`)
  }
})

test('T5 per-agent isolation: agent A durable history never lifts or pollutes agent B', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t5-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  seedDurableGeneration(storeFile, AGT_ID, 7)
  const { router, spawned } = await freshRig(t, dir, [AGT_ID, AGT_ID_B], storeFile)
  const procB = await startAgent(router, spawned, AGT_ID_B)
  assert.equal(procB.processGeneration, 1, 'agent B has no durable history: starts at 1')
  const procA = await startAgent(router, spawned, AGT_ID)
  assert.equal(procA.processGeneration, 8, 'agent A floors above its own durable gen 7')
})

test('T6 empty durable history behaves exactly like a fresh store', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t6-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  const probe = new TurnReconciliationStore({ persistenceFile: storeFile })
  assert.equal(probe.highestIssuedGeneration(AGT_ID), 0, 'absent agent floors at 0')
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  const proc = await startAgent(router, spawned, AGT_ID)
  assert.equal(proc.processGeneration, 1)
})

test('T7 malformed durable store: fail loud, never mints from a fallback generation 1, store untouched', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t7-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  const poison = '{"epoch":{"epochs":['
  await writeFile(storeFile, poison, 'utf8')
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  await assert.rejects(() => router.ensureRunning(AGT_ID), (error) => {
    assert.match(String(error.message ?? error), /admission|recovery|durable/i)
    return true
  })
  await tick()
  assert.equal(spawned.length, 0, 'no process may spawn against an unprovable allocator state')
  assert.equal(await readFile(storeFile, 'utf8'), poison, 'the poisoned file must not be rewritten or healed')
})

test('T8 existing overlapping store: stays fail-closed, allocator never runs, store never self-heals', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t8-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  // Reproduce the production bug through the REAL store write path: gen1
  // mints again after gen2 exists, extending gen1's range past gen2's.
  const writer = new TurnReconciliationStore({ persistenceFile: storeFile, runtimeEpoch: 'poison-epoch' })
  writer.mintTurnExecution({ agentId: AGT_ID, processGeneration: 1, sessionId: null })
  for (let seq = 0; seq < 40; seq += 1) writer.mintTurnExecution({ agentId: AGT_ID, processGeneration: 2, sessionId: null })
  writer.mintTurnExecution({ agentId: AGT_ID, processGeneration: 1, sessionId: null })
  const poisoned = await readFile(storeFile, 'utf8')
  assert.throws(() => readDurableRecoveryStore(storeFile), /overlapping durable issuance generation ranges/, 'fixture is genuinely poisoned')
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  await assert.rejects(() => router.ensureRunning(AGT_ID), () => true)
  await tick()
  assert.equal(spawned.length, 0, 'no allocation against a poisoned store')
  assert.equal(await readFile(storeFile, 'utf8'), poisoned, 'poisoned durable state must remain exactly as-is (operator recovery authority)')
})

test('T9 concurrent ensureRunning stays single-flight: exactly one allocation (generation 1)', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t9-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  const calls = []
  for (let index = 0; index < 30; index += 1) calls.push(router.ensureRunning(AGT_ID))
  await tick()
  assert.equal(spawned.length, 1, 'exactly one CAS(EMPTY -> STARTUP) winner => exactly one generation minted')
  await answerInitialize(spawned[0])
  const proc = await calls[0]
  assert.equal(proc.processGeneration, 1)
})

test('T10 crash before the first turn: reissue after restart is safe (nothing durable collided)', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t10-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  // Epoch A: generation allocated, process crashes, NO turn was ever minted.
  {
    const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
    const proc = await startAgent(router, spawned, AGT_ID)
    assert.equal(proc.processGeneration, 1)
  }
  // Epoch B: generation 1 is reissued — safe, because no durable issuance
  // references it; the store must load clean with no ranges at all.
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  const proc = await startAgent(router, spawned, AGT_ID)
  assert.equal(proc.processGeneration, 1)
  const store = readDurableRecoveryStore(storeFile)
  const entry = store.issuance.get(AGT_ID)
  assert.ok(entry === undefined || entry.generations.size === 0, 'no durable generation was recorded for the crashed epoch')
})

test('T11 generation exhaustion: MAX_SAFE_INTEGER durable floor fails before STARTUP mutation or spawn', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t11-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  seedDurableGeneration(storeFile, AGT_ID, Number.MAX_SAFE_INTEGER)
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  // Router construction may legitimately settle a crash-interrupted reserved
  // record; freeze bytes only after startup recovery, immediately before the
  // generation-allocation attempt whose side effects this test constrains.
  const before = await readFile(storeFile, 'utf8')
  assert.throws(() => router.ensureRunning(AGT_ID), (error) => {
    assert.equal(error.code, 'AGENT_PROCESS_GENERATION_EXHAUSTED')
    return true
  })
  assert.equal(spawned.length, 0, 'generation exhaustion must reject before processFactory/spawn')
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' }, 'generation exhaustion must reject before STARTUP slot mutation')
  assert.equal(await readFile(storeFile, 'utf8'), before, 'generation exhaustion must not rewrite durable authority')
})

test('T12 restart integration: durable store -> spawn -> restart -> spawn -> validator PASS with disjoint ranges', async (t) => {
  const dir = await makeDir(t, 'gen-safety-t12-')
  const storeFile = join(dir, 'turn-recovery-v3.json')
  seedDurableGeneration(storeFile, AGT_ID, 1)
  // Runtime epoch 2: full bootstrap to READY on generation 2.
  {
    const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
    const proc = await startAgent(router, spawned, AGT_ID)
    assert.equal(proc.processGeneration, 2)
  }
  // The turn epoch 2 would have executed lands under generation 2.
  seedDurableGeneration(storeFile, AGT_ID, 2)
  // Runtime epoch 3: must floor above BOTH durable generations.
  const { router, spawned } = await freshRig(t, dir, [AGT_ID], storeFile)
  const proc = await startAgent(router, spawned, AGT_ID)
  assert.equal(proc.processGeneration, 3)
  const store = readDurableRecoveryStore(storeFile)
  assert.ok(store !== null, 'durable store loads clean after the full restart chain')
  const ranges = [...store.issuance.get(AGT_ID).generations.values()].sort((a, b) => a.minSeq - b.minSeq)
  assert.ok(ranges.length >= 2, 'both prior generations remain durably recorded')
  assert.ok(ranges.every((range, index) => index === 0 || range.minSeq > ranges[index - 1].maxSeq), 'all issuance ranges disjoint (validator invariant)')
})
