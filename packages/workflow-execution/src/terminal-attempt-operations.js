import { DEFAULT_MAX_ATTEMPTS_PER_VISIT } from './ledger.js'

export function createTerminalAttemptOperations({ ledger, escalateAttemptLimit }) {
  function isAtAttemptLimit(attempt) {
    return (attempt.generation ?? 1) >= (ledger.maxAttemptsPerVisit ?? DEFAULT_MAX_ATTEMPTS_PER_VISIT)
  }

  async function maybeEscalateAtLimit(attempt) {
    if (!isAtAttemptLimit(attempt) || attempt.escalation !== undefined) return
    await escalateAttemptLimit({ attempt, reason: 'ATTEMPTS_EXHAUSTED' })
  }

  async function settleStale(attempt) {
    const recorded = await ledger.recordStaleSuperseded({
      nodeVisitId: attempt.nodeVisitId,
      expected: { state: attempt.state, phase: attempt.phase, deliveredAtMs: attempt.delivered.atMs },
      observedWorkflowStateVersion: attempt.workflowStateVersionAtDispatch,
    })
    return recorded.committed
  }

  async function reconcileTerminalCandidate(attempt, stale, staleReentry) {
    if (stale.kind !== 'stale_confirmed') return
    if (isAtAttemptLimit(attempt)) {
      await maybeEscalateAtLimit(attempt)
      return
    }
    if (await settleStale(attempt)) staleReentry.push(attempt.nodeVisitId)
  }

  return { isAtAttemptLimit, maybeEscalateAtLimit, settleStale, reconcileTerminalCandidate }
}
