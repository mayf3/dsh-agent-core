/**
 * Static reply-card tests (OWNER_RULING = ENABLE_STATIC_FEISHU_REPLY_CARD,
 * STATIC_FINAL_CARD_V1): the final-success-reply card rendering mode over
 * the REAL pinned @larksuite/channel sender (genuine unconnected LarkChannel
 * with a stubbed rawClient transport — no network, no test app, no
 * production sends; real-client display verification belongs to the deploy
 * round).
 *
 * Coverage mirrors the frozen task list:
 *   1  default markdown byte-identical          10 long-content pre-send fallback
 *   2  card mode → interactive CardKit 2.0      11 card API fail → no second answer
 *   3  P2P replyTo preserved                    12 failure receipt stays text
 *   4  group replyTo preserved                  13 unbound receipt stays text
 *   5  topic replyInThread preserved            14 proactive/scheduler stays text
 *   6  no-auto-mention preserved                15 typing reaction settles around card
 *   7  markdown body never rewritten            16 invalid render mode fail-loud
 *   8  heading/list/code/link carried verbatim  17 card + autoMention fail-loud
 *   9  table carried verbatim (GFM in 2.0)      18 SDK pin unchanged (+ Router zero-diff asserted at run phase)
 *   +  empty reply is never cardified
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createLarkChannel } from '@larksuite/channel'
import {
  buildReplyTarget,
  replyTargetToSdkSend,
  FOUNDATION_LARK_CHANNEL_OPTIONS,
} from '../../src/core.js'
import { buildFeishuHandle, apply } from '../../src/index.js'
import { createReceiptReply } from '../../src/bridge.js'
import { createProcessingReactionLifecycle } from '../../src/processing-reaction.js'
import {
  composeReplyCard,
  replyCardSendPlan,
  REPLY_CARD_MAX_JSON_BYTES,
  CARD_NOT_ATTEMPTED_CONTENT_OUT_OF_ENVELOPE,
  CARD_NOT_ATTEMPTED_EMPTY_REPLY,
} from '../../src/reply-card.js'

const HERE = dirname(fileURLToPath(import.meta.url))

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

/** The Router success call's exact ux intent (frozen, byte-identical). */
const ROUTER_UX = { ux: { rendering: 'markdown', autoMentionTriggerSender: true } }

const RICH_BODY = [
  '# 总结',
  '',
  '## 要点',
  '',
  '- 第一项 **加粗** 与 *斜体*',
  '- 第二项 `inline_code` 与 [链接](https://example.com/docs?a=1&b=2)',
  '',
  '1. 步骤一',
  '2. 步骤二',
  '',
  '> 引用一段 mixed 中英文 text with trailing words',
  '',
  '```python',
  'def hello():',
  '    print("你好, world")',
  '```',
  '',
  '| 列A | 列B |',
  '| --- | --- |',
  '| 值1 | 值2 |',
  '| 值3 | value-4 |',
  '',
  '结尾段落 long trailing paragraph with 中英混排 mixed content.',
].join('\n')

/** A real LarkChannel with the rawClient transport stubbed (no network). */
function stubbedChannel({ offlineConnect = false } = {}) {
  const calls = { create: [], reply: [], reactionCreate: [], reactionDelete: [] }
  const channel = createLarkChannel({
    appId: 'cli_test_reply_card',
    appSecret: 'test',
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger,
  })
  if (offlineConnect) channel.connect = async () => {}
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
    // the processing-reaction lifecycle reads rawClient.im.messageReaction
    // (the path src/processing-reaction.js consumes)
    messageReaction: {
      async create(opts) {
        calls.reactionCreate.push(opts)
        return { code: 0, data: { reaction_id: `rx_${calls.reactionCreate.length}` } }
      },
      async delete(opts) {
        calls.reactionDelete.push(opts)
        return { code: 0, data: {} }
      },
    },
  }
  return { channel, calls }
}

/**
 * A mounted handle over a stubbed channel with a recording channel.send
 * wrapper (captures the exact SDK input/opts the connector composed).
 * `renderMode`: undefined = cfg key absent (pure default); 'markdown'/'card'
 * = explicit. `autoMention` defaults true = the frozen pre-card default.
 */
function mountedHandle({ renderMode, autoMention = true, channel } = {}) {
  const real = channel ?? stubbedChannel().channel
  const sends = []
  const logs = []
  const realSend = real.send.bind(real)
  real.send = async (to, input, opts) => {
    sends.push({ to, input, opts })
    return realSend(to, input, opts)
  }
  const handle = buildFeishuHandle({
    channel: real,
    cfg: {
      onEvent: null,
      ingressGate: null,
      onStatus: null,
      autoMentionTriggerSender: autoMention,
      ...(renderMode !== undefined ? { replyRenderMode: renderMode } : {}),
    },
    log: (level, ...args) => logs.push({ level, text: args.map(String).join(' ') }),
    connect: async () => {},
  })
  return { handle, sends, logs, channel: real }
}

const p2pTarget = () => buildReplyTarget({ conversationId: 'oc_p2p_1', chatId: 'oc_p2p_1', channel: 'p2p' }).replyTo('om_in_p2p')
const groupTarget = () => buildReplyTarget({ conversationId: 'oc_g', chatId: 'oc_g', channel: 'group', triggerSenderOpenId: 'ou_sender_valid1' }).replyTo('om_in_group')
const threadBuilder = () => buildReplyTarget({ conversationId: 'oc_g:topic:omt_t', chatId: 'oc_g', channel: 'thread', threadId: 'omt_t', rootMsgId: 'om_root', triggerSenderOpenId: 'ou_sender_valid1' })
const threadTarget = () => threadBuilder().replyTo('om_in_thread')

// ---------------------------------------------------------------------------
// 1 — default render mode is BYTE-IDENTICAL to the pre-card behavior
// ---------------------------------------------------------------------------

test('1. default render mode: the Router success reply plan is byte-identical to the pre-card mapping (mentions still composed)', async () => {
  const base = stubbedChannel()
  const { handle, sends } = mountedHandle({ channel: base.channel }) // no replyRenderMode key at all
  await handle.reply(groupTarget(), RICH_BODY, ROUTER_UX)
  assert.equal(sends.length, 1)
  const expected = replyTargetToSdkSend(groupTarget(), RICH_BODY, ROUTER_UX.ux)
  assert.deepEqual(sends[0].input, expected.input, 'input stays { markdown }')
  assert.deepEqual(sends[0].opts, expected.opts, 'opts (mentions included when enabled) unchanged')
  assert.equal(sends[0].to, expected.to)
  assert.equal(base.calls.reply[0].data.msg_type, 'post', 'SDK markdown→post pipeline untouched')
})

test('1b. explicit replyRenderMode=markdown composes the identical plan as the unset default', async () => {
  const a = mountedHandle({ channel: stubbedChannel().channel })
  const b = mountedHandle({ renderMode: 'markdown', channel: stubbedChannel().channel })
  await a.handle.reply(groupTarget(), RICH_BODY, ROUTER_UX)
  await b.handle.reply(groupTarget(), RICH_BODY, ROUTER_UX)
  assert.deepEqual(a.sends[0], b.sends[0])
})

// ---------------------------------------------------------------------------
// 2 — card mode renders the success reply as ONE interactive CardKit 2.0 card
// ---------------------------------------------------------------------------

test('2. card mode: the Router success reply is ONE interactive CardKit 2.0 static card', async () => {
  const base = stubbedChannel()
  const { handle, sends } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  await handle.reply(groupTarget(), RICH_BODY, ROUTER_UX)
  assert.equal(sends.length, 1, 'exactly one channel.send')
  assert.ok('card' in sends[0].input, 'input is { card }')
  assert.equal(base.calls.reply.length, 1)
  assert.equal(base.calls.create.length, 0)
  assert.equal(base.calls.reply[0].data.msg_type, 'interactive')
  const card = JSON.parse(base.calls.reply[0].data.content)
  assert.equal(card.schema, '2.0')
  assert.equal(card.header.title.tag, 'plain_text')
  assert.equal(card.header.title.content, 'Agent 回复')
  assert.equal(card.body.elements.length, 1)
  assert.equal(card.body.elements[0].tag, 'markdown')
  // No buttons / interactive actions anywhere in the card JSON.
  assert.equal(JSON.stringify(card).includes('button'), false)
  assert.equal(JSON.stringify(card).includes('"actions"'), false)
})

// ---------------------------------------------------------------------------
// 3/4/5 — reply anchoring preserved for p2p / group / topic
// ---------------------------------------------------------------------------

test('3. card P2P: still replies to the ORIGINAL message, no thread escape', async () => {
  const base = stubbedChannel()
  const { handle } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  await handle.reply(p2pTarget(), 'P2P 答案', ROUTER_UX)
  assert.equal(base.calls.reply.length, 1)
  assert.equal(base.calls.reply[0].path.message_id, 'om_in_p2p')
  assert.equal(base.calls.reply[0].data.reply_in_thread, false)
  assert.equal(base.calls.reply[0].data.msg_type, 'interactive')
  assert.equal(base.calls.create.length, 0, 'anchored reply never degrades to a top-level create')
})

test('4. card group: replyTo preserved on the inbound message', async () => {
  const base = stubbedChannel()
  const { handle } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  await handle.reply(groupTarget(), '群聊答案', ROUTER_UX)
  assert.equal(base.calls.reply.length, 1)
  assert.equal(base.calls.reply[0].path.message_id, 'om_in_group')
  assert.equal(base.calls.reply[0].data.msg_type, 'interactive')
})

test('5. card topic: replyInThread=true keeps the answer INSIDE the topic', async () => {
  const base = stubbedChannel()
  const { handle } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  await handle.reply(threadTarget(), '话题答案', ROUTER_UX)
  assert.equal(base.calls.reply.length, 1)
  assert.equal(base.calls.reply[0].path.message_id, 'om_in_thread')
  assert.equal(base.calls.reply[0].data.reply_in_thread, true, 'topic reply stays in-thread')
  assert.equal(base.calls.create.length, 0, 'no escape to the group main conversation')
  const plan = replyCardSendPlan(threadBuilder().asThread(), 'x')
  assert.equal(plan.plan.opts.replyTo, 'om_root', 'thread-anchored plan stays at the root')
  assert.equal(plan.plan.opts.replyInThread, true)
})

// ---------------------------------------------------------------------------
// 6 — no auto-mention in card mode
// ---------------------------------------------------------------------------

test('6. no-auto-mention: a card plan NEVER carries a mentions entry (CARD_AUTO_MENTION = NONE)', async () => {
  const base = stubbedChannel()
  const { handle, sends } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  await handle.reply(groupTarget(), '答案', ROUTER_UX)
  assert.equal('mentions' in sends[0].opts, false, 'no mentions key on the card send opts')
  assert.equal(JSON.stringify(sends[0].input).includes('<at'), false, 'no at-mention markup anywhere')
  // config-off markdown mode also composes none (the frozen no-mention production behavior)
  const md = mountedHandle({ autoMention: false, channel: stubbedChannel().channel })
  await md.handle.reply(groupTarget(), '答案', ROUTER_UX)
  assert.equal('mentions' in md.sends[0].opts, false)
})

// ---------------------------------------------------------------------------
// 7/8/9 — the markdown body is carried VERBATIM (headings/lists/code/links/tables)
// ---------------------------------------------------------------------------

test('7. card body: the model reply markdown is carried BYTE-UNMODIFIED in the markdown element', () => {
  const { card } = composeReplyCard(RICH_BODY)
  assert.equal(card.body.elements[0].content, RICH_BODY, 'content byte-equal')
  const round = JSON.parse(JSON.stringify(card))
  assert.equal(round.body.elements[0].content, RICH_BODY, 'JSON round-trip preserves the body')
})

test('8. card body: H1/H2 headings, ordered/unordered lists, bold/italic, quote, inline code, fenced python code and a clickable link all survive in ONE markdown element', () => {
  const { card, attempted, jsonBytes } = composeReplyCard(RICH_BODY)
  assert.equal(attempted, true)
  assert.ok(jsonBytes <= REPLY_CARD_MAX_JSON_BYTES)
  const content = card.body.elements[0].content
  for (const fragment of ['# 总结', '## 要点', '- 第一项', '1. 步骤一', '**加粗**', '*斜体*', '> 引用', '`inline_code`', '```python', '[链接](https://example.com/docs?a=1&b=2)']) {
    assert.ok(content.includes(fragment), `card markdown element must carry ${fragment} verbatim`)
  }
})

test('9. card table: a GFM pipe table stays VERBATIM in the 2.0 markdown element (native table rendering; no garbling, no parser introduced)', () => {
  const tableBody = '| 列A | 列B |\n| --- | --- |\n| 值1 | 值2 |\n| 值3 | value-4 |'
  const { card, attempted } = composeReplyCard(tableBody)
  assert.equal(attempted, true)
  assert.equal(card.body.elements[0].content, tableBody, 'table markdown is never rewritten or degraded')
  assert.equal(card.body.elements.length, 1)
  assert.equal(card.body.elements[0].tag, 'markdown')
})

// ---------------------------------------------------------------------------
// 10 — deterministic PRE-send envelope check (long content → existing markdown)
// ---------------------------------------------------------------------------

test('10. long content: oversize card JSON is NEVER attempted — deterministic pre-send fallback to the existing markdown pipeline', async () => {
  const base = stubbedChannel()
  const { handle, sends, logs } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  const oversize = '长'.repeat(11000) // 3 bytes/char ⇒ card JSON ≫ 30000 bytes
  await handle.reply(groupTarget(), oversize, ROUTER_UX)
  assert.equal(sends.length, 1)
  assert.ok('markdown' in sends[0].input, 'falls back to { markdown } BEFORE any card API call')
  assert.equal(base.calls.reply[0].data.msg_type, 'post', 'the existing SDK markdown pipeline delivers (chunked as needed)')
  assert.ok(base.calls.reply.length >= 1)
  assert.ok(logs.some((l) => l.text.includes(CARD_NOT_ATTEMPTED_CONTENT_OUT_OF_ENVELOPE)), 'CARD_NOT_ATTEMPTED reason recorded')
})

test('10b. envelope boundary: exactly-at-limit is attempted, one byte over is not (pure, deterministic)', () => {
  const wrapperOverhead = composeReplyCard('x').jsonBytes - Buffer.byteLength('x', 'utf8')
  const atLimit = 'x'.repeat(REPLY_CARD_MAX_JSON_BYTES - wrapperOverhead)
  assert.equal(composeReplyCard(atLimit).attempted, true)
  const decision = composeReplyCard(`${atLimit}x`)
  assert.equal(decision.attempted, false)
  assert.equal(decision.reason, CARD_NOT_ATTEMPTED_CONTENT_OUT_OF_ENVELOPE)
  assert.ok(decision.jsonBytes > REPLY_CARD_MAX_JSON_BYTES)
})

// ---------------------------------------------------------------------------
// 11 — card API failure is fail-loud: NO markdown re-send, no second answer
// ---------------------------------------------------------------------------

test('11. card API fail: exactly ONE API call, the error propagates, and NO second full answer is ever sent', async () => {
  const base = stubbedChannel()
  const realReply = base.channel.rawClient.im.v1.message.reply.bind(base.channel.rawClient.im.v1.message)
  base.channel.rawClient.im.v1.message.reply = async (opts) => {
    await realReply(opts) // record the call, then fail loud like the real API
    throw Object.assign(new Error('card send rejected'), { response: { status: 400, data: { code: 230026 } } })
  }
  const { handle, sends } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  await assert.rejects(() => handle.reply(groupTarget(), RICH_BODY, ROUTER_UX), /card send rejected/)
  assert.equal(sends.length, 1, 'the card send is the FIRST and ONLY channel.send — no markdown fallback after failure')
  assert.equal(base.calls.reply.length, 1)
  assert.equal(base.calls.create.length, 0)
})

// ---------------------------------------------------------------------------
// 12/13/14 — non-success paths are NEVER cardified
// ---------------------------------------------------------------------------

test('12. Router failure receipt: stays plain text in card mode', async () => {
  const base = stubbedChannel()
  const { handle } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  await handle.reply(groupTarget(), '[agent-core] delivery failed: turn error', {}) // no ux intent
  assert.equal(base.calls.reply[0].data.msg_type, 'text')
  assert.deepEqual(JSON.parse(base.calls.reply[0].data.content), { text: '[agent-core] delivery failed: turn error' })
})

test('13. unbound receipt: the bridge rejection receipt stays plain text in card mode', async () => {
  const base = stubbedChannel()
  const receipt = createReceiptReply(base.channel, () => {})
  await receipt({ conversationId: 'oc_g', chatId: 'oc_g', channel: 'group', messageId: 'om_in_group' })
  assert.equal(base.calls.reply[0].data.msg_type, 'text')
  assert.equal(JSON.parse(base.calls.reply[0].data.content).text.includes('未完成绑定'), true)
})

test('14. proactive/scheduler: explicit-parts targets without ux intent stay plain text in card mode', async () => {
  const base = stubbedChannel()
  const { handle } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  const schedulerTarget = buildReplyTarget({ conversationId: 'oc_sched', chatId: 'oc_sched', channel: 'group' }).directChat()
  await handle.reply(schedulerTarget, 'scheduled notification', {})
  assert.equal(base.calls.create[0].data.msg_type, 'text')
})

test('14b. empty reply: an empty final reply is NEVER cardified (keeps its current treatment)', async () => {
  const base = stubbedChannel()
  const { handle, sends, logs } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  await handle.reply(groupTarget(), '', ROUTER_UX)
  assert.ok('markdown' in sends[0].input, 'empty body goes down the existing markdown path')
  assert.equal(base.calls.reply[0].data.msg_type, 'post')
  assert.ok(logs.some((l) => l.text.includes(CARD_NOT_ATTEMPTED_EMPTY_REPLY)))
})

// ---------------------------------------------------------------------------
// 15 — typing reaction lifecycle settles around the card send
// ---------------------------------------------------------------------------

test('15. typing reaction: added once before the turn, removed once AFTER the card send settles (success and failure)', async () => {
  const base = stubbedChannel()
  const { handle } = mountedHandle({ renderMode: 'card', autoMention: false, channel: base.channel })
  const lifecycle = createProcessingReactionLifecycle({ channel: base.channel, log: () => {} })
  const order = []
  const realCreate = base.channel.rawClient.im.messageReaction.create.bind(base.channel.rawClient.im.messageReaction)
  const realDelete = base.channel.rawClient.im.messageReaction.delete.bind(base.channel.rawClient.im.messageReaction)
  base.channel.rawClient.im.messageReaction.create = async (opts) => { order.push('create'); return realCreate(opts) }
  base.channel.rawClient.im.messageReaction.delete = async (opts) => { order.push('delete'); return realDelete(opts) }

  const ingress = { conversationId: 'oc_g', chatId: 'oc_g', channel: 'group', messageId: 'om_in_group', timestamp: Date.now() }
  const wrapped = lifecycle.wrapOnEvent(async () => {
    order.push('turn')
    await handle.reply(groupTarget(), RICH_BODY, ROUTER_UX)
    order.push('card-settled')
  }, { processingReactionEnabled: true })
  await wrapped(ingress, {})
  assert.deepEqual(order, ['create', 'turn', 'card-settled', 'delete'], 'reaction removed only after the card send settled')
  assert.equal(base.calls.reactionCreate.length, 1)
  assert.equal(base.calls.reactionDelete.length, 1)

  // failure variant: the card send rejects ⇒ the existing finally still cleans the reaction
  const order2 = []
  base.channel.rawClient.im.messageReaction.create = async (opts) => { order2.push('create'); return realCreate(opts) }
  base.channel.rawClient.im.messageReaction.delete = async (opts) => { order2.push('delete'); return realDelete(opts) }
  base.channel.rawClient.im.v1.message.reply = async () => { throw new Error('card send failed hard') }
  const wrapped2 = lifecycle.wrapOnEvent(async () => {
    order2.push('turn')
    await handle.reply(groupTarget(), RICH_BODY, ROUTER_UX)
  }, { processingReactionEnabled: true })
  await assert.rejects(() => wrapped2({ ...ingress, messageId: 'om_in_group_2' }, {}))
  assert.deepEqual(order2, ['create', 'turn', 'delete'], 'reaction cleaned in the finally on card failure')
})

// ---------------------------------------------------------------------------
// 16/17 — startup fail-loud validation
// ---------------------------------------------------------------------------

function fakeCtx() {
  return { effect: () => () => {}, provide: () => {} }
}

test('16. invalid render mode fails startup LOUD (FEISHU_REPLY_RENDER_MODE_INVALID)', () => {
  for (const bad of ['interactive', 'STATIC', 'card ', '']) {
    assert.throws(
      () => apply(fakeCtx(), { enabled: true, appId: 'cli_x', appSecret: 's', replyRenderMode: bad }),
      (error) => error.code === 'FEISHU_REPLY_RENDER_MODE_INVALID',
      `must reject ${JSON.stringify(bad)}`,
    )
  }
})

test('17. card + autoMentionTriggerSender≠false fails startup LOUD (FEISHU_CARD_AUTO_MENTION_UNSUPPORTED)', () => {
  assert.throws(
    () => apply(fakeCtx(), { enabled: true, appId: 'cli_x', appSecret: 's', replyRenderMode: 'card' }),
    (error) => error.code === 'FEISHU_CARD_AUTO_MENTION_UNSUPPORTED',
  )
  assert.throws(
    () => apply(fakeCtx(), { enabled: true, appId: 'cli_x', appSecret: 's', replyRenderMode: 'card', autoMentionTriggerSender: true }),
    (error) => error.code === 'FEISHU_CARD_AUTO_MENTION_UNSUPPORTED',
  )
  // the valid production combination mounts (channel factory stubbed offline; no network)
  const handle = apply(fakeCtx(), {
    enabled: true,
    appId: 'cli_x',
    appSecret: 's',
    replyRenderMode: 'card',
    autoMentionTriggerSender: false,
    log: () => {},
  }, { createChannel: () => stubbedChannel({ offlineConnect: true }).channel })
  assert.equal(typeof handle.reply, 'function')
})

test('17b. default markdown + autoMention=true keeps mounting (the old behavior is preserved)', () => {
  const handle = apply(fakeCtx(), {
    enabled: true,
    appId: 'cli_x',
    appSecret: 's',
    autoMentionTriggerSender: true,
    log: () => {},
  }, { createChannel: () => stubbedChannel({ offlineConnect: true }).channel })
  assert.equal(typeof handle.reply, 'function')
})

// ---------------------------------------------------------------------------
// 18 — zero SDK / dependency change (Router zero-diff is asserted at the run
//      phase via git diff against BASE_MAIN)
// ---------------------------------------------------------------------------

test('18. the @larksuite/channel dependency pin is byte-identical to BASE_MAIN (SDK_CHANGE = NONE, DEPENDENCY_CHANGE = NONE)', () => {
  const pkg = JSON.parse(readFileSync(join(HERE, '..', '..', 'package.json'), 'utf8'))
  assert.equal(
    pkg.dependencies['@larksuite/channel'],
    'https://github.com/mayf3/channel-sdk-node.git#ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f',
  )
  assert.equal(pkg.name, '@agent-core/feishu-connector')
})
