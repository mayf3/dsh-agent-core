/**
 * @agent-core/workflow-execution — WORKFLOW_AGENT_EXECUTION_V1.
 *
 * Thin infrastructure connecting svc-workflow's Agent-owned NodeVisit /
 * DISPATCH_INTENT due feed to dsh-agent-core Agent Runs:
 *
 *   due DISPATCH_INTENT -> atomic one-attempt-per-NodeVisit fence
 *   -> canonical assignee resolution -> agent-router Run admission with
 *   trusted `workflow_execution` provenance -> ledger linkage
 *   -> deterministic reconcile (SETTLED | ACTIVE | NEEDS_REVIEW).
 *
 * The engine's real I/O seams are wired in
 * production-runtime/src/workflow-execution-runtime.js.
 */

export { ExecutionLedger, attemptIdFor, ATTEMPT_STATES, LEDGER_EVENTS_FILE, LEDGER_LOCK_FILE } from './ledger.js'
export { normalizeDueIntent, judgeSettleFromDetail, judgeAttempt } from './judgment.js'
export { buildExecutionInstruction } from './instruction.js'
export { createWorkflowExecutionEngine, DEFAULT_POLL_INTERVAL_MS, DEFAULT_MAX_ADMISSIONS_PER_POLL } from './engine.js'
