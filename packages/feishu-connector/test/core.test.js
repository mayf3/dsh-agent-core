import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeIngressEvent,
  buildConversationId,
  buildReplyTarget,
  replyTargetFor,
  LruDedup,
  dedupEvent,
  classifyIngress,
  parseAttachments,
  parseSender,
  parseMentions,
} from '../src/core.js'
import {
  p2pTextEvent,
  groupMentionedEvent,
  groupUnmentionedEvent,
  threadReplyEvent,
  imageEvent,
  fileEvent,
  botEchoEvent,
  BOT_OPEN_ID,
} from '../fixtures/fixtures.js'

// --- 1. inbound p2p → normalized IngressEvent ---
test('p2p message normalizes to IngressEvent (channel=p2p)', () => {
  const ev = normalizeIngressEvent(p2pTextEvent, { botOpenId: BOT_OPEN_ID })
  assert.equal(ev.channel, 'p2p')
  assert.equal(ev.chatType, 'p2p')
  assert.equal(ev.eventId, 'evt_p2p_001')
  assert.equal(ev.messageId, 'om_p2p_msg_001')
  assert.equal(ev.conversationId, 'oc_p2p_001')
  assert.equal(ev.chatId, 'oc_p2p_001')
  assert.equal(ev.text, 'hello bot, please multiply 6 by 7')
  assert.equal(ev.sender.openId, 'ou_sender_p2p')
  assert.equal(ev.sender.unionId, 'on_sender_p2p')
  assert.equal(ev.sender.userId, 'u_sender_p2p')
  assert.equal(ev.sender.isBotSelf, false)
  assert.equal(ev.dedupKey, 'evt_p2p_001')
  // p2p is addressed to the bot by default
  const cls = classifyIngress(ev)
  assert.equal(cls.forward, true)
  assert.equal(cls.reason, 'p2p')
  // pure data: JSON-serializable
  assert.doesNotThrow(() => JSON.stringify(ev))
})

// --- 1b. inbound group (bot mentioned) ---
test('group message with bot mention normalizes to IngressEvent (channel=group)', () => {
  const ev = normalizeIngressEvent(groupMentionedEvent, { botOpenId: BOT_OPEN_ID })
  assert.equal(ev.channel, 'group')
  assert.equal(ev.chatType, 'group')
  assert.equal(ev.chatId, 'oc_group_001')
  assert.equal(ev.conversationId, 'oc_group_001')
  assert.equal(ev.mentioned, true)
  assert.equal(ev.sender.isBotSelf, false)
  // mentions include the bot itself with type 'bot'
  const botMention = ev.mentions.find((m) => m.type === 'bot')
  assert.ok(botMention)
  assert.equal(botMention.openId, 'ou_bot_self')
  const cls = classifyIngress(ev)
  assert.equal(cls.forward, true)
  assert.equal(cls.reason, 'group_mentioned')
})

// --- 4. p2p conversation identifier ---
test('p2p conversation identifier is the plain chat id', () => {
  assert.equal(buildConversationId({ chatId: 'oc_p2p_001', scope: 'p2p' }), 'oc_p2p_001')
})

// --- 3. group chat identifier (chat_type=group) ---
test('group chat identifier keeps chat_id and classifies as group', () => {
  const ev = normalizeIngressEvent(groupUnmentionedEvent, { botOpenId: BOT_OPEN_ID })
  assert.equal(ev.chatType, 'group')
  assert.equal(ev.conversationId, 'oc_group_001')
  // not mentioned → not forwarded
  const cls = classifyIngress(ev)
  assert.equal(cls.forward, false)
  assert.equal(cls.reason, 'group_not_mentioned')
})

// --- 5. thread identifiers ---
test('thread message preserves thread_id / root message and maps to thread channel', () => {
  const ev = normalizeIngressEvent(threadReplyEvent, { botOpenId: BOT_OPEN_ID })
  assert.equal(ev.channel, 'thread')
  assert.equal(ev.chatId, 'oc_group_002')
  assert.equal(ev.threadId, 'omt_thread_001')
  assert.equal(ev.rootMsgId, 'om_thread_root')
  assert.equal(ev.parentMsgId, 'om_thread_root')
  // canonical conversation id for the thread
  assert.equal(ev.conversationId, buildConversationId({ chatId: 'oc_group_002', scope: 'group_topic', threadId: 'omt_thread_001' }))
  assert.equal(ev.conversationId, 'oc_group_002:topic:omt_thread_001')
  const cls = classifyIngress(ev)
  assert.equal(cls.forward, true) // mentioned in thread
})

// ReplyTarget for a thread
test('ReplyTarget from a thread ingress replies inside the thread', () => {
  const ev = normalizeIngressEvent(threadReplyEvent, { botOpenId: BOT_OPEN_ID })
  const target = replyTargetFor(ev)
  const reply = target.replyTo(ev.messageId)
  assert.equal(reply.kind, 'reply')
  assert.equal(reply.replyMsgId, 'om_thread_msg_001')
  assert.equal(reply.replyInThread, true) // in a topic thread → reply_in_thread
  assert.equal(reply.threadId, 'omt_thread_001')
})

// --- 6. duplicate event dedup ---
test('same event_id is deduplicated a second time', () => {
  const store = new LruDedup({ maxSize: 100 })
  const ev1 = normalizeIngressEvent(p2pTextEvent)
  const ev2 = normalizeIngressEvent(p2pTextEvent)
  assert.equal(dedupEvent(ev1, store), 'accepted')
  assert.equal(store.size, 1)
  assert.equal(dedupEvent(ev2, store), 'duplicate')
  assert.equal(dedupEvent(ev1, store), 'duplicate')
})

test('LruDedup evicts oldest beyond maxSize', () => {
  const store = new LruDedup({ maxSize: 3 })
  for (const k of ['a', 'b', 'c', 'd']) store.record(k)
  assert.equal(store.size, 3)
  assert.equal(store.check('a'), false) // evicted
  assert.equal(store.check('b'), true)
})

// --- attachments ---
test('image attachment parses to a unified descriptor', () => {
  const ev = normalizeIngressEvent(imageEvent)
  assert.equal(ev.attachments.length, 1)
  const a = ev.attachments[0]
  assert.equal(a.type, 'image')
  assert.equal(a.fileKey, 'img_v2_abcd')
  assert.equal(a.downloadHint.endpoint, 'im/v1/images')
  assert.equal(ev.text, '[image]')
})

test('file attachment parses name + size + download hint', () => {
  const ev = normalizeIngressEvent(fileEvent)
  assert.equal(ev.attachments.length, 1)
  const a = ev.attachments[0]
  assert.equal(a.type, 'file')
  assert.equal(a.fileKey, 'file_v2_efgh')
  assert.equal(a.name, 'report.pdf')
  assert.equal(a.sizeBytes, 2048)
  assert.equal(ev.text, '[file report.pdf]')
})

// sender metadata
test('sender metadata includes ids, self-sent flag, is-bot flag', () => {
  const sender = parseSender(botEchoEvent.event, BOT_OPEN_ID)
  assert.equal(sender.openId, 'ou_bot_self')
  assert.equal(sender.senderType, 'app')
  assert.equal(sender.isBotSelf, true)
  assert.equal(sender.selfSent, true)
})

// parseMentions
test('parseMentions distinguishes all / user / bot', () => {
  const mentions = parseMentions(
    { mentions: [
      { key: '@_user_1', id: { open_id: 'ou_bot_self' }, name: 'my-bot' },
      { key: '@_user_2', id: { open_id: 'ou_other' }, name: 'alice' },
      { key: '@_all', name: '所有人' },
    ] },
    BOT_OPEN_ID,
  )
  const types = mentions.map((m) => m.type).sort()
  assert.deepEqual(types, ['all', 'bot', 'user'])
})

// classification edge
test('bot self-echo is classified but not forwarded', () => {
  const ev = normalizeIngressEvent(botEchoEvent, { botOpenId: BOT_OPEN_ID })
  const cls = classifyIngress(ev)
  assert.equal(cls.forward, false)
  assert.equal(cls.reason, 'self_echo')
})

// invalid event throws
test('invalid / non-message event throws', () => {
  assert.throws(() => normalizeIngressEvent({ header: { event_id: 'x' }, event: { message: { chat_type: 'unknown' } } }), /chat_type/)
  assert.throws(() => normalizeIngressEvent({ event: { message: { chat_type: 'p2p' } } }), /message_id/)
})
