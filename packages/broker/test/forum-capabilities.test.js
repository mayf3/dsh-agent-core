/**
 * @agent-core/broker — Forum V2 capability matrix tests.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

import { validateManifest } from '../src/schema.js'
import { buildToolDefinition } from '../src/registry.js'
import { createHttpTransport, createHttpHandlers } from '../src/transport.js'
import { targets } from '../src/targets.js'
import { manifests as forumManifests } from '../src/capabilities/forum.js'
// ─── Helpers ────────────────────────────────────────────────────────────────
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

/** Mock auth-service token endpoint; records every token request. */
async function startTokenServer() {
  return startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/oauth/token') {
      return json(res, 200, { access_token: 'tok-real', token_type: 'Bearer', expires_in: 300 })
    }
    json(res, 404, { error: 'not_found' })
  })
}

/** Wire a manifest through buildToolDefinition + the real transport. */
function wire(manifest, transport) {
  return buildToolDefinition({
    manifest,
    handlers: createHttpHandlers(manifest, transport),
    deps: { resolvePrincipal: () => undefined },
  })
}

/**
 * Targets with the REAL deployed origins replaced by mock-server origins, so
 * fixtures stay hermetic (the real svc-forum/workflow/okr may be running on
 * this machine and would answer with 401 TOKEN_INVALID_OR_EXPIRED otherwise).
 */
function mockTargets(overrides) {
  return targets.map((t) => (overrides[t.targetId] ? { ...t, allowedOrigin: overrides[t.targetId] } : t))
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
// ═══ AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 (accepted) ═════════════════
//
// Second-batch Forum capability tests: the 5-tool normal pack, the 8-tool
// moderator pack (exact three-scope contract), local fail-fast validation
// (nonBlank / closed enums), soft-delete-only bindings, admin unread scope,
// and the seven first-batch Forum tools' zero-regression projection.

import {
  normalManifests as forumNormalManifests,
} from '../src/capabilities/forum.js'
import { moderatorManifests as forumModeratorManifests } from '../src/capabilities/forum-moderation.js'

const MODERATOR_SCOPES = ['forum.read', 'forum.write', 'forum.moderate']
const TOOL_CHANNEL_FIXTURES = [
  ['forum_create_thread', 'create', { title: 'fixture' }], ['forum_watch_thread', 'watch', { threadId: 't-1' }],
  ['forum_unwatch_thread', 'unwatch', { threadId: 't-1' }], ['forum_report_content', 'report', { targetType: 'thread', targetId: 't-1', reason: 'spam' }],
  ['forum_stats', 'stats', {}], ['forum_pin_or_feature_thread', 'set_pinned', { threadId: 't-1', pinned: true }],
  ['forum_delete_thread', 'delete_thread', { threadId: 't-1' }], ['forum_delete_message', 'delete_message', { threadId: 't-1', messageId: 'm-1' }],
  ['forum_resolve_thread', 'resolve', { threadId: 't-1', summaryMd: 'done' }], ['forum_archive_thread', 'archive', { threadId: 't-1' }],
  ['forum_moderation_queue', 'list', {}], ['forum_handle_report', 'handle', { reportId: 'r-1', action: 'ignore' }],
  ['forum_admin_unread', 'unread', {}],
]

// ─── Schema: all 13 second-batch manifests validate; PATCH is allowed ───────
test('schema: all 13 second-batch Forum manifests validate (5 normal + 8 moderator)', () => {
  assert.equal(forumNormalManifests.length, 5)
  assert.equal(forumModeratorManifests.length, 8)
  for (const manifest of [...forumNormalManifests, ...forumModeratorManifests]) {
    const res = validateManifest(manifest)
    assert.equal(res.ok, true, `${manifest.id}: ${res.errors?.join('; ')}`)
    for (const op of manifest.operations) {
      assert.ok(targets.some((t) => t.targetId === op.http.target), `${manifest.id}: unknown target`)
      assert.ok(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(op.http.method), `${manifest.id}: bad method`)
    }
  }
})

test('CTR-FMC-002/003: exact tool ids and exact scope arrays', () => {
  assert.deepEqual(
    [...forumNormalManifests.map((m) => m.id), ...forumModeratorManifests.map((m) => m.id)].sort(),
    [
      'forum_create_thread', 'forum_watch_thread', 'forum_unwatch_thread', 'forum_report_content', 'forum_stats',
      'forum_pin_or_feature_thread', 'forum_delete_thread', 'forum_delete_message', 'forum_resolve_thread',
      'forum_archive_thread', 'forum_moderation_queue', 'forum_handle_report', 'forum_admin_unread',
    ].sort(),
  )
  const byId = Object.fromEntries([...forumNormalManifests, ...forumModeratorManifests].map((m) => [m.id, m]))
  assert.deepEqual(byId.forum_create_thread.requiredScopes, ['forum.write'])
  assert.deepEqual(byId.forum_watch_thread.requiredScopes, ['forum.write'])
  assert.deepEqual(byId.forum_unwatch_thread.requiredScopes, ['forum.write'])
  assert.deepEqual(byId.forum_report_content.requiredScopes, ['forum.write'])
  assert.deepEqual(byId.forum_stats.requiredScopes, ['forum.read'])
  for (const id of ['forum_pin_or_feature_thread', 'forum_delete_thread', 'forum_delete_message', 'forum_resolve_thread', 'forum_archive_thread', 'forum_moderation_queue', 'forum_handle_report', 'forum_admin_unread']) {
    assert.deepEqual(byId[id].requiredScopes, MODERATOR_SCOPES, `${id} must require exactly the three moderator scopes`)
  }
  for (const m of [...forumNormalManifests, ...forumModeratorManifests]) {
    assert.ok(!m.requiredScopes.includes('*'), `${m.id} must not use wildcards`)
  }
})

test('CTR-FMC-011: new tool parameter schemas carry no identity/credential fields', () => {
  for (const m of [...forumNormalManifests, ...forumModeratorManifests]) {
    const { definition } = wire(m, { execute: async () => ({ errorCode: 'credential_unavailable' }) })
    const names = Object.keys(definition.parameters)
    for (const banned of ['principalid', 'clientid', 'credential', 'secret', 'authorization', 'sessionkey']) {
      assert.ok(!names.some((n) => n.toLowerCase().includes(banned)), `${m.id} must not expose "${banned}"`)
    }
    // agentId is allowed ONLY as the admin-unread single-agent business filter,
    // never as a caller-identity field on any other tool.
    if (names.includes('agentId')) assert.equal(m.id, 'forum_admin_unread')
  }
})

// ─── Zero regression: the seven first-batch Forum tools are invariant ───────

test('CTR-FMC-010: the seven first-batch Forum tools keep their frozen projections', () => {
  const FROZEN = {
    forum_my_notifications: { scopes: ['forum.read'], ops: { list: ['GET', '/api/me/notifications'] } },
    forum_read_thread: { scopes: ['forum.read'], ops: { read: ['GET', '/api/threads/{threadId}'] } },
    forum_read_transcript: { scopes: ['forum.read'], ops: { read: ['GET', '/api/threads/{threadId}/transcript'] } },
    forum_reply: { scopes: ['forum.write'], ops: { reply: ['POST', '/api/threads/{threadId}/messages'] } },
    forum_mark_read: { scopes: ['forum.write'], ops: { mark_read: ['PUT', '/api/threads/{threadId}/read'] } },
    forum_list_threads: { scopes: ['forum.read'], ops: { list: ['GET', '/api/threads'] } },
    forum_search_threads: { scopes: ['forum.read'], ops: { search: ['GET', '/api/search'] } },
  }
  assert.equal(forumManifests.length, 7)
  for (const m of forumManifests) {
    const frozen = FROZEN[m.id]
    assert.ok(frozen !== undefined, `unexpected first-batch manifest ${m.id}`)
    assert.deepEqual(m.requiredScopes, frozen.scopes, `${m.id} scopes drifted`)
    for (const op of m.operations) {
      const [method, path] = frozen.ops[op.name]
      assert.equal(op.http.method, method, `${m.id}.${op.name} method drifted`)
      assert.equal(op.http.path, path, `${m.id}.${op.name} path drifted`)
    }
    // The moderator kinds stay unexposed on forum_reply (reviewer-safe enum).
    if (m.id === 'forum_reply') {
      const kinds = m.operations[0].arguments.properties.kind.enum
      assert.deepEqual(kinds, ['comment', 'proposal', 'challenge', 'clarification', 'evidence'])
    }
  }
})

// ─── Normal pack end-to-end (hermetic mock svc-forum + token endpoint) ──────

async function startForumMock() {
  return startMockServer((req, res, entry) => {
    const { method, pathname } = entry
    if (method === 'POST' && pathname === '/api/threads') return json(res, 201, { thread: { id: 't-9', title: entry.body.title } })
    if (method === 'PUT' && pathname === '/api/threads/t-1/watch') return json(res, 200, { participant: { threadId: 't-1', watching: true } })
    if (method === 'DELETE' && pathname === '/api/threads/t-1/watch') return json(res, 200, { participant: { threadId: 't-1', watching: false } })
    if (method === 'POST' && pathname === '/api/reports') return json(res, 201, { report: { id: 'r-1', status: 'pending' } })
    if (method === 'GET' && pathname === '/api/stats') return json(res, 200, { threads: { total: 3 }, messages: { total: 10 } })
    if (method === 'PATCH' && pathname === '/api/threads/t-1') return json(res, 200, { thread: { id: 't-1', ...entry.body } })
    if (method === 'DELETE' && pathname === '/api/threads/t-1') return json(res, 200, { thread: { id: 't-1', status: 'deleted' } })
    if (method === 'DELETE' && pathname === '/api/threads/t-1/messages/m-1') return json(res, 200, { ok: true })
    if (method === 'POST' && pathname === '/api/threads/t-1/resolve') return json(res, 200, { thread: { id: 't-1', status: 'resolved' } })
    if (method === 'POST' && pathname === '/api/threads/t-1/archive') return json(res, 200, { thread: { id: 't-1', status: 'archived' } })
    if (method === 'GET' && pathname === '/api/reports') return json(res, 200, { items: [], total: 0, page: 1, limit: 20 })
    if (method === 'PATCH' && pathname === '/api/reports/r-1') return json(res, 200, { report: { id: 'r-1', status: 'warned' } })
    if (method === 'GET' && pathname === '/api/admin/notifications/unread') return json(res, 200, { total: 0, items: [] })
    json(res, 404, { error: 'not_found' })
  })
}

function moderatorTransport(forum, tokenServer) {
  return createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'mod-client', clientSecret: 'mod-secret' }) },
    targets: mockTargets({ 'svc-forum': forum.origin }),
    authServiceOrigin: tokenServer.origin,
  })
}

test('normal pack: create/watch/unwatch/report/stats execute with exact wire shapes', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startForumMock()
  const transport = moderatorTransport(forum, tokenServer)
  const byId = Object.fromEntries(forumNormalManifests.map((m) => [m.id, m]))

  // create: title nonBlank enforced locally (missing / empty / whitespace)
  const create = wire(byId.forum_create_thread, { execute: async () => ({ errorCode: 'x' }) })
  for (const bad of [undefined, '', '   ']) {
    const args = { type: 'discussion' }
    if (bad !== undefined) args.title = bad
    const out = await create.definition.execute({ operation: 'create', ...args })
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'invalid_arguments')
  }
  // create: valid → exact POST body
  const create2 = wire(byId.forum_create_thread, transport)
  const res = await create2.definition.execute({ operation: 'create', title: 'Release checklist', tags: ['ops'] })
  assert.equal(res.ok, true)
  const biz = forum.requests.find((r) => r.method === 'POST' && r.pathname === '/api/threads')
  assert.deepEqual(biz.body, { title: 'Release checklist', tags: ['ops'] })
  assert.equal(biz.headers.authorization, 'Bearer tok-real')
  const tok = tokenServer.requests.find((r) => r.body.scope === 'forum.write')
  assert.equal(tok.body.resource, 'svc-forum')

  // watch / unwatch: exact PUT/DELETE paths, forum.write scope
  const watch = wire(byId.forum_watch_thread, transport)
  const w = await watch.definition.execute({ operation: 'watch', threadId: 't-1' })
  assert.equal(w.ok, true)
  const unwatch = wire(byId.forum_unwatch_thread, transport)
  const u = await unwatch.definition.execute({ operation: 'unwatch', threadId: 't-1' })
  assert.equal(u.ok, true)
  assert.ok(forum.requests.some((r) => r.method === 'PUT' && r.pathname === '/api/threads/t-1/watch'))
  assert.ok(forum.requests.some((r) => r.method === 'DELETE' && r.pathname === '/api/threads/t-1/watch'))

  // report: closed enums validated locally; valid reaches POST /api/reports
  const report = wire(byId.forum_report_content, { execute: async () => ({ errorCode: 'x' }) })
  for (const bad of [
    { targetType: 'post', targetId: 't-1', reason: 'spam' },
    { targetType: 'thread', targetId: 't-1', reason: 'rude' },
    { targetType: 'thread' },
  ]) {
    const out = await report.definition.execute({ operation: 'report', ...bad })
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'invalid_arguments')
  }
  const report2 = wire(byId.forum_report_content, transport)
  const r = await report2.definition.execute({ operation: 'report', targetType: 'thread', targetId: 't-1', reason: 'spam', note: 'n' })
  assert.equal(r.ok, true)
  assert.deepEqual(forum.requests.find((x) => x.method === 'POST' && x.pathname === '/api/reports').body, {
    targetType: 'thread', targetId: 't-1', reason: 'spam', note: 'n',
  })

  // stats: GET, forum.read scope only
  const stats = wire(byId.forum_stats, transport)
  const s = await stats.definition.execute({ operation: 'stats' })
  assert.equal(s.ok, true)
  assert.equal(tokenServer.requests.find((x) => x.body.scope === 'forum.read').body.resource, 'svc-forum')
  assert.ok(forum.requests.some((x) => x.method === 'GET' && x.pathname === '/api/stats'))

  await tokenServer.close()
  await forum.close()
})

// ─── Moderator pack end-to-end ───────────────────────────────────────────────

test('moderator pack: pin/feature via PATCH with only the selected flag', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startForumMock()
  const transport = moderatorTransport(forum, tokenServer)
  const { definition } = wire(forumModeratorManifests.find((m) => m.id === 'forum_pin_or_feature_thread'), transport)

  const p = await definition.execute({ operation: 'set_pinned', threadId: 't-1', pinned: true })
  assert.equal(p.ok, true)
  const f = await definition.execute({ operation: 'set_featured', threadId: 't-1', featured: false })
  assert.equal(f.ok, true)
  const patches = forum.requests.filter((r) => r.method === 'PATCH')
  assert.equal(patches.length, 2)
  assert.equal(patches[0].pathname, '/api/threads/t-1')
  assert.deepEqual(patches[0].body, { pinned: true })
  assert.deepEqual(patches[1].body, { featured: false })
  assert.equal(patches[0].headers.authorization, 'Bearer tok-real')
  // exact three-scope token request
  const mod = tokenServer.requests.find((r) => r.body.scope === MODERATOR_SCOPES.join(' '))
  assert.equal(mod.body.resource, 'svc-forum')

  await tokenServer.close()
  await forum.close()
})

test('moderator pack: thread/message delete bind ONLY the deployed soft-delete endpoints', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startForumMock()
  const transport = moderatorTransport(forum, tokenServer)

  const dt = wire(forumModeratorManifests.find((m) => m.id === 'forum_delete_thread'), transport)
  const r1 = await dt.definition.execute({ operation: 'delete_thread', threadId: 't-1' })
  assert.equal(r1.ok, true)
  const dm = wire(forumModeratorManifests.find((m) => m.id === 'forum_delete_message'), transport)
  const r2 = await dm.definition.execute({ operation: 'delete_message', threadId: 't-1', messageId: 'm-1' })
  assert.equal(r2.ok, true)
  const del = forum.requests.filter((r) => r.method === 'DELETE')
  assert.deepEqual(del.map((r) => r.pathname).sort(), ['/api/threads/t-1', '/api/threads/t-1/messages/m-1'].sort())
  assert.ok(del.every((r) => r.rawBody === '' || r.rawBody === undefined), 'deletes carry no body (soft delete only)')

  await tokenServer.close()
  await forum.close()
})

test('CTR-FMC-006: resolve requires nonBlank summaryMd locally (zero transport calls)', async () => {
  const manifest = forumModeratorManifests.find((m) => m.id === 'forum_resolve_thread')
  let calls = 0
  const spy = { execute: async () => { calls += 1; return { errorCode: 'x' } } }
  const { definition } = wire(manifest, spy)
  for (const bad of [undefined, '', '   \t  ']) {
    const args = { threadId: 't-1' }
    if (bad !== undefined) args.summaryMd = bad
    const out = await definition.execute({ operation: 'resolve', ...args })
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'invalid_arguments')
  }
  assert.equal(calls, 0, 'no token mint / no HTTP before local validation passes')

  const tokenServer = await startTokenServer()
  const forum = await startForumMock()
  const transport = moderatorTransport(forum, tokenServer)
  const { definition: def2 } = wire(manifest, transport)
  const res = await def2.execute({ operation: 'resolve', threadId: 't-1', summaryMd: '## Outcome\nshipped', openQuestionsJson: [] })
  assert.equal(res.ok, true)
  assert.deepEqual(forum.requests.find((r) => r.pathname === '/api/threads/t-1/resolve').body, {
    summaryMd: '## Outcome\nshipped', openQuestionsJson: [],
  })
  await tokenServer.close()
  await forum.close()
})

test('moderator pack: archive posts the exact endpoint with an empty body', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startForumMock()
  const transport = moderatorTransport(forum, tokenServer)
  const { definition } = wire(forumModeratorManifests.find((m) => m.id === 'forum_archive_thread'), transport)
  const res = await definition.execute({ operation: 'archive', threadId: 't-1' })
  assert.equal(res.ok, true)
  const req = forum.requests.find((r) => r.method === 'POST' && r.pathname === '/api/threads/t-1/archive')
  assert.ok(req !== undefined)
  assert.ok(req.rawBody === '' || req.rawBody === undefined)
  await tokenServer.close()
  await forum.close()
})

test('moderator pack: queue query mapping + status/targetType enums local fail-fast', async () => {
  const manifest = forumModeratorManifests.find((m) => m.id === 'forum_moderation_queue')
  let calls = 0
  const spy = { execute: async () => { calls += 1; return { errorCode: 'x' } } }
  const { definition: strict } = wire(manifest, spy)
  for (const bad of [{ status: 'open' }, { targetType: 'user' }, { page: 'one' }]) {
    const out = await strict.execute({ operation: 'list', ...bad })
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'invalid_arguments')
  }
  assert.equal(calls, 0)

  const tokenServer = await startTokenServer()
  const forum = await startForumMock()
  const transport = moderatorTransport(forum, tokenServer)
  const { definition } = wire(manifest, transport)
  const res = await definition.execute({ operation: 'list', status: 'pending', targetType: 'thread', page: 2, limit: 50 })
  assert.equal(res.ok, true)
  const req = forum.requests.find((r) => r.method === 'GET' && r.pathname === '/api/reports')
  assert.equal(req.query.status, 'pending')
  assert.equal(req.query.targetType, 'thread')
  assert.equal(req.query.page, '2')
  assert.equal(req.query.limit, '50')
  await tokenServer.close()
  await forum.close()
})

test('CTR-FMC-007: handle_report action closed to ignore|warn|delete locally', async () => {
  const manifest = forumModeratorManifests.find((m) => m.id === 'forum_handle_report')
  let calls = 0
  const spy = { execute: async () => { calls += 1; return { errorCode: 'x' } } }
  const { definition: strict } = wire(manifest, spy)
  for (const action of ['ban', 'mute', 'DELETE', '']) {
    const out = await strict.execute({ operation: 'handle', reportId: 'r-1', action })
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'invalid_arguments')
  }
  assert.equal(calls, 0)

  const tokenServer = await startTokenServer()
  const forum = await startForumMock()
  const transport = moderatorTransport(forum, tokenServer)
  const { definition } = wire(manifest, transport)
  const handled = []
  for (const action of ['ignore', 'warn', 'delete']) {
    const res = await definition.execute({ operation: 'handle', reportId: 'r-1', action, note: `n-${action}` })
    assert.equal(res.ok, true)
    const req = forum.requests.find((r) => r.method === 'PATCH' && r.pathname === '/api/reports/r-1' && r.body.action === action)
    assert.ok(req !== undefined, `no PATCH captured for action ${action}`)
    assert.deepEqual(req.body, { action, note: `n-${action}` })
    handled.push(req.body.action)
  }
  assert.deepEqual(handled, ['ignore', 'warn', 'delete'])
  await tokenServer.close()
  await forum.close()
})

test('all 13 new tools cover success and five failure channels with canary scans', async (t) => {
  const manifests = Object.fromEntries([...forumNormalManifests, ...forumModeratorManifests].map((m) => [m.id, m]))
  const channels = ['success', 'downstream 4xx', 'downstream 5xx', 'token failure', 'network failure', 'malformed response']
  for (const [id, operation, args] of TOOL_CHANNEL_FIXTURES) {
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
      const { definition } = wire(manifests[id], transport)
      const input = { operation, ...args }
      const capturedChannels = await captureChannels(definition, input)
      const { result } = capturedChannels
      assert.equal(capturedChannels.thrownError, null, `${id}/${channel} threw`)
      const expectedCode = { 'downstream 4xx': 'http_4xx', 'downstream 5xx': 'http_5xx', 'token failure': 'authorization_denied', 'network failure': 'transport_failure', 'malformed response': 'malformed_response' }[channel]
      assert.equal(result.ok, channel === 'success', `${id}/${channel}`)
      if (expectedCode) assert.equal(result.error.code, expectedCode, `${id}/${channel}`)
      if (channel === 'token failure' && manifests[id].requiredScopes.includes('forum.moderate')) assert.equal(result.error.code, 'authorization_denied', `${id}: writer-only moderator denial`)
      assert.deepEqual(calls, { credentialCalls: 1, tokenCalls: 1, businessCalls: channel === 'token failure' ? 0 : 1 }, `${id}/${channel}`)
      const captured = JSON.stringify({ ...capturedChannels, modelEnvelope: result, renderer: definition.output.render(input, result) })
      for (const canary of ['credential-canary-abc123', 'token-canary-abc123', 'abc123']) assert.ok(!captured.includes(canary), `${id}/${channel} leaked ${canary}`)
    })
  }
})

test('CTR-FMC-005: admin unread uses exactly the moderator scopes', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startForumMock()
  const transport = moderatorTransport(forum, tokenServer)
  const { definition } = wire(forumModeratorManifests.find((m) => m.id === 'forum_admin_unread'), transport)
  const zero = await definition.execute({ operation: 'unread' })
  assert.equal(zero.ok, true)
  assert.deepEqual(forum.requests.at(-1).query, {})
  const res = await definition.execute({
    operation: 'unread', reason: 'mention', since: '2026-08-28T00:00:00Z', agentId: 'agt_other-agent',
  })
  assert.equal(res.ok, true)
  const req = forum.requests.at(-1)
  assert.equal(req.method, 'GET')
  assert.equal(req.query.reason, 'mention')
  assert.equal(req.query.since, '2026-08-28T00:00:00Z')
  assert.equal(req.query.agentId, 'agt_other-agent')
  assert.ok(tokenServer.requests.every((r) => r.body.scope === MODERATOR_SCOPES.join(' ')))
  await tokenServer.close()
  await forum.close()
})
