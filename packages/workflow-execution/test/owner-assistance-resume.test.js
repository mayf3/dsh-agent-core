import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyLedgerEvent } from '../src/ledger-events.js'
import { validateOwnerAssistanceResumeEvidence } from '../src/owner-assistance-resume.js'

const IDS = {
  dispatchIntentId: '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33',
  nodeVisitId: '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11',
  workflowInstanceId: '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55',
  ownerPrincipalId: '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66',
  assistanceCaseId: '6d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77',
  resolverPrincipalId: '7d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e88',
  policyCallerPrincipalId: '8d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e99',
}
const PREVIOUS_ATTEMPT = 'wfeat-0123456789abcdef01234567'

function evidence(overrides = {}) {
  return {
    dispatchIntentId: IDS.dispatchIntentId,
    workflowInstanceId: IDS.workflowInstanceId,
    nodeVisitId: IDS.nodeVisitId,
    ownerPrincipalId: IDS.ownerPrincipalId,
    activationState: 'ACTIVE',
    workflowStateVersion: 12,
    assistanceCaseId: IDS.assistanceCaseId,
    requestEventSequence: 11,
    resolutionEventSequence: 12,
    requesterPrincipalId: IDS.ownerPrincipalId,
    resolverPrincipalId: IDS.resolverPrincipalId,
    ingress: 'assignee',
    reason: null,
    lastAttemptId: null,
    ...overrides,
  }
}

function expected(overrides = {}) {
  return {
    ...IDS,
    previousAttemptId: PREVIOUS_ATTEMPT,
    previousPreDeliveryWorkflowStateVersion: 10,
    preDeliveryWorkflowStateVersion: 12,
    ...overrides,
  }
}

function attemptStateBeforeOwnerResume() {
  const attempts = new Map()
  applyLedgerEvent(attempts, {
    kind: 'attempt_planned', attemptId: PREVIOUS_ATTEMPT, generation: 1,
    nodeVisitId: IDS.nodeVisitId, dispatchIntentId: IDS.dispatchIntentId,
    workflowInstanceId: IDS.workflowInstanceId, ownerPrincipalId: IDS.ownerPrincipalId,
    preDeliveryWorkflowStateVersion: 10, atMs: 1,
  })
  applyLedgerEvent(attempts, { kind: 'delivery_started', nodeVisitId: IDS.nodeVisitId, atMs: 2 })
  applyLedgerEvent(attempts, {
    kind: 'run_delivered', nodeVisitId: IDS.nodeVisitId, agentId: 'agt_target',
    requestId: PREVIOUS_ATTEMPT, sessionId: 'main', reconciliationHandle: 'turn:prior', atMs: 3,
  })
  applyLedgerEvent(attempts, {
    kind: 'reconciled', nodeVisitId: IDS.nodeVisitId, verdict: 'NEEDS_REVIEW',
    judgment: 'run_ended_no_submission', reason: 'run ended without submission', atMs: 4,
  })
  return attempts
}

function ownerResumePlan(overrides = {}) {
  return {
    kind: 'attempt_planned',
    attemptId: 'wfeat-abcdefabcdefabcdefabcdef',
    generation: 2,
    nodeVisitId: IDS.nodeVisitId,
    dispatchIntentId: IDS.dispatchIntentId,
    workflowInstanceId: IDS.workflowInstanceId,
    ownerPrincipalId: IDS.ownerPrincipalId,
    preDeliveryWorkflowStateVersion: 12,
    previousAttemptId: PREVIOUS_ATTEMPT,
    retryReason: 'owner_assistance_resolved',
    assistanceResume: evidence(),
    atMs: 5,
    ...overrides,
  }
}

test('accepts exact current-assignee Assistance proof after the previous attempt baseline', () => {
  const checked = validateOwnerAssistanceResumeEvidence(evidence(), expected())
  assert.equal(checked.ok, true)
  assert.deepEqual(checked.evidence, evidence())
})

test('accepts execution-policy proof bound to the exact opaque previous attempt', () => {
  const policy = evidence({
    requesterPrincipalId: IDS.policyCallerPrincipalId,
    ingress: 'execution_policy',
    reason: 'ATTEMPTS_EXHAUSTED',
    lastAttemptId: PREVIOUS_ATTEMPT,
  })
  const checked = validateOwnerAssistanceResumeEvidence(policy, expected())
  assert.equal(checked.ok, true)
  assert.equal(checked.evidence.ingress, 'execution_policy')
})

test('rejects identity drift, non-active activation, or version drift', () => {
  for (const candidate of [
    evidence({ dispatchIntentId: IDS.workflowInstanceId }),
    evidence({ nodeVisitId: IDS.workflowInstanceId }),
    evidence({ ownerPrincipalId: IDS.resolverPrincipalId }),
    evidence({ activationState: 'CLOSED' }),
    evidence({ workflowStateVersion: 13 }),
  ]) {
    assert.equal(validateOwnerAssistanceResumeEvidence(candidate, expected()).ok, false)
  }
})

test('rejects events outside the previous-baseline and current-version interval', () => {
  for (const candidate of [
    evidence({ requestEventSequence: 10 }),
    evidence({ requestEventSequence: 12, resolutionEventSequence: 12 }),
    evidence({ requestEventSequence: 13, resolutionEventSequence: 14 }),
    evidence({ requestEventSequence: 11, resolutionEventSequence: 13 }),
  ]) {
    assert.equal(validateOwnerAssistanceResumeEvidence(candidate, expected()).ok, false)
  }
})

test('ordinary ingress requires current assignee requester and null policy fields', () => {
  for (const candidate of [
    evidence({ requesterPrincipalId: IDS.policyCallerPrincipalId }),
    evidence({ reason: 'ATTEMPTS_EXHAUSTED' }),
    evidence({ lastAttemptId: PREVIOUS_ATTEMPT }),
  ]) {
    assert.equal(validateOwnerAssistanceResumeEvidence(candidate, expected()).ok, false)
  }
})

test('policy ingress requires an enumerated reason and persisted previous attempt ID', () => {
  for (const candidate of [
    evidence({ ingress: 'execution_policy', reason: null, lastAttemptId: null }),
    evidence({ ingress: 'execution_policy', reason: 'made_up', lastAttemptId: PREVIOUS_ATTEMPT }),
    evidence({ ingress: 'execution_policy', reason: 'ATTEMPTS_EXHAUSTED', lastAttemptId: 'wfeat-other' }),
  ]) {
    assert.equal(validateOwnerAssistanceResumeEvidence(candidate, expected()).ok, false)
  }
})

test('rejects malformed, missing, or extra evidence fields without coercion', () => {
  const { workflowStateVersion: _ignored, ...missing } = evidence()
  assert.equal(validateOwnerAssistanceResumeEvidence(missing, expected()).ok, false)
  assert.equal(validateOwnerAssistanceResumeEvidence({ ...evidence(), payload: 'secret' }, expected()).ok, false)
  assert.equal(validateOwnerAssistanceResumeEvidence(evidence({ requestEventSequence: '11' }), expected()).ok, false)
  assert.equal(validateOwnerAssistanceResumeEvidence(evidence({ assistanceCaseId: 'not-a-uuid' }), expected()).ok, false)
})

test('replay admits one Owner-resume generation with complete settled predecessor and preserves the consumed case', () => {
  const attempts = attemptStateBeforeOwnerResume()
  applyLedgerEvent(attempts, ownerResumePlan())
  const resumed = attempts.get(IDS.nodeVisitId)
  assert.equal(resumed.attemptId, 'wfeat-abcdefabcdefabcdefabcdef')
  assert.equal(resumed.retryReason, 'owner_assistance_resolved')
  assert.equal(resumed.preDeliveryWorkflowStateVersion, 12)
  assert.deepEqual(resumed.assistanceResume, evidence())
  assert.deepEqual(resumed.consumedAssistanceCaseIds, [IDS.assistanceCaseId])
})

test('replay refuses an Owner-resume plan against unknown, unsettled, or mismatched predecessor', () => {
  for (const setup of ['unknown', 'unsettled', 'moved']) {
    const attempts = attemptStateBeforeOwnerResume()
    if (setup === 'unknown') {
      const current = attempts.get(IDS.nodeVisitId)
      current.judgment = 'run_outcome_unknown'
    } else if (setup === 'unsettled') {
      attempts.get(IDS.nodeVisitId).state = 'ACTIVE'
    }
    const event = ownerResumePlan(setup === 'moved' ? { ownerPrincipalId: IDS.resolverPrincipalId } : {})
    assert.throws(() => applyLedgerEvent(attempts, event))
  }
})

test('replay refuses a reused case ID and malformed Owner proof on a later generation', () => {
  const attempts = attemptStateBeforeOwnerResume()
  applyLedgerEvent(attempts, ownerResumePlan())
  applyLedgerEvent(attempts, { kind: 'delivery_started', nodeVisitId: IDS.nodeVisitId, atMs: 6 })
  applyLedgerEvent(attempts, {
    kind: 'run_delivered', nodeVisitId: IDS.nodeVisitId, agentId: 'agt_target',
    requestId: 'wfeat-abcdefabcdefabcdefabcdef', sessionId: 'main', reconciliationHandle: 'turn:second', atMs: 7,
  })
  applyLedgerEvent(attempts, {
    kind: 'reconciled', nodeVisitId: IDS.nodeVisitId, verdict: 'NEEDS_REVIEW',
    judgment: 'run_ended_no_submission', reason: 'run ended without submission', atMs: 8,
  })
  assert.throws(() => applyLedgerEvent(attempts, ownerResumePlan({
    attemptId: 'wfeat-fedcbafedcbafedcbafedcba', generation: 3,
    previousAttemptId: 'wfeat-abcdefabcdefabcdefabcdef',
  })), /already consumed|assistance/i)
  assert.throws(() => applyLedgerEvent(attempts, ownerResumePlan({
    attemptId: 'wfeat-fedcbafedcbafedcbafedcba', generation: 3,
    previousAttemptId: 'wfeat-abcdefabcdefabcdefabcdef',
    assistanceResume: evidence({ resolutionEventSequence: 13 }),
  })), /corrupt ledger|assistance/i)
})
