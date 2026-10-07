/**
 * AGENT_CORE_WORKFLOW_AUTHORING_FILE_ENTRY_V1 (candidate) — runtime-entry
 * integration: the REAL child broker apply() registers the file-entry tool;
 * its execute flows through the REAL parent-RPC handler (agent-router,
 * actual-caller binding) into the REAL gateway + authorized HTTP transport,
 * against mock auth-service / svc-workflow servers. No production resource
 * is touched; the only substitution is the pinned downstream origin, the
 * same hermetic seam the accepted capability tests use.
 *
 * Asserts the #562 load-bearing property end to end: the svc PUT body is
 * deep-equal, field by field, to the parsed arguments file; repeated calls
 * converge with fresh trusted Idempotency-Keys and never create duplicates.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { workflowDefinitionAuthoringManifest } from '../src/capabilities/workflow-definition-authoring.js'
import { AUTHORING_FILE_ENTRY_TOOL_NAME } from '../src/authoring-file-entry.js'
import { apply as applyBroker } from '../src/index.js'
import { createParentRpcHandler } from '../../agent-router/src/parent-rpc-relay.js'
import { json, mockTargets, startMockServer, startTokenServer } from '../test-support/capability-fixtures.js'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** A graph big enough to make model restatement loss plausible (~30 KB) and
 *  structurally identical to the #562 business fixture shape. */
function bigGraphArgs() {
  const properties = {}
  const required = []
  for (let i = 0; i < 11; i++) {
    properties[`field_${i}`] = { type: 'string', description: `业务字段${i}：较长说明`.repeat(4) }
    required.push(`field_${i}`)
  }
  const instructions = '明确需求、数量、规格、预算、家庭限制及交付期；缺必需信息时等待用户补齐，不猜测。'.repeat(6)
  return {
    domainId: 'd-aaaa',
    definitionId: 'def-bbbb',
    definitionVersionId: 'ver-cccc',
    contextSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      required,
      properties,
    },
    nodes: [
      { node_key: 'requirements', display_name: '冻结家庭购物需求与预算', order_index: 0, node_type: 'DRAFT', assignee_ref_type: 'WORKFLOW_CREATOR', instructions, primary_advance_transition_key: 'to_candidates' },
      { node_key: 'candidates', display_name: '候选', order_index: 1, node_type: 'TASK', assignee_ref_type: 'DOMAIN_OWNER', instructions, primary_advance_transition_key: 'to_review' },
      { node_key: 'review', display_name: '产品复核', order_index: 2, node_type: 'TASK', assignee_ref_type: 'DOMAIN_OWNER', instructions, primary_advance_transition_key: 'to_done' },
      { node_key: 'done', display_name: '完成', order_index: 3, node_type: 'TERMINAL' },
    ],
    transitions: [
      { transition_key: 'to_candidates', display_name: '生成候选', source_node_key: 'requirements', target_node_key: 'candidates', transition_effect: 'ADVANCE', submission_schema: { type: 'object', additionalProperties: false, required: ['summary'], properties: { summary: { type: 'string' } } } },
      { transition_key: 'to_review', display_name: '提交复核', source_node_key: 'candidates', target_node_key: 'review', transition_effect: 'ADVANCE', submission_schema: { type: 'object', additionalProperties: false, required: ['confirm'], properties: { confirm: { type: 'boolean' } } } },
      { transition_key: 'to_done', display_name: '完成', source_node_key: 'review', target_node_key: 'done', transition_effect: 'ADVANCE' },
    ],
  }
}

function fakeCtx({ collect } = {}) {
  const provided = new Map()
  const registered = []
  return {
    registered,
    get: (name) => provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    tools: { register: (tool) => { registered.push(tool); collect?.(tool) } },
  }
}

test('runtime entry: file → child tool → parent-RPC (actual caller) → gateway → svc PUT, byte-faithful and idempotent', async (t) => {
  const token = await startTokenServer()
  t.after(() => token.close())
  const svc = await startMockServer((req, res, entry) => {
    if (entry.method === 'PUT' && entry.pathname.endsWith('/draft')) {
      res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': 'req-afe-runtime' })
      return res.end(JSON.stringify({ status: 'ok' }))
    }
    return json(res, 404, { error: { code: 'definition_not_found' } })
  })
  t.after(() => svc.close())

  const dir = await mkdtemp(join(tmpdir(), 'afe-runtime-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const workspace = join(dir, 'workspace')
  await mkdir(workspace, { recursive: true })
  const credentialsFile = join(dir, 'agent-credentials.json')
  await writeFile(credentialsFile, JSON.stringify({
    version: 1,
    credentials: { agt_afe: { clientId: 'client-afe', clientSecret: 'secret-afe' } },
  }, null, 2))

  const raw = JSON.stringify(bigGraphArgs(), null, 2)
  const argsFile = join(workspace, 'shopping-repair.arguments.json')
  await writeFile(argsFile, raw)
  const args = JSON.parse(raw)

  const targets = mockTargets({ 'svc-workflow': svc.origin })
  const gatewayCtx = fakeCtx()
  const { gateway } = applyBroker(gatewayCtx, {
    mode: 'gateway',
    manifests: [workflowDefinitionAuthoringManifest],
    targets,
    authServiceOrigin: token.origin,
    credentialsFile,
  })

  // Capture the call AT the gateway boundary — the exact args object the
  // existing trusted seam received (the #562 field-by-field equality point).
  const gatewayCalls = []
  const parentHandler = createParentRpcHandler({
    agentId: 'agt_afe',
    log: { log: () => {} },
    getProc: () => ({ state: 'READY', processGeneration: 1, executions: new Map() }),
    getBrokerGateway: () => ({
      execute: async (call, ctx) => {
        gatewayCalls.push(call)
        return gateway.execute(call, ctx)
      },
    }),
    switchAgent: async () => { throw new Error('switch not used in this test') },
  })

  const childCtx = fakeCtx()
  const previousWorkspace = process.env.DSH_PRIMARY_WORKSPACE
  process.env.DSH_PRIMARY_WORKSPACE = workspace
  t.after(() => {
    if (previousWorkspace === undefined) delete process.env.DSH_PRIMARY_WORKSPACE
    else process.env.DSH_PRIMARY_WORKSPACE = previousWorkspace
  })
  applyBroker(childCtx, {
    manifests: [workflowDefinitionAuthoringManifest],
    targets,
    authServiceOrigin: token.origin,
  })
  // The parent-RPC channel is provided AFTER apply in production composition;
  // the child resolves it lazily at execute time. The wire resolves
  // { ok: true, result: <parent answer> } — the same two layers the child
  // relay unwraps (rpc-channel contract).
  childCtx.provide('agentRpc', {
    request: async (method, params) => ({ ok: true, result: await parentHandler(method, params, {}) }),
  })

  const fileEntry = childCtx.registered.find((tool) => tool?.name === AUTHORING_FILE_ENTRY_TOOL_NAME)
  assert.ok(fileEntry, 'file entry tool must be registered in child mode')
  // The existing capability tool stays registered exactly once (CTR-WDA-005).
  assert.equal(childCtx.registered.filter((tool) => tool?.name === 'workflow_definition_authoring').length, 1)

  const envelope = await fileEntry.execute({ path: argsFile })
  assert.equal(envelope.ok, true)
  assert.deepEqual(envelope.result, { status: 'ok' })

  // Gateway boundary: the FULL parsed object, field by field.
  assert.equal(gatewayCalls.length, 1)
  assert.equal(gatewayCalls[0].capabilityId, 'workflow_definition_authoring')
  assert.equal(gatewayCalls[0].operation, 'replace_draft_graph')
  assert.deepEqual(gatewayCalls[0].args, args)

  // svc HTTP boundary: domainId/definitionId ride the PATH per the frozen
  // binding (CTR-WDA-001); the body carries the rest, byte-faithful.
  assert.equal(svc.requests.length, 1)
  const put = svc.requests[0]
  assert.equal(put.method, 'PUT')
  assert.equal(put.pathname, '/internal/v1/domains/d-aaaa/definitions/def-bbbb/draft')
  const { domainId, definitionId, ...bodyArgs } = args
  assert.deepEqual(put.body, bodyArgs)
  assert.deepEqual(put.body.contextSchema.properties, args.contextSchema.properties)
  assert.deepEqual(put.body.contextSchema.required, args.contextSchema.required)
  assert.equal(put.body.nodes[0].assignee_ref_type, 'WORKFLOW_CREATOR')
  assert.match(put.headers['idempotency-key'], /^ik-workflow-definition-authoring-/)
  assert.equal(put.headers.authorization, 'Bearer tok-real')
  assert.ok(token.requests.every((r) => r.body.scope === 'workflow.execute'))

  // Evidence: untruncated request line + response line with requestId.
  const evidenceRaw = await readFile(join(workspace, '.workflow-authoring-file-entry', 'evidence.jsonl'), 'utf8')
  const lines = evidenceRaw.trim().split('\n').map((line) => JSON.parse(line))
  assert.equal(lines.length, 2)
  assert.equal(lines[0].stage, 'request')
  assert.deepEqual(lines[0].args, args)
  assert.equal(lines[0].sha256, sha256(raw))
  assert.equal(lines[1].stage, 'response')
  assert.deepEqual(lines[1].envelope, { ok: true, result: { status: 'ok' } })

  // Idempotent convergence: a second identical call relays again (fresh
  // trusted key, same body) and never surfaces a duplicate.
  const second = await fileEntry.execute({ path: argsFile })
  assert.equal(second.ok, true)
  assert.deepEqual(second.result, { status: 'ok' })
  assert.equal(svc.requests.length, 2)
  assert.deepEqual(gatewayCalls[1].args, args)
  assert.deepEqual(svc.requests[1].body, bodyArgs)
  assert.notEqual(svc.requests[1].headers['idempotency-key'], put.headers['idempotency-key'])
})
