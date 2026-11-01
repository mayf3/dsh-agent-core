/**
 * CTR-S1..S5 policy borrowed from implementation 82566485. Governing target:
 * D-009 §8.5 and its scoped Owner amendment, Scheduler V3, CTR-RECON-001.
 *
 * Policy layer over accepted Scheduler V3 / D-009. The frozen
 * evidence→decision mapping in `evaluateAutoReconcileDecision` is the ONLY
 * path by which this policy settles an unresolved outcome_unknown occurrence;
 * every other evidence shape is left for human disposition. The unknown-never-
 * terminal invariant is never weakened: settlements produced here carry exact
 * trusted evidence and go through the same store mutation path as the
 * operator CLI (the autoReconcileOccurrences adapter, single mutation
 * authority per SCHEDULER_CONTROL_PLANE_RELIABILITY_V1).
 *
 * CTR-S4 default OFF: a pass runs only when wired with an `evidenceLookup`
 * function AND explicitly enabled by operator/owner configuration. Without a
 * lookup the pass plans ZERO settlements (fail-closed to no action) — an
 * absent evidence source MUST NOT be read as "no evidence ⇒ failed", because
 * that would settle live occurrences from ignorance.
 */

import { canonicalJSON, computePayloadHash, isUnresolvedUnknown } from '../occurrence-model.js'

/** CTR-S3 machine receipt actor — always distinguishable from human operators. */
export const AUTO_RECONCILE_DEFAULT_ACTOR_ID = 'system:fence-auto-reconcile'

/** Upper bound per pass so one crowded store cannot make unbounded progress. */
export const AUTO_RECONCILE_MAX_SETTLEMENTS = 50

/** Only the runtime Router adapter may supply this exact, bounded envelope. */
function exactEvidence(record, evidence) {
  if (!evidence || record.recordSchemaVersion !== 3) return false
  const expected = { occurrenceId: record.occurrenceId, runId: record.runId,
    requestId: record.requestId, agentId: record.ownerAgentId }
  if (Object.entries(expected).some(([key, value]) => typeof value !== 'string' || !value || evidence[key] !== value)) return false
  if (typeof evidence.runtimeEpoch !== 'string' || !evidence.runtimeEpoch
    || typeof evidence.reconciliationHandle !== 'string'
    || !evidence.reconciliationHandle.startsWith(`turn:${evidence.runtimeEpoch}:`)) return false
  const success = evidence.outcomeEvidence === 'exact_turn_end_success'
  const failure = evidence.outcomeEvidence === 'exact_turn_end_failure'
  if (success || failure) {
    const direct = evidence.outcome ?? null
    const late = evidence.lateOutcome ?? null
    return (direct === null && late === (success ? 'late_completed' : 'late_failed')
      || late === null && direct === (success ? 'completed' : 'failed'))
      && ['exact_terminal_then_idle', 'child_real_exit'].includes(evidence.terminationEvidence)
  }
  return !evidence.outcomeEvidence && !evidence.outcome && evidence.lateOutcome === 'terminated_without_outcome'
    && ['child_real_exit', 'exact_terminal_then_idle', 'exact_started_then_idle', 'exact_queued_removal', 'cancellation_ack'].includes(evidence.terminationEvidence)
}

function definitionSnapshot(job) {
  const { id, agentId, enabled, scheduleRevision, updatedAtMs, schedule, payload, retry, deleteAfterRun } = job
  return canonicalJSON({ id, agentId, enabled, scheduleRevision, updatedAtMs, schedule, payload, retry, deleteAfterRun })
}

/**
 * CTR-S2 frozen evidence→decision mapping. Mutually exclusive, exhaustive,
 * everything else ⇒ no action (human).
 *
 * @param {{schedule?: {kind?: string}}} job
 * @param {Record<string, unknown>} record scheduler occurrence (unresolved unknown)
 * @param {{outcomeEvidence?: string, terminationEvidence?: string,
 *          lateOutcome?: string, initialSource?: string}|null} evidence
 *        trusted termination evidence from the runtime turn-recovery registry
 *        (D-009 exact occurrence authority + its retention semantics), or
 *        `null` when the registry holds no record for this occurrence.
 * @returns {{decision: 'succeeded'|'failed'|null, reason: string}}
 */
export function evaluateAutoReconcileDecision({ job, record, evidence }) {
  if (!job || !record) return { decision: null, reason: 'missing_input' }
  // CTR-S2 gate 1: one-shot `at` jobs stay HUMAN_REQUIRED unconditionally —
  // a rerun of a one-shot is precisely the double-execution class the fence
  // exists to prevent.
  if (job.schedule?.kind === 'at') return { decision: null, reason: 'one_shot_at_human_required' }
  if (evidence === null || evidence === undefined) {
    // Missing admission/outcome proof cannot prove failure (D-009 §8.5).
    return { decision: null, reason: 'no_registry_record_keep_unknown' }
  }
  if (evidence.outcomeEvidence === 'exact_turn_end_success') {
    return { decision: 'succeeded', reason: 'late_completed_exact_turn_end_success' }
  }
  if (evidence.outcomeEvidence === 'exact_turn_end_failure') {
    return { decision: 'failed', reason: 'known_failure_exact_turn_end_failure' }
  }
  if (
    evidence.terminationEvidence === 'child_real_exit'
    || evidence.lateOutcome === 'terminated_without_outcome'
  ) {
    return { decision: 'failed', reason: 'child_exit_without_outcome' }
  }
  return { decision: null, reason: 'ambiguous_evidence_human_required' }
}

/**
 * CTR-S1 pass planner. Pure: reads a store document snapshot + an injected
 * `evidenceLookup(record) -> evidence|null` and produces the settlement
 * targets for the `autoReconcileOccurrences` adapter. Performs NO mutation.
 *
 * Fail-closed (CTR-S4): without a function `evidenceLookup` the plan is empty.
 *
 * @param {{jobs: Array, occurrences: Array}} doc
 * @param {((record: Record<string, unknown>) => object|null)|undefined} evidenceLookup
 * @param {{maxSettlements?: number}} [options]
 */
export function planAutoReconcilePass(doc, evidenceLookup, { maxSettlements = AUTO_RECONCILE_MAX_SETTLEMENTS } = {}) {
  const jobsById = new Map((doc.jobs ?? []).map((job) => [job.id, job]))
  const targets = []
  const skipped = []
  if (typeof evidenceLookup !== 'function') {
    return { targets, skipped: [{ occurrenceId: null, reason: 'evidence_lookup_unavailable_default_off' }] }
  }
  for (const record of doc.occurrences ?? []) {
    if (targets.length >= maxSettlements) {
      skipped.push({ occurrenceId: record?.occurrenceId ?? null, reason: 'max_settlements_reached' })
      continue
    }
    if (!isUnresolvedUnknown(record)) continue
    const job = jobsById.get(record.jobId)
    if (job?.schedule?.kind === 'at') {
      skipped.push({ occurrenceId: record.occurrenceId, reason: 'one_shot_at_human_required' })
      continue
    }
    if (!job || !['cron', 'every'].includes(job.schedule?.kind) || !job.enabled
      || job.agentId !== record.ownerAgentId || job.scheduleRevision !== record.scheduleRevision
      || computePayloadHash(job) !== record.payloadHash) {
      skipped.push({ occurrenceId: record.occurrenceId, reason: 'definition_or_identity_not_eligible' })
      continue
    }
    const evidence = evidenceLookup(record)
    const { decision, reason } = evaluateAutoReconcileDecision({ job, record, evidence })
    if (decision === null) {
      skipped.push({ occurrenceId: record.occurrenceId, reason })
      continue
    }
    if (!exactEvidence(record, evidence)) {
      skipped.push({ occurrenceId: record.occurrenceId, reason: 'evidence_not_exact_or_coherent' })
      continue
    }
    targets.push({
      occurrenceId: record.occurrenceId,
      runId: record.runId,
      requestId: record.requestId,
      jobId: record.jobId,
      ownerAgentId: record.ownerAgentId,
      scheduleRevision: record.scheduleRevision,
      payloadHash: record.payloadHash,
      expectedDefinition: definitionSnapshot(job),
      evidence: structuredClone(evidence),
      resolvedTo: decision,
      policyReason: reason,
    })
  }
  return { targets, skipped }
}
