/**
 * @agent-core/scheduler-router — Scheduler ↔ Router Final Integration bridge.
 *
 * The Scheduler Replacement V1 (packages/scheduler) owns zero agent
 * knowledge and reaches agents/channels ONLY through its injected seams:
 *
 *   invokeAgent(request)  — scheduler.js -> this bridge -> existing Router
 *   deliver({job, result, text}) — scheduler.js -> this bridge -> existing
 *                                   Feishu outbound seam
 *
 * This package is the real wiring promised by docs/reports/
 * scheduler-replacement-v1.md §5/§6 ("Product Integration 提供稳定
 * invokeAgent 后，一行注入"): it adapts the scheduler's seam contract to the
 * Router's EXISTING public domain surface. It changes nothing inside the
 * Router and nothing inside the Scheduler core:
 *
 *   - `createRouterInvoker(router)` calls only
 *     `router.runTurnWithRouteChain(agentId, args)` (the Router's published
 *     unified route-attempt chain surface — the same single executor behind
 *     onIngress and Delivery V0). No Router source change, no scheduler
 *     special-case inside the Router, no chain logic in this bridge.
 *   - `createFeishuDeliver(feishu)` calls only `feishu.reply(ReplyTarget,
 *     text)` — the single existing outbound send (packages/feishu-connector,
 *     same seam the Router's onIngress reply path uses). It reads the opaque
 *     `job.delivery.{channel,to}` fields and builds the ReplyTarget; it
 *     never opens a second outbound path.
 *
 * AbortSignal (scheduler TIMEOUT_ABORT audit): the scheduler passes
 * `request.signal` into the seam; this bridge OBSERVES it (records
 * `aborted` on every settled call). The Router / AgentProcess currently has
 * NO cancellation seam (turn() has no signal; the demo-server JSON-RPC
 * METHODS set has no cancel), so the signal cannot cancel a real turn yet —
 * the bridge records the observation for the TIMEOUT_ABORT_END_TO_END
 * evidence and keeps the turn running (see docs/reports/
 * scheduler-router-final-integration-v1.md).
 */

// Process-lifetime defense in depth. Cross-process durability remains the
// Scheduler occurrence ledger + AgentProcess caller-correlation authority.
const PROCESS_ADMISSIONS = new Map()
const TERMINATION_EVIDENCE = new Set([
  'exact_terminal_then_idle',
  'exact_queued_removal',
  'child_real_exit',
  'cancellation_ack',
])

/** Parse an opaque scheduler delivery target `job.delivery.to` into a Feishu chat id. */
export function chatIdFromDeliveryTo(to) {
  if (typeof to !== 'string' || to.trim() === '') {
    throw new TypeError('scheduler-router: job.delivery.to must be a non-empty string')
  }
  const trimmed = to.trim()
  // OpenClaw announce targets are `chat:oc_...`; accept the bare chat id too.
  if (trimmed.startsWith('chat:')) return trimmed.slice('chat:'.length)
  if (trimmed.startsWith('oc_')) return trimmed
  throw new TypeError(`scheduler-router: unsupported delivery target: ${to} (expected chat:<chatId>)`)
}

/**
 * The real invocation seam: Scheduler.invokeAgent -> Router published chain
 * surface -> AgentProcess -> DSH native Session.
 *
 * Uses ONLY the Router's published domain surface:
 *   - `router.runTurnWithRouteChain(agentId, {sessionId, message, opts,
 *     deadlineMs, strictReason})` — the unified ordered route-attempt seam
 *     (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1 CTR-IMPL-002) shared by all
 *     three process-admission entries. The chain executor owns hop/STOP
 *     policy, the per-attempt journal and the single deadline budget; this
 *     bridge never imports executor internals and runs NO chain logic of its
 *     own.
 *   - `opts.onDispatch` fires exactly once when the first route attempt's
 *     turn is dispatched — the scheduler's admitted->running start evidence
 *     (C-027; envelope started semantics: any dispatched attempt => true).
 *   - an explicit `request.model` selects STRICT_CHAIN_MODE (DEC-IMPL-005:
 *     exactly one attempt, zero fallbacks). The model string itself stays
 *     opaque — no model→route resolution exists at this layer.
 *
 * V2 (SCHEDULER_TIMEOUT_OUTCOME_V2) — unchanged semantics, one occurrence =
 * one logical turn = ONE chain execution producing exactly one outcome
 * envelope (multiple route attempts are internal to the occurrence; hop !=
 * transport retry, the requestId admission fingerprint never changes):
 *   - `request.sessionId` is the fresh non-main native Session minted PER
 *     OCCURRENCE by the scheduler (C-031 / D-006 §10).
 *   - `request.requestId` (the occurrence idempotencyKey) is recorded on
 *     every call and carried in evidence (C-008/C-023).
 *   - error outcomes carry `started` so the scheduler can distinguish a
 *     proven PRE-START rejection (no attempt ever dispatched) from a terminal
 *     failure of a started run (C-004).
 *
 * Never throws: every failure becomes the scheduler's outcome envelope.
 * Structured `outcome_unknown` carriers (status/envelope) pass through with
 * their reconciliationHandle — an unproven execution is NEVER collapsed into
 * ordinary error (C-001).
 *
 * @param {object} router - the published `agentRouter` service (or any object
 *   exposing runTurnWithRouteChain(agentId, args) -> turn result).
 * @param {object} [opts]
 * @param {object} [opts.definition] - optional Agent Definition service
 *   (`agentDefinition`); when present, the target agent must be RUNNABLE
 *   before spawn: unknown (AGENT_NOT_FOUND) AND disabled (AGENT_DISABLED)
 *   are both rejected before the chain seam is ever called (merge review
 *   FIX 2). These rejections are PRE-START (the turn never began).
 * @returns {Function} the invokeAgent(request) seam, with `.calls` log.
 */
export function createRouterInvoker(router, opts = {}) {
  if (router === undefined || typeof router.runTurnWithRouteChain !== 'function') {
    throw new TypeError('scheduler-router: router.runTurnWithRouteChain(agentId, args) is required')
  }
  const definition = opts?.definition
  const calls = []
  const admissions = opts?.admissions ?? PROCESS_ADMISSIONS

  /**
   * Runnable-agent check: unknown OR disabled -> structured rejection, so
   * the Router's spawn path is never reached for a non-runnable target.
   * @param {string} agentId
   * @throws {Error} code `AGENT_NOT_FOUND` (unknown) or `AGENT_DISABLED`.
   */
  function assertRunnable(agentId) {
    if (definition === undefined) return
    const defined = definition.getAgent(agentId) // throws AGENT_NOT_FOUND when unknown
    if (defined.disabled === true) {
      throw Object.assign(new Error(`scheduler-router: agent ${agentId} is disabled (not runnable)`), { code: 'AGENT_DISABLED' })
    }
  }

  async function executeAgent(request) {
    const started = Date.now()
    const call = { agentId: request.agentId, sessionId: request.sessionId, requestId: request.requestId, atMs: started }
    let aborted = false
    let turnDispatched = false
    if (request.signal) {
      request.signal.addEventListener('abort', () => { aborted = true }, { once: true })
    }
    try {
      assertRunnable(request.agentId)
      // The Scheduler owns the run deadline (it aborts `signal`); the chain
      // gets the same single budget (margin so the scheduler's race settles
      // first). Hops consume this budget — no per-hop refresh exists.
      const turnTimeoutMs = request.timeoutMs ? request.timeoutMs + 30_000 : 300_000
      const turnResult = await router.runTurnWithRouteChain(request.agentId, {
        sessionId: request.sessionId,
        message: request.message,
        deadlineMs: turnTimeoutMs,
        // Explicit model => STRICT_CHAIN_MODE (DEC-IMPL-005): exactly one
        // route attempt, zero fallbacks. The model string stays opaque here.
        ...(request.model === undefined ? {} : { strictReason: 'explicit_model_strict' }),
        opts: {
          callerCorrelation: {
            occurrenceId: request.occurrenceId,
            runId: request.runId,
            requestId: request.requestId,
          },
          // Exactly once, when the FIRST route attempt's turn dispatches.
          onDispatch: () => {
            turnDispatched = true
            if (typeof request.onStart === 'function') request.onStart()
          },
        },
      })
      const outcome = {
        status: 'ok',
        summary: turnResult?.reply,
        sessionId: request.sessionId,
        durationMs: Date.now() - started,
        started: true,
        reconciliationHandle: turnResult?.reconciliationHandle,
        evidence: turnResult?.evidence,
      }
      call.outcome = outcome
      call.aborted = aborted
      calls.push(call)
      return outcome
    } catch (error) {
      const explicitlyUnknown = error?.status === 'outcome_unknown' || error?.envelope === 'outcome_unknown'
      const terminationEvidence = error?.terminationEvidence ?? error?.evidence?.terminationEvidence
      const provenTerminal = error?.status === 'failed' && TERMINATION_EVIDENCE.has(terminationEvidence)
      // Any post-dispatch failure without exact-turn termination proof is
      // outcome_unknown, even when represented as a generic thrown Error.
      const unknown = explicitlyUnknown || (turnDispatched && !provenTerminal)
      const outcome = {
        status: unknown ? 'outcome_unknown' : 'error',
        error: error?.message ?? String(error),
        sessionId: request.sessionId,
        durationMs: Date.now() - started,
        started: turnDispatched, // false = proven pre-start rejection (C-004)
        ...(error?.reconciliationHandle === undefined ? {} : { reconciliationHandle: error.reconciliationHandle }),
        ...(error?.deadlineAtWallMs === undefined ? {} : { deadlineAtWallMs: error.deadlineAtWallMs }),
        ...(error?.evidence !== undefined
          ? { evidence: error.evidence }
          : provenTerminal ? { evidence: { terminationEvidence } } : {}),
      }
      call.outcome = outcome
      call.aborted = aborted
      calls.push(call)
      return outcome
    }
  }

  function invokeAgent(request) {
    const requestId = request?.requestId
    if (typeof requestId !== 'string' || requestId === '') return executeAgent(request)
    const fingerprint = request.payloadHash ?? JSON.stringify([
      request.agentId, request.sessionId, request.message, request.model ?? null, request.lightContext ?? null,
    ])
    const existing = admissions.get(requestId)
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return Promise.resolve({
          status: 'error', started: false, code: 'OCCURRENCE_PAYLOAD_CONFLICT',
          error: `requestId ${requestId} is already bound to a different payload`,
          sessionId: request.sessionId,
        })
      }
      return existing.promise
    }
    const promise = executeAgent(request)
    admissions.set(requestId, { fingerprint, promise })
    return promise
  }
  invokeAgent.calls = calls
  invokeAgent.assertRunnable = assertRunnable
  return invokeAgent
}

/**
 * The real delivery seam: Scheduler.deliver -> existing Feishu outbound.
 *
 * Maps the scheduler's OPAQUE delivery directive onto the ONE existing
 * outbound seam: `feishu.reply(ReplyTarget, text)` (the same call the
 * Router's onIngress reply path uses; im.message.create via a `create`
 * ReplyTarget). `job.delivery.{channel,to}` stay opaque to the Scheduler —
 * this adapter is the only place that reads them.
 *
 * Throws for anything it cannot send -> the Scheduler marks the run
 * not-delivered (deliver throw = not-delivered, scheduler.js _runOne).
 *
 * @param {object} feishu - the published `feishu` channel handle exposing
 *   `reply(replyTarget, text) -> {messageId, chatId, code, msg}`.
 * @returns {Function} the deliver({job, result, text}) seam, with
 *   `.deliveries` log.
 */
export function createFeishuDeliver(feishu) {
  if (feishu === undefined || typeof feishu.reply !== 'function') {
    throw new TypeError('scheduler-router: feishu.reply(replyTarget, text) is required')
  }
  const deliveries = []

  async function deliver({ job, result, text }) {
    const delivery = job?.delivery ?? {}
    if (delivery.channel !== 'feishu') {
      throw new Error(`scheduler-router: unsupported delivery channel: ${String(delivery.channel)} (only feishu)`)
    }
    const chatId = chatIdFromDeliveryTo(delivery.to)
    // ReplyTarget literal per the feishu-connector contract (api.js):
    // kind 'create' -> im.message.create with receive_id_type 'chat_id'.
    const target = {
      kind: 'create',
      conversationId: `group:${chatId}`,
      chatId,
      channel: 'group',
      receiveIdType: 'chat_id',
      receiveId: chatId,
      threadId: undefined,
      rootMsgId: undefined,
      replyInThread: false,
    }
    const sent = await feishu.reply(target, String(text ?? ''))
    deliveries.push({
      jobId: job.id,
      channel: delivery.channel,
      to: delivery.to,
      chatId,
      text: text ?? null,
      resultStatus: result?.status,
      sent,
    })
    return sent
  }
  deliver.deliveries = deliveries
  return deliver
}
