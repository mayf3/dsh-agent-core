/**
 * @agent-core/scheduler/src/auto-reconcile.js — AGENT_DELIVERY_RESILIENCE_V1
 * CTR-S1..S5: evidence-gated fence auto-reconcile POLICY (accepted spec,
 * docs/specs/AGENT_DELIVERY_RESILIENCE_V1.md @8cf2c23a).
 *
 * Policy layer over SCHEDULER_TIMEOUT_OUTCOME_V1 / D-007. The frozen
 * evidence→decision mapping in `evaluateAutoReconcileDecision` is the ONLY
 * path by which this policy settles an unresolved outcome_unknown occurrence;
 * every other evidence shape is left for human disposition. The unknown-never-
 * terminal invariant is never weakened: settlements produced here carry exact
 * trusted evidence and go through the same store mutation path as the
 * operator CLI (`control.js autoReconcileOccurrences`, single mutation
 * authority per SCHEDULER_CONTROL_PLANE_RELIABILITY_V1).
 *
 * CTR-S4 default OFF: a pass runs only when wired with an `evidenceLookup`
 * function AND explicitly enabled by operator/owner configuration. Without a
 * lookup the pass plans ZERO settlements (fail-closed to no action) — an
 * absent evidence source MUST NOT be read as "no evidence ⇒ failed", because
 * that would settle live occurrences from ignorance.
 */

import { isUnresolvedUnknown } from './occurrence-model.js'

/** CTR-S3 machine receipt actor — always distinguishable from human operators. */
export const AUTO_RECONCILE_DEFAULT_ACTOR_ID = 'system:fence-auto-reconcile'

/** Upper bound per pass so one crowded store cannot make unbounded progress. */
export const AUTO_RECONCILE_MAX_SETTLEMENTS = 50

/**
 * CTR-S2 frozen evidence→decision mapping. Mutually exclusive, exhaustive,
 * everything else ⇒ no action (human).
 *
 * @param {{schedule?: {kind?: string}}} job
 * @param {Record<string, unknown>} record scheduler occurrence (unresolved unknown)
 * @param {{outcomeEvidence?: string, terminationEvidence?: string,
 *          lateOutcome?: string, initialSource?: string}|null} evidence
 *        trusted termination evidence from the runtime turn-recovery registry
 *        (D-007 durable occurrence authority + its retention semantics), or
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
    // No registry record: admission was never proven, the turn did not
    // execute. Settling failed lets the next natural slot rerun — identical
    // to any crashed run's disposition.
    return { decision: 'failed', reason: 'no_registry_record_admission_unproven' }
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
 * targets for `autoReconcileOccurrences` (control.js). Performs NO mutation.
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
    const evidence = evidenceLookup(record)
    const { decision, reason } = evaluateAutoReconcileDecision({ job, record, evidence })
    if (decision === null) {
      skipped.push({ occurrenceId: record.occurrenceId, reason })
      continue
    }
    let evidenceDigest = 'null'
    try { evidenceDigest = JSON.stringify(evidence)?.slice(0, 200) ?? 'null' } catch { /* unserializable evidence keeps the digest placeholder */ }
    targets.push({
      occurrenceId: record.occurrenceId,
      runId: record.runId,
      resolvedTo: decision,
      evidenceNote: `auto-reconcile policy (AGENT_DELIVERY_RESILIENCE_V1 CTR-S2): ${reason}; evidence=${evidenceDigest}`,
    })
  }
  return { targets, skipped }
}
