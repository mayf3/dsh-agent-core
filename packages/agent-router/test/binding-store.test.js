/**
 * Unit tests for @agent-core/agent-router BindingStore.
 *
 * Covers the Product Integration V1 persistence contract:
 *   1. set/get/list round-trip;
 *   2. durability across "restart" (a new store instance over the same file);
 *   3. atomic document shape (version + bindings map);
 *   4. missing file = empty table (fresh deployment);
 *   5. corrupt / unsupported store fails loud (never silently reset);
 *   6. absolute-path contract (relative / `~` values rejected fail-loud);
 *   7. validation of rows.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { BindingStore, CORRUPT_STORE, VALIDATION_ERROR } from '../src/binding-store.js'

/** Fresh store path inside a throwaway tmp tree. */
async function tmpStore(t, name = 'bindings.json') {
  const dir = await mkdtemp(join(tmpdir(), 'acr-bind-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return join(dir, name)
}

function row(ccId = 'feishu:chat-x', agentId = 'agt_a', sessionId = 'main') {
  return { channelConversationId: ccId, activeAgentId: agentId, activeSessionId: sessionId, updatedAt: '2026-08-15T00:00:00.000Z' }
}

test('1. set/get/list round-trip', async (t) => {
  const store = new BindingStore({ storeFile: await tmpStore(t) })
  assert.equal(store.get('feishu:chat-x'), undefined, 'empty before set')

  await store.set(row('feishu:chat-x', 'agt_a', 'main'))
  const got = store.get('feishu:chat-x')
  assert.equal(got.activeAgentId, 'agt_a')
  assert.equal(got.activeSessionId, 'main')
  assert.equal(store.list().length, 1)
  assert.equal(store.list()[0].channelConversationId, 'feishu:chat-x')
})

test('2. survives restart: a new instance over the same store file', async (t) => {
  const file = await tmpStore(t)
  const first = new BindingStore({ storeFile: file })
  await first.set(row('feishu:chat-x', 'agt_a', 'main'))
  await first.set(row('feishu:chat-y', 'agt_b', 'main'))

  const second = new BindingStore({ storeFile: file }) // control-plane restart
  assert.equal(second.get('feishu:chat-x').activeAgentId, 'agt_a')
  assert.equal(second.get('feishu:chat-y').activeAgentId, 'agt_b')
  assert.equal(second.list().length, 2)
})

test('3. document shape is atomic and versioned', async (t) => {
  const file = await tmpStore(t)
  const store = new BindingStore({ storeFile: file })
  await store.set(row('feishu:chat-x', 'agt_a', 'main'))
  const document = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(document.version, 1)
  assert.deepEqual(Object.keys(document.bindings), ['feishu:chat-x'])
  assert.equal(document.bindings['feishu:chat-x'].activeAgentId, 'agt_a')
})

test('4. missing file is a legal empty table', (t) => {
  const store = new BindingStore({ storeFile: join(tmpdir(), `never-${Date.now()}.json`) })
  assert.equal(store.list().length, 0)
  assert.equal(store.get('feishu:chat-x'), undefined)
})

test('5. corrupt / unsupported store fails loud (never silently reset)', async (t) => {
  const corrupt = await tmpStore(t, 'corrupt.json')
  await writeFile(corrupt, 'not json {', 'utf8')
  assert.throws(() => new BindingStore({ storeFile: corrupt }), (error) => error.code === CORRUPT_STORE)

  const wrongVersion = await tmpStore(t, 'wrong-version.json')
  await writeFile(wrongVersion, JSON.stringify({ version: 99, bindings: {} }), 'utf8')
  assert.throws(() => new BindingStore({ storeFile: wrongVersion }), (error) => error.code === CORRUPT_STORE)

  const dangling = await tmpStore(t, 'dangling.json')
  await writeFile(dangling, JSON.stringify({ version: 1, bindings: { 'feishu:x': { activeAgentId: 'agt_a' } } }), 'utf8')
  assert.throws(() => new BindingStore({ storeFile: dangling }), (error) => error.code === CORRUPT_STORE)
})

test('6. absolute-path contract: relative and ~-prefixed storeFile rejected', (t) => {
  assert.throws(() => new BindingStore({ storeFile: 'relative/bindings.json' }), (error) => error.code === VALIDATION_ERROR)
  assert.throws(() => new BindingStore({ storeFile: '~/bindings.json' }), (error) => error.code === VALIDATION_ERROR)
})

test('7. row validation', async (t) => {
  const store = new BindingStore({ storeFile: await tmpStore(t) })
  assert.throws(() => store.set({ activeAgentId: 'agt_a', activeSessionId: 'main' }), (error) => error.code === VALIDATION_ERROR)
  assert.throws(() => store.set(row('feishu:x', '', 'main')), (error) => error.code === VALIDATION_ERROR)
})

test('8. FIX3: persist failure rolls back RAM, keeps disk, rejects the caller', async (t) => {
  const file = await tmpStore(t)
  const store = new BindingStore({ storeFile: file })
  await store.set(row('feishu:chat-x', 'agt_a', 'main'))
  const diskBefore = await readFile(file, 'utf8')

  // Inject a persist failure for the next mutation.
  store.persist = async () => { throw new Error('disk full') }
  await assert.rejects(() => store.set(row('feishu:chat-x', 'agt_b', 'main')), /disk full/)

  // RAM unchanged (the mutation rolled back).
  assert.equal(store.get('feishu:chat-x').activeAgentId, 'agt_a')
  assert.equal(store.get('feishu:chat-x').activeSessionId, 'main')
  // Disk unchanged (atomic persist never ran to completion).
  assert.equal(await readFile(file, 'utf8'), diskBefore)

  // The store recovers: the next mutation (with persist restored) works.
  store.persist = BindingStore.prototype.persist
  await store.set(row('feishu:chat-x', 'agt_b', 'main'))
  assert.equal(store.get('feishu:chat-x').activeAgentId, 'agt_b')
  assert.notEqual(await readFile(file, 'utf8'), diskBefore)
})

test('9. FIX3: a failed NEW binding rolls back too (no phantom row)', async (t) => {
  const file = await tmpStore(t)
  const store = new BindingStore({ storeFile: file })
  await store.set(row('feishu:chat-x', 'agt_a', 'main'))
  const diskBefore = await readFile(file, 'utf8')

  store.persist = async () => { throw new Error('disk full') }
  await assert.rejects(() => store.set(row('feishu:chat-new', 'agt_b', 'main')), /disk full/)
  assert.equal(store.get('feishu:chat-new'), undefined, 'failed creation leaves no row in RAM')
  assert.equal(store.list().length, 1)
  assert.equal(await readFile(file, 'utf8'), diskBefore)
})

// ------------------------------------------------- Delivery V0 fresh table

const mint = (used) => {
  let id = 'fresh-x'
  let n = 0
  while (used.has(id)) id = `fresh-x-${++n}`
  return id
}

test('10. freshSessionFor mints on first sight, returns the same row on retry', async (t) => {
  const store = new BindingStore({ storeFile: await tmpStore(t) })
  assert.equal(store.getFreshSession('agt_a', 'req-1'), undefined)

  const first = await store.freshSessionFor('agt_a', 'req-1', mint)
  assert.equal(first.requestId, 'req-1')
  assert.equal(first.sessionId, 'fresh-x')
  assert.equal(typeof first.createdAt, 'string')

  const retry = await store.freshSessionFor('agt_a', 'req-1', mint)
  assert.equal(retry.sessionId, 'fresh-x', 'retry returns the SAME session, mint is not called again')
  assert.equal(store.freshSessionsSnapshot().length, 1)
})

test('11. freshSessionFor: different requestIds mint different sessions', async (t) => {
  const store = new BindingStore({ storeFile: await tmpStore(t) })
  const a = await store.freshSessionFor('agt_a', 'req-A', mint)
  const b = await store.freshSessionFor('agt_a', 'req-B', mint)
  assert.notEqual(a.sessionId, b.sessionId)
  assert.equal(store.freshSessionsSnapshot().length, 2)
})

test('12. freshSessionFor: mapping is per-agent (same requestId, two agents)', async (t) => {
  const store = new BindingStore({ storeFile: await tmpStore(t) })
  const a = await store.freshSessionFor('agt_a', 'req-1', mint)
  const b = await store.freshSessionFor('agt_b', 'req-1', mint)
  // The mapping namespace is (agentId, requestId): both rows exist side by
  // side, each agent resolves its own row for the same requestId.
  assert.equal(store.getFreshSession('agt_a', 'req-1').sessionId, a.sessionId)
  assert.equal(store.getFreshSession('agt_b', 'req-1').sessionId, b.sessionId)
  assert.equal(store.freshSessionsSnapshot().length, 2)
})

test('13. freshSessionFor hands the mint the used-id set (router collision loop input)', async (t) => {
  const store = new BindingStore({ storeFile: await tmpStore(t) })
  const seen = []
  await store.freshSessionFor('agt_a', 'req-0', (used) => { seen.push([...used]); return 'fresh-x' })
  await store.freshSessionFor('agt_a', 'req-1', (used) => { seen.push([...used]); return 'fresh-y' })
  assert.deepEqual(seen, [[], ['fresh-x']], 'second mint sees the first session id')
  // The router's mint loop uses that set to pick a collision-free id.
  const third = await store.freshSessionFor('agt_a', 'req-2', (used) => {
    let id = 'fresh-y'
    let n = 0
    while (used.has(id)) id = `fresh-y-${++n}`
    return id
  })
  assert.equal(third.sessionId, 'fresh-y-1')
})

test('14. freshSessionFor: concurrent first deliveries converge on ONE row', async (t) => {
  const store = new BindingStore({ storeFile: await tmpStore(t) })
  const [a, b] = await Promise.all([
    store.freshSessionFor('agt_a', 'req-1', mint),
    store.freshSessionFor('agt_a', 'req-1', mint),
  ])
  assert.equal(a.sessionId, b.sessionId, 'atomic read-or-mint inside the mutation queue')
  assert.equal(store.freshSessionsSnapshot().length, 1)
})

test('15. freshSessions survive restart; older documents (no table) still load', async (t) => {
  const file = await tmpStore(t)
  const first = new BindingStore({ storeFile: file })
  await first.freshSessionFor('agt_a', 'req-1', mint)
  await first.set(row('feishu:chat-x', 'agt_a', 'main'))

  const second = new BindingStore({ storeFile: file }) // control-plane restart
  assert.equal(second.getFreshSession('agt_a', 'req-1').sessionId, 'fresh-x')
  assert.equal(second.getFreshSession('agt_a', 'req-2'), undefined)
  assert.equal(second.freshSessionsSnapshot().length, 1)
  assert.equal(second.get('feishu:chat-x').activeAgentId, 'agt_a', 'bindings table unaffected')

  // A document written BEFORE Delivery V0 (no freshSessions field) must keep
  // loading — the field is optional.
  const oldDoc = JSON.parse(await readFile(file, 'utf8'))
  delete oldDoc.freshSessions
  await writeFile(file, JSON.stringify(oldDoc))
  const third = new BindingStore({ storeFile: file })
  assert.equal(third.freshSessionsSnapshot().length, 0)
  assert.equal(third.get('feishu:chat-x').activeAgentId, 'agt_a')
})

test('16. freshSessionFor validation and corrupt-table fail-loud', async (t) => {
  const file = await tmpStore(t)
  const store = new BindingStore({ storeFile: file })
  await assert.rejects(async () => store.freshSessionFor('', 'req', mint), (e) => e.code === VALIDATION_ERROR)
  await assert.rejects(async () => store.freshSessionFor('agt_a', '', mint), (e) => e.code === VALIDATION_ERROR)
  await assert.rejects(async () => store.freshSessionFor('agt_a', 'req', undefined), (e) => e.code === VALIDATION_ERROR)
  await assert.rejects(async () => store.freshSessionFor('agt_a', 'req', () => ''), (e) => e.code === VALIDATION_ERROR)
  await store.freshSessionFor('agt_a', 'req-0', () => 'fresh-x') // occupies 'fresh-x'
  await assert.rejects(async () => store.freshSessionFor('agt_a', 'req', () => 'fresh-x'), (e) => e.code === VALIDATION_ERROR)

  // A corrupt freshSessions table fails loud at load (never silently reset).
  await store.freshSessionFor('agt_a', 'req-1', mint)
  const doc = JSON.parse(await readFile(file, 'utf8'))
  doc.freshSessions.agt_a['req-1'].sessionId = ''
  await writeFile(file, JSON.stringify(doc))
  assert.throws(() => new BindingStore({ storeFile: file }), (e) => e.code === CORRUPT_STORE)
})
