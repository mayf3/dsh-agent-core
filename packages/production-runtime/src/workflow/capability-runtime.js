import { mountWorkflowExecutionRuntime } from '../workflow-execution-runtime.js'
import { mountWorkflowExecutionContextRuntime } from '../workflow-execution-context-runtime.js'
import { mountWorkflowProgressRuntime } from '../workflow-progress-runtime.js'
// Latest-main integration: BOTH wirings coexist —
//   WORKFLOW_EXECUTION_CONTROL_V1 (projectExecutionTrace → workflowExecutionAccess)
//   DEVELOPMENT_EXECUTION_SURFACE_V1 (mountDevelopmentExecutionRuntime)
import { mountDevelopmentExecutionRuntime } from '../development-execution-runtime.js'
import { mountFixedOperationRuntime } from '../fixed-operation-runtime.js'
import { projectExecutionTrace } from '../../../workflow-execution/src/projection.js'
import { projectExecutionAttention } from '../../../workflow-execution/src/attention.js'

/** Mount the existing execution capabilities and their Workflow projections. */
export function mountWorkflowCapabilityRuntime({ ctx, layout, router, log, opts }) {
  // AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1: shared local coding-executor
  // capability. Additive and agent-agnostic; refuses honestly (config_missing)
  // until the Operator provisions dev-execution/{repos.json,backend.json}.
  mountDevelopmentExecutionRuntime({ ctx, layout, log })

  // Runtime-owned turn -> workflow_execution provenance mapping shared by
  // every Workflow-scoped LOCAL capability. It is execution context only,
  // never workflow business state.
  mountWorkflowExecutionContextRuntime({ ctx })

  // FIXED_OPERATION_V1: fixture-only fixed-operation LOCAL surface.
  mountFixedOperationRuntime({ ctx, log })

  const workflowExecution = mountWorkflowExecutionRuntime({
    ctx,
    layout,
    router,
    log,
    ...(opts.workflowExecution === undefined ? {} : { config: opts.workflowExecution }),
  })

  // WORKFLOW_EXECUTION_CONTROL_V1 (CTR-WEC1-003/006): the product-api
  // /workflow-execution/* routes resolve this service at request time (the
  // same late-binding discipline as schedulerHistory/schedulerTokenVerifier).
  // traces = cross-process-fresh read model; kick = one coalesced poll
  // trigger (latency only; the poll loop stays the correctness path).
  mountWorkflowProgressRuntime({ ctx, ledger: workflowExecution.ledger, log })

  ctx.provide('workflowExecutionAccess', {
    traces: async ({ workflowInstanceId, nodeVisitId } = {}) => {
      const attempts = await workflowExecution.ledger.snapshotFresh()
      return projectExecutionTrace(attempts, { workflowInstanceId, nodeVisitId })
    },
    // Fleet-level attention summary: the same cross-process-fresh snapshot,
    // selected down to the attention-worthy executionStates. Read-only.
    attention: async () => {
      const attempts = await workflowExecution.ledger.snapshotFresh()
      return projectExecutionAttention(attempts)
    },
    kick: (payload) => {
      if (!workflowExecution.enabled) return { ok: false, code: 'poller_unconfigured' }
      void payload // the kick carries no semantics; the poll re-reads svc truth
      return workflowExecution.engine.kick()
    },
    ownerAssistanceWake: (payload) => workflowExecution.wakeOwnerAssistance(payload),
  })

  return workflowExecution
}
