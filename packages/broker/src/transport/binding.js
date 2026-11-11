export const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
export const ALLOWED_REQUEST_HEADERS = new Set(['Idempotency-Key'])

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

