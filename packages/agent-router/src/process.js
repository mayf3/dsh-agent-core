/**
 * @agent-core/agent-router/src/process.js — per-agent DSH process client.
 *
 * Governing authority: AGENT_PROCESS_LIFECYCLE_HARDENING_V2 (accepted,
 * implementation_authority = contracts) — C-001..C-022. This file implements
 * the AgentProcess lifecycle state machine, the four-field deadline model,
 * RPC pending-settlement contracts, turn admission/watermark/exact
 * correlation, the outcome_unknown fence + late reconciliation wiring, the
 * bounded process-evidence ceilings and the shutdown ownership model.
 *
 * Extracted from the process-model benchmark driver into the component the
 * Router / Control Plane owns. One process per Agent: spawns
 * `dsh --profile <agentProfile>` with the agent's own DSH_HOME + workspace,
 * speaks newline-delimited JSON-RPC over stdio (initialize / session/prompt /
 * shutdown — the demo-server protocol), buffers `session.event` /
 * `session.status` notifications, and resolves one "turn" when the whole
 * agent goes idle again.
 *
 * Parent-RPC relay: per-agent plugins can ask the Control Plane to run a
 * Router domain operation. The demo-server emits a `rpc.request` notification
 * on stdout; this client dispatches it to the `onRpcRequest` hook the router
 * installs and answers over stdin with a `rpc.response` request — bounded by
 * one absolute deadline with a fixed response-write reserve (C-005).
 *
 * Result envelope carriers (C-010 closed union): `completed` resolves (a
 * superset of the historical `{reply, ms, promptMs, messageId}` shape);
 * `failed`, `not_admitted` and `outcome_unknown` are carried as STRUCTURED
 * Error throws that expose `.status`, `.reconciliationHandle` and
 * `.evidence` — `outcome_unknown` never degrades to a bare string, and the
 * throw shape preserves the unmodifiable external callers' (scheduler
 * bridge / product entries) catch semantics.
 *
 * Zero DSH imports: only node builtins + the shared provisioning package.
 */

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cliBin } from '../../agent-provisioning/src/index.js'
import { TurnReconciliationStore } from './reconciliation-store.js'

export const RECOGNIZED_PROXY_ENV_KEYS = Object.freeze([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'ALL_PROXY',
  'all_proxy',
  'NODE_USE_ENV_PROXY',
])

/**
 * Spawn configuration for the per-agent DSH child under the TRUSTED
 * credential broker model: the trusted Router parent (deployment uid
 * authsvc/505) runs every Agent child at the NORMAL Agent runtime uid/gid
 * (default 502 — NOT a per-agent OS user).
 *
 * - DSH_AGENT_CHILD_UID / DSH_AGENT_CHILD_GID: target uid/gid. Absent =>
 *   the child inherits the parent's identity (legacy behavior).
 * - DSH_AGENT_SPAWN_HELPER (optional): ABSOLUTE path of a privileged spawn
 *   helper (`<helper> <uid> <gid> <node> <program> <args...>` that
 *   setuids and execs the child, stdio inherited). Required when the parent
 *   cannot setuid directly: only root (or the same uid) can setuid, so a
 *   505 parent needs a one-time-root-bootstrapped setuid helper. When the
 *   helper is absent AND the requested uid differs from the parent's and
 *   the parent is not root, the spawn FAILS LOUD — a child must never
 *   silently run with more privilege than configured.
 *
 * @returns {{ argv: string[], spawnUid?: number, spawnGid?: number }}
 */
export function childSpawnConfig(log = console) {
  const uidRaw = process.env.DSH_AGENT_CHILD_UID
  if (uidRaw === undefined || uidRaw === '') return { argv: [process.execPath] }
  const uid = Number.parseInt(uidRaw, 10)
  // The child gid defaults to the PARENT's effective gid (the runtime user's
  // primary group) — never to the numeric uid, which is usually not a group
  // the process may setgid to (macOS: EPERM).
  const gidRaw = process.env.DSH_AGENT_CHILD_GID
  const gid = gidRaw === undefined || gidRaw === ''
    ? (typeof process.getgid === 'function' ? process.getgid() : uid)
    : Number.parseInt(gidRaw, 10)
  if (!Number.isInteger(uid) || uid < 0 || !Number.isInteger(gid) || gid < 0) {
    throw new Error(`agent-router: invalid DSH_AGENT_CHILD_UID/GID (uid=${uidRaw}, gid=${process.env.DSH_AGENT_CHILD_GID})`)
  }
  const helper = process.env.DSH_AGENT_SPAWN_HELPER
  if (typeof helper === 'string' && helper !== '') {
    log.log?.(`[router] spawn helper ${helper} -> child uid ${uid} gid ${gid}`)
    // <helper> <uid> <gid> <program> <args...> — stdio is inherited through
    // the helper's exec so the JSON-RPC pipes connect straight to the child.
    return { argv: [helper, String(uid), String(gid), process.execPath] }
  }
  log.log?.(`[router] spawn child with uid ${uid} gid ${gid} (direct setuid; requires root or same uid)`)
  return { argv: [process.execPath], spawnUid: uid, spawnGid: gid }
}

/**
 * Fixed TMPDIR every Agent child receives, regardless of what the Router
 * parent's environment carries. Production evidence: the launchd Runtime
 * (uid authsvc/505) gets a per-user TMPDIR (/var/folders/.../T, mode 0700,
 * owner authsvc); the Agent child runs at uid 502 via the spawn helper and
 * cannot even traverse that directory, so @deepseek-ai/dsh-spill-local's
 * mkdtempSync(join(tmpdir(), 'dsh-spill-')) fails EACCES => plugin tree
 * load failure => provider never registers => deliver hangs. The system
 * sticky temp root is the one directory every local uid may create in;
 * mkdtemp still yields a randomly-named 0700 child-uid-owned subdirectory,
 * so the child's temp content stays private. /private/tmp is the canonical
 * macOS spelling of the sticky root (what /tmp symlinks to), avoiding the
 * symlink hop; non-darwin hosts get their equivalent fixed root.
 */
export const AGENT_CHILD_TMPDIR = process.platform === 'darwin' ? '/private/tmp' : '/tmp'

/** Base environment for one agent process (its own home, workspace as cwd). */
export function agentEnv(home, extra = {}, omit = [], providerEnv = {}) {
  const env = {
    ...process.env,
    DSH_HOME: home,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    ...extra,
  }
  // Defense in depth at every spawn: inherited, lowercase-precedence and
  // caller-extra proxy variables are all removed before the validated target
  // providerEnv is injected. A non-target receives an empty providerEnv and
  // therefore has no recognized proxy variable at all.
  for (const name of RECOGNIZED_PROXY_ENV_KEYS) delete env[name]
  Object.assign(env, providerEnv)
  if (env.OPENCODE_GO_API_KEY === undefined) {
    const credentialFile = join(home, '.credentials.yaml')
    if (existsSync(credentialFile)) {
      const match = readFileSync(credentialFile, 'utf8').match(/^OPENCODE_GO_API_KEY:\s*"?([^"\n]+)"?/m)
      if (match !== null) env.OPENCODE_GO_API_KEY = match[1]
    }
  }
  for (const name of omit) delete env[name]
  // Written LAST, after extra/providerEnv/omit: the child's TMPDIR is a
  // fixed runtime property of the uid-502 Agent identity, not configuration.
  // The parent's private 0700 TMPDIR must never cross the uid boundary, and
  // no per-Agent config, model override, caller env param or omit list may
  // override or drop it. The Router parent's own process.env is untouched —
  // this only shapes the child's env object.
  env.TMPDIR = AGENT_CHILD_TMPDIR
  return env
}

/** Redact common OAuth/API token shapes before an error reaches logs/callers. */
export function redactSensitiveText(value) {
  return String(value ?? '')
    .replace(/(["'](?:access_token|refresh_token|id_token|token|authorization|openai_api_key|client_secret)["']\s*:\s*["'])[^"']*(["'])/giu, '$1[REDACTED]$2')
    .replace(/\b(Authorization\s*:\s*)(?:Bearer\s+)?[^\s,;]+/giu, '$1[REDACTED]')
    .replace(/\b(Bearer\s+)[^\s,;]+/giu, '$1[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/gu, '[REDACTED]')
    .replace(/((?:access|refresh|id)[_-]?token|OPENAI_API_KEY|client_secret)\s*[=:]\s*[^\s,;}]+/giu, '$1=[REDACTED]')
}

/** Provider/account failures stay truthful and never trigger route fallback. */
export function classifyProviderError({ code, message } = {}) {
  const text = `${code ?? ''} ${message ?? ''}`.toLowerCase()
  if (/insufficient[_ -]?quota|account[_ -]?quota|quota (?:exhausted|exceeded)|usage limit/u.test(text)) return 'account_quota_exhausted'
  if (/oauth.*(?:expired|revoked)|(?:expired|revoked).*oauth|invalid[_ -]?grant/u.test(text)) return 'oauth_expired_or_revoked'
  if (/credential[_ -]?missing|auth(?:entication)? file.*(?:missing|not found)|provider is not configured/u.test(text)) return 'credential_missing'
  if (/model[_ -]?(?:unavailable|not[_ -]?found)|unknown model|unsupported model/u.test(text)) return 'model_unavailable'
  if (/provider[_ -]?unavailable|service unavailable|econnrefused|enotfound|network.*unavailable/u.test(text)) return 'provider_unavailable'
  if (code === 'SESSION_WORKSPACE_MISMATCH') return code
  return 'provider_runtime_rejection'
}

/**
 * The only provider-error boundary used for both JSON-RPC responses and the
 * asynchronous DSH turn/end reason. It deliberately reads only code/message:
 * arbitrary provider payloads, causes and OAuth objects never cross the
 * Router boundary.
 */
export function sanitizeProviderError(providerError, { agentId, provider, model } = {}) {
  const safeCode = redactSensitiveText(providerError?.code ?? 'provider_error')
  const safeMessage = redactSensitiveText(providerError?.message ?? 'provider request failed')
  const classification = classifyProviderError({ code: safeCode, message: safeMessage })
  const layer = classification === 'account_quota_exhausted' || classification === 'oauth_expired_or_revoked'
    ? 'provider/account'
    : classification === 'model_unavailable'
      ? 'provider/model'
      : classification === 'credential_missing'
        ? 'agent/credential'
        : classification === 'SESSION_WORKSPACE_MISMATCH'
          ? 'session'
        : 'provider'
  return Object.assign(new Error(`${safeCode}: ${safeMessage}`), {
    name: 'ProviderError',
    code: classification,
    class: classification,
    layer,
    agentId,
    provider,
    model,
  })
}

const FAIL_LOUD_PROVIDER_ERRORS = new Set([
  'credential_missing',
  'oauth_expired_or_revoked',
  'provider_unavailable',
  'account_quota_exhausted',
  'model_unavailable',
])

// ---------------------------------------------------------------------------
// AGENT_PROCESS_LIFECYCLE_HARDENING_V2 machinery
// ---------------------------------------------------------------------------

/** CLAUSE-PROC-LIFECYCLE: the only public lifecycle order. */
export const PROCESS_STATES = Object.freeze(['SPAWNING', 'INITIALIZING', 'READY', 'DRAINING', 'EXITED'])

const LEGAL_PROCESS_TRANSITIONS = new Set([
  'SPAWNING->INITIALIZING',
  'SPAWNING->DRAINING',
  'INITIALIZING->READY',
  'INITIALIZING->DRAINING',
  'READY->DRAINING',
  'DRAINING->EXITED',
])

/** CLAUSE-PROC-BOUNDED frozen safety ceilings (count + bytes, per surface). */
export const PROCESS_EVIDENCE_CAPS = Object.freeze({
  MAX_EVENT_RECORDS: 10000,
  MAX_EVENT_BUFFER_BYTES: 8388608,
  MAX_EVENT_RECORD_BYTES: 1048576,
  MAX_STDERR_BYTES: 1048576,
  MAX_CREATION_RECORDS: 256,
  MAX_CREATION_RECORD_BYTES: 4096,
  MAX_STDOUT_PARTIAL_BYTES: 1048576,
  MAX_RPC_FRAME_BYTES: 1048576,
  MAX_PENDING_RPC: 1024,
  MAX_FINAL_ASSISTANT_OUTPUT_BYTES: 1048576,
  MAX_QUEUED_TURNS_PER_PROCESS: 64,
  MAX_QUEUED_PROMPT_BYTES_PER_PROCESS: 4194304,
  MAX_PROMPT_BYTES: 1048576,
  /** Bounded late-receipt correlation tombstones (C-012). */
  MAX_LATE_PROMPT_TOMBSTONES: 256,
})

/** Process-local monotonic clock in ms (C-001: enforcement never reads wall clock). */
export function monotonicNowMs() {
  return Number(process.hrtime.bigint() / 1000000n)
}

const sleep = (ms) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms)
  timer.unref?.()
})

/** C-010 result-envelope carrier shared by every prompt-producing path. */
function envelopeCarrier(status, reconciliationHandle, code, message, extra = {}) {
  const error = new Error(message)
  error.name = 'AgentProcessEnvelopeError'
  error.status = status
  error.envelope = status
  error.reconciliationHandle = reconciliationHandle
  error.code = code
  Object.assign(error, extra)
  return error
}

function fencedRejection(fenceHandle) {
  return envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_TURN_FENCED',
    `agent ${fenceHandle === undefined ? 'process' : 'process'} has an unresolved outcome_unknown turn; new prompt admission is forbidden until termination is proven`, { fencedBy: fenceHandle ?? null })
}

function assertPositiveSafeDeadline(field, value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`AgentProcess: deadline ${field} must be a positive safe integer (got ${JSON.stringify(value)}) — validated fail-loud before spawn`)
  }
}

/**
 * One tracked prompt execution (C-010..C-016): the matcher that incrementally
 * attributes events (by watermark + exact sessionId + receipt messageId +
 * exact turn number), captures the final assistant output as a UTF-8-safe
 * incremental tail, and drives the settle-once outcome machine.
 */
class TurnExecution {
  constructor({ handle, sessionId, mode, watermarkSeq, startMono, deadlines, bindingContext }) {
    this.handle = handle
    this.sessionId = sessionId
    this.mode = mode // 'turn' | 'deliver'
    this.watermarkSeq = watermarkSeq
    this.lastFedSeq = watermarkSeq
    this.startMono = startMono
    this.deadlines = deadlines
    this.bindingContext = bindingContext
    this.phase = 'queued'
    // Deadlines: prompt receipt + turn terminal, both anchored immediately
    // before the prompt write (C-001 / §5.1 table).
    this.promptReceiptDeadlineMono = startMono + deadlines.promptReceiptTimeoutMs
    this.turnDeadlineMono = startMono + deadlines.turnTimeoutMs
    this.promptRequestId = null
    this.receiptMessageId = null
    this.promptReceipt = 'unknown' // unknown | accepted | proven_not_accepted
    this.receiptSeen = false
    this.receiptMessageSeen = false
    this.currentTurnNumber = undefined
    this.terminalEvent = null
    this.terminalReason = null
    this.laterTurnStartSeen = false
    this.assistantSegments = []
    this.assistantOriginalBytes = 0
    this.assistantTruncated = false
    this.unknownMarked = false
    this.unknownSource = null
    this.settled = false
    this.terminationEvidence = null
    this.deadlineTimer = undefined
    // The terminal deferred exists from construction: settlement may happen
    // synchronously DURING the prompt-receipt continuation (watermark
    // replay), before the turn caller arms its wait — a late-created
    // promise would silently drop that settlement.
    this.terminalPromise = new Promise((resolveTerminal, rejectTerminal) => {
      this.terminalResolve = resolveTerminal
      this.terminalReject = rejectTerminal
    })
    // Receipt-only (deliver) executions have no terminal waiter; a provider
    // failure settlement must never surface as an unhandled rejection.
    this.terminalPromise.catch(() => {})
  }

  /** The exact receipt correlation is proven once the bound messageId was
   *  observed as the session's user message inside the matched turn. */
  receiptCorrelated() {
    return this.receiptMessageSeen
  }

  /** BOUNDED rule 10: incremental UTF-8-safe tail capture — never buffers the full output. */
  appendAssistantText(text) {
    if (typeof text !== 'string' || text === '') return
    const bytes = Buffer.byteLength(text, 'utf8')
    this.assistantOriginalBytes += bytes
    this.assistantSegments.push({ text, bytes })
    let kept = this.assistantSegments.reduce((sum, segment) => sum + segment.bytes, 0)
    while (kept > PROCESS_EVIDENCE_CAPS.MAX_FINAL_ASSISTANT_OUTPUT_BYTES && this.assistantSegments.length > 1) {
      const dropped = this.assistantSegments.shift()
      kept -= dropped.bytes
      this.assistantTruncated = true
    }
    if (kept > PROCESS_EVIDENCE_CAPS.MAX_FINAL_ASSISTANT_OUTPUT_BYTES && this.assistantSegments.length === 1) {
      const buffer = Buffer.from(this.assistantSegments[0].text, 'utf8')
      let start = buffer.length - PROCESS_EVIDENCE_CAPS.MAX_FINAL_ASSISTANT_OUTPUT_BYTES
      while (start > 0 && (buffer[start] & 0xc0) === 0x80) start -= 1 // never split a code point
      this.assistantSegments[0] = { text: buffer.subarray(start).toString('utf8'), bytes: buffer.length - start }
      this.assistantTruncated = true
    }
  }

  finalAssistantText() {
    return this.assistantSegments.map(segment => segment.text).join('')
  }

  outputSnapshot() {
    return {
      text: this.finalAssistantText(),
      truncated: this.assistantTruncated,
      originalBytes: this.assistantOriginalBytes,
    }
  }

  hasOutput() {
    return this.assistantOriginalBytes > 0 || this.assistantSegments.length > 0
  }

  evidenceSnapshot() {
    return {
      eventWatermarkSeq: this.watermarkSeq,
      promptRequestId: this.promptRequestId,
      messageId: this.receiptMessageId,
      promptReceipt: this.promptReceipt,
      terminationEvidence: this.terminationEvidence,
      phase: this.phase,
    }
  }
}

/**
 * One owned DSH agent process. `turn()` is the business entry: prompt a
 * session, wait for the receipt + whole-agent idle, return the last assistant
 * text. `exit` promise settles only after the full child-exit settlement
 * order (C-020) completed.
 */
export class AgentProcess {
  constructor({
    agentId, home, workspace, profile, provider, model, providerEnv = {}, omitEnv = [],
    log = console, env = {},
    processGeneration = 1,
    deadlines,
    reconciliationStore,
    registryIntegration = null,
  }) {
    if (typeof profile !== 'string' || profile === '') {
      throw new TypeError('AgentProcess: profile is required (no default — the caller owns the composition choice)')
    }
    this.agentId = agentId
    this.home = home
    this.workspace = workspace
    this.profile = profile
    // Immutable for this process lifetime. Production composition resolves a
    // per-Agent override before construction; every create/resume in this
    // process therefore inherits the same initialize route. Non-production
    // callers retain the historical global-env/default behavior.
    this.provider = provider ?? process.env.DSH_AGENT_PROVIDER ?? 'opencode-go'
    this.model = model ?? process.env.DSH_AGENT_MODEL ?? 'deepseek-v4-flash'
    this.providerEnv = Object.freeze({ ...providerEnv })
    this.omitEnv = [...omitEnv]
    this.log = log
    this.env = env // extra env for the child (e.g. DSH_AGENT_ID)

    // --- V2 lifecycle -----------------------------------------------------
    this.processGeneration = processGeneration
    // Four-field deadline config (CLAUSE-PROC-DEADLINE-CONFIG). Validated
    // fail-loud at construction — before any spawn.
    this.deadlines = Object.freeze({
      initializeTimeoutMs: 90000,
      promptReceiptTimeoutMs: 30000,
      turnTimeoutMs: 300000,
      shutdownGraceMs: 30000,
      ...(deadlines ?? {}),
    })
    for (const field of Object.keys(this.deadlines)) {
      assertPositiveSafeDeadline(field, this.deadlines[field])
    }
    this.store = reconciliationStore ?? new TurnReconciliationStore()
    this.registryIntegration = registryIntegration

    this.state = 'SPAWNING'
    this.stateHistory = [{ to: 'SPAWNING', atWallMs: Date.now() }]

    this.pid = undefined
    this.exit = undefined // { code, signal } once real exit observed
    this.exitPromise = undefined
    this.exitResolve = undefined
    this.child = undefined
    this.ownership = null // { childObject, pid, token } once a child was created
    this.ownershipToken = undefined
    this.spawnFailure = null
    this.fatalInitiated = false
    this.fatalCause = null
    this.inputFrozen = false
    this.killSignalSent = false
    this.shutdownPromise = undefined
    this.initializeEvidence = undefined
    this.initializeElapsedMs = undefined

    // --- bounded evidence surfaces ---------------------------------------
    this.eventSeq = 0
    this.eventLog = new Map() // seq -> { params, bytes } (insertion-ordered ring, O(1) eviction)
    this.eventLogBytes = 0
    this.eventsDroppedCount = 0
    this.stderr = ''
    this.stderrDroppedBytes = 0
    this.creations = []
    this.creationsDroppedCount = 0
    this.creationsDroppedBytes = 0
    this.status = {} // sessionId -> last agent status
    this.buf = '' // stdout partial frame (capped; overflow = fatal)

    // --- RPC pending table (C-001..C-004) --------------------------------
    this.pending = new Map()
    this.seq = 0
    this.latePromptTombstones = new Map() // request id -> execution (bounded, C-012)
    this.lateTombstonesDropped = 0

    // --- turn admission (C-013) ------------------------------------------
    /** ChannelConversation of the in-flight turn (switch tool relay target). */
    this.activeBindingContext = undefined
    this.turnQueueEntries = []
    this.turnInFlight = false
    this.queuedPromptBytes = 0
    /** live tracked executions: handle -> TurnExecution */
    this.executions = new Map()
    this.activeUnknownFence = null // { handle, sessionId } while unresolved unknown
    /** Router-installed hook: async (method, params, deadlineCtx) => result. */
    this.onRpcRequest = undefined

    // --- fault-injection oracles (exact counters; §10.3) -----------------
    this.counters = {
      spawnAttempts: 0,
      promptWriteAttempts: 0,
      rpcResponseWriteAttempts: 0,
      gracefulShutdownWriteAttempts: 0,
      killSignals: 0,
      replayAdmissions: 0, // structurally 0: no replay path exists
    }
    this.boundedAudit = [] // last 64 invariant/ownership/stale-callback notes
  }

  // ------------------------------------------------------------------ state

  transition(next) {
    const from = this.state
    if (from === next && next === 'EXITED') return
    if (!LEGAL_PROCESS_TRANSITIONS.has(`${from}->${next}`)) {
      const error = new Error(`AgentProcess invariant violation: illegal transition ${from} -> ${next} (agent ${this.agentId} generation ${this.processGeneration})`)
      this.auditBounded({ kind: 'invariant_violation', detail: `${from}->${next}` })
      this.log.error?.(error.message)
      if (from !== 'EXITED' && next !== 'EXITED' && !this.fatalInitiated) {
        try { this.fatal('invariant_violation') } catch { /* fatal itself must never mask the invariant */ }
      }
      throw error
    }
    this.state = next
    this.stateHistory.push({ to: next, atWallMs: Date.now() })
    if (this.stateHistory.length > 32) this.stateHistory.shift()
  }

  auditBounded(entry) {
    this.boundedAudit.push({ ...entry, observedAtWallMs: Date.now() })
    if (this.boundedAudit.length > 64) this.boundedAudit.shift()
  }

  /** Historical observability view of the bounded event ring. */
  get events() {
    return [...this.eventLog.values()].map(entry => entry.params)
  }

  // ------------------------------------------------------------------ spawn

  /** Spawn the dsh CLI child. Does not wait for readiness. */
  spawn() {
    this.counters.spawnAttempts += 1
    let spawnConfig
    try {
      spawnConfig = childSpawnConfig(this.log)
    } catch (cause) {
      this.handleSpawnFailureWithoutChild(cause)
      throw cause
    }
    const program = spawnConfig.argv[0]
    const args = [...spawnConfig.argv.slice(1), cliBin(), '--profile', this.profile]
    // Direct setuid is only legal from root or the same uid; anything else
    // (e.g. a 505 parent without the root-bootstrapped helper) must fail
    // LOUD rather than silently run the child at the parent's identity.
    if (spawnConfig.spawnUid !== undefined && spawnConfig.spawnUid !== process.getuid?.() && process.getuid?.() !== 0) {
      const cause = new Error(
        `agent-router: cannot drop child to uid ${spawnConfig.spawnUid} from uid ${process.getuid()} without DSH_AGENT_SPAWN_HELPER`,
      )
      this.handleSpawnFailureWithoutChild(cause)
      throw cause
    }
    let child
    try {
      child = spawn(program, args, {
        cwd: this.workspace,
        env: agentEnv(this.home, this.env, this.omitEnv, this.providerEnv),
        stdio: ['pipe', 'pipe', 'pipe'],
        ...(spawnConfig.spawnUid === undefined ? {} : { uid: spawnConfig.spawnUid, gid: spawnConfig.spawnGid }),
      })
    } catch (cause) {
      this.handleSpawnFailureWithoutChild(cause)
      throw cause
    }
    return this.attachChild(child)
  }

  /**
   * Bind one created child object to this process instance — the single
   * wiring path shared by the real spawn() and deterministic fault-injection
   * harnesses (they construct a controllable child object and attach it).
   */
  attachChild(child) {
    this.child = child
    this.pid = child.pid
    // C-020: unforgeable in-memory ownership token bound to
    // { agentId, processGeneration, childObjectIdentity, pid } at spawn
    // success; every signal/kill must re-match all of them.
    this.ownership = { childObject: child, pid: child.pid, token: randomUUID() }
    this.ownershipToken = this.ownership.token
    this.exitPromise = new Promise((resolveExit) => {
      this.exitResolve = resolveExit
    })
    child.once('error', (error) => this.onChildError(error))
    child.once('exit', (code, signal) => this.onChildExit(code, signal))
    child.stdin.on('error', (error) => this.onStdinBroken(error))
    child.stdin.on('close', () => this.onStdinBroken(new Error('agent-router: stdin pipe closed')))
    child.stderr.on('data', (chunk) => this.onStderr(chunk))
    child.stdout.on('data', (chunk) => this.onStdout(String(chunk)))
    return this
  }

  /**
   * C-009 explicit no-child fatal branch: spawn failed before any OS process
   * existed (sync throw, or async spawn 'error' with no pid). DRAINING
   * bookkeeping, recorded `spawn_failed_without_child` evidence, STARTUP->EMPTY
   * — no REAP, no kill, no exit await.
   */
  handleSpawnFailureWithoutChild(cause) {
    if (this.state === 'EXITED') return
    if (this.state !== 'DRAINING') this.transition('DRAINING')
    this.spawnFailure = { kind: 'spawn_failed_without_child', error: redactSensitiveText(String(cause?.message ?? cause)), atWallMs: Date.now() }
    this.exit = { code: null, signal: null, spawnFailedWithoutChild: true }
    this.rejectQueuedTurns('AGENT_PROCESS_UNAVAILABLE', 'spawn_failed_without_child')
    this.rejectAllPending('AGENT_PROCESS_UNAVAILABLE', { cause: 'spawn_failed_without_child', detail: this.spawnFailure.error })
    this.registryIntegration?.casStartupEmpty?.(this)
    this.transition('EXITED')
    this.exitResolve?.(this.exit)
  }

  onChildError(error) {
    if (this.state === 'EXITED') {
      this.auditBounded({ kind: 'stale_callback', detail: `child error after EXITED: ${redactSensitiveText(String(error?.message ?? error))}` })
      return
    }
    // No pid => no OS process was ever created: the no-child terminal
    // evidence `spawn_failed_without_child` (EXITED definition (a)).
    if (this.pid === undefined && this.exit === undefined) {
      this.handleSpawnFailureWithoutChild(error)
      return
    }
    // Created-child stream/process error: C-003 — reject pending with
    // AGENT_PROCESS_UNAVAILABLE (never masquerade as a real exit) and enter
    // the C-009 fatal teardown. The real exit callback completes the order.
    this.auditBounded({ kind: 'child_error', detail: redactSensitiveText(String(error?.message ?? error)) })
    this.fatal('child_error')
  }

  /**
   * Child real exit — the C-020 mandatory order, synchronously:
   * evidence -> reject pending -> freeze+snapshot parser evidence ->
   * unknown visible -> precedence settlement -> store visible -> release
   * matcher -> REAP->EMPTY -> EXITED -> THEN resolve exitPromise.
   */
  onChildExit(code, signal) {
    if (this.state === 'EXITED') {
      this.auditBounded({ kind: 'stale_callback', detail: `late exit after EXITED (code=${code}, signal=${signal}) — bounded audit only` })
      return
    }
    // 1. atomically mark exact child exit evidence
    this.exit = { code, signal }
    if (this.state === 'SPAWNING' || this.state === 'INITIALIZING' || this.state === 'READY') {
      this.registryIntegration?.casReap?.(this, 'child_exit')
    }
    if (this.state !== 'DRAINING') this.transition('DRAINING')
    // 2. immediately settle/reject every pending RPC; pending.size = 0
    this.rejectAllPending('AGENT_PROCESS_EXITED', { code, signal })
    // 3. freeze input; snapshot parser evidence already received pre-exit
    this.inputFrozen = true
    for (const execution of [...this.executions.values()]) {
      // 4. active execution without outcome proof: outcome_unknown visible FIRST
      if (!execution.settled && !execution.unknownMarked) {
        this.markExecutionUnknown(execution, 'child_exit_without_parsed_outcome')
        if (!execution.settled && typeof execution.terminalReject === 'function') {
          execution.terminalReject(envelopeCarrier('outcome_unknown', execution.handle, 'AGENT_PROCESS_CHILD_EXITED',
            `agent ${this.agentId} (generation ${this.processGeneration}) exited (code=${code}, signal=${signal}) without an exact parsed outcome for this turn`, { evidence: execution.evidenceSnapshot() }))
          execution.terminalReject = undefined
        }
      }
      // 5. C-017 precedence: parsed exact outcome (received before the exit
      //    callback) wins over child_real_exit.
      if (execution.terminalEvent !== null) {
        const failed = execution.terminalReason?.kind === 'error'
        this.store.settleLate(execution.handle, {
          lateOutcome: failed ? 'late_failed' : 'late_completed',
          outcomeEvidence: failed ? 'exact_turn_end_failure' : 'exact_turn_end_success',
          terminationEvidence: 'child_real_exit',
          finalAssistantOutput: execution.hasOutput() ? execution.outputSnapshot() : undefined,
        })
      } else {
        this.store.settleLate(execution.handle, {
          lateOutcome: 'terminated_without_outcome',
          terminationEvidence: 'child_real_exit',
          finalAssistantOutput: execution.hasOutput() ? execution.outputSnapshot() : undefined,
        })
      }
      this.releaseFence(execution.handle)
      this.finishExecution(execution)
    }
    // 6. authoritative reconciliation records are visible (in-memory store)
    // 7. local matcher/output copies released (finishExecution above)
    // 8. CAS exact REAP entry -> EMPTY
    this.registryIntegration?.casEmpty?.(this)
    // 9. EXITED
    this.transition('EXITED')
    // exitPromise resolves LAST — never before settlement/reconciliation.
    this.exitResolve?.(this.exit)
  }

  onStderr(chunk) {
    const safeChunk = redactSensitiveText(chunk)
    const appended = this.stderr + safeChunk
    if (Buffer.byteLength(appended, 'utf8') > PROCESS_EVIDENCE_CAPS.MAX_STDERR_BYTES) {
      // Keep the newest tail; account every dropped byte.
      const buffer = Buffer.from(appended, 'utf8')
      const keep = buffer.subarray(buffer.length - PROCESS_EVIDENCE_CAPS.MAX_STDERR_BYTES)
      this.stderrDroppedBytes += buffer.length - keep.length
      this.stderr = keep.toString('utf8')
    } else {
      this.stderr = appended
    }
    for (const line of safeChunk.split('\n')) {
      const match = line.match(/\[demo-server\] session (\S+) (created|resumed) \((\d+) events\)/)
      if (match !== null) {
        const record = { sessionId: match[1], mode: match[2], events: Number(match[3]) }
        const recordBytes = Buffer.byteLength(JSON.stringify(record), 'utf8')
        if (recordBytes > PROCESS_EVIDENCE_CAPS.MAX_CREATION_RECORD_BYTES) {
          this.creationsDroppedBytes += recordBytes
          continue
        }
        this.creations.push(record)
        if (this.creations.length > PROCESS_EVIDENCE_CAPS.MAX_CREATION_RECORDS) {
          this.creations.shift()
          this.creationsDroppedCount += 1
        }
        this.log.log?.(`[router] agent ${this.agentId}: session ${match[1]} ${match[2]} (${match[3]} events)`)
      }
    }
  }

  onStdout(chunk) {
    if (this.state === 'EXITED') return
    this.buf += chunk
    if (Buffer.byteLength(this.buf, 'utf8') > PROCESS_EVIDENCE_CAPS.MAX_STDOUT_PARTIAL_BYTES
        || Buffer.byteLength(this.buf, 'utf8') > PROCESS_EVIDENCE_CAPS.MAX_RPC_FRAME_BYTES) {
      // BOUNDED rule 6: stdout partial/frame overflow is a fatal protocol
      // error -> C-009 DRAINING teardown.
      this.auditBounded({ kind: 'protocol_buffer_overflow', detail: `stdout partial buffer ${Buffer.byteLength(this.buf, 'utf8')} bytes` })
      this.buf = ''
      this.fatal('protocol_buffer_overflow')
      return
    }
    let index
    while ((index = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, index)
      this.buf = this.buf.slice(index + 1)
      if (line.trim() === '') continue
      if (Buffer.byteLength(line, 'utf8') > PROCESS_EVIDENCE_CAPS.MAX_RPC_FRAME_BYTES) {
        this.auditBounded({ kind: 'protocol_buffer_overflow', detail: `rpc frame ${Buffer.byteLength(line, 'utf8')} bytes` })
        this.fatal('protocol_buffer_overflow')
        return
      }
      let message
      try { message = JSON.parse(line) } catch { continue }
      if (message.id !== undefined) {
        this.onRpcResponse(message)
      } else if (message.method === 'session.event') {
        this.onSessionEvent(message.params)
      } else if (message.method === 'session.status') {
        this.onSessionStatus(message.params)
      } else if (message.method === 'rpc.request') {
        // A per-agent plugin asks the Control Plane to run a Router domain
        // operation; the answer goes back over stdin as rpc.response.
        void this.handleRpcRequest(message.params)
      }
    }
  }

  onRpcResponse(message) {
    const waiter = this.pending.get(message.id)
    if (waiter === undefined) {
      // Late response after settle: for an outcome_unknown prompt execution,
      // correlate the exact messageId via the bounded tombstone (C-012) so
      // reconciliation can continue — never re-settle the caller.
      const tombstone = this.latePromptTombstones.get(message.id)
      if (tombstone !== undefined) {
        this.latePromptTombstones.delete(message.id)
        const messageId = message.result?.messageId
        if (tombstone.execution !== undefined && messageId !== undefined) {
          tombstone.execution.receiptMessageId = messageId
          tombstone.execution.promptReceipt = 'accepted'
          tombstone.execution.phase = 'running'
          this.store.markPromptReceipt(tombstone.execution.handle, { messageId })
          this.replayExecutionFromWatermark(tombstone.execution)
          this.auditBounded({ kind: 'late_receipt_correlated', detail: `request ${message.id} -> ${messageId}` })
        }
      }
      return
    }
    this.settlePendingEntry(waiter, 'resolve-or-reject', message)
  }

  // ------------------------------------------------------- bounded events

  onSessionEvent(params) {
    if (params === null || typeof params !== 'object') return
    this.eventSeq += 1
    const seq = this.eventSeq
    let stored = params
    let bytes = Buffer.byteLength(JSON.stringify(params ?? null), 'utf8')
    if (bytes > PROCESS_EVIDENCE_CAPS.MAX_EVENT_RECORD_BYTES) {
      // Oversized single event: correlation header + explicit truncated
      // metadata — never allocate the unbounded payload.
      stored = {
        __truncatedEvent: true,
        sessionId: params.sessionId ?? null,
        eventType: params.event?.type ?? null,
        originalBytes: bytes,
      }
      bytes = Buffer.byteLength(JSON.stringify(stored), 'utf8')
    }
    this.eventLog.set(seq, { params: stored, bytes })
    this.eventLogBytes += bytes
    while (this.eventLog.size > PROCESS_EVIDENCE_CAPS.MAX_EVENT_RECORDS
        || this.eventLogBytes > PROCESS_EVIDENCE_CAPS.MAX_EVENT_BUFFER_BYTES) {
      const oldestKey = this.eventLog.keys().next().value
      if (oldestKey === undefined) break
      const oldest = this.eventLog.get(oldestKey)
      this.eventLog.delete(oldestKey) // O(1); sequence numbers are never reused
      this.eventLogBytes -= oldest.bytes
      this.eventsDroppedCount += 1
    }
    // Live matcher: incremental attribution at event arrival (BOUNDED rule 2).
    // Events that arrive BEFORE the receipt messageId is bound are retained
    // in the bounded ring and replayed on binding (C-011: a receipt event
    // arriving before the JSON-RPC response must never be lost).
    for (const execution of [...this.executions.values()]) {
      if (seq <= execution.watermarkSeq || seq <= execution.lastFedSeq) continue
      if (params.sessionId !== execution.sessionId) continue
      if (execution.receiptMessageId === null) continue
      this.feedExecution(execution, params.event, seq)
    }
  }

  onSessionStatus(params) {
    if (params === null || typeof params !== 'object') return
    this.status[params.sessionId] = params.status
    for (const execution of [...this.executions.values()]) {
      if (execution.sessionId === params.sessionId && execution.terminalEvent !== null) {
        this.trySettleExecution(execution)
      }
    }
  }

  /** Replay the bounded ring from the watermark through the matcher (C-011). */
  replayExecutionFromWatermark(execution) {
    if (execution.receiptMessageId === null || execution.settled) return
    for (let seq = execution.watermarkSeq + 1; seq <= this.eventSeq; seq += 1) {
      if (seq <= execution.lastFedSeq) continue
      const entry = this.eventLog.get(seq)
      if (entry === undefined) continue // evicted ring head — bounded history
      if (entry.params?.sessionId !== execution.sessionId) continue
      this.feedExecution(execution, entry.params.event, seq)
    }
  }

  feedExecution(execution, event, seq) {
    if (execution.settled || seq <= execution.lastFedSeq) return
    const type = event?.type
    try {
      if (type === 'agent/inbox/spliced') {
        if (!execution.receiptSeen && execution.receiptMessageId !== null) {
          const inserted = event.data?.inserted
          if (Array.isArray(inserted) && inserted.some(message => message?.id === execution.receiptMessageId)) {
            execution.receiptSeen = true
            execution.promptReceipt = 'accepted'
          }
        }
        return
      }
      if (type === 'user/message' && execution.receiptMessageId !== null
          && (event.data?.id === execution.receiptMessageId || event.data?.message?.id === execution.receiptMessageId)) {
        execution.receiptMessageSeen = true
        execution.promptReceipt = 'accepted'
        return
      }
      if (type === 'turn/start') {
        if (execution.terminalEvent !== null) {
          // A later turn of the same session started after our terminal — the
          // session necessarily passed through idle in between.
          execution.laterTurnStartSeen = true
          this.trySettleExecution(execution)
        } else {
          execution.currentTurnNumber = event.data?.turn
        }
        return
      }
      if (type === 'assistant/message') {
        // Output attribution is scoped to the matched turn window: a prior
        // turn's late assistant event (before our turn/start or after our
        // terminal) must not leak into this execution's output (C-011).
        if (execution.currentTurnNumber === undefined || execution.terminalEvent !== null) return
        const text = (event.data?.message?.content ?? [])
          .filter(block => block?.type === 'text').map(block => block.text).join('')
        execution.appendAssistantText(text)
        this.store.updateFinalOutput(execution.handle, execution.hasOutput() ? execution.outputSnapshot() : null)
        return
      }
      if (type === 'turn/end' && execution.currentTurnNumber !== undefined
          && event.data?.turn === execution.currentTurnNumber
          && execution.receiptMessageSeen) {
        execution.terminalEvent = event
        execution.terminalReason = event.data?.reason ?? { kind: 'unknown' }
        this.trySettleExecution(execution)
      }
    } finally {
      execution.lastFedSeq = seq
    }
  }

  /**
   * Exact terminal + idle => settle once. In-deadline callers get the
   * envelope; already-unknown executions go through the late machine and
   * release the fence (same handle only — C-016).
   */
  trySettleExecution(execution) {
    if (execution.settled || execution.terminalEvent === null) return
    const idle = this.status[execution.sessionId] === 'idle' || execution.laterTurnStartSeen
    if (!idle) return
    execution.settled = true
    execution.terminationEvidence = 'exact_terminal_then_idle'
    execution.phase = 'terminal'
    if (execution.deadlineTimer !== undefined) clearTimeout(execution.deadlineTimer)
    const failed = execution.terminalReason?.kind === 'error'
    if (execution.unknownMarked) {
      this.store.settleLate(execution.handle, {
        lateOutcome: failed ? 'late_failed' : 'late_completed',
        outcomeEvidence: failed ? 'exact_turn_end_failure' : 'exact_turn_end_success',
        terminationEvidence: 'exact_terminal_then_idle',
        finalAssistantOutput: execution.hasOutput() ? execution.outputSnapshot() : undefined,
      })
      this.releaseFence(execution.handle)
      this.finishExecution(execution)
      return
    }
    if (failed) {
      const error = sanitizeProviderError(execution.terminalReason.error, {
        agentId: this.agentId,
        provider: this.provider,
        model: this.model,
      })
      error.status = 'failed'
      error.envelope = 'failed'
      error.reconciliationHandle = execution.handle
      error.evidence = execution.evidenceSnapshot()
      this.store.settleDirect(execution.handle, {
        outcome: 'failed',
        outcomeEvidence: 'exact_turn_end_failure',
        terminationEvidence: 'exact_terminal_then_idle',
        errorClass: error.code,
      })
      execution.terminalReject?.(error)
    } else {
      this.store.settleDirect(execution.handle, {
        outcome: 'completed',
        outcomeEvidence: 'exact_turn_end_success',
        terminationEvidence: 'exact_terminal_then_idle',
      })
      execution.terminalResolve?.({
        reply: execution.finalAssistantText(),
        messageId: execution.receiptMessageId,
        terminationEvidence: execution.terminationEvidence,
      })
    }
    execution.terminalReject = undefined
    execution.terminalResolve = undefined
    this.finishExecution(execution)
  }

  finishExecution(execution) {
    if (execution.deadlineTimer !== undefined) {
      clearTimeout(execution.deadlineTimer)
      execution.deadlineTimer = undefined
    }
    this.executions.delete(execution.handle)
  }

  markExecutionUnknown(execution, source) {
    if (execution.settled || execution.unknownMarked) return
    execution.unknownMarked = true
    execution.unknownSource = source
    execution.phase = 'outcome_unknown'
    this.store.markOutcomeUnknown(execution.handle, { source, deadlineAtWallMs: Date.now() })
    this.installUnknownFence(execution)
  }

  installUnknownFence(execution) {
    if (this.activeUnknownFence === null) {
      this.activeUnknownFence = { handle: execution.handle, sessionId: execution.sessionId }
      // C-013: reject every queued-not-sent turn structurally; they never
      // auto-send after fence release (re-admission is an explicit caller act).
      this.rejectQueuedTurns('AGENT_PROCESS_TURN_FENCED', 'outcome_unknown fence', execution.handle)
    }
  }

  /** C-016: only termination evidence of the SAME active unknown handle releases. */
  releaseFence(handle) {
    if (this.activeUnknownFence?.handle === handle) this.activeUnknownFence = null
  }

  // ------------------------------------------------------------ parent RPC

  /**
   * Relay one parent-RPC request to the router-installed hook and answer the
   * child — bounded by ONE absolute deadline with the fixed response-write
   * reserve (C-005). One wire response attempt, no re-invocation.
   */
  async handleRpcRequest({ requestId, method, params } = {}) {
    if (typeof requestId !== 'string' || typeof method !== 'string') return
    const receivedAtMono = monotonicNowMs()
    const activeExecution = [...this.executions.values()].find(execution => execution.mode === 'turn')
    const totalDeadlineMono = (activeExecution !== undefined && activeExecution.turnDeadlineMono > receivedAtMono)
      ? activeExecution.turnDeadlineMono
      : receivedAtMono + this.deadlines.turnTimeoutMs
    const totalBudgetMs = totalDeadlineMono - receivedAtMono
    if (totalBudgetMs <= 0) {
      // Deadline already past at receipt: no handler, no write (C-005).
      this.auditBounded({ kind: 'parent_rpc_budget_exhausted', detail: method })
      return
    }
    const responseWriteReserveMs = Math.min(250, Math.max(1, Math.floor(totalBudgetMs * 0.10)))
    const handlerDeadlineMono = totalDeadlineMono - responseWriteReserveMs
    const deadlineAtWallMs = Date.now() + totalBudgetMs
    let result
    let error
    let timedOut = false
    if (handlerDeadlineMono <= receivedAtMono) {
      // Reserve alone exceeds the budget: do not start the handler.
      timedOut = true
    } else {
      const controller = new AbortController()
      const abortTimer = setTimeout(() => {
        controller.abort()
        timedOut = true
      }, handlerDeadlineMono - receivedAtMono)
      abortTimer.unref?.()
      try {
        if (typeof this.onRpcRequest !== 'function') {
          throw new Error(`process ${this.agentId}: no parent-RPC handler for ${method}`)
        }
        result = await this.onRpcRequest(method, params, { handlerDeadlineMono, totalDeadlineMono, deadlineAtWallMs, signal: controller.signal })
      } catch (cause) {
        error = cause
      }
      clearTimeout(abortTimer)
    }
    if (timedOut) {
      // The handler missed its deadline: the wire answer is the timeout
      // response regardless of any late hook settlement — and whether the
      // hook's side effect happened stays unknown.
      if (error === undefined) {
        error = new Error(`parent-RPC ${method} exceeded its handler deadline (agent ${this.agentId})`)
      }
      result = undefined
      this.auditBounded({ kind: 'parent_rpc_timeout', detail: `${method} sideEffectOutcome=unknown` })
    }
    // ONE best-effort wire response within the original total deadline. The
    // write OUTCOME is decided by the write callback (C-005: pipe
    // unavailable/backpressure => failed|unknown), never by a response
    // receipt the child may not owe.
    this.counters.rpcResponseWriteAttempts += 1
    let writeOutcome = 'unknown'
    try {
      await this.request('rpc.response', {
        requestId,
        ok: error === undefined,
        result,
        error: error === undefined ? undefined : (error instanceof Error ? error.message : String(error)),
      }, undefined, {
        deadlineMono: totalDeadlineMono,
        onWriteCompleted: (writeError) => { writeOutcome = writeError === null || writeError === undefined ? 'sent' : 'failed' },
      })
      if (writeOutcome === 'unknown') writeOutcome = 'sent'
    } catch {
      // Deadline before receipt: the write outcome stands as last recorded.
    }
    this.auditBounded({ kind: 'parent_rpc_response', detail: `${method} responseWrite=${writeOutcome}` })
  }

  // ------------------------------------------------------------------ RPC

  /**
   * JSON-RPC request to the demo-server child with one absolute total
   * deadline (C-001). The legacy third argument is honored as a per-call
   * budget (deadline = now + timeoutMs); internal callers pass
   * `opts.deadlineMono` directly (retries never reset it). stdin failures
   * reject the entry (C-004) with zero-byte provenance classification.
   * @param {string} method
   * @param {object|undefined} params
   * @param {number} [timeoutMs] legacy per-call budget
   * @param {object} [opts] { deadlineMono, execution, onWriteAttempted }
   */
  request(method, params, timeoutMs, opts = {}) {
    const deadlineMono = opts.deadlineMono
      ?? (timeoutMs !== undefined ? monotonicNowMs() + timeoutMs : undefined)
      ?? (monotonicNowMs() + this.deadlines.turnTimeoutMs) // generic lifecycle-budget derivation — never infinite
    if (this.pending.size >= PROCESS_EVIDENCE_CAPS.MAX_PENDING_RPC) {
      return Promise.reject(envelopeCarrier('not_admitted', opts.execution?.handle ?? null, 'AGENT_PROCESS_PENDING_CAP',
        `agent ${this.agentId}: pending RPC cap ${PROCESS_EVIDENCE_CAPS.MAX_PENDING_RPC} reached — request ${method} rejected before write`))
    }
    if (this.inputFrozen) {
      return Promise.reject(envelopeCarrier('not_admitted', opts.execution?.handle ?? null, 'AGENT_PROCESS_INPUT_FROZEN',
        `agent ${this.agentId}: input frozen — request ${method} rejected before write`, { proven: 'zero_byte' }))
    }
    return new Promise((resolveRequest, rejectRequest) => {
      const id = ++this.seq
      const entry = {
        id,
        method,
        deadlineMono,
        execution: opts.execution ?? null,
        resolve: resolveRequest,
        reject: rejectRequest,
        settled: false,
        timer: undefined,
        writeProven: false,
      }
      const remaining = Math.max(0, deadlineMono - monotonicNowMs())
      const budgetMsForMessage = Math.max(1, remaining)
      entry.timer = setTimeout(() => {
        const isPrompt = method === 'session/prompt'
        const handle = entry.execution?.handle ?? null
        if (isPrompt && entry.execution !== null && entry.execution !== undefined) {
          // C-012: receipt deadline with admission unproven -> outcome_unknown.
          this.recordLatePromptTombstone(entry)
          const carrier = envelopeCarrier('outcome_unknown', handle, 'AGENT_PROCESS_PROMPT_RECEIPT_TIMEOUT',
            `prompt receipt for session ${params?.sessionId} (agent ${this.agentId}) timed out — admission unproven, outcome_unknown`, { source: 'prompt_receipt_timeout', evidence: { method } })
          this.settlePendingEntry(entry, 'reject', carrier)
        } else {
          this.settlePendingEntry(entry, 'reject', Object.assign(
            new Error(`request ${method} timed out after ${budgetMsForMessage}ms (agent ${this.agentId})`),
            { code: 'AGENT_PROCESS_RPC_DEADLINE', method },
          ))
        }
      }, remaining)
      entry.timer.unref?.()
      this.pending.set(id, entry)
      if (method === 'session/prompt') this.counters.promptWriteAttempts += 1
      const payload = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`
      try {
        this.child.stdin.write(payload, (writeError) => {
          opts.onWriteCompleted?.(writeError ?? null)
          if (writeError !== undefined && writeError !== null && !entry.settled) {
            // Write callback error: bytes may or may not have reached the
            // child — admission unprovable (C-004).
            const handle = entry.execution?.handle ?? null
            const carrier = envelopeCarrier(entry.method === 'session/prompt' && entry.execution !== null ? 'outcome_unknown' : 'failed',
              handle, 'AGENT_PROCESS_PROMPT_WRITE_FAILED',
              `stdin write for ${entry.method} failed (agent ${this.agentId}): ${redactSensitiveText(String(writeError?.message ?? writeError))}`,
              { source: 'prompt_write_failed' })
            this.settlePendingEntry(entry, 'reject', carrier)
            this.onStdinBroken(writeError)
          }
        })
        opts.onWriteAttempted?.()
      } catch (syncError) {
        // Synchronous throw: PROVEN zero-byte rejection (C-004 not_admitted).
        const execution = entry.execution ?? null
        const handle = execution?.handle ?? null
        const carrier = envelopeCarrier(entry.method === 'session/prompt' ? 'not_admitted' : 'failed',
          handle, 'AGENT_PROCESS_PROMPT_WRITE_FAILED',
          `stdin write for ${entry.method} threw before any byte was sent (agent ${this.agentId}): ${redactSensitiveText(String(syncError?.message ?? syncError))}`,
          { proven: 'zero_byte', source: 'prompt_write_failed' })
        this.settlePendingEntry(entry, 'reject', carrier)
        // Settle the definitive not_admitted NOW, synchronously — the
        // deferred stream-level fatal below must never race a later
        // unknown classification onto the same execution.
        if (execution !== null && entry.method === 'session/prompt' && !execution.settled) {
          try {
            this.store.settleDirect(handle, {
              outcome: 'not_admitted',
              outcomeEvidence: 'proven_zero_byte_rejection',
              errorClass: carrier.code,
            })
          } catch { /* settlement conflict is audited below */ }
          this.finishExecution(execution)
        }
        queueMicrotask(() => this.onStdinBroken(syncError))
      }
    })
  }

  recordLatePromptTombstone(entry) {
    if (entry.execution === null || entry.execution === undefined) return
    this.latePromptTombstones.set(entry.id, { execution: entry.execution, atWallMs: Date.now() })
    if (this.latePromptTombstones.size > PROCESS_EVIDENCE_CAPS.MAX_LATE_PROMPT_TOMBSTONES) {
      const oldest = this.latePromptTombstones.keys().next().value
      this.latePromptTombstones.delete(oldest)
      this.lateTombstonesDropped += 1
    }
  }

  /** C-002: settle exactly once — delete the map entry + clear the timer. */
  settlePendingEntry(entry, mode, payload) {
    if (entry.settled) return false
    entry.settled = true
    if (entry.timer !== undefined) clearTimeout(entry.timer)
    this.pending.delete(entry.id)
    if (mode === 'reject') entry.reject(payload)
    else if (payload?.error !== undefined) {
      // STRUCTURED errors survive the wire: the demo-server rejects
      // cross-workspace session reuse with a string error code
      // (SESSION_WORKSPACE_MISMATCH); copying it onto the Error lets the
      // Router surface it verbatim.
      entry.reject(sanitizeProviderError(payload.error, {
        agentId: this.agentId,
        provider: this.provider,
        model: this.model,
      }))
    } else entry.resolve(payload?.result)
    return true
  }

  /** C-003: child error/exit rejects every pending RPC and clears timers. */
  rejectAllPending(code, evidence) {
    for (const entry of [...this.pending.values()]) {
      const error = Object.assign(new Error(
        `agent ${this.agentId} (generation ${this.processGeneration}) RPC ${entry.method} rejected: ${code}`,
      ), {
        code,
        agentId: this.agentId,
        processGeneration: this.processGeneration,
        method: entry.method,
        evidence,
      })
      this.settlePendingEntry(entry, 'reject', error)
    }
    this.pending.clear()
  }

  onStdinBroken(error) {
    if (this.inputFrozen || this.state === 'EXITED') return
    this.auditBounded({ kind: 'stdin_failure', detail: redactSensitiveText(String(error?.message ?? error)) })
    this.rejectAllPending('AGENT_PROCESS_UNAVAILABLE', { cause: 'stdin_failure' })
    for (const execution of [...this.executions.values()]) {
      if (!execution.settled && !execution.unknownMarked) {
        // Async/pipe failure: admission unprovable -> outcome_unknown (C-004).
        this.markExecutionUnknown(execution, 'stdin_write_failed')
        if (typeof execution.terminalReject === 'function') {
          execution.terminalReject(envelopeCarrier('outcome_unknown', execution.handle, 'AGENT_PROCESS_UNAVAILABLE',
            `stdin pipe failure while turn was in flight (agent ${this.agentId}) — admission unproven`, { source: 'stdin_write_failed', evidence: execution.evidenceSnapshot() }))
          execution.terminalReject = undefined
        }
      }
    }
    this.fatal('stdin_failure')
  }

  // ------------------------------------------------------------- readiness

  /** spawn → initialize (retries bounded by ONE total deadline; C-001). */
  async ready(timeoutMs) {
    if (this.state === 'READY') return this.initializeElapsedMs ?? 0
    const budgetMs = timeoutMs ?? this.deadlines.initializeTimeoutMs
    if (this.state === 'SPAWNING') this.transition('INITIALIZING')
    // Deadline starts at the INITIALIZING transition, before the first
    // initialize write; retries never reset it.
    const initDeadlineMono = monotonicNowMs() + budgetMs
    const startedWall = Date.now()
    for (;;) {
      if (this.exit !== undefined) {
        throw this.spawnFailure !== null
          ? Object.assign(new Error(`spawn failed without child for agent ${this.agentId}: ${this.spawnFailure.error}`), { code: 'AGENT_PROCESS_SPAWN_FAILED' })
          : Object.assign(new Error(`initialize failed for agent ${this.agentId}: child exited (${this.exit.code ?? 'signal'})`), { code: 'AGENT_PROCESS_EXITED' })
      }
      if (monotonicNowMs() >= initDeadlineMono) {
        void this.fatal('initialize_timeout')
        throw Object.assign(new Error(`initialize timeout for agent ${this.agentId}`), { code: 'AGENT_PROCESS_INITIALIZE_TIMEOUT' })
      }
      try {
        const initialized = await this.request('initialize', {
          cwd: this.workspace,
          provider: this.provider,
          model: this.model,
          maxTokens: Number.parseInt(process.env.DSH_AGENT_MAX_TOKENS ?? '8192', 10),
        }, undefined, { deadlineMono: initDeadlineMono })
        if (Array.isArray(initialized?.registeredProviders)
            && !initialized.registeredProviders.includes(this.provider)) {
          if (monotonicNowMs() >= initDeadlineMono) {
            void this.fatal('initialize_timeout')
            throw sanitizeProviderError({
              code: 'provider_unavailable',
              message: `provider ${this.provider} did not register before initialize timeout`,
            }, { agentId: this.agentId, provider: this.provider, model: this.model })
          }
          await sleep(300)
          continue
        }
        this.initializeEvidence = initialized
        this.initializeElapsedMs = Date.now() - startedWall
        this.transition('READY')
        this.log.log?.(`[router] agent ${this.agentId} ready pid=${this.pid} (${this.initializeElapsedMs}ms)`)
        return this.initializeElapsedMs
      } catch (error) {
        if (error?.code === 'AGENT_PROCESS_UNAVAILABLE' || error?.code === 'AGENT_PROCESS_EXITED'
            || error?.code === 'AGENT_PROCESS_INPUT_FROZEN' || error?.code === 'AGENT_PROCESS_PENDING_CAP') {
          // Process-level failure: fatal teardown is already running — the
          // startup caller rejects NOW (bounded), not after the OS reap.
          throw this.spawnFailure !== null
            ? Object.assign(new Error(`spawn failed without child for agent ${this.agentId}: ${this.spawnFailure.error}`), { code: 'AGENT_PROCESS_SPAWN_FAILED' })
            : error
        }
        if (FAIL_LOUD_PROVIDER_ERRORS.has(error?.code)) {
          void this.fatal('initialize_failed')
          throw error
        }
        if (monotonicNowMs() >= initDeadlineMono) {
          void this.fatal('initialize_timeout')
          throw Object.assign(new Error(`initialize timeout for agent ${this.agentId}`), { code: 'AGENT_PROCESS_INITIALIZE_TIMEOUT' })
        }
        await sleep(300)
      }
    }
  }

  // ------------------------------------------------------ turn admission

  /**
   * One owned turn: prompt `sessionId` with `text`, wait for the receipt then
   * the whole-agent idle. Serialized through the bounded per-process turn
   * queue (C-013: one active turn per AgentProcess); the fourth legacy
   * argument is the CALLER wait bound — distinct from the configured
   * `turnTimeoutMs` turn deadline; whichever expires first without
   * termination proof yields `outcome_unknown`.
   * @returns {Promise<{status:'completed', reconciliationHandle, reply, ms,
   *   promptMs, messageId, evidence}>} — failures/not-admitted/unknown are
   *   structured throws carrying the same envelope fields.
   */
  turn(sessionId, text, opts = {}, callerWaitTimeoutMs) {
    return this.enqueuePromptExecution('turn', sessionId, text, opts, callerWaitTimeoutMs)
  }

  /**
   * ADMISSION SEAM (Agent Router Delivery V0): accept one message into a
   * session's inbox WITHOUT waiting for the model turn. Resolves on the
   * demo-server receipt (`session/prompt` response). Not serialized through
   * the turn queue (deliveries never wait for a turn), but the SAME fence at
   * the unified prompt write boundary applies (C-013), and the execution is
   * tracked in the background to its terminal/unknown fence (C-010).
   */
  deliver(sessionId, text, opts = {}, timeoutMs) {
    return this.enqueuePromptExecution('deliver', sessionId, text, opts, timeoutMs)
  }

  enqueuePromptExecution(mode, sessionId, text, opts, callerBoundMs) {
    return new Promise((resolve, reject) => {
      const promptBytes = Buffer.byteLength(String(text ?? ''), 'utf8')
      const preError = this.preAdmissionError(mode, sessionId, text, promptBytes)
      if (preError !== null) {
        reject(preError)
        return
      }
      if (mode === 'turn') {
        if (this.turnQueueEntries.length >= PROCESS_EVIDENCE_CAPS.MAX_QUEUED_TURNS_PER_PROCESS
            || this.queuedPromptBytes + promptBytes > PROCESS_EVIDENCE_CAPS.MAX_QUEUED_PROMPT_BYTES_PER_PROCESS) {
          reject(envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_QUEUE_CAP',
            `agent ${this.agentId}: queued turn caps exceeded (${this.turnQueueEntries.length} entries / ${this.queuedPromptBytes}B)`))
          return
        }
        this.turnQueueEntries.push({ mode, sessionId, text, opts, callerBoundMs, promptBytes, resolve, reject })
        this.queuedPromptBytes += promptBytes
        this.drainTurnQueue()
      } else {
        void this.runPromptExecution({ mode, sessionId, text, opts, callerBoundMs, promptBytes, resolve, reject })
      }
    })
  }

  /** Pre-reservation admission gate (envelope not_admitted with handle=null). */
  preAdmissionError(mode, sessionId, text, promptBytes) {
    if (typeof sessionId !== 'string' || sessionId === '') {
      return envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_INVALID_INPUT', 'sessionId must be a non-empty string')
    }
    if (typeof text !== 'string') {
      return envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_INVALID_INPUT', 'prompt text must be a string')
    }
    if (promptBytes > PROCESS_EVIDENCE_CAPS.MAX_PROMPT_BYTES) {
      return envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_PROMPT_TOO_LARGE',
        `prompt of ${promptBytes} bytes exceeds MAX_PROMPT_BYTES ${PROCESS_EVIDENCE_CAPS.MAX_PROMPT_BYTES} — rejected before queueing (input is never cached)`)
    }
    if (this.activeUnknownFence !== null) {
      return fencedRejection(this.activeUnknownFence.handle)
    }
    if (this.state !== 'READY') {
      return envelopeCarrier('not_admitted', null, this.state === 'DRAINING' || this.state === 'EXITED' ? 'AGENT_PROCESS_DRAINING' : 'AGENT_PROCESS_NOT_READY',
        `agent ${this.agentId} is ${this.state} — prompt admission rejected`)
    }
    return null
  }

  drainTurnQueue() {
    if (this.turnInFlight || this.turnQueueEntries.length === 0) return
    if (this.activeUnknownFence !== null || this.state !== 'READY') {
      this.rejectQueuedTurns('AGENT_PROCESS_TURN_FENCED', `admission blocked (state=${this.state})`, this.activeUnknownFence?.handle)
      return
    }
    const entry = this.turnQueueEntries.shift()
    this.queuedPromptBytes -= entry.promptBytes
    this.turnInFlight = true
    void this.runPromptExecution(entry).finally(() => {
      this.turnInFlight = false
      this.drainTurnQueue()
    })
  }

  rejectQueuedTurns(code, detail, fenceHandle) {
    for (const entry of this.turnQueueEntries.splice(0)) {
      this.queuedPromptBytes -= entry.promptBytes
      entry.reject(envelopeCarrier('not_admitted', null, code,
        `agent ${this.agentId}: queued turn rejected (${detail})`, { fencedBy: fenceHandle ?? null }))
    }
  }

  async runPromptExecution(entry) {
    const { mode, sessionId, text, opts, callerBoundMs, resolve, reject } = entry
    // Re-gate at the unified session/prompt write boundary (C-013).
    const gate = this.preAdmissionError(mode, sessionId, text, entry.promptBytes)
    if (gate !== null) {
      reject(gate)
      return
    }
    let handle
    try {
      // C-010: handle minted by the Router reconciliation store BEFORE the
      // watermark and any prompt bytes; capacity fails loud pre-reservation.
      handle = this.store.mintTurnExecution({
        agentId: this.agentId,
        processGeneration: this.processGeneration,
        sessionId,
        callerCorrelation: opts?.callerCorrelation ?? null,
      })
    } catch (cause) {
      reject(envelopeCarrier('not_admitted', null, cause?.code ?? 'RECONCILIATION_CAPACITY_EXHAUSTED', cause?.message ?? String(cause)))
      return
    }
    const execution = new TurnExecution({
      handle,
      sessionId,
      mode,
      watermarkSeq: this.eventSeq,
      startMono: monotonicNowMs(),
      deadlines: this.deadlines,
      bindingContext: opts?.bindingContext,
    })
    this.store.markAdmitted(handle, {
      eventWatermarkSeq: execution.watermarkSeq,
      deadlineAtWallMs: Date.now() + this.deadlines.turnTimeoutMs,
    })
    this.executions.set(handle, execution)
    if (mode === 'turn') this.activeBindingContext = opts?.bindingContext
    const startedWall = Date.now()
    execution.phase = 'prompt_sending'
    try {
      execution.phase = 'receipt_pending'
      const receipt = await this.promptWrite(execution, sessionId, text, opts)
      execution.promptMs = Date.now() - startedWall
      execution.phase = 'running'
      if (mode === 'deliver') {
        // Receipt-only: the caller returns now; the execution keeps its
        // terminal/unknown fence tracking in the background (C-010).
        resolve({
          accepted: true,
          sessionId,
          messageId: execution.receiptMessageId,
          ms: Date.now() - startedWall,
          status: 'completed',
          reconciliationHandle: handle,
          evidence: execution.evidenceSnapshot(),
        })
        this.installBackgroundTurnWatch(execution)
        return
      }
      const terminal = await this.awaitTerminal(execution, callerBoundMs)
      resolve({
        status: 'completed',
        reconciliationHandle: handle,
        reply: terminal.reply ?? '',
        ms: Date.now() - startedWall,
        promptMs: execution.promptMs,
        messageId: execution.receiptMessageId,
        evidence: execution.evidenceSnapshot(),
      })
    } catch (error) {
      this.handleExecutionCallerError(execution, error, reject)
    } finally {
      if (mode === 'turn') this.activeBindingContext = undefined
    }
  }

  async promptWrite(execution, sessionId, text, opts) {
    const receiptDeadlineMono = Math.min(execution.promptReceiptDeadlineMono, execution.turnDeadlineMono)
    const requestId = `req-${this.processGeneration}-${this.seq + 1}`
    execution.promptRequestId = requestId
    const receipt = await this.request('session/prompt', {
      sessionId,
      contentBlocks: [{ type: 'text', text }],
      ...(opts?.cwd === undefined ? {} : { cwd: opts.cwd }),
    }, undefined, {
      deadlineMono: receiptDeadlineMono,
      execution,
      onWriteAttempted: () => {
        execution.phase = 'prompt_sending'
        this.store.markPromptWriteAttempted(execution.handle)
      },
    })
    execution.receiptMessageId = receipt?.messageId ?? null
    execution.promptReceipt = receipt?.messageId !== undefined ? 'accepted' : 'unknown'
    this.store.markPromptReceipt(execution.handle, { messageId: execution.receiptMessageId })
    // C-011: exact receipt messageId is now bound — replay the bounded ring
    // from the watermark so events that arrived before this JSON-RPC
    // response are correctly attributed to this execution.
    this.replayExecutionFromWatermark(execution)
    return receipt
  }

  /** Wait for exact terminal + idle within min(turn deadline, caller bound). */
  awaitTerminal(execution, callerBoundMs) {
    const callerDeadlineMono = callerBoundMs !== undefined
      ? execution.startMono + callerBoundMs
      : Number.POSITIVE_INFINITY
    const waitDeadlineMono = Math.min(execution.turnDeadlineMono, callerDeadlineMono)
    const remaining = waitDeadlineMono - monotonicNowMs()
    execution.deadlineTimer = setTimeout(() => {
      if (execution.settled) return
      const source = callerDeadlineMono <= execution.turnDeadlineMono ? 'caller_wait_exceeded' : 'turn_deadline_exceeded'
      // C-014: timeout without termination proof -> outcome_unknown.
      this.markExecutionUnknown(execution, source)
      execution.terminalReject?.(envelopeCarrier('outcome_unknown', execution.handle, 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN',
        `turn for session ${execution.sessionId} (agent ${this.agentId}) passed its ${source === 'turn_deadline_exceeded' ? 'turn deadline' : 'caller wait bound'} without termination proof — outcome_unknown`,
        {
          source,
          deadlineAtWallMs: Date.now(),
          evidence: execution.evidenceSnapshot(),
        }))
      execution.terminalReject = undefined
    }, Math.max(0, remaining))
    execution.deadlineTimer.unref?.()
    return execution.terminalPromise
  }

  /** deliver(): background turn-deadline watch — unknown + fence, no caller. */
  installBackgroundTurnWatch(execution) {
    const remaining = execution.turnDeadlineMono - monotonicNowMs()
    execution.deadlineTimer = setTimeout(() => {
      if (execution.settled) return
      this.markExecutionUnknown(execution, 'turn_deadline_exceeded')
    }, Math.max(0, remaining))
    execution.deadlineTimer.unref?.()
  }

  handleExecutionCallerError(execution, error, reject) {
    if (error?.envelope === 'outcome_unknown') {
      if (!execution.unknownMarked) this.markExecutionUnknown(execution, error.source ?? 'unknown_source')
      // Turn-path prompt-receipt timeout is fatal per §10.3
      // PROMPT_RECEIPT_NEVER_REPLIES; deliver-path keeps reconciling.
      if (execution.mode === 'turn' && error.source === 'prompt_receipt_timeout') {
        void this.fatal('prompt_receipt_timeout')
      }
      reject(error)
      return
    }
    if (error?.envelope === 'not_admitted' && error.proven === 'zero_byte') {
      // Proven zero-byte: definitive not_admitted — no unknown fence. The
      // settlement usually already happened synchronously at the write
      // boundary (request sync-throw path); this is the idempotent backstop.
      if (!execution.settled) {
        try {
          this.store.settleDirect(execution.handle, {
            outcome: 'not_admitted',
            outcomeEvidence: 'proven_zero_byte_rejection',
            errorClass: error.code,
          })
        } catch (cause) {
          this.auditBounded({ kind: 'settlement_conflict', detail: redactSensitiveText(String(cause?.message ?? cause)) })
        }
        this.finishExecution(execution)
      }
      reject(error)
      return
    }
    // Stream/process-level rejection with the outcome unproven (C-004 /
    // C-017): stdin failure, child error/exit, input freeze — admission or
    // termination cannot be proven, so the execution enters outcome_unknown;
    // the fatal/exit machinery owns its late settlement.
    const admissionUnproven = error?.code === 'AGENT_PROCESS_UNAVAILABLE'
      || error?.code === 'AGENT_PROCESS_EXITED'
      || error?.source === 'stdin_write_failed'
    if (admissionUnproven && !execution.settled) {
      if (!execution.unknownMarked) this.markExecutionUnknown(execution, error?.source ?? 'process_unavailable')
      if (error instanceof Error && error.status === undefined) {
        error.status = 'outcome_unknown'
        error.envelope = 'outcome_unknown'
        error.reconciliationHandle = execution.handle
        error.evidence = execution.evidenceSnapshot()
      }
      reject(error)
      return
    }
    if (!execution.settled) {
      // Structured RPC error response (e.g. SESSION_WORKSPACE_MISMATCH) or
      // another definitive rejection with admission proven by the response.
      try {
        this.store.settleDirect(execution.handle, {
          outcome: 'failed',
          outcomeEvidence: 'rpc_error_response',
          terminationEvidence: null,
          errorClass: error?.code ?? null,
        })
      } catch (cause) {
        this.auditBounded({ kind: 'settlement_conflict', detail: redactSensitiveText(String(cause?.message ?? cause)) })
      }
      this.finishExecution(execution)
    }
    if (error instanceof Error && error.status === undefined) {
      error.status = 'failed'
      error.envelope = 'failed'
      error.reconciliationHandle = execution.handle
      error.evidence = execution.evidenceSnapshot()
    }
    reject(error)
  }

  // ------------------------------------------------------------ fatal/kill

  /**
   * C-009 fatal teardown primitive: CAS exact slot -> REAP FIRST, DRAINING,
   * stop admissions, reject queued, settle pending, authoritative
   * outcome_unknown for unproven executions, immediate-kill exact owned
   * child, await real exit (the exit callback completes the settlement).
   */
  fatal(cause) {
    if (this.state === 'EXITED') return this.exitPromise ?? Promise.resolve(this.exit)
    if (this.fatalInitiated) return this.exitPromise ?? Promise.resolve(this.exit)
    this.fatalInitiated = true
    this.fatalCause = cause
    // First registry mutation: atomic replace of the exact entry with the
    // generation-bound REAP fence (created child only).
    if (this.ownership !== null) {
      this.registryIntegration?.casReap?.(this, cause)
    }
    if (this.state !== 'DRAINING') this.transition('DRAINING')
    this.rejectQueuedTurns('AGENT_PROCESS_DRAINING', `fatal: ${cause}`)
    this.rejectAllPending('AGENT_PROCESS_UNAVAILABLE', { cause })
    for (const execution of [...this.executions.values()]) {
      if (!execution.settled && !execution.unknownMarked) {
        this.markExecutionUnknown(execution, cause)
        if (typeof execution.terminalReject === 'function') {
          execution.terminalReject(envelopeCarrier('outcome_unknown', execution.handle, 'AGENT_PROCESS_UNAVAILABLE',
            `agent ${this.agentId} entered fatal teardown (${cause}) without an outcome proof for this turn`, { source: cause, evidence: execution.evidenceSnapshot() }))
          execution.terminalReject = undefined
        }
      }
    }
    // Fatal policy: immediate kill of the EXACT Router-owned generation.
    this.killOwnedChild('SIGKILL', { cause })
    return this.exitPromise ?? Promise.resolve(this.exit ?? { code: null, signal: null })
  }

  /**
   * C-020: signal only the exact Router-owned child — the lifecycle REAP
   * identity (generation, processRef, ownershipToken, child object AND
   * original pid) must all match. PID equality alone never justifies a kill.
   */
  killOwnedChild(signal = 'SIGKILL', { cause } = {}) {
    if (this.state === 'EXITED' || this.ownership === null) return false
    const ownership = this.ownership
    if (this.child !== ownership.childObject
        || this.child?.pid !== ownership.pid
        || this.ownershipToken !== ownership.token) {
      this.auditBounded({ kind: 'ownership_mismatch', detail: `refusing ${signal} (cause ${cause ?? 'n/a'}): child identity does not match the spawn-time ownership binding` })
      this.log.error?.(`[router] agent ${this.agentId}: ownership mismatch — refusing to ${signal} a non-owned child`)
      return false
    }
    if (this.killSignalSent && signal === 'SIGKILL') return false // exactly one SIGKILL per generation
    if (signal === 'SIGKILL') this.killSignalSent = true
    this.counters.killSignals += 1
    try {
      this.child.kill(signal)
    } catch (cause2) {
      this.auditBounded({ kind: 'kill_failed', detail: redactSensitiveText(String(cause2?.message ?? cause2)) })
    }
    return true
  }

  /** Verify the process still matches a lifecycle REAP ownership binding. */
  verifyOwnership() {
    if (this.ownership === null) return false
    return this.child === this.ownership.childObject
      && this.child?.pid === this.ownership.pid
      && this.ownershipToken === this.ownership.token
  }

  // --------------------------------------------------------------- shutdown

  /**
   * Graceful shutdown; resolves with the settled exit evidence only AFTER
   * real exit + pending settlement + reconciliation visibility + exact REAP
   * cleanup (C-020). Concurrent callers share one promise (C-021); grace
   * expiry escalates to one exact SIGKILL and still awaits real exit (C-022).
   */
  async shutdown(timeoutMs) {
    if (this.exit !== undefined) return this.exit
    if (this.shutdownPromise !== undefined) return this.shutdownPromise
    const graceMs = timeoutMs ?? this.deadlines.shutdownGraceMs
    this.shutdownPromise = this.performShutdown(graceMs)
    return this.shutdownPromise
  }

  async performShutdown(graceMs) {
    if (this.exit !== undefined) return this.exit
    if (this.ownership === null || this.child === undefined) {
      // Never-spawned / no-child process: logical DRAINING -> EXITED.
      if (this.state !== 'EXITED') {
        if (this.state !== 'DRAINING') this.transition('DRAINING')
        this.rejectQueuedTurns('AGENT_PROCESS_DRAINING', 'shutdown')
        this.registryIntegration?.casStartupEmpty?.(this)
        this.transition('EXITED')
      }
      return this.exit ?? { code: null, signal: null }
    }
    // Explicit operator/runtime shutdown: graceful-then-kill (C-020/C-022).
    this.registryIntegration?.casReap?.(this, 'shutdown')
    // C-020 ownership gate: when a lifecycle REAP fence exists for this
    // process, its ownership binding (generation + processRef + ownership
    // token) must match BEFORE any graceful write or signal. A mismatch is
    // fail-loud audit + fence retention — never a guessed kill or write.
    if (this.registryIntegration !== null && typeof this.registryIntegration.verifyReapOwnership === 'function'
        && !this.registryIntegration.verifyReapOwnership(this) && this.state !== 'EXITED') {
      this.auditBounded({ kind: 'ownership_mismatch', detail: 'shutdown refused: lifecycle REAP ownership does not match this process' })
      this.log.error?.(`[router] agent ${this.agentId}: shutdown refused — REAP ownership mismatch (kill/write counts stay 0)`)
      throw Object.assign(new Error(`agent-router: shutdown of ${this.agentId} refused — lifecycle REAP ownership mismatch`), { code: 'AGENT_PROCESS_OWNERSHIP_MISMATCH' })
    }
    if (this.state !== 'DRAINING') this.transition('DRAINING')
    this.rejectQueuedTurns('AGENT_PROCESS_DRAINING', 'shutdown')
    // Graceful attempt: ONE shutdown RPC bounded by the grace deadline.
    this.counters.gracefulShutdownWriteAttempts += 1
    await this.request('shutdown', undefined, undefined, {
      deadlineMono: monotonicNowMs() + graceMs,
    }).catch(() => {})
    if (this.exit === undefined) {
      // Grace expiry is ESCALATION, not completion: one exact SIGKILL, then
      // await real exit — never a fake {timeout:true} terminal.
      this.killOwnedChild('SIGKILL', { cause: 'shutdown_grace_expired' })
    }
    await this.exitPromise
    return this.exit
  }

  /** SIGKILL (crash path); resolves with the settled exit. */
  kill9() {
    this.killOwnedChild('SIGKILL', { cause: 'kill9' })
    return this.exitPromise ?? Promise.resolve(this.exit ?? { code: null, signal: null })
  }

  // ------------------------------------------------------- scheduler seam

  /**
   * §13.1 minimal owned snapshot per turnExecutionId — the Scheduler
   * termination seam (no Scheduler policy). Absence semantics delegate to
   * the Router reconciliation store.
   */
  turnExecutionSnapshot(turnExecutionId) {
    const record = this.store.getTurnReconciliation(turnExecutionId)
    if (record.state === 'restart_lost' || record.state === 'never_existed' || record.state === 'evicted') {
      return { turnExecutionId, state: record.state }
    }
    const snapshot = record.snapshot
    const execution = this.executions.get(turnExecutionId)
    return {
      turnExecutionId,
      agentId: this.agentId,
      processGeneration: this.processGeneration,
      callerCorrelation: snapshot.callerCorrelation ?? null,
      phase: execution?.phase ?? (snapshot.state === 'settled' ? 'terminal' : 'outcome_unknown'),
      promptReceipt: execution?.promptReceipt ?? (snapshot.messageId !== null && snapshot.messageId !== undefined ? 'accepted' : 'unknown'),
      initialOutcome: snapshot.initialOutcome,
      reconciledOutcome: snapshot.lateOutcome ?? snapshot.outcome ?? null,
      outcomeEvidence: snapshot.outcomeEvidence,
      cancelRequested: snapshot.cancelRequested === true,
      cancelRequestedAtWallMs: snapshot.cancelRequestedAtWallMs ?? null,
      terminationProven: snapshot.terminationEvidence !== null && snapshot.terminationEvidence !== undefined,
      terminationEvidence: snapshot.terminationEvidence ?? null,
      reconciliationHandle: turnExecutionId,
      finalAssistantOutputAvailable: snapshot.finalAssistantOutput !== null && snapshot.finalAssistantOutput !== undefined,
      finalAssistantOutputTruncated: snapshot.finalAssistantOutput?.truncated === true,
      updatedAtWallMs: snapshot.settledAtWallMs ?? snapshot.createdAtWallMs,
    }
  }
}
