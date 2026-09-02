/**
 * @agent-core/production-runtime/src/agent-session-messaging.js — the
 * `agentSessionMessagingAccess` LOCAL capability provider for
 * agent_session_send (AGENT_CORE_AGENT_SESSION_MESSAGING_V1, accepted r3,
 * implementation_authority: contracts).
 *
 * Trusted seam: these handlers run IN-PROCESS in the control-plane broker
 * gateway. The model-visible args are EXACTLY { targetAgentId, message,
 * timeoutSeconds } (R2); everything else is derived by the trusted runtime:
 *
 *   sourceAgentId  = the gateway-frozen ACTUAL caller (context.callerAgentId)
 *   correlation    = the exact source turnExecutionId proven at the
 *                    parent-RPC boundary (context.sourceTurnExecutionId —
 *                    present in the source process's execution map, not
 *                    settled; R3)
 *   requestId      = fresh opaque runtime id per send
 *   sessionMode    = 'main' forever (target canonical main; one send = one
 *                    new Run/Turn, never a new Session)
 *
 * Commit order is frozen (R12): authoritative validation → intent audit
 * append (failure = internal_error with ZERO Router deliveries) → ONE
 * agentRouter.deliver call → outcome audit append (a post-receipt append
 * failure never rewrites the proven business result).
 *
 * Closed behavior: no replay, no second Session, no ping-pong, no
 * active-run steering, no external delivery, no Binding touch, no target
 * identity inheritance — B executes with B's own Principal/credential/
 * grants (R5); A's identity is origin metadata only.
 */

import { randomUUID } from 'node:crypto'

import { AGENT_SESSION_SEND_CAPABILITY_ID } from '../../broker/src/capabilities/agent-session-messaging.js'
import { createFinalReplyWaiter, mapFinalAssistantOutputToOutcome } from './agent-session-reply-wait.js'

const TARGET_AGENT_ID_RE = /^agt_[a-z0-9-]+$/
const TRUSTED_SOURCE_AGENT_ID_RE = /^agt_[A-Za-z0-9_-]+$/
const MESSAGE_MAX_UTF8_BYTES = 65536
const TIMEOUT_MAX_SECONDS = 300

/**
 * Authoritative first-action validation (R2). Broker structural validation
 * is defense-in-depth only: byte-length and NUL rules are expressible
 * nowhere else, so the trusted handler re-checks EVERYTHING here — before
 * request-id generation, audit appends, or any Router delivery.
 * @returns {{ok:true, args:object} | {ok:false, detail:string}}
 */
export function validateSendArgs(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, detail: 'arguments must be an object with exactly targetAgentId, message, timeoutSeconds' }
  }
  const keys = Object.keys(input)
  for (const key of ['targetAgentId', 'message', 'timeoutSeconds']) {
    if (!keys.includes(key)) return { ok: false, detail: `missing required property "${key}"` }
  }
  if (keys.some((key) => !['targetAgentId', 'message', 'timeoutSeconds'].includes(key))) {
    return { ok: false, detail: 'unknown property: only targetAgentId, message, timeoutSeconds are accepted' }
  }
  const { targetAgentId, message, timeoutSeconds } = input
  if (typeof targetAgentId !== 'string'
    || targetAgentId.length < 5 || targetAgentId.length > 128
    || !TARGET_AGENT_ID_RE.test(targetAgentId)) {
    return { ok: false, detail: 'targetAgentId must match ^agt_[a-z0-9-]+$ (5..128 chars)' }
  }
  if (typeof message !== 'string') return { ok: false, detail: 'message must be a string' }
  if (message.includes('\u0000')) return { ok: false, detail: 'message must not contain NUL bytes' }
  const messageBytes = Buffer.byteLength(message, 'utf8')
  if (messageBytes < 1 || messageBytes > MESSAGE_MAX_UTF8_BYTES) {
    return { ok: false, detail: `message must be 1..${MESSAGE_MAX_UTF8_BYTES} UTF-8 bytes (got ${messageBytes})` }
  }
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 0 || timeoutSeconds > TIMEOUT_MAX_SECONDS) {
    return { ok: false, detail: `timeoutSeconds must be an integer 0..${TIMEOUT_MAX_SECONDS} (no default)` }
  }
  return { ok: true, args: { targetAgentId, message, timeoutSeconds } }
}

/**
 * Map ONE deliver() rejection to the closed §5 class. The proven-vs-unknown
 * distinction is preserved: a provably zero-byte rejection is not_admitted
 * (or queue_capacity_exceeded), an unproven admission is outcome_unknown,
 * and nothing here ever retries.
 */
function mapDeliverError(error) {
  if (error?.code === 'AGENT_DISABLED') return { code: 'target_disabled', detail: 'targetAgentId resolves to a disabled Agent' }
  if (error?.code === 'AGENT_NOT_FOUND') return { code: 'target_not_found', detail: 'no enabled Agent resolves targetAgentId' }
  if (error?.envelope === 'not_admitted') {
    return error?.code === 'AGENT_PROCESS_QUEUE_CAP'
      ? { code: 'queue_capacity_exceeded', detail: 'target bounded queue rejected the admission; zero prompt bytes written' }
      : { code: 'not_admitted', detail: 'target admission provably rejected; zero prompt bytes written' }
  }
  if (error?.envelope === 'outcome_unknown') return { code: 'outcome_unknown', detail: 'send admission could not be proven; outcome unknown' }
  if (error?.proven === 'zero_byte' || error?.code === 'SESSION_WORKSPACE_MISMATCH') {
    return { code: 'not_admitted', detail: 'target admission provably rejected before any prompt byte' }
  }
  return { code: 'outcome_unknown', detail: 'send admission outcome unproven; nothing was replayed' }
}

/**
 * Create the provider.
 * @param {object} deps
 * @param {object} deps.router - the agentRouter service (deliver +
 *   readFinalAssistantOutput + onTurnReconciled seams; sole reconciliation
 *   authority).
 * @param {object} deps.audit - createAgentSessionMessagingAudit surface.
 * @param {({phase:string, requestId:string, result?:string}) => void} [deps.onAuditFailure] -
 *   sanitized operations-visible append-failure signal (never business data).
 * @param {() => string} [deps.generateRequestId] - opaque id seam (tests).
 * @param {() => number} [deps.now] - wall-clock seam (tests).
 * @param {{set:Function, clear:Function}} [deps.timer] - timer seam (tests).
 * @returns {{ handlers: { send: Function } }}
 */
export function createAgentSessionMessagingAccess({
  router,
  audit,
  onAuditFailure = () => {},
  generateRequestId = () => randomUUID(),
  now = () => Date.now(),
  timer,
}) {
  if (router === undefined || typeof router.deliver !== 'function'
    || typeof router.readFinalAssistantOutput !== 'function'
    || typeof router.onTurnReconciled !== 'function') {
    throw new TypeError('agent-session-messaging: router with deliver/readFinalAssistantOutput/onTurnReconciled is required')
  }
  if (audit === undefined || typeof audit.appendIntent !== 'function'
    || typeof audit.appendOutcome !== 'function' || typeof audit.appendDenial !== 'function') {
    throw new TypeError('agent-session-messaging: audit surface is required')
  }
  const waitForFinalAssistantReply = createFinalReplyWaiter({
    read: (handle) => router.readFinalAssistantOutput(handle),
    subscribe: (listener) => router.onTurnReconciled(listener),
    ...(timer === undefined ? {} : { timer }),
    now,
  })

  function auditFailed(requestId, phase) {
    try {
      onAuditFailure({ phase, requestId })
    } catch { /* the sanitized signal is best-effort by contract */ }
  }

  function deny(sourceAgentId, code, detail) {
    if (audit.appendDenial({
      capabilityId: AGENT_SESSION_SEND_CAPABILITY_ID,
      agentId: typeof sourceAgentId === 'string' ? sourceAgentId : undefined,
      code,
    }) !== 'appended') auditFailed(undefined, 'denial')
    return { ok: false, error: { code, detail } }
  }

  /**
   * The `send` operation handler: (args, trustedContext) -> broker envelope.
   */
  async function send(rawArgs, context) {
    // ── R2: authoritative validation, first action, no side effects yet ────
    const checked = validateSendArgs(rawArgs)
    if (!checked.ok) {
      return deny(context?.callerAgentId, 'invalid_arguments', checked.detail)
    }
    const { targetAgentId, message, timeoutSeconds } = checked.args

    // ── R3: trusted runtime-derived identity + exact source-turn proof ────
    const sourceAgentId = context?.callerAgentId
    if (typeof sourceAgentId !== 'string' || !TRUSTED_SOURCE_AGENT_ID_RE.test(sourceAgentId)) {
      return deny(sourceAgentId, 'internal_error', 'trusted caller identity missing from the gateway context')
    }
    const correlation = context?.sourceTurnExecutionId
    if (typeof correlation !== 'string' || correlation === '') {
      // Missing or stale source execution proof fails BEFORE Router delivery.
      return deny(sourceAgentId, 'internal_error', 'trusted source turn proof missing or stale')
    }
    if (targetAgentId === sourceAgentId) {
      // R3: self-send would self-deadlock the per-process queue — rejected
      // before delivery, never smuggled through as accepted.
      return deny(sourceAgentId, 'self_send_not_supported', 'sending to the calling Agent itself is not supported')
    }

    const timeoutMode = timeoutSeconds === 0 ? 'receipt_only' : 'wait_reply'
    const requestId = generateRequestId()
    const startedAtWallMs = now()

    // ── R12: L1 intent BEFORE Router delivery; failure = zero deliveries ──
    if (audit.appendIntent({ sourceAgentId, targetAgentId, requestId, correlation, timeoutMode }) !== 'appended') {
      auditFailed(requestId, 'intent')
      return { ok: false, error: { code: 'internal_error', detail: 'audit intent append failed; nothing was delivered' } }
    }

    // ── ONE outbound admission into the target canonical main ─────────────
    let receipt
    try {
      receipt = await router.deliver(
        { requestId, agentId: targetAgentId, sessionMode: 'main', message },
        {
          messageOrigin: Object.freeze({
            kind: 'inter_agent',
            sourceAgentId,
            correlation,
          }),
        },
      )
    } catch (error) {
      const mapped = mapDeliverError(error)
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'failed', startedAtWallMs,
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: false, error: mapped }
    }
    if (receipt === null || typeof receipt !== 'object' || receipt.accepted !== true) {
      // Contract violation AFTER a proven delivery — the business result must
      // not be rewritten as a delivery failure.
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'failed', startedAtWallMs,
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: false, error: { code: 'internal_error', detail: 'delivery receipt was malformed after a proven inbox acceptance' } }
    }

    // ── R7: receipt-only mode returns on the real inbox receipt ───────────
    if (timeoutMode === 'receipt_only') {
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'accepted', reconciliationHandle: receipt.reconciliationHandle, startedAtWallMs,
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: true, result: { status: 'accepted' } }
    }

    // ── R8: wait for THIS exact Run's one aggregated final reply ──────────
    const handle = receipt.reconciliationHandle
    if (typeof handle !== 'string' || handle === '') {
      // Delivered but unreconcilable: honest unknown — never a fabricated
      // success and never not_admitted.
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'failed', reconciliationHandle: null, startedAtWallMs,
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: false, error: { code: 'outcome_unknown', detail: 'message delivered but the reconciliation handle is unavailable; outcome unknown' } }
    }
    const deadlineWallMs = now() + timeoutSeconds * 1000
    const waited = await waitForFinalAssistantReply(handle, deadlineWallMs)
    if (waited.timedOut) {
      // The timeout stops only this wait — the target Run keeps running; no
      // cancel, no replay, no external push of its late result.
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'timeout', reconciliationHandle: handle, startedAtWallMs,
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: true, result: { status: 'timeout' } }
    }
    const outcome = waited.outcome
    if (outcome.kind === 'replied') {
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'replied', reconciliationHandle: handle, startedAtWallMs,
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: true, result: { status: 'replied', reply: outcome.reply } }
    }
    const failureEnvelope = outcome.kind === 'target_run_failed'
      ? { code: 'target_run_failed', detail: 'the exact target Run settled as failed; retained text is never returned as success' }
      : outcome.kind === 'not_admitted'
        ? { code: 'not_admitted', detail: 'the exact target Run settled as not admitted' }
        : outcome.kind === 'reply_unavailable'
          ? { code: 'reply_unavailable', detail: `reply unavailable (${outcome.reason})` }
          : { code: 'outcome_unknown', detail: 'the exact target Run terminated without a proven outcome' }
    if (audit.appendOutcome({
      sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
      result: 'failed', reconciliationHandle: handle, startedAtWallMs,
    }) !== 'appended') auditFailed(requestId, 'outcome')
    return { ok: false, error: failureEnvelope }
  }

  // Provider shape: handlers keyed by CAPABILITY ID then operation name —
  // the exact contract the broker execute-time resolver closure merges
  // (same shape as selfServiceSchedulerAccess.handlers).
  return { handlers: { [AGENT_SESSION_SEND_CAPABILITY_ID]: { send } } }
}

export { mapFinalAssistantOutputToOutcome }
