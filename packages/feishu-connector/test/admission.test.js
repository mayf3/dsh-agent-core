/**
 * Admission tests — the bridge handler's Agent Core segment (spec §8
 * pipeline ordering + §9 lifecycle):
 *
 *   self-echo drop → group identity fail-closed → PREBOUND_ONLY gate →
 *   onEvent (awaited for the full turn).
 *
 * These are the V2 §4.5 semantics previously tested against the V0
 * createIngressPipeline; the gate surface (fail-closed, fixed receipt, live
 * config swap) is unchanged — only the pre-gate ownership moved (SDK policy
 * owns mention adjudication; dedup owns nothing here anymore).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createBridgeHandler } from '../src/bridge.js'
import { INGRESS_GATE_REJECTED_REPLY } from '../src/core.js'
import { p2pTextEvent, groupMentionedEvent, botEchoEvent, flattenV2Event, BOT_OPEN_ID } from '../fixtures/fixtures.js'

const botIdentity = { openId: BOT_OPEN_ID, name: 'my-bot' }

async function toSdkMessage(envelope) {
  const { normalize } = await import('@larksuite/channel')
  return normalize(flattenV2Event(envelope), { botIdentity, includeRaw: true })
}

/** Handler rig: fresh live config; captures onEvent calls and receipts. */
function rig(config = {}, overrides = {}) {
  const cfg = { onEvent: null, ingressGate: null, ...config }
  const forwarded = []
  const receipts = []
  cfg.onEvent = config.onEvent ?? (async (ev) => { forwarded.push(ev) })
  const handle = createBridgeHandler({
    resolveBotIdentity: overrides.resolveBotIdentity ?? (() => botIdentity),
    config: cfg,
    reply: async (ev) => { receipts.push(ev) },
    log: () => {},
  })
  return { cfg, handle, forwarded, receipts }
}

// ---------------------------------------------------------------------------
// gate verdicts (V2 §4.5 — surface unchanged from the V0 pipeline)
// ---------------------------------------------------------------------------

test('GATE: allowed verdict forwards to onEvent, no receipt', async () => {
  const r = rig({ ingressGate: async () => ({ allowed: true, reason: 'prebound' }) })
  await r.handle(await toSdkMessage(p2pTextEvent))
  assert.equal(r.forwarded.length, 1)
  assert.equal(r.receipts.length, 0)
})

test('GATE: rejection FAILS CLOSED — onEvent never called, fixed receipt sent once', async () => {
  const r = rig({ ingressGate: async () => ({ allowed: false, reason: 'unbound' }) })
  await r.handle(await toSdkMessage(p2pTextEvent))
  assert.equal(r.forwarded.length, 0, 'onEvent (Router onIngress) must NOT run')
  assert.equal(r.receipts.length, 1, 'connector sends its own rejection receipt')
  assert.equal(typeof INGRESS_GATE_REJECTED_REPLY, 'string')
  assert.ok(INGRESS_GATE_REJECTED_REPLY.length > 0)
  assert.ok(INGRESS_GATE_REJECTED_REPLY.includes('未完成绑定'), 'receipt text is the frozen V0 text')
})

test('AC-GATE-MALFORMED-FAIL-CLOSED: only a non-null object with literal allowed=true passes', async () => {
  const malformed = [
    ['undefined', undefined],
    ['null', null],
    ['empty object', {}],
    ['array', []],
    ['string', 'true'],
    ['number', 1],
    ['boolean', true],
    ['function', () => true],
    ['allowed missing', { reason: 'missing' }],
    ['allowed false', { allowed: false }],
    ['allowed zero', { allowed: 0 }],
    ['allowed one', { allowed: 1 }],
    ['allowed string', { allowed: 'true' }],
  ]
  for (const [label, verdict] of malformed) {
    const bindingRows = []
    const r = rig({
      ingressGate: async () => verdict,
      onEvent: async () => { bindingRows.push('created') },
    })
    await r.handle(await toSdkMessage(p2pTextEvent))
    assert.equal(r.forwarded.length, 0, `${label}: Router callback`)
    assert.equal(bindingRows.length, 0, `${label}: Binding row delta`)
    assert.equal(r.receipts.length, 1, `${label}: fixed rejection receipt`)
  }

  const allowed = rig({ ingressGate: async () => ({ allowed: true }) })
  await allowed.handle(await toSdkMessage(p2pTextEvent))
  assert.equal(allowed.forwarded.length, 1, 'literal true is the unique pass value')
})

test('GATE: a throwing gate FAILS CLOSED too (gate_error)', async () => {
  const r = rig({ ingressGate: async () => { throw new Error('binding store exploded') } })
  await r.handle(await toSdkMessage(p2pTextEvent))
  assert.equal(r.forwarded.length, 0)
  assert.equal(r.receipts.length, 1)
})

test('GATE: NO gate installed = fail-closed drop (spec §9 startup ordering — never legacy forward)', async () => {
  const r = rig()
  await r.handle(await toSdkMessage(p2pTextEvent))
  assert.equal(r.forwarded.length, 0, 'a message admitted without a gate would bypass V2 admission')
  assert.equal(r.receipts.length, 0, 'no receipt either — the message is dropped, not rejected')
})

test('GATE: wired after construction takes effect immediately (live config, like setCallback)', async () => {
  const r = rig()
  await r.handle(await toSdkMessage(p2pTextEvent))
  assert.equal(r.forwarded.length, 0, 'no gate yet — fail-closed')
  r.cfg.ingressGate = async () => ({ allowed: false, reason: 'unbound' })
  await r.handle(await toSdkMessage(groupMentionedEvent))
  assert.equal(r.forwarded.length, 0)
  assert.equal(r.receipts.length, 1)
})

test('GATE: self-echo never reaches the gate (residual guard before admission)', async () => {
  const gateCalls = []
  const r = rig({
    ingressGate: async (ev) => { gateCalls.push(ev.conversationId); return { allowed: true } },
  })
  await r.handle(await toSdkMessage(botEchoEvent))
  assert.equal(gateCalls.length, 0, 'the bot\'s own echo never reaches the gate')
  assert.equal(r.forwarded.length, 0)
})

test('GATE: handler awaits the FULL onEvent turn before resolving', async () => {
  let turnDone = false
  const r = rig({
    ingressGate: async () => ({ allowed: true }),
    onEvent: async () => { await new Promise((resolve) => setTimeout(resolve, 25)); turnDone = true },
  })
  const message = await toSdkMessage(p2pTextEvent)
  await r.handle(message)
  assert.equal(turnDone, true, 'onEvent completed before the handler resolved')
})

test('GATE: onEvent rejection propagates to the SDK public error pipeline', async () => {
  const r = rig({ onEvent: async () => { throw new Error('turn exploded') }, ingressGate: async () => ({ allowed: true }) })
  const message = await toSdkMessage(p2pTextEvent)
  await assert.rejects(() => r.handle(message), /turn exploded/)
})

test('GATE: current Router-style {error} outcome remains a handler failure', async () => {
  const r = rig({
    ingressGate: async () => ({ allowed: true }),
    onEvent: async () => ({ error: Object.assign(new Error('provider unavailable'), { code: 'provider_unavailable' }) }),
  })
  const message = await toSdkMessage(p2pTextEvent)
  await assert.rejects(() => r.handle(message), /provider unavailable/)
})

// ---------------------------------------------------------------------------
// BOT_IDENTITY_BEFORE_INGRESS (spec §9) — group messages fail closed while
// the identity is unknown; the normal path makes this unreachable (connect
// resolves identity before the WS handshake delivers anything).
// ---------------------------------------------------------------------------

test('IDENTITY: group message with UNRESOLVED bot identity fails closed (error + drop)', async () => {
  const gateCalls = []
  const r = rig(
    { ingressGate: async (ev) => { gateCalls.push(ev.conversationId); return { allowed: true } } },
    { resolveBotIdentity: () => { throw new Error('bot identity not resolved yet') } },
  )
  await r.handle(await toSdkMessage(groupMentionedEvent))
  assert.equal(gateCalls.length, 0, 'never adjudicated with an unknown identity')
  assert.equal(r.forwarded.length, 0)
  assert.equal(r.receipts.length, 0)
})

test('IDENTITY: p2p message with unresolved identity still reaches the gate (p2p needs no identity for adjudication)', async () => {
  const gateCalls = []
  const r = rig(
    { ingressGate: async () => { gateCalls.push(1); return { allowed: true } } },
    { resolveBotIdentity: () => { throw new Error('bot identity not resolved yet') } },
  )
  await r.handle(await toSdkMessage(p2pTextEvent))
  assert.equal(gateCalls.length, 1)
  assert.equal(r.forwarded.length, 1)
})

test('IDENTITY: identity resolved but openId empty fails closed for group too', async () => {
  const r = rig(
    { ingressGate: async () => ({ allowed: true }) },
    { resolveBotIdentity: () => ({ openId: '', name: 'x' }) },
  )
  await r.handle(await toSdkMessage(groupMentionedEvent))
  assert.equal(r.forwarded.length, 0)
})
