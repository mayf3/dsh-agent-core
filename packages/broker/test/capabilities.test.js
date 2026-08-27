/**
 * @agent-core/broker — First-batch capability fixtures (real-shaped) tests.
 *
 * End-to-end proof that the SHIPPED capability manifests run through the whole
 * generic pipeline against mock servers shaped like the real services:
 *
 *   manifest → tool (defineTool-shaped) → invoke → generic transport
 *   → mock Broker endpoint (token endpoint + business endpoint) → structured result
 *
 * Fixtures (real shapes, real paths/scopes — evidence:
 * docs/investigations/broker-capability-parity.md §1.2 + service source):
 *   - forum_reply           POST /api/threads/{threadId}/messages  forum.write (svc-forum)
 *   - workflow_instance_detail GET /internal/v1/workflow-instances/{workflowInstanceId} workflow.read (svc-workflow)
 *   - workflow_my_tasks     GET /internal/v1/worklists/assigned-to-me workflow.read (svc-workflow)
 *   - workflow_domain_instances GET /internal/v1/workflow-instances/domain workflow.read (svc-workflow;
 *     AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1 — read-only DOMAIN_OWNER enumeration,
 *     server-side auth, camelCase `domainId` wire param, snake_case summary passthrough)
 *   - okr_read              GET /api/goals/mine                    okr.read (svc-okr)
 *
 * The mock token endpoint implements the auth-service client_credentials
 * contract (Basic auth + grant_type/resource/scope form body).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

import { validateManifest } from '../src/schema.js'
import { buildToolDefinition } from '../src/registry.js'
import { createHttpTransport, createHttpHandlers } from '../src/transport.js'
import { targets } from '../src/targets.js'
import { manifests as forumManifests } from '../src/capabilities/forum.js'
import { manifests as workflowManifests } from '../src/capabilities/workflow.js'
import { manifests as okrManifests } from '../src/capabilities/okr.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function startMockServer(handler) {
  const requests = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const entry = {
        method: req.method,
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: req.headers,
        rawBody: raw,
        body: raw === '' ? undefined : safeJson(raw) ?? Object.fromEntries(new URLSearchParams(raw)),
      }
      requests.push(entry)
      handler(req, res, entry)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        origin: `http://127.0.0.1:${port}`,
        requests,
        close: () =>
          new Promise((r) => {
            server.closeAllConnections?.()
            server.close(r)
          }),
      })
    })
  })
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Mock auth-service token endpoint; records every token request. */
async function startTokenServer() {
  return startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/oauth/token') {
      return json(res, 200, { access_token: 'tok-real', token_type: 'Bearer', expires_in: 300 })
    }
    json(res, 404, { error: 'not_found' })
  })
}

/** Wire a manifest through buildToolDefinition + the real transport. */
function wire(manifest, transport) {
  return buildToolDefinition({
    manifest,
    handlers: createHttpHandlers(manifest, transport),
    deps: { resolvePrincipal: () => undefined },
  })
}

/**
 * Targets with the REAL deployed origins replaced by mock-server origins, so
 * fixtures stay hermetic (the real svc-forum/workflow/okr may be running on
 * this machine and would answer with 401 TOKEN_INVALID_OR_EXPIRED otherwise).
 */
function mockTargets(overrides) {
  return targets.map((t) => (overrides[t.targetId] ? { ...t, allowedOrigin: overrides[t.targetId] } : t))
}

// ─── Schema: all 13 shipped manifests are valid ─────────────────────────────

test('schema: all 13 first-batch manifests validate', () => {
  const all = [...forumManifests, ...workflowManifests, ...okrManifests]
  assert.equal(all.length, 13)
  for (const manifest of all) {
    const res = validateManifest(manifest)
    assert.equal(res.ok, true, `${manifest.id}: ${res.errors?.join('; ')}`)
  }
  // every http op pins a known target and declares its scopes
  for (const manifest of all) {
    for (const op of manifest.operations) {
      if (!op.http) continue
      assert.ok(targets.some((t) => t.targetId === op.http.target), `${manifest.id}: unknown target`)
      assert.ok(manifest.requiredScopes.length > 0, `${manifest.id}: missing requiredScopes`)
      assert.ok(['GET', 'POST', 'PUT', 'DELETE'].includes(op.http.method), `${manifest.id}: bad method`)
    }
  }
})

// ─── Fixture 1: Forum reply (POST, path param, JSON body, forum.write) ─────

test('forum_reply: kind is restricted to the reviewer-safe enum (no moderator-only kinds)', async () => {
  const manifest = forumManifests.find((m) => m.id === 'forum_reply')
  const REVIEWER_SAFE = ['comment', 'proposal', 'challenge', 'clarification', 'evidence']

  // tool schema exposes ONLY kinds a forum.write credential can post
  const { definition } = wire(manifest, { execute: async () => ({ errorCode: 'credential_unavailable' }) })
  const kindSpec = definition.parameters.kind
  assert.deepEqual(kindSpec.enum, REVIEWER_SAFE)
  assert.ok(!kindSpec.enum.includes('system'))
  assert.ok(!kindSpec.enum.includes('decision'))

  // mapping rejects a moderator-only kind BEFORE any transport call
  let calls = 0
  const spy = {
    execute: async () => {
      calls += 1
      return { errorCode: 'credential_unavailable' }
    },
  }
  const { definition: def2 } = wire(manifest, spy)
  const out = await def2.execute({ operation: 'reply', threadId: 't-1', content: 'hi', kind: 'system' })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'invalid_arguments')
  assert.equal(calls, 0, 'transport must not run for a moderator-only kind')

  // reviewer-safe kind passes validation and reaches the transport
  const out2 = await def2.execute({ operation: 'reply', threadId: 't-1', content: 'hi', kind: 'comment' })
  assert.equal(out2.ok, false)
  assert.equal(out2.error.code, 'credential_unavailable')
  assert.equal(calls, 1)
})

test('forum_search_threads: q is required (manifest schema + tool schema + mapping)', async () => {
  const manifest = forumManifests.find((m) => m.id === 'forum_search_threads')

  // manifest schema: q in required
  const res = validateManifest(manifest)
  assert.equal(res.ok, true)
  assert.deepEqual(res.manifest.operations[0].arguments.required, ['q'])

  // tool schema: q.required === true
  const { definition } = wire(manifest, { execute: async () => ({ errorCode: 'credential_unavailable' }) })
  assert.equal(definition.parameters.q.required, true)

  // mapping: missing q → invalid_arguments, transport never runs
  let calls = 0
  const spy = {
    execute: async () => {
      calls += 1
      return { errorCode: 'credential_unavailable' }
    },
  }
  const { definition: def2 } = wire(manifest, spy)
  const out = await def2.execute({ operation: 'search', page: 1 })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'invalid_arguments')
  assert.equal(calls, 0)

  // with q → passes validation and reaches the transport
  const out2 = await def2.execute({ operation: 'search', q: 'okr', page: 1 })
  assert.equal(out2.ok, false)
  assert.equal(out2.error.code, 'credential_unavailable')
  assert.equal(calls, 1)
})

test('forum_reply: manifest → tool → authorized POST → structured result', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/api/threads/t-1/messages') {
      return json(res, 201, { message: { id: 'm-1', content: entry.body.content, threadId: 't-1' } })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'forum-client', clientSecret: 'forum-secret' }) },
    targets: mockTargets({ 'svc-forum': forum.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = forumManifests.find((m) => m.id === 'forum_reply')
  const { definition, capabilityId } = wire(manifest, transport)

  // manifest → DSH tool: name / parameters / no identity fields
  assert.equal(capabilityId, 'forum_reply')
  assert.equal(definition.name, 'forum_reply')
  assert.deepEqual(definition.parameters.operation.enum, ['reply'])
  assert.equal(definition.parameters.content.required, true)
  assert.ok(!JSON.stringify(definition.parameters).toLowerCase().includes('agentid'))
  assert.ok(!JSON.stringify(definition.parameters).toLowerCase().includes('principalid'))

  // execute through the real tool definition
  const res = await definition.execute({ operation: 'reply', threadId: 't-1', content: 'hello', kind: 'proposal' })
  assert.deepEqual(res, { ok: true, result: { message: { id: 'm-1', content: 'hello', threadId: 't-1' } } })

  // authorization propagation: audience + scope on the wire
  const tokenReq = tokenServer.requests[0]
  assert.equal(tokenReq.body.resource, 'svc-forum')
  assert.equal(tokenReq.body.scope, 'forum.write')
  assert.equal(tokenReq.headers.authorization, `Basic ${Buffer.from('forum-client:forum-secret').toString('base64')}`)

  // business request: pinned path + JSON body + Bearer
  const bizReq = forum.requests[0]
  assert.equal(bizReq.method, 'POST')
  assert.equal(bizReq.pathname, '/api/threads/t-1/messages')
  assert.equal(bizReq.headers.authorization, 'Bearer tok-real')
  assert.deepEqual(bizReq.body, { content: 'hello', kind: 'proposal' })

  await tokenServer.close()
  await forum.close()
})

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

// ─── Fixture 5: OKR read (GET, no params, okr.read) ────────────────────────

test('okr_read: no-param GET with okr.read scope (svc-okr target)', async () => {
  const tokenServer = await startTokenServer()
  const okr = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/api/goals/mine') {
      return json(res, 200, { goals: [{ id: 'g-1', title: 'Ship Broker V1' }] })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'okr-client', clientSecret: 'okr-secret' }) },
    targets: mockTargets({ 'svc-okr': okr.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = okrManifests.find((m) => m.id === 'okr_read')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'read' })
  assert.equal(res.ok, true)
  assert.equal(res.result.goals[0].title, 'Ship Broker V1')

  assert.equal(tokenServer.requests[0].body.resource, 'svc-okr')
  assert.equal(tokenServer.requests[0].body.scope, 'okr.read')
  const bizReq = okr.requests[0]
  assert.equal(bizReq.pathname, '/api/goals/mine')
  assert.equal(bizReq.headers.authorization, 'Bearer tok-real')

  await tokenServer.close()
  await okr.close()
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

test('F. forum broker non-regression: undeclared service code still degrades to declared http_4xx', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startMockServer((req, res) => json(res, 404, { error: 'not_found', message: 'no such thread' }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'forum-client', clientSecret: 'forum-secret' }) },
    targets: mockTargets({ 'svc-forum': forum.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = forumManifests.find((m) => m.id === 'forum_reply')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'reply', threadId: 'missing', content: 'hi' })
  assert.equal(res.ok, false)
  // `not_found` is not in forum_reply's declared table → fail-closed fallback
  // to the declared canonical code, with status + detail still preserved.
  assert.equal(res.error.code, 'http_4xx')
  assert.equal(res.error.status, 404)
  assert.equal(res.error.detail, 'no such thread')
  assert.equal(res.error.requestId, undefined)

  await tokenServer.close()
  await forum.close()
})

// ─── Generic Idempotency-Key fixture (write shape, test-only capability) ───

test('idempotency: generic IK mechanism works for a workflow-transition-shaped write', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/internal/v1/workflow-instances/wf-1/transitions') {
      return json(res, 200, { transitioned: true, ik: entry.headers['idempotency-key'] })
    }
    json(res, 404, { error: 'not_found' })
  })

  const manifest = {
    id: 'workflow_transition',
    toolName: 'workflow_transition',
    name: 'Workflow Transition',
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
  assert.ok(/^ik-workflow-transition-\d+-[a-z0-9]+$/.test(ik), `unexpected IK ${ik}`)
  assert.equal(res.result.ik, ik)
  // model-supplied IK in args is ignored (trusted-zone generation only)
  const res2 = await definition.execute({ operation: 'transition', workflowInstanceId: 'wf-1', action: 'approve', idempotencyKey: 'ik-mallory' })
  assert.equal(res2.ok, true)
  assert.ok(workflow.requests[1].headers['idempotency-key'] !== 'ik-mallory')

  await tokenServer.close()
  await workflow.close()
})
