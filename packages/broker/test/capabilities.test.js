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

// ─── Schema: all 12 shipped manifests are valid ─────────────────────────────

test('schema: all 12 first-batch manifests validate', () => {
  const all = [...forumManifests, ...workflowManifests, ...okrManifests]
  assert.equal(all.length, 12)
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

// ─── Fixture 4: OKR read (GET, no params, okr.read) ────────────────────────

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

test('workflow_instance_detail: 404 maps to http_4xx with status/detail', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 404, { error: 'not_found' }))

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = workflowManifests.find((m) => m.id === 'workflow_instance_detail')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'read', workflowInstanceId: 'missing' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'http_4xx')
  assert.equal(res.error.status, 404)
  assert.ok(res.error.detail.includes('not_found'))

  await tokenServer.close()
  await workflow.close()
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
