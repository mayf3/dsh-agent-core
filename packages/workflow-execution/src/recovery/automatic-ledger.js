import { staleObservation, validateObservationIdentity } from '../attempt-identity.js'

export const RECOVERY_RULE = 'accepted:AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1#CTR-EKRWAE-005'
const IDS = ['workflowInstanceId', 'nodeVisitId', 'dispatchIntentId', 'ownerPrincipalId']

export function recoveryIdentity(attempt) {
  return { ...Object.fromEntries(IDS.map(key => [key, attempt[key]])),
    expectedAttemptId: attempt.attemptId, expectedGeneration: attempt.generation ?? 1,
    requestId: attempt.attemptId, expectedRecoveryRevision: attempt.recoveryCheck?.revision ?? 0 }
}

export function matchesRecoveryTrigger(attempt, expected) {
  return attempt !== undefined && !staleObservation(attempt, expected)
    && IDS.every(key => expected[key] === attempt[key])
    && expected.requestId === attempt.attemptId
    && expected.expectedRecoveryRevision === (attempt.recoveryCheck?.revision ?? 0)
}

function validateCheck(current, event) {
  validateObservationIdentity(event)
  if (!matchesRecoveryTrigger(current, event) || current.state !== 'ACTIVE'
    || current.phase !== 'resolution_blocked'
    || !Number.isSafeInteger(event.atMs) || !Number.isSafeInteger(event.nextCheckAtMs)
    || event.nextCheckAtMs <= event.atMs || !Number.isSafeInteger(event.failures) || event.failures < 1
    || typeof event.result !== 'string' || event.result === ''
    || typeof event.triggerId !== 'string' || event.triggerId === '' || event.ruleRef !== RECOVERY_RULE) {
    throw new Error('workflow-execution: invalid automatic recovery responsibility')
  }
}

export function applyRecoveryCheck(current, event) {
  validateCheck(current, event)
  current.recoveryCheck = { revision: event.expectedRecoveryRevision + 1,
    nextCheckAtMs: event.nextCheckAtMs, failures: event.failures, lastResult: event.result,
    triggerId: event.triggerId, ruleRef: event.ruleRef,
    consumer: 'workflow_execution_due_poller', businessOutcome: 'UNKNOWN' }
}

/** Called ONLY from the scope-bound record port under FIFO/OwnerLock. */
export function recordRecoveryCheck(ledger, io, nodeVisitId, fields) {
  const current = io.attempt(nodeVisitId)
  const event = { ...fields, kind: 'recovery_checked', nodeVisitId, atMs: ledger.clock() }
  validateCheck(current, event)
  io.appendEvent(event)
  io.applyEvent(event)
  return { ...io.attempt(nodeVisitId) }
}

export function validateAutomaticAudit(current, authorization) {
  if (authorization === undefined) return
  if (authorization.kind !== 'automatic' || authorization.ruleRef !== RECOVERY_RULE
    || IDS.some(key => authorization[key] !== current[key])
    || authorization.attemptId !== current.attemptId || authorization.requestId !== current.attemptId
    || authorization.generation !== (current.generation ?? 1)
    || authorization.triggerId !== current.recoveryCheck?.triggerId
    || authorization.gateEvidence === null || typeof authorization.gateEvidence !== 'object') {
    throw new Error('workflow-execution: invalid automatic recovery audit')
  }
}
