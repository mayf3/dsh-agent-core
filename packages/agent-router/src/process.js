/**
 * @agent-core/agent-router/src/process.js — per-agent DSH process client.
 *
 * Extracted (and slimmed) from the process-model benchmark driver
 * (`scripts/process-model-demo.mjs`, verified A–F) into the component the
 * Router / Control Plane owns. One process per Agent: spawns
 * `dsh --profile <agentProfile>` with the agent's own DSH_HOME + workspace,
 * speaks newline-delimited JSON-RPC over stdio (initialize / session/prompt /
 * shutdown — the demo-server protocol), buffers `session.event` /
 * `session.status` notifications, and resolves one "turn" when the whole
 * agent goes idle again.
 *
 * Parent-RPC relay: per-agent plugins (e.g. the DSH switch tool) can ask the
 * Control Plane to run a Router domain operation. The demo-server emits a
 * `rpc.request` notification on stdout; this client dispatches it to the
 * `onRpcRequest` hook the router installs and answers over stdin with a
 * `rpc.response` request. This client only relays — it owns no policy.
 *
 * Zero DSH imports: only node builtins + the shared provisioning package
 * (@agent-core/agent-provisioning, extracted from the old demo-home script).
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cliBin } from '../../agent-provisioning/src/index.js'

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

/** Base environment for one agent process (its own home, workspace as cwd). */
export function agentEnv(home, extra = {}) {
  const env = {
    ...process.env,
    DSH_HOME: home,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    ...extra,
  }
  if (env.OPENCODE_GO_API_KEY === undefined) {
    const credentialFile = join(home, '.credentials.yaml')
    if (existsSync(credentialFile)) {
      const match = readFileSync(credentialFile, 'utf8').match(/^OPENCODE_GO_API_KEY:\s*"?([^"\n]+)"?/m)
      if (match !== null) env.OPENCODE_GO_API_KEY = match[1]
    }
  }
  return env
}

/**
 * One owned DSH agent process. `turn()` is the only business entry: prompt a
 * session, wait for the receipt + whole-agent idle, return the last assistant
 * text. `exit` promise settles when the OS process dies (any cause).
 */
export class AgentProcess {
  constructor({ agentId, home, workspace, profile, log = console, env = {} }) {
    if (typeof profile !== 'string' || profile === '') {
      throw new TypeError('AgentProcess: profile is required (no default — the caller owns the composition choice)')
    }
    this.agentId = agentId
    this.home = home
    this.workspace = workspace
    this.profile = profile
    this.log = log
    this.env = env // extra env for the child (e.g. DSH_AGENT_ID)
    this.pid = undefined
    this.exit = undefined // { code, signal } once settled
    this.stderr = ''
    this.events = [] // session.event notifications
    this.status = {} // sessionId -> agent status
    this.creations = [] // parsed [demo-server] session ... lines
    this.buf = ''
    this.pending = new Map()
    this.seq = 0
    this.exitPromise = undefined
    this.exitResolve = undefined
    this.child = undefined
    /** ChannelConversation of the in-flight turn (set by turn(); the switch
     *  tool relay uses it to target exactly this conversation's Binding). */
    this.activeBindingContext = undefined
    /** Per-process single-flight turn queue (FIX 2): one routed turn at a
     *  time per AgentProcess; see turn(). */
    this.turnQueue = Promise.resolve()
    /** Router-installed hook: async (method, params) => result. */
    this.onRpcRequest = undefined
  }

  /** Spawn the dsh CLI child. Does not wait for readiness. */
  spawn() {
    const { argv, spawnUid, spawnGid } = childSpawnConfig(this.log)
    const program = argv[0]
    const args = [...argv.slice(1), cliBin(), '--profile', this.profile]
    // Direct setuid is only legal from root or the same uid; anything else
    // (e.g. a 505 parent without the root-bootstrapped helper) must fail
    // LOUD rather than silently run the child at the parent's identity.
    if (spawnUid !== undefined && spawnUid !== process.getuid?.() && process.getuid?.() !== 0) {
      throw new Error(
        `agent-router: cannot drop child to uid ${spawnUid} from uid ${process.getuid()} without DSH_AGENT_SPAWN_HELPER`,
      )
    }
    const child = spawn(program, args, {
      cwd: this.workspace,
      env: agentEnv(this.home, this.env),
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(spawnUid === undefined ? {} : { uid: spawnUid, gid: spawnGid }),
    })
    this.child = child
    this.pid = child.pid
    this.exitPromise = new Promise((resolveExit) => {
      this.exitResolve = resolveExit
    })
    child.once('error', (error) => {
      this.exitResolve?.({ code: null, signal: null, error })
    })
    child.once('exit', (code, signal) => {
      this.exit = { code, signal }
      this.exitResolve?.({ code, signal })
    })
    child.stderr.on('data', (chunk) => {
      this.stderr += chunk
      for (const line of String(chunk).split('\n')) {
        const match = line.match(/\[demo-server\] session (\S+) (created|resumed) \((\d+) events\)/)
        if (match !== null) {
          this.creations.push({ sessionId: match[1], mode: match[2], events: Number(match[3]) })
          this.log.log?.(`[router] agent ${this.agentId}: session ${match[1]} ${match[2]} (${match[3]} events)`)
        }
      }
    })
    child.stdout.on('data', (chunk) => this.onStdout(String(chunk)))
    return this
  }

  onStdout(chunk) {
    this.buf += chunk
    let index
    while ((index = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, index)
      this.buf = this.buf.slice(index + 1)
      if (line.trim() === '') continue
      let message
      try { message = JSON.parse(line) } catch { continue }
      if (message.id !== undefined) {
        const waiter = this.pending.get(message.id)
        if (waiter !== undefined) {
          this.pending.delete(message.id)
          if (waiter.timer !== undefined) clearTimeout(waiter.timer)
          if (message.error !== undefined) waiter.reject(new Error(`${message.error.code ?? -1}: ${message.error.message}`))
          else waiter.resolve(message.result)
        }
      } else if (message.method === 'session.event') {
        this.events.push(message.params)
      } else if (message.method === 'session.status') {
        this.status[message.params.sessionId] = message.params.status
      } else if (message.method === 'rpc.request') {
        // A per-agent plugin asks the Control Plane to run a Router domain
        // operation; the answer goes back over stdin as rpc.response.
        this.handleRpcRequest(message.params)
      }
    }
  }

  /**
   * Relay one parent-RPC request to the router-installed hook and answer the
   * child (best-effort: a dead child cannot be answered, and the pending
   * tool call dies with it).
   */
  async handleRpcRequest({ requestId, method, params } = {}) {
    if (typeof requestId !== 'string' || typeof method !== 'string') return
    let result
    let error
    try {
      if (typeof this.onRpcRequest !== 'function') {
        throw new Error(`process ${this.agentId}: no parent-RPC handler for ${method}`)
      }
      result = await this.onRpcRequest(method, params)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }
    await this.request('rpc.response', { requestId, ok: error === undefined, result, error }).catch(() => {})
  }

  /**
   * JSON-RPC request to the demo-server child. An optional `timeoutMs`
   * rejects (and removes) the pending entry when the receipt does not
   * arrive — used by the delivery seam so a dead child can never hang a
   * caller forever.
   * @param {string} method
   * @param {object|undefined} params
   * @param {number} [timeoutMs]
   */
  request(method, params, timeoutMs) {
    return new Promise((resolveRequest, rejectRequest) => {
      const id = ++this.seq
      const entry = { resolve: resolveRequest, reject: rejectRequest }
      this.pending.set(id, entry)
      if (timeoutMs !== undefined) {
        entry.timer = setTimeout(() => {
          this.pending.delete(id)
          rejectRequest(new Error(`request ${method} timed out after ${timeoutMs}ms (agent ${this.agentId})`))
        }, timeoutMs)
      }
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  }

  /** spawn → initialize (retries until the model route registers). */
  async ready(timeoutMs = 90000) {
    const started = Date.now()
    for (;;) {
      try {
        await this.request('initialize', {
          cwd: this.workspace,
          provider: process.env.DSH_AGENT_PROVIDER ?? 'opencode-go',
          model: process.env.DSH_AGENT_MODEL ?? 'deepseek-v4-flash',
          maxTokens: Number.parseInt(process.env.DSH_AGENT_MAX_TOKENS ?? '8192', 10),
        })
        this.log.log?.(`[router] agent ${this.agentId} ready pid=${this.pid} (${Date.now() - started}ms)`)
        return Date.now() - started
      } catch {
        if (Date.now() - started > timeoutMs) throw new Error(`initialize timeout for agent ${this.agentId}`)
        await new Promise(resolveTimeout => setTimeout(resolveTimeout, 300))
      }
    }
  }

  /**
   * One owned turn: prompt `sessionId` with `text`, wait for the receipt then
   * the whole-agent idle, return `{ reply, ms, promptMs, messageId }`.
   *
   * PER-PROCESS SINGLE-FLIGHT (FIX 2): DSH's native queue is per Agent
   * instance = per native Session — two sessions of the same process can run
   * turns concurrently (empirically verified). `activeBindingContext` is a
   * single shared field, so concurrent turns would overwrite each other's
   * binding and the switch tool relay could target the wrong conversation.
   * Product semantics: ONE Agent processes ONE routed turn at a time; later
   * turns wait until the previous one truly ends (including tools /
   * parent-RPC / turn/end). `turn()` therefore serializes every call through
   * a per-AgentProcess promise chain — no mailbox, no turnId framework, the
   * DSH queue is untouched.
   *
   * @param {string} sessionId
   * @param {string} text
   * @param {object} [opts]
   * @param {string} [opts.bindingContext] - the ChannelConversation this
   *   turn belongs to; while the turn is in flight the switch tool relay
   *   targets exactly this Binding.
   */
  turn(sessionId, text, opts = {}, timeoutMs = Number.parseInt(process.env.DSH_AGENT_TURN_TIMEOUT ?? '300000', 10)) {
    // Serialize: run this turn only after every previously submitted turn has
    // fully settled. The chain survives rejections so a failed turn never
    // wedges the queue.
    const run = this.turnQueue.then(() => this.runTurn(sessionId, text, opts, timeoutMs))
    this.turnQueue = run.then(() => undefined, () => undefined)
    return run
  }

  /** The actual turn body; never called concurrently (see turn()). */
  async runTurn(sessionId, text, opts, timeoutMs) {
    const started = Date.now()
    this.activeBindingContext = opts.bindingContext
    try {
      const receipt = await this.request('session/prompt', {
        sessionId,
        contentBlocks: [{ type: 'text', text }],
      })
      const promptMs = Date.now() - started
      const before = this.events.length
      let received = false
      let done = false
      while (!done && Date.now() - started < timeoutMs) {
        await new Promise(resolveTimeout => setTimeout(resolveTimeout, 100))
        for (let i = before; i < this.events.length; i += 1) {
          const ev = this.events[i]
          if (ev.sessionId !== sessionId) continue
          if (!received && JSON.stringify(ev.event).includes(receipt.messageId)) received = true
        }
        if (received && this.status[sessionId] === 'idle') done = true
      }
      if (!done) throw new Error(`turn timeout for session ${sessionId} (agent ${this.agentId})`)
      const texts = this.events
        .filter(ev => ev.sessionId === sessionId && ev.event.type === 'assistant/message')
        .map(ev => (ev.event.data?.message?.content ?? [])
          .filter(block => block.type === 'text').map(block => block.text).join(''))
      return { reply: texts.at(-1) ?? '', ms: Date.now() - started, promptMs, messageId: receipt.messageId }
    } finally {
      // Only after the WHOLE turn truly ended (turn/end observed, idle) is the
      // shared binding context released — the next queued turn then sets its own.
      this.activeBindingContext = undefined
    }
  }

  /**
   * ADMISSION SEAM (Agent Router Delivery V0): accept one message into a
   * session's inbox WITHOUT waiting for the model turn.
   *
   * Resolves on the demo-server receipt — the JSON-RPC response to
   * `session/prompt`, which the server writes ONLY after
   * `handle.agent.followup(message)` returned. `followup` is DSH's
   * synchronous inbox insertion (`send(..., 'next-turn', true)` ->
   * `inbox.splice()` + `wakeDriver()`, core/agent-loop/src/agent.ts) and
   * returns void — so the receipt means exactly "the DSH session accepted
   * the message into its native queue", never "the turn finished". The
   * model turn continues asynchronously; the caller may poll the session
   * trajectory or the agent status later.
   *
   * Deliberately NOT serialized through the turn single-flight queue: a
   * delivery must not wait for any turn/job to complete (the DSH native
   * queue per session orders messages anyway). It also never touches
   * `activeBindingContext` — a delivery has no ChannelConversation.
   *
   * @param {string} sessionId - the native session to accept into (the
   *   Router decides it: 'main' or a fresh-mapped id).
   * @param {string} text - the message text.
   * @param {number} [timeoutMs] - receipt wait cap (default
   *   $DSH_AGENT_DELIVER_TIMEOUT or 30s); a dead child then rejects instead
   *   of hanging the caller. Only the RECEIPT is bounded — the turn itself
   *   keeps running regardless.
   * @returns {Promise<{accepted:true, sessionId:string, messageId:string,
   *   ms:number}>}
   */
  deliver(sessionId, text, timeoutMs = Number.parseInt(process.env.DSH_AGENT_DELIVER_TIMEOUT ?? '30000', 10)) {
    const started = Date.now()
    return this.request('session/prompt', {
      sessionId,
      contentBlocks: [{ type: 'text', text }],
    }, timeoutMs).then((receipt) => ({
      accepted: true,
      sessionId,
      messageId: receipt.messageId,
      ms: Date.now() - started,
    }))
  }

  /** Graceful JSON-RPC shutdown; resolves with the settled exit. */
  async shutdown(timeoutMs = 30000) {
    if (this.exit !== undefined) return this.exit
    await Promise.race([
      this.request('shutdown', undefined).catch(() => {}),
      new Promise(resolveTimeout => setTimeout(resolveTimeout, 5000)),
    ])
    const settled = await Promise.race([
      this.exitPromise,
      // NOTE: setTimeout returns a Timeout, not a Promise — the historical
      // `setTimeout(...).then(...)` form was a latent bug on modern Node
      // (recorded as an integration need in docs/reports/agent-session-v1.md).
      new Promise(resolveTimeout => setTimeout(() => resolveTimeout({ code: null, signal: null, timeout: true }), timeoutMs)),
    ])
    return settled
  }

  /** SIGKILL (crash path); resolves with the settled exit. */
  kill9() {
    try { this.child.kill('SIGKILL') } catch { /* already dead */ }
    return this.exitPromise
  }
}
