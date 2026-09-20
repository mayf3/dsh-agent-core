/**
 * @agent-core/production-runtime/src/identity/agent-principal-reverse-resolution.js — the
 * `agentPrincipalReverseResolutionAccess` LOCAL capability provider for
 * agent_resolve_principal_by_agent (AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1,
 * accepted, implementation_authority: contracts).
 *
 * Trusted seam (mirrors the forward sibling agent-principal-resolution.js):
 * this handler runs IN-PROCESS in the control-plane broker gateway. The
 * model-visible arg is EXACTLY { agentId } (CTR-APR-001/002); everything else
 * is derived by the trusted runtime:
 *
 *   caller identity  = the gateway-frozen ACTUAL caller (context.callerAgentId);
 *                      the agentId argument NEVER selects credentials, source
 *                      identity or any authorization input (CTR-APR-003 item 1)
 *   token            = acquired by the runtime for the ACTUAL caller through
 *                      the injected `acquireCallerToken` seam with EXACTLY
 *                      resource 'identity-directory' × scope
 *                      'auth.directory.read' (the baseline internal directory
 *                      entitlement callers already hold); the token stays in
 *                      the trusted parent transport and never reaches the model
 *   Auth origin      = the fixed configured auth-service origin (never a tool
 *                      argument; unconfigured = transport_failure per call)
 *   Auth read        = GET /api/v1/directory/agents/{agentId}/principal — one
 *                      attempt, no retry, bounded deadline <= 5000ms
 *
 * Composition order (CTR-APR-003 items 5-6): a 200 Auth answer is only a
 * closed three-field observation — {principalId, agentId, principalStatus}
 * with a canonical UUID, a byte-equal agentId and principalStatus in
 * {active, disabled} — and the local Agent Definition validation (exact
 * getAgent id equality + explicit enabled check) must also pass before the
 * success envelope. A disabled TARGET (auth 200 principalStatus=disabled)
 * classifies as the error `principal_disabled` so a model can never route a
 * disabled Agent's Principal UUID downstream. One coherent Definition snapshot
 * per admission: a single synchronous getAgent call, no await between the read
 * and the enabled check.
 *
 * STRICT_CANONICAL boundary: this resolves the production-effective stored
 * identity relation; no canonical-lifecycle semantics are claimed or returned.
 *
 * Closed behavior: read-only (no Session mutation, no run admission, no
 * Workflow transition, no scheduler job, no message send); no cache — every
 * call freshly reads Auth and the Definition registry.
 */

import {
  AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID,
} from '../../../broker/src/capabilities/agent-principal-reverse-resolution.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const AGENT_ID_RE = /^agt_[a-z0-9-]+$/
const AUTH_READ_TIMEOUT_MS = 5000

function validAgentId(value) {
  return typeof value === 'string' && value.length >= 5 && value.length <= 128 && AGENT_ID_RE.test(value)
}

/**
 * Authoritative first-action validation (CTR-APR-001/002): exactly one
 * `agentId` string matching the stored-id grammar. No trimming, no case
 * rewriting, no substring or prefix semantics.
 * @returns {{ok:true, agentId:string} | {ok:false, detail:string}}
 */
export function validateResolveByAgentArgs(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, detail: 'arguments must be an object with exactly agentId' }
  }
  const keys = Object.keys(input)
  if (keys.length !== 1 || keys[0] !== 'agentId') {
    return { ok: false, detail: 'unknown properties: only agentId is accepted' }
  }
  const { agentId } = input
  if (!validAgentId(agentId)) {
    return { ok: false, detail: `agentId must match ${AGENT_ID_RE.source} with length 5..128` }
  }
  return { ok: true, agentId }
}

/**
 * Map one Auth reverse-route response to the closed CTR-APR-004 outcome.
 * @param {{status:number, body:object|undefined}} res
 * @returns {{kind:'ok', principalId:string, agentId:string}
 *          |{kind:'disabled'}
 *          | {kind:'error', code:string, detail:string}}
 */
export function mapAuthResponse({ status, body }) {
  if (status === 200) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return { kind: 'error', code: 'identity_resolution_unavailable', detail: 'auth response body is not a JSON object' }
    }
    const keys = Object.keys(body)
    if (keys.length !== 3 || !keys.includes('principalId') || !keys.includes('agentId') || !keys.includes('principalStatus')) {
      return { kind: 'error', code: 'identity_resolution_unavailable', detail: 'auth response fields are not exactly {principalId, agentId, principalStatus}' }
    }
    const { principalId, agentId, principalStatus } = body
    if (typeof principalId !== 'string' || !UUID_RE.test(principalId)) {
      return { kind: 'error', code: 'identity_resolution_unavailable', detail: 'auth response principalId is not a canonical UUID' }
    }
    if (!validAgentId(agentId)) {
      return { kind: 'error', code: 'identity_resolution_unavailable', detail: 'auth response agentId violates the stored-id grammar' }
    }
    if (principalStatus !== 'active' && principalStatus !== 'disabled') {
      return { kind: 'error', code: 'identity_resolution_unavailable', detail: 'auth response principalStatus is outside the directory value domain' }
    }
    if (principalStatus === 'disabled') return { kind: 'disabled' }
    return { kind: 'ok', principalId, agentId }
  }
  // Error statuses: classify by the auth contract's status/code families.
  const code = typeof body?.error === 'string' ? body.error : undefined
  if (status === 404 && code === 'AGENT_NOT_FOUND') return { kind: 'error', code: 'agent_not_found', detail: 'no Principal exists for the exact agentId' }
  if (status === 422 && code === 'PRINCIPAL_NOT_AGENT') return { kind: 'error', code: 'principal_not_agent', detail: 'the relation row is not an AGENT Principal' }
  if (status === 409 && code === 'IDENTITY_RESOLUTION_AMBIGUOUS') return { kind: 'error', code: 'identity_resolution_ambiguous', detail: 'the exact agentId relation is ambiguous' }
  if (status === 401) return { kind: 'error', code: 'credential_invalid', detail: 'the auth-service rejected the caller token' }
  if (status === 403) return { kind: 'error', code: 'access_denied', detail: 'the caller lacks auth.directory.read on the auth-service side' }
  return { kind: 'error', code: 'identity_resolution_unavailable', detail: `auth read failed with status ${status}` }
}

/**
 * Create the provider.
 * @param {object} deps
 * @param {object} deps.definition - the Agent Definition service (exact
 *   `getAgent`; duplicates are rejected at config load, so an exact match is
 *   unique by construction).
 * @param {string} deps.authServiceOrigin - the fixed configured auth-service
 *   origin (CTR-APR-003 item 3).
 * @param {({agentId:string}) => Promise<{accessToken:string}>} deps.acquireCallerToken -
 *   trusted token seam for the ACTUAL caller (compose.js wires the Broker
 *   credential store + requestAccessToken with resource 'identity-directory'
 *   and scope 'auth.directory.read'); thrown errors must carry `code` in
 *   {credential_unavailable, credential_invalid, access_denied, transport_failure}.
 * @param {typeof fetch} [deps.fetchImpl] - transport seam (tests).
 * @param {number} [deps.timeoutMs] - bounded read deadline (<= 5000).
 * @returns {{ handlers: { resolve: Function } }}
 */
export function createAgentPrincipalReverseResolutionAccess({
  definition,
  authServiceOrigin,
  acquireCallerToken,
  fetchImpl = fetch,
  timeoutMs = AUTH_READ_TIMEOUT_MS,
}) {
  if (definition === undefined || typeof definition.getAgent !== 'function') {
    throw new TypeError('agent-principal-reverse-resolution: definition with getAgent is required')
  }
  if (authServiceOrigin !== undefined && (typeof authServiceOrigin !== 'string' || authServiceOrigin === '')) {
    throw new TypeError('agent-principal-reverse-resolution: authServiceOrigin must be a non-empty string when provided')
  }
  if (typeof acquireCallerToken !== 'function') {
    throw new TypeError('agent-principal-reverse-resolution: acquireCallerToken seam is required')
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > AUTH_READ_TIMEOUT_MS) {
    throw new TypeError(`agent-principal-reverse-resolution: timeoutMs must be 1..${AUTH_READ_TIMEOUT_MS}`)
  }

  function deny(code, detail) {
    return { ok: false, error: { code, detail } }
  }

  /**
   * The `resolve` operation handler: (args, trustedContext) -> broker envelope.
   */
  async function resolve(rawArgs, context) {
    // ── CTR-APR-001/002: authoritative validation, first action, zero writes ──
    const checked = validateResolveByAgentArgs(rawArgs)
    if (!checked.ok) return deny('invalid_arguments', checked.detail)
    const { agentId } = checked

    // An unconfigured fixed origin is a deployment wiring fault: fail closed
    // per call (never at composition time — the runtime must boot without an
    // auth origin, exactly like the credential-store fail-closed posture).
    if (typeof authServiceOrigin !== 'string' || authServiceOrigin === '') {
      return deny('transport_failure', 'the fixed auth-service origin is not configured')
    }

    // ── Trusted runtime-derived caller (never from args, CTR-APR-003 item 1) ──
    const callerAgentId = context?.callerAgentId
    if (typeof callerAgentId !== 'string' || callerAgentId === '') {
      return deny('internal_error', 'trusted caller identity missing from the gateway context')
    }

    // ── Token for the ACTUAL caller; stays in the trusted parent transport ─
    let token
    try {
      token = await acquireCallerToken({ agentId: callerAgentId })
    } catch (error) {
      const code = typeof error?.code === 'string'
        && ['credential_unavailable', 'credential_invalid', 'access_denied', 'transport_failure'].includes(error.code)
        ? error.code
        : 'transport_failure'
      return deny(code, 'the trusted token acquisition failed')
    }
    if (typeof token?.accessToken !== 'string' || token.accessToken === '') {
      return deny('transport_failure', 'the trusted token seam returned no access token')
    }

    // ── ONE fixed-path Auth read; no retry, bounded deadline (CTR-APR-003
    //    item 4). The grammar makes agentId URL-safe by construction. ──────
    let res
    try {
      res = await fetchImpl(`${authServiceOrigin}/api/v1/directory/agents/${encodeURIComponent(agentId)}/principal`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/json',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      return deny('identity_resolution_unavailable', 'the auth read failed or timed out')
    }
    let body
    try {
      body = await res.json()
    } catch {
      body = undefined
    }
    const mapped = mapAuthResponse({ status: res.status, body })
    if (mapped.kind === 'disabled') return deny('principal_disabled', 'the AGENT Principal exists but is disabled')
    if (mapped.kind !== 'ok') return deny(mapped.code, mapped.detail)

    // The Auth answer must describe the requested agentId byte-for-byte
    // (the auth route proves exact equality server-side; re-verified here).
    if (mapped.agentId !== agentId) {
      return deny('identity_resolution_unavailable', 'auth response agentId does not match the requested agentId')
    }

    // ── Local Definition validation: a public Auth answer NEVER succeeds
    //    alone (CTR-APR-003 item 6). One synchronous exact lookup — no await
    //    between the read and the enabled check. ─────────────────────────────
    let record
    try {
      record = definition.getAgent(mapped.agentId)
    } catch {
      return deny('target_not_found', 'no Agent Definition exists for the resolved exact agentId')
    }
    if (record?.disabled === true) {
      return deny('target_disabled', 'the resolved Agent Definition is disabled')
    }
    if (record?.id !== mapped.agentId) {
      return deny('identity_resolution_unavailable', 'the definition lookup returned a different identity')
    }

    return { ok: true, result: { agentId: mapped.agentId, principalId: mapped.principalId } }
  }

  // Provider shape: handlers keyed by CAPABILITY ID then operation name —
  // the exact contract the broker execute-time resolver closure merges.
  return { handlers: { [AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID]: { resolve } } }
}
