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
 *   stale re-entry    WORKFLOW_STALE_REENTRY_V1: the SAME settle-probe read
 *                     is the stale evidence source (visit current + version
 *                     unchanged). Redispatch is READ-ONLY gated on the
 *                     superseded execution's reconciliation state — it defers
 *                     while the record is still an active unknown (fence
 *                     untouched) and proceeds only on exact-termination
 *                     convergence. Threshold:
 *                     DSH_WORKFLOW_STALE_NO_PROGRESS_MS (default 1h).
 *
 * The mount is fail-closed by configuration: without a poller agent id the
 * ledger still loads (evidence stays readable) but the engine never polls,
 * and start() logs the honest disabled line — it never fakes liveness.
 */

import { ExecutionLedger, createWorkflowExecutionEngine, createForumProjection, DEFAULT_MAX_ATTEMPTS_PER_VISIT } from '../../workflow-execution/src/index.js'

export const WORKFLOW_EXECUTION_POLLER_AGENT_ID_ENV = 'WORKFLOW_EXECUTION_POLLER_AGENT_ID'
export const WORKFLOW_STALE_NO_PROGRESS_MS_ENV = 'DSH_WORKFLOW_STALE_NO_PROGRESS_MS'
export const WORKFLOW_MAX_ATTEMPTS_PER_VISIT_ENV = 'DSH_WORKFLOW_MAX_ATTEMPTS_PER_VISIT'
export const WORKFLOW_RETRY_DELAY_MS_ENV = 'DSH_WORKFLOW_RETRY_DELAY_MS'
const DUE_FEED_LIMIT = 100 // svc-workflow hard cap (1..100)

/** Positive-integer env resolution; undefined/'' → fallback, garbage → fail loud. */
function resolvePositiveInt({ configValue, envValue, fallback, name }) {
  const raw = configValue ?? envValue
  if (raw === undefined || raw === '') return fallback
  const parsed = typeof raw === 'number' ? raw : (/^\d+$/.test(String(raw).trim()) ? Number.parseInt(String(raw), 10) : NaN)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new TypeError(`workflow-execution-runtime: ${name} must be a positive integer (got ${JSON.stringify(raw)})`)
  }
  return parsed
}

/**
 * WORKFLOW_STALE_REENTRY_V1 CTR-SRE-002 threshold wiring: explicit config
 * wins, then the env, then the 1h default. Fail-loud on a non-positive-
 * integer (a silently-degraded threshold would be an invisible policy
 * change). Callers SHOULD keep it above the router's turn deadline so the
 * unknown marking always precedes any stale evaluation.
 */
export function resolveStaleNoProgressThresholdMs({ configValue, envValue } = {}) {
  const raw = configValue ?? envValue
  if (raw === undefined || raw === '') return 3_600_000
  const parsed = typeof raw === 'number' ? raw : (/^\d+$/.test(String(raw).trim()) ? Number.parseInt(String(raw), 10) : NaN)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new TypeError(`workflow-execution-runtime: stale threshold must be a positive integer (got ${JSON.stringify(raw)})`)
  }
  return parsed
}

/**
 * @param {object} deps
 * @param {object} deps.ctx - cordis context (brokerGateway / agentPrincipal-
 *   ResolutionAccess services are read at mount time, after their rows).
 * @param {object} deps.layout - resolveProductionLayout() output.
 * @param {object} deps.router - the composed agent-router service.
 * @param {object} deps.log - { log, warn, error }.
 * @param {object} [deps.config] - { pollerAgentId?, maxAdmissionsPerPoll?,
 *   intervalMs?, staleNoProgressThresholdMs? }; pollerAgentId falls back to
 *   WORKFLOW_EXECUTION_POLLER_AGENT_ID, the stale threshold to
 *   DSH_WORKFLOW_STALE_NO_PROGRESS_MS, then 1h.
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

  const ledger = new ExecutionLedger({
    dir: layout.workflowExecutionDir,
    log,
    // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-004: the attempt limit lives on
    // the fence itself (admission policy; replay of old files unchanged).
    maxAttemptsPerVisit: resolvePositiveInt({
      configValue: config.maxAttemptsPerVisit,
      envValue: process.env[WORKFLOW_MAX_ATTEMPTS_PER_VISIT_ENV],
      fallback: DEFAULT_MAX_ATTEMPTS_PER_VISIT,
      name: 'maxAttemptsPerVisit',
    }),
  })
  const pollerAgentId = config.pollerAgentId ?? process.env[WORKFLOW_EXECUTION_POLLER_AGENT_ID_ENV]
  const enabled = typeof pollerAgentId === 'string' && pollerAgentId !== ''
  const staleNoProgressThresholdMs = resolveStaleNoProgressThresholdMs({
    configValue: config.staleNoProgressThresholdMs,
    envValue: process.env[WORKFLOW_STALE_NO_PROGRESS_MS_ENV],
  })
  const retryDelayMs = resolvePositiveInt({
    configValue: config.retryDelayMs,
    envValue: process.env[WORKFLOW_RETRY_DELAY_MS_ENV],
    fallback: undefined,
    name: 'retryDelayMs',
  })

  const engine = createWorkflowExecutionEngine({
    ledger,
    log,
    config: {
      ...(config.maxAdmissionsPerPoll === undefined ? {} : { maxAdmissionsPerPoll: config.maxAdmissionsPerPoll }),
      staleNoProgressThresholdMs,
      ...(retryDelayMs === undefined ? {} : { retryDelayMs }),
    },
    // WORKFLOW_STALE_REENTRY_V1 r2: no router seam is injected — the r1
    // resolveStaleTurn pass-through was removed per independent review. The
    // engine's quiescence gate reads the EXISTING router seams
    // (getTurnReconciliation / resolveCallerCorrelation) and defers the
    // generation N+1 delivery until the superseded execution is provably
    // no longer an active unknown; fence lifecycle stays untouched.
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
          // CTR-SCT-006: pass the receipt's native messageId through to the
          // ledger's existing run_delivered field (the receipt carries it;
          // dropping it here was the production seam gap). The outcome_unknown
          // branch below still records NO messageId — an unproven receipt is
          // never fabricated.
          ...(receipt.messageId === undefined ? {} : { messageId: receipt.messageId }),
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
    // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-005: the ONE escalation seam —
    // svc-workflow's system execution-escalation ingress, called as the
    // poller principal (GLOBAL_SCHEDULER_READ bound server-side).
    escalateAttemptLimit: async (payload) => {
      if (!enabled) return { ok: false, code: 'poller_unconfigured' }
      const res = await gateway.execute(
        {
          capabilityId: 'workflow_execution_escalation',
          operation: 'create',
          args: {
            workflowInstanceId: payload.workflowInstanceId,
            nodeVisitId: payload.nodeVisitId,
            reason: payload.reason,
            attemptCount: payload.attemptCount,
            lastAttemptId: payload.lastAttemptId,
            dispatchIntentId: payload.dispatchIntentId,
          },
        },
        { agentId: pollerAgentId },
      )
      if (!res.ok) return { ok: false, code: res.error?.code ?? 'escalation_failed', detail: res.error?.detail }
      return { ok: true, escalated: res.result?.escalated, assistanceCaseId: res.result?.assistanceCaseId }
    },
  })

  // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-007: the forum execution-event
  // projection. It NEVER creates threads (svc owns the canonical binding)
  // and never touches execution decisions; disabled-honest when no poller
  // principal is configured (the gateway needs a caller identity).
  const forumProjection = createForumProjection({
    dir: layout.workflowExecutionDir,
    log,
    resolveThread: async ({ workflowInstanceId }) => {
      if (!enabled) return { ok: false, code: 'poller_unconfigured' }
      const res = await gateway.execute(
        {
          // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-007: the canonical-thread
          // resolution rides the EXISTING forum_list_threads capability whose
          // list operation this Spec widened with contextType/contextId.
          capabilityId: 'forum_list_threads',
          operation: 'list',
          args: { contextType: 'workflow_instance', contextId: workflowInstanceId, limit: 1 },
        },
        { agentId: pollerAgentId },
      )
      if (!res.ok) return { ok: false, code: res.error?.code ?? 'forum_threads_failed' }
      const items = Array.isArray(res.result?.items) ? res.result.items : []
      const thread = items.find((t) => t?.contextType === 'workflow_instance' && t?.contextId === workflowInstanceId)
      return { ok: true, threadId: typeof thread?.id === 'string' ? thread.id : null }
    },
    loadPostedKeys: async ({ threadId }) => {
      if (!enabled) return { ok: false, code: 'poller_unconfigured' }
      const res = await gateway.execute(
        {
          capabilityId: 'forum_read_transcript',
          operation: 'read',
          args: { threadId, format: 'json' },
        },
        { agentId: pollerAgentId },
      )
      if (!res.ok) return { ok: false, code: res.error?.code ?? 'forum_transcript_failed' }
      const transcript = res.result
      if (transcript?.thread?.id !== threadId || !Array.isArray(transcript.messages)) {
        return { ok: false, code: 'forum_transcript_shape' }
      }
      return {
        ok: true,
        keys: transcript.messages
          .map((message) => message?.metadata?.eventKey)
          .filter((key) => typeof key === 'string'),
      }
    },
    postMessage: async ({ threadId, content, kind, metadata }) => {
      if (!enabled) return { ok: false, code: 'poller_unconfigured' }
      const res = await gateway.execute(
        {
          // CTR-WEC1-007: messages are ordinary reviewer-safe comments via
          // the EXISTING forum_reply capability (kind=comment + metadata).
          capabilityId: 'forum_reply',
          operation: 'reply',
          args: { threadId, content, kind, metadata },
        },
        { agentId: pollerAgentId },
      )
      return res.ok ? { ok: true } : { ok: false, code: res.error?.code ?? 'forum_reply_failed' }
    },
  })

  return {
    engine,
    ledger,
    pollerAgentId,
    enabled,
    staleNoProgressThresholdMs,
    forumProjection,
    /**
     * THE ONE controlled recovery operation (V2 CTR-WAE-013), surfaced as a
     * runtime-component method ONLY: the control plane (Owner/operator seam)
     * may call it with an explicit authorityRef. It is deliberately NOT a
     * broker capability/tool manifest, NOT reachable from any Agent tool
     * surface, and NOT invoked by the poller, reconcile, or any timer —
     * there is no scheduling semantics around it at all.
     */
    recoverAttempt: (args) => engine.recoverAttempt(args),
    /** Start the poll loop (+ forum projection); no-op, honestly logged, when unconfigured. */
    start({ intervalMs } = {}) {
      if (!enabled) {
        log.warn(`workflow-execution: poller disabled — no ${WORKFLOW_EXECUTION_POLLER_AGENT_ID_ENV} configured (ledger at ${layout.workflowExecutionDir} stays evidence-only)`)
        return
      }
      engine.start({ ...(intervalMs === undefined ? {} : { intervalMs }) })
      forumProjection.start()
      log.log(`workflow-execution: poller enabled (agent ${pollerAgentId}, due feed limit ${DUE_FEED_LIMIT})`)
    },
    stop() {
      // DSH_SHUTDOWN_CONTRACT (Phase A): the engine's stop() returns the
      // bounded drain promise; compose.stop() awaits THIS method before
      // scheduler.stop() and ctx.disposeAll(), so the drain semantics must
      // propagate — dropping the promise made the await resolve while a poll
      // was still in flight (late delivery into a disposed Router became
      // reachable). WORKFLOW_EXECUTION_CONTROL_V1 (main): the forum
      // projection loop stops with it (synchronous timer clear).
      const draining = engine.stop()
      forumProjection.stop()
      return draining
    },
  }
}
