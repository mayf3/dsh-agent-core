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
 * as /scheduler/* and /workflow-execution/*). The Owner-designated sole
 * privileged authority is the exact canonical CTO machine identity recorded
 * by the accepted bootstrap authority (AGENT_CORE_WORKFLOW_ADMIN_AGENT_
 * BOOTSTRAP_V1 OBS-WA-008, corroborated by the workflow-recovery identity
 * receipts): Principal UUID `4e5a4578-0645-4133-bd35-b80e453dfee9` bound to
 * canonical agentId `agt_cto-agent` as the signed token asserts it; every
 * other principal (including other workflow.admin holders AND the legacy
 * OpenClaw-era `cto-agent` / `3e2439d2-…` pair, which originates in a
 * historical scheduler fixture) fails closed. Inbound identity is
 * NOT authority: no request-supplied field can grant reset power. The gate
 * runs FIRST; every denial is zero-mutation.
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
 * Review finding (EMPTY ≠ drained): after a controller restart the in-memory
 * lifecycle registry is empty even though a durable restart-lost fence may
 * have NO termination evidence at all. A stuck unknown fence WITHOUT durable
 * exit/termination evidence therefore refuses fail-closed (409
 * restart_lost_termination_evidence_unavailable, naming the accepted
 * restart-quiescence/exact-generation recovery paths); only stuck fences
 * bearing durable child_real_exit evidence (C-015 kind 4) — or no stuck
 * fences at all — may proceed. A missing verification capability is 503,
 * never a default-to-resettable.
 *
 * Declaration budget: the durable scope registry is bounded to 32 distinct
 * declaration ids per store (never recycled; retries of existing ids always
 * remain possible). Exhaustion maps to 409 abandonment_capacity_exhausted.
 *
 * Error envelope = the product-api frozen { error: { code, message } }.
 */

const ADMIN_RESET_AGENT = 'agt_hr-agent'

// Owner-designated sole privileged authority for HR reset/resume: the
// canonical current CTO (研发总监) machine identity, bound EXACTLY by the
// accepted bootstrap authority's Principal UUID + canonical agentId. The
// authsvc-signed token is the canonical identity mapping (`sub` + `agent_id`
// are asserted by the issuer, never caller input) — any mismatch fails
// closed. Exactly ONE pair is authorized: the legacy OpenClaw-era
// `cto-agent` / `3e2439d2-…` pair (a historical scheduler-fixture identity)
// is deliberately NOT accepted alongside it. No display names, no
// scope-derived admin role (workflow.admin alone is explicitly NOT authority
// here), no human-OpenID allowlist, no generalized RBAC: this is one narrow
// delegated owner/recovery capability for exactly one operation.
const AUTHORIZED_RESET_PRINCIPAL_ID = '4e5a4578-0645-4133-bd35-b80e453dfee9'
const AUTHORIZED_RESET_AGENT_ID = 'agt_cto-agent'

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
    if (principal?.principalId !== AUTHORIZED_RESET_PRINCIPAL_ID
        || principal?.agentId !== AUTHORIZED_RESET_AGENT_ID) {
      throw new HttpError(403, 'forbidden',
        'turn abandonment is reserved for the exact canonical CTO recovery principal (principal UUID + agentId must both match)')
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
 * r4130766489 + EMPTY-slot review finding: a declaration is not exit
 * evidence. Before any mutation the entry must establish that no identifiable
 * execution of the target Agent is in flight — across ALL lifecycle slots,
 * not only the READY ones that `registrySnapshot` projects. STARTUP and REAP
 * are explicit local limitations (not drained), a missing
 * lifecycle-verification or termination-evidence capability fails closed
 * instead of defaulting to resettable, and an EMPTY slot is accepted ONLY
 * when no stuck fence lacks durable exit evidence (an empty in-memory
 * registry after a restart is not termination evidence).
 */
function refuseUnDrainedExecution(router, agentId) {
  if (typeof router.lifecycleSlotSnapshot !== 'function') {
    throw new HttpError(503, 'liveness_verification_unavailable',
      'agent lifecycle slot snapshot is unavailable; a reset never defaults to allowed without execution-state verification')
  }
  if (typeof router.stuckFenceWithoutDurableExitEvidenceForAgent !== 'function') {
    throw new HttpError(503, 'liveness_verification_unavailable',
      'termination-evidence verification is unavailable; a reset never defaults to allowed without durable exit evidence checks')
  }
  const slot = router.lifecycleSlotSnapshot(agentId) ?? { state: 'EMPTY' }
  if (slot?.state === 'STARTUP') {
    throw new HttpError(409, 'startup_in_progress',
      `agent ${agentId} generation ${slot.generation} is still STARTUP (not drained); drain it via the existing controlled shutdown/startup path first — zero mutation performed`)
  }
  if (slot?.state === 'REAP') {
    throw new HttpError(409, 'reaping_in_progress',
      `agent ${agentId} generation ${slot.generation} is still REAP (real exit not settled); wait for the existing reap path to drain — zero mutation performed`)
  }
  const live = (typeof router.registrySnapshot === 'function' ? router.registrySnapshot() : [])
    .find(entry => entry?.agentId === agentId && entry?.alive === true)
  if (live !== undefined) {
    throw new HttpError(409, 'live_execution_present',
      `agent ${agentId} still has a live process (pid ${live.pid}); abandon only after the existing controlled cancel/shutdown drained it — an administrator declaration is not termination evidence`)
  }
  const unproven = router.stuckFenceWithoutDurableExitEvidenceForAgent(agentId)
  if (unproven !== null && unproven !== undefined) {
    throw new HttpError(409, 'restart_lost_termination_evidence_unavailable',
      `agent ${agentId} still has an unsettled unknown-fence turn (${unproven.handle}) with NO durable exit/termination evidence`
        + `${unproven.failureReason ? ` (recorded: ${unproven.failureReason})` : ''}; an EMPTY local registry after a restart is not termination evidence`
        + ' — settle the old execution via the accepted restart-quiescence proof / exact-generation recovery path first — zero mutation performed')
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
      refuseUnDrainedExecution(service, agentId)
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
