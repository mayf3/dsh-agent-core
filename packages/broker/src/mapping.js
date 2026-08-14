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
  const violations = []
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return ['arguments must be an object']
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
  return violations
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
  const violations = validateArguments(op.arguments, call.args)
  if (violations.length > 0) {
    return { ok: false, error: resolveCode(manifest, 'invalid_arguments', FALLBACK_ERRORS.invalid_arguments) }
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
  // Handler declared a direct error code.
  if (raw && typeof raw === 'object' && typeof raw.errorCode === 'string') {
    return { ok: false, error: resolveCode(manifest, raw.errorCode, FALLBACK_ERRORS.invalid_arguments) }
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
