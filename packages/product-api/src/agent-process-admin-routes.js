/**
 * /agent-process/turn-abandonment admin routes for product-api
 * (HR_RESET_AND_RESUME_V1) — the authenticated administrator entry that was
 * deliberately left unwired by PR #368.
 *
 *   POST /agent-process/turn-abandonment
 *     {agentId: 'agt_hr-agent', declarationId: '<caller idempotency key>'}
 *     -> {ok:true, agentId, declarationId, abandonedHandles, completedHandles, scopeHandles}
 *   GET  /agent-process/turn-abandonment?agentId=agt_hr-agent
 *     -> {agentId, declarations:[{declarationId, declaredAt, handles, pendingHandles, settledHandles}]}
 *
 * Authorization source (reused, not invented): the EXISTING product-api
 * authsvc verifier seam (`schedulerTokenVerifier`, the same RS256/JWKS gate
 * as /scheduler/* and /workflow-execution/*) requiring the EXISTING fleet
 * admin scope `workflow.admin` (the same grant the runtime's own trusted
 * admin provisioning consumes). Inbound identity is NOT authority: only the
 * verifier-returned scope set decides; no request-supplied field can grant
 * reset power. The gate runs FIRST; every denial is zero-mutation.
 *
 * Target scope is PINNED to agt_hr-agent: any other agentId is refused
 * before any store mutation.
 *
 * Review r4130766489 handling: an administrator declaration is NOT evidence
 * that an old execution exited. When the registry still identifies a LIVE
 * process of the target Agent, the route returns 409 live_execution_present
 * naming the existing controlled cancel/shutdown path and mutates nothing.
 * Without a live execution the declaration only unblocks NEW-request
 * admission; the old records stay blocked + fenced + outcome_unknown, never
 * settled, never deleted, never replayed.
 *
 * Declaration budget: the durable scope registry is bounded to 32 distinct
 * declaration ids per store (never recycled; retries of existing ids always
 * remain possible). Exhaustion maps to 409 abandonment_capacity_exhausted.
 *
 * Error envelope = the product-api frozen { error: { code, message } }.
 */

const ADMIN_RESET_AGENT = 'agt_hr-agent'
const ADMIN_SCOPE = 'workflow.admin'

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function verifyAdminToken(verifier, req) {
  const header = req.headers?.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (verifier === undefined || verifier === null || match === null) {
    throw new HttpError(401, 'unauthenticated', 'missing bearer token or unconfigured verification seam')
  }
  try {
    const principal = await verifier.verify(match[1].trim())
    const scopes = principal?.scopes instanceof Set ? principal.scopes : new Set()
    if (!scopes.has(ADMIN_SCOPE)) {
      throw new HttpError(403, 'forbidden', `token carries no ${ADMIN_SCOPE} scope`)
    }
    return principal
  } catch (error) {
    if (error instanceof HttpError) throw error
    // Fail-closed: every verification failure is 401; the error detail is
    // never echoed to the caller.
    throw new HttpError(401, 'unauthenticated', 'token verification failed')
  }
}

function requireRouter(router) {
  if (router === undefined || router === null || typeof router !== 'object') {
    throw new HttpError(503, 'not_ready', 'agent router is not wired into this runtime')
  }
  return router
}

function requireTargetAgent(agentId) {
  if (typeof agentId !== 'string' || agentId.trim() === '') {
    throw new HttpError(400, 'invalid_arguments', 'agentId must be a non-empty string')
  }
  // The reset operation exists for exactly one target; a caller-supplied
  // agentId never widens it.
  if (agentId !== ADMIN_RESET_AGENT) {
    throw new HttpError(403, 'forbidden', `turn abandonment is pinned to ${ADMIN_RESET_AGENT}`)
  }
  return agentId
}

function requireDeclarationId(body) {
  const value = body?.declarationId
  if (typeof value !== 'string' || value.trim() === '' || value.length > 128) {
    throw new HttpError(400, 'invalid_arguments', 'declarationId must be a non-empty string of at most 128 chars')
  }
  return value
}

function requireClosedBody(body, allowed) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_arguments', 'body must be a JSON object')
  }
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new HttpError(400, 'invalid_arguments', `unknown body field: ${key}`)
  }
}

/** Read a bounded JSON request body. */
function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 64_000) {
        rejectBody(new HttpError(400, 'invalid_arguments', 'request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) { resolveBody({}); return }
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch {
        rejectBody(new HttpError(400, 'invalid_arguments', 'body must be JSON'))
      }
    })
    req.on('error', rejectBody)
  })
}

/**
 * r4130766489: a declaration is not exit evidence. If the registry still
 * identifies a live process of the target Agent, refuse with the existing
 * controlled recovery path instead of stamping over a possibly running task.
 */
function refuseLiveExecution(router, agentId) {
  const live = (typeof router.registrySnapshot === 'function' ? router.registrySnapshot() : [])
    .find(entry => entry?.agentId === agentId && entry?.alive === true)
  if (live !== undefined) {
    throw new HttpError(409, 'live_execution_present',
      `agent ${agentId} still has a live process (pid ${live.pid}); abandon only after the existing controlled cancel/shutdown drained it — an administrator declaration is not termination evidence`)
  }
}

/**
 * @param {object} args
 * @param {object} args.req - node http IncomingMessage.
 * @param {URL} args.url - parsed request URL.
 * @param {object} [args.router] - the agentRouter service (request-time
 *   resolution at the mount site, same discipline as /scheduler/*).
 * @param {object} [args.verifier] - the authsvc token verifier seam.
 * @returns {Promise<{status:number, body:object}>}
 */
export async function handleAgentProcessAdminRequest({ req, url, router, verifier }) {
  try {
    if (url.pathname !== '/agent-process/turn-abandonment') {
      return { status: 404, body: { error: { code: 'not_found', message: `no such endpoint: ${req.method} ${url.pathname}` } } }
    }
    await verifyAdminToken(verifier, req)
    const service = requireRouter(router)
    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      requireClosedBody(body, new Set(['agentId', 'declarationId']))
      const agentId = requireTargetAgent(body?.agentId)
      const declarationId = requireDeclarationId(body)
      refuseLiveExecution(service, agentId)
      try {
        const result = await service.abandonPendingTurns({ agentId, declarationId })
        return { status: 200, body: { ok: true, ...result } }
      } catch (error) {
        if (error?.name === 'ReconciliationCapacityError') {
          throw new HttpError(409, 'abandonment_capacity_exhausted', String(error?.message ?? error))
        }
        if (error?.code === 'RECONCILIATION_DECLARATION_CONFLICT') {
          throw new HttpError(409, 'declaration_conflict', String(error?.message ?? error))
        }
        throw error
      }
    }
    if (req.method === 'GET') {
      const agentId = requireTargetAgent(url.searchParams.get('agentId'))
      const declarations = typeof service.abandonmentDeclarationsSnapshot === 'function'
        ? service.abandonmentDeclarationsSnapshot(agentId)
        : []
      return { status: 200, body: { agentId, declarations } }
    }
    return { status: 405, body: { error: { code: 'method_not_allowed', message: `method not allowed: ${req.method}` } } }
  } catch (error) {
    if (error instanceof HttpError) {
      return { status: error.status, body: { error: { code: error.code, message: error.message } } }
    }
    return { status: 500, body: { error: { code: 'internal', message: 'internal error' } } }
  }
}
