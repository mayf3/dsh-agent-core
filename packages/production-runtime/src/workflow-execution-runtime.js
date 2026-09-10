/**
 * @agent-core/production-runtime/src/workflow-execution-runtime.js — the
 * production wiring for WORKFLOW_AGENT_EXECUTION_V2 (whole-authority successor of V1; mount + start/stop + the ONE control-plane recovery pass-through).
 *
 * This file owns ONLY the real-I/O seam injection; every semantic lives in
 * packages/workflow-execution (engine/ledger/judgment) and the reused seams:
 *
 *   due feed          broker gateway `workflow_dispatch_intents.list`
 *                     (the poller Principal holds the GLOBAL_SCHEDULER_READ
 *                     binding server-side; the gateway does token+HTTP —
 *                     no second HTTP client, no new scope handling). The
 *                     engine sweeps pages via the svc-workflow keyset
 *                     continuation (afterNextEligibleAt +
 *                     afterDispatchIntentId) until a short page.
 *   assignee mapping  `agentPrincipalResolutionAccess` (AGENT_CORE_EXACT_
 *                     PRINCIPAL_AGENT_RESOLUTION_V1 — auth-service authority
 *                     + local definition deliverability, invoked trusted and
 *                     in-process with the poller as the caller identity)
 *   Run admission     router.deliver({requestId, agentId, sessionMode:'main',
 *                     message}, {messageOrigin}) — the ONE admission seam,
 *                     with the trusted `workflow_execution` provenance
 *                     sidecar (WORKFLOW_AGENT_EXECUTION_V2 (inherited from V1) Router shape)
 *   run outcome       router.getTurnReconciliation / resolveCallerCorrelation
 *                     (the Router reconciliation store; never reply text)
 *   settle probe      broker gateway `workflow_instance_detail.read` AS THE
 *                     TARGET AGENT (visibility invariant: restricted view
 *                     mechanically proves our visit is no longer current)
 *
 * The mount is fail-closed by configuration: without a poller agent id the
 * ledger still loads (evidence stays readable) but the engine never polls,
 * and start() logs the honest disabled line — it never fakes liveness.
 */

import { ExecutionLedger, createWorkflowExecutionEngine } from '../../workflow-execution/src/index.js'

export const WORKFLOW_EXECUTION_POLLER_AGENT_ID_ENV = 'WORKFLOW_EXECUTION_POLLER_AGENT_ID'
const DUE_FEED_LIMIT = 100 // svc-workflow hard cap (1..100)

/**
 * @param {object} deps
 * @param {object} deps.ctx - cordis context (brokerGateway / agentPrincipal-
 *   ResolutionAccess services are read at mount time, after their rows).
 * @param {object} deps.layout - resolveProductionLayout() output.
 * @param {object} deps.router - the composed agent-router service.
 * @param {object} deps.log - { log, warn, error }.
 * @param {object} [deps.config] - { pollerAgentId?, maxAdmissionsPerPoll?,
 *   intervalMs? }; pollerAgentId falls back to WORKFLOW_EXECUTION_POLLER_AGENT_ID.
 */
export function mountWorkflowExecutionRuntime({ ctx, layout, router, log, config = {} }) {
  if (ctx === undefined || layout === undefined || router === undefined || log === undefined) {
    throw new TypeError('workflow-execution-runtime: ctx, layout, router and log are required')
  }
  const gateway = ctx.get('brokerGateway')
  const principalAccess = ctx.get('agentPrincipalResolutionAccess')
  if (gateway === undefined) throw new TypeError('workflow-execution-runtime: brokerGateway service missing — mount after applyBroker')
  if (principalAccess?.handlers?.agent_resolve_principal?.resolve === undefined) {
    throw new TypeError('workflow-execution-runtime: agentPrincipalResolutionAccess service missing — mount after its provide')
  }

  const ledger = new ExecutionLedger({ dir: layout.workflowExecutionDir, log })
  const pollerAgentId = config.pollerAgentId ?? process.env[WORKFLOW_EXECUTION_POLLER_AGENT_ID_ENV]
  const enabled = typeof pollerAgentId === 'string' && pollerAgentId !== ''

  const engine = createWorkflowExecutionEngine({
    ledger,
    log,
    ...(config.maxAdmissionsPerPoll === undefined ? {} : { config: { maxAdmissionsPerPoll: config.maxAdmissionsPerPoll } }),
    fetchDuePage: async ({ afterNextEligibleAt, afterDispatchIntentId } = {}) => {
      if (!enabled) return { ok: false, code: 'poller_unconfigured', detail: `set ${WORKFLOW_EXECUTION_POLLER_AGENT_ID_ENV} to enable the due-feed poller` }
      // Keyset continuation (CTR-WAE-001b): the engine only ever supplies
      // BOTH-or-NEITHER cursor params, and the strings are the EXACT
      // previously returned values (never reformatted).
      const args = { limit: DUE_FEED_LIMIT }
      if (afterNextEligibleAt !== undefined) args.afterNextEligibleAt = afterNextEligibleAt
      if (afterDispatchIntentId !== undefined) args.afterDispatchIntentId = afterDispatchIntentId
      const res = await gateway.execute(
        { capabilityId: 'workflow_dispatch_intents', operation: 'list', args },
        { agentId: pollerAgentId },
      )
      if (!res.ok) return { ok: false, code: res.error?.code ?? 'dispatch_intents_failed', detail: res.error?.detail }
      const items = Array.isArray(res.result?.items) ? res.result.items : []
      return { ok: true, items }
    },
    resolvePrincipalToAgent: async (principalId) => {
      const res = await principalAccess.handlers.agent_resolve_principal.resolve({ principalId }, { callerAgentId: pollerAgentId })
      if (!res.ok) return { ok: false, code: res.error?.code ?? 'resolve_failed', detail: res.error?.detail }
      return { ok: true, agentId: res.result.agentId }
    },
    deliverRun: async ({ requestId, agentId, message, messageOrigin }) => {
      try {
        const receipt = await router.deliver({ requestId, agentId, sessionMode: 'main', message }, { messageOrigin })
        return {
          ok: true,
          sessionId: receipt.sessionId,
          ...(receipt.reconciliationHandle === undefined ? {} : { reconciliationHandle: receipt.reconciliationHandle }),
        }
      } catch (error) {
        // Router outcome_unknown means prompt admission is unproven, not
        // proven absent. Its durable reconciliation handle is the only safe
        // way to observe the possibly-running Run; preserve that linkage and
        // let CTR-WAE-006 settle it. WAE always addresses canonical `main`,
        // so the session coordinate remains known even when the receipt was
        // lost. No replay is attempted.
        if ((error?.envelope === 'outcome_unknown' || error?.status === 'outcome_unknown')
          && typeof error?.reconciliationHandle === 'string' && error.reconciliationHandle !== '') {
          return { ok: true, sessionId: 'main', reconciliationHandle: error.reconciliationHandle }
        }
        return { ok: false, code: error?.code ?? 'delivery_failed', detail: String(error?.message ?? error).slice(0, 200) }
      }
    },
    getTurnReconciliation: (handle) => router.getTurnReconciliation(handle),
    ...(typeof router.resolveCallerCorrelation === 'function'
      ? { resolveCallerCorrelation: ({ requestId }) => router.resolveCallerCorrelation({ requestId }) }
      : {}),
    readInstanceDetail: async ({ agentId, workflowInstanceId }) => {
      const res = await gateway.execute(
        { capabilityId: 'workflow_instance_detail', operation: 'read', args: { workflowInstanceId } },
        { agentId },
      )
      if (!res.ok) return { ok: false, code: res.error?.code ?? 'instance_detail_failed', detail: res.error?.detail }
      return { ok: true, body: res.result }
    },
  })

  return {
    engine,
    ledger,
    pollerAgentId,
    enabled,
    /**
     * THE ONE controlled recovery operation (V2 CTR-WAE-013), surfaced as a
     * runtime-component method ONLY: the control plane (Owner/operator seam)
     * may call it with an explicit authorityRef. It is deliberately NOT a
     * broker capability/tool manifest, NOT reachable from any Agent tool
     * surface, and NOT invoked by the poller, reconcile, or any timer —
     * there is no scheduling semantics around it at all.
     */
    recoverAttempt: (args) => engine.recoverAttempt(args),
    /** Start the poll loop (no-op, honestly logged, when unconfigured). */
    start({ intervalMs } = {}) {
      if (!enabled) {
        log.warn(`workflow-execution: poller disabled — no ${WORKFLOW_EXECUTION_POLLER_AGENT_ID_ENV} configured (ledger at ${layout.workflowExecutionDir} stays evidence-only)`)
        return
      }
      engine.start({ ...(intervalMs === undefined ? {} : { intervalMs }) })
      log.log(`workflow-execution: poller enabled (agent ${pollerAgentId}, due feed limit ${DUE_FEED_LIMIT})`)
    },
    stop() {
      engine.stop()
    },
  }
}
