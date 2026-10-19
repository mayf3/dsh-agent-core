/**
 * ADMISSION_ASSISTANCE_RESUME_REPRODUCTION_20261019 — SOURCE-only isolation
 * reproduction for mayf3/agent-control#1214 (hypothesis, NOT a production
 * root-cause claim): after an assistance open→Owner resolve pair bumps
 * `workflow_state_version` without moving the visit, does ANY existing
 * engine path legally re-enter the SAME visit?
 *
 * Matrix (per command):
 *   1. terminal run, visit still current, assignee unchanged; open+resolve
 *      version increments → due candidate → judgment → ledger refusal;
 *      delivery count; recovery-operation probe; repeated scans idempotent.
 *   2. control: version unchanged stale_no_progress CAN re-enter; visit
 *      moved / terminal business MUST NOT re-dispatch.
 *   3. outcome_unknown / running / still-OPEN states never re-dispatch;
 *      resolve cannot clear UNKNOWN.
 *   4. budget exhausted: existing refusal only; no reset/fence/budget API.
 *
 * Real engine (createWorkflowExecutionEngine) + real ExecutionLedger over a
 * temp dir; ONLY the transport seams (due feed, detail read, turn state,
 * delivery) are fakes — synthetic ids throughout, no svc/network/production.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor, STALE_NO_PROGRESS_JUDGMENT } from '../src/ledger.js'
import { createWorkflowExecutionEngine } from '../src/engine.js'
import { createRecoveryOperation } from '../src/recovery.js'

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

function fullDetail({ version, visit, isTerminal = false } = {}) {
  return {
    visibility: 'full',
    detail: {
      instance: { workflow_state_version: version, is_terminal: isTerminal },
      current_node_visit_id: visit,
    },
  }
}

/**
 * Shared fixture: one mutable clock, temp-dir ledger, engine over fake
 * seams; `detailSeq` lets a test step the observed business version across
 * reconcile passes (open → resolve), `turnState` re-points per handle.
 */
function makeFixture({
  maxAttemptsPerVisit,
  retryDelayMs = 60_000,
  thresholdMs = 3_600_000,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-assist-'))
  const state = { now: T0 }
  const clock = () => state.now
  const ledger = new ExecutionLedger({ dir, clock, ...(maxAttemptsPerVisit ? { maxAttemptsPerVisit } : {}) })
  const calls = { delivers: [], detailReads: [] }
  const mutable = { detailVersion: 7, detailVisit: VISIT, isTerminal: false, turnState: () => 'pending' }
  const engine = createWorkflowExecutionEngine({
    ledger,
    clock,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    config: { staleNoProgressThresholdMs: thresholdMs, retryDelayMs },
    fetchDuePage: async () => ({ ok: true, items: [dueIntent()] }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async (req) => {
      calls.delivers.push(req)
      return { ok: true, sessionId: 'main', reconciliationHandle: `turn:handle-${calls.delivers.length}` }
    },
    getTurnReconciliation: (handle) => ({ state: mutable.turnState(handle) }),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    readInstanceDetail: async () => {
      calls.detailReads.push(calls.detailReads.length)
      return { ok: true, body: fullDetail({ version: mutable.detailVersion, visit: mutable.detailVisit, isTerminal: mutable.isTerminal }) }
    },
  })
  const recovery = createRecoveryOperation({
    ledger,
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async () => { throw new Error('recovery must not deliver in this reproduction') },
    readInstanceDetail: engine.deps?.readInstanceDetail ?? (async () => ({ ok: true, body: fullDetail({ version: mutable.detailVersion, visit: mutable.detailVisit }) })),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    buildInstruction: () => ({}),
    provenanceFor: () => ({}),
  })
  return {
    engine, ledger, recovery, calls, dir, state, mutable,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
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

test('M1 — assistance open→resolve version bumps: same-visit re-entry refused by every engine path', async (t) => {
  const fx = makeFixture()
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  // The run ends without a transition (assistance owns the business) →
  // NEEDS_REVIEW run_ended_no_submission (the CASE 3b end state).
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'settled'
  // Observation 1: assistance OPEN (version 8, visit unchanged).
  fx.mutable.detailVersion = 8
  const r1 = await fx.engine.reconcileOnce()
  assert.deepEqual(r1.staleReentry, [], 'open assistance must not stale-reenter')
  assert.deepEqual(r1.needsReview, [VISIT])
  // Observation 2: Owner RESOLVED (version 9, still same visit/assignee).
  fx.mutable.detailVersion = 9
  const r2 = await fx.engine.reconcileOnce()
  assert.deepEqual(r2.staleReentry, [], 'resolved assistance must not stale-reenter either (version gate)')
  // The attempt is already NEEDS_REVIEW (main loop probes ACTIVE only);
  // the run-ended/stale candidate loops re-probe it and keep refusing.
  const afterResolve = fx.ledger.get(VISIT)
  assert.equal(afterResolve.state, 'NEEDS_REVIEW')
  assert.equal(afterResolve.judgment, 'run_ended_no_submission')
  // The fast run-ended continuation path shares the same stale gate.
  assert.equal(fx.calls.delivers.length, 1, 'no second delivery through either loop')
  // Third scan: idempotent — no hidden convergence over time.
  fx.state.now += 10 * 60_000
  const r3 = await fx.engine.reconcileOnce()
  assert.deepEqual(r3.staleReentry, [])
  assert.equal(fx.calls.delivers.length, 1)
  // Due-feed poll refuses at the ledger fence.
  const poll = await fx.engine.pollOnce()
  assert.deepEqual(poll.admissions.map((a) => a.action), ['already_attempted'])
  // Direct ledger gate: judgment never became stale_no_progress.
  const attempt = fx.ledger.get(VISIT)
  assert.notEqual(attempt.judgment, STALE_NO_PROGRESS_JUDGMENT)
  const direct = await fx.ledger.beginAttemptIfAbsent({
    dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER,
  })
  assert.equal(direct.created, false)
  assert.equal(direct.cause, 'already_attempted')
  // Recovery operation: E3 terminal refusal — not a path for this state.
  const rec = await fx.recovery.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'authority-test-ref' })
  assert.equal(rec.outcome, 'NO_OP_TERMINAL')
  // Persisted-event immutability: no gen-2 attempt_planned ever appended.
  const snap = fx.ledger.snapshot()
  const gen2Events = (snap.events ?? []).filter((e) => e.kind === 'attempt_planned' && (e.generation ?? 1) > 1)
  assert.equal(gen2Events.length, 0)
})

test('M2 control — version unchanged: stale_no_progress re-entry delivers generation 2', async (t) => {
  const fx = makeFixture()
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'settled'
  fx.mutable.detailVersion = 7 // unchanged business
  const r = await fx.engine.reconcileOnce()
  assert.deepEqual(r.staleReentry, [VISIT], 'unchanged version is stale_confirmed')
  const settled = fx.ledger.get(VISIT)
  assert.equal(settled.state, 'SETTLED')
  assert.equal(settled.judgment, STALE_NO_PROGRESS_JUDGMENT)
  const pass = await fx.engine.pollOnce()
  assert.deepEqual(pass.admissions.map((a) => a.action), ['admitted'])
  assert.equal(fx.calls.delivers.length, 2, 'gen-2 legally delivered for the same visit')
  assert.equal(fx.ledger.get(VISIT).generation, 2)
})

test('M2 negative — visit moved or instance terminal: business settle, never re-dispatch', async (t) => {
  for (const variant of [
    { name: 'visit moved', detail: { version: 8, visit: VISIT_NEXT } },
    { name: 'instance terminal', detail: { version: 8, visit: VISIT, isTerminal: true } },
  ]) {
    const fx = makeFixture()
    t.after(() => fx.cleanup())
    await dispatchOnce(fx)
    fx.state.now += 61 * 60_000
    fx.mutable.turnState = () => 'settled'
    Object.assign(fx.mutable, { detailVersion: variant.detail.version, detailVisit: variant.detail.visit, isTerminal: !!variant.detail.isTerminal })
    const r = await fx.engine.reconcileOnce()
    assert.deepEqual(r.staleReentry, [], `${variant.name}: must not stale-reenter`)
    assert.equal(fx.calls.delivers.length, 1)
    const poll = await fx.engine.pollOnce()
    assert.deepEqual(poll.admissions.map((a) => a.action), ['already_attempted'])
  }
})

test('M3 — durable turn UNKNOWN: stays fenced; resolve bump cannot clear it', async (t) => {
  const fx = makeFixture()
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'unknown'
  const r = await fx.engine.reconcileOnce()
  assert.deepEqual(r.staleReentry, [], 'unknown outcome never stale-reenters')
  const attempt = fx.ledger.get(VISIT)
  assert.equal(attempt.state, 'NEEDS_REVIEW', 'durable unknown settles to NEEDS_REVIEW')
  assert.equal(attempt.judgment, 'run_outcome_unknown', 'UNKNOWN judgment recorded')
  assert.equal(fx.calls.delivers.length, 1)
  // Owner resolves assistance (version bump) — the UNKNOWN is untouched.
  fx.mutable.detailVersion = 9
  const r2 = await fx.engine.reconcileOnce()
  assert.deepEqual(r2.staleReentry, [])
  const after = fx.ledger.get(VISIT)
  assert.equal(after.state, 'NEEDS_REVIEW', 'resolve does not clear UNKNOWN')
  assert.equal(after.judgment, 'run_outcome_unknown')
  const poll = await fx.engine.pollOnce()
  assert.deepEqual(poll.admissions.map((a) => a.action), ['already_attempted'])
  assert.equal(fx.calls.delivers.length, 1)
})

test('M4 — attempt budget exhausted: clean refusal, no reset/fence/budget API', async (t) => {
  const fx = makeFixture({ maxAttemptsPerVisit: 1 })
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'settled'
  fx.mutable.detailVersion = 7
  const r = await fx.engine.reconcileOnce()
  assert.deepEqual(r.staleReentry, [VISIT], 'stale settlement itself still happens')
  const poll = await fx.engine.pollOnce()
  assert.deepEqual(poll.admissions.map((a) => a.action), ['attempt_limit_reached'], 'budget refusal inside the fence')
  assert.equal(fx.calls.delivers.length, 1, 'no delivery past the cap')
  const direct = await fx.ledger.beginAttemptIfAbsent({
    dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER,
  })
  assert.equal(direct.created, false)
  assert.equal(direct.cause, 'attempt_limit_reached')
  // Structural: the ledger exposes no budget/fence reset surface.
  for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(fx.ledger))) {
    assert.ok(!/reset|unfence|clearbudget/i.test(key), `no reset-like API expected, found ${key}`)
  }
})
