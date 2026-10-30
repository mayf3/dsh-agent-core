import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JobStore } from '../src/store.js'
import { buildOccurrenceRecord, applyTransition, rebuildFences } from '../src/occurrence-model.js'
import { evaluateAutoReconcileDecision, planAutoReconcilePass, AUTO_RECONCILE_DEFAULT_ACTOR_ID } from '../src/auto-reconcile.js'
import { autoReconcileOccurrences } from '../src/control.js'

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

async function fixture({ jobs, occurrences }) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-auto-reconcile-'))
  const store = new JobStore(join(dir, 'jobs.json'))
  await store.mutateDoc((doc) => {
    doc.jobs = structuredClone(jobs)
    doc.occurrences = structuredClone(occurrences)
    doc.fences = rebuildFences(doc.occurrences)
  })
  return store
}

test('CTR-S2 frozen mapping: evidence -> decision table', () => {
  const record = { state: 'outcome_unknown' }
  const base = { job: recurringJob, record }
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: { outcomeEvidence: 'exact_turn_end_success', lateOutcome: 'late_completed' } }).decision, 'succeeded')
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: { outcomeEvidence: 'exact_turn_end_failure', terminationEvidence: 'exact_terminal_then_idle' } }).decision, 'failed')
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: { terminationEvidence: 'child_real_exit', lateOutcome: 'terminated_without_outcome' } }).decision, 'failed')
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: null }).decision, 'failed')
  assert.equal(evaluateAutoReconcileDecision({ ...base, evidence: null }).reason, 'no_registry_record_admission_unproven')
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

test('CTR-S1/S3 integration: settlement goes through the CLI-identical path with a machine receipt and releases the fence', async () => {
  const occurrence = makeUnknownOccurrence(recurringJob)
  const store = await fixture({ jobs: [recurringJob], occurrences: [occurrence] })
  const before = await store.loadDoc()
  assert.equal(before.fences[recurringJob.id] !== undefined, true, 'fixture must start fenced')

  const plan = planAutoReconcilePass(
    { jobs: [recurringJob], occurrences: before.occurrences },
    () => ({ outcomeEvidence: 'exact_turn_end_success', lateOutcome: 'late_completed', terminationEvidence: 'exact_terminal_then_idle' }),
  )
  assert.equal(plan.targets.length, 1)

  const { results, fencesRemaining, identity } = await autoReconcileOccurrences(
    store, { settlements: plan.targets, nowMs: 10_000 },
  )
  assert.equal(results.length, 1)
  assert.equal(results[0].outcome, 'settled')
  assert.equal(results[0].resolvedTo, 'succeeded')
  assert.equal(fencesRemaining, 0)
  assert.equal(identity.actorId, AUTO_RECONCILE_DEFAULT_ACTOR_ID)

  const after = await store.loadDoc()
  const settled = after.occurrences.find((entry) => entry.occurrenceId === occurrence.occurrenceId)
  assert.equal(settled.state, 'succeeded')
  assert.equal(settled.lateSettlement.basis, 'policy-auto-reconcile')
  assert.equal(settled.lateSettlement.resolvedTo, 'succeeded')
  assert.equal(after.fences[recurringJob.id], undefined, 'fence must be released')
  const summary = after.jobs.find((job) => job.id === recurringJob.id).state
  assert.equal(summary.lastRunStatus, 'succeeded')
})

test('CTR-S5 drift safety: plan/commit drift settles nothing out of policy and reports per-item errors', async () => {
  const occurrence = makeUnknownOccurrence(recurringJob)
  const store = await fixture({ jobs: [recurringJob], occurrences: [occurrence] })
  // Drift: wrong runId + a fabricated resolvedTo outside the policy vocabulary.
  const { results } = await autoReconcileOccurrences(store, {
    settlements: [
      { occurrenceId: occurrence.occurrenceId, runId: 'run:drift', resolvedTo: 'succeeded', evidenceNote: 'drift' },
      { occurrenceId: occurrence.occurrenceId, runId: occurrence.runId, resolvedTo: 'terminated_without_outcome', evidenceNote: 'outside policy vocabulary' },
    ],
    nowMs: 10_000,
  })
  assert.equal(results.filter((entry) => entry.outcome === 'error').length, 2)
  const after = await store.loadDoc()
  const record = after.occurrences.find((entry) => entry.occurrenceId === occurrence.occurrenceId)
  assert.equal(record.state, 'outcome_unknown', 'drift must settle nothing')
  assert.equal(after.fences[recurringJob.id] !== undefined, true, 'fence stays for the human path')
})
