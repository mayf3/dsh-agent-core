/**
 * WORKFLOW_AGENT_EXECUTION_V1 — judgment tests (pure reconcile rules).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeDueIntent, judgeSettleFromDetail, judgeAttempt } from '../src/judgment.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const VISIT_NEXT = 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'

const VALID_INTENT = {
  dispatchIntentId: INTENT,
  nodeVisitId: VISIT,
  workflowInstanceId: INSTANCE,
  ownerPrincipalId: OWNER,
  nextEligibleAt: '2026-09-09T01:00:00Z',
  createdAt: '2026-09-09T00:00:00Z',
  updatedAt: '2026-09-09T00:30:00Z',
}

test('normalizeDueIntent: exact 7-field camelCase contract, UUID-checked, canonicalized', () => {
  const normalized = normalizeDueIntent(VALID_INTENT)
  assert.equal(normalized.ok, true)
  assert.deepEqual(normalized.intent, {
    dispatchIntentId: INTENT,
    nodeVisitId: VISIT,
    workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER,
    nextEligibleAt: '2026-09-09T01:00:00Z',
  })
  const bad = [
    { ...VALID_INTENT, dispatchIntentId: 'nope' },
    { ...VALID_INTENT, nodeVisitId: undefined },
    { ...VALID_INTENT, extra: 1 },
    (({ nextEligibleAt, ...rest }) => rest)(VALID_INTENT),
    null,
    'string',
  ]
  for (const item of bad) {
    assert.equal(normalizeDueIntent(item).ok, false, JSON.stringify(item))
  }
})

test('judgeSettleFromDetail: full view with a different current visit => SETTLED', () => {
  const verdict = judgeSettleFromDetail({
    body: {
      visibility: 'full',
      detail: { instance: { is_terminal: false }, current_node_visit_id: VISIT_NEXT, current_visit: {} },
    },
    nodeVisitId: VISIT,
  })
  assert.equal(verdict.kind, 'settled')
  assert.match(verdict.reason, /no_longer_current/)
})

test('judgeSettleFromDetail: full view still on our visit => still_current', () => {
  const verdict = judgeSettleFromDetail({
    body: {
      visibility: 'full',
      detail: { instance: { is_terminal: false }, current_node_visit_id: VISIT, current_visit: { node_visit_id: VISIT } },
    },
    nodeVisitId: VISIT,
  })
  assert.deepEqual(verdict, { kind: 'still_current', reason: 'node_visit_still_current' })
})

test('judgeSettleFromDetail: historical_participant mechanically proves the visit moved on (visibility invariant)', () => {
  // The attempt agent WAS the due visit's assignee at admission; visit rows
  // are immutable, so a restricted view proves our visit is no longer current.
  const verdict = judgeSettleFromDetail({
    body: { visibility: 'historical_participant', detail: { instance: { is_terminal: false } } },
    nodeVisitId: VISIT,
  })
  assert.equal(verdict.kind, 'settled')
  assert.match(verdict.reason, /assignee_no_longer_current/)
})

test('judgeSettleFromDetail: unreadable states are unavailable, NEVER silently settled', () => {
  const cases = [
    { body: null, why: 'null body' },
    { body: {}, why: 'missing visibility' },
    { body: { visibility: 'weird', detail: {} }, why: 'unknown visibility' },
    { body: { visibility: 'full', detail: {} }, why: 'full without current_node_visit_id' },
    { body: { visibility: 'full', detail: { current_node_visit_id: 'junk' } }, why: 'non-UUID current visit' },
  ]
  for (const { body, why } of cases) {
    const verdict = judgeSettleFromDetail({ body, nodeVisitId: VISIT })
    assert.equal(verdict.kind, 'unavailable', why)
    assert.match(verdict.reason, /^settle_check_unavailable/, why)
  }
})

test('judgeAttempt: run pending => stays ACTIVE (no settle probe, no LLM heartbeat needed)', () => {
  const verdict = judgeAttempt({ phase: 'run_delivered' }, { turnState: 'pending', settle: undefined })
  assert.deepEqual(verdict, { state: 'ACTIVE', judgment: 'run_running', reason: 'turn reconciliation pending (run in flight)' })
})

test('judgeAttempt: run ended + still current => NEEDS_REVIEW even if the model said it finished (negative case)', () => {
  const verdict = judgeAttempt(
    { phase: 'run_delivered' },
    { turnState: 'settled', settle: { kind: 'still_current', reason: 'node_visit_still_current' } },
  )
  assert.equal(verdict.state, 'NEEDS_REVIEW')
  assert.equal(verdict.judgment, 'run_ended_no_submission')
})

test('judgeAttempt: lost/unknowable run outcome + still current => NEEDS_REVIEW, never a rerun', () => {
  for (const turnState of ['evicted', 'restart_lost', 'never_existed']) {
    const verdict = judgeAttempt(
      { phase: 'run_delivered' },
      { turnState, settle: { kind: 'still_current', reason: 'node_visit_still_current' } },
    )
    assert.equal(verdict.state, 'NEEDS_REVIEW', turnState)
    assert.equal(verdict.judgment, 'run_outcome_unknown', turnState)
  }
})

test('judgeAttempt: terminal run + settled business fact => SETTLED regardless of turn record loss', () => {
  for (const turnState of ['settled', 'evicted', 'restart_lost']) {
    const verdict = judgeAttempt(
      { phase: 'run_delivered' },
      { turnState, settle: { kind: 'settled', reason: 'node_visit_no_longer_current' } },
    )
    assert.equal(verdict.state, 'SETTLED', turnState)
    assert.equal(verdict.judgment, 'business_commitment_observed', turnState)
  }
})

test('judgeAttempt: settle probe unavailable => NEEDS_REVIEW (unknown is never settled, never rerun)', () => {
  const verdict = judgeAttempt(
    { phase: 'run_delivered' },
    { turnState: 'settled', settle: { kind: 'unavailable', reason: 'settle_check_unavailable: instance detail read failed (credential_unavailable)' } },
  )
  assert.equal(verdict.state, 'NEEDS_REVIEW')
  assert.equal(verdict.judgment, 'settle_check_unavailable')
})

test('judgeAttempt: no verified Run linkage => NEEDS_REVIEW delivery_unverified (no second delivery)', () => {
  const planned = judgeAttempt({ phase: 'planned' }, { turnState: undefined, settle: undefined })
  assert.equal(planned.state, 'NEEDS_REVIEW')
  assert.equal(planned.judgment, 'delivery_unverified')
  const noTurn = judgeAttempt({ phase: 'run_delivered' }, { turnState: undefined, settle: undefined })
  assert.equal(noTurn.state, 'NEEDS_REVIEW')
  assert.equal(noTurn.judgment, 'delivery_unverified')
})

// ── #724 submission-gap diagnosis ────────────────────────────────────────────
// SYNTHETIC_ONLY: no readable natural execution history existed at execution
// time (no attempts.jsonl under the default production root), so every case
// below is a synthetic counterexample. No production cause/rate-improvement
// claim is made. The diagnosis is a read-only explain-result BESIDE the frozen
// judgment vocabulary — never a new execution state, never an auto-retry
// trigger, never a business fact derived from exit0 shapes or model text.

import * as judgmentNs from '../src/judgment.js'
import { authErrors } from '../../broker/src/capabilities/workflow-definition-authoring.js'

const ATTEMPT_ID = `wfeat-${'d'.repeat(24)}`
const OTHER_ATTEMPT_ID = `wfeat-${'e'.repeat(24)}`
const PAYLOAD_VALUE_MARKER = 'SECRET-PAYLOAD-VALUE-MARKER-724'

const gapAttempt = { attemptId: ATTEMPT_ID, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, phase: 'run_delivered' }
const STILL_CURRENT = { kind: 'still_current', reason: 'node_visit_still_current' }

function gapToolResult(over = {}) {
  return {
    attemptId: ATTEMPT_ID,
    nodeVisitId: VISIT,
    workflowInstanceId: INSTANCE,
    ok: false,
    error: { code: 'submission_validation_failed', fieldPaths: ['submissionPayload.amount'], requestId: 'req-gap-1', details: { received: PAYLOAD_VALUE_MARKER } },
    ...over,
  }
}

test('#724-0 diagnoseSubmissionGap exists as a pure export beside judgeAttempt', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
})

test('#724-1 same-attempt structured validation rejection => INPUT_INVALID; field PATHS and error codes only, never payload values', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
  const d = judgmentNs.diagnoseSubmissionGap({
    attempt: gapAttempt,
    settle: STILL_CURRENT,
    lastToolResult: gapToolResult({ error: { code: 'submission_validation_failed', fieldPaths: ['submissionPayload.amount'], requestId: 'req-gap-1', details: { received: PAYLOAD_VALUE_MARKER } } }),
    evidenceStatus: 'readable',
  })
  assert.equal(d.category, 'INPUT_INVALID')
  assert.ok(d.evidenceRefs.some((r) => r.includes('submission_validation_failed')), 'error code presented')
  assert.ok(d.evidenceRefs.some((r) => r.includes('submissionPayload.amount')), 'authorized field path presented')
  assert.ok(d.evidenceRefs.some((r) => r.includes('req-gap-1')), 'request reference presented')
  assert.ok(!JSON.stringify(d).includes(PAYLOAD_VALUE_MARKER), 'payload values never leak into the diagnosis')
})

test('#724-2 version conflict => STALE_VERSION; re-read then explicit resubmit decision; the diagnosis itself is pure and side-effect-free', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
  const input = {
    attempt: gapAttempt,
    settle: STILL_CURRENT,
    lastToolResult: gapToolResult({ error: { code: 'workflow_state_version_conflict', requestId: 'req-gap-2' } }),
    evidenceStatus: 'readable',
  }
  const d1 = judgmentNs.diagnoseSubmissionGap(input)
  const d2 = judgmentNs.diagnoseSubmissionGap(input)
  assert.equal(d1.category, 'STALE_VERSION')
  assert.deepEqual(d1, d2, 'pure: identical inputs => identical result (no hidden state, no I/O, no transitions)')
  assert.match(d1.suggestedNextStep, /workflow_instance_detail/, 'suggests re-reading the current visit')
  assert.match(d1.suggestedNextStep, /explicitly/i, 'resubmission stays an explicit decision')
  assert.doesNotMatch(d1.suggestedNextStep, /automatic/i, 'no automatic version swap')
})

test('#724-3 visit moved on => reuses the existing settled/progressed expression; the attempt no longer needs a submission; never a business-quality verdict', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
  const settled = judgmentNs.diagnoseSubmissionGap({
    attempt: gapAttempt,
    settle: { kind: 'settled', reason: 'node_visit_no_longer_current' },
    lastToolResult: gapToolResult(),
    evidenceStatus: 'readable',
  })
  assert.equal(settled.category, 'settled')
  assert.match(settled.suggestedNextStep, /not a business-quality verdict/i)
  const progressed = judgmentNs.diagnoseSubmissionGap({
    attempt: gapAttempt,
    settle: { kind: 'progressed', reason: 'workflow_state_version advanced (2 -> 3) since dispatch' },
    lastToolResult: gapToolResult(),
    evidenceStatus: 'readable',
  })
  assert.equal(progressed.category, 'progressed')
  assert.match(progressed.suggestedNextStep, /not a business-quality verdict/i)
})

test('#724-4 permission denial => AUTHORIZATION_BLOCKED; original denial preserved; no fallback principal/token/global-read suggestion', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
  for (const code of ['principal_not_assignee', 'not_domain_owner', 'credential_unavailable']) {
    const d = judgmentNs.diagnoseSubmissionGap({
      attempt: gapAttempt,
      settle: STILL_CURRENT,
      lastToolResult: gapToolResult({ error: { code, requestId: 'req-gap-4' } }),
      evidenceStatus: 'readable',
    })
    assert.equal(d.category, 'AUTHORIZATION_BLOCKED', code)
    assert.ok(d.evidenceRefs.some((r) => r.includes(code)), `original denial code preserved for ${code}`)
    assert.doesNotMatch(d.suggestedNextStep, /fallback|another principal|new token|global read/i)
  }
})

test('#724-5 timeout / lost receipt / still processing => OUTCOME_UNKNOWN; reconcile via the original read entry, never replay; zero side effects', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
  for (const code of ['transport_failure', 'http_5xx', 'malformed_response', 'command_still_processing']) {
    const d = judgmentNs.diagnoseSubmissionGap({
      attempt: gapAttempt,
      settle: STILL_CURRENT,
      lastToolResult: gapToolResult({ error: { code, requestId: 'req-gap-5' } }),
      evidenceStatus: 'readable',
    })
    assert.equal(d.category, 'OUTCOME_UNKNOWN', code)
    assert.match(d.suggestedNextStep, /workflow_instance_detail/, 'read-back via the original entry')
    assert.doesNotMatch(d.suggestedNextStep, /replay|resubmit|retry/i, 'an unknown-outcome call is never replayed')
  }
})

test('#724-6 only model "done" text / success-shaped result / nothing => NO_COMMIT_OBSERVED; never a business-success conclusion', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
  const textOnly = judgmentNs.diagnoseSubmissionGap({
    attempt: gapAttempt,
    settle: STILL_CURRENT,
    lastToolResult: { attemptId: ATTEMPT_ID, text: '完成了' },
    evidenceStatus: 'readable',
  })
  const nothing = judgmentNs.diagnoseSubmissionGap({ attempt: gapAttempt, settle: STILL_CURRENT, lastToolResult: undefined, evidenceStatus: 'readable' })
  const okShaped = judgmentNs.diagnoseSubmissionGap({
    attempt: gapAttempt,
    settle: STILL_CURRENT,
    lastToolResult: { attemptId: ATTEMPT_ID, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ok: true },
    evidenceStatus: 'readable',
  })
  for (const [d, why] of [[textOnly, 'model text'], [nothing, 'no result'], [okShaped, 'exit0-shaped result']]) {
    assert.equal(d.category, 'NO_COMMIT_OBSERVED', why)
    assert.ok(!/business (commitment|success) observed/i.test(JSON.stringify(d)), `${why}: no business-success conclusion`)
  }
  assert.ok(okShaped.missingEvidence.some((m) => /never a business fact/i.test(m)), 'success shape is explicitly not treated as a business fact')
})

test('#724-7 another attempt\'s / cross-attempt error is never this attempt\'s cause; an explicit evidence gap stands instead', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
  const foreign = judgmentNs.diagnoseSubmissionGap({
    attempt: gapAttempt,
    settle: STILL_CURRENT,
    lastToolResult: gapToolResult({ attemptId: OTHER_ATTEMPT_ID, error: { code: 'submission_validation_failed', requestId: 'req-gap-7' } }),
    evidenceStatus: 'readable',
  })
  assert.equal(foreign.category, 'NO_COMMIT_OBSERVED', 'foreign-attempt rejection does not classify this attempt')
  assert.ok(foreign.missingEvidence.some((m) => /another attempt|cross-attempt/i.test(m)), 'exclusion named as a gap')
  const marked = judgmentNs.diagnoseSubmissionGap({ attempt: gapAttempt, settle: STILL_CURRENT, lastToolResult: gapToolResult(), evidenceStatus: 'cross_attempt' })
  assert.equal(marked.category, 'NO_COMMIT_OBSERVED')
  assert.ok(marked.missingEvidence.some((m) => /another attempt|cross-attempt/i.test(m)))
})

test('#724-8 unreadable / truncated evidence => OUTCOME_UNKNOWN with missingEvidence; never explained as "no call made"; no settle probe or linkage => unknown too', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
  for (const evidenceStatus of ['unreadable', 'truncated']) {
    const d = judgmentNs.diagnoseSubmissionGap({ attempt: gapAttempt, settle: STILL_CURRENT, lastToolResult: undefined, evidenceStatus })
    assert.equal(d.category, 'OUTCOME_UNKNOWN', evidenceStatus)
    assert.ok(d.missingEvidence.some((m) => new RegExp(evidenceStatus).test(m)), 'gap names the readability state')
    assert.doesNotMatch(d.suggestedNextStep, /no call was made|never called/i)
  }
  const noSettle = judgmentNs.diagnoseSubmissionGap({ attempt: gapAttempt, settle: undefined, lastToolResult: undefined, evidenceStatus: 'readable' })
  assert.equal(noSettle.category, 'OUTCOME_UNKNOWN', 'without a settle probe the still-current premise is not established')
  const planned = judgmentNs.diagnoseSubmissionGap({ attempt: { ...gapAttempt, phase: 'planned' }, settle: STILL_CURRENT, lastToolResult: undefined, evidenceStatus: 'readable' })
  assert.equal(planned.category, 'OUTCOME_UNKNOWN', 'delivery-unverified attempts cannot be classified')
})

test('#724-4b manifest-declared auth-layer denials (unauthenticated/forbidden) => AUTHORIZATION_BLOCKED; no resubmission guidance, no identity fallback (P2 4236719936)', () => {
  assert.equal(typeof judgmentNs.diagnoseSubmissionGap, 'function', 'diagnoseSubmissionGap missing (#724)')
  for (const code of ['unauthenticated', 'forbidden']) {
    const d = judgmentNs.diagnoseSubmissionGap({
      attempt: gapAttempt,
      settle: STILL_CURRENT,
      lastToolResult: gapToolResult({ error: { code, requestId: 'req-gap-4b' } }),
      evidenceStatus: 'readable',
    })
    assert.equal(d.category, 'AUTHORIZATION_BLOCKED', `${code} is a declared auth-layer denial, not a missing commit`)
    assert.ok(d.evidenceRefs.some((r) => r.includes(code)), `original denial code preserved for ${code}`)
    assert.doesNotMatch(d.suggestedNextStep, /fallback|another principal|new token|global read|resubmit|retry|重新提交|重试/i, `${code}: expired credentials / missing scopes must not produce resubmission guidance`)
  }
})

test('#724-4c the authz code set covers every manifest-declared workflow_execute auth-layer code (no drift)', () => {
  const declared = new Set(authErrors.map((e) => e.code))
  for (const code of declared) {
    const d = judgmentNs.diagnoseSubmissionGap({
      attempt: gapAttempt,
      settle: STILL_CURRENT,
      lastToolResult: gapToolResult({ error: { code } }),
      evidenceStatus: 'readable',
    })
    assert.equal(d.category, 'AUTHORIZATION_BLOCKED', `manifest-declared auth-layer code ${code} classifies as AUTHORIZATION_BLOCKED`)
  }
})
