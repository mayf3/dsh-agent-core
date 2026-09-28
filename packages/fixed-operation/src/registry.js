import { canonicalDigest, canonicalJSON, sha256Hex } from './canonical.js'
import { FixedOperationError } from './errors.js'
import { requireWorkflowTrustedContext } from './trusted-context.js'
import { validateArgumentsDetailed } from '../../broker/src/mapping.js'

const OPERATION_KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/
const VERSION_RE = /^\d+\.\d+\.\d+$/

/**
 * One immutable fixed-operation definition. The definition hash binds the
 * entire model-visible contract surface (key + version + input schema) so a
 * model can pin exactly what it is calling and any definition drift is
 * detectable; handler code is bound by registration into the frozen
 * registry, not by the hash. The input schema MUST be closed
 * (additionalProperties: false) — an open schema would let a model smuggle
 * scriptPath/shell/arbitrary fields past validation.
 */
export function defineOperation({ key, version, description, inputSchema, handler }) {
  if (typeof key !== 'string' || !OPERATION_KEY_RE.test(key)) {
    throw new TypeError(`fixed-operation: operation key ${JSON.stringify(key)} must be a dotted lowercase key like "fixture.echo"`)
  }
  if (typeof version !== 'string' || !VERSION_RE.test(version)) {
    throw new TypeError(`fixed-operation: version ${JSON.stringify(version)} must be semver "MAJOR.MINOR.PATCH"`)
  }
  if (typeof description !== 'string' || description.trim() === '') {
    throw new TypeError('fixed-operation: description must be a non-blank string')
  }
  if (inputSchema === null || typeof inputSchema !== 'object' || Array.isArray(inputSchema)) {
    throw new TypeError('fixed-operation: inputSchema must be an object')
  }
  if (inputSchema.additionalProperties !== false) {
    throw new TypeError('fixed-operation: inputSchema.additionalProperties must be false (closed input surface)')
  }
  if (inputSchema.properties === undefined || inputSchema.properties === null
    || typeof inputSchema.properties !== 'object' || Array.isArray(inputSchema.properties)) {
    throw new TypeError('fixed-operation: inputSchema.properties must be an object')
  }
  if (inputSchema.required !== undefined) {
    if (!Array.isArray(inputSchema.required) || inputSchema.required.some((n) => typeof n !== 'string' || !Object.hasOwn(inputSchema.properties, n))) {
      throw new TypeError('fixed-operation: inputSchema.required must be an array of declared property names')
    }
  }
  if (typeof handler !== 'function') {
    throw new TypeError('fixed-operation: handler must be a function')
  }
  // The hash binds the NORMALIZED contract surface (the exact schema the
  // registry publishes), so equal contracts hash identically regardless of
  // authoring-style key order or omitted defaults.
  const normalizedSchema = Object.freeze({
    type: 'object',
    properties: Object.freeze({ ...inputSchema.properties }),
    ...(inputSchema.required !== undefined ? { required: Object.freeze([...inputSchema.required]) } : {}),
    additionalProperties: false,
  })
  return Object.freeze({
    key,
    version,
    description,
    inputSchema: normalizedSchema,
    handler,
    hash: canonicalDigest({ key, version, inputSchema: normalizedSchema }),
  })
}

function publicDescriptor(definition) {
  return Object.freeze({
    key: definition.key,
    version: definition.version,
    description: definition.description,
    hash: definition.hash,
    inputSchema: definition.inputSchema,
  })
}

/**
 * FIXED_OPERATION_V1 registry. Operations are registered once at
 * construction and never mutated; the registry object, every definition and
 * every descriptor is frozen. Execution fails closed in this exact order:
 * trusted context, unknown key, version pin, hash pin, argument schema —
 * a handler only ever runs after all five gates pass.
 */
export function createOperationRegistry(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new TypeError('fixed-operation: registry requires a non-empty array of operation definitions')
  }
  const byKey = new Map()
  for (const raw of definitions) {
    const definition = defineOperation(raw)
    if (byKey.has(definition.key)) {
      throw new TypeError(`fixed-operation: duplicate operation key "${definition.key}"`)
    }
    byKey.set(definition.key, definition)
  }

  /**
   * Raw execution: returns the success envelope or THROWS a coded
   * FixedOperationError. Call-site order is the fail-closed gate order.
   */
  function execute(call, trustedContext) {
    const workflow = requireWorkflowTrustedContext(trustedContext)

    const operation = call?.operation
    const definition = typeof operation === 'string' ? byKey.get(operation) : undefined
    if (definition === undefined) {
      throw new FixedOperationError('unknown_operation', `operationKey ${JSON.stringify(operation ?? null)} is not registered`)
    }
    if (call?.version !== definition.version) {
      throw new FixedOperationError('operation_version_mismatch', `operation "${definition.key}" is pinned to version ${definition.version}; declared ${JSON.stringify(call?.version ?? null)}`)
    }
    if (call?.hash !== definition.hash) {
      throw new FixedOperationError('operation_hash_mismatch', `operation "${definition.key}" is pinned to definition hash ${definition.hash}; declared ${JSON.stringify(call?.hash ?? null)}`)
    }
    const structural = validateArgumentsDetailed(definition.inputSchema, call?.args)
    if (structural.violations.length > 0) {
      throw new FixedOperationError('invalid_arguments', structural.violations.join('; '))
    }

    const args = call.args
    const inputDigest = canonicalDigest(args)
    const startedAt = new Date().toISOString()
    const result = definition.handler(args, Object.freeze({ operation: publicDescriptor(definition), workflow }))
    const finishedAt = new Date().toISOString()

    // Stable invocation id: a pure digest of the pinned definition, the
    // input digest and the trusted workflow coordinates — deterministic
    // across retries within one registry revision (attemptIdFor discipline:
    // no clock, no counter).
    const invocationId = `opinv-${sha256Hex(canonicalJSON({
      operation: definition.key,
      version: definition.version,
      hash: definition.hash,
      inputDigest,
      workflow,
    })).slice(0, 24)}`

    return {
      ok: true,
      result,
      receipt: Object.freeze({
        operation: Object.freeze({ key: definition.key, version: definition.version, hash: definition.hash }),
        invocationId,
        inputDigest,
        workflow,
        startedAt,
        finishedAt,
        status: 'succeeded',
      }),
    }
  }

  /**
   * Wire envelope: coded failures become { ok: false, error: { code, detail } }.
   * Only declared FIXED_OPERATION codes can ever appear (see errors.js);
   * unexpected handler exceptions propagate and must NOT be reported as one
   * of the five fail-closed classes.
   */
  function invoke(call, trustedContext) {
    try {
      return execute(call, trustedContext)
    } catch (error) {
      if (error instanceof FixedOperationError) {
        return { ok: false, error: { code: error.code, detail: error.message } }
      }
      throw error
    }
  }

  return Object.freeze({
    get: (key) => {
      const definition = byKey.get(key)
      return definition === undefined ? undefined : publicDescriptor(definition)
    },
    list: () => [...byKey.values()].map(publicDescriptor),
    /** The pinned catalog a model chooses from: key + version + hash + closed
     * argument schema. Handler code is never exposed. */
    describeForModel: () => ({
      selector: 'operation',
      operations: [...byKey.values()].map((d) => ({
        key: d.key,
        version: d.version,
        hash: d.hash,
        description: d.description,
        arguments: d.inputSchema,
      })),
    }),
    execute,
    invoke,
  })
}
