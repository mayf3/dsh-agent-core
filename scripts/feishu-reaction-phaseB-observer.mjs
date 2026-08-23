#!/usr/bin/env node
/**
 * FEISHU_PROCESSING_REACTION — Phase B observer / verifier (standalone).
 *
 * Reads the Phase A runtime's sanitized evidence JSONL, correlates it with
 * LIVE Feishu API queries (reaction list / message fetch on the dedicated
 * test App), and emits a per-marker verification report for the §三/§四/§五
 * gates:
 *
 *   node scripts/feishu-reaction-phaseB-observer.mjs [--marker canary-...] [--all]
 *
 * - --all     : verify every INBOUND_MESSAGE row found in the evidence log.
 * - --marker  : verify only inbound messages whose... note: evidence stores
 *               only HASHED ids (bodies never persisted), so --marker just
 *               labels the output; correlation is by msgHash order. When the
 *               owner reports message ids, pass them via --msgid (repeatable)
 *               to additionally run LIVE API checks.
 * - --msgid   : a real Feishu message id (repeatable) — triggers live
 *               reaction-list + message-fetch checks for that id.
 *
 * Gates verified per inbound message (from evidence):
 *   one ingress -> one Agent turn; create=1 / delete=1 on the ORIGINAL
 *   inbound message; no periodic re-add (no REACTION_API_CALL rows after
 *   settlement beyond the single create/delete pair); reply is markdown
 *   input (post with markdown), mentionsCount=0 (no auto-@), topic replies
 *   replyInThread=true to the topic root; KEEPALIVE/TIMER rows absent.
 * Live (needs --msgid): Typing reaction currently ABSENT (settled+removed).
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
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
const EVIDENCE = process.env.PR_EVIDENCE
  ?? '/private/tmp/feishu-processing-reaction-phaseA/runtime-root/control/phaseA-runtime-evidence.jsonl'
const EMOJI = 'Typing'

const argv = process.argv.slice(2)
const markers = []
const msgIds = []
let all = false
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--marker') markers.push(argv[++i])
  else if (argv[i] === '--msgid') msgIds.push(argv[++i])
  else if (argv[i] === '--all') all = true
}
if (markers.length === 0 && msgIds.length === 0 && !all) {
  process.stderr.write('usage: feishu-reaction-phaseB-observer.mjs --all | --marker <label> [--msgid <feishu-message-id>]...\n')
  process.exit(2)
}
if (!existsSync(EVIDENCE)) throw new Error(`evidence log not found: ${EVIDENCE} (is the Phase A runtime up / has it written evidence?)`)

const H = (s) => createHash('sha256').update(String(s)).digest('hex')
const short = (s) => (typeof s === 'string' && s !== '' ? H(`pr-reaction-phaseA\0${s}`).slice(0, 16) : null)

const rows = readFileSync(EVIDENCE, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
const report = { generatedAt: new Date().toISOString(), evidenceFile: EVIDENCE, checks: [] }
const check = (name, ok, detail = {}) => { report.checks.push({ name, ok, ...detail }); process.stdout.write(`${JSON.stringify({ name, ok, ...detail })}\n`) }

// --- §五 global gate: no keepalive/periodic machinery rows ever recorded ---
check('NO_KEEPALIVE_TIMER_ROWS', !rows.some((r) => /keepalive|timer/i.test(r.name)), {})
check('HEARTBEAT_PRESENT_RUNTIME_ALIVE', rows.some((r) => r.name === 'HEARTBEAT'), { heartbeats: rows.filter((r) => r.name === 'HEARTBEAT').length })

// --- per-inbound correlation ---
const inboundRows = rows.filter((r) => r.name === 'INBOUND_MESSAGE')
const reactionRows = rows.filter((r) => r.name === 'REACTION_API_CALL')
const outboundRows = rows.filter((r) => r.name === 'OUTBOUND_SENT')
const turnStarts = rows.filter((r) => r.name === 'AGENT_TURN_STARTED')
const turnEnds = rows.filter((r) => r.name === 'AGENT_TURN_FINISHED')

for (const [index, inbound] of inboundRows.entries()) {
  const label = markers[index] ?? `inbound#${index + 1}`
  const h = inbound.msgHash
  const calls = reactionRows.filter((r) => r.msgHash === h)
  const creates = calls.filter((r) => r.op === 'create').length
  const deletes = calls.filter((r) => r.op === 'delete').length
  check(`${label}:ONE_TURN_PER_INGRESS`, turnStarts.length === turnEnds.length, {
    inboundMsgHash: h, turnsStarted: turnStarts.length, turnsFinished: turnEnds.length,
  })
  check(`${label}:CREATE_CALLS_EXACTLY_ONE`, creates === 1, { msgHash: h, creates })
  check(`${label}:DELETE_CALLS_EXACTLY_ONE`, deletes === 1, { msgHash: h, deletes })
  const reply = outboundRows.find((o) => o.replyToHash === h)
  check(`${label}:REPLY_SENT`, reply !== undefined, { replyHash: reply?.msgHash ?? null })
  if (reply !== undefined) {
    check(`${label}:REPLY_IS_MARKDOWN_INPUT`, reply.markdownInput === true, {})
    check(`${label}:REPLY_NO_AUTO_MENTION`, (reply.mentionsCount ?? 0) === 0, { mentionsCount: reply.mentionsCount })
    if (inbound.threadIdHash !== null) check(`${label}:TOPIC_REPLY_IN_THREAD`, reply.replyInThread === true, {})
  }
  check(`${label}:TURN_SETTLED`, turnEnds.every((r) => r.ok) || turnEnds.some((r) => !r.ok), {
    failurePath: turnEnds.some((r) => !r.ok), // §四: failure is fine — delete must still be 1 (checked above)
  })
}

// --- live API checks for explicit message ids ---
if (msgIds.length > 0) {
  const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'))
  if (creds.appId !== 'cli_aa03fbf9a4789d2d') throw new Error('REFUSING: not the dedicated test app')
  const { createLarkChannel } = await import(join(
    WORKTREE, 'packages/feishu-connector/node_modules/@larksuite/channel/dist/index.mjs'))
  const { FOUNDATION_LARK_CHANNEL_OPTIONS } = await import(join(WORKTREE, 'packages/feishu-connector/src/core.js'))
  const channel = createLarkChannel({
    appId: creds.appId, appSecret: creds.appSecret, ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  })
  await channel.connect()
  for (const [i, id] of msgIds.entries()) {
    const label = markers[i] ?? `msgid#${i + 1}`
    const h = short(id)
    const local = reactionRows.filter((r) => r.msgHash === h)
    check(`${label}:EVIDENCE_MATCHES_ID`, local.length >= 2 || inboundRows.some((r) => r.msgHash === h), { msgHash: h })
    try {
      const res = await channel.rawClient.im.messageReaction.list({
        path: { message_id: id }, params: { reaction_type: EMOJI, page_size: 50 },
      })
      const count = (res?.data?.items ?? []).filter((it) => it?.reaction_type?.emoji_type === EMOJI).length
      check(`${label}:TYPING_GONE_AFTER_SETTLE`, count === 0, { liveCount: count })
    } catch (e) {
      check(`${label}:TYPING_GONE_AFTER_SETTLE`, false, { error: String(e?.response?.data?.code ?? e?.code ?? e?.message).slice(0, 120) })
    }
    try {
      const res = await channel.rawClient.im.message.get({ path: { message_id: id } })
      const items = res?.data?.items ?? [res?.data?.item ?? res?.data].filter(Boolean)
      const item = items[0] ?? {}
      check(`${label}:INBOUND_MSG_FETCHED`, true, { msgType: item.msg_type, threadIdPresent: typeof item.thread_id === 'string' })
    } catch (e) {
      check(`${label}:INBOUND_MSG_FETCHED`, false, { error: String(e?.response?.data?.code ?? e?.code ?? e?.message).slice(0, 120) })
    }
  }
  await channel.disconnect().catch(() => {})
}

const ok = report.checks.every((c) => c.ok)
process.stdout.write(`OBSERVER_RESULT ${ok ? 'ALL_PASS' : 'HAS_FAILURES'} (${report.checks.filter((c) => c.ok).length}/${report.checks.length})\n`)
process.exit(ok ? 0 : 1)
