import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFeishuTransport } from '../src/transport.js'
import { normalizeIngressEvent, LruDedup, dedupEvent } from '../src/core.js'
import { p2pTextEvent } from '../fixtures/fixtures.js'

/** Mock WSClient with controllable start/close. */
function mockWs({ failStart = false } = {}) {
  const ws = {
    started: false,
    closed: false,
    startedWith: null,
    async start(opts) {
      if (failStart) throw new Error('connection refused')
      this.started = true
      this.startedWith = opts
    },
    async close() {
      this.closed = true
    },
  }
  return ws
}

test('transport start transitions to connected and invokes onStatus', async () => {
  const ws = mockWs()
  const statuses = []
  const t = createFeishuTransport({
    ws,
    eventDispatcher: {},
    config: { appId: 'cli_x' },
    onStatus: (s) => statuses.push(s.status),
    onEvent: async () => {},
    log: () => {},
  })
  await t.start()
  assert.deepEqual(statuses, ['connecting', 'connected'])
  assert.equal(t.state.connectionStatus, 'connected')
  assert.equal(ws.started, true)
})

test('transport failed start -> disconnected status + error surfaced', async () => {
  const ws = mockWs({ failStart: true })
  const statuses = []
  const t = createFeishuTransport({
    ws,
    eventDispatcher: {},
    config: {},
    onStatus: (s) => statuses.push(s.status),
    onEvent: async () => {},
    log: () => {},
  })
  await assert.rejects(() => t.start(), /connection refused/)
  assert.equal(t.state.connectionStatus, 'disconnected')
})

// --- 7. disconnect → reconnect ---
test('notification of reconnect updates status + count and emits onStatus', async () => {
  const ws = mockWs()
  const statuses = []
  const reconnects = []
  const t = createFeishuTransport({
    ws,
    eventDispatcher: {},
    config: {},
    onStatus: (s) => statuses.push(s.status),
    onReconnect: (info) => reconnects.push(info.count),
    onEvent: async () => {},
    log: () => {},
  })
  await t.start()
  // simulate the SDK reconnecting
  t.notifyReconnect()
  t.notifyReconnect()
  assert.equal(t.state.reconnectCount, 2)
  assert.equal(t.state.connectionStatus, 'reconnecting')
  assert.deepEqual(reconnects, [1, 2])
  assert.equal(statuses[statuses.length - 1], 'reconnecting')
})

test('after a reconnect, a message is still ingested and deduped', async () => {
  const ws = mockWs()
  const received = []
  let onEventCb
  const t = createFeishuTransport({
    ws,
    eventDispatcher: {},
    config: {},
    onStatus: () => {},
    onEvent: async (raw) => { onEventCb?.(raw) },
    log: () => {},
  })
  await t.start()

  // Simulate the plugin's per-event wiring (dedup + normalize + callback).
  const dedup = new LruDedup({ maxSize: 100 })
  const receivedEvents = []
  onEventCb = async (raw) => {
    const ev = normalizeIngressEvent(raw)
    if (dedupEvent(ev, dedup) === 'duplicate') return
    receivedEvents.push(ev)
  }

  // First message delivered.
  t.notifyReconnect() // disconnect happened
  await t.ingest(p2pTextEvent)
  assert.equal(receivedEvents.length, 1)
  assert.equal(receivedEvents[0].text, 'hello bot, please multiply 6 by 7')
  assert.equal(t.state.reconnectCount, 1)

  // Re-send of the SAME event after reconnect is deduped.
  await t.ingest(p2pTextEvent)
  assert.equal(receivedEvents.length, 1) // unchanged → deduped
})

test('graceful stop closes the connection and marks stopped', async () => {
  const ws = mockWs()
  const t = createFeishuTransport({
    ws,
    eventDispatcher: {},
    config: {},
    onStatus: () => {},
    onEvent: async () => {},
    log: () => {},
  })
  await t.start()
  await t.stop()
  assert.equal(ws.closed, true)
  assert.equal(t.state.connectionStatus, 'disconnected')
})
