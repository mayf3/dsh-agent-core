const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVIDENCE_KEYS = [
  'dispatchIntentId', 'workflowInstanceId', 'nodeVisitId', 'ownerPrincipalId',
  'activationState', 'workflowStateVersion', 'assistanceCaseId',
  'requestEventSequence', 'resolutionEventSequence', 'requesterPrincipalId',
  'resolverPrincipalId', 'ingress', 'reason', 'lastAttemptId',
]
const POLICY_REASONS = new Set(['ATTEMPTS_EXHAUSTED', 'STALE_LOOP_EXHAUSTED'])

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

function sameUuid(left, right) {
  return isUuid(left) && isUuid(right) && left.toLowerCase() === right.toLowerCase()
}

function invalid(reason) {
  return { ok: false, reason }
}

/** Validate the closed svc CTR-SWEC-010 DTO against the current exact plan. */
export function validateOwnerAssistanceResumeEvidence(evidence, expected) {
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return invalid('evidence_not_object')
  }
  if (expected === null || typeof expected !== 'object' || Array.isArray(expected)) {
    return invalid('expected_plan_not_object')
  }
  const keys = Object.keys(evidence).sort()
  const expectedKeys = [...EVIDENCE_KEYS].sort()
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key, index) => key === keys[index])) {
    return invalid('evidence_shape_mismatch')
  }
  for (const field of ['dispatchIntentId', 'workflowInstanceId', 'nodeVisitId', 'ownerPrincipalId', 'assistanceCaseId', 'requesterPrincipalId', 'resolverPrincipalId']) {
    if (!isUuid(evidence[field])) return invalid(`invalid_${field}`)
  }
  for (const field of ['dispatchIntentId', 'workflowInstanceId', 'nodeVisitId', 'ownerPrincipalId']) {
    if (!sameUuid(evidence[field], expected[field])) return invalid(`${field}_mismatch`)
  }
  if (evidence.activationState !== 'ACTIVE') return invalid('activation_not_active')
  if (!Number.isInteger(expected.preDeliveryWorkflowStateVersion)
    || expected.preDeliveryWorkflowStateVersion < 1
    || evidence.workflowStateVersion !== expected.preDeliveryWorkflowStateVersion) {
    return invalid('workflow_state_version_mismatch')
  }
  const previousBaseline = expected.previousPreDeliveryWorkflowStateVersion
  if (!Number.isInteger(previousBaseline) || previousBaseline < 1
    || !Number.isInteger(evidence.requestEventSequence)
    || !Number.isInteger(evidence.resolutionEventSequence)
    || evidence.requestEventSequence <= previousBaseline
    || evidence.resolutionEventSequence <= evidence.requestEventSequence
    || evidence.resolutionEventSequence > evidence.workflowStateVersion) {
    return invalid('event_sequence_mismatch')
  }
  if (typeof expected.previousAttemptId !== 'string' || expected.previousAttemptId === '') {
    return invalid('previous_attempt_missing')
  }
  if (evidence.ingress === 'assignee') {
    if (!sameUuid(evidence.requesterPrincipalId, evidence.ownerPrincipalId)) return invalid('assignee_requester_mismatch')
    if (evidence.reason !== null || evidence.lastAttemptId !== null) return invalid('assignee_policy_fields_not_null')
  } else if (evidence.ingress === 'execution_policy') {
    if (typeof evidence.reason !== 'string' || !POLICY_REASONS.has(evidence.reason)) return invalid('policy_reason_invalid')
    if (typeof evidence.lastAttemptId !== 'string' || evidence.lastAttemptId !== expected.previousAttemptId) {
      return invalid('policy_previous_attempt_mismatch')
    }
  } else {
    return invalid('ingress_invalid')
  }
  return { ok: true, evidence }
}
