/**
 * @agent-core/notification-ingress — Notification Ingress V1.
 *
 * NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 (accepted) +
 * NOTIFICATION_INGRESS_AUTH_RESOURCE_SCOPE_CLARIFICATION_V1 (accepted).
 *
 * POST /v1/deliver is no longer an anonymous loopback adapter. The frozen
 * request pipeline (strict order — never reordered, never skipped):
 *
 *   authenticate  (Authorization: Basic -> auth-service /oauth/token online
 *                 mint with resource=agent-core-notification-ingress-v1,
 *                 scope=notification.deliver; callerPrincipalId = the
 *                 VERIFIED clientId — request-body identity is UNTRUSTED)
 *   authorize     (operator allowlist {svc-forum, svc-workflow}; verified
 *                 but unlisted -> 403, incl. per-agent clients)
 *   body validation (the four wire fields; 400 pre-gate, no state written)
 *   durable idempotency reserve ((callerPrincipalId, requestId) key;
 *                 state=reserved commits BEFORE the Router is called;
 *                 same-key different-payload -> 409; terminal record ->
 *                 reuse the durable outcome, never a second delivery)
 *   Router deliver (business-blind agentRouter.deliver, bounded by a
 *                 deadline; PROVEN no-admission = VALIDATION_ERROR /
 *                 AGENT_NOT_FOUND only — everything else is unprovable)
 *   durable terminal / outcome_unknown record (delivered |
 *                 failed_no_admission | outcome_unknown)
 *
 * outcome_unknown wire (task freeze): HTTP 200, accepted=false,
 * outcome="outcome_unknown", reconciliationHandle preserved. Late Router
 * settlements after a deadline are evidence-only (late_settled) — the
 * durable outcome is never rewritten (C-IDM-010d).
 *
 * The adapter remains THIN over the frozen Router contract: zero routing /
 * session / process / queue semantics, zero Forum or Workflow knowledge, no
 * Router changes (ROUTER_SEMANTIC_CHANGE = NONE).
 *
 * V0 non-goals inherited unchanged: no queue / scheduler retry / polling /
 * dead-letter, no notification center, no caller special-casing. Remedy for
 * an outcome_unknown delivery = the CALLER's decision with a NEW requestId;
 * never an automatic re-delivery.
 */

import { createServer } from 'node:http'
import z from '@deepseek-ai/schemastery'

import {
  ALLOWED_CALLERS, loadAuthConfig, createServiceAuthVerifier, redactForLog,
} from './auth.js'
import { createDeliverHandler } from './deliver-handler.js'
import { NotificationIdempotencyStore } from './idempotency.js'
import { SESSION_MODES, errorBody, json, readBody } from './wire-response.js'

/** Stable plugin name referenced by bundle patches. */
export const name = 'notification-ingress'

/**
 * The Router is a HARD dependency: Cordis enters waiting and re-applies this
 * plugin once it is provided (same ordering pattern as product-api).
 */
export const inject = ['agentRouter']

export {
  ALLOWED_CALLERS,
  NOTIFICATION_RESOURCE, NOTIFICATION_SCOPE,
} from './auth.js'
export {
  NotificationIdempotencyStore, canonicalPayloadHash,
  PROVEN_NO_ADMISSION_CODES, RECORD_STATES, TERMINAL_STATES,
} from './idempotency.js'

/** Notification Ingress config. */
export const Config = z.object({
  /** Whether the HTTP server is mounted at all (control-plane opt-out). */
  enabled: z.boolean().default(true),
  /** Bind host. Loopback bind is NOT authentication (C-AUTH-008). */
  host: z.string().default('127.0.0.1'),
  /** Bind port (distinct from product-api's 8787). */
  port: z.number().default(8790),
  /** Operator-owned 0600 auth config (§4.4); empty = not configured. */
  authConfigFile: z.string().default(''),
  /** Durable idempotency authority store (REQUIRED for a legal V1 mount). */
  storeFile: z.string().default(''),
  /** Evidence JSONL (defaults beside the store). */
  evidenceFile: z.string().default(''),
})

export { SESSION_MODES } from './wire-response.js'

/**
 * Mount the Notification Ingress V1 HTTP server and publish
 * `ctx.notificationIngress`.
 *
 * Construction is fail-loud on a corrupt idempotency authority document
 * (C-IDM-014): the store constructor throws, the plugin never mounts, no
 * port is served, no delivery is accepted. A MISSING or INVALID auth config
 * is a legal not-ready state — the server mounts and every /v1/deliver
 * answers 503 AUTH_NOT_CONFIGURED (fail closed per call, never anonymous).
 *
 * @param ctx - plugin context (must carry agentRouter).
 * @param config - validated config; `storeFile` is REQUIRED, `fetchImpl` /
 *   `now` are test seams (same injection discipline as the repo's existing
 *   auth primitive).
 */
export function apply(ctx, config = {}) {
  const cfg = {
    enabled: config.enabled ?? true,
    host: config.host ?? '127.0.0.1',
    port: Number.isFinite(config.port) ? config.port : 8790,
    authConfigFile: config.authConfigFile ?? process.env.NOTIFICATION_INGRESS_AUTH_CONFIG ?? '',
    storeFile: config.storeFile ?? '',
    evidenceFile: config.evidenceFile ?? '',
    fetchImpl: config.fetchImpl,
    now: config.now,
  }
  const log = {
    log: (...args) => process.stderr.write(`[notification-ingress] ${args.join(' ')}\n`),
    error: (...args) => process.stderr.write(`[notification-ingress] ERROR ${args.join(' ')}\n`),
  }

  const router = ctx.get('agentRouter')
  if (router === undefined) {
    throw new Error('notification-ingress: agentRouter service not available (mount @agent-core/agent-router first)')
  }
  const deliverReady = typeof router.deliver === 'function'
  if (!deliverReady) {
    log.log('agentRouter.deliver NOT available; POST /v1/deliver will answer 503 SERVICE_UNAVAILABLE')
  }

  if (typeof cfg.storeFile !== 'string' || cfg.storeFile === '') {
    throw new Error('notification-ingress: storeFile is required for a legal V1 mount (durable idempotency authority — compose wires the production layout path)')
  }

  // The durable idempotency authority. Throws CORRUPT_STORE on a bad
  // document: mount aborts, port never serves (C-IDM-003/014).
  const store = new NotificationIdempotencyStore({
    storeFile: cfg.storeFile,
    ...(cfg.evidenceFile === '' ? {} : { evidenceFile: cfg.evidenceFile }),
    ...(cfg.now === undefined ? {} : { now: cfg.now }),
  })
  const storeReady = true

  const verifier = createServiceAuthVerifier(
    cfg.fetchImpl === undefined ? {} : { fetchImpl: cfg.fetchImpl },
  )

  /** Load the auth config + apply retention tuning (single authority: auth.json). */
  function loadAuth() {
    const result = loadAuthConfig(cfg.authConfigFile === '' ? undefined : cfg.authConfigFile)
    if (result.ok) {
      store.applyTuning({ retentionMs: result.config.retentionMs, maxRecords: result.config.maxRecords })
    }
    return result
  }

  const handleDeliver = createDeliverHandler({
    store, verifier, loadAuth, router, deliverReady,
  })

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        const auth = loadAuth()
        json(res, 200, {
          ok: true,
          service: 'agent-core-notification-ingress',
          deliverReady,
          authConfigured: auth.ok,
          storeReady,
        })
        return
      }
      if (req.method === 'POST' && url.pathname === '/v1/deliver') {
        const { status, body } = await handleDeliver(req.headers.authorization, await readBody(req))
        json(res, status, body)
        return
      }
      if (['GET', 'POST'].includes(req.method ?? '')) {
        json(res, 404, errorBody('NOT_FOUND', `no such endpoint: ${req.method} ${url.pathname}`))
        return
      }
      json(res, 405, errorBody('METHOD_NOT_ALLOWED', `method not allowed: ${req.method}`))
    } catch (error) {
      const message = redactForLog(error?.message ?? String(error))
      log.error(`${req.method} ${url.pathname} failed: ${message}`)
      const code = error?.code === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'
      json(res, code === 'VALIDATION_ERROR' ? 400 : 500, errorBody(code, message))
    }
  })

  if (!cfg.enabled) {
    log.log('disabled; no HTTP server mounted')
    store.stop()
    return { enabled: false, deliverReady, storeReady }
  }

  // The handler enforces its own Router deadline (C-IDM-011); keep Node's
  // request/header timeouts off so a bounded handler is never double-killed.
  server.requestTimeout = 0
  server.headersTimeout = 120000

  server.listen(cfg.port, cfg.host, () => {
    log.log(`listening on http://${cfg.host}:${server.address()?.port ?? cfg.port} (deliverReady=${deliverReady} storeReady=${storeReady})`)
  })

  ctx.effect(() => () => {
    store.stop()
    server.closeAllConnections()
    server.close()
  })

  const service = {
    pluginName: name,
    /** Whether the frozen Router deliver() is present at apply time. */
    deliverReady,
    /** The durable idempotency authority is mounted (always true here —
     *  construction is fail-loud on a corrupt store). */
    storeReady,
    /** Live auth-configured probe (health surface, same code path). */
    authConfigured: () => loadAuth().ok,
    /** Ops surface: the ACTUAL bound address (port 0 = ephemeral). */
    address: () => {
      const addr = server.address()
      if (addr === null || typeof addr === 'string') return { host: cfg.host, port: cfg.port }
      return { host: addr.address, port: addr.port }
    },
    /**
     * In-process equivalent of POST /v1/deliver (same code path): present
     * the Authorization header and the parsed body.
     * @returns {Promise<{status:number, body:object}>}
     */
    deliver: (authorizationHeader, body) => handleDeliver(authorizationHeader, body),
    /** Test/ops surface: the mounted idempotency authority. */
    store,
  }
  ctx.provide('notificationIngress', service)
  return service
}
