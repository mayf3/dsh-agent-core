import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'
import { validateManifest } from '../../src/schema.js'

// AGENT_CORE_WORKFLOW_DOMAIN_MEMBERS_BROKER_V1 — DOMAIN_OWNER member-management
// control plane (operation=list|add|remove). Authorization is SERVER-SIDE
// (svc-workflow enforces DOMAIN_OWNER + per-endpoint scope + direct token);
// these tests freeze the wire shape, the trusted Idempotency-Key seam, the
// declared error preservation, and the identity-neutral argument discipline.

const DOMAIN = '10000000-0000-4000-8000-000000000100'
const TARGET = '25a6789f-daa5-4000-8000-00000000ce01'
const membersManifest = () => workflowManifests.find((m) => m.id === 'workflow_domain_members')

const mkTransport = (tokenServer, workflow) =>
  createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })

test('workflow_domain_members manifest validates and freezes the three-operation binding', () => {
  const manifest = membersManifest()
  assert.equal(validateManifest(manifest).ok, true)
  assert.deepEqual(manifest.requiredScopes, ['workflow.read', 'workflow.execute'])

  const list = manifest.operations.find((o) => o.name === 'list')
  assert.deepEqual(list.http, {
    target: 'svc-workflow',
    method: 'GET',
    path: '/internal/v1/domains/{domainId}/members',
    pathParams: ['domainId'],
    query: ['limit', 'beforeCreatedAt', 'beforeId'],
  })
  const add = manifest.operations.find((o) => o.name === 'add')
  assert.deepEqual(add.http, {
    target: 'svc-workflow',
    method: 'PUT',
    path: '/internal/v1/domains/{domainId}/members/{principalId}',
    pathParams: ['domainId', 'principalId'],
    body: ['role'],
    idempotencyKey: true,
  })
  const remove = manifest.operations.find((o) => o.name === 'remove')
  assert.deepEqual(remove.http, {
    target: 'svc-workflow',
    method: 'DELETE',
    path: '/internal/v1/domains/{domainId}/members/{principalId}',
    pathParams: ['domainId', 'principalId'],
    idempotencyKey: true,
  })
  // No name-based identity surface: the tool never accepts display names.
  assert.deepEqual(Object.keys(add.arguments.properties).sort(), ['domainId', 'principalId', 'role'])
})

test('list: path + camelCase cursor query mapping + union-scope token', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === `/internal/v1/domains/${DOMAIN}/members`) {
      return json(res, 200, {
        items: [
          {
            principalId: TARGET,
            principalType: 'agent',
            displayName: '龙虾合伙人',
            role: 'DOMAIN_MEMBER',
            bindingCreatedAt: '2026-09-09T12:00:00Z',
          },
        ],
        nextCursor: null,
      })
    }
    json(res, 404, { error: 'not_found' })
  })

  const { definition } = wire(membersManifest(), mkTransport(tokenServer, workflow))
  const res = await definition.execute({
    operation: 'list',
    domainId: DOMAIN,
    limit: 50,
    beforeCreatedAt: '2026-09-01T00:00:00Z',
    beforeId: '0f1e2d3c-0000-4000-8000-0000000000c3',
  })
  assert.equal(res.ok, true)
  assert.equal(res.result.items[0].principalId, TARGET)

  assert.equal(tokenServer.requests[0].body.resource, 'svc-workflow')
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.read workflow.execute')
  const bizReq = workflow.requests[0]
  assert.equal(bizReq.pathname, `/internal/v1/domains/${DOMAIN}/members`)
  assert.deepEqual(bizReq.query, {
    limit: '50',
    beforeCreatedAt: '2026-09-01T00:00:00Z',
    beforeId: '0f1e2d3c-0000-4000-8000-0000000000c3',
  })

  await tokenServer.close()
  await workflow.close()
})

test('add: role forwarded in body, trusted Idempotency-Key, identity fields never reach the wire', async () => {
  const tokenServer = await startTokenServer()
  let seenKey = ''
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'PUT' && entry.pathname === `/internal/v1/domains/${DOMAIN}/members/${TARGET}`) {
      seenKey = entry.headers['idempotency-key']
      return json(res, 200, { domainId: DOMAIN, principalId: TARGET, role: 'DOMAIN_MEMBER' })
    }
    json(res, 404, { error: 'not_found' })
  })

  const { definition } = wire(membersManifest(), mkTransport(tokenServer, workflow))
  const res = await definition.execute({
    operation: 'add',
    domainId: DOMAIN,
    principalId: TARGET,
    role: 'DOMAIN_MEMBER',
    // smuggled identity/impersonation fields — MUST NOT reach the wire
    callerPrincipalId: 'aaaa0000-0000-4000-8000-00000000bad0',
    actorId: 'bbbb0000-0000-4000-8000-00000000bad1',
    agentId: 'agt_evil',
    idempotencyKey: 'model-forged-key',
  })
  assert.equal(res.ok, true)
  assert.equal(res.result.role, 'DOMAIN_MEMBER')

  assert.match(seenKey, /^ik-workflow-domain-members-\d+-[a-z0-9]+$/)
  const bizReq = workflow.requests[0]
  assert.deepEqual(bizReq.body, { role: 'DOMAIN_MEMBER' })
  const raw = JSON.stringify(bizReq)
  assert.ok(!raw.includes('callerPrincipalId'))
  assert.ok(!raw.includes('agt_evil'))
  assert.ok(!raw.includes('model-forged-key'))

  await tokenServer.close()
  await workflow.close()
})

test('add: role omitted sends NO body (server default DOMAIN_MEMBER), DELETE carries no body', async () => {
  const tokenServer = await startTokenServer()
  let putHadBody = null
  let deleteHadBody = null
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'PUT' && entry.pathname === `/internal/v1/domains/${DOMAIN}/members/${TARGET}`) {
      putHadBody = entry.body ?? null
      return json(res, 200, { domainId: DOMAIN, principalId: TARGET, role: 'DOMAIN_MEMBER' })
    }
    if (entry.method === 'DELETE' && entry.pathname === `/internal/v1/domains/${DOMAIN}/members/${TARGET}`) {
      deleteHadBody = entry.body ?? null
      return json(res, 200, { domainId: DOMAIN, principalId: TARGET, role: 'DOMAIN_MEMBER', enabled: false })
    }
    json(res, 404, { error: 'not_found' })
  })

  const { definition } = wire(membersManifest(), mkTransport(tokenServer, workflow))
  const addRes = await definition.execute({ operation: 'add', domainId: DOMAIN, principalId: TARGET })
  assert.equal(addRes.ok, true)
  const delRes = await definition.execute({ operation: 'remove', domainId: DOMAIN, principalId: TARGET })
  assert.equal(delRes.ok, true)
  assert.equal(delRes.result.enabled, false)

  // No body was sent for either (server-side default / no body by contract).
  assert.ok(putHadBody === null || putHadBody === '')
  assert.ok(deleteHadBody === null || deleteHadBody === '')

  await tokenServer.close()
  await workflow.close()
})

test('error preservation: already_member / domain_owner_delegation_forbidden / not_domain_owner / member_not_found', async () => {
  const tokenServer = await startTokenServer()
  const dupTarget = '11111111-0000-4000-8000-0000000000d1'
  const delegTarget = '22222222-0000-4000-8000-0000000000d2'
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'PUT' && entry.pathname === `/internal/v1/domains/${DOMAIN}/members/${dupTarget}`) {
      return json(res, 409, { error: { code: 'already_member', message: 'principal already holds an enabled DOMAIN_MEMBER binding for this domain' } })
    }
    if (entry.method === 'PUT' && entry.pathname === `/internal/v1/domains/${DOMAIN}/members/${delegTarget}`) {
      return json(res, 403, { error: { code: 'domain_owner_delegation_forbidden', message: 'a domain owner cannot grant DOMAIN_OWNER' } })
    }
    if (entry.method === 'GET') {
      return json(res, 403, { error: { code: 'not_domain_owner', message: 'caller is not a domain owner' } })
    }
    if (entry.method === 'DELETE') {
      return json(res, 404, { error: { code: 'member_not_found', message: 'member binding not found' } })
    }
    json(res, 404, { error: 'not_found' })
  })

  const { definition } = wire(membersManifest(), mkTransport(tokenServer, workflow))

  const dup = await definition.execute({ operation: 'add', domainId: DOMAIN, principalId: dupTarget })
  assert.equal(dup.ok, false)
  assert.equal(dup.error.code, 'already_member')
  assert.equal(dup.error.status, 409)

  const deleg = await definition.execute({ operation: 'add', domainId: DOMAIN, principalId: delegTarget, role: 'DOMAIN_OWNER' })
  assert.equal(deleg.ok, false)
  assert.equal(deleg.error.code, 'domain_owner_delegation_forbidden')
  assert.equal(deleg.error.status, 403)

  const notOwner = await definition.execute({ operation: 'list', domainId: DOMAIN })
  assert.equal(notOwner.ok, false)
  assert.equal(notOwner.error.code, 'not_domain_owner')
  assert.equal(notOwner.error.status, 403)

  const missing = await definition.execute({ operation: 'remove', domainId: DOMAIN, principalId: TARGET })
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'member_not_found')
  assert.equal(missing.error.status, 404)

  await tokenServer.close()
  await workflow.close()
})

test('local fail-fast: limit out of family bounds and half cursor never reach the wire', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 500, { error: { code: 'internal_consistency_error', message: 'must not be called' } }))

  const { definition } = wire(membersManifest(), mkTransport(tokenServer, workflow))
  for (const limit of [0, -1, 101]) {
    const res = await definition.execute({ operation: 'list', domainId: DOMAIN, limit })
    assert.equal(res.ok, false)
    assert.equal(res.error.code, 'invalid_pagination')
  }
  const halfCursor = await definition.execute({ operation: 'list', domainId: DOMAIN, beforeCreatedAt: '2026-09-01T00:00:00Z' })
  assert.equal(halfCursor.ok, false)
  assert.equal(halfCursor.error.code, 'invalid_cursor')

  assert.equal(workflow.requests.length, 0, 'no HTTP request may leave the broker')
  assert.equal(tokenServer.requests.length, 0, 'no token may be minted for local validation failures')

  await tokenServer.close()
  await workflow.close()
})
