/**
 * Production wiring for the FIXED_OPERATION_V1 candidate slice: mounts the
 * fixed-operation registry over the deterministic fixture operations and
 * provides the LOCAL handler map consumed by the broker gateway
 * (`fixedOperationAccess`), exactly like selfOpsAccess /
 * developmentExecutionAccess.
 *
 * Provenance discipline: the ONLY path into the registry is a
 * `workflow_execution` provenance recorded by the RUNTIME (noteWorkflowTurn),
 * resolved from the gateway's trusted-context turnExecutionId — never from
 * model arguments. Ordinary turns, un-noted turns and forged provenance all
 * fail closed (missing_trusted_context) inside the registry.
 */

import { createOperationRegistry } from '../../fixed-operation/src/registry.js'
import { requireWorkflowTrustedContext } from '../../fixed-operation/src/trusted-context.js'
import { FIXED_OPERATION_DEFINITIONS, FIXED_OPERATION_WIRE_KEYS } from '../../broker/src/capabilities/fixed-operation.js'

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
   * ordinary sessions — the registry then fails closed. The Router forwards
   * turnExecutionId nested in ingressContext (legacy flat callers remain
   * supported; a nested/flat disagreement fails closed). */
  function resolveWorkflowProvenance(trustedContext) {
    const nested = trustedContext?.ingressContext?.turnExecutionId
    const legacy = trustedContext?.turnExecutionId
    if (nested !== undefined && legacy !== undefined && nested !== legacy) return undefined
    const turnExecutionId = nested ?? legacy
    return typeof turnExecutionId === 'string' ? notedTurns.get(turnExecutionId) : undefined
  }

  const handlers = {
    fixed_operation: Object.fromEntries(Object.entries(FIXED_OPERATION_WIRE_KEYS).map(([wireName, operationKey]) => [
      wireName,
      async (args, trustedContext) => {
        const { version, hash, ...businessArgs } = args ?? {}
        const workflow = resolveWorkflowProvenance(trustedContext)
        return registry.invoke({ operation: operationKey, version, hash, args: businessArgs }, workflow)
      },
    ])),
  }

  const access = { handlers, registry, noteWorkflowTurn, resolveWorkflowProvenance }
  ctx.provide('fixedOperationAccess', access)
  log.log('fixed-operation surface mounted (fixture operations only)')
  return access
}
