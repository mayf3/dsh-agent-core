import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createLarkChannel } from '@larksuite/channel'
import { buildReplyTarget, FOUNDATION_LARK_CHANNEL_OPTIONS } from '../../src/core.js'
import { buildFeishuHandle } from '../../src/index.js'

function buildHarness({ replyRenderMode = 'markdown' } = {}) {
  const sends = []
  const channel = {
    on() {},
    getBotIdentity() { return { openId: 'ou_bot' } },
    async send(to, input, opts) {
      sends.push({ to, input, opts })
      return { messageId: `om_${sends.length}` }
    },
  }
  const handle = buildFeishuHandle({
    channel,
    cfg: {
      onEvent: null,
      ingressGate: null,
      onStatus: null,
      autoMentionTriggerSender: true,
      processingReactionEnabled: false,
      replyRenderMode,
    },
    log: () => {},
    connect: async () => {},
  })
  const target = buildReplyTarget({
    conversationId: 'oc_group_1',
    chatId: 'oc_group_1',
    channel: 'group',
    messageId: 'om_source',
    triggerSenderOpenId: 'ou_sender',
  }).replyTo('om_source')
  return { handle, sends, target }
}

const ROUTER_UX = Object.freeze({ rendering: 'markdown', autoMentionTriggerSender: true })

const mediaCases = [
  ['external image URL', 'before ![diagram](https://example.com/a.png?x=1#frag) after'],
  ['percent encoded URL', '![图](https://example.com/%E2%9C%93%20image.png)'],
  ['image key', '![uploaded](img_v2_abc123)'],
  ['reference image', '![reference][asset]\n\n[asset]: https://example.com/a.png'],
  ['uppercase HTML image', '<IMG src="https://example.com/a.png">'],
  ['HTML image element', '<image href="https://example.com/a.svg">'],
  ['HTML video', '<video src="https://example.com/a.mp4"></video>'],
  ['HTML audio', '<audio controls src="https://example.com/a.mp3">'],
  ['marker inside code fence', '```markdown\n![literal](https://example.com/a.png)\n```'],
]

for (const [name, answer] of mediaCases) {
  test(`V3 media preselection: ${name} uses original-byte text in markdown mode`, async () => {
    const { handle, sends, target } = buildHarness({ replyRenderMode: 'markdown' })

    await handle.reply(target, answer, { ux: ROUTER_UX })

    assert.equal(sends.length, 1)
    assert.deepEqual(sends[0].input, { text: answer })
    assert.deepEqual(sends[0].opts.mentions, [{ openId: 'ou_sender' }])
    assert.equal(sends[0].opts.replyTo, 'om_source')
  })
}

test('V3 card mode media reply bypasses the card and carries no automatic mention', async () => {
  const answer = 'original ![photo](https://example.com/a.png) bytes'
  const { handle, sends, target } = buildHarness({ replyRenderMode: 'card' })

  await handle.reply(target, answer, { ux: ROUTER_UX })

  assert.equal(sends.length, 1)
  assert.deepEqual(sends[0].input, { text: answer })
  assert.equal(sends[0].opts.mentions, undefined)
  assert.equal(sends[0].opts.replyTo, 'om_source')
})

test('V3 plain img key text is not proof of media and keeps the Markdown path', async () => {
  const { handle, sends, target } = buildHarness({ replyRenderMode: 'markdown' })

  await handle.reply(target, 'existing key img_v2_abc123 is plain text', { ux: ROUTER_UX })

  assert.deepEqual(sends[0].input, { markdown: 'existing key img_v2_abc123 is plain text' })
})

test('V3 non-media empty and oversize Router replies retain existing card-mode fallback plans', async () => {
  const { handle, sends, target } = buildHarness({ replyRenderMode: 'card' })
  const oversize = 'x'.repeat(30_000)

  await handle.reply(target, '', { ux: ROUTER_UX })
  await handle.reply(target, oversize, { ux: ROUTER_UX })

  assert.deepEqual(sends.map(({ input }) => input), [{ markdown: '' }, { markdown: oversize }])
})

test('V3 Scheduler card intent remains card-eligible even when its body contains a media marker', async () => {
  const answer = 'scheduler ![status](https://example.com/status.png)'
  const { handle, sends, target } = buildHarness({ replyRenderMode: 'card' })

  await handle.reply(target, answer, {
    presentation: { cardEligible: true, source: 'scheduler' },
  })

  assert.equal(sends.length, 1)
  assert.ok(sends[0].input.card, 'Scheduler keeps its existing static-card plan')
  assert.equal(sends[0].opts.mentions, undefined)
})

test('V3 Scheduler markdown-mode plan remains plain text with media markers unchanged', async () => {
  const answer = 'scheduler ![status](https://example.com/status.png)'
  const { handle, sends, target } = buildHarness({ replyRenderMode: 'markdown' })

  await handle.reply(target, answer, {
    presentation: { cardEligible: true, source: 'scheduler' },
  })

  assert.deepEqual(sends[0].input, { text: answer })
  assert.equal(sends[0].opts.mentions, undefined)
})

function buildRealSdkHarness() {
  const lower = []
  const sdk = createLarkChannel({
    appId: 'cli_v3_test',
    appSecret: 'test',
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  })
  let upperSends = 0
  const sdkSend = sdk.send.bind(sdk)
  sdk.send = async (...args) => {
    upperSends += 1
    return sdkSend(...args)
  }
  const handle = buildFeishuHandle({
    channel: sdk,
    cfg: {
      onEvent: null,
      ingressGate: null,
      onStatus: null,
      autoMentionTriggerSender: true,
      processingReactionEnabled: false,
      replyRenderMode: 'markdown',
    },
    log: () => {},
    connect: async () => {},
  })
  const target = buildReplyTarget({
    conversationId: 'oc_group_1',
    chatId: 'oc_group_1',
    channel: 'group',
    triggerSenderOpenId: 'ou_sender',
  }).directChat()
  return { sdk, handle, target, lower, upperSends: () => upperSends }
}

test('V3 fixed SDK missing messageId stays unknown after its existing three attempts; upper send stays one', async () => {
  const fx = buildRealSdkHarness()
  fx.sdk.rawClient.im = { v1: { message: {
    async create(opts) {
      fx.lower.push(opts)
      return { code: 0, data: {} }
    },
  } } }

  await assert.rejects(
    () => fx.handle.reply(fx.target, 'short answer', { ux: ROUTER_UX }),
    (error) => error.code === 'unknown' && /message_id missing/.test(error.message),
  )

  assert.equal(fx.upperSends(), 1)
  assert.equal(fx.lower.length, 3)
})

test('V3 fixed SDK send_timeout preserves its code and is not retried by default', async () => {
  const fx = buildRealSdkHarness()
  fx.sdk.rawClient.im = { v1: { message: {
    async create(opts) {
      fx.lower.push(opts)
      throw Object.assign(new Error('request timeout'), { code: 'ETIMEDOUT' })
    },
  } } }

  await assert.rejects(
    () => fx.handle.reply(fx.target, 'short answer', { ux: ROUTER_UX }),
    (error) => error.code === 'send_timeout',
  )

  assert.equal(fx.upperSends(), 1)
  assert.equal(fx.lower.length, 1)
})

for (const code of ['unknown', 'permission_denied', 'format_error']) {
  test(`V3 partial text chunk ${code} failure exposes no fabricated prior chunk receipt`, async () => {
    const fx = buildRealSdkHarness()
    let call = 0
    const terminal = () => {
      if (code === 'unknown') return new Error('socket reset')
      if (code === 'permission_denied') {
        return Object.assign(new Error('denied'), { response: { status: 403, data: { code: 99991400 } } })
      }
      return Object.assign(new Error('invalid text'), { response: { status: 400, data: { code: 230002 } } })
    }
    const send = async (opts) => {
      call += 1
      fx.lower.push(opts)
      if (call === 1) return { code: 0, data: { message_id: 'om_first_chunk' } }
      throw terminal()
    }
    fx.sdk.rawClient.im = { v1: { message: { create: send, reply: send } } }
    const answer = `![media](https://example.com/a.png)\n${'x'.repeat(7_500)}`

    let caught
    try {
      await fx.handle.reply(fx.target, answer, { ux: ROUTER_UX })
    } catch (error) {
      caught = error
    }

    assert.ok(caught)
    assert.equal(caught.code, code)
    assert.equal(caught.chunkIds, undefined)
    assert.equal(caught.messageId, undefined)
    assert.equal(fx.upperSends(), 1)
    assert.equal(fx.lower[0].data.msg_type, 'text')
    assert.equal(fx.lower[1].data.msg_type, 'text', 'already-selected text gets no post-format fallback')
    assert.ok(fx.lower.length >= 2)
  })
}
