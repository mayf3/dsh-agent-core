import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ExecutionLedger } from '../../src/ledger.js'
import { createWorkflowExecutionEngine } from '../../src/engine.js'
import { RECOVERY_RULE } from '../../src/recovery/automatic-ledger.js'
import { mountWorkflowExecutionRuntime } from '../../../production-runtime/src/workflow-execution-runtime.js'
import { intent, detail, VISIT, INSTANCE, OWNER, AGENT, T0, barrier } from './fixture.js'

const OTHER = 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'

function fixture(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-blocked-consumer-'))
  const state = { now: T0, resolve: async () => ({ ok: true, agentId: AGENT }),
    correlation: () => ({ state: 'never_existed' }), read: async () => detail() }
  const clock = () => state.now
  const config = { automaticRecoveryEnabled: true, recoveryRetryDelayMs: 80,
    recoveryMaxDelayMs: 160, ...overrides }
  const calls = { deliveries: [], resolutions: [], errors: [] }
  const ledger = new ExecutionLedger({ dir, clock })
  const makeEngine = (store = ledger) => createWorkflowExecutionEngine({
    ledger: store, clock, config,
    fetchDuePage: async () => ({ ok: true, items: [] }),
    resolvePrincipalToAgent: async owner => {
      calls.resolutions.push(owner)
      return state.resolve(owner)
    },
    resolveCallerCorrelation: request => state.correlation(request),
    readInstanceDetail: args => state.read(args),
    getTurnReconciliation: () => ({ state: 'pending' }),
    deliverRun: async request => {
      calls.deliveries.push(request)
      return { ok: true, sessionId: 'main', reconciliationHandle: `turn:${request.requestId}` }
    },
    log: { error: message => calls.errors.push(message) },
  })
  const engine = makeEngine()
  const events = () => readFileSync(ledger.eventsFile, 'utf8').trim().split('\n').map(JSON.parse)
  return { dir, ledger, engine, makeEngine, clock, state, config, calls, events,
    bytes: () => readFileSync(ledger.eventsFile, 'utf8'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

async function blocked(ledger, input = intent()) {
  const result = await ledger.beginAttemptIfAbsent(input,
    async () => ({ kind: 'resolution_blocked', code: 'identity_resolution_unavailable' }))
  assert.equal(result.created, true)
  return structuredClone(result.attempt)
}

function noAdmission(fx, attempt) {
  assert.equal(fx.calls.deliveries.length, 0)
  assert.equal(fx.events().filter(e => e.kind === 'recovery_authorized').length, 0)
  assert.equal(fx.events().filter(e => e.kind === 'delivery_started').length, 0)
  const current = fx.ledger.get(attempt.nodeVisitId)
  assert.equal(current.attemptId, attempt.attemptId)
  assert.equal(current.generation, attempt.generation)
  assert.equal(current.delivered, undefined)
}

test('B2 default OFF and caller-forged automatic authorization both leave the ledger unchanged', async () => {
  const fx = fixture({ automaticRecoveryEnabled: false })
  try {
    await blocked(fx.ledger)
    const before = fx.bytes()
    assert.deepEqual((await fx.engine.reconcileOnce()).recoveries, [])
    for (const args of [
      { nodeVisitId: VISIT },
      { nodeVisitId: VISIT, automaticAuthorization: { kind: 'automatic', ruleRef: RECOVERY_RULE } },
    ]) {
      const result = await fx.engine.recoverAttempt(args, { kind: 'automatic', ruleRef: RECOVERY_RULE })
      assert.equal(result.outcome, 'REFUSED_CALL')
    }
    assert.equal(fx.bytes(), before)
    assert.equal(fx.calls.deliveries.length, 0)
    assert.equal(fx.calls.resolutions.length, 0)
  } finally { fx.cleanup() }
})

test('B2 ordinary planned-only is excluded even when Router reports never_existed', async () => {
  const fx = fixture()
  try {
    const planned = await fx.ledger.beginAttemptIfAbsent(intent())
    const before = fx.bytes()
    const explicit = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'owner:test' })
    assert.equal(explicit.outcome, 'RECOVERY_INAPPLICABLE')
    assert.equal(explicit.evidenceClass, 'not_pre_admission_blocked')
    assert.equal(fx.bytes(), before)
    const pass = await fx.engine.reconcileOnce()
    assert.deepEqual(pass.recoveries, [])
    noAdmission(fx, planned.attempt)
  } finally { fx.cleanup() }
})

test('B2 persistently schedules unavailable resolution, caps backoff, and consumes after reopen', async () => {
  const fx = fixture()
  try {
    const original = await blocked(fx.ledger)
    const prefix = fx.bytes()
    fx.state.resolve = async () => ({ ok: false, code: 'identity_resolution_unavailable' })
    await fx.engine.reconcileOnce()
    let current = fx.ledger.get(VISIT)
    assert.equal(current.recoveryCheck.lastResult, 'STILL_BLOCKED:identity_resolution_unavailable')
    assert.equal(current.recoveryCheck.nextCheckAtMs, T0 + 80)
    assert.equal(current.recoveryCheck.consumer, 'workflow_execution_due_poller')
    assert.equal(current.recoveryCheck.businessOutcome, 'UNKNOWN')
    const before = fx.bytes()
    assert.deepEqual((await fx.engine.reconcileOnce()).recoveries, [])
    assert.equal(fx.bytes(), before)
    const reopened = new ExecutionLedger({ dir: fx.dir, clock: fx.clock })
    const engine = fx.makeEngine(reopened)
    for (const expectedDelay of [160, 160]) {
      fx.state.now = current.recoveryCheck.nextCheckAtMs
      await engine.reconcileOnce()
      current = reopened.get(VISIT)
      assert.equal(current.recoveryCheck.nextCheckAtMs - fx.state.now, expectedDelay)
      assert.equal(current.attemptId, original.attemptId)
      assert.equal(current.generation, original.generation)
    }
    assert.ok(fx.bytes().startsWith(prefix))
    assert.equal(fx.calls.deliveries.length, 0)
    fx.state.now = current.recoveryCheck.nextCheckAtMs
    fx.state.resolve = async () => ({ ok: true, agentId: AGENT })
    const pass = await engine.reconcileOnce()
    assert.equal(pass.recoveries[0].outcome, 'RECOVERED_RUN_ADMITTED')
    assert.equal(fx.calls.deliveries.length, 1)
    assert.equal(fx.calls.deliveries[0].requestId, original.attemptId)
    const authorized = fx.events().find(e => e.kind === 'recovery_authorized')
    assert.equal(authorized.authorityRef, RECOVERY_RULE)
    assert.equal(authorized.authorization.kind, 'automatic')
    assert.equal(authorized.authorization.attemptId, original.attemptId)
    assert.equal(authorized.authorization.generation, original.generation)
    assert.equal(authorized.authorization.gateEvidence.originalExecution, 'never_started')
    assert.equal(authorized.authorization.gateEvidence.tools, 'never_dispatched')
  } finally { fx.cleanup() }
})

test('B2 finite per-pass budget postpones failed items and lets another eligible blocked item progress', async () => {
  const fx = fixture({ maxRecoveryChecksPerPoll: 1 })
  try {
    const first = await blocked(fx.ledger)
    fx.state.now += 1
    const otherIntent = { ...intent(), nodeVisitId: OTHER, ownerPrincipalId: OTHER, workflowInstanceId: OTHER }
    const second = await blocked(fx.ledger, otherIntent)
    fx.state.resolve = async owner => owner === OWNER
      ? { ok: false, code: 'identity_resolution_unavailable' } : { ok: true, agentId: AGENT }
    fx.state.read = async () => {
      const read = detail()
      read.body.detail.current_node_visit_id = OTHER
      read.body.detail.instance.workflow_instance_id = OTHER
      read.body.detail.current_visit = { node_visit_id: OTHER, workflow_instance_id: OTHER, assignee_principal_id: OTHER }
      return read
    }
    const firstPass = await fx.engine.reconcileOnce()
    assert.equal(firstPass.recoveries.length, 1)
    assert.equal(firstPass.recoveries[0].attemptId, first.attemptId)
    assert.equal(fx.ledger.get(OTHER).recoveryCheck, undefined)
    const secondPass = await fx.engine.reconcileOnce()
    assert.equal(secondPass.recoveries.length, 1)
    assert.equal(secondPass.recoveries[0].attemptId, second.attemptId)
    assert.equal(secondPass.recoveries[0].outcome, 'RECOVERED_RUN_ADMITTED')
    assert.equal(fx.calls.deliveries.length, 1)
    assert.equal(fx.calls.deliveries[0].requestId, second.attemptId)
    assert.equal(fx.ledger.get(VISIT).phase, 'resolution_blocked')
  } finally { fx.cleanup() }
})

test('B2 historical resolve_failed projects to blocked and gains same-identity automatic recovery', async () => {
  const fx = fixture()
  try {
    const result = await fx.ledger.beginAttemptIfAbsent(intent())
    appendFileSync(fx.ledger.eventsFile, `${JSON.stringify({ kind: 'delivery_failed', nodeVisitId: VISIT,
      reason: 'resolve_failed:agent_mapping_missing', atMs: T0 })}\n`)
    const originalBytes = fx.bytes()
    const pass = await fx.engine.reconcileOnce()
    assert.equal(pass.recoveries[0].outcome, 'RECOVERED_RUN_ADMITTED')
    assert.equal(fx.calls.deliveries[0].requestId, result.attempt.attemptId)
    assert.equal(fx.ledger.get(VISIT).historicalBlocked, true)
    assert.equal(fx.ledger.get(VISIT).generation, 1)
    assert.ok(fx.bytes().startsWith(originalBytes))
  } finally { fx.cleanup() }
})

const routerCases = [
  ['pending', () => ({ state: 'pending' })],
  ['settled', () => ({ state: 'settled' })],
  ['evicted', () => ({ state: 'evicted' })],
  ['restart_lost', () => ({ state: 'restart_lost' })],
  ['unavailable', () => null],
  ['throw', () => { throw new Error('injected unavailable Router') }],
  ['false absence plus handle', () => ({ state: 'never_existed', handle: 'old-live-turn' })],
  ['false absence plus epoch', () => ({ state: 'never_existed', runtimeEpoch: 'wrong-epoch' })],
]
for (const [name, correlation] of routerCases) {
  test(`B2 ${name} never grants automatic admission and retains durable UNKNOWN responsibility`, async () => {
    const fx = fixture()
    try {
      const original = await blocked(fx.ledger)
      const prefix = fx.bytes()
      fx.state.correlation = correlation
      const pass = await fx.engine.reconcileOnce()
      assert.equal(pass.recoveries[0].outcome, 'RECOVERY_INAPPLICABLE')
      noAdmission(fx, original)
      const current = fx.ledger.get(VISIT)
      assert.equal(current.phase, 'resolution_blocked')
      assert.equal(current.recoveryCheck.businessOutcome, 'UNKNOWN')
      assert.ok(current.recoveryCheck.nextCheckAtMs > fx.state.now)
      assert.ok(fx.bytes().startsWith(prefix))
      assert.equal(fx.calls.resolutions.length, 0)
    } finally { fx.cleanup() }
  })
}

test('B2 persisted WAL overrides false Router absence before any second admission', async () => {
  const fx = fixture()
  try {
    const original = await blocked(fx.ledger)
    await fx.ledger.recordDeliveryStarted({ nodeVisitId: VISIT })
    const prefix = fx.bytes()
    const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'owner:test' })
    assert.equal(result.outcome, 'RECOVERY_INAPPLICABLE')
    assert.equal(fx.bytes(), prefix)
    assert.deepEqual((await fx.engine.reconcileOnce()).recoveries, [])
    assert.equal(fx.calls.deliveries.length, 0)
    assert.equal(fx.ledger.get(VISIT).attemptId, original.attemptId)
    assert.equal(fx.events().filter(e => e.kind === 'delivery_started').length, 1)
    assert.equal(fx.events().filter(e => e.kind === 'recovery_authorized').length, 0)
  } finally { fx.cleanup() }
})

const worldCases = [
  ['moved visit', read => { read.body.detail.current_node_visit_id = OTHER }, 'RECOVERY_REFUSED'],
  ['terminal instance', read => { read.body.detail.instance.is_terminal = true }, 'RECOVERY_REFUSED'],
  ['changed assignee', read => { read.body.detail.current_visit.assignee_principal_id = OTHER }, 'RECOVERY_REFUSED'],
  ['wrong instance', read => { read.body.detail.instance.workflow_instance_id = OTHER }, 'RECOVERY_INAPPLICABLE'],
  ['missing instance identity', read => { delete read.body.detail.instance.workflow_instance_id }, 'RECOVERY_INAPPLICABLE'],
  ['missing current visit', read => { delete read.body.detail.current_visit }, 'RECOVERY_INAPPLICABLE'],
  ['missing terminal status', read => { delete read.body.detail.instance.is_terminal }, 'RECOVERY_INAPPLICABLE'],
  ['unavailable instance', read => { read.ok = false; read.code = 'http_503' }, 'RECOVERY_INAPPLICABLE'],
]
for (const [name, mutate, expected] of worldCases) {
  test(`B2 ${name} refuses fresh automatic admission`, async () => {
    const fx = fixture()
    try {
      const original = await blocked(fx.ledger)
      fx.state.read = async () => { const read = detail(); mutate(read); return read }
      const pass = await fx.engine.reconcileOnce()
      assert.equal(pass.recoveries[0].outcome, expected)
      noAdmission(fx, original)
      if (expected === 'RECOVERY_INAPPLICABLE') {
        assert.equal(fx.ledger.get(VISIT).phase, 'resolution_blocked')
        assert.ok(fx.ledger.get(VISIT).recoveryCheck.nextCheckAtMs > fx.state.now)
      } else {
        const refusal = fx.events().find(e => e.kind === 'recovery_refused')
        assert.equal(refusal.authorization.kind, 'automatic')
        assert.equal(refusal.authorization.requestId, original.attemptId)
      }
    } finally { fx.cleanup() }
  })
}

test('B2 manual and automatic callers serialize to at most one first admission', async () => {
  const fx = fixture()
  try {
    const original = await blocked(fx.ledger)
    const [automatic, manual] = await Promise.all([
      fx.engine.reconcileOnce(),
      fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'owner:concurrent-test' }),
    ])
    assert.equal(fx.calls.deliveries.length, 1)
    assert.equal(fx.calls.deliveries[0].requestId, original.attemptId)
    assert.equal(fx.events().filter(e => e.kind === 'delivery_started').length, 1)
    assert.equal(fx.events().filter(e => e.kind === 'recovery_authorized').length, 1)
    assert.ok([manual.outcome, ...automatic.recoveries.map(r => r.outcome)].includes('RECOVERED_RUN_ADMITTED'))
    assert.equal(fx.ledger.get(VISIT).generation, 1)
  } finally { fx.cleanup() }
})

test('B2 a changed target between verification and execution never receives a Run', async () => {
  const fx = fixture()
  try {
    const original = await blocked(fx.ledger)
    let reads = 0
    fx.state.resolve = async () => ({ ok: true, agentId: ++reads === 1 ? AGENT : 'agt_changed-agent' })
    const pass = await fx.engine.reconcileOnce()
    assert.equal(pass.recoveries[0].outcome, 'STILL_BLOCKED:recovery_authority_or_target_changed')
    assert.equal(fx.calls.deliveries.length, 0)
    assert.equal(fx.events().filter(e => e.kind === 'delivery_started').length, 0)
    assert.equal(fx.ledger.get(VISIT).attemptId, original.attemptId)
    assert.equal(fx.ledger.get(VISIT).recoveryCheck.businessOutcome, 'UNKNOWN')
  } finally { fx.cleanup() }
})

test('B2 revocation during fresh I/O prevents authorization and first admission', async () => {
  const fx = fixture()
  const held = barrier(detail())
  try {
    const original = await blocked(fx.ledger)
    fx.state.read = held.call
    const running = fx.engine.reconcileOnce()
    await held.arrived
    fx.config.automaticRecoveryEnabled = false
    held.release()
    const pass = await running
    assert.equal(pass.recoveries[0].outcome, 'REFUSED_CALL')
    noAdmission(fx, original)
    assert.ok(fx.ledger.get(VISIT).recoveryCheck.nextCheckAtMs > fx.state.now)
  } finally { held.release(); fx.cleanup() }
})

test('B2 an old automatic scan cannot authorize or modify a later blocked generation', async () => {
  const fx = fixture()
  try {
    const first = await blocked(fx.ledger)
    const mutate = fx.ledger.mutateWithRecord.bind(fx.ledger)
    let next, switchedBytes
    // Pause exactly between the automatic fresh scan and its locked entry.
    // A separate legal lifecycle wins: one admission, positive stale proof,
    // proven quiescence, then generation 2 blocks before its first delivery.
    fx.ledger.mutateWithRecord = async (...args) => {
      fx.ledger.mutateWithRecord = mutate
      await fx.ledger.recordRecoveryAuthorized({ nodeVisitId: VISIT, authorityRef: 'owner:race-winner' })
      await fx.ledger.recordDeliveryStarted({ nodeVisitId: VISIT })
      await fx.ledger.recordRunDelivered({ nodeVisitId: VISIT, agentId: AGENT,
        requestId: first.attemptId, sessionId: 'main', workflowStateVersionAtDispatch: 7 })
      const admitted = fx.ledger.get(VISIT)
      const settled = await fx.ledger.recordStaleSuperseded({ nodeVisitId: VISIT,
        expectedAttemptId: first.attemptId, expectedGeneration: 1,
        expected: { state: 'ACTIVE', phase: 'run_delivered', deliveredAtMs: admitted.delivered.atMs },
        observedWorkflowStateVersion: 7 })
      assert.equal(settled.committed, true)
      const replanned = await fx.ledger.beginAttemptIfAbsent(intent(),
        async () => ({ kind: 'resolution_blocked', code: 'identity_resolution_unavailable' }), () => true)
      assert.equal(replanned.created, true)
      next = structuredClone(replanned.attempt)
      switchedBytes = fx.bytes()
      return mutate(...args)
    }
    const pass = await fx.engine.reconcileOnce()
    assert.equal(pass.recoveries[0].outcome, 'REFUSED_CALL')
    assert.equal(next.generation, 2)
    assert.notEqual(next.attemptId, first.attemptId)
    assert.deepEqual(fx.ledger.get(VISIT), next)
    assert.equal(fx.bytes(), switchedBytes)
    assert.equal(fx.calls.deliveries.length, 0)
    assert.equal(fx.calls.resolutions.length, 0)
  } finally { fx.cleanup() }
})

test('B2 budgets and retry delays reject nonpositive, nonfinite, fractional, and inverted ranges', () => {
  const fx = fixture()
  try {
    for (const key of ['maxRecoveryChecksPerPoll', 'recoveryRetryDelayMs', 'recoveryMaxDelayMs']) {
      const original = fx.config[key]
      for (const invalid of [0, -1, Infinity, NaN, 0.5]) {
        fx.config[key] = invalid
        assert.throws(() => fx.makeEngine(), /finite positive integer/)
      }
      fx.config[key] = original
    }
    fx.config.recoveryMaxDelayMs = 79
    assert.throws(() => fx.makeEngine(), /invalid recovery delay range/)
  } finally { fx.cleanup() }
})

test('B2 production mount binds automatic recovery to the existing configured poller switch', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wfe-blocked-runtime-'))
  const deliveries = []
  const reads = []
  const resolutions = []
  const services = {
    brokerGateway: { execute: async (request, caller) => {
      reads.push({ request, caller })
      if (request.capabilityId === 'workflow_dispatch_intents') return { ok: true, result: { items: [] } }
      if (request.capabilityId === 'workflow_owner_obligation') {
        return { ok: false, error: { code: 'owner_obligation_not_managed' } }
      }
      assert.equal(request.capabilityId, 'workflow_instance_detail')
      assert.equal(caller.agentId, AGENT)
      return { ok: true, result: detail().body }
    } },
    agentPrincipalResolutionAccess: { handlers: { agent_resolve_principal: {
      resolve: async (args, caller) => {
        resolutions.push({ args, caller })
        return { ok: true, result: { principalId: OWNER, agentId: AGENT } }
      },
    } } },
  }
  const router = {
    deliver: async (request, provenance) => {
      deliveries.push({ request, provenance })
      return { sessionId: 'main', reconciliationHandle: 'turn:runtime-blocked' }
    },
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    getTurnReconciliation: () => ({ state: 'pending' }),
  }
  let runtime
  try {
    for (const enabled of [false, true]) {
      const dir = join(root, enabled ? 'enabled' : 'disabled')
      const seed = new ExecutionLedger({ dir })
      const original = await blocked(seed)
      const prefix = readFileSync(seed.eventsFile, 'utf8')
      runtime = mountWorkflowExecutionRuntime({
        ctx: { get: name => services[name] }, layout: { workflowExecutionDir: dir }, router,
        log: { log() {}, warn() {}, error() {} }, config: { pollerAgentId: enabled ? 'agt_fixture-poller' : '' },
      })
      assert.equal(runtime.enabled, enabled)
      const summary = enabled ? (await runtime.engine.pollOnce()).reconciled : await runtime.engine.reconcileOnce()
      if (enabled) {
        assert.equal(summary.recoveries[0].outcome, 'RECOVERED_RUN_ADMITTED')
        assert.equal(deliveries.length, 1)
        assert.equal(deliveries[0].request.requestId, original.attemptId)
        assert.equal(deliveries[0].request.sessionMode, 'main')
        assert.equal(deliveries[0].provenance.messageOrigin.kind, 'workflow_execution')
        assert.ok(resolutions.every(call => call.caller.callerAgentId === 'agt_fixture-poller'))
        const events = readFileSync(seed.eventsFile, 'utf8').trim().split('\n').map(JSON.parse)
        assert.equal(events.find(e => e.kind === 'recovery_authorized').authorization.ruleRef, RECOVERY_RULE)
      } else {
        assert.deepEqual(summary.recoveries, [])
        assert.equal(readFileSync(seed.eventsFile, 'utf8'), prefix)
        assert.equal(deliveries.length, 0)
        assert.equal(resolutions.length, 0)
        assert.equal(reads.length, 0)
      }
      await runtime.stop()
      runtime = undefined
    }
  } finally {
    await runtime?.stop()
    rmSync(root, { recursive: true, force: true })
  }
})
