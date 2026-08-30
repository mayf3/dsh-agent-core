import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── Fixture 3: Workflow my tasks (GET, no params, query limit) ────────────

test('workflow_my_tasks: no-param GET with query mapping', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/internal/v1/worklists/assigned-to-me') {
      return json(res, 200, { items: [{ id: 't-9', title: 'Review PR' }] })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_my_tasks')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'list', limit: 5 })
  assert.equal(res.ok, true)
  assert.equal(res.result.items[0].title, 'Review PR')

  const bizReq = workflow.requests[0]
  assert.equal(bizReq.pathname, '/internal/v1/worklists/assigned-to-me')
  assert.deepEqual(bizReq.query, { limit: '5' })
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.read')

  await tokenServer.close()
  await workflow.close()
})
// ─── Downstream error preservation & pagination validation (task ACs A-F) ───

/** svc-workflow-shaped error response with a service-generated x-request-id. */
const svcError = (res, status, code, message, requestId) => {
  const headers = { 'Content-Type': 'application/json' }
  if (requestId !== undefined) headers['x-request-id'] = requestId
  res.writeHead(status, headers)
  res.end(JSON.stringify({ error: { code, message } }))
}

test('A. workflow_my_tasks: projection exists, no tasks → 200 + items=[]', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    assert.equal(entry.method, 'GET')
    assert.equal(entry.pathname, '/internal/v1/worklists/assigned-to-me')
    return json(res, 200, { items: [], nextBefore: null })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_my_tasks')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'list' })
  assert.equal(res.ok, true)
  assert.deepEqual(res.result, { items: [], nextBefore: null })

  await tokenServer.close()
  await workflow.close()
})

test('B. workflow_my_tasks: missing projection → 404 principal_not_found + request-id preserved', async () => {
  const requestId = 'b1a0c2d3-e4f5-6789-abcd-ef0123456789'
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => svcError(res, 404, 'principal_not_found', 'principal not found', requestId))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_my_tasks')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'list' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'principal_not_found') // NOT http_4xx
  assert.equal(res.error.status, 404)
  assert.equal(res.error.requestId, requestId)
  assert.equal(res.error.detail, 'principal not found')

  // The final renderer surfaces the precise diagnostics, not a bare code.
  const rendered = definition.output.render({ operation: 'list' }, res)
  assert.match(rendered[0].text, /failed: principal_not_found \(status=404, request_id=b1a0c2d3-e4f5-6789-abcd-ef0123456789\)/)

  await tokenServer.close()
  await workflow.close()
})

test('C. workflow_my_tasks: invalid limit fails fast locally — HTTP call count = 0', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 200, { items: [] }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_my_tasks')
  const { definition } = wire(manifest, transport)

  for (const limit of [0, -1, 21, 999]) {
    const res = await definition.execute({ operation: 'list', limit })
    assert.equal(res.ok, false, `limit=${limit}`)
    assert.equal(res.error.code, 'invalid_pagination', `limit=${limit}`)
    assert.match(res.error.detail, /limit/)
  }
  // Fail-fast BEFORE the wire: neither the token endpoint nor svc-workflow
  // was contacted (total HTTP call count = 0 across all four rejections).
  assert.equal(tokenServer.requests.length, 0)
  assert.equal(workflow.requests.length, 0)

  // Boundary values 1 and 20 are legal and DO reach svc-workflow.
  for (const limit of [1, 20]) {
    const res = await definition.execute({ operation: 'list', limit })
    assert.equal(res.ok, true, `limit=${limit}`)
    assert.equal(workflow.requests.at(-1).query.limit, String(limit))
  }
  assert.equal(tokenServer.requests.length, 1) // cached after the first issue

  // Cursor parameters are NOT exposed by this capability: a model-supplied
  // half-cursor is dropped at the binding layer, never forwarded downstream.
  const res = await definition.execute({ operation: 'list', limit: 5, before_created_at: '2024-01-15T10:30:00Z' })
  assert.equal(res.ok, true)
  assert.deepEqual(workflow.requests.at(-1).query, { limit: '5' })

  await tokenServer.close()
  await workflow.close()
})

test('D. workflow_my_tasks: downstream 403 preserves status/code/request-id', async () => {
  const requestId = 'c0ffee00-dead-beef-0000-123456789abc'
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => svcError(res, 403, 'forbidden', 'required scope is missing', requestId))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_my_tasks')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'list' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'forbidden')
  assert.equal(res.error.status, 403)
  assert.equal(res.error.requestId, requestId)
  assert.equal(res.error.detail, 'required scope is missing')

  await tokenServer.close()
  await workflow.close()
})

test('E. workflow_my_tasks: sensitive material in the service message is sanitized', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) =>
    svcError(
      res,
      422,
      'invalid_pagination',
      'rejected: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature token=sekret-value-123 credential="hunter2"',
      'd-4a5b6c7d',
    ),
  )
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_my_tasks')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'list' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'invalid_pagination')
  assert.equal(res.error.requestId, 'd-4a5b6c7d')
  // The WHOLE envelope (not just detail) carries none of the secrets: no
  // bearer token, no token/credential values, nothing echoable.
  const wire_ = JSON.stringify(res)
  assert.ok(!wire_.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'JWT leaked')
  assert.ok(!wire_.includes('sekret-value-123'), 'token value leaked')
  assert.ok(!wire_.includes('hunter2'), 'credential value leaked')
  assert.match(res.error.detail, /rejected:/)
  assert.match(res.error.detail, /authorization: \[REDACTED\]/i)
  assert.match(res.error.detail, /token=\[REDACTED\]/i)
  assert.match(res.error.detail, /credential=\[REDACTED\]/i)

  await tokenServer.close()
  await workflow.close()
})
