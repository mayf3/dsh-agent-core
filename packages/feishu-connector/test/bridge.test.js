/**
 * Bridge mapping tests — the thin adapter over @larksuite/channel
 * NormalizedMessages (spec §6.3 IngressEvent mapping contract).
 *
 * Fixtures run through the REAL pinned SDK normalize() (offline injection)
 * so the mapping is exercised on genuine NormalizedMessage shapes.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalize } from '@larksuite/channel'
import { normalizedToIngressEvent } from '../src/bridge.js'
import {
  p2pTextEvent,
  groupMentionedEvent,
  groupUnmentionedEvent,
  threadReplyEvent,
  imageEvent,
  fileEvent,
  botEchoEvent,
  flattenV2Event,
  BOT_OPEN_ID,
} from '../fixtures/fixtures.js'

const botIdentity = { openId: BOT_OPEN_ID, name: 'my-bot' }

async function mapEvent(envelope, opts = {}) {
  const msg = await normalize(flattenV2Event(envelope), { botIdentity, includeRaw: true })
  return normalizedToIngressEvent(msg, { botIdentity, ...opts })
}

// ---------------------------------------------------------------------------
// field mapping parity (Router-consumed shape)
// ---------------------------------------------------------------------------

test('p2p text message maps to the IngressEvent shape', async () => {
  const ev = await mapEvent(p2pTextEvent)
  assert.equal(ev.type, 'message')
  assert.equal(ev.channel, 'p2p')
  assert.equal(ev.chatType, 'p2p')
  assert.equal(ev.eventId, 'evt_p2p_001')
  assert.equal(ev.messageId, 'om_p2p_msg_001')
  assert.equal(ev.conversationId, 'oc_p2p_001')
  assert.equal(ev.chatId, 'oc_p2p_001')
  assert.equal(ev.messageType, 'text')
  assert.equal(ev.subType, 'text')
  assert.equal(ev.sender.openId, 'ou_sender_p2p')
  assert.equal(ev.sender.unionId, 'on_sender_p2p')
  assert.equal(ev.sender.userId, 'u_sender_p2p')
  assert.equal(ev.sender.senderType, 'user')
  assert.equal(ev.sender.isBotSelf, false)
  assert.equal(ev.sender.selfSent, false)
  assert.equal(ev.mentioned, false)
  assert.equal(ev.addressed, true, 'p2p is addressed by default')
  assert.equal(ev.timestamp, 1712000000000)
  assert.equal(ev.dedupKey, 'evt_p2p_001')
  // the SDK text converter already unwraps {"text": ...}
  assert.equal(ev.text, 'hello bot, please multiply 6 by 7')
  assert.doesNotThrow(() => JSON.stringify(ev))
})

test('group @bot mention maps with mentioned=true and the bot mention typed', async () => {
  const ev = await mapEvent(groupMentionedEvent)
  assert.equal(ev.channel, 'group')
  assert.equal(ev.conversationId, 'oc_group_001')
  assert.equal(ev.mentioned, true)
  assert.equal(ev.addressed, true)
  const botMention = ev.mentions.find((m) => m.type === 'bot')
  assert.ok(botMention, 'the bot mention is typed bot')
  assert.equal(botMention.openId, BOT_OPEN_ID)
})

test('group message WITHOUT a bot mention maps with mentioned=false', async () => {
  const ev = await mapEvent(groupUnmentionedEvent)
  assert.equal(ev.mentioned, false)
  assert.equal(ev.addressed, false)
})

test('topic thread message carries threadId/rootMsgId/parentMsgId', async () => {
  const ev = await mapEvent(threadReplyEvent)
  assert.equal(ev.channel, 'thread')
  assert.equal(ev.chatId, 'oc_group_002')
  assert.equal(ev.threadId, 'omt_thread_001')
  assert.equal(ev.rootMsgId, 'om_thread_root')
  assert.equal(ev.parentMsgId, 'om_thread_root')
  assert.equal(ev.conversationId, 'oc_group_002:topic:omt_thread_001')
  assert.equal(ev.mentioned, true, 'thread message with bot mention')
})

test('image attachment maps onto the unified descriptor', async () => {
  const ev = await mapEvent(imageEvent)
  assert.equal(ev.attachments.length, 1)
  const a = ev.attachments[0]
  assert.equal(a.type, 'image')
  assert.equal(a.fileKey, 'img_v2_abcd')
  assert.equal(a.downloadHint.endpoint, 'im/v1/images')
})

test('file attachment maps with name + download hint', async () => {
  const ev = await mapEvent(fileEvent)
  assert.equal(ev.attachments.length, 1)
  const a = ev.attachments[0]
  assert.equal(a.type, 'file')
  assert.equal(a.fileKey, 'file_v2_efgh')
  assert.equal(a.name, 'report.pdf')
})

test('@all mention synthesizes the all-mention entry and sets mentioned', async () => {
  const ev = await mapEvent({
    ...groupMentionedEvent,
    event: {
      ...groupMentionedEvent.event,
      message: {
        ...groupMentionedEvent.event.message,
        message_id: 'om_group_msg_all_1',
        content: '{"text":"@_all hands up"}',
        mentions: [
          { key: '@_all', id: {}, name: '所有人' },
          { key: '@_user_1', id: { open_id: BOT_OPEN_ID }, name: 'my-bot' },
        ],
      },
    },
  })
  assert.equal(ev.mentioned, true)
  const all = ev.mentions.find((m) => m.type === 'all')
  assert.ok(all, 'all-mention synthesized with V0 shape')
  assert.equal(all.key, '@_all')
})

// ---------------------------------------------------------------------------
// V2 §5 — no workspace / session injection
// ---------------------------------------------------------------------------

test('V2: mapping attaches NO workspace and NO session (p2p)', async () => {
  const ev = await mapEvent(p2pTextEvent)
  assert.equal(ev.workspace, undefined, 'no conversation workspace injection')
  assert.equal(ev.session, undefined, 'no conversation session injection')
})

test('V2: mapping attaches NO workspace and NO session (group)', async () => {
  const ev = await mapEvent(groupMentionedEvent)
  assert.equal(ev.workspace, undefined)
  assert.equal(ev.session, undefined)
})

// ---------------------------------------------------------------------------
// self-echo / malformed guards
// ---------------------------------------------------------------------------

test('bot self-echo (sender_type=app) maps with selfSent — the bridge guard drops it', async () => {
  const ev = await mapEvent(botEchoEvent)
  assert.equal(ev.sender.senderType, 'app')
  assert.equal(ev.sender.selfSent, true)
  assert.equal(ev.sender.isBotSelf, true)
})

test('malformed events throw (drop-non-message guard, V0 parity)', () => {
  assert.throws(
    () => normalizedToIngressEvent({ messageId: 'om_x', chatType: 'weird', content: '', resources: [], mentions: [], mentionAll: false, mentionedBot: false, createTime: 0 }),
    /chat_type/,
  )
  assert.throws(
    () => normalizedToIngressEvent({ messageId: '', chatType: 'p2p', content: '', resources: [], mentions: [], mentionAll: false, mentionedBot: false, createTime: 0 }),
    /message_id/,
  )
})

test('missing createTime falls back to receipt time (V0 timestamp semantics)', async () => {
  const msg = await normalize(flattenV2Event(p2pTextEvent), { botIdentity, includeRaw: true })
  const ev = normalizedToIngressEvent({ ...msg, createTime: 0 }, { botIdentity, now: 1712999999999 })
  assert.equal(ev.timestamp, 1712999999999)
})
