/**
 * @agent-core/workflow-execution/src/fixed-operation — FIXED_OPERATION_V1
 * barrel: pre-registered, immutable Workflow operations a Run can invoke
 * with pinned versions/hashes, bound to the trusted workflow execution
 * context, answering with structured receipts.
 */

export {
  FIXED_OPERATION_CONTRACT_ID,
  OPERATION_KEY_RE,
  OPERATION_VERSION_RE,
  FORBIDDEN_INPUT_KEYS,
  canonicalJson,
  sha256Hex,
  operationHashOf,
  createFixedOperationRegistry,
} from './registry.js'
export { trustedCallerFrom, workflowContextFrom, UUID_RE, ATTEMPT_ID_RE } from './trusted-context.js'
export {
  FIXED_OPERATION_RECEIPT_VERSION,
  FIXED_OPERATION_ERROR_CODES,
  inputDigestOf,
  invocationIdOf,
  validateInputAgainstSchema,
  createFixedOperationInvoker,
} from './invoke.js'
export { FIXED_OPERATION_CAPABILITY_ID, createFixedOperationAccess } from './capability.js'
