/**
 * Processing-reaction tests (OWNER_RULING = ENABLE_FEISHU_PROCESSING_
 * REACTION): the one-shot `Typing` reaction around the FULL admitted Agent
 * turn — one create before the turn body, one delete in the turn's finally
 * across EVERY settlement shape, API failures never affecting the outcome,
 * per-turn reactionId isolation, stale guard, zero timers, graceful dispose,
 * admission boundary, real-SDK-pipeline dedup, and mount non-regression.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBridgeHandler } from '../src/bridge.js'
import { Config, buildFeishuHandle } from '../src/index.js'
import {
  PROCESSING_REACTION_EMOJI_TYPE,
  PROCESSING_REACTION_STALE_WINDOW_MS,
  MAX_REACTION_CREATE_CALLS_PER_TURN,
  MAX_REACTION_DELETE_CALLS_PER_TURN,
  createProcessingReactionLifecycle,
  bridgeConfigWithProcessingReaction,
} from '../src/processing-reaction.js'
import { nextTurn, realSdkChannel, dispatchEnvelope } from './real-sdk-harness.js'
import { p2pTextEvent, groupUnmentionedEvent, botEchoEvent, flattenV2Event, BOT_OPEN_ID } from '../fixtures/fixtures.js'

const HERE = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// disabled default — no reaction API calls at all
// ---------------------------------------------------------------------------

test('DISABLED DEFAULT: schema default false and no reaction API calls; turn unchanged', async () => {
  const parsed = Config({ appId: 'a', appSecret: 'b' })
  assert.equal(parsed.processingReactionEnabled, false, 'Config schema default false')
  const r = rig({ enabled: false })
  const forwarded = []
  r.cfg.onEvent = async (ev) => { forwarded.push(ev.messageId); return { reply: 'ok' } }
  r.cfg.ingressGate = async () => ({ allowed: true })
  const result = await r.handle(await toSdkMessage(p2pTextEvent))
  assert.equal(forwarded.length, 1)
  assert.deepEqual(result, { reply: 'ok' })
  assert.equal(r.channel.createCalls.length, 0)
  assert.equal(r.channel.deleteCalls.length, 0)
})

test('DISABLED EXPLICIT: processingReactionEnabled=false behaves identically', async () => {
  const r = rig({ enabled: false, config: { processingReactionEnabled: false } })
  r.cfg.onEvent = async () => 'done'
  r.cfg.ingressGate = async () => ({ allowed: true })
  await r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_disabled')))
  assert.equal(r.channel.createCalls.length, 0)
  assert.equal(r.channel.deleteCalls.length, 0)
})

// ---------------------------------------------------------------------------
// enabled success turn — exactly one create before the turn, one delete after
// ---------------------------------------------------------------------------

test('SUCCESS: create=1 BEFORE the Agent turn, delete=1 after settlement, exact API payloads', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => { r.journal.push('gate'); return { allowed: true } }
  r.cfg.onEvent = async (ev) => { r.journal.push('turn'); return { reply: `answer for ${ev.messageId}` } }
  const result = await r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_success')))
  assert.deepEqual(result, { reply: 'answer for om_success' })
  assert.equal(r.channel.createCalls.length, MAX_REACTION_CREATE_CALLS_PER_TURN)
  assert.equal(r.channel.deleteCalls.length, MAX_REACTION_DELETE_CALLS_PER_TURN)
  // REACTION_ADDED_BEFORE_AGENT_TURN / REMOVED_AFTER_REPLY_SETTLEMENT ordering.
  assert.deepEqual(r.journal, ['gate', 'create', 'turn', 'delete'])
  // create payload shape: ORIGINAL inbound message + frozen Typing emoji.
  assert.deepEqual(r.channel.createCalls[0], {
    path: { message_id: 'om_success' },
    data: { reaction_type: { emoji_type: PROCESSING_REACTION_EMOJI_TYPE } },
  })
  assert.equal(PROCESSING_REACTION_EMOJI_TYPE, 'Typing')
  // delete payload shape: same message + the reactionId THIS create returned.
  assert.deepEqual(r.channel.deleteCalls[0].path, {
    message_id: 'om_success',
    reaction_id: r.channel.deleteCalls[0].path.reaction_id,
  })
  assert.match(r.channel.deleteCalls[0].path.reaction_id, /^rid_\d+$/)
})

// ---------------------------------------------------------------------------
// error settlements — reaction still removed exactly once
// ---------------------------------------------------------------------------

test('AGENT ERROR (rejected onEvent): handler rejects, create=1 delete=1', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  r.cfg.onEvent = async () => { throw new Error('agent child crashed') }
  await assert.rejects(r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_agent_err'))), /agent child crashed/)
  assert.equal(r.channel.createCalls.length, MAX_REACTION_CREATE_CALLS_PER_TURN)
  assert.equal(r.channel.deleteCalls.length, MAX_REACTION_DELETE_CALLS_PER_TURN)
})

test('ROUTER ERROR + FINAL REPLY ERROR ({error} return): bridge throws per contract, delete=1', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  // Router semantics: a failed final reply send is caught and returned as
  // {error} after its best-effort failure notice — a normal resolution.
  r.cfg.onEvent = async () => ({ error: new Error('final reply send failed') })
  await assert.rejects(r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_reply_err'))), /final reply send failed/)
  assert.equal(r.channel.createCalls.length, MAX_REACTION_CREATE_CALLS_PER_TURN)
  assert.equal(r.channel.deleteCalls.length, MAX_REACTION_DELETE_CALLS_PER_TURN)
})

test('OUTCOME_UNKNOWN: structured timeout error settles, delete=1', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  r.cfg.onEvent = async () => ({
    error: Object.assign(new Error('turn outcome unknown'), { status: 'outcome_unknown', envelope: 'outcome_unknown' }),
  })
  await assert.rejects(r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_unknown'))), /outcome unknown/)
  assert.equal(r.channel.createCalls.length, MAX_REACTION_CREATE_CALLS_PER_TURN)
  assert.equal(r.channel.deleteCalls.length, MAX_REACTION_DELETE_CALLS_PER_TURN)
})

test('SYNCHRONOUS THROW inside onEvent: wrapper still deletes once', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  r.cfg.onEvent = () => { throw new Error('sync throw') }
  await assert.rejects(r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_sync'))), /sync throw/)
  assert.equal(r.channel.createCalls.length, 1)
  assert.equal(r.channel.deleteCalls.length, 1)
})

// ---------------------------------------------------------------------------
// reaction API failures never affect the turn
// ---------------------------------------------------------------------------

test('CREATE FAILS: turn result preserved, no delete, sanitized warning only', async () => {
  const r = rig({ failCreate: true })
  r.cfg.ingressGate = async () => ({ allowed: true })
  r.cfg.onEvent = async () => ({ reply: 'turn succeeded anyway' })
  const result = await r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_create_fail')))
  assert.deepEqual(result, { reply: 'turn succeeded anyway' })
  assert.equal(r.channel.createCalls.length, 1)
  assert.equal(r.channel.deleteCalls.length, 0, 'nothing was added — nothing to delete')
  const warnings = r.logs.filter(([level]) => level === 'warn').map(([, ...rest]) => JSON.stringify(rest))
  assert.equal(warnings.length, 1, 'exactly one sanitized warning')
  const all = warnings.join(' ')
  assert.ok(!all.includes('secret-token') && !all.includes('authorization') && !all.includes('Authorization'), 'no token/auth material in logs')
  assert.ok(!all.includes('appSecret'), 'no appSecret in logs')
})

test('DELETE FAILS: original turn outcome NOT overridden, no retry loop', async () => {
  const r = rig({ failDelete: true })
  r.cfg.ingressGate = async () => ({ allowed: true })
  r.cfg.onEvent = async () => ({ reply: 'survives delete failure' })
  const result = await r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_del_fail')))
  assert.deepEqual(result, { reply: 'survives delete failure' }, 'success outcome untouched')
  assert.equal(r.channel.createCalls.length, 1)
  assert.equal(r.channel.deleteCalls.length, MAX_REACTION_DELETE_CALLS_PER_TURN, 'exactly one delete attempt — no retry loop')
  // A failing delete also never converts an error turn into a different one.
  const r2 = rig({ failDelete: true })
  r2.cfg.ingressGate = async () => ({ allowed: true })
  r2.cfg.onEvent = async () => { throw new Error('original agent failure') }
  await assert.rejects(r2.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_del_fail2'))), /original agent failure/)
  assert.equal(r2.channel.deleteCalls.length, 1)
})

// ---------------------------------------------------------------------------
// concurrency — per-turn reactionId isolation
// ---------------------------------------------------------------------------

test('CONCURRENT TURNS: independent reactionIds, each turn deletes only its own', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  const gates = new Map()
  for (const id of ['om_c1', 'om_c2']) {
    let resolve
    const promise = new Promise((res) => { resolve = res })
    gates.set(id, { promise, resolve })
  }
  r.cfg.onEvent = (ev) => gates.get(ev.messageId).promise
  const p1 = r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_c1')))
  const p2 = r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_c2')))
  await nextTurn()
  await nextTurn()
  assert.equal(r.channel.createCalls.length, 2)
  const ridByMessage = new Map(r.channel.createCalls.map((call, i) => [call.path.message_id, `rid_${i + 1}`]))
  assert.notEqual(r.channel.createCalls[0].path.message_id, r.channel.createCalls[1].path.message_id)
  // Both reactions are ACTIVE while both turns are in flight.
  assert.equal(r.lifecycle.activeReactionCount(), 2)
  gates.get('om_c1').resolve({ reply: 'r1' })
  gates.get('om_c2').resolve({ reply: 'r2' })
  assert.deepEqual(await p1, { reply: 'r1' })
  assert.deepEqual(await p2, { reply: 'r2' })
  assert.equal(r.channel.deleteCalls.length, 2)
  for (const call of r.channel.deleteCalls) {
    assert.equal(call.path.reaction_id, ridByMessage.get(call.path.message_id), 'delete pairs with THIS turn\'s create')
  }
  assert.equal(r.lifecycle.activeReactionCount(), 0)
})

// ---------------------------------------------------------------------------
// stale/replayed message — no reaction, turn still forwarded
// ---------------------------------------------------------------------------

test('STALE >2min: create=0 (turn itself still forwarded unchanged)', async () => {
  const r = rig({})
  const forwarded = []
  r.cfg.ingressGate = async () => ({ allowed: true })
  r.cfg.onEvent = async (ev) => { forwarded.push(ev.messageId); return { reply: 'stale but processed' } }
  const result = await r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_stale', PROCESSING_REACTION_STALE_WINDOW_MS + 60_000)))
  assert.deepEqual(result, { reply: 'stale but processed' })
  assert.deepEqual(forwarded, ['om_stale'])
  assert.equal(r.channel.createCalls.length, 0)
  assert.equal(r.channel.deleteCalls.length, 0)
})

// ---------------------------------------------------------------------------
// no interval / timeout / keepalive re-add — ever
// ---------------------------------------------------------------------------

test('NO TIMERS / NO PERIODIC RE-ADD: long turn sees exactly one create; module creates zero timers', async () => {
  const source = readFileSync(join(HERE, '..', 'src', 'processing-reaction.js'), 'utf8')
  assert.ok(!/setInterval|setTimeout|setImmediate/.test(source), 'no timer API anywhere in the lifecycle module')
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  let settle
  const gate = new Promise((resolve) => { settle = resolve })
  r.cfg.onEvent = async () => { await gate; return { reply: 'long turn done' } }
  const pending = r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_long')))
  for (let i = 0; i < 5; i += 1) await nextTurn()
  assert.equal(r.channel.createCalls.length, 1, 'no periodic re-add while the turn runs')
  assert.equal(r.lifecycle.activeReactionCount(), 1)
  settle()
  assert.deepEqual(await pending, { reply: 'long turn done' })
  assert.equal(r.channel.createCalls.length, MAX_REACTION_CREATE_CALLS_PER_TURN)
  assert.equal(r.channel.deleteCalls.length, MAX_REACTION_DELETE_CALLS_PER_TURN)
})

// ---------------------------------------------------------------------------
// graceful dispose — one best-effort cleanup pass, no double delete
// ---------------------------------------------------------------------------

test('DISPOSE: cleans still-active reactions once; turn finally does NOT double-delete', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  let settle
  const gate = new Promise((resolve) => { settle = resolve })
  r.cfg.onEvent = async () => { await gate; return { reply: 'after dispose' } }
  const pending = r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_dispose')))
  await nextTurn()
  assert.equal(r.lifecycle.activeReactionCount(), 1)
  await r.lifecycle.dispose()
  assert.equal(r.channel.deleteCalls.length, 1, 'dispose removed the active reaction')
  assert.equal(r.lifecycle.activeReactionCount(), 0)
  settle()
  assert.deepEqual(await pending, { reply: 'after dispose' }, 'turn outcome still intact')
  assert.equal(r.channel.deleteCalls.length, MAX_REACTION_DELETE_CALLS_PER_TURN, 'turn finally did not delete again')
  // dispose with nothing active is a no-op.
  await r.lifecycle.dispose()
  assert.equal(r.channel.deleteCalls.length, 1)
})

// --- shared rigs (stub reaction channel + production-shaped bridge facade) ---
const botIdentity = { openId: BOT_OPEN_ID, name: 'my-bot' }

/** Stub reaction channel: records create/delete calls, allocates reaction ids. */
function reactionChannel({ failCreate = false, failDelete = false, journal } = {}) {
  let seq = 0
  const createCalls = []
  const deleteCalls = []
  const authBomb = { response: { headers: { authorization: 'Bearer secret-token' } } }
  return {
    createCalls,
    deleteCalls,
    on() {},
    rawClient: {
      im: {
        messageReaction: {
          create: async (payload) => {
            createCalls.push(payload)
            journal?.push('create')
            if (failCreate) throw Object.assign(new Error('reaction create failed'), authBomb)
            seq += 1
            return { code: 0, data: { reaction_id: `rid_${seq}` } }
          },
          delete: async (payload) => {
            deleteCalls.push(payload)
            journal?.push('delete')
            if (failDelete) throw new Error('reaction delete failed')
            return { code: 0, data: {} }
          },
        },
      },
    },
  }
}

/** Normalize a fixture envelope through the REAL SDK normalize(). */
async function toSdkMessage(envelope) {
  const { normalize } = await import('@larksuite/channel')
  return normalize(flattenV2Event(envelope), { botIdentity, includeRaw: true })
}

/** Clone a fixture with a FRESH create_time (reaction staleness guard) and id. */
function fresh(envelope, messageId, ageMs = 0) {
  const ts = String(Date.now() - ageMs)
  const clone = structuredClone(envelope)
  clone.header = { ...clone.header, event_id: `evt_${messageId}`, create_time: ts }
  clone.event.message = { ...clone.event.message, message_id: messageId, create_time: ts }
  return clone
}

/** Bridge-level rig with the production wiring shape (see buildFeishuHandle). */
function rig({ enabled = true, failCreate = false, failDelete = false, config = {} } = {}) {
  const journal = []
  const channel = reactionChannel({ failCreate, failDelete, journal })
  const logs = []
  const log = (level, ...args) => logs.push([level, ...args])
  const lifecycle = createProcessingReactionLifecycle({ channel, log })
  const cfg = {
    onEvent: null,
    ingressGate: null,
    requireMentionInGroup: true,
    processingReactionEnabled: enabled,
    ...config,
  }
  const handle = createBridgeHandler({
    resolveBotIdentity: () => botIdentity,
    config: bridgeConfigWithProcessingReaction(cfg, lifecycle),
    reply: async () => {},
    log,
  })
  return { channel, cfg, handle, lifecycle, logs, journal }
}

// ---------------------------------------------------------------------------
// admission boundary — dropped/rejected messages never gain a reaction
// ---------------------------------------------------------------------------

test('UNBOUND (gate reject): create=0 delete=0, receipt path unchanged', async () => {
  const r = rig({})
  const receipts = []
  r.cfg.ingressGate = async () => ({ allowed: false, reason: 'unbound' })
  r.cfg.onEvent = async () => { throw new Error('must not run') }
  const handle = createBridgeHandler({
    resolveBotIdentity: () => botIdentity,
    config: bridgeConfigWithProcessingReaction(r.cfg, r.lifecycle),
    reply: async () => { receipts.push('receipt') },
    log: () => {},
  })
  await handle(await toSdkMessage(fresh(p2pTextEvent, 'om_unbound')))
  assert.equal(receipts.length, 1)
  assert.equal(r.channel.createCalls.length, 0)
  assert.equal(r.channel.deleteCalls.length, 0)
})

test('SELF-ECHO (bot sender): create=0 delete=0', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  r.cfg.onEvent = async () => { throw new Error('must not run') }
  await r.handle(await toSdkMessage(fresh(botEchoEvent, 'om_echo')))
  assert.equal(r.channel.createCalls.length, 0)
  assert.equal(r.channel.deleteCalls.length, 0)
})

test('GATE ABSENT: fail-closed drop, create=0 delete=0', async () => {
  const r = rig({})
  r.cfg.onEvent = async () => { throw new Error('must not run') }
  await r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_nogate')))
  assert.equal(r.channel.createCalls.length, 0)
  assert.equal(r.channel.deleteCalls.length, 0)
})

test('NO-MENTION DROP (requireMentionInGroup=true): create=0 delete=0', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  r.cfg.onEvent = async () => { throw new Error('must not run') }
  await r.handle(await toSdkMessage(fresh(groupUnmentionedEvent, 'om_nomention')))
  assert.equal(r.channel.createCalls.length, 0)
  assert.equal(r.channel.deleteCalls.length, 0)
})

test('BOUND NO-MENTION (requireMentionInGroup=false): admitted, create=1 delete=1', async () => {
  const r = rig({ config: { requireMentionInGroup: false } })
  const forwarded = []
  r.cfg.ingressGate = async (ev) => { forwarded.push(ev.conversationId); return { allowed: true } }
  r.cfg.onEvent = async (ev) => ({ reply: 'group answer' })
  const result = await r.handle(await toSdkMessage(fresh(groupUnmentionedEvent, 'om_bound_group')))
  assert.deepEqual(result, { reply: 'group answer' })
  assert.equal(forwarded.length, 1)
  assert.equal(r.channel.createCalls.length, MAX_REACTION_CREATE_CALLS_PER_TURN)
  assert.equal(r.channel.deleteCalls.length, MAX_REACTION_DELETE_CALLS_PER_TURN)
})

// ---------------------------------------------------------------------------
// duplicate SDK event — the SDK safety pipeline drops it before the seam
// ---------------------------------------------------------------------------

test('DUPLICATE SDK EVENT: SeenCache drops the redelivery, reaction added exactly once', async () => {
  const channel = reactionChannel()
  const lifecycle = createProcessingReactionLifecycle({ channel, log: () => {} })
  const cfg = {
    processingReactionEnabled: true,
    ingressGate: async () => ({ allowed: true }),
    onEvent: async () => ({ reply: 'once' }),
  }
  const bridge = createBridgeHandler({
    resolveBotIdentity: () => botIdentity,
    config: bridgeConfigWithProcessingReaction(cfg, lifecycle),
    reply: async () => {},
    log: () => {},
  })
  const sdk = realSdkChannel({ onMessage: bridge })
  const envelope = fresh(p2pTextEvent, 'om_dup')
  await dispatchEnvelope(sdk, envelope)
  await nextTurn()
  await dispatchEnvelope(sdk, envelope) // identical event_id + message_id
  await nextTurn()
  await nextTurn()
  sdk.safety.dispose()
  assert.equal(channel.createCalls.length, 1, 'duplicate redelivery gained no second reaction')
  assert.equal(channel.deleteCalls.length, 1)
})

// ---------------------------------------------------------------------------
// non-regression — args/outcome pass-through, live config, topic continuity
// ---------------------------------------------------------------------------

test('PASS-THROUGH: wrapper forwards the exact ingress object + handler ctx, preserves outcomes', async () => {
  const r = rig({})
  r.cfg.ingressGate = async () => ({ allowed: true })
  const seen = []
  const sentinelResult = { reply: 'unchanged', agentId: 'agt_x', status: 'completed' }
  r.cfg.onEvent = async (ev, ctx) => { seen.push([ev, ctx]); return sentinelResult }
  const msg = await toSdkMessage(fresh(p2pTextEvent, 'om_passthrough'))
  const result = await r.handle(msg)
  assert.equal(seen.length, 1)
  assert.equal(typeof seen[0][1]?.classify?.forward, 'boolean', 'bridge handler ctx preserved')
  assert.equal(result, sentinelResult, 'outcome object identity preserved')
  assert.equal(r.channel.createCalls.length, 1)
  assert.equal(r.channel.deleteCalls.length, 1)
})

test('LIVE CONFIG: enabling/disabling takes effect per event (no restart)', async () => {
  const r = rig({ enabled: false })
  r.cfg.ingressGate = async () => ({ allowed: true })
  r.cfg.onEvent = async () => ({ reply: 'ok' })
  await r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_off')))
  assert.equal(r.channel.createCalls.length, 0)
  r.cfg.processingReactionEnabled = true
  await r.handle(await toSdkMessage(fresh(p2pTextEvent, 'om_on')))
  assert.equal(r.channel.createCalls.length, 1)
  assert.equal(r.channel.deleteCalls.length, 1)
})

test('TOPIC CONTINUITY: bound topic message with requireMentionInGroup=false keeps identity + gains reaction', async () => {
  const r = rig({ config: { requireMentionInGroup: false } })
  const convIds = []
  r.cfg.ingressGate = async (ev) => { convIds.push(ev.conversationId); return { allowed: true } }
  r.cfg.onEvent = async (ev) => ({ reply: `topic:${ev.threadId ?? ''}` })
  const envelope = fresh(groupUnmentionedEvent, 'om_topic_msg')
  envelope.event.message.thread_id = 'omt_topic_1'
  envelope.event.message.root_id = 'om_topic_root'
  const result = await r.handle(await toSdkMessage(envelope))
  assert.deepEqual(result, { reply: 'topic:omt_topic_1' })
  assert.match(convIds[0], /:topic:omt_topic_1$/, 'topic conversation identity unchanged')
  assert.equal(r.channel.createCalls[0].path.message_id, 'om_topic_msg')
  assert.equal(r.channel.deleteCalls.length, 1)
})

test('MOUNT: buildFeishuHandle wires the facade, exposes disposeProcessingReactions, setCallback keeps the wrap', async () => {
  const channel = reactionChannel()
  const registered = {}
  channel.on = (handlers) => { Object.assign(registered, handlers) }
  channel.getBotIdentity = () => botIdentity
  const cfg = {
    onEvent: null,
    ingressGate: async () => ({ allowed: true }),
    requireMentionInGroup: false,
    processingReactionEnabled: true,
    onStatus: null,
  }
  const handle = buildFeishuHandle({ channel, cfg, log: () => {}, connect: async () => {} })
  assert.equal(typeof registered.message, 'function', 'message handler registered on the channel')
  assert.equal(typeof handle.disposeProcessingReactions, 'function')

  const turns = []
  handle.setCallback(async (ev) => { turns.push(ev.messageId); return { reply: 'x' } })

  // Drive the REGISTERED production handler (channel.on('message')) with a
  // real SDK-normalized message — same path the live connection takes.
  await registered.message(await toSdkMessage(fresh(groupUnmentionedEvent, 'om_mount')))
  assert.deepEqual(turns, ['om_mount'])
  assert.equal(channel.createCalls.length, 1)
  assert.equal(channel.deleteCalls.length, 1)

  await handle.disposeProcessingReactions()
  assert.equal(channel.deleteCalls.length, 1, 'dispose is a no-op when nothing is active')
})
