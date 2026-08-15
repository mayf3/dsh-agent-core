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
 * Zero DSH imports: only node builtins + the shared demo-home provisioner.
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cliBin } from '../../../scripts/demo-home.mjs'

const DEFAULT_PROFILE = 'agent-core-demo'

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
  constructor({ agentId, home, workspace, profile = DEFAULT_PROFILE, log = console, env = {} }) {
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
    /** Router-installed hook: async (method, params) => result. */
    this.onRpcRequest = undefined
  }

  /** Spawn the dsh CLI child. Does not wait for readiness. */
  spawn() {
    const child = spawn(process.execPath, [cliBin(), '--profile', this.profile], {
      cwd: this.workspace,
      env: agentEnv(this.home, this.env),
      stdio: ['pipe', 'pipe', 'pipe'],
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

  request(method, params) {
    return new Promise((resolveRequest, rejectRequest) => {
      const id = ++this.seq
      this.pending.set(id, { resolve: resolveRequest, reject: rejectRequest })
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
   * @param {string} sessionId
   * @param {string} text
   * @param {object} [opts]
   * @param {string} [opts.bindingContext] - the ChannelConversation this
   *   turn belongs to; while the turn is in flight the switch tool relay
   *   targets exactly this Binding.
   */
  async turn(sessionId, text, opts = {}, timeoutMs = Number.parseInt(process.env.DSH_AGENT_TURN_TIMEOUT ?? '300000', 10)) {
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
      this.activeBindingContext = undefined
    }
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
