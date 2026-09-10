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
