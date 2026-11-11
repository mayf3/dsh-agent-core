import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  workflowAssistanceActionManifest,
  workflowAssistanceReadManifest,
} from '../src/capabilities/workflow/assistance.js'
import { workflowExecutionEscalationManifest } from '../src/capabilities/workflow/index.js'
import { DEFAULT_MANIFESTS } from '../src/index.js'
import { assertValidManifest } from '../src/mapping.js'
import { validateManifest } from '../src/schema.js'
import { createHttpTransport } from '../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../test-support/capability-fixtures.js'

test('Domain Owner assistance read/action are split by least-privilege scope', () => {
  const read = assertValidManifest(workflowAssistanceReadManifest)
  const action = assertValidManifest(workflowAssistanceActionManifest)

  assert.deepEqual(read.requiredScopes, ['workflow.read'])
  assert.deepEqual(action.requiredScopes, ['workflow.execute'])
  assert.deepEqual(read.operations.map((op) => op.name), ['owner_inbox', 'detail'])
  assert.deepEqual(action.operations.map((op) => op.name), ['resolve', 'resolve_current_governance_review', 'escalate_to_human', 'bind_governance', 'create_and_bind_governance_child'])
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

const REVIEW_REF = {
  bindingId: '44444444-4444-4444-8444-444444444444',
  terminalEventId: '55555555-5555-4555-8555-555555555555',
  submissionId: '66666666-6666-4666-8666-666666666666',
  submissionDigest: 'a'.repeat(64),
  acceptanceContractDigest: 'b'.repeat(64),
}

test('resolve exposes only the statically declared typed review projection', () => {
  const manifest = assertValidManifest(workflowAssistanceActionManifest)
  const resolve = manifest.operations.find((op) => op.name === 'resolve')
  assert.deepEqual(resolve.arguments.properties.governanceChildReview.required, [
    'bindingId', 'terminalEventId', 'submissionId', 'submissionDigest', 'acceptanceContractDigest',
  ])
  assert.equal(resolve.arguments.properties.governanceChildReview.additionalProperties, false)
  assert.match(resolve.description, /top level.*service-provided values from workflow_assistance_read\.detail/)
  assert.deepEqual(resolve.http.bodyProjections, [{
    sourceArg: 'governanceChildReview',
    destinationBodyPath: ['resolution', 'supportingPayload', 'governanceChildReview'],
  }])

  for (const bodyProjections of [
    [{ sourceArg: 'unknown', destinationBodyPath: ['resolution', 'supportingPayload', 'review'] }],
    [{ sourceArg: 'governanceChildReview', destinationBodyPath: ['resolution', '__proto__', 'review'] }],
    [{ sourceArg: 'governanceChildReview', destinationBodyPath: ['unbound', 'supportingPayload', 'review'] }],
    [{ sourceArg: 'governanceChildReview', destinationBodyPath: ['resolution', 'supportingPayload', 'review'] }, {
      sourceArg: 'other', destinationBodyPath: ['resolution', 'supportingPayload', 'review'],
    }],
    [{ sourceArg: 'governanceChildReview', destinationBodyPath: ['resolution', 'message', 'review'] }],
  ]) {
    const input = structuredClone(workflowAssistanceActionManifest)
    input.operations.find((op) => op.name === 'resolve').http.bodyProjections = bodyProjections
    assert.equal(validateManifest(input).ok, false)
  }
  const overlapping = structuredClone(workflowAssistanceActionManifest)
  const resolveInput = overlapping.operations.find((op) => op.name === 'resolve')
  resolveInput.arguments.properties.governanceChildReviewAlias = structuredClone(
    resolveInput.arguments.properties.governanceChildReview,
  )
  resolveInput.http.bodyProjections = [
    { sourceArg: 'governanceChildReview', destinationBodyPath: ['resolution', 'supportingPayload'] },
    { sourceArg: 'governanceChildReviewAlias', destinationBodyPath: ['resolution', 'supportingPayload', 'governanceChildReview'] },
  ]
  assert.equal(validateManifest(overlapping).ok, false)
})

test('resolve projects typed review copy-on-write and preserves input and siblings', async (t) => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((_req, res) => json(res, 200, { status: 'RESOLVED' }))
  t.after(async () => { await tokenServer.close(); await workflow.close() })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(workflowAssistanceActionManifest, transport)
  assert.equal(definition.parameters.governanceChildReview.type, 'object')
  assert.deepEqual(definition.parameters.governanceChildReview.properties.bindingId, {
    description: 'Exact service-provided governance binding id.', required: true, type: 'string',
  })
  const originalPayload = { custom: ['preserve', { nested: true }] }
  const resolution = { message: 'reviewed', supportingPayload: originalPayload }
  const args = {
    operation: 'resolve', assistanceCaseId: BIND_IDS.case, expectedWorkflowStateVersion: 9,
    resolution, governanceChildReview: { ...REVIEW_REF },
  }
  const before = structuredClone(args)
  const result = await definition.execute(args)

  assert.deepEqual(result, { ok: true, result: { status: 'RESOLVED' } })
  assert.deepEqual(workflow.requests[0].body, {
    expectedWorkflowStateVersion: 9,
    resolution: { message: 'reviewed', supportingPayload: { ...originalPayload, governanceChildReview: REVIEW_REF } },
  })
  assert.deepEqual(args, before)
  assert.equal(args.resolution.supportingPayload, originalPayload)
  assert.equal(Object.hasOwn(originalPayload, 'governanceChildReview'), false)
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.execute')
  assert.match(workflow.requests[0].headers['idempotency-key'], /^ik-workflow-assistance-action-/)
})

test('resolve creates absent supportingPayload only in the projected body', async (t) => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((_req, res) => json(res, 200, { status: 'RESOLVED' }))
  t.after(async () => { await tokenServer.close(); await workflow.close() })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(workflowAssistanceActionManifest, transport)
  const resolution = { message: 'reviewed' }
  const args = {
    operation: 'resolve', assistanceCaseId: BIND_IDS.case, expectedWorkflowStateVersion: 9,
    resolution, governanceChildReview: { ...REVIEW_REF },
  }
  const before = structuredClone(args)
  const result = await definition.execute(args)
  assert.equal(result.ok, true)
  assert.deepEqual(workflow.requests[0].body.resolution, {
    message: 'reviewed', supportingPayload: { governanceChildReview: REVIEW_REF },
  })
  assert.deepEqual(args, before)
  assert.equal(Object.hasOwn(resolution, 'supportingPayload'), false)
})

test('resolve rejects malformed typed/container input before credential or HTTP', async (t) => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((_req, res) => json(res, 200, { status: 'RESOLVED' }))
  t.after(async () => { await tokenServer.close(); await workflow.close() })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(workflowAssistanceActionManifest, transport)
  const malformed = [
    { ...REVIEW_REF, verdict: 'ACCEPTED' },
    { ...REVIEW_REF, acceptanceContractDigest: undefined },
    null,
    'invalid',
    [],
  ]
  const invalidCalls = malformed.map((governanceChildReview) => ({
    operation: 'resolve', assistanceCaseId: BIND_IDS.case, expectedWorkflowStateVersion: 9,
    resolution: { message: 'reviewed' }, governanceChildReview,
  }))
  for (const supportingPayload of [null, 'bad', []]) {
    invalidCalls.push({
      operation: 'resolve', assistanceCaseId: BIND_IDS.case, expectedWorkflowStateVersion: 9,
      resolution: { message: 'reviewed', supportingPayload }, governanceChildReview: { ...REVIEW_REF },
    })
  }
  for (const resolution of [null, 'bad', []]) {
    invalidCalls.push({
      operation: 'resolve', assistanceCaseId: BIND_IDS.case, expectedWorkflowStateVersion: 9,
      resolution, governanceChildReview: { ...REVIEW_REF },
    })
  }
  for (const call of invalidCalls) {
    const result = await definition.execute(call)
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'invalid_arguments')
  }
  assert.equal(tokenServer.requests.length, 0)
  assert.equal(workflow.requests.length, 0)
})

test('resolve rejects any pre-existing projection target as binding_error before HTTP', async (t) => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((_req, res) => json(res, 200, { status: 'RESOLVED' }))
  t.after(async () => { await tokenServer.close(); await workflow.close() })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(workflowAssistanceActionManifest, transport)
  for (const existing of [REVIEW_REF, { different: true }, null, 'owner-value']) {
    const result = await definition.execute({
      operation: 'resolve', assistanceCaseId: BIND_IDS.case, expectedWorkflowStateVersion: 9,
      resolution: { message: 'reviewed', supportingPayload: { governanceChildReview: existing } },
      governanceChildReview: { ...REVIEW_REF },
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'binding_error')
  }
  assert.equal(tokenServer.requests.length, 0)
  assert.equal(workflow.requests.length, 0)
})


test('atomic create-bind is closed, validates UUIDs and forwards one trusted-key request unchanged', async () => {
  const token = await startTokenServer()
  const prerequisiteReadiness = {
    status: 'WAITING',
    reason: 'PREREQUISITE_PENDING',
    sourceInstanceId: '66666666-6666-4666-8666-666666666666',
    sourceDefinitionVersionId: '77777777-7777-4777-8777-777777777777',
    transitionId: '88888888-8888-4888-8888-888888888888',
  }
  const receipt = {
    bindingId: 'service-binding',
    child: { workflowInstanceId: 'service-child' },
    acceptanceContractDigest: 'service-digest',
    prerequisiteReadiness,
  }
  const service = await startMockServer((req, res) => json(res, 200, receipt))
  try {
    const transport = createHttpTransport({
      credentialProvider: { getCredential: async () => ({ clientId: 'client', clientSecret: 'secret' }) },
      targets: mockTargets({ 'svc-workflow': service.origin }), authServiceOrigin: token.origin,
    })
    const { definition } = wire(workflowAssistanceActionManifest, transport)
    const id = '11111111-2222-4333-8444-555555555555'
    const args = { operation: 'create_and_bind_governance_child', assistanceCaseId: id, definitionVersionId: id,
      contextPayload: { workflowPrerequisite: { kind: 'TERMINAL_SUBMISSION', workflowInstanceId: id, definitionVersionId: id, transitionId: id } },
      acceptanceTransitionId: id, expectedWorkflowStateVersion: 7 }
    for (const bad of [{ domainId: id }, { bindingId: id }, { definitionVersionId: 'name' }, { acceptanceTransitionId: 'guess' }, { assistanceCaseId: 'bad' }]) {
      assert.equal((await definition.execute({ ...args, ...bad })).ok, false)
    }
    assert.equal(service.requests.length, 0)
    assert.equal(token.requests.length, 0)
    const created = await definition.execute(args)
    assert.deepEqual(created.result, receipt)
    assert.deepEqual(created.result.prerequisiteReadiness, prerequisiteReadiness)
    assert.equal(service.requests.length, 1)
    const request = service.requests[0]
    assert.equal(request.pathname, `/internal/v1/assistance-cases/${id}/governance-child:create-and-bind`)
    assert.ok(request.headers['idempotency-key'])
    assert.deepEqual(request.body, { definitionVersionId: id, contextPayload: args.contextPayload,
      acceptanceTransitionId: id, expectedWorkflowStateVersion: 7 })
    const op = workflowAssistanceActionManifest.operations.find(op => op.name === args.operation)
    assert.match(op.description, /unresolved ambiguity/)
    assert.match(op.description, /UNKNOWN/)
    assert.match(op.description, /no new-key call/)
  } finally { await token.close(); await service.close() }
})
