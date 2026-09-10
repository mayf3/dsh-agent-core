/**
 * @agent-core/workflow-execution/src/ledger-events.js — the event vocabulary
 * and replay projection (WORKFLOW_AGENT_EXECUTION_V2; whole-authority
 * successor of V1). Pure: no I/O, no clocks — the ExecutionLedger store
 * (ledger.js) owns the durable append + mutation machinery and delegates all
 * projection here, so the state machine is unit-testable against bytes.
 *
 * Event kinds and the projection they build (the frozen state machine is
 * ACTIVE | SETTLED | NEEDS_REVIEW; no new terminal state in V2):
 *
 *   attempt_planned     { attemptId, nodeVisitId, dispatchIntentId,
 *                         workflowInstanceId, ownerPrincipalId }
 *                       → ACTIVE phase planned. This event IS the atomic
 *                       one-attempt-per-NodeVisit fence.
 *   delivery_started    { nodeVisitId }
 *                       → ACTIVE phase delivery_started. V2 CTR-WAE-012: the
 *                       durable WRITE-AHEAD INTENT appended BEFORE any
 *                       router.deliver invocation on EVERY admission path;
 *                       at most ONE per attempt (a second is a corrupt-ledger
 *                       fail-loud). Presence ⇒ DELIVERY_STARTED_OR_OUTCOME_
 *                       UNKNOWN — never recovery-eligible; absence on a
 *                       blocked attempt is the mechanical proof of
 *                       never-invoked.
 *   resolution_blocked  { nodeVisitId, code }
 *                       → ACTIVE phase resolution_blocked (V2 CTR-WAE-011:
 *                       the recoverable-blocked live phase for resolution-
 *                       phase failures — zero delivery side effect by
 *                       construction, never terminal).
 *   recovery_authorized { nodeVisitId, authorityRef }
 *                       → phase stays resolution_blocked; records the exact
 *                       governance reference for ONE controlled recovery.
 *   recovery_refused    { nodeVisitId, authorityRef, refused }
 *                       → terminal NEEDS_REVIEW (E5 world drift on an
 *                       eligible-shaped attempt; the human path is correct).
 *   run_delivered       { attemptId, agentId, requestId, sessionId,
 *                         reconciliationHandle?, messageId? }
 *                       → ACTIVE phase run_delivered (the Run linkage).
 *   delivery_failed     { attemptId, reason }
 *                       → terminal NEEDS_REVIEW for every post-invocation
 *                       class. EXCEPTION (V2 CTR-WAE-011, projection-only):
 *                       HISTORICAL V1-era reasons starting `resolve_failed:`
 *                       project to ACTIVE/resolution_blocked — the emission
 *                       proves the engine was still resolving, so deliver was
 *                       never reached; event bytes stay exactly as written.
 *   reconciled          { attemptId, verdict: SETTLED|NEEDS_REVIEW, judgment,
 *                         reason }
 *                       → terminal.
 *
 * Terminal attempts refuse further appends fail-loud: no automatic second
 * execution exists, so a late writer must be visible, never absorbed.
 */

/**
 * The shared terminal-append refusal. Fail-loud, never absorbed.
 */
export function terminalRefusal(current, event) {
  throw new Error(
    `workflow-execution: refusing ${event.kind} for nodeVisit ${event.nodeVisitId} — attempt is terminal `
    + `(state=${current?.state}, phase=${current?.phase}); V1/V2 never re-run a settled/reviewed NodeVisit`,
  )
}

/**
 * Apply ONE event to the attempts Map (nodeVisitId → projection record).
 * Throws on any fact that contradicts the frozen invariants (a replayed file
 * can only produce that through real corruption — fail loud, never absorb).
 */
export function applyLedgerEvent(attempts, event) {
  const nodeVisitId = event.nodeVisitId.toLowerCase()
  const current = attempts.get(nodeVisitId)
  switch (event.kind) {
    case 'attempt_planned':
      if (current !== undefined) {
        // beginAttemptIfAbsent guards this; a replayed file can only hit it
        // if the same nodeVisitId was planned twice — impossible by
        // construction (deterministic id + existence check under lock).
        throw new Error(`workflow-execution: corrupt ledger — attempt_planned twice for nodeVisit ${nodeVisitId}`)
      }
      attempts.set(nodeVisitId, {
        attemptId: event.attemptId,
        nodeVisitId,
        dispatchIntentId: event.dispatchIntentId.toLowerCase(),
        workflowInstanceId: event.workflowInstanceId.toLowerCase(),
        ownerPrincipalId: event.ownerPrincipalId.toLowerCase(),
        state: 'ACTIVE',
        phase: 'planned',
        reason: undefined,
        createdAtMs: event.atMs,
        delivered: undefined,
      })
      return
    case 'delivery_started':
      if (current?.state !== 'ACTIVE') terminalRefusal(current, event)
      // V2 CTR-WAE-012: at most ONE delivery_started per attempt — a second
      // record would mean a second delivery was prepared for the same
      // deterministic attempt, which the fence forbids by construction.
      if (current.deliveryStartedAtMs !== undefined) {
        throw new Error(`workflow-execution: corrupt ledger — delivery_started twice for nodeVisit ${nodeVisitId}`)
      }
      if (current.phase !== 'planned' && current.phase !== 'resolution_blocked') {
        throw new Error(`workflow-execution: refusing delivery_started for nodeVisit ${nodeVisitId} — phase ${current.phase} is already in the delivery domain`)
      }
      current.phase = 'delivery_started'
      current.deliveryStartedAtMs = event.atMs
      return
    case 'resolution_blocked':
      if (current?.state !== 'ACTIVE') terminalRefusal(current, event)
      if (current.phase !== 'planned' && current.phase !== 'resolution_blocked') {
        throw new Error(`workflow-execution: refusing resolution_blocked for nodeVisit ${nodeVisitId} — phase ${current.phase} is in the delivery domain`)
      }
      if (typeof event.code !== 'string' || event.code === '') {
        throw new Error('workflow-execution: resolution_blocked requires a non-empty code')
      }
      current.phase = 'resolution_blocked'
      current.blockedCode = event.code
      current.blockedCount = (current.blockedCount ?? 0) + 1
      current.lastBlockedAtMs = event.atMs
      return
    case 'recovery_authorized':
      if (current?.state !== 'ACTIVE') terminalRefusal(current, event)
      if (current.phase !== 'resolution_blocked') {
        throw new Error(`workflow-execution: refusing recovery_authorized for nodeVisit ${nodeVisitId} — attempt is not pre-admission blocked (phase ${current.phase})`)
      }
      if (typeof event.authorityRef !== 'string' || event.authorityRef === '') {
        throw new Error('workflow-execution: recovery_authorized requires a non-empty authorityRef')
      }
      current.recoveryAuthorizedAtMs = event.atMs
      current.recoveryAuthorizations = (current.recoveryAuthorizations ?? 0) + 1
      current.lastAuthorityRef = event.authorityRef
      return
    case 'recovery_refused':
      if (current?.state !== 'ACTIVE') terminalRefusal(current, event)
      if (current.phase !== 'resolution_blocked') {
        throw new Error(`workflow-execution: refusing recovery_refused for nodeVisit ${nodeVisitId} — attempt is not pre-admission blocked (phase ${current.phase})`)
      }
      if (typeof event.authorityRef !== 'string' || event.authorityRef === ''
        || typeof event.refused !== 'string' || event.refused === '') {
        throw new Error('workflow-execution: recovery_refused requires non-empty authorityRef and refused')
      }
      current.state = 'NEEDS_REVIEW'
      current.phase = 'recovery_refused'
      current.reason = `recovery_refused:${event.refused}`
      current.lastAuthorityRef = event.authorityRef
      return
    case 'run_delivered':
      if (current?.state !== 'ACTIVE') terminalRefusal(current, event)
      current.state = 'ACTIVE'
      current.phase = 'run_delivered'
      current.delivered = {
        agentId: event.agentId,
        requestId: event.requestId,
        sessionId: event.sessionId,
        reconciliationHandle: event.reconciliationHandle,
        messageId: event.messageId,
        atMs: event.atMs,
      }
      return
    case 'delivery_failed':
      if (current?.state !== 'ACTIVE') terminalRefusal(current, event)
      // V2 CTR-WAE-011 (projection-only reclassification): a HISTORICAL V1
      // emission `resolve_failed:<code>` proves the engine was still in the
      // resolution phase when the attempt's single pass ended — deliver was
      // never reached. The event bytes stay exactly as written; only the
      // projected state mapping changes from terminal NEEDS_REVIEW to the
      // recoverable-blocked live phase. Every other reason (post-invocation
      // classes) stays terminal, fail-closed, non-recoverable.
      if (typeof event.reason === 'string' && event.reason.startsWith('resolve_failed:')) {
        current.state = 'ACTIVE'
        current.phase = 'resolution_blocked'
        current.blockedCode = event.reason.slice('resolve_failed:'.length)
        current.blockedCount = (current.blockedCount ?? 0) + 1
        current.lastBlockedAtMs = event.atMs
        current.historicalBlocked = true
        return
      }
      current.state = 'NEEDS_REVIEW'
      current.phase = 'delivery_failed'
      current.reason = event.reason
      return
    case 'reconciled':
      if (current?.state !== 'ACTIVE') terminalRefusal(current, event)
      if (event.verdict === 'ACTIVE') {
        throw new Error('workflow-execution: reconciled events must be terminal (SETTLED | NEEDS_REVIEW)')
      }
      current.state = event.verdict
      current.phase = 'reconciled'
      current.judgment = event.judgment
      current.reason = event.reason
      return
    default:
      throw new Error(`workflow-execution: unknown ledger event kind ${JSON.stringify(event?.kind)}`)
  }
}

/**
 * V2 record builders — the PRE-APPEND projection checks for the recovery
 * lifecycle events. The guards also exist in applyLedgerEvent for replay
 * safety, but checking only there would let an interleaved caller durably
 * append an event the projection then refuses (corrupt file: apply happens
 * after append). Pre-check + append + apply run inside ONE locked mutation,
 * so the check is atomic with the write. Each builder returns the event
 * patch ({ kind, ... }) for #recordForActive to stamp and append.
 */

export function buildDeliveryStartedEvent(current, nodeVisitId) {
  if (current.deliveryStartedAtMs !== undefined) {
    throw new Error(`workflow-execution: corrupt ledger — delivery_started twice for nodeVisit ${nodeVisitId.toLowerCase()}`)
  }
  if (current.phase !== 'planned' && current.phase !== 'resolution_blocked') {
    throw new Error(`workflow-execution: refusing delivery_started for nodeVisit ${nodeVisitId.toLowerCase()} — phase ${current.phase} is already in the delivery domain`)
  }
  return { kind: 'delivery_started' }
}

export function buildResolutionBlockedEvent(current, nodeVisitId, code) {
  if (typeof code !== 'string' || code === '') throw new TypeError('workflow-execution: resolution_blocked code is required')
  if (current.phase !== 'planned' && current.phase !== 'resolution_blocked') {
    throw new Error(`workflow-execution: refusing resolution_blocked for nodeVisit ${nodeVisitId.toLowerCase()} — phase ${current.phase} is in the delivery domain`)
  }
  return { kind: 'resolution_blocked', code }
}

export function buildRecoveryAuthorizedEvent(current, nodeVisitId, authorityRef) {
  if (typeof authorityRef !== 'string' || authorityRef === '') throw new TypeError('workflow-execution: authorityRef is required')
  if (current.phase !== 'resolution_blocked') {
    throw new Error(`workflow-execution: refusing recovery_authorized for nodeVisit ${nodeVisitId.toLowerCase()} — attempt is not pre-admission blocked (phase ${current.phase})`)
  }
  return { kind: 'recovery_authorized', authorityRef }
}

export function buildRecoveryRefusedEvent(current, nodeVisitId, authorityRef, refused) {
  if (typeof authorityRef !== 'string' || authorityRef === '') throw new TypeError('workflow-execution: authorityRef is required')
  if (typeof refused !== 'string' || refused === '') throw new TypeError('workflow-execution: refused is required')
  if (current.phase !== 'resolution_blocked') {
    throw new Error(`workflow-execution: refusing recovery_refused for nodeVisit ${nodeVisitId.toLowerCase()} — attempt is not pre-admission blocked (phase ${current.phase})`)
  }
  return { kind: 'recovery_refused', authorityRef, refused }
}
