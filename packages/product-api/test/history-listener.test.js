/**
 * HTTP integration tests for the dedicated history-only Tailnet listener
 * (HISTORY_LISTENER): ALL_REQUESTS_ADMITTED ownership with 403 for
 * non-history-class requests, auth admission → History input validation
 * ownership chain (selector ≠ main is History's 400, not auth's 403),
 * denial never reaches the history service (ACC-PA-K), frozen error
 * envelopes, runtime log allowlist (CTR-SH-014 / CTR-PA-011), concurrent
 * append stability, and the zero-mutation / no-spawn invariants.
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createSessionHistoryService } from '../../session-history/src/index.js'
import { projectKey } from '../../session-history/src/dsh-compat.js'
import { FORBIDDEN, NOT_READY, loadAuthConfigProfile } from '../src/history-auth.js'
import { matchHistoryRouteClass, startHistoryListener } from '../src/history-listener.js'

const TMP = mkdtempSync(join(os.tmpdir(), 'history-listener-test-'))
const VALID_SURFACE = '3f2a1b4c-5d6e-4f70-8a90-1b2c3d4e5f60'
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

const line = (value) => JSON.stringify(value) + '\n'
const headerLine = () => line({ type: 'session', version: 0, id: 'main', createdAt: 1700000000000, cwd: '/w', delegationDepth: 0 })
const userMessage = ({ seq, id, text, kind = 'user' }) => ({
  type: 'user/message', seq, time: 1700000000000 + seq, surfaceOp: 'append',
  data: { id, role: 'user', content: [{ type: 'text', text }], source: { kind } },
})
const assistantMessage = ({ seq, turn, id }) => ({
  type: 'assistant/message', seq, time: 1700000000000 + seq, surfaceOp: 'append',
  data: { turn, step: 1, message: { id, role: 'assistant', content: [{ type: 'text', text: `reply-${id}` }] }, source: { kind: 'model' } },
})
const turnEnd = ({ seq, turn, kind = 'completed' }) => ({ type: 'turn/end', seq, time: 1700000000000 + seq, data: { turn, reason: { kind } } })

/** Build the fixture Agent home + artifact and the service wired to a counting router. */
function buildFixture() {
  const root = join(TMP, `case-${Math.random().toString(36).slice(2)}`)
  const homeDir = join(root, 'agents', 'agt_test')
  const workspaceDir = join(root, 'workspaces', 'agt_test')
  const artifactDir = join(homeDir, 'sessions', projectKey(workspaceDir), 'main')
  mkdirSync(artifactDir, { recursive: true })
  const artifactPath = join(artifactDir, 'session.jsonl')
  writeFileSync(artifactPath, headerLine()
    + line(userMessage({ seq: 0, id: 'u1', text: 'hello' }))
    + line(assistantMessage({ seq: 1, turn: 1, id: 'a1' }))
    + line(turnEnd({ seq: 2, turn: 1 })))
  return { root, homeDir, workspaceDir, artifactPath }
}

function fakeRouter({ binding = { activeAgentId: 'agt_test' } } = {}) {
  const counters = { bindingReads: 0, historyCalls: 0 }
  return {
    counters,
    channelConversationId: (channel, surfaceId) => `${channel}:${surfaceId}`,
    getBinding() {
      counters.bindingReads += 1
      return binding
    },
    ensureRunning() { throw new Error('ensureRunning MUST NOT be called') },
    route() { throw new Error('route MUST NOT be called') },
  }
}

/**
 * Wrap the history service so the listener's hand-off can be counted for the
 * ACC-PA-K invariant (denial → history service call count = 0).
 */
function countingService(inner, counters) {
  return {
    listMessages(args) {
      counters.historyCalls += 1
      return inner.listMessages(args)
    },
  }
}

async function startTestListener({ profile, router, fixture: fx, logLines, whoisByIp = { '127.0.0.1': 'node:phone-1' } }) {
  const service = createSessionHistoryService({
    router,
    definition: { getAgent: (id) => id === 'agt_test' ? { id } : (() => { throw Object.assign(new Error('nf'), { code: 'AGENT_NOT_FOUND' }) })() },
    resolveAgentWorkspace: () => fx.workspaceDir,
    resolveAgentHome: () => fx.homeDir,
  })
  const listener = startHistoryListener({
    host: '127.0.0.1',
    port: 0,
    profile,
    sessionHistory: countingService(service, router.counters),
    resolveStableNodeId: async (canonicalIp) => {
      const entry = whoisByIp[canonicalIp]
      if (entry === undefined) return { ok: false }
      return typeof entry === 'string' ? { ok: true, stableNodeId: entry } : { ok: false }
    },
    writeLog: (lineText) => logLines.push(lineText),
  })
  await new Promise((resolveListen) => listener.server.once('listening', resolveListen))
  const { port } = listener.address()
  return { listener, port }
}

async function get(port, path, headers = {}) {
  const { default: http } = await import('node:http')
  return await new Promise((resolveGet) => {
    const request = http.get({ host: '127.0.0.1', port, path, headers }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolveGet({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    request.on('error', (error) => resolveGet({ status: 0, body: String(error) }))
  })
}

const authHeaders = { 'x-agentcore-surface-id': VALID_SURFACE }

test('H1 route class shape match is selector-agnostic; everything else is 403', () => {
  assert.deepEqual(matchHistoryRouteClass('GET', '/v1/agents/agt_x/sessions/main/messages'), { rawAgentId: 'agt_x', rawSelector: 'main' })
  assert.deepEqual(matchHistoryRouteClass('GET', '/v1/agents/agt_x/sessions/whatever/messages'), { rawAgentId: 'agt_x', rawSelector: 'whatever' })
  assert.equal(matchHistoryRouteClass('POST', '/v1/agents/agt_x/sessions/main/messages'), null)
  assert.equal(matchHistoryRouteClass('GET', '/v1/agents/agt_x/sessions/main/messages/extra'), null)
  assert.equal(matchHistoryRouteClass('GET', '/v1/binding'), null)
  assert.equal(matchHistoryRouteClass('GET', '/'), null)
})

test('H2 allow path: exact pair → 200 frozen envelope; denial shapes are exact; loopback server untouched semantics', async () => {
  const fx = buildFixture()
  const router = fakeRouter()
  const logLines = []
  const { listener, port } = await startTestListener({
    profile: loadAuthConfigProfile(writeValidConfig('h2.json')),
    router,
    fixture: fx,
    logLines,
  })
  try {
    const allowed = await get(port, '/v1/agents/agt_test/sessions/main/messages?limit=50', authHeaders)
    assert.equal(allowed.status, 200)
    const parsed = JSON.parse(allowed.body)
    assert.deepEqual(Object.keys(parsed), ['messages', 'hasMore'])
    assert.equal(parsed.messages.length, 2)
    assert.deepEqual(Object.keys(parsed.messages[0]).sort(), ['agentId', 'content', 'createdAt', 'id', 'role', 'sessionId'])
    assert.equal(router.counters.historyCalls, 1)

    // Allowed Node + wrong surface → 403, history service never called.
    const wrongSurface = await get(port, '/v1/agents/agt_test/sessions/main/messages', { 'x-agentcore-surface-id': '00000000-0000-4000-8000-000000000000' })
    assert.equal(wrongSurface.status, 403)
    assert.deepEqual(JSON.parse(wrongSurface.body), { error: { code: FORBIDDEN, message: 'caller is not authorized' } })

    // Non-history path on the listener → 403 (no unauthenticated behavior surface).
    const badPath = await get(port, '/v1/binding', authHeaders)
    assert.equal(badPath.status, 403)
    assert.deepEqual(JSON.parse(badPath.body), { error: { code: FORBIDDEN, message: 'caller is not authorized' } })

    // Denial reached the history service zero extra times.
    assert.equal(router.counters.historyCalls, 1)
  } finally {
    await listener.close()
  }

  // A WhoIs-resolvable-but-unknown peer (no match) → 503 NOT_READY with the
  // exact frozen envelope (ACC-PA-H unknown class).
  const router503 = fakeRouter()
  const { listener: listener503, port: port503 } = await startTestListener({
    profile: loadAuthConfigProfile(writeValidConfig('h2b.json')),
    router: router503,
    fixture: fx,
    logLines: [],
    whoisByIp: {},
  })
  try {
    const unknownPeer = await get(port503, '/v1/agents/agt_test/sessions/main/messages', authHeaders)
    assert.equal(unknownPeer.status, 503)
    assert.deepEqual(JSON.parse(unknownPeer.body), { error: { code: NOT_READY, message: 'authentication is not ready' } })
    assert.equal(router503.counters.historyCalls, 0)
  } finally {
    await listener503.close()
  }
})

function writeValidConfig(name) {
  const path = join(TMP, name)
  writeFileSync(path, JSON.stringify({
    version: 1,
    generation: 'gen-h',
    profile: 'local-tailnet-mobile-history-v1',
    allowedCallers: [{ tailscaleStableNodeId: 'node:phone-1', surfaceId: VALID_SURFACE }],
  }))
  chmodSync(path, 0o600) // CTR-PA-005: mode must not be wider than 0600
  return path
}

test('H4 selector ≠ main → 400 VALIDATION_ERROR with valid identity (History owns the 400)', async () => {
  const fx = buildFixture()
  const router = fakeRouter()
  const logLines = []
  const service = createSessionHistoryService({
    router,
    definition: { getAgent: (id) => ({ id }) },
    resolveAgentWorkspace: () => fx.workspaceDir,
    resolveAgentHome: () => fx.homeDir,
  })
  // Feed the listener a WhoIs resolver that admits the loopback test peer so
  // the request reaches History input validation.
  const listener = startHistoryListener({
    host: '127.0.0.1',
    port: 0,
    profile: loadAuthConfigProfile(writeValidConfig('h4.json')),
    sessionHistory: countingService(service, router.counters),
    resolveStableNodeId: async () => ({ ok: true, stableNodeId: 'node:phone-1' }),
    writeLog: (lineText) => logLines.push(lineText),
  })
  await new Promise((resolveListen) => listener.server.once('listening', resolveListen))
  const { port } = listener.address()
  try {
    const wrongSelector = await get(port, '/v1/agents/agt_test/sessions/not-main/messages', authHeaders)
    assert.equal(wrongSelector.status, 400)
    assert.equal(JSON.parse(wrongSelector.body).error.code, 'VALIDATION_ERROR')
    // Traversal-shaped agentId → 400.
    const traversal = await get(port, `/v1/agents/${encodeURIComponent('../evil')}/sessions/main/messages`, authHeaders)
    assert.equal(traversal.status, 400)
    // Bad limit → 400.
    const badLimit = await get(port, '/v1/agents/agt_test/sessions/main/messages?limit=0', authHeaders)
    assert.equal(badLimit.status, 400)
    const badLimit2 = await get(port, '/v1/agents/agt_test/sessions/main/messages?limit=201', authHeaders)
    assert.equal(badLimit2.status, 400)
    // Malformed cursor → 400; well-formed absent cursor → 409.
    const badCursor = await get(port, '/v1/agents/agt_test/sessions/main/messages?before=zzz', authHeaders)
    assert.equal(badCursor.status, 400)
    const staleCursor = await get(port, '/v1/agents/agt_test/sessions/main/messages?before=msg_sh1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', authHeaders)
    assert.equal(staleCursor.status, 409)
    assert.equal(JSON.parse(staleCursor.body).error.code, 'HISTORY_CURSOR_STALE')
  } finally {
    await listener.close()
  }
})

test('H5 not-ready profile: listener mounts fail-closed (503 on every class-matched request, 403 otherwise)', async () => {
  const fx = buildFixture()
  const router = fakeRouter()
  const { listener, port } = await startTestListener({
    profile: loadAuthConfigProfile(join(TMP, 'does-not-exist.json')),
    router,
    fixture: fx,
    logLines: [],
  })
  try {
    const response = await get(port, '/v1/agents/agt_test/sessions/main/messages', authHeaders)
    assert.equal(response.status, 503)
    assert.equal(router.counters.historyCalls, 0)
    const otherPath = await get(port, '/v1/binding', authHeaders)
    assert.equal(otherPath.status, 403)
    assert.equal(router.counters.bindingReads, 0, 'Binding is never read on denial')
  } finally {
    await listener.close()
  }
})

test('H6 concurrent append over HTTP: existing public IDs and old cursors stay byte-stable', async () => {
  const fx = buildFixture()
  const router = fakeRouter()
  const { listener, port } = await startTestListener({
    profile: loadAuthConfigProfile(writeValidConfig('h6.json')),
    router,
    fixture: fx,
    logLines: [],
  })
  try {
    const before = JSON.parse((await get(port, '/v1/agents/agt_test/sessions/main/messages', authHeaders)).body)
    // Concurrent DSH writer appends a new message.
    const bytes = readFileSync(fx.artifactPath, 'utf8')
    writeFileSync(fx.artifactPath, bytes + line(userMessage({ seq: 3, id: 'u2', text: 'later' })))
    const after = JSON.parse((await get(port, '/v1/agents/agt_test/sessions/main/messages', authHeaders)).body)
    assert.deepEqual(after.messages.slice(0, 2).map((m) => m.id), before.messages.map((m) => m.id))
    assert.equal(after.messages.length, 3)
    const page = JSON.parse((await get(port, `/v1/agents/agt_test/sessions/main/messages?before=${encodeURIComponent(after.messages[2].id)}`, authHeaders)).body)
    assert.deepEqual(page.messages.map((m) => m.id), before.messages.map((m) => m.id))
  } finally {
    await listener.close()
  }
})

test('H7 runtime log allowlist: no content, no cursor values, no paths, no auth material (CTR-SH-014/CTR-PA-011)', async () => {
  const fx = buildFixture()
  const router = fakeRouter()
  const logLines = []
  const { listener, port } = await startTestListener({
    profile: loadAuthConfigProfile(writeValidConfig('h7.json')),
    router,
    fixture: fx,
    logLines,
  })
  try {
    const ok = await get(port, '/v1/agents/agt_test/sessions/main/messages?limit=2', authHeaders)
    const parsed = JSON.parse(ok.body)
    await get(port, '/v1/agents/agt_test/sessions/main/messages?before=' + encodeURIComponent(parsed.messages[0].id), authHeaders)
    await get(port, '/v1/binding', authHeaders) // 403 path
    await get(port, '/v1/agents/agt_test/sessions/main/messages', { 'x-agentcore-surface-id': 'bogus' }) // 403 path
  } finally {
    await listener.close()
  }
  const all = logLines.join('\n')
  assert.ok(logLines.length >= 4)
  assert.ok(!all.includes('hello'), 'no transcript content in logs')
  assert.ok(!all.includes('reply-a1'), 'no assistant content in logs')
  assert.ok(!all.includes('msg_sh1_'), 'no public message IDs in logs')
  assert.ok(!all.includes(VALID_SURFACE), 'no surfaceId in logs')
  assert.ok(!all.includes('node:phone-1'), 'no StableID in logs')
  assert.ok(!all.includes(fx.root), 'no filesystem paths in logs')
  assert.ok(!all.includes('gen-h'), 'no raw generation in logs')
  assert.ok(all.includes('route=/v1/agents/{agentId}/sessions/{selector}/messages'))
  assert.ok(all.includes('beforePresent=true'))
  assert.ok(all.includes('agentId=agt_test'))
})

test('H8 cold read: no spawn seams exist, artifact bytes unchanged across HTTP reads', async () => {
  const fx = buildFixture()
  const router = fakeRouter()
  const { listener, port } = await startTestListener({
    profile: loadAuthConfigProfile(writeValidConfig('h8.json')),
    router,
    fixture: fx,
    logLines: [],
  })
  try {
    const before = sha(readFileSync(fx.artifactPath))
    await get(port, '/v1/agents/agt_test/sessions/main/messages', authHeaders)
    await get(port, '/v1/agents/agt_test/sessions/main/messages?limit=1', authHeaders)
    assert.equal(sha(readFileSync(fx.artifactPath)), before)
    assert.equal(router.counters.bindingReads, 2, 'exactly one Binding snapshot per request')
  } finally {
    await listener.close()
  }
})
