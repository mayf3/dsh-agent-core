/**
 * Scheduler success announce card tests (SCHEDULER_SUCCESS_CARD_ELIGIBLE
 * Owner ruling; STATIC_FINAL_CARD_V1 reuse): in replyRenderMode=card the
 * scheduler's TERMINAL SUCCESS announce — and ONLY it — is rendered as the
 * SAME static CardKit 2.0 card the Router success reply gets. The eligibility
 * vehicle is the NEW narrow outbound presentation intent
 * `{ presentation: { cardEligible: true, source: 'scheduler' } }` carried as
 * the reply() third argument by packages/scheduler-router createFeishuDeliver
 * (asserted byte-exact in scheduler-router/test/bridge.test.js); it reuses
 * NOTHING of the Router ingress ux authority.
 *
 * Frozen rulings under test:
 *   SCHEDULER_SUCCESS_CARD_ELIGIBLE       = YES   (card mode + ok announce)
 *   SCHEDULER_ERROR_CARD_ELIGIBLE         = NO    (error stays text)
 *   OUTCOME_UNKNOWN_CARD_ELIGIBLE         = NO    (bridge sends no intent)
 *   GENERIC_PROACTIVE_CARD_ELIGIBLE       = NO    (no intent => text)
 *   DEFAULT_SCHEDULER_MARKDOWN_MODE       = CURRENT_PLAIN_TEXT_PRESERVED
 *   oversize                              = pre-send text fallback, card calls = 0
 *   card API failure                      = fail-loud, NO second answer
 *   mention / typing reaction             = NONE (SCHEDULER_ORIGINAL_INBOUND_MESSAGE = NONE)
 *
 * Real pinned @larksuite/channel sender with a stubbed rawClient transport —
 * no network, no test app, no production sends.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createLarkChannel } from '@larksuite/channel'
import { replyTargetToSdkSend, FOUNDATION_LARK_CHANNEL_OPTIONS } from '../../src/core.js'
import { buildFeishuHandle } from '../../src/index.js'
import { CARD_NOT_ATTEMPTED_REQUEST_BODY_OUT_OF_ENVELOPE, CARD_NOT_ATTEMPTED_EMPTY_REPLY } from '../../src/reply-card.js'

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

/** The EXACT intent object createFeishuDeliver passes for result.status==='ok'. */
const SCHEDULER_OK_PRESENTATION = { presentation: { cardEligible: true, source: 'scheduler' } }

/** A scheduler announce body with heading, list, table and a link (card carried verbatim). */
const SCHEDULER_BODY = [
  '# 定时任务结果',
  '',
  '- 结论 **成功**，共 3 项',
  '- 详情见 [报表](https://example.com/report?a=1)',
  '',
  '| 项目 | 数值 |',
  '| --- | --- |',
  '| 任务 | 晨报 |',
  '| 耗时 | 42s |',
  '',
  '结尾说明段落 with mixed 中英文 trailing text.',
].join('\n')

/** The literal direct kind=create ReplyTarget createFeishuDeliver builds. */
function schedulerTarget(chatId = 'oc_sched_chat') {
  return {
    kind: 'create',
    conversationId: `group:${chatId}`,
    chatId,
    channel: 'group',
    receiveIdType: 'chat_id',
    receiveId: chatId,
    threadId: undefined,
    rootMsgId: undefined,
    replyInThread: false,
  }
}

/** A real LarkChannel with the rawClient transport stubbed (no network). */
function stubbedChannel() {
  const calls = { create: [], reply: [] }
  const channel = createLarkChannel({
    appId: 'cli_test_scheduler_card',
    appSecret: 'test',
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger,
  })
  channel.connect = async () => {}
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

/** A mounted handle over a stubbed channel with a recording channel.send wrapper. */
function mountedHandle({ renderMode, channel } = {}) {
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
      autoMentionTriggerSender: false,
      ...(renderMode !== undefined ? { replyRenderMode: renderMode } : {}),
    },
    log: (level, ...args) => logs.push({ level, text: args.map(String).join(' ') }),
    connect: async () => {},
  })
  return { handle, sends, logs, channel: real }
}

// ---------------------------------------------------------------------------
// 1 — card mode + scheduler success => ONE interactive STATIC_FINAL_CARD_V1
// ---------------------------------------------------------------------------

test('SC-1. card mode + scheduler success announce => ONE interactive CardKit 2.0 static card via the direct create target', async () => {
  const base = stubbedChannel()
  const { handle, sends } = mountedHandle({ renderMode: 'card', channel: base.channel })
  await handle.reply(schedulerTarget(), SCHEDULER_BODY, SCHEDULER_OK_PRESENTATION)
  assert.equal(sends.length, 1, 'exactly ONE channel.send (single delivery)')
  assert.ok('card' in sends[0].input, 'input is { card }')
  // kind=create stays a top-level im.message.create into the SAME chatId.
  assert.equal(base.calls.create.length, 1)
  assert.equal(base.calls.reply.length, 0, 'the direct create target never degrades to a reply call')
  const create = base.calls.create[0]
  assert.equal(create.params.receive_id_type, 'chat_id')
  assert.equal(create.data.receive_id, 'oc_sched_chat')
  assert.equal(create.data.msg_type, 'interactive')
})

test('SC-2. card shape: title, markdown body, table and links are the SAME STATIC_FINAL_CARD_V1 (byte-verbatim body)', async () => {
  const base = stubbedChannel()
  const { handle } = mountedHandle({ renderMode: 'card', channel: base.channel })
  await handle.reply(schedulerTarget(), SCHEDULER_BODY, SCHEDULER_OK_PRESENTATION)
  const card = JSON.parse(base.calls.create[0].data.content)
  assert.equal(card.schema, '2.0')
  assert.equal(card.header.title.tag, 'plain_text')
  assert.equal(card.header.title.content, 'Agent 回复')
  assert.equal(card.body.elements.length, 1)
  assert.equal(card.body.elements[0].tag, 'markdown')
  assert.equal(card.body.elements[0].content, SCHEDULER_BODY, 'announce body byte-verbatim')
  for (const fragment of ['# 定时任务结果', '| 项目 | 数值 |', '| 任务 | 晨报 |', '[报表](https://example.com/report?a=1)']) {
    assert.ok(card.body.elements[0].content.includes(fragment), `card must carry ${fragment}`)
  }
  assert.equal(JSON.stringify(card).includes('button'), false, 'no buttons')
})

// ---------------------------------------------------------------------------
// 2 — markdown mode: the scheduler announce plan is BYTE-IDENTICAL (parity)
// ---------------------------------------------------------------------------

test('SC-3. markdown mode + scheduler success => the current plain-text plan, byte-identical to a caller WITHOUT the intent', async () => {
  const a = mountedHandle({ renderMode: 'markdown', channel: stubbedChannel().channel })
  const b = mountedHandle({ renderMode: 'markdown', channel: stubbedChannel().channel })
  await a.handle.reply(schedulerTarget(), SCHEDULER_BODY, SCHEDULER_OK_PRESENTATION)
  await b.handle.reply(schedulerTarget(), SCHEDULER_BODY, undefined)
  assert.deepEqual(a.sends[0], b.sends[0], 'presentation intent is INERT in markdown mode (full plan parity)')
  const expected = replyTargetToSdkSend(schedulerTarget(), SCHEDULER_BODY, undefined)
  assert.deepEqual(a.sends[0].input, expected.input)
  assert.deepEqual(a.sends[0].opts, expected.opts)
  assert.equal(a.sends[0].to, expected.to)
  // and on the wire: msg_type 'text' with the exact text payload
  const base = stubbedChannel()
  const c = mountedHandle({ renderMode: 'markdown', channel: base.channel })
  await c.handle.reply(schedulerTarget(), SCHEDULER_BODY, SCHEDULER_OK_PRESENTATION)
  assert.equal(base.calls.create[0].data.msg_type, 'text')
  assert.deepEqual(JSON.parse(base.calls.create[0].data.content), { text: SCHEDULER_BODY })
})

// ---------------------------------------------------------------------------
// 3 — oversize: deterministic PRE-send fallback onto the scheduler text path
// ---------------------------------------------------------------------------

test('SC-4. oversize announce body in card mode => pre-send plain-text fallback, ZERO card API calls', async () => {
  const base = stubbedChannel()
  const { handle, sends, logs } = mountedHandle({ renderMode: 'card', channel: base.channel })
  const oversize = '长'.repeat(11000)
  await handle.reply(schedulerTarget(), oversize, SCHEDULER_OK_PRESENTATION)
  assert.equal(sends.length, 1)
  assert.deepEqual(sends[0].input, { text: oversize }, 'falls back to the scheduler plain-text plan BEFORE any card API call')
  assert.equal(base.calls.create[0].data.msg_type, 'text')
  assert.equal(base.calls.create.filter((c) => c.data.msg_type === 'interactive').length, 0, 'card calls = 0')
  assert.equal(base.calls.reply.length, 0)
  assert.ok(logs.some((l) => l.text.includes(CARD_NOT_ATTEMPTED_REQUEST_BODY_OUT_OF_ENVELOPE)), 'CARD_NOT_ATTEMPTED reason recorded')
})

test('SC-4b. empty announce body in card mode => EMPTY_REPLY_NO_CARD, existing text treatment', async () => {
  const base = stubbedChannel()
  const { handle, logs } = mountedHandle({ renderMode: 'card', channel: base.channel })
  await handle.reply(schedulerTarget(), '', SCHEDULER_OK_PRESENTATION)
  assert.equal(base.calls.create[0].data.msg_type, 'text')
  assert.equal(base.calls.create.filter((c) => c.data.msg_type === 'interactive').length, 0)
  assert.ok(logs.some((l) => l.text.includes(CARD_NOT_ATTEMPTED_EMPTY_REPLY)))
})

// ---------------------------------------------------------------------------
// 4 — card API failure: fail-loud, exactly ONE send, NO second answer
// ---------------------------------------------------------------------------

test('SC-5. card API failure after the scheduler card attempt => error propagates, NO markdown re-send (AMBIGUOUS_CARD_SEND_FALLBACK = FORBIDDEN)', async () => {
  const base = stubbedChannel()
  const realCreate = base.channel.rawClient.im.v1.message.create.bind(base.channel.rawClient.im.v1.message)
  base.channel.rawClient.im.v1.message.create = async (opts) => {
    await realCreate(opts) // record the call, then fail loud like the real API
    throw Object.assign(new Error('card create rejected'), { response: { status: 400, data: { code: 230025 } } })
  }
  const { handle, sends } = mountedHandle({ renderMode: 'card', channel: base.channel })
  await assert.rejects(() => handle.reply(schedulerTarget(), SCHEDULER_BODY, SCHEDULER_OK_PRESENTATION), /card create rejected/)
  assert.equal(sends.length, 1, 'the card send is the FIRST and ONLY channel.send — no second answer is ever composed')
  assert.equal(base.calls.create.length, 1)
  assert.equal(base.calls.reply.length, 0)
})

// ---------------------------------------------------------------------------
// 5 — the gate is NARROW: everything else stays plain text in card mode
// ---------------------------------------------------------------------------

test('SC-6. narrow gate: presentation without BOTH cardEligible=true AND source=scheduler stays plain text in card mode', async () => {
  for (const opts of [
    {},
    { presentation: { cardEligible: true } },
    { presentation: { cardEligible: true, source: 'proactive' } },
    { presentation: { cardEligible: false, source: 'scheduler' } },
    { presentation: { source: 'scheduler' } },
  ]) {
    const base = stubbedChannel()
    const { handle } = mountedHandle({ renderMode: 'card', channel: base.channel })
    await handle.reply(schedulerTarget(), 'generic proactive notice', opts)
    assert.equal(base.calls.create[0].data.msg_type, 'text', `no card for ${JSON.stringify(opts)}`)
    assert.equal(base.calls.create.filter((c) => c.data.msg_type === 'interactive').length, 0)
  }
})

test('SC-6b. Scheduler error / outcome_unknown announces (bridge passes NO opts) stay plain text in card mode', async () => {
  const base = stubbedChannel()
  const { handle } = mountedHandle({ renderMode: 'card', channel: base.channel })
  await handle.reply(schedulerTarget(), '[agent-core] delivery failed: boom', undefined)
  await handle.reply(schedulerTarget(), '任务结果未知', {})
  assert.equal(base.calls.create.length, 2)
  for (const c of base.calls.create) assert.equal(c.data.msg_type, 'text')
  assert.equal(base.calls.create.filter((c) => c.data.msg_type === 'interactive').length, 0)
})

// ---------------------------------------------------------------------------
// 6 — no mention, no typing reaction surface
// ---------------------------------------------------------------------------

test('SC-7. no mention: the scheduler card send NEVER carries a mentions key or at-markup (CARD_AUTO_MENTION = NONE)', async () => {
  const base = stubbedChannel()
  const { handle, sends } = mountedHandle({ renderMode: 'card', channel: base.channel })
  await handle.reply(schedulerTarget(), SCHEDULER_BODY, SCHEDULER_OK_PRESENTATION)
  assert.equal('mentions' in sends[0].opts, false, 'no mentions key on the card send opts')
  assert.equal(JSON.stringify(sends[0].input).includes('<at'), false, 'no at-mention markup anywhere')
  assert.equal(JSON.stringify(base.calls.create[0].data.content).includes('<at'), false)
  // the oversize text fallback composes no mention either (no-auto-mention preserved)
  const fallback = mountedHandle({ renderMode: 'card', channel: stubbedChannel().channel })
  await fallback.handle.reply(schedulerTarget(), '长'.repeat(11000), SCHEDULER_OK_PRESENTATION)
  assert.equal('mentions' in fallback.sends[0].opts, false)
})

test('SC-8. typing reaction surface: reply() itself never touches the reaction API (SCHEDULER_ORIGINAL_INBOUND_MESSAGE = NONE)', async () => {
  const base = stubbedChannel()
  const calls = { reactionCreate: 0, reactionDelete: 0 }
  base.channel.rawClient.im.messageReaction = {
    create: async () => { calls.reactionCreate += 1; return { code: 0, data: {} } },
    delete: async () => { calls.reactionDelete += 1; return { code: 0, data: {} } },
  }
  const { handle } = mountedHandle({ renderMode: 'card', channel: base.channel })
  await handle.reply(schedulerTarget(), SCHEDULER_BODY, SCHEDULER_OK_PRESENTATION)
  assert.equal(calls.reactionCreate, 0, 'a scheduler announce has NO original inbound message — no Typing reaction')
  assert.equal(calls.reactionDelete, 0)
})

// ---------------------------------------------------------------------------
// 7 — Router ingress ux authority is NOT reused by the scheduler path
// ---------------------------------------------------------------------------

test('SC-9. the scheduler path never carries ux: presentation alone drives the card (no Router ingress authority reuse)', async () => {
  const base = stubbedChannel()
  const { handle, sends } = mountedHandle({ renderMode: 'card', channel: base.channel })
  await handle.reply(schedulerTarget(), SCHEDULER_BODY, SCHEDULER_OK_PRESENTATION)
  // The card plan anchoring is derived with NO ux (receipt-style): for a
  // kind=create target the plan opts are EMPTY — no rendering key, no mention.
  assert.deepEqual(sends[0].opts, {})
  // Byte-parity of the plan with the pure no-ux mapping of the same target.
  const expected = replyTargetToSdkSend(schedulerTarget(), SCHEDULER_BODY, undefined)
  assert.equal(sends[0].to, expected.to)
  assert.equal(sends[0].opts.replyInThread, undefined, 'direct create has no thread anchoring')
})
