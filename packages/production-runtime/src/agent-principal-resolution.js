/**
 * @agent-core/production-runtime/src/agent-principal-resolution.js — the
 * `agentPrincipalResolutionAccess` LOCAL capability provider for
 * agent_resolve_principal (AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1,
 * accepted, implementation_authority: contracts).
 *
 * Trusted seam: this handler runs IN-PROCESS in the control-plane broker
 * gateway. The model-visible arg is EXACTLY { principalId } (CTR-EPAR-001);
 * everything else is derived by the trusted runtime:
 *
 *   caller identity  = the gateway-frozen ACTUAL caller (context.callerAgentId);
 *                      the principalId argument NEVER selects credentials,
 *                      source identity or any authorization input (CTR-EPAR-002)
 *   token            = acquired by the runtime for the ACTUAL caller through
 *                      the injected `acquireCallerToken` seam (Broker trusted
 *                      credential store + V1 direct-machine issuance; the
 *                      gateway's own requiredScopes grant check already ran
 *                      before this handler; the token stays in the trusted
 *                      parent transport and never reaches the model)
 *   Auth origin      = the fixed configured auth-service origin (CTR-EPAR-002:
 *                      pinned by deployment configuration, never a tool arg)
 *
 * Composition order (CTR-EPAR-003): the Auth read is a closed two-field
 * observation — a public Auth response alone NEVER succeeds; the local Agent
 * Definition validation (exact `getAgent` id equality + explicit enabled
 * check) must also pass before the success envelope. One coherent Definition
 * snapshot per admission: a single synchronous getAgent call, no await
 * between the read and the enabled check, no re-resolution through a
 * display-name fallback (CTR-EPAR-005).
 *
 * Closed behavior: read-only (no Session mutation, no run admission, no
 * Workflow transition, no scheduler job, no message send); no automatic
 * retry of the Auth read (bounded deadline, one attempt); no cache — every
 * call freshly reads Auth and the Definition registry.
 */

import {
  AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID,
} from '../../broker/src/capabilities/agent-principal-resolution.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const AGENT_ID_RE = /^agt_[a-z0-9-]+$/
const AUTH_READ_TIMEOUT_MS = 5000

/**
 * Authoritative first-action validation (CTR-EPAR-001): exactly one
 * `principalId` string matching the Auth CTR-EAPR-002 UUID grammar. No
 * trimming, no case rewriting of the INPUT (the response is compared
 * case-insensitively against the canonical lowercase output).
 * @returns {{ok:true, principalId:string} | {ok:false, detail:string}}
 */
export function validateResolveArgs(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, detail: 'arguments must be an object with exactly principalId' }
  }
  const keys = Object.keys(input)
  if (keys.length !== 1 || keys[0] !== 'principalId') {
    return { ok: false, detail: 'unknown properties: only principalId is accepted' }
  }
  const { principalId } = input
  if (typeof principalId !== 'string' || !UUID_RE.test(principalId)) {
    return { ok: false, detail: `principalId must match ${UUID_RE.source}` }
  }
  return { ok: true, principalId }
}

/**
 * Map one Auth route response to the closed CTR-EPAR-004 outcome.
 * @param {{status:number, body:object|undefined}} res
 * @returns {{kind:'ok', principalId:string, agentId:string}
 *          | {kind:'error', code:string, detail:string}}
 */
export function mapAuthResponse({ status, body }) {
  if (status === 200) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return { kind: 'error', code: 'identity_resolution_unavailable', detail: 'auth response body is not a JSON object' }
    }
    const keys = Object.keys(body)
    if (keys.length !== 2 || !keys.includes('principalId') || !keys.includes('agentId')) {
      return { kind: 'error', code: 'identity_resolution_unavailable', detail: 'auth response fields are not exactly {principalId, agentId}' }
    }
    const { principalId, agentId } = body
    if (typeof principalId !== 'string' || !UUID_RE.test(principalId)) {
      return { kind: 'error', code: 'identity_resolution_unavailable', detail: 'auth response principalId is not a canonical UUID' }
    }
    if (typeof agentId !== 'string'
      || agentId.length < 5 || agentId.length > 128
      || !AGENT_ID_RE.test(agentId)) {
      return { kind: 'error', code: 'identity_resolution_unavailable', detail: 'auth response agentId violates the stored-id grammar' }
    }
    return { kind: 'ok', principalId, agentId }
  }
  // Error statuses: classify by the auth contract's status/code families.
  const code = typeof body?.error === 'string' ? body.error : undefined
  if (status === 404 && code === 'PRINCIPAL_NOT_FOUND') return { kind: 'error', code: 'principal_not_found', detail: 'no Principal exists for the exact UUID' }
  if (status === 422 && code === 'PRINCIPAL_NOT_AGENT') return { kind: 'error', code: 'principal_not_agent', detail: 'the Principal is not of type AGENT' }
  if (status === 409 && code === 'PRINCIPAL_DISABLED') return { kind: 'error', code: 'principal_disabled', detail: 'the AGENT Principal is disabled' }
  if (status === 409 && code === 'AGENT_MAPPING_MISSING') return { kind: 'error', code: 'agent_mapping_missing', detail: 'the AGENT Principal has no canonical agentId' }
  if (status === 409 && code === 'IDENTITY_RESOLUTION_AMBIGUOUS') return { kind: 'error', code: 'identity_resolution_ambiguous', detail: 'the UUID or its reverse agentId relation is ambiguous' }
  if (status === 401) return { kind: 'error', code: 'credential_invalid', detail: 'the auth-service rejected the caller token' }
  if (status === 403) return { kind: 'error', code: 'access_denied', detail: 'the caller lacks auth.agent.resolve on the auth-service side' }
  return { kind: 'error', code: 'identity_resolution_unavailable', detail: `auth read failed with status ${status}` }
}

/**
 * Create the provider.
 * @param {object} deps
 * @param {object} deps.definition - the Agent Definition service (exact
 *   `getAgent`; duplicates are rejected at config load, so an exact match is
 *   unique by construction).
 * @param {string} deps.authServiceOrigin - the fixed configured auth-service
 *   origin (CTR-EPAR-002).
 * @param {({agentId:string}) => Promise<{accessToken:string}>} deps.acquireCallerToken -
 *   trusted token seam for the ACTUAL caller (compose.js wires the Broker
 *   credential store + requestAccessToken with the exact resource/scope);
 *   thrown errors must carry `code` in {credential_unavailable,
 *   credential_invalid, access_denied, transport_failure}.
 * @param {typeof fetch} [deps.fetchImpl] - transport seam (tests).
 * @param {number} [deps.timeoutMs] - bounded read deadline (<= 5000).
 * @returns {{ handlers: { resolve: Function } }}
 */
export function createAgentPrincipalResolutionAccess({
  definition,
  authServiceOrigin,
  acquireCallerToken,
  fetchImpl = fetch,
  timeoutMs = AUTH_READ_TIMEOUT_MS,
}) {
  if (definition === undefined || typeof definition.getAgent !== 'function') {
    throw new TypeError('agent-principal-resolution: definition with getAgent is required')
  }
  if (typeof authServiceOrigin !== 'string' || authServiceOrigin === '') {
    throw new TypeError('agent-principal-resolution: fixed authServiceOrigin is required')
  }
  if (typeof acquireCallerToken !== 'function') {
    throw new TypeError('agent-principal-resolution: acquireCallerToken seam is required')
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > AUTH_READ_TIMEOUT_MS) {
    throw new TypeError(`agent-principal-resolution: timeoutMs must be 1..${AUTH_READ_TIMEOUT_MS}`)
  }

  function deny(code, detail) {
    return { ok: false, error: { code, detail } }
  }

  /**
   * The `resolve` operation handler: (args, trustedContext) -> broker envelope.
   */
  async function resolve(rawArgs, context) {
    // ── CTR-EPAR-001: authoritative validation, first action, zero writes ──
    const checked = validateResolveArgs(rawArgs)
    if (!checked.ok) return deny('invalid_arguments', checked.detail)
    const { principalId } = checked

    // ── Trusted runtime-derived caller (never from args, CTR-EPAR-002) ────
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

    // ── ONE fixed-path Auth read; no retry, bounded deadline (CTR-EPAR-004)─
    let res
    try {
      res = await fetchImpl(`${authServiceOrigin}/api/v1/agent-principals/${encodeURIComponent(principalId)}/agent`, {
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
    if (mapped.kind !== 'ok') return deny(mapped.code, mapped.detail)

    // The Auth answer must describe the requested UUID (case-insensitive;
    // auth returns the canonical lowercase form).
    if (mapped.principalId.toLowerCase() !== principalId.toLowerCase()) {
      return deny('identity_resolution_unavailable', 'auth response principalId does not match the requested UUID')
    }

    // ── Local Definition validation: a public Auth answer NEVER succeeds
    //    alone (CTR-EPAR-003). One synchronous exact lookup — no await
    //    between the read and the enabled check (CTR-EPAR-005). ─────────────
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

    return { ok: true, result: { principalId: mapped.principalId, agentId: mapped.agentId } }
  }

  // Provider shape: handlers keyed by CAPABILITY ID then operation name —
  // the exact contract the broker execute-time resolver closure merges.
  return { handlers: { [AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID]: { resolve } } }
}
