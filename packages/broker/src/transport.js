/**
 * @agent-core/broker — Generic authorized HTTP transport (V1, P1).
 *
 * Closes the shared gap identified by docs/investigations/broker-capability-parity.md
 * §3 (P1): the DSH broker previously could only execute process-internal
 * handlers; this module adds the authorized-HTTP pipeline used by EVERY HTTP
 * capability (Forum / Workflow / OKR / future):
 *
 *   1. resolve the operation's `http` binding (target / method / path are
 *      PINNED from manifest data — never model input);
 *   2. obtain the caller credential from the identity seam (credential.js);
 *   3. issue a short-lived access token via the auth-service
 *      `client_credentials` grant (resource = target audience, scope =
 *      manifest.requiredScopes), cached per (clientId, audience, scope);
 *   4. bind path placeholders / query / JSON body from the manifest-declared
 *      argument names;
 *   5. fetch the pinned origin+path with `Authorization: Bearer <token>`;
 *      401 → invalidate the token, re-issue once and retry — but ONLY for
 *      GET and idempotency-keyed writes (reusing the SAME Idempotency-Key so
 *      a retried write is deduplicated server-side); non-idempotent writes
 *      fail closed on 401 to avoid double-application;
 *   6. parse JSON / text responses; map non-2xx, malformed bodies, network
 *      and timeout failures onto the capability error table.
 *
 * Downstream error preservation (error-mapping hardening): a non-2xx response
 * is never flattened to a bare `http_4xx`. The transport extracts, GENERICALLY
 * and from response data only:
 *
 *   - `errorCode`: the downstream service error `code` when the body carries
 *     one in a recognized envelope shape and it matches the safe code grammar
 *     (e.g. svc-workflow `{"error":{"code":"principal_not_found",...}}`,
 *     forum `{"error":"not_found"}`, generic `{"code":...}`); otherwise the
 *     canonical `http_4xx` / `http_5xx`. The mapping layer still resolves the
 *     code against the manifest's declared error table (fail-closed), so an
 *     undeclared service code degrades to the declared `http_4xx`/`http_5xx`
 *     — never to an undeclared wire code.
 *   - `status`: the upstream HTTP status (unchanged).
 *   - `detail`: the SANITIZED service message (redacted + truncated); raw
 *     bodies / headers / credentials never reach the caller.
 *   - `requestId`: the downstream `x-request-id` response header, validated
 *     and passed through verbatim; null when absent — NEVER fabricated.
 *
 * Security discipline (translated from the OpenClaw BrokerCore design, same
 * guarantees):
 *   - origin / method / path / audience / scope come ONLY from trusted
 *     manifest + target registry data; arbitrary URL fetch is impossible;
 *   - the tool argument schema never carries identity fields, and the
 *     transport never reads identity from `args` — the credential comes only
 *     from the injected provider;
 *   - the only forwarded header besides Authorization is `Idempotency-Key`
 *     (generated in the trusted zone, never from model input);
 *   - no credential or token is ever returned to the caller or logged.
 *
 * The transport is 100% generic: it contains no `if (forum|workflow|okr)`
 * branches. Business systems differ ONLY in manifest data (see
 * src/capabilities/).
 */

import { sanitizeErrorDetail } from './error-detail-sanitizer.js'
export { sanitizeErrorDetail } from './error-detail-sanitizer.js'

/** HTTP methods the transport will execute (pinned per capability). */
export const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

/** Request headers the transport is willing to forward beyond Authorization. */
export const ALLOWED_REQUEST_HEADERS = new Set(['Idempotency-Key'])

/** Token endpoint path (auth-service V1 contract, evidence: auth-service/src/routes/oauth.ts). */
export const TOKEN_ENDPOINT_PATH = '/oauth/token'

/** Default per-request timeout. */
export const DEFAULT_TIMEOUT_MS = 15000

/** Maximum 401 retries (one fresh token). */
export const MAX_TOKEN_RETRIES = 1

/** Stable Broker classifications for failures returned by the token endpoint. */
export const TOKEN_FAILURE_CODES = Object.freeze({
  credential: 'credential_invalid',
  authorization: 'authorization_denied',
  downstream: 'transport_failure',
})

/**
 * A redacted token-endpoint failure. Response bodies can contain sensitive
 * diagnostics and are deliberately never retained in the Error object.
 */
export class TokenEndpointError extends Error {
  constructor(message, { status, oauthError, errorCode = TOKEN_FAILURE_CODES.downstream } = {}) {
    super(message)
    this.name = 'TokenEndpointError'
    this.status = status
    this.oauthError = oauthError
    this.errorCode = errorCode
  }
}

/** Map OAuth wire errors onto the minimal stable Broker responsibility layers. */
export function classifyTokenEndpointFailure(status, oauthError) {
  if (status === 401 && oauthError === 'invalid_client') return TOKEN_FAILURE_CODES.credential
  if (status === 403 && oauthError === 'insufficient_scope') return TOKEN_FAILURE_CODES.authorization
  if (
    status === 400
    && ['invalid_scope', 'invalid_grant', 'invalid_resource'].includes(oauthError)
  ) return TOKEN_FAILURE_CODES.authorization
  return TOKEN_FAILURE_CODES.downstream
}

/** Refresh tokens this many ms before nominal expiry. */
const TOKEN_CACHE_SAFETY_MS = 5000
const KNOWN_OAUTH_ERRORS = new Set([
  'invalid_client', 'invalid_scope', 'invalid_grant', 'invalid_resource',
  'invalid_target', 'insufficient_scope', 'temporarily_unavailable',
])

/**
 * Issue ONE access token via the auth-service `client_credentials` grant —
 * the SAME primitive the HTTP transport uses, exported for thin reuse by
 * LOCAL (in-process) capabilities whose authorization is the Auth grant
 * (AGENT_DEFINITION_ACCESS_V1: agent.definition.write checks the scope
 * `agent.definition.write` here — the auth-service is the ONLY grant
 * authority; a failed/denied token request means the caller's grant does
 * not cover the requested scope and the call fails closed).
 *
 * @param {object} opts
 * @param {{clientId:string, clientSecret:string}} opts.credential - the
 *   caller's MachineClient credential (from the trusted store).
 * @param {string} opts.authServiceOrigin - token endpoint origin.
 * @param {string} opts.resource - nominal resource the token is minted for.
 * @param {string} opts.scope - space-separated scope list requested.
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{accessToken:string, expiresIn:number}>}
 * @throws {Error} when the token endpoint is unreachable, denies the
 *   request, or returns a malformed body — every failure is a DENIAL.
 */
export async function requestAccessToken({
  credential,
  authServiceOrigin,
  resource,
  scope,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const basic = Buffer.from(`${credential.clientId}:${credential.clientSecret}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    resource,
    scope,
  })
  let res
  try {
    res = await fetchImpl(`${authServiceOrigin}${TOKEN_ENDPOINT_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw new TokenEndpointError('token endpoint unreachable')
  }
  if (!res.ok) {
    let oauthError
    try {
      const body = await res.json()
      oauthError = typeof body?.error === 'string' && KNOWN_OAUTH_ERRORS.has(body.error)
        ? body.error
        : undefined
    } catch {
      // Deliberately discard malformed/non-JSON bodies: never echo an Auth
      // response into logs or caller-visible details.
    }
    const errorCode = classifyTokenEndpointFailure(res.status, oauthError)
    throw new TokenEndpointError(
      `token endpoint rejected the request (status ${res.status}${oauthError ? `, error ${oauthError}` : ''})`,
      { status: res.status, oauthError, errorCode },
    )
  }
  let data
  try {
    data = await res.json()
  } catch {
    throw new TokenEndpointError('token endpoint returned a malformed JSON body')
  }
  if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new TokenEndpointError('token response missing access_token')
  }
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : parseInt(data.expires_in, 10) || 300
  return { accessToken: data.access_token, expiresIn }
}

/**
 * Canonical transport error codes. Every HTTP capability manifest declares
 * these in its error table (via `withTransportErrors`), so the mapping layer's
 * fail-closed code resolution surfaces them as-is.
 */
export const TRANSPORT_ERRORS = [
  { code: 'credential_unavailable', description: 'No caller credential was available from the identity seam; the request was not authorized (fail-closed).' },
  { code: 'credential_invalid', description: 'The token endpoint rejected the configured client credential.' },
  { code: 'authorization_denied', description: 'The credential was accepted but the requested resource or scope was not authorized.' },
  { code: 'binding_error', description: 'The capability HTTP binding could not be satisfied (path/query/body mismatch).' },
  { code: 'http_4xx', description: 'The target service rejected the request (HTTP 4xx).' },
  { code: 'http_5xx', description: 'The target service failed (HTTP 5xx).' },
  { code: 'malformed_response', description: 'The target service returned a body that could not be parsed as JSON.' },
  { code: 'transport_failure', description: 'The transport could not complete the request (network error, timeout, or token endpoint failure).' },
]

/**
 * Merge the canonical transport error codes into a capability manifest's
 * error table (deduplicated). Generic mechanism — no per-capability code.
 * @param {object} manifest - capability manifest data (errors table optional).
 * @returns {object} manifest with transport codes declared.
 */
export function withTransportErrors(manifest) {
  const existing = new Set((manifest.errors || []).map((e) => e.code))
  return {
    ...manifest,
    errors: [...(manifest.errors || []), ...TRANSPORT_ERRORS.filter((e) => !existing.has(e.code))],
  }
}

/** Raised for malformed / mismatched request bindings (client input semantics). */
export class TransportBindingError extends Error {
  constructor(detail) {
    super(detail)
    this.name = 'TransportBindingError'
  }
}

/** Extract `{name}` placeholders from a path template, in order. */
export function extractPathPlaceholders(path) {
  const out = []
  const re = /\{([^}]+)\}/g
  let m
  while ((m = re.exec(path)) !== null) out.push(m[1])
  return out
}

/**
 * Interpolate `{name}` placeholders from pathParams with EXACT-match
 * enforcement (missing / extra / empty params are binding errors) and
 * encodeURIComponent on every value (path-injection prevention). Dot segments
 * ("." / "..") are rejected: URL normalization would otherwise rewrite the
 * manifest-pinned path.
 * @param {string} pathTemplate - e.g. `/api/threads/{threadId}`.
 * @param {Record<string,string>} pathParams - placeholder → value.
 * @returns {string} concrete path with no placeholders left.
 * @throws {TransportBindingError}
 */
export function buildPath(pathTemplate, pathParams) {
  const placeholders = extractPathPlaceholders(pathTemplate)
  const providedKeys = pathParams ? Object.keys(pathParams) : []
  const expected = new Set(placeholders)

  if (placeholders.length === 0) {
    if (providedKeys.length > 0) {
      throw new TransportBindingError(`path "${pathTemplate}" has no placeholders but pathParams were provided: [${providedKeys.join(', ')}]`)
    }
    return pathTemplate
  }
  for (const ph of placeholders) {
    if (!Object.hasOwn(pathParams, ph)) {
      throw new TransportBindingError(`missing path parameter "${ph}" for path "${pathTemplate}"`)
    }
  }
  for (const key of providedKeys) {
    if (!expected.has(key)) {
      throw new TransportBindingError(`undeclared path parameter "${key}" (path "${pathTemplate}" placeholders: [${placeholders.join(', ')}])`)
    }
  }
  let result = pathTemplate
  for (const ph of placeholders) {
    const raw = pathParams[ph]
    if (raw === undefined || raw === null || raw === '') {
      throw new TransportBindingError(`empty value for path parameter "${ph}"`)
    }
    // Dot segments: encodeURIComponent leaves "." and ".." untouched, and
    // Node/WHATWG URL normalization collapses them (e.g. "/a/../b" → "/b").
    // A model-supplied "." / ".." would therefore rewrite the manifest-pinned
    // path — a hard violation of the pinned-path invariant. Fail closed here
    // in the generic binding layer; no URL policy framework needed.
    if (raw === '.' || raw === '..') {
      throw new TransportBindingError(`path parameter "${ph}" must not be a dot segment (got "${raw}")`)
    }
    result = result.replace(`{${ph}}`, encodeURIComponent(String(raw)))
  }
  if (/\{|\}/.test(result)) {
    throw new TransportBindingError(`unresolved placeholders in path "${result}"`)
  }
  return result
}

/**
 * Serialize a query map, omitting undefined/null/'' entries.
 * @param {Record<string, unknown>} [query]
 * @returns {string} query string WITHOUT leading '?', or '' when empty.
 */
export function buildQuery(query) {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }
  return params.toString()
}

// ── Downstream error preservation (generic; response data only) ─────────────

/** Safe grammar a downstream error `code` must match to be surfaced at all. */
export const SERVICE_CODE_PATTERN = /^[a-z][a-zA-Z0-9_]{0,63}$/

/** `x-request-id` pass-through contract: visible ASCII, bounded; else null. */
export const REQUEST_ID_PATTERN = /^[\x21-\x7e]{1,128}$/


/**
 * Extract `{ code?, message? }` from a downstream error body, generically.
 * Recognized envelope shapes (checked in order):
 *   svc-workflow  {"error": {"code": "...", "message": "...", "details": ...}}
 *   generic       {"code": "...", "message": "..."}
 *   forum/legacy  {"error": "<slug-or-text>", "message": "..."}
 * A `code` is only returned when it matches the safe SERVICE_CODE_PATTERN
 * (human prose like "no such thread" is a message, not a code). Never throws;
 * unparsable input yields `{}`.
 * @param {string} bodyText - raw response body text.
 * @returns {{ code?: string, message?: string }}
 */
export function parseServiceErrorBody(bodyText) {
  let data
  try {
    data = JSON.parse(bodyText)
  } catch {
    return {}
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return {}
  const nested = data.error
  const source =
    nested !== null && typeof nested === 'object' && !Array.isArray(nested) ? nested : data
  const out = {}
  if (typeof source.code === 'string' && SERVICE_CODE_PATTERN.test(source.code)) {
    out.code = source.code
  } else if (typeof data.error === 'string' && SERVICE_CODE_PATTERN.test(data.error)) {
    out.code = data.error
  }
  for (const key of ['message', 'error', 'detail']) {
    const value = source[key]
    if (typeof value === 'string' && value.length > 0) {
      out.message = value
      break
    }
  }
  return out
}

/**
 * Read the downstream `x-request-id` response header for error correlation.
 * Validated against REQUEST_ID_PATTERN; anything missing/oversized/non-visible
 * yields null. NEVER generates an id — a fabricated request-id would send the
 * operator debugging a request that does not exist.
 * @param {Headers} headers - the fetch response headers.
 * @returns {string | null}
 */
export function extractRequestId(headers) {
  const raw = headers.get('x-request-id')
  if (raw === null) return null
  const value = raw.trim()
  return REQUEST_ID_PATTERN.test(value) ? value : null
}

/**
 * Build the transport error object for a non-2xx (or malformed) downstream
 * response. Pure given (status, bodyText, headers).
 * @param {number} status - upstream HTTP status.
 * @param {string} bodyText - raw upstream body text (never surfaced raw).
 * @param {Headers} headers - upstream response headers.
 * @returns {{ errorCode: string, status: number, detail: string, requestId: string | null }}
 */
export function buildDownstreamError(status, bodyText, headers) {
  const { code, message } = parseServiceErrorBody(bodyText)
  const canonical = status < 500 ? 'http_4xx' : 'http_5xx'
  return {
    // A pattern-valid downstream code is offered to the mapping layer, which
    // still resolves it against the manifest's DECLARED error table and falls
    // back to this canonical code when the service code is not declared.
    errorCode: code ?? canonical,
    status,
    detail:
      message !== undefined
        ? sanitizeErrorDetail(message)
        : bodyText.trim() === ''
          ? '(downstream returned an empty error body)'
          : '(downstream returned a non-JSON error body)',
    requestId: extractRequestId(headers),
  }
}

/**
 * Normalize extra request headers against the allowlist (Idempotency-Key
 * only). Anything else is rejected — no model-controllable header can reach
 * the wire.
 * @param {Record<string,string>} [headers]
 * @returns {Record<string,string>}
 * @throws {TransportBindingError}
 */
export function buildRequestHeaders(headers) {
  const result = {}
  for (const [key, value] of Object.entries(headers || {})) {
    if (!ALLOWED_REQUEST_HEADERS.has(key)) {
      throw new TransportBindingError(`header "${key}" is not allowed (only ${[...ALLOWED_REQUEST_HEADERS].join(', ')})`)
    }
    if (typeof value !== 'string' || value.length === 0 || value.length > 128 || !/^[\x21-\x7e]+$/.test(value)) {
      throw new TransportBindingError(`header "${key}" must be 1-128 visible ASCII characters`)
    }
    result[key] = value
  }
  return result
}

/**
 * Generate an Idempotency-Key in the TRUSTED zone (model uncontrollable).
 * Format satisfies the svc-workflow server contract (1-128 visible ASCII,
 * evidence: svc-workflow/src/http/handlers/mod.rs `idempotency_key`).
 * @param {string} capabilityId - manifest wire id, used as the key prefix.
 * @param {() => number} [clock] - ms epoch; injectable for tests.
 * @param {() => string} [rand] - random fragment; injectable for tests.
 * @returns {string}
 */
export function createIdempotencyKey(capabilityId, clock = Date.now, rand = () => Math.random().toString(36).slice(2, 10)) {
  const prefix = String(capabilityId).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `ik-${prefix}-${clock()}-${rand()}`
}

/**
 * Create the generic authorized HTTP transport.
 *
 * @param {object} opts
 * @param {{ getCredential: () => Promise<import('./credential.js').Credential | undefined> }} opts.credentialProvider
 *   - the identity seam (required; see credential.js).
 * @param {import('./targets.js').Target[]} [opts.targets] - target registry.
 * @param {string} [opts.authServiceOrigin] - token endpoint origin
 *   (e.g. http://127.0.0.1:4001).
 * @param {typeof fetch} [opts.fetchImpl] - injectable fetch (defaults to
 *   global fetch; tests use mock servers / stubs).
 * @param {() => number} [opts.clock] - ms epoch (token expiry bookkeeping).
 * @param {() => string} [opts.rand] - random fragment source.
 * @param {number} [opts.timeoutMs] - default request timeout.
 * @returns {{
 *   execute: (call: { manifest: object, operation: string, args: object }) =>
 *     Promise<unknown | { errorCode: string, status?: number, detail?: string }>,
 *   tokenCacheStats: () => { size: number },
 *   clearCache: () => void,
 * }}
 */
export function createHttpTransport(opts = {}) {
  const {
    credentialProvider,
    targets = [],
    authServiceOrigin = '',
    fetchImpl = fetch,
    clock = Date.now,
    rand = () => Math.random().toString(36).slice(2, 10),
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  const targetMap = new Map(targets.map((t) => [t.targetId, t]))
  /** @type {Map<string, { token: string, expiresAt: number }>} */
  const tokenCache = new Map()

  // ── Token lifecycle (client_credentials, per auth-service V1 contract) ──

  const cacheKey = (credential, target, scope) => `${credential.clientId}|${target.audience}|${scope}`

  async function getAccessToken(credential, target, scope) {
    const key = cacheKey(credential, target, scope)
    const cached = tokenCache.get(key)
    if (cached !== undefined && cached.expiresAt > clock() + TOKEN_CACHE_SAFETY_MS) {
      return cached.token
    }
    const issued = await issueAccessToken(credential, target, scope)
    tokenCache.set(key, { token: issued.accessToken, expiresAt: clock() + issued.expiresIn * 1000 })
    return issued.accessToken
  }

  function invalidateAccessToken(credential, target, scope) {
    tokenCache.delete(cacheKey(credential, target, scope))
  }

  async function issueAccessToken(credential, target, scope) {
    const issued = await requestAccessToken({
      credential,
      authServiceOrigin,
      resource: target.audience,
      scope,
      fetchImpl,
      timeoutMs,
    })
    return issued
  }

  // ── Request binding (generic; driven by manifest data) ──────────────────

  /**
   * Bind a request from the operation's `http` block + validated args.
   * Only argument names the manifest declares for path/query/body are
   * forwarded; everything else in `args` is ignored (identity fields
   * included — see the self-reported-identity tests).
   * @returns {{ path: string, query: Record<string, unknown>, body: object | undefined }}
   */
  function bindRequest(http, args) {
    const pathParams = {}
    for (const name of http.pathParams || []) {
      const value = args[name]
      if (value === undefined || value === null || value === '') {
        throw new TransportBindingError(`empty value for path parameter "${name}"`)
      }
      pathParams[name] = String(value)
    }
    const path = buildPath(http.path, pathParams)

    const query = {}
    for (const name of http.query || []) {
      const value = args[name]
      if (value !== undefined && value !== null && value !== '') query[name] = value
    }

    const body = {}
    let hasBody = false
    for (const name of http.body || []) {
      const value = args[name]
      if (value !== undefined) {
        body[name] = value
        hasBody = true
      }
    }
    return { path, query, body: hasBody ? body : undefined }
  }

  // ── Execute ─────────────────────────────────────────────────────────────

  /**
   * Execute one http-bound operation end-to-end.
   * @param {object} call
   * @param {object} call.manifest - validated capability manifest.
   * @param {string} call.operation - operation name.
   * @param {object} call.args - validated model arguments (identity-neutral).
   * @returns {Promise<unknown>} the parsed business response (JSON or text),
   *   or an error object `{ errorCode, status?, detail? }`.
   */
  async function execute({ manifest, operation, args }) {
    const op = manifest.operations.find((o) => o.name === operation)
    const http = op && op.http
    if (!http) return { errorCode: 'unsupported_operation' }

    const target = targetMap.get(http.target)
    if (target === undefined) {
      return { errorCode: 'binding_error', detail: `unknown target "${http.target}" for capability "${manifest.id}"` }
    }

    // Identity: the credential comes ONLY from the injected seam. Arguments
    // carrying agentId / principalId / sessionKey / credential are never read
    // here — they are not in the binding lists and cannot reach the wire.
    const credential = await credentialProvider.getCredential()
    if (credential === undefined) {
      return { errorCode: 'credential_unavailable' }
    }
    if (typeof credential.clientId !== 'string' || credential.clientSecret === undefined || typeof credential.clientSecret !== 'string') {
      return { errorCode: 'credential_unavailable', detail: 'identity seam returned a malformed credential' }
    }

    const scope = (manifest.requiredScopes || []).join(' ')

    let binding
    try {
      binding = bindRequest(http, args)
    } catch (err) {
      if (err instanceof TransportBindingError) {
        return { errorCode: 'binding_error', detail: err.message }
      }
      throw err
    }

    // Idempotency-Key: generated in the trusted zone when the capability asks
    // for it; reused verbatim on the 401 retry (server-side dedup).
    const idempotencyKey = http.idempotencyKey ? createIdempotencyKey(manifest.id, clock, rand) : undefined

    let accessToken
    try {
      accessToken = await getAccessToken(credential, target, scope)
    } catch (err) {
      return { errorCode: err?.errorCode ?? 'transport_failure', status: err?.status, detail: `token acquisition failed: ${err.message}` }
    }

    // Transport-controlled headers (Authorization / Content-Type / Accept) are
    // set directly; buildRequestHeaders guards ONLY the extra user-facing
    // header (Idempotency-Key) against the allowlist.
    const extraHeaders = {}
    if (idempotencyKey !== undefined) extraHeaders['Idempotency-Key'] = idempotencyKey
    const buildInit = (token) => {
      const headers = { Authorization: `Bearer ${token}`, ...buildRequestHeaders(extraHeaders) }
      if (binding.body !== undefined) {
        headers['Content-Type'] = 'application/json'
        headers['Accept'] = 'application/json'
      }
      return {
        method: http.method,
        headers,
        body: binding.body !== undefined ? JSON.stringify(binding.body) : undefined,
        signal: AbortSignal.timeout(http.timeoutMs ?? timeoutMs),
      }
    }

    const url = binding.path + (Object.keys(binding.query).length > 0 ? `?${buildQuery(binding.query)}` : '')

    let res
    try {
      res = await fetchImpl(`${target.allowedOrigin}${url}`, buildInit(accessToken))
    } catch (err) {
      return { errorCode: 'transport_failure', detail: `network error: ${err.message}` }
    }

    // 401 → invalidate + re-issue + retry ONCE, reusing the same Idempotency-Key.
    // Retry policy (audit follow-up): ONLY GET requests and idempotency-keyed
    // writes are retried. A non-idempotent write (no Idempotency-Key) is NOT
    // retried: its first attempt may have been applied server-side, and a
    // retry could double-apply it. All real Broker write capabilities either
    // carry an Idempotency-Key or are one-shot by design.
    if (res.status === 401 && (http.method === 'GET' || idempotencyKey !== undefined)) {
      invalidateAccessToken(credential, target, scope)
      try {
        accessToken = await getAccessToken(credential, target, scope)
      } catch (err) {
        return { errorCode: err?.errorCode ?? 'transport_failure', status: err?.status, detail: `token refresh failed: ${err.message}` }
      }
      try {
        res = await fetchImpl(`${target.allowedOrigin}${url}`, buildInit(accessToken))
      } catch (err) {
        return { errorCode: 'transport_failure', detail: `network error on retry: ${err.message}` }
      }
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      return buildDownstreamError(res.status, bodyText, res.headers)
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        return await res.json()
      } catch {
        return { errorCode: 'malformed_response', status: res.status, requestId: extractRequestId(res.headers) }
      }
    }
    const text = await res.text().catch(() => '')
    return text === '' ? null : text
  }

  return {
    execute,
    tokenCacheStats: () => ({ size: tokenCache.size }),
    clearCache: () => tokenCache.clear(),
  }
}

/**
 * Build the operation → handler map for an http-bound capability. Every
 * operation with an `http` block gets a generic handler that delegates to the
 * transport; operations without one are left for `handlersByCapability`.
 * Generic mechanism — a capability is NEVER hardcoded here.
 *
 * @param {object} manifest - validated capability manifest.
 * @param {{ execute: Function }} transport - a transport instance.
 * @returns {Record<string, (operation: string, args: object, principal: unknown) => Promise<unknown>>}
 */
export function createHttpHandlers(manifest, transport) {
  const handlers = {}
  for (const op of manifest.operations) {
    if (!op.http) continue
    handlers[op.name] = async (_operation, args) => {
      const res = await transport.execute({ manifest, operation: op.name, args })
      return res
    }
  }
  return handlers
}
