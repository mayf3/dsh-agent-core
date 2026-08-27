/**
 * @agent-core/broker — Request / response / error mapping (V1).
 *
 * Pure mapping layer between a model tool call and a capability handler,
 * preserving V0's accepted fixture semantics 1:1:
 *
 *   arguments: { operation: add|subtract|multiply|divide, a: number, b: number }
 *   success:   { ok: true, result: <number> }
 *   failure:   { ok: false, error: { code: invalid_arguments|unsupported_operation|divide_by_zero } }
 *
 * Transport-produced failures additionally carry the preserved downstream
 * diagnostics on the error object (all optional): `status` (upstream HTTP
 * status), `detail` (SANITIZED upstream message / broker violation message)
 * and `requestId` (the downstream `x-request-id`, verbatim, never fabricated)
 * — see transport.js "Downstream error preservation".
 *
 * A capability handler is a plain function `(operation, args, principal) =>
 * (something)`. The converter turns the handler's return value into the wire
 * envelope, validating error codes against the manifest's error table. All
 * functions here are pure and directly unit-testable without DSH context.
 *
 * Identity discipline: the ONLY principal source handed to a handler is the
 * `principal` produced by an injected `resolvePrincipal` callback. Model-side
 * arguments never carry a principal field — the mapping layer does not read,
 * forward, or even accept one from `args`.
 */

import { validateManifest } from './schema.js'

/** Client-supplied error codes the mapping emits for structural failures. */
const FALLBACK_ERRORS = {
  unsupported_operation: 'unsupported_operation',
  invalid_arguments: 'invalid_arguments',
}

/**
 * Validate one operation's `arguments` against its `{ properties, required }`
 * schema (a minimal JSON-Schema subset). Returns a list of violation strings.
 * @param {object} argumentSchema - { properties, required }.
 * @param {unknown} args - candidate arguments, however malformed.
 * @returns {string[]} human-readable violations; empty means valid.
 */
export function validateArguments(argumentSchema, args) {
  return validateArgumentsDetailed(argumentSchema, args).violations
}

/**
 * Detailed variant of validateArguments: besides the human-readable violation
 * strings, surfaces the DECLARED error code a violation should report (e.g.
 * `invalid_pagination` for an out-of-range `limit`), when the violated
 * property schema carries `validationError`. Bounds checking (`minimum` /
 * `maximum`) runs Broker-side BEFORE any HTTP request is issued, so an
 * out-of-range page size fails fast locally instead of surfacing as a
 * generic downstream 4xx/422.
 * @param {object} argumentSchema - { properties, required }.
 * @param {unknown} args - candidate arguments, however malformed.
 * @returns {{ violations: string[], code?: string }}
 */
export function validateArgumentsDetailed(argumentSchema, args) {
  const violations = []
  let code
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return { violations: ['arguments must be an object'] }
  }
  const props = argumentSchema.properties || {}
  const required = argumentSchema.required || []
  for (const name of required) {
    if (!Object.hasOwn(args, name) || args[name] === undefined) {
      violations.push(`missing required property "${name}"`)
    }
  }
  for (const [name, val] of Object.entries(args)) {
    const spec = props[name]
    if (spec === undefined) {
      // Unknown keys are tolerated structurally but never treated as identity;
      // a caller-provided principalId is intentionally ignored here.
      continue
    }
    if (spec.type === 'number' || spec.type === 'integer') {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        violations.push(`property "${name}" must be a finite number`)
      } else if (spec.type === 'integer' && !Number.isInteger(val)) {
        violations.push(`property "${name}" must be an integer`)
      } else {
        if (typeof spec.minimum === 'number' && val < spec.minimum) {
          violations.push(`property "${name}" must be >= ${spec.minimum}`)
          if (code === undefined && typeof spec.validationError === 'string') code = spec.validationError
        }
        if (typeof spec.maximum === 'number' && val > spec.maximum) {
          violations.push(`property "${name}" must be <= ${spec.maximum}`)
          if (code === undefined && typeof spec.validationError === 'string') code = spec.validationError
        }
      }
    } else if (spec.type === 'string') {
      if (typeof val !== 'string') violations.push(`property "${name}" must be a string`)
    } else if (spec.type === 'boolean') {
      if (typeof val !== 'boolean') violations.push(`property "${name}" must be a boolean`)
    }
    if (spec.enum !== undefined && !spec.enum.includes(val)) {
      violations.push(`property "${name}" must be one of ${JSON.stringify(spec.enum)}`)
    }
  }
  return code === undefined ? { violations } : { violations, code }
}

/**
 * Resolve a produced error code against the manifest's error table.
 * Fails closed: an unknown / undeclared code is downgraded to the capability's
 * `invalid_arguments`. Returns the canonical wire error object.
 * @param {object} manifest - validated manifest.
 * @param {string} code - code the handler or mapping produced.
 * @param {string} fallback - preferred fallback when the manifest has it.
 * @returns {{ code: string }}
 */
export function resolveCode(manifest, code, fallback) {
  const table = new Set((manifest.errors || []).map((e) => e.code))
  if (table.has(code)) return { code }
  /* Fails closed: never surface an undeclared code. */
  if (table.has(fallback)) return { code: fallback }
  if (table.has(FALLBACK_ERRORS.invalid_arguments)) return { code: FALLBACK_ERRORS.invalid_arguments }
  return { code: 'invalid_arguments' }
}

/**
 * Convert one capability invocation to the wire envelope.
 *
 * @param {object} manifest - validated capability manifest.
 * @param {object} handlers - capability id -> { operationName: pure function } map.
 * @param {object} call - `{ operation, args }` where `args` holds the model args.
 * @param {object} deps
 * @param {() => unknown} deps.resolvePrincipal - the single identity source.
 * @returns {Promise<{ ok: true, result: unknown } | { ok: false, error: { code: string } }>}
 */
export async function invoke(manifest, handlers, call, deps) {
  const operation = call.operation
  const op = manifest.operations.find((o) => o.name === operation)
  const handler = handlers && handlers[operation]

  // Unsupported / unknown operation.
  if (op === undefined || handler === undefined) {
    return { ok: false, error: resolveCode(manifest, 'unsupported_operation', FALLBACK_ERRORS.unsupported_operation) }
  }

  // Argument validation against this operation's OWN schema.
  const { violations, code: violationCode } = validateArgumentsDetailed(op.arguments, call.args)
  if (violations.length > 0) {
    // A violation category may declare its own wire code (e.g. an
    // out-of-range page size reports `invalid_pagination`); resolved through
    // the manifest's table, failing closed to invalid_arguments. A coded
    // violation additionally carries the broker-generated violation message
    // as detail (our own text — no upstream content, nothing to sanitize).
    const resolved = resolveCode(manifest, violationCode ?? FALLBACK_ERRORS.invalid_arguments, FALLBACK_ERRORS.invalid_arguments)
    const error = violationCode !== undefined ? { ...resolved, detail: violations.join('; ') } : resolved
    return { ok: false, error }
  }

  // Identity: obtained ONLY from the injected resolver; there is no
  // principal field in `call.args` and nothing here reads one.
  const principal = deps.resolvePrincipal ? deps.resolvePrincipal() : undefined

  let raw
  try {
    raw = await handler(operation, call.args, principal)
  } catch (err) {
    // A thrown handler implies an internal failure; downgrade to a declared code.
    return { ok: false, error: resolveCode(manifest, 'invalid_arguments', FALLBACK_ERRORS.invalid_arguments) }
  }

  // Normalize the handler return value.
  if (raw && typeof raw === 'object' && raw.ok === false && raw.error && typeof raw.error.code === 'string') {
    return { ok: false, error: resolveCode(manifest, raw.error.code, FALLBACK_ERRORS.invalid_arguments) }
  }
  // Handler declared a direct error code. Transport-produced codes may carry
  // optional `status` (upstream HTTP status), `detail` (SANITIZED upstream
  // message) and `requestId` (the downstream `x-request-id`, when present)
  // which are passed through on the wire envelope for the model's benefit.
  // Downstream error preservation: when the transport extracted a downstream
  // service code, it is offered as `errorCode` and resolved against the
  // manifest's DECLARED table; when the service code is not declared the
  // status-aware canonical fallback (`http_4xx` / `http_5xx`, always declared
  // for HTTP capabilities via withTransportErrors) wins — an undeclared code
  // never reaches the wire, and a downstream 404 never degrades to
  // `invalid_arguments`.
  if (raw && typeof raw === 'object' && typeof raw.errorCode === 'string') {
    const statusFallback = typeof raw.status === 'number' ? (raw.status < 500 ? 'http_4xx' : 'http_5xx') : FALLBACK_ERRORS.invalid_arguments
    const code = resolveCode(manifest, raw.errorCode, statusFallback)
    const error = { code: code.code }
    if (typeof raw.status === 'number') error.status = raw.status
    if (typeof raw.detail === 'string') error.detail = raw.detail
    if (typeof raw.requestId === 'string' && raw.requestId.length > 0) error.requestId = raw.requestId
    return { ok: false, error }
  }
  return { ok: true, result: raw }
}

/**
 * Validate a candidate manifest and return the canonical form, throwing on
 * invalid input (convenience for registration time).
 * @param {unknown} input - raw manifest data.
 * @returns {object} validated canonical manifest.
 */
export function assertValidManifest(input) {
  const res = validateManifest(input)
  if (!res.ok) {
    throw new Error(`invalid capability manifest: ${res.errors.join('; ')}`)
  }
  return res.manifest
}
