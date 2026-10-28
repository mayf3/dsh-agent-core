import assert from 'node:assert/strict'
import { test } from 'node:test'

import { wakeDomainOwnerAssistance } from '../src/workflow-execution-runtime.js'

const OWNER_PRINCIPAL = '11111111-1111-4111-8111-111111111111'
const CASE_ID = '22222222-2222-4222-8222-222222222222'
const WORKFLOW_ID = '33333333-3333-4333-8333-333333333333'
const VISIT_ID = '44444444-4444-4444-8444-444444444444'
const POLLER = 'agt_workflow-poller'
const OWNER = 'agt_domain-owner'

function principalAccess(result = { ok: true, result: { agentId: OWNER } }) {
  return {
    handlers: {
      agent_resolve_principal: {
        resolve: async () => result,
      },
    },
  }
}

const REVIEW = {
  phase: 'GOVERNANCE_CHILD_REVIEW',
  workflowInstanceId: WORKFLOW_ID,
  nodeVisitId: VISIT_ID,
  assistanceCaseId: CASE_ID,
  ownerPrincipalId: OWNER_PRINCIPAL,
  ownerBindingId: '55555555-5555-4555-8555-555555555555',
  reviewWakeId: '66666666-6666-4666-8666-666666666666',
  bindingId: '77777777-7777-4777-8777-777777777777',
  governanceChildInstanceId: '88888888-8888-4888-8888-888888888888',
  childNodeVisitId: '99999999-9999-4999-8999-999999999999',
  childDefinitionVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  childTerminalEventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  acceptanceTransitionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  acceptanceContractDigest: 'a'.repeat(64),
  childSubmissionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  childSubmissionDigest: 'b'.repeat(64),
}

test('governance child review wake carries exact evidence instructions and recipient-bound identity', async () => {
  const deliveries = []
  const router = {
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    deliver: async (req, control) => { deliveries.push({ req, control }); return { sessionId: 'main' } },
  }
  const result = await wakeDomainOwnerAssistance({
    router, principalAccess: principalAccess(), pollerAgentId: POLLER, ...REVIEW,
  })
  assert.equal(result.ok, true)
  assert.equal(deliveries.length, 1)
  const delivery = deliveries[0]
  assert.equal(delivery.req.requestId,
    `wfassist-review-${REVIEW.bindingId}-${REVIEW.childTerminalEventId}-${REVIEW.ownerPrincipalId}-${REVIEW.reviewWakeId}`)
  assert.equal(delivery.req.agentId, OWNER)
  assert.match(delivery.req.message, new RegExp(REVIEW.childTerminalEventId))
  assert.match(delivery.req.message, new RegExp(REVIEW.childSubmissionId))
  assert.match(delivery.req.message, /workflow_instance_detail/)
  assert.match(delivery.req.message, /workflow_submission_history/)
  assert.match(delivery.req.message, /resolve_current_governance_review/)
  assert.match(delivery.req.message, /explicitly use/)
  assert.match(delivery.req.message, /escalate_to_human/)
  assert.match(delivery.req.message, /UNKNOWN/)
  assert.deepEqual(delivery.control.messageOrigin, {
    kind: 'inter_agent', sourceAgentId: POLLER,
    correlation: `workflow-assistance-review:${CASE_ID}:${REVIEW.bindingId}:${REVIEW.childTerminalEventId}:${OWNER_PRINCIPAL}:${REVIEW.reviewWakeId}`,
  })
})

test('review redelivery uses reviewWakeId even when the same Owner Principal returns', async () => {
  const deliveries = []
  const router = {
    resolveCallerCorrelation: ({ requestId }) => deliveries.some(({ req }) => req.requestId === requestId)
      ? { state: 'settled' } : { state: 'never_existed' },
    deliver: async (req) => { deliveries.push({ req }); return { sessionId: 'main' } },
  }
  const first = await wakeDomainOwnerAssistance({
    router, principalAccess: principalAccess(), pollerAgentId: POLLER, ...REVIEW,
  })
  const retry = await wakeDomainOwnerAssistance({
    router, principalAccess: principalAccess(), pollerAgentId: POLLER,
    ...REVIEW, ownerBindingId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  })
  const reassignedBack = await wakeDomainOwnerAssistance({
    router, principalAccess: principalAccess(), pollerAgentId: POLLER,
    ...REVIEW, reviewWakeId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  })
  assert.equal(first.ok, true)
  assert.equal(retry.reused, true)
  assert.equal(reassignedBack.ok, true)
  assert.equal(deliveries.length, 2)
  assert.notEqual(deliveries[0].req.requestId, deliveries[1].req.requestId)
})

test('owner assistance wake resolves exact principal and uses stable inter-agent delivery', async () => {
  const deliveries = []
  const router = {
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    deliver: async (req, control) => {
      deliveries.push({ req, control })
      return { sessionId: 'main' }
    },
  }
  const result = await wakeDomainOwnerAssistance({
    router, principalAccess: principalAccess(), pollerAgentId: POLLER,
    workflowInstanceId: WORKFLOW_ID, nodeVisitId: VISIT_ID,
    assistanceCaseId: CASE_ID, ownerPrincipalId: OWNER_PRINCIPAL,
    reason: 'ATTEMPTS_EXHAUSTED',
  })
  assert.equal(result.ok, true)
  assert.equal(result.ownerAgentId, OWNER)
  assert.equal(deliveries.length, 1)
  assert.equal(deliveries[0].req.requestId, 'wfassist-' + CASE_ID)
  assert.equal(deliveries[0].req.agentId, OWNER)
  assert.equal(deliveries[0].req.sessionMode, 'main')
  assert.match(deliveries[0].req.message, /OWNER_PENDING/)
  assert.match(deliveries[0].req.message, /workflow_assistance_action/)
  assert.deepEqual(deliveries[0].control.messageOrigin, {
    kind: 'inter_agent', sourceAgentId: POLLER,
    correlation: 'workflow-assistance:' + CASE_ID,
  })
})

test('existing pending/settled caller correlation suppresses duplicate prompt', async () => {
  let deliveries = 0
  const router = {
    resolveCallerCorrelation: () => ({ state: 'pending' }),
    deliver: async () => { deliveries += 1 },
  }
  const result = await wakeDomainOwnerAssistance({
    router, principalAccess: principalAccess(), pollerAgentId: POLLER,
    workflowInstanceId: WORKFLOW_ID, nodeVisitId: VISIT_ID,
    assistanceCaseId: CASE_ID, ownerPrincipalId: OWNER_PRINCIPAL,
  })
  assert.equal(result.ok, true)
  assert.equal(result.reused, true)
  assert.equal(deliveries, 0)
})

test('delivery error is accepted only when caller correlation proves admission', async () => {
  let queries = 0
  const router = {
    resolveCallerCorrelation: () => (++queries === 1
      ? { state: 'never_existed' }
      : { state: 'pending' }),
    deliver: async () => { throw Object.assign(new Error('lost receipt'), { status: 'outcome_unknown' }) },
  }
  const result = await wakeDomainOwnerAssistance({
    router, principalAccess: principalAccess(), pollerAgentId: POLLER,
    workflowInstanceId: WORKFLOW_ID, nodeVisitId: VISIT_ID,
    assistanceCaseId: CASE_ID, ownerPrincipalId: OWNER_PRINCIPAL,
  })
  assert.equal(result.ok, true)
  assert.equal(result.reused, true)
})

test('owner principal resolution failure prevents delivery and stays retryable', async () => {
  let deliveries = 0
  const router = {
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    deliver: async () => { deliveries += 1 },
  }
  const result = await wakeDomainOwnerAssistance({
    router,
    principalAccess: principalAccess({ ok: false, error: { code: 'principal_disabled' } }),
    pollerAgentId: POLLER,
    workflowInstanceId: WORKFLOW_ID, nodeVisitId: VISIT_ID,
    assistanceCaseId: CASE_ID, ownerPrincipalId: OWNER_PRINCIPAL,
  })
  assert.deepEqual(result, { ok: false, code: 'principal_disabled', detail: undefined })
  assert.equal(deliveries, 0)
})
