import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { validateManifest } from '../../src/schema.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── workflow_domain_members (AGENT_CORE_WORKFLOW_COORDINATOR_CONTROL_PLANE_BROKER_V1, CTR-DCP-002) ─

const membersManifest = () => workflowManifests.find((m) => m.id === 'workflow_domain_members')

test('workflow_domain_members: manifest validates; three operations; add is PUT, remove is DELETE, both with trusted IK', () => {
  const manifest = membersManifest()
  assert.equal(validateManifest(manifest).ok, true)
  assert.deepEqual(manifest.requiredScopes, ['workflow.read', 'workflow.execute'])
  assert.deepEqual(
    manifest.operations.map((op) => op.name),
    ['list', 'add', 'remove'],
  )

  const http = (name) => manifest.operations.find((op) => op.name === name).http
  assert.deepEqual(http('list'), {
    target: 'svc-workflow',
    method: 'GET',
    path: '/internal/v1/domains/{domainId}/members',
    pathParams: ['domainId'],
    query: ['limit', 'beforeCreatedAt', 'beforeId'],
  })
  // B1/B3: add = PUT (per frozen svc route), remove = DELETE; both idempotent.
  assert.deepEqual(http('add'), {
    target: 'svc-workflow',
    method: 'PUT',
    path: '/internal/v1/domains/{domainId}/members/{principalId}',
    pathParams: ['domainId', 'principalId'],
    idempotencyKey: true,
  })
  assert.deepEqual(http('remove'), {
    target: 'svc-workflow',
    method: 'DELETE',
    path: '/internal/v1/domains/{domainId}/members/{principalId}',
    pathParams: ['domainId', 'principalId'],
    idempotencyKey: true,
  })

  // The declarer table carries the full svc DomainMembershipError family
  // including member_not_found (B3).
  const codes = new Set(manifest.errors.map((e) => e.code))
  for (const code of [
    'domain_not_found',
    'principal_not_registered',
    'principal_projection_conflict',
    'member_not_found',
    'principal_is_owner',
    'not_domain_owner',
    'direct_token_required',
    'global_coordinator_required',
    'idempotency_conflict',
    'command_still_processing',
    'invalid_cursor',
  ]) {
    assert.ok(codes.has(code), `declarer table must contain ${code}`)
  }
})

test('workflow_domain_members add: outcome contract forwarded verbatim (added | already_member); transport replay never synthesized', async () => {
  const tokenServer = await startTokenServer()
  let addCalls = 0
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'PUT' && entry.pathname === '/internal/v1/domains/d-1/members/p-new') {
      addCalls += 1
      // Server-side three-state contract (svc CTR-CP-006): a NEW key against
      // an existing enabled member answers already_member with no mutation.
      return json(res, 200, {
        domainId: 'd-1',
        principalId: 'p-new',
        role: 'DOMAIN_MEMBER',
        outcome: addCalls === 1 ? 'added' : 'already_member',
      })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(membersManifest(), transport)

  const first = await definition.execute({ operation: 'add', domainId: 'd-1', principalId: 'p-new' })
  assert.equal(first.ok, true)
  assert.equal(first.result.outcome, 'added')

  // A second call is a NEW logical request (fresh trusted IK) — the server
  // answers already_member and the broker forwards it VERBATIM.
  const duplicate = await definition.execute({ operation: 'add', domainId: 'd-1', principalId: 'p-new' })
  assert.equal(duplicate.ok, true)
  assert.equal(duplicate.result.outcome, 'already_member')

  assert.equal(workflow.requests.length, 2)
  for (const request of workflow.requests) {
    assert.equal(request.method, 'PUT')
    assert.equal(request.pathname, '/internal/v1/domains/d-1/members/p-new')
    assert.ok(request.headers['idempotency-key'])
  }
  const keys = new Set(workflow.requests.map((r) => r.headers['idempotency-key']))
  assert.equal(keys.size, 2, 'fresh trusted IK per logical call')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_members remove: success body and member_not_found fail-closed code preserved', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'DELETE' && entry.pathname === '/internal/v1/domains/d-1/members/p-gone') {
      return json(res, 200, { domainId: 'd-1', principalId: 'p-gone', role: 'DOMAIN_MEMBER', enabled: false })
    }
    if (entry.method === 'DELETE' && entry.pathname === '/internal/v1/domains/d-1/members/p-never') {
      return json(res, 404, { error: { code: 'member_not_found', message: 'member binding not found' } })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(membersManifest(), transport)

  const removed = await definition.execute({ operation: 'remove', domainId: 'd-1', principalId: 'p-gone' })
  assert.equal(removed.ok, true)
  assert.equal(removed.result.enabled, false)

  const missing = await definition.execute({ operation: 'remove', domainId: 'd-1', principalId: 'p-never' })
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'member_not_found')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_members list: keyset query forwarding and not_domain_owner passthrough', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/internal/v1/domains/d-1/members') {
      if (entry.query.limit === '1') {
        return json(res, 200, { items: [{ principal_id: 'p-1', principal_type: 'AGENT', display_name: 'A', role: 'DOMAIN_MEMBER', binding_created_at: '2026-09-09T10:00:00Z' }] })
      }
      return json(res, 403, { error: { code: 'not_domain_owner', message: 'caller is not a domain owner' } })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(membersManifest(), transport)

  const ok = await definition.execute({ operation: 'list', domainId: 'd-1', limit: 1 })
  assert.equal(ok.ok, true)
  assert.equal(ok.result.items[0].principal_id, 'p-1')

  const denied = await definition.execute({ operation: 'list', domainId: 'd-1', limit: 20 })
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'not_domain_owner')

  await tokenServer.close()
  await workflow.close()
})
