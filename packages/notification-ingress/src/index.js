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
  ALLOWED_CALLERS, loadAuthConfig, parseBasicCredential, createServiceAuthVerifier, redactForLog,
} from './auth.js'
import {
  NotificationIdempotencyStore, PROVEN_NO_ADMISSION_CODES, canonicalPayloadHash,
} from './idempotency.js'

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

/** The only wire sessionMode values (frozen contract; interpreted by Router). */
export const SESSION_MODES = Object.freeze(['main', 'fresh'])

const BODY_LIMIT_BYTES = 1_000_000

/** JSON reply helper. */
function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** Error envelope per the frozen contract ({error:{code,message}}). */
function errorBody(code, message) {
  return { error: { code, message } }
}

/** Read the whole request body (small JSON, bounded — C-WIRE-004). */
function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > BODY_LIMIT_BYTES) {
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
 * adapter — it never forwards unknown fields to the Router, and unknown
 * fields never participate in the payload hash).
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

  // Per-key in-flight attempts (C-IDM-007 single-flight): concurrent same-key
  // same-payload requests wait for the live attempt and replay its outcome —
  // they never judge outcome_unknown on their own and never start a second
  // Router call.
  /** @type {Map<string, {payloadHash:string, promise:Promise<{status:number,body:object}>}>} */
  const inflight = new Map()

  /**
   * Run one bounded Router attempt (C-IDM-011). Resolves with
   * {kind:'resolved', result} | {kind:'rejected', error} | {kind:'deadline'}
   * exactly once; a Router settlement that arrives after the deadline is
   * routed to `onLate` and NEVER rewrites any durable outcome.
   */
  function attemptRouterDelivery(payload, deadlineMs, onLate) {
    return new Promise((resolveAttempt) => {
      let settled = false
      const finish = (descriptor) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolveAttempt(descriptor)
      }
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        resolveAttempt({ kind: 'deadline' })
      }, deadlineMs)
      if (typeof timer.unref === 'function') timer.unref()
      Promise.resolve(router.deliver({ ...payload })).then(
        (result) => {
          if (!settled) finish({ kind: 'resolved', result })
          else onLate({ kind: 'resolved', result })
        },
        (error) => {
          if (!settled) finish({ kind: 'rejected', error })
          else onLate({ kind: 'rejected', error })
        },
      )
    })
  }

  /**
   * The frozen deliver pipeline. Resolves with the HTTP response descriptor
   * {status, body}; rejects only on internal store failures (500).
   */
  async function handleDeliver(authorizationHeader, body) {
    // 1. authenticate — config first: a not-ready ingress answers 503 on
    //    EVERY /v1/deliver (fail closed per call, never anonymous; §4.4).
    const auth = loadAuth()
    if (!auth.ok) {
      store.appendEvidence({ kind: 'auth_reject', code: 'AUTH_NOT_CONFIGURED' })
      return { status: 503, body: errorBody('AUTH_NOT_CONFIGURED', `notification ingress auth is not configured (${auth.reason})`) }
    }
    const credential = parseBasicCredential(authorizationHeader)
    if (credential === null) {
      // C-AUTH-001/007: missing / non-Basic / corrupted structure -> 401;
      // the response never echoes any header material.
      store.appendEvidence({ kind: 'auth_reject', code: 'INVALID_CREDENTIAL' })
      return { status: 401, body: errorBody('INVALID_CREDENTIAL', 'missing or malformed Basic credential') }
    }
    const secrets = [authorizationHeader, credential.clientSecret]
    const verification = await verifier.verify(credential, auth.config)

    // 2. authorize — allowlist {svc-forum, svc-workflow} (C-AUTH-004).
    if (!verification.ok) {
      store.appendEvidence({
        kind: 'auth_reject',
        code: verification.code,
        ...(verification.callerPrincipalId === undefined ? {} : { clientId: verification.callerPrincipalId }),
      })
      if (verification.status === 403) {
        return { status: 403, body: errorBody('CALLER_NOT_ALLOWED', 'verified caller is not on the notification ingress allowlist') }
      }
      if (verification.status === 401) {
        return { status: 401, body: errorBody('INVALID_CREDENTIAL', 'credential is invalid, revoked, or not valid for this surface') }
      }
      return { status: 503, body: errorBody('AUTH_INCONCLUSIVE', 'auth-service verification was inconclusive; retry later') }
    }
    const { callerPrincipalId, callerName } = verification
    store.appendEvidence({ kind: 'auth_ok', clientId: callerPrincipalId, callerName })

    // 3. body validation (pre-gate, no state written).
    const payload = validateDeliverBody(body)

    // V0 capability guard retained: without agentRouter.deliver nothing can
    // be admitted; answer 503 BEFORE reserving (no state pollution).
    if (!deliverReady) {
      return {
        status: 503,
        body: errorBody('SERVICE_UNAVAILABLE', 'agentRouter.deliver is not available; the ingress cannot dispatch'),
      }
    }

    // 4. durable idempotency gate — (callerPrincipalId, requestId).
    const payloadHash = canonicalPayloadHash(payload)
    const key = `${callerPrincipalId}\u0000${payload.requestId}`

    const pending = inflight.get(key)
    if (pending !== undefined && pending.payloadHash === payloadHash) {
      // Single-flight: join the live attempt and replay its outcome.
      return pending.promise
    }

    const reservation = await store.reserve({ callerPrincipalId, requestId: payload.requestId, payloadHash })
    if (reservation.outcome === 'conflict') {
      // C-IDM-006: same key, different payload. No delivery; the original
      // record is never rewritten.
      return {
        status: 409,
        body: errorBody('CONFLICT', 'this (caller, requestId) is already recorded with a different payload'),
      }
    }
    if (reservation.outcome === 'terminal') {
      // C-IDM-005: reuse the durable outcome; ZERO further Router calls.
      return duplicateResponse(reservation.record)
    }
    if (reservation.outcome === 'reserved') {
      // Non-terminal with no live attempt in this process. Single-process
      // authority makes this unreachable in normal operation (boot sweep
      // migrated restart leftovers); defensively prove nothing and settle
      // outcome_unknown — never re-deliver.
      const late = inflight.get(key)
      if (late !== undefined && late.payloadHash === payloadHash) return late.promise
      await store.settleUnresolvedReserved({ callerPrincipalId, requestId: payload.requestId })
      return unknownResponse(undefined, false)
    }

    // 5. new key — we own the attempt. Register the single-flight entry
    //    synchronously (before any await) so joiners see it.
    const attempt = runAttempt(callerPrincipalId, payload, payloadHash, auth.config.routerDeadlineMs, key)
    inflight.set(key, { payloadHash, promise: attempt })
    try {
      return await attempt
    } finally {
      inflight.delete(key)
    }
  }

  /** The owned attempt: Router deliver + durable terminal/unknown record. */
  async function runAttempt(callerPrincipalId, payload, payloadHash, deadlineMs, key) {
    const requestId = payload.requestId
    const lateSettled = (descriptor) => {
      // C-IDM-010d NO_LATE_REWRITE: late Router settlement is evidence-only.
      store.recordLateSettled({
        callerPrincipalId,
        requestId,
        settled: descriptor.kind,
        detail: descriptor.kind === 'rejected'
          ? redactForLog(descriptor.error?.message ?? String(descriptor.error))
          : 'resolved after deadline',
      }).catch(() => { /* evidence must never break the answered outcome */ })
    }
    const descriptor = await attemptRouterDelivery(payload, deadlineMs, lateSettled)
    if (descriptor.kind === 'resolved') {
      const result = descriptor.result ?? {}
      const { record } = await store.settle({
        callerPrincipalId, requestId, state: 'delivered',
        sessionId: typeof result.sessionId === 'string' ? result.sessionId : undefined,
        reason: 'router_accepted',
      })
      return {
        status: 200,
        body: {
          accepted: result.accepted ?? true,
          sessionId: record.sessionId,
          outcome: 'delivered',
          ...(result.status === undefined ? {} : { status: result.status }),
          ...(result.reconciliationHandle === undefined ? {} : { reconciliationHandle: result.reconciliationHandle }),
          ...(result.evidence === undefined ? {} : { evidence: result.evidence }),
        },
      }
    }
    if (descriptor.kind === 'rejected') {
      const error = descriptor.error
      if (error?.code !== undefined && PROVEN_NO_ADMISSION_CODES.includes(error.code)) {
        // C-IDM-008: the ONLY proven no-admission classes (Router throws
        // both BEFORE ensureRunning / proc.deliver).
        const httpStatus = error.code === 'AGENT_NOT_FOUND' ? 404 : 400
        await store.settle({
          callerPrincipalId, requestId, state: 'failed_no_admission',
          failure: { code: error.code, httpStatus },
          reason: `proven_${error.code}`,
        })
        return {
          status: httpStatus,
          body: errorBody(error.code, redactForLog(error.message ?? String(error))),
        }
      }
    }
    // Everything else — unknown errors, timeouts, process faults, capacity
    // errors, outcome_unknown carriers, or the deadline expiring — leaves
    // admission unprovable: durable outcome_unknown, HTTP 200 accepted=false.
    const carrier = descriptor.kind === 'rejected' ? descriptor.error : undefined
    const deadlineCarrier = descriptor.kind === 'deadline'
      ? { source: 'router_deadline' }
      : undefined
    const unknownDetail = deadlineCarrier ?? {
      source: carrier?.status === 'outcome_unknown' ? 'outcome_unknown_carrier' : (carrier?.code ?? 'router_error'),
    }
    await store.settle({
      callerPrincipalId, requestId, state: 'outcome_unknown',
      outcomeUnknown: {
        ...(carrier?.reconciliationHandle === undefined ? {} : { reconciliationHandle: carrier.reconciliationHandle }),
        ...(carrier?.deadlineAtWallMs === undefined ? {} : { deadlineAtWallMs: carrier.deadlineAtWallMs }),
        ...unknownDetail,
      },
      reason: unknownDetail.source,
    })
    return unknownResponse(carrier, false)
  }

  /** 200 outcome_unknown response (task freeze: reconciliationHandle保留). */
  function unknownResponse(carrier, duplicate) {
    return {
      status: 200,
      body: {
        accepted: false,
        outcome: 'outcome_unknown',
        ...(duplicate ? { duplicate: true } : {}),
        ...(carrier?.reconciliationHandle === undefined ? {} : { reconciliationHandle: carrier.reconciliationHandle }),
        ...(carrier?.deadlineAtWallMs === undefined ? {} : { deadlineAtWallMs: carrier.deadlineAtWallMs }),
        ...(carrier?.evidence === undefined ? {} : { evidence: carrier.evidence }),
      },
    }
  }

  /** Duplicate response: reuse the DURABLE outcome, zero Router calls. */
  function duplicateResponse(record) {
    if (record.state === 'delivered') {
      return {
        status: 200,
        body: { accepted: true, sessionId: record.sessionId, outcome: 'delivered', duplicate: true },
      }
    }
    if (record.state === 'failed_no_admission') {
      // Original 4xx error envelope, byte-for-byte semantics.
      return {
        status: record.failure.httpStatus,
        body: errorBody(record.failure.code, 'delivery failed before admission (recorded outcome)'),
      }
    }
    // outcome_unknown duplicate: keep the recorded reconciliation handle.
    return {
      status: 200,
      body: {
        accepted: false,
        outcome: 'outcome_unknown',
        duplicate: true,
        ...(record.outcomeUnknown?.reconciliationHandle === undefined ? {} : { reconciliationHandle: record.outcomeUnknown.reconciliationHandle }),
      },
    }
  }

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
