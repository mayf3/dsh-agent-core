import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { validateManifest } from '../../src/schema.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── workflow_domain_binding_reconcile (AGENT_CORE_WORKFLOW_COORDINATOR_CONTROL_PLANE_BROKER_V1, CTR-DCP-003) ─

const reconcileManifest = () => workflowManifests.find((m) => m.id === 'workflow_domain_binding_reconcile')

test('workflow_domain_binding_reconcile: manifest validates; plan is read-only, apply rides the trusted IK seam', () => {
  const manifest = reconcileManifest()
  assert.equal(validateManifest(manifest).ok, true)
  assert.deepEqual(manifest.requiredScopes, ['workflow.read', 'workflow.execute'])
  assert.deepEqual(
    manifest.operations.map((op) => op.name),
    ['plan', 'apply'],
  )

  const plan = manifest.operations.find((op) => op.name === 'plan')
  // DEC-DCP-006: plan is pure read — no Idempotency-Key.
  assert.deepEqual(plan.http, {
    target: 'svc-workflow',
    method: 'POST',
    path: '/internal/v1/domains/{domainId}/binding-reconcile/plan',
    pathParams: ['domainId'],
    body: ['role', 'fromPrincipalId', 'toPrincipalId', 'reason'],
  })
  assert.ok(!plan.http.idempotencyKey)

  const apply = manifest.operations.find((op) => op.name === 'apply')
  assert.deepEqual(apply.http, {
    target: 'svc-workflow',
    method: 'POST',
    path: '/internal/v1/domains/{domainId}/binding-reconcile/apply',
    pathParams: ['domainId'],
    body: ['role', 'fromPrincipalId', 'toPrincipalId', 'reason'],
    idempotencyKey: true,
  })

  // B5: the family declares principal_disabled (TARGET only) and never
  // treats a disabled SOURCE as an error — identity_not_found is for a
  // missing exact UUID.
  const codes = new Set(manifest.errors.map((e) => e.code))
  for (const code of ['identity_not_found', 'principal_disabled', 'binding_conflict', 'invalid_input']) {
    assert.ok(codes.has(code), `declarer table must contain ${code}`)
  }
  for (const op of manifest.operations) {
    assert.ok(op.arguments.properties.role.description.includes('DOMAIN_OWNER | DOMAIN_MEMBER'))
  }
})

test('workflow_domain_binding_reconcile plan: explicit source/target quads and blockers forwarded read-only', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/internal/v1/domains/d-1/binding-reconcile/plan') {
      return json(res, 200, {
        domainId: 'd-1',
        role: 'DOMAIN_MEMBER',
        sourcePrincipalExists: true,
        sourcePrincipalEnabled: false,
        sourceBindingExists: true,
        sourceBindingEnabled: true,
        targetPrincipalExists: true,
        targetPrincipalEnabled: true,
        targetHasEnabledBinding: false,
        singleOwnerInvariantOk: true,
        plan: 'disable the enabled DOMAIN_MEMBER binding of from and establish the enabled DOMAIN_MEMBER binding for to in one transaction',
        blockers: [],
        reason: 'canonical migration',
      })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(reconcileManifest(), transport)

  const res = await definition.execute({
    operation: 'plan',
    domainId: 'd-1',
    role: 'DOMAIN_MEMBER',
    fromPrincipalId: 'p-stale',
    toPrincipalId: 'p-canonical',
    reason: 'canonical migration',
  })
  assert.equal(res.ok, true)
  // A disabled SOURCE principal is presented as data, never a blocker.
  assert.equal(res.result.sourcePrincipalEnabled, false)
  assert.equal(res.result.sourceBindingEnabled, true)
  assert.deepEqual(res.result.blockers, [])

  const bizReq = workflow.requests[0]
  assert.equal(bizReq.method, 'POST')
  assert.equal(bizReq.headers['idempotency-key'], undefined, 'plan carries no idempotency key')
  assert.deepEqual(bizReq.body, {
    role: 'DOMAIN_MEMBER',
    fromPrincipalId: 'p-stale',
    toPrincipalId: 'p-canonical',
    reason: 'canonical migration',
  })

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_binding_reconcile apply: applied outcome and binding_conflict fail-closed code preserved', async () => {
  const tokenServer = await startTokenServer()
  let applyCalls = 0
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/internal/v1/domains/d-1/binding-reconcile/apply') {
      applyCalls += 1
      if (applyCalls === 1) {
        return json(res, 200, {
          domainId: 'd-1',
          role: 'DOMAIN_MEMBER',
          fromPrincipalId: 'p-stale',
          toPrincipalId: 'p-canonical',
          outcome: 'applied',
        })
      }
      return json(res, 409, { error: { code: 'binding_conflict', message: 'preimage no longer matches' } })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(reconcileManifest(), transport)

  const applied = await definition.execute({
    operation: 'apply',
    domainId: 'd-1',
    role: 'DOMAIN_MEMBER',
    fromPrincipalId: 'p-stale',
    toPrincipalId: 'p-canonical',
    reason: 'canonical migration',
  })
  assert.equal(applied.ok, true)
  assert.equal(applied.result.outcome, 'applied')
  assert.ok(workflow.requests[0].headers['idempotency-key'])

  const conflict = await definition.execute({
    operation: 'apply',
    domainId: 'd-1',
    role: 'DOMAIN_MEMBER',
    fromPrincipalId: 'p-stale',
    toPrincipalId: 'p-other',
    reason: 'stale preimage',
  })
  assert.equal(conflict.ok, false)
  assert.equal(conflict.error.code, 'binding_conflict')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_binding_reconcile apply: disabled target is principal_disabled 403; malformed role is invalid_input 422', async () => {
  const tokenServer = await startTokenServer()
  let roleSeen = null
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/internal/v1/domains/d-1/binding-reconcile/apply') {
      roleSeen = entry.rawBody ? JSON.parse(entry.rawBody).role : roleSeen
      if (roleSeen === 'DOMAIN_MEMBER') {
        return json(res, 403, { error: { code: 'principal_disabled', message: 'principal is disabled' } })
      }
      return json(res, 422, { error: { code: 'invalid_input', message: 'role must be DOMAIN_OWNER or DOMAIN_MEMBER' } })
    }
    json(res, 404, { error: { code: 'domain_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(reconcileManifest(), transport)

  const disabledTarget = await definition.execute({
    operation: 'apply',
    domainId: 'd-1',
    role: 'DOMAIN_MEMBER',
    fromPrincipalId: 'p-src',
    toPrincipalId: 'p-disabled',
    reason: 'disabled target',
  })
  assert.equal(disabledTarget.ok, false)
  assert.equal(disabledTarget.error.code, 'principal_disabled')

  const malformed = await definition.execute({
    operation: 'apply',
    domainId: 'd-1',
    role: 'DOMAIN_OVERLORD',
    fromPrincipalId: 'p-src',
    toPrincipalId: 'p-t',
    reason: 'bad role',
  })
  assert.equal(malformed.ok, false)
  assert.equal(malformed.error.code, 'invalid_input')

  await tokenServer.close()
  await workflow.close()
})
