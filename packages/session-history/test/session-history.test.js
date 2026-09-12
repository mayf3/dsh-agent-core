/**
 * Focused acceptance tests for @agent-core/session-history
 * (MOBILE_SESSION_HISTORY_V1 implementation round).
 *
 * Coverage mapping to the owner-mandated focused-acceptance list:
 *   cold read no spawn            → router seam exposes only getBinding (T1,T2)
 *   projection correctness        → T3 (user) / T4 (assistant) / T5 (inbox dedup)
 *   reasoning/tool leakage = NONE → T6
 *   stable ID                     → T7 / T8
 *   pagination no gap/no duplicate→ T9
 *   concurrent append             → T10
 *   generation reset/stale cursor → T11 (incl. ACC-SH-N 3a blind-spot variant)
 *   Binding snapshot semantics    → T12 (one read/request, absent, mismatch)
 *   malformed selector/input      → T13 (service-level 400/404/409 mapping)
 *   agent/session not found       → T12/T13
 *   no Session mutation           → T14 (hash before/after; torn tail ignored)
 *   confinement / ceilings        → T15 / T16
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { createSessionHistoryService } from '../src/index.js'
import { HistoryError } from '../src/errors.js'
import { projectKey, encodeSegment } from '../src/dsh-compat.js'
import { isWellFormedPublicMessageId, publicMessageId, currentMainGenerationDigest, canonicalJson } from '../src/ids.js'

const TMP_ROOT = mkdtempSync(join(os.tmpdir?.() ?? '/tmp', 'session-history-test-'))

/** Build one DSH artifact line (newline-terminated record bytes). */
const line = (value) => JSON.stringify(value) + '\n'

const headerLine = ({ id = 'main', cwd, createdAt = 1700000000000, delegationDepth = 0 } = {}) =>
  line({ type: 'session', version: 0, id, createdAt, cwd, delegationDepth })

const userMessage = ({ seq, time = 1700000000000 + seq, id, text, kind = 'user', surfaceOp = 'append', content } = {}) => ({
  type: 'user/message',
  seq,
  time,
  surfaceOp,
  data: {
    id,
    role: 'user',
    content: content ?? [{ type: 'text', text }],
    source: { kind },
  },
})

const assistantMessage = ({ seq, time = 1700000000000 + seq, turn, step = 1, id, blocks, surfaceOp = 'append' } = {}) => ({
  type: 'assistant/message',
  seq,
  time,
  ...(surfaceOp !== undefined ? { surfaceOp } : {}),
  data: { turn, step, message: { id, role: 'assistant', content: blocks ?? [{ type: 'text', text: `reply-${id}` }] }, source: { kind: 'model' } },
})

const turnEnd = ({ seq, time = 1700000000000 + seq, turn, kind = 'completed' } = {}) => ({
  type: 'turn/end',
  seq,
  time,
  data: { turn, reason: { kind } },
})

const textChunksRow = ({ seq0, time0 = 1700000000000, turn = 1, step = 1, texts, index = 0 } = {}) => ({
  type: 'text-chunks',
  seq0,
  time0,
  data: { turn, step, index, dt: texts.map(() => 0).slice(1), texts },
})

/** Materialize a fixture Agent home + artifact; returns the service deps. */
function fixture({ agentId = 'agt_test', records, home, workspace } = {}) {
  const root = join(TMP_ROOT, `case-${Math.random().toString(36).slice(2)}`)
  const homeDir = home ?? join(root, 'agents', agentId)
  const workspaceDir = workspace ?? join(root, 'workspaces', agentId)
  const artifactDir = join(homeDir, 'sessions', projectKey(workspaceDir), 'main')
  mkdirSync(artifactDir, { recursive: true })
  const artifactPath = join(artifactDir, 'session.jsonl')
  const bytes = records === undefined ? undefined : records.join('')
  if (bytes !== undefined) writeFileSync(artifactPath, bytes)
  return { root, homeDir, workspaceDir, artifactPath, bytes: () => readFileSync(artifactPath) }
}

/** Fake Router exposing ONLY the read seams the service may use. */
function fakeRouter({ binding = { activeAgentId: 'agt_test' }, bindReads } = {}) {
  let reads = 0
  return {
    channelConversationId: (channel, surfaceId) => `${channel}:${surfaceId}`,
    getBinding(ccId) {
      reads += 1
      if (bindReads) bindReads.push(performance.now())
      if (binding === 'throw') throw new Error('binding store offline')
      return binding
    },
    get bindingReads() { return reads },
    // The cold-read seam must never reach any of these:
    ensureRunning: () => { throw new Error('ensureRunning MUST NOT be called') },
    spawn: () => { throw new Error('spawn MUST NOT be called') },
    route: () => { throw new Error('route MUST NOT be called') },
  }
}

const fakeDefinition = ({ agents = ['agt_test'] } = {}) => ({
  getAgent(agentId) {
    if (!agents.includes(agentId)) {
      throw Object.assign(new Error('agent-definition: agent not found'), { code: 'AGENT_NOT_FOUND' })
    }
    return { id: agentId, name: agentId, description: null, disabled: false }
  },
})

function buildService({ router, definition = fakeDefinition(), fixture: fx, sessionRootFor } = {}) {
  return createSessionHistoryService({
    router: router ?? fakeRouter(),
    definition,
    resolveAgentWorkspace: () => fx.workspaceDir,
    resolveAgentHome: () => fx.homeDir,
    sessionRootFor,
  })
}

const authContext = { principalType: 'mobile_tailnet_node', surfaceId: 'surface-under-test', authProfile: 'local-tailnet-mobile-history-v1', configGeneration: 'gen-1' }

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('T1 basic history: user + completed assistant turns, cold read with a read-only router seam', async () => {
  const fx = fixture({
    records: [
      headerLine({ cwd: '/w' }),
      line(userMessage({ seq: 0, id: 'u1', text: 'hello' })),
      line({ type: 'turn/start', seq: 1, time: 1, data: { turn: 1 } }),
      line(assistantMessage({ seq: 2, turn: 1, id: 'a1' })),
      line(turnEnd({ seq: 3, turn: 1 })),
    ],
  })
  const router = fakeRouter()
  const service = buildService({ router, fixture: fx })
  const result = await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.equal(result.messages.length, 2)
  assert.deepEqual(result.messages.map((m) => m.role), ['user', 'assistant'])
  assert.deepEqual(result.messages.map((m) => m.content), ['hello', 'reply-a1'])
  for (const m of result.messages) {
    assert.match(m.id, /^msg_sh1_[A-Za-z0-9_-]{43}$/)
    assert.equal(m.id.length, 51)
    assert.equal(m.agentId, 'agt_test')
    assert.equal(m.sessionId, 'main')
    assert.match(m.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  }
  assert.equal(result.hasMore, false)
  assert.equal(router.bindingReads, 1, 'exactly ONE Binding snapshot per request')
})

test('T2 cold read never touches spawn/prompt/route seams and never mutates the artifact', async () => {
  const fx = fixture({
    records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'x' }))],
  })
  const before = sha(fx.bytes())
  const service = buildService({ fixture: fx })
  await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.equal(sha(fx.bytes()), before, 'artifact bytes unchanged')
})

test('T3 user projection: text-block order, empty-only omitted, non-text blocks ignored, mixed block types', async () => {
  const fx = fixture({
    records: [
      headerLine(),
      line(userMessage({ seq: 0, id: 'u1', content: [{ type: 'text', text: '' }, { type: 'text', text: 'a' }, { type: 'reasoning', text: 'SECRET-REASONING' }, { type: 'text', text: 'b' }] })),
      line(userMessage({ seq: 1, id: 'u2', content: [{ type: 'text', text: '' }, { type: 'image', url: 'x' }] })), // empty → omitted
      line(userMessage({ seq: 2, id: 'u3', text: 'kept' })),
    ],
  })
  const service = buildService({ fixture: fx })
  const result = await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.deepEqual(result.messages.map((m) => m.content), ['ab', 'kept'])
  assert.ok(!JSON.stringify(result.messages).includes('SECRET-REASONING'))
})

test('T4 assistant projection: only completed turns, only last non-empty-text append, chunks/tool/usage excluded', async () => {
  const fx = fixture({
    records: [
      headerLine(),
      line(userMessage({ seq: 0, id: 'u1', text: 'q' })),
      // turn 1: chunks then a tool-only assistant message, then the real final text one
      line(textChunksRow({ seq0: 1, texts: ['CH', 'UNK'] })),
      line({ type: 'tool/call', seq: 3, time: 3, data: { turn: 1, step: 1, callId: 'c1', name: 'tool', arguments: '{}' } }),
      line({ type: 'tool/result', seq: 4, time: 4, data: { turn: 1, step: 1, callId: 'c1' } }),
      line(assistantMessage({ seq: 5, turn: 1, id: 'a1', blocks: [{ type: 'text', text: '' }] })), // empty → not qualifying
      line(assistantMessage({ seq: 6, turn: 1, id: 'a2' })), // final text
      line(turnEnd({ seq: 7, turn: 1 })),
      // turn 2: failed turn → provisional text absent
      line(userMessage({ seq: 8, id: 'u2', text: 'q2' })),
      line(assistantMessage({ seq: 9, turn: 2, id: 'a3' })),
      line(turnEnd({ seq: 10, turn: 2, kind: 'error' })),
      // turn 3: unterminated → provisional
      line(userMessage({ seq: 11, id: 'u3', text: 'q3' })),
      line(assistantMessage({ seq: 12, turn: 3, id: 'a4' })),
    ],
  })
  const service = buildService({ fixture: fx })
  const result = await service.listMessages({ authContext, agentId: 'agt_test' })
  const assistants = result.messages.filter((m) => m.role === 'assistant')
  assert.equal(assistants.length, 1)
  assert.equal(assistants[0].content, 'reply-a2')
  assert.ok(!JSON.stringify(result.messages).includes('CH'))
  assert.ok(!JSON.stringify(result.messages).includes('reply-a3'))
  assert.ok(!JSON.stringify(result.messages).includes('reply-a4'))
})

test('T5 inbox deduplication: spliced + user/message appears exactly once; plugin/goal/system excluded', async () => {
  const fx = fixture({
    records: [
      headerLine(),
      line({ type: 'agent/inbox/spliced', seq: 0, time: 0, data: { id: 's1', content: [{ type: 'text', text: 'SPLICED-LEAK' }] } }),
      line(userMessage({ seq: 1, id: 'u1', text: 'real' })),
      line(userMessage({ seq: 2, id: 'p1', text: 'PLUGIN-LEAK', kind: 'plugin' })),
      line(userMessage({ seq: 3, id: 'g1', text: 'GOAL-LEAK', kind: 'goal' })),
      line(userMessage({ seq: 4, id: 'r1', text: 'REPLACE-LEAK', surfaceOp: { op: 'replace', start: 0, end: 1 } })),
    ],
  })
  const service = buildService({ fixture: fx })
  const result = await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.deepEqual(result.messages.map((m) => m.content), ['real'])
  assert.ok(!JSON.stringify(result.messages).includes('SPLICED-LEAK'))
  assert.ok(!JSON.stringify(result.messages).includes('PLUGIN-LEAK'))
  assert.ok(!JSON.stringify(result.messages).includes('GOAL-LEAK'))
  assert.ok(!JSON.stringify(result.messages).includes('REPLACE-LEAK'))
})

test('T6 leakage: response envelope has exactly the frozen fields; no seq/time/raw-internal fields', async () => {
  const fx = fixture({
    records: [
      headerLine({ cwd: '/secret/cwd/path' }),
      line(userMessage({ seq: 0, id: 'u1', text: 'sentinel-content' })),
      line(assistantMessage({ seq: 1, turn: 1, id: 'a1' })),
      line(turnEnd({ seq: 2, turn: 1 })),
    ],
  })
  const service = buildService({ fixture: fx })
  const result = await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.deepEqual(Object.keys(result), ['messages', 'hasMore', 'stats'])
  for (const message of result.messages) {
    assert.deepEqual(Object.keys(message).sort(), ['agentId', 'content', 'createdAt', 'id', 'role', 'sessionId'])
  }
  const wire = JSON.stringify(result)
  assert.ok(!wire.includes('/secret/cwd/path'))
  assert.ok(!wire.includes('u1'))
})

test('T7 stable ID: deterministic composite binding (agent, main, generation, role, rawId, recordDigest)', async () => {
  const records = [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'hello' }))]
  const fxA = fixture({ agentId: 'agt_a', records })
  const fxB = fixture({ agentId: 'agt_b', records })
  const serviceA = buildService({
    fixture: fxA,
    router: fakeRouter({ binding: { activeAgentId: 'agt_a' } }),
    definition: fakeDefinition({ agents: ['agt_a'] }),
  })
  const serviceB = buildService({
    fixture: fxB,
    router: fakeRouter({ binding: { activeAgentId: 'agt_b' } }),
    definition: fakeDefinition({ agents: ['agt_b'] }),
  })
  const [ra, rb] = await Promise.all([
    serviceA.listMessages({ authContext, agentId: 'agt_a' }),
    serviceB.listMessages({ authContext, agentId: 'agt_b' }),
  ])
  const [ma, mb] = [ra.messages[0], rb.messages[0]]
  // Same content across agents → different IDs (agentId participates).
  assert.notEqual(ma.id, mb.id)
  // Recompute the expected ID from the frozen grammar.
  const header = { type: 'session', version: 0, id: 'main', createdAt: 1700000000000, cwd: undefined, delegationDepth: 0 }
  const generation = currentMainGenerationDigest(
    { version: 0, id: 'main', createdAt: 1700000000000, delegationDepth: 0 },
    sha(Buffer.from(records[0], 'utf8')),
  )
  const expected = publicMessageId({
    agentId: 'agt_a',
    generationDigest: generation,
    role: 'user',
    rawId: 'u1',
    recordDigest: sha(Buffer.from(records[1], 'utf8')),
  })
  assert.equal(ma.id, expected)
  assert.ok(isWellFormedPublicMessageId(ma.id))
})

test('T8 repeated reads of an unchanged prefix are byte-stable (IDs, createdAt, order, pages)', async () => {
  const fx = fixture({
    records: [
      headerLine(),
      ...[0, 1, 2].map((i) => line(userMessage({ seq: i, id: `u${i}`, text: `t${i}` }))),
    ],
  })
  const service = buildService({ fixture: fx })
  const a = await service.listMessages({ authContext, agentId: 'agt_test', limit: 2 })
  const b = await service.listMessages({ authContext, agentId: 'agt_test', limit: 2 })
  assert.deepEqual(a, b)
  const page2 = await service.listMessages({ authContext, agentId: 'agt_test', limit: 2, before: a.messages[0].id })
  // Exclusive cursor: everything strictly before t1's page → only t0 remains.
  assert.deepEqual(page2.messages.map((m) => m.content), ['t0'])
  assert.equal(page2.hasMore, false)
})

test('T9 pagination: newest page, exclusive cursor, no gap/duplicate, hasMore exact, malformed vs stale cursor', async () => {
  const fx = fixture({
    records: [
      headerLine(),
      ...[0, 1, 2, 3, 4].map((i) => line(userMessage({ seq: i, id: `u${i}`, text: `t${i}` }))),
    ],
  })
  const service = buildService({ fixture: fx })
  const all = await service.listMessages({ authContext, agentId: 'agt_test', limit: 200 })
  assert.equal(all.messages.length, 5)

  const newest = await service.listMessages({ authContext, agentId: 'agt_test', limit: 2 })
  assert.deepEqual(newest.messages.map((m) => m.content), ['t3', 't4'])
  assert.equal(newest.hasMore, true)

  const middle = await service.listMessages({ authContext, agentId: 'agt_test', limit: 2, before: newest.messages[0].id })
  assert.deepEqual(middle.messages.map((m) => m.content), ['t1', 't2'])
  assert.equal(middle.hasMore, true)

  const first = await service.listMessages({ authContext, agentId: 'agt_test', limit: 2, before: middle.messages[0].id })
  assert.deepEqual(first.messages.map((m) => m.content), ['t0'])
  assert.equal(first.hasMore, false)

  const atFirst = await service.listMessages({ authContext, agentId: 'agt_test', limit: 5, before: all.messages[0].id })
  assert.deepEqual(atFirst.messages, [])
  assert.equal(atFirst.hasMore, false)

  // No duplicate and no gap across the full walk (set equality, order-insensitive walk).
  const walk = [...newest.messages, ...middle.messages, ...first.messages]
  assert.deepEqual(
    walk.map((m) => m.content).sort(),
    all.messages.map((m) => m.content),
  )

  await assert.rejects(
    service.listMessages({ authContext, agentId: 'agt_test', before: 'not-a-public-id' }),
    (error) => error.code === 'VALIDATION_ERROR' && error.status === 400,
  )
  await assert.rejects(
    service.listMessages({ authContext, agentId: 'agt_test', before: 'msg_sh1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }),
    (error) => error.code === 'HISTORY_CURSOR_STALE' && error.status === 409,
  )
})

test('T10 concurrent append: existing public IDs and issued cursors stay byte-stable, new message appended', async () => {
  const fx = fixture({
    records: [
      headerLine(),
      ...[0, 1].map((i) => line(userMessage({ seq: i, id: `u${i}`, text: `t${i}` }))),
    ],
  })
  const service = buildService({ fixture: fx })
  const before1 = await service.listMessages({ authContext, agentId: 'agt_test' })
  // A concurrent DSH writer appends; the snapshot prefix is unchanged.
  const appended = fx.bytes() + line(userMessage({ seq: 2, id: 'u2', text: 't2' }))
  writeFileSync(fx.artifactPath, appended)
  const after1 = await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.deepEqual(after1.messages.slice(0, 2).map((m) => m.id), before1.messages.map((m) => m.id))
  assert.equal(after1.messages.length, 3)
  // A cursor issued before the append still resolves.
  const page = await service.listMessages({ authContext, agentId: 'agt_test', limit: 2, before: after1.messages[2].id })
  assert.deepEqual(page.messages.map((m) => m.id), before1.messages.map((m) => m.id))
})

test('T11 generation reset: full reset stale; ACC-SH-N 3a blind-spot variant; prefix-identical reset', async () => {
  // (1) full reset: different first record → old cursor structurally stale (409).
  const original = fixture({
    records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'before-reset' }))],
  })
  const service = buildService({ fixture: original })
  const before = await service.listMessages({ authContext, agentId: 'agt_test' })
  const resetAt = 1700000500000
  writeFileSync(original.artifactPath, headerLine({ createdAt: resetAt, cwd: '/w' }) + line(userMessage({ seq: 0, id: 'u1', text: 'after-reset' })))
  await assert.rejects(
    service.listMessages({ authContext, agentId: 'agt_test', before: before.messages[0].id }),
    (error) => error.code === 'HISTORY_CURSOR_STALE',
  )
  const after = await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.equal(after.messages[0].content, 'after-reset')

  // (2) ACC-SH-N 3a: identical first record + identical header (same native id
  // and createdAt) + reused rawId but DIFFERENT record content → different
  // public ID; the old cursor is 409, never a cross-generation misread.
  const blind = fixture({
    records: [
      headerLine(),
      line(userMessage({ seq: 0, id: 'u1', text: 'generation-one-secret' })),
    ],
  })
  const blindService = buildService({ fixture: blind })
  const genOne = await blindService.listMessages({ authContext, agentId: 'agt_test' })
  writeFileSync(blind.artifactPath, headerLine() + line(userMessage({ seq: 0, id: 'u1', text: 'generation-two-secret' })))
  const genTwo = await blindService.listMessages({ authContext, agentId: 'agt_test' })
  assert.notEqual(genOne.messages[0].id, genTwo.messages[0].id)
  assert.equal(genTwo.messages[0].content, 'generation-two-secret')
  await assert.rejects(
    blindService.listMessages({ authContext, agentId: 'agt_test', before: genOne.messages[0].id }),
    (error) => error.code === 'HISTORY_CURSOR_STALE',
  )

  // (3) prefix-identical reset with byte-identical record content → same ID,
  // byte-identical presentation (no misread possible by construction).
  const identical = fixture({
    records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'same-bytes' }))],
  })
  const identicalService = buildService({ fixture: identical })
  const firstRead = await identicalService.listMessages({ authContext, agentId: 'agt_test' })
  writeFileSync(identical.artifactPath, headerLine() + line(userMessage({ seq: 0, id: 'u1', text: 'same-bytes' })))
  const secondRead = await identicalService.listMessages({ authContext, agentId: 'agt_test' })
  assert.equal(firstRead.messages[0].id, secondRead.messages[0].id)
  assert.equal(secondRead.messages[0].content, firstRead.messages[0].content)
})

test('T12 Binding snapshot semantics: absent → SESSION_NOT_FOUND, mismatch → SESSION_NOT_FOUND, missing definition → AGENT_NOT_FOUND, binding failure → INTERNAL_ERROR, read exactly once', async () => {
  const fx = fixture({ records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'x' }))] })
  // `null` binding = the surface has no Binding (explicit undefined would hit
  // the fakeRouter default-parameter trap).
  const absentRouter = fakeRouter({ binding: null })
  const absentService = buildService({ router: absentRouter, fixture: fx })
  await assert.rejects(absentService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'SESSION_NOT_FOUND')
  assert.equal(absentRouter.bindingReads, 1)

  const mismatchService = buildService({ fixture: fx, definition: fakeDefinition({ agents: ['agt_test', 'agt_other'] }) })
  await assert.rejects(mismatchService.listMessages({ authContext, agentId: 'agt_other' }), (e) => e.code === 'SESSION_NOT_FOUND')

  const missingDefService = buildService({ fixture: fx, definition: fakeDefinition({ agents: [] }) })
  await assert.rejects(missingDefService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'AGENT_NOT_FOUND')

  const failingRouter = fakeRouter({ binding: 'throw' })
  const failingService = buildService({ router: failingRouter, fixture: fx })
  await assert.rejects(failingService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'INTERNAL_ERROR')
})

test('T13 input validation: limit defaults/range, selector-independent service checks, cursor byte bound', async () => {
  const fx = fixture({ records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'x' }))] })
  const service = buildService({ fixture: fx })
  const ok = await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.equal(ok.messages.length, 1) // default limit
  for (const bad of [0, 201, 1.5, '50', -1]) {
    await assert.rejects(
      service.listMessages({ authContext, agentId: 'agt_test', limit: bad }),
      (e) => e.code === 'VALIDATION_ERROR',
    )
  }
  await assert.rejects(service.listMessages({ authContext, agentId: 'agt_test', before: 'x'.repeat(513) }), (e) => e.code === 'VALIDATION_ERROR')
  await assert.rejects(service.listMessages({ authContext: { principalType: 'wrong', surfaceId: 's' }, agentId: 'agt_test' }), (e) => e.code === 'INTERNAL_ERROR')
})

test('T14 torn final record is observational: ignored, never repaired, bytes unchanged', async () => {
  const fx = fixture({
    records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'ok' })), '{"type":"assistant/messa'],
  })
  const before = sha(fx.bytes())
  const service = buildService({ fixture: fx })
  const result = await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.deepEqual(result.messages.map((m) => m.content), ['ok'])
  assert.equal(sha(fx.bytes()), before)
})

test('T15 corruption and header fail-closed: seq gap, bad JSON, unknown header field, header id ≠ main, bad version', async () => {
  const cases = [
    { name: 'seq gap', records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'a' })), line(userMessage({ seq: 2, id: 'u2', text: 'b' }))] },
    { name: 'bad json', records: [headerLine(), '{"type":"user/message",\n'] },
    { name: 'unknown header field', records: [line({ type: 'session', version: 0, id: 'main', createdAt: 1, delegationDepth: 0, evil: true })] },
    { name: 'header id not main', records: [headerLine({ id: 'other' }), line(userMessage({ seq: 0, id: 'u1', text: 'a' }))] },
    { name: 'bad version', records: [line({ type: 'session', version: 1, id: 'main', createdAt: 1, delegationDepth: 0 })] },
    { name: 'malformed relevant user event', records: [headerLine(), line({ type: 'user/message', seq: 0, time: 0, surfaceOp: 'append', data: { source: { kind: 'user' }, content: [] } })] },
    { name: 'malformed correlated assistant', records: [headerLine(), line({ type: 'assistant/message', seq: 0, time: 0, data: { turn: 1, step: 1, message: { id: '' } } })] },
    { name: 'duplicate terminal', records: [headerLine(), line(turnEnd({ seq: 0, turn: 1 })), line(turnEnd({ seq: 1, turn: 1 }))] },
    { name: 'candidate after terminal', records: [headerLine(), line(turnEnd({ seq: 0, turn: 1 })), line(assistantMessage({ seq: 1, turn: 1, id: 'a1' }))] },
    { name: 'empty artifact', records: [] },
  ]
  for (const testCase of cases) {
    const fx = fixture({ records: testCase.records })
    const service = buildService({ fixture: fx })
    await assert.rejects(
      service.listMessages({ authContext, agentId: 'agt_test' }),
      (e) => e.code === 'INTERNAL_ERROR',
      `expected INTERNAL_ERROR for ${testCase.name}`,
    )
  }
  // Missing / unsafe data.turn events are DROPPED, never fatal.
  const dropped = fixture({
    records: [
      headerLine(),
      line({ type: 'assistant/message', seq: 0, time: 0, data: { step: 1, message: { id: 'a', role: 'assistant', content: [{ type: 'text', text: 'no-turn' }], source: { kind: 'model' } } } }),
      line({ type: 'turn/end', seq: 1, time: 1, data: { reason: { kind: 'completed' } } }),
      line(userMessage({ seq: 2, id: 'u1', text: 'kept' })),
      line(turnEnd({ seq: 3, turn: 0 })), // zero turn: non-correlatable, dropped
    ],
  })
  const service = buildService({ fixture: dropped })
  const result = await service.listMessages({ authContext, agentId: 'agt_test' })
  assert.deepEqual(result.messages.map((m) => m.content), ['kept'])
})

test('T16 session not found / confinement fail-closed', async () => {
  // Absent artifact (no main trajectory).
  const absent = fixture({ records: undefined })
  const absentService = buildService({ fixture: absent })
  await assert.rejects(absentService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'SESSION_NOT_FOUND')

  // Absent agent home entirely.
  const noHome = fixture({ records: [headerLine()] })
  rmSync(noHome.homeDir, { recursive: true, force: true })
  const noHomeService = buildService({ fixture: noHome })
  await assert.rejects(noHomeService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'SESSION_NOT_FOUND')

  // Final artifact is a symlink → INTERNAL_ERROR.
  const symlinked = fixture({ records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'x' }))] })
  rmSync(symlinked.artifactPath)
  symlinkSync(join(symlinked.homeDir, 'elsewhere.jsonl'), symlinked.artifactPath)
  writeFileSync(join(symlinked.homeDir, 'elsewhere.jsonl'), headerLine())
  const symlinkService = buildService({ fixture: symlinked })
  await assert.rejects(symlinkService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'INTERNAL_ERROR')

  // Intermediate symlinked project directory → INTERNAL_ERROR.
  const midSymlink = fixture({ records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'x' }))] })
  const realSessions = join(midSymlink.homeDir, 'real-sessions')
  cpSync(join(midSymlink.homeDir, 'sessions'), realSessions, { recursive: true })
  rmSync(join(midSymlink.homeDir, 'sessions'), { recursive: true })
  symlinkSync(realSessions, join(midSymlink.homeDir, 'sessions'))
  const midService = buildService({ fixture: midSymlink })
  await assert.rejects(midService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'INTERNAL_ERROR')

  // Cross-root hardlink inside the session root (st_nlink > 1) → INTERNAL_ERROR.
  const hardlink = fixture({ records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'x' }))] })
  const outside = join(hardlink.root, 'outside.jsonl')
  writeFileSync(outside, headerLine() + line(userMessage({ seq: 0, id: 'u1', text: 'h' })))
  rmSync(hardlink.artifactPath)
  linkSyncCompat(outside, hardlink.artifactPath)
  const hardlinkService = buildService({ fixture: hardlink })
  await assert.rejects(hardlinkService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'INTERNAL_ERROR')

  // BLOCKER-UNION regression (audit blocker 1 / ACC-SH-M (b)(c)): intermediate
  // components BELOW the Session root — the projectKey dir and the native
  // `main` dir — replaced by symlinks to another agent's artifact must fail
  // closed (cross-agent transcript escape was mechanically demonstrated).
  for (const swapped of ['main', projectKey(join('x', 'y')) + '']) {
    const mid = fixture({ records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'mine' }))] })
    const otherAgent = fixture({ agentId: 'agt_other', records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'AGENT-B-TRANSCRIPT' }))] })
    const componentDir = swapped === 'main'
      ? join(mid.homeDir, 'sessions', projectKey(mid.workspaceDir), 'main')
      : join(mid.homeDir, 'sessions', projectKey(mid.workspaceDir))
    rmSync(componentDir, { recursive: true })
    symlinkSync(swapped === 'main' ? dirname(otherAgent.artifactPath) : dirname(dirname(otherAgent.artifactPath)), componentDir)
    const midService = buildService({ fixture: mid })
    await assert.rejects(midService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'INTERNAL_ERROR')
    void otherAgent
  }

  // Session root configured outside the Agent Home → fail-closed INTERNAL_ERROR.
  const outsideRoot = fixture({ records: [headerLine(), line(userMessage({ seq: 0, id: 'u1', text: 'x' }))] })
  const outsideService = createSessionHistoryService({
    router: fakeRouter(),
    definition: fakeDefinition(),
    resolveAgentWorkspace: () => outsideRoot.workspaceDir,
    resolveAgentHome: () => outsideRoot.homeDir,
    sessionRootFor: () => outsideRoot.root,
  })
  await assert.rejects(outsideService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'INTERNAL_ERROR')
})

function linkSyncCompat(target, path) {
  linkSync(target, path)
}

test('T17 ceilings: artifact byte ceiling and over-ceiling record are 413 before content use', async () => {
  // Artifact > MAX_ARTIFACT_BYTES: 413 without reading content.
  const big = fixture({ records: undefined })
  const bigPayload = headerLine() + line(userMessage({ seq: 0, id: 'u1', text: 'x' }))
  const pad = Buffer.alloc(4_000_001 - Buffer.byteLength(bigPayload), 0x20).toString('utf8')
  writeFileSync(big.artifactPath, bigPayload + pad)
  const bigService = buildService({ fixture: big })
  await assert.rejects(bigService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'HISTORY_RESOURCE_LIMIT' && e.status === 413)

  // One record > MAX_RECORD_BYTES (512,000): 413 before parse.
  const fatRecord = fixture({ records: undefined })
  writeFileSync(fatRecord.artifactPath, headerLine() + line(userMessage({ seq: 0, id: 'u1', text: 'y'.repeat(512_001) })))
  const fatService = buildService({ fixture: fatRecord })
  await assert.rejects(fatService.listMessages({ authContext, agentId: 'agt_test' }), (e) => e.code === 'HISTORY_RESOURCE_LIMIT')
})

test('T18 locator encoding golden vectors (pinned DSH projectKey/encodeSegment)', () => {
  assert.equal(encodeSegment('main'), 'main')
  assert.equal(projectKey('/Users/yanfenma/.dsh/workspaces/agent-demo'), '--Users-yanfenma-.dsh-workspaces-agent-demo--')
  assert.equal(projectKey('/Users/yanfenma/.dsh/workspaces/agt_282d42b764dd4d428c02f2007551ba25'), '--Users-yanfenma-.dsh-workspaces-agt_282d42b764dd4d428c02f2007551ba25--')
  assert.equal(projectKey('/'), '--root--') // separators collapse+strip → root slug
  assert.equal(projectKey('relative/cwd'), '--relative-cwd--')
  assert.equal(canonicalJson({ b: 1, a: 'x' }), '{"a":"x","b":1}')
})

test('T19 expanded event-count pre-scan matches the pinned decoder (chunk rows expand 1:members)', async () => {
  const fx = fixture({
    records: [
      headerLine(),
      line(userMessage({ seq: 0, id: 'u1', text: 'q' })),
      line(textChunksRow({ seq0: 1, texts: ['a', 'b', 'c'] })),
      line(assistantMessage({ seq: 4, turn: 1, id: 'a1' })),
      line(turnEnd({ seq: 5, turn: 1 })),
    ],
  })
  const service = buildService({ fixture: fx })
  const result = await service.listMessages({ authContext, agentId: 'agt_test' })
  // Chunk rows never become messages; the completed turn's final text survives.
  const assistants = result.messages.filter((m) => m.role === 'assistant')
  assert.equal(assistants.length, 1)
  assert.equal(assistants[0].content, 'reply-a1')
  assert.equal(result.stats.expandedEvents, 3 + 1 + 1 + 1, 'chunk row expanded 3 events + user + assistant + turn/end')
})
