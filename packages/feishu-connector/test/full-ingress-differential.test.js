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
      if (field === 'text' && raw.message.message_type === 'post') {
        assert.equal(actual.text, normalized.content, 'post text authority is SDK-normalized Markdown')
        continue
      }
      assert.deepEqual(actual[field], expected[field], `${field} drift`)
    }
    assert.equal(actual.workspace, undefined)
    assert.equal(actual.session, undefined)
  })
}

function complexPostVector() {
  return {
    schema: '2.0',
    event_id: 'evt_complex_post',
    event_type: 'im.message.receive_v1',
    sender: {
      sender_id: { open_id: 'ou_complex_sender', union_id: 'on_complex_sender', user_id: 'u_complex_sender' },
      sender_type: 'user',
      name: 'complex-sender',
    },
    message: {
      message_id: 'om_complex_post',
      chat_id: 'oc_complex_post',
      chat_type: 'group',
      message_type: 'post',
      create_time: '1712000000',
      mentions: [
        { key: '@_bot', id: { open_id: botIdentity.openId, union_id: 'on_bot', user_id: 'u_bot' }, name: botIdentity.name },
        { key: '@_human', id: { open_id: 'ou_human', union_id: 'on_human', user_id: 'u_human' }, name: 'Alice' },
      ],
      content: JSON.stringify({
        title: 'Complex Title',
        content: [
          [
            { tag: 'at', user_id: botIdentity.openId, user_name: botIdentity.name },
            { tag: 'text', text: ' bold ', style: ['bold'] },
            { tag: 'text', text: 'italic', style: ['italic'] },
            { tag: 'at', user_id: 'ou_human', user_name: 'Alice' },
          ],
          [
            { tag: 'img', image_key: 'img_complex', alt: 'diagram' },
            { tag: 'media', file_key: 'media_complex', file_name: 'clip.mp4', file_size: '77' },
            { tag: 'a', href: 'file/file_shared', text: 'report.pdf', file_size: '2048' },
            { tag: 'a', href: 'file/file_shared', text: 'report copy' },
            { tag: 'url', href: 'file/file_without_metadata' },
          ],
          [],
          [{ tag: 'code_block', language: 'js', text: 'const x = 1;' }],
          [{ tag: 'md', text: '**md bold**\n```js\n@inside\n```\n<at user_id="ou_human">Alice</at>' }],
        ],
      }),
    },
  }
}

test('BOT_PLACEHOLDER_STRIPPING_EXPLICIT_ACCEPTED_DELTA + COMPLEX_POST_SEMANTIC_CONTENT_MATRIX', async () => {
  const raw = complexPostVector()
  const normalized = await normalize(raw, { botIdentity, includeRaw: true, stripBotMentions: true })
  const actual = normalizedToIngressEvent(normalized, { botIdentity, now: fixedNow })

  assert.equal(actual.text, normalized.content, 'bridge preserves SDK-normalized Markdown exactly')
  assert.doesNotMatch(actual.text, /@_bot|@my-bot/, 'bot transport placeholder is stripped from Agent text')
  assert.match(actual.text, /\*\*Complex Title\*\*/)
  assert.match(actual.text, /\*\* bold \*\*/)
  assert.match(actual.text, /\*italic\*/)
  assert.match(actual.text, /@Alice/)
  assert.match(actual.text, /```js\nconst x = 1;\n```/)
  assert.match(actual.text, /```js\n@inside\n```/, 'fenced content is not mention-normalized')
  assert.match(actual.text, /\n\n\n```js/, 'empty post line and code-block spacing survive SDK normalization')
  assert.equal(actual.mentioned, true)
  assert.equal(actual.mentions.find((mention) => mention.type === 'bot')?.openId, botIdentity.openId)
  assert.equal(actual.mentions.find((mention) => mention.name === 'Alice')?.openId, 'ou_human')
})

test('POST_FILE_LINK_ATTACHMENT_DIFFERENTIAL + NO_ATTACHMENT_INFORMATION_LOSS', async () => {
  const raw = complexPostVector()
  const normalized = await normalize(raw, { botIdentity, includeRaw: true, stripBotMentions: true })
  assert.deepEqual(normalized.resources.map(({ type, fileKey }) => ({ type, fileKey })), [
    { type: 'image', fileKey: 'img_complex' },
    { type: 'file', fileKey: 'media_complex' },
  ], 'pinned SDK public resources omit post file links')

  const actual = normalizedToIngressEvent(normalized, { botIdentity, now: fixedNow })
  assert.deepEqual(actual.attachments, [
    {
      type: 'image',
      fileKey: 'img_complex',
      downloadHint: { kind: 'image', endpoint: 'im/v1/images', key: 'img_complex' },
      name: 'diagram',
    },
    {
      type: 'file',
      fileKey: 'media_complex',
      downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: 'media_complex' },
      name: 'clip.mp4',
      sizeBytes: 77,
    },
    {
      type: 'file',
      fileKey: 'file_shared',
      name: 'report.pdf',
      sizeBytes: 2048,
      downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: 'file_shared' },
    },
    {
      type: 'file',
      fileKey: 'file_shared',
      name: 'report copy',
      sizeBytes: undefined,
      downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: 'file_shared' },
    },
    {
      type: 'file',
      fileKey: 'file_without_metadata',
      name: undefined,
      sizeBytes: undefined,
      downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: 'file_without_metadata' },
    },
  ])
})

test('NO_RAW_TEXT_RENORMALIZATION: raw projection cannot replace SDK post text', () => {
  const rawContent = JSON.stringify({
    title: 'raw title must not become text',
    content: [[
      { tag: 'text', text: 'raw body must not become text' },
      { tag: 'a', href: 'file/raw_attachment', text: 'attachment.txt', file_size: '9' },
    ]],
  })
  const actual = normalizedToIngressEvent({
    messageId: 'om_no_raw_text',
    chatId: 'oc_no_raw_text',
    chatType: 'p2p',
    senderId: 'ou_sender',
    senderType: 'user',
    content: '**SDK normalized authority**',
    rawContentType: 'post',
    resources: [],
    mentions: [],
    mentionAll: false,
    mentionedBot: false,
    createTime: 1712000000000,
    raw: {
      event_id: 'evt_no_raw_text',
      sender: { sender_id: { open_id: 'ou_sender' }, sender_type: 'user' },
      message: { content: rawContent },
    },
  }, { botIdentity, now: fixedNow })

  assert.equal(actual.text, '**SDK normalized authority**')
  assert.deepEqual(actual.attachments, [{
    type: 'file',
    fileKey: 'raw_attachment',
    name: 'attachment.txt',
    sizeBytes: 9,
    downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: 'raw_attachment' },
  }])
})
