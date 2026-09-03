import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { buildToolDefinition } from '../../src/registry.js'
import { validateManifest } from '../../src/schema.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

const manifest = () => workflowManifests.find((item) => item.id === 'workflow_definition_authoring')

test('manifest freezes one authoring tool, four exact operations, and current bindings', () => {
  const value = manifest()
  assert.equal(validateManifest(value).ok, true)
  assert.equal(value.toolName, 'workflow_definition_authoring')
  assert.deepEqual(value.requiredScopes, ['workflow.execute'])
  assert.deepEqual(value.operations.map((op) => op.name), [
    'create_definition', 'create_draft_version', 'replace_draft_graph', 'publish_version',
  ])
  assert.deepEqual(value.operations.map((op) => [op.http.method, op.http.path]), [
    ['POST', '/internal/v1/domains/{domainId}/definitions'],
    ['POST', '/internal/v1/domains/{domainId}/definitions/{definitionId}/versions'],
    ['PUT', '/internal/v1/domains/{domainId}/definitions/{definitionId}/draft'],
    ['POST', '/internal/v1/domains/{domainId}/definitions/{definitionId}/publish'],
  ])
  assert.ok(value.operations.every((op) => op.http.idempotencyKey === true))
  assert.ok(value.operations.every((op) => op.arguments.additionalProperties === false))
})

test('generated catalog preserves closed mixed-case graph item schemas', () => {
  const { definition } = buildToolDefinition({ manifest: manifest(), handlers: {} })
  assert.deepEqual(definition.parameters.operation.enum, [
    'create_definition', 'create_draft_version', 'replace_draft_graph', 'publish_version',
  ])
  const nodes = definition.parameters.nodes
  assert.equal(nodes.type, 'array')
  assert.equal(nodes.items.additionalProperties, false)
  assert.deepEqual(Object.keys(nodes.items.properties), [
    'node_key', 'display_name', 'order_index', 'node_type', 'assignee_ref_type',
    'fixed_principal_id', 'assignee_input_key', 'instructions',
    'primary_advance_transition_key', 'metadata',
  ])
  assert.deepEqual(nodes.items.properties.node_type.enum, ['DRAFT', 'NORMAL', 'TASK', 'TERMINAL'])
  const transitions = definition.parameters.transitions
  assert.equal(transitions.items.additionalProperties, false)
  assert.deepEqual(Object.keys(transitions.items.properties), [
    'transition_key', 'display_name', 'source_node_key', 'target_node_key',
    'transition_effect', 'submission_schema', 'metadata',
  ])
})

test('all four operations bind exact path/body and trusted identity/key seams', async () => {
  const token = await startTokenServer()
  const svc = await startMockServer((req, res, entry) => {
    if (entry.pathname.endsWith('/definitions')) return json(res, 201, { workflowDefinitionId: 'def-1' })
    if (entry.pathname.endsWith('/versions')) return json(res, 201, { definitionVersionId: 'ver-1', versionStatus: 'DRAFT' })
    if (entry.pathname.endsWith('/draft')) return json(res, 200, { status: 'ok' })
    return json(res, 200, { definitionVersionId: 'ver-1', versionStatus: 'PUBLISHED', digest: 'sha256:x' })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'client', clientSecret: 'secret' }) },
    targets: mockTargets({ 'svc-workflow': svc.origin }), authServiceOrigin: token.origin,
  })
  const { definition } = wire(manifest(), transport)
  const graph = {
    nodes: [
      { node_key: 'start', display_name: 'Start', order_index: 0, node_type: 'NORMAL', assignee_ref_type: 'WORKFLOW_CREATOR' },
      { node_key: 'done', display_name: 'Done', order_index: 1, node_type: 'TERMINAL' },
    ],
    transitions: [{ transition_key: 'finish', display_name: 'Finish', source_node_key: 'start', target_node_key: 'done', transition_effect: 'ADVANCE' }],
  }
  assert.equal((await definition.execute({ operation: 'create_definition', domainId: 'dom-1', definitionKey: 'demo', displayName: 'Demo', actor: 'mallory', idempotencyKey: 'forged' })).ok, false)
  assert.equal(svc.requests.length, 0)
  assert.equal((await definition.execute({ operation: 'create_definition', domainId: 'dom-1', definitionKey: 'demo', displayName: 'Demo' })).ok, true)
  assert.equal((await definition.execute({ operation: 'create_draft_version', domainId: 'dom-1', definitionId: 'def-1', semanticModelVersion: 2 })).ok, true)
  assert.equal((await definition.execute({ operation: 'replace_draft_graph', domainId: 'dom-1', definitionId: 'def-1', definitionVersionId: 'ver-1', ...graph })).ok, true)
  assert.equal((await definition.execute({ operation: 'publish_version', domainId: 'dom-1', definitionId: 'def-1', versionId: 'ver-1' })).ok, true)
  assert.deepEqual(svc.requests.map((r) => [r.method, r.pathname]), [
    ['POST', '/internal/v1/domains/dom-1/definitions'],
    ['POST', '/internal/v1/domains/dom-1/definitions/def-1/versions'],
    ['PUT', '/internal/v1/domains/dom-1/definitions/def-1/draft'],
    ['POST', '/internal/v1/domains/dom-1/definitions/def-1/publish'],
  ])
  assert.deepEqual(svc.requests[2].body.nodes, graph.nodes)
  assert.deepEqual(svc.requests[2].body.transitions, graph.transitions)
  assert.equal(svc.requests[3].body.expectedRevision, undefined)
  assert.ok(svc.requests.every((r) => /^ik-workflow-definition-authoring-/.test(r.headers['idempotency-key'])))
  assert.equal(new Set(svc.requests.map((r) => r.headers['idempotency-key'])).size, 4)
  assert.ok(svc.requests.every((r) => !JSON.stringify(r.body).includes('mallory')))
  assert.ok(token.requests.every((r) => r.body.scope === 'workflow.execute'))
  await token.close(); await svc.close()
})

test('current endpoint errors preserve exact status/code and sanitized envelope', async () => {
  const token = await startTokenServer()
  const responses = [
    [404, 'definition_not_found'], [500, 'internal_consistency_error'],
    [503, 'service_unavailable'], [409, 'revision_conflict'],
  ]
  const svc = await startMockServer((_req, res) => {
    const [status, code] = responses.shift()
    res.writeHead(status, { 'content-type': 'application/json', 'x-request-id': `req-${status}` })
    res.end(JSON.stringify({ error: { code, message: `safe-${code}` } }))
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'client', clientSecret: 'secret' }) },
    targets: mockTargets({ 'svc-workflow': svc.origin }), authServiceOrigin: token.origin,
  })
  const { definition } = wire(manifest(), transport)
  const calls = [
    { operation: 'replace_draft_graph', domainId: 'd', definitionId: 'x', definitionVersionId: 'v', nodes: [], transitions: [] },
    { operation: 'replace_draft_graph', domainId: 'd', definitionId: 'x', definitionVersionId: 'v', nodes: [], transitions: [] },
    { operation: 'replace_draft_graph', domainId: 'd', definitionId: 'x', definitionVersionId: 'v', nodes: [], transitions: [] },
    { operation: 'publish_version', domainId: 'd', definitionId: 'x', versionId: 'v', expectedRevision: 'stale' },
  ]
  for (const [index, call] of calls.entries()) {
    const result = await definition.execute(call)
    assert.equal(result.error.code, [[404, 'definition_not_found'], [500, 'internal_consistency_error'], [503, 'service_unavailable'], [409, 'revision_conflict']][index][1])
    assert.equal(result.error.status, [404, 500, 503, 409][index])
    assert.equal(result.error.requestId, `req-${[404, 500, 503, 409][index]}`)
  }
  await token.close(); await svc.close()
})

test('disposable local chain publishes a version then workflow_execute creates from that exact version', async () => {
  const token = await startTokenServer()
  let published = false
  const svc = await startMockServer((req, res, entry) => {
    if (entry.pathname.endsWith('/definitions')) return json(res, 201, { workflowDefinitionId: 'def-e2e' })
    if (entry.pathname.endsWith('/versions')) return json(res, 201, { definitionVersionId: 'ver-e2e' })
    if (entry.pathname.endsWith('/draft')) return json(res, 200, { status: 'ok' })
    if (entry.pathname.endsWith('/publish')) { published = true; return json(res, 200, { definitionVersionId: 'ver-e2e', versionStatus: 'PUBLISHED' }) }
    assert.equal(entry.body.definitionVersionId, 'ver-e2e'); assert.equal(published, true)
    return json(res, 201, { workflowInstanceId: 'instance-e2e', definitionVersionId: 'ver-e2e', workflowStateVersion: 1 })
  })
  const transport = createHttpTransport({ credentialProvider: { getCredential: async () => ({ clientId: 'c', clientSecret: 's' }) }, targets: mockTargets({ 'svc-workflow': svc.origin }), authServiceOrigin: token.origin })
  const author = wire(manifest(), transport).definition
  const execute = wire(workflowManifests.find((m) => m.id === 'workflow_execute'), transport).definition
  await author.execute({ operation: 'create_definition', domainId: 'd', definitionKey: 'e2e', displayName: 'E2E' })
  await author.execute({ operation: 'create_draft_version', domainId: 'd', definitionId: 'def-e2e', semanticModelVersion: 2 })
  await author.execute({ operation: 'replace_draft_graph', domainId: 'd', definitionId: 'def-e2e', definitionVersionId: 'ver-e2e', nodes: [], transitions: [] })
  await author.execute({ operation: 'publish_version', domainId: 'd', definitionId: 'def-e2e', versionId: 'ver-e2e' })
  const created = await execute.execute({ operation: 'create_instance', domainId: 'd', definitionVersionId: 'ver-e2e', contextPayload: {}, metadata: null })
  assert.equal(created.result.definitionVersionId, 'ver-e2e')
  assert.deepEqual(svc.requests.map((r) => r.pathname), [
    '/internal/v1/domains/d/definitions', '/internal/v1/domains/d/definitions/def-e2e/versions',
    '/internal/v1/domains/d/definitions/def-e2e/draft', '/internal/v1/domains/d/definitions/def-e2e/publish',
    '/internal/v1/workflow-instances',
  ])
  await token.close(); await svc.close()
})
