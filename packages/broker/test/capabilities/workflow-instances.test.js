import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { DEFAULT_MANIFESTS } from '../../src/index.js'
import { assertValidManifest, invoke } from '../../src/mapping.js'
import { createHttpHandlers } from '../../src/transport.js'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── Fixture 2: Workflow instance detail (GET, path param, workflow.read) ───

test('workflow_instance_detail: GET with path param mapping + workflow.read scope', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/internal/v1/workflow-instances/9c7f3b0a-0000-4000-8000-000000000001') {
      return json(res, 200, { visibility: 'assigned', detail: { status: 'in_progress' }, outgoingTransitions: ['approve', 'reject'] })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_instance_detail')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({
    operation: 'read',
    workflowInstanceId: '9c7f3b0a-0000-4000-8000-000000000001',
  })
  assert.equal(res.ok, true)
  assert.deepEqual(res.result.outgoingTransitions, ['approve', 'reject'])

  assert.equal(tokenServer.requests[0].body.resource, 'svc-workflow')
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.read')
  const bizReq = workflow.requests[0]
  assert.equal(bizReq.pathname, '/internal/v1/workflow-instances/9c7f3b0a-0000-4000-8000-000000000001')
  assert.equal(bizReq.headers.authorization, 'Bearer tok-real')

  await tokenServer.close()
  await workflow.close()
})
// ─── Fixture 4: Workflow domain instances (GET, query mapping, DOMAIN_OWNER) ─

test('workflow_domain_instances: GET with camelCase domainId query mapping + workflow.read scope', async () => {
  const tokenServer = await startTokenServer()
  const domainId = '1c2d3e4f-0000-4000-8000-00000000aa01'
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/internal/v1/workflow-instances/domain') {
      if (entry.query.domainId !== domainId) {
        return json(res, 422, { error: { code: 'invalid_pagination', message: 'pagination parameters are invalid' } })
      }
      // Real shape: Page<DomainInstanceSummary> — downstream snake_case JSON.
      return json(res, 200, {
        items: [
          {
            workflow_instance_id: '9c7f3b0a-0000-4000-8000-0000000000a1',
            domain_id: domainId,
            definition_version_id: '5e6f7a8b-0000-4000-8000-0000000000b2',
            definition_key: 'requirement_review',
            created_by_principal_id: '0f1e2d3c-0000-4000-8000-0000000000c3',
            current_assignee_principal_id: '7a8b9c0d-0000-4000-8000-0000000000d4',
            execution_class: 'BUSINESS',
            current_node: { node_id: '2b3c4d5e-0000-4000-8000-0000000000e5', node_key: 'review', display_name: '评审', node_type: 'human' },
            is_terminal: false,
            title: '调度 正式部署方案修订',
            created_at: '2026-08-26T10:00:00Z',
            updated_at: '2026-08-27T09:30:00Z',
          },
        ],
        next_cursor: null,
      })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_domain_instances')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'list', domainId, limit: 5 })
  assert.equal(res.ok, true)
  // summary passthrough untouched (snake_case downstream shape)
  assert.equal(res.result.items[0].workflow_instance_id, '9c7f3b0a-0000-4000-8000-0000000000a1')
  assert.equal(res.result.items[0].current_node.node_key, 'review')
  assert.equal(res.result.items[0].current_assignee_principal_id, '7a8b9c0d-0000-4000-8000-0000000000d4')
  // ACC-WECB-003 (AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1): the class
  // passes through verbatim — present when svc sends it, never renamed.
  assert.equal(res.result.items[0].execution_class, 'BUSINESS')
  assert.equal(res.result.items[0].updated_at, '2026-08-27T09:30:00Z')

  assert.equal(tokenServer.requests[0].body.resource, 'svc-workflow')
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.read')
  const bizReq = workflow.requests[0]
  assert.equal(bizReq.pathname, '/internal/v1/workflow-instances/domain')
  // camelCase wire names only — downstream serde uses deny_unknown_fields
  assert.deepEqual(bizReq.query, { domainId, limit: '5' })
  assert.equal(bizReq.headers.authorization, 'Bearer tok-real')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_instances: non-owner 404 preserves service code, status, request-id', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => {
    res.setHeader('x-request-id', 'req-domain-404-1')
    json(res, 404, { error: { code: 'workflow_instance_not_found_or_not_visible', message: 'workflow instance not found or not visible' } })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_domain_instances')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'list', domainId: '1c2d3e4f-0000-4000-8000-00000000aa02' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'workflow_instance_not_found_or_not_visible')
  assert.equal(res.error.status, 404)
  assert.equal(res.error.requestId, 'req-domain-404-1')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_instances: limit out of bounds fails fast locally — HTTP call count = 0', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 200, { items: [] }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_domain_instances')
  const { definition } = wire(manifest, transport)

  for (const limit of [0, -1, 21]) {
    const res = await definition.execute({ operation: 'list', domainId: '1c2d3e4f-0000-4000-8000-00000000aa03', limit })
    assert.equal(res.ok, false, `limit=${limit}`)
    assert.equal(res.error.code, 'invalid_pagination', `limit=${limit}`)
  }
  assert.equal(workflow.requests.length, 0, 'no business call may leave the broker')
  assert.equal(tokenServer.requests.length, 0, 'no token may be requested')

  await tokenServer.close()
  await workflow.close()
})
// ─── Real-shaped error path: workflow 404 through the shipped manifest ─────

test('workflow_instance_detail: 404 preserves service code, status, request-id', async () => {
  const requestId = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0'
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => {
    res.writeHead(404, { 'Content-Type': 'application/json', 'x-request-id': requestId })
    res.end(JSON.stringify({ error: { code: 'workflow_instance_not_found_or_not_visible', message: 'workflow instance not found or not visible' } }))
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_instance_detail')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'read', workflowInstanceId: 'missing' })
  assert.equal(res.ok, false)
  // NOT flattened to http_4xx: the declared service code, status, sanitized
  // detail and downstream request-id all reach the model-visible envelope.
  assert.equal(res.error.code, 'workflow_instance_not_found_or_not_visible')
  assert.equal(res.error.status, 404)
  assert.equal(res.error.requestId, requestId)
  assert.equal(res.error.detail, 'workflow instance not found or not visible')

  await tokenServer.close()
  await workflow.close()
})

// Current task input through the default Broker inventory and generic HTTP.
const capturedInput = JSON.parse(readFileSync(new URL('../../test-support/current-task-input-responses.json', import.meta.url)))
const instance = capturedInput.input.binding.workflow_instance_id
const submission = capturedInput.input.entry.submission_id

function currentInputManifest() {
  const matches = DEFAULT_MANIFESTS.filter((m) => m.id === 'workflow_current_task_input')
  assert.equal(matches.length, 1, 'default Broker must expose exactly one current-input capability')
  return assertValidManifest(matches[0])
}

async function server(t, respond) {
  const requests = []
  const app = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const request = { method: req.method, url: req.url, headers: req.headers, body }
    requests.push(request)
    respond(request, res)
  })
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => {
    app.closeAllConnections()
    app.close(resolve)
  }))
  return { origin: `http://127.0.0.1:${app.address().port}`, requests }
}

function ctiJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json', 'x-request-id': 'cti-test-request' })
  res.end(JSON.stringify(value))
}

async function setup(t, respond) {
  const manifest = currentInputManifest()
  const auth = await server(t, (_req, res) => ctiJson(res, 200, {
    access_token: 'synthetic-test-token', token_type: 'Bearer', expires_in: 300,
  }))
  const service = await server(t, respond)
  const transport = createHttpTransport({
    targets: [{ targetId: 'svc-workflow', allowedOrigin: service.origin, audience: 'workflow-test' }],
    authServiceOrigin: auth.origin,
    credentialProvider: { getCredential: async () => ({ clientId: 'test-agent', clientSecret: 'synthetic-only' }) },
  })
  const handlers = createHttpHandlers(manifest, transport)
  return {
    manifest, auth, service,
    read: (args) => invoke(manifest, handlers, { operation: 'read', args }, {}),
  }
}

test('current-input read uses the exact GET and preserves limited-selection qualification', async (t) => {
  // Exact producer-shaped fixture; omit one body to exercise INCOMPLETE
  // passthrough without changing its identity/digest/selection boundaries.
  const payload = structuredClone(capturedInput.input)
  payload.detail_body = { ...payload.detail_body, text: '', next_offset: 0, content_status: 'OMITTED' }
  payload.input_status = 'INCOMPLETE'
  payload.content_complete = false
  const io = await setup(t, (_req, res) => ctiJson(res, 200, payload))
  const result = await io.read({ workflowInstanceId: instance, view: 'input', submissionIds: submission })
  assert.deepEqual(result, { ok: true, result: payload })
  assert.deepEqual(io.manifest.requiredScopes, ['workflow.read'])
  assert.equal(io.manifest.operations.length, 1)
  assert.equal(io.service.requests.length, 1)
  const request = io.service.requests[0]
  assert.equal(request.method, 'GET')
  const url = new URL(request.url, io.service.origin)
  assert.equal(url.pathname, `/internal/v1/workflow-instances/${instance}/current-task-input`)
  assert.deepEqual(Object.fromEntries(url.searchParams), { view: 'input', submissionIds: submission })
  assert.equal(request.body, '')
  assert.equal(request.headers['idempotency-key'], undefined)
  assert.equal(new URLSearchParams(io.auth.requests[0].body).get('scope'), 'workflow.read')
})

test('body reads preserve Unicode, digest and byte offset coordinates through generic transport', async (t) => {
  const payload = capturedInput.body
  const { binding, body } = payload
  const io = await setup(t, (_req, res) => ctiJson(res, 200, payload))
  const args = { workflowInstanceId: binding.workflow_instance_id, view: 'body',
    expectedNodeVisitId: binding.node_visit_id, expectedWorkflowStateVersion: binding.workflow_state_version,
    expectedContextRevisionId: binding.context_revision_id, bodyKind: body.kind, bodyId: body.id,
    expectedBodySha256: body.sha256, offset: body.offset }
  assert.deepEqual(await io.read(args), { ok: true, result: payload })
  const { workflowInstanceId, ...query } = args
  const requestUrl = new URL(io.service.requests[0].url, io.service.origin)
  assert.equal(requestUrl.pathname, `/internal/v1/workflow-instances/${workflowInstanceId}/current-task-input`)
  assert.deepEqual(Object.fromEntries(requestUrl.searchParams),
    Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])))
  assert.equal(Buffer.byteLength(body.text), body.next_offset - body.offset)
  assert.equal(Buffer.byteLength(body.text), 8190, 'actual UTF-8-boundary chunk from the service')

})

test('read failures retain exact service codes and statuses without retry or false success', async (t) => {
  const cases = [
    [422, 'invalid_current_task_input'], [409, 'current_task_input_stale'],
    [409, 'current_task_body_changed'], [404, 'current_task_body_not_found_or_not_visible'],
    [404, 'workflow_instance_not_found_or_not_visible'], [404, 'principal_not_found'],
    [403, 'restricted_history_not_visible'], [403, 'principal_disabled'],
    [500, 'internal_consistency_error'], [503, 'service_unavailable'],
    [503, 'new_unrecognized_error', 'http_5xx'],
  ]
  let next = 0
  const io = await setup(t, (_req, res) => {
    const [status, code] = cases[next++]
    ctiJson(res, status, { error: { code, message: 'controlled read failure' } })
  })
  for (const [status, code, fallback] of cases) {
    const result = await io.read({ workflowInstanceId: instance })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, fallback ?? code)
    assert.equal(result.error.status, status)
    assert.equal(result.error.requestId, 'cti-test-request')
  }
  assert.equal(io.service.requests.length, cases.length, 'a read failure must not trigger implicit retry')
})

test('invalid or identity-bearing model arguments fail before credentials or HTTP', async (t) => {
  const io = await setup(t, (_req, res) => ctiJson(res, 200, {}))
  for (const invalid of [
    {}, { workflowInstanceId: instance, principalId: 'forged' },
    { workflowInstanceId: instance, view: 'history' },
    { workflowInstanceId: instance, bodyKind: 'FILESYSTEM' },
    { workflowInstanceId: instance, offset: -1 },
    { workflowInstanceId: instance, expectedWorkflowStateVersion: 0 },
    { workflowInstanceId: instance, submissionIds: [submission] },
  ]) {
    const result = await io.read(invalid)
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'invalid_arguments')
  }
  assert.equal(io.auth.requests.length, 0)
  assert.equal(io.service.requests.length, 0)
})
