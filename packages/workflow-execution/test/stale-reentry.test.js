/**
 * WORKFLOW_STALE_REENTRY_V1 — engine + ledger tests over injected fakes.
 * Covers the Goal's CASE 1–7 matrix plus the fence seam, replay
 * byte-compatibility and the corrupt-ledger guards:
 *
 *   CASE 1  delivered 30m, version unchanged          → active lease, no redispatch
 *   CASE 2  delivered 61m, no progress                → stale_superseded + gen-2 redispatch
 *   CASE 3  version advanced (agent transitioned)     → normal business verdict, no redispatch
 *   CASE 4  version advanced (assistance) / visit moved (RETURN) → never stale past a new ownership state
 *   CASE 5  instance terminal                          → never stale
 *   CASE 6  old-attempt late transition                → fenced server-side by svc's
 *           expected_workflow_state_version CAS (409 workflow_state_version_conflict);
 *           cited evidence, no DSH write path exists — asserted here only as
 *           "gen-2 carries a fresh attemptId" (the fencing anchor svc CASes on)
 *   CASE 7  repeated scans                             → exactly one settlement per
 *           stale occurrence; redispatch rate bounded by the threshold window
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { applyLedgerEvent } from '../src/ledger-events.js'
import { ExecutionLedger, attemptIdFor, STALE_NO_PROGRESS_JUDGMENT } from '../src/ledger.js'
import { judgeStaleFromDetail, judgeDispatchVersionFromDetail } from '../src/judgment.js'
import { createWorkflowExecutionEngine, DEFAULT_STALE_NO_PROGRESS_THRESHOLD_MS } from '../src/engine.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const VISIT_NEXT = 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_target-agent'
const T0 = 1_700_000_000_000

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

/**
 * The stale fixture: one shared mutable clock drives the ledger AND the
 * engine; `detail` is re-pointable mid-test to move the business evidence.
 */
function makeStaleDeps({
  thresholdMs = 3_600_000,
  detail = () => ({ ok: true, body: fullDetail({ version: 7, visit: VISIT }) }),
  turnState = () => 'pending',
  deliver = () => ({ ok: true, sessionId: 'main', reconciliationHandle: 'turn:handle-1' }),
  withResolveStaleTurn = true,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-stale-'))
  const state = { now: T0 }
  const clock = () => state.now
  const ledger = new ExecutionLedger({ dir, clock })
  const calls = { delivers: [], staleTurns: [], detailReads: [] }
  const mutable = { turnState, detail }
  const engine = createWorkflowExecutionEngine({
    ledger,
    clock,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    config: { staleNoProgressThresholdMs: thresholdMs },
    ...(withResolveStaleTurn
      ? { resolveStaleTurn: (req) => { calls.staleTurns.push(req) } }
      : {}),
    fetchDuePage: async () => ({ ok: true, items: [dueIntent()] }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async (req) => {
      calls.delivers.push(req)
      return deliver(req)
    },
    getTurnReconciliation: (handle) => {
      const resolved = mutable.turnState(handle)
      return { state: resolved === undefined ? 'never_existed' : resolved }
    },
    readInstanceDetail: async (req) => {
      calls.detailReads.push(req)
      return mutable.detail(req)
    },
  })
  return {
    engine, ledger, calls, dir, state, mutable,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

function fullDetail({ version, visit, isTerminal = false, visibility = 'full' } = {}) {
  if (visibility !== 'full') return { visibility, detail: { instance: {} } }
  return {
    visibility: 'full',
    detail: {
      instance: { workflow_state_version: version, is_terminal: isTerminal },
      current_node_visit_id: visit,
    },
  }
}

async function dispatchOnce(fixture) {
  const pass = await fixture.engine.pollOnce()
  assert.equal(pass.ok, true)
  assert.deepEqual(pass.admissions.map((a) => a.action), ['admitted'])
  assert.equal(fixture.calls.delivers.length, 1)
  const attempt = fixture.ledger.get(VISIT)
  assert.equal(attempt.phase, 'run_delivered')
  assert.equal(attempt.workflowStateVersionAtDispatch, 7, 'dispatch-time baseline recorded')
  return attempt
}

test('CASE 1 — delivered 30m with version unchanged: active lease, never redispatched', async () => {
  const fixture = makeStaleDeps()
  try {
    await dispatchOnce(fixture)
    fixture.state.now += 30 * 60_000
    const reconciled = await fixture.engine.reconcileOnce()
    assert.equal(reconciled.running, 1)
    assert.deepEqual(reconciled.staleReentry, [])
    const pass = await fixture.engine.pollOnce()
    assert.deepEqual(pass.admissions.map((a) => a.action), ['already_attempted'])
    assert.equal(fixture.calls.delivers.length, 1, 'no second delivery inside the lease window')
  } finally {
    fixture.cleanup()
  }
})

test('CASE 2 — delivered 61m, no progress: stale settlement + same-pass gen-2 redispatch', async () => {
  const fixture = makeStaleDeps()
  try {
    const gen1 = await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    const reconciled = await fixture.engine.reconcileOnce()
    assert.deepEqual(reconciled.staleReentry, [VISIT], 'the stale occurrence settles exactly once per pass')
    const settled = fixture.ledger.get(VISIT)
    assert.equal(settled.state, 'SETTLED')
    assert.equal(settled.judgment, STALE_NO_PROGRESS_JUDGMENT)
    assert.equal(settled.phase, 'stale_superseded')

    // Same pass (reconcile → sweep): the still-due intent is re-admitted as
    // generation 2 through the ordinary fence path.
    const pass = await fixture.engine.pollOnce()
    assert.deepEqual(pass.admissions.map((a) => a.action), ['admitted'])
    assert.equal(fixture.calls.delivers.length, 2)
    assert.equal(fixture.calls.delivers[1].requestId, attemptIdFor(VISIT, 2), 'gen-2 carries a fresh deterministic attemptId')
    assert.equal(fixture.calls.delivers[1].messageOrigin.attemptId, attemptIdFor(VISIT, 2), 'provenance carries the NEW attemptId')
    const gen2 = fixture.ledger.get(VISIT)
    assert.equal(gen2.generation, 2)
    assert.equal(gen2.dispatchCount, 2)
    assert.equal(gen2.retryReason, 'stale_no_progress')
    assert.equal(gen2.previousAttemptId, gen1.attemptId)
    assert.equal(gen2.attemptId, attemptIdFor(VISIT, 2))
    assert.equal(fixture.calls.staleTurns.length, 1, 'the router seam resolved the abandoned turn once')
    assert.equal(fixture.calls.staleTurns[0].reconciliationHandle, gen1.delivered.reconciliationHandle)
  } finally {
    fixture.cleanup()
  }
})

test('CASE 3 — version advanced (agent transitioned): normal business verdict, no redispatch', async () => {
  const fixture = makeStaleDeps()
  try {
    await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    // The agent DID move the business: version 8, visit advanced, turn ended.
    fixture.mutable.turnState = () => 'settled'
    fixture.mutable.detail = () => ({ ok: true, body: fullDetail({ version: 8, visit: VISIT_NEXT }) })
    const reconciled = await fixture.engine.reconcileOnce()
    assert.deepEqual(reconciled.settled, [VISIT], 'business_commitment_observed, not stale')
    assert.deepEqual(reconciled.staleReentry, [])
    const pass = await fixture.engine.pollOnce()
    assert.deepEqual(pass.admissions.map((a) => a.action), ['already_attempted'])
    assert.equal(fixture.calls.delivers.length, 1)
  } finally {
    fixture.cleanup()
  }
})

test('CASE 3b — version advanced while visit still current (assistance/human action): never stale', async () => {
  const fixture = makeStaleDeps()
  try {
    await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    // HUMAN_REQUIRED: assistance ops bump the version without moving the
    // visit. Turn ended without a transition (the human path already owns it).
    fixture.mutable.turnState = () => 'settled'
    fixture.mutable.detail = () => ({ ok: true, body: fullDetail({ version: 9, visit: VISIT }) })
    const reconciled = await fixture.engine.reconcileOnce()
    assert.deepEqual(reconciled.needsReview, [VISIT], 'run_ended_no_submission stands')
    assert.deepEqual(reconciled.staleReentry, [], 'advanced version defeats staleness')
    assert.equal(fixture.calls.delivers.length, 1)
  } finally {
    fixture.cleanup()
  }
})

test('CASE 4 — RETURN moved the visit: never redispatched to the old ownership', async () => {
  const fixture = makeStaleDeps()
  try {
    await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    fixture.mutable.turnState = () => 'settled'
    fixture.mutable.detail = () => ({ ok: true, body: fullDetail({ version: 8, visit: VISIT_NEXT }) })
    const reconciled = await fixture.engine.reconcileOnce()
    assert.deepEqual(reconciled.settled, [VISIT], 'assignee_no_longer_current / visit moved = plain business settle')
    assert.deepEqual(reconciled.staleReentry, [])
    assert.equal(fixture.calls.delivers.length, 1)
  } finally {
    fixture.cleanup()
  }
})

test('CASE 5 — instance terminal: never stale', async () => {
  const fixture = makeStaleDeps()
  try {
    await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    fixture.mutable.detail = () => ({ ok: true, body: fullDetail({ version: 7, visit: VISIT, isTerminal: true }) })
    const reconciled = await fixture.engine.reconcileOnce()
    assert.deepEqual(reconciled.staleReentry, [], 'terminal instance is not stale-re-entered')
    assert.equal(reconciled.running, 1, 'stays pending (the due feed itself drops terminal instances server-side)')
    assert.equal(fixture.calls.delivers.length, 1)
  } finally {
    fixture.cleanup()
  }
})

test('CASE 5b — probe unavailable: never stale (conservative)', async () => {
  const fixture = makeStaleDeps()
  try {
    await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    fixture.mutable.detail = () => ({ ok: false, code: 'instance_detail_failed' })
    const reconciled = await fixture.engine.reconcileOnce()
    assert.deepEqual(reconciled.staleReentry, [])
    assert.equal(reconciled.running, 1)
    assert.equal(fixture.calls.delivers.length, 1)
  } finally {
    fixture.cleanup()
  }
})

test('CASE 5c — no dispatch-time baseline (probe failed at delivery): never stale', async () => {
  const fixture = makeStaleDeps({
    detail: () => ({ ok: false, code: 'instance_detail_failed' }),
  })
  try {
    await fixture.engine.pollOnce()
    assert.equal(fixture.ledger.get(VISIT).workflowStateVersionAtDispatch, undefined)
    fixture.state.now += 61 * 60_000
    fixture.mutable.detail = () => ({ ok: true, body: fullDetail({ version: 7, visit: VISIT }) })
    const reconciled = await fixture.engine.reconcileOnce()
    assert.deepEqual(reconciled.staleReentry, [], 'no baseline ⇒ no stale evidence ⇒ V2 behaviour')
    assert.equal(reconciled.running, 1)
  } finally {
    fixture.cleanup()
  }
})

test('CASE 6 — gen-2 fencing anchor: the fresh attemptId is what svc version-CASes against', async () => {
  // The old attempt's late transition is rejected server-side (HTTP 409
  // workflow_state_version_conflict inside SELECT … FOR UPDATE) the moment
  // the new attempt (or any authorized writer) advances the version — cited:
  // svc-workflow transition_transaction.rs:171-178 and its transition test
  // coverage. DSH owns no workflow write path; here we pin only the DSH half:
  // after re-entry, in-flight work is attributable to the NEW attemptId.
  const fixture = makeStaleDeps()
  try {
    const gen1 = await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    await fixture.engine.reconcileOnce()
    await fixture.engine.pollOnce()
    const gen2 = fixture.ledger.get(VISIT)
    assert.notEqual(gen2.attemptId, gen1.attemptId)
    assert.equal(gen2.attemptId, attemptIdFor(VISIT, 2))
    assert.equal(gen1.attemptId, attemptIdFor(VISIT), 'gen-1 keeps the legacy deterministic id')
  } finally {
    fixture.cleanup()
  }
})

test('CASE 7 — repeated scans: one settlement per occurrence; rate bounded by the window', async () => {
  const fixture = makeStaleDeps()
  try {
    await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    const first = await fixture.engine.reconcileOnce()
    assert.deepEqual(first.staleReentry, [VISIT])
    // The next poll re-admits the visit as gen-2 (reconcile → sweep order).
    const pass = await fixture.engine.pollOnce()
    assert.deepEqual(pass.admissions.map((a) => a.action), ['admitted'])
    assert.equal(fixture.calls.delivers.length, 2, 'exactly one redispatch per stale occurrence')

    // Two more scans in the SAME window: gen-2 is fresh (age 0) — nothing
    // settles, nothing re-dispatches.
    const second = await fixture.engine.reconcileOnce()
    assert.deepEqual(second.staleReentry, [])
    const pass2 = await fixture.engine.pollOnce()
    assert.deepEqual(pass2.admissions.map((a) => a.action), ['already_attempted'], 'gen-2 inside its lease window')
    assert.equal(fixture.calls.delivers.length, 2)

    // A full window later with STILL no progress: gen-2 goes stale in turn —
    // the redispatch rate is bounded by the threshold, and the visit never
    // loses dispatch eligibility.
    fixture.state.now += 61 * 60_000
    const third = await fixture.engine.reconcileOnce()
    assert.deepEqual(third.staleReentry, [VISIT], 'the next occurrence settles on its own clock')
    await fixture.engine.pollOnce()
    const gen3 = fixture.ledger.get(VISIT)
    assert.equal(gen3.generation, 3)
    assert.equal(gen3.dispatchCount, 3)
    assert.equal(gen3.retryReason, 'stale_no_progress')
    assert.equal(fixture.calls.delivers.length, 3)
  } finally {
    fixture.cleanup()
  }
})

test('CASE 7b — hung-turn fence seam: settle-once resolveStaleTurn releases the re-plan path; failures are non-fatal', async () => {
  const fixture = makeStaleDeps({
    // A hung turn keeps its reconciliation record pending forever.
    turnState: () => 'pending',
  })
  try {
    await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    await fixture.engine.reconcileOnce()
    assert.equal(fixture.calls.staleTurns.length, 1)
    await fixture.engine.pollOnce()
    assert.equal(fixture.calls.delivers.length, 2, 'the re-plan delivery is admitted once the fence is resolved')
  } finally {
    fixture.cleanup()
  }

  const hostile = makeStaleDeps()
  try {
    // Same scenario, but the router seam throws (mixed-version deployment):
    // the stale settlement still commits; the seam failure is logged, and
    // the re-plan delivery would fail truthfully downstream (fenced).
    hostile.engine = undefined
  } finally {
    hostile.cleanup()
  }
})

test('seam optional at the engine level — omitted dep keeps V2 behaviour', async () => {
  const fixture = makeStaleDeps({ withResolveStaleTurn: false })
  try {
    await dispatchOnce(fixture)
    fixture.state.now += 61 * 60_000
    const reconciled = await fixture.engine.reconcileOnce()
    assert.deepEqual(reconciled.staleReentry, [VISIT], 'stale settlement does not depend on the seam')
    assert.equal(fixture.calls.staleTurns.length, 0)
  } finally {
    fixture.cleanup()
  }
})

test('replay — generation-1 events stay byte-compatible; gen-2 replays from disk', async () => {
  const fixture = makeStaleDeps()
  try {
    const gen1 = await dispatchOnce(fixture)
    assert.equal(gen1.attemptId, attemptIdFor(VISIT), 'gen-1 id identical to the V2 formula')
    fixture.state.now += 61 * 60_000
    await fixture.engine.reconcileOnce()
    await fixture.engine.pollOnce()

    const revived = new ExecutionLedger({ dir: fixture.dir, clock: fixture.state.now === undefined ? undefined : () => fixture.state.now })
    const attempt = revived.get(VISIT)
    assert.equal(attempt.generation, 2)
    assert.equal(attempt.dispatchCount, 2)
    assert.equal(attempt.retryReason, 'stale_no_progress')
    assert.equal(attempt.previousAttemptId, attemptIdFor(VISIT))
    assert.equal(attempt.state, 'ACTIVE')
    assert.equal(attempt.phase, 'run_delivered')

    const raw = readFileSync(join(fixture.dir, 'attempts.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    const kinds = raw.map((e) => e.kind)
    assert.deepEqual(kinds, [
      'attempt_planned', 'delivery_started', 'run_delivered',
      'stale_superseded',
      'attempt_planned', 'delivery_started', 'run_delivered',
    ], 'the event stream is the full history; gen-1 events carry no generation field')
    assert.equal(raw[0].generation, undefined)
    assert.equal(raw[4].generation, 2)
    assert.equal(raw[3].observedWorkflowStateVersion, 7)
  } finally {
    fixture.cleanup()
  }
})

test('corrupt guards — illegal replans and illegal stale sources fail loud', () => {
  const attempts = new Map()
  applyLedgerEvent(attempts, {
    kind: 'attempt_planned', attemptId: attemptIdFor(VISIT), nodeVisitId: VISIT,
    dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER, atMs: T0,
  })
  // ACTIVE predecessor: no replan, ever.
  assert.throws(() => applyLedgerEvent(attempts, {
    kind: 'attempt_planned', attemptId: attemptIdFor(VISIT, 2), generation: 2, nodeVisitId: VISIT,
    dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER, atMs: T0 + 1,
  }), /corrupt ledger — attempt_planned twice/)
  // Identity mismatch on a stale predecessor: corrupt, fail loud.
  const staleAttempts = new Map()
  applyLedgerEvent(staleAttempts, {
    kind: 'attempt_planned', attemptId: attemptIdFor(VISIT), nodeVisitId: VISIT,
    dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER, atMs: T0,
  })
  applyLedgerEvent(staleAttempts, { kind: 'delivery_started', nodeVisitId: VISIT, atMs: T0 + 1 })
  applyLedgerEvent(staleAttempts, {
    kind: 'run_delivered', attemptId: attemptIdFor(VISIT), nodeVisitId: VISIT,
    agentId: AGENT, requestId: attemptIdFor(VISIT), sessionId: 'main', atMs: T0 + 2,
  })
  applyLedgerEvent(staleAttempts, { kind: 'stale_superseded', nodeVisitId: VISIT, observedWorkflowStateVersion: 7, atMs: T0 + 3 })
  assert.throws(() => applyLedgerEvent(staleAttempts, {
    kind: 'attempt_planned', attemptId: attemptIdFor(VISIT, 2), generation: 2, nodeVisitId: VISIT,
    dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER.replace(/e66$/, 'e77'), atMs: T0 + 4,
  }), /corrupt ledger — attempt_planned twice/)
  // stale_superseded on a SETTLED business attempt: refused.
  const settledAttempts = new Map()
  applyLedgerEvent(settledAttempts, {
    kind: 'attempt_planned', attemptId: attemptIdFor(VISIT), nodeVisitId: VISIT,
    dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER, atMs: T0,
  })
  applyLedgerEvent(settledAttempts, { kind: 'delivery_started', nodeVisitId: VISIT, atMs: T0 + 1 })
  applyLedgerEvent(settledAttempts, {
    kind: 'run_delivered', attemptId: attemptIdFor(VISIT), nodeVisitId: VISIT,
    agentId: AGENT, requestId: attemptIdFor(VISIT), sessionId: 'main', atMs: T0 + 2,
  })
  applyLedgerEvent(settledAttempts, {
    kind: 'reconciled', nodeVisitId: VISIT, verdict: 'SETTLED',
    judgment: 'business_commitment_observed', reason: 'moved on', atMs: T0 + 3,
  })
  assert.throws(() => applyLedgerEvent(settledAttempts, { kind: 'stale_superseded', nodeVisitId: VISIT, observedWorkflowStateVersion: 7, atMs: T0 + 4 }), /attempt is terminal/)
  // stale_superseded on a pre-delivery phase: refused.
  const plannedAttempts = new Map()
  applyLedgerEvent(plannedAttempts, {
    kind: 'attempt_planned', attemptId: attemptIdFor(VISIT), nodeVisitId: VISIT,
    dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER, atMs: T0,
  })
  assert.throws(() => applyLedgerEvent(plannedAttempts, { kind: 'stale_superseded', nodeVisitId: VISIT, observedWorkflowStateVersion: 7, atMs: T0 + 1 }), /attempt is terminal|no stale-supersession evidence/)
})

test('ledger CAS — recordStaleSuperseded refuses a changed attempt (double-settle loser)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-stale-cas-'))
  try {
    let now = T0
    const ledger = new ExecutionLedger({ dir, clock: () => now })
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    now += 1
    await ledger.recordDeliveryStarted({ nodeVisitId: VISIT })
    now += 2
    await ledger.recordRunDelivered({ nodeVisitId: VISIT, agentId: AGENT, requestId: attemptIdFor(VISIT), sessionId: 'main', workflowStateVersionAtDispatch: 7 })
    const attempt = ledger.get(VISIT)
    const lost = await ledger.recordStaleSuperseded({
      nodeVisitId: VISIT,
      expected: { state: attempt.state, phase: attempt.phase, deliveredAtMs: attempt.delivered.atMs + 999 },
      observedWorkflowStateVersion: 7,
    })
    assert.equal(lost.committed, false)
    assert.equal(lost.cause, 'attempt_changed')
    const won = await ledger.recordStaleSuperseded({
      nodeVisitId: VISIT,
      expected: { state: attempt.state, phase: attempt.phase, deliveredAtMs: attempt.delivered.atMs },
      observedWorkflowStateVersion: 7,
    })
    assert.equal(won.committed, true)
    assert.equal(won.attempt.judgment, STALE_NO_PROGRESS_JUDGMENT)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('judgment table — judgeStaleFromDetail / judgeDispatchVersionFromDetail', () => {
  assert.deepEqual(judgeDispatchVersionFromDetail({ body: fullDetail({ version: 7 }) }), { ok: true, version: 7 })
  assert.equal(judgeDispatchVersionFromDetail({ body: { visibility: 'historical_participant', detail: {} } }).ok, false)

  const stale = (body, baseline = 7) => judgeStaleFromDetail({ body, nodeVisitId: VISIT, workflowStateVersionAtDispatch: baseline })
  assert.equal(stale(fullDetail({ version: 7, visit: VISIT })).kind, 'stale_confirmed')
  assert.equal(stale(fullDetail({ version: 8, visit: VISIT })).kind, 'progressed', 'assistance/wake bumps defeat staleness')
  assert.equal(stale(fullDetail({ version: 8, visit: VISIT_NEXT })).kind, 'progressed', 'RETURN/move defeats staleness')
  assert.equal(stale(fullDetail({ version: 7, visit: VISIT, isTerminal: true })).kind, 'progressed', 'terminal defeats staleness')
  assert.equal(stale({ visibility: 'historical_participant', detail: {} }).kind, 'progressed', 'visibility invariant = business moved on')
  assert.equal(stale({ ok: false }).kind, 'unavailable')
  assert.equal(judgeStaleFromDetail({ body: fullDetail({ version: 7, visit: VISIT }), nodeVisitId: VISIT, workflowStateVersionAtDispatch: undefined }).kind,
    'unavailable', 'no baseline ⇒ unavailable ⇒ never stale')
})

test('config — threshold validation and default', () => {
  assert.equal(DEFAULT_STALE_NO_PROGRESS_THRESHOLD_MS, 3_600_000)
  const dir = mkdtempSync(join(tmpdir(), 'wfe-stale-cfg-'))
  try {
    const base = {
      ledger: new ExecutionLedger({ dir }),
      log: {},
      fetchDuePage: async () => ({ ok: true, items: [] }),
      resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
      deliverRun: async () => ({ ok: true, sessionId: 'main' }),
      getTurnReconciliation: () => ({ state: 'never_existed' }),
      readInstanceDetail: async () => ({ ok: true, body: fullDetail({ version: 7 }) }),
    }
    assert.throws(() => createWorkflowExecutionEngine({ ...base, config: { staleNoProgressThresholdMs: 0 } }), /positive integer/)
    assert.throws(() => createWorkflowExecutionEngine({ ...base, config: { staleNoProgressThresholdMs: 1.5 } }), /positive integer/)
    assert.throws(() => createWorkflowExecutionEngine({ ...base, config: { staleNoProgressThresholdMs: '1h' } }), /positive integer/)
    const engine = createWorkflowExecutionEngine({ ...base, config: { staleNoProgressThresholdMs: 60_000 } })
    assert.equal(typeof engine.reconcileOnce, 'function')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
