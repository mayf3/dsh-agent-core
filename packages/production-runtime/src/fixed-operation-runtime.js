/**
 * Production wiring for FIXED_OPERATION_V1. The registry remains fixture-only;
 * trusted Workflow provenance is resolved by workflowExecutionContextAccess,
 * shared with other Workflow-scoped runtime capabilities.
 */

import { createOperationRegistry } from '../../fixed-operation/src/registry.js'
import { FIXED_OPERATION_DEFINITIONS, FIXED_OPERATION_WIRE_KEYS } from '../../broker/src/capabilities/fixed-operation.js'
import { mountWorkflowExecutionContextRuntime } from './workflow-execution-context-runtime.js'

export function mountFixedOperationRuntime({ ctx, log = { log: () => {} } }) {
  if (ctx === undefined || typeof ctx.provide !== 'function') {
    throw new TypeError('fixed-operation-runtime: ctx with provide() is required')
  }

  const workflowContext = (typeof ctx.get === 'function' ? ctx.get('workflowExecutionContextAccess') : undefined)
    ?? mountWorkflowExecutionContextRuntime({ ctx })
  if (workflowContext?.resolveWorkflowProvenance === undefined || workflowContext?.noteWorkflowTurn === undefined) {
    throw new TypeError('fixed-operation-runtime: workflowExecutionContextAccess service missing')
  }

  const registry = createOperationRegistry(FIXED_OPERATION_DEFINITIONS)
  const handlers = {
    fixed_operation: Object.fromEntries(Object.entries(FIXED_OPERATION_WIRE_KEYS).map(([wireName, operationKey]) => [
      wireName,
      async (args, trustedContext) => {
        const { version, hash, ...businessArgs } = args ?? {}
        const workflow = workflowContext.resolveWorkflowProvenance(trustedContext)
        return registry.invoke({ operation: operationKey, version, hash, args: businessArgs }, workflow)
      },
    ])),
  }

  // Compatibility aliases: callers/tests from FIXED_OPERATION_V1 may still
  // resolve these methods through fixedOperationAccess, but the authority now
  // lives on the generic workflowExecutionContextAccess service.
  const access = {
    handlers,
    registry,
    noteWorkflowTurn: workflowContext.noteWorkflowTurn,
    resolveWorkflowProvenance: workflowContext.resolveWorkflowProvenance,
  }
  ctx.provide('fixedOperationAccess', access)
  log.log('fixed-operation surface mounted (fixture operations only)')
  return access
}
