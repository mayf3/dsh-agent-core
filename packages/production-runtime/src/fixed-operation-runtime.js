/**
 * Production wiring for the FIXED_OPERATION_V1 candidate slice: mounts the
 * fixed-operation registry over the deterministic fixture operations and
 * provides the LOCAL handler map consumed by the broker gateway
 * (`fixedOperationAccess`), exactly like selfOpsAccess /
 * developmentExecutionAccess.
 *
 * Provenance discipline: the handler consumes ONLY the broker-injected
 * trusted context. A call may enter the registry exclusively with a trusted
 * `workflow_execution` provenance recorded by the RUNTIME (noteWorkflowTurn),
 * resolved from the trusted-context turnExecutionId — never from model
 * arguments. Ordinary sessions, un-noted turns and forged provenance all
 * fail closed (missing_trusted_context).
 */

import { createOperationRegistry } from '../../fixed-operation/src/registry.js'
import { requireWorkflowTrustedContext } from '../../fixed-operation/src/trusted-context.js'
import { FIXED_OPERATION_DEFINITIONS } from '../../broker/src/capabilities/fixed-operation.js'

/** Bounded note table: workflow dispatches are the writer; oldest entry is
 * evicted FIFO so the table can never grow unbounded. */
const MAX_NOTED_TURNS = 256

/**
 * @param {object} deps
 * @param {object} deps.ctx - cordis-like context ({ provide }) from the
 *   production composition.
 * @param {object} [deps.log] - { log } sink.
 */
export function mountFixedOperationRuntime({ ctx, log = { log: () => {} } }) {
  if (ctx === undefined || typeof ctx.provide !== 'function') {
    throw new TypeError('fixed-operation-runtime: ctx with provide() is required')
  }
  const registry = createOperationRegistry(FIXED_OPERATION_DEFINITIONS)
  const notedTurns = new Map()

  /**
   * Workflow-dispatch-side seam: record that `turnExecutionId` was admitted
   * with the trusted `workflow_execution` provenance (engine messageOrigin).
   * Anything but the exact provenance shape is rejected here already.
   */
  function noteWorkflowTurn({ turnExecutionId, provenance }) {
    if (typeof turnExecutionId !== 'string' || turnExecutionId === '') {
      return { ok: false, code: 'invalid_turn' }
    }
    let frozen
    try {
      frozen = requireWorkflowTrustedContext(provenance)
    } catch {
      return { ok: false, code: 'missing_trusted_context' }
    }
    if (notedTurns.size >= MAX_NOTED_TURNS) {
      notedTurns.delete(notedTurns.keys().next().value)
    }
    notedTurns.set(turnExecutionId, frozen)
    return { ok: true }
  }

  /** RUNTIME-owned resolution from the gateway trusted context; undefined for
   * ordinary sessions. The Router forwards turnExecutionId nested in
   * ingressContext (legacy flat callers remain supported; a nested/flat
   * disagreement fails closed). */
  function resolveWorkflowProvenance(trustedContext) {
    const nested = trustedContext?.ingressContext?.turnExecutionId
    const legacy = trustedContext?.turnExecutionId
    if (nested !== undefined && legacy !== undefined && nested !== legacy) return undefined
    const turnExecutionId = nested ?? legacy
    return typeof turnExecutionId === 'string' ? notedTurns.get(turnExecutionId) : undefined
  }

  const handlers = {
    fixed_operation: {
      execute: async (args, trustedContext) => {
        const { operation, version, hash, args: businessArgs } = args ?? {}
        // Provenance is RUNTIME-owned (noted for the calling turn); model
        // args are never consulted for it. Only a trusted workflow_execution
        // provenance may enter the registry — everything else fails closed.
        const workflow = resolveWorkflowProvenance(trustedContext)
        if (workflow === undefined || workflow.kind !== 'workflow_execution') {
          return { ok: false, error: { code: 'missing_trusted_context', detail: 'fixed_operation requires the trusted workflow_execution provenance injected by the runtime' } }
        }
        return registry.invoke({ operation, version, hash, args: businessArgs }, workflow)
      },
    },
  }

  const access = { handlers, registry, noteWorkflowTurn, resolveWorkflowProvenance }
  ctx.provide('fixedOperationAccess', access)
  log.log('fixed-operation surface mounted (fixture operations only)')
  return access
}
