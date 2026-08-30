import test from 'node:test'
import assert from 'node:assert/strict'

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
