/**
 * @agent-core/workflow-execution/src/attention.js — the execution-attention
 * read projection (WORKFLOW_EXECUTION_CONTROL_V1 §0: the control plane must
 * answer, from system-owned facts alone, "why nothing completed, and when
 * Domain Owner attention or an explicit human escalation exists").
 *
 * A PURE fleet-level selection over the SAME CTR-WEC1-001/002 projection:
 * a node visit is attention-worthy ONLY when its frozen executionState is
 * one of the attention states below; in-flight normals (DISPATCHED/RUNNING)
 * and terminal-OK (SETTLED) are never attention, and no condition is ever
 * inferred from wall-clock heuristics — staleness is the ledger's own
 * recorded `stale_no_progress` judgment, not an age computation. Absent
 * facts (agentId/sessionId/escalation) stay absent. This module is a
 * projection, NOT a store: the attempts ledger stays the only execution
 * evidence store, and the projection never mutates the snapshot it reads.
 */

import { projectExecutionTraces } from './projection.js'

/**
 * The frozen executionState values that require human attention. Every
 * value is a CTR-WEC1-002 output; nothing outside that table can appear.
 */
export const ATTENTION_STATES = Object.freeze([
  'OUTCOME_UNKNOWN',
  'OWNER_PENDING',
  'RUN_ENDED_NO_TRANSITION',
  'STALE_NO_PROGRESS',
  'BLOCKED',
])

/** Evidence-grounded reason phrase per attention state (frozen). */
export const ATTENTION_REASONS = Object.freeze({
  OUTCOME_UNKNOWN: 'run outcome unknown — reconciliation required; side effects possible (outcome_unknown fence)',
  OWNER_PENDING: 'system escalation fact recorded — Domain Owner assistance pending',
  RUN_ENDED_NO_TRANSITION: 'run ended without a workflow transition — no business progress observed',
  STALE_NO_PROGRESS: 'ledger judgment stale_no_progress — execution made no progress',
  BLOCKED: 'resolution blocked',
})

/** The engine's attempt-limit escalation reason (CTR-WEC1-004/005). */
const ATTEMPTS_EXHAUSTED_REASON = 'ATTEMPTS_EXHAUSTED'

function attentionItemFor(entry) {
  const reason = ATTENTION_REASONS[entry.executionState]
  const escalation = entry.escalation
  return {
    workflowInstanceId: entry.workflowInstanceId,
    nodeVisitId: entry.nodeVisitId,
    executionState: entry.executionState,
    ...(reason !== undefined ? { reason } : {}),
    attemptId: entry.attemptId,
    generation: entry.generation,
    attemptCount: entry.attemptCount,
    // Budget exhaustion is asserted ONLY from the recorded escalation fact —
    // never derived from attemptCount arithmetic.
    ...(escalation?.reason === ATTEMPTS_EXHAUSTED_REASON ? { attemptBudgetExhausted: true } : {}),
    ...(escalation !== undefined ? { escalation } : {}),
    ...(entry.agentId !== undefined ? { agentId: entry.agentId } : {}),
    ...(entry.sessionId !== undefined ? { sessionId: entry.sessionId } : {}),
    startedAtMs: entry.startedAtMs,
    updatedAtMs: entry.updatedAtMs,
  }
}

/**
 * Project the fleet-level attention summary from a ledger snapshot.
 * @param {object[]} attempts - ledger snapshot / snapshotFresh() output.
 * @returns {{items: object[], counts: Record<string, number>}} items sorted
 *   longest-stuck-first (updatedAtMs ascending, nodeVisitId tiebreak);
 *   counts carry every attention state key (zero is a fact, not an absence).
 */
export function projectExecutionAttention(attempts) {
  if (!Array.isArray(attempts)) throw new TypeError('workflow-execution: projection requires an attempts array')
  const traces = projectExecutionTraces(attempts)
  const items = []
  const counts = Object.fromEntries(ATTENTION_STATES.map((state) => [state, 0]))
  for (const entry of Object.values(traces)) {
    for (const visit of entry.nodeVisits) {
      if (!ATTENTION_STATES.includes(visit.executionState)) continue
      counts[visit.executionState] += 1
      items.push(attentionItemFor({ ...visit, workflowInstanceId: entry.workflowInstanceId }))
    }
  }
  items.sort((a, b) => (a.updatedAtMs ?? 0) - (b.updatedAtMs ?? 0) || String(a.nodeVisitId).localeCompare(String(b.nodeVisitId)))
  return { items, counts }
}
