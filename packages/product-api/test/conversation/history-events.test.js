// CTR-NC-006/007 acceptance for the request-owned history/events projection.
// Isolated fixtures only: synthetic subject/scope, temp store, fixture router.
// The new operations are gated by the owner config and default OFF.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConversationService } from '../../src/conversation/service.js'

import { agent, credential, fixture, resolvedSend } from './history-test-support.js'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

test('old owner config without the new operations keeps them closed (NO_ACCESS, zero reads)', async t => {
  const fx = await fixture(t, ['resolve', 'send', 'result'])
  const reads = fx.sources.reads ?? 0
  const history = await fx.service.invoke('history', { session_handle: 'session_nc1_whatever', direction: 'older' }, credential)
  assert.equal(history.status, 403)
  assert.equal(history.body.error.class, 'NO_ACCESS')
  const events = await fx.service.invoke('events', {}, credential)
  assert.equal(events.status, 403)
  assert.equal(fx.sources.reads ?? 0, reads) // zero source reads for denied ops
})

test('closed adapter stays NOT_PROVISIONED for the new operations', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'native-history-closed-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const service = createConversationService({ router: {}, definition: { getAgent: () => null },
    storeFile: join(dir, 'requests.json'), configProvider: () => null })
  t.after(() => service.close())
  const history = await service.invoke('history', { session_handle: 'session_nc1_x', direction: 'older' }, credential)
  assert.equal(history.status, 503)
  assert.equal(history.body.error.class, 'NOT_PROVISIONED')
})

test('history returns the user projection and assistant reply with relations, stable ids and coverage', async t => {
  const fx = await fixture(t)
  const sent = await resolvedSend(t, fx, 'req-history-1', '请总结这份周报的要点')
  const body = sent.body
  assert.ok(body.session_handle)
  fx.sources.set(sent.nativeId, { state: 'completed', agent_id: agent, session_id: 'main', session_generation: 'trajectory:fixture',
    message_id: sent.body.message_id, turn_id: 1, reply_message_id: 'reply-native-1', reply_body: '要点如下：三条。', started_at: 100,
    finished_at: 200, reply_created_at: 199, source_retained: true })
  await fx.service.invoke('result', { request_id: 'req-history-1' }, credential)
  const page = await fx.service.invoke('history', { session_handle: body.session_handle, direction: 'older' }, credential)
  assert.equal(page.status, 200)
  const out = page.body
  assert.equal(out.status, 'OK')
  assert.equal(Array.isArray(out.items), true)
  assert.equal(out.items.length, 2)
  const user = out.items.find(item => item.role === 'user')
  assert.ok(user, 'user projection present')
  assert.equal(user.body, '请总结这份周报的要点')
  assert.equal(user.source, 'request_owner_submitted')
  assert.ok(user.message_id.startsWith('msg_nc1_'))
  assert.equal(user.native_message_id, 'user-1')
  const assistant = out.items.find(item => item.role === 'assistant')
  assert.equal(assistant.body, '要点如下：三条。')
  assert.equal(assistant.native_message_id, 'reply-native-1')
  assert.equal(assistant.incomplete, false)
  assert.equal(out.coverage.scope, 'request_bound_only')
  assert.ok(out.coverage.events_seq_start !== undefined)
  assert.equal(out.has_more, false)
})

test('older/newer pagination has no dup or miss; empty newer keeps the cursor; growth is picked up', async t => {
  const fx = await fixture(t)
  const handles = []
  const nativeIds = {}
  for (const [id, text] of [['req-p1', '第一条'], ['req-p2', '第二条'], ['req-p3', '第三条']]) {
    const sent = await resolvedSend(t, fx, id, text)
    handles.push(sent.body.session_handle)
    nativeIds[id] = sent.nativeId
    fx.sources.set(sent.nativeId, { state: 'completed', agent_id: agent, session_id: 'main',
      session_generation: 'trajectory:fixture', message_id: sent.body.message_id, turn_id: Number(sent.body.message_id.split('-')[1]),
      reply_message_id: 'reply-' + id, reply_body: text + ' 的回复', started_at: 100, finished_at: 200,
      reply_created_at: 199, source_retained: true })
    await fx.service.invoke('result', { request_id: id }, credential)
  }
  assert.equal(new Set(handles).size, 1)
  const sessionHandle = handles[0]
  const page1 = (await fx.service.invoke('history', { session_handle: sessionHandle, direction: 'older', limit: 2 }, credential)).body
  assert.equal(page1.items.length, 2)
  assert.equal(page1.has_more, true)
  const page2 = (await fx.service.invoke('history', { session_handle: sessionHandle, direction: 'older', cursor: page1.next_cursor, limit: 2 }, credential)).body
  const ids1 = page1.items.map(i => i.message_id), ids2 = page2.items.map(i => i.message_id)
  assert.equal(new Set([...ids1, ...ids2]).size, 4)
  const page3 = (await fx.service.invoke('history', { session_handle: sessionHandle, direction: 'older', cursor: page2.next_cursor, limit: 2 }, credential)).body
  const ids3 = page3.items.map(i => i.message_id)
  assert.equal(new Set([...ids1, ...ids2, ...ids3]).size, 6)
  assert.equal(page3.has_more, false)
  // newest-first ordering on the older walk: newest record's assistant reply first
  assert.equal(page1.items[0].body, '第三条 的回复')
  // a fresh newer walk from the beginning returns the full visible set in
  // ascending order; its cursor is the consumed high-water position.
  const newerAll = (await fx.service.invoke('history', { session_handle: sessionHandle, direction: 'newer' }, credential)).body
  assert.equal(newerAll.items.length, 6)
  assert.equal(newerAll.has_more, false)
  assert.ok(newerAll.next_cursor)
  // empty increment from that high-water keeps a usable cursor
  const newer1 = (await fx.service.invoke('history', { session_handle: sessionHandle, direction: 'newer', cursor: newerAll.next_cursor }, credential)).body
  assert.equal(newer1.items.length, 0)
  assert.ok(newer1.cursor, 'empty newer increment keeps a usable cursor')
  assert.equal(JSON.parse(Buffer.from(newer1.cursor, 'base64url').toString('utf8')).position,
    JSON.parse(Buffer.from(newerAll.next_cursor, 'base64url').toString('utf8')).position)
  // growth after the boundary
  const sent4 = await resolvedSend(t, fx, 'req-p4', '第四条')
  fx.sources.set(sent4.nativeId, { state: 'completed', agent_id: agent, session_id: 'main', session_generation: 'trajectory:fixture',
    message_id: sent4.body.message_id, turn_id: Number(sent4.body.message_id.split('-')[1]), reply_message_id: 'reply-req-p4', reply_body: '第四条 的回复', started_at: 100,
    finished_at: 200, reply_created_at: 199, source_retained: true })
  await fx.service.invoke('result', { request_id: 'req-p4' }, credential)
  const newer2 = (await fx.service.invoke('history', { session_handle: sessionHandle, direction: 'newer', cursor: newer1.cursor }, credential)).body
  assert.equal(newer2.items.length, 2)
  assert.equal(newer2.items[0].body, '第四条')
  assert.equal(newer2.items[1].body, '第四条 的回复')
  // the incremental walk never re-delivers already-consumed positions
  assert.ok(newer2.items.every(i => i.position > Math.max(...newerAll.items.map(old => old.position))))
  const positions2 = newer2.items.map(i => i.position)
  assert.equal(new Set(positions2).size, 2)
})

test('long reply bodies page through content_cursor within 6144 UTF-8 bytes', async t => {
  const fx = await fixture(t)
  const sentLong = await resolvedSend(t, fx, 'req-long', '长文请求')
  const longText = '事'.repeat(5000) + 'x'.repeat(3000)
  fx.sources.set(sentLong.nativeId, { state: 'completed', agent_id: agent, session_id: 'main', session_generation: 'trajectory:fixture',
    message_id: sentLong.body.message_id, turn_id: 1, reply_message_id: 'reply-long', reply_body: longText, started_at: 100,
    finished_at: 200, reply_created_at: 199, source_retained: true })
  await fx.service.invoke('result', { request_id: 'req-long' }, credential)
  const page = (await fx.service.invoke('history', { session_handle: (await fx.service.invoke('result', { request_id: 'req-long' }, credential)).body.session_handle, direction: 'older' }, credential)).body
  const assistant = page.items.find(i => i.role === 'assistant')
  assert.ok(Buffer.byteLength(assistant.body, 'utf8') <= 6144)
  assert.equal(assistant.content_complete, false)
  assert.ok(assistant.content_cursor)
  // long bodies need a loop: each page is <=6144 UTF-8 bytes and the last page
  // completes; concatenated pages reproduce the original bytes hash.
  let cursor = assistant.content_cursor
  const parts = [assistant.body]
  let guard = 0
  while (cursor && guard++ < 10) {
    const next = (await fx.service.invoke('history', { content_cursor: cursor }, credential)).body
    assert.equal(next.status, 'OK')
    assert.equal(next.has_more, !next.content_complete)
    parts.push(next.body)
    assert.ok(Buffer.byteLength(next.body, 'utf8') <= 6144)
    cursor = next.next_content_cursor
  }
  assert.ok(parts.length >= 3, '18000-byte body needs at least 3 pages: ' + parts.map(p => Buffer.byteLength(p, 'utf8')).join(','))
  const joined = Buffer.from(parts.join(''), 'utf8')
  assert.equal(joined.length, 18000)
  assert.equal(joined.toString('utf8'), longText)
  assert.equal(createHash('sha256').update(joined).digest('hex'), assistant.body_sha256)
  assert.ok(cursor === null)
  // mutually exclusive arguments
  const bad = await fx.service.invoke('history', { session_handle: 'session_nc1_x', direction: 'older', content_cursor: assistant.content_cursor }, credential)
  assert.equal(bad.status, 400)
})

test('expired results keep their tombstone and history shows the expired state honestly', async t => {
  const fx = await fixture(t, ['resolve', 'send', 'result', 'history', 'events'], 1)
  const sentExp = await resolvedSend(t, fx, 'req-exp', '会过期的')
  fx.sources.set(sentExp.nativeId, { state: 'completed', agent_id: agent, session_id: 'main', session_generation: 'trajectory:fixture',
    message_id: sentExp.body.message_id, turn_id: 1, reply_message_id: 'reply-exp', reply_body: '稍纵即逝', started_at: 100,
    finished_at: 200, reply_created_at: 199, source_retained: true })
  const result = (await fx.service.invoke('result', { request_id: 'req-exp' }, credential)).body
  fx.advance(5)
  const page = (await fx.service.invoke('history', { session_handle: result.session_handle, direction: 'older' }, credential)).body
  const assistant = page.items.find(i => i.role === 'assistant')
  assert.ok(assistant, 'the record stays in history')
  assert.equal(assistant.reply_status, 'unavailable')
  assert.equal(assistant.body ?? null, null)
  assert.equal(assistant.error_class, 'RESULT_EXPIRED')
  await t.test('result read after expiry reports RESULT_EXPIRED but keeps the tombstone', async () => {
    const after = await fx.service.invoke('result', { request_id: 'req-exp' }, credential)
    assert.equal(after.status, 410)
    assert.equal(after.body.error.class, 'RESULT_EXPIRED')
  })
})

test('records from before the user-body projection keep their content not_projected', async t => {
  const fx = await fixture(t)
  await resolvedSend(t, fx, 'req-legacy', '旧记录')
  void (await fx.service.invoke('result', { request_id: 'req-legacy' }, credential))
  // simulate a v1 record: strip the projection fields the new sender writes
  const { readPrivateJson, atomicPrivateJson } = await import('../../../agent-router/src/conversation/persistence.js')
  const doc = readPrivateJson(fx.storeFile)
  const row = doc.records.find(r => r.request_id === 'req-legacy')
  delete row.user_body
  delete row.user_body_redacted
  delete row.user_message_id
  atomicPrivateJson(fx.storeFile, doc)
  const page = (await fx.service.invoke('history', { session_handle: (await fx.service.invoke('result', { request_id: 'req-legacy' }, credential)).body.session_handle, direction: 'older' }, credential)).body
  const user = page.items.find(i => i.role === 'user')
  assert.equal(user.body ?? null, null)
  assert.equal(user.body_availability.status, 'not_projected')
  assert.equal(user.body_availability.reason, 'record_predates_user_body_projection')
})

test('foreign or unknown session handles leak nothing', async t => {
  const fx = await fixture(t)
  await resolvedSend(t, fx, 'req-hidden', '隐藏内容')
  const page = await fx.service.invoke('history', { session_handle: 'session_nc1_' + 'x'.repeat(64), direction: 'older' }, credential)
  assert.equal(page.status, 404)
  assert.equal(page.body.error.class, 'NOT_FOUND_OR_NOT_VISIBLE')
  assert.ok(!JSON.stringify(page.body).includes('隐藏内容'))
})

test('events are scope-monotonic with stable ids, survive restart, and dedupe repeated callbacks', async t => {
  const fx = await fixture(t)
  const sentEv = await resolvedSend(t, fx, 'req-ev1', '事件一')
  fx.sources.set(sentEv.nativeId, { state: 'completed', agent_id: agent, session_id: 'main', session_generation: 'trajectory:fixture',
    message_id: sentEv.body.message_id, turn_id: 1, reply_message_id: 'reply-ev1', reply_body: '回复一', started_at: 100,
    finished_at: 200, reply_created_at: 199, source_retained: true })
  await fx.service.invoke('result', { request_id: 'req-ev1' }, credential)
  await fx.service.reconcilePending() // duplicate pass over the same settled row
  const first = (await fx.service.invoke('events', {}, credential)).body
  assert.ok(first.items.length >= 2)
  const seqs = first.items.map(i => i.seq)
  assert.deepEqual([...seqs].sort((a, b) => a - b), seqs)
  const replyEvents = first.items.filter(i => i.kind === 'reply_available')
  assert.equal(replyEvents.length, 1, 'duplicate callbacks create no second business reply')
  // restart on the same store, resume from the original cursor
  fx.reset()
  const again = (await fx.service.invoke('events', { cursor: first.next_cursor }, credential)).body
  // resume never re-delivers: exact zero overlap with the first page
  assert.equal(again.items.filter(e => first.items.some(o => o.event_id === e.event_id)).length, 0)
  // stable ids across restart for the same seq
  for (const old of first.items) {
    const resumed = (await fx.service.invoke('events', {}, credential)).body.items.find(e => e.seq === old.seq)
    if (resumed) assert.equal(resumed.event_id, old.event_id)
  }
  // request filter binding
  const filtered = (await fx.service.invoke('events', { request_id: 'req-ev1' }, credential)).body
  assert.ok(filtered.items.length > 0)
  assert.ok(filtered.items.every(i => i.request_id === 'req-ev1'))
})

test('event cursors below retention report EVENT_CURSOR_EXPIRED with retained coverage', async t => {
  const fx = await fixture(t, ['resolve', 'send', 'result', 'history', 'events'])
  await resolvedSend(t, fx, 'req-cap', '容量前的记录')
  void (await fx.service.invoke('result', { request_id: 'req-cap' }, credential))
  const first = (await fx.service.invoke('events', {}, credential)).body
  // single-page high-water must advance to the last persisted seq
  const decoded = JSON.parse(Buffer.from(first.next_cursor, 'base64url').toString('utf8'))
  assert.equal(decoded.after_seq, JSON.parse(readFileSync(fx.storeFile, 'utf8')).event_seq)
  // A fully consumed cursor remains valid when earlier events are trimmed.
  const { readPrivateJson, atomicPrivateJson } = await import('../../../agent-router/src/conversation/persistence.js')
  const doc = readPrivateJson(fx.storeFile)
  const removed = doc.events.slice(0, -1)
  doc.events = doc.events.slice(-1)
  doc.event_dropped_through = { [removed[0].scope_key]: removed.at(-1).seq }
  atomicPrivateJson(fx.storeFile, doc)
  const tail = await fx.service.invoke('events', { cursor: first.next_cursor }, credential)
  assert.equal(tail.status, 200)
  assert.deepEqual(tail.body.items, [])
  const old = { ...decoded, after_seq: 0 }
  const stale = await fx.service.invoke('events', { cursor: Buffer.from(JSON.stringify(old)).toString('base64url') }, credential)
  assert.equal(stale.status, 410)
  assert.equal(stale.body.error.class, 'EVENT_CURSOR_EXPIRED')
  assert.ok(stale.body.coverage)
})
