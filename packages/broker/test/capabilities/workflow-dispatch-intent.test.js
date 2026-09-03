// ============================================================================
// workflow_dispatch_intents + workflow_wake_dispatch_intent
// (AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1 — ACC-DIB-001..003)
//
// The manifests are pure passthrough of the accepted svc-workflow
// VISIT_ACTIVATION_IMPL_V1 surface (svc main 22e862a):
//   GET  /internal/v1/dispatch-intents                       (workflow.read)
//   POST /internal/v1/workflow-instances/{id}/node-visits/{visitId}/wake
//                                                            (workflow.execute)
// Authorization is SERVER-SIDE (GLOBAL_SCHEDULER_READ, fail-closed); the
// broker never replicates, relaxes, or re-interprets it. No existing
// workflow manifest is touched (Owner ruling KEEP_ACCEPTED_V6 fences).
// ============================================================================

import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { validateManifest } from '../../src/schema.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

const findDue = () => workflowManifests.find((m) => m.id === 'workflow_dispatch_intents')
const findWake = () => workflowManifests.find((m) => m.id === 'workflow_wake_dispatch_intent')

const intent = (n) => ({
  dispatchIntentId: `1a2b3c4d-0000-4000-8000-00000000000${n}`,
  nodeVisitId: `2b3c4d5e-0000-4000-8000-00000000000${n}`,
  workflowInstanceId: `3c4d5e6f-0000-4000-8000-00000000000${n}`,
  ownerPrincipalId: `4d5e6f70-0000-4000-8000-00000000000${n}`,
  nextEligibleAt: '2026-09-02T10:00:00Z',
  createdAt: '2026-09-02T09:00:00Z',
  updatedAt: '2026-09-02T09:30:00Z',
})

// ── ACC-DIB-001: due poll read ──────────────────────────────────────────────

test('workflow_dispatch_intents: GET passthrough, limit forwarded, workflow.read scope', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/internal/v1/dispatch-intents') {
      return json(res, 200, { items: [intent(1), intent(2)] })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findDue(), transport)

  const res = await definition.execute({ operation: 'list', limit: 100 })
  assert.equal(res.ok, true)
  // Exact 7-field minimum projection passes through verbatim (camelCase).
  assert.deepEqual(Object.keys(res.result.items[0]).sort(), [
    'createdAt',
    'dispatchIntentId',
    'nextEligibleAt',
    'nodeVisitId',
    'ownerPrincipalId',
    'updatedAt',
    'workflowInstanceId',
  ])
  assert.equal(res.result.items[1].dispatchIntentId, '1a2b3c4d-0000-4000-8000-000000000002')

  assert.equal(tokenServer.requests[0].body.resource, 'svc-workflow')
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.read')
  const bizReq = workflow.requests[0]
  assert.equal(bizReq.method, 'GET')
  assert.equal(bizReq.rawBody, '')
  assert.deepEqual(bizReq.query, { limit: '100' })

  await tokenServer.close()
  await workflow.close()
})

test('workflow_dispatch_intents: 403 scheduler_read_role_required preserved fail-closed (incl. Reader holders)', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => {
    res.setHeader('x-request-id', 'req-dib-403-1')
    json(res, 403, { error: { code: 'scheduler_read_role_required', message: 'caller must hold the GLOBAL_SCHEDULER_READ role' } })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findDue(), transport)

  const res = await definition.execute({ operation: 'list' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'scheduler_read_role_required')
  assert.equal(res.error.status, 403)
  assert.equal(res.error.requestId, 'req-dib-403-1')
  assert.equal(res.error.detail, 'caller must hold the GLOBAL_SCHEDULER_READ role')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_dispatch_intents: limit out of 1-100 fails fast locally — token/HTTP count = 0', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 200, { items: [] }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findDue(), transport)

  for (const limit of [0, 101, -1]) {
    const res = await definition.execute({ operation: 'list', limit })
    assert.equal(res.ok, false)
    assert.equal(res.error.code, 'invalid_pagination')
  }
  assert.equal(tokenServer.requests.length, 0)
  assert.equal(workflow.requests.length, 0)

  await tokenServer.close()
  await workflow.close()
})

// ── ACC-DIB-002: wake write ─────────────────────────────────────────────────

const INSTANCE = '9c7f3b0a-0000-4000-8000-0000000000aa'
const VISIT = '2b3c4d5e-0000-4000-8000-0000000000bb'

test('workflow_wake_dispatch_intent: POST path params + body, trusted Idempotency-Key, workflow.execute scope', async () => {
  const tokenServer = await startTokenServer()
  const keys = []
  const workflow = await startMockServer((req, res, entry) => {
    if (
      entry.method === 'POST' &&
      entry.pathname ===
        `/internal/v1/workflow-instances/${INSTANCE}/node-visits/${VISIT}/wake`
    ) {
      keys.push(entry.headers['idempotency-key'])
      return json(res, 200, {
        wakeApplied: true,
        workflowInstanceId: INSTANCE,
        nodeVisitId: VISIT,
        workflowStateVersion: 4,
        eventSequence: 4,
        nextEligibleAt: '2026-09-02T10:00:00.123456Z',
      })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findWake(), transport)

  const res = await definition.execute({
    operation: 'wake',
    workflowInstanceId: INSTANCE,
    nodeVisitId: VISIT,
    expectedWorkflowStateVersion: 3,
    cause: 'manual nudge',
  })
  assert.equal(res.ok, true)
  assert.equal(res.result.wakeApplied, true)
  assert.equal(res.result.workflowStateVersion, 4)

  assert.equal(tokenServer.requests[0].body.resource, 'svc-workflow')
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.execute')
  const bizReq = workflow.requests[0]
  assert.equal(bizReq.method, 'POST')
  const body = JSON.parse(bizReq.rawBody)
  // Model-facing args exactly: expectedWorkflowStateVersion + cause.
  assert.deepEqual(body, {
    expectedWorkflowStateVersion: 3,
    cause: 'manual nudge',
  })
  // Trusted seam: fresh non-empty Idempotency-Key per call.
  assert.equal(typeof keys[0], 'string')
  assert.ok(keys[0].length > 0)

  await tokenServer.close()
  await workflow.close()
})

test('workflow_wake_dispatch_intent: identity fields are never model-facing (trusted seam discipline)', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.pathname === `/internal/v1/workflow-instances/${INSTANCE}/node-visits/${VISIT}/wake`) {
      return json(res, 200, { wakeApplied: false, reason: 'ALREADY_DUE', workflowInstanceId: INSTANCE, nodeVisitId: VISIT })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findWake(), transport)

  const res = await definition.execute({
    operation: 'wake',
    workflowInstanceId: INSTANCE,
    nodeVisitId: VISIT,
    expectedWorkflowStateVersion: 3,
    // Model-supplied identity fields must be ignored and absent from the wire.
    principalId: '11111111-2222-4333-8444-555555555555',
    agentId: 'agt_sneaky',
    actor: 'agt_sneaky',
    assigneePrincipalId: '11111111-2222-4333-8444-555555555556',
    idempotencyKey: 'model-forged-key',
  })
  assert.equal(res.ok, true)
  assert.equal(res.result.wakeApplied, false)
  const body = JSON.parse(workflow.requests[0].rawBody)
  assert.equal('principalId' in body, false)
  assert.equal('agentId' in body, false)
  assert.equal('actor' in body, false)
  assert.equal('assigneePrincipalId' in body, false)
  assert.equal('idempotencyKey' in body, false)

  await tokenServer.close()
  await workflow.close()
})

test('workflow_wake_dispatch_intent: durable no-op (wakeApplied=false) is a 200 success with reason', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => {
    res.setHeader('x-request-id', 'req-dib-noop-1')
    json(res, 200, {
      wakeApplied: false,
      reason: 'VERSION_MISMATCH',
      workflowInstanceId: INSTANCE,
      nodeVisitId: VISIT,
    })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findWake(), transport)

  const res = await definition.execute({
    operation: 'wake',
    workflowInstanceId: INSTANCE,
    nodeVisitId: VISIT,
    expectedWorkflowStateVersion: 999,
  })
  assert.equal(res.ok, true, 'durable no-op must surface as success')
  assert.equal(res.result.wakeApplied, false)
  assert.equal(res.result.reason, 'VERSION_MISMATCH')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_wake_dispatch_intent: declared downstream errors preserved verbatim', async () => {
  const tokenServer = await startTokenServer()
  const cases = [
    [404, 'dispatch_intent_not_found', 'no DISPATCH_INTENT activation for the given instance and node visit'],
    [403, 'scheduler_read_role_required', 'caller must hold the GLOBAL_SCHEDULER_READ role'],
    [422, 'invalid_cause', 'wake cause is invalid'],
    [409, 'idempotency_conflict', 'idempotency key was reused'],
    [425, 'command_still_processing', 'command is still processing'],
  ]
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.pathname === `/internal/v1/workflow-instances/${INSTANCE}/node-visits/${VISIT}/wake`) {
      const [status, code, message] = cases[(workflow.requests.length - 1) % cases.length]
      res.setHeader('x-request-id', `req-dib-${status}`)
      return json(res, status, { error: { code, message } })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findWake(), transport)

  for (const [status, code, message] of cases) {
    const res = await definition.execute({
      operation: 'wake',
      workflowInstanceId: INSTANCE,
      nodeVisitId: VISIT,
      expectedWorkflowStateVersion: 1,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error.code, code, `status ${status}`)
    assert.equal(res.error.status, status)
    assert.equal(res.error.detail, message)
  }

  await tokenServer.close()
  await workflow.close()
})

// ── ACC-DIB-003: registration + inventory ───────────────────────────────────

test('workflow_dispatch_intents + workflow_wake_dispatch_intent: manifest validation and single registration', () => {
  for (const manifest of [findDue(), findWake()]) {
    assert.ok(manifest, 'manifest must exist')
    const validated = validateManifest(manifest)
    assert.equal(validated.ok, true, `manifest ${manifest.id} must validate`)
  }
  const ids = workflowManifests.map((m) => m.id)
  assert.equal(ids.filter((id) => id === 'workflow_dispatch_intents').length, 1)
  assert.equal(ids.filter((id) => id === 'workflow_wake_dispatch_intent').length, 1)
  // Owner-rule fences: the compat read surfaces are untouched and remain the
  // ONLY global/domain instance enumerations.
  assert.equal(ids.filter((id) => id === 'workflow_global_instances').length, 1)
  assert.equal(ids.filter((id) => id === 'workflow_domain_instances').length, 1)
  assert.equal(ids.includes('workflow_transition'), false)
})
