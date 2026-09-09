/**
 * @agent-core/broker — Governance V1 notification capability tests
 * (AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 AMENDMENT_1 §22.4).
 *
 * Covers the three AMENDMENT_1 normal-pack manifests (forum_notifications,
 * forum_notification_read, forum_notifications_read) and the forum_reply
 * `mentions` parameter: schema/scope contract, exact wire shapes, local
 * fail-closed argument validation, the server-enforced ≤100 batch guard
 * mapped as a clean tool error, the strict mention contract (server 400
 * UNKNOWN_MENTION_AGENT), and credential non-disclosure across channels.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

import { validateManifest } from '../src/schema.js'
import { buildToolDefinition } from '../src/registry.js'
import { createHttpTransport, createHttpHandlers } from '../src/transport.js'
import { targets } from '../src/targets.js'
import { manifests as forumManifests, normalManifests as forumNormalManifests } from '../src/capabilities/forum.js'
import { normalManifests as notificationManifests } from '../src/capabilities/forum-notifications.js'

// ─── Helpers (mirrors forum-capabilities.test.js) ───────────────────────────
function startMockServer(handler) {
  const requests = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const entry = {
        method: req.method,
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: req.headers,
        rawBody: raw,
        body: raw === '' ? undefined : safeJson(raw) ?? Object.fromEntries(new URLSearchParams(raw)),
      }
      requests.push(entry)
      handler(req, res, entry)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        origin: `http://127.0.0.1:${port}`,
        requests,
        close: () =>
          new Promise((r) => {
            server.closeAllConnections?.()
            server.close(r)
          }),
      })
    })
  })
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function startTokenServer() {
  return startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/oauth/token') {
      return json(res, 200, { access_token: 'tok-real', token_type: 'Bearer', expires_in: 300 })
    }
    json(res, 404, { error: 'not_found' })
  })
}

function mockTargets(overrides) {
  return targets.map((t) => (overrides[t.targetId] ? { ...t, allowedOrigin: overrides[t.targetId] } : t))
}

function wire(manifest, transport) {
  return buildToolDefinition({
    manifest,
    handlers: createHttpHandlers(manifest, transport),
    deps: { resolvePrincipal: () => undefined },
  })
}

async function captureChannels(definition, input) {
  let stdout = '', stderr = '', thrownError = null, result
  const [outWrite, errWrite] = [process.stdout.write, process.stderr.write]
  process.stdout.write = (chunk) => { stdout += String(chunk); return true }
  process.stderr.write = (chunk) => { stderr += String(chunk); return true }
  try { result = await definition.execute(input) } catch (error) { thrownError = String(error) } finally {
    [process.stdout.write, process.stderr.write] = [outWrite, errWrite]
  }
  return { result, thrownError, stdout, stderr }
}

const byId = Object.fromEntries(notificationManifests.map((m) => [m.id, m]))

// ─── Schema / scope contract ────────────────────────────────────────────────

test('AMENDMENT_1: three notification manifests validate with exact ids/scopes/routes', () => {
  assert.equal(notificationManifests.length, 3)
  for (const manifest of notificationManifests) {
    const res = validateManifest(manifest)
    assert.equal(res.ok, true, `${manifest.id}: ${res.errors?.join('; ')}`)
    for (const op of manifest.operations) {
      assert.ok(targets.some((t) => t.targetId === op.http.target), `${manifest.id}: unknown target`)
    }
  }
  assert.deepEqual(
    notificationManifests.map((m) => m.id).sort(),
    ['forum_notification_read', 'forum_notifications', 'forum_notifications_read'].sort(),
  )
  assert.deepEqual(byId.forum_notifications.requiredScopes, ['forum.read'])
  assert.deepEqual(byId.forum_notification_read.requiredScopes, ['forum.write'])
  assert.deepEqual(byId.forum_notifications_read.requiredScopes, ['forum.write'])
  const [list] = byId.forum_notifications.operations
  assert.equal(list.http.method, 'GET')
  assert.equal(list.http.path, '/api/notifications')
  assert.deepEqual(list.http.query, ['type', 'unread', 'threadId', 'page', 'limit'])
  assert.deepEqual(list.arguments.properties.type.enum, ['mention', 'thread_notice', 'moderator_notice'])
  const [read] = byId.forum_notification_read.operations
  assert.equal(read.http.path, '/api/notifications/{id}/read')
  assert.deepEqual(read.http.pathParams, ['id'])
  assert.deepEqual(read.arguments.required, ['id'])
  const [batch] = byId.forum_notifications_read.operations
  assert.equal(batch.http.path, '/api/notifications/read')
  assert.deepEqual(batch.http.body, ['ids'])
  assert.deepEqual(batch.arguments.required, ['ids'])
})

test('AMENDMENT_1: the three manifests are composed into the forum normal pack (every child)', () => {
  const packIds = forumNormalManifests.map((m) => m.id)
  for (const id of ['forum_notifications', 'forum_notification_read', 'forum_notifications_read']) {
    assert.ok(packIds.includes(id), `${id} must be registered for every Agent child`)
  }
  // The first-batch export stays exactly the seven frozen manifests.
  assert.equal(forumManifests.length, 7)
})

test('AMENDMENT_1: new manifests carry no identity/credential fields', () => {
  for (const m of notificationManifests) {
    const { definition } = wire(m, { execute: async () => ({ errorCode: 'credential_unavailable' }) })
    for (const banned of ['principalid', 'clientid', 'credential', 'secret', 'authorization', 'sessionkey', 'agentid']) {
      assert.ok(!Object.keys(definition.parameters).some((n) => n.toLowerCase().includes(banned)), `${m.id} must not expose "${banned}"`)
    }
  }
})

test('AMENDMENT_1: forum_reply exposes mentions as an optional formal JSON argument', () => {
  const reply = forumManifests.find((m) => m.id === 'forum_reply')
  const op = reply.operations[0]
  assert.deepEqual(op.arguments.required, ['threadId', 'content'])
  assert.equal(op.arguments.properties.mentions.type, 'json')
  assert.equal(op.arguments.properties.mentions.required, undefined)
  assert.deepEqual(op.http.body.slice(-1), ['mentions'])
})

// ─── Local fail-closed validation (zero transport calls) ────────────────────

test('AMENDMENT_1: missing required args fail locally as invalid_arguments', async () => {
  const transport = { execute: async () => { throw new Error('must not be called') } }
  for (const [id, operation, args] of [
    ['forum_notification_read', 'read', {}],
    ['forum_notifications_read', 'read_batch', {}],
  ]) {
    const { definition } = wire(byId[id], transport)
    const out = await definition.execute({ operation, ...args })
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'invalid_arguments', id)
  }
  // `type` enum fails closed locally.
  const { definition } = wire(byId.forum_notifications, transport)
  const out = await definition.execute({ operation: 'list', type: 'reaction' })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'invalid_arguments')
})

// ─── Hermetic end-to-end (mock svc-forum + token endpoint) ──────────────────

test('AMENDMENT_1: list/read/batch execute with exact wire shapes and scopes', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startMockServer((req, res, entry) => {
    const { method, pathname } = entry
    if (method === 'GET' && pathname === '/api/notifications') return json(res, 200, { notifications: [], page: 1 })
    if (method === 'POST' && pathname === '/api/notifications/n-1/read') return json(res, 200, { notification: { id: 'n-1', readAt: '2026-09-10T00:00:00Z' } })
    if (method === 'POST' && pathname === '/api/notifications/read') return json(res, 200, { marked: entry.body.ids.length })
    json(res, 404, { error: 'not_found' })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'writer', clientSecret: 'credential-canary-abc123' }) },
    targets: mockTargets({ 'svc-forum': forum.origin }),
    authServiceOrigin: tokenServer.origin,
  })

  const list = wire(byId.forum_notifications, transport)
  const l = await list.definition.execute({ operation: 'list', type: 'mention', unread: true, threadId: 't-1', page: 2, limit: 5 })
  assert.equal(l.ok, true)
  const listReq = forum.requests.find((r) => r.method === 'GET' && r.pathname === '/api/notifications')
  assert.deepEqual(listReq.query, { type: 'mention', unread: 'true', threadId: 't-1', page: '2', limit: '5' })
  assert.equal(tokenServer.requests.find((r) => r.body.scope === 'forum.read').body.resource, 'svc-forum')

  const read = wire(byId.forum_notification_read, transport)
  const r = await read.definition.execute({ operation: 'read', id: 'n-1' })
  assert.equal(r.ok, true)
  assert.ok(forum.requests.some((x) => x.method === 'POST' && x.pathname === '/api/notifications/n-1/read'))
  assert.equal(tokenServer.requests.find((x) => x.body.scope === 'forum.write').body.resource, 'svc-forum')

  const batch = wire(byId.forum_notifications_read, transport)
  const b = await batch.definition.execute({ operation: 'read_batch', ids: ['n-1', 'n-2'] })
  assert.equal(b.ok, true)
  assert.deepEqual(forum.requests.find((x) => x.method === 'POST' && x.pathname === '/api/notifications/read').body, { ids: ['n-1', 'n-2'] })

  await tokenServer.close()
  await forum.close()
})

test('AMENDMENT_1: batch >100 maps the server 400 to a clean tool error (server-enforced guard)', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startMockServer((req, res) => {
    json(res, 400, { error: 'bad_request', message: 'ids must not exceed 100 items per batch' })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'writer', clientSecret: 'credential-canary-abc123' }) },
    targets: mockTargets({ 'svc-forum': forum.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(byId.forum_notifications_read, transport)
  const ids = Array.from({ length: 101 }, (_, i) => `n-${i}`)
  const captured = await captureChannels(definition, { operation: 'read_batch', ids })
  assert.equal(captured.thrownError, null)
  assert.equal(captured.result.ok, false)
  assert.equal(captured.result.error.status, 400)
  assert.ok(!captured.result.ok || captured.result.error.code !== 'transport_failure', 'a 400 must not be misreported as transport_failure')
  await tokenServer.close()
  await forum.close()
})

test('AMENDMENT_1: strict mention contract — server 400 UNKNOWN_MENTION_AGENT maps cleanly', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startMockServer((req, res) => {
    json(res, 400, { error: 'UNKNOWN_MENTION_AGENT', message: 'unknown mention agent' })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'writer', clientSecret: 'credential-canary-abc123' }) },
    targets: mockTargets({ 'svc-forum': forum.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const reply = forumManifests.find((m) => m.id === 'forum_reply')
  const { definition } = wire(reply, transport)
  const captured = await captureChannels(definition, {
    operation: 'reply', threadId: 't-1', content: 'hello', mentions: ['agt_unknown-agent'],
  })
  assert.equal(captured.thrownError, null)
  assert.equal(captured.result.ok, false)
  assert.equal(captured.result.error.status, 400)
  const rendered = JSON.stringify(captured.result) + JSON.stringify(definition.output.render({ operation: 'reply' }, captured.result))
  for (const canary of ['credential-canary-abc123', 'tok-real', 'Bearer']) {
    assert.ok(!rendered.includes(canary), `leaked ${canary}`)
  }
  await tokenServer.close()
  await forum.close()
})

// ─── Channel coverage + secret canary scan (same discipline as V2 §10) ──────

test('AMENDMENT_1: three tools cover success and five failure channels with canary scans', async (t) => {
  const channels = ['success', 'downstream 4xx', 'downstream 5xx', 'token failure', 'network failure', 'malformed response']
  for (const [id, operation, args] of [
    ['forum_notifications', 'list', {}],
    ['forum_notification_read', 'read', { id: 'n-1' }],
    ['forum_notifications_read', 'read_batch', { ids: ['n-1'] }],
  ]) {
    for (const channel of channels) await t.test(`${id}: ${channel}`, async () => {
      const calls = { credentialCalls: 0, tokenCalls: 0, businessCalls: 0 }
      const headers = { 'content-type': 'application/json', 'x-secret-canary': 'header-canary-abc123' }
      const fetchImpl = async (url) => {
        if (String(url).endsWith('/oauth/token')) {
          calls.tokenCalls += 1
          if (channel === 'token failure') return new Response('{"error":"invalid_scope"}', { status: 400, headers })
          return new Response('{"access_token":"token-canary-abc123","expires_in":300}', { status: 200, headers })
        }
        calls.businessCalls += 1
        if (channel === 'network failure') throw new Error('DPoP abc123')
        if (channel === 'malformed response') return new Response('{broken', { status: 200, headers })
        const status = channel === 'downstream 4xx' ? 400 : channel === 'downstream 5xx' ? 500 : 200
        const body = status === 200 ? '{"fixture":"ok"}' : '{"error":{"message":"NTLM abc123"}}'
        return new Response(body, { status, headers })
      }
      const transport = createHttpTransport({
        credentialProvider: { getCredential: async () => { calls.credentialCalls += 1; return { clientId: 'writer', clientSecret: 'credential-canary-abc123' } } },
        targets: mockTargets({ 'svc-forum': 'https://forum.invalid' }), authServiceOrigin: 'https://auth.invalid', fetchImpl,
      })
      const { definition } = wire(byId[id], transport)
      const input = { operation, ...args }
      const capturedChannels = await captureChannels(definition, input)
      const { result } = capturedChannels
      assert.equal(capturedChannels.thrownError, null, `${id}/${channel} threw`)
      const expectedCode = { 'downstream 4xx': 'http_4xx', 'downstream 5xx': 'http_5xx', 'token failure': 'authorization_denied', 'network failure': 'transport_failure', 'malformed response': 'malformed_response' }[channel]
      assert.equal(result.ok, channel === 'success', `${id}/${channel}`)
      if (expectedCode) assert.equal(result.error.code, expectedCode, `${id}/${channel}`)
      assert.deepEqual(calls, { credentialCalls: 1, tokenCalls: 1, businessCalls: channel === 'token failure' ? 0 : 1 }, `${id}/${channel}`)
      const captured = JSON.stringify({ ...capturedChannels, modelEnvelope: result, renderer: definition.output.render(input, result) })
      for (const canary of ['credential-canary-abc123', 'token-canary-abc123', 'abc123']) assert.ok(!captured.includes(canary), `${id}/${channel} leaked ${canary}`)
    })
  }
})
