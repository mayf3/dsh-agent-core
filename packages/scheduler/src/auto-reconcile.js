/**
 * D-009 / SCHEDULER_TIMEOUT_OUTCOME_V3 policy, corrected by
 * AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1 CTR-527D2-001..004.
 * Current Router readback is the evidence authority. Labels and missing
 * records never prove outcome or termination. All writes use mutateDoc.
 */
import { createHash } from 'node:crypto'
import { applyTransition, isUnresolvedUnknown, rebuildFences } from './occurrence-model.js'
import { deriveJobStateSummary } from './eligibility.js'

export const AUTO_RECONCILE_DEFAULT_ACTOR_ID = 'system:fence-auto-reconcile'
export const AUTO_RECONCILE_MAX_SETTLEMENTS = 50
const MAX_EVIDENCE_AGE_MS = 5 * 60 * 1000
const TERMINATION_KINDS = new Set(['exact_terminal_then_idle', 'exact_queued_removal', 'child_real_exit', 'cancellation_ack', 'restart_quiescence_proven'])
const hash = (parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)
const businessUnknown = (record) => record?.state === 'outcome_unknown' && record.lateSettlement === undefined
const noAction = (reason) => ({ decision: null, reason })

/** Current, non-consuming exact Router readback; invoked again under the lock. */
export function createRouterRecoveryEvidenceLookup(router, clock = () => Date.now()) {
  if (typeof router?.resolveCallerCorrelation !== 'function'
    || typeof router?.reconciliationRuntimeStatus !== 'function') return null
  return (record) => ({
    ...router.resolveCallerCorrelation({
      occurrenceId: record.occurrenceId, runId: record.runId,
      requestId: record.requestId ?? record.idempotencyKey,
    }),
    source: 'router-current-readback', trusted: true,
    currentEpoch: router.reconciliationRuntimeStatus().generationId,
    observedAt: clock(),
  })
}

/** Ordered exact/trust/epoch/coherence gate; no string alone crosses it. */
export function evaluateAutoReconcileDecision({ job, record, evidence, nowMs = Date.now() }) {
  if (!job || !record) return noAction('missing_input')
  if (job.schedule?.kind === 'at') return noAction('one_shot_at_human_required')
  if (!businessUnknown(record)) return noAction('business_already_settled')
  if (record.recordSchemaVersion !== 3 || record.jobId !== job.id
    || record.ownerAgentId !== job.agentId) return noAction('owner_or_job_mismatch')
  const snapshot = evidence?.snapshot
  if (evidence?.source !== 'router-current-readback' || evidence.trusted !== true
    || evidence.state !== 'settled' || !snapshot
    || !Number.isFinite(nowMs) || !Number.isFinite(evidence.observedAt)
    || evidence.observedAt > nowMs || nowMs - evidence.observedAt > MAX_EVIDENCE_AGE_MS) {
    return noAction('missing_or_untrusted_evidence')
  }
  const requestId = record.requestId ?? record.idempotencyKey
  const correlation = snapshot.callerCorrelation
  const handle = typeof evidence.handle === 'string'
    ? evidence.handle.match(/^turn:([^:]+):a([1-9][0-9]*):g([1-9][0-9]*):s([1-9][0-9]*)$/) : null
  if (!handle || evidence.handle !== snapshot.handle || evidence.handle !== snapshot.turnExecutionId
    || snapshot.runtimeEpoch !== evidence.currentEpoch || handle[1] !== evidence.currentEpoch
    || Number(handle[3]) !== snapshot.processGeneration || snapshot.state !== 'settled'
    || snapshot.agentId !== job.agentId || typeof requestId !== 'string' || requestId === ''
    || correlation?.occurrenceId !== record.occurrenceId || correlation.runId !== record.runId
    || correlation.requestId !== requestId) return noAction('exact_identity_or_epoch_mismatch')
  const outcome = snapshot.lateOutcome ?? snapshot.outcome
  const business = snapshot.outcomeEvidence === 'exact_turn_end_success' ? 'succeeded'
    : snapshot.outcomeEvidence === 'exact_turn_end_failure' ? 'failed' : null
  const expectedOutcome = business === 'succeeded' ? ['completed', 'late_completed'] : ['failed', 'late_failed']
  // Both fields, when supplied, must agree. Contradictory trusted facts
  // quarantine instead of selecting a winner by field order.
  if (snapshot.outcome != null && snapshot.lateOutcome != null
    && snapshot.outcome !== snapshot.lateOutcome) return noAction('conflicting_evidence')
  if (snapshot.settlementResult != null && snapshot.settlementResult !== outcome) return noAction('conflicting_evidence')
  if (business !== null) {
    if (!expectedOutcome.includes(outcome)) return noAction('conflicting_evidence')
    if (snapshot.terminationEvidence != null && !TERMINATION_KINDS.has(snapshot.terminationEvidence)) return noAction('conflicting_evidence')
    return { decision: business, reason: 'trusted_exact_business_outcome', handle: evidence.handle }
  }
  if (snapshot.outcomeEvidence != null) return noAction('unsupported_business_evidence')
  if (outcome === 'terminated_without_outcome' && TERMINATION_KINDS.has(snapshot.terminationEvidence)) {
    return { decision: 'terminated_without_outcome', reason: 'trusted_exact_termination_only', handle: evidence.handle, evidenceKind: snapshot.terminationEvidence }
  }
  return noAction('ambiguous_evidence_human_required')
}

/** Pure bounded planner. Terminated UNKNOWNs remain eligible for late outcome. */
export function planAutoReconcilePass(doc, evidenceLookup, { maxSettlements = AUTO_RECONCILE_MAX_SETTLEMENTS, nowMs, clock = () => Date.now() } = {}) {
  const jobsById = new Map((doc.jobs ?? []).map((job) => [job.id, job]))
  const targets = []
  const skipped = []
  if (typeof evidenceLookup !== 'function') return { targets, skipped: [{ occurrenceId: null, reason: 'evidence_lookup_unavailable_default_off' }] }
  for (const record of doc.occurrences ?? []) {
    if (!businessUnknown(record)) continue
    if (targets.length >= maxSettlements) {
      skipped.push({ occurrenceId: record.occurrenceId, reason: 'max_settlements_reached' })
      continue
    }
    const evaluated = evaluateAutoReconcileDecision({ job: jobsById.get(record.jobId), record, evidence: evidenceLookup(record), nowMs: nowMs ?? clock() })
    if (evaluated.decision === null || evaluated.decision === 'terminated_without_outcome' && !isUnresolvedUnknown(record)) {
      skipped.push({ occurrenceId: record.occurrenceId, reason: evaluated.reason })
      continue
    }
    targets.push({ occurrenceId: record.occurrenceId, runId: record.runId, resolvedTo: evaluated.decision })
  }
  return { targets, skipped }
}

class NoWrite extends Error {
  constructor(value) {
    super('auto-reconcile: no authoritative write')
    this.value = value
  }
}

function applyPolicySettlement(record, decision, { actorId, nowMs, fenceBefore }) {
  const evidenceId = `ev:${hash([decision.handle, decision.evidenceKind ?? decision.decision])}`
  if (decision.decision === 'terminated_without_outcome') {
    record.terminationSettlement = {
      kind: 'terminated_without_outcome', businessStateAtCommit: 'outcome_unknown',
      requestId: record.requestId ?? record.idempotencyKey,
      evidenceKind: decision.evidenceKind, evidenceId,
      actorKind: 'scheduler-policy', actorId, actorProvenance: 'scheduler-policy',
      operationId: `op:${hash(['policy-auto-reconcile', actorId, record.occurrenceId, record.runId])}`,
      fenceBefore, fenceAfter: false, scheduleDisposition: 'recurring_future_natural_only',
      settledAt: nowMs, committedAt: nowMs,
    }
    record.terminalEvidence = { kind: 'termination-only', detailRef: evidenceId }
    record.history.push({ at: nowMs, from: 'outcome_unknown', to: 'outcome_unknown', reason: 'policy trusted exact termination without business outcome' })
    record.endedAt = nowMs
  } else {
    applyTransition(record, {
      to: decision.decision, at: nowMs, endedAt: nowMs,
      reason: `policy auto-reconcile: ${decision.reason}`, executionOutcome: decision.decision,
      lateSettlement: { resolvedTo: decision.decision, resolvedAt: nowMs, basis: 'policy-auto-reconcile', evidenceRef: decision.handle },
      terminalEvidence: { kind: 'policy-auto-reconcile', detailRef: decision.handle },
    })
  }
  return evidenceId
}

/** Sole atomic policy writer; re-read current evidence for each exact target. */
export async function autoReconcileOccurrences(store, {
  settlements, actorId = AUTO_RECONCILE_DEFAULT_ACTOR_ID, evidenceLookup, nowMs, clock = () => Date.now(),
}) {
  if (!Array.isArray(settlements) || settlements.length === 0) return { results: [], fencesRemaining: null }
  if (typeof actorId !== 'string' || !/^system:[a-z0-9-]+$/.test(actorId)) throw new TypeError('autoReconcileOccurrences: actorId must be a machine identity of the form system:<kebab-id>')
  if (typeof evidenceLookup !== 'function') return { results: [], fencesRemaining: null }
  const identity = { provenance: 'scheduler-policy', actorId }
  let value
  try {
    ({ value } = await store.mutateDoc((latest) => {
      const results = []
      const touchedJobs = new Set()
      for (const target of settlements) {
        const record = latest.occurrences.find((item) => item.occurrenceId === target?.occurrenceId)
        const job = latest.jobs.find((item) => item.id === record?.jobId)
        if (!record || record.runId !== target.runId) {
          results.push({ occurrenceId: target?.occurrenceId ?? null, outcome: 'skipped', reason: 'identity_drift' })
          continue
        }
        const decision = evaluateAutoReconcileDecision({ job, record, evidence: evidenceLookup(record), nowMs: nowMs ?? clock() })
        if (decision.decision === null || decision.decision !== target.resolvedTo
          || decision.decision === 'terminated_without_outcome' && !isUnresolvedUnknown(record)) {
          results.push({ occurrenceId: record.occurrenceId, outcome: 'skipped', reason: decision.reason })
          continue
        }
        const resolvedAt = nowMs ?? clock()
        const evidenceId = applyPolicySettlement(record, decision, { actorId, nowMs: resolvedAt, fenceBefore: latest.fences[record.jobId] !== undefined })
        latest.fences = rebuildFences(latest.occurrences)
        if (decision.decision === 'terminated_without_outcome') record.terminationSettlement.fenceAfter = latest.fences[record.jobId] !== undefined
        touchedJobs.add(record.jobId)
        results.push({ occurrenceId: record.occurrenceId, runId: record.runId, jobId: record.jobId, outcome: 'settled', resolvedTo: decision.decision, evidenceId, evidenceRef: decision.handle, resolvedAt })
      }
      const result = { results, fencesRemaining: Object.keys(latest.fences).length }
      if (touchedJobs.size === 0) throw new NoWrite(result)
      for (const job of latest.jobs) {
        if (touchedJobs.has(job.id)) job.state = deriveJobStateSummary(job, latest.occurrences, nowMs ?? clock())
      }
      return { value: result }
    }))
  } catch (error) {
    if (error instanceof NoWrite) value = error.value
    else if (error?.mutationOutcome === 'committed' && error.committedValue) value = error.committedValue
    else throw error
  }
  for (const result of value.results) {
    if (result.outcome !== 'settled') continue
    try {
      const receipt = await store.appendRunEvent({
        ts: result.resolvedAt, action: result.resolvedTo === 'terminated_without_outcome' ? 'termination_settlement' : 'late_settlement',
        ...result, basis: 'policy-auto-reconcile', operatorIdentity: identity,
        fenceRemaining: value.fencesRemaining,
      })
      result.receipt = receipt?.ok === false ? 'failed' : 'ok'
    } catch (error) {
      result.receipt = `failed:${String(error?.message ?? error).slice(0, 120)}`
    }
  }
  return { ...value, identity }
}
