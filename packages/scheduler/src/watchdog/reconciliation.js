export const RECONCILIATION_RESULTS = Object.freeze({
  RECONCILED_SUCCESS: 'RECONCILED_SUCCESS',
  RECONCILED_FAILURE: 'RECONCILED_FAILURE',
  STILL_IN_FLIGHT: 'STILL_IN_FLIGHT',
  QUARANTINED_UNKNOWN: 'QUARANTINED_UNKNOWN',
})

function exactTrusted(evidence, identity) {
  return evidence?.trusted === true
    && evidence.jobId === identity.jobId
    && evidence.occurrenceId === identity.occurrenceId
    && evidence.runId === identity.runId
    && Number.isFinite(evidence.observedAt)
}

function quarantine(reason) {
  return { classification: RECONCILIATION_RESULTS.QUARANTINED_UNKNOWN, path: 'quarantine', releaseFence: false, zeroWrite: true, reason }
}

export function classifyReconciliationEvidence({ identity, businessOutcome, termination, live } = {}) {
  if (!identity?.jobId || !identity?.occurrenceId || !identity?.runId) return quarantine('identity incomplete')
  const supplied = [businessOutcome, termination, live].filter(Boolean)
  if (supplied.some((evidence) => !exactTrusted(evidence, identity))) return quarantine('evidence identity, trust, or freshness provenance invalid')
  if (businessOutcome && live?.live === true) return quarantine('trusted business outcome conflicts with live evidence')
  if (businessOutcome) {
    if (!['succeeded', 'failed'].includes(businessOutcome.status)) return quarantine('unsupported business outcome')
    return {
      classification: businessOutcome.status === 'succeeded'
        ? RECONCILIATION_RESULTS.RECONCILED_SUCCESS
        : RECONCILIATION_RESULTS.RECONCILED_FAILURE,
      path: 'business-outcome', releaseFence: true, zeroWrite: false,
    }
  }
  if (termination?.terminated === true) {
    return { classification: null, path: 'termination-only', releaseFence: true, zeroWrite: false, replayOccurrence: false, nextSchedule: 'future-natural-only' }
  }
  if (live?.live === true && live.fresh === true) {
    return { classification: RECONCILIATION_RESULTS.STILL_IN_FLIGHT, path: 'live', releaseFence: false, zeroWrite: true }
  }
  return quarantine('bounded evidence exhausted')
}

export async function dispatchReconciliation({ evidence, settleBusiness, settleTermination }) {
  const result = classifyReconciliationEvidence(evidence)
  if (result.path === 'business-outcome') {
    await settleBusiness?.({ identity: evidence.identity, classification: result.classification, evidence: evidence.businessOutcome })
  } else if (result.path === 'termination-only') {
    await settleTermination?.({ identity: evidence.identity, evidence: evidence.termination })
  }
  return result
}

export function unresolvedFenceContributions(occurrences, jobId) {
  return (occurrences ?? [])
    .filter((record) => record.jobId === jobId && record.state === 'outcome_unknown' && record.terminationSettlement === undefined)
    .map((record) => record.occurrenceId)
    .sort()
}
