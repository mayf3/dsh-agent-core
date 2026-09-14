export const RECONCILIATION_RESULTS = Object.freeze({
  RECONCILED_SUCCESS: 'RECONCILED_SUCCESS',
  RECONCILED_FAILURE: 'RECONCILED_FAILURE',
  STILL_IN_FLIGHT: 'STILL_IN_FLIGHT',
  QUARANTINED_UNKNOWN: 'QUARANTINED_UNKNOWN',
})

const TRUSTED_EVIDENCE_SOURCES = new Set(['router', 'router-current-readback', 'business-ledger', 'scheduler-runtime'])
export const DEFAULT_RECONCILIATION_EVIDENCE_MAX_AGE_MS = 5 * 60 * 1000

function exactTrusted(evidence, identity, { nowMs, maxEvidenceAgeMs }) {
  return evidence?.trusted === true
    && evidence.fresh === true
    && TRUSTED_EVIDENCE_SOURCES.has(evidence.source)
    && evidence.jobId === identity.jobId
    && evidence.occurrenceId === identity.occurrenceId
    && evidence.runId === identity.runId
    && evidence.epoch === identity.epoch
    && Number.isFinite(evidence.observedAt)
    && evidence.observedAt <= nowMs
    && nowMs - evidence.observedAt <= maxEvidenceAgeMs
}

function quarantine(reason) {
  return { classification: RECONCILIATION_RESULTS.QUARANTINED_UNKNOWN, path: 'quarantine', releaseFence: false, zeroWrite: true, reason }
}

export function classifyReconciliationEvidence({ identity, businessOutcome, termination, live } = {}, {
  nowMs = Date.now(), maxEvidenceAgeMs = DEFAULT_RECONCILIATION_EVIDENCE_MAX_AGE_MS,
} = {}) {
  if (!identity?.jobId || !identity?.occurrenceId || !identity?.runId) return quarantine('identity incomplete')
  const supplied = [businessOutcome, termination, live].filter(Boolean)
  if (!Number.isFinite(nowMs) || !Number.isFinite(maxEvidenceAgeMs) || maxEvidenceAgeMs < 0
    || supplied.some((evidence) => !exactTrusted(evidence, identity, { nowMs, maxEvidenceAgeMs }))) {
    return quarantine('evidence identity, trust, or freshness provenance invalid')
  }
  if ((businessOutcome && live?.live === true) || (termination?.terminated === true && live?.live === true)
    || (businessOutcome && termination?.terminated === false)) return quarantine('trusted evidence conflicts across sources')
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

export async function dispatchReconciliation({ evidence, settleBusiness, settleTermination, nowMs, maxEvidenceAgeMs }) {
  const result = classifyReconciliationEvidence(evidence, { nowMs, maxEvidenceAgeMs })
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
