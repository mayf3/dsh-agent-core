/**
 * @agent-core/broker — Forum Governance V1 moderator manifests tests
 * (AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 AMENDMENT_2).
 *
 * New-file rule per AMENDMENT_1 §22.2 precedent (forum-capabilities.test.js
 * is at its frozen line budget): all AMENDMENT_2 assertions live here. Pure
 * schema/wiring assertions plus hermetic mock-transport wire tests; no real
 * network, no credentials.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { validateManifest } from '../src/schema.js'
import { buildToolDefinition } from '../src/registry.js'
import { createHttpHandlers, createHttpTransport } from '../src/transport.js'
import { targets } from '../src/targets.js'
import { moderatorManifests as forumModeratorManifests } from '../src/capabilities/forum-moderation.js'
import { governanceModeratorManifests, forumHideThreadManifest, forumAuditLogsManifest, forumCloseThreadManifest, forumRestoreThreadManifest } from '../src/capabilities/forum-governance.js'
import { manifests as forumManifests, normalManifests as forumNormalManifests } from '../src/capabilities/forum.js'

const MODERATOR_SCOPES = ['forum.read', 'forum.write', 'forum.moderate']
const here = dirname(fileURLToPath(import.meta.url))

// ─── Schema & pack semantics ─────────────────────────────────────────────────

test('AMENDMENT_2 schema: all four governance manifests validate with exact moderator scopes', () => {
  assert.equal(governanceModeratorManifests.length, 4)
  for (const manifest of governanceModeratorManifests) {
    const res = validateManifest(manifest)
    assert.equal(res.ok, true, `${manifest.id}: ${res.errors?.join('; ')}`)
    assert.deepEqual(manifest.requiredScopes, MODERATOR_SCOPES)
    for (const op of manifest.operations) {
      assert.equal(op.http.target, 'svc-forum')
      assert.ok(['GET', 'POST'].includes(op.http.method), `${manifest.id}: bad method`)
    }
  }
})

test('AMENDMENT_2 composition: moderator pack grows to 12 and stays OUT of the normal/first-batch packs', () => {
  assert.equal(forumModeratorManifests.length, 12)
  const governanceIds = new Set(governanceModeratorManifests.map((m) => m.id))
  for (const m of [...forumNormalManifests, ...forumManifests]) {
    assert.equal(governanceIds.has(m.id), false, `${m.id} must not leak into the normal pack`)
  }
  // Every governance manifest is reachable through the gated moderator pack.
  const packIds = new Set(forumModeratorManifests.map((m) => m.id))
  for (const id of governanceIds) assert.ok(packIds.has(id), `${id} missing from moderator pack`)
})

test('AMENDMENT_2 bindings: exact deployed endpoints at agent-forum 87e4677', () => {
  const byId = Object.fromEntries(governanceModeratorManifests.map((m) => [m.id, m]))
  const op = (id) => byId[id].operations[0]
  assert.deepEqual([op('forum_close_thread').http.method, op('forum_close_thread').http.path], ['POST', '/api/threads/{threadId}/close'])
  assert.deepEqual([op('forum_hide_thread').http.method, op('forum_hide_thread').http.path], ['POST', '/api/threads/{threadId}/hide'])
  assert.deepEqual([op('forum_restore_thread').http.method, op('forum_restore_thread').http.path], ['POST', '/api/threads/{threadId}/restore'])
  assert.deepEqual([op('forum_audit_logs').http.method, op('forum_audit_logs').http.path], ['GET', '/api/admin/audit-logs'])
  assert.deepEqual(op('forum_close_thread').http.body, ['reason'])
  assert.deepEqual(op('forum_hide_thread').http.body, ['reason'])
  assert.deepEqual(
    op('forum_audit_logs').http.query,
    ['eventType', 'targetType', 'targetId', 'actorAgentId', 'page', 'limit'],
  )
  // pathParams binding for the three lifecycle actions
  for (const id of ['forum_close_thread', 'forum_hide_thread', 'forum_restore_thread']) {
    assert.deepEqual(op(id).http.pathParams, ['threadId'])
  }
})

test('CTR-FMC-011 continuity: no identity/credential field in governance argument schemas', () => {
  const forbidden = ['agentid', 'agent_id', 'callerid', 'caller_id', 'principalid', 'principal_id', 'token', 'secret', 'authorization', 'password']
  for (const manifest of governanceModeratorManifests) {
    for (const op of manifest.operations) {
      for (const name of Object.keys(op.arguments.properties)) {
        assert.equal(forbidden.includes(name.toLowerCase()), false, `${manifest.id}.${name} looks like an identity/credential field`)
      }
    }
  }
})

test('AMENDMENT_2 authority: V2 spec carries the §23 amendment record bound to this goal', () => {
  const spec = readFileSync(join(here, '..', '..', '..', 'docs', 'specs', 'AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2.md'), 'utf8')
  assert.ok(spec.includes('## 23. AMENDMENT_2'), 'spec §23 AMENDMENT_2 section present')
  for (const needle of ['forum_close_thread', 'forum_hide_thread', 'forum_restore_thread', 'forum_audit_logs', 'DIRECT_BROADCAST = CONTRACT_GAP', 'PHYSICAL_DELETE = OUT_OF_SCOPE']) {
    assert.ok(spec.includes(needle), `spec §23 must mention ${needle}`)
  }
})

// ─── Hermetic wire tests (mock svc-forum; no credentials, no network) ────────

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
        rawBody: raw,
        body: raw === '' ? undefined : safeJson(raw),
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
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r) }),
      })
    })
  })
}

function safeJson(raw) {
  try { return JSON.parse(raw) } catch { return undefined }
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function startTokenServer() {
  return startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/oauth/token') {
      return json(res, 200, { access_token: 'tok-gov', token_type: 'Bearer', expires_in: 300 })
    }
    json(res, 404, { error: 'not_found' })
  })
}

function mockTargets(overrides) {
  return targets.map((t) => (overrides[t.targetId] ? { ...t, allowedOrigin: overrides[t.targetId] } : t))
}

async function wire(manifest, forum) {
  const tokenServer = await startTokenServer()
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'gov-client', clientSecret: 'gov-secret' }) },
    targets: mockTargets({ 'svc-forum': forum.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const built = buildToolDefinition({
    manifest,
    handlers: createHttpHandlers(manifest, transport),
    deps: { resolvePrincipal: () => undefined },
  })
  return { definition: built.definition, close: async () => { await forum.close(); await tokenServer.close() } }
}

test('wire: close posts the exact endpoint, forwards optional reason, renders thread', async () => {
  const forum = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === `/api/threads/t-1/close`) {
      return json(res, 200, { thread: { id: 't-1', status: 'closed' } })
    }
    json(res, 404, { error: 'not_found' })
  })
  const { definition, close } = await wire(forumCloseThreadManifest, forum)
  try {
    const value = await definition.execute({ operation: 'close', threadId: 't-1' })
    assert.equal(value.ok, true)
    assert.equal(value.result.thread.status, 'closed')
    assert.equal(forum.requests.length, 1)
    assert.equal(forum.requests[0].body, undefined, 'no reason supplied → empty body')
  } finally { await close() }
})

test('wire: hide forwards the required reason and maps the deployed 400 state rejection cleanly', async () => {
  const forum = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === `/api/threads/t-1/hide`) {
      if (!entry.body || typeof entry.body.reason !== 'string' || entry.body.reason.trim() === '') {
        return json(res, 400, { error: 'reason is required to hide a thread' })
      }
      return json(res, 200, { thread: { id: 't-1', status: 'hidden' } })
    }
    json(res, 404, { error: 'not_found' })
  })
  const { definition, close } = await wire(forumHideThreadManifest, forum)
  try {
    // Local fail-fast FIRST: blank reason is rejected with zero transport calls.
    const local = await definition.execute({ operation: 'hide', threadId: 't-1', reason: '   ' })
    assert.equal(local.ok, false, 'blank reason must fail locally (invalid_arguments)')
    assert.equal(forum.requests.length, 0, 'local rejection must not hit the transport')

    const value = await definition.execute({ operation: 'hide', threadId: 't-1', reason: 'spam wave' })
    assert.equal(value.ok, true)
    assert.equal(value.result.thread.status, 'hidden')
    assert.equal(forum.requests.length, 1)
    assert.deepEqual(JSON.parse(forum.requests[0].rawBody), { reason: 'spam wave' })
  } finally { await close() }
})

test('wire: restore posts the exact endpoint with no body', async () => {
  const forum = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === `/api/threads/t-1/restore`) {
      return json(res, 200, { thread: { id: 't-1', status: 'open' } })
    }
    json(res, 404, { error: 'not_found' })
  })
  const { definition, close } = await wire(forumRestoreThreadManifest, forum)
  try {
    const value = await definition.execute({ operation: 'restore', threadId: 't-1' })
    assert.equal(value.ok, true)
    assert.equal(value.result.thread.status, 'open')
    assert.equal(forum.requests[0].body, undefined)
  } finally { await close() }
})

test('wire: audit-logs maps GET query filters and renders the page; enums stay server-validated', async () => {
  const forum = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/api/admin/audit-logs') {
      if (entry.query.eventType && !entry.query.eventType.startsWith('thread.')) {
        return json(res, 400, { error: 'eventType must be one of: …' })
      }
      return json(res, 200, { items: [{ eventType: 'thread.close', targetId: 't-1', createdAt: '2026-09-10T00:00:00Z' }], total: 1 })
    }
    json(res, 404, { error: 'not_found' })
  })
  const { definition, close } = await wire(forumAuditLogsManifest, forum)
  try {
    const value = await definition.execute({ operation: 'list', eventType: 'thread.close', targetId: 't-1', limit: 5 })
    assert.equal(value.ok, true)
    assert.equal(value.result.total, 1)
    const sent = forum.requests[0]
    assert.equal(sent.query.eventType, 'thread.close')
    assert.equal(sent.query.targetId, 't-1')
    assert.equal(sent.query.limit, '5')

    // Server-validated enum passes through unchanged; a bad enum maps to a clean 400 error.
    const bad = await definition.execute({ operation: 'list', eventType: 'nonsense' })
    assert.equal(bad.ok, false)
    assert.equal(bad.error.status, 400)
    assert.equal(JSON.stringify(bad.error).toLowerCase().includes('bearer'), false, 'no credential material in errors')
  } finally { await close() }
})

test('wire: governance 403 (non-moderator at the server) maps to a clean tool error without scope/credential leakage', async () => {
  const forum = await startMockServer((req, res) => {
    json(res, 403, { error: 'insufficient_scope' })
  })
  const { definition, close } = await wire(forumCloseThreadManifest, forum)
  try {
    const value = await definition.execute({ operation: 'close', threadId: 't-1' })
    assert.equal(value.ok, false)
    assert.equal(value.error.status, 403)
    const rendered = JSON.stringify(value)
    for (const needle of ['forum.moderate', 'Bearer', 'access_token', 'secret']) {
      assert.equal(rendered.toLowerCase().includes(needle.toLowerCase()), false, `error envelope must not leak ${needle}`)
    }
  } finally { await close() }
})
