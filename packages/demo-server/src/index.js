/**
 * @agent-core/demo-server — the process-model demo's long-lived app plugin.
 *
 * One DSH process hosts one Agent's sessions and serves them over
 * newline-delimited JSON-RPC on stdio (the same wire as the official
 * `dsh-sdk-jsonrpc-server`, so the demo driver speaks the standard protocol).
 *
 * The one deliberate difference from the official SDK server: **session
 * resume**. The SDK server's `getOrCreateSession` always calls
 * `ctx.agents.create()`, which mints a fresh session even when a persisted
 * log exists (verified empirically in the V0 demo investigation). This server
 * instead checks the configured persistence backend and:
 *
 *   - session artifact absent  -> `ctx.agents.create()` (cold start)
 *   - session artifact present -> `ctx.agents.resume()` (cold resume, the
 *     process loads the JSONL log and the model continues the same
 *     conversation)
 *
 * The choice is observable on stderr as `[demo-server] session <id>
 * resumed|created (N events)`, which the benchmark asserts on.
 *
 * Parent-RPC passthrough (the only transport extension over the SDK wire):
 * a per-agent plugin (e.g. the DSH switch tool) can call
 * `ctx.agentRpc.request(method, params)`; this server emits a `rpc.request`
 * notification on stdout, and the parent (the Router / Control Plane)
 * answers with a `rpc.response` request on stdin, which resolves the
 * plugin's promise. The server only relays — the method names and their
 * meaning belong to the caller and the Control Plane; the per-agent process
 * never touches Router state directly.
 *
 * stdout stays pure JSON-RPC. All diagnostics go to stderr.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

import z from '@deepseek-ai/schemastery'

import { createSessionSeam, SESSION_WORKSPACE_MISMATCH } from './session-seam.js'

/** Stable plugin name referenced by bundle patches. */
export const name = 'demo-server'

// AGENT_CORE_BINDING_WORKSPACE_V1 §Errors: re-exported so callers/tests can
// import the structured rejection code from the package root.
export { SESSION_WORKSPACE_MISMATCH }

/** The agent factory is the only hard dependency; everything else is optional. */
export const inject = ['agents']

/** Server config: none today (transport hooks would mirror the SDK server). */
export const Config = z.object({})

/** Wire protocol method → handler. */
const METHODS = new Set(['initialize', 'session/prompt', 'shutdown', 'rpc.response'])

/**
 * Serve the demo protocol over process stdio for the process lifetime.
 * @param ctx - plugin context carrying the agent factory and optional services.
 */
export function apply(ctx) {
  const pendingRpc = new Map() // requestId -> { resolve, reject }
  // Parent mints one opaque execution handle per prompt. AsyncLocalStorage
  // preserves its origin across delayed async work, so an RPC born in turn A
  // cannot inherit turn B merely because B is current when it reaches stdout.
  const rpcTurnContext = new AsyncLocalStorage()
  const exit = () => { process.exit(0) }
  const notify = (method, params) => {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }

  let rpcSeq = 0

  /**
   * Parent-RPC service: `agentRpc.request(method, params)` resolves with the
   * Control Plane's answer `{ ok, result?, error? }`. Transport only — the
   * server neither knows nor validates the method names.
   */
  const agentRpc = {
    request(method, params) {
      if (typeof method !== 'string' || method === '') {
        return Promise.reject(new TypeError('agentRpc.request: method must be a non-empty string'))
      }
      return new Promise((resolveRequest, rejectRequest) => {
        const requestId = `rpc-${++rpcSeq}`
        pendingRpc.set(requestId, { resolve: resolveRequest, reject: rejectRequest })
        notify('rpc.request', {
          requestId,
          method,
          params,
          turnExecutionId: rpcTurnContext.getStore(),
        })
      })
    },
  }

  let cwd = process.cwd()
  let provider = 'opencode-go'
  let model = 'deepseek-v4-flash'
  let maxTokens

  // The per-session resolution seam (AGENT_CORE_BINDING_WORKSPACE_V1
  // SESSION_WRITE_CONTRACT R1/R2/R3): create freezes the resolved effective
  // workspace into meta:{cwd}; resume restores the persisted header and
  // verifies it against the resolved workspace; a mismatch is a structured
  // SESSION_WORKSPACE_MISMATCH rejection. Getters observe the
  // initialize-time values at call time.
  const seam = createSessionSeam({
    ctx,
    settings: {
      get cwd() { return cwd },
      get provider() { return provider },
      get model() { return model },
      get maxTokens() { return maxTokens },
    },
  })
  const { handles, pendingCreations, prompt } = seam

  // Mirror the SDK server's event fan-out: every durable fact streams as
  // session.event, every whole-agent lifecycle transition as session.status.
  const offEvent = ctx.on('session/event', (session, event) => {
    notify('session.event', { sessionId: String(session.id), event })
  })
  const offStatus = ctx.on('agent/status', ({ agent, status }) => {
    notify('session.status', { sessionId: String(agent.session.id), status })
  })

  /** Dispose every owned agent and flush sessions, then exit 0. */
  async function shutdown() {
    const live = [...handles.values()]
    handles.clear()
    pendingCreations.clear()
    for (const handle of live) {
      try {
        await sessions?.flush(handle.agent.session)
      } catch {
        // best effort; dispose still runs
      }
      await handle.dispose().catch(() => {})
    }
    offEvent()
    offStatus()
    // Exit only after the caller has written the response for this request,
    // and only after the root fiber disposed (which releases the owner guard
    // lock and lets the persistence coordinator retire to quiescence) — the
    // same ordering the official SDK server uses.
    setImmediate(() => {
      void ctx.root.fiber.dispose().finally(() => exit())
    })
    return {}
  }

  // Keep the process alive until shutdown/EOF.
  let buffer = ''
  const onData = (chunk) => {
    buffer += chunk
    let index
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      if (line.trim() === '') continue
      let message
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }
      void handleLine(message)
    }
  }
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', onData)
  process.stdin.on('end', () => { void shutdown() })
  process.stderr.write(`[demo-server] ready pid=${process.pid}\n`)

  async function handleLine(message) {
    const { id, method, params } = message
    if (typeof method !== 'string' || !METHODS.has(method)) {
      if (id !== undefined) respond(id, undefined, { code: -32601, message: `unknown method: ${method}` })
      return
    }
    try {
      let result
      if (method === 'initialize') {
        cwd = params?.cwd ?? process.cwd()
        provider = params?.provider ?? provider
        model = params?.model ?? model
        maxTokens = params?.maxTokens
        const registeredProviders = ctx.get('llm')?.listProviders().map((entry) => entry.id) ?? []
        result = {
          serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.0.1' },
          route: { provider, model },
          registeredProviders,
          pluginServices: { openAICodex: ctx.get('openAICodex') !== undefined },
        }
      } else if (method === 'session/prompt') {
        // params.cwd = the Router-resolved effective workspace for THIS
        // session (AGENT_CORE_BINDING_WORKSPACE_V1); absent => the
        // initialize-time process cwd (legacy/scheduler callers).
        result = await rpcTurnContext.run(
          params?.turnExecutionId,
          () => prompt(params?.sessionId, params?.contentBlocks ?? [], params?.cwd),
        )
      } else if (method === 'rpc.response') {
        // Parent's answer to a rpc.request: resolve the pending plugin call.
        const waiter = pendingRpc.get(params?.requestId)
        if (waiter !== undefined) {
          pendingRpc.delete(params.requestId)
          if (params?.ok === true) waiter.resolve({ ok: true, result: params.result })
          else waiter.reject(new Error(params?.error ?? 'parent RPC failed'))
        }
        result = {}
      } else {
        result = await shutdown()
      }
      respond(id, result, undefined)
    } catch (error) {
      process.stderr.write(`[demo-server] ${method} failed: ${error instanceof Error ? error.message : String(error)}\n`)
      // STRUCTURED rejections (e.g. SESSION_WORKSPACE_MISMATCH) keep their
      // string code on the wire so the Router can surface them verbatim.
      respond(id, undefined, {
        code: typeof error?.code === 'string' ? error.code : -32603,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  function respond(id, result, error) {
    if (id === undefined) return
    const payload = { jsonrpc: '2.0', id }
    if (error !== undefined) payload.error = error
    else payload.result = result
    process.stdout.write(`${JSON.stringify(payload)}\n`)
  }

  // Publish the parent-RPC passthrough for sibling plugins in the same
  // per-agent composition (e.g. @agent-core/agent-switch).
  ctx.provide('agentRpc', agentRpc)
}
