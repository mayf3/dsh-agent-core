/**
 * WORKFLOW_EXECUTION_CONTROL_V1 — execution-attention read projection tests.
 *
 * The attention summary is a pure fleet-level selection over the frozen
 * CTR-WEC1-002 executionState table. Pins:
 *   - every attention condition is a ledger fact (UNKNOWN/OWNER_PENDING/
 *     STALE/BLOCKED/RUN_ENDED positive cases with evidence coordinates);
 *   - normal-running and terminal-OK visits are NEVER attention (negative);
 *   - absent facts stay absent (no agent/session refs without a receipt);
 *   - budget exhaustion is asserted only from the recorded escalation fact;
 *   - the projection is read-only (input snapshot never mutated).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { projectExecutionAttention, ATTENTION_STATES } from '../src/attention.js'
import { executionStateFor } from '../src/projection.js'

const INSTANCE_A = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const INSTANCE_B = '9d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e99'
const VISIT_A = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const VISIT_B = '1d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e22'
const VISIT_C = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const VISIT_RUNNING = '3d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e44'

function attempt(overrides = {}) {
  return {
    attemptId: 'wfeat-x',
    nodeVisitId: VISIT_A,
    workflowInstanceId: INSTANCE_A,
    ownerPrincipalId: 'p-owner',
    createdAtMs: 1,
    state: 'NEEDS_REVIEW',
    phase: 'reconciled',
    judgment: 'run_outcome_unknown',
    ...overrides,
  }
}

test('attention: UNKNOWN/reconciliation states are attention with evidence coordinates', () => {
  const { items, counts } = projectExecutionAttention([
    attempt({ judgment: 'run_outcome_unknown', delivered: { agentId: 'agt_one', sessionId: 'main' }, reconciledAtMs: 100 }),
    attempt({ nodeVisitId: VISIT_B, judgment: 'delivery_failed', phase: 'delivery_failed' }),
  ])

  assert.equal(items.length, 2)
  assert.ok(items.every((item) => item.executionState === 'OUTCOME_UNKNOWN'))
  assert.equal(counts.OUTCOME_UNKNOWN, 2)

  const unknown = items.find((item) => item.nodeVisitId === VISIT_A)
  assert.equal(unknown.workflowInstanceId, INSTANCE_A)
  assert.match(unknown.reason, /outcome unknown/)
  assert.equal(unknown.attemptId, 'wfeat-x')
  assert.equal(unknown.generation, 1)
  assert.equal(unknown.attemptCount, 1)
  assert.equal(unknown.startedAtMs, 1)
  assert.equal(unknown.updatedAtMs, 100)
  // Execution evidence refs only come from the delivered receipt:
  assert.equal(unknown.agentId, 'agt_one')
  assert.equal(unknown.sessionId, 'main')

  // A failed delivery without any receipt exposes NO session refs.
  const failed = items.find((item) => item.nodeVisitId === VISIT_B)
  assert.equal(failed.agentId, undefined)
  assert.equal(failed.sessionId, undefined)
  assert.equal('agentId' in failed, false)
  assert.equal('sessionId' in failed, false)
})

test('attention: OWNER_PENDING exposes the escalation fact; budget exhaustion only from that fact', () => {
  const exhausted = projectExecutionAttention([
    attempt({ judgment: 'run_outcome_unknown', escalation: { reason: 'ATTEMPTS_EXHAUSTED', attemptCount: 3, atMs: 50 }, reconciledAtMs: 50 }),
  ]).items[0]
  assert.equal(exhausted.executionState, 'OWNER_PENDING')
  assert.equal(exhausted.attemptBudgetExhausted, true)
  assert.deepEqual(exhausted.escalation, { reason: 'ATTEMPTS_EXHAUSTED', attemptCount: 3, atMs: 50 })

  // A different recorded escalation reason stays OWNER_PENDING but must NOT
  // mint the budget-exhausted condition (evidence-backed or absent).
  const other = projectExecutionAttention([
    attempt({ judgment: 'run_outcome_unknown', escalation: { reason: 'delivery_rejected:denied', atMs: 51 }, reconciledAtMs: 51 }),
  ]).items[0]
  assert.equal(other.executionState, 'OWNER_PENDING')
  assert.equal('attemptBudgetExhausted' in other, false)
  assert.equal(other.escalation.reason, 'delivery_rejected:denied')
})

test('attention: stale, blocked and run-ended ledger judgments are attention', () => {
  const { items, counts } = projectExecutionAttention([
    attempt({ state: 'SETTLED', judgment: 'stale_no_progress', reconciledAtMs: 10 }),
    attempt({ nodeVisitId: VISIT_B, state: 'ACTIVE', phase: 'resolution_blocked', lastBlockedAtMs: 20 }),
    attempt({ nodeVisitId: VISIT_C, judgment: 'run_ended_no_submission', reconciledAtMs: 30 }),
  ])

  assert.deepEqual(
    items.map((item) => item.executionState),
    ['STALE_NO_PROGRESS', 'BLOCKED', 'RUN_ENDED_NO_TRANSITION'],
  )
  assert.equal(counts.STALE_NO_PROGRESS, 1)
  assert.equal(counts.BLOCKED, 1)
  assert.equal(counts.RUN_ENDED_NO_TRANSITION, 1)
  // Longest-stuck-first ordering is deterministic on updatedAtMs.
  assert.deepEqual(items.map((item) => item.updatedAtMs), [10, 20, 30])
})

test('attention: normal-running and terminal-OK visits produce NO attention conditions', () => {
  // Cross-check the states against the frozen CTR-WEC1-002 table itself.
  assert.equal(executionStateFor({ state: 'ACTIVE', phase: 'planned' }).state, 'DISPATCHED')
  assert.equal(executionStateFor({ state: 'ACTIVE', phase: 'run_delivered', delivered: {} }).state, 'RUNNING')
  assert.equal(executionStateFor({ state: 'SETTLED', judgment: 'business_commitment_observed' }).state, 'SETTLED')

  const { items, counts } = projectExecutionAttention([
    attempt({ nodeVisitId: VISIT_A, state: 'ACTIVE', phase: 'planned' }),
    attempt({ nodeVisitId: VISIT_B, state: 'ACTIVE', phase: 'run_delivered', delivered: { agentId: 'agt_one', sessionId: 'main' }, deliveredAtMs: 5 }),
    attempt({ nodeVisitId: VISIT_C, state: 'SETTLED', judgment: 'business_commitment_observed', reconciledAtMs: 6 }),
    attempt({ nodeVisitId: VISIT_RUNNING, workflowInstanceId: INSTANCE_B, state: 'ACTIVE', phase: 'delivery_started' }),
  ])

  assert.deepEqual(items, [])
  assert.deepEqual(counts, Object.fromEntries(ATTENTION_STATES.map((state) => [state, 0])))
})

test('attention: empty ledger snapshot is an empty summary; input is never mutated', () => {
  const empty = projectExecutionAttention([])
  assert.deepEqual(empty, { items: [], counts: Object.fromEntries(ATTENTION_STATES.map((state) => [state, 0])) })

  const snapshot = [attempt({ delivered: { agentId: 'agt_one', sessionId: 'main' } })]
  const frozen = JSON.parse(JSON.stringify(snapshot))
  projectExecutionAttention(snapshot)
  assert.deepEqual(snapshot, frozen)

  assert.throws(() => projectExecutionAttention(undefined), TypeError)
})
