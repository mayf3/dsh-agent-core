/**
 * @agent-core/broker — Caller-visible downstream error detail sanitizer (V2).
 *
 * Applies the Forum V2 policy and preserves the pre-existing stronger Broker
 * redactions before code-point-correct truncation.
 */

/** Max CODE POINTS of a sanitized detail string (code-point-correct truncation). */
const DETAIL_MAX_LENGTH = 500

/**
 * Sensitive-content redaction patterns applied to EVERY detail string (redaction
 * layer 2 — runs AFTER the spec policy in sanitizeErrorDetail and is kept
 * verbatim; password / api-key forms and scheme-prefixed Authorization values
 * are covered HERE and must survive every future hardening). The
 * detail is derived from the service's own `message` field only (never from
 * raw headers / raw bodies), and these patterns are the second line of
 * defense: an upstream echo of auth material is replaced, not forwarded.
 */
const DETAIL_REDACTIONS = [
  // "Bearer <token>" anywhere (also inside sentences) — must run BEFORE the
  // Authorization-header rule, which would otherwise consume only the word
  // "Bearer" and leave the token itself exposed.
  [/bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'bearer [REDACTED]'],
  // "Authorization: Basic <credentials>" / "authorization=NTLM <blob>" —
  // scheme-prefixed values: the scheme word alone is not the secret, the
  // credentials token after it are. Without this rule the generic rule below
  // consumes only the scheme word and the credentials survive (the same trap
  // the bearer rule documents for in-sentence tokens).
  [/(authorization\s*[:=]\s*)(?:basic|bearer|digest|dpop|hoba|mutual|negotiate|ntlm|scram-sha-1|scram-sha-256|vapid)\s+[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]'],
  // Short standalone non-Basic/Bearer auth credentials remain protected even
  // when they are too short for the opaque-run fallback (focused amendment).
  [/\b(ntlm|digest|vapid|dpop)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]'],
  // "Authorization: <value>" / "authorization=<value>" → keep the key, drop the value.
  [/(authorization\s*[:=]\s*)([^\s,;"']+)/gi, '$1[REDACTED]'],
  // "token"/"secret"/"password"/"credential"/"api-key" assignments.
  [/((?:api[_-]?key|token|secret|password|credential)["']?\s*[:=]\s*)["']?[^\s,;"'}]+/gi, '$1[REDACTED]'],
  // Long opaque runs (JWTs / hex / base64 keys) even without a keyword.
  [/[A-Za-z0-9+/_-]{40,}={0,2}/g, '[REDACTED]'],
]

/**
 * Sanitize a downstream error message for the caller-visible `detail`.
 *
 * Two redaction layers run in a fixed order (additive hardening — neither
 * layer replaces or weakens the other):
 *
 *   1. the SPEC policy frozen by AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
 *      CTR-FMC-012 (exact ordered steps, exact replacement literals):
 *        a. `\b(Bearer|Basic)[ \t]+<credentials>` → scheme + ` <AUTH_REDACTED>`;
 *        b. `key: value` / `key="value"` where the lowercased key contains
 *           `authorization` | `token` | `secret` | `credential` → key kept,
 *           value → `<SENSITIVE_REDACTED>` (quotes dropped);
 *        c. opaque runs `[A-Za-z0-9._~+/-]{24,}={0,2}` → `<OPAQUE_REDACTED>`
 *           (the three spec replacement literals are exempt);
 *      then truncation to the first 500 Unicode CODE POINTS (code-point, not
 *      UTF-16 code-unit, counting — an astral character never splits).
 *   2. the pre-existing redaction set below (password / api-key forms, scheme-
 *      prefixed Authorization values, ≥40-char opaque runs, …) — kept verbatim
 *      and still effective after the spec layer.
 *
 * The composition is idempotent: every replacement literal is either exempt
 * from the opaque-run rules or rewrites to itself on a second pass.
 * Pure function.
 *
 * @param {string} text - the service-provided message string.
 * @returns {string} redacted + truncated text (≤ 500 code points).
 */
// Spec CTR-FMC-012 step 1: scheme-prefixed credentials (scheme spelling kept).
const SPEC_AUTH_SCHEME_RE = /\b(Bearer|Basic)[ \t]+[^ \t\r\n,;]+/gi
// Step 2: sensitive-keyed assignments. Group 1 = key prefix boundary, group 2 =
// the key, group 3 = separator, group 4 = quoted-or-bare value.
const SPEC_SENSITIVE_KEY_RE = /(^|[^A-Za-z0-9_.-])([A-Za-z_][A-Za-z0-9_.-]*)([ \t]*[:=][ \t]*)("(?:\\.|[^"\\])*"|[^ \t\r\n,;]+)/g
// Step 3: opaque runs (JWTs, hex, base64url keys) even without a keyword.
const SPEC_OPAQUE_RUN_RE = /[A-Za-z0-9._~+/-]{24,}={0,2}/g
const SPEC_REPLACEMENT_LITERALS = ['<AUTH_REDACTED>', '<SENSITIVE_REDACTED>', '<OPAQUE_REDACTED>']
// Private-use sentinels stand in for the spec literals while the opaque-run
// rule runs: none of the sentinel characters is in the run class, so the
// literals are provably exempt from their own redaction.
const SPEC_SENTINELS = ['\uE000', '\uE001', '\uE002']

function applySpecRedactions(out) {
  out = out.replace(SPEC_AUTH_SCHEME_RE, (_m, scheme) => `${scheme} <AUTH_REDACTED>`)
  out = out.replace(SPEC_SENSITIVE_KEY_RE, (m, before, key, sep, _value) => {
    const lower = key.toLowerCase()
    if (!(lower.includes('authorization') || lower.includes('token') || lower.includes('secret') || lower.includes('credential'))) {
      return m
    }
    return `${before}${key}${sep}<SENSITIVE_REDACTED>`
  })
  // Exempt the spec literals from the opaque-run rule via sentinels.
  for (const [i, literal] of SPEC_REPLACEMENT_LITERALS.entries()) {
    out = out.split(literal).join(SPEC_SENTINELS[i])
  }
  out = out.replace(SPEC_OPAQUE_RUN_RE, '<OPAQUE_REDACTED>')
  for (const [i, literal] of SPEC_REPLACEMENT_LITERALS.entries()) {
    out = out.split(SPEC_SENTINELS[i]).join(literal)
  }
  return out
}

/** Count Unicode code points (surrogate pairs count as one). */
function codePointLength(text) {
  let count = 0
  for (const _cp of text) count += 1
  return count
}

/** First `n` Unicode code points, never splitting a surrogate pair. */
function codePointSlice(text, n) {
  let out = ''
  let count = 0
  for (const cp of text) {
    if (count >= n) break
    out += cp
    count += 1
  }
  return out
}

export function sanitizeErrorDetail(text) {
  let out = String(text)
  out = applySpecRedactions(out)
  for (const [re, replacement] of DETAIL_REDACTIONS) out = out.replace(re, replacement)
  if (codePointLength(out) > DETAIL_MAX_LENGTH) out = codePointSlice(out, DETAIL_MAX_LENGTH)
  return out
}
