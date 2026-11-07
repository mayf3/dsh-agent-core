import { recoveryIdentity, matchesRecoveryTrigger, RECOVERY_RULE } from './automatic-ledger.js'

/** Existing reconciler consumer only: no queue/timer, and no second admission path. */
export function createAutomaticRecovery({ ledger, recover, clock, config }) {
  const budget = config.maxRecoveryChecksPerPoll ?? 25
  const delayMs = config.recoveryRetryDelayMs ?? 30_000
  const maxDelayMs = config.recoveryMaxDelayMs ?? 300_000
  for (const [name, value] of Object.entries({ maxRecoveryChecksPerPoll: budget,
    recoveryRetryDelayMs: delayMs, recoveryMaxDelayMs: maxDelayMs })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`workflow-execution: config.${name} must be a finite positive integer`)
  }
  if (maxDelayMs < delayMs || !Number.isSafeInteger(clock() + maxDelayMs)) {
    throw new TypeError('workflow-execution: invalid recovery delay range')
  }
  const enabled = () => config.automaticRecoveryEnabled === true

  async function reconcile() {
    if (!enabled()) return []
    const attempts = await ledger.inspectFresh(items => items.filter(a => a.state === 'ACTIVE'
      && a.phase === 'resolution_blocked' && (a.recoveryCheck?.nextCheckAtMs ?? 0) <= clock())
      .sort((a, b) => (a.recoveryCheck?.nextCheckAtMs ?? 0) - (b.recoveryCheck?.nextCheckAtMs ?? 0)
        || a.createdAtMs - b.createdAtMs || a.attemptId.localeCompare(b.attemptId)).slice(0, budget))
    const results = []
    for (const attempt of attempts) {
      if (!enabled()) break
      results.push(await recover({ nodeVisitId: attempt.nodeVisitId }, {
        expected: recoveryIdentity(attempt),
        triggerId: `${attempt.attemptId}:${attempt.generation ?? 1}:${(attempt.recoveryCheck?.revision ?? 0) + 1}`,
      }))
    }
    return results
  }

  function eligible(attempt, context) {
    return enabled() && matchesRecoveryTrigger(attempt, context.expected)
      && (attempt.recoveryCheck?.nextCheckAtMs ?? 0) <= clock()
  }

  function checkpoint(record, attempt, context, result = 'checking') {
    const failures = Math.min((attempt.recoveryCheck?.failures ?? 0) + (result === 'checking' ? 1 : 0), 53)
    const nextCheckAtMs = result === 'checking'
      ? clock() + Math.min(maxDelayMs, delayMs * 2 ** Math.min(failures - 1, 30))
      : Math.max(attempt.recoveryCheck.nextCheckAtMs, clock() + delayMs)
    return record.recoveryChecked({ ...recoveryIdentity(attempt), ruleRef: RECOVERY_RULE,
      triggerId: context.triggerId, failures, nextCheckAtMs, result })
  }

  function audit(attempt, context, gateEvidence) {
    const { expectedAttemptId, expectedGeneration, expectedRecoveryRevision, ...ids } = recoveryIdentity(attempt)
    return { ...ids, kind: 'automatic', ruleRef: RECOVERY_RULE, triggerId: context.triggerId,
      attemptId: expectedAttemptId, generation: expectedGeneration, gateEvidence }
  }
  return { reconcile, eligible, checkpoint, audit, enabled }
}
