import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { validateManifest } from '../../src/schema.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── workflow_domain_admin (AGENT_CORE_WORKFLOW_COORDINATOR_CONTROL_PLANE_BROKER_V1, CTR-DCP-001) ─

const adminManifest = () => workflowManifests.find((m) => m.id === 'workflow_domain_admin')

test('workflow_domain_admin: manifest validates; six operations with frozen wire bindings; union scope set', () => {
  const manifest = adminManifest()
  assert.equal(validateManifest(manifest).ok, true)
  assert.deepEqual(manifest.requiredScopes, ['workflow.read', 'workflow.execute'])
  assert.deepEqual(
    manifest.operations.map((op) => op.name),
    ['list', 'get', 'create', 'update', 'get_owner', 'set_owner'],
  )

  const http = (name) => manifest.operations.find((op) => op.name === name).http
  assert.deepEqual(http('list'), {
    target: 'svc-workflow',
    method: 'GET',
    path: '/internal/v1/domains',
    query: ['limit', 'beforeCreatedAt', 'beforeId'],
  })
  assert.deepEqual(http('get'), {
    target: 'svc-workflow',
    method: 'GET',
    path: '/internal/v1/domains/{domainId}',
    pathParams: ['domainId'],
  })
  // B4: create body is EXACTLY the current ProvisionDomainRequest contract
  // (domainId = the NEW-RESOURCE id; caller-supplied in V1).
  assert.deepEqual(http('create'), {
    target: 'svc-workflow',
    method: 'POST',
    path: '/internal/v1/domains',
    body: ['domainId', 'domainKey', 'displayName', 'enabled'],
    idempotencyKey: true,
  })
  // DEC-DCP-005: update is displayName-only in V1.
  assert.deepEqual(http('update'), {
    target: 'svc-workflow',
    method: 'PATCH',
    path: '/internal/v1/domains/{domainId}',
    pathParams: ['domainId'],
    body: ['displayName'],
    idempotencyKey: true,
  })
  assert.deepEqual(http('get_owner'), {
    target: 'svc-workflow',
    method: 'GET',
    path: '/internal/v1/domains/{domainId}/owner',
    pathParams: ['domainId'],
  })
  assert.deepEqual(http('set_owner'), {
    target: 'svc-workflow',
    method: 'PUT',
    path: '/internal/v1/domains/{domainId}/owner',
    pathParams: ['domainId'],
    body: ['newOwnerPrincipalId'],
    idempotencyKey: true,
  })
})

test('workflow_domain_admin list: keyset cursor forwards as camelCase query pairs', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/internal/v1/domains') {
      return json(res, 200, {
        items: [
          {
            domain_id: 'd1',
            domain_key: 'hr-onboarding',
            display_name: 'HR Onboarding',
            enabled: true,
            created_at: '2026-09-09T10:00:00Z',
            updated_at: '2026-09-09T10:00:00Z',
          },
        ],
        nextBeforeCreatedAt: null,
        nextBeforeId: null,
      })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(adminManifest(), transport)

  const res = await definition.execute({
    operation: 'list',
    limit: 20,
    beforeCreatedAt: '2026-09-09T10:00:00Z',
    beforeId: 'd0',
  })
  assert.equal(res.ok, true)
  assert.equal(res.result.items[0].domain_key, 'hr-onboarding')

  const bizReq = workflow.requests[0]
  assert.equal(bizReq.method, 'GET')
  assert.equal(bizReq.rawBody, '')
  assert.deepEqual(bizReq.query, {
    limit: '20',
    beforeCreatedAt: '2026-09-09T10:00:00Z',
    beforeId: 'd0',
  })

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_admin create/update/set_owner: exact body forwarding with trusted IK; fail-closed codes preserved', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/internal/v1/domains') {
      return json(res, 200, { domainId: 'd-new', domainKey: 'dogfood-a', enabled: true })
    }
    if (entry.method === 'PATCH' && entry.pathname === '/internal/v1/domains/d-new') {
      return json(res, 200, { domainId: 'd-new', domainKey: 'dogfood-a', displayName: 'Renamed', enabled: true })
    }
    if (entry.method === 'PUT' && entry.pathname === '/internal/v1/domains/d-new/owner') {
      return json(res, 403, { error: { code: 'global_coordinator_required', message: 'caller must hold the GLOBAL_WORKFLOW_COORDINATOR role' } })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(adminManifest(), transport)

  const created = await definition.execute({
    operation: 'create',
    domainId: 'd-new',
    domainKey: 'dogfood-a',
    displayName: 'Dogfood A',
    enabled: true,
  })
  assert.equal(created.ok, true)
  const createReq = workflow.requests[0]
  assert.equal(createReq.method, 'POST')
  assert.deepEqual(createReq.body, {
    domainId: 'd-new',
    domainKey: 'dogfood-a',
    displayName: 'Dogfood A',
    enabled: true,
  })
  assert.ok(createReq.headers['idempotency-key'])

  const updated = await definition.execute({
    operation: 'update',
    domainId: 'd-new',
    displayName: 'Renamed',
  })
  assert.equal(updated.ok, true)
  const patchReq = workflow.requests[1]
  assert.equal(patchReq.method, 'PATCH')
  assert.deepEqual(patchReq.body, { displayName: 'Renamed' })

  // Authorization failures are forwarded verbatim (no swallowing).
  const denied = await definition.execute({
    operation: 'set_owner',
    domainId: 'd-new',
    newOwnerPrincipalId: 'p-1',
  })
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'global_coordinator_required')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_admin get_owner: domain_owner_missing forwarded as the frozen 404 code', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.pathname === '/internal/v1/domains/d-empty/owner') {
      return json(res, 404, { error: { code: 'domain_owner_missing', message: 'no enabled owner' } })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(adminManifest(), transport)

  const res = await definition.execute({ operation: 'get_owner', domainId: 'd-empty' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'domain_owner_missing')

  await tokenServer.close()
  await workflow.close()
})
