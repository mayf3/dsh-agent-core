/**
 * @agent-core/workflow-execution/src/projection.js — the execution trace
 * read model (WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-001/002).
 *
 * A PURE projection over the ledger snapshot: per workflowInstanceId, the
 * NodeVisit → Attempt → Run chain with the system-owned execution state.
 * No I/O, no clocks in the judgment itself — the caller may stamp
 * generatedAt. Every field comes from authoritative ledger facts; absent
 * facts stay absent (never inferred, never defaulted into existence).
 *
 * This is a projection, NOT a second ledger: the attempts.jsonl file stays
 * the only execution evidence store (Spec §1).
 */

import { STALE_NO_PROGRESS_JUDGMENT } from './ledger.js'
import { DELIVERY_WAL_PROTOCOL } from './ledger-plan.js'

/** B3: an observation about the ORIGINAL request, never admission permission.
 * Missing historical WAL provenance and a started fence both defeat non-send
 * proof. Router reservation alone is not a prompt acceptance receipt. */
export function reconcileDeliveryEvidence(attempt, resolveCallerCorrelation) {
  const result = {
    nodeVisitId: attempt.nodeVisitId, attemptId: attempt.attemptId,
    generation: attempt.generation ?? 1, requestId: attempt.attemptId,
    classification: 'UNKNOWN', businessOutcome: 'UNKNOWN', resumeAuthorized: false,
    responsibility: 'original_request_readback_or_escalation',
  }
  let correlation
  try {
    if (typeof resolveCallerCorrelation !== 'function') return { ...result, reason: 'correlation_unavailable' }
    correlation = resolveCallerCorrelation({ requestId: attempt.attemptId })
  } catch { return { ...result, reason: 'correlation_unavailable' } }
  if (correlation === null || typeof correlation !== 'object' || Array.isArray(correlation)) {
    return { ...result, reason: 'correlation_invalid' }
  }
  const snapshot = correlation.snapshot
  const caller = snapshot?.callerCorrelation
  if (['pending', 'recovering', 'settled'].includes(correlation.state)
    && typeof correlation.handle === 'string' && correlation.handle !== ''
    && snapshot?.handle === correlation.handle && snapshot.turnExecutionId === correlation.handle
    && snapshot.state === correlation.state && caller?.requestId === attempt.attemptId
    && caller.occurrenceId === undefined && caller.runId === undefined
    && typeof snapshot.agentId === 'string' && snapshot.agentId !== ''
    && typeof snapshot.sessionId === 'string' && snapshot.sessionId !== ''
    && typeof snapshot.messageId === 'string' && snapshot.messageId !== '') {
    return { ...result, classification: 'ACCEPTED', reason: 'original_prompt_receipt',
      responsibility: 'wait_original_receipt_or_reconcile',
      receipt: { reconciliationHandle: correlation.handle, agentId: snapshot.agentId,
        sessionId: snapshot.sessionId, messageId: snapshot.messageId, turnState: correlation.state } }
  }
  // An empty exact never_existed is only a secondary gate. It can NEVER
  // override delivery_started, nor turn an old unmarked plan into PROVEN_ZERO.
  if (correlation.state === 'never_existed' && Object.keys(correlation).length === 1
    && attempt.deliveryProtocol === DELIVERY_WAL_PROTOCOL
    && attempt.deliveryStartedAtMs === undefined && attempt.delivered === undefined) {
    return { ...result, classification: 'NOT_SENT', reason: 'wal_before_delivery_fence',
      responsibility: 'explicit_controlled_resolution' }
  }
  return { ...result, reason: attempt.deliveryStartedAtMs === undefined
    ? 'non_send_unproven' : 'delivery_started_without_exact_receipt' }
}

/**
 * CTR-WEC1-002 — the deterministic executionState mapping. Pure table over
 * one attempt projection. ELIGIBLE is a svc-workflow activation fact and is
 * deliberately NOT derivable here.
 * @returns {{state:string}}
 */
export function executionStateFor(attempt) {
  if (attempt.state === 'SETTLED') {
    return { state: attempt.judgment === STALE_NO_PROGRESS_JUDGMENT ? 'STALE_NO_PROGRESS' : 'SETTLED' }
  }
  if (attempt.state === 'NEEDS_REVIEW') {
    // A system escalation fact now means OWNER_PENDING assistance was opened.
    // HUMAN_REQUIRED is a later explicit Domain Owner action in svc-workflow
    // and must never be inferred from the execution ledger alone.
    if (attempt.escalation !== undefined) return { state: 'OWNER_PENDING' }
    if (attempt.judgment === 'run_ended_no_submission') return { state: 'RUN_ENDED_NO_TRANSITION' }
    // outcome_unknown and every unresolved/unknown-ish terminal class
    // (delivery_unverified, settle_check_unavailable, delivery_failed) is an
    // UNKNOWN until exact termination or business evidence lands — never
    // "not executed".
    return { state: 'OUTCOME_UNKNOWN' }
  }
  // ACTIVE
  if (attempt.phase === 'resolution_blocked') return { state: 'BLOCKED' }
  return { state: attempt.phase === 'run_delivered' ? 'RUNNING' : 'DISPATCHED' }
}

/** One trace entry per attempt chain (the visit's CURRENT generation facts
 *  plus the system attempt count). */
function traceEntryFor(attempt) {
  const { state } = executionStateFor(attempt)
  const delivered = attempt.delivered
  const escalation = attempt.escalation
  return {
    nodeVisitId: attempt.nodeVisitId,
    attemptId: attempt.attemptId,
    generation: attempt.generation ?? 1,
    dispatchIntentId: attempt.dispatchIntentId,
    ownerPrincipalId: attempt.ownerPrincipalId,
    ...(delivered?.agentId !== undefined ? { agentId: delivered.agentId } : {}),
    ...(delivered?.sessionId !== undefined ? { sessionId: delivered.sessionId } : {}),
    ...(delivered?.reconciliationHandle !== undefined ? { reconciliationHandle: delivered.reconciliationHandle } : {}),
    ...(delivered?.messageId !== undefined ? { messageId: delivered.messageId } : {}),
    executionState: state,
    attemptCount: attempt.dispatchCount ?? attempt.generation ?? 1,
    ...(escalation !== undefined
      ? {
        escalation: {
          reason: escalation.reason,
          ...(escalation.attemptCount !== undefined ? { attemptCount: escalation.attemptCount } : {}),
          atMs: escalation.atMs,
        },
      }
      : {}),
    startedAtMs: attempt.createdAtMs,
    updatedAtMs: attempt.staleSupersededAtMs
      ?? attempt.reconciledAtMs
      ?? delivered?.atMs
      ?? attempt.lastBlockedAtMs
      ?? attempt.createdAtMs,
  }
}

/**
 * Project the full trace, grouped by workflowInstanceId.
 * @param {object[]} attempts - ledger snapshot / snapshotFresh() output.
 * @returns {Record<string, {workflowInstanceId:string, nodeVisits:object[]}>}
 */
export function projectExecutionTraces(attempts) {
  if (!Array.isArray(attempts)) throw new TypeError('workflow-execution: projection requires an attempts array')
  const byInstance = new Map()
  for (const attempt of attempts) {
    if (typeof attempt?.workflowInstanceId !== 'string' || attempt.workflowInstanceId === '') continue
    let entry = byInstance.get(attempt.workflowInstanceId)
    if (entry === undefined) {
      entry = { workflowInstanceId: attempt.workflowInstanceId, nodeVisits: [] }
      byInstance.set(attempt.workflowInstanceId, entry)
    }
    entry.nodeVisits.push(traceEntryFor(attempt))
  }
  for (const entry of byInstance.values()) {
    // Deterministic order: creation order of the visits' first attempts.
    entry.nodeVisits.sort((a, b) => (a.startedAtMs ?? 0) - (b.startedAtMs ?? 0))
  }
  return Object.fromEntries([...byInstance.entries()].map(([k, v]) => [k, v]))
}

/**
 * One workflowInstanceId's trace (or null when this runtime has never
 * attempted any of its visits).
 */
export function projectExecutionTrace(attempts, { workflowInstanceId, nodeVisitId } = {}) {
  if (typeof workflowInstanceId !== 'string' || workflowInstanceId === '') {
    throw new TypeError('workflow-execution: projectExecutionTrace requires workflowInstanceId')
  }
  const key = workflowInstanceId.toLowerCase()
  const all = projectExecutionTraces(attempts)
  const entry = all[key]
  if (entry === undefined) return null
  if (typeof nodeVisitId === 'string' && nodeVisitId !== '') {
    const visitKey = nodeVisitId.toLowerCase()
    const filtered = entry.nodeVisits.filter((v) => v.nodeVisitId === visitKey)
    if (filtered.length === 0) return null
    return { workflowInstanceId: key, nodeVisits: filtered }
  }
  return entry
}
