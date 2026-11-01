import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOccurrenceRecord, applyTransition, rebuildFences } from '../../src/occurrence-model.js'
import { evaluateAutoReconcileDecision, planAutoReconcilePass } from '../../src/watchdog/auto-reconcile.js'

const recurringJob = {
  id: 'job-rec', name: 'recurring fixture', agentId: 'agent-a', enabled: true,
  scheduleRevision: 1, revisionActivatedAtMs: 1_000, createdAtMs: 1_000, updatedAtMs: 1_000,
  schedule: { kind: 'every', everyMs: 60_000 },
  payload: { kind: 'agentTurn', message: 'work' }, delivery: { mode: 'none' },
  deleteAfterRun: false, state: {},
}
const atJob = {
  ...recurringJob,
  id: 'job-at', name: 'one-shot fixture',
  schedule: { kind: 'at', at: '2030-01-01T00:00:00.000Z' },
}

function makeUnknownOccurrence(job) {
  const occurrence = buildOccurrenceRecord({
    job, kind: 'natural', nominalScheduledAt: 2_000, admittedAt: 3_000, timeoutMs: 60_000,
  })
  applyTransition(occurrence, { to: 'outcome_unknown', at: 4_000, reason: 'unproven exit (fixture)' })
  return occurrence
}

test('CTR-S2 frozen mapping: evidence -> decision table', () => {
  const record = { state: 'outcome_unknown' }
  const base = { job: recurringJob, record }
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: { outcomeEvidence: 'exact_turn_end_success', lateOutcome: 'late_completed' } }).decision, 'succeeded')
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: { outcomeEvidence: 'exact_turn_end_failure', terminationEvidence: 'exact_terminal_then_idle' } }).decision, 'failed')
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: { terminationEvidence: 'child_real_exit', lateOutcome: 'terminated_without_outcome' } }).decision, 'failed')
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: null }).decision, null)
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: null }).reason, 'no_registry_record_keep_unknown')
})

test('CTR-S2 gate: one-shot `at` jobs are never auto-disposed', () => {
  const record = { state: 'outcome_unknown' }
  const decided = evaluateAutoReconcileDecision({ job: atJob, record, evidence: { outcomeEvidence: 'exact_turn_end_success' } })
  assert.equal(decided.decision, null)
  assert.equal(decided.reason, 'one_shot_at_human_required')
})

test('CTR-S2 gate: ambiguous evidence leaves the occurrence for a human', () => {
  const decided = evaluateAutoReconcileDecision({
    job: recurringJob, record: { state: 'outcome_unknown' },
    evidence: { outcomeEvidence: 'some_unregistered_shape', terminationEvidence: 'weird' },
  })
  assert.equal(decided.decision, null)
  assert.equal(decided.reason, 'ambiguous_evidence_human_required')
})

test('CTR-S4 default OFF: without an evidenceLookup the pass plans zero settlements', () => {
  const occurrence = makeUnknownOccurrence(recurringJob)
  const plan = planAutoReconcilePass({ jobs: [recurringJob], occurrences: [occurrence] })
  assert.equal(plan.targets.length, 0)
  assert.equal(plan.skipped[0].reason, 'evidence_lookup_unavailable_default_off')
})

test('CTR-S1 pass: recurring unknown with success evidence is planned; `at` and ambiguous are skipped', () => {
  const recOcc = makeUnknownOccurrence(recurringJob)
  const atOcc = makeUnknownOccurrence(atJob)
  const evidenceLookup = (record) => {
    if (record.occurrenceId === recOcc.occurrenceId) return { outcomeEvidence: 'exact_turn_end_success', lateOutcome: 'late_completed' }
    if (record.occurrenceId === atOcc.occurrenceId) return { outcomeEvidence: 'exact_turn_end_success' }
    return null
  }
  const plan = planAutoReconcilePass(
    { jobs: [recurringJob, atJob], occurrences: [recOcc, atOcc] },
    evidenceLookup,
  )
  assert.equal(plan.targets.length, 1)
  assert.equal(plan.targets[0].resolvedTo, 'succeeded')
  assert.equal(plan.targets[0].occurrenceId, recOcc.occurrenceId)
  assert.ok(plan.skipped.some((entry) => entry.reason === 'one_shot_at_human_required'))
})


test('CTR-S2 no registry record: null and undefined keep UNKNOWN, fence and input bytes', () => {
  const occurrence = makeUnknownOccurrence(recurringJob)
  const doc = { jobs: [recurringJob], occurrences: [occurrence], fences: rebuildFences([occurrence]) }
  const before = JSON.stringify(doc)
  for (const missing of [null, undefined]) {
    assert.equal(evaluateAutoReconcileDecision({ job: recurringJob, record: occurrence, evidence: missing }).decision, null)
    const plan = planAutoReconcilePass(doc, () => missing)
    assert.deepEqual(plan.targets, [])
    assert.equal(plan.skipped[0].reason, 'no_registry_record_keep_unknown')
    assert.equal(occurrence.state, 'outcome_unknown')
    assert.ok(doc.fences[recurringJob.id])
    assert.equal(JSON.stringify(doc), before)
  }
})
