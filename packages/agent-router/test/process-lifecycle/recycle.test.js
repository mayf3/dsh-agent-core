/**
 * AGENT_PROCESS_RECYCLE_V1 (#703): idle READY generations retire through the
 * EXISTING graceful shutdown path; the reuse gate transparently waits out a
 * retiring generation instead of failing the caller's turn; the next demand
 * spawns a fresh generation. No new lifecycle state.
 *
 * Frozen invariants:
 *   - the sweep is the ONLY writer of retireRequested, and it only touches
 *     READY slots whose process is idle (turn queue + tracked executions +
 *     unknown fences all empty);
 *   - recycling never kills: it is performShutdown (graceful RPC → exit →
 *     REAP → EMPTY), so C-020 settlement order applies unchanged;
 *   - ensureRunning on a retire-requested generation NEVER mints a parallel
 *     generation and NEVER rejects while the budget holds — it waits, then
 *     re-reads the lifecycle (fresh spawn on EMPTY, REAPING past the budget).
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation/index.js'
import { createProcessRegistry } from '../../src/process-registry.js'
import { AgentProcess } from '../../src/process/agent-process.js'
import { DEFAULT_RECYCLE_CONFIG, parseRecycleConfig, recycleEligibility } from '../../src/process/recycle.js'

const log = { log: () => {}, error: () => {} }

function makeFakeProc(args) {
  const generation = args.processGeneration
  const proc = {
    agentId: args.agentId,
    processGeneration: generation,
    state: 'SPAWNING',
    exit: undefined,
    pid: 10000 + generation,
    ownership: null,
    ownershipToken: null,
    turnInFlight: false,
    turnQueueEntries: [],
    executions: new Map(),
    activeUnknownFences: new Map(),
    creations: [],
    home: args.home,
    workspace: args.workspace,
    profile: args.profile,
    retireRequested: false,
    recycleState: { settledTurns: 0, spawnedAtWallMs: Date.now() },
    registryIntegration: args.registryIntegration ?? null,
    shutdownInvocations: 0,
    spawn() {
      this.ownership = { fake: true }
      this.ownershipToken = `tok-${generation}`
      this.state = 'INITIALIZING'
    },
    async ready() {
      this.state = 'READY'
      return 1
    },
    shutdown() {
      this.shutdownInvocations += 1
      this.shutdownPromise = (async () => {
        // Mirror the real performShutdown shape: install REAP first, then the
        // idle child exits immediately (graceful RPC + exit; no kill here).
        this.registryIntegration?.casReap?.(this, 'recycle')
        this.state = 'DRAINING'
        this.exit = { code: 0, signal: null }
        return this.exit
      })()
      return this.shutdownPromise
    },
  }
  return proc
}

function fakeRegistryDeps(store, { procs } = {}) {
  return {
    log,
    cfg: { agentProfile: 'test-profile' },
    workspaceBootstrap: { ensure: async () => {}, resolveWorkspace: () => '/tmp/w', resolveDshHome: () => '/tmp/h' },
    agentDefinition: { getAgent: (id) => ({ id, disabled: false }) },
    deadlineConfig: { perAgent: () => ({ turnTimeoutMs: 1000, promptReceiptTimeoutMs: 1000, initializeTimeoutMs: 1000, shutdownGraceMs: 1000 }) },
    reconciliationStore: store,
    processFactory: (args) => {
      const proc = makeFakeProc(args)
      procs?.push(proc)
      return proc
    },
    resolveProcessConfig: () => ({}),
    provisionHome: () => {},
    switchAgent: async () => ({}),
    getBrokerGateway: () => undefined,
  }
}

async function freshRegistry(t, { procs } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-recycle-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = new TurnReconciliationStore({ persistenceFile: join(dir, 'recovery.json'), runtimeEpoch: 'epoch-recycle' })
  return createProcessRegistry(fakeRegistryDeps(store, { procs }))
}

// ------------------------------------------------------------- pure policy

test('recycleEligibility: thresholds and the idle composite', () => {
  const nowMs = 1_000_000_000
  const base = {
    state: 'READY', exit: undefined, retireRequested: false,
    turnInFlight: false, turnQueueEntries: [], executions: new Map(), activeUnknownFences: new Map(),
    recycleState: { settledTurns: 0, spawnedAtWallMs: nowMs - DEFAULT_RECYCLE_CONFIG.maxAgeMs },
  }
  const age = recycleEligibility(base, DEFAULT_RECYCLE_CONFIG, nowMs)
  assert.equal(age.eligible, true)
  assert.match(age.reason, /age/)

  const turns = recycleEligibility(
    { ...base, recycleState: { settledTurns: 20, spawnedAtWallMs: nowMs } }, DEFAULT_RECYCLE_CONFIG, nowMs)
  assert.equal(turns.eligible, true)
  assert.match(turns.reason, /turns/)

  const under = recycleEligibility(
    { ...base, recycleState: { settledTurns: 1, spawnedAtWallMs: nowMs } }, DEFAULT_RECYCLE_CONFIG, nowMs)
  assert.equal(under.eligible, false)

  for (const [label, busy] of Object.entries({
    'turn in flight': { turnInFlight: true },
    'queued turns': { turnQueueEntries: [{}] },
    'tracked executions': { executions: new Map([['h', {}]]) },
    'unknown fences': { activeUnknownFences: new Map([['h', {}]]) },
    'already exiting': { exit: { code: 0, signal: null } },
    'already retiring': { retireRequested: true },
    'not READY': { state: 'DRAINING' },
  })) {
    const verdict = recycleEligibility({ ...base, recycleState: { settledTurns: 99, spawnedAtWallMs: nowMs - DEFAULT_RECYCLE_CONFIG.maxAgeMs }, ...busy }, DEFAULT_RECYCLE_CONFIG, nowMs)
    assert.equal(verdict.eligible, false, label)
  }
})

test('parseRecycleConfig: kill-switch, overrides, fail-loud on invalid', () => {
  assert.equal(parseRecycleConfig({}).enabled, true)
  assert.equal(parseRecycleConfig({ DSH_AGENT_RECYCLE: 'off' }).enabled, false)
  assert.equal(parseRecycleConfig({ DSH_AGENT_RECYCLE_MAX_TURNS: '7' }).maxTurns, 7)
  assert.throws(() => parseRecycleConfig({ DSH_AGENT_RECYCLE_MAX_TURNS: '0' }), TypeError)
  assert.throws(() => parseRecycleConfig({ DSH_AGENT_RECYCLE_SWEEP_MS: 'NaN' }), TypeError)
})

// ------------------------------------------------- registry-level lifecycle

test('recycle sweep retires an idle over-threshold generation through the graceful path; the next demand lands on a fresh generation', async (t) => {
  const procs = []
  const registry = await freshRegistry(t, { procs })

  const gen1 = await registry.ensureRunning('agt_recycle')
  assert.equal(gen1.processGeneration, 1)
  assert.equal(gen1.retireRequested, false)
  assert.equal(registry.lifecycleSlotSnapshot('agt_recycle').state, 'READY')

  gen1.recycleState.settledTurns = DEFAULT_RECYCLE_CONFIG.maxTurns
  gen1.recycleState.spawnedAtWallMs = Date.now() // age under threshold: turns are the trigger

  const retired = registry.recycleSweep(DEFAULT_RECYCLE_CONFIG)
  assert.equal(retired.length, 1)
  assert.equal(retired[0].agentId, 'agt_recycle')
  assert.equal(gen1.retireRequested, true)
  assert.equal(gen1.shutdownInvocations, 1)
  // The sweep's shutdown settles SYNCHRONOUSLY through REAP install (the
  // graceful RPC await comes after the REAP CAS) — later arrivals observe
  // the standard REAP fence, never a half-retired READY generation.
  assert.equal(registry.lifecycleSlotSnapshot('agt_recycle').state, 'REAP')

  // REAP discipline unchanged: admission during the recycle reap rejects.
  await assert.rejects(registry.ensureRunning('agt_recycle'), error => error.code === 'AGENT_PROCESS_REAPING')

  // The real C-020 exit sequence owns REAP -> EMPTY; the fake mirrors it,
  // then the next demand spawns a fresh generation through the SAME path.
  await gen1.shutdownPromise
  gen1.registryIntegration.casEmpty(gen1)
  assert.equal(registry.lifecycleSlotSnapshot('agt_recycle').state, 'EMPTY')

  const gen2 = await registry.ensureRunning('agt_recycle')
  assert.equal(gen2.processGeneration, 2)
  assert.equal(gen2.retireRequested, false)
  assert.equal(gen2.recycleState.settledTurns, 0)
  assert.equal(registry.lifecycleSlotSnapshot('agt_recycle').state, 'READY')
  assert.equal(procs.length, 2)
})

test('recycle sweep skips busy generations and never touches non-READY slots', async (t) => {
  const procs = []
  const registry = await freshRegistry(t, { procs })
  const gen1 = await registry.ensureRunning('agt_busy')
  gen1.turnInFlight = true
  gen1.recycleState.settledTurns = DEFAULT_RECYCLE_CONFIG.maxTurns

  const retired = registry.recycleSweep(DEFAULT_RECYCLE_CONFIG)
  assert.deepEqual(retired, [])
  assert.equal(gen1.retireRequested, false)
  assert.equal(gen1.shutdownInvocations, 0)
  assert.equal(registry.lifecycleSlotSnapshot('agt_busy').state, 'READY')
  assert.equal(await registry.ensureRunning('agt_busy'), gen1)
})

test('recycle sweep is idempotent: an already-retiring generation is never re-touched', async (t) => {
  const procs = []
  const registry = await freshRegistry(t, { procs })
  const gen1 = await registry.ensureRunning('agt_once')
  gen1.recycleState.settledTurns = DEFAULT_RECYCLE_CONFIG.maxTurns

  assert.equal(registry.recycleSweep(DEFAULT_RECYCLE_CONFIG).length, 1)
  assert.equal(registry.recycleSweep(DEFAULT_RECYCLE_CONFIG).length, 0)
  assert.equal(gen1.shutdownInvocations, 1)
})

test('real AgentProcess: finishExecution drives recycleState.settledTurns', () => {
  const proc = new AgentProcess({ agentId: 'agt_counter', profile: 'test-profile', log })
  assert.equal(proc.recycleState.settledTurns, 0)
  assert.equal(proc.retireRequested, false)
  proc.finishExecution({ handle: 'h1' })
  proc.finishExecution({ handle: 'h2' })
  assert.equal(proc.recycleState.settledTurns, 2)
})
