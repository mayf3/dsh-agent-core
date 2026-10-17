/**
 * @agent-core/production-runtime/src/workflow-fixed-operation-runtime.js —
 * the production wiring for FIXED_OPERATION_V1 (mount only; zero real
 * operations in V1).
 *
 * This file owns ONLY composition: it creates the immutable Operation
 * Registry, mounts the trusted LOCAL broker capability
 * (`workflow_fixed_ops.invoke`) through the same provider pattern as
 * selfOpsAccess, and hands the registry back so a future accepted authority
 * can register real operations in exactly one place. V1 deliberately
 * registers NOTHING: every invocation on this runtime fails closed with
 * `unknown_operation` until an operation is registered by composition —
 * the framework and its fail-closed behavior are the deliverable, not any
 * concrete production operation.
 *
 * Trust chain (all server-derived, never model input):
 *   workflow-execution engine -> frozen messageOrigin sidecar
 *   -> Router execution record (turn-execution.js)
 *   -> proven at the parent-RPC boundary (parent-rpc-relay.js)
 *   -> gateway trustedContext.workflowExecutionContext
 *   -> this access layer (fixed-operation/capability.js).
 */

import {
  createFixedOperationRegistry,
  createFixedOperationAccess,
} from '../../workflow-execution/src/fixed-operation/index.js'

export function mountWorkflowFixedOperationRuntime({ ctx, log = () => {} }) {
  const registry = createFixedOperationRegistry()
  ctx.provide('fixedOperationAccess', createFixedOperationAccess({ registry, log }))
  log.log('[fixed-operation] workflow_fixed_ops capability mounted (registry empty — fail closed until composition registers operations)')
  return { registry }
}
