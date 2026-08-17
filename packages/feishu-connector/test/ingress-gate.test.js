/**
 * V2 core-alignment tests for the Feishu connector's INGRESS surface
 * (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC, accepted):
 *
 *   §5   normal ingress MUST NOT inject/select a conversation workspace or a
 *        conversation-scoped session (no `workspace` / `session` fields —
 *        Binding.workspace lands null and the Router default session 'main'
 *        applies downstream); the conversationWorkspaceId /
 *        conversationMainSessionId helpers stay exported as TRANSITIONAL
 *        compatibility carriers.
 *   §4.5 the pre-forward ingress gate: after classify decided forward and
 *        BEFORE onEvent, an injectable predicate decides PREBOUND_ONLY. A
 *        rejection FAILS CLOSED — onEvent (the Router's onIngress) is never
 *        called (so no default Binding can be created), and the connector
 *        itself sends the FIXED rejection receipt. A gate ERROR also fails
 *        closed.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeIngressEvent,
  classifyIngress,
  createIngressPipeline,
  INGRESS_GATE_REJECTED_REPLY,
  LruDedup,
  conversationWorkspaceId,
  conversationMainSessionId,
} from '../src/core.js'
import {
  p2pTextEvent,
  groupMentionedEvent,
  groupUnmentionedEvent,
  BOT_OPEN_ID,
} from '../fixtures/fixtures.js'

function ingressEvent(raw, overrides = {}) {
  const ev = normalizeIngressEvent(raw, { botOpenId: BOT_OPEN_ID })
  return { ...ev, ...overrides }
}

/** Pipeline rig: fresh dedup + live config; captures onEvent calls and
 *  rejection receipts. */
function rig(config = {}) {
  const cfg = { onEvent: null, ingressGate: null, ...config }
  const forwarded = []
  const receipts = []
  cfg.onEvent = config.onEvent ?? (async (ev) => { forwarded.push(ev) })
  const handle = createIngressPipeline({
    dedup: new LruDedup({ maxSize: 100 }),
    config: cfg,
    reply: async (ev) => { receipts.push(ev) },
    log: () => {},
  })
  return { cfg, handle, forwarded, receipts }
}

// ---------------------------------------------------------------------------
// §5 — normal ingress injects NEITHER workspace NOR session
// ---------------------------------------------------------------------------

test('V2: normalizeIngressEvent attaches NO workspace and NO session (p2p)', () => {
  const ev = normalizeIngressEvent(p2pTextEvent, { botOpenId: BOT_OPEN_ID })
  assert.equal(ev.workspace, undefined, 'no conversation workspace injection')
  assert.equal(ev.session, undefined, 'no conversation session injection')
  // The event is still JSON-serializable pure data.
  assert.doesNotThrow(() => JSON.stringify(ev))
})

test('V2: normalizeIngressEvent attaches NO workspace and NO session (group)', () => {
  const ev = normalizeIngressEvent(groupMentionedEvent, { botOpenId: BOT_OPEN_ID })
  assert.equal(ev.workspace, undefined)
  assert.equal(ev.session, undefined)
})

test('V2: the conversation policy helpers stay exported and deterministic (transitional compat)', () => {
  assert.equal(conversationWorkspaceId('oc_X'), 'feishu-oc_X')
  assert.equal(conversationMainSessionId('oc_X'), 'main-oc_X')
  assert.equal(conversationWorkspaceId('oc_X'), conversationWorkspaceId('oc_X'))
})

// ---------------------------------------------------------------------------
// §4.5 — pre-forward gate: forward / fail closed / error / ordering
// ---------------------------------------------------------------------------

test('GATE: allowed verdict forwards to onEvent, no receipt', async () => {
  const r = rig({ ingressGate: async () => ({ allowed: true, reason: 'prebound' }) })
  await r.handle(ingressEvent(p2pTextEvent))
  assert.equal(r.forwarded.length, 1)
  assert.equal(r.receipts.length, 0)
})

test('GATE: rejection FAILS CLOSED — onEvent never called, fixed receipt sent once', async () => {
  const r = rig({ ingressGate: async () => ({ allowed: false, reason: 'unbound' }) })
  await r.handle(ingressEvent(p2pTextEvent))
  assert.equal(r.forwarded.length, 0, 'onEvent (Router onIngress) must NOT run')
  assert.equal(r.receipts.length, 1, 'connector sends its own rejection receipt')
  // The receipt is the FIXED text — callers cannot vary it per reason.
  assert.equal(typeof INGRESS_GATE_REJECTED_REPLY, 'string')
  assert.ok(INGRESS_GATE_REJECTED_REPLY.length > 0)
})

test('GATE: a throwing gate FAILS CLOSED too (gate_error)', async () => {
  const r = rig({ ingressGate: async () => { throw new Error('binding store exploded') } })
  await r.handle(ingressEvent(p2pTextEvent))
  assert.equal(r.forwarded.length, 0)
  assert.equal(r.receipts.length, 1)
})

test('GATE: no gate configured keeps the legacy forward behavior', async () => {
  const r = rig()
  await r.handle(ingressEvent(p2pTextEvent))
  assert.equal(r.forwarded.length, 1)
  assert.equal(r.receipts.length, 0)
})

test('GATE: set later takes effect immediately (live config, like setCallback)', async () => {
  const r = rig()
  await r.handle(ingressEvent(p2pTextEvent))
  assert.equal(r.forwarded.length, 1)
  // Wire the gate AFTER construction (the composition layer mounts later).
  r.cfg.ingressGate = async () => ({ allowed: false, reason: 'unbound' })
  await r.handle(ingressEvent(groupMentionedEvent))
  assert.equal(r.forwarded.length, 1, 'second event rejected — not forwarded')
  assert.equal(r.receipts.length, 1)
})

test('GATE ordering: the gate runs AFTER classify (not-addressed events never reach it)', async () => {
  const gateCalls = []
  const r = rig({
    ingressGate: async (ev) => { gateCalls.push(ev.conversationId); return { allowed: true } },
  })
  await r.handle(ingressEvent(groupUnmentionedEvent)) // classified: not forwarded
  assert.equal(gateCalls.length, 0, 'unaddressed group message never reaches the gate')
  assert.equal(r.forwarded.length, 0)
  await r.handle(ingressEvent(groupMentionedEvent)) // classified: forward
  assert.equal(gateCalls.length, 1)
  assert.equal(r.forwarded.length, 1)
})

test('GATE ordering: duplicates never reach the gate', async () => {
  const gateCalls = []
  const r = rig({
    ingressGate: async (ev) => { gateCalls.push(ev.dedupKey); return { allowed: true } },
  })
  const ev = ingressEvent(p2pTextEvent)
  await r.handle(ev)
  await r.handle({ ...ev }) // same dedupKey -> duplicate
  assert.equal(gateCalls.length, 1, 'duplicate dropped before the gate')
  assert.equal(r.forwarded.length, 1)
})

test('GATE: the gate receives the ingress event and its classify verdict', async () => {
  const seen = []
  const r = rig({
    ingressGate: async (ev, meta) => { seen.push({ ev, meta }); return { allowed: true } },
  })
  await r.handle(ingressEvent(p2pTextEvent))
  assert.equal(seen.length, 1)
  assert.equal(seen[0].ev.conversationId, 'oc_p2p_001')
  assert.equal(seen[0].meta.classify.reason, 'p2p')
  assert.equal(typeof classifyIngress, 'function')
})
