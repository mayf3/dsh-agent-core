import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalize } from '@larksuite/channel'
import { normalizedToIngressEvent } from '../src/bridge.js'
import { normalizeIngressEvent as legacyNormalize } from './legacy-v0-oracle.js'

const botIdentity = { openId: 'ou_bot_self', name: 'my-bot' }
const fixedNow = 1712999999999

const contentByType = {
  text: { text: 'hello body' },
  post: { title: 'ignored legacy title', content: [[{ tag: 'text', text: 'post body' }, { tag: 'img', image_key: 'img_post', alt: 'diagram' }]] },
  image: { image_key: 'img_key' },
  file: { file_key: 'file_key', file_name: 'report.pdf', file_size: '2048' },
  audio: { file_key: 'audio_key', duration: '1234' },
  video: { file_key: 'video_key', file_name: 'clip.mp4', duration: '5678', image_key: 'cover_key' },
  sticker: { file_key: 'sticker_key' },
}

function vector({ id, type = 'text', chatType = 'p2p', thread = false, mention = 'none', createTime = '1712000000', withEventId = true }) {
  const mentions = mention === 'bot'
    ? [{ key: '@_bot', id: { open_id: botIdentity.openId, union_id: 'on_bot', user_id: 'u_bot' }, name: botIdentity.name }]
    : mention === 'all'
      ? [{ key: '@_all', id: {}, name: '所有人' }]
      : []
  return {
    schema: '2.0',
    ...(withEventId ? { event_id: `evt_${id}` } : {}),
    event_type: 'im.message.receive_v1',
    sender: {
      sender_id: { open_id: `ou_${id}`, union_id: `on_${id}`, user_id: `u_${id}` },
      sender_type: 'user',
      name: `sender-${id}`,
    },
    message: {
      message_id: `om_${id}`,
      root_id: thread ? `om_root_${id}` : '',
      parent_id: thread ? `om_parent_${id}` : '',
      ...(thread ? { thread_id: `omt_${id}` } : {}),
      create_time: createTime,
      chat_id: `oc_${id}`,
      chat_type: chatType,
      message_type: type,
      content: JSON.stringify(contentByType[type]),
      mentions,
    },
  }
}

const vectors = [
  vector({ id: 'p2p_text', mention: 'none' }),
  vector({ id: 'group_bot', chatType: 'group', mention: 'bot' }),
  vector({ id: 'topic_all', chatType: 'group', thread: true, mention: 'all' }),
  vector({ id: 'post', type: 'post' }),
  vector({ id: 'image', type: 'image' }),
  vector({ id: 'file', type: 'file' }),
  vector({ id: 'audio', type: 'audio' }),
  vector({ id: 'video', type: 'video' }),
  vector({ id: 'sticker', type: 'sticker' }),
  vector({ id: 'milliseconds', createTime: '1712000000123' }),
  vector({ id: 'fallback', createTime: 'not-a-time', withEventId: false }),
]

const parityFields = [
  'eventId', 'type', 'subType', 'channel', 'chatType', 'conversationId',
  'chatId', 'threadId', 'rootMsgId', 'parentMsgId', 'messageId', 'messageType',
  'sender', 'text', 'mentions', 'mentioned', 'addressed', 'attachments',
  'timestamp', 'dedupKey', 'raw',
]

for (const raw of vectors) {
  test(`AC-FULL-INGRESS-DIFFERENTIAL: ${raw.message.message_id}`, async () => {
    const normalized = await normalize(raw, {
      botIdentity,
      includeRaw: true,
      stripBotMentions: true,
    })
    const actual = normalizedToIngressEvent(normalized, { botIdentity, now: fixedNow })
    const expected = legacyNormalize(raw, { botOpenId: botIdentity.openId, now: fixedNow })
    // V2's SDK raw authority is dispatcher-flattened. The V0 oracle predates
    // that surface and only read nested header.event_id, so apply the frozen
    // V2 mechanical event-id/raw mapping before the full field comparison.
    expected.eventId = raw.event_id ?? ''
    expected.dedupKey = expected.eventId || `message:${expected.messageId}`
    expected.raw = raw
    for (const field of parityFields) {
      assert.deepEqual(actual[field], expected[field], `${field} drift`)
    }
    assert.equal(actual.workspace, undefined)
    assert.equal(actual.session, undefined)
  })
}
