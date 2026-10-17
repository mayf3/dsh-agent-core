/**
 * @agent-core/workflow-execution/src/fixed-operation/capability.js — the
 * trusted LOCAL Broker capability face of FIXED_OPERATION_V1.
 *
 * Same composition pattern as selfOpsAccess / agentDefinitionAccess: a
 * factory returning `{ handlers: { <capabilityId>: { <operation> } } }`
 * whose handlers receive (args, trustedContext) from the broker gateway.
 * The gateway decides `agentId` from the actual spawning relationship and
 * forwards the Router-proven `workflowExecutionContext` beside it — the
 * model's argument bag carries ONLY the operation selection and its
 * declared input, and this layer never reads coordinates from args because
 * the wire schema has no such fields.
 *
 * Envelope contract (relay strict shape): `{ok:true, result}` where result
 * is the operation receipt, or `{ok:false, error:{code, detail}}` for the
 * fail-closed denials. A handler that RAN and failed still answers
 * `{ok:true, result:<receipt status:'failed'>}` — the execution happened,
 * and the receipt (not an error envelope) attests its outcome.
 */

import { createFixedOperationInvoker, FIXED_OPERATION_ERROR_CODES } from './invoke.js'

export const FIXED_OPERATION_CAPABILITY_ID = 'workflow_fixed_ops'

/**
 * @param {object} opts
 * @param {object} opts.registry - createFixedOperationRegistry() instance.
 * @param {() => number} [opts.clock] - injected clock (deterministic tests).
 * @param {(msg: string) => void} [opts.log]
 */
export function createFixedOperationAccess({ registry, clock, log = () => {} }) {
  const invokeFixedOperation = createFixedOperationInvoker({ registry, ...(clock === undefined ? {} : { clock }) })
  return {
    handlers: {
      [FIXED_OPERATION_CAPABILITY_ID]: {
        async invoke(args, trustedContext) {
          try {
            const outcome = await invokeFixedOperation({ trustedContext, request: args })
            if (outcome.ok) return { ok: true, result: outcome.receipt }
            return { ok: false, error: outcome.error }
          } catch (error) {
            // The pipeline is total by construction; this backstop keeps a
            // defect from crashing the parent RPC (gateway rethrows into
            // internal_error for non-scheduler locals — we prefer the
            // declared code).
            log(`[fixed-operation] invoker defect: ${error?.message ?? error}`)
            return { ok: false, error: { code: FIXED_OPERATION_ERROR_CODES.INTERNAL_ERROR, detail: 'fixed operation invoker failed before execution' } }
          }
        },
      },
    },
  }
}
