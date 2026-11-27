import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs'
import { agent, credential, fixture, resolvedSend } from './history-test-support.js'
import { readPrivateJson, atomicPrivateJson } from '../../../agent-router/src/conversation/persistence.js'
import { ConversationStore } from '../../src/conversation/store.js'

const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url')
const decode = x => JSON.parse(Buffer.from(x, 'base64url'))
const history = (fx, handle, extra = {}) => fx.service.invoke('history', { session_handle: handle, direction: 'newer', ...extra }, credential)
async function complete(fx, sent, text = 'visible reply', created = 90000) {
  fx.sources.set(sent.nativeId, { state: 'completed', agent_id: agent, session_id: 'main', session_generation: 'trajectory:fixture',
    message_id: sent.body.message_id, turn_id: Number(sent.body.message_id.split('-')[1]), reply_message_id: 'reply-' + sent.body.message_id,
    reply_body: text, reply_created_at: created, source_retained: true })
  const result = await fx.service.invoke('result', { request_id: sent.body.request_id }, credential)
  assert.equal(result.status, 200)
}

// Catches read->ensureStore construction, migration and recovery writes.
test('cold and steady history/events reads do not create files, migrate, recover or read native source', async t => {
  const fx = await fixture(t)
  assert.equal(existsSync(fx.storeFile), false)
  assert.equal((await fx.service.invoke('events', {}, credential)).status, 200)
  assert.equal((await history(fx, 'session_nc1_unknown')).status, 404)
  assert.equal(existsSync(fx.storeFile), false)
  assert.deepEqual(readdirSync(fx.dir), [])
  const sent = await resolvedSend(t, fx, 'pure-read', 'own user')
  const before = readFileSync(fx.storeFile), modified = statSync(fx.storeFile).mtimeMs
  const sourceReads = fx.sources.reads, sends = fx.calls.length
  await history(fx, sent.body.session_handle)
  await fx.service.invoke('events', {}, credential)
  assert.deepEqual(readFileSync(fx.storeFile), before)
  assert.equal(statSync(fx.storeFile).mtimeMs, modified)
  assert.equal(fx.sources.reads, sourceReads)
  assert.equal(fx.calls.length, sends)
  assert.deepEqual(fx.counters, { monitor: 0, execute: 0, business: 0 })
  const doc = readPrivateJson(fx.storeFile)
  doc.version = 1
  delete doc.events
  delete doc.event_seq
  delete doc.projection_seq
  for (const row of doc.records) {
    row.request_status = 'reserved'
    delete row.user_body
    delete row.user_position
    delete row.assistant_position
  }
  atomicPrivateJson(fx.storeFile, doc)
  const legacy = readFileSync(fx.storeFile)
  const page = await history(fx, sent.body.session_handle)
  assert.equal(page.status, 200)
  assert.equal(page.body.items[0].body_availability.status, 'not_projected')
  const events = await fx.service.invoke('events', {}, credential)
  assert.equal(events.body.coverage.history_availability, 'not_projected')
  assert.deepEqual(readFileSync(fx.storeFile), legacy)
})

// Catches using submitted_at/fixed part positions, unfrozen snapshot and shifting event-derived positions.
test('frozen pages exclude growth; after_cursor finds late replies once, also after restart and duplicate callback', async t => {
  const fx = await fixture(t)
  const a = await resolvedSend(t, fx, 'late-a', 'a user')
  const b = await resolvedSend(t, fx, 'late-b', 'b user')
  const handle = a.body.session_handle
  const first = (await history(fx, handle, { limit: 1 })).body
  assert.equal(first.items.length, 1)
  assert.ok(first.after_cursor)
  await complete(fx, b, 'b exact reply')
  await complete(fx, a, 'a exact reply', null)
  const second = (await history(fx, handle, { limit: 1, cursor: first.next_cursor })).body
  assert.deepEqual(second.items.map(i => i.body), ['b user'])
  assert.equal(second.has_more, false)
  const tail = (await history(fx, handle, { limit: 1, cursor: second.next_cursor })).body
  assert.deepEqual(tail.items.map(i => i.body), ['b exact reply'])
  assert.equal(tail.has_more, true)
  const last = (await history(fx, handle, { limit: 1, cursor: tail.next_cursor })).body
  assert.deepEqual(last.items.map(i => i.body), ['a exact reply'])
  assert.equal(last.items[0].created_at, null)
  assert.equal(last.items[0].reply_relation.native_parent_id, null)
  assert.equal(last.items[0].reply_relation.reply_to, a.body.message_id)
  assert.equal(last.items[0].reply_relation.relation_source, 'native_turn')
  const cursor = last.after_cursor
  fx.emit()
  await fx.service.reconcilePending()
  fx.reset()
  await fx.service.reconcilePending()
  const empty = (await history(fx, handle, { limit: 1, cursor })).body
  assert.deepEqual(empty.items, [])
  assert.equal(empty.after_cursor, cursor)
  const older = (await history(fx, handle, { direction: 'older', limit: 2 })).body
  await resolvedSend(t, fx, 'late-c', 'c user')
  const older2 = (await history(fx, handle, { direction: 'older', limit: 2, cursor: older.next_cursor })).body
  assert.deepEqual(older2.items.map(i => i.body), ['b user', 'a user'])
  const invalidDirection = await history(fx, handle, { cursor: older.next_cursor, limit: 2 })
  assert.equal(invalidDirection.body.error.class, 'CURSOR_STALE')
})

// Catches user content bypasses, mismatched generation/tag/part/UTF-8 offsets, and stale target bindings.
test('user and reply content cursors bind exact scope/version/part/generation/UTF8 and obey retention', async t => {
  const fx = await fixture(t)
  const text = '事'.repeat(6000)
  const sent = await resolvedSend(t, fx, 'content-user', text)
  await complete(fx, sent, text + 'reply')
  const page = (await history(fx, sent.body.session_handle)).body
  for (const item of page.items) {
    let cursor = item.content_cursor, joined = item.body
    while (cursor) {
      const result = await fx.service.invoke('history', { content_cursor: cursor }, credential)
      assert.equal(result.status, 200)
      assert.equal(result.body.role, item.role)
      assert.ok(Buffer.byteLength(result.body.body) <= 6144)
      joined += result.body.body
      cursor = result.body.next_content_cursor
    }
    assert.equal(joined, item.role === 'user' ? text : text + 'reply')
  }
  const userCursor = page.items.find(i => i.role === 'user').content_cursor
  const parsed = decode(userCursor)
  for (const patch of [{ offset: 6145 }, { offset: -1 }, { offset: 999999 }, { part: 'assistant' }, { tag: 'bad' }, { scope_key: 'bad' }]) {
    const result = await fx.service.invoke('history', { content_cursor: encode({ ...parsed, ...patch }) }, credential)
    assert.equal(result.status, 409, JSON.stringify(patch))
    assert.equal(result.body.body, undefined)
  }
  const generation = await fx.service.invoke('history', { content_cursor: encode({ ...parsed, generation: 'other' }) }, credential)
  assert.equal(generation.body.error.class, 'SESSION_GENERATION_CHANGED')
  const oldSubject = fx.cfg.clients[0].subject_id
  fx.cfg.clients[0].subject_id = 'other-subject'
  const hidden = await history(fx, sent.body.session_handle)
  assert.equal(hidden.status, 404)
  assert.ok(!JSON.stringify(hidden).includes(text.slice(0, 100)))
  const deniedContent = await fx.service.invoke('history', { content_cursor: userCursor }, credential)
  assert.notEqual(deniedContent.status, 200)
  fx.cfg.clients[0].subject_id = oldSubject
  fx.cfg.clients[0].targets[0].agent_id = 'agt_replacement'
  assert.equal((await fx.service.invoke('history', { content_cursor: userCursor }, credential)).status, 404)
  fx.cfg.clients[0].targets[0].agent_id = agent
  fx.advance(3600001)
  for (const item of page.items) {
    const expired = await fx.service.invoke('history', { content_cursor: item.content_cursor }, credential)
    assert.equal(expired.status, 410)
    assert.equal(expired.body.error.class, 'RESULT_EXPIRED')
    assert.equal(expired.body.body, undefined)
  }
  const expiredPage = await history(fx, sent.body.session_handle)
  assert.ok(expiredPage.body.items.every(i => i.body === null))
  assert.equal(readPrivateJson(fx.storeFile).records.length, 1)
})

test('pending user projection expires on its own bounded retention without deleting UNKNOWN', async t => {
  const fx = await fixture(t, undefined, 10)
  const sent = await resolvedSend(t, fx, 'pending-expiry', 'private pending user')
  fx.advance(11)
  const page = await history(fx, sent.body.session_handle)
  assert.equal(page.body.items.length, 1)
  assert.equal(page.body.items[0].body, null)
  assert.equal(page.body.items[0].body_availability.reason, 'RESULT_EXPIRED')
  assert.equal(page.body.incomplete, true)
  assert.equal(readPrivateJson(fx.storeFile).records[0].execution_status, 'unknown')
})

// Catches terminal cursor not advancing, request filter swaps, revocation and global coverage leakage.
test('event pages resume at tail, bind filters and scope, reject explicit revoked target and stale binding', async t => {
  const fx = await fixture(t)
  const a = await resolvedSend(t, fx, 'events-a', 'a user')
  const b = await resolvedSend(t, fx, 'events-b', 'b user')
  await complete(fx, b)
  await complete(fx, a)
  const invoke = body => fx.service.invoke('events', body, credential)
  let page = (await invoke({ limit: 1 })).body, ids = []
  while (true) {
    ids.push(...page.items.map(i => i.event_id))
    if (!page.has_more) break
    page = (await invoke({ limit: 1, cursor: page.next_cursor })).body
  }
  assert.equal(new Set(ids).size, ids.length)
  const empty = (await invoke({ limit: 1, cursor: page.next_cursor })).body
  assert.deepEqual(empty.items, [])
  assert.equal(empty.next_cursor, page.next_cursor)
  const filtered = (await invoke({ request_id: 'events-a' })).body
  assert.equal(filtered.has_more, false)
  assert.ok(filtered.items.every(i => i.request_id === 'events-a'))
  assert.equal((await invoke({ request_id: 'events-b', cursor: filtered.next_cursor })).status, 409)
  const changed = fx.cfg.clients[0].communication_scope_id
  fx.cfg.clients[0].communication_scope_id = 'other-scope'
  assert.equal((await invoke({ cursor: filtered.next_cursor, request_id: 'events-a' })).status, 409)
  const foreign = (await invoke({})).body
  assert.equal(foreign.coverage.seq_end, null)
  fx.cfg.clients[0].communication_scope_id = changed
  fx.cfg.clients[0].targets[0].agent_id = 'agt_replacement'
  assert.deepEqual((await invoke({})).body.items, [])
  assert.equal((await invoke({ request_id: 'events-a' })).status, 404)
  fx.cfg.clients[0].targets[0].agent_id = agent
  fx.router.getBinding = () => ({ activeAgentId: 'agt_replacement', activeSessionId: 'main' })
  assert.deepEqual((await invoke({})).body.items, [])
  assert.equal((await history(fx, a.body.session_handle)).status, 404)
})

// Catches non-atomic event/state commits and duplicate callbacks creating a second reply.
test('callback retry after commit failure preserves old durable state then atomically publishes one reply/event', async t => {
  const fx = await fixture(t)
  const sent = await resolvedSend(t, fx, 'atomic-reply', 'user')
  const before = readFileSync(fx.storeFile)
  fx.sources.set(sent.nativeId, { state: 'completed', agent_id: agent, session_id: 'main', session_generation: 'trajectory:fixture',
    message_id: sent.body.message_id, turn_id: 1, reply_body: 'durable reply', reply_message_id: 'native-r', source_retained: true })
  writeFileSync(fx.storeFile + '.lock', '{}', { mode: 0o600 })
  fx.emit()
  await fx.service.reconcilePending()
  assert.deepEqual(readFileSync(fx.storeFile), before)
  unlinkSync(fx.storeFile + '.lock')
  fx.emit()
  await fx.service.reconcilePending()
  await fx.service.reconcilePending()
  const doc = readPrivateJson(fx.storeFile)
  assert.equal(doc.records[0].reply_body, 'durable reply')
  const replies = doc.events.filter(e => e.kind === 'reply_available')
  assert.equal(replies.length, 1)
  assert.equal(new Set(doc.events.map(e => e.seq)).size, doc.events.length)
  assert.equal(new Set(doc.events.map(e => e.event_id)).size, doc.events.length)
  const beforeRestart = replies[0]
  fx.reset()
  await fx.service.reconcilePending()
  assert.deepEqual(readPrivateJson(fx.storeFile).events.filter(e => e.kind === 'reply_available'), [beforeRestart])
  // Failure inside the atomic document serialization must publish neither state nor event.
  const db = new ConversationStore(fx.storeFile)
  const durable = readFileSync(fx.storeFile)
  assert.throws(() => db.update(doc.records[0].key, row => { row.execution_status = 'failed'; row.invalid = 1n }))
  assert.deepEqual(readFileSync(fx.storeFile), durable)
})

// Catches response byte caps, and loss of durable positions when the event ring is trimmed.
test('large response obeys 1MiB and durable history positions survive actual event cap trimming', async t => {
  const fx = await fixture(t)
  const first = await resolvedSend(t, fx, 'size-first', 'start')
  const db = new ConversationStore(fx.storeFile, () => 100000)
  const principal = fx.cfg.clients[0], target = principal.targets[0]
  const { hash } = await import('../../src/conversation/protocol.js')
  const text = '事'.repeat(2800)
  for (let i = 0; i < 85; i++) {
    const row = db.reserve(principal, { request_id: 'size-' + i, message: text }, target, fx.cfg).row
    db.update(row.key, r => Object.assign(r, { session_id: 'main', session_generation: 'trajectory:fixture',
      message_id: 'native-size-' + i, native_turn_id: i, reply_status: 'available', reply_body: text,
      reply_projection_id: 'reply_nc1_' + hash([r.native_request_id, 'native-size-' + i, i, text]),
      result_persisted_at: 100000, expires_at: 3700000 }))
  }
  let page = await history(fx, first.body.session_handle, { limit: 200 })
  assert.equal(page.status, 200)
  assert.ok(Buffer.byteLength(JSON.stringify(page.body)) <= 1048576)
  assert.equal(page.body.has_more, true)
  const count = page.body.items.length
  page = await history(fx, first.body.session_handle, { limit: 200, cursor: page.body.next_cursor })
  assert.equal(count + page.body.items.length, 171)
  assert.equal(page.body.has_more, false)
  const before = (await history(fx, first.body.session_handle, { limit: 200 })).body.items.map(i => i.message_id)
  const oldCursor = (await fx.service.invoke('events', { limit: 1 }, credential)).body.next_cursor
  db.mutate(doc => {
    const row = doc.records[0]
    for (let i = 0; i < 5001; i++) db.appendEvent(doc, row, 'execution_state_changed', null)
  })
  assert.deepEqual((await history(fx, first.body.session_handle, { limit: 200 })).body.items.map(i => i.message_id), before)
  const expired = await fx.service.invoke('events', { limit: 1, cursor: oldCursor }, credential)
  assert.equal(expired.body.error.class, 'EVENT_CURSOR_EXPIRED')
  assert.ok(expired.body.coverage.dropped_through > 0)
})

test('closed read arguments reject mutually exclusive content/query fields and invalid limits', async t => {
  const fx = await fixture(t)
  for (const args of [{}, { session_handle: 'x', direction: 'newer', limit: 201 },
    { content_cursor: 'x', cursor: 'x' }, { content_cursor: 'x', limit: 1 },
    { session_handle: 'x', direction: 'fresh' }, { session_handle: 'x', direction: 'older', sessionId: 'main' }]) {
    assert.equal((await fx.service.invoke('history', args, credential)).status, 400)
  }
  for (const args of [{ limit: 101 }, { limit: 0 }, { request_id: 'bad key' }, { subject_id: 'forged' }]) {
    assert.equal((await fx.service.invoke('events', args, credential)).status, 400)
  }
  assert.equal(existsSync(fx.storeFile), false)
})

// A lost receipt must not make the user projection permanently fall behind an already consumed cursor.
test('recovered native coordinates publish previously undiscoverable user content at a new durable position', async t => {
  const fx = await fixture(t)
  const original = fx.router.sendProductSurface
  fx.router.sendProductSurface = async args => ({ ...await original(args), sessionGeneration: null })
  const target = (await fx.service.invoke('resolve', { target: { agent_id: agent } }, credential)).body.target_handle
  const lost = await fx.service.invoke('send', { request_id: 'lost-coordinate', target_handle: target, message: 'recovered own user' }, credential)
  assert.equal(lost.status, 200)
  assert.equal(lost.body.session_handle, null)
  const nativeId = fx.calls[0].requestId
  fx.router.sendProductSurface = original
  const known = await resolvedSend(t, fx, 'known-coordinate', 'already consumed user')
  const baseline = (await history(fx, known.body.session_handle)).body
  assert.equal(baseline.items.length, 1)
  fx.sources.set(nativeId, { state: 'completed', agent_id: agent, session_id: 'main', session_generation: 'trajectory:fixture',
    message_id: 'user-1', turn_id: 1, reply_message_id: 'reply-recovered', reply_body: 'recovered reply', source_retained: true })
  assert.equal((await fx.service.invoke('result', { request_id: 'lost-coordinate' }, credential)).status, 200)
  const increment = (await history(fx, known.body.session_handle, { cursor: baseline.after_cursor })).body
  assert.deepEqual(increment.items.map(i => i.body), ['recovered own user', 'recovered reply'])
})
