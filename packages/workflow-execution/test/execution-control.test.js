/**
 * WORKFLOW_EXECUTION_CONTROL_V1 — agent-core slice tests (CTR-WEC1-001..006).
 *
 * Covers the Goal §12 cases that live on the execution side:
 *   Case 3  run_ended_no_submission → policy retry delay → generation N+1
 *   Case 4  attempt limit → ONE escalation (ledger fact idempotent)
 *   Case 7  outcome_unknown never re-enters on a timeout alone
 *   Case 9  restart: the projection recovers from the replayed file
 * plus the CTR-WEC1-002 state table, the fence limit, and kick coalescing.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor, DEFAULT_MAX_ATTEMPTS_PER_VISIT } from '../src/ledger.js'
import { createWorkflowExecutionEngine, DEFAULT_RETRY_DELAY_MS } from '../src/engine.js'
import { executionStateFor, projectExecutionTrace, projectExecutionTraces } from '../src/projection.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_target-agent'

function dueIntent(overrides = {}) {
  return {
    dispatchIntentId: INTENT,
    nodeVisitId: VISIT,
    workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER,
    nextEligibleAt: '2026-09-09T01:00:00Z',
    createdAt: '2026-09-09T00:00:00Z',
    updatedAt: '2026-09-09T00:30:00Z',
    ...overrides,
  }
}

// ── CTR-WEC1-002: the deterministic execution state table ──────────────────

test('CTR-WEC1-002: every ledger fact class maps to its executionState', () => {
  const base = {
    attemptId: 'wfeat-x', nodeVisitId: VISIT, dispatchIntentId: INTENT,
    workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER, createdAtMs: 1,
  }
  assert.equal(executionStateFor({ ...base, state: 'ACTIVE', phase: 'planned' }).state, 'DISPATCHED')
  assert.equal(executionStateFor({ ...base, state: 'ACTIVE', phase: 'delivery_started' }).state, 'DISPATCHED')
  assert.equal(executionStateFor({ ...base, state: 'ACTIVE', phase: 'run_delivered', delivered: {} }).state, 'RUNNING')
  assert.equal(executionStateFor({ ...base, state: 'ACTIVE', phase: 'resolution_blocked' }).state, 'BLOCKED')
  assert.equal(executionStateFor({ ...base, state: 'NEEDS_REVIEW', phase: 'reconciled', judgment: 'run_ended_no_submission' }).state, 'RUN_ENDED_NO_TRANSITION')
  assert.equal(executionStateFor({ ...base, state: 'NEEDS_REVIEW', phase: 'reconciled', judgment: 'run_outcome_unknown' }).state, 'OUTCOME_UNKNOWN')
  assert.equal(executionStateFor({ ...base, state: 'NEEDS_REVIEW', phase: 'delivery_failed' }).state, 'OUTCOME_UNKNOWN')
  assert.equal(executionStateFor({ ...base, state: 'NEEDS_REVIEW', phase: 'reconciled', judgment: 'delivery_unverified' }).state, 'OUTCOME_UNKNOWN')
  assert.equal(
    executionStateFor({ ...base, state: 'NEEDS_REVIEW', phase: 'reconciled', judgment: 'run_outcome_unknown', escalation: { reason: 'ATTEMPTS_EXHAUSTED', atMs: 2 } }).state,
    'HUMAN_REQUIRED',
  )
  assert.equal(executionStateFor({ ...base, state: 'SETTLED', judgment: 'stale_no_progress' }).state, 'STALE_NO_PROGRESS')
  assert.equal(executionStateFor({ ...base, state: 'SETTLED', judgment: 'business_commitment_observed' }).state, 'SETTLED')
})

test('CTR-WEC1-001: projection groups by workflowInstanceId and exposes the attempt chain', () => {
  const attempts = [{
    attemptId: attemptIdFor(VISIT), nodeVisitId: VISIT, generation: 2, dispatchCount: 2,
    dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER,
    state: 'NEEDS_REVIEW', phase: 'reconciled', judgment: 'run_ended_no_submission',
    createdAtMs: 10,
    delivered: { agentId: AGENT, requestId: attemptIdFor(VISIT, 2), sessionId: 'main', reconciliationHandle: 'turn:h', messageId: 'm1', atMs: 20 },
    reconciledAtMs: 30,
    escalation: { reason: 'ATTEMPTS_EXHAUSTED', attemptCount: 2, atMs: 40 },
  }]
  const all = projectExecutionTraces(attempts)
  assert.deepEqual(Object.keys(all), [INSTANCE])
  const trace = projectExecutionTrace(attempts, { workflowInstanceId: INSTANCE })
  assert.equal(trace.nodeVisits.length, 1)
  const visit = trace.nodeVisits[0]
  assert.equal(visit.nodeVisitId, VISIT)
  assert.equal(visit.generation, 2)
  assert.equal(visit.dispatchIntentId, INTENT)
  assert.equal(visit.agentId, AGENT)
  assert.equal(visit.sessionId, 'main')
  assert.equal(visit.reconciliationHandle, 'turn:h')
  assert.equal(visit.executionState, 'HUMAN_REQUIRED')
  assert.equal(visit.attemptCount, 2)
  assert.equal(visit.escalation.reason, 'ATTEMPTS_EXHAUSTED')
  assert.equal(projectExecutionTrace(attempts, { workflowInstanceId: INSTANCE, nodeVisitId: VISIT }).nodeVisits.length, 1)
  assert.equal(projectExecutionTrace(attempts, { workflowInstanceId: INSTANCE, nodeVisitId: '9d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e99' }), null)
  assert.equal(projectExecutionTrace(attempts, { workflowInstanceId: 'aa5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e12' }), null)
})

// ── CTR-WEC1-004: the fence enforces the attempt limit ─────────────────────

test('CTR-WEC1-004: the fence refuses a mint past maxAttemptsPerVisit (default 3)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-limit-'))
  try {
    const ledger = new ExecutionLedger({ dir, maxAttemptsPerVisit: 2 })
    const seed = {
      dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER,
    }
    // generation 1 → deliver → stale-supersede
    let r = await ledger.beginAttemptIfAbsent(seed)
    assert.equal(r.created, true)
    await ledger.recordRunDelivered({ nodeVisitId: VISIT, agentId: AGENT, requestId: attemptIdFor(VISIT), sessionId: 'main' })
    await ledger.recordStaleSuperseded({ nodeVisitId: VISIT, expected: { state: 'ACTIVE', phase: 'run_delivered', deliveredAtMs: ledger.get(VISIT).delivered.atMs }, observedWorkflowStateVersion: 1 })
    // generation 2 → deliver → stale-supersede
    r = await ledger.beginAttemptIfAbsent(seed)
    assert.equal(r.created, true)
    assert.equal(r.attempt.generation, 2)
    await ledger.recordRunDelivered({ nodeVisitId: VISIT, agentId: AGENT, requestId: attemptIdFor(VISIT, 2), sessionId: 'main' })
    await ledger.recordStaleSuperseded({ nodeVisitId: VISIT, expected: { state: 'ACTIVE', phase: 'run_delivered', deliveredAtMs: ledger.get(VISIT).delivered.atMs }, observedWorkflowStateVersion: 1 })
    // generation 3 would exceed maxAttemptsPerVisit=2 → clean refusal
    r = await ledger.beginAttemptIfAbsent(seed)
    assert.equal(r.created, false)
    assert.equal(r.cause, 'attempt_limit_reached')

    // A DEFAULT ledger keeps the old unbounded... no: the default limit is 3.
    const defaults = new ExecutionLedger({ dir: mkdtempSync(join(tmpdir(), 'wfe-limit-')) })
    try {
      assert.equal(defaults.maxAttemptsPerVisit, DEFAULT_MAX_ATTEMPTS_PER_VISIT)
    } finally {
      rmSync(defaults.dir, { recursive: true, force: true })
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── CTR-WEC1-005: ONE escalation per visit, ledger fact as the marker ──────

test('CTR-WEC1-005: limit refusal escalates exactly once and records the fact', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-esc-'))
  const escalations = []
  try {
    // The ledger shares the ENGINE's test clock: stale/delay windows are
    // evaluated against the same timeline the test advances.
    let t = 1_000
    const clock = () => t
    const ledger = new ExecutionLedger({ dir, maxAttemptsPerVisit: 1, clock })
    const engine = createWorkflowExecutionEngine({
      ledger,
      clock,
      fetchDuePage: async () => ({ ok: true, items: [dueIntent()] }),
      resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
      deliverRun: async () => ({ ok: true, sessionId: 'main', reconciliationHandle: 'turn:h1' }),
      getTurnReconciliation: () => ({ state: 'settled' }),
      readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1, is_terminal: false }, current_node_visit_id: VISIT } } }),
      escalateAttemptLimit: async (payload) => {
        escalations.push(payload)
        return { ok: true, escalated: true, assistanceCaseId: 'case-1' }
      },
    })
    // generation 1: admitted, run delivered, then the run ends without a
    // submission → the stale clock settles it stale (generation == limit).
    await engine.admitDueIntent(dueIntent())
    const attempt = ledger.get(VISIT)
    t = attempt.delivered.atMs + 3_600_000
    const summary = await engine.reconcileOnce()
    assert.deepEqual(summary.staleReentry, [VISIT])

    // The visit is re-offered: the fence (limit 1) refuses → ONE escalation.
    const result = await engine.admitDueIntent(dueIntent())
    assert.equal(result.action, 'attempt_limit_reached')
    assert.equal(escalations.length, 1)
    assert.equal(escalations[0].nodeVisitId, VISIT)
    assert.equal(escalations[0].attemptCount, 1)
    assert.equal(escalations[0].reason, 'ATTEMPTS_EXHAUSTED')
    assert.equal(ledger.get(VISIT).escalation.reason, 'ATTEMPTS_EXHAUSTED')

    // A later pass re-offers the visit: NO second escalation call or event.
    const again = await engine.admitDueIntent(dueIntent())
    assert.equal(again.action, 'attempt_limit_reached')
    assert.equal(escalations.length, 1)

    // The projection surfaces the escalation fact; per the CTR-WEC1-002
    // table the SETTLED/stale chain keeps its judgment class
    // (STALE_NO_PROGRESS) — the escalation object is the HUMAN_REQUIRED
    // marker (a NEEDS_REVIEW chain would read HUMAN_REQUIRED).
    const trace = projectExecutionTrace(await ledger.snapshotFresh(), { workflowInstanceId: INSTANCE })
    assert.equal(trace.nodeVisits[0].executionState, 'STALE_NO_PROGRESS')
    assert.equal(trace.nodeVisits[0].escalation.reason, 'ATTEMPTS_EXHAUSTED')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── Goal Case 3 + Case 7: the run-ended fast path and the unknown fence ────

test('Case 3: run_ended_no_submission re-enters after the retry delay; Case 7: outcome_unknown never does', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-retry-'))
  const escalations = []
  try {
    // The ledger shares the ENGINE's test clock (the delay/threshold windows
    // are evaluated with the ledger's clock inside its fresh enumerations).
    let t = 10_000
    const clock = () => t
    const ledger = new ExecutionLedger({ dir, maxAttemptsPerVisit: 3, clock })
    let dueItems = [dueIntent()]
    const engine = createWorkflowExecutionEngine({
      ledger,
      clock,
      config: { staleNoProgressThresholdMs: 3_600_000, retryDelayMs: 1_000 },
      fetchDuePage: async () => ({ ok: true, items: dueItems }),
      resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
      deliverRun: async () => ({ ok: true, sessionId: 'main', reconciliationHandle: `turn:h${clock()}` }),
      getTurnReconciliation: () => ({ state: 'settled' }),
      readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1, is_terminal: false }, current_node_visit_id: VISIT } } }),
      escalateAttemptLimit: async (payload) => {
        escalations.push(payload)
        return { ok: true, escalated: true }
      },
    })

    // Attempt #1: admitted, run ends without a submission → NEEDS_REVIEW.
    await engine.admitDueIntent(dueIntent())
    const deliveredAtMs = ledger.get(VISIT).delivered.atMs
    t = deliveredAtMs + 2_000 // turn settles quickly; reconcile marks run-ended
    let summary = await engine.reconcileOnce()
    assert.deepEqual(summary.needsReview, [VISIT])
    assert.equal(ledger.get(VISIT).judgment, 'run_ended_no_submission')

    // Before the retry delay: no fast re-entry.
    t = ledger.get(VISIT).reconciledAtMs + 500
    summary = await engine.reconcileOnce()
    assert.equal(summary.staleReentry.length, 0)

    // Past the retry delay (still far below the 1h stale clock): the probe's
    // positive business evidence (visit current, version unchanged) settles
    // the attempt stale → the visit is re-entry eligible.
    t = ledger.get(VISIT).reconciledAtMs + 1_500
    summary = await engine.reconcileOnce()
    assert.deepEqual(summary.staleReentry, [VISIT])

    // The next sweep mints generation 2 through the SAME fence (Attempt #2).
    const result = await engine.admitDueIntent(dueIntent())
    assert.equal(result.action, 'admitted')
    assert.equal(ledger.get(VISIT).generation, 2)
    assert.equal(escalations.length, 0)

    // Case 7: an outcome_unknown attempt NEVER enters the fast class — and
    // the conservative 1h stale clock still applies to it (well within this
    // assertion's time window).
    await ledger.recordReconciled({
      nodeVisitId: VISIT, expectedPhase: 'run_delivered',
      verdict: 'NEEDS_REVIEW', judgment: 'run_outcome_unknown', reason: 'timeout',
    })
    t = ledger.get(VISIT).reconciledAtMs + 5_000 // past the 1s retry delay, far below the 1h stale clock
    summary = await engine.reconcileOnce()
    assert.equal(summary.staleReentry.length, 0, 'unknown never re-runs on a timeout alone')
    assert.equal(ledger.get(VISIT).judgment, 'run_outcome_unknown')
    assert.equal(escalations.length, 0)
    dueItems = [] // stop the sweep from re-admitting in later passes
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── CTR-WEC1-006: kicks coalesce, never stack ──────────────────────────────

test('CTR-WEC1-006: kick triggers one poll; a poll in flight coalesces further kicks', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-kick-'))
  try {
    const ledger = new ExecutionLedger({ dir })
    let release
    const gate = new Promise((resolve) => { release = resolve })
    let polls = 0
    const engine = createWorkflowExecutionEngine({
      ledger,
      fetchDuePage: async () => {
        polls += 1
        await gate
        return { ok: true, items: [] }
      },
      resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
      deliverRun: async () => ({ ok: true, sessionId: 'main' }),
      getTurnReconciliation: () => ({ state: 'never_existed' }),
      readInstanceDetail: async () => ({ ok: false, code: 'x' }),
    })
    const first = engine.pollOnce()
    assert.deepEqual(engine.kick(), { ok: true, coalesced: true }, 'an in-flight poll absorbs the kick')
    release()
    await first
    assert.equal(polls, 1)

    const second = engine.kick()
    assert.deepEqual(second, { ok: true, kicked: true })
    for (let i = 0; i < 50 && polls < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert.ok(polls >= 2, 'the kick ran one coalesced poll')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── Goal Case 9: restart recovers everything from the replayed file ────────

test('Case 9: restart — the trace projection recovers from the replayed ledger file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-restart-'))
  try {
    const first = new ExecutionLedger({ dir })
    const r = await first.beginAttemptIfAbsent({
      dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER,
    })
    await first.recordRunDelivered({ nodeVisitId: VISIT, agentId: AGENT, requestId: attemptIdFor(VISIT), sessionId: 'main', reconciliationHandle: 'turn:h9' })
    await first.recordReconciled({
      nodeVisitId: VISIT, expectedPhase: 'run_delivered',
      verdict: 'NEEDS_REVIEW', judgment: 'run_ended_no_submission', reason: 'run ended',
    })

    // A brand-new ledger instance (simulated process restart) replays the
    // file and the projection answers identically from durable facts.
    const second = new ExecutionLedger({ dir })
    const trace = projectExecutionTrace(await second.snapshotFresh(), { workflowInstanceId: INSTANCE })
    assert.equal(trace.nodeVisits.length, 1)
    const visit = trace.nodeVisits[0]
    assert.equal(visit.attemptId, attemptIdFor(VISIT))
    assert.equal(visit.sessionId, 'main')
    assert.equal(visit.reconciliationHandle, 'turn:h9')
    assert.equal(visit.executionState, 'RUN_ENDED_NO_TRANSITION')
    assert.equal(visit.attemptCount, 1)
    void r
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('config validation: non-positive retryDelayMs fails loud', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-cfg-'))
  try {
    const ledger = new ExecutionLedger({ dir })
    assert.throws(
      () => createWorkflowExecutionEngine({
        ledger,
        fetchDuePage: async () => ({ ok: true, items: [] }),
        resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
        deliverRun: async () => ({ ok: true, sessionId: 'main' }),
        getTurnReconciliation: () => ({ state: 'never_existed' }),
        readInstanceDetail: async () => ({ ok: false, code: 'x' }),
        config: { retryDelayMs: 0 },
      }),
      /retryDelayMs must be a positive integer/,
    )
    assert.equal(DEFAULT_RETRY_DELAY_MS, 60_000)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// Silence unused-variable lint for the deliberate seed helper re-export.
void writeFileSync
