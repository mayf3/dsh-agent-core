import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareWorkflowDraft } from '../../src/capabilities/workflow-linear-authoring.js'
import { workflowDefinitionAuthoringManifest as manifest } from '../../src/capabilities/workflow-definition-authoring.js'
import { createBrokerGateway } from '../../src/gateway.js'
import { buildToolDefinition } from '../../src/registry.js'
import { json, mockTargets, startMockServer, startTokenServer } from '../../test-support/capability-fixtures.js'

const owner = '00000000-0000-4000-8000-000000000001'
const second = '00000000-0000-4000-8000-000000000002'
const base = { domainId: 'domain', definitionId: 'definition', definitionVersionId: 'version' }
const step = (id = owner) => ({ displayName: '  准备标题  ', assigneePrincipalId: id, instructions: '生成三个标题\n保留本指令。' })
const input = () => ({ ...base, steps: [step(), step(second)], terminalOutcome: '全部完成' })

test('linear output preserves intent, exact principals, entry and deterministic primary path at 1/2/32 boundaries', () => {
  for (const count of [1, 2, 32]) {
    const args = { ...input(), steps: Array.from({ length: count }, (_, i) => step(i % 2 ? second : owner)), contextSchema: null }
    const before = structuredClone(args)
    const a = prepareWorkflowDraft(args)
    assert.equal(a.ok, true)
    assert.deepEqual(args, before, 'caller input remains untouched')
    assert.equal(JSON.stringify(a), JSON.stringify(prepareWorkflowDraft(structuredClone(args))))
    assert.equal(a.args.nodes.length, count + 1)
    assert.equal(a.args.transitions.length, count)
    assert.equal(a.args.contextSchema, null)
    assert.equal(a.args.steps, undefined)
    assert.equal(a.args.terminalOutcome, undefined)
    assert.deepEqual(a.args.nodes[0], {
      node_key: 'step_1', display_name: args.steps[0].displayName, order_index: 0, node_type: 'TASK',
      assignee_ref_type: 'FIXED_PRINCIPAL', fixed_principal_id: owner,
      instructions: args.steps[0].instructions, primary_advance_transition_key: 'advance_1',
    })
    assert.deepEqual(a.args.nodes.at(-1), { node_key: 'done', display_name: '全部完成', order_index: count, node_type: 'TERMINAL' })
    for (let i = 0; i < count; i++) {
      const node = a.args.nodes[i]
      const edge = a.args.transitions.find(t => t.transition_key === node.primary_advance_transition_key)
      assert.equal(node.fixed_principal_id, args.steps[i].assigneePrincipalId)
      assert.equal(node.instructions, args.steps[i].instructions)
      assert.equal(edge.source_node_key, node.node_key)
      assert.equal(edge.target_node_key, a.args.nodes[i + 1].node_key)
      assert.equal(edge.transition_effect, 'ADVANCE')
    }
  }
})

test('unicode character bounds preserve nonblank text verbatim', () => {
  const value = input()
  value.steps[0].displayName = '😀'.repeat(200)
  value.steps[0].instructions = '😀'.repeat(4000)
  value.terminalOutcome = '😀'.repeat(200)
  assert.equal(prepareWorkflowDraft(value).ok, true)
  value.steps[0].instructions += '😀'
  assert.match(prepareWorkflowDraft(value).error.detail, /steps\[0\].instructions/)
})

const malformed = [
  null, [], {}, { ...input(), nodes: [] }, { ...base, steps: [step()] },
  { ...base, terminalOutcome: 'done' }, { ...base, nodes: [] }, { ...base, transitions: [] },
  { ...input(), steps: [] }, { ...input(), steps: Array.from({ length: 33 }, () => step()) },
  { ...input(), steps: [null] }, { ...input(), steps: [{ ...step(), assigneePrincipalId: '博客 Agent' }] },
  { ...input(), steps: [{ ...step(), assigneePrincipalId: `${owner}\n` }] },
  { ...input(), steps: [{ ...step(), instructions: ' ' }] },
  { ...input(), steps: [{ ...step(), displayName: 'x'.repeat(201) }] },
  { ...input(), steps: [{ ...step(), instructions: 'x'.repeat(4001) }] },
  { ...input(), terminalOutcome: '' }, { ...input(), terminalOutcome: 'x'.repeat(201) },
  { ...input(), branches: [] }, { ...input(), actor: 'forged' },
  { ...input(), steps: [{ ...step(), transitions: [] }] },
  { ...input(), steps: [{ ...step(), 'password=private-value': true }] },
]

test('bad or unsupported forms fail before credential access even via direct parent RPC', async () => {
  const gateway = createBrokerGateway({ manifests: [manifest], targets: [], credentialsFile: '/nonexistent/authoring-credentials.json' })
  for (const args of malformed) {
    const result = await gateway.execute({ capabilityId: manifest.id, operation: 'replace_draft_graph', args }, { agentId: 'agent' })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'invalid_arguments', JSON.stringify(args))
    assert.ok(result.error.detail.length <= 250)
    assert.doesNotMatch(result.error.detail, /private-value|forged/)
  }
})

test('existing full form stays unchanged and cannot be mixed with linear fields', () => {
  const full = { ...base, contextSchema: { type: 'object' }, nodes: [], transitions: [] }
  assert.equal(prepareWorkflowDraft(full).args, full)
  for (const mixed of [{ ...full, steps: undefined }, { ...full, terminalOutcome: null }]) {
    assert.equal(prepareWorkflowDraft(mixed).ok, false)
  }
})

test('real catalog + gateway sends one canonical HTTP write and preserves actionable service error', async t => {
  const token = await startTokenServer()
  let reject = false
  const svc = await startMockServer((_req, res) => reject
    ? json(res, 422, { error: { code: 'graph_validation_failed', message: 'graph validation failed (rule: v1 primary advance required): Set one primary ADVANCE for each TASK.', details: { private: 'never-forward-this' } } })
    : json(res, 200, { status: 'ok' }))
  t.after(async () => { await token.close(); await svc.close() })
  const dir = await mkdtemp(join(tmpdir(), 'linear-authoring-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const credentialsFile = join(dir, 'credentials.json')
  await writeFile(credentialsFile, JSON.stringify({ version: 1, credentials: { agent: { clientId: 'client', clientSecret: 'secret' } } }))
  const gateway = createBrokerGateway({ manifests: [manifest], targets: mockTargets({ 'svc-workflow': svc.origin }), authServiceOrigin: token.origin, credentialsFile })
  const handlers = Object.fromEntries(manifest.operations.map(op => [op.name, async (operation, args) => {
    const result = await gateway.execute({ capabilityId: manifest.id, operation, args }, { agentId: 'agent' })
    return result.ok ? result.result : { errorCode: result.error.code, ...result.error }
  }]))
  const { definition } = buildToolDefinition({ manifest, handlers })
  assert.deepEqual(definition.parameters.operation.enum, ['create_definition', 'create_draft_version', 'replace_draft_graph', 'publish_version'])
  assert.equal(definition.parameters.steps.items.additionalProperties, false)
  assert.deepEqual(Object.keys(definition.parameters.steps.items.properties), ['displayName', 'assigneePrincipalId', 'instructions'])
  assert.ok(Object.values(definition.parameters.steps.items.properties).every(field => field.required === true))
  assert.match(definition.parameters.semanticModelVersion.description, /Omitted means Legacy/)
  assert.equal((await definition.execute({ operation: 'replace_draft_graph', ...input() })).ok, true)
  assert.equal(svc.requests.length, 1)
  const request = svc.requests[0]
  assert.equal(request.method, 'PUT')
  assert.equal(request.pathname, '/internal/v1/domains/domain/definitions/definition/draft')
  const body = request.body
  assert.deepEqual(Object.keys(body).sort(), ['definitionVersionId', 'nodes', 'transitions'])
  assert.deepEqual(body.nodes, prepareWorkflowDraft(input()).args.nodes)
  assert.ok(request.headers['idempotency-key'])
  reject = true
  const failure = await definition.execute({ operation: 'replace_draft_graph', ...input() })
  assert.equal(failure.error.code, 'graph_validation_failed')
  assert.equal(failure.error.status, 422)
  assert.match(failure.error.detail, /v1 primary advance required/)
  assert.match(failure.error.detail, /Set one primary ADVANCE/)
  assert.doesNotMatch(JSON.stringify(failure), /never-forward/)
  assert.equal(svc.requests.length, 2, 'no auto retry after canonical rejection')
})
