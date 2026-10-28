import assert from 'node:assert/strict'
import { test } from 'node:test'

import { workflowAssistanceActionManifest } from '../../src/capabilities/workflow-assistance.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

const UUIDS = {
  case: '11111111-1111-4111-8111-111111111111',
  child: '22222222-2222-4222-8222-222222222222',
  transition: '33333333-3333-4333-8333-333333333333',
}

function setupWorkflow(handler) {
  return Promise.all([
    startTokenServer(),
    startMockServer(handler),
  ])
}

test('bind_governance forwards only typed fields with trusted idempotency and preserves binding receipt', async () => {
  const [tokenServer, workflow] = await setupWorkflow((_req, res) => json(res, 200, {
    bindingId: '44444444-4444-4444-8444-444444444444',
    sourceWorkflowInstanceId: '55555555-5555-4555-8555-555555555555',
    governanceChildInstanceId: UUIDS.child,
    acceptanceContractDigest: 'a'.repeat(64),
    status: 'BOUND',
  }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(workflowAssistanceActionManifest, transport)

  const result = await definition.execute({
    operation: 'bind_governance',
    assistanceCaseId: UUIDS.case,
    governanceChildInstanceId: UUIDS.child,
    acceptanceTransitionId: UUIDS.transition,
    expectedWorkflowStateVersion: 7,
  })

  assert.deepEqual(result, { ok: true, result: {
    bindingId: '44444444-4444-4444-8444-444444444444',
    sourceWorkflowInstanceId: '55555555-5555-4555-8555-555555555555',
    governanceChildInstanceId: UUIDS.child,
    acceptanceContractDigest: 'a'.repeat(64),
    status: 'BOUND',
  } })
  assert.equal(workflow.requests.length, 1)
  const request = workflow.requests[0]
  assert.equal(request.method, 'POST')
  assert.equal(request.pathname, `/internal/v1/assistance-cases/${UUIDS.case}/governance-child`)
  assert.deepEqual(request.body, {
    governanceChildInstanceId: UUIDS.child,
    acceptanceTransitionId: UUIDS.transition,
    expectedWorkflowStateVersion: 7,
  })
  assert.match(request.headers['idempotency-key'], /^ik-workflow-assistance-action-/)
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.execute')

  const extra = await definition.execute({
    operation: 'bind_governance', assistanceCaseId: UUIDS.case,
    governanceChildInstanceId: UUIDS.child, acceptanceTransitionId: UUIDS.transition,
    expectedWorkflowStateVersion: 7, ownerPrincipalId: UUIDS.transition,
  })
  assert.equal(extra.ok, false)
  assert.equal(extra.error.code, 'invalid_arguments')
  assert.equal(workflow.requests.length, 1)

  await tokenServer.close()
  await workflow.close()
})

test('resolve transports arbitrary supportingPayload unchanged for existing unlinked cases', async () => {
  const [tokenServer, workflow] = await setupWorkflow((_req, res) => json(res, 200, { status: 'RESOLVED' }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(workflowAssistanceActionManifest, transport)
  const supportingPayload = { custom: ['opaque', { nested: true }], governanceChildReview: 'owner-authored-unlinked-value' }

  const result = await definition.execute({
    operation: 'resolve', assistanceCaseId: UUIDS.case, expectedWorkflowStateVersion: 9,
    resolution: { message: 'handled', supportingPayload },
  })

  assert.deepEqual(result, { ok: true, result: { status: 'RESOLVED' } })
  assert.deepEqual(workflow.requests[0].body, {
    expectedWorkflowStateVersion: 9,
    resolution: { message: 'handled', supportingPayload },
  })
  await tokenServer.close()
  await workflow.close()
})
