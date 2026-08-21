#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(SCRIPT_DIR, '..')
const EXPECTED_TEST_APP_SHA256 = '57350f752227fdb435306a277dcfcb7fbc110877ef33d6a4d346cb47c552a592'
const TEST_APP_CREDS = process.env.FEISHU_FINAL_CANARY_CREDS
  ?? '/private/tmp/pr27-test-app-canary-20260821/feishu-test-app-creds.json'
const HARNESS = process.env.DSH_HARNESS_ROOT
  ?? '/private/tmp/dsh-harness-rc5-pr27-audit'
const CODEX_PLUGIN_SOURCE = '/private/tmp/dsh-gpt56-subscription-experiment/plugin-home/profiles/headless/node_modules/dsh-codex'
const CODEX_AUTH_SOURCE = join(homedir(), '.dsh', '.openai-codex-auth.json')
const PROVIDER = process.env.FEISHU_FINAL_CANARY_PROVIDER ?? 'zai'
const MODEL = process.env.FEISHU_FINAL_CANARY_MODEL ?? 'glm-5.3'
const RUN_KIND = process.env.FEISHU_FINAL_CANARY_RUN_KIND ?? 'primary'
const STATE = process.env.FEISHU_FINAL_CANARY_STATE
if (typeof STATE !== 'string' || STATE === '') throw new Error('FEISHU_FINAL_CANARY_STATE is required')
const RUN_MATRIX = Object.freeze({
  primary: Object.freeze({ provider: 'zai', model: 'glm-5.3', plugin: null, pluginVersion: null }),
  fallback: Object.freeze({ provider: 'openai-codex', model: 'gpt-5.6-luna', plugin: 'dsh-codex', pluginVersion: '0.2.3' }),
})
const expectedRoute = RUN_MATRIX[RUN_KIND]
if (expectedRoute === undefined) throw new Error('RUN_KIND must be primary or fallback')
if (PROVIDER !== expectedRoute.provider || MODEL !== expectedRoute.model) {
  throw new Error('provider/model does not match the frozen run-kind route')
}

for (const key of [
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy',
  'ALL_PROXY', 'all_proxy', 'NODE_USE_ENV_PROXY',
]) delete process.env[key]

const gitOutput = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
const CANDIDATE_HEAD = gitOutput(WORKTREE, ['rev-parse', 'HEAD'])
const candidateTree = gitOutput(WORKTREE, ['rev-parse', 'HEAD^{tree}'])
const candidateTrackedStatus = gitOutput(WORKTREE, ['status', '--porcelain', '--untracked-files=no'])
const candidateDriverBlob = gitOutput(WORKTREE, ['rev-parse', 'HEAD:scripts/feishu-phase-a-final-canary.mjs'])
const executedDriverBlob = gitOutput(WORKTREE, ['hash-object', 'scripts/feishu-phase-a-final-canary.mjs'])
const harnessCommit = gitOutput(HARNESS, ['rev-parse', 'HEAD'])
const harnessTree = gitOutput(HARNESS, ['rev-parse', 'HEAD^{tree}'])
const harnessTrackedStatus = gitOutput(HARNESS, ['status', '--porcelain', '--untracked-files=no'])
if (candidateTrackedStatus !== '') throw new Error('candidate tracked tree is dirty')
if (candidateDriverBlob !== executedDriverBlob) throw new Error('executed canary driver differs from candidate HEAD blob')
if (harnessTrackedStatus !== '') throw new Error('frozen Harness tracked tree is dirty')
if (harnessCommit !== 'a12bb03c6861969985f066bfbf0cb7e5dd5ac567') throw new Error('unexpected Harness commit')

const { composeProductionRuntime } = await import(pathToFileURL(join(WORKTREE, 'packages/production-runtime/src/compose.js')))
const { resolveProductionLayout } = await import(pathToFileURL(join(WORKTREE, 'packages/production-runtime/src/paths.js')))
const { makeV2PreboundIngressGate } = await import(pathToFileURL(join(WORKTREE, 'packages/production-runtime/src/v2-ingress-gate.js')))
const { AgentProcess } = await import(pathToFileURL(join(WORKTREE, 'packages/agent-router/src/process.js')))
const { buildReplyTarget } = await import(pathToFileURL(join(WORKTREE, 'packages/feishu-connector/src/core.js')))
const { safeInspect } = await import(pathToFileURL(join(WORKTREE, 'packages/feishu-connector/src/log-redaction.js')))
const { LarkChannel } = await import(pathToFileURL(join(
  WORKTREE,
  'packages/feishu-connector/node_modules/@larksuite/channel/dist/index.mjs',
)))
const GROUP = process.env.FEISHU_FINAL_CANARY_GROUP
const P2P_CHAT = process.env.FEISHU_FINAL_CANARY_P2P
if (typeof GROUP !== 'string' || GROUP === '' || typeof P2P_CHAT !== 'string' || P2P_CHAT === '') {
  throw new Error('FEISHU_FINAL_CANARY_GROUP and FEISHU_FINAL_CANARY_P2P are required')
}
const AGENT_ID = 'agt_final-canary'
const NO_MENTION_WINDOW_MS = Number(process.env.FEISHU_FINAL_CANARY_NO_MENTION_MS ?? 20_000)
const creds = JSON.parse(readFileSync(TEST_APP_CREDS, 'utf8'))

const hashText = (value) => createHash('sha256').update(value).digest('hex')
if (hashText(creds.appId ?? '') !== EXPECTED_TEST_APP_SHA256
    || typeof creds.appSecret !== 'string' || creds.appSecret === '') {
  throw new Error('refusing non-dedicated or empty test-App credential')
}
const stableId = (value) => typeof value === 'string' && value !== ''
  ? hashText(`feishu-phase-a-final-canary/v1\0${value}`).slice(0, 24)
  : null
const productionConfigPath = join(homedir(), '.openclaw', 'openclaw.json')
if (!existsSync(productionConfigPath)) throw new Error('production App identity source unavailable for isolation comparison')
const productionConfig = JSON.parse(readFileSync(productionConfigPath, 'utf8'))
const productionAppId = productionConfig?.channels?.feishu?.appId
if (typeof productionAppId !== 'string' || productionAppId === '' || productionAppId === creds.appId) {
  throw new Error('dedicated test App is not independently isolated from production App identity')
}
const fileSha256 = (path) => hashText(readFileSync(path))
const dataValue = (value, key) => {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined
  } catch {
    return undefined
  }
}
const KNOWN_ERROR_CLASSES = Object.freeze([
  'account_quota_exhausted',
  'provider_unavailable',
  'no_adapter',
  'transport',
  'timeout',
  'not_connected',
])
const errorClass = (error) => {
  for (const key of ['class', 'code', 'status']) {
    const value = dataValue(error, key)
    if (typeof value === 'string') {
      const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      const known = KNOWN_ERROR_CLASSES.find((candidate) => normalized === candidate
        || normalized.startsWith(`${candidate}_`))
      return known ?? `opaque_${hashText(value).slice(0, 16)}`
    }
    if (typeof value === 'number') {
      return [429, 500, 502, 503, 504].includes(value)
        ? `http_${value}`
        : `opaque_${hashText(`${value}`).slice(0, 16)}`
    }
  }
  return 'unknown'
}

if (process.env.FEISHU_FINAL_CANARY_VALIDATE_ONLY === '1') {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    candidateHead: CANDIDATE_HEAD,
    runKind: RUN_KIND,
    provider: PROVIDER,
    model: MODEL,
    dedicatedAppIdHash: stableId(creds.appId),
    productionAppIdHash: stableId(productionAppId),
    dedicatedAndProductionAppDiffer: productionAppId !== creds.appId,
    importsResolved: true,
  })}\n`)
  process.exit(0)
}

if (existsSync(STATE)) throw new Error(`refusing reused canary state: ${STATE}`)
mkdirSync(STATE, { recursive: false, mode: 0o700 })

const originalStdoutWrite = process.stdout.write.bind(process.stdout)
const emitOwned = (value) => originalStdoutWrite(`${JSON.stringify(value)}\n`)
let emergencyHandler = async (error, origin) => {
  emitOwned({ observation: {
    name: 'FATAL_PRECOMPOSE_ERROR',
    ok: false,
    at: new Date().toISOString(),
    origin,
    errorClass: errorClass(error),
  } })
  rmSync(STATE, { recursive: true, force: true })
  delete process.env.ZAI_API_KEY
  process.exitCode = 1
}
process.on('uncaughtException', (error) => void emergencyHandler(error, 'uncaughtException'))
process.on('unhandledRejection', (reason) => void emergencyHandler(reason, 'unhandledRejection'))
let secretDisclosureMatches = 0
let nonStringConsoleValues = 0
let noMentionDropLogCount = 0
function captureRuntimeLog(args) {
  const inspected = []
  for (const arg of args) {
    if (typeof arg === 'string') {
      secretDisclosureMatches += arg.split(creds.appSecret).length - 1
    } else {
      nonStringConsoleValues += 1
      const diagnostic = safeInspect(arg, { secrets: [] })
      secretDisclosureMatches += diagnostic.split(creds.appSecret).length - 1
    }
    inspected.push(safeInspect(arg, { secrets: [creds.appSecret] }))
  }
  const line = inspected.join(' ')
  if (line.includes('ordinary no-mention message dropped')) noMentionDropLogCount += 1
  // Runtime logs may contain human text or raw IDs. They are deliberately not
  // emitted or persisted; only the counters above cross into evidence.
}
function interceptWrite(chunk, encoding, callback) {
  captureRuntimeLog([chunk])
  const done = typeof encoding === 'function' ? encoding : callback
  if (typeof done === 'function') queueMicrotask(done)
  return true
}
process.stdout.write = interceptWrite
process.stderr.write = interceptWrite
console.log = (...args) => captureRuntimeLog(args)
console.warn = (...args) => captureRuntimeLog(args)
console.error = (...args) => captureRuntimeLog(args)
const runtimeLog = {
  log: (...args) => captureRuntimeLog(args),
  warn: (...args) => captureRuntimeLog(args),
  error: (...args) => captureRuntimeLog(args),
}

let sdkConnectCallsObserved = 0
let sdkWebSocketConstructionsObserved = 0
const originalSdkConnect = LarkChannel.prototype.connect
const originalSdkConnectWebSocket = LarkChannel.prototype.connectWebSocket
LarkChannel.prototype.connect = function observedConnect(...args) {
  sdkConnectCallsObserved += 1
  return originalSdkConnect.apply(this, args)
}
LarkChannel.prototype.connectWebSocket = function observedConnectWebSocket(...args) {
  sdkWebSocketConstructionsObserved += 1
  return originalSdkConnectWebSocket.apply(this, args)
}

const layout = resolveProductionLayout(STATE)
for (const dir of [join(STATE, 'bindings'), layout.homesRoot, layout.workspacesRoot, layout.controlDir]) {
  mkdirSync(dir, { recursive: true, mode: 0o700 })
}
writeFileSync(layout.agentsConfig, `${JSON.stringify({
  version: 1,
  defaultAgentId: AGENT_ID,
  agents: [{ id: AGENT_ID, name: 'Phase A Final Canary' }],
}, null, 2)}\n`, { mode: 0o600 })

if (PROVIDER === 'openai-codex') {
  writeFileSync(layout.agentModelOverrides, `${JSON.stringify({
    version: 1,
    overrides: {
      [AGENT_ID]: {
        provider: 'openai-codex',
        model: 'gpt-5.6-luna',
        plugin: 'dsh-codex',
        pluginVersion: '0.2.3',
        providerEnv: {
          HTTP_PROXY: 'http://127.0.0.1:7890',
          HTTPS_PROXY: 'http://127.0.0.1:7890',
          NO_PROXY: 'localhost,127.0.0.1,::1',
          NODE_USE_ENV_PROXY: '1',
        },
      },
    },
  }, null, 2)}\n`, { mode: 0o600 })
}

const now = new Date().toISOString()
const initialConversations = [P2P_CHAT, GROUP]
const bindings = Object.fromEntries(initialConversations.map((conversationId) => {
  const key = `feishu:${conversationId}`
  return [key, {
    channelConversationId: key,
    activeAgentId: AGENT_ID,
    activeSessionId: 'main',
    workspace: null,
    updatedAt: now,
  }]
}))
writeFileSync(layout.bindingsStore, `${JSON.stringify({
  version: 1,
  bindings,
  lastSessions: {},
  freshSessions: {},
}, null, 2)}\n`, { mode: 0o600 })

const agentHome = join(layout.homesRoot, AGENT_ID)
const agentWorkspace = join(layout.workspacesRoot, AGENT_ID)
mkdirSync(agentHome, { recursive: true, mode: 0o700 })
mkdirSync(agentWorkspace, { recursive: true, mode: 0o700 })
if (PROVIDER === 'openai-codex') {
  mkdirSync(join(agentHome, 'profiles', 'node_modules'), { recursive: true, mode: 0o700 })
  cpSync(CODEX_PLUGIN_SOURCE, join(agentHome, 'profiles', 'node_modules', 'dsh-codex'), { recursive: true })
  symlinkSync(CODEX_AUTH_SOURCE, join(agentHome, '.openai-codex-auth.json'))
}
writeFileSync(join(agentHome, '.credentials.yaml'), '# isolated canary credentials are injected in memory only\n', { mode: 0o600 })
writeFileSync(join(agentHome, 'settings.yaml'), `llm-pi-ai:
  providers:
    zai:
      apiKeyEnv: ZAI_API_KEY
      models:
        - id: glm-5.3
agent-default-model:
  provider: ${PROVIDER}
  model: ${MODEL}
agent-presets:
  default: cordis-smart
permission:
  defaultPreset: danger-full-access
`, { mode: 0o600 })
writeFileSync(join(agentWorkspace, 'AGENTS.md'), `# Isolated Phase A final canary

Reply concisely and preserve the FA32 marker.
For FA32 DUPLICATE LONG, run exactly \`sleep 20\`, then reply exactly FA32 DUPLICATE LONG COMPLETE.
For all other FA32 prompts, reply with the marker followed by COMPLETE.
Do not access production services, production credentials, or other workspaces.
`, { mode: 0o600 })

const openclaw = JSON.parse(readFileSync(join(homedir(), '.openclaw', 'openclaw.json'), 'utf8'))
const zaiKey = openclaw?.models?.providers?.zai?.apiKey
if (typeof zaiKey !== 'string' || zaiKey === '') throw new Error('isolated ZAI credential source unavailable')
process.env.ZAI_API_KEY = zaiKey
process.env.DSH_HARNESS_ROOT = HARNESS
process.env.DSH_AGENT_PROVIDER = PROVIDER
process.env.DSH_AGENT_MODEL = MODEL
process.env.DSH_AGENT_MAX_TOKENS = '2048'

const evidenceFile = join(layout.controlDir, 'final-canary-evidence.jsonl')
const rows = []
const record = (name, ok, detail = {}) => {
  const row = { name, ok, at: new Date().toISOString(), ...detail }
  rows.push(row)
  writeFileSync(evidenceFile, `${JSON.stringify(row)}\n`, { flag: 'a', mode: 0o600 })
  emitOwned({ observation: row })
  return row
}
const bindingSnapshot = () => {
  const stat = statSync(layout.bindingsStore)
  return { hash: fileSha256(layout.bindingsStore), size: stat.size, mtimeMs: stat.mtimeMs }
}
const sameBinding = (left, right) => left.hash === right.hash
  && left.size === right.size
  && left.mtimeMs === right.mtimeMs

const providerArtifact = RUN_KIND === 'fallback'
  ? {
      plugin: expectedRoute.plugin,
      pluginVersion: JSON.parse(readFileSync(join(CODEX_PLUGIN_SOURCE, 'package.json'), 'utf8')).version,
      pluginPackageHash: fileSha256(join(CODEX_PLUGIN_SOURCE, 'package.json')),
    }
  : { plugin: null, pluginVersion: null, pluginPackageHash: null }
if (providerArtifact.pluginVersion !== expectedRoute.pluginVersion) {
  throw new Error('fallback provider plugin version does not match frozen route')
}

const metrics = {
  rawLive: 0,
  rawLocalReplay: 0,
  gate: 0,
  router: 0,
  agentTurns: 0,
  agentTurnActive: 0,
  outbound: 0,
  replies: 0,
  sdkErrors: 0,
}
const processes = []
class ObservedAgentProcess extends AgentProcess {
  constructor(options) {
    super(options)
    processes.push(this)
    const routeMatches = this.provider === expectedRoute.provider && this.model === expectedRoute.model
    record('AGENT_PROCESS_CONSTRUCTED', routeMatches, {
      provider: this.provider,
      model: this.model,
      expectedProvider: expectedRoute.provider,
      expectedModel: expectedRoute.model,
      routeMatches,
      plugin: providerArtifact.plugin,
      pluginVersion: providerArtifact.pluginVersion,
      pluginPackageHash: providerArtifact.pluginPackageHash,
      agentIdHash: stableId(this.agentId),
    })
    if (!routeMatches) throw new Error('resolved AgentProcess route differs from frozen run-kind route')
  }
  spawn() {
    super.spawn()
    record('AGENT_PROCESS_SPAWNED', Number.isInteger(this.pid), {
      provider: this.provider,
      model: this.model,
    })
    return this
  }
  async turn(sessionId, text, context) {
    metrics.agentTurns += 1
    metrics.agentTurnActive += 1
    const turnIndex = metrics.agentTurns
    const scenario = classify(text)
    record('AGENT_TURN_STARTED', true, {
      index: turnIndex,
      scenario,
      sessionId,
      bindingContextHash: stableId(context?.bindingContext),
      provider: this.provider,
      model: this.model,
    })
    try {
      const result = await super.turn(sessionId, text, context)
      record('AGENT_TURN_FINISHED', true, {
        index: turnIndex,
        scenario,
        provider: this.provider,
        model: this.model,
        replyPresent: typeof result?.reply === 'string' && result.reply.length > 0,
      })
      return result
    } catch (error) {
      record('AGENT_TURN_FINISHED', false, {
        index: turnIndex,
        scenario,
        provider: this.provider,
        model: this.model,
        errorClass: errorClass(error),
      })
      throw error
    } finally {
      metrics.agentTurnActive -= 1
    }
  }
}

let runtime
let fatalStopping = false
emergencyHandler = async (error, origin) => {
  if (fatalStopping) return
  fatalStopping = true
  record('FATAL_RUNTIME_ERROR', false, { origin, errorClass: errorClass(error) })
  try {
    await runtime?.stop()
  } catch {
    // Best-effort shutdown after a fatal canary failure.
  }
  rmSync(STATE, { recursive: true, force: true })
  delete process.env.ZAI_API_KEY
  process.exitCode = 1
}

runtime = await composeProductionRuntime({
  layout,
  feishuCredsPath: TEST_APP_CREDS,
  globalRoute: { provider: PROVIDER, model: MODEL },
  processFactory: (options) => new ObservedAgentProcess(options),
  productApi: { enabled: false, port: 0 },
  notificationIngress: { enabled: false, port: 0 },
  catchup: false,
  log: runtimeLog,
})
const channel = runtime.feishu._channel
let localReplayActive = false
let topicScenario = null
let createdThread = null
const rawMeta = new Map()
const noMentionBaselines = new Map()

const rawSend = channel.send.bind(channel)
channel.send = async (to, input, opts) => {
  metrics.outbound += 1
  const result = await rawSend(to, input, opts)
  record('SDK_OUTBOUND_SENT', typeof result?.messageId === 'string' && result.messageId !== '', {
    index: metrics.outbound,
    messageIdHash: stableId(result?.messageId),
    targetHash: stableId(typeof to === 'string' ? to : ''),
    replyToHash: stableId(opts?.replyTo),
    replyInThread: opts?.replyInThread === true,
  })
  if (topicScenario !== null && topicScenario.outbound === null && opts?.replyTo === topicScenario.ingressMessageId) {
    topicScenario.outbound = {
      messageId: result?.messageId ?? null,
      parentId: opts?.replyTo ?? null,
      target: typeof to === 'string' ? to : null,
      replyInThread: opts?.replyInThread === true,
    }
  }
  return result
}
const rawReply = runtime.feishu.reply.bind(runtime.feishu)
runtime.feishu.reply = async (...args) => {
  const result = await rawReply(...args)
  metrics.replies += 1
  return result
}

const rawMessageOf = (payload) => payload?.event?.message ?? payload?.message ?? null
const getMessageId = (payload) => rawMessageOf(payload)?.message_id ?? payload?.header?.event_id ?? null
channel.onRawEvent('im.message.receive_v1', (payload) => {
  if (localReplayActive) metrics.rawLocalReplay += 1
  else metrics.rawLive += 1
  const rawMessage = rawMessageOf(payload)
  const messageId = getMessageId(payload)
  const serialized = JSON.stringify(payload)
  const mentions = Array.isArray(rawMessage?.mentions) ? rawMessage.mentions : null
  if (!localReplayActive && typeof messageId === 'string') {
    rawMeta.set(messageId, {
      rawSha256: hashText(serialized),
      mentionsPresent: mentions !== null,
      mentionsCount: mentions?.length ?? null,
      rawBotMentions: mentions === null
        ? null
        : mentions.filter((mention) => mention?.id?.open_id === channel.getBotIdentity()?.openId).length,
      contentHasAtAllPlaceholder: typeof rawMessage?.content === 'string' && /@_all\b/.test(rawMessage.content),
    })
  }
  if (!localReplayActive && serialized.includes('FA32 NO MENTION') && typeof messageId === 'string') {
    const baseline = {
      startedAt: Date.now(),
      metrics: { ...metrics },
      dropLogs: noMentionDropLogCount,
      binding: bindingSnapshot(),
      rawMentionCount: mentions?.length ?? null,
      messageId,
    }
    noMentionBaselines.set(messageId, baseline)
    setTimeout(() => {
      const after = { ...metrics }
      const afterBinding = bindingSnapshot()
      const deltas = {
        sdkHandler: after.rawLive - baseline.metrics.rawLive,
        ingressGate: after.gate - baseline.metrics.gate,
        router: after.router - baseline.metrics.router,
        agentTurn: after.agentTurns - baseline.metrics.agentTurns,
        rejectionReceipt: after.outbound - baseline.metrics.outbound,
        reply: after.replies - baseline.metrics.replies,
      }
      const dropLogDelta = noMentionDropLogCount - baseline.dropLogs
      const zeroDeltas = Object.values(deltas).every((value) => value === 0)
      record('NO_MENTION_DROP_WINDOW', zeroDeltas && dropLogDelta === 1 && sameBinding(baseline.binding, afterBinding), {
        messageIdHash: stableId(messageId),
        observationWindowMs: Date.now() - baseline.startedAt,
        configuredWindowMs: NO_MENTION_WINDOW_MS,
        before: {
          sdkHandler: baseline.metrics.rawLive,
          ingressGate: baseline.metrics.gate,
          router: baseline.metrics.router,
          agentTurn: baseline.metrics.agentTurns,
          rejectionReceipt: baseline.metrics.outbound,
          reply: baseline.metrics.replies,
        },
        after: {
          sdkHandler: after.rawLive,
          ingressGate: after.gate,
          router: after.router,
          agentTurn: after.agentTurns,
          rejectionReceipt: after.outbound,
          reply: after.replies,
        },
        deltas,
        sdkHandlerCounterSource: 'SDK raw-event observer; current event included before baseline',
        dropLogDelta,
        rawMentionCount: baseline.rawMentionCount,
        bindingBefore: baseline.binding,
        bindingAfter: afterBinding,
        bindingHashUnchanged: baseline.binding.hash === afterBinding.hash,
        bindingSizeUnchanged: baseline.binding.size === afterBinding.size,
        bindingMtimeUnchanged: baseline.binding.mtimeMs === afterBinding.mtimeMs,
      })
    }, NO_MENTION_WINDOW_MS)
  }
})

channel.on('error', (error) => {
  metrics.sdkErrors += 1
  record('SDK_PUBLIC_ERROR', false, { errorClass: errorClass(error) })
})
const realGate = makeV2PreboundIngressGate({
  router: runtime.router,
  workspaceBootstrap: runtime.ctx.get('workspaceBootstrap'),
  log: runtimeLog,
})
runtime.feishu.setIngressGate(async (...args) => {
  metrics.gate += 1
  return realGate(...args)
})

async function tenantToken() {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ app_id: creds.appId, app_secret: creds.appSecret }),
  })
  const body = await response.json()
  if (!response.ok || typeof body.tenant_access_token !== 'string') throw new Error('test-App token request failed')
  return body.tenant_access_token
}
async function fetchMessageMeta(messageId) {
  const token = await tenantToken()
  const response = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(messageId)}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const body = await response.json()
  if (!response.ok || body.code !== 0) return { ok: false }
  const item = body.data?.items?.[0]
  return {
    ok: item !== undefined,
    messageId: item?.message_id ?? messageId,
    chatId: item?.chat_id ?? null,
    rootId: item?.root_id ?? null,
    parentId: item?.parent_id ?? null,
    threadId: item?.thread_id ?? null,
  }
}
async function fetchMessageMetaEventually(messageId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const meta = await fetchMessageMeta(messageId)
    if (meta.ok && meta.threadId) return meta
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000))
  }
  return fetchMessageMeta(messageId)
}

function classify(text) {
  if (typeof text !== 'string') return 'OTHER'
  for (const marker of [
    'FA32 PRIMARY',
    'FA32 GROUP',
    'FA32 P2P',
    'FA32 ATALL',
    'FA32 TOPIC',
    'FA32 DUPLICATE LONG',
    'FA32 THREAD FOLLOWUP',
  ]) if (text.includes(marker)) return marker
  return 'OTHER'
}

runtime.feishu.setCallback(async (ingress) => {
  metrics.router += 1
  const scenario = classify(ingress.text)
  const before = { metrics: { ...metrics }, binding: bindingSnapshot() }
  const bindingKey = `feishu:${ingress.conversationId}`
  const binding = runtime.router.getBinding(bindingKey)
  const platformMeta = rawMeta.get(ingress.messageId) ?? null
  const mentionAll = (ingress.mentions ?? []).some((mention) => mention?.type === 'all')
  const mentionedBot = (ingress.mentions ?? []).some((mention) => mention?.type === 'bot')
  const expectedChatType = {
    'FA32 PRIMARY': 'group',
    'FA32 GROUP': 'group',
    'FA32 P2P': 'p2p',
    'FA32 ATALL': 'group',
    'FA32 TOPIC': 'thread',
    'FA32 DUPLICATE LONG': 'group',
    'FA32 THREAD FOLLOWUP': 'thread',
  }[scenario]
  const placementMatches = expectedChatType === undefined || ingress.chatType === expectedChatType
  const botMentionRequired = [
    'FA32 PRIMARY',
    'FA32 GROUP',
    'FA32 TOPIC',
    'FA32 DUPLICATE LONG',
    'FA32 THREAD FOLLOWUP',
  ].includes(scenario)
  const mentionPlacementMatches = scenario === 'FA32 ATALL'
    ? mentionAll && !mentionedBot
    : scenario === 'FA32 P2P'
      ? !mentionAll && !mentionedBot
      : botMentionRequired
        ? mentionedBot && !mentionAll
        : true
  record('ROUTER_INGRESS', binding !== undefined && placementMatches && mentionPlacementMatches, {
    scenario,
    messageIdHash: stableId(ingress.messageId),
    conversationIdHash: stableId(ingress.conversationId),
    chatType: ingress.chatType,
    expectedChatType: expectedChatType ?? null,
    placementMatches,
    mentionPlacementMatches,
    senderSelfSent: ingress.sender?.selfSent === true,
    mentioned: ingress.mentioned === true,
    mentionAll,
    mentionedBot,
    bindingHit: binding !== undefined,
    bindingAgentIdHash: stableId(binding?.activeAgentId),
    bindingSession: binding?.activeSessionId ?? null,
  })
  if (scenario === 'FA32 ATALL') {
    const normalizedAllEntryPresent = (ingress.mentions ?? [])
      .some((mention) => mention?.key === '@_all' && mention?.type === 'all')
    const rawBotAbsencePreserved = platformMeta?.mentionsPresent === false
      ? platformMeta?.rawBotMentions === null
      : platformMeta?.rawBotMentions === 0
    record('ATALL_MENTION_METADATA', mentionAll && !mentionedBot
      && platformMeta?.contentHasAtAllPlaceholder === true
      && normalizedAllEntryPresent
      && rawBotAbsencePreserved, {
      mentionAll,
      mentionedBot,
      rawMentionsPresent: platformMeta?.mentionsPresent ?? null,
      rawMentionsCount: platformMeta?.mentionsCount ?? null,
      rawBotMentions: platformMeta?.rawBotMentions ?? null,
      rawBotAbsencePreserved,
      rawContentHasAtAllPlaceholder: platformMeta?.contentHasAtAllPlaceholder ?? null,
      normalizedAllEntryPresent,
    })
  }
  if (scenario === 'FA32 TOPIC') {
    topicScenario = {
      ingressMessageId: ingress.messageId,
      ingressChatId: ingress.chatId,
      ingressRootId: ingress.rootMsgId,
      ingressThreadId: ingress.threadId,
      outbound: null,
    }
  }

  let duplicateReplay
  if (scenario === 'FA32 DUPLICATE LONG') {
    const exactRaw = ingress.raw
    const messageId = ingress.messageId
    duplicateReplay = new Promise((resolveReplay) => {
      setTimeout(async () => {
        const lockEntry = channel.safety.lock.locks.get(messageId)
        const leaseHeld = lockEntry !== undefined
          && channel.safety.lock.currentEntry(lockEntry.lease) !== undefined
        const seenBeforeSettle = await channel.safety.seenCache.has(messageId)
        const counts = { ...metrics }
        localReplayActive = true
        try {
          await channel.dispatcher.invoke(exactRaw, { needCheck: false })
        } finally {
          localReplayActive = false
        }
        await new Promise((resolveImmediate) => setImmediate(resolveImmediate))
        const rawHashEqual = hashText(JSON.stringify(exactRaw)) === platformMeta?.rawSha256
        const routerDeltaDuringReplay = metrics.router - counts.router
        const agentTurnDeltaDuringReplay = metrics.agentTurns - counts.agentTurns
        record('PENDING_TURN_EXACT_REPLAY', leaseHeld
          && rawHashEqual
          && seenBeforeSettle === false
          && routerDeltaDuringReplay === 0
          && agentTurnDeltaDuringReplay === 0
          && metrics.agentTurnActive === 1, {
          messageIdHash: stableId(messageId),
          rawHashEqual,
          processingLeaseStillHeld: leaseHeld,
          seenBeforeSettle,
          routerDeltaDuringReplay,
          agentTurnDeltaDuringReplay,
          agentTurnActive: metrics.agentTurnActive,
        })
        resolveReplay()
      }, 3_000)
    })
  }

  const outcome = await runtime.router.route(ingress)
  if (duplicateReplay) await duplicateReplay
  await new Promise((resolveWait) => setTimeout(resolveWait, 1_000))
  const after = { metrics: { ...metrics }, binding: bindingSnapshot() }
  const scenarioDeltas = {
    router: after.metrics.router - before.metrics.router + 1,
    agentTurn: after.metrics.agentTurns - before.metrics.agentTurns,
    reply: after.metrics.replies - before.metrics.replies,
    outbound: after.metrics.outbound - before.metrics.outbound,
  }
  const outcomeErrorClass = outcome?.error === undefined ? null : errorClass(outcome.error)
  const primaryIntegrity = placementMatches
    && mentionPlacementMatches
    && binding?.activeAgentId === AGENT_ID
    && binding?.activeSessionId === 'main'
    && scenarioDeltas.router === 1
    && scenarioDeltas.agentTurn === 1
    && scenarioDeltas.reply === 1
    && scenarioDeltas.outbound === 1
    && sameBinding(before.binding, after.binding)
  const allowedPrimaryFailure = scenario === 'FA32 PRIMARY'
    && ['account_quota_exhausted', 'provider_unavailable'].includes(outcomeErrorClass)
    && primaryIntegrity
  const successfulTurn = outcome?.error === undefined
    && placementMatches
    && mentionPlacementMatches
    && binding?.activeAgentId === AGENT_ID
    && binding?.activeSessionId === 'main'
    && scenarioDeltas.router === 1
    && scenarioDeltas.agentTurn === 1
    && scenarioDeltas.reply === 1
    && scenarioDeltas.outbound === 1
    && sameBinding(before.binding, after.binding)
  record('SCENARIO_SETTLED', allowedPrimaryFailure || successfulTurn, {
    scenario,
    messageIdHash: stableId(ingress.messageId),
    conversationIdHash: stableId(ingress.conversationId),
    provider: PROVIDER,
    model: MODEL,
    routerDelta: scenarioDeltas.router,
    agentTurnDelta: scenarioDeltas.agentTurn,
    replyDelta: scenarioDeltas.reply,
    outboundDelta: scenarioDeltas.outbound,
    placementMatches,
    bindingUnchanged: sameBinding(before.binding, after.binding),
    outcomeError: outcome?.error !== undefined,
    outcomeErrorClass,
    primaryIntegrity,
    allowedPrimaryFailure,
    activeAgentIdHash: stableId(binding?.activeAgentId),
    activeSessionId: binding?.activeSessionId ?? null,
  })

  if (scenario === 'FA32 DUPLICATE LONG') {
    const messageId = ingress.messageId
    const bindingAtReturn = bindingSnapshot()
    setTimeout(async () => {
      const seenAfterSettle = await channel.safety.seenCache.has(messageId)
      const processingLeaseReleased = channel.safety.lock.locks.get(messageId) === undefined
      const bindingUnchanged = sameBinding(bindingAtReturn, bindingSnapshot())
      record('POST_SETTLE_SEEN_CACHE', seenAfterSettle && processingLeaseReleased && bindingUnchanged, {
        messageIdHash: stableId(messageId),
        seenCacheMarkedAfterSettle: seenAfterSettle,
        processingLeaseReleased,
        bindingUnchanged,
      })
    }, 500)
  }
  if (scenario === 'FA32 TOPIC' && topicScenario !== null) {
    const snapshot = { ...topicScenario }
    topicScenario = null
    setTimeout(async () => {
      try {
        const [ingressMeta, outboundMeta] = await Promise.all([
          fetchMessageMeta(snapshot.ingressMessageId),
          snapshot.outbound?.messageId ? fetchMessageMeta(snapshot.outbound.messageId) : Promise.resolve(null),
        ])
        const pass = ingressMeta?.ok === true
          && outboundMeta?.ok === true
          && ingressMeta.chatId === outboundMeta.chatId
          && ingressMeta.rootId === outboundMeta.rootId
          && ingressMeta.threadId !== null
          && ingressMeta.threadId === outboundMeta.threadId
          && outboundMeta.parentId === snapshot.ingressMessageId
        record('TOPIC_TARGET_EQUALITY', pass, {
          ingressMessageIdHash: stableId(snapshot.ingressMessageId),
          outboundMessageIdHash: stableId(snapshot.outbound?.messageId),
          sameChat: ingressMeta?.ok && outboundMeta?.ok ? ingressMeta.chatId === outboundMeta.chatId : null,
          sameRoot: ingressMeta?.ok && outboundMeta?.ok ? ingressMeta.rootId === outboundMeta.rootId : null,
          sameThread: ingressMeta?.ok && outboundMeta?.ok
            ? ingressMeta.threadId !== null && ingressMeta.threadId === outboundMeta.threadId
            : null,
          replyParentIsIngressMessage: outboundMeta?.ok ? outboundMeta.parentId === snapshot.ingressMessageId : null,
          escapedToGroupTimeline: outboundMeta?.ok ? outboundMeta.threadId === null : null,
        })
      } catch (error) {
        record('TOPIC_TARGET_EQUALITY', false, { errorClass: errorClass(error) })
      }
    }, 1_500)
  }
  if (scenario === 'FA32 THREAD FOLLOWUP') {
    record('CREATE_THREAD_FOLLOWUP_CONTINUITY', createdThread !== null
      && binding?.activeAgentId === AGENT_ID
      && binding?.activeSessionId === 'main'
      && ingress.threadId === createdThread.threadId
      && sameBinding(createdThread.bindingSnapshot, before.binding)
      && sameBinding(createdThread.bindingSnapshot, after.binding), {
      createdThreadIdHash: stableId(createdThread?.threadId),
      ingressThreadIdHash: stableId(ingress.threadId),
      threadIdEqual: ingress.threadId === createdThread?.threadId,
      activeAgentIdHash: stableId(binding?.activeAgentId),
      activeSessionId: binding?.activeSessionId ?? null,
      creationBinding: createdThread?.bindingSnapshot ?? null,
      beforeBindingMatchesCreation: createdThread !== null
        && sameBinding(createdThread.bindingSnapshot, before.binding),
      afterBindingMatchesCreation: createdThread !== null
        && sameBinding(createdThread.bindingSnapshot, after.binding),
      bindingUnchanged: sameBinding(before.binding, after.binding),
    })
  }
  return outcome
})

await runtime.start()
const botIdentityResolved = Boolean(channel.getBotIdentity()?.openId)
const rawWsClientInstancesObserved = channel.rawWsClient === undefined ? 0 : 1
const runtimeReady = runtime.feishu.status() === 'connected'
  && botIdentityResolved
  && sdkConnectCallsObserved === 1
  && sdkWebSocketConstructionsObserved === 1
  && rawWsClientInstancesObserved === 1
  && productionAppId !== creds.appId
  && secretDisclosureMatches === 0
  && nonStringConsoleValues === 0
record('RUNTIME_READY', runtimeReady, {
  candidateHead: CANDIDATE_HEAD,
  candidateTree,
  feishuConnectorTree: gitOutput(WORKTREE, ['rev-parse', 'HEAD:packages/feishu-connector']),
  canaryDriverBlob: candidateDriverBlob,
  executedDriverBlob,
  driverBlobMatchesHead: candidateDriverBlob === executedDriverBlob,
  candidateTrackedClean: gitOutput(WORKTREE, ['status', '--porcelain', '--untracked-files=no']) === '',
  runKind: RUN_KIND,
  provider: PROVIDER,
  model: MODEL,
  expectedPlugin: expectedRoute.plugin,
  expectedPluginVersion: expectedRoute.pluginVersion,
  harnessCommit,
  harnessTree,
  harnessVersion: JSON.parse(readFileSync(join(HARNESS, 'package.json'), 'utf8')).version,
  harnessTrackedClean: gitOutput(HARNESS, ['status', '--porcelain', '--untracked-files=no']) === '',
  connectionStatus: runtime.feishu.status(),
  botIdentityResolved,
  sdkChannelServicesObserved: runtime.feishu && channel ? 1 : 0,
  sdkConnectCallsObserved,
  sdkWebSocketConstructionsObserved,
  rawWsClientInstancesObserved,
  sdkConnectPromisePresent: channel.connectPromise !== undefined,
  dedicatedAppIdHash: stableId(creds.appId),
  productionAppIdHash: stableId(productionAppId),
  appIdentityCompared: true,
  dedicatedAndProductionAppDiffer: productionAppId !== creds.appId,
  credentialSourceType: 'dedicated-non-production-test-app-file',
  binding: bindingSnapshot(),
  secretDisclosureMatches,
  nonStringConsoleValues,
})
chmodSync(evidenceFile, 0o600)

const groupTarget = buildReplyTarget({ conversationId: GROUP, chatId: GROUP, channel: 'group' }).directChat()
if (RUN_KIND === 'primary') {
  await runtime.feishu.reply(groupTarget, 'FA32 PRIMARY provider provenance run is ready. Please @ the bot with: FA32 PRIMARY')
} else {
  const root = await runtime.feishu.reply(groupTarget, 'FA32 fresh create-thread root. A thread will be opened under this message.')
  const threadTarget = buildReplyTarget({
    conversationId: GROUP,
    chatId: GROUP,
    channel: 'group',
    rootMsgId: root.messageId,
  }).asThread()
  const threadMessage = await runtime.feishu.reply(threadTarget,
    'FA32 created thread is ready. In this thread, please @ the bot with FA32 TOPIC, then FA32 THREAD FOLLOWUP.')
  const threadMeta = await fetchMessageMetaEventually(threadMessage.messageId)
  createdThread = threadMeta.ok && threadMeta.threadId ? {
    rootMessageId: root.messageId,
    threadMessageId: threadMessage.messageId,
    threadId: threadMeta.threadId,
  } : null
  if (createdThread !== null) {
    await runtime.router.resolveChannelConversation({
      channel: 'feishu',
      externalId: `${GROUP}:topic:${createdThread.threadId}`,
      sessionId: 'main',
      workspace: null,
    })
    createdThread.bindingSnapshot = bindingSnapshot()
  }
  const createdThreadBinding = createdThread === null
    ? undefined
    : runtime.router.getBinding(`feishu:${GROUP}:topic:${createdThread.threadId}`)
  record('CREATE_THREAD_READY', createdThread !== null
    && threadMeta.rootId === root.messageId
    && threadMeta.chatId === GROUP
    && createdThreadBinding?.activeAgentId === AGENT_ID
    && createdThreadBinding?.activeSessionId === 'main', {
    rootMessageIdHash: stableId(root.messageId),
    threadMessageIdHash: stableId(threadMessage.messageId),
    threadIdHash: stableId(threadMeta.threadId),
    rootIdParity: threadMeta.rootId === root.messageId,
    sameChat: threadMeta.chatId === GROUP,
    threadAnchored: threadMeta.threadId !== null,
    preboundToAgentMain: createdThreadBinding?.activeAgentId === AGENT_ID
      && createdThreadBinding?.activeSessionId === 'main',
    activeAgentIdHash: stableId(createdThreadBinding?.activeAgentId),
    activeSessionId: createdThreadBinding?.activeSessionId ?? null,
    binding: bindingSnapshot(),
  })
  await runtime.feishu.reply(groupTarget,
    'FA32 fallback run ready. Please send: (1) group @bot FA32 GROUP; (2) P2P FA32 P2P; '
    + '(3) @all only FA32 ATALL; (4) ordinary group no mention FA32 NO MENTION, then wait 25 seconds; '
    + '(5) in the created thread @bot FA32 TOPIC then @bot FA32 THREAD FOLLOWUP; '
    + '(6) group @bot FA32 DUPLICATE LONG.')
}

const fallbackScenarios = [
  'FA32 GROUP',
  'FA32 P2P',
  'FA32 ATALL',
  'FA32 TOPIC',
  'FA32 DUPLICATE LONG',
  'FA32 THREAD FOLLOWUP',
]
const latestRow = (name, scenario) => rows.findLast((row) => row.name === name
  && (scenario === undefined || row.scenario === scenario))
function evaluateFinalGate() {
  const checks = []
  const requireRow = (label, name, scenario) => {
    const row = latestRow(name, scenario)
    checks.push({ label, present: row !== undefined, ok: row?.ok === true })
  }
  requireRow('runtime-ready', 'RUNTIME_READY')
  requireRow('resolved-provider-route', 'AGENT_PROCESS_CONSTRUCTED')
  if (RUN_KIND === 'primary') {
    requireRow('primary-allowed-failure', 'SCENARIO_SETTLED', 'FA32 PRIMARY')
  } else {
    requireRow('create-thread-ready', 'CREATE_THREAD_READY')
    for (const scenario of fallbackScenarios) requireRow(`scenario:${scenario}`, 'SCENARIO_SETTLED', scenario)
    requireRow('atall-metadata', 'ATALL_MENTION_METADATA')
    requireRow('no-mention-window', 'NO_MENTION_DROP_WINDOW')
    requireRow('topic-target-equality', 'TOPIC_TARGET_EQUALITY')
    requireRow('duplicate-pending-replay', 'PENDING_TURN_EXACT_REPLAY')
    requireRow('duplicate-post-settle', 'POST_SETTLE_SEEN_CACHE')
    requireRow('create-thread-followup', 'CREATE_THREAD_FOLLOWUP_CONTINUITY')
  }
  const complete = checks.every((check) => check.present)
  const cleanAtEnd = complete
    ? gitOutput(WORKTREE, ['status', '--porcelain', '--untracked-files=no']) === ''
      && gitOutput(HARNESS, ['status', '--porcelain', '--untracked-files=no']) === ''
      && gitOutput(WORKTREE, ['rev-parse', 'HEAD']) === CANDIDATE_HEAD
      && gitOutput(WORKTREE, ['rev-parse', 'HEAD^{tree}']) === candidateTree
      && gitOutput(HARNESS, ['rev-parse', 'HEAD']) === harnessCommit
      && gitOutput(HARNESS, ['rev-parse', 'HEAD^{tree}']) === harnessTree
    : null
  const policyOk = secretDisclosureMatches === 0 && nonStringConsoleValues === 0
  const oneWebSocketOk = sdkConnectCallsObserved === 1 && sdkWebSocketConstructionsObserved === 1
  const sdkErrorRows = rows.filter((row) => row.name === 'SDK_PUBLIC_ERROR')
  const primaryScenario = latestRow('SCENARIO_SETTLED', 'FA32 PRIMARY')
  const sdkErrorsOk = RUN_KIND === 'primary'
    ? sdkErrorRows.length === 1 && sdkErrorRows[0].errorClass === primaryScenario?.outcomeErrorClass
    : sdkErrorRows.length === 0
  const pass = complete
    && checks.every((check) => check.ok)
    && cleanAtEnd === true
    && policyOk
    && oneWebSocketOk
    && sdkErrorsOk
  return {
    complete,
    pass,
    checks,
    cleanAtEnd,
    policyOk,
    oneWebSocketOk,
    sdkErrorsOk,
    sdkErrorCount: sdkErrorRows.length,
    secretDisclosureMatches,
    nonStringConsoleValues,
  }
}

const heartbeat = setInterval(() => {
  emitOwned({ heartbeat: {
    candidateHead: CANDIDATE_HEAD,
    runKind: RUN_KIND,
    provider: PROVIDER,
    model: MODEL,
    status: runtime.feishu.status(),
    metrics,
    scenarios: rows.filter((row) => row.name === 'SCENARIO_SETTLED').map((row) => row.scenario),
    finalGate: evaluateFinalGate(),
  } })
}, 15_000)

let stopping = false
let completionWatcher
let timeoutHandle
const stop = async (signal, requestedSuccess = false) => {
  if (stopping) return
  stopping = true
  clearInterval(heartbeat)
  clearInterval(completionWatcher)
  clearTimeout(timeoutHandle)
  const finalGate = evaluateFinalGate()
  const pass = requestedSuccess && finalGate.pass
  record('FINAL_GATE', pass, {
    signal,
    runKind: RUN_KIND,
    provider: PROVIDER,
    model: MODEL,
    ...finalGate,
  })
  const statusBeforeStop = runtime.feishu.status()
  const finalBindingSnapshot = bindingSnapshot()
  await runtime.stop()
  rmSync(layout.homesRoot, { recursive: true, force: true })
  if (RUN_KIND === 'primary') rmSync(join(STATE, 'bindings'), { recursive: true, force: true })
  const sessionStateScrubbed = !existsSync(layout.homesRoot)
  const rawBindingsRetainedForRollback = RUN_KIND === 'fallback' && existsSync(layout.bindingsStore)
  record('EPHEMERAL_SESSION_STATE_SCRUBBED', sessionStateScrubbed, {
    homesRootRemoved: sessionStateScrubbed,
    credentialCopyPersisted: false,
    codexAuthWasSymlinkOnly: RUN_KIND === 'fallback',
    rawBindingsRetainedForRollback,
    retentionPurpose: rawBindingsRetainedForRollback ? 'ephemeral live rollback handoff only' : null,
  })
  record('RUNTIME_STOP', pass && sessionStateScrubbed, {
    signal,
    runKind: RUN_KIND,
    provider: PROVIDER,
    model: MODEL,
    statusBeforeStop,
    metrics,
    scenarios: rows.filter((row) => row.name === 'SCENARIO_SETTLED').map((row) => row.scenario),
    binding: finalBindingSnapshot,
    secretDisclosureMatches,
    nonStringConsoleValues,
    evidenceSha256BeforeStopRow: fileSha256(evidenceFile),
  })
  delete process.env.ZAI_API_KEY
  process.exitCode = pass && sessionStateScrubbed ? 0 : 1
}
completionWatcher = setInterval(() => {
  const gate = evaluateFinalGate()
  if (gate.pass) void stop('COMPLETE', true)
}, 1_000)
process.on('SIGINT', () => void stop('SIGINT', false))
process.on('SIGTERM', () => void stop('SIGTERM', false))
timeoutHandle = setTimeout(
  () => void stop('TIMEOUT', false),
  Number(process.env.FEISHU_FINAL_CANARY_TIMEOUT_MS ?? 45 * 60_000),
)
