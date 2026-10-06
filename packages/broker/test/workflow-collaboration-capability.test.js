// workflow-collaboration-capability.test.js — focused RED-first battery for the
// G7 Workflow collaboration broker capability (Product #480 slice,
// claim g7-workflow-collaboration-r330).
//
// Contract source (frozen, external): svc-workflow proposal
// SVC_WORKFLOW_INSTANCE_COLLABORATION_V1 @183c85c (PR #60, AUTHORITY_GATE=PENDING)
// — CTR-7/8/9/10 surfaces, error catalogue §3. The broker binds those routes as
// thin transport; svc-workflow remains the sole authority for visibility and
// write relations (broker never duplicates permission logic).
//
// Governance: implementation rides the proposed
// AGENT_CORE_WORKFLOW_COLLABORATION_BROKER_V1 (this slice, docs-first commit);
// merge is gated on that Spec's Owner acceptance — merged-main precedent
// 7655a817 (RETURN_POLICY_EXHAUSTED_DECLARER_V1 riding implementation).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validateManifest } from '../src/schema.js'
import {
  workflowCollaborationReadManifest,
  workflowCollaborationAppendManifest,
} from '../src/capabilities/workflow-collaboration.js'
import { DEFAULT_MANIFESTS } from '../src/index.js'
import { assertValidManifest } from '../src/mapping.js'
import { createHttpTransport } from '../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../test-support/capability-fixtures.js'

// ─── Freeze: capability surface (manifest-level, no HTTP) ───────────────────

test('collaboration read/append are split by least-privilege scope (CTR-10)', () => {
  const read = assertValidManifest(workflowCollaborationReadManifest)
  const append = assertValidManifest(workflowCollaborationAppendManifest)

  assert.equal(read.id, 'workflow_collaboration_read')
  assert.equal(read.toolName, 'workflow_collaboration_read')
  assert.equal(append.id, 'workflow_collaboration_append')
  assert.equal(append.toolName, 'workflow_collaboration_append')
  assert.deepEqual(read.requiredScopes, ['workflow.read'])
  assert.deepEqual(append.requiredScopes, ['workflow.execute'])
  assert.deepEqual(read.operations.map((op) => op.name), ['feed'])
  assert.deepEqual(append.operations.map((op) => op.name), ['append_entry'])
})

test('collaboration manifests freeze the proposal CTR-10 routes and wire surfaces', () => {
  const read = assertValidManifest(workflowCollaborationReadManifest)
  const append = assertValidManifest(workflowCollaborationAppendManifest)

  const feed = read.operations[0]
  assert.deepEqual(feed.http, {
    target: 'svc-workflow',
    method: 'GET',
    path: '/internal/v1/workflow-instances/{workflowInstanceId}/collaboration',
    pathParams: ['workflowInstanceId'],
    query: ['limit', 'afterCreatedAt', 'afterItemType', 'afterId'],
  })
  // CTR-9 keyset continuation: the triple is all-or-none, broker fail-closed.
  assert.deepEqual(feed.arguments.allOrNone, [
    { properties: ['afterCreatedAt', 'afterItemType', 'afterId'], validationError: 'invalid_cursor' },
  ])
  assert.deepEqual(feed.arguments.required, ['workflowInstanceId'])
  assert.deepEqual(Object.keys(feed.arguments.properties), [
    'workflowInstanceId',
    'limit',
    'afterCreatedAt',
    'afterItemType',
    'afterId',
  ])
  assert.equal(feed.arguments.properties.limit.minimum, 1)
  assert.equal(feed.arguments.properties.limit.maximum, 100)
  assert.equal(feed.arguments.properties.limit.validationError, 'invalid_pagination')
  assert.equal(feed.http.idempotencyKey, undefined, 'reads carry no Idempotency-Key')

  const appendOp = append.operations[0]
  assert.equal(appendOp.http.method, 'POST')
  assert.equal(appendOp.http.path, '/internal/v1/workflow-instances/{workflowInstanceId}/collaboration/entries')
  assert.equal(appendOp.http.idempotencyKey, true, 'CTR-10: Idempotency-Key required on the append command')
  assert.deepEqual(appendOp.http.body, [
    'body',
    'replyToEntryId',
    'relatedEventId',
    'relatedSubmissionId',
    'relatedAssistanceCaseId',
  ])
  assert.deepEqual(appendOp.arguments.required, ['workflowInstanceId', 'body'])
})

test('collaboration error tables declare the proposal §3 catalogue; declared codes only', () => {
  const read = assertValidManifest(workflowCollaborationReadManifest)
  const append = assertValidManifest(workflowCollaborationAppendManifest)

  const readCodes = new Set(read.errors.map((e) => e.code))
  for (const code of [
    'invalid_arguments',
    'unauthenticated',
    'forbidden',
    'workflow_instance_not_found_or_not_visible',
    'invalid_pagination',
    'invalid_cursor',
    'internal_consistency_error',
    'service_unavailable',
  ]) {
    assert.ok(readCodes.has(code), 'read must declare ' + code)
  }

  const appendCodes = new Set(append.errors.map((e) => e.code))
  for (const code of [
    'workflow_instance_not_found_or_not_visible',
    'principal_disabled',
    'collaboration_write_forbidden',
    'instance_archived',
    'idempotency_conflict',
    'command_still_processing',
    'invalid_input',
    'invalid_collaboration_references',
  ]) {
    assert.ok(appendCodes.has(code), 'append must declare ' + code)
  }

  // CTR-5 authorization evaluation is server-side; the broker must not model
  // any principal/domain/role input and must not declare a broker-authored
  // permission code.
  const appendJson = JSON.stringify(append.operations[0].arguments)
  for (const forbidden of ['principalId', 'domainId', 'author', 'kind', 'observedNodeVisitId', 'observedWorkflowStateVersion']) {
    assert.equal(appendJson.includes(forbidden), false, 'authority/server-authored field must not be model input: ' + forbidden)
  }
})

test('collaboration capabilities are part of the default broker surface exactly once', () => {
  const ids = DEFAULT_MANIFESTS.map((manifest) => manifest.id)
  assert.equal(ids.filter((id) => id === 'workflow_collaboration_read').length, 1)
  assert.equal(ids.filter((id) => id === 'workflow_collaboration_append').length, 1)
})

// ─── Read: real transport against a mock svc-workflow ───────────────────────

const readHarness = async (t, svcHandler) => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer(svcHandler)
  t.after(() => Promise.all([tokenServer.close(), workflow.close()]))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(workflowCollaborationReadManifest, transport)
  return { tokenServer, workflow, definition }
}

test('collaboration feed forwards the frozen query surface and returns the envelope verbatim', async (t) => {
  const envelope = {
    visibility: 'full',
    latestWorkflowStateVersion: 3,
    items: [
      { itemType: 'WORKFLOW_FACT', factType: 'RETURN', itemId: 'ev-1', createdAt: '2026-10-07T00:00:00Z' },
      { itemType: 'COLLABORATION_ENTRY', entryId: 'ce-1', body: '可以，但需要发布日期。' },
    ],
    nextCursor: null,
  }
  const { tokenServer, workflow, definition } = await readHarness(t, (req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/internal/v1/workflow-instances/wf-1/collaboration')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'x-request-id': 'req-feed-1' })
      return res.end(JSON.stringify(envelope))
    }
    json(res, 404, { error: { code: 'not_found', message: 'nope' } })
  })

  const res = await definition.execute({
    operation: 'feed',
    workflowInstanceId: 'wf-1',
    limit: 50,
    afterCreatedAt: '2026-10-06T00:00:00Z',
    afterItemType: 'WORKFLOW_FACT',
    afterId: 'ev-0',
  })
  assert.equal(res.ok, true)
  assert.deepEqual(res.result, envelope)

  const req = workflow.requests[0]
  assert.equal(req.method, 'GET')
  assert.equal(req.pathname, '/internal/v1/workflow-instances/wf-1/collaboration')
  assert.deepEqual(req.query, {
    limit: '50',
    afterCreatedAt: '2026-10-06T00:00:00Z',
    afterItemType: 'WORKFLOW_FACT',
    afterId: 'ev-0',
  })
  assert.equal(req.headers.authorization, 'Bearer tok-real')

  await tokenServer.close()
  await workflow.close()
})

test('collaboration feed: absent cursor and limit are not forwarded (server default 50)', async (t) => {
  const { tokenServer, workflow, definition } = await readHarness(t, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ visibility: 'full', latestWorkflowStateVersion: 1, items: [], nextCursor: null }))
  })

  const res = await definition.execute({ operation: 'feed', workflowInstanceId: 'wf-1' })
  assert.equal(res.ok, true)
  assert.deepEqual(workflow.requests[0].query, {})
  assert.equal(workflow.requests[0].headers['idempotency-key'], undefined)

  await tokenServer.close()
  await workflow.close()
})

test('collaboration feed: half cursor triple and limit bounds fail closed with ZERO downstream requests', async (t) => {
  const { tokenServer, workflow, definition } = await readHarness(t, () => {
    throw new Error('svc must not be reached for locally rejected arguments')
  })

  for (const bad of [
    { operation: 'feed', workflowInstanceId: 'wf-1', afterCreatedAt: '2026-10-06T00:00:00Z' },
    { operation: 'feed', workflowInstanceId: 'wf-1', afterCreatedAt: '2026-10-06T00:00:00Z', afterItemType: 'WORKFLOW_FACT' },
    { operation: 'feed', workflowInstanceId: 'wf-1', afterItemType: 'WORKFLOW_FACT', afterId: 'ev-0' },
    { operation: 'feed', workflowInstanceId: 'wf-1', limit: 0 },
    { operation: 'feed', workflowInstanceId: 'wf-1', limit: 101 },
  ]) {
    const res = await definition.execute(bad)
    assert.equal(res.ok, false)
    assert.ok(
      res.error.code === 'invalid_cursor' || res.error.code === 'invalid_pagination',
      `unexpected local code ${res.error.code}`,
    )
  }
  assert.equal(workflow.requests.length, 0, 'locally rejected arguments must not reach svc-workflow')

  await tokenServer.close()
  await workflow.close()
})

// ─── Append: trusted Idempotency-Key + exact body mapping ───────────────────

const appendHarness = async (t, svcHandler) => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer(svcHandler)
  t.after(() => Promise.all([tokenServer.close(), workflow.close()]))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(workflowCollaborationAppendManifest, transport)
  return { tokenServer, workflow, definition }
}

test('collaboration append sends the trusted Idempotency-Key and the exact optional-reference body', async (t) => {
  const entry = {
    entryId: '0b8f6d5e-0000-4000-8000-000000000001',
    authorPrincipalId: '7c9e6679-0000-4000-8000-000000000002',
    body: '官方博客是否可以？',
    observedNodeVisitId: '2f0c8a1b-0000-4000-8000-000000000003',
    observedWorkflowStateVersion: 2,
    relatedEventId: 'aa000000-0000-4000-8000-000000000004',
    commandId: 'bb000000-0000-4000-8000-000000000005',
    createdAt: '2026-10-07T01:00:00Z',
    replayed: false,
  }
  const { tokenServer, workflow, definition } = await appendHarness(t, (req, res) => {
    if (req.method === 'POST' && req.url.startsWith('/internal/v1/workflow-instances/wf-1/collaboration/entries')) {
      res.writeHead(201, { 'Content-Type': 'application/json', 'x-request-id': 'req-append-1' })
      return res.end(JSON.stringify(entry))
    }
    json(res, 404, { error: { code: 'not_found', message: 'nope' } })
  })

  const res = await definition.execute({
    operation: 'append_entry',
    workflowInstanceId: 'wf-1',
    body: '官方博客是否可以？',
    replyToEntryId: 'cc000000-0000-4000-8000-000000000006',
    relatedEventId: 'aa000000-0000-4000-8000-000000000004',
  })
  assert.equal(res.ok, true)
  assert.deepEqual(res.result, entry)

  const req = workflow.requests[0]
  assert.equal(req.method, 'POST')
  assert.equal(req.pathname, '/internal/v1/workflow-instances/wf-1/collaboration/entries')
  assert.ok(req.headers['idempotency-key'], 'append must carry the trusted Idempotency-Key')
  assert.deepEqual(Object.keys(req.body).sort(), ['body', 'relatedEventId', 'replyToEntryId'])
  assert.equal(req.body.author, undefined, 'author is always token.sub (server-authored)')
  assert.equal(req.body.kind, undefined, 'kind-free model: no client kind field')

  await tokenServer.close()
  await workflow.close()
})

test('collaboration append: absent optional references omit the keys entirely (request-hash identity)', async (t) => {
  const { tokenServer, workflow, definition } = await appendHarness(t, (req, res) => {
    res.writeHead(201, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ entryId: 'e1' }))
  })

  const res = await definition.execute({ operation: 'append_entry', workflowInstanceId: 'wf-1', body: 'plain entry' })
  assert.equal(res.ok, true)
  assert.deepEqual(Object.keys(workflow.requests[0].body), ['body'])

  await tokenServer.close()
  await workflow.close()
})

test('collaboration append: missing required body fails closed locally with ZERO downstream requests', async (t) => {
  const { tokenServer, workflow, definition } = await appendHarness(t, () => {
    throw new Error('svc must not be reached for locally rejected arguments')
  })

  const res = await definition.execute({ operation: 'append_entry', workflowInstanceId: 'wf-1' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'invalid_arguments')
  assert.equal(workflow.requests.length, 0)

  await tokenServer.close()
  await workflow.close()
})

// ─── Error preservation: verbatim passthrough, declared codes only ──────────

test('collaboration append preserves svc error codes verbatim with requestId and no retry', async (t) => {
  const cases = [
    { status: 404, code: 'workflow_instance_not_found_or_not_visible' },
    { status: 403, code: 'principal_disabled' },
    { status: 403, code: 'collaboration_write_forbidden' },
    { status: 409, code: 'instance_archived' },
    { status: 422, code: 'invalid_collaboration_references' },
    { status: 409, code: 'idempotency_conflict' },
    { status: 425, code: 'command_still_processing' },
  ]
  const { tokenServer, workflow, definition } = await appendHarness(t, (req, res) => {
    const c = cases[workflow.requests.length - 1]
    res.writeHead(c.status, { 'Content-Type': 'application/json', 'x-request-id': `req-${c.code}` })
    res.end(JSON.stringify({ error: { code: c.code, message: `svc says ${c.code}` } }))
  })

  for (const c of cases) {
    const res = await definition.execute({ operation: 'append_entry', workflowInstanceId: 'wf-1', body: 'x' })
    assert.equal(res.ok, false, `${c.code} must surface as an error`)
    assert.equal(res.error.code, c.code)
    assert.equal(res.error.status, c.status)
    assert.ok(String(res.error.detail ?? '').length > 0, 'sanitized detail must be present (content may be redacted by the sanitizer)')
    assert.equal(res.error.requestId, `req-${c.code}`)
  }
  assert.equal(workflow.requests.length, cases.length, 'one downstream request per call — no broker retry')
})

test('collaboration feed preserves read-side errors verbatim (404 not-visible family)', async (t) => {
  const { tokenServer, workflow, definition } = await readHarness(t, (req, res) => {
    res.writeHead(404, { 'Content-Type': 'application/json', 'x-request-id': 'req-nv' })
    res.end(JSON.stringify({ error: { code: 'workflow_instance_not_found_or_not_visible', message: 'no visibility' } }))
  })

  const res = await definition.execute({ operation: 'feed', workflowInstanceId: 'wf-secret' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'workflow_instance_not_found_or_not_visible')
  assert.equal(res.error.status, 404)
  assert.equal(res.error.requestId, 'req-nv')
  assert.equal(workflow.requests.length, 1)

  await tokenServer.close()
  await workflow.close()
})

test('undeclared svc code degrades to the declared canonical family (no wildcard declaration)', async (t) => {
  const { tokenServer, workflow, definition } = await appendHarness(t, (req, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json', 'x-request-id': 'req-x' })
    res.end(JSON.stringify({ error: { code: 'some_future_svc_code', message: 'future' } }))
  })

  const res = await definition.execute({ operation: 'append_entry', workflowInstanceId: 'wf-1', body: 'x' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'http_4xx')
  assert.equal(res.error.status, 403)
  assert.equal(res.error.requestId, 'req-x')

  await tokenServer.close()
  await workflow.close()
})
