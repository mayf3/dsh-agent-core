/**
 * Issue #562 delivery verification — run the REAL authoring file entry
 * through the REAL runtime path (child broker apply → parent-RPC handler →
 * gateway → authorized transport) against LOCAL MOCK auth/svc servers, with
 * the actual #562 arguments file, and persist UNTRUNCATED evidence:
 *
 *   sh562-pipe-gateway-captured-args.json  — the FULL args object the gateway
 *                                          received (field-by-field proof)
 *   sh562-pipe-svc-put.json              — svc PUT path/method/headers/body
 *   sh562-pipe-evidence.jsonl            — the tool's own evidence lines
 *   sh562-pipe-negative-results.json     — pre-relay rejection records
 *
 * Zero production resources are touched: the pinned downstream origins are
 * the same hermetic mock seam the accepted broker tests use; no definition
 * is created, replaced, published, or instantiated anywhere real.
 *
 * Usage:
 *   node scripts/verify-issue-562-authoring-file-entry.mjs \
 *     --args-file /path/to/shopping-repair-draft.arguments.json \
 *     --out-dir /path/to/evidence-dir
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { realpathSync } from 'node:fs'

import { workflowDefinitionAuthoringManifest } from '../packages/broker/src/capabilities/workflow-definition-authoring.js'
import { AUTHORING_FILE_ENTRY_TOOL_NAME } from '../packages/broker/src/authoring-file-entry.js'
import { apply as applyBroker } from '../packages/broker/src/index.js'
import { createParentRpcHandler } from '../packages/agent-router/src/parent-rpc-relay.js'
import { json, mockTargets, startMockServer, startTokenServer } from '../packages/broker/test-support/capability-fixtures.js'

function argValue(flag) {
  const at = process.argv.indexOf(flag)
  return at === -1 ? undefined : process.argv[at + 1]
}

const argsFile = resolve(argValue('--args-file') ?? throw_('--args-file is required'))
const outDir = resolve(argValue('--out-dir') ?? throw_('--out-dir is required'))
function throw_(message) { throw new Error(message) }

const raw = await readFile(argsFile, 'utf8')
const fileArgs = JSON.parse(raw)
const rawBytes = Buffer.byteLength(raw)
const fileSha256 = createHash('sha256').update(raw).digest('hex')
console.log(`[sh562] args file: ${argsFile} (${rawBytes} bytes, sha256 ${fileSha256})`)
console.log(`[sh562] graph: ${fileArgs.nodes.length} nodes, ${fileArgs.transitions.length} transitions, contextSchema required=${fileArgs.contextSchema?.required?.length ?? 0} properties=${Object.keys(fileArgs.contextSchema?.properties ?? {}).length}`)

// ── hermetic auth + svc mock servers ──────────────────────────────────────
const token = await startTokenServer()
const svcRequests = []
const svc = await startMockServer((req, res, entry) => {
  svcRequests.push(entry)
  if (entry.method === 'PUT' && entry.pathname.endsWith('/draft')) {
    res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': 'req-sh562-pipe' })
    return res.end(JSON.stringify({ status: 'ok' }))
  }
  if (entry.method === 'GET' && entry.pathname === '/internal/v1/domains/e738b9af-b34f-46ee-8d60-e3c0db24d64d/definitions/fa016161-d6d0-48b3-826f-b684b4439554') {
    res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': 'req-sh555-read' })
    return res.end(JSON.stringify({
      definition: { id: 'fa016161-d6d0-48b3-826f-b684b4439554' },
      versions: [{ id: 'a85253b1-d887-49cf-b28d-57c456a1c710', version_status: 'PUBLISHED', context_schema: { type: 'object', required: ['requestId'] } }],
    }))
  }
  return json(res, 404, { error: { code: 'definition_not_found', message: 'safe-not-found' } })
})

const dir = await mkdtemp(join(tmpdir(), 'sh562-pipe-'))
const workspace = join(dir, 'workspace')
await mkdir(workspace, { recursive: true })
const credentialsFile = join(dir, 'agent-credentials.json')
await writeFile(credentialsFile, JSON.stringify({
  version: 1,
  credentials: { 'agt_family-steward-agent': { clientId: 'client-local-test', clientSecret: 'secret-local-test' } },
}, null, 2))

// The arguments file is copied INSIDE the workspace — the entry's read
// boundary is the agent's own workspace (production-shaped).
const workspaceArgsFile = join(workspace, 'shopping-repair.arguments.json')
await writeFile(workspaceArgsFile, raw)

const targets = mockTargets({ 'svc-workflow': svc.origin })
const provided = new Map()
const gatewayCtx = {
  get: (name) => provided.get(name),
  provide: (name, value) => { provided.set(name, value) },
  tools: { register: () => {} },
}
const { gateway } = applyBroker(gatewayCtx, {
  mode: 'gateway',
  manifests: [workflowDefinitionAuthoringManifest, workflowDefinitionReadManifest],
  targets,
  authServiceOrigin: token.origin,
  credentialsFile,
})

const gatewayCalls = []
const parentHandler = createParentRpcHandler({
  agentId: 'agt_family-steward-agent',
  log: { log: () => {} },
  getProc: () => ({ state: 'READY', processGeneration: 1, executions: new Map() }),
  getBrokerGateway: () => ({
    execute: async (call, ctx) => {
      gatewayCalls.push(call)
      return gateway.execute(call, ctx)
    },
  }),
  switchAgent: async () => { throw new Error('switch not used') },
})

const registered = []
const childCtx = {
  get: (name) => provided.get(name),
  provide: (name, value) => { provided.set(name, value) },
  tools: { register: (tool) => { registered.push(tool) } },
}
process.env.DSH_PRIMARY_WORKSPACE = workspace
applyBroker(childCtx, {
  manifests: [workflowDefinitionAuthoringManifest, workflowDefinitionReadManifest],
  targets,
  authServiceOrigin: token.origin,
})
childCtx.provide('agentRpc', {
  request: async (method, params) => ({ ok: true, result: await parentHandler(method, params, {}) }),
})

const fileEntry = registered.find((tool) => tool?.name === AUTHORING_FILE_ENTRY_TOOL_NAME)
assert.ok(fileEntry, 'file entry tool must be registered')

// ── positive: the real file, twice (idempotent convergence) ───────────────
const first = await fileEntry.execute({ path: workspaceArgsFile })
assert.equal(first.ok, true, `first call failed: ${JSON.stringify(first)}`)
const second = await fileEntry.execute({ path: workspaceArgsFile, expectedSha256: fileSha256 })
assert.equal(second.ok, true, `second call failed: ${JSON.stringify(second)}`)

// Gateway boundary: the FULL parsed object, field by field, both calls.
assert.equal(gatewayCalls.length, 2)
for (const call of gatewayCalls) {
  assert.equal(call.capabilityId, 'workflow_definition_authoring')
  assert.equal(call.operation, 'replace_draft_graph')
  assert.deepEqual(call.args, fileArgs)
}
const svcPuts = svcRequests.filter((entry) => entry.method === 'PUT')
assert.equal(svcPuts.length, 2)
const { domainId, definitionId, ...bodyArgs } = fileArgs
for (const put of svcPuts) {
  assert.equal(put.pathname, `/internal/v1/domains/${domainId}/definitions/${definitionId}/draft`)
  assert.deepEqual(put.body, bodyArgs)
}
assert.notEqual(svcPuts[0].headers['idempotency-key'], svcPuts[1].headers['idempotency-key'])
assert.ok(svcPuts.every((put) => /^ik-workflow-definition-authoring-/.test(put.headers['idempotency-key'])))

// ── negatives: every rejection must fire BEFORE any svc HTTP write ────────
// tier 'pre_gateway': file-stage / schema-structural — the gateway is never
// reached. tier 'pre_svc_write': gateway-owned rejections (e.g. exactly-one
// form) — the gateway sees the call but svc receives ZERO write.
const negatives = []
const putCount = () => svcRequests.filter((entry) => entry.method === 'PUT').length
async function expectRejection(name, tier, setup) {
  const beforeGateway = gatewayCalls.length
  const beforePuts = putCount()
  const file = await setup()
  const envelope = await fileEntry.execute({ path: file })
  const preGateway = gatewayCalls.length === beforeGateway
  const preSvcWrite = putCount() === beforePuts
  const ok = envelope.ok === false && (tier === 'pre_gateway' ? preGateway : preSvcWrite)
  negatives.push({ name, tier, rejected: ok, ok: envelope.ok, code: envelope.error?.code, detail: envelope.error?.detail, preGateway, preSvcWrite })
  console.log(`[sh562] negative ${name} (${tier}): rejected=${ok} code=${envelope.error?.code}`)
  assert.equal(ok, true, `negative ${name} must fail ${tier}`)
}
const expectPreRelayRejection = (name, setup) => expectRejection(name, 'pre_gateway', setup)

await expectPreRelayRejection('invalid_json', async () => {
  const f = join(workspace, 'broken.json')
  await writeFile(f, '{"nodes": [')
  return f
})
await expectPreRelayRejection('truncated_payload', async () => {
  const f = join(workspace, 'truncated.json')
  await writeFile(f, raw.slice(0, Math.floor(raw.length / 2)))
  return f
})
await expectPreRelayRejection('identity_field_injection', async () => {
  const f = join(workspace, 'identity.json')
  await writeFile(f, JSON.stringify({ ...fileArgs, agentId: 'agt_mallory', scope: 'workflow.admin' }))
  return f
})
await expectPreRelayRejection('outside_workspace', async () => {
  const f = join(dir, 'outside.json')
  await writeFile(f, raw)
  return f
})
await expectRejection('type_violation_nodes_not_array', 'pre_svc_write', async () => {
  // Array-type strictness is gateway-side (the child mapping validates
  // objects recursively but not bare array types); the gateway rejects it
  // before any svc write. (Semantic graph/schema correctness stays
  // svc-owned by contract: the entry guarantees lossless fidelity, not
  // re-judgement — the #562 defect shape (required kept, properties
  // dropped) is valid broker-side JSON and is preserved verbatim for the
  // service to rule on.)
  const broken = JSON.parse(raw)
  broken.nodes = 'not-an-array'
  const f = join(workspace, 'broken-nodes.json')
  await writeFile(f, JSON.stringify(broken))
  return f
})
// unknown outcome is NEVER auto-retried: the relay failure leaves exactly one
// gateway attempt and preserves the UNKNOWN category (never invalid_arguments).
const failedCallsBefore = gatewayCalls.length
provided.set('agentRpc', { request: async () => { throw new Error('channel died mid-call') } })
const relayFailure = await fileEntry.execute({ path: workspaceArgsFile })
assert.equal(relayFailure.ok, false)
assert.equal(relayFailure.error.code, 'outcome_unknown')
assert.match(relayFailure.error.detail, /UNKNOWN/)
assert.match(relayFailure.error.detail, /channel died mid-call/)
assert.equal(gatewayCalls.length, failedCallsBefore)
negatives.push({ name: 'relay_failure_no_auto_retry', rejected: relayFailure.ok === false, ok: relayFailure.ok, code: relayFailure.error?.code, detail: relayFailure.error?.detail, gatewayCallsDelta: 0 })
console.log('[sh562] negative relay_failure_no_auto_retry: outcome_unknown, single attempt, no retry')
provided.set('agentRpc', { request: async (method, params) => ({ ok: true, result: await parentHandler(method, params, {}) }) })

// ── persist UNTRUNCATED evidence ─────────────────────────────────────────
await mkdir(outDir, { recursive: true })
const evidenceRaw = await readFile(join(workspace, '.workflow-authoring-file-entry', 'evidence.jsonl'), 'utf8')
const evidenceLines = evidenceRaw.trim().split('\n').map((line) => JSON.parse(line))
// Every request line carrying the REAL file's hash must hold the FULL
// untruncated args object; gateway-rejected calls keep their own honest
// evidence lines (not compared here).
const realRequestLines = evidenceLines.filter((line) => line.stage === 'request' && line.sha256 === fileSha256)
assert.ok(realRequestLines.length >= 2, 'request lines for the two positive calls expected')
for (const line of realRequestLines) assert.deepEqual(line.args, fileArgs)
const responseLines = evidenceLines.filter((line) => line.stage === 'response' && line.sha256 === fileSha256)
assert.ok(responseLines.length >= 3, 'two positive responses + one relay-failure response expected')

await writeFile(join(outDir, 'sh562-pipe-gateway-captured-args.json'), JSON.stringify(gatewayCalls[0].args, null, 2) + '\n')
await writeFile(join(outDir, 'sh562-pipe-svc-put.json'), JSON.stringify({
  method: svcPuts[0].method,
  pathname: svcPuts[0].pathname,
  headers: {
    'content-type': svcPuts[0].headers['content-type'],
    'idempotency-key-1': svcPuts[0].headers['idempotency-key'],
    'idempotency-key-2': svcPuts[1].headers['idempotency-key'],
    authorization: 'Bearer tok-real (local mock; scope workflow.execute)',
  },
  body: svcPuts[0].body,
}, null, 2) + '\n')
await writeFile(join(outDir, 'sh562-pipe-evidence.jsonl'), evidenceRaw)
await writeFile(join(outDir, 'sh562-pipe-negative-results.json'), JSON.stringify({
  argsFile, bytes: rawBytes, sha256: fileSha256,
  positiveCalls: 2, gatewayCallsTotal: gatewayCalls.length,
  negatives,
}, null, 2) + '\n')

// ── #555 same-domain precise definition/version schema read (pipe) ────────
// The read capability flows the SAME real pipeline (child tool → parent
// handler → gateway → transport). Allow / deny / honest-not-found against
// the mock svc; identity stays the ACTUAL caller (agt_family-steward-agent).
import { workflowDefinitionReadManifest } from '../packages/broker/src/capabilities/workflow-definition-read.js'
const readTool = registered.find((tool) => tool?.name === 'workflow_definition_read')
assert.ok(readTool, 'workflow_definition_read must be registered in child mode')
const readCalls = []
provided.set('agentRpc', {
  request: async (method, params) => ({
    ok: true,
    result: await createParentRpcHandler({
      agentId: 'agt_family-steward-agent',
      log: { log: () => {} },
      getProc: () => ({ state: 'READY', processGeneration: 1, executions: new Map() }),
      getBrokerGateway: () => ({
        execute: async (call, ctx) => { readCalls.push(call); return gateway.execute(call, ctx) },
      }),
      switchAgent: async () => { throw new Error('switch not used') },
    })(method, params, {}),
  }),
})
const detail = await readTool.execute({ operation: 'get_definition', domainId: 'e738b9af-b34f-46ee-8d60-e3c0db24d64d', definitionId: 'fa016161-d6d0-48b3-826f-b684b4439554' })
assert.equal(detail.ok, true)
assert.equal(detail.result.versions[0].version_status, 'PUBLISHED')
assert.ok(detail.result.versions[0].context_schema)
const denied = await readTool.execute({ operation: 'get_definition', domainId: 'e738b9af-b34f-46ee-8d60-e3c0db24d64d', definitionId: 'def-foreign' })
assert.equal(denied.ok, false)
assert.equal(denied.error.code, 'definition_not_found')
const missingField = await readTool.execute({ operation: 'get_definition', domainId: 'e738b9af-b34f-46ee-8d60-e3c0db24d64d' })
assert.equal(missingField.ok, false)
assert.equal(missingField.error.code, 'invalid_arguments')
console.log('[sh555] read pipe: allow (PUBLISHED + context_schema), deny (honest 404), missing-field (local invalid_arguments) — all through the real pipeline')
assert.equal(readCalls.length, 2)

console.log('[sh562] PIPE VERIFICATION PASSED — evidence written to', outDir)
await token.close()
await svc.close()
await rm(dir, { recursive: true, force: true })
