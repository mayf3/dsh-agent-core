import { DEFAULT_MAX_ATTEMPTS_PER_VISIT } from './ledger.js'

/** Candidate selection only; commits still revalidate under the ledger lock. */
export function staleCandidates(attempts, thresholdMs, nowMs) {
  if (!Number.isInteger(thresholdMs) || thresholdMs < 1) {
    throw new TypeError('workflow-execution: listStaleCandidatesFresh requires a positive integer thresholdMs')
  }
  return attempts.filter(attempt => attempt.delivered !== undefined
    && attempt.retryReason !== 'owner_assistance_resolved'
    && nowMs - attempt.delivered.atMs >= thresholdMs
    && ((attempt.state === 'ACTIVE' && attempt.phase === 'run_delivered')
      || (attempt.state === 'NEEDS_REVIEW' && attempt.judgment === 'run_ended_no_submission')))
}

export function runEndedCandidates(attempts, retryDelayMs, nowMs) {
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 1) {
    throw new TypeError('workflow-execution: listRunEndedCandidatesFresh requires a positive integer retryDelayMs')
  }
  return attempts.filter(attempt => attempt.state === 'NEEDS_REVIEW'
    && attempt.retryReason !== 'owner_assistance_resolved'
    && attempt.judgment === 'run_ended_no_submission'
    && Number.isInteger(attempt.reconciledAtMs)
    && nowMs - attempt.reconciledAtMs >= retryDelayMs)
}

export function createTerminalAttemptOperations({ ledger, escalateAttemptLimit }) {
  async function isAtAttemptLimit(attempt) {
    const policy = ledger.attemptPolicy ? await ledger.attemptPolicy(attempt)
      : { limit: ledger.maxAttemptsPerVisit ?? DEFAULT_MAX_ATTEMPTS_PER_VISIT }
    return policy === undefined ? undefined : (attempt.generation ?? 1) >= policy.limit
  }

  async function maybeEscalateAtLimit(attempt) {
    if (!await isAtAttemptLimit(attempt) || attempt.escalation !== undefined) return
    return escalateAttemptLimit({ attempt, reason: 'ATTEMPTS_EXHAUSTED' })
  }

  async function settleStale(attempt) {
    const recorded = await ledger.recordStaleSuperseded({
      nodeVisitId: attempt.nodeVisitId,
      expectedAttemptId: attempt.attemptId, expectedGeneration: attempt.generation ?? 1,
      expected: { state: attempt.state, phase: attempt.phase, deliveredAtMs: attempt.delivered.atMs },
      observedWorkflowStateVersion: attempt.workflowStateVersionAtDispatch,
    })
    return recorded
  }

  async function reconcileTerminalCandidate(attempt, stale, staleReentry) {
    if (stale.kind !== 'stale_confirmed') return
    const atLimit = await isAtAttemptLimit(attempt)
    if (atLimit === undefined) return
    if (atLimit) {
      return maybeEscalateAtLimit(attempt)
    }
    const recorded = await settleStale(attempt)
    if (recorded.committed) staleReentry.push(attempt.nodeVisitId)
    return recorded
  }

  return { isAtAttemptLimit, maybeEscalateAtLimit, settleStale, reconcileTerminalCandidate }
}

/** CTR-WEC1-005: external wake first, then bind its fact to the observed attempt. */
export function createAttemptLimitEscalation({ ledger, escalateAttemptLimit, log }) {
  return async ({ attempt, reason }) => {
    if (typeof escalateAttemptLimit !== 'function') return
    const payload = {
      workflowInstanceId: attempt.workflowInstanceId,
      nodeVisitId: attempt.nodeVisitId,
      attemptCount: attempt.dispatchCount ?? attempt.generation ?? 1,
      lastAttemptId: attempt.attemptId,
      dispatchIntentId: attempt.dispatchIntentId,
      reason,
    }
    try {
      const result = await escalateAttemptLimit(payload)
      if (!result?.ok) {
        log.warn?.(`workflow-execution: escalation call failed for ${attempt.nodeVisitId} (${result?.code ?? 'unknown'}) — retried on a later pass`)
        return
      }
      const recorded = await ledger.recordEscalationRequested({
        ...payload, expectedAttemptId: attempt.attemptId, expectedGeneration: attempt.generation ?? 1,
      })
      if (recorded.committed) {
        log.log?.(`workflow-execution: owner assistance opened for ${attempt.nodeVisitId} (${reason}; svc case ${result.assistanceCaseId ?? 'n/a'})`)
      }
      return recorded
    } catch (error) {
      log.error?.(`workflow-execution: escalation error for ${attempt.nodeVisitId}: ${error?.message ?? error}`)
    }
  }
}
