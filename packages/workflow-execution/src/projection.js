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
    // CTR-WEC1-002 table: a recorded escalation fact marks the review class
    // HUMAN_REQUIRED (the escalation object also rides SETTLED/stale chains,
    // whose judgment class stays stale_no_progress per the table).
    if (attempt.escalation !== undefined) return { state: 'HUMAN_REQUIRED' }
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
