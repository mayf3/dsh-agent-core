/**
 * Outbound compatibility tests (spec §10 — Contract 4) against the REAL
 * pinned @larksuite/channel OutboundSender: a genuine (unconnected)
 * LarkChannel whose rawClient transport methods are stubbed. This exercises
 * the true SDK code paths — text send, reply/reply_in_thread routing,
 * 3500-char chunking fidelity, fail-loud on API errors and empty
 * message_id — not a re-implementation.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createLarkChannel } from '@larksuite/channel'
import { buildReplyTarget, replyTargetToSdkSend } from '../src/core.js'
import { FOUNDATION_LARK_CHANNEL_OPTIONS } from '../src/core.js'

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

/** A real LarkChannel with the rawClient transport stubbed (no network). */
function stubbedChannel() {
  const calls = { create: [], reply: [] }
  const channel = createLarkChannel({
    appId: 'cli_test_outbound',
    appSecret: 'test',
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger,
  })
  channel.rawClient.im = {
    v1: {
      message: {
        async create(opts) {
          calls.create.push(opts)
          return { code: 0, data: { message_id: `om_created_${calls.create.length}`, chat_id: opts.data?.receive_id } }
        },
        async reply(opts) {
          calls.reply.push(opts)
          return { code: 0, data: { message_id: `om_replied_${calls.reply.length}`, chat_id: 'oc_x' } }
        },
      },
    },
  }
  return { channel, calls }
}

// ---------------------------------------------------------------------------
// text send / reply / thread routing (behavior-compat with V0)
// ---------------------------------------------------------------------------

test('SDK send: plain create posts a text message into receive_id (chat_id)', async () => {
  const { channel, calls } = stubbedChannel()
  const result = await channel.send('oc_group_001', { text: 'top-level message' })
  assert.equal(calls.create.length, 1)
  assert.equal(calls.create[0].params.receive_id_type, 'chat_id')
  assert.equal(calls.create[0].data.receive_id, 'oc_group_001')
  assert.equal(calls.create[0].data.msg_type, 'text')
  assert.deepEqual(JSON.parse(calls.create[0].data.content), { text: 'top-level message' })
  assert.equal(result.messageId, 'om_created_1')
})

test('SDK send: reply via replyTo targets im.message.reply with reply_in_thread', async () => {
  const { channel, calls } = stubbedChannel()
  await channel.send('oc_group_001', { text: 'in-thread reply' }, { replyTo: 'om_9', replyInThread: true })
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].path.message_id, 'om_9')
  assert.equal(calls.reply[0].data.msg_type, 'text')
  assert.equal(calls.reply[0].data.reply_in_thread, true)
  assert.equal(calls.create.length, 0, 'anchored reply never degrades to a top-level create')
})

test('SDK send: p2p reply carries reply_in_thread=false (no thread escape)', async () => {
  const { channel, calls } = stubbedChannel()
  await channel.send('oc_p2p_001', { text: 'plain reply' }, { replyTo: 'om_1', replyInThread: false })
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].path.message_id, 'om_1')
  assert.equal(calls.reply[0].data.reply_in_thread, false)
})

test('ReplyTarget → SDK plan: create_thread anchors at the root message (thread placement)', async () => {
  const { channel, calls } = stubbedChannel()
  const target = buildReplyTarget({ conversationId: 'oc_g:topic:omt_t', chatId: 'oc_g', channel: 'thread', threadId: 'omt_t', rootMsgId: 'om_root' })
  const plan = replyTargetToSdkSend(target.asThread(), 'thread reply')
  const result = await channel.send(plan.to, plan.input, plan.opts)
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].path.message_id, 'om_root', 'anchored at the thread ROOT')
  assert.equal(calls.reply[0].data.reply_in_thread, true)
  assert.equal(result.messageId, 'om_replied_1')
})

// ---------------------------------------------------------------------------
// long-text chunking (fidelity-only)
// ---------------------------------------------------------------------------

test('SDK send: an in-limit message is NEVER split (single create, single call)', async () => {
  const { channel, calls } = stubbedChannel()
  const text = 'x'.repeat(3000)
  const result = await channel.send('oc_group_001', { text })
  assert.equal(calls.create.length, 1)
  assert.deepEqual(JSON.parse(calls.create[0].data.content), { text })
  assert.equal(result.chunkIds, undefined)
})

test('SDK send: an over-limit message is fully delivered via chunks (nothing lost)', async () => {
  const { channel, calls } = stubbedChannel()
  const text = `${'y'.repeat(2500)}\n\`\`\`js\nconst a = 1\n\`\`\`\n${'z'.repeat(6500)}`
  const result = await channel.send('oc_group_001', { text })
  assert.ok(calls.create.length > 1, `expected chunking, got ${calls.create.length} calls`)
  assert.ok(calls.create.every((c) => JSON.parse(c.data.content).text.length <= 3500), 'every chunk within the 3500 limit')
  const rejoined = calls.create.map((c) => JSON.parse(c.data.content).text).join('')
  assert.equal(rejoined, text, 'chunks reassemble to the exact original content')
  assert.equal(result.messageId, 'om_created_1')
  assert.equal(result.chunkIds.length, calls.create.length)
})

// ---------------------------------------------------------------------------
// fail-loud (API_ERROR_FAIL_LOUD + EMPTY_MESSAGE_ID_REJECTION)
// ---------------------------------------------------------------------------

test('SDK send: a non-zero Feishu code (no message_id) REJECTS — never a fake success', async () => {
  const { channel } = stubbedChannel()
  channel.rawClient.im.v1.message.create = async () => ({ code: 230002, msg: 'InvalidContent' })
  await assert.rejects(() => channel.send('oc_group_001', { text: 'x' }))
})

test('SDK send: a transport error REJECTS', async () => {
  const { channel } = stubbedChannel()
  channel.rawClient.im.v1.message.create = async () => { throw Object.assign(new Error('boom'), { response: { status: 500, data: { code: 99991400 } } }) }
  await assert.rejects(() => channel.send('oc_group_001', { text: 'x' }))
})

test('SDK send: a "successful" response with an empty message_id REJECTS', async () => {
  const { channel } = stubbedChannel()
  channel.rawClient.im.v1.message.create = async () => ({ code: 0, data: {} })
  await assert.rejects(() => channel.send('oc_group_001', { text: 'x' }), /message_id/)
})

test('handle-level fail-loud: the connector reply seam adds its own empty-messageId rejection', async () => {
  const { channel } = stubbedChannel()
  // simulates an SDK that somehow returned an empty id without throwing
  const fakeChannel = { send: async () => ({ messageId: '' }) }
  const target = buildReplyTarget({ conversationId: 'oc_p', chatId: 'oc_p', channel: 'p2p' }).replyTo('om_1')
  const plan = replyTargetToSdkSend(target, 'hello')
  const result = await fakeChannel.send(plan.to, plan.input, plan.opts)
  assert.equal(result.messageId, '')
  // the handle's own guard turns that into a rejection
  const { buildFeishuHandle } = await import('../src/index.js')
  const handle = buildFeishuHandle({
    channel,
    cfg: { onEvent: null, ingressGate: null, onStatus: null },
    log: () => {},
    connect: async () => {},
  })
  handle._channel.send = async () => ({ messageId: '' })
  await assert.rejects(() => handle.reply(target, 'hello'), /message_id/)
})
