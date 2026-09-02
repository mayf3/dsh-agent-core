/**
 * Inbound Bearer-token verification for the /scheduler/* read API
 * (AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 §3 R8).
 *
 * Seam = auth-service. The fleet-accepted consumer pattern (svc-forum
 * src/lib/auth-jwt.ts, svc-workflow Auth V1) is standard-OAuth RS256 tokens
 * verified against the auth-service JWKS public-key endpoint — a shared
 * symmetric secret is NOT used to verify inbound standard tokens. The exact
 * claims contract is the auth-service v1 machine token:
 *
 *   { iss, sub (principal UUID), aud, principal_type: 'agent'|'service',
 *     client_id, token_use: 'access', type: 'access', version, scope,
 *     agent_id? (agent tokens), jti, iat, nbf, exp }
 *
 * Fail-closed (R8/R-H9): ANY verification failure, a missing/unconfigured
 * JWKS seam, or a malformed token maps to 401 unauthenticated at the gate.
 * The verifier NEVER reaches the handler on failure.
 *
 * Zero third-party dependencies: node WebCrypto verifies RS256
 * (RSASSA-PKCS1-v1_5 / SHA-256); the JWKS document is fetched over HTTP and
 * cached for a bounded TTL (one immediate refresh on an unknown kid).
 */

const DEFAULT_CACHE_TTL_MS = 300_000
const DEFAULT_MAX_STALE_MS = 600_000
const DEFAULT_CLOCK_TOLERANCE_SEC = 60
const DIRECT_MACHINE_MAX_TTL_SEC = 600
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const SCOPE_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$/
const DIRECT_MACHINE_CLAIMS = new Set([
  'iss', 'sub', 'aud', 'principal_type', 'scope', 'token_use', 'type',
  'version', 'agent_id', 'client_id', 'jti', 'iat', 'nbf', 'exp',
])

/** Verification failure kinds (all gate to 401 — the split only shapes the message). */
export class TokenVerifyError extends Error {
  constructor(kind, message) {
    super(message)
    this.name = 'TokenVerifyError'
    this.kind = kind // 'TOKEN_INVALID_OR_EXPIRED' | 'TOKEN_CONTRACT_INVALID' | 'AUTH_JWKS_UNAVAILABLE' | 'AUTH_SEAM_NOT_CONFIGURED'
  }
}

function b64urlToBuffer(segment) {
  return Buffer.from(segment, 'base64url')
}

async function importJwkRsa(jwk) {
  if (jwk?.kty !== 'RSA'
    || (jwk.alg !== undefined && jwk.alg !== 'RS256')
    || (jwk.use !== undefined && jwk.use !== 'sig')
    || typeof jwk.n !== 'string'
    || typeof jwk.e !== 'string') {
    throw new TokenVerifyError('AUTH_JWKS_UNAVAILABLE', 'JWKS key is not a usable RSA key')
  }
  const key = jwk
  return globalThis.crypto.subtle.importKey(
    'jwk',
    key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

function requireNumericDate(claims, name) {
  const value = claims?.[name]
  if (!Number.isInteger(value) || value < 0) {
    throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', `token ${name} must be an integer NumericDate`)
  }
  return value
}

function parseCanonicalScopes(scope) {
  if (typeof scope !== 'string' || scope === '' || scope.trim() !== scope || scope.includes('  ')) {
    throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token scope is not a canonical non-empty string')
  }
  const values = scope.split(' ')
  if (values.some((value) => !SCOPE_PATTERN.test(value))) {
    throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token scope contains a non-canonical value')
  }
  if (new Set(values).size !== values.length || [...values].sort().join(' ') !== scope) {
    throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token scope must be unique and ASCII sorted')
  }
  return new Set(values)
}

/**
 * @param {object} opts
 * @param {string} opts.jwksUrl - auth-service JWKS endpoint (/.well-known/jwks.json)
 * @param {string} [opts.issuer] - required iss when configured
 * @param {string} [opts.audience] - required aud when configured
 * @param {number} [opts.cacheTtlMs] - JWKS cache TTL (default 300s)
 * @param {number} [opts.maxStaleMs] - trusted-cache maximum age (default 600s)
 * @param {number} [opts.clockToleranceSec] - exp/nbf tolerance (default 60s)
 * @param {Function} [opts.nowMs] - injectable wall clock (tests)
 * @param {Function} [opts.fetchImpl] - injectable fetch (tests)
 * @param {object} [opts.log] - { warn? } sink
 * @returns {{ verify: (bearer: string) => Promise<object> }} principal =
 *   { principalId, agentId|null, clientId, scopes:Set<string>, principalType }
 */
export function createJwksTokenVerifier(opts = {}) {
  const { jwksUrl, issuer, audience } = opts
  if (typeof jwksUrl !== 'string' || jwksUrl === '') {
    throw new TypeError('createJwksTokenVerifier: jwksUrl is required')
  }
  if (typeof issuer !== 'string' || issuer === '') {
    throw new TypeError('createJwksTokenVerifier: issuer is required')
  }
  if (typeof audience !== 'string' || audience === '') {
    throw new TypeError('createJwksTokenVerifier: audience is required')
  }
  const fetchImpl = opts.fetchImpl ?? fetch
  const cacheTtlMs = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  const maxStaleMs = opts.maxStaleMs ?? DEFAULT_MAX_STALE_MS
  const toleranceSec = opts.clockToleranceSec ?? DEFAULT_CLOCK_TOLERANCE_SEC
  const nowMs = opts.nowMs ?? (() => Date.now())
  const log = opts.log ?? {}
  let cache = null // { keys: Map<kid, CryptoKey>, fetchedAt }

  async function fetchJwks() {
    let res
    try {
      res = await fetchImpl(jwksUrl, { signal: AbortSignal.timeout(5_000) })
    } catch (error) {
      throw new TokenVerifyError('AUTH_JWKS_UNAVAILABLE', `JWKS endpoint unreachable: ${error?.message ?? error}`)
    }
    if (!res.ok) {
      throw new TokenVerifyError('AUTH_JWKS_UNAVAILABLE', `JWKS endpoint returned ${res.status}`)
    }
    let document
    try {
      document = await res.json()
    } catch {
      throw new TokenVerifyError('AUTH_JWKS_UNAVAILABLE', 'JWKS endpoint returned a malformed document')
    }
    const keys = new Map()
    for (const jwk of Array.isArray(document?.keys) ? document.keys : []) {
      if (typeof jwk?.kid !== 'string') continue
      try {
        keys.set(jwk.kid, await importJwkRsa(jwk))
      } catch (error) {
        ;(log.warn ?? (() => {}))(`scheduler-auth: skipping unusable JWKS kid ${jwk.kid}: ${error?.message}`)
      }
    }
    cache = { keys, fetchedAt: nowMs() }
    return cache
  }

  async function keyFor(kid) {
    const fresh = cache !== null && nowMs() - cache.fetchedAt < cacheTtlMs
    if (cache === null) await fetchJwks()
    else if (!fresh) {
      const trustedStale = nowMs() - cache.fetchedAt <= maxStaleMs
      try {
        await fetchJwks()
      } catch (error) {
        if (!trustedStale) throw error
        ;(log.warn ?? (() => {}))(`scheduler-auth: JWKS refresh failed; using trusted cache within max-stale: ${error?.message ?? error}`)
      }
    }
    if (cache.keys.has(kid)) return cache.keys.get(kid)
    // Unknown kid: exactly one immediate refresh, then reject.
    try {
      await fetchJwks()
    } catch {
      throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', `unknown token kid: ${kid}`)
    }
    if (cache.keys.has(kid)) return cache.keys.get(kid)
    throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', `unknown token kid: ${kid}`)
  }

  async function verify(bearer) {
    if (typeof bearer !== 'string' || bearer.length === 0 || bearer.length > 16384) {
      throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', 'missing or malformed bearer token')
    }
    const segments = bearer.split('.')
    if (segments.length !== 3) {
      throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', 'token is not a well-formed JWT')
    }
    let header
    try {
      header = JSON.parse(b64urlToBuffer(segments[0]).toString('utf8'))
    } catch {
      throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', 'token header is not valid JSON')
    }
    if (header?.alg !== 'RS256' || typeof header?.kid !== 'string') {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token must be RS256 with a kid')
    }
    const key = await keyFor(header.kid)
    let signatureOk = false
    try {
      signatureOk = await globalThis.crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        key,
        b64urlToBuffer(segments[2]),
        // The signing input is the raw ASCII `header.payload` — never decoded.
        Buffer.from(`${segments[0]}.${segments[1]}`, 'utf8'),
      )
    } catch {
      signatureOk = false
    }
    if (!signatureOk) {
      throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', 'token signature verification failed')
    }
    let claims
    try {
      claims = JSON.parse(b64urlToBuffer(segments[1]).toString('utf8'))
    } catch {
      throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', 'token payload is not valid JSON')
    }
    for (const claim of Object.keys(claims ?? {})) {
      if (!DIRECT_MACHINE_CLAIMS.has(claim)) {
        throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', `direct machine token carries forbidden claim: ${claim}`)
      }
    }
    const nowSec = Math.floor(nowMs() / 1000)
    const iat = requireNumericDate(claims, 'iat')
    const nbf = requireNumericDate(claims, 'nbf')
    const exp = requireNumericDate(claims, 'exp')
    if (nbf > iat || exp <= iat || exp - iat > DIRECT_MACHINE_MAX_TTL_SEC) {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token timing relationship or TTL is invalid')
    }
    if (iat - toleranceSec > nowSec || nbf - toleranceSec > nowSec) {
      throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', 'token is not yet valid')
    }
    if (exp + toleranceSec < nowSec) {
      throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', 'token is expired')
    }
    if (claims?.iss !== issuer) {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token issuer mismatch')
    }
    if (typeof claims?.aud !== 'string' || claims.aud !== audience) {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token audience must be the exact configured string')
    }
    if (claims?.type !== 'access' || claims?.token_use !== 'access' || claims?.version !== 'v1') {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token is not a V1 direct access token')
    }
    if (claims?.principal_type !== 'agent' && claims?.principal_type !== 'service') {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token is not a machine principal token')
    }
    if (typeof claims?.sub !== 'string' || !UUID_PATTERN.test(claims.sub)) {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token subject must be a principal UUID')
    }
    if (typeof claims?.client_id !== 'string' || claims.client_id === '') {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token carries no client_id')
    }
    if (typeof claims?.jti !== 'string' || claims.jti.length < 16) {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'token carries no usable jti')
    }
    if (claims.principal_type === 'agent' && (typeof claims.agent_id !== 'string' || claims.agent_id === '')) {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'agent token carries no agent_id')
    }
    if (claims.principal_type === 'service' && claims.agent_id !== undefined) {
      throw new TokenVerifyError('TOKEN_CONTRACT_INVALID', 'service token must not carry agent_id')
    }
    const scopes = parseCanonicalScopes(claims.scope)
    return {
      principalId: claims.sub,
      agentId: typeof claims.agent_id === 'string' ? claims.agent_id : null,
      clientId: typeof claims.client_id === 'string' ? claims.client_id : null,
      scopes,
      principalType: claims.principal_type,
    }
  }

  return { verify }
}

/**
 * Injectable stub for fixtures (SELF_SERVICE CTR-AUTH-002 pattern: the Auth
 * seam is always injectable in tests, never bypassed in production).
 * @param {Function|object} resolver - bearer -> principal | null (sync or async),
 *   or a map of bearer -> principal.
 * @returns {{ verify: (bearer: string) => Promise<object> }}
 */
export function createStubTokenVerifier(resolver) {
  const resolveValue = typeof resolver === 'function' ? resolver : (bearer) => resolver?.[bearer] ?? null
  return {
    verify: async (bearer) => {
      const principal = await resolveValue(bearer)
      if (principal === null || principal === undefined) {
        throw new TokenVerifyError('TOKEN_INVALID_OR_EXPIRED', 'stub: unknown bearer token')
      }
      return { scopes: new Set(), ...principal }
    },
  }
}
