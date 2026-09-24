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
 *   stale_superseded    { nodeVisitId, observedWorkflowStateVersion }
 *                       (WORKFLOW_STALE_REENTRY_V1 CTR-SRE-002)
 *                       → terminal SETTLED, phase 'stale_superseded',
 *                       judgment 'stale_no_progress'. THE ONE re-entry
 *                       marker: legal only from ACTIVE/run_delivered or from
 *                       terminal NEEDS_REVIEW, both with delivered evidence —
 *                       never from a pre-delivery phase, never from SETTLED.
 *
 * Terminal attempts refuse further appends fail-loud. The ONE exception is
 * CTR-SRE-003: a terminal attempt with judgment 'stale_no_progress' may be
 * superseded by a generation N+1 attempt_planned (same identity triple) —
 * that is the stale re-entry path, not a silent re-run.
 */

/**
 * The shared terminal-append refusal. Fail-loud, never absorbed.
 */
export function terminalRefusal(current, event) {
  throw new Error(
    `workflow-execution: refusing ${event.kind} for nodeVisit ${event.nodeVisitId} — attempt is terminal `
    + `(state=${current?.state}, phase=${current?.phase}); a settled/reviewed NodeVisit re-runs only via `
    + `the WORKFLOW_STALE_REENTRY_V1 stale_no_progress generation path`,
  )
}

/**
 * CTR-SRE-002: the stale-supersession source-state guard. Both legal
 * source classes carry delivered evidence (the dispatch actually happened);
 * a pre-delivery phase or a plain SETTLED (business progressed) never
 * qualifies.
 */
function staleSupersessionSourceGuard(current, event) {
  if (current?.state === 'ACTIVE' && current.phase === 'run_delivered' && current.delivered !== undefined) return
  if (current?.state === 'NEEDS_REVIEW' && current.delivered !== undefined) return
  terminalRefusal(current, event)
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
    case 'attempt_planned': {
      const generation = event.generation ?? 1
      if (!Number.isInteger(generation) || generation < 1) {
        throw new Error(`workflow-execution: corrupt ledger — attempt_planned generation ${JSON.stringify(event.generation)} for nodeVisit ${nodeVisitId}`)
      }
      if (current !== undefined) {
        // V2: planning twice was impossible by construction. V3 CTR-SRE-003
        // opens exactly ONE re-plan path: generation N+1 superseding a
        // terminal stale_no_progress attempt with the SAME identity triple.
        // Everything else — including a mismatched identity or a skipped
        // generation — is a corrupt file, fail loud, never absorb.
        const previousGeneration = current.generation ?? 1
        const sameIdentity = current.dispatchIntentId === event.dispatchIntentId.toLowerCase()
          && current.workflowInstanceId === event.workflowInstanceId.toLowerCase()
          && current.ownerPrincipalId === event.ownerPrincipalId.toLowerCase()
        const legalReplan = previousGeneration + 1 === generation
          && current.state !== 'ACTIVE'
          && current.judgment === 'stale_no_progress'
          && sameIdentity
        if (!legalReplan) {
          throw new Error(`workflow-execution: corrupt ledger — attempt_planned twice for nodeVisit ${nodeVisitId} (generation ${previousGeneration} → ${generation}, state=${current.state}, judgment=${current.judgment ?? 'none'})`)
        }
      }
      attempts.set(nodeVisitId, {
        attemptId: event.attemptId,
        generation,
        dispatchCount: generation,
        ...(current !== undefined
          ? { previousAttemptId: current.attemptId, retryReason: 'stale_no_progress' }
          : {}),
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
    }
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
      // CTR-SRE-002: the dispatch-time business baseline (best-effort probe;
      // absent ⇒ this attempt is never stale-eligible — conservative V2
      // behaviour for that attempt).
      if (event.workflowStateVersionAtDispatch !== undefined) {
        if (!Number.isInteger(event.workflowStateVersionAtDispatch) || event.workflowStateVersionAtDispatch < 1) {
          throw new Error(`workflow-execution: corrupt ledger — run_delivered workflowStateVersionAtDispatch ${JSON.stringify(event.workflowStateVersionAtDispatch)} for nodeVisit ${nodeVisitId}`)
        }
        current.workflowStateVersionAtDispatch = event.workflowStateVersionAtDispatch
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
      // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-004: the reconcile verdict
      // timestamp starts the run_ended_no_submission retry clock. Additive
      // projection field — existing files replay unchanged and simply gain
      // the field.
      current.reconciledAtMs = event.atMs
      return
    case 'stale_superseded': {
      // CTR-SRE-002: the ONE re-entry marker. Source guard first — ACTIVE
      // must be in the delivered phase; a terminal source must be
      // NEEDS_REVIEW; both must carry delivered evidence.
      staleSupersessionSourceGuard(current, event)
      if (!Number.isInteger(event.observedWorkflowStateVersion) || event.observedWorkflowStateVersion < 1) {
        throw new Error(`workflow-execution: corrupt ledger — stale_superseded requires an integer observedWorkflowStateVersion (nodeVisit ${nodeVisitId})`)
      }
      current.state = 'SETTLED'
      current.phase = 'stale_superseded'
      current.judgment = 'stale_no_progress'
      current.reason = `stale_no_progress: visit still current with workflow_state_version ${event.observedWorkflowStateVersion} unchanged since delivery`
      current.observedWorkflowStateVersion = event.observedWorkflowStateVersion
      current.staleSupersededAtMs = event.atMs
      return
    }
    case 'escalation_requested': {
      // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-005: the ONE escalation fact
      // per visit. The live writer never appends a second one (pre-check in
      // recordEscalationRequested), so a replayed second event means a
      // corrupt file — fail loud, never absorb.
      if (current === undefined) {
        throw new Error(`workflow-execution: corrupt ledger — escalation_requested for unknown nodeVisit ${nodeVisitId}`)
      }
      if (current.escalation !== undefined) {
        throw new Error(`workflow-execution: corrupt ledger — escalation_requested twice for nodeVisit ${nodeVisitId}`)
      }
      if (typeof event.reason !== 'string' || event.reason === '') {
        throw new Error(`workflow-execution: corrupt ledger — escalation_requested requires a reason (nodeVisit ${nodeVisitId})`)
      }
      current.escalation = {
        reason: event.reason,
        ...(Number.isInteger(event.attemptCount) ? { attemptCount: event.attemptCount } : {}),
        ...(typeof event.lastAttemptId === 'string' ? { lastAttemptId: event.lastAttemptId } : {}),
        ...(typeof event.dispatchIntentId === 'string' ? { dispatchIntentId: event.dispatchIntentId } : {}),
        atMs: event.atMs,
      }
      return
    }
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

export function buildStaleSupersededEvent(current, nodeVisitId, observedWorkflowStateVersion) {
  if (!Number.isInteger(observedWorkflowStateVersion) || observedWorkflowStateVersion < 1) {
    throw new TypeError('workflow-execution: observedWorkflowStateVersion must be a positive integer')
  }
  const legalSource = (current.state === 'ACTIVE' && current.phase === 'run_delivered' && current.delivered !== undefined)
    || (current.state === 'NEEDS_REVIEW' && current.delivered !== undefined)
  if (!legalSource) {
    throw new Error(`workflow-execution: refusing stale_superseded for nodeVisit ${nodeVisitId.toLowerCase()} — source state=${current.state} phase=${current.phase} has no stale-supersession evidence`)
  }
  return { kind: 'stale_superseded', observedWorkflowStateVersion }
}
