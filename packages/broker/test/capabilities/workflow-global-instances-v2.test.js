import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { validateManifest } from '../../src/schema.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── Global Instances V2 (AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2) ─

const findManifest = () => workflowManifests.find((m) => m.id === 'workflow_global_instances')

const globalPage = (items, nextCursor) => ({ items, next_cursor: nextCursor })

const instance = (suffix, createdAt, assignee) => ({
  workflow_instance_id: `9c7f3b0a-0000-4000-8000-${suffix}`,
  title: `调度 需求 ${suffix}`,
  is_terminal: false,
  current_node: { node_key: 'review', display_name: '评审', node_type: 'human' },
  current_assignee_principal_id: assignee,
  created_at: createdAt,
  updated_at: createdAt,
})

test('workflow_global_instances: GET global path, camelCase query set, workflow.read scope, passthrough', async () => {
  const tokenServer = await startTokenServer()
  const assignee = '7a8b9c0d-0000-4000-8000-0000000000d4'
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/internal/v1/workflow-instances/global') {
      return json(res, 200, globalPage([instance('0000000000a1', '2026-08-26T10:00:00Z', assignee)], null))
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findManifest(), transport)

  const res = await definition.execute({
    operation: 'list',
    limit: 5,
    lifecycle: 'active',
    status: 'all',
    definitionKey: 'requirement_review',
    currentNodeKey: 'review',
    assigneePrincipalId: assignee,
    beforeCreatedAt: '2026-08-26T10:00:00Z',
    beforeId: '9c7f3b0a-0000-4000-8000-000000000099',
  })
  assert.equal(res.ok, true)
  // DEC-007: summary passthrough untouched (snake_case downstream shape)
  assert.equal(res.result.items[0].workflow_instance_id, '9c7f3b0a-0000-4000-8000-0000000000a1')
  assert.equal(res.result.items[0].current_node.node_key, 'review')
  assert.equal(res.result.items[0].current_assignee_principal_id, assignee)
  assert.equal(res.result.items[0].created_at, '2026-08-26T10:00:00Z')
  assert.equal('next_cursor' in res.result, true)

  assert.equal(tokenServer.requests[0].body.resource, 'svc-workflow')
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.read')
  const bizReq = workflow.requests[0]
  // CTR-005: GET-only — no request body may leave the broker
  assert.equal(bizReq.method, 'GET')
  assert.equal(bizReq.rawBody, '')
  assert.equal(bizReq.headers.authorization, 'Bearer tok-real')
  // ACC-001: query names are exactly the declared camelCase set (deny_unknown_fields downstream)
  assert.deepEqual(bizReq.query, {
    limit: '5',
    lifecycle: 'active',
    status: 'all',
    definitionKey: 'requirement_review',
    currentNodeKey: 'review',
    assigneePrincipalId: assignee,
    beforeCreatedAt: '2026-08-26T10:00:00Z',
    beforeId: '9c7f3b0a-0000-4000-8000-000000000099',
  })

  await tokenServer.close()
  await workflow.close()
})

test('workflow_global_instances: non-holder 403 preserves global_read_role_required + request-id (fail-closed)', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => {
    res.setHeader('x-request-id', 'req-global-403-reader-1')
    json(res, 403, { error: { code: 'global_read_role_required', message: 'caller holds no global workflow read role' } })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findManifest(), transport)

  const res = await definition.execute({ operation: 'list' })
  assert.equal(res.ok, false)
  // CTR-004: neither flattened to forbidden/http_4xx nor downgraded to invalid_arguments
  assert.equal(res.error.code, 'global_read_role_required')
  assert.equal(res.error.status, 403)
  assert.equal(res.error.requestId, 'req-global-403-reader-1')
  assert.equal(res.error.detail, 'caller holds no global workflow read role')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_global_instances: transition-state 403 preserves global_coordinator_required (dual-code declaration)', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => {
    res.setHeader('x-request-id', 'req-global-403-coord-1')
    json(res, 403, { error: { code: 'global_coordinator_required', message: 'global coordinator role required' } })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findManifest(), transport)

  const res = await definition.execute({ operation: 'list' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'global_coordinator_required')
  assert.equal(res.error.status, 403)
  assert.equal(res.error.requestId, 'req-global-403-coord-1')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_global_instances: limit out of bounds fails fast locally — token/HTTP count = 0', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 200, globalPage([], null)))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findManifest(), transport)

  for (const limit of [0, -1, 21]) {
    const res = await definition.execute({ operation: 'list', limit })
    assert.equal(res.ok, false, `limit=${limit}`)
    assert.equal(res.error.code, 'invalid_pagination', `limit=${limit}`)
  }
  assert.equal(workflow.requests.length, 0, 'no business call may leave the broker')
  assert.equal(tokenServer.requests.length, 0, 'no token may be requested')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_global_instances: half cursor forwarded as declared — downstream 422 invalid_cursor preserved', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    // Downstream composite-cursor discipline (OBS-005): the pair must arrive together.
    if (('beforeCreatedAt' in entry.query) !== ('beforeId' in entry.query)) {
      res.setHeader('x-request-id', 'req-global-422-cursor-1')
      return json(res, 422, { error: { code: 'invalid_cursor', message: 'cursor parameters must be given together' } })
    }
    json(res, 200, globalPage([], null))
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findManifest(), transport)

  const res = await definition.execute({ operation: 'list', beforeCreatedAt: '2026-08-26T10:00:00Z' })
  assert.equal(res.ok, false)
  // No broker-side pairing check (CTR-002): the half cursor reached the server…
  assert.deepEqual(workflow.requests[0].query, { beforeCreatedAt: '2026-08-26T10:00:00Z' })
  // …and the downstream 422 envelope is preserved end to end.
  assert.equal(res.error.code, 'invalid_cursor')
  assert.equal(res.error.status, 422)
  assert.equal(res.error.requestId, 'req-global-422-cursor-1')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_global_instances: paired cursor paginates and results carry next_cursor', async () => {
  const tokenServer = await startTokenServer()
  const page1 = [
    instance('0000000000b1', '2026-08-27T09:00:00Z', '0f1e2d3c-0000-4000-8000-0000000000c3'),
    instance('0000000000b2', '2026-08-26T10:00:00Z', '7a8b9c0d-0000-4000-8000-0000000000d4'),
  ]
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.query.beforeCreatedAt === undefined) {
      return json(res, 200, globalPage(page1, 'opaque-next'))
    }
    return json(res, 200, globalPage([instance('0000000000b3', '2026-08-25T08:00:00Z', null)], null))
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findManifest(), transport)

  const first = await definition.execute({ operation: 'list', limit: 2 })
  assert.equal(first.ok, true)
  assert.equal(first.result.items.length, 2)
  assert.notEqual(first.result.next_cursor, null)

  // DEC-002: advance with the paired cursor built from the page boundary.
  const boundary = first.result.items[first.result.items.length - 1]
  const second = await definition.execute({
    operation: 'list',
    limit: 2,
    beforeCreatedAt: boundary.created_at,
    beforeId: boundary.workflow_instance_id,
  })
  assert.equal(second.ok, true)
  assert.equal(second.result.items[0].workflow_instance_id, '9c7f3b0a-0000-4000-8000-0000000000b3')
  assert.equal(second.result.next_cursor, null)
  assert.deepEqual(workflow.requests[1].query, {
    limit: '2',
    beforeCreatedAt: '2026-08-26T10:00:00Z',
    beforeId: '9c7f3b0a-0000-4000-8000-0000000000b2',
  })

  await tokenServer.close()
  await workflow.close()
})

test('workflow_global_instances: assigneePrincipalId is a result filter — token subject/credential invariant', async () => {
  const tokenServer = await startTokenServer()
  let credentialCalls = 0
  const workflow = await startMockServer((req, res) => json(res, 200, globalPage([], null)))
  const transport = createHttpTransport({
    credentialProvider: {
      getCredential: async () => {
        credentialCalls += 1
        return { clientId: 'wf-client', clientSecret: 'wf-secret' }
      },
    },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findManifest(), transport)

  const first = await definition.execute({ operation: 'list', assigneePrincipalId: '11111111-0000-4000-8000-000000000001' })
  const second = await definition.execute({ operation: 'list', assigneePrincipalId: '22222222-0000-4000-8000-000000000002' })
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)

  // CTR-003: the parameter never reaches the auth layer — every token request
  // is byte-identical (the transport reuses the cached token, which only
  // strengthens the invariant: same subject for any filter value).
  assert.ok(tokenServer.requests.length >= 1)
  for (const req of tokenServer.requests) {
    assert.deepEqual(req.body, tokenServer.requests[0].body)
  }
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.read')
  assert.ok(credentialCalls >= 1)
  // …and on the business call it appears only as the server-side filter param.
  assert.equal(workflow.requests[0].query.assigneePrincipalId, '11111111-0000-4000-8000-000000000001')
  assert.equal(workflow.requests[1].query.assigneePrincipalId, '22222222-0000-4000-8000-000000000002')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_global_instances: manifest shape — schema-valid, GET-only, no idempotency, declared error table', () => {
  const manifest = findManifest()
  const res = validateManifest(manifest)
  assert.equal(res.ok, true, res.errors?.join('; '))

  assert.deepEqual(manifest.requiredScopes, ['workflow.read'])
  const op = manifest.operations[0]
  // ACC-007: read-only binding — GET, no idempotency flag anywhere in the manifest.
  assert.equal(op.name, 'list')
  assert.equal(op.http.method, 'GET')
  assert.equal(op.http.path, '/internal/v1/workflow-instances/global')
  assert.equal(op.http.target, 'svc-workflow')
  assert.equal(JSON.stringify(manifest).includes('idempotency'), false)

  // CTR-001: the declared error table (dual role codes + lifecycle/status codes).
  const codes = new Set(manifest.errors.map((e) => e.code))
  for (const code of [
    'invalid_arguments',
    'unsupported_operation',
    'unauthenticated',
    'forbidden',
    'principal_not_found',
    'principal_disabled',
    'global_coordinator_required',
    'global_read_role_required',
    'invalid_pagination',
    'invalid_cursor',
    'invalid_lifecycle',
    'invalid_status',
    'internal_consistency_error',
    'service_unavailable',
  ]) {
    assert.equal(codes.has(code), true, `missing declared error code ${code}`)
  }
})

test('workflow_global_instances: generic tool — no per-agent wiring, no scheduler surface', () => {
  const manifest = findManifest()
  // ACC-009 (DEC-008): no agent/principal/session identity baked into the manifest.
  assert.equal(/agt_|dispatcher|scheduler/i.test(JSON.stringify(manifest)), false)
  // …and none in the capability module source, which stays free of scheduler bindings.
  const source = readFileSync(new URL('../../src/capabilities/workflow.js', import.meta.url), 'utf8')
  assert.equal(/agt_|dispatcher|scheduler/i.test(source), false)
  assert.equal(source.includes('dc702687'), false)
  assert.equal(source.includes('bc970ced'), false)
})
