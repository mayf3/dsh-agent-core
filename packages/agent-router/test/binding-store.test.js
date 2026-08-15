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
