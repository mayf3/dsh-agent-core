#!/usr/bin/env node
/**
 * FEISHU_PROCESSING_REACTION live canary (API-based slice, dedicated
 * non-production App ONLY).
 *
 * What this driver can verify autonomously over the REAL Feishu API:
 *   1. LIVE SELF-ECHO: the bot's own outgoing group message echoes back over
 *      the WS connection and the bridge drops it — no reaction is created.
 *   2. LIVE LIFECYCLE ON A REAL MESSAGE: create the frozen `Typing` reaction
 *      on a real message id (the bot's own canary message in the test group),
 *      observe it via im.messageReaction.list WHILE the wrapped turn is
 *      still running, settle the turn, then observe it is GONE.
 *   3. CALL CEILING + NO PERIODIC CALLS: exactly one create and one delete
 *      per turn, and zero additional reaction API calls in a quiet window
 *      after settlement (no keepalive / periodic re-add).
 *
 * What this driver CANNOT do (documented honestly, NOT faked): send an
 * inbound message AS A USER. The checks that require a real user message —
 * reaction on a user's P2P/bound-group/bound-topic message through the full
 * Router turn, live no-mention drop, no-auto-@ reply, controlled Agent
 * failure removal — are NOT executed by this driver.
 *
 * Honesty guards: refuses to run against the production app id; never logs
 * the app secret or Authorization material; writes evidence with hashed ids.
 */

import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

for (const key of [
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy',
  'ALL_PROXY', 'all_proxy', 'NODE_USE_ENV_PROXY',
]) delete process.env[key]

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = join(HERE, '..')

const CREDS_PATH = process.env.PR_CREDS
  ?? '/private/tmp/pr46-ux-final-canary-20260822/feishu-test-app-creds.json'
const CHATS_PATH = process.env.PR_CHATS
  ?? '/private/tmp/pr46-ux-final-canary-20260822/chats.json'
const EVIDENCE_PATH = process.env.PR_EVIDENCE
  ?? '/private/tmp/feishu-processing-reaction-canary/evidence.json'
const PRODUCTION_APP_IDS = new Set(['cli_a9d7abdf05385cd3']) // NEVER touch
const EXPECTED_TEST_APP_IDS = new Set(['cli_aa03fbf9a4789d2d', 'cli_a907e201cf78dbb4'])
const EMOJI = 'Typing'

const H = (s) => createHash('sha256').update(String(s)).digest('hex')
const short = (s) => H(`pr-reaction-canary\0${s}`).slice(0, 16)
const rows = []
const rec = (name, ok, detail = {}) => {
  rows.push({ name, ok, at: new Date().toISOString(), ...detail })
  process.stdout.write(`${JSON.stringify({ name, ok, ...detail })}\n`)
}
const saveEvidence = () => {
  writeFileSync(EVIDENCE_PATH, `${JSON.stringify({ version: 1, rows }, null, 2)}\n`)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'))
if (creds.appId === undefined || typeof creds.appSecret !== 'string' || creds.appSecret === '') {
  throw new Error('test-app creds missing appId/appSecret')
}
if (PRODUCTION_APP_IDS.has(creds.appId)) {
  throw new Error('REFUSING TO RUN: credentials are the PRODUCTION app — canary requires the dedicated non-production app')
}
if (!EXPECTED_TEST_APP_IDS.has(creds.appId)) {
  throw new Error(`unexpected app id hash ${short(creds.appId)} — not a known dedicated test app; refusing`)
}
const chats = JSON.parse(readFileSync(CHATS_PATH, 'utf8'))
const GROUP = process.env.PR_GROUP ?? chats.groupChatId
const P2P = process.env.PR_P2P ?? chats.p2pChatId

const { createLarkChannel } = await import(join(
  WORKTREE, 'packages/feishu-connector/node_modules/@larksuite/channel/dist/index.mjs'))
const { buildFeishuHandle } = await import(join(WORKTREE, 'packages/feishu-connector/src/index.js'))
const { FOUNDATION_LARK_CHANNEL_OPTIONS } = await import(join(WORKTREE, 'packages/feishu-connector/src/core.js'))
const { createProcessingReactionLifecycle, PROCESSING_REACTION_EMOJI_TYPE } = await import(
  join(WORKTREE, 'packages/feishu-connector/src/processing-reaction.js'))

const logger = {
  debug() {},
  info() {},
  warn(...a) { appendFileSync(EVIDENCE_PATH + '.log', `WARN ${a.map(safe).join(' ')}\n`) },
  error(...a) { appendFileSync(EVIDENCE_PATH + '.log', `ERROR ${a.map(safe).join(' ')}\n`) },
}
function safe(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
  return text.split(creds.appSecret).join('[REDACTED]')
}

const channel = createLarkChannel({
  appId: creds.appId,
  appSecret: creds.appSecret,
  ...FOUNDATION_LARK_CHANNEL_OPTIONS,
  logger,
})

// Instrument the PUBLIC rawClient reaction surface (counters only).
const counters = { create: 0, delete: 0, list: 0 }
const errors = []
const reaction = channel.rawClient?.im?.messageReaction
if (reaction === undefined) throw new Error('rawClient.im.messageReaction surface missing on the pinned SDK')
const origCreate = reaction.create.bind(reaction)
const origDelete = reaction.delete.bind(reaction)
const origList = reaction.list?.bind(reaction)
reaction.create = async (payload) => {
  counters.create += 1
  try { return await origCreate(payload) } catch (e) { errors.push(describe('create', e)); throw e }
}
reaction.delete = async (payload) => {
  counters.delete += 1
  try { return await origDelete(payload) } catch (e) { errors.push(describe('delete', e)); throw e }
}
if (origList !== undefined) {
  reaction.list = async (payload) => {
    counters.list += 1
    try { return await origList(payload) } catch (e) { errors.push(describe('list', e)); throw e }
  }
}
function describe(op, error) {
  // Exact API error code + message — the honest "missing scope" report.
  return { op, code: error?.code ?? error?.response?.data?.code, msg: error?.data?.msg ?? error?.response?.data?.msg ?? error?.message }
}

const seenEvents = []
const cfg = {
  onEvent: async (ev) => { seenEvents.push(ev.messageId); return { reply: 'no-op' } },
  ingressGate: async (ev) => ({ allowed: ev.chatId === GROUP || ev.chatId === P2P }),
  requireMentionInGroup: false,
  processingReactionEnabled: true,
  onStatus: null,
  log: () => {},
}
const handle = buildFeishuHandle({ channel, cfg, log: () => {}, connect: () => channel.connect() })
await handle.ready()
rec('CHANNEL_LIVE', true, { appHash: short(creds.appId), transport: 'websocket', groupHash: short(GROUP) })

// ---------------------------------------------------------------------------
// STEP 1 — live self-echo: the bot's own group message must gain NO reaction
// ---------------------------------------------------------------------------
const sent = await handle.reply(
  { kind: 'create', channel: 'group', chatId: GROUP, receiveIdType: 'chat_id', receiveId: GROUP, conversationId: GROUP, replyInThread: false },
  'processing-reaction canary self-echo probe (auto-cleanup follows)',
)
const botMessageId = sent.messageId
await sleep(4000) // WS echo round trip
rec('SELF_ECHO_NO_REACTION', counters.create === 0 && !seenEvents.includes(botMessageId), {
  createCalls: counters.create, echoSeenByBridge: seenEvents.includes(botMessageId),
})

// ---------------------------------------------------------------------------
// STEP 2 — real lifecycle on a REAL message id: add Typing -> present -> settle -> gone
// ---------------------------------------------------------------------------
const lifecycle = createProcessingReactionLifecycle({ channel, log: () => {} })
const listTyping = async (messageId) => {
  if (origList === undefined) return null
  const res = await origList({ path: { message_id: messageId }, params: { reaction_type: EMOJI, page_size: 50 } })
  const items = res?.data?.items ?? []
  return items.filter((item) => item?.reaction_type?.emoji_type === EMOJI).length
}

const settleSignal = { resolve: null }
const turnGate = new Promise((resolve) => { settleSignal.resolve = resolve })
const wrapped = lifecycle.wrapOnEvent(async () => {
  await turnGate
  return { reply: 'turn finished' }
}, cfg)
const turnPromise = wrapped({ messageId: botMessageId, chatId: GROUP, timestamp: Date.now() }, { classify: { forward: true, reason: 'canary' } })
await sleep(2500)
const duringCount = await listTyping(botMessageId)
rec('TYPING_PRESENT_DURING_TURN', duringCount === 1, { duringCount, emoji: EMOJI, msgHash: short(botMessageId) })

settleSignal.resolve()
const outcome = await turnPromise
await sleep(2500)
const afterCount = await listTyping(botMessageId)
rec('TYPING_REMOVED_AFTER_SETTLEMENT', afterCount === 0 && outcome?.reply === 'turn finished', { afterCount })

// ---------------------------------------------------------------------------
// STEP 3 — call ceiling + no periodic calls in a quiet window
// ---------------------------------------------------------------------------
rec('CREATE_CALLS_EXACTLY_ONE', counters.create === 1, { createCalls: counters.create })
rec('DELETE_CALLS_EXACTLY_ONE', counters.delete === 1, { deleteCalls: counters.delete })
const before = { ...counters }
await sleep(8000)
rec('NO_PERIODIC_CALLS', counters.create === before.create && counters.delete === before.delete, {
  createCalls: counters.create, deleteCalls: counters.delete, quietWindowMs: 8000,
})
rec('NO_API_ERRORS', errors.length === 0, { errors })

await handle.disposeProcessingReactions()
await channel.disconnect().catch(() => {})
saveEvidence()
process.stdout.write(`EVIDENCE ${EVIDENCE_PATH}\n`)
process.exit(rows.every((row) => row.ok) ? 0 : 1)
