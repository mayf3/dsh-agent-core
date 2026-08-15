/**
 * @agent-core/scheduler — injectable invocation + delivery seams.
 *
 * The scheduler owns ZERO agent knowledge:
 *
 *   - `invokeAgent({agentId, sessionId, message, model?, lightContext?,
 *     timeoutMs?, deliveryTarget?})` is the ONLY way a job reaches an agent.
 *     The Product Integration / Router agent (packages/agent-router,
 *     separate PR) will provide the real implementation later; V1 ships a
 *     FakeInvoker for tests and a NoopInvoker for integration stubs.
 *   - `deliver({job, result})` is the ONLY way a job result reaches a channel.
 *     `job.delivery.to` / `job.delivery.channel` are OPAQUE strings — the
 *     scheduler never branches on "feishu". The Feishu Connector will provide
 *     the real adapter later; V1 ships a recording delivery seam.
 *
 * Both seams are plain async functions injected into the Scheduler; nothing
 * in this package imports a channel SDK or the Router.
 */

/** Invocation contract. Returns the outcome envelope consumed by the scheduler. */
export const INVOKE_CONTRACT = {
  input: {
    agentId: 'string (required)',
    sessionId: 'string|undefined — explicit session; undefined = engine default',
    message: 'string (required)',
    model: 'string|undefined — opaque model override (payload.model)',
    lightContext: 'boolean|undefined',
    timeoutMs: 'number|undefined — run timeout (payload.timeoutSeconds*1000)',
    deliveryTarget: 'object|undefined — job.delivery verbatim (opaque)',
    signal: 'AbortSignal|undefined — aborted when the run times out; invokers MAY '
      + 'observe it, but ignoring it is allowed (end-to-end cancellation is '
      + 'verified at Scheduler → Router Final Integration, audit TIMEOUT_ABORT)',
  },
  output: {
    status: "'ok' | 'error'",
    summary: 'string|undefined — final agent text (announce payload)',
    error: 'string|undefined',
    sessionId: 'string|undefined',
    durationMs: 'number|undefined',
  },
}

/** Default session id for a job (mirrors OpenClaw's `agent:<id>:cron:<jobId>` convention). */
export function defaultSessionId(job) {
  if (job.sessionKey) return job.sessionKey
  return `agent:${job.agentId}:cron:${job.id}`
}

/**
 * Deterministic fake invoker for tests: records every call and returns a
 * scripted outcome (default: {status:'ok', summary:'done'}).
 */
export function createFakeInvoker({ outcome = null, delayMs = 0, onCall = null } = {}) {
  const calls = []
  async function invokeAgent(request) {
    const call = { ...request, atMs: Date.now() }
    calls.push(call)
    if (onCall) onCall(call)
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
    if (outcome && typeof outcome === 'function') return outcome(call)
    return outcome ?? { status: 'ok', summary: 'ok', sessionId: request.sessionId, durationMs: 1 }
  }
  invokeAgent.calls = calls
  return invokeAgent
}

/** No-op invoker for integration stubs: records and succeeds instantly. */
export function createNoopInvoker() {
  const calls = []
  async function invokeAgent(request) {
    calls.push(request)
    return { status: 'ok', summary: '', sessionId: request.sessionId, durationMs: 0 }
  }
  invokeAgent.calls = calls
  return invokeAgent
}

/** Delivery seam contract. */
export const DELIVER_CONTRACT = {
  input: {
    job: 'the job (delivery.* fields opaque)',
    result: 'the invocation outcome envelope',
    text: 'string — the text to deliver (result.summary)',
  },
  output: 'void; throw to mark not-delivered',
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
