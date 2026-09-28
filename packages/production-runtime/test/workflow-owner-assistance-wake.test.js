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
}test('owner assistance wake resolves exact principal and uses stable inter-agent delivery', async () => {
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
