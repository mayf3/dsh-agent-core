import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { DEFAULT_MANIFESTS } from '../../src/index.js'
import * as manifests from '../../src/capabilities/manifests.js'
import { createBrokerGateway } from '../../src/gateway.js'
import { createRelayHandlers } from '../../src/relay.js'
import { buildToolDefinition } from '../../src/registry.js'

const id = 'workflow_current_task_body_complete'
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']
const sha = text => createHash('sha256').update(text).digest('hex')
const binding = { workflow_instance_id: ids[0], definition_version_id: ids[1], node_visit_id: ids[2],
  workflow_state_version: 7, context_revision_id: ids[3] }
const argsFor = text => ({ workflowInstanceId: ids[0], expectedDefinitionVersionId: ids[1],
  expectedNodeVisitId: ids[2], expectedWorkflowStateVersion: 7, expectedContextRevisionId: ids[3],
  bodyKind: 'CURRENT_DETAIL', bodyId: ids[2], expectedBodySha256: sha(text) })
const old = manifests.workflowCurrentTaskInputManifest
const complete = manifests.workflowCurrentTaskBodyCompleteManifest
// RED uses the exact requested identity with the old read's error table; the
// missing built-in LOCAL path must fail observably, not at module import.
const candidate = complete ?? { ...old, id, toolName: id, local: true,
  operations: [{ ...old.operations[0], http: undefined }] }

async function fixture(t, text, change = page => page) {
  const root = await mkdtemp(join(tmpdir(), 'body-complete-'))
  const credentialsFile = join(root, 'clients.json')
  await writeFile(credentialsFile, JSON.stringify({ version: 1, credentials: {
    actor: { clientId: 'synthetic-client', clientSecret: 'synthetic-secret' },
  } }))
  const requests = [], tokens = []
  const server = createServer((req, res) => {
    if (req.url === '/oauth/token') {
      let body = ''
      req.on('data', b => { body += b })
      req.on('end', () => { tokens.push(body); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ access_token: 'synthetic-token', expires_in: 3600 })) })
      return
    }
    requests.push({ url: req.url, authorization: req.headers.authorization })
    const u = new URL(req.url, 'http://localhost'), offset = Number(u.searchParams.get('offset'))
    const bytes = Buffer.from(text)
    let end = Math.min(bytes.length, offset + 8192)
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    const page = { view: 'body', binding, body: { kind: 'CURRENT_DETAIL', id: ids[2], sha256: sha(text), encoding: 'utf-8',
      serialization: 'JCS', total_bytes: bytes.length, offset, text: bytes.subarray(offset, end).toString('utf8'),
      next_offset: end === bytes.length ? null : end, content_status: end === bytes.length ? 'COMPLETE' : 'TRUNCATED' } }
    const result = change(structuredClone(page), requests.length, req, res)
    if (result === undefined) return
    res.writeHead(result.status ?? 200, { 'content-type': 'application/json', 'x-request-id': 'req-body-1', ...result.headers })
    res.end(typeof result.raw === 'string' || Buffer.isBuffer(result.raw) ? result.raw : JSON.stringify(result))
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); await rm(root, { recursive: true, force: true }) })
  const origin = `http://127.0.0.1:${server.address().port}`
  const gateway = createBrokerGateway({ manifests: [candidate, old], targets: [{ targetId: 'svc-workflow', allowedOrigin: origin, audience: 'svc-workflow' }], authServiceOrigin: origin, credentialsFile })
  const execute = args => gateway.execute({ capabilityId: id, operation: 'read', args }, { agentId: 'actor' })
  const tool = buildToolDefinition({ manifest: candidate, handlers: createRelayHandlers(candidate,
    async call => ({ ok: true, result: await gateway.execute(call, { agentId: 'actor' }) })) }).definition
  return { execute, requests, tokens, tool, gateway }
}

test('new complete-body manifest is a separate LOCAL scope-bound read', () => {
  assert.ok(complete, 'new complete-body manifest missing')
  assert.equal(complete.id, id)
  assert.ok(complete.local)
  assert.equal(DEFAULT_MANIFESTS.filter(m => m.id === id).length, 1)
  assert.deepEqual(complete.requiredScopes, ['workflow.read'])
  assert.deepEqual(complete.operations.map(x => x.name), ['read'])
})

test('mapped relay and trusted gateway return the full multibyte original from offset zero', async t => {
  const text = JSON.stringify({ original: '原文🌍'.repeat(7000) })
  const f = await fixture(t, text)
  const r = await f.tool.execute({ operation: 'read', ...argsFor(text) })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.result.view, 'complete_body')
  assert.equal(r.result.body.text, text)
  assert.equal(r.result.body.sha256, sha(text))
  assert.equal(r.result.body.total_bytes, Buffer.byteLength(text))
  assert.deepEqual(r.result.binding, binding)
  assert.equal(r.result.verification.page_count, f.requests.length)
  assert.equal(r.result.verification.sha256_verified, true)
  assert.ok(f.requests.length > 1)
  assert.equal(new URL(f.requests[0].url, 'http://localhost').searchParams.get('offset'), '0')
  const request = new URL(f.requests[0].url, 'http://localhost')
  assert.equal(request.pathname, `/internal/v1/workflow-instances/${ids[0]}/current-task-input`)
  assert.deepEqual([...request.searchParams.keys()].sort(), ['view', 'expectedNodeVisitId', 'expectedWorkflowStateVersion', 'expectedContextRevisionId', 'bodyKind', 'bodyId', 'offset', 'expectedBodySha256'].sort())
  assert.ok(f.requests.every(x => x.authorization === 'Bearer synthetic-token'))
  assert.equal(f.tokens.length, 1)
  assert.match(f.tokens[0], /scope=workflow.read/)
})

for (const [name, mutate] of [
  ['extra identity', a => ({ ...a, principalId: 'private-secret' })],
  ['partial binding', a => { delete a.expectedDefinitionVersionId; return a }],
  ['invalid UUID', a => ({ ...a, bodyId: 'bad' })],
  ['wrong current detail ID', a => ({ ...a, bodyId: ids[0] })],
  ['unsafe version', a => ({ ...a, expectedWorkflowStateVersion: 2 ** 53 })],
  ['bad digest', a => ({ ...a, expectedBodySha256: 'A'.repeat(64) })],
  ['caller budget', a => ({ ...a, timeout: 999999 })],
]) test(`reject ${name} before any token or HTTP`, async t => {
  const f = await fixture(t, '{}')
  const r = await f.execute(mutate(argsFor('{}')))
  assert.equal(r.ok, false); assert.equal(r.error.code, 'invalid_arguments')
  assert.equal(f.tokens.length, 0); assert.equal(f.requests.length, 0)
  assert.ok(!JSON.stringify(r).includes('private-secret'))
})

for (const [name, mutate] of [
  ['binding drift', p => { p.binding.context_revision_id = ids[0] }],
  ['definition drift', p => { p.binding.definition_version_id = ids[0] }],
  ['extra body key', p => { p.body.secret = 'must-not-leak' }],
  ['wrong offset', p => { p.body.offset++ }],
  ['gap', p => { p.body.next_offset++ }],
  ['OMITTED body', p => { p.body.content_status = 'OMITTED'; p.body.text = ''; p.body.next_offset = 0 }],
  ['surrogate', p => { p.body.text = '\ud800' }],
]) test(`fail whole operation on ${name}, without another page`, async t => {
  const text = JSON.stringify({ value: 'x'.repeat(20000) })
  const f = await fixture(t, text, p => { mutate(p); return p })
  const r = await f.execute(argsFor(text))
  assert.equal(r.ok, false); assert.equal(r.error.code, 'current_task_body_protocol_error')
  assert.equal(f.requests.length, 1); assert.ok(!JSON.stringify(r).includes('must-not-leak'))
  assert.equal(r.result, undefined)
})

test('complete bytes must match requested SHA, not just descriptor', async t => {
  const f = await fixture(t, 'true', p => { p.body.text = 'null'; return p })
  const r = await f.execute(argsFor('true'))
  assert.equal(r.error.code, 'current_task_body_digest_mismatch')
  assert.equal(f.requests.length, 1)
})

test('401 produces one GET with no refresh/reissue', async t => {
  const f = await fixture(t, '{}', () => ({ status: 401, raw: JSON.stringify({ error: { code: 'unauthorized', message: 'must-not-leak' } }) }))
  const r = await f.execute(argsFor('{}'))
  assert.equal(r.ok, false); assert.equal(r.error.status, 401)
  assert.equal(f.requests.length, 1); assert.equal(f.tokens.length, 1)
  assert.ok(!JSON.stringify(r).includes('must-not-leak'))
})

test('preserves declared stale service error/status/request ID without original', async t => {
  const f = await fixture(t, '{}', () => ({ status: 409, raw: JSON.stringify({ error: { code: 'current_task_input_stale', message: 'private-context' } }) }))
  const r = await f.execute(argsFor('{}'))
  assert.equal(r.error.code, 'current_task_input_stale'); assert.equal(r.error.status, 409)
  assert.equal(r.error.requestId, 'req-body-1'); assert.ok(!JSON.stringify(r).includes('private-context'))
})

test('oversized streamed entity fails before parsing', async t => {
  const f = await fixture(t, '{}', () => ({ raw: ' '.repeat(65537) }))
  const r = await f.execute(argsFor('{}'))
  assert.equal(r.error.code, 'current_task_body_limit_exceeded'); assert.equal(f.requests.length, 1)
})

test('malformed UTF8 wire bytes are not replaced', async t => {
  const f = await fixture(t, '{}', () => ({ raw: Buffer.from([0xc3, 0x28]) }))
  const r = await f.execute(argsFor('{}'))
  assert.equal(r.error.code, 'current_task_body_protocol_error')
})


test('a redirect cannot cause an uncounted second page request', async t => {
  const f = await fixture(t, '{}', (p, n) => n === 1 ? { status: 302, headers: { location: '/redirected' }, raw: '' } : p)
  const r = await f.execute(argsFor('{}'))
  assert.equal(r.ok, false)
  assert.equal(f.requests.length, 1)
})

test('standalone relay failures redact transport exception text', async () => {
  const relay = createRelayHandlers(candidate, async () => { throw new Error('private-path-SECRET') })
  const r = await relay.read('read', argsFor('{}'))
  assert.ok(!JSON.stringify(r).includes('private-path-SECRET'))
})


test('a broken credential store keeps the existing identity failure family', async () => {
  const gateway = createBrokerGateway({ manifests: [candidate], targets: [{ targetId: 'svc-workflow', allowedOrigin: 'http://127.0.0.1:1', audience: 'svc-workflow' }], authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile: '/not-a-real-synthetic-store/secret-path.json' })
  const r = await gateway.execute({ capabilityId: id, operation: 'read', args: argsFor('{}') }, { agentId: 'actor' })
  assert.equal(r.error.code, 'credential_unavailable')
  assert.ok(!JSON.stringify(r).includes('secret-path'))
})


test('HTTP200 errorCode text is malformed body data, not a trusted transport error', async t => {
  const f = await fixture(t, '{}', p => ({ ...p, errorCode: 'current_task_input_stale' }))
  const r = await f.execute(argsFor('{}'))
  assert.equal(r.error.code, 'current_task_body_protocol_error')
  assert.equal(r.error.status, undefined)
})


test('relay cannot promote malformed or partial parent data to complete success', async () => {
  for (const value of [null, {}, { view: 'complete_body', body: { text: 'prefix' } }]) {
    const relay = createRelayHandlers(candidate, async () => ({ ok: true, result: { ok: true, result: value } }))
    const r = await relay.read('read', argsFor('{}'))
    assert.equal(r?.errorCode, 'current_task_body_protocol_error')
  }
})


test('mapped pre-handler exceptions are fixed failures without private text', async () => {
  const tool = buildToolDefinition({ manifest: candidate, handlers: { read: async () => null },
    deps: { resolvePrincipal() { throw Error('private-mapper-SECRET') } } }).definition
  const r = await tool.execute({ operation: 'read', ...argsFor('{}') })
  assert.equal(r.ok, false)
  assert.ok(!JSON.stringify(r).includes('private-mapper-SECRET'))
})

test('mapped local handler cannot return partial original as success', async () => {
  const tool = buildToolDefinition({ manifest: candidate, handlers: { read: async () => ({ body: { text: 'prefix' } }) } }).definition
  const r = await tool.execute({ operation: 'read', ...argsFor('{}') })
  assert.equal(r.ok, false)
  assert.equal(r.error.code, 'current_task_body_protocol_error')
})


for (const [name, mutate] of [
  ['instance', p => { p.binding.workflow_instance_id = ids[1] }],
  ['visit', p => { p.binding.node_visit_id = ids[0] }],
  ['state', p => { p.binding.workflow_state_version++ }],
  ['total', p => { p.body.total_bytes++ }],
  ['kind', p => { p.body.kind = 'SUBMISSION_PAYLOAD' }],
  ['body ID', p => { p.body.id = ids[0] }],
  ['digest', p => { p.body.sha256 = 'f'.repeat(64) }],
  ['missing key', p => { delete p.body.encoding }],
  ['repeated offset', p => { p.body.offset = 0 }],
  ['overlap', p => { p.body.offset-- }],
  ['empty progress', p => { p.body.text = ''; p.body.next_offset = p.body.offset }],
  ['premature COMPLETE', p => { p.body.content_status = 'COMPLETE'; p.body.next_offset = null }],
]) test(`second-page ${name} violation discards the first page and never restarts`, async t => {
  const text = 'x'.repeat(20000), f = await fixture(t, text, (p, n) => { if (n === 2) mutate(p); return p })
  const r = await f.execute(argsFor(text))
  assert.equal(r.error.code, 'current_task_body_protocol_error')
  assert.equal(r.result, undefined); assert.equal(f.requests.length, 2)
})

for (const raw of ['null', '[]', 'not-json']) test(`invalid entity shape ${raw} fails closed`, async t => {
  const f = await fixture(t, '{}', () => ({ raw }))
  assert.equal((await f.execute(argsFor('{}'))).error.code, 'current_task_body_protocol_error')
  assert.equal(f.requests.length, 1)
})

test('mapped invalid arguments and rendered failure never echo caller contents', async t => {
  const f = await fixture(t, '{}'), args = { operation: 'read', ...argsFor('{}'), secret: 'PRIVATE'.repeat(20000) }
  const r = await f.tool.execute(args)
  const rendered = f.tool.output.render(args, r)
  for (const value of [r, rendered]) {
    assert.ok(Buffer.byteLength(JSON.stringify(value)) < 4096)
    assert.ok(!JSON.stringify(value).includes('PRIVATE'))
  }
  assert.equal(f.requests.length, 0); assert.equal(f.tokens.length, 0)
})

test('parsed UUID spellings use canonical wire/output identity', async t => {
  const f = await fixture(t, '{}'), a = argsFor('{}')
  a.workflowInstanceId = a.workflowInstanceId.replaceAll('-', '')
  a.expectedNodeVisitId = `urn:uuid:${a.expectedNodeVisitId}`
  a.bodyId = `{${a.bodyId}}`
  const r = await f.execute(a)
  assert.equal(r.ok, true); assert.deepEqual(r.result.binding, binding)
})
