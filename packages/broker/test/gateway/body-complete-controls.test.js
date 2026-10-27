import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createTransportControl } from '../../src/transport/control.js'
import { createHttpTransport } from '../../src/transport.js'
import { readCompleteBody } from '../../src/capabilities/workflow-definition-read/complete-reader.js'
import { workflowCurrentTaskBodyCompleteManifest as manifest } from '../../src/capabilities/manifests.js'

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const sha = text => createHash('sha256').update(text).digest('hex')
const binding = { workflow_instance_id: id, definition_version_id: id, node_visit_id: id,
  workflow_state_version: 1, context_revision_id: id }
const argsFor = text => ({ workflowInstanceId: id, expectedDefinitionVersionId: id, expectedNodeVisitId: id,
  expectedWorkflowStateVersion: 1, expectedContextRevisionId: id, bodyKind: 'CURRENT_DETAIL', bodyId: id, expectedBodySha256: sha(text) })
const options = { deadlineMs: 30000, maxEntityBytes: 65536, maxTotalBytes: 2097152, maxAttempts: 32 }
const credential = { clientId: 'test-client', clientSecret: 'test-secret' }
const json = x => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } })
function page(text, offset, size = 8192) {
  const raw = Buffer.from(text), end = Math.min(offset + size, raw.length)
  return { view: 'body', binding, body: { kind: 'CURRENT_DETAIL', id, sha256: sha(text), encoding: 'utf-8', serialization: 'JCS',
    total_bytes: raw.length, offset, text: raw.subarray(offset, end).toString(), next_offset: end === raw.length ? null : end,
    content_status: end === raw.length ? 'COMPLETE' : 'TRUNCATED' } }
}
function setup(t, { text = '{}', fetchImpl, provider, controlOptions } = {}) {
  let calls = 0, tokens = 0
  const control = createTransportControl({ ...options, ...controlOptions })
  t.after(() => control.close())
  const transport = createHttpTransport({ targets: [{ targetId: 'svc-workflow', allowedOrigin: 'http://127.0.0.1:1234', audience: 'svc-workflow' }],
    authServiceOrigin: 'http://127.0.0.1:1234', credentialProvider: provider ?? { getCredential: async () => credential },
    fetchImpl: async (url, init) => {
      const token = url.endsWith('/oauth/token')
      if (token) tokens++; else calls++
      if (fetchImpl) return fetchImpl(url, init, { token, calls })
      return token ? json({ access_token: 'test-token', expires_in: 3600 }) : json(page(text, Number(new URL(url).searchParams.get('offset'))))
    } })
  return { control, counts: () => ({ calls, tokens }), run: () => readCompleteBody({ manifest,
    call: { operation: 'read', args: argsFor(text) }, context: { agentId: 'actor' }, transport, control }) }
}

for (const length of [131072, 131073]) test(`original size ${length} enforces first-page body cap`, async t => {
  const text = 'x'.repeat(length), f = setup(t, { text })
  const r = await f.run()
  if (length === 131072) {
    assert.equal(r.ok, true); assert.equal(r.result.body.text, text); assert.equal(f.counts().calls, 16)
  } else { assert.equal(r.error.code, 'current_task_body_limit_exceeded'); assert.equal(f.counts().calls, 1) }
})

for (const length of [32, 33]) test(`exact ${length} tiny pages stop without a 33rd HTTP call`, async t => {
  const text = 'x'.repeat(length)
  const f = setup(t, { text, fetchImpl: (url, init, { token }) => token ? json({ access_token: 't', expires_in: 3600 })
    : json(page(text, Number(new URL(url).searchParams.get('offset')), 1)) })
  const r = await f.run()
  assert.equal(f.counts().calls, 32)
  assert.equal(r.ok, length === 32)
  if (length === 33) assert.equal(r.error.code, 'current_task_body_limit_exceeded')
})

for (const bytes of [65536, 65537]) test(`one decoded entity boundary ${bytes}`, async t => {
  const control = createTransportControl(options); t.after(() => control.close())
  const response = new Response(' '.repeat(bytes))
  if (bytes === 65536) assert.equal(Buffer.byteLength(await control.readEntity(response)), bytes)
  else await assert.rejects(control.readEntity(response), e => e.kind === 'limit')
})

test('cumulative decoded entities accept exactly 2MiB then reject one more byte', async t => {
  const c = createTransportControl(options); t.after(() => c.close())
  for (let n = 0; n < 32; n++) await c.readEntity(new Response(' '.repeat(65536)))
  assert.equal(c.stats().totalBytes, 2097152)
  await assert.rejects(c.readEntity(new Response('x')), e => e.kind === 'limit')
})

test('valid worst escaped output remains below the success envelope cap', async t => {
  const text = '\u0000'.repeat(131072), f = setup(t, { text })
  const r = await f.run()
  assert.equal(r.ok, true)
  assert.equal(r.result.body.total_bytes, 131072)
  assert.ok(Buffer.byteLength(JSON.stringify(r)) < 1048576)
})

test('deadline includes delayed credential and blocks all subsequent HTTP', async t => {
  let clock = 0
  const f = setup(t, { controlOptions: { now: () => clock }, provider: { getCredential: async () => { clock = 30000; return credential } } })
  const r = await f.run()
  assert.equal(r.error.code, 'current_task_body_deadline_exceeded')
  assert.deepEqual(f.counts(), { calls: 0, tokens: 0 })
})

test('deadline includes token response and prevents a late body request', async t => {
  let clock = 0
  const f = setup(t, { controlOptions: { now: () => clock }, fetchImpl: () => {
    clock = 30001; return json({ access_token: 'late-token', expires_in: 3600 })
  } })
  const r = await f.run()
  assert.equal(r.error.code, 'current_task_body_deadline_exceeded')
  assert.deepEqual(f.counts(), { calls: 0, tokens: 1 })
})

test('deadline is checked before success even when the last page arrived', async t => {
  let clock = 0
  const f = setup(t, { controlOptions: { now: () => clock }, fetchImpl: (url, init, { token }) => {
    if (token) return json({ access_token: 't', expires_in: 3600 })
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(Buffer.from(JSON.stringify(page('{}', 0))))
      clock = 30000; controller.close()
    } }))
  } })
  assert.equal((await f.run()).error.code, 'current_task_body_deadline_exceeded')
  assert.equal(f.counts().calls, 1)
})

test('cancellation fails once and never issues a page', async t => {
  const ac = new AbortController(); ac.abort()
  const f = setup(t, { controlOptions: { signal: ac.signal } })
  assert.equal((await f.run()).error.code, 'transport_failure')
  assert.deepEqual(f.counts(), { calls: 0, tokens: 0 })
})

test('timed-out credential promise cannot launch HTTP when it eventually resolves', async t => {
  let release
  const f = setup(t, { controlOptions: { deadlineMs: 10 }, provider: { getCredential: () => new Promise(r => { release = r }) } })
  const r = await f.run()
  assert.equal(r.error.code, 'current_task_body_deadline_exceeded')
  release(credential)
  await new Promise(r => setImmediate(r))
  assert.deepEqual(f.counts(), { calls: 0, tokens: 0 })
})

for (const [status, oauth, code] of [[401, 'invalid_client', 'credential_invalid'], [403, 'insufficient_scope', 'authorization_denied']]) {
  test(`token denial ${status} retains its family and is not retried`, async t => {
    const f = setup(t, { fetchImpl: () => new Response(JSON.stringify({ error: oauth, secret: 'not-returned' }), { status }) })
    const r = await f.run()
    assert.equal(r.error.code, code); assert.equal(r.error.status, status)
    assert.deepEqual(f.counts(), { calls: 0, tokens: 1 }); assert.ok(!JSON.stringify(r).includes('not-returned'))
  })
}

for (const reason of ['cancellation', 'deadline']) test(`real streaming HTTP ${reason} aborts and leaves no late success`, async t => {
  let closedResolve, startedResolve
  const closed = new Promise(r => { closedResolve = r }), started = new Promise(r => { startedResolve = r })
  const server = createServer((req, res) => {
    if (req.url === '/oauth/token') { res.end(JSON.stringify({ access_token: 't', expires_in: 3600 })); return }
    res.writeHead(200, { 'content-type': 'application/json' }); res.write('{')
    res.on('close', closedResolve); startedResolve()
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)) })
  const origin = `http://127.0.0.1:${server.address().port}`, ac = new AbortController()
  const control = createTransportControl({ ...options, signal: ac.signal, ...(reason === 'deadline' ? { deadlineMs: 100 } : {}) }); t.after(() => control.close())
  const transport = createHttpTransport({ targets: [{ targetId: 'svc-workflow', allowedOrigin: origin, audience: 'svc-workflow' }],
    authServiceOrigin: origin, credentialProvider: { getCredential: async () => credential } })
  const result = readCompleteBody({ manifest, call: { operation: 'read', args: argsFor('{}') }, context: { agentId: 'actor' }, transport, control })
  await started
  if (reason === 'cancellation') ac.abort()
  const outcome = await result
  assert.equal(outcome.error.code, reason === 'deadline' ? 'current_task_body_deadline_exceeded' : 'transport_failure')
  await Promise.race([closed, new Promise((_, reject) => setTimeout(() => reject(Error('HTTP response was not aborted')), 1000))])
})


test('non-JSON token denial retains existing status classification', async t => {
  const f = setup(t, { fetchImpl: () => new Response('not-json-private', { status: 401 }) })
  const r = await f.run()
  assert.equal(r.error.code, 'transport_failure'); assert.equal(r.error.status, 401)
  assert.equal(f.counts().tokens, 1); assert.equal(f.counts().calls, 0)
})


test('deadline at delayed HTTP headers aborts and blocks every later page', async t => {
  let clock = 0
  const f = setup(t, { controlOptions: { now: () => clock }, fetchImpl: (url, init, { token }) => {
    if (token) return json({ access_token: 't', expires_in: 3600 })
    clock = 30001
    return json(page('{}', 0))
  } })
  assert.equal((await f.run()).error.code, 'current_task_body_deadline_exceeded')
  assert.equal(f.counts().calls, 1); assert.equal(f.control.signal.aborted, true)
})
