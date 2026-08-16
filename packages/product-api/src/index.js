/**
 * @agent-core/product-api — Gate 1 thin Mobile Product API (HTTP adapter).
 *
 * ONE transport for the Android Emulator local slice:
 *
 *   Android Emulator -> adb reverse -> localhost:8787 (this server)
 *     -> Router / Control Plane -> Binding -> per-agent DSH process -> reply
 *
 * The server is a THIN ADAPTER over existing Control Plane capabilities
 * (`ctx.agentRouter` domain operations + `ctx.agentDefinition` reads). It owns
 * NONE of: routing policy, process lifecycle, session selection policy
 * (switch-agent merely calls Router.switchAgent — bookmark / main decisions
 * belong to the Router), workspace / DSH_HOME / credential / memory
 * internals.
 *
 * Surface model (Gate 1 防扩张约束): surfaceType = mobile is a fixed
 * constant; surfaceId is a stable opaque id GENERATED AND PERSISTED BY THE
 * ANDROID CLIENT (first launch UUID, reused on restart). The backend never
 * interprets the id — it only consumes it as the Product Surface Binding
 * scope: `surfaceId -> ChannelConversation(channel='mobile',
 * externalId=surfaceId)` (M13), i.e. Binding key `mobile:<surfaceId>`. No
 * Surface Registry, no Device Registry, no session registry, no history,
 * no navigation stack, no DSH metadata.
 *
 * Gate 1 MAX API SURFACE (nothing else is routed):
 *
 *   GET  /v1/binding?surfaceId=<id>      current Binding | 404 BINDING_NOT_FOUND
 *   GET  /v1/agents                      registered Agents
 *   POST /v1/switch-agent                { surfaceId, targetAgentId } ONLY
 *   POST /v1/message                     { surfaceId, text } -> { reply, agentId, sessionId }
 *
 * switch-agent is targetAgentId-ONLY (merge audit FIX 2): the Mobile Gate 1
 * contract has no sessionId on the wire — the Router decides the target
 * Session (per-surface bookmark ?? main). The Router's internal explicit
 * targetSessionId seam (the DSH switch tool via parent-RPC) is untouched;
 * the Product API wire deliberately does not expose it, and a request that
 * carries sessionId is rejected with VALIDATION_ERROR.
 *
 * getMessages is deliberately NOT implemented: the synchronous
 * request -> response vertical slice returns the reply in the POST /message
 * response, so history is not a blocker (per Gate 1 brief).
 *
 * Transport posture (Gate 1): the HTTP server binds 127.0.0.1 ONLY and
 * serves exactly the Android Emulator -> adb reverse -> localhost path.
 * No auth, no TLS, no LAN exposure, no hardening.
 *
 * Errors use the frozen contract envelope: { "error": { "code", "message" } }
 * with codes from AGENT_SESSION_CHANNEL_MODEL_V1.api.json.
 */

import { createServer } from 'node:http'
import z from '@deepseek-ai/schemastery'

/** Stable plugin name referenced by bundle patches. */
export const name = 'product-api'

/**
 * The Router and the Agent Definition are HARD dependencies: Cordis enters
 * waiting and re-applies this plugin once both are provided (the loader
 * applies sibling include entries concurrently, so reading them via ctx.get
 * at apply time would race — inject is the framework-blessed ordering).
 */
export const inject = ['agentRouter', 'agentDefinition']

/** Product API config. */
export const Config = z.object({
  /** Whether the HTTP server is mounted at all (control-plane opt-out). */
  enabled: z.boolean().default(true),
  /** Bind host. Gate 1: 127.0.0.1 only — adb reverse targets localhost. */
  host: z.string().default('127.0.0.1'),
  /** Bind port; `adb reverse tcp:<port> tcp:<port>` maps the emulator to it. */
  port: z.number().default(8787),
  /** Product Surface channel tag (surfaceType). Fixed 'mobile' in Gate 1. */
  channel: z.string().default('mobile'),
})

/** JSON reply helper. */
function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** Error envelope per the frozen contract. */
function errorBody(code, message) {
  return { error: { code, message } }
}

/** Map a Router/Agent-Definition error to the contract's HTTP status. */
function httpStatusFor(error) {
  if (error?.code === 'AGENT_NOT_FOUND') return 404
  if (error?.code === 'BINDING_NOT_FOUND') return 404
  if (error?.code === 'VALIDATION_ERROR') return 400
  return 500
}

/** Read the whole request body (small JSON, bounded). */
function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1_000_000) {
        rejectBody(Object.assign(new Error('request body too large'), { code: 'VALIDATION_ERROR' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') { resolveBody({}); return }
      try { resolveBody(JSON.parse(text)) } catch { rejectBody(Object.assign(new Error('body must be JSON'), { code: 'VALIDATION_ERROR' })) }
    })
    req.on('error', rejectBody)
  })
}

/** Non-empty string field validation helper. */
function requireString(body, field) {
  const value = body?.[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw Object.assign(new TypeError(`product-api: ${field} must be a non-empty string`), { code: 'VALIDATION_ERROR' })
  }
  return value
}

/**
 * Mount the Product API HTTP server and publish `ctx.productApi`.
 * @param ctx - plugin context (must carry agentRouter + agentDefinition).
 * @param config - validated config.
 */
export function apply(ctx, config = {}) {
  // Schema defaults are applied explicitly (a raw spread of the schema
  // object does not coerce defaults — same pattern as the router).
  const cfg = {
    enabled: config.enabled ?? true,
    host: config.host ?? '127.0.0.1',
    port: Number.isFinite(config.port) ? config.port : 8787,
    channel: config.channel ?? 'mobile',
  }
  const log = {
    log: (...args) => process.stderr.write(`[product-api] ${args.join(' ')}\n`),
    error: (...args) => process.stderr.write(`[product-api] ERROR ${args.join(' ')}\n`),
  }

  const router = ctx.get('agentRouter')
  const definition = ctx.get('agentDefinition')
  if (router === undefined) {
    throw new Error('product-api: agentRouter service not available (mount @agent-core/agent-router first)')
  }
  if (definition === undefined) {
    throw new Error('product-api: agentDefinition service not available (mount @agent-core/agent-definition first)')
  }

  /**
   * Product Surface Binding scope: surfaceId -> ChannelConversation id
   * (M13). The id format is owned by the Router service — the API never
   * invents a convention of its own (sibling packages talk through
   * services, not module imports).
   */
  const ccIdFor = (surfaceId) => router.channelConversationId(cfg.channel, surfaceId)

  /** GET /v1/binding?surfaceId= — current Binding or 404. */
  function getBinding(query) {
    const surfaceId = query?.get?.('surfaceId') ?? ''
    const binding = router.getBinding(ccIdFor(surfaceId))
    if (binding === undefined) {
      throw Object.assign(new Error(`no binding for surface: ${surfaceId}`), { code: 'BINDING_NOT_FOUND' })
    }
    return binding
  }

  /**
   * POST /v1/switch-agent — targetAgentId-ONLY (Gate 1 contract, audit
   * FIX 2). The ONLY session-selection caller here is Router.switchAgent;
   * bookmark/main decisions happen in the Router. The wire never carries
   * sessionId: the Router's internal explicit-targetSession seam (DSH
   * switch tool) stays, but the Product API rejects it.
   */
  async function switchAgent(body) {
    const surfaceId = requireString(body, 'surfaceId')
    const targetAgentId = requireString(body, 'targetAgentId')
    if (body?.sessionId !== undefined) {
      throw Object.assign(new TypeError('product-api: sessionId is not part of the Gate 1 switch-agent contract'), {
        code: 'VALIDATION_ERROR',
      })
    }
    const binding = await router.switchAgent(ccIdFor(surfaceId), targetAgentId)
    return binding
  }

  /** POST /v1/message — deliver into the surface's bound (agent, session). */
  async function sendMessage(body) {
    const surfaceId = requireString(body, 'surfaceId')
    const text = requireString(body, 'text')
    // The SAME path every entry uses (onIngress): resolve -> binding ->
    // ensureRunning -> turn -> reply. channel='mobile' keeps this surface
    // out of the Feishu reply path.
    const result = await router.route({
      channel: cfg.channel,
      chatId: surfaceId,
      conversationId: surfaceId,
      sender: { openId: `mobile:${surfaceId.slice(0, 12)}` },
      text,
    })
    if (result?.error !== undefined) throw result.error
    return {
      reply: result.reply ?? '',
      agentId: result.agentId,
      sessionId: result.sessionId,
      pid: result.pid,
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        json(res, 200, { ok: true, service: 'agent-core-product-api' })
        return
      }
      if (req.method === 'GET' && url.pathname === '/v1/binding') {
        json(res, 200, getBinding(url.searchParams))
        return
      }
      if (req.method === 'GET' && url.pathname === '/v1/agents') {
        // The wire contract keeps `avatar: null` as a CONSTANT (the old
        // registry's avatar field was dropped — no caller ever read it).
        const agents = definition.listAgents().map(a => ({
          id: a.id,
          name: a.name,
          avatar: null,
          description: a.description ?? null,
        }))
        json(res, 200, { agents })
        return
      }
      if (req.method === 'POST' && url.pathname === '/v1/switch-agent') {
        const binding = await switchAgent(await readBody(req))
        json(res, 200, binding)
        return
      }
      if (req.method === 'POST' && url.pathname === '/v1/message') {
        const result = await sendMessage(await readBody(req))
        json(res, 200, result)
        return
      }
      if (['GET', 'POST'].includes(req.method ?? '')) {
        json(res, 404, errorBody('NOT_FOUND', `no such endpoint: ${req.method} ${url.pathname}`))
        return
      }
      json(res, 405, errorBody('METHOD_NOT_ALLOWED', `method not allowed: ${req.method}`))
    } catch (error) {
      log.error(`${req.method} ${url.pathname} failed: ${error?.message ?? error}`)
      json(res, httpStatusFor(error), errorBody(error?.code === 'BINDING_NOT_FOUND' ? 'BINDING_NOT_FOUND'
        : error?.code === 'AGENT_NOT_FOUND' ? 'AGENT_NOT_FOUND'
        : error?.code === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR'
        : 'INTERNAL_ERROR', error?.message ?? String(error)))
    }
  })

  if (!cfg.enabled) {
    log.log('disabled; no HTTP server mounted')
    return { enabled: false }
  }

  // Long turns: a message can take minutes (the router's own turn timeout
  // guards the turn); disable Node's default request/header timeouts so a
  // slow agent reply is never cut by the transport.
  server.requestTimeout = 0
  server.headersTimeout = 120000

  server.listen(cfg.port, cfg.host, () => {
    log.log(`listening on http://${cfg.host}:${cfg.port} (channel=${cfg.channel})`)
  })

  ctx.effect(() => () => {
    server.closeAllConnections()
    server.close()
  })

  const service = {
    pluginName: name,
    /** Ops surface: the ACTUAL bound address (port 0 = ephemeral). */
    address: () => {
      const addr = server.address()
      if (addr === null || typeof addr === 'string') return { host: cfg.host, port: cfg.port }
      return { host: addr.address, port: addr.port }
    },
    /** Ops surface: surface -> ChannelConversation mapping (M13). */
    channelConversationIdOf: ccIdFor,
    /** In-process equivalents (same code paths as the HTTP handlers). */
    getBinding,
    switchAgent,
    sendMessage,
  }
  ctx.provide('productApi', service)
  return service
}
