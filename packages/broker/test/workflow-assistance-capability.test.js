import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  workflowAssistanceActionManifest,
  workflowAssistanceReadManifest,
} from '../src/capabilities/workflow-assistance.js'
import { workflowExecutionEscalationManifest } from '../src/capabilities/workflow.js'
import { DEFAULT_MANIFESTS } from '../src/index.js'
import { assertValidManifest } from '../src/mapping.js'
import { createHttpTransport } from '../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../test-support/capability-fixtures.js'

test('Domain Owner assistance read/action are split by least-privilege scope', () => {
  const read = assertValidManifest(workflowAssistanceReadManifest)
  const action = assertValidManifest(workflowAssistanceActionManifest)

  assert.deepEqual(read.requiredScopes, ['workflow.read'])
  assert.deepEqual(action.requiredScopes, ['workflow.execute'])
  assert.deepEqual(read.operations.map((op) => op.name), ['owner_inbox', 'detail'])
  assert.deepEqual(action.operations.map((op) => op.name), ['resolve', 'escalate_to_human', 'bind_governance'])
  assert.equal(read.operations[0].http.path, '/internal/v1/assistance-cases/owner-inbox')
  assert.equal(read.operations[1].http.path, '/internal/v1/assistance-cases/{assistanceCaseId}')
})

test('governance bind is a closed typed workflow.execute mutation', () => {
  const action = assertValidManifest(workflowAssistanceActionManifest)
  const bind = action.operations.find((op) => op.name === 'bind_governance')
  assert.match(bind.description, /If the bind response is lost or returns transport_failure, read the exact case with workflow_assistance_read\.detail/)
  assert.match(bind.description, /selected acceptance transition, the acceptanceContractDigest, and persisted source\/request and child-bind provenance/)
  assert.match(bind.description, /If readback is inconclusive, report UNKNOWN; do not invoke bind_governance again, create a replacement child, or use a new idempotency key/)
  assert.deepEqual(bind.arguments.required, [
    'assistanceCaseId', 'governanceChildInstanceId', 'acceptanceTransitionId', 'expectedWorkflowStateVersion',
  ])
  assert.equal(bind.arguments.additionalProperties, false)
  assert.deepEqual(bind.http, {
    target: 'svc-workflow', method: 'POST',
    path: '/internal/v1/assistance-cases/{assistanceCaseId}/governance-child',
    pathParams: ['assistanceCaseId'],
    body: ['governanceChildInstanceId', 'acceptanceTransitionId', 'expectedWorkflowStateVersion'],
    idempotencyKey: true,
  })
  const args = JSON.stringify(bind.arguments)
  for (const forbidden of ['ownerPrincipalId', 'workflowInstanceId', 'nodeVisitId', 'contextRevisionId', 'definitionVersionId', 'requestDigest', 'domainId', 'acceptanceContractDigest']) {
    assert.equal(args.includes(forbidden), false, `Svc-derived field must not be model input: ${forbidden}`)
  }
})

test('Domain Owner assistance actions reuse authoritative svc endpoints and idempotency', () => {
  const action = assertValidManifest(workflowAssistanceActionManifest)
  const resolve = action.operations.find((op) => op.name === 'resolve')
  const escalate = action.operations.find((op) => op.name === 'escalate_to_human')

  assert.equal(resolve.http.method, 'POST')
  assert.equal(resolve.http.path, '/internal/v1/assistance-cases/{assistanceCaseId}/resolve')
  assert.equal(resolve.http.idempotencyKey, true)
  assert.equal(escalate.http.path, '/internal/v1/assistance-cases/{assistanceCaseId}/escalate-to-human')
  assert.equal(escalate.http.idempotencyKey, true)

  for (const op of [resolve, escalate]) {
    const json = JSON.stringify(op.arguments)
    for (const forbidden of ['principalId', 'domainId', 'agentId', 'scriptPath', 'shell', 'credential']) {
      assert.equal(json.includes(forbidden), false, 'authority/escape field must not be model input: ' + forbidden)
    }
  }
})

test('assistance capabilities are part of the default broker surface exactly once', () => {
  const ids = DEFAULT_MANIFESTS.map((manifest) => manifest.id)
  assert.equal(ids.filter((id) => id === 'workflow_assistance_read').length, 1)
  assert.equal(ids.filter((id) => id === 'workflow_assistance_action').length, 1)
})

test('system execution policy now opens OWNER_PENDING instead of auto-human escalation', () => {
  const manifest = assertValidManifest(workflowExecutionEscalationManifest)
  assert.match(manifest.description, /OWNER_PENDING/)
  assert.doesNotMatch(manifest.description, /created\/escalated/)
  assert.match(manifest.operations[0].description, /OWNER_PENDING/)
})

const BIND_IDS = {
  case: '11111111-1111-4111-8111-111111111111',
  child: '22222222-2222-4222-8222-222222222222',
  transition: '33333333-3333-4333-8333-333333333333',
}

test('bind_governance forwards only typed fields with trusted idempotency and preserves binding receipt', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((_req, res) => json(res, 200, {
    bindingId: '44444444-4444-4444-8444-444444444444',
    sourceWorkflowInstanceId: '55555555-5555-4555-8555-555555555555',
    governanceChildInstanceId: BIND_IDS.child,
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
    operation: 'bind_governance', assistanceCaseId: BIND_IDS.case,
    governanceChildInstanceId: BIND_IDS.child, acceptanceTransitionId: BIND_IDS.transition,
    expectedWorkflowStateVersion: 7,
  })

  assert.deepEqual(result, { ok: true, result: {
    bindingId: '44444444-4444-4444-8444-444444444444',
    sourceWorkflowInstanceId: '55555555-5555-4555-8555-555555555555',
    governanceChildInstanceId: BIND_IDS.child,
    acceptanceContractDigest: 'a'.repeat(64), status: 'BOUND',
  } })
  assert.equal(workflow.requests.length, 1)
  const request = workflow.requests[0]
  assert.equal(request.method, 'POST')
  assert.equal(request.pathname, `/internal/v1/assistance-cases/${BIND_IDS.case}/governance-child`)
  assert.deepEqual(request.body, {
    governanceChildInstanceId: BIND_IDS.child,
    acceptanceTransitionId: BIND_IDS.transition,
    expectedWorkflowStateVersion: 7,
  })
  assert.match(request.headers['idempotency-key'], /^ik-workflow-assistance-action-/)
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.execute')

  const extra = await definition.execute({
    operation: 'bind_governance', assistanceCaseId: BIND_IDS.case,
    governanceChildInstanceId: BIND_IDS.child, acceptanceTransitionId: BIND_IDS.transition,
    expectedWorkflowStateVersion: 7, ownerPrincipalId: BIND_IDS.transition,
  })
  assert.equal(extra.ok, false)
  assert.equal(extra.error.code, 'invalid_arguments')
  assert.equal(workflow.requests.length, 1)
  await tokenServer.close()
  await workflow.close()
})

test('lost bind response is reconciled through exact case detail without another mutation', async () => {
  const tokenServer = await startTokenServer()
  const receipt = {
    bindingId: '44444444-4444-4444-8444-444444444444',
    assistanceCaseId: BIND_IDS.case,
    source: {
      workflowInstanceId: '55555555-5555-4555-8555-555555555555',
      nodeVisitId: '66666666-6666-4666-8666-666666666666',
      requestContextRevisionId: '77777777-7777-4777-8777-777777777777',
      definitionVersionId: '88888888-8888-4888-8888-888888888888',
      requestPayloadDigest: 'b'.repeat(64),
      requestCommandId: '99999999-9999-4999-8999-999999999999',
      requestEventSequence: 12,
    },
    child: {
      workflowInstanceId: BIND_IDS.child,
      definitionVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      contextRevisionAtBind: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      acceptanceTransitionId: BIND_IDS.transition,
    },
    acceptanceContractDigest: 'a'.repeat(64),
    status: 'BOUND',
    currentReview: null,
  }
  let bindCommitted = false
  const workflow = await startMockServer((_req, res, entry) => {
    if (entry.method === 'POST') {
      bindCommitted = true
      // Model a service commit followed by a lost response.
      res.destroy()
      return
    }
    if (entry.method === 'GET' && entry.pathname === `/internal/v1/assistance-cases/${BIND_IDS.case}` && bindCommitted) {
      json(res, 200, { assistanceCaseId: BIND_IDS.case, governanceBinding: receipt, governanceTerminalProof: null })
      return
    }
    json(res, 404, { error: 'not_found' })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition: action } = wire(workflowAssistanceActionManifest, transport)
  const { definition: read } = wire(workflowAssistanceReadManifest, transport)

  const bindResult = await action.execute({
    operation: 'bind_governance', assistanceCaseId: BIND_IDS.case,
    governanceChildInstanceId: BIND_IDS.child, acceptanceTransitionId: BIND_IDS.transition,
    expectedWorkflowStateVersion: 7,
  })
  assert.equal(bindResult.ok, false)
  assert.equal(bindResult.error.code, 'transport_failure')

  const detail = await read.execute({ operation: 'detail', assistanceCaseId: BIND_IDS.case })
  assert.deepEqual(detail, { ok: true, result: {
    assistanceCaseId: BIND_IDS.case,
    governanceBinding: receipt,
    governanceTerminalProof: null,
  } })
  assert.equal(workflow.requests.filter((request) => request.method === 'POST').length, 1)
  assert.equal(workflow.requests.filter((request) => request.method === 'GET').length, 1)
  assert.equal(workflow.requests[0].headers['idempotency-key'].startsWith('ik-workflow-assistance-action-'), true)
  assert.equal(workflow.requests[0].headers['idempotency-key'].includes(BIND_IDS.case), false)
  assert.equal(workflow.requests[1].pathname, `/internal/v1/assistance-cases/${BIND_IDS.case}`)
  await tokenServer.close()
  await workflow.close()
})

test('resolve transports arbitrary supportingPayload unchanged for existing unlinked cases', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((_req, res) => json(res, 200, { status: 'RESOLVED' }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(workflowAssistanceActionManifest, transport)
  const supportingPayload = { custom: ['opaque', { nested: true }], governanceChildReview: 'owner-authored-unlinked-value' }
  const result = await definition.execute({
    operation: 'resolve', assistanceCaseId: BIND_IDS.case, expectedWorkflowStateVersion: 9,
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
