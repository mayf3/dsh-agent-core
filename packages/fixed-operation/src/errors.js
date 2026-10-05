/**
 * Fail-closed error taxonomy. These are the ONLY codes the registry may put
 * on the wire (broker resolveCode discipline: an undeclared code never
 * reaches the model). Any future code must be added here first.
 */
export const FIXED_OPERATION_ERRORS = Object.freeze([
  { code: 'unknown_operation', description: 'operationKey is not registered' },
  { code: 'operation_version_mismatch', description: 'declared version missing or not the registered immutable version' },
  { code: 'operation_hash_mismatch', description: 'declared definition hash missing or not the registered immutable hash' },
  { code: 'invalid_arguments', description: 'arguments violate the operation input schema' },
  { code: 'missing_trusted_context', description: 'trusted workflow execution context absent or malformed' },
])

const DECLARED_CODES = new Set(FIXED_OPERATION_ERRORS.map((e) => e.code))

export function isDeclaredFixedOperationCode(code) {
  return DECLARED_CODES.has(code)
}

export class FixedOperationError extends Error {
  constructor(code, message) {
    if (!isDeclaredFixedOperationCode(code)) {
      // Fail loud at authoring time: an undeclared code must never exist.
      throw new TypeError(`fixed-operation: "${code}" is not a declared FIXED_OPERATION error code`)
    }
    super(message)
    this.name = 'FixedOperationError'
    this.code = code
  }
}
