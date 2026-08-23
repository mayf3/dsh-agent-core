/**
 * @agent-core/notification-ingress/src/auth.js — Notification Ingress service
 * authentication (NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 §4 +
 * NOTIFICATION_INGRESS_AUTH_RESOURCE_SCOPE_CLARIFICATION_V1).
 *
 * Frozen authentication chain (C-AUTH-001..014):
 *
 *   Authorization: Basic base64(clientId:clientSecret)
 *     -> per-request online verification against the auth-service token
 *        endpoint (/oauth/token, grant_type=client_credentials, the frozen
 *        resource + scope; management APIs are FORBIDDEN — C-AUTH-014)
 *     -> 200 = credential valid; callerPrincipalId = VERIFIED clientId
 *        (request-body caller identity is UNTRUSTED and wholly ignored —
 *        C-AUTH-003)
 *     -> operator allowlist {svc-forum, svc-workflow} -> 403 when a verified
 *        clientId is not listed (C-AUTH-004; per-agent clients land here)
 *     -> 401 for missing/malformed/invalid/wrong-audience credentials
 *     -> 503 AUTH_INCONCLUSIVE for transport/5xx/temporarily_unavailable/
 *        malformed responses — inconclusive is NEVER misreported as 401 and
 *        NEVER admitted (C-AUTH-009)
 *     -> no credential or verification caching (C-AUTH-013)
 *
 * Exact literals (clarification spec DEC-NAC-001/002, mirrored in auth config
 * only as a validated exact value):
 *
 *   NOTIFICATION_RESOURCE = agent-core-notification-ingress-v1
 *   NOTIFICATION_SCOPE    = notification.deliver
 *
 * The auth config (§4.4) is an operator-owned 0600/0700 trusted file
 * containing NO clientSecret (clientId is a public identifier). A missing or
 * invalid config is a legal not-ready state: the ingress mounts and every
 * /v1/deliver answers 503 AUTH_NOT_CONFIGURED (fail closed per call, never at
 * boot) — it NEVER degrades to anonymous acceptance.
 *
 * Redaction (C-AUTH-012 / C-BND-005): raw credentials never appear in logs,
 * error messages, HTTP responses, evidence or stores. `redactForLog` is the
 * single scrub helper used on every error path that can touch wire data.
 */

import { lstatSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Frozen audience resource literal (clarification CTR-NAC-001/002). */
export const NOTIFICATION_RESOURCE = 'agent-core-notification-ingress-v1'

/** Frozen minimum scope literal (clarification CTR-NAC-001). */
export const NOTIFICATION_SCOPE = 'notification.deliver'

/** Frozen caller allowlist (Program §2.3). */
export const ALLOWED_CALLERS = Object.freeze(['svc-forum', 'svc-workflow'])

/** OAuth errors the token endpoint can return that we know how to classify. */
export const KNOWN_OAUTH_ERRORS = Object.freeze([
  'invalid_client', 'invalid_scope', 'invalid_grant', 'invalid_resource',
  'invalid_target', 'temporarily_unavailable',
])

/** OAuth errors that PROVE the credential is invalid for this surface. */
const INVALID_CREDENTIAL_OAUTH_ERRORS = new Set([
  'invalid_client', 'invalid_scope', 'invalid_grant', 'invalid_resource', 'invalid_target',
])

export const DEFAULT_ROUTER_DEADLINE_MS = 300000
export const DEFAULT_RETENTION_MS = 604800000
export const DEFAULT_MAX_RECORDS = 100000
export const DEFAULT_AUTH_TIMEOUT_MS = 15000

const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600

/**
 * Scrub credential material from any text before it reaches logs, error
 * messages or HTTP responses (C-AUTH-012 / C-BND-005). Removes raw
 * Authorization header values, `Basic <base64>` patterns and any extra
 * caller-supplied secret strings registered for this request.
 * @param {string} text - potentially tainted text.
 * @param {string[]} [extraSecrets] - additional exact strings to scrub.
 * @returns {string} scrubbed text.
 */
export function redactForLog(text, extraSecrets = []) {
  let out = typeof text === 'string' ? text : String(text ?? '')
  // Redact the ENTIRE value of any `authorization: <scheme> <credential>`
  // form, to end of line (any scheme: Basic / Bearer / ...).
  out = out.replace(/(authorization\s*[:=]\s*).+$/gimu, '$1[REDACTED]')
  // Redact bare Basic schemes anywhere ("Basic <base64>").
  out = out.replace(/Basic\s+[A-Za-z0-9+/=_-]+/giu, 'Basic [REDACTED]')
  for (const secret of extraSecrets) {
    if (typeof secret === 'string' && secret !== '') {
      out = out.split(secret).join('[REDACTED]')
    }
  }
  return out
}

function authError(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

/**
 * Parse the `Authorization` header into a Basic credential (C-AUTH-001).
 * Missing / non-Basic / bad base64 / non-UTF-8 / structurally broken values
 * all return null — the caller answers 401 without ever echoing the value.
 * @param {string|undefined} header - raw Authorization header value.
 * @returns {{clientId:string, clientSecret:string}|null}
 */
export function parseBasicCredential(header) {
  if (typeof header !== 'string') return null
  const trimmed = header.trim()
  if (trimmed === '') return null
  const match = /^Basic[ \t]+(.+)$/i.exec(trimmed)
  if (match === null) return null
  let bytes
  try {
    bytes = Buffer.from(match[1], 'base64')
  } catch {
    return null
  }
  // base64 leniency round-trip check: corrupted encodings must not pass.
  if (bytes.toString('base64').replace(/=+$/u, '') !== match[1].replace(/=+$/u, '')) return null
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
  const separator = text.indexOf(':')
  if (separator <= 0) return null
  const clientId = text.slice(0, separator)
  const clientSecret = text.slice(separator + 1)
  if (clientId === '' || clientSecret === '') return null
  return { clientId, clientSecret }
}

/** Normalize + validate an HTTPS origin (same rule as the provisioning client). */
function normalizeHttpsOrigin(origin) {
  let url
  try {
    url = new URL(origin)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) return null
  return url.origin
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function notConfigured(reason) {
  return { ok: false, code: 'AUTH_NOT_CONFIGURED', reason }
}

/**
 * Load + fully validate the operator auth config (§4.4 / C-BND-002).
 *
 * The file must be an absolute path, a non-symlink 0600 file inside a 0700
 * directory owned by the (non-root) control-plane account, and contain:
 *
 *   { authServiceOrigin (HTTPS origin, required),
 *     audience (must EQUAL the frozen resource literal — validated mirror),
 *     allowlist ({svc-forum: clientId, svc-workflow: clientId}, both present,
 *                non-empty, DISTINCT — C-AUTH-006),
 *     routerDeadlineMs? / retentionMs? / maxRecords? (positive integers) }
 *
 * A missing file, unreadable file, bad metadata, malformed JSON or invalid
 * structure is a legal not-ready state: `{ok:false, code:'AUTH_NOT_CONFIGURED'}`
 * — the caller fails CLOSED per call (503), never at boot, never anonymously.
 *
 * @param {string} authConfigFile - absolute path of the auth config.
 * @returns {{ok:true, config:object}|{ok:false, code:'AUTH_NOT_CONFIGURED', reason:string}}
 */
export function loadAuthConfig(authConfigFile) {
  if (typeof authConfigFile !== 'string' || authConfigFile === '') {
    return notConfigured('auth config path is not configured')
  }
  let stat
  try {
    stat = lstatSync(authConfigFile)
  } catch {
    return notConfigured(`auth config file is missing: ${authConfigFile}`)
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    return notConfigured('auth config must be a regular non-symlink file')
  }
  if ((stat.mode & 0o7777) !== PRIVATE_FILE_MODE) {
    return notConfigured('auth config file mode must be 0600')
  }
  let dirStat
  try {
    dirStat = lstatSync(dirname(authConfigFile))
  } catch {
    return notConfigured('auth config directory is unavailable')
  }
  if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) {
    return notConfigured('auth config must live in a regular directory')
  }
  if ((dirStat.mode & 0o7777) !== PRIVATE_DIRECTORY_MODE) {
    return notConfigured('auth config directory mode must be 0700')
  }
  const processUid = process.getuid?.()
  const processGid = process.getgid?.()
  if (stat.uid !== processUid || dirStat.uid !== processUid) {
    return notConfigured('auth config must be owned by the control-plane account')
  }
  if (processUid === 0 || stat.uid === 0) {
    return notConfigured('a root-owned auth config is never trusted')
  }
  let document
  try {
    document = JSON.parse(readFileSync(authConfigFile, 'utf8'))
  } catch {
    return notConfigured('auth config is not valid JSON')
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return notConfigured('auth config must be a JSON object')
  }
  const origin = normalizeHttpsOrigin(document.authServiceOrigin)
  if (origin === null) {
    return notConfigured('authServiceOrigin must be an HTTPS origin')
  }
  if (document.audience !== NOTIFICATION_RESOURCE) {
    return notConfigured(`audience must be exactly ${NOTIFICATION_RESOURCE}`)
  }
  if (document.allowlist === null || typeof document.allowlist !== 'object' || Array.isArray(document.allowlist)) {
    return notConfigured('allowlist must be an object')
  }
  const allowlist = {}
  for (const caller of ALLOWED_CALLERS) {
    const clientId = document.allowlist[caller]
    if (typeof clientId !== 'string' || clientId === '') {
      return notConfigured(`allowlist.${caller} clientId is required`)
    }
    allowlist[caller] = clientId
  }
  const seen = new Set(Object.values(allowlist))
  if (seen.size !== ALLOWED_CALLERS.length) {
    return notConfigured('svc-forum and svc-workflow must map DISTINCT clientIds (C-AUTH-006)')
  }
  for (const [key, value] of Object.entries({
    routerDeadlineMs: document.routerDeadlineMs,
    retentionMs: document.retentionMs,
    maxRecords: document.maxRecords,
  })) {
    if (value !== undefined && !isPositiveInteger(value)) {
      return notConfigured(`${key} must be a positive integer when present`)
    }
  }
  return {
    ok: true,
    config: {
      authServiceOrigin: origin,
      audience: NOTIFICATION_RESOURCE,
      allowlist,
      routerDeadlineMs: document.routerDeadlineMs ?? DEFAULT_ROUTER_DEADLINE_MS,
      retentionMs: document.retentionMs ?? DEFAULT_RETENTION_MS,
      maxRecords: document.maxRecords ?? DEFAULT_MAX_RECORDS,
    },
  }
}

/**
 * Create the per-request service-caller verifier (C-AUTH-002).
 *
 * The verification protocol mirrors the repo's existing primitive
 * (agent-credential-provisioning auth-client.verifyCredential): one
 * client_credentials mint against the auth-service token endpoint with the
 * frozen resource + scope; `200` = valid. Only /oauth/token is ever called —
 * the principal/client management APIs are forbidden (C-AUTH-014) and nothing
 * in this module constructs their paths. `fetchImpl` is injectable for tests
 * and the acceptance driver (same seam discipline as the primitive).
 *
 * @param {object} [options]
 * @param {Function} [options.fetchImpl] - fetch-like transport (default global).
 * @param {number} [options.timeoutMs] - mint timeout (default 15s).
 * @returns {{verify(object):Promise<object>}} the verifier.
 */
export function createServiceAuthVerifier({ fetchImpl = fetch, timeoutMs = DEFAULT_AUTH_TIMEOUT_MS } = {}) {
  return {
    /**
     * Verify one request credential against a loaded auth config.
     * @param {{clientId:string, clientSecret:string}} credential
     * @param {object} config - validated config from loadAuthConfig.
     * @returns {Promise<{ok:true, callerPrincipalId:string, callerName:string}
     *   |{ok:false, status:number, code:string, callerPrincipalId?:string}>}
     */
    async verify(credential, config) {
      const basic = Buffer.from(`${credential.clientId}:${credential.clientSecret}`, 'utf8').toString('base64')
      const url = `${config.authServiceOrigin}/oauth/token`
      let response
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            resource: NOTIFICATION_RESOURCE,
            scope: NOTIFICATION_SCOPE,
          }).toString(),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch {
        // Transport failure (network/DNS/timeout): inconclusive, never 401.
        return { ok: false, status: 503, code: 'AUTH_INCONCLUSIVE' }
      }
      let body
      try {
        body = await response.json()
      } catch {
        return { ok: false, status: 503, code: 'AUTH_INCONCLUSIVE' }
      }
      if (response.ok) {
        if (typeof body?.access_token !== 'string' || body.access_token === '') {
          // 200 without a token cannot prove validity: inconclusive.
          return { ok: false, status: 503, code: 'AUTH_INCONCLUSIVE' }
        }
        return allowlistResult(credential.clientId, config)
      }
      const oauthError = typeof body?.error === 'string' && KNOWN_OAUTH_ERRORS.includes(body.error)
        ? body.error
        : undefined
      if (oauthError === 'temporarily_unavailable') {
        return { ok: false, status: 503, code: 'AUTH_INCONCLUSIVE' }
      }
      if (oauthError !== undefined && INVALID_CREDENTIAL_OAUTH_ERRORS.has(oauthError)) {
        // Includes wrong-audience invalid_target/invalid_resource (C-AUTH-005):
        // valid-for-someone-else is invalid for THIS surface.
        return { ok: false, status: 401, code: 'INVALID_CREDENTIAL' }
      }
      // Unknown OAuth error code or unexpected HTTP status: we can neither
      // prove the credential invalid nor valid -> fail loud, never admit.
      return { ok: false, status: 503, code: 'AUTH_INCONCLUSIVE' }
    },
  }
}

/** Map a VERIFIED clientId onto the allowlist (C-AUTH-003/004). */
function allowlistResult(clientId, config) {
  for (const [callerName, allowedId] of Object.entries(config.allowlist)) {
    if (allowedId === clientId) {
      return { ok: true, callerPrincipalId: clientId, callerName }
    }
  }
  return { ok: false, status: 403, code: 'CALLER_NOT_ALLOWED', callerPrincipalId: clientId }
}

export { authError }
