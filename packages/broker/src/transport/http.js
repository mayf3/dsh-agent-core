import { TransportControlError } from './control.js'
import { requestAccessToken, DEFAULT_TIMEOUT_MS } from './token.js'
import { TransportBindingError, buildPath, buildQuery, buildRequestHeaders, createIdempotencyKey } from './binding.js'
import {
  applyHttpBodyProjections,
  applyHttpReadBodyProjections,
  assertHttpReadProjectionTargetsAbsent,
  evaluateHttpReadResponseChecks,
} from './body-projection.js'
import { buildDownstreamError, extractRequestId } from './errors.js'
import { sanitizeErrorDetail } from './error-detail-sanitizer.js'

const TOKEN_CACHE_SAFETY_MS = 5000

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

  async function getAccessToken(credential, target, scope, control) {
    const key = cacheKey(credential, target, scope)
    const cached = tokenCache.get(key)
    if (cached !== undefined && cached.expiresAt > clock() + TOKEN_CACHE_SAFETY_MS) {
      return cached.token
    }
    const issued = await issueAccessToken(credential, target, scope, control)
    control?.check()
    tokenCache.set(key, { token: issued.accessToken, expiresAt: clock() + issued.expiresIn * 1000 })
    return issued.accessToken
  }

  function invalidateAccessToken(credential, target, scope) {
    tokenCache.delete(cacheKey(credential, target, scope))
  }

  async function issueAccessToken(credential, target, scope, control) {
    const issued = await requestAccessToken({
      credential,
      authServiceOrigin,
      resource: target.audience,
      scope,
      fetchImpl,
      timeoutMs, control,
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
    for (const name of http.body || []) {
      const value = args[name]
      if (value !== undefined) {
        body[name] = value
      }
    }
    const projectedBody = applyHttpBodyProjections(http, args, body)
    assertHttpReadProjectionTargetsAbsent(http, projectedBody)
    return { path, query, body: Object.keys(projectedBody).length > 0 ? projectedBody : undefined }
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
  async function executeCore({ manifest, operation, args, control, executeRead }) {
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
    let binding
    try {
      binding = bindRequest(http, args)
    } catch (err) {
      if (err instanceof TransportBindingError) {
        return { errorCode: 'binding_error', detail: err.message }
      }
      throw err
    }

    let credential
    try {
      credential = control ? await control.wait(() => credentialProvider.getCredential()) : await credentialProvider.getCredential()
    } catch (error) {
      if (!control || error instanceof TransportControlError) throw error
      return { errorCode: 'credential_unavailable' }
    }
    if (credential === undefined) return { errorCode: 'credential_unavailable' }
    if (typeof credential.clientId !== 'string' || credential.clientSecret === undefined || typeof credential.clientSecret !== 'string') {
      return { errorCode: 'credential_unavailable', detail: 'identity seam returned a malformed credential' }
    }

    const scope = (manifest.requiredScopes || []).join(' ')

    // Idempotency-Key: generated in the trusted zone when the capability asks
    // for it; reused verbatim on the 401 retry (server-side dedup).
    const idempotencyKey = http.idempotencyKey ? createIdempotencyKey(manifest.id, clock, rand) : undefined

    let accessToken
    try {
      accessToken = await getAccessToken(credential, target, scope, control)
    } catch (err) {
      if (err instanceof TransportControlError) throw err
      return { errorCode: err?.errorCode ?? 'transport_failure', status: err?.status, detail: sanitizeErrorDetail(`token acquisition failed: ${err.message}`) }
    }

    if (http.readProjection) {
      const read = http.readProjection
      if (typeof executeRead !== 'function') {
        return { errorCode: 'authoritative_reference_unavailable', detail: 'read projection gateway executor is unavailable' }
      }
      const sourceArgs = {}
      for (const { sourceArg, targetArg } of read.argumentBindings) {
        if (!Object.hasOwn(args, sourceArg) || args[sourceArg] === undefined) {
          return { errorCode: 'invalid_arguments', detail: `read projection source argument is missing: ${sourceArg}` }
        }
        sourceArgs[targetArg] = args[sourceArg]
      }
      let sourceEnvelope
      try {
        sourceEnvelope = await executeRead({ capabilityId: read.capabilityId, operation: read.operation, args: sourceArgs })
      } catch (error) {
        if (error instanceof TransportControlError) throw error
        return { errorCode: 'transport_failure', detail: sanitizeErrorDetail(`authorized source read failed: ${error.message}`) }
      }
      if (sourceEnvelope?.ok !== true) {
        const error = sourceEnvelope?.error
        return { errorCode: error?.code ?? 'authoritative_reference_unavailable', status: error?.status, detail: error?.detail }
      }
      const sourceResult = sourceEnvelope.result
      const failedCheck = evaluateHttpReadResponseChecks(read, args, sourceResult)
      if (failedCheck) return { errorCode: failedCheck }
      try {
        binding.body = applyHttpReadBodyProjections(read, sourceResult, binding.body || {})
      } catch (err) {
        if (err instanceof TransportBindingError) return { errorCode: 'authoritative_reference_unavailable', detail: err.message }
        throw err
      }
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
        ...(control ? { redirect: 'error' } : {}),
        signal: control?.signal ?? AbortSignal.timeout(http.timeoutMs ?? timeoutMs),
      }
    }

    const url = binding.path + (Object.keys(binding.query).length > 0 ? `?${buildQuery(binding.query)}` : '')

    let res
    try {
      control?.attempt()
      const send = () => fetchImpl(`${target.allowedOrigin}${url}`, buildInit(accessToken))
      res = control ? await control.wait(send) : await send()
    } catch (err) {
      if (err instanceof TransportControlError) throw err
      return { errorCode: 'transport_failure', detail: sanitizeErrorDetail(`network error: ${err.message}`) }
    }

    // 401 → invalidate + re-issue + retry ONCE, reusing the same Idempotency-Key.
    // Retry policy (audit follow-up): ONLY GET requests and idempotency-keyed
    // writes are retried. A non-idempotent write (no Idempotency-Key) is NOT
    // retried: its first attempt may have been applied server-side, and a
    // retry could double-apply it. All real Broker write capabilities either
    // carry an Idempotency-Key or are one-shot by design.
    if (control?.retry401 !== false && res.status === 401 && (http.method === 'GET' || idempotencyKey !== undefined)) {
      invalidateAccessToken(credential, target, scope)
      try {
        accessToken = await getAccessToken(credential, target, scope, control)
      } catch (err) {
        return { errorCode: err?.errorCode ?? 'transport_failure', status: err?.status, detail: sanitizeErrorDetail(`token refresh failed: ${err.message}`) }
      }
      try {
        res = await fetchImpl(`${target.allowedOrigin}${url}`, buildInit(accessToken))
      } catch (err) {
        return { errorCode: 'transport_failure', detail: sanitizeErrorDetail(`network error on retry: ${err.message}`) }
      }
    }

    if (control) {
      const text = await control.readEntity(res)
      if (!res.ok) return buildDownstreamError(res.status, text, res.headers)
      // Keep successful downstream JSON distinct from transport-owned errors.
      try { return { value: JSON.parse(text) } }
      catch { throw new TransportControlError('protocol') }
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

  async function execute(call) {
    if (!call.control) return executeCore(call)
    try { return await call.control.wait(() => executeCore(call)) }
    catch (error) {
      if (error instanceof TransportControlError) return { errorCode: error.errorCode }
      return { errorCode: 'transport_failure' }
    }
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
export function createHttpHandlers(manifest, transport, { executeRead } = {}) {
  const handlers = {}
  for (const op of manifest.operations) {
    if (!op.http) continue
    handlers[op.name] = async (_operation, args) => {
      const res = await transport.execute({ manifest, operation: op.name, args, executeRead })
      return res
    }
  }
  return handlers
}
