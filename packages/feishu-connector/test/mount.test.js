/**
 * Mount-shell tests: buildFeishuHandle service surface over a stub channel
 * (no network) + the apply() configuration guards (disabled / missing
 * credentials). The live connect path itself is covered by the standalone
 * driver + production canary, not by unit tests on this machine.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildFeishuHandle, apply, name, inject } from '../src/index.js'
import { normalizedToIngressEvent } from '../src/bridge.js'
import { FOUNDATION_LARK_CHANNEL_OPTIONS } from '../src/core.js'
import { p2pTextEvent, flattenV2Event, BOT_OPEN_ID } from '../fixtures/fixtures.js'

const botIdentity = { openId: BOT_OPEN_ID, name: 'my-bot' }

function stubChannel() {
  const handlers = {}
  return {
    handlers,
    botIdentity,
    on(mapOrName, maybeHandler) {
      if (typeof mapOrName === 'string') { handlers[mapOrName] = maybeHandler; return () => {} }
      for (const [k, fn] of Object.entries(mapOrName)) handlers[k] = fn
      return () => {}
    },
    getBotIdentity: () => botIdentity,
    getConnectionStatus: () => ({ state: 'CONNECTED', reconnectAttempts: 0 }),
    async send(to, input, opts) {
      this.sendCalls.push({ to, input, opts })
      return { messageId: `om_stub_${this.sendCalls.length}` }
    },
    sendCalls: [],
    async disconnect() { this.disconnected = true },
    disconnected: false,
  }
}

function rig(overrides = {}) {
  const channel = stubChannel()
  const cfg = { onEvent: null, ingressGate: null, onStatus: null, ...overrides.cfg }
  const statuses = []
  cfg.onStatus = (s) => statuses.push(s)
  const handle = buildFeishuHandle({
    channel,
    cfg,
    log: () => {},
    connect: overrides.connect ?? (async () => {}),
  })
  return { channel, cfg, handle, statuses }
}

/** Drive one real wire event through the mounted bridge (stub channel). */
async function deliverEvent(rig, envelope) {
  const { normalize } = await import('@larksuite/channel')
  const msg = await normalize(flattenV2Event(envelope), { botIdentity, includeRaw: true })
  await rig.channel.handlers.message(msg)
}

test('plugin shell metadata: name feishu, no DSH inject', () => {
  assert.equal(name, 'feishu')
  assert.deepEqual(inject, [])
})

test('handle surface: reply/replyTargetFor/status/reconnectCount/setCallback/setIngressGate/ready', async () => {
  const r = rig()
  for (const method of ['reply', 'replyTargetFor', 'status', 'reconnectCount', 'setCallback', 'setIngressGate', 'ready']) {
    assert.equal(typeof r.handle[method], 'function', `handle.${method} must exist`)
  }
  await r.handle.ready()
  assert.equal(r.handle.status(), 'connected')
  assert.equal(r.handle.reconnectCount(), 0)
})

test('mounted bridge: prebound p2p message flows gate → onEvent; reply seam sends via SDK', async () => {
  const forwarded = []
  const r = rig({ cfg: { onEvent: async (ev) => { forwarded.push(ev) }, ingressGate: async () => ({ allowed: true, reason: 'prebound' }) } })
  await deliverEvent(r, p2pTextEvent)
  assert.equal(forwarded.length, 1)
  assert.equal(forwarded[0].conversationId, 'oc_p2p_001')

  // the Router's reply path against the stub channel
  const target = r.handle.replyTargetFor(forwarded[0]).replyTo(forwarded[0].messageId)
  const sent = await r.handle.reply(target, 'the answer is 42')
  assert.equal(r.channel.sendCalls.length, 1)
  assert.equal(r.channel.sendCalls[0].opts.replyTo, 'om_p2p_msg_001')
  assert.equal(r.channel.sendCalls[0].input.text, 'the answer is 42')
  assert.equal(sent.messageId, 'om_stub_1')
  assert.equal(sent.method, 'reply')
})

test('mounted bridge: unbound conversation → fixed receipt via the connector\'s own send, onEvent never called', async () => {
  const forwarded = []
  const r = rig({ cfg: {
    onEvent: async (ev) => { forwarded.push(ev) },
    ingressGate: async () => ({ allowed: false, reason: 'unbound' }),
  } })
  await deliverEvent(r, p2pTextEvent)
  assert.equal(forwarded.length, 0)
  assert.equal(r.channel.sendCalls.length, 1, 'the connector itself sends the rejection receipt')
  const receipt = r.channel.sendCalls[0]
  assert.equal(receipt.input.text.includes('未完成绑定'), true, 'the receipt is the frozen INGRESS_GATE_REJECTED_REPLY text')
  assert.equal(receipt.opts.replyTo, 'om_p2p_msg_001')
})

test('mounted bridge: reconnect lifecycle feeds onStatus and reconnectCount', async () => {
  const r = rig()
  await r.handle.ready()
  await new Promise((resolve) => setImmediate(resolve)) // let the ready-then status emit land
  r.channel.handlers.reconnecting()
  r.channel.handlers.reconnected()
  assert.equal(r.handle.reconnectCount(), 1)
  assert.deepEqual(r.statuses.map((s) => s.status), ['connected', 'reconnecting', 'connected'])
})

test('apply(): disabled by config returns the offline handle', async () => {
  const provided = []
  const ctx = { effect: () => {}, provide: (n, v) => { provided.push(n) }, get: () => undefined }
  const handle = apply(ctx, { enabled: false })
  assert.equal(handle.started, false)
  assert.equal(handle.status(), 'disabled')
  assert.equal(await handle.ready(), 'disabled')
  await assert.rejects(() => handle.reply({}, 'x'), /disabled/)
  assert.equal(provided.length, 0)
})

test('apply(): enabled without credentials fails loud', () => {
  const ctx = { effect: () => {}, provide: () => {}, get: () => undefined }
  assert.throws(() => apply(ctx, { enabled: true }), /appId\/appSecret/)
})

test('FOUNDATION options are what the shell mounts (single definition)', () => {
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.safety.chatQueue.enabled, false)
  assert.equal(typeof normalizedToIngressEvent, 'function')
})
