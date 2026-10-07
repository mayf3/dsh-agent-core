/**
 * AGENT_CORE_WORKFLOW_DEFINITION_VERSION_READ_V1 (candidate, issue #555) —
 * (flat test dir: packages/broker/test/capabilities sat at its 20-children
 * structure ceiling — CODE_STRUCTURE_GUARDRAILS_V1 DIRECTORY_MAX_CHILDREN.)
 * the same-domain precise definition/version schema read capability:
 * manifest pins + allow / deny / missing-field behavior over the REAL
 * transport against mock auth/svc servers. Read-only: GET bindings carry no
 * Idempotency-Key and never write.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { workflowDefinitionReadManifest } from '../src/capabilities/workflow-definition-read.js'
import { DEFAULT_MANIFESTS } from '../src/index.js'
import { validateManifest } from '../src/schema.js'
import { createHttpTransport } from '../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../test-support/capability-fixtures.js'

const VERSION_ROW = {
  id: 'ver-fc9b0966',
  version_status: 'PUBLISHED',
  version_number: 1,
  semantic_model_version: 1,
  context_schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['title', 'description', 'acceptanceCriteria', 'sourceArtifactRef'],
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      acceptanceCriteria: { type: 'string' },
      sourceArtifactRef: { type: 'string' },
    },
  },
}

test('manifest: registered exactly once, GET-only, workflow.read scope, no idempotency key', () => {
  assert.equal(validateManifest(workflowDefinitionReadManifest).ok, true)
  assert.equal(DEFAULT_MANIFESTS.filter((m) => m?.id === 'workflow_definition_read').length, 1)
  assert.deepEqual(workflowDefinitionReadManifest.requiredScopes, ['workflow.read'])
  assert.deepEqual(workflowDefinitionReadManifest.operations.map((op) => op.name), ['list_definitions', 'get_definition'])
  for (const op of workflowDefinitionReadManifest.operations) {
    assert.equal(op.http.method, 'GET')
    assert.equal(op.http.idempotencyKey, undefined)
  }
  assert.equal(workflowDefinitionReadManifest.operations[0].http.path, '/internal/v1/domains/{domainId}/definitions')
  assert.equal(workflowDefinitionReadManifest.operations[1].http.path, '/internal/v1/domains/{domainId}/definitions/{definitionId}')
  // Same-domain precision is the point: the version row contract stays the
  // service's own — the capability never reshapes or filters it.
  assert.deepEqual(workflowDefinitionReadManifest.operations.map((op) => op.result), [{ type: 'json' }, { type: 'json' }])
})

test('allow: same-domain owner reads the precise version schema through the real transport', async () => {
  const token = await startTokenServer()
  const svc = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/internal/v1/domains/dom-1/definitions/def-9') {
      return json(res, 200, { definition: { id: 'def-9', domainId: 'dom-1' }, versions: [VERSION_ROW] })
    }
    if (entry.method === 'GET' && entry.pathname === '/internal/v1/domains/dom-1/definitions') {
      return json(res, 200, { items: [{ id: 'def-9' }], next_cursor: null })
    }
    return json(res, 404, { error: { code: 'definition_not_found', message: 'safe-not-found' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'client', clientSecret: 'secret' }) },
    targets: mockTargets({ 'svc-workflow': svc.origin }), authServiceOrigin: token.origin,
  })
  const { definition } = wire(workflowDefinitionReadManifest, transport)

  const envelope = await definition.execute({ operation: 'get_definition', domainId: 'dom-1', definitionId: 'def-9' })
  assert.equal(envelope.ok, true)
  assert.equal(envelope.result.versions[0].version_status, 'PUBLISHED')
  assert.deepEqual(envelope.result.versions[0].context_schema.required, ['title', 'description', 'acceptanceCriteria', 'sourceArtifactRef'])
  assert.deepEqual(envelope.result.versions[0].context_schema.properties, VERSION_ROW.context_schema.properties)

  const put = svc.requests[0]
  assert.equal(put.method, 'GET')
  assert.equal(put.pathname, '/internal/v1/domains/dom-1/definitions/def-9')
  assert.equal(put.headers['idempotency-key'], undefined)
  assert.equal(token.requests[0].body.scope, 'workflow.read')

  const page = await definition.execute({ operation: 'list_definitions', domainId: 'dom-1', limit: 20 })
  assert.equal(page.ok, true)
  const list = svc.requests[1]
  assert.equal(list.pathname, '/internal/v1/domains/dom-1/definitions')
  assert.equal(list.query.limit, '20')
  await token.close(); await svc.close()
})

test('deny: nonexistent version/definition, foreign domain and other service codes pass through honestly', async () => {
  const token = await startTokenServer()
  const responses = [
    [404, 'definition_not_found'], [403, 'forbidden'], [403, 'domain_disabled'],
  ]
  const svc = await startMockServer((_req, res) => {
    const [status, code] = responses.shift()
    res.writeHead(status, { 'content-type': 'application/json', 'x-request-id': `req-${code}` })
    res.end(JSON.stringify({ error: { code, message: `safe-${code}` } }))
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'client', clientSecret: 'secret' }) },
    targets: mockTargets({ 'svc-workflow': svc.origin }), authServiceOrigin: token.origin,
  })
  const { definition } = wire(workflowDefinitionReadManifest, transport)
  const results = []
  for (let i = 0; i < 3; i++) {
    results.push(await definition.execute({ operation: 'get_definition', domainId: 'dom-1', definitionId: 'def-x' }))
  }
  assert.deepEqual(results.map((r) => [r.error.code, r.error.status, r.error.requestId]), [
    ['definition_not_found', 404, 'req-definition_not_found'],
    ['forbidden', 403, 'req-forbidden'],
    ['domain_disabled', 403, 'req-domain_disabled'],
  ])
  await token.close(); await svc.close()
})

test('missing fields: cursor half-pair and absent arguments fail fast locally, before any token or HTTP work', async () => {
  const token = await startTokenServer()
  const svc = await startMockServer((_req, res) => json(res, 500, { error: { code: 'internal_consistency_error' } }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'client', clientSecret: 'secret' }) },
    targets: mockTargets({ 'svc-workflow': svc.origin }), authServiceOrigin: token.origin,
  })
  const { definition } = wire(workflowDefinitionReadManifest, transport)

  const missingDefinition = await definition.execute({ operation: 'get_definition', domainId: 'dom-1' })
  assert.equal(missingDefinition.ok, false)
  assert.equal(missingDefinition.error.code, 'invalid_arguments')

  const halfCursor = await definition.execute({ operation: 'list_definitions', domainId: 'dom-1', beforeId: 'uuid-without-ts' })
  assert.equal(halfCursor.ok, false)
  assert.equal(halfCursor.error.code, 'invalid_cursor')

  const badLimit = await definition.execute({ operation: 'list_definitions', domainId: 'dom-1', limit: 99 })
  assert.equal(badLimit.ok, false)
  assert.equal(badLimit.error.code, 'invalid_pagination')

  // Zero local rejections reached the token endpoint or svc.
  assert.equal(svc.requests.length, 0)
  assert.equal(token.requests.length, 0)
  await token.close(); await svc.close()
})
