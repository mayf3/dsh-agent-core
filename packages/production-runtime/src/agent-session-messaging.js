/**
 * @agent-core/production-runtime/src/agent-session-messaging.js — the
 * `agentSessionMessagingAccess` LOCAL capability provider for
 * agent_session_send / agent_session_turn_inspect
 * (AGENT_CORE_AGENT_SESSION_MESSAGING_V2, accepted r4,
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
 * agentRouter.deliver call → coordinate-bearing outcome audit append. A
 * first post-receipt coordinate append failure is reported honestly as
 * DELIVERED + UNKNOWN and never causes redelivery.
 *
 * Closed behavior: no replay, no second Session, no ping-pong, no
 * active-run steering, no external delivery, no Binding touch, no target
 * identity inheritance — B executes with B's own Principal/credential/
 * grants (R5); A's identity is origin metadata only.
 */

import { randomUUID } from 'node:crypto'

import {
  AGENT_SESSION_SEND_CAPABILITY_ID,
  AGENT_SESSION_TURN_INSPECT_CAPABILITY_ID,
} from '../../broker/src/capabilities/agent-session-messaging.js'
import { AGENT_SESSION_SEND_RECONCILE_CAPABILITY_ID } from '../../broker/src/capabilities/agent-session-reconcile.js'
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
  if (error?.envelope === 'outcome_unknown') return {
    code: 'outcome_unknown',
    detail: typeof error?.code === 'string'
      ? `send admission could not be proven; outcome unknown (reason: ${error.code})`
      : 'send admission could not be proven; outcome unknown',
  }
  if (error?.code === 'AGENT_PROCESS_EXITED' && error?.envelope === undefined && error?.status === undefined) {
    return { code: 'not_admitted', detail: 'target process exited before session RPC readiness; no prompt write existed (reason: AGENT_PROCESS_EXITED)' }
  }
  if (error?.proven === 'zero_byte' || error?.code === 'SESSION_WORKSPACE_MISMATCH') {
    return { code: 'not_admitted', detail: 'target admission provably rejected before any prompt byte' }
  }
  return {
    code: 'outcome_unknown',
    detail: typeof error?.code === 'string'
      ? `send admission outcome unproven; nothing was replayed (reason: ${error.code})`
      : 'send admission outcome unproven; nothing was replayed',
  }
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
  inspectTurn,
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
    const invocationCorrelation = typeof context?.invocationCorrelation === 'string'
      && context.invocationCorrelation.length >= 8
      && context.invocationCorrelation.length <= 128
      && /^[\x21-\x7e]+$/.test(context.invocationCorrelation)
      ? context.invocationCorrelation
      : undefined

    // ── R12: L1 intent BEFORE Router delivery; failure = zero deliveries ──
    if (audit.appendIntent({ sourceAgentId, targetAgentId, requestId, correlation, timeoutMode, invocationCorrelation }) !== 'appended') {
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
        result: 'failed', startedAtWallMs, invocationCorrelation, failureCode: mapped.code,
        ...(typeof error?.code === 'string' && error.code !== mapped.code
          ? { failureSource: error.code.slice(0, 128) }
          : {}),
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: false, error: mapped }
    }
    if (receipt === null || typeof receipt !== 'object' || receipt.accepted !== true
      || typeof receipt.sessionId !== 'string' || receipt.sessionId === ''
      || typeof receipt.messageId !== 'string' || receipt.messageId === '') {
      // Contract violation AFTER a proven delivery — the business result must
      // not be rewritten as a delivery failure.
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'failed', startedAtWallMs, invocationCorrelation,
        failureCode: 'internal_error', failureReason: 'post_receipt',
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: false, error: { code: 'outcome_unknown', detail: 'delivery was accepted but its trace coordinate is unavailable after a proven inbox receipt; outcome unknown' } }
    }

    const trace = {
      targetAgentId,
      sessionId: receipt.sessionId,
      messageId: receipt.messageId,
    }
    // The first proven-receipt row makes the exact coordinate durable before
    // any normal V2 success can settle. Losing this append is DELIVERED +
    // UNKNOWN and never licenses replay.
    if (audit.appendOutcome({
      sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
      result: 'accepted', reconciliationHandle: receipt.reconciliationHandle,
      startedAtWallMs, sessionId: trace.sessionId, messageId: trace.messageId,
      invocationCorrelation,
    }) !== 'appended') {
      auditFailed(requestId, 'outcome')
      return { ok: false, error: { code: 'outcome_unknown', detail: 'message delivered but trace evidence could not be retained; outcome unknown' } }
    }

    // ── R7: receipt-only mode returns on the real inbox receipt ───────────
    if (timeoutMode === 'receipt_only') {
      return { ok: true, result: { status: 'accepted', ...trace } }
    }

    // ── R8: wait for THIS exact Run's one aggregated final reply ──────────
    const handle = receipt.reconciliationHandle
    if (typeof handle !== 'string' || handle === '') {
      // Delivered but unreconcilable: honest unknown — never a fabricated
      // success and never not_admitted.
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'failed', reconciliationHandle: null, startedAtWallMs,
        sessionId: trace.sessionId, messageId: trace.messageId,
        invocationCorrelation, failureCode: 'outcome_unknown', failureReason: 'post_receipt',
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: false, error: { code: 'outcome_unknown', detail: 'message delivered but the reconciliation handle is unavailable after a proven inbox receipt; outcome unknown' } }
    }
    const deadlineWallMs = now() + timeoutSeconds * 1000
    const waited = await waitForFinalAssistantReply(handle, deadlineWallMs)
    if (waited.timedOut) {
      // The timeout stops only this wait — the target Run keeps running; no
      // cancel, no replay, no external push of its late result.
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'timeout', reconciliationHandle: handle, startedAtWallMs,
        sessionId: trace.sessionId, messageId: trace.messageId,
        invocationCorrelation,
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: true, result: { status: 'timeout', ...trace } }
    }
    const outcome = waited.outcome
    if (outcome.kind === 'replied') {
      if (audit.appendOutcome({
        sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
        result: 'replied', reconciliationHandle: handle, startedAtWallMs,
        sessionId: trace.sessionId, messageId: trace.messageId,
        invocationCorrelation,
      }) !== 'appended') auditFailed(requestId, 'outcome')
      return { ok: true, result: { status: 'replied', reply: outcome.reply, ...trace } }
    }
    const postReceiptUnknown = outcome.kind === 'outcome_unknown'
    let exitReason
    if (postReceiptUnknown && typeof router.getTurnReconciliation === 'function') {
      try {
        const snapshot = router.getTurnReconciliation(handle)?.snapshot
        const raw = snapshot?.terminationEvidence ?? snapshot?.errorClass ?? snapshot?.initialSource
        if (typeof raw === 'string' && raw !== '') exitReason = raw.slice(0, 128)
      } catch { /* the phase remains mechanically proven without optional reason evidence */ }
    }
    const failureEnvelope = outcome.kind === 'target_run_failed'
      ? { code: 'target_run_failed', detail: 'the exact target Run settled as failed; retained text is never returned as success' }
      : outcome.kind === 'not_admitted'
        ? { code: 'not_admitted', detail: 'the exact target Run settled as not admitted' }
        : outcome.kind === 'reply_unavailable'
          ? { code: 'reply_unavailable', detail: `reply unavailable (${outcome.reason})` }
          : {
              code: 'outcome_unknown',
              detail: exitReason === undefined
                ? 'the exact target Run terminated without a proven outcome after a proven inbox receipt'
                : `the exact target Run terminated without a proven outcome after a proven inbox receipt (exit reason: ${exitReason})`,
            }
    if (audit.appendOutcome({
      sourceAgentId, targetAgentId, requestId, correlation, timeoutMode,
      result: 'failed', reconciliationHandle: handle, startedAtWallMs,
      sessionId: trace.sessionId, messageId: trace.messageId,
      invocationCorrelation, failureCode: failureEnvelope.code,
      ...(outcome.kind === 'reply_unavailable' ? { failureReason: outcome.reason } : {}),
      ...(failureEnvelope.code === 'outcome_unknown' ? { failureReason: 'post_receipt' } : {}),
      ...(exitReason === undefined ? {} : { exitReason }),
    }) !== 'appended') auditFailed(requestId, 'outcome')
    return { ok: false, error: failureEnvelope }
  }

  async function inspect(rawArgs, context) {
    if (typeof inspectTurn !== 'function') {
      return { ok: false, error: { code: 'internal_error', detail: 'trusted turn inspection surface is unavailable' } }
    }
    try {
      return await inspectTurn({ args: rawArgs, callerAgentId: context?.callerAgentId })
    } catch {
      return { ok: false, error: { code: 'internal_error', detail: 'trusted turn inspection failed closed' } }
    }
  }

  function reconcile(rawArgs, context) {
    const sourceAgentId = context?.callerAgentId
    if (typeof sourceAgentId !== 'string' || !TRUSTED_SOURCE_AGENT_ID_RE.test(sourceAgentId)) {
      return { ok: false, error: { code: 'internal_error', detail: 'trusted caller identity missing from the gateway context' } }
    }
    if (rawArgs === null || typeof rawArgs !== 'object' || Array.isArray(rawArgs)
      || Object.keys(rawArgs).length !== 1 || !Object.hasOwn(rawArgs, 'invocationCorrelation')) {
      return { ok: false, error: { code: 'invalid_arguments', detail: 'lookup requires exactly invocationCorrelation' } }
    }
    const invocationCorrelation = rawArgs.invocationCorrelation
    if (typeof invocationCorrelation !== 'string' || invocationCorrelation.length < 8
      || invocationCorrelation.length > 128 || !/^[\x21-\x7e]+$/.test(invocationCorrelation)) {
      return { ok: false, error: { code: 'invalid_arguments', detail: 'invocationCorrelation must be an opaque printable 8..128-char string' } }
    }
    if (typeof audit.findInvocation !== 'function') {
      return { ok: false, error: { code: 'internal_error', detail: 'bounded retained evidence lookup is unavailable' } }
    }
    const found = audit.findInvocation({ sourceAgentId, invocationCorrelation })
    if (found.available !== true) {
      return { ok: false, error: { code: 'internal_error', detail: 'bounded retained evidence lookup failed closed' } }
    }
    return { ok: true, result: {
      invocationCorrelationFound: found.intentFound,
      outcome: found.outcome,
      oldestRetainedIntentTs: found.oldestRetainedIntentTs,
      retentionIntegrity: found.retentionIntegrity,
    } }
  }

  // Provider shape: handlers keyed by CAPABILITY ID then operation name —
  // the exact contract the broker execute-time resolver closure merges
  // (same shape as selfServiceSchedulerAccess.handlers).
  return { handlers: {
    [AGENT_SESSION_SEND_CAPABILITY_ID]: { send },
    [AGENT_SESSION_SEND_RECONCILE_CAPABILITY_ID]: { lookup: reconcile },
    [AGENT_SESSION_TURN_INSPECT_CAPABILITY_ID]: { inspect },
  } }
}

export { mapFinalAssistantOutputToOutcome }
