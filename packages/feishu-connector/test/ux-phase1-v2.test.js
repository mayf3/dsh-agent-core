/**
 * AGENT_CORE_LARK_UX_PHASE1_V2 (+ heading-normalization amendment) UX tests.
 *
 * Covers the two first-round UX activations end to end at the unit and
 * integration level:
 *
 *   1. SDK-native Markdown for Agent success replies (markdown send plan,
 *      native heading normalization payload semantics, emphasis/lists/fence/
 *      link/table byte stability, 3500 chunking with fence close/reopen,
 *      first-chunk-only mention outside code fences).
 *   2. Triggering-sender auto mention (ReplyTarget mention-context derivation
 *      from IngressEvent.sender.openId only; group/topic activation; p2p /
 *      missing / invalid identity structural exclusion; renamed-sender
 *      openId-only entries; model @name never converted).
 *
 * Excluded callers (failure/unbound/proactive/startup) stay plain text with
 * no mention, and the SDK error contracts (target_revoked / rate_limited
 * attempts / permission denied / format fallback / ambiguous unknown) are
 * exercised against the REAL pinned @larksuite/channel OutboundSender with a
 * stubbed rawClient — the connector itself must add zero retry/fallback.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createLarkChannel } from '@larksuite/channel'
import {
  buildReplyTarget,
  replyTargetFor,
  replyTargetToSdkSend,
  isValidTriggerSenderOpenId,
  FOUNDATION_LARK_CHANNEL_OPTIONS,
} from '../src/core.js'
import { buildFeishuHandle } from '../src/index.js'

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }
const UX = { rendering: 'markdown', autoMentionTriggerSender: true }

// ---------------------------------------------------------------------------
// harness: real pinned SDK channel with the rawClient transport stubbed
// ---------------------------------------------------------------------------

function mdText(call) {
  return JSON.parse(call.data.content).zh_cn.content[0][0].text
}

function stubbedChannel() {
  const calls = { create: [], reply: [] }
  const channel = createLarkChannel({
    appId: 'cli_ux_test',
    appSecret: 'test',
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger,
  })
  channel.rawClient.im = {
    v1: {
      message: {
        async create(opts) {
          calls.create.push(opts)
          return { code: 0, data: { message_id: `om_created_${calls.create.length}` } }
        },
        async reply(opts) {
          calls.reply.push(opts)
          return { code: 0, data: { message_id: `om_replied_${calls.reply.length}` } }
        },
      },
    },
  }
  return { channel, calls }
}

/** A group ingress event with the given sender openId. */
function groupIngress(openId = 'ou_trigger_sender') {
  return {
    channel: 'group',
    chatType: 'group',
    conversationId: 'oc_group_1',
    chatId: 'oc_group_1',
    messageId: 'om_src_group',
    sender: openId === null ? {} : { openId, name: 'Any Name' },
    text: 'hello',
  }
}

function topicIngress(openId = 'ou_trigger_sender') {
  return {
    channel: 'thread',
    chatType: 'group',
    conversationId: 'oc_group_1:topic:omt_t1',
    chatId: 'oc_group_1',
    threadId: 'omt_t1',
    rootMsgId: 'om_root',
    messageId: 'om_src_topic',
    sender: openId === null ? {} : { openId },
    text: 'hello',
  }
}

function p2pIngress(openId = 'ou_trigger_sender') {
  return {
    channel: 'p2p',
    chatType: 'p2p',
    conversationId: 'oc_p2p_1',
    chatId: 'oc_p2p_1',
    messageId: 'om_src_p2p',
    sender: openId === null ? {} : { openId },
    text: 'hello',
  }
}

// ---------------------------------------------------------------------------
// B. ReplyTarget mention context (identity authority = sender.openId only)
// ---------------------------------------------------------------------------

test('UX-B1: group ingress with valid openId carries mention context on every target form', () => {
  const ev = groupIngress('ou_trigger_sender')
  for (const target of [
    replyTargetFor(ev).replyTo(ev.messageId),
    replyTargetFor(ev).asThread(),
    replyTargetFor(ev).directChat(),
  ]) {
    assert.equal(target.triggerSenderOpenId, 'ou_trigger_sender')
  }
})

test('UX-B2: topic ingress with valid openId carries mention context', () => {
  assert.equal(replyTargetFor(topicIngress('on_union_sender')).replyTo('om_x').triggerSenderOpenId, 'on_union_sender')
})

test('UX-B3: missing openId carries NO mention context (no name fallback, no fabrication)', () => {
  const ev = groupIngress(null)
  ev.sender = { name: '张三' }
  const target = replyTargetFor(ev).replyTo(ev.messageId)
  assert.equal(target.triggerSenderOpenId, undefined, 'sender.name must never become identity')
})

test('UX-B4: invalid openId formats carry NO mention context', () => {
  for (const bad of ['ou_', 'on_', 'user_x', 'ou_中文!', 'oc_chat_id', '']) {
    assert.equal(replyTargetFor(groupIngress(bad)).replyTo('om_x').triggerSenderOpenId, undefined, `invalid: ${bad}`)
    assert.equal(isValidTriggerSenderOpenId(bad), false)
  }
})

test('UX-B5: renamed sender resolves by openId; the mention entry carries NO name (openId only)', () => {
  // A renamed account: the name is stale/attacker-influenced, the openId is stable.
  const ev = groupIngress('ou_renamed_user')
  ev.sender.name = 'Old Name'
  const plan = replyTargetToSdkSend(replyTargetFor(ev).replyTo(ev.messageId), 'answer', UX)
  assert.deepEqual(plan.opts.mentions, [{ openId: 'ou_renamed_user' }], 'openId-carrying entry, no name field')
})

test('UX-B6: model @name text is never converted (resolveMentionsInText stays off, body untouched)', () => {
  const ev = groupIngress('ou_real_sender')
  const body = 'hey @张三 please review'
  const plan = replyTargetToSdkSend(replyTargetFor(ev).replyTo(ev.messageId), body, UX)
  assert.equal(plan.input.markdown, body, 'body not rewritten')
  assert.equal(plan.opts.resolveMentionsInText, undefined, 'name resolution must stay disabled')
  assert.deepEqual(plan.opts.mentions, [{ openId: 'ou_real_sender' }], 'only the ingress sender')
})

test('UX-B7: scheduler literal target (explicit parts, no ingress sender) has no mention context', () => {
  const target = buildReplyTarget({ conversationId: 'oc_g', chatId: 'oc_g', channel: 'group' }).directChat()
  assert.equal(target.triggerSenderOpenId, undefined)
  const plan = replyTargetToSdkSend(target, 'proactive notice', UX) // even with intent forced
  assert.equal(plan.opts.mentions, undefined, 'no openId => no mention, no fabrication')
})

test('UX-B8: p2p target with deliberately true intent never mentions (structural exclusion)', () => {
  const plan = replyTargetToSdkSend(replyTargetFor(p2pIngress()).replyTo('om_x'), 'answer', UX)
  assert.equal(plan.opts.mentions, undefined)
})

// ---------------------------------------------------------------------------
// C. Markdown send plan + real-SDK payload semantics
// ---------------------------------------------------------------------------

test('UX-C1: ux.rendering=markdown maps to the SDK markdown input; no ux keeps the V0 text plan', () => {
  const target = replyTargetFor(groupIngress()).replyTo('om_src_group')
  const md = replyTargetToSdkSend(target, '**bold** answer', UX)
  assert.deepEqual(md.input, { markdown: '**bold** answer' })
  assert.equal(md.method, 'reply')
  assert.equal(md.opts.replyTo, 'om_src_group')
  // Unopted caller: byte-identical V0 plan (text, no mentions).
  const text = replyTargetToSdkSend(target, '**bold** answer')
  assert.deepEqual(text.input, { text: '**bold** answer' })
  assert.deepEqual(text.opts, { replyTo: 'om_src_group', replyInThread: false })
})

test('UX-C2: heading normalization payload — six labels preserved, ordered, native heading treatment (amendment contract)', async () => {
  const { channel, calls } = stubbedChannel()
  const md = '# H1 标题一\n\n## H2 label\n\n### H3 label\n\n#### H4 label\n\n##### H5 label\n\n###### H6 label\n'
  await channel.send('oc_group_1', { markdown: md })
  assert.equal(calls.create.length, 1)
  assert.equal(calls.create[0].data.msg_type, 'post')
  const text = mdText(calls.create[0])
  // Text + order preservation (all six labels, in order).
  let at = -1
  for (const label of ['H1 标题一', 'H2 label', 'H3 label', 'H4 label', 'H5 label', 'H6 label']) {
    const i = text.indexOf(label)
    assert.ok(i > at, `label ${label} missing or out of order in: ${text}`)
    at = i
  }
  // Native heading treatment (SDK normalization # → ####, ##–###### → ##### is compliant;
  // ALL headings plain body text is forbidden).
  for (const line of text.split('\n')) {
    if (/H[1-6] /.test(line)) assert.match(line, /^#{1,6} /, `heading line lost its marker: ${line}`)
  }
  assert.match(text, /^#### H1/, 'H1 normalized to ####')
  assert.match(text, /##### H2/, 'H2 normalized to ##### (distinct rendering NOT required)')
})

test('UX-C3: bold / italic / quote / inline code survive into the md payload', async () => {
  const { channel, calls } = stubbedChannel()
  const md = '**bold** and *italic* and `inline_code`\n\n> quoted 中文 line\n'
  await channel.send('oc_group_1', { markdown: md })
  const text = mdText(calls.create[0])
  for (const needle of ['**bold**', '*italic*', '`inline_code`', 'quoted 中文 line']) {
    assert.ok(text.includes(needle), `missing ${needle} in ${text}`)
  }
})

test('UX-C4: nested ordered/unordered lists (depth 1) preserved with hierarchy and order', async () => {
  const { channel, calls } = stubbedChannel()
  const md = '- alpha 一\n  - alpha.child 甲\n- beta 二\n\n1. first\n   1. first.child 子\n2. second\n'
  await channel.send('oc_group_1', { markdown: md })
  const text = mdText(calls.create[0])
  const idx = ['alpha 一', 'alpha.child 甲', 'beta 二', 'first', 'first.child 子', 'second']
    .map((s) => text.indexOf(s))
  assert.ok(idx.every((i) => i >= 0), `missing list items in ${text}`)
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'list order preserved')
  // The child lines stay indented relative to their parents (hierarchy not flattened).
  for (const line of text.split('\n')) {
    if (line.includes('alpha.child') || line.includes('first.child')) {
      assert.match(line, /^\s+[-*]\s|\s+\d+\.\s/, `nested child lost indentation: ${JSON.stringify(line)}`)
    }
  }
})

test('UX-C5: python language tag and fenced code bytes preserved', async () => {
  const { channel, calls } = stubbedChannel()
  const code = '```python\nprint("hello")\n```'
  await channel.send('oc_group_1', { markdown: `before\n\n${code}\n\nafter` })
  const text = mdText(calls.create[0])
  assert.ok(text.includes('```python'), 'language tag preserved')
  assert.ok(text.includes('print("hello")'), 'code content preserved')
})

test('UX-C6: link URL byte stability — query, fragment, percent encoding, display text', async () => {
  const { channel, calls } = stubbedChannel()
  const url = 'https://example.com/docs?a=1&b=two%20words#section-%E4%B8%AD'
  await channel.send('oc_group_1', { markdown: `see [文档 link](${url}) now` })
  const text = mdText(calls.create[0])
  assert.ok(text.includes(url), `exact URL bytes must survive: ${text}`)
  assert.ok(text.includes('文档 link'), 'display text preserved')
})

test('UX-C7: simple GFM table bytes preserved (md payload); CJK/English mixed content intact', async () => {
  const { channel, calls } = stubbedChannel()
  const table = '| 名称 name | 值 value |\n|---|---|\n| alpha 甲 | 1 |\n| beta 乙 | 2 |'
  await channel.send('oc_group_1', { markdown: `表格 table：\n\n${table}\n\ndone 完成` })
  const text = mdText(calls.create[0])
  for (const needle of ['| 名称 name | 值 value |', '|---|---|', '| alpha 甲 | 1 |', '| beta 乙 | 2 |', 'done 完成']) {
    assert.ok(text.includes(needle), `table/mix byte lost: ${needle}`)
  }
})

test('UX-C8: in-limit content is ONE message (no chunking)', async () => {
  const { channel, calls } = stubbedChannel()
  await channel.send('oc_group_1', { markdown: 'x'.repeat(3000) }, { mentions: [{ openId: 'ou_s' }] })
  assert.equal(calls.create.length, 1)
})

test('UX-C9: >3500 comprehensive long content — table + python fence + byte-stable link + first-chunk mention + CJK', async () => {
  const { channel, calls } = stubbedChannel()
  const url = 'https://example.com/p?x=1&y=%20z#frag-中文'
  const parts = [
    '# 长文综合 Long comprehensive',
    '',
    'para 中文与 English mixed. '.repeat(40).trim(),
    '',
    '| h1 表头 | h2 |\n|---|---|\n| v1 一 | v2 二 |\n| v3 三 | v4 四 |',
    '',
    '```python',
    ...Array.from({ length: 320 }, (_, i) => `code_line_${i} = ${i}`),
    '```',
    '',
    `[文档链接 docs](${url})`,
    '',
    ...Array.from({ length: 80 }, (_, i) => `tail 尾段 ${i} line`),
  ]
  const md = parts.join('\n')
  assert.ok(md.length > 3500, `comprehensive doc must exceed 3500 (got ${md.length})`)

  const result = await channel.send('oc_group_1', { markdown: md }, { mentions: [{ openId: 'ou_sender' }] })
  assert.ok(calls.create.length > 1, 'must chunk')

  const texts = calls.create.map(mdText)
  // every post stays bounded around the 3500 chunk limit (optimizer may add minor spacing)
  assert.ok(texts.every((t) => t.length <= 3550), `chunk sizes: ${texts.map((t) => t.length)}`)

  // first chunk only carries the mention, and the mention sits OUTSIDE the code fence
  const mentionTag = '<at user_id="ou_sender">'
  assert.ok(texts[0].startsWith(mentionTag), 'mention prefix opens the first chunk (outside all fences)')
  assert.ok(!texts.slice(1).some((t) => t.includes(mentionTag)), 'mention must be first-chunk only')
  const fenceStart = texts[0].indexOf('```')
  assert.ok(fenceStart > texts[0].indexOf(mentionTag), 'mention outside the code fence')

  // complete + ordered: all code lines, in order, across chunks
  const joined = texts.join('\n')
  let at = -1
  for (let i = 0; i < 320; i += 40) {
    const idx = joined.indexOf(`code_line_${i} = ${i}`)
    assert.ok(idx > at, `code_line_${i} missing or out of order`)
    at = idx
  }
  // fence reopened with its language tag after the split
  assert.ok(texts.slice(1).some((t) => /^\s*```python/.test(t)), 'continuation chunk reopens the fence with the python tag')
  // link byte stability across chunks
  assert.ok(joined.includes(url), 'byte-stable link preserved across chunks')
  // table content complete across chunks
  assert.ok(joined.includes('| v1 一 | v2 二 |') && joined.includes('| v3 三 | v4 四 |'), 'table rows complete')
  // ordered chunk ids
  assert.equal(result.chunkIds.length, calls.create.length)
})

test('UX-C10: fence crossing the 3500 boundary closes and reopens with the same language tag, nothing lost', async () => {
  const { channel, calls } = stubbedChannel()
  const fence = '```python\n' + 'code_line = 1\n'.repeat(300) + '```'
  const md = 'intro paragraph\n\n' + fence + '\n\noutro paragraph'
  await channel.send('oc_group_1', { markdown: md })
  const texts = calls.create.map(mdText)
  assert.ok(texts.length >= 2)
  assert.match(texts[0].trimEnd(), /```$/, 'chunk 0 closes the fence')
  assert.match(texts[1].trimStart(), /^```python/, 'chunk 1 reopens with the language tag')
  assert.equal(texts.join('\n').split('code_line = 1').length - 1, 300, 'all code lines survive the split')
  assert.ok(texts[texts.length - 1].includes('outro paragraph'))
})

// ---------------------------------------------------------------------------
// D. Excluded callers stay plain text / no mention
// ---------------------------------------------------------------------------

test('UX-D1: handle.reply WITHOUT ux opts sends the V0 plain-text plan (failure/unbound/proactive parity)', async () => {
  const { channel, calls } = stubbedChannel()
  const handle = buildFeishuHandle({ channel, cfg: { onEvent: null, ingressGate: null, onStatus: null }, log: () => {}, connect: async () => {} })
  const target = replyTargetFor(groupIngress('ou_sender')).replyTo('om_src_group')
  await handle.reply(target, '[agent-core] delivery failed: boom')
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].data.msg_type, 'text', 'excluded callers never send markdown')
  assert.equal(JSON.parse(calls.reply[0].data.content).text.includes('<at'), false, 'no mention in excluded callers')
})

test('UX-D2: handle.reply WITH ux opts drives the real SDK markdown + mentions pipeline', async () => {
  const { channel, calls } = stubbedChannel()
  const handle = buildFeishuHandle({ channel, cfg: { onEvent: null, ingressGate: null, onStatus: null }, log: () => {}, connect: async () => {} })
  const target = replyTargetFor(groupIngress('ou_sender')).replyTo('om_src_group')
  const result = await handle.reply(target, '# Answer 回答\n\n**done**', { ux: UX })
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].data.msg_type, 'post')
  const text = mdText(calls.reply[0])
  assert.ok(text.startsWith('<at user_id="ou_sender">'), 'native mention composed by the SDK')
  assert.ok(text.includes('Answer 回答'), 'heading label text preserved behind the mention prefix')
  assert.ok(text.includes('**done**'))
  assert.ok(result.messageId)
})

test('UX-D3: unbound receipt path (createReceiptReply) stays plain text with no mention', async () => {
  const { createReceiptReply } = await import('../src/bridge.js')
  const { INGRESS_GATE_REJECTED_REPLY } = await import('../src/core.js')
  const { channel, calls } = stubbedChannel()
  const receipt = createReceiptReply(channel, () => {})
  await receipt(groupIngress('ou_sender'))
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].data.msg_type, 'text')
  assert.deepEqual(JSON.parse(calls.reply[0].data.content), { text: INGRESS_GATE_REJECTED_REPLY })
})

// ---------------------------------------------------------------------------
// E. SDK error contracts (real OutboundSender; connector adds zero retry)
// ---------------------------------------------------------------------------

test('UX-E1: TARGET_REVOKED — exactly one logical fallback: reply fails 230020 → same-chat top-level create, payload + mention preserved', async () => {
  const { channel, calls } = stubbedChannel()
  channel.rawClient.im.v1.message.reply = async (opts) => {
    calls.reply.push(opts)
    throw Object.assign(new Error('reply target revoked'), { response: { status: 400, data: { code: 230020 } } })
  }
  const target = replyTargetFor(groupIngress('ou_sender')).replyTo('om_src_group')
  const plan = replyTargetToSdkSend(target, '# Answer', UX)
  const result = await channel.send(plan.to, plan.input, plan.opts)
  assert.equal(calls.reply.length, 1, 'original anchored attempt (target_revoked is not transport-retried)')
  assert.equal(calls.create.length, 1, 'exactly ONE same-chat top-level fallback — no second fallback')
  assert.equal(calls.create[0].data.receive_id, 'oc_group_1', 'same chat, never cross-chat')
  assert.equal(calls.create[0].data.msg_type, 'post', 'rendering preserved on the fallback attempt')
  assert.ok(mdText(calls.create[0]).startsWith('<at user_id="ou_sender">'), 'mentions preserved on the fallback attempt')
  assert.ok(result.messageId)
})

test('UX-E2: RATE_LIMITED exhausted — exactly 3 SDK transport attempts, fail-loud, connector retry = 0', async () => {
  const { channel, calls } = stubbedChannel()
  let attempts = 0
  channel.rawClient.im.v1.message.create = async (opts) => {
    attempts += 1
    calls.create.push(opts)
    throw Object.assign(new Error('too many requests'), { response: { status: 429, data: { code: 429 } } })
  }
  const sendSpy = channel.send.bind(channel)
  let connectorLevelSends = 0
  channel.send = async (...args) => { connectorLevelSends += 1; return sendSpy(...args) }
  const target = replyTargetFor(groupIngress()).directChat()
  const plan = replyTargetToSdkSend(target, 'answer', UX)
  await assert.rejects(() => channel.send(plan.to, plan.input, plan.opts), (err) => err.code === 'rate_limited')
  assert.equal(attempts, 3, 'SDK bounded transport attempts = maxAttempts 3')
  assert.equal(connectorLevelSends, 1, 'connector adds no retry of its own')
  assert.equal(calls.create.length, 3)
})

test('UX-E3: PERMISSION_DENIED — fail loud, replyTo never removed, no top-level, no format fallback', async () => {
  const { channel, calls } = stubbedChannel()
  channel.rawClient.im.v1.message.reply = async (opts) => {
    calls.reply.push(opts)
    throw Object.assign(new Error('no permission'), { response: { status: 403, data: { code: 99991400 } } })
  }
  const target = replyTargetFor(groupIngress()).replyTo('om_src_group')
  const plan = replyTargetToSdkSend(target, '# Answer', UX)
  await assert.rejects(
    () => channel.send(plan.to, plan.input, plan.opts),
    (err) => err.code === 'permission_denied',
  )
  assert.equal(calls.reply.length, 1, 'the anchored attempt ran')
  assert.equal(calls.create.length, 0, 'never degrades to top-level')
  const types = calls.reply.map((c) => c.data.msg_type)
  assert.deepEqual(types, ['post'], 'no format fallback on permission errors')
})

test('UX-E4: FORMAT_ERROR — exactly one logical Markdown→plain-text fallback with the same answer', async () => {
  const { channel, calls } = stubbedChannel()
  const seen = []
  channel.rawClient.im.v1.message.create = async (opts) => {
    seen.push(opts)
    if (opts.data.msg_type === 'post') {
      throw Object.assign(new Error('content invalid'), { response: { status: 400, data: { code: 230002 } } })
    }
    calls.create.push(opts)
    return { code: 0, data: { message_id: 'om_text_fallback' } }
  }
  const target = replyTargetFor(groupIngress()).directChat()
  const plan = replyTargetToSdkSend(target, '# Answer 回答 body', UX)
  const result = await channel.send(plan.to, plan.input, plan.opts)
  assert.equal(result.messageId, 'om_text_fallback')
  const postAttempts = seen.filter((c) => c.data.msg_type === 'post').length
  assert.equal(postAttempts, 1, 'exactly one post attempt (format errors are not retried)')
  assert.equal(calls.create.length, 1, 'exactly ONE text fallback, no second logical fallback')
  assert.equal(calls.create[0].data.msg_type, 'text', 'fallback is plain text')
  const text = JSON.parse(calls.create[0].data.content).text
  assert.ok(text.includes('Answer 回答 body'), 'same Agent answer preserved')
})

test('UX-E5: ambiguous unknown rejects OUTCOME-UNKNOWN-style (no exactly-once claim), connector replay = 0', async () => {
  const { channel } = stubbedChannel()
  let attempts = 0
  channel.rawClient.im.v1.message.create = async () => {
    attempts += 1
    throw new Error('socket hang up') // classified unknown → retryable → bounded
  }
  const target = replyTargetFor(groupIngress()).directChat()
  const plan = replyTargetToSdkSend(target, 'answer', UX)
  await assert.rejects(() => channel.send(plan.to, plan.input, plan.opts), (err) => err.code === 'unknown')
  assert.equal(attempts, 3, 'ambiguous unknown also bounded by SDK maxAttempts')
})
