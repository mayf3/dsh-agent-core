/**
 * REQUIRE_MENTION_IN_GROUP / AUTO_MENTION_TRIGGER_SENDER config split tests.
 *
 * The inbound group/topic mention requirement and the success-reply
 * triggering-sender mention are TWO INDEPENDENT config fields (both default
 * true = byte-identical pre-split behavior). These tests pin:
 *
 *   - schema/DEFAULTS default both switches to true;
 *   - default (field absent) and true keep the ordinary no-mention drop;
 *   - requireMentionInGroup=false admits BOUND ordinary group/topic messages
 *     into the PREBOUND_ONLY gate (never past it: unbound stays fail-closed
 *     with the frozen receipt, absent gate stays fail-closed, bot/app
 *     self-echo still drops, p2p unaffected, mentioned path unchanged);
 *   - autoMentionTriggerSender=false composes NO opts.mentions while markdown
 *     rendering, reply/thread anchoring and the body stay untouched; every
 *     excluded caller (failure/unbound receipt, no-ux callers) stays plain;
 *   - default/true keeps the native auto-mention exactly as before.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createLarkChannel } from '@larksuite/channel'
import { Config, buildFeishuHandle } from '../src/index.js'
import { createBridgeHandler, createReceiptReply } from '../src/bridge.js'
import {
  INGRESS_GATE_REJECTED_REPLY,
  FOUNDATION_LARK_CHANNEL_OPTIONS,
  replyTargetFor,
} from '../src/core.js'
import {
  p2pTextEvent,
  groupMentionedEvent,
  groupUnmentionedEvent,
  threadReplyEvent,
  botEchoEvent,
  flattenV2Event,
  BOT_OPEN_ID,
} from '../fixtures/fixtures.js'

const botIdentity = { openId: BOT_OPEN_ID, name: 'my-bot' }
const UX_INTENT = { rendering: 'markdown', autoMentionTriggerSender: true }

async function toSdkMessage(envelope) {
  const { normalize } = await import('@larksuite/channel')
  return normalize(flattenV2Event(envelope), { botIdentity, includeRaw: true })
}

// A topic-thread message WITHOUT a bot mention (threadReplyEvent minus mentions).
const topicUnmentionedEvent = {
  ...threadReplyEvent,
  header: { event_id: 'evt_thread_002', event_type: 'im.message.receive_v1' },
  event: {
    ...threadReplyEvent.event,
    sender: { sender_id: { open_id: 'ou_topic_chatter' }, sender_type: 'user' },
    message: {
      ...threadReplyEvent.event.message,
      message_id: 'om_thread_msg_002',
      mentions: [],
      content: '{"text":"topic chat without any mention"}',
    },
  },
}

// A group message whose sender is the app itself (sender_type=app echo).
const appEchoEvent = {
  ...groupUnmentionedEvent,
  header: { event_id: 'evt_app_echo', event_type: 'im.message.receive_v1' },
  event: {
    ...groupUnmentionedEvent.event,
    sender: { sender_id: { open_id: 'ou_app_echo' }, sender_type: 'app' },
    message: {
      ...groupUnmentionedEvent.event.message,
      message_id: 'om_app_echo_001',
    },
  },
}

// ---------------------------------------------------------------------------
// Schema defaults
// ---------------------------------------------------------------------------

test('CFG: Config schema defaults both switches to true', () => {
  const parsed = Config({ appId: 'a', appSecret: 'b' })
  assert.equal(parsed.requireMentionInGroup, true)
  assert.equal(parsed.autoMentionTriggerSender, true)
})

// ---------------------------------------------------------------------------
// Inbound: requireMentionInGroup gates exactly the no-mention drop
// ---------------------------------------------------------------------------

/** Bridge rig: fresh live config, allowed gate by default, capture forwards. */
function rig(config = {}) {
  const cfg = { onEvent: null, ingressGate: null, ...config }
  const forwarded = []
  const receipts = []
  if (!('ingressGate' in config)) {
    cfg.ingressGate = async () => ({ allowed: true, reason: 'prebound' })
  }
  cfg.onEvent = async (ev) => { forwarded.push(ev) }
  const handle = createBridgeHandler({
    resolveBotIdentity: () => botIdentity,
    config: cfg,
    reply: async (ev) => { receipts.push(ev) },
    log: () => {},
  })
  return { cfg, handle, forwarded, receipts }
}

test('IN-DEFAULT-PARITY: field absent keeps the ordinary no-mention group/topic drop', async () => {
  const r = rig()
  await r.handle(await toSdkMessage(groupUnmentionedEvent))
  await r.handle(await toSdkMessage(topicUnmentionedEvent))
  assert.equal(r.forwarded.length, 0, 'ordinary no-mention stays dropped by default')
  assert.equal(r.receipts.length, 0, 'silent drop — no receipt')
})

test('IN-DEFAULT-PARITY: explicit true keeps the drop (same as default)', async () => {
  const r = rig({ requireMentionInGroup: true })
  await r.handle(await toSdkMessage(groupUnmentionedEvent))
  assert.equal(r.forwarded.length, 0)
  assert.equal(r.receipts.length, 0)
})

test('IN-FALSE-GROUP: requireMentionInGroup=false forwards a bound ordinary group message', async () => {
  const r = rig({ requireMentionInGroup: false })
  await r.handle(await toSdkMessage(groupUnmentionedEvent))
  assert.equal(r.forwarded.length, 1, 'gate-allowed ordinary group message reaches onEvent')
  assert.equal(r.receipts.length, 0)
  const ev = r.forwarded[0]
  assert.equal(ev.chatType, 'group')
  assert.equal(ev.mentioned, false, 'mentioned flag is NOT rewritten by the switch')
  assert.equal(ev.conversationId, 'oc_group_001')
})

test('IN-FALSE-TOPIC: requireMentionInGroup=false forwards a bound ordinary topic message with topic continuity', async () => {
  const r = rig({ requireMentionInGroup: false })
  await r.handle(await toSdkMessage(topicUnmentionedEvent))
  assert.equal(r.forwarded.length, 1)
  assert.equal(r.receipts.length, 0)
  const ev = r.forwarded[0]
  assert.equal(ev.conversationId, 'oc_group_002:topic:omt_thread_001', 'topic identity preserved')
  assert.equal(ev.threadId, 'omt_thread_001')
  assert.equal(ev.mentioned, false)
})

test('IN-FALSE-UNBOUND: gate rejection still fails closed with the frozen receipt', async () => {
  const r = rig({ requireMentionInGroup: false, ingressGate: async () => ({ allowed: false, reason: 'unbound' }) })
  await r.handle(await toSdkMessage(groupUnmentionedEvent))
  assert.equal(r.forwarded.length, 0, 'PREBOUND_ONLY verdict is unchanged by the switch')
  assert.equal(r.receipts.length, 1)
  assert.equal(r.receipts[0].messageId, 'om_group_msg_002')
  assert.equal(INGRESS_GATE_REJECTED_REPLY.includes('未完成绑定'), true)
})

test('IN-FALSE-NO-GATE: absent gate stays fail-closed even with the requirement off', async () => {
  const r = rig({ requireMentionInGroup: false, ingressGate: null })
  await r.handle(await toSdkMessage(groupUnmentionedEvent))
  assert.equal(r.forwarded.length, 0, 'no gate installed — never the legacy forward')
  assert.equal(r.receipts.length, 0)
})

test('IN-FALSE-SELF-ECHO: bot and app senders still drop with the requirement off', async () => {
  const r = rig({ requireMentionInGroup: false })
  await r.handle(await toSdkMessage(botEchoEvent))
  await r.handle(await toSdkMessage(appEchoEvent))
  assert.equal(r.forwarded.length, 0, 'self-echo guard precedes the requirement switch')
  assert.equal(r.receipts.length, 0)
})

test('IN-FALSE-P2P: p2p admission is unchanged (no requirement either way)', async () => {
  const r = rig({ requireMentionInGroup: false })
  await r.handle(await toSdkMessage(p2pTextEvent))
  assert.equal(r.forwarded.length, 1)
})

test('IN-FALSE-MENTIONED: explicitly mentioned group messages still forward (path unchanged)', async () => {
  const r = rig({ requireMentionInGroup: false })
  await r.handle(await toSdkMessage(groupMentionedEvent))
  assert.equal(r.forwarded.length, 1)
})

test('IN-FALSE-CONFIG-SWAP: the switch is read per event on the live config', async () => {
  const r = rig({ requireMentionInGroup: true })
  await r.handle(await toSdkMessage(groupUnmentionedEvent))
  assert.equal(r.forwarded.length, 0)
  r.cfg.requireMentionInGroup = false
  await r.handle(await toSdkMessage(groupUnmentionedEvent))
  assert.equal(r.forwarded.length, 1, 'live config swap takes effect immediately')
})

// ---------------------------------------------------------------------------
// Outbound: autoMentionTriggerSender is the FINAL mention switch
// ---------------------------------------------------------------------------

function mdText(call) {
  return JSON.parse(call.data.content).zh_cn.content[0][0].text
}

function stubbedChannel() {
  const calls = { create: [], reply: [] }
  const channel = createLarkChannel({
    appId: 'cli_mention_config_test',
    appSecret: 'test',
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
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

function handleOver(channel, cfgExtra = {}) {
  return buildFeishuHandle({
    channel,
    cfg: { onEvent: null, ingressGate: null, onStatus: null, ...cfgExtra },
    log: () => {},
    connect: async () => {},
  })
}

const groupIngress = {
  channel: 'group',
  chatType: 'group',
  conversationId: 'oc_group_1',
  chatId: 'oc_group_1',
  messageId: 'om_src_group',
  sender: { openId: 'ou_trigger_sender', name: 'Any Name' },
  text: 'hello',
}

const topicIngress = {
  channel: 'thread',
  chatType: 'group',
  conversationId: 'oc_group_1:topic:omt_t1',
  chatId: 'oc_group_1',
  threadId: 'omt_t1',
  rootMsgId: 'om_root',
  messageId: 'om_src_topic',
  sender: { openId: 'ou_trigger_sender' },
  text: 'hello',
}

const p2pIngress = {
  channel: 'p2p',
  chatType: 'p2p',
  conversationId: 'oc_p2p_1',
  chatId: 'oc_p2p_1',
  messageId: 'om_src_p2p',
  sender: { openId: 'ou_trigger_sender' },
  text: 'hello',
}

test('OUT-DEFAULT-PARITY: default config keeps the native auto-mention on the success call', async () => {
  const { channel, calls } = stubbedChannel()
  const handle = handleOver(channel)
  const target = replyTargetFor(groupIngress).replyTo(groupIngress.messageId)
  await handle.reply(target, '**answer** done', { ux: UX_INTENT })
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].data.msg_type, 'post')
  assert.ok(mdText(calls.reply[0]).startsWith('<at user_id="ou_trigger_sender">'), 'native mention composed by default')
})

test('OUT-FALSE-PLAN: autoMentionTriggerSender=false sends NO mentions while markdown + anchoring survive the seam', async () => {
  const sent = []
  const stubChannel = {
    on() {},
    getBotIdentity() { return { openId: 'ou_bot', name: 'bot' } },
    getConnectionStatus() { return { state: 'connected' } },
    async send(to, input, opts) { sent.push({ to, input, opts }); return { messageId: 'om_out_1' } },
  }
  const handle = handleOver(stubChannel, { autoMentionTriggerSender: false })
  const target = replyTargetFor(groupIngress).replyTo(groupIngress.messageId)
  await handle.reply(target, '# Answer\n\n| h | v |\n|---|---|\n| a | 1 |', { ux: UX_INTENT })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].opts.mentions, undefined, 'no opts.mentions composed under the final switch')
  assert.deepEqual(sent[0].input, { markdown: '# Answer\n\n| h | v |\n|---|---|\n| a | 1 |' }, 'markdown input byte-identical')
  assert.equal(sent[0].opts.replyTo, 'om_src_group', 'reply anchor preserved')
  assert.equal(sent[0].opts.replyInThread, false, 'inline group reply semantics preserved')
  assert.equal(sent[0].to, 'oc_group_1')
})

test('OUT-FALSE-GROUP: real SDK group success reply renders markdown, stays anchored, composes NO mention', async () => {
  const { channel, calls } = stubbedChannel()
  const handle = handleOver(channel, { autoMentionTriggerSender: false })
  const target = replyTargetFor(groupIngress).replyTo(groupIngress.messageId)
  const body = '| 名称 name | 值 value |\n|---|---|\n| alpha 甲 | 1 |\n\nsee [文档 link](https://example.com/docs?a=1&b=two%20words#sec) done'
  const result = await handle.reply(target, body, { ux: UX_INTENT })
  assert.equal(calls.reply.length, 1, 'anchored reply endpoint used (target preserved)')
  assert.equal(calls.create.length, 0)
  assert.equal(calls.reply[0].data.msg_type, 'post', 'markdown rendering preserved')
  const text = mdText(calls.reply[0])
  assert.equal(text.includes('<at'), false, 'no mention token anywhere')
  for (const needle of ['| 名称 name | 值 value |', '| alpha 甲 | 1 |', 'https://example.com/docs?a=1&b=two%20words#sec', '文档 link', 'done']) {
    assert.ok(text.includes(needle), `body byte lost: ${needle}`)
  }
  assert.ok(result.messageId)
})

test('OUT-FALSE-TOPIC: topic success reply keeps the thread anchor and composes NO mention', async () => {
  const { channel, calls } = stubbedChannel()
  const handle = handleOver(channel, { autoMentionTriggerSender: false })
  const target = replyTargetFor(topicIngress).replyTo(topicIngress.messageId)
  await handle.reply(target, '**topic answer** 回答', { ux: UX_INTENT })
  assert.equal(calls.reply.length, 1, 'anchored in-thread reply (thread target preserved)')
  assert.equal(calls.create.length, 0)
  assert.equal(calls.reply[0].data.msg_type, 'post')
  const text = mdText(calls.reply[0])
  assert.equal(text.includes('<at'), false, 'topic reply mention-free under the switch')
  assert.ok(text.includes('topic answer'), 'body preserved')
})

test('OUT-FALSE-P2P: p2p success reply stays mention-free (structural exclusion unchanged)', async () => {
  const { channel, calls } = stubbedChannel()
  const handle = handleOver(channel, { autoMentionTriggerSender: false })
  const target = replyTargetFor(p2pIngress).replyTo(p2pIngress.messageId)
  await handle.reply(target, 'p2p answer', { ux: UX_INTENT })
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].data.msg_type, 'post')
  assert.equal(mdText(calls.reply[0]).includes('<at'), false, 'p2p mention-free under the switch')
  assert.ok(mdText(calls.reply[0]).includes('p2p answer'), 'body preserved')
})

test('OUT-FALSE-NO-UX: callers without ux opts keep the V0 plain-text plan under the switch', async () => {
  const { channel, calls } = stubbedChannel()
  const handle = handleOver(channel, { autoMentionTriggerSender: false })
  const target = replyTargetFor(groupIngress).replyTo(groupIngress.messageId)
  await handle.reply(target, '[agent-core] delivery failed: boom')
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].data.msg_type, 'text', 'failure path stays plain text')
  assert.equal(JSON.parse(calls.reply[0].data.content).text.includes('<at'), false, 'failure path stays mention-free')
})

test('OUT-FALSE-RECEIPT: unbound rejection receipt stays plain text / no mention', async () => {
  const { channel, calls } = stubbedChannel()
  const receipt = createReceiptReply(channel, () => {})
  await receipt(groupIngress)
  assert.equal(calls.reply.length, 1)
  assert.equal(calls.reply[0].data.msg_type, 'text')
  assert.deepEqual(JSON.parse(calls.reply[0].data.content), { text: INGRESS_GATE_REJECTED_REPLY })
})

test('OUT-FALSE-LONG: chunked markdown carries no mention on ANY chunk under the switch', async () => {
  const { channel, calls } = stubbedChannel()
  const handle = handleOver(channel, { autoMentionTriggerSender: false })
  const target = replyTargetFor(groupIngress).directChat()
  const body = 'para 中文与 English mixed. '.repeat(80).trim() + '\n\n```python\n' +
    Array.from({ length: 120 }, (_, i) => `code_line_${i} = ${i}`).join('\n') + '\n```'
  await handle.reply(target, body, { ux: UX_INTENT })
  assert.ok(calls.create.length > 1, 'long content still chunks')
  for (const call of calls.create) {
    assert.equal(String(call.data.content).includes('<at'), false, 'no chunk may carry a mention')
  }
  const texts = calls.create.map(mdText)
  assert.ok(texts.join('\n').includes('code_line_119 = 119'), 'content complete across chunks')
})

test('OUT-TRUE-EXPLICIT: explicit true config keeps composing mentions (independence of the two switches)', async () => {
  const { channel, calls } = stubbedChannel()
  const handle = handleOver(channel, { requireMentionInGroup: false, autoMentionTriggerSender: true })
  const target = replyTargetFor(groupIngress).replyTo(groupIngress.messageId)
  await handle.reply(target, 'answer', { ux: UX_INTENT })
  assert.equal(calls.reply.length, 1)
  assert.ok(mdText(calls.reply[0]).startsWith('<at user_id="ou_trigger_sender">'), 'auto-mention ON with inbound requirement OFF')
})
