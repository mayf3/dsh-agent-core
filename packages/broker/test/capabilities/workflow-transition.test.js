import test from 'node:test'
import assert from 'node:assert/strict'

import { validateManifest } from '../../src/schema.js'
import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── Generic Idempotency-Key fixture (write shape, test-only capability) ───

test('idempotency: generic IK mechanism works for a workflow-write-shaped capability', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/internal/v1/workflow-instances/wf-1/transitions') {
      return json(res, 200, { transitioned: true, ik: entry.headers['idempotency-key'] })
    }
    json(res, 404, { error: 'not_found' })
  })

  const manifest = {
    id: 'workflow_execute_fixture',
    toolName: 'workflow_execute_fixture',
    name: 'Workflow Execute Fixture',
    description: 'Test fixture: generic Idempotency-Key mechanism on a real write shape.',
    requiredScopes: ['workflow.execute'],
    errors: [
      { code: 'invalid_arguments', description: 'Invalid.' },
      { code: 'unsupported_operation', description: 'Unsupported.' },
      { code: 'credential_unavailable', description: 'No credential.' },
      { code: 'binding_error', description: 'Binding.' },
      { code: 'http_4xx', description: '4xx.' },
      { code: 'http_5xx', description: '5xx.' },
      { code: 'malformed_response', description: 'Malformed.' },
      { code: 'transport_failure', description: 'Transport.' },
    ],
    operations: [
      {
        name: 'transition',
        description: 'Submit a transition.',
        arguments: {
          properties: {
            workflowInstanceId: { type: 'string', description: 'Instance id.' },
            action: { type: 'string', description: 'Transition action.' },
          },
          required: ['workflowInstanceId', 'action'],
        },
        result: { type: 'json' },
        errors: ['invalid_arguments'],
        http: {
          target: 'svc-workflow',
          method: 'POST',
          path: '/internal/v1/workflow-instances/{workflowInstanceId}/transitions',
          pathParams: ['workflowInstanceId'],
          body: ['action'],
          idempotencyKey: true,
        },
      },
    ],
  }

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'transition', workflowInstanceId: 'wf-1', action: 'approve' })
  assert.equal(res.ok, true)
  const ik = workflow.requests[0].headers['idempotency-key']
  assert.ok(/^ik-workflow-execute-fixture-\d+-[a-z0-9]+$/.test(ik), `unexpected IK ${ik}`)
  assert.equal(res.result.ik, ik)
  // model-supplied IK in args is ignored (trusted-zone generation only)
  const res2 = await definition.execute({ operation: 'transition', workflowInstanceId: 'wf-1', action: 'approve', idempotencyKey: 'ik-mallory' })
  assert.equal(res2.ok, true)
  assert.ok(workflow.requests[1].headers['idempotency-key'] !== 'ik-mallory')

  await tokenServer.close()
  await workflow.close()
})

const executeManifest = () => workflowManifests.find((manifest) => manifest.id === 'workflow_execute')

const svcError = (res, status, code, message, requestId, details) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'x-request-id': requestId })
  res.end(JSON.stringify({ error: { code, message, details } }))
}

test('workflow_execute: manifest freezes the unified two-operation write contract', () => {
  const manifest = executeManifest()
  assert.ok(manifest)
  assert.equal(validateManifest(manifest).ok, true)
  assert.equal(manifest.toolName, 'workflow_execute')
  assert.deepEqual(manifest.requiredScopes, ['workflow.execute'])
  // DEC-010: exactly two operations, single write entry, no workflow_transition.
  assert.deepEqual(manifest.operations.map((op) => op.name), ['create_instance', 'transition'])
  assert.ok(!workflowManifests.some((m) => m.id === 'workflow_transition' || m.toolName === 'workflow_transition'))

  const transition = manifest.operations[1]
  assert.deepEqual(transition.arguments.required, [
    'workflowInstanceId',
    'transitionDefinitionId',
    'expectedWorkflowStateVersion',
  ])
  assert.deepEqual(Object.keys(transition.arguments.properties), [
    'workflowInstanceId',
    'transitionDefinitionId',
    'expectedWorkflowStateVersion',
    'submissionPayload',
  ])
  assert.equal(transition.arguments.properties.expectedWorkflowStateVersion.minimum, 1)
  assert.deepEqual(transition.http, {
    target: 'svc-workflow',
    method: 'POST',
    path: '/internal/v1/workflow-instances/{workflowInstanceId}/transitions',
    pathParams: ['workflowInstanceId'],
    body: ['transitionDefinitionId', 'expectedWorkflowStateVersion', 'submissionPayload'],
    idempotencyKey: true,
  })

  // No identity / trusted-seam field is model-facing in either operation.
  const parameterNames = JSON.stringify(manifest.operations.map((op) => op.arguments.properties)).toLowerCase()
  for (const forbidden of ['principalid', 'agentid', 'onbehalfof', '"assignee"']) {
    assert.ok(!parameterNames.includes(forbidden), `${forbidden} must not be model-facing`)
  }
  assert.match(manifest.description, /executable_for_actor: true.*advisory/s)
  assert.match(manifest.description, /advisory false\/stale values are never blocked locally/)
})

test('workflow_execute operation=transition: authorized POST preserves body, scope, trusted IK and token-only actor', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/internal/v1/workflow-instances/wf-42/transitions') {
      return json(res, 200, {
        workflowInstanceId: 'wf-42',
        workflowStateVersion: 8,
        currentContextRevisionId: 'ctx-2',
        sourceNodeVisitId: 'visit-1',
        currentNodeVisitId: 'visit-2',
        submissionId: 'submission-1',
        eventSequence: 19,
      })
    }
    return json(res, 404, { error: { code: 'instance_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  const result = await definition.execute({
    operation: 'transition',
    workflowInstanceId: 'wf-42',
    transitionDefinitionId: 'transition-7',
    expectedWorkflowStateVersion: 7,
    submissionPayload: { decision: 'approve' },
    idempotencyKey: 'ik-model-controlled',
    principalId: 'principal-mallory',
    agentId: 'agt_mallory',
    actor: 'mallory',
    executable_for_actor: false,
  })

  assert.deepEqual(result, {
    ok: true,
    result: {
      workflowInstanceId: 'wf-42',
      workflowStateVersion: 8,
      currentContextRevisionId: 'ctx-2',
      sourceNodeVisitId: 'visit-1',
      currentNodeVisitId: 'visit-2',
      submissionId: 'submission-1',
      eventSequence: 19,
    },
  })
  assert.equal(tokenServer.requests.length, 1)
  assert.equal(tokenServer.requests[0].body.resource, 'svc-workflow')
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.execute')

  assert.equal(workflow.requests.length, 1, 'advisory false must not trigger a local block')
  const request = workflow.requests[0]
  assert.equal(request.method, 'POST')
  assert.equal(request.pathname, '/internal/v1/workflow-instances/wf-42/transitions')
  assert.deepEqual(request.body, {
    transitionDefinitionId: 'transition-7',
    expectedWorkflowStateVersion: 7,
    submissionPayload: { decision: 'approve' },
  })
  assert.equal(request.headers.authorization, 'Bearer tok-real')
  assert.ok(/^ik-workflow-execute-\d+-[a-z0-9]+$/.test(request.headers['idempotency-key']))
  assert.notEqual(request.headers['idempotency-key'], 'ik-model-controlled')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_execute operation=transition: optional submissionPayload is omitted from the wire when absent', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 200, { workflowInstanceId: 'wf-43' }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  const result = await definition.execute({
    operation: 'transition',
    workflowInstanceId: 'wf-43',
    transitionDefinitionId: 'transition-8',
    expectedWorkflowStateVersion: 3,
  })
  assert.equal(result.ok, true)
  assert.deepEqual(workflow.requests[0].body, {
    transitionDefinitionId: 'transition-8',
    expectedWorkflowStateVersion: 3,
  })

  await tokenServer.close()
  await workflow.close()
})

test('workflow_execute operation=transition: declared transition failures preserve the formal error envelope', async () => {
  const tokenServer = await startTokenServer()
  const failures = {
    'transition-assignee': [403, 'principal_not_assignee', 'caller is not current assignee', 'req-transition-403'],
    'transition-cas': [409, 'workflow_state_version_conflict', 'workflow state version conflict', 'req-transition-cas'],
    'transition-ik': [409, 'idempotency_conflict', 'idempotency key conflict', 'req-transition-ik'],
  }
  const workflow = await startMockServer((req, res, entry) => {
    const failure = failures[entry.body.transitionDefinitionId]
    return svcError(res, ...failure, { expected: 4, actual: 5 })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  for (const [transitionDefinitionId, [status, code, message, requestId]] of Object.entries(failures)) {
    const result = await definition.execute({
      operation: 'transition',
      workflowInstanceId: 'wf-errors',
      transitionDefinitionId,
      expectedWorkflowStateVersion: 4,
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, code)
    assert.equal(result.error.status, status)
    assert.equal(result.error.detail, message)
    assert.equal(result.error.requestId, requestId)
    assert.equal(result.error.details, undefined)
    assert.equal(result.error.expected, undefined)
    assert.equal(result.error.actual, undefined)
  }

  await tokenServer.close()
  await workflow.close()
})
