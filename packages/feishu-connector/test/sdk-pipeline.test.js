import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createBridgeHandler } from '../src/bridge.js'
import { FOUNDATION_LARK_CHANNEL_OPTIONS } from '../src/core.js'
import { groupMentionedEvent, groupUnmentionedEvent, p2pTextEvent } from '../fixtures/fixtures.js'
import { dispatchEnvelope, nextTurn, realSdkChannel, TEST_BOT_IDENTITY } from './real-sdk-harness.js'

function cloneWithMessageId(envelope, messageId) {
  return {
    ...structuredClone(envelope),
    header: { ...envelope.header, event_id: `evt_${messageId}` },
    event: {
      ...structuredClone(envelope.event),
      message: { ...structuredClone(envelope.event.message), message_id: messageId },
    },
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

test('AC-ATALL-V0-PARITY and AC-NO-MENTION: real dispatcher preserves @all-only and silently drops ordinary group text', async (t) => {
  const gateCalls = []
  const turns = []
  const receipts = []
  const config = {
    ingressGate: async (event) => { gateCalls.push(event.messageId); return { allowed: true } },
    onEvent: async (event) => { turns.push(event.messageId) },
  }
  const bridge = createBridgeHandler({
    resolveBotIdentity: () => TEST_BOT_IDENTITY,
    config,
    reply: async (event) => { receipts.push(event.messageId) },
  })
  const channel = realSdkChannel({ onMessage: bridge })
  t.after(() => channel.safety.dispose())

  const atAll = cloneWithMessageId(groupMentionedEvent, 'om_atall_only')
  atAll.event.message.content = '{"text":"@_all hello"}'
  atAll.event.message.mentions = [{ key: '@_all', id: {}, name: '所有人' }]
  await dispatchEnvelope(channel, atAll)
  const topicAtAll = cloneWithMessageId(atAll, 'om_topic_atall_only')
  topicAtAll.event.message.thread_id = 'omt_atall'
  topicAtAll.event.message.root_id = 'om_atall_root'
  await dispatchEnvelope(channel, topicAtAll)
  await nextTurn()
  assert.deepEqual(gateCalls, ['om_atall_only', 'om_topic_atall_only'])
  assert.deepEqual(turns, ['om_atall_only', 'om_topic_atall_only'])

  const ordinary = cloneWithMessageId(groupUnmentionedEvent, 'om_no_mention')
  await dispatchEnvelope(channel, ordinary)
  const ordinaryTopic = cloneWithMessageId(ordinary, 'om_topic_no_mention')
  ordinaryTopic.event.message.thread_id = 'omt_no_mention'
  await dispatchEnvelope(channel, ordinaryTopic)
  await nextTurn()
  assert.deepEqual(gateCalls, ['om_atall_only', 'om_topic_atall_only'], 'ordinary group/topic message never reaches gate')
  assert.deepEqual(turns, ['om_atall_only', 'om_topic_atall_only'], 'ordinary group/topic message never reaches Router')
  assert.deepEqual(receipts, [], 'ordinary group message is a silent drop')
})

test('AC-REAL-SDK-ASYNC-DISPATCH and renewable lock: dispatch returns early, duplicate stays blocked beyond TTL, seen marks after settle', async (t) => {
  const held = deferred()
  let entered = 0
  let settled = false
  const bridge = createBridgeHandler({
    resolveBotIdentity: () => TEST_BOT_IDENTITY,
    config: {
      ingressGate: async () => ({ allowed: true }),
      onEvent: async () => { entered += 1; await held.promise; settled = true },
    },
  })
  const channel = realSdkChannel({
    safety: { processingLock: { ttlMs: 40, renewIntervalMs: 10 } },
    onMessage: bridge,
  })
  t.after(() => channel.safety.dispose())
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.safety.chatQueue.enabled, false)

  const event = cloneWithMessageId(p2pTextEvent, 'om_pending_lease')
  const transportDispatch = dispatchEnvelope(channel, event)
  await transportDispatch
  assert.equal(settled, false, 'transport dispatch completion is not turn completion')
  assert.equal(entered, 1)

  await new Promise((resolve) => setTimeout(resolve, 95))
  await dispatchEnvelope(channel, event)
  await nextTurn()
  assert.equal(entered, 1, 'renewal keeps duplicate blocked beyond two original TTL windows')

  held.resolve()
  await nextTurn()
  await nextTurn()
  assert.equal(settled, true)
  await dispatchEnvelope(channel, event)
  await nextTurn()
  assert.equal(entered, 1, 'post-settlement duplicate is dropped by SeenCache')
})

test('AC-HANDLER-ERROR-PUBLIC-SURFACE: rejected bridge Promise reaches public channel error exactly once; rejecting async observer is consumed', async (t) => {
  const observed = []
  const unhandled = []
  const onUnhandled = (reason) => unhandled.push(reason)
  process.on('unhandledRejection', onUnhandled)
  t.after(() => process.off('unhandledRejection', onUnhandled))

  const bridge = createBridgeHandler({
    resolveBotIdentity: () => TEST_BOT_IDENTITY,
    config: {
      ingressGate: async () => ({ allowed: true }),
      onEvent: async () => ({ error: new Error('terminal provider failure') }),
    },
  })
  const channel = realSdkChannel({
    onMessage: bridge,
    onError: async (error) => {
      observed.push(error)
      throw new Error('observer rejected intentionally')
    },
  })
  t.after(() => channel.safety.dispose())

  await dispatchEnvelope(channel, cloneWithMessageId(p2pTextEvent, 'om_error_surface'))
  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.equal(observed.length, 1)
  assert.match(observed[0].message, /terminal provider failure/)
  assert.equal(unhandled.length, 0, 'async observer rejection is safely consumed')
})

test('reviewed ProcessingLease uses exact id plus unforgeable generation token', async (t) => {
  const channel = realSdkChannel({ safety: { processingLock: { ttlMs: 20, renewIntervalMs: 5 } } })
  t.after(() => channel.safety.dispose())
  const lock = channel.safety.lock
  const first = lock.acquire('om_generation')
  assert.equal(first.id, 'om_generation')
  assert.equal(typeof first.ownerToken, 'symbol')

  const forged = Object.freeze({ id: first.id, ownerToken: Symbol(first.id) })
  lock.stopRenewal(forged)
  lock.release(forged)
  assert.equal(lock.acquire(first.id), undefined, 'non-owner cannot release the current generation')

  const stallUntil = Date.now() + 55
  while (Date.now() < stallUntil) { /* event-loop stall longer than TTL */ }
  assert.equal(lock.acquire(first.id), undefined, 'event-loop stall beyond TTL cannot mint a second owner')

  lock.stopRenewal(first)
  assert.equal(lock.acquire(first.id), undefined, 'finalizing owner remains held until exact release')
  lock.release(first)
  const second = lock.acquire(first.id)
  assert.notEqual(second.ownerToken, first.ownerToken, 'reacquire mints a new generation token')
  lock.stopRenewal(second)
  lock.release(second)
})

test('reviewed queued/batched SafetyPipeline keeps one exact lease per source until merged handler settlement', async (t) => {
  const held = deferred()
  let handlerCalls = 0
  const channel = realSdkChannel({
    safety: {
      chatQueue: { enabled: true },
      batch: { text: { delayMs: 15, maxMessages: 8, maxChars: 4000 } },
      processingLock: { ttlMs: 40, renewIntervalMs: 10 },
    },
    onMessage: async () => { handlerCalls += 1; await held.promise },
  })
  t.after(() => channel.safety.dispose())
  const one = cloneWithMessageId(p2pTextEvent, 'om_batch_source_one')
  const two = cloneWithMessageId(p2pTextEvent, 'om_batch_source_two')
  await Promise.all([dispatchEnvelope(channel, one), dispatchEnvelope(channel, two)])
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(handlerCalls, 1, 'two sources share one merged handler invocation')
  await new Promise((resolve) => setTimeout(resolve, 75))
  await Promise.all([dispatchEnvelope(channel, one), dispatchEnvelope(channel, two)])
  await nextTurn()
  assert.equal(handlerCalls, 1, 'each source lease independently blocks its duplicate beyond TTL')
  held.resolve()
  await new Promise((resolve) => setTimeout(resolve, 30))
  await Promise.all([dispatchEnvelope(channel, one), dispatchEnvelope(channel, two)])
  await nextTurn()
  assert.equal(handlerCalls, 1, 'each settled source is committed to SeenCache')
})

test('outcome_unknown remains a single failed turn with no connector retry and a lease covering final handling', async (t) => {
  const held = deferred()
  let turns = 0
  const observed = []
  const bridge = createBridgeHandler({
    resolveBotIdentity: () => TEST_BOT_IDENTITY,
    config: {
      ingressGate: async () => ({ allowed: true }),
      onEvent: async () => { turns += 1; await held.promise; return { error: Object.assign(new Error('turn outcome unknown'), { code: 'outcome_unknown' }) } },
    },
  })
  const channel = realSdkChannel({
    safety: { processingLock: { ttlMs: 40, renewIntervalMs: 10 } },
    onMessage: bridge,
    onError: (error) => observed.push(error),
  })
  t.after(() => channel.safety.dispose())
  const event = cloneWithMessageId(p2pTextEvent, 'om_outcome_unknown')
  await dispatchEnvelope(channel, event)
  await new Promise((resolve) => setTimeout(resolve, 90))
  await dispatchEnvelope(channel, event)
  assert.equal(turns, 1, 'no retry while outcome is unresolved')
  held.resolve()
  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.equal(observed.length, 1)
  assert.equal(turns, 1, 'connector never automatically replays a failed/unknown turn')
})

test('SDK SafetyPipeline converts a synchronous message handler throw to the same public error surface', async (t) => {
  const observed = []
  const channel = realSdkChannel({
    onMessage: () => { throw new Error('sync handler exploded') },
    onError: (error) => { observed.push(error) },
  })
  t.after(() => channel.safety.dispose())
  await dispatchEnvelope(channel, cloneWithMessageId(p2pTextEvent, 'om_sync_throw'))
  await nextTurn()
  assert.equal(observed.length, 1)
  assert.match(observed[0].message, /sync handler exploded/)
})
