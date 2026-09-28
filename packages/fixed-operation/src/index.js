/**
 * FIXED_OPERATION_V1 public surface — import from here; deeper modules are
 * implementation details. The package is a fixture-only vertical slice: the
 * registry, its fail-closed gates and the receipt contract are the product;
 * fixtures.js exists only to exercise them in tests.
 */
export { canonicalDigest, canonicalJSON, sha256Hex } from './canonical.js'
export { FIXED_OPERATION_ERRORS, FixedOperationError, isDeclaredFixedOperationCode } from './errors.js'
export { requireWorkflowTrustedContext } from './trusted-context.js'
export { createOperationRegistry, defineOperation } from './registry.js'
export { FIXTURE_TRUSTED_CONTEXT, fixtureEcho, fixtureSum, spyOnDefinition } from './fixtures.js'
