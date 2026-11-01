import { DEFAULT_MAX_ATTEMPTS_PER_VISIT } from './ledger.js'

export function createTerminalAttemptOperations({ ledger, escalateAttemptLimit }) {
  async function isAtAttemptLimit(attempt) {
    const policy = ledger.attemptPolicy ? await ledger.attemptPolicy(attempt)
      : { limit: ledger.maxAttemptsPerVisit ?? DEFAULT_MAX_ATTEMPTS_PER_VISIT }
    return policy === undefined ? undefined : (attempt.generation ?? 1) >= policy.limit
  }

  async function maybeEscalateAtLimit(attempt) {
    if (!await isAtAttemptLimit(attempt) || attempt.escalation !== undefined) return
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
    const atLimit = await isAtAttemptLimit(attempt)
    if (atLimit === undefined) return
    if (atLimit) {
      await maybeEscalateAtLimit(attempt)
      return
    }
    if (await settleStale(attempt)) staleReentry.push(attempt.nodeVisitId)
  }

  return { isAtAttemptLimit, maybeEscalateAtLimit, settleStale, reconcileTerminalCandidate }
}
