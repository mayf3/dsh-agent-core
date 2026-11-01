import { sanitizeErrorDetail } from './error-detail-sanitizer.js'

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

