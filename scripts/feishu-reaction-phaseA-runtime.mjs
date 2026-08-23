#!/usr/bin/env node
/**
 * FEISHU_PROCESSING_REACTION — Phase A long-lived detached canary runtime.
 *
 * Boots the FULL production composition (connector + router + agent
 * processes) from THIS worktree's head, on the DEDICATED non-production
 * test App cli_aa03fbf9a4789d2d, with:
 *   - FEISHU_PROCESSING_REACTION_ENABLED=true   (the feature under test)
 *   - FEISHU_REQUIRE_MENTION_IN_GROUP=false     (bound no-mention admission)
 *   - FEISHU_AUTO_MENTION_TRIGGER_SENDER=false  (reply must NOT auto-@)
 *
 * Bindings (all explicit prebound, V2 prebound-only ingress gate):
 *   feishu:oc_326b43e5777dccb90948f1202f86f2e2                       -> agt_reaction_canary (P2P)
 *   feishu:oc_89ed845a1bd3b36b55318d0aa06b7bc9                       -> agt_reaction_canary (bound group)
 *   feishu:oc_89ed845a1bd3b36b55318d0aa06b7bc9:topic:omt_19ecc7eccc8f9a43 -> agt_reaction_canary (bound topic)
 *   feishu:oc_f41a7267c64deacdcb0dea65099e1dad:topic:omt_19ecdcf4ef4f5b83 -> agt_reaction_fail (failure-test topic)
 *
 * agt_reaction_fail uses a NONEXISTENT zai model -> every turn fails
 * deterministically -> Router failure receipt -> reaction must STILL be
 * cleaned up (§四 error-cleanup canary).
 *
 * This script IDLES waiting for REAL HUMAN inbound messages. It never sends
 * user-visible chat messages itself. Auto-shutdown after AUTO_SHUTDOWN_MS
 * (default 4h). Evidence: sanitized JSONL under <ROOT>/control/.
 * Honesty guards: refuses production app; no secret/token ever logged or
 * persisted; ids stored hashed; message bodies NEVER persisted.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
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
const ROOT = process.env.PR_RUNTIME_ROOT
  ?? '/private/tmp/feishu-processing-reaction-phaseA/runtime-root'
const HARNESS = process.env.DSH_HARNESS_ROOT ?? '/private/tmp/dsh-harness-rc5-pr27-audit'
const AUTO_SHUTDOWN_MS = Number(process.env.PR_AUTO_SHUTDOWN_MS ?? 4 * 60 * 60 * 1000)
const HEARTBEAT_MS = 5 * 60 * 1000
const PRODUCTION_APP_IDS = new Set(['cli_a9d7abdf05385cd3'])
const CANARY_AGENT = 'agt_reaction_canary'
const FAIL_AGENT = 'agt_reaction_fail'
const P2P = 'oc_326b43e5777dccb90948f1202f86f2e2'
const GROUP = 'oc_89ed845a1bd3b36b55318d0aa06b7bc9'
const TOPIC = `${GROUP}:topic:omt_19ecc7eccc8f9a43`
const FAIL_TOPIC = 'oc_f41a7267c64deacdcb0dea65099e1dad:topic:omt_19ecdcf4ef4f5b83'

// Feature env — read by composeProductionRuntime at composition time.
process.env.FEISHU_PROCESSING_REACTION_ENABLED = 'true'
process.env.FEISHU_REQUIRE_MENTION_IN_GROUP = 'false'
process.env.FEISHU_AUTO_MENTION_TRIGGER_SENDER = 'false'

const H = (s) => createHash('sha256').update(String(s)).digest('hex')
const short = (s) => (typeof s === 'string' && s !== '' ? H(`pr-reaction-phaseA\0${s}`).slice(0, 16) : null)

const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'))
if (creds.appId !== 'cli_aa03fbf9a4789d2d') {
  throw new Error(`REFUSING: appId is not the dedicated test app (hash ${short(creds.appId)})`)
}
if (PRODUCTION_APP_IDS.has(creds.appId)) throw new Error('REFUSING: production app')
if (!existsSync(HARNESS)) throw new Error(`harness missing: ${HARNESS}`)
if (existsSync(ROOT)) throw new Error(`refusing reused runtime root: ${ROOT}`)

const openclaw = JSON.parse(readFileSync(join(homedir(), '.openclaw', 'openclaw.json'), 'utf8'))
const zaiKey = openclaw?.models?.providers?.zai?.apiKey
if (typeof zaiKey !== 'string' || zaiKey === '') throw new Error('isolated ZAI credential source unavailable')
process.env.ZAI_API_KEY = zaiKey
process.env.DSH_HARNESS_ROOT = HARNESS
process.env.DSH_AGENT_PROVIDER = 'zai'
process.env.DSH_AGENT_MODEL = 'glm-5.3'
process.env.DSH_AGENT_MAX_TOKENS = '2048'

const { composeProductionRuntime } = await import(join(WORKTREE, 'packages/production-runtime/src/compose.js'))
const { resolveProductionLayout } = await import(join(WORKTREE, 'packages/production-runtime/src/paths.js'))
const { AgentProcess } = await import(join(WORKTREE, 'packages/agent-router/src/process.js'))
const { LarkChannel } = await import(join(
  WORKTREE, 'packages/feishu-connector/node_modules/@larksuite/channel/dist/index.mjs'))

const layout = resolveProductionLayout(ROOT)
for (const dir of [join(ROOT, 'bindings'), layout.homesRoot, layout.workspacesRoot, layout.controlDir]) {
  mkdirSync(dir, { recursive: true, mode: 0o700 })
}
const now = new Date().toISOString()
writeFileSync(layout.agentsConfig, `${JSON.stringify({
  version: 1,
  defaultAgentId: CANARY_AGENT,
  agents: [
    { id: CANARY_AGENT, name: 'Reaction Canary Agent' },
    { id: FAIL_AGENT, name: 'Reaction Failure-Test Agent' },
  ],
}, null, 2)}\n`, { mode: 0o600 })

const bindingKeys = {
  [`feishu:${P2P}`]: CANARY_AGENT,
  [`feishu:${GROUP}`]: CANARY_AGENT,
  [`feishu:${TOPIC}`]: CANARY_AGENT,
  [`feishu:${FAIL_TOPIC}`]: FAIL_AGENT,
}
writeFileSync(layout.bindingsStore, `${JSON.stringify({
  version: 1,
  bindings: Object.fromEntries(Object.entries(bindingKeys).map(([key, agentId]) => [key, {
    channelConversationId: key,
    activeAgentId: agentId,
    activeSessionId: 'main',
    workspace: null,
    updatedAt: now,
  }])),
  lastSessions: {},
  freshSessions: {},
}, null, 2)}\n`, { mode: 0o600 })

const settingsYaml = (model) => `llm-pi-ai:
  providers:
    zai:
      apiKeyEnv: ZAI_API_KEY
      models:
        - id: ${model}
agent-default-model:
  provider: zai
  model: ${model}
agent-presets:
  default: cordis-smart
permission:
  defaultPreset: danger-full-access
`
for (const [agentId, model] of [
  [CANARY_AGENT, 'glm-5.3'],
  [FAIL_AGENT, 'glm-nonexistent-canary-failure'], // deterministic per-turn provider failure
]) {
  const agentHome = join(layout.homesRoot, agentId)
  const agentWorkspace = join(layout.workspacesRoot, agentId)
  mkdirSync(agentHome, { recursive: true, mode: 0o700 })
  mkdirSync(agentWorkspace, { recursive: true, mode: 0o700 })
  writeFileSync(join(agentHome, '.credentials.yaml'), '# isolated canary credentials are injected in memory only\n', { mode: 0o600 })
  writeFileSync(join(agentHome, 'settings.yaml'), settingsYaml(model), { mode: 0o600 })
  writeFileSync(join(agentWorkspace, 'AGENTS.md'), agentId === CANARY_AGENT
    ? `# Isolated processing-reaction canary agent

Reply CONCISELY (one or two sentences) in Markdown to every message.
Echo the unique marker in the reply when the message contains one.
Never access production services, production credentials, or other workspaces.
`
    : `# Isolated failure-test agent (intentionally broken model)

This agent's model id does not exist; every turn is EXPECTED to fail with a
provider error. Do not "fix" it. Never access production services.
`, { mode: 0o600 })
}

// Sanitized evidence plane: rows only ever contain hashes, counts, enums.
const evidenceFile = join(layout.controlDir, 'phaseA-runtime-evidence.jsonl')
const rawLog = join(layout.controlDir, 'phaseA-runtime-internal.log')
const record = (name, ok, detail = {}) => {
  const row = { name, ok, at: new Date().toISOString(), ...detail }
  try { writeFileSync(evidenceFile, `${JSON.stringify(row)}\n`, { flag: 'a', mode: 0o600 }) } catch { /* best-effort */ }
}
const redacted = (args) => args.map((a) => {
  const text = typeof a === 'string' ? a : (() => { try { return JSON.stringify(a) } catch { return String(a) } })()
  return text.split(creds.appSecret).join('[REDACTED]').split(zaiKey).join('[REDACTED]')
}).join(' ')
const internal = (tag, ...args) => {
  try { writeFileSync(rawLog, `${new Date().toISOString()} ${tag} ${redacted(args)}\n`, { flag: 'a', mode: 0o600 }) } catch { /* best-effort */ }
}
const runtimeLog = {
  log: (...a) => internal('LOG', ...a),
  warn: (...a) => internal('WARN', ...a),
  error: (...a) => internal('ERROR', ...a),
}

// Per-message reaction call accounting (§五) via the public rawClient surface.
const reactionCalls = { create: 0, delete: 0 }
const perMessageReactionCalls = new Map() // messageIdHash -> {create,delete}
const bump = (messageId, op) => {
  reactionCalls[op] += 1
  const h = short(messageId)
  const row = perMessageReactionCalls.get(h) ?? { create: 0, delete: 0 }
  row[op] += 1
  perMessageReactionCalls.set(h, row)
  record('REACTION_API_CALL', true, { op, msgHash: h, totalCreate: reactionCalls.create, totalDelete: reactionCalls.delete })
}

class ObservedAgentProcess extends AgentProcess {
  async turn(sessionId, text, context) {
    record('AGENT_TURN_STARTED', true, { agentIdHash: short(this.agentId), session: sessionId })
    try {
      const result = await super.turn(sessionId, text, context)
      record('AGENT_TURN_FINISHED', true, { agentIdHash: short(this.agentId), replyPresent: typeof result?.reply === 'string' && result.reply.length > 0 })
      return result
    } catch (error) {
      record('AGENT_TURN_FINISHED', false, { agentIdHash: short(this.agentId), errorClass: String(error?.class ?? error?.code ?? error?.message ?? 'unknown').slice(0, 120) })
      throw error
    }
  }
}

const runtime = await composeProductionRuntime({
  layout,
  feishuCredsPath: CREDS_PATH,
  globalRoute: { provider: 'zai', model: 'glm-5.3' },
  processFactory: (options) => new ObservedAgentProcess(options),
  productApi: { enabled: false, port: 0 },
  notificationIngress: { enabled: false, port: 0 },
  catchup: false,
  log: runtimeLog,
})

const channel = runtime.feishu._channel
const reaction = channel.rawClient?.im?.messageReaction
if (reaction === undefined) throw new Error('rawClient.im.messageReaction surface missing')
const origCreate = reaction.create.bind(reaction)
const origDelete = reaction.delete.bind(reaction)
reaction.create = async (payload) => { bump(payload?.path?.message_id, 'create'); return origCreate(payload) }
reaction.delete = async (payload) => { bump(payload?.path?.message_id, 'delete'); return origDelete(payload) }
const origList = reaction.list?.bind(reaction)
if (origList !== undefined) {
  reaction.list = async (payload) => origList(payload) // observer uses its own channel; passthrough here
}

// Inbound / outbound accounting (§三): hashes + flags only, never bodies.
const inbound = new Set()
channel.onRawEvent('im.message.receive_v1', (payload) => {
  const m = payload?.event?.message ?? payload?.message ?? null
  const id = m?.message_id ?? payload?.header?.event_id ?? null
  if (id === null || inbound.has(id)) return
  inbound.add(id)
  record('INBOUND_MESSAGE', true, {
    msgHash: short(id), chatHash: short(m?.chat_id), msgType: m?.message_type ?? null,
    mentionsCount: Array.isArray(m?.mentions) ? m.mentions.length : 0,
    threadIdHash: short(m?.thread_id), rootIdHash: short(m?.root_id),
  })
})
const rawSend = channel.send.bind(channel)
channel.send = async (to, input, opts) => {
  const result = await rawSend(to, input, opts)
  record('OUTBOUND_SENT', typeof result?.messageId === 'string' && result.messageId !== '', {
    msgHash: short(result?.messageId), targetHash: short(typeof to === 'string' ? to : ''),
    replyToHash: short(opts?.replyTo), replyInThread: opts?.replyInThread === true,
    markdownInput: typeof input === 'object' && input !== null && Object.hasOwn(input, 'markdown'),
    mentionsCount: Array.isArray(opts?.mentions) ? opts.mentions.length : 0,
  })
  return result
}

record('RUNTIME_READY', true, {
  appHash: short(creds.appId), transport: 'websocket',
  processingReactionEnabled: true, requireMentionInGroup: false, autoMentionTriggerSender: false,
  bindings: { p2p: short(P2P), group: short(GROUP), topicHash: short(TOPIC), failTopicHash: short(FAIL_TOPIC) },
  canaryAgent: CANARY_AGENT, failAgent: FAIL_AGENT, harnessHead: 'a12bb03c6861969985f066bfbf0cb7e5dd5ac567',
})

const shutdownAt = Date.now() + AUTO_SHUTDOWN_MS
record('AUTO_SHUTDOWN_SCHEDULED', true, { at: new Date(shutdownAt).toISOString(), ms: AUTO_SHUTDOWN_MS })

const heartbeat = setInterval(() => {
  record('HEARTBEAT', true, {
    inboundTotal: inbound.size, reactionCreate: reactionCalls.create, reactionDelete: reactionCalls.delete,
    autoShutdownAt: new Date(shutdownAt).toISOString(),
  })
}, HEARTBEAT_MS)
const autoShutdown = setTimeout(async () => {
  record('AUTO_SHUTDOWN_FIRE', true, {})
  clearInterval(heartbeat)
  try { await runtime.stop() } catch { /* best-effort */ }
  delete process.env.ZAI_API_KEY
  process.exit(0)
}, AUTO_SHUTDOWN_MS)
autoShutdown.unref?.()
// NOTE: heartbeat intentionally keeps the event loop alive so the detached
// process survives; autoShutdown is the ONLY timer that stops the runtime.

const stop = async (signal) => {
  record('RUNTIME_STOP', true, { signal })
  clearInterval(heartbeat)
  clearTimeout(autoShutdown)
  try { await runtime.stop() } catch { /* best-effort */ }
  delete process.env.ZAI_API_KEY
  process.exit(0)
}
process.on('SIGTERM', () => void stop('SIGTERM'))
process.on('SIGINT', () => void stop('SIGINT'))
process.on('uncaughtException', (e) => { record('FATAL', false, { origin: 'uncaughtException', errorClass: String(e?.code ?? e?.message).slice(0, 120) }); void stop('fatal') })
process.on('unhandledRejection', (e) => { record('FATAL', false, { origin: 'unhandledRejection', errorClass: String(e?.code ?? e?.message).slice(0, 120) }); void stop('fatal') })
record('RUNTIME_IDLE_WAITING_FOR_HUMAN_INPUT', true, {})
