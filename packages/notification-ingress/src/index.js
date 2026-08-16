/**
 * @agent-core/notification-ingress — Notification Ingress V0 (thin HTTP adapter).
 *
 * ONE synchronous ingress for external notification-style delivery:
 *
 *   POST /v1/deliver
 *     { requestId, agentId, sessionMode: 'main' | 'fresh', message }
 *       -> agentRouter.deliver({ requestId, agentId, sessionMode, message })
 *       -> { accepted, sessionId }
 *
 * The server is a THIN ADAPTER over the FROZEN Router contract
 * `agentRouter.deliver` (landed with AGENT_ROUTER_DELIVERY_V0 on
 * feat/agent-router-delivery-v0, merged into main). It owns NONE of: routing
 * policy, session/process lifecycle, session mapping, queue / scheduler /
 * retry / dead-letter, notification center, Workflow or Forum specifics. It
 * does not know Workflow, and it does not know Forum — it only turns one HTTP
 * request into one deliver() call and one HTTP response.
 *
 * V0 explicitly does NOT do (frozen non-goals):
 *   - notification queue / scheduler retry / polling / dead-letter queue
 *   - notification center
 *   - Workflow / Forum special-casing
 *   - session mapping / any old-session resume policy (sessionMode is passed
 *     through verbatim; interpreting it is the Router's job)
 *
 * Main HAS agentRouter.deliver (AGENT_ROUTER_DELIVERY_V0 is merged), so the
 * live code path delivers. The runtime guard below (`typeof router.deliver`)
 * is kept for forward-compat so the adapter degrades to 503 instead of
 * crashing or re-implementing routing if the Router ever mounts without
 * deliver(). This mirrors the product-api thin-ingress posture (127.0.0.1
 * only, no auth/TLS in V0, error envelope { error: { code, message } }).
 */

import { createServer } from 'node:http'
import z from '@deepseek-ai/schemastery'

/** Stable plugin name referenced by bundle patches. */
export const name = 'notification-ingress'

/**
 * The Router is a HARD dependency: Cordis enters waiting and re-applies this
 * plugin once it is provided (same ordering pattern as product-api).
 */
export const inject = ['agentRouter']

/** Notification Ingress config. */
export const Config = z.object({
  /** Whether the HTTP server is mounted at all (control-plane opt-out). */
  enabled: z.boolean().default(true),
  /** Bind host. V0: 127.0.0.1 only (same posture as product-api). */
  host: z.string().default('127.0.0.1'),
  /** Bind port (distinct from product-api's 8787). */
  port: z.number().default(8790),
})

/** The only wire sessionMode values (frozen contract; interpreted by Router). */
export const SESSION_MODES = Object.freeze(['main', 'fresh'])

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

/** Map a Router error to the contract's HTTP status. */
function httpStatusFor(error) {
  if (error?.code === 'AGENT_NOT_FOUND') return 404
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
    throw Object.assign(new TypeError(`notification-ingress: ${field} must be a non-empty string`), { code: 'VALIDATION_ERROR' })
  }
  return value
}

/**
 * Validate the wire body into the frozen deliver() payload. Only the four
 * contract fields are read; anything else on the wire is ignored (thin
 * adapter — it never forwards unknown fields to the Router).
 */
function validateDeliverBody(body) {
  const payload = {
    requestId: requireString(body, 'requestId'),
    agentId: requireString(body, 'agentId'),
    sessionMode: requireString(body, 'sessionMode'),
    message: requireString(body, 'message'),
  }
  if (!SESSION_MODES.includes(payload.sessionMode)) {
    throw Object.assign(new TypeError(`notification-ingress: sessionMode must be one of ${SESSION_MODES.join(' | ')}`), { code: 'VALIDATION_ERROR' })
  }
  return payload
}

/**
 * Mount the Notification Ingress HTTP server and publish `ctx.notificationIngress`.
 * @param ctx - plugin context (must carry agentRouter).
 * @param config - validated config.
 */
export function apply(ctx, config = {}) {
  // Schema defaults applied explicitly (same pattern as product-api / router).
  const cfg = {
    enabled: config.enabled ?? true,
    host: config.host ?? '127.0.0.1',
    port: Number.isFinite(config.port) ? config.port : 8790,
  }
  const log = {
    log: (...args) => process.stderr.write(`[notification-ingress] ${args.join(' ')}\n`),
    error: (...args) => process.stderr.write(`[notification-ingress] ERROR ${args.join(' ')}\n`),
  }

  const router = ctx.get('agentRouter')
  if (router === undefined) {
    throw new Error('notification-ingress: agentRouter service not available (mount @agent-core/agent-router first)')
  }

  // FROZEN DEPENDENCY CHECK: deliver() comes from the Router branch
  // (feat/agent-router-delivery-v0), which is merged into main. The runtime
  // guard is retained for forward-compat: if the Router ever mounts without
  // deliver(), the ingress degrades to 503 and NEVER re-implements routing,
  // session or process logic of its own.
  const deliverReady = typeof router.deliver === 'function'
  if (!deliverReady) {
    log.log('agentRouter.deliver NOT available; POST /v1/deliver will answer 503 SERVICE_UNAVAILABLE')
  }

  /**
   * POST /v1/deliver — the ONLY endpoint of Notification Ingress V0.
   * HTTP request -> validation -> agentRouter.deliver(...) -> HTTP response.
   */
  async function deliver(body) {
    const payload = validateDeliverBody(body)
    if (!deliverReady) {
      throw Object.assign(new Error('agentRouter.deliver is not available; the ingress cannot dispatch'), {
        code: 'SERVICE_UNAVAILABLE',
      })
    }
    return router.deliver(payload)
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        json(res, 200, { ok: true, service: 'agent-core-notification-ingress', deliverReady })
        return
      }
      if (req.method === 'POST' && url.pathname === '/v1/deliver') {
        const result = await deliver(await readBody(req))
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
      const code = error?.code === 'SERVICE_UNAVAILABLE' ? 'SERVICE_UNAVAILABLE'
        : error?.code === 'AGENT_NOT_FOUND' ? 'AGENT_NOT_FOUND'
        : error?.code === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR'
        : 'INTERNAL_ERROR'
      json(res, code === 'SERVICE_UNAVAILABLE' ? 503 : httpStatusFor(error), errorBody(code, error?.message ?? String(error)))
    }
  })

  if (!cfg.enabled) {
    log.log('disabled; no HTTP server mounted')
    return { enabled: false, deliverReady }
  }

  // Deliveries can take minutes (the Router's own turn timeout guards the
  // turn); disable Node's default request/header timeouts (product-api same).
  server.requestTimeout = 0
  server.headersTimeout = 120000

  server.listen(cfg.port, cfg.host, () => {
    log.log(`listening on http://${cfg.host}:${cfg.port} (deliverReady=${deliverReady})`)
  })

  ctx.effect(() => () => {
    server.closeAllConnections()
    server.close()
  })

  const service = {
    pluginName: name,
    /** Whether the frozen Router deliver() is present at apply time. */
    deliverReady,
    /** Ops surface: the ACTUAL bound address (port 0 = ephemeral). */
    address: () => {
      const addr = server.address()
      if (addr === null || typeof addr === 'string') return { host: cfg.host, port: cfg.port }
      return { host: addr.address, port: addr.port }
    },
    /** In-process equivalent (same code path as the HTTP handler). */
    deliver,
  }
  ctx.provide('notificationIngress', service)
  return service
}
