import test from 'node:test'
import assert from 'node:assert/strict'

import { defineTool } from '@deepseek-ai/dsh-tools'

import { validateManifest } from '../../src/schema.js'
import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { buildToolDefinition } from '../../src/registry.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

const executeManifest = () => workflowManifests.find((manifest) => manifest.id === 'workflow_execute')
const readManifestIds = () =>
  workflowManifests.filter((m) => m.requiredScopes.includes('workflow.read')).map((m) => m.id)

const svcError = (res, status, code, message, requestId) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'x-request-id': requestId })
  res.end(JSON.stringify({ error: { code, message } }))
}

// ─── Single write entry (DEC-010) ───────────────────────────────────────────

test('workflow_execute is the ONLY workflow-STATE write tool; workflow_transition no longer exists', () => {
  // DEC-010 governs workflow-state mutation writes. The wake tool
  // (AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1) is an activation-model
  // eligibility command, not a workflow-state write: it never touches
  // workflowStateVersion downstream semantics of transitions and creates no
  // Visit/Submission. workflow_transition remains absent from the tool face.
  const writes = workflowManifests.filter((m) =>
    m.operations.some((op) => op.http && m.requiredScopes.includes('workflow.execute'))
  )
  assert.deepEqual(writes.map((m) => m.id), ['workflow_execute', 'workflow_wake_dispatch_intent'])
  assert.ok(!workflowManifests.some((m) => m.id === 'workflow_transition'))
  assert.ok(!workflowManifests.some((m) => m.toolName === 'workflow_transition'))
  // 6 compat read tools + the due-intent read (activation model) + 1 write.
  assert.deepEqual(readManifestIds(), [
    'workflow_my_tasks',
    'workflow_instance_detail',
    'workflow_submission_history',
    'workflow_my_domains',
    'workflow_domain_instances',
    'workflow_global_instances',
    'workflow_dispatch_intents',
  ])
  for (const id of readManifestIds()) {
    const manifest = workflowManifests.find((m) => m.id === id)
    assert.deepEqual(manifest.requiredScopes, ['workflow.read'])
    assert.equal(validateManifest(manifest).ok, true)
  }
})

// ─── create_instance contract (CTR-010, CASE A binding) ─────────────────────

test('workflow_execute: create_instance operation freezes the svc-workflow create binding', () => {
  const manifest = executeManifest()
  assert.equal(validateManifest(manifest).ok, true)
  const op = manifest.operations.find((candidate) => candidate.name === 'create_instance')
  assert.ok(op)
  assert.deepEqual(Object.keys(op.arguments.properties), [
    'domainId',
    'definitionVersionId',
    'contextPayload',
    'metadata',
    'externalReference',
    'externalUrl',
  ])
  assert.deepEqual(op.arguments.required, ['domainId', 'definitionVersionId', 'contextPayload', 'metadata'])
  assert.deepEqual(op.http, {
    target: 'svc-workflow',
    method: 'POST',
    path: '/internal/v1/workflow-instances',
    body: ['domainId', 'definitionVersionId', 'contextPayload', 'metadata', 'externalReference', 'externalUrl'],
    idempotencyKey: true,
  })
  // No pathParams on the collection POST; the only identity surface is the seam.
  assert.equal(op.http.pathParams, undefined)
})

test('workflow_execute operation=create_instance: authorized POST preserves body, scope, trusted IK; identity fields never reach the wire', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/internal/v1/workflow-instances') {
      return json(res, 201, {
        workflowInstanceId: 'wf-created-1',
        workflowStateVersion: 1,
        currentContextRevisionId: 'ctx-1',
        currentNodeVisitId: 'visit-1',
        eventSequence: 1,
      })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  const result = await definition.execute({
    operation: 'create_instance',
    domainId: 'domain-9',
    definitionVersionId: 'defver-3',
    contextPayload: { title: 'ship the unified write tool' },
    metadata: null,
    // Model-supplied identity / trusted-seam fields must be ignored entirely.
    principalId: 'principal-mallory',
    agentId: 'agt_mallory',
    actor: 'mallory',
    idempotencyKey: 'ik-mallory',
    assigneePrincipalId: 'agt_victim',
  })

  assert.deepEqual(result, {
    ok: true,
    result: {
      workflowInstanceId: 'wf-created-1',
      workflowStateVersion: 1,
      currentContextRevisionId: 'ctx-1',
      currentNodeVisitId: 'visit-1',
      eventSequence: 1,
    },
  })
  assert.equal(tokenServer.requests.length, 1)
  assert.equal(tokenServer.requests[0].body.resource, 'svc-workflow')
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.execute')

  assert.equal(workflow.requests.length, 1)
  const request = workflow.requests[0]
  assert.equal(request.method, 'POST')
  assert.equal(request.pathname, '/internal/v1/workflow-instances')
  // Exactly the CTR-010 model-controlled fields; null metadata forwarded; no
  // optional externalReference/externalUrl; zero identity/trusted fields.
  assert.deepEqual(request.body, {
    domainId: 'domain-9',
    definitionVersionId: 'defver-3',
    contextPayload: { title: 'ship the unified write tool' },
    metadata: null,
  })
  assert.equal(request.headers.authorization, 'Bearer tok-real')
  assert.ok(/^ik-workflow-execute-\d+-[a-z0-9]+$/.test(request.headers['idempotency-key']))
  assert.notEqual(request.headers['idempotency-key'], 'ik-mallory')
  assert.equal(JSON.stringify(request.body).includes('mallory'), false)

  await tokenServer.close()
  await workflow.close()
})

test('workflow_execute operation=create_instance: optional externalReference/externalUrl forwarded when present', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 201, { workflowInstanceId: 'wf-2', workflowStateVersion: 1 }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  const result = await definition.execute({
    operation: 'create_instance',
    domainId: 'domain-9',
    definitionVersionId: 'defver-3',
    contextPayload: {},
    metadata: { source: 'test' },
    externalReference: 'REQ-123',
    externalUrl: 'https://example.com/req/123',
  })
  assert.equal(result.ok, true)
  assert.deepEqual(workflow.requests[0].body, {
    domainId: 'domain-9',
    definitionVersionId: 'defver-3',
    contextPayload: {},
    metadata: { source: 'test' },
    externalReference: 'REQ-123',
    externalUrl: 'https://example.com/req/123',
  })

  await tokenServer.close()
  await workflow.close()
})

// ─── Exactly-once / idempotency / no-auto-retry (both operations) ───────────

test('workflow_execute: every write call gets a FRESH trusted IK and the broker never retries', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.pathname === '/internal/v1/workflow-instances') return json(res, 201, { workflowInstanceId: 'wf-3', workflowStateVersion: 1 })
    return json(res, 200, { workflowInstanceId: 'wf-3', workflowStateVersion: 2 })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  const createArgs = { domainId: 'd', definitionVersionId: 'v', contextPayload: {}, metadata: null }
  const r1 = await definition.execute({ operation: 'create_instance', ...createArgs })
  const r2 = await definition.execute({ operation: 'create_instance', ...createArgs })
  assert.equal(r1.ok, true)
  assert.equal(r2.ok, true)
  // One HTTP request per call; two DIFFERENT fresh keys (no cross-call reuse,
  // no broker-side dedupe/retry — the server owns exactly-once).
  assert.equal(workflow.requests.length, 2)
  const [k1, k2] = workflow.requests.map((request) => request.headers['idempotency-key'])
  assert.notEqual(k1, k2)

  const t1 = await definition.execute({
    operation: 'transition', workflowInstanceId: 'wf-3', transitionDefinitionId: 'td-1', expectedWorkflowStateVersion: 1,
  })
  const t2 = await definition.execute({
    operation: 'transition', workflowInstanceId: 'wf-3', transitionDefinitionId: 'td-1', expectedWorkflowStateVersion: 1,
  })
  assert.equal(t1.ok, true)
  assert.equal(t2.ok, true)
  const transitionRequests = workflow.requests.slice(2)
  assert.equal(transitionRequests.length, 2, 'a failed/complete first call must never trigger a broker retry')
  assert.notEqual(transitionRequests[0].headers['idempotency-key'], transitionRequests[1].headers['idempotency-key'])

  await tokenServer.close()
  await workflow.close()
})

// ─── Declared create-family error envelope (fail-closed, no structured details) ──

test('workflow_execute operation=create_instance: declared failures preserve the formal error envelope', async () => {
  const tokenServer = await startTokenServer()
  const failures = {
    'domain-403': [403, 'domain_membership_required', 'not an active member', 'req-create-403'],
    'defver-409': [409, 'version_not_published', 'definition version not published', 'req-create-409'],
    'context-422': [422, 'context_validation_failed', 'context payload invalid', 'req-create-422'],
  }
  const workflow = await startMockServer((req, res, entry) => {
    const failure = failures[entry.body.domainId]
    return svcError(res, ...failure)
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  for (const [domainId, [status, code, message, requestId]] of Object.entries(failures)) {
    const result = await definition.execute({
      operation: 'create_instance', domainId, definitionVersionId: 'defver-3', contextPayload: {}, metadata: null,
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, code)
    assert.equal(result.error.status, status)
    assert.equal(result.error.detail, message)
    assert.equal(result.error.requestId, requestId)
    assert.equal(result.error.details, undefined)
  }

  await tokenServer.close()
  await workflow.close()
})

// ─── Per-operation strict validation (mapping layer, fail fast) ─────────────

test('workflow_execute: per-operation strict validation fails fast before any credential or HTTP work', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer(() => { throw new Error('no HTTP request may happen for invalid args') })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  // create-only required args missing -> invalid_arguments, zero token + HTTP.
  const missingCreate = await definition.execute({ operation: 'create_instance', domainId: 'd' })
  assert.equal(missingCreate.ok, false)
  assert.equal(missingCreate.error.code, 'invalid_arguments')
  // transition-only required args missing -> same.
  const missingTransition = await definition.execute({ operation: 'transition', workflowInstanceId: 'wf-1' })
  assert.equal(missingTransition.ok, false)
  assert.equal(missingTransition.error.code, 'invalid_arguments')
  // unknown operation -> unsupported_operation.
  const unknown = await definition.execute({ operation: 'cancel', workflowInstanceId: 'wf-1' })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'unsupported_operation')
  assert.equal(tokenServer.requests.length, 0)
  assert.equal(workflow.requests.length, 0)

  await tokenServer.close()
  await workflow.close()
})

// ─── CTR-011: real DSH host (defineTool) carries the multi-operation tool ───

test('CTR-011: the real defineTool host accepts workflow_execute; coarse required schema blocks neither operation', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.pathname === '/internal/v1/workflow-instances') return json(res, 201, { workflowInstanceId: 'wf-h', workflowStateVersion: 1 })
    return json(res, 200, { workflowInstanceId: 'wf-h', workflowStateVersion: 2 })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  // Exactly what registerCapability hands to the production defineTool.
  const { definition } = wire(executeManifest(), transport)
  const tool = defineTool(definition)
  assert.equal(tool.name, 'workflow_execute')

  // REGISTRY coarse-required check: at tool level only `operation` is required;
  // no create-only or transition-only arg is required, so the host schema can
  // never demand cross-operation arguments.
  const requiredToolArgs = Object.entries(definition.parameters)
    .filter(([, spec]) => spec.required === true)
    .map(([name]) => name)
  assert.deepEqual(requiredToolArgs, ['operation'])
  assert.deepEqual(definition.parameters.operation.enum, ['create_instance', 'transition'])

  // Both operations execute through the real host with strictly their own args.
  const created = await tool.execute({ operation: 'create_instance', domainId: 'd', definitionVersionId: 'v', contextPayload: {}, metadata: null })
  assert.deepEqual(created, { ok: true, result: { workflowInstanceId: 'wf-h', workflowStateVersion: 1 } })
  const transitioned = await tool.execute({ operation: 'transition', workflowInstanceId: 'wf-h', transitionDefinitionId: 'td-1', expectedWorkflowStateVersion: 1 })
  assert.deepEqual(transitioned, { ok: true, result: { workflowInstanceId: 'wf-h', workflowStateVersion: 2 } })
  assert.equal(workflow.requests.length, 2)
  assert.equal(workflow.requests[0].pathname, '/internal/v1/workflow-instances')
  assert.equal(workflow.requests[1].pathname, '/internal/v1/workflow-instances/wf-h/transitions')

  await tokenServer.close()
  await workflow.close()
})
