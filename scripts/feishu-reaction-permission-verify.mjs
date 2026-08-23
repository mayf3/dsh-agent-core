#!/usr/bin/env node
/**
 * FEISHU_PROCESSING_REACTION — Phase A permission verification (dedicated
 * non-production test App ONLY).
 *
 * Real im.messageReaction.create (emoji_type=OnThisTopic? NO — the frozen
 * 'Typing') on a real message id, then real im.messageReaction.delete, on a
 * message the bot itself posts into the isolated canary group. Admission
 * rules are irrelevant here; this verifies ONLY that the owner-granted
 * im:message.reactions:write_only scope actually works on app
 * cli_aa03fbf9a4789d2d.
 *
 * Honesty guards: refuses production app ids; never prints appSecret or
 * tokens; evidence stores hashed ids only.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
const OUT_DIR = process.env.PR_OUT ?? '/private/tmp/feishu-processing-reaction-phaseA'
const GROUP = process.env.PR_GROUP ?? 'oc_89ed845a1bd3b36b55318d0aa06b7bc9'
const PRODUCTION_APP_IDS = new Set(['cli_a9d7abdf05385cd3'])
const EMOJI = 'Typing'

const H = (s) => createHash('sha256').update(String(s)).digest('hex')
const short = (s) => H(`pr-reaction-perm-verify\0${s}`).slice(0, 16)

const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'))
if (creds.appId !== 'cli_aa03fbf9a4789d2d') {
  throw new Error(`REFUSING: appId is not the dedicated test app (hash ${short(creds.appId)})`)
}
if (PRODUCTION_APP_IDS.has(creds.appId)) throw new Error('REFUSING: production app')
mkdirSync(OUT_DIR, { recursive: true })

const { createLarkChannel } = await import(join(
  WORKTREE, 'packages/feishu-connector/node_modules/@larksuite/channel/dist/index.mjs'))
const { FOUNDATION_LARK_CHANNEL_OPTIONS } = await import(join(WORKTREE, 'packages/feishu-connector/src/core.js'))

const logger = { debug() {}, info() {}, warn() {}, error() {} }
const channel = createLarkChannel({
  appId: creds.appId,
  appSecret: creds.appSecret,
  ...FOUNDATION_LARK_CHANNEL_OPTIONS,
  logger,
})
await channel.connect()

const rows = []
const rec = (name, ok, detail = {}) => {
  rows.push({ name, ok, at: new Date().toISOString(), ...detail })
  process.stdout.write(`${JSON.stringify({ name, ok, ...detail })}\n`)
}
const apiCode = (e) => e?.code ?? e?.response?.data?.code ?? null
const apiMsg = (e) => e?.data?.msg ?? e?.response?.data?.msg ?? e?.message ?? null

// 1. bot posts a probe message (reaction TARGET)
const sent = await channel.send(GROUP, { text: 'processing-reaction permission verify probe (reaction target; auto-cleaned)' })
const messageId = sent?.messageId
rec('PROBE_MESSAGE_SENT', typeof messageId === 'string' && messageId !== '', { msgHash: short(messageId) })

// 2. real create
let createOk = false
let createErr = null
let reactionId = null
try {
  const result = await channel.rawClient.im.messageReaction.create({ path: { message_id: messageId }, data: { reaction_type: { emoji_type: EMOJI } } })
  reactionId = result?.data?.reaction_id ?? null
  createOk = typeof reactionId === 'string' && reactionId !== ''
} catch (e) { createErr = { code: apiCode(e), msg: apiMsg(e) } }
rec('REACTION_CREATE', createOk, createOk ? { emoji: EMOJI, reactionIdHash: short(reactionId) } : { error: createErr })

// 3. confirm present via list
let present = null
try {
  const res = await channel.rawClient.im.messageReaction.list({
    path: { message_id: messageId }, params: { reaction_type: EMOJI, page_size: 50 },
  })
  present = (res?.data?.items ?? []).filter((i) => i?.reaction_type?.emoji_type === EMOJI).length
} catch (e) { present = `list-error:${apiCode(e)}` }
rec('REACTION_LIST_AFTER_CREATE', present === 1, { presentCount: present })

// 4. real delete
let deleteOk = false
let deleteErr = null
try {
  await channel.rawClient.im.messageReaction.delete({ path: { message_id: messageId, reaction_id: reactionId } })
  deleteOk = true
} catch (e) { deleteErr = { code: apiCode(e), msg: apiMsg(e) } }
rec('REACTION_DELETE', deleteOk, deleteOk ? {} : { error: deleteErr })

// 5. confirm gone
let after = null
try {
  const res = await channel.rawClient.im.messageReaction.list({
    path: { message_id: messageId }, params: { reaction_type: EMOJI, page_size: 50 },
  })
  after = (res?.data?.items ?? []).filter((i) => i?.reaction_type?.emoji_type === EMOJI).length
} catch (e) { after = `list-error:${apiCode(e)}` }
rec('REACTION_LIST_AFTER_DELETE', after === 0, { afterCount: after })

await channel.disconnect().catch(() => {})
const out = join(OUT_DIR, 'permission-evidence.json')
writeFileSync(out, `${JSON.stringify({ version: 1, appHash: short(creds.appId), emoji: EMOJI, rows }, null, 2)}\n`, { mode: 0o600 })
process.stdout.write(`EVIDENCE ${out}\n`)
process.exit(rows.every((r) => r.ok) ? 0 : 1)
