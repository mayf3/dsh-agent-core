import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reply, textContent } from '../src/api.js'
import { buildReplyTarget, replyTargetFor } from '../src/core.js'
import { p2pTextEvent, threadReplyEvent } from '../fixtures/fixtures.js'

/** A mock Lark client that records the last create/reply arguments. */
function mockLarkClient() {
  const calls = { create: [], reply: [] }
  const client = {
    im: {
      message: {
        async create(opts) {
          calls.create.push(opts)
          return { code: 0, data: { message_id: 'om_created_1', chat_id: opts.data.receive_id } }
        },
        async reply(opts) {
          calls.reply.push(opts)
          return { code: 0, data: { message_id: 'om_replied_1', chat_id: 'oc_xxx' } }
        },
      },
    },
  }
  return { client, calls }
}

test('textContent builds a Feishu text content JSON string', () => {
  assert.equal(textContent('hi'), '{"text":"hi"}')
})

// --- 2. reply (outbound API request construction) ---
test('reply() to a p2p message posts via im.message.reply with correct message_id', async () => {
  const { client, calls } = mockLarkClient()
  const target = buildReplyTarget({ conversationId: 'oc_p2p_001', chatId: 'oc_p2p_001', channel: 'p2p' })
  const result = await reply(client, target.replyTo('om_p2p_msg_001'), 'the answer is 42')
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].path.message_id, 'om_p2p_msg_001')
  assert.equal(calls.reply[0].data.msg_type, 'text')
  assert.deepEqual(JSON.parse(calls.reply[0].data.content), { text: 'the answer is 42' })
  // p2p reply is NOT in a thread → no reply_in_thread flag
  assert.equal(calls.reply[0].data.reply_in_thread, undefined)
  assert.equal(result.messageId, 'om_replied_1')
  assert.equal(result.method, 'reply')
})

test('reply() into a topic thread sets reply_in_thread=true', async () => {
  const { client, calls } = mockLarkClient()
  const ev = { ...threadReplyEvent }
  // normalize minimal, or use core to build target
  const { normalizeIngressEvent } = await import('../src/core.js')
  const ingress = normalizeIngressEvent(ev)
  const target = replyTargetFor(ingress)
  await reply(client, target.replyTo(ingress.messageId), 'in-thread reply')
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].path.message_id, ingress.messageId)
  assert.equal(calls.reply[0].data.reply_in_thread, true)
})

test('direct chat create posts conversation_id as receive_id (chat_id type)', async () => {
  const { client, calls } = mockLarkClient()
  const target = buildReplyTarget({ conversationId: 'oc_group_001', chatId: 'oc_group_001', channel: 'group' })
  await reply(client, target.directChat('oc_group_001'), 'top-level message')
  assert.equal(calls.create.length, 1)
  assert.equal(calls.create[0].params.receive_id_type, 'chat_id')
  assert.equal(calls.create[0].data.receive_id, 'oc_group_001')
  assert.equal(calls.create[0].data.msg_type, 'text')
})

test('unknown ReplyTarget kind throws', async () => {
  const { client } = mockLarkClient()
  await assert.rejects(() => reply(client, { kind: 'nope' }, 'x'), /ReplyTarget kind/)
})

test('reply() to a p2p ingress returns the sent message id', async () => {
  const { client } = mockLarkClient()
  const { normalizeIngressEvent } = await import('../src/core.js')
  const ingress = normalizeIngressEvent(p2pTextEvent)
  const target = replyTargetFor(ingress)
  const result = await reply(client, target.replyTo(ingress.messageId), 'ok')
  assert.equal(result.messageId, 'om_replied_1')
  assert.equal(result.method, 'reply')
  assert.equal(typeof result.chatId, 'string')
})
