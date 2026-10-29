import { UUID_RE, AGENT_ID_RE, ATTEMPT_ID_RE } from './attempt-identity.js'
import { continuePlannedOwnerResume as continuePlannedOwnerResumeMutation } from './owner-assistance-resume-ledger.js'
import { buildStaleSupersededEvent } from './ledger-events.js'
import { normalizeProgressCheckpoint } from './progress.js'
const ESCALATION_REQUESTED_KIND = 'escalation_requested'

/**
 * PROGRESS_CHECKPOINT_V1: append thin execution-resume metadata for the
 * EXACT currently-delivered attempt. This is deliberately NOT a business
 * progress signal: it never changes state/phase/judgment and therefore
 * cannot reset stale-no-progress or trigger Workflow transitions/wakes.
 */
export async function recordProgressCheckpoint(ledger, io, { nodeVisitId, attemptId, reporterAgentId, sessionId, turnExecutionId, checkpoint }) {
  if (typeof nodeVisitId !== 'string' || !UUID_RE.test(nodeVisitId)) {
    throw new TypeError(`workflow-execution: progress nodeVisitId must be a UUID string (got ${JSON.stringify(nodeVisitId)})`)
  }
  if (typeof attemptId !== 'string' || !ATTEMPT_ID_RE.test(attemptId)) {
    throw new TypeError('workflow-execution: progress attemptId must be a ledger-minted wfeat-* id')
  }
  if (typeof reporterAgentId !== 'string' || !AGENT_ID_RE.test(reporterAgentId)) {
    throw new TypeError('workflow-execution: progress reporterAgentId must be an agt_* id')
  }
  if (sessionId !== undefined && (typeof sessionId !== 'string' || sessionId === '')) {
    throw new TypeError('workflow-execution: progress sessionId must be a non-empty string when provided')
  }
  if (turnExecutionId !== undefined && (typeof turnExecutionId !== 'string' || turnExecutionId === '')) {
    throw new TypeError('workflow-execution: progress turnExecutionId must be a non-empty string when provided')
  }
  const normalized = normalizeProgressCheckpoint(checkpoint)
  return ledger.mutate(() => {
    const current = io.attempt(nodeVisitId)
    if (current === undefined) {
      throw new Error(`workflow-execution: no attempt exists for nodeVisit ${nodeVisitId.toLowerCase()} — cannot record progress`)
    }
    if (current.state !== 'ACTIVE') io.terminalGuard(current, { kind: 'progress_checkpoint', nodeVisitId })
    if (current.phase !== 'run_delivered' || current.delivered === undefined) {
      throw new Error(`workflow-execution: progress requires an active delivered Run (phase=${current.phase})`)
    }
    if (current.attemptId !== attemptId) {
      return { committed: false, cause: 'stale_attempt', attempt: { ...current } }
    }
    if (current.delivered.agentId !== reporterAgentId) {
      return { committed: false, cause: 'reporter_mismatch', attempt: { ...current } }
    }
    if (sessionId !== undefined && current.delivered.sessionId !== sessionId) {
      return { committed: false, cause: 'session_mismatch', attempt: { ...current } }
    }
    const event = {
      kind: 'progress_checkpoint',
      nodeVisitId: nodeVisitId.toLowerCase(),
      attemptId,
      reporterAgentId,
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(turnExecutionId === undefined ? {} : { turnExecutionId }),
      checkpoint: normalized,
      atMs: ledger.clock(),
    }
    io.appendEvent(event)
    io.applyEvent(event)
    return { committed: true, attempt: { ...io.attempt(nodeVisitId) } }
  })
}

export async function recordReconciled(ledger, io, { nodeVisitId, expectedPhase, verdict, judgment, reason }) {
  if (verdict !== 'SETTLED' && verdict !== 'NEEDS_REVIEW') {
    throw new TypeError(`workflow-execution: reconciled verdict must be SETTLED | NEEDS_REVIEW (got ${JSON.stringify(verdict)})`)
  }
  if (typeof expectedPhase !== 'string' || expectedPhase === '') throw new TypeError('workflow-execution: reconciled expectedPhase is required')
  if (typeof judgment !== 'string' || judgment === '') throw new TypeError('workflow-execution: reconciled judgment is required')
  if (typeof reason !== 'string' || reason === '') throw new TypeError('workflow-execution: reconciled reason is required')
  return ledger.mutate(() => {
    const current = io.attempt(nodeVisitId)
    if (current === undefined) {
      throw new Error(`workflow-execution: no attempt exists for nodeVisit ${nodeVisitId.toLowerCase()} — beginAttemptIfAbsent first`)
    }
    if (current.state !== 'ACTIVE') io.terminalGuard(current, { kind: 'reconciled', nodeVisitId })
    if (current.phase !== expectedPhase) {
      return { committed: false, attempt: { ...current }, cause: 'attempt_changed' }
    }
    const record = io.recordForActive(nodeVisitId, (event) => {
      event.kind = 'reconciled'
      event.verdict = verdict
      event.judgment = judgment
      event.reason = reason
      return event
    })
    return { committed: true, ...record }
  })
}


/**
 * WORKFLOW_STALE_REENTRY_V1 CTR-SRE-002: settle ONE stale attempt as the
 * re-entry marker (terminal SETTLED / judgment 'stale_no_progress'). The
 * `expected` snapshot (state + phase + delivered.atMs) is the CAS guard:
 * two pollers may both probe stale, only the one whose snapshot still
 * matches the fresh replay wins; the loser gets { committed: false } —
 * never a double settlement, never a corrupt append.
 */
export async function recordStaleSuperseded(ledger, io, { nodeVisitId, expected, observedWorkflowStateVersion }) {
  if (expected === null || typeof expected !== 'object') throw new TypeError('workflow-execution: stale supersession expected snapshot is required')
  if (typeof expected.state !== 'string' || typeof expected.phase !== 'string') throw new TypeError('workflow-execution: stale supersession expected.state/phase are required')
  if (!Number.isInteger(expected.deliveredAtMs)) throw new TypeError('workflow-execution: stale supersession expected.deliveredAtMs must be an integer')
  return ledger.mutate(() => {
    const current = io.attempt(nodeVisitId)
    if (current === undefined) {
      throw new Error(`workflow-execution: no attempt exists for nodeVisit ${nodeVisitId.toLowerCase()} — beginAttemptIfAbsent first`)
    }
    const matches = current.state === expected.state
      && current.phase === expected.phase
      && current.delivered !== undefined
      && current.delivered.atMs === expected.deliveredAtMs
    if (!matches) {
      return { committed: false, attempt: { ...current }, cause: 'attempt_changed' }
    }
    const patch = buildStaleSupersededEvent(current, nodeVisitId, observedWorkflowStateVersion)
    const event = { nodeVisitId: nodeVisitId.toLowerCase(), atMs: ledger.clock(), ...patch }
    io.appendEvent(event)
    io.applyEvent(event)
    return { committed: true, attempt: { ...io.attempt(nodeVisitId) } }
  })
}


/**
 * WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-005: record the ONE escalation
 * fact per visit (append-only `escalation_requested` event). Idempotent:
 * an already-escalated visit yields { committed: false } WITHOUT appending
 * anything. Requires an existing terminal attempt — escalation rides the
 * attempt's own terminal evidence, never an ACTIVE attempt.
 */
export async function recordEscalationRequested(ledger, io, { nodeVisitId, reason, attemptCount, lastAttemptId, dispatchIntentId }) {
  if (typeof reason !== 'string' || reason === '') throw new TypeError('workflow-execution: escalation reason is required')
  return ledger.mutate(() => {
    const current = io.attempt(nodeVisitId)
    if (current === undefined) {
      throw new Error(`workflow-execution: no attempt exists for nodeVisit ${nodeVisitId.toLowerCase()} — escalation rides an existing attempt`)
    }
    if (current.state === 'ACTIVE') {
      throw new Error(`workflow-execution: refusing escalation_requested for nodeVisit ${nodeVisitId.toLowerCase()} — attempt is ACTIVE`)
    }
    if (current.escalation !== undefined) {
      return { committed: false, attempt: { ...current }, cause: 'already_escalated' }
    }
    const event = {
      kind: ESCALATION_REQUESTED_KIND,
      nodeVisitId: nodeVisitId.toLowerCase(),
      // The workflowInstanceId rides the event line (not the projection):
      // outbound projections (forum) key their thread resolution on it.
      workflowInstanceId: current.workflowInstanceId,
      atMs: ledger.clock(),
      reason,
      ...(Number.isInteger(attemptCount) ? { attemptCount } : {}),
      ...(typeof lastAttemptId === 'string' ? { lastAttemptId } : {}),
      ...(typeof dispatchIntentId === 'string' ? { dispatchIntentId } : {}),
    }
    io.appendEvent(event)
    io.applyEvent(event)
    return { committed: true, attempt: { ...io.attempt(nodeVisitId) } }
  })
}


export async function continuePlannedOwnerResume(ledger, io, nodeVisitId, verify, complete) {
  if (typeof nodeVisitId !== 'string' || !UUID_RE.test(nodeVisitId)) {
    throw new TypeError('workflow-execution: planned Owner-resume nodeVisitId must be a UUID')
  }
  if (typeof verify !== 'function' || typeof complete !== 'function') {
    throw new TypeError('workflow-execution: planned Owner-resume callbacks are required')
  }
  return ledger.mutate(async () => {
    const current = io.attempt(nodeVisitId)
    const result = await continuePlannedOwnerResumeMutation({
      current, verify, complete,
      recordDeliveryStarted: () => io.recordDeliveryStarted(nodeVisitId),
      recordRunDelivered: (fields) => io.recordRunDelivered(nodeVisitId, fields),
      recordDeliveryFailed: (reason) => io.recordDeliveryFailed(nodeVisitId, reason),
      recordResolutionBlocked: (code) => io.recordResolutionBlocked(nodeVisitId, code),
    })
    return { ...result, ...(result.resumed ? { attempt: { ...io.attempt(nodeVisitId) } } : {}) }
  })
}


/** V2 CTR-WAE-013: run ONE controlled-recovery dispatch ATOMICALLY — fresh
 *  replay under the lock, held across the whole entry-state dispatch (the
 *  same discipline as the admission completion callback). `record` exposes
 *  the locked-mutation appenders (pre-checked private paths — NO nested
 *  mutate, which would deadlock the FIFO chain), and `getAttempt` reads the
 *  live projection, so an interleaved caller can never split an E-check
 *  from its append: the whole dispatch is single-flight. */
export async function mutateWithRecord(ledger, io, nodeVisitId, fn) {
  return ledger.mutate(async () => {
    // The record seam is SCOPE-BOUND: the appenders die with the locked
    // callback (revoked in `finally`), so a captured closure can never
    // append after the OwnerLock/FIFO boundary — every post-callback call
    // fails loud instead of bypassing the serialization.
    let closed = false
    const guard = (call) => (...args) => {
      if (closed) throw new Error('workflow-execution: recovery mutation seam is closed (lock released)')
      return call(...args)
    }
    const record = {
      recoveryAuthorized: guard((authorityRef) => io.recordRecoveryAuthorized(nodeVisitId, authorityRef)),
      resolutionBlocked: guard((code) => io.recordResolutionBlocked(nodeVisitId, code)),
      deliveryStarted: guard(() => io.recordDeliveryStarted(nodeVisitId)),
      recoveryRefused: guard((authorityRef, refused) => io.recordRecoveryRefused(nodeVisitId, authorityRef, refused)),
      runDelivered: guard((fields) => io.recordRunDelivered(nodeVisitId, fields)),
      deliveryFailed: guard((reason) => io.recordDeliveryFailed(nodeVisitId, reason)),
    }
    try {
      return await fn(record, () => io.attempt(nodeVisitId))
    } finally {
      closed = true
    }
  })
}
