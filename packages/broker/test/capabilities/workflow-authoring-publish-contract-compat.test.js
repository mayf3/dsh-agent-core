import test from 'node:test'
import assert from 'node:assert/strict'

import { workflowDefinitionAuthoringManifest as manifest } from '../../src/capabilities/workflow-definition-authoring.js'
import { buildToolDefinition } from '../../src/registry.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

test('model-facing authoring contract exposes contextSchema and tells publish callers not to guess revisions', () => {
  const { definition } = buildToolDefinition({ manifest, handlers: {} })
  assert.equal(definition.parameters.contextSchema.type, 'json')
  assert.match(String(definition.parameters.contextSchema.description), /preserve the current schema/i)

  const publish = manifest.operations.find((op) => op.name === 'publish_version')
  assert.deepEqual(publish.arguments.required, ['domainId', 'definitionId', 'versionId'])
  assert.deepEqual(publish.http.body, ['versionId', 'expectedRevision'])
  assert.match(publish.description, /definition digest/i)
  assert.match(publish.description, /not a version number or revision counter/i)
  assert.match(publish.description, /omit/i)
  assert.match(publish.arguments.properties.expectedRevision.description, /not a numeric revision\/version counter/i)
  assert.match(publish.arguments.properties.expectedRevision.description, /never guess/i)
})

test('replace forwards contextSchema and normal publish omits expectedRevision entirely', async t => {
  const token = await startTokenServer()
  const svc = await startMockServer((_req, res, entry) => {
    if (entry.pathname.endsWith('/draft')) return json(res, 200, { status: 'ok' })
    return json(res, 200, { definitionVersionId: 'ver-compat', versionStatus: 'PUBLISHED', digest: 'sha256:published' })
  })
  t.after(async () => { await token.close(); await svc.close() })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'client', clientSecret: 'secret' }) },
    targets: mockTargets({ 'svc-workflow': svc.origin }),
    authServiceOrigin: token.origin,
  })
  const { definition } = wire(manifest, transport)
  const contextSchema = {
    type: 'object',
    properties: { reviewerPrincipalId: { type: 'string' } },
    required: ['reviewerPrincipalId'],
  }
  const nodes = [
    { node_key: 'review', display_name: 'Review', order_index: 0, node_type: 'TASK', assignee_ref_type: 'INSTANCE_INPUT_PRINCIPAL', assignee_input_key: 'reviewerPrincipalId' },
    { node_key: 'done', display_name: 'Done', order_index: 1, node_type: 'TERMINAL' },
  ]
  const transitions = [
    { transition_key: 'finish', display_name: 'Finish', source_node_key: 'review', target_node_key: 'done', transition_effect: 'ADVANCE' },
  ]

  const replaced = await definition.execute({
    operation: 'replace_draft_graph',
    domainId: 'dom-compat',
    definitionId: 'def-compat',
    definitionVersionId: 'ver-compat',
    contextSchema,
    nodes,
    transitions,
  })
  assert.equal(replaced.ok, true)

  const published = await definition.execute({
    operation: 'publish_version',
    domainId: 'dom-compat',
    definitionId: 'def-compat',
    versionId: 'ver-compat',
  })
  assert.equal(published.ok, true)

  assert.equal(svc.requests.length, 2)
  assert.deepEqual(svc.requests[0].body, {
    definitionVersionId: 'ver-compat',
    contextSchema,
    nodes,
    transitions,
  })
  assert.deepEqual(svc.requests[1].body, { versionId: 'ver-compat' })
})

test('publish graph-validation 422 stays graph_validation_failed with actionable detail', async t => {
  const token = await startTokenServer()
  const svc = await startMockServer((_req, res) => {
    res.setHeader('x-request-id', 'req-publish-contract')
    json(res, 422, { error: {
      code: 'graph_validation_failed',
      message: 'graph validation failed (rule: context schema required): provide the schema required by the graph before publish',
    } })
  })
  t.after(async () => { await token.close(); await svc.close() })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'client', clientSecret: 'secret' }) },
    targets: mockTargets({ 'svc-workflow': svc.origin }),
    authServiceOrigin: token.origin,
  })
  const { definition } = wire(manifest, transport)
  const result = await definition.execute({
    operation: 'publish_version',
    domainId: 'dom-compat',
    definitionId: 'def-compat',
    versionId: 'ver-compat',
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'graph_validation_failed')
  assert.equal(result.error.status, 422)
  assert.equal(result.error.requestId, 'req-publish-contract')
  assert.match(result.error.detail, /context schema required/i)
  assert.notEqual(result.error.code, 'invalid_arguments')
})
