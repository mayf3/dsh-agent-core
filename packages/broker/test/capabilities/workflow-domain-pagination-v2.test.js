import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { validateManifest } from '../../src/schema.js'
import { buildToolDefinition } from '../../src/registry.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── Domain Instances Pagination V2 ─────────────────────────────────────────

const findManifest = () => workflowManifests.find((manifest) => manifest.id === 'workflow_domain_instances')
const page = (items, nextCursor) => ({ items, next_cursor: nextCursor })
const item = (id, createdAt) => ({
  workflow_instance_id: id,
  title: `分页 ${id}`,
  is_terminal: false,
  current_node: { node_key: 'review', display_name: '评审', node_type: 'human' },
  current_assignee_principal_id: '7a8b9c0d-0000-4000-8000-0000000000d4',
  created_at: createdAt,
  updated_at: createdAt,
})

test('workflow_domain_instances pagination: exact tool schema and canonical generic allOrNone group', () => {
  const manifest = findManifest()
  const canonical = validateManifest(manifest)
  assert.equal(canonical.ok, true, canonical.errors?.join('; '))

  const op = canonical.manifest.operations[0]
  assert.deepEqual(Object.keys(op.arguments.properties).sort(), ['beforeCreatedAt', 'beforeId', 'domainId', 'limit'])
  assert.deepEqual(op.arguments.required, ['domainId'])
  assert.equal(op.arguments.properties.beforeCreatedAt.type, 'string')
  assert.equal(op.arguments.properties.beforeId.type, 'string')

  const { definition } = buildToolDefinition({ manifest, handlers: {} })
  assert.deepEqual(Object.keys(definition.parameters).sort(), ['beforeCreatedAt', 'beforeId', 'domainId', 'limit', 'operation'])
  assert.equal(definition.parameters.domainId.required, true)
  assert.equal(definition.parameters.beforeCreatedAt.type, 'string')
  assert.equal(definition.parameters.beforeCreatedAt.required, undefined)
  assert.equal(definition.parameters.beforeId.type, 'string')
  assert.equal(definition.parameters.beforeId.required, undefined)
  assert.deepEqual(op.arguments.allOrNone, [
    { properties: ['beforeCreatedAt', 'beforeId'], validationError: 'invalid_cursor' },
  ])
  assert.deepEqual(op.http.query, ['domainId', 'limit', 'beforeCreatedAt', 'beforeId'])
  assert.ok(op.errors.includes('invalid_cursor'))

  const codes = new Set(manifest.errors.map((error) => error.code))
  assert.equal(codes.has('invalid_cursor'), true)
  assert.equal(codes.has('global_read_role_required'), false, 'domain capability must not add GLOBAL_WORKFLOW_READER semantics')
})

test('workflow_domain_instances pagination: malformed allOrNone metadata fails closed', () => {
  const manifest = JSON.parse(JSON.stringify(findManifest()))
  const originalOperation = manifest.operations[0]
  const withGroup = (group) => {
    manifest.operations[0] = {
      ...originalOperation,
      arguments: { ...originalOperation.arguments, allOrNone: [group] },
    }
    return validateManifest(manifest)
  }

  assert.equal(withGroup({ properties: ['beforeCreatedAt'], validationError: 'invalid_cursor' }).ok, false)
  assert.equal(withGroup({ properties: ['beforeCreatedAt', 'missing'], validationError: 'invalid_cursor' }).ok, false)
  assert.equal(withGroup({ properties: ['beforeId', 'beforeId'], validationError: 'invalid_cursor' }).ok, false)
  assert.equal(withGroup({ properties: ['beforeCreatedAt', 'beforeId'], validationError: 'undeclared_code' }).ok, false)
  assert.equal(withGroup({ properties: ['beforeCreatedAt', 'beforeId'], validationError: 'invalid_cursor' }).ok, true)
})

test('workflow_domain_instances pagination: either half cursor is local invalid_cursor before credential, token, or HTTP', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 200, page([], null)))
  let credentialCalls = 0
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
  const domainId = '1c2d3e4f-0000-4000-8000-00000000aa05'

  for (const args of [
    { operation: 'list', domainId, beforeCreatedAt: '2026-08-13T22:25:34.354961+05:30' },
    { operation: 'list', domainId, beforeId: '153F0EB5-4FBA-43E5-95E3-E12E9640FCD6' },
  ]) {
    const result = await definition.execute(args)
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'invalid_cursor')
    assert.equal(result.error.status, undefined)
  }

  assert.equal(credentialCalls, 0, 'credential lookup must not run')
  assert.equal(tokenServer.requests.length, 0, 'token request must not run')
  assert.equal(workflow.requests.length, 0, 'business HTTP request must not run')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_instances pagination: full cursor is verbatim and pages remain unique until next_cursor null', async () => {
  const tokenServer = await startTokenServer()
  const domainId = '1c2d3e4f-0000-4000-8000-00000000aa04'
  const boundary = {
    created_at: '2026-08-13T22:25:34.354961+05:30',
    id: '153F0EB5-4FBA-43E5-95E3-E12E9640FCD6',
  }
  const firstPage = page(
    [
      item('9c7f3b0a-0000-4000-8000-0000000000a1', '2026-08-26T10:00:00.123456Z'),
      item(boundary.id, boundary.created_at),
    ],
    boundary,
  )
  const secondPage = page(
    [
      item('9c7f3b0a-0000-4000-8000-0000000000b1', '2026-08-12T09:00:00Z'),
      item('9c7f3b0a-0000-4000-8000-0000000000b2', '2026-08-11T08:00:00Z'),
    ],
    null,
  )

  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method !== 'GET' || entry.pathname !== '/internal/v1/workflow-instances/domain') {
      return json(res, 404, { error: 'not_found' })
    }
    if (entry.query.domainId !== domainId) {
      return json(res, 422, { error: { code: 'invalid_pagination', message: 'invalid domainId' } })
    }
    if (entry.query.beforeCreatedAt === undefined && entry.query.beforeId === undefined) {
      return json(res, 200, firstPage)
    }
    if (entry.query.beforeCreatedAt === boundary.created_at && entry.query.beforeId === boundary.id) {
      return json(res, 200, secondPage)
    }
    return json(res, 422, { error: { code: 'invalid_cursor', message: 'cursor changed in transit' } })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findManifest(), transport)

  const pages = []
  let cursor
  do {
    const result = await definition.execute({
      operation: 'list',
      domainId,
      limit: 2,
      ...(cursor === undefined ? {} : { beforeCreatedAt: cursor.created_at, beforeId: cursor.id }),
    })
    assert.equal(result.ok, true)
    pages.push(result.result)
    cursor = result.result.next_cursor
  } while (cursor !== null)

  assert.deepEqual(pages, [firstPage, secondPage], 'snake_case pages and cursor objects must pass through without reshape')
  assert.equal(pages[0].items.length, 2)
  assert.equal(pages[1].items.length, 2)
  const page1Ids = pages[0].items.map((entry) => entry.workflow_instance_id)
  const page2Ids = pages[1].items.map((entry) => entry.workflow_instance_id)
  assert.equal(page1Ids.some((id) => page2Ids.includes(id)), false, 'page 1 and page 2 IDs must not overlap')
  const allIds = [...page1Ids, ...page2Ids]
  assert.equal(new Set(allIds).size, 4)
  assert.equal(allIds.length - new Set(allIds).size, 0)
  assert.equal(cursor, null)

  assert.deepEqual(workflow.requests[0].query, { domainId, limit: '2' })
  assert.deepEqual(workflow.requests[1].query, {
    domainId,
    limit: '2',
    beforeCreatedAt: boundary.created_at,
    beforeId: boundary.id,
  })
  assert.equal(tokenServer.requests[0].body.scope, 'workflow.read')

  await tokenServer.close()
  await workflow.close()
})

test('workflow_domain_instances pagination: server-side DOMAIN_OWNER camouflage 404 remains unchanged', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => {
    res.setHeader('x-request-id', 'req-domain-pagination-404')
    json(res, 404, {
      error: {
        code: 'workflow_instance_not_found_or_not_visible',
        message: 'workflow instance not found or not visible',
      },
    })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(findManifest(), transport)

  const result = await definition.execute({
    operation: 'list',
    domainId: '1c2d3e4f-0000-4000-8000-00000000aa02',
  })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'workflow_instance_not_found_or_not_visible')
  assert.equal(result.error.status, 404)
  assert.equal(result.error.requestId, 'req-domain-pagination-404')

  await tokenServer.close()
  await workflow.close()
})
