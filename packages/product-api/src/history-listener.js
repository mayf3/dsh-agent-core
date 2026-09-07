/**
 * HISTORY_LISTENER — the dedicated history-only Tailnet listener
 * (PRODUCT_API_AUTHENTICATION_V1 CTR-PA-001 / MOBILE_SESSION_HISTORY_V1
 * CTR-SH-002).
 *
 * - Binds the configured Tailscale address directly (no L7 proxy, no forwarded
 *   headers); the existing Product API loopback server is untouched and its
 *   routes are unchanged — the history route exists ONLY here.
 * - TAILNET_LISTENER_ROUTE_OWNERSHIP = ALL_REQUESTS_ADMITTED: every request
 *   enters the auth profile; non-history-class requests are 403 after (as the
 *   first admission step); history-class requests run the frozen admission
 *   chain and then History input validation (selector ≠ main → 400 is owned by
 *   History, not auth). Single ownership chain: auth admission → History
 *   input validation.
 * - Runtime logs carry exactly the CTR-SH-014 / CTR-PA-011 allowlist fields:
 *   no transcript, no public IDs (only a `before` presence boolean), no paths,
 *   no native/raw IDs, no auth field values (digests only).
 */

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import {
  admitHistoryRequest,
  FORBIDDEN,
  NOT_READY,
} from './history-auth.js'

/** Fixed safe error messages — never include paths, values or causes. */
const DENIAL_MESSAGES = {
  [FORBIDDEN]: 'caller is not authorized',
  [NOT_READY]: 'authentication is not ready',
}

const ROUTE_TEMPLATE = '/v1/agents/{agentId}/sessions/{selector}/messages'

/** Parse the history route class (CTR-PA-001): GET + single-segment agentId + any selector + `messages` tail. */
export function matchHistoryRouteClass(method, pathname) {
  if (method !== 'GET') return null
  const match = /^\/v1\/agents\/([^/]+)\/sessions\/([^/]*)\/messages$/.exec(pathname ?? '')
  if (match === null) return null
  return { rawAgentId: match[1], rawSelector: match[2] }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

const errorEnvelope = (code, message) => ({ error: { code, message } })

/** Decode one URL path segment; invalid URL encoding is a 400 (CTR-SH-002). */
function decodeSegment(raw) {
  try {
    return decodeURIComponent(raw)
  } catch {
    throw Object.assign(new Error('invalid request'), { statusCode: 400, code: 'VALIDATION_ERROR' })
  }
}

/**
 * History input validation — runs AFTER admission (CTR-SH-002); the selector
 * is this Spec's own 400, not the auth Child's 403.
 */
function validateHistoryInput({ rawAgentId, rawSelector, searchParams }) {
  const selector = decodeSegment(rawSelector)
  if (selector !== 'main') {
    throw Object.assign(new Error('invalid request'), { statusCode: 400, code: 'VALIDATION_ERROR' })
  }
  const agentId = decodeSegment(rawAgentId)
  // workspace-bootstrap validator contract: single safe component, ≤ 200 chars.
  if (agentId === '' || agentId.length > 200 || /[\u0000/\\ .]/.test(agentId) || /^(\.|\.\.)$/.test(agentId)) {
    throw Object.assign(new Error('invalid request'), { statusCode: 400, code: 'VALIDATION_ERROR' })
  }
  let limit
  const rawLimit = searchParams.get('limit')
  if (rawLimit !== null) {
    if (!/^\d{1,3}$/.test(rawLimit)) {
      throw Object.assign(new Error('invalid request'), { statusCode: 400, code: 'VALIDATION_ERROR' })
    }
    limit = Number(rawLimit)
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw Object.assign(new Error('invalid request'), { statusCode: 400, code: 'VALIDATION_ERROR' })
    }
  }
  let before
  const rawBefore = searchParams.get('before')
  if (rawBefore !== null) {
    if (rawBefore === '' || Buffer.byteLength(rawBefore, 'utf8') > 512) {
      throw Object.assign(new Error('invalid request'), { statusCode: 400, code: 'VALIDATION_ERROR' })
    }
    before = rawBefore
  }
  return { agentId, limit, before }
}

/**
 * Create (and bind) the dedicated history listener. `deps.sessionHistory` is
 * the `@agent-core/session-history` service; `deps.resolveStableNodeId` the
 * WhoIs resolver; `deps.profile` the loaded restart-only auth config
 * generation. Bind failure propagates — a forced enable without a bindable
 * Tailscale address fails startup closed.
 */
export function startHistoryListener({
  host,
  port,
  profile,
  sessionHistory,
  resolveStableNodeId,
  writeLog = (line) => process.stderr.write(`[product-api:history] ${line}\n`),
}) {
  const server = createServer((req, res) => {
    const startedAtNs = process.hrtime.bigint()
    const requestId = randomUUID()
    const url = new URL(req.url ?? '/', 'http://localhost')
    const routeClass = matchHistoryRouteClass(req.method, url.pathname)

    admitHistoryRequest({
      routeClass,
      socket: req.socket,
      headers: req.headers,
      profile,
      resolveStableNodeId,
    })
      .then((admission) => {
        if (admission.decision === 'forbidden') {
          sendJson(res, 403, errorEnvelope(FORBIDDEN, DENIAL_MESSAGES[FORBIDDEN]))
          return { status: 403, code: FORBIDDEN, authed: false }
        }
        if (admission.decision === 'not_ready') {
          sendJson(res, 503, errorEnvelope(NOT_READY, DENIAL_MESSAGES[NOT_READY]))
          return { status: 503, code: NOT_READY, authed: false }
        }
        try {
          const { agentId, limit, before } = validateHistoryInput({
            rawAgentId: routeClass.rawAgentId,
            rawSelector: routeClass.rawSelector,
            searchParams: url.searchParams,
          })
          return sessionHistory
            .listMessages({ authContext: admission.authContext, agentId, limit, before })
            .then((result) => {
              const { stats, ...envelope } = result
              sendJson(res, 200, envelope)
              return {
                status: 200,
                code: 'OK',
                authed: true,
                agentId,
                limit: limit ?? 50,
                beforePresent: before !== null && before !== undefined,
                artifactBytes: stats.artifactBytes,
                projectedCount: stats.projectedCount,
                pageCount: stats.pageCount,
              }
            })
            .catch((error) => {
              const status = error?.status ?? 500
              const code = error?.code ?? 'INTERNAL_ERROR'
              sendJson(res, status, errorEnvelope(code, error?.message ?? 'internal error'))
              return {
                status,
                code,
                authed: true,
                agentId,
                limit: limit ?? 50,
                beforePresent: before !== null && before !== undefined,
              }
            })
        } catch (error) {
          const status = error?.statusCode ?? 500
          const code = error?.code ?? 'INTERNAL_ERROR'
          sendJson(res, status, errorEnvelope(code, error?.message ?? 'internal error'))
          return Promise.resolve({ status, code, authed: true })
        }
      })
      .then((outcome) => {
        // CTR-SH-014 / CTR-PA-011 allowlist only: literal route template,
        // agentId (post-authorization only), status + code, limit number,
        // before presence boolean, numeric aggregates, request id.
        const durationMs = Number(process.hrtime.bigint() - startedAtNs) / 1e6
        const fields = [
          `route=${ROUTE_TEMPLATE}`,
          `requestId=${requestId}`,
          `result=${outcome.status} ${outcome.code}`,
          `durationMs=${durationMs.toFixed(1)}`,
        ]
        if (outcome.authed && outcome.agentId !== undefined) fields.push(`agentId=${outcome.agentId}`)
        if (outcome.limit !== undefined) fields.push(`limit=${outcome.limit}`)
        if (outcome.beforePresent !== undefined) fields.push(`beforePresent=${outcome.beforePresent}`)
        if (outcome.artifactBytes !== undefined) fields.push(`artifactBytes=${outcome.artifactBytes}`)
        if (outcome.projectedCount !== undefined) fields.push(`projectedCount=${outcome.projectedCount}`)
        if (outcome.pageCount !== undefined) fields.push(`pageCount=${outcome.pageCount}`)
        writeLog(fields.join(' '))
      })
      .catch(() => {
        if (!res.headersSent) sendJson(res, 500, errorEnvelope('INTERNAL_ERROR', 'internal error'))
        else res.destroy()
      })
  })

  server.requestTimeout = 0
  server.headersTimeout = 30000
  server.listen(port, host)

  return {
    server,
    address: () => server.address(),
    close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
  }
}
