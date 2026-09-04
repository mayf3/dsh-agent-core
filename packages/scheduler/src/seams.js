/**
 * @agent-core/scheduler — injectable invocation + delivery seams (V2).
 *
 * The scheduler owns ZERO agent knowledge:
 *
 *   - `invokeAgent({agentId, sessionId, requestId, message, model?,
 *     lightContext?, timeoutMs?, deliveryTarget?, signal?, onStart?})` is the
 *     ONLY way an occurrence reaches an agent. `sessionId` is the fresh
 *     non-main native Session minted per occurrence (C-031); `requestId` is
 *     the occurrence idempotencyKey reused across every admission transport
 *     retry (C-008/C-023); `onStart` is the turn-start evidence callback the
 *     scheduler uses for the admitted->running transition (C-027).
 *   - `deliver({job, result})` is the ONLY way a job result reaches a
 *     channel. `job.delivery.to` / `job.delivery.channel` are OPAQUE strings
 *     — the scheduler never branches on "feishu". Delivery outcome is a
 *     SEPARATE field from execution outcome and never rewrites it (D-007
 *     §11.4).
 *
 * Both seams are plain async functions injected into the Scheduler; nothing
 * in this package imports a channel SDK or the Router.
 */

/** Invocation contract. Returns the outcome envelope consumed by the scheduler. */
export const INVOKE_CONTRACT = {
  input: {
    agentId: 'string (required)',
    sessionId: 'string — fresh non-main native Session minted per occurrence (C-031)',
    requestId: 'string — occurrence idempotencyKey; reuse across ALL transport retries (C-008)',
    message: 'string (required)',
    model: 'string|undefined — opaque model override (payload.model; not proven by D-007)',
    lightContext: 'boolean|undefined',
    timeoutMs: 'number|undefined — remaining time to the persisted execution deadline (C-025)',
    deliveryTarget: 'object|undefined — job.delivery verbatim (opaque)',
    signal: 'AbortSignal|undefined — aborted when the deadline passes; observing it is '
      + 'NOT a termination proof (C-010) — the original turn may still be running',
    onStart: 'Function|undefined — call EXACTLY when the exact turn is dispatched; '
      + 'drives the admitted->running transition (C-027)',
  },
  output: {
    status: "'ok' | 'error' | 'outcome_unknown'",
    summary: 'string|undefined — final agent text (announce payload)',
    error: 'string|undefined',
    sessionId: 'string|undefined',
    durationMs: 'number|undefined',
    started: 'boolean|undefined — true when the turn was actually dispatched '
      + '(distinguishes pre-start rejections from terminal failures; C-004)',
    reconciliationHandle: 'string|undefined — outcome_unknown carriers',
    evidence: 'object|undefined',
    // AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 R4 (ADDITIVE, optional): the
    // trusted production-runtime wrapper ingests the final
    // ```scheduler-result fenced block and attaches the validated structured
    // business result. The scheduler persists it VERBATIM into the history
    // RunRecord and never interprets business keys (opaque JSON; R-H7).
    // Shape contract: { final_status: 'PASS'|'PARTIAL'|'FAIL',
    // counters: flat string->integer map, notes?: string(<=500),
    // wake_sent?: [{target_agent_id, workflow_instance_id, request_id, session_id}] }.
    result: 'object|undefined — opaque structured business result (R4)',
    // Set INSTEAD of result when ingestion rejected the block (fail-soft;
    // execution outcome and delivery are never affected — R4 step 4).
    result_error_code: "'UNPARSEABLE' | 'OVERSIZE' | 'INVALID_SCHEMA' | undefined",
  },
}

/**
 * Deterministic fake invoker for tests: records every call and returns a
 * scripted outcome (default: {status:'ok', summary:'done'}). Invokes the
 * request's onStart callback synchronously (turn-start evidence).
 */
export function createFakeInvoker({ outcome = null, delayMs = 0, onCall = null } = {}) {
  const calls = []
  async function invokeAgent(request) {
    const call = { ...request, atMs: Date.now() }
    calls.push(call)
    if (onCall) onCall(call)
    try {
      if (typeof request.onStart === 'function') request.onStart()
    } catch { /* start evidence is best-effort for fakes */ }
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
    if (outcome && typeof outcome === 'function') return outcome(call)
    return outcome ?? { status: 'ok', summary: 'ok', sessionId: request.sessionId, durationMs: 1 }
  }
  invokeAgent.calls = calls
  invokeAgent.assertRunnable = () => true
  return invokeAgent
}

/** No-op invoker for integration stubs: records and succeeds instantly. */
export function createNoopInvoker() {
  const calls = []
  async function invokeAgent(request) {
    calls.push(request)
    try {
      if (typeof request.onStart === 'function') request.onStart()
    } catch { /* ignore */ }
    return { status: 'ok', summary: '', sessionId: request.sessionId, durationMs: 0 }
  }
  invokeAgent.calls = calls
  invokeAgent.assertRunnable = () => true
  return invokeAgent
}

/** Delivery seam contract. */
export const DELIVER_CONTRACT = {
  input: {
    job: 'the job (delivery.* fields opaque)',
    result: 'the invocation outcome envelope',
    text: 'string — the text to deliver (result.summary)',
  },
  output: 'void; throw to mark not-delivered (never rewrites the execution outcome)',
}

/**
 * Recording delivery seam: never sends anything, records every delivery.
 * The real Feishu Connector adapter replaces this later without scheduler
 * changes (delivery.to/channel stay opaque).
 */
export function createRecordingDelivery() {
  const deliveries = []
  async function deliver({ job, result, text }) {
    deliveries.push({
      jobId: job.id,
      mode: job.delivery?.mode,
      channel: job.delivery?.channel,
      to: job.delivery?.to,
      text: text ?? null,
      resultStatus: result?.status,
    })
  }
  deliver.deliveries = deliveries
  return deliver
}
