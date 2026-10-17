/**
 * @agent-core/workflow-execution/src/fixed-operation/registry.js — the
 * FIXED_OPERATION_V1 Operation Registry.
 *
 * A registry entry is the WHOLE operation contract: operationKey + immutable
 * version + content hash + input schema + execute handler, frozen at
 * registration time. There is no unregister, no overwrite (a duplicate
 * key@version throws), and no mutation path — a Workflow/Agent can only ever
 * SELECT a registered operation and fill its declared input properties.
 * Nothing here accepts a scriptPath, shell command, or any executable text:
 * the only executable artifact is the `execute` handler closed over by the
 * composition that registered the operation (trusted runtime code, never
 * model input).
 *
 * `operationHash` pins the contract bytes (canonical JSON over
 * {contractId, operationKey, version, inputSchema}); invocations carry the
 * expected hash and fail closed on drift (invoke.js), which makes a plan
 * authored against one registration reject a silently re-registered one.
 *
 * Pure and synchronous: no I/O, no clock, no store — the single seam a
 * future reconcile/idempotency ledger needs (a stable identity for "this
 * exact operation contract") already exists as `operationHash`.
 */

import { createHash } from 'node:crypto'

/** The contract id stamped into every hash and receipt (drift marker). */
export const FIXED_OPERATION_CONTRACT_ID = 'FIXED_OPERATION_V1'

export const OPERATION_KEY_RE = /^[a-z][a-z0-9_.]{1,63}$/
export const OPERATION_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/**
 * Input property names a registered operation may NEVER declare: any of
 * these would let a caller smuggle execution or identity into the operation
 * input. Identity/coordinates travel only in the trusted context (never the
 * input), and no V1 input surface carries executable text.
 */
export const FORBIDDEN_INPUT_KEYS = new Set([
  'script', 'scriptPath', 'script_path', 'shell', 'command', 'cmd', 'exec',
  'executable', 'code', 'interpreter', 'eval', 'env', 'cwd', 'stdin',
  'workflowInstanceId', 'nodeVisitId', 'attemptId', 'agentId', 'callerAgentId',
  'workflow_execution_context', 'trustedContext', 'messageOrigin',
])

const INPUT_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array'])

/**
 * Deterministic JSON: object keys sorted recursively, arrays in order.
 * Throws on values canonical JSON cannot represent (functions, undefined,
 * symbols, NaN/Infinity) — a contract that cannot be serialized exactly
 * cannot be hashed, so it cannot be registered.
 */
export function canonicalJson(value) {
  if (value === null) return 'null'
  const type = typeof value
  if (type === 'string') return JSON.stringify(value)
  if (type === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('fixed-operation: canonicalJson rejects non-finite numbers')
    return JSON.stringify(value)
  }
  if (type === 'boolean') return value ? 'true' : 'false'
  if (type === 'object') {
    if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  throw new TypeError(`fixed-operation: canonicalJson rejects ${type} values`)
}

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** The immutable contract hash for one registration (the pin invocations check). */
export function operationHashOf({ operationKey, version, inputSchema }) {
  return sha256Hex(canonicalJson({ contractId: FIXED_OPERATION_CONTRACT_ID, operationKey, version, inputSchema }))
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`fixed-operation: ${label} must be a plain object`)
  }
}

/**
 * Validate an input schema at REGISTRATION time (fail loud in the trusted
 * composition, never at model-invocation time). V1 schema vocabulary is the
 * broker's exact-allowlist subset: {type, required, enum, maxLength, items}
 * per property; objects inside input are not supported in V1 (depth-1).
 */
function validateInputSchema(inputSchema) {
  assertPlainObject(inputSchema, 'inputSchema')
  if (inputSchema.type !== 'object') throw new TypeError('fixed-operation: inputSchema.type must be "object"')
  assertPlainObject(inputSchema.properties, 'inputSchema.properties')
  if (inputSchema.required !== undefined) {
    if (!Array.isArray(inputSchema.required)
      || inputSchema.required.some((name) => typeof name !== 'string')) {
      throw new TypeError('fixed-operation: inputSchema.required must be an array of property names')
    }
    for (const name of inputSchema.required) {
      if (!(name in inputSchema.properties)) {
        throw new TypeError(`fixed-operation: inputSchema.required names undeclared property "${name}"`)
      }
    }
  }
  for (const [name, spec] of Object.entries(inputSchema.properties)) {
    if (FORBIDDEN_INPUT_KEYS.has(name)) {
      throw new TypeError(`fixed-operation: input property "${name}" is forbidden (execution/identity travels only in the trusted context)`)
    }
    assertPlainObject(spec, `inputSchema.properties.${name}`)
    if (!INPUT_TYPES.has(spec.type)) {
      throw new TypeError(`fixed-operation: inputSchema.properties.${name}.type must be one of ${[...INPUT_TYPES].join('|')}`)
    }
    if (spec.enum !== undefined && (!Array.isArray(spec.enum) || spec.enum.length === 0)) {
      throw new TypeError(`fixed-operation: inputSchema.properties.${name}.enum must be a non-empty array`)
    }
    if (spec.maxLength !== undefined && (!Number.isInteger(spec.maxLength) || spec.maxLength < 1)) {
      throw new TypeError(`fixed-operation: inputSchema.properties.${name}.maxLength must be a positive integer`)
    }
    if (spec.type === 'array') {
      if (spec.items === undefined || !INPUT_TYPES.has(spec.items?.type)) {
        throw new TypeError(`fixed-operation: inputSchema.properties.${name}.items.type must be one of ${[...INPUT_TYPES].join('|')}`)
      }
    }
  }
}

/**
 * Create an empty registry. `register` is the ONLY writer; entries and the
 * index are frozen the moment they are created.
 *
 * @returns {{
 *   register(def: {operationKey:string, version:string, description?:string,
 *     inputSchema:object, execute:Function}): object,
 *   resolve(operationKey:string, version:string): object|undefined,
 *   describe(): Array<{operationKey:string, version:string, hash:string, description:string}>,
 * }}
 */
export function createFixedOperationRegistry() {
  const byKeyVersion = new Map() // `${operationKey}\u0000${version}` -> frozen entry

  function register({ operationKey, version, description = '', inputSchema, execute }) {
    if (typeof operationKey !== 'string' || !OPERATION_KEY_RE.test(operationKey)) {
      throw new TypeError(`fixed-operation: operationKey must match ${OPERATION_KEY_RE} (got ${JSON.stringify(operationKey)})`)
    }
    if (typeof version !== 'string' || !OPERATION_VERSION_RE.test(version)) {
      throw new TypeError(`fixed-operation: version must match ${OPERATION_VERSION_RE} (got ${JSON.stringify(version)})`)
    }
    if (typeof description !== 'string') throw new TypeError('fixed-operation: description must be a string')
    if (typeof execute !== 'function') throw new TypeError('fixed-operation: execute must be a function')
    validateInputSchema(inputSchema)
    const key = `${operationKey}\u0000${version}`
    if (byKeyVersion.has(key)) {
      // Immutability: a registration is a commitment. Same key@version means
      // the SAME contract bytes; any different registration must take a new
      // version (and a new hash).
      throw new TypeError(`fixed-operation: operation ${operationKey}@${version} is already registered (immutable; register a new version instead)`)
    }
    const entry = Object.freeze({
      contractId: FIXED_OPERATION_CONTRACT_ID,
      operationKey,
      version,
      description,
      hash: operationHashOf({ operationKey, version, inputSchema }),
      inputSchema: Object.freeze({
        type: 'object',
        required: Object.freeze([...(inputSchema.required ?? [])]),
        properties: Object.freeze(Object.fromEntries(
          Object.entries(inputSchema.properties).map(([name, spec]) => [name, Object.freeze({ ...spec })]),
        )),
      }),
      execute,
    })
    byKeyVersion.set(key, entry)
    return entry
  }

  function resolve(operationKey, version) {
    if (typeof operationKey !== 'string' || typeof version !== 'string') return undefined
    return byKeyVersion.get(`${operationKey}\u0000${version}`)
  }

  function describe() {
    return [...byKeyVersion.values()]
      .map(({ operationKey, version, hash, description }) => ({ operationKey, version, hash, description }))
      .sort((a, b) => (a.operationKey === b.operationKey ? a.version.localeCompare(b.version) : a.operationKey.localeCompare(b.operationKey)))
  }

  return { register, resolve, describe }
}
