import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { mountWorkflowExecutionRuntime } from '../../production-runtime/src/workflow-execution-runtime.js'
import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { apply as applyRouter } from '../../agent-router/src/index.js'
import { AgentProcess } from '../../agent-router/src/process.js'
import { TurnReconciliationStore } from '../../agent-router/src/reconciliation/store.js'
import { makeFakeChild } from '../../agent-router/test/helpers/fake-child.js'
import { ExecutionLedger } from '../src/ledger.js'

const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_target-agent'

test('Router outcome_unknown preserves its reconciliation handle as active Run linkage with no replay', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wfe-runtime-unknown-'))
  const handle = 'turn:runtime:a1:g1:s1'
  let deliveries = 0
  const gateway = {
    execute: async () => ({ ok: true, result: { visibility: 'full', detail: { current_node_visit_id: VISIT } } }),
  }
  const principalAccess = {
    handlers: {
      agent_resolve_principal: {
        resolve: async () => ({ ok: true, result: { principalId: OWNER, agentId: AGENT } }),
      },
    },
  }
  const ctx = {
    get: (name) => ({ brokerGateway: gateway, agentPrincipalResolutionAccess: principalAccess })[name],
  }
  const router = {
    deliver: async () => {
      deliveries += 1
      throw Object.assign(new Error('prompt receipt lost'), {
        status: 'outcome_unknown',
        envelope: 'outcome_unknown',
        code: 'AGENT_PROCESS_PROMPT_RECEIPT_TIMEOUT',
        reconciliationHandle: handle,
      })
    },
    getTurnReconciliation: (candidate) => ({ state: candidate === handle ? 'pending' : 'never_existed' }),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
  }
  try {
    const runtime = mountWorkflowExecutionRuntime({
      ctx,
      layout: { workflowExecutionDir: join(root, 'workflow-execution') },
      router,
      log: { log() {}, warn() {}, error() {} },
      config: { pollerAgentId: 'agt_workflow-dispatcher-hr-agent' },
    })
    const admitted = await runtime.engine.admitDueIntent({
      dispatchIntentId: INTENT,
      nodeVisitId: VISIT,
      workflowInstanceId: INSTANCE,
      ownerPrincipalId: OWNER,
    })
    assert.equal(admitted.action, 'admitted')
    assert.equal(deliveries, 1)
    const attempt = runtime.ledger.get(VISIT)
    assert.equal(attempt.state, 'ACTIVE')
    assert.equal(attempt.phase, 'run_delivered')
    assert.equal(attempt.delivered.requestId, attempt.attemptId)
    assert.equal(attempt.delivered.reconciliationHandle, handle)

    const reconciled = await runtime.engine.reconcileOnce()
    assert.equal(reconciled.running, 1)
    assert.deepEqual(reconciled.needsReview, [])

    const duplicate = await runtime.engine.admitDueIntent({
      dispatchIntentId: INTENT,
      nodeVisitId: VISIT,
      workflowInstanceId: INSTANCE,
      ownerPrincipalId: OWNER,
    })
    assert.equal(duplicate.action, 'already_attempted')
    assert.equal(deliveries, 1, 'outcome_unknown is never replayed')

    // V2 CTR-WAE-013: the runtime component exposes the ONE controlled
    // recovery as a control-plane METHOD (authorityRef-gated inside the
    // engine) — and a replayed/foreign recovery against the admitted attempt
    // is delivery-domain evidence: RECOVERY_INAPPLICABLE, zero appends, zero
    // second delivery.
    assert.equal(typeof runtime.recoverAttempt, 'function')
    const sizeBefore = (await import('node:fs')).statSync(join(root, 'workflow-execution', 'attempts.jsonl')).size
    const replay = await runtime.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'TEST_AUTH_REF' })
    assert.equal(replay.outcome, 'RECOVERY_INAPPLICABLE')
    assert.equal(replay.evidenceClass, 'delivery_domain:run_delivered')
    const sizeAfter = (await import('node:fs')).statSync(join(root, 'workflow-execution', 'attempts.jsonl')).size
    assert.equal(sizeAfter, sizeBefore, 'zero recovery append')
    assert.equal(deliveries, 1, 'never a second delivery')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

const intent = { dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER }
const silentLog = { log() {}, warn() {}, error() {} }
const tick = () => new Promise(resolve => setImmediate(resolve))

function executionContext() {
  const services = {
    brokerGateway: { execute: async (request, caller) => {
      assert.equal(request.capabilityId, 'workflow_instance_detail')
      assert.equal(caller.agentId, AGENT)
      return { ok: true, result: { visibility: 'full', detail: {
        current_node_visit_id: VISIT, instance: { is_terminal: false, workflow_state_version: 7 },
      } } }
    } },
    agentPrincipalResolutionAccess: { handlers: { agent_resolve_principal: {
      resolve: async () => ({ ok: true, result: { principalId: OWNER, agentId: AGENT } }),
    } } },
  }
  return { get: name => services[name], provide: (name, value) => { services[name] = value }, effect: fn => fn() }
}

function mountExecution(dir, router, ctx = executionContext()) {
  return mountWorkflowExecutionRuntime({ ctx, layout: { workflowExecutionDir: dir }, router, log: silentLog,
    config: { pollerAgentId: 'agt_fixture-poller', maxAttemptsPerVisit: 3, staleNoProgressThresholdMs: 3_600_000 } })
}

async function seedStale(dir, store, correlationOnly = false) {
  const ledger = new ExecutionLedger({ dir, clock: () => Date.now() - 7_200_000 })
  let handle
  const seeded = await ledger.beginAttemptIfAbsent(intent, async (attempt, { recordDeliveryStarted }) => {
    handle = store.mintTurnExecution({ agentId: AGENT, processGeneration: 1, sessionId: 'main',
      callerCorrelation: { requestId: attempt.attemptId } })
    store.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: attempt.attemptId, deadlineAtWallMs: Date.now() })
    recordDeliveryStarted()
    return { kind: 'run_delivered', agentId: AGENT, requestId: attempt.attemptId, sessionId: 'main',
      ...(correlationOnly ? {} : { reconciliationHandle: handle }), workflowStateVersionAtDispatch: 7 }
  })
  const predecessor = seeded.attempt
  const stale = await ledger.recordStaleSuperseded({ nodeVisitId: VISIT,
    expected: { state: predecessor.state, phase: predecessor.phase, deliveredAtMs: predecessor.delivered.atMs },
    observedWorkflowStateVersion: 7 })
  assert.equal(stale.committed, true)
  return { handle, predecessor: stale.attempt }
}

// Port of #307's discriminating repro. Persistent Router/store/ledger remain
// real; only principal/business reads, provisioning and the OS child are fakes.
async function recoveryFixture(t, correlationOnly) {
  const root = mkdtempSync(join(tmpdir(), 'wfe-recovery-interleave-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'recovery.json')
  const dir = join(root, 'ledger')
  const store = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'seed' })
  const { handle, predecessor } = await seedStale(dir, store, correlationOnly)
  // Same producer as auto-recovery-v3-persistence.test.js:170-189: fake
  // child exit is persisted, then runtime dies BEFORE registry cleanup.
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  store.claimRecovery(handle, { operationId: 'op-fixture', claimantRuntimeEpoch: store.runtimeEpoch })
  store.commitRecoveryShutdown(handle)
  const oldChild = makeFakeChild()
  oldChild.once('exit', () => store.markExitObserved(handle))
  oldChild.handlers.exit(0, null)
  const roster = join(root, 'agents.json')
  await writeAgentDefinition(roster, { defaultAgentId: AGENT, agents: [{ id: AGENT, name: 'Fixture' }] })
  const definition = new AgentDefinition({ configFile: roster })
  const spawned = []
  const delivered = []
  class FakeProcess extends AgentProcess {
    spawn() {
      this.counters.spawnAttempts += 1
      this.fakeChild = makeFakeChild({ pid: 9100 + spawned.length })
      return this.attachChild(this.fakeChild)
    }
  }
  t.after(async () => {
    for (const proc of spawned) {
      assert.deepEqual(proc.fakeChild.killSignals, [])
      proc.fakeChild.handlers.exit(0, null)
      await proc.exitPromise
    }
  })
  function restart() {
    const ctx = executionContext()
    ctx.provide('agentDefinition', definition)
    ctx.provide('workspaceBootstrap', {
      resolveWorkspace: () => join(root, 'workspace'), resolveDshHome: () => join(root, 'home'),
      ensure: async () => ({ workspace: join(root, 'workspace'), dshHome: join(root, 'home') }),
    })
    const router = applyRouter(ctx, { bindingsStoreFile: join(root, 'bindings.json'),
      reconciliationStoreFile: file, productionRoot: root, defaultAgentId: AGENT,
      defaultSessionId: 'main', agentProfile: 'agent-core-production', provisionHome: () => {},
      processFactory: opts => { const proc = new FakeProcess(opts); spawned.push(proc); return proc } })
    const deliver = router.deliver
    router.deliver = (...args) => { delivered.push(args[0]); return deliver(...args) }
    return { router, runtime: mountExecution(dir, router, ctx) }
  }
  function cleanup() {
    const reopened = new TurnReconciliationStore({ persistenceFile: file })
    assert.equal(reopened.admissionBlockerForAgent(AGENT).handle, handle)
    assert.equal(reopened.records.get(handle).adminAbandonment ?? null, null)
    // Existing test-only authority shape (:221-241); never set/clear a fence.
    reopened.recordRecoveryAction(handle, { action: 'registry_cleanup', result: 'succeeded', reasonCode: 'exact_reap_empty' })
    assert.equal(reopened.activeFenceForAgent(AGENT).handle, handle)
  }
  return { handle, predecessor, restart, cleanup, spawned, delivered,
    bytes: () => readFileSync(join(dir, 'attempts.jsonl')) }
}

async function answerChild(f, admission) {
  let done = false
  admission.then(() => { done = true }, () => { done = true })
  const answered = new Set()
  for (let deadline = Date.now() + 5000; !done && Date.now() < deadline;) {
    await tick()
    for (const proc of f.spawned) for (const write of proc.fakeChild.writes) {
      if (answered.has(write.id)) continue
      answered.add(write.id)
      assert.ok(['initialize', 'session/prompt'].includes(write.method))
      const result = write.method === 'initialize' ? { registeredProviders: [proc.provider] } : { messageId: 'new-message' }
      proc.fakeChild.stdout.handler(`${JSON.stringify({ id: write.id, result })}\n`)
    }
  }
  assert.equal(done, true, 'bounded fake-child RPC completion')
  return admission
}

for (const correlationOnly of [false, true]) for (const cleanupFirst of [false, true]) {
  test(`settled active fence preserves stale successor liveness: correlation=${correlationOnly}, clean baseline=${cleanupFirst}`, async t => {
    const f = await recoveryFixture(t, correlationOnly)
    let { router, runtime } = f.restart()
    const query = router.getTurnReconciliation(f.handle)
    assert.equal(query.state, 'settled')
    assert.equal(query.snapshot.terminationEvidence, 'child_real_exit')
    assert.equal(query.snapshot.fenceState, 'active')
    assert.equal(query.snapshot.recoveryState, 'blocked')
    await assert.rejects(router.ensureRunning(AGENT), e => e.code === 'AGENT_PROCESS_TURN_FENCED' && e.fencedBy === f.handle)
    const before = f.bytes()
    if (!cleanupFirst) for (let poll = 0; poll < 3; poll++) {
      assert.equal((await runtime.engine.admitDueIntent(intent)).action, 'deferred_quiescence')
      assert.deepEqual(runtime.ledger.get(VISIT), f.predecessor)
      assert.equal(runtime.ledger.maxAttemptsPerVisit, 3)
      assert.deepEqual(f.bytes(), before, 'no generation or delivery_started and no budget spent')
      assert.equal(f.spawned.length, 0)
      assert.equal(f.delivered.length, 0)
      assert.equal(router.getTurnReconciliation(f.handle).snapshot.fenceState, 'active')
    }
    f.cleanup()
    ;({ router, runtime } = f.restart())
    assert.equal(router.getTurnReconciliation(f.handle).snapshot.fenceState, 'cleared')
    assert.equal(router.getTurnReconciliation(f.handle).snapshot.recoveryState, 'settled')
    assert.equal((await answerChild(f, runtime.engine.admitDueIntent(intent))).action, 'admitted')
    const successor = runtime.ledger.get(VISIT)
    assert.equal(successor.generation, 2)
    assert.equal(successor.dispatchCount, 2)
    assert.equal(successor.previousAttemptId, f.predecessor.attemptId)
    assert.equal(successor.delivered.requestId, successor.attemptId)
    assert.notEqual(successor.delivered.reconciliationHandle, f.handle)
    assert.equal(f.delivered.length, 1)
    assert.equal(f.delivered[0].requestId, successor.attemptId)
    const after = f.bytes()
    assert.deepEqual(after.toString().slice(before.length).trim().split('\n').map(line => JSON.parse(line).kind),
      ['attempt_planned', 'delivery_started', 'run_delivered'])
    assert.equal((await runtime.engine.admitDueIntent(intent)).action, 'already_attempted')
    assert.deepEqual(f.bytes(), after)
    assert.equal(f.spawned.length, 1)
    const child = f.spawned[0].fakeChild
    assert.equal(child.writes.filter(w => w.method === 'session/prompt').length, 1)
    const emit = message => child.stdout.handler(`${JSON.stringify(message)}\n`)
    for (const event of [
      { type: 'agent/inbox/spliced', data: { inserted: [{ id: 'new-message' }] } },
      { type: 'turn/start', data: { turn: 1 } }, { type: 'user/message', data: { id: 'new-message' } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]) emit({ method: 'session.event', params: { sessionId: 'main', event } })
    emit({ method: 'session.status', params: { sessionId: 'main', status: 'idle' } })
    const completed = router.getTurnReconciliation(successor.delivered.reconciliationHandle)
    assert.equal(completed.state, 'settled')
    assert.equal(completed.snapshot.outcome, 'completed')
    assert.equal(completed.snapshot.terminationEvidence, 'exact_terminal_then_idle')
  })
}

const unreadable = () => { throw new Error('unreadable Router evidence') }
const evidenceCases = [
  ['active fence', { state: 'settled', snapshot: { fenceState: 'active', recoveryState: 'settled' } }, false],
  ['blocked recovery', { state: 'settled', snapshot: { fenceState: 'cleared', recoveryState: 'blocked' } }, false],
  ['both blockers', { state: 'settled', snapshot: { fenceState: 'active', recoveryState: 'blocked' } }, false],
  ...['UNKNOWN', 'pending', 'recovering', 'failed'].map(state => [state, { state }, false]),
  ['missing state', {}, false], ['missing result', undefined, false], ['throwing read', unreadable, false],
  ['unreadable snapshot', { state: 'settled', get snapshot() { return unreadable() } }, false],
  ...[null, false, [], 'settled'].map(snapshot => [`invalid snapshot ${JSON.stringify(snapshot)}`, { state: 'settled', snapshot }, false]),
  ['contradictory snapshot state', { state: 'settled', snapshot: { state: 'recovering' } }, false],
  ...['fenceState', 'recoveryState'].flatMap(key => ['future_enum', false, {}, []].map(value =>
    [`unsupported ${key} ${JSON.stringify(value)}`, { state: 'settled', snapshot: { [key]: value } }, false])),
  ['legacy state only', { state: 'settled' }, true],
  ['default fields', { state: 'settled', snapshot: {} }, true],
  ['nullable fields', { state: 'settled', snapshot: { fenceState: null, recoveryState: null } }, true],
  ['producer defaults', { state: 'settled', snapshot: { fenceState: 'none', recoveryState: null } }, true],
  ['normal completion', { state: 'settled', snapshot: { fenceState: 'armed', recoveryState: 'settled' } }, true],
]
for (const correlationOnly of [false, true]) for (const [name, evidence, positive] of evidenceCases) {
  test(`positive quiescence evidence: ${name}, correlation=${correlationOnly}`, async t => {
    const root = mkdtempSync(join(tmpdir(), 'wfe-evidence-'))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    const { handle, predecessor } = await seedStale(root, new TurnReconciliationStore())
    const delivered = []
    const read = () => typeof evidence === 'function' ? evidence() : evidence
    const router = {
      getTurnReconciliation: candidate => { assert.equal(candidate, handle); return correlationOnly ? undefined : read() },
      resolveCallerCorrelation: ({ requestId }) => { assert.equal(requestId, predecessor.attemptId); return read() },
      deliver: async request => { delivered.push(request); return { sessionId: 'main', reconciliationHandle: 'turn:new' } },
    }
    const runtime = mountExecution(root, router)
    const before = readFileSync(join(root, 'attempts.jsonl'))
    const result = await runtime.engine.admitDueIntent(intent)
    assert.equal(result.action, positive ? 'admitted' : 'deferred_quiescence')
    assert.equal(runtime.ledger.get(VISIT).generation, positive ? 2 : 1)
    assert.equal(delivered.length, positive ? 1 : 0)
    if (!positive) assert.deepEqual(readFileSync(join(root, 'attempts.jsonl')), before)
  })
}

test('WORKFLOW_STALE_REENTRY_V1 r2 wiring — threshold resolution: default, env, config, fail-loud', async () => {
  const { resolveStaleNoProgressThresholdMs } = await import('../../production-runtime/src/workflow-execution-runtime.js')
  assert.equal(resolveStaleNoProgressThresholdMs(), 3_600_000, 'default 1h')
  assert.equal(resolveStaleNoProgressThresholdMs({ envValue: '' }), 3_600_000, 'empty env falls back to default')
  assert.equal(resolveStaleNoProgressThresholdMs({ envValue: '7200000' }), 7_200_000)
  assert.equal(resolveStaleNoProgressThresholdMs({ envValue: '7200000', configValue: 5000 }), 5000, 'explicit config wins over env')
  assert.throws(() => resolveStaleNoProgressThresholdMs({ envValue: '0' }), /positive integer/)
  assert.throws(() => resolveStaleNoProgressThresholdMs({ envValue: '1h' }), /positive integer/)
  assert.throws(() => resolveStaleNoProgressThresholdMs({ configValue: -5 }), /positive integer/)
})

test('WORKFLOW_STALE_REENTRY_V1 r2 wiring — quiescence-gated redispatch over the REAL gateway/read seams; no mutation seam exists', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wfe-runtime-stale-'))
  // r2 review closure: the reconciliation record starts pending (unresolved
  // turn) and only the EXISTING authorities converge it — the wiring never
  // settles, releases, or tears anything down. Redispatch follows strictly.
  let turnState = 'pending'
  let deliveries = 0
  const gateway = {
    execute: async () => ({ ok: true, result: { visibility: 'full', detail: { instance: { workflow_state_version: 7 }, current_node_visit_id: VISIT } } }),
  }
  const principalAccess = {
    handlers: { agent_resolve_principal: { resolve: async () => ({ ok: true, result: { principalId: OWNER, agentId: AGENT } }) } },
  }
  const ctx = { get: (name) => ({ brokerGateway: gateway, agentPrincipalResolutionAccess: principalAccess })[name] }
  try {
    const runtime = mountWorkflowExecutionRuntime({
      ctx,
      layout: { workflowExecutionDir: join(root, 'workflow-execution') },
      router: {
        deliver: async () => {
          deliveries += 1
          return { ok: true, sessionId: 'main', reconciliationHandle: 'turn:stale-1' }
        },
        getTurnReconciliation: () => ({ state: turnState }),
      },
      log: { log() {}, warn() {}, error() {} },
      config: { pollerAgentId: 'agt_workflow-dispatcher-hr-agent', staleNoProgressThresholdMs: 1 },
    })
    assert.equal(runtime.staleNoProgressThresholdMs, 1)
    await runtime.engine.admitDueIntent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(runtime.ledger.get(VISIT).workflowStateVersionAtDispatch, 7, 'dispatch-time baseline recorded through the real gateway seam')
    assert.equal(deliveries, 1)
    await new Promise((resolve) => setTimeout(resolve, 10)) // cross the 1ms stale threshold on the real clock

    // Business layer settles stale (evidence: visit current + version unchanged)…
    await runtime.engine.reconcileOnce()
    const settled = runtime.ledger.get(VISIT)
    assert.equal(settled.judgment, 'stale_no_progress')
    // …but the execution is still unresolved: the sweep DEFERS — no second
    // delivery, no generation minted, the pending fence untouched.
    const deferred = await runtime.engine.admitDueIntent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(deferred.action, 'deferred_quiescence')
    assert.equal(deliveries, 1)
    assert.equal(runtime.ledger.get(VISIT).generation, 1)

    // The existing termination authority converges the record (real late
    // path / restart) → quiescent → generation 2 delivered.
    turnState = 'settled'
    const admitted = await runtime.engine.admitDueIntent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(admitted.action, 'admitted')
    assert.equal(deliveries, 2)
    const gen2 = runtime.ledger.get(VISIT)
    assert.equal(gen2.generation, 2)
    assert.equal(gen2.retryReason, 'stale_no_progress')
    assert.equal(runtime.ledger.get(VISIT).previousAttemptId, settled.attemptId)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
