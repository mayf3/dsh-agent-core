/** Closed, secret-free outer failure projection (V3 C-026). */
const RECOVERY_PROJECTION_KEYS = Object.freeze([
  'fencedBy', 'reconciliationHandle', 'processGeneration', 'terminationEvidence',
  'missingEvidence', 'attemptedActions', 'nextSafeAction', 'replyDelivery',
  'partialDelivery', 'requestAdmission',
])

export function outerFailureProjection(error, failureStage, recovery = {}) {
  const projection = {
    error,
    failureStage,
    fencedBy: null,
    reconciliationHandle: null,
    processGeneration: null,
    terminationEvidence: null,
    missingEvidence: [],
    attemptedActions: [],
    nextSafeAction: 'none',
    replyDelivery: 'not_attempted',
    partialDelivery: 'none',
    requestAdmission: failureStage === 'admission' ? 'not_admitted' : 'accepted',
  }
  for (const key of RECOVERY_PROJECTION_KEYS) {
    if (error?.[key] !== undefined) projection[key] = error[key]
  }
  return Object.assign(projection, recovery)
}
