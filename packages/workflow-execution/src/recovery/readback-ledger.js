import { staleObservation, validateObservationIdentity } from '../attempt-identity.js'

const ID_FIELDS = ['workflowInstanceId', 'nodeVisitId', 'dispatchIntentId', 'ownerPrincipalId']
const CATEGORIES = ['settlement', 'baseline', 'version']
const RESULTS = ['scheduled', 'unavailable', 'still_current', 'revalidated', 'closed']
const CLOSURES = ['node_visit_no_longer_current', 'historical_participant', 'instance_terminal']

export function readbackCategory(attempt) {
  if (!attempt.delivered || attempt.state === 'SETTLED') return undefined
  if (attempt.readback?.status === 'pending') return attempt.readback.category
  if (attempt.judgment === 'settle_check_unavailable') return 'settlement'
  if ((attempt.state === 'ACTIVE' && attempt.phase === 'run_delivered'
    || attempt.judgment === 'run_ended_no_submission')
    && attempt.workflowStateVersionAtDispatch === undefined) return 'baseline'
  return undefined
}

export function readbackIdentity(attempt) {
  return { ...Object.fromEntries(ID_FIELDS.map(key => [key, attempt[key]])),
    expectedAttemptId: attempt.attemptId, expectedGeneration: attempt.generation ?? 1,
    requestId: attempt.delivered.requestId, agentId: attempt.delivered.agentId,
    expectedState: attempt.state, expectedPhase: attempt.phase,
    expectedReadbackRevision: attempt.readback?.revision ?? 0 }
}

function validateEvent(current, event) {
  validateObservationIdentity(event)
  if (!current?.delivered || current.state === 'SETTLED'
    || staleObservation(current, event)
    || ID_FIELDS.some(key => event[key] !== current[key])
    || event.requestId !== current.delivered.requestId || event.agentId !== current.delivered.agentId
    || event.expectedState !== current.state || event.expectedPhase !== current.phase
    || event.expectedReadbackRevision !== (current.readback?.revision ?? 0)
    || !CATEGORIES.includes(event.category) || !RESULTS.includes(event.result)
    || !Number.isSafeInteger(event.atMs) || !Number.isSafeInteger(event.observedAtMs)
    || event.observedAtMs > event.atMs || !Number.isSafeInteger(event.nextCheckAtMs)
    || event.nextCheckAtMs <= event.atMs || !Number.isSafeInteger(event.failures) || event.failures < 0
    || (event.result === 'closed' && !CLOSURES.includes(event.reason))
    || typeof event.reason !== 'string' || event.reason === '') {
    throw new Error('workflow-execution: invalid readback responsibility event')
  }
  if (event.observationBaseline !== undefined) {
    const sample = event.observationBaseline
    if (sample.kind !== 'late_current_read' || sample.source !== 'target_agent_instance_detail'
      || !Number.isSafeInteger(sample.version) || sample.version < 1 || sample.observedAtMs !== event.observedAtMs) {
      throw new Error('workflow-execution: invalid late readback sample')
    }
  }
}

/** Narrow terminal append exception: metadata and trusted visit closure only.
 * Never changes delivery/WAL, the original baseline, or any Router outcome. */
export function applyReadbackEvent(current, event) {
  validateEvent(current, event)
  current.readback = {
    category: event.category, consumer: 'workflow_execution_due_poller',
    status: event.result === 'closed' ? 'closed' : event.result === 'revalidated' ? 'revalidated' : 'pending',
    revision: event.expectedReadbackRevision + 1, nextCheckAtMs: event.nextCheckAtMs,
    failures: event.failures, lastResult: event.result, reason: event.reason,
    observedAtMs: event.observedAtMs, businessOutcome: 'UNKNOWN',
    ...(current.readback?.observationBaseline === undefined ? {} : { observationBaseline: current.readback.observationBaseline }),
    ...(event.observationBaseline === undefined ? {} : { observationBaseline: event.observationBaseline }),
    ...(event.result === 'revalidated' ? { consumer: 'existing_stale_reconciler' } : {}),
  }
  if (event.result === 'closed') {
    current.readback.priorVerdict = { state: current.state, judgment: current.judgment, reason: current.reason }
    current.state = 'SETTLED'
    current.judgment = 'business_commitment_observed'
    current.reason = event.reason
    // Visit closure is not a business outcome or authorship claim for the Run.
    current.readback.completedByThisRun = false
  }
}

export async function recordReadback(ledger, io, observation) {
  validateObservationIdentity(observation)
  return ledger.mutate(() => {
    const current = io.attempt(observation.nodeVisitId)
    if (!current) throw new Error('workflow-execution: readback without original attempt')
    const stale = staleObservation(current, observation)
    if (stale) return stale
    if (ID_FIELDS.some(key => current[key] !== observation[key])
      || current.state !== observation.expectedState || current.phase !== observation.expectedPhase
      || (current.readback?.revision ?? 0) !== observation.expectedReadbackRevision) {
      return { committed: false, cause: 'attempt_changed', attempt: { ...current } }
    }
    const event = { ...observation, kind: 'readback_checked', atMs: ledger.clock() }
    validateEvent(current, event)
    io.appendEvent(event)
    io.applyEvent(event)
    return { committed: true, attempt: { ...io.attempt(observation.nodeVisitId) } }
  })
}

/** Old terminal unavailable/missing-baseline events bootstrap without rewriting
 * their bytes. Oldest due first; postponement prevents one failed item starving
 * later ones. The per-pass candidate/read budget is finite and shared. */
export function listReadbackCandidates(ledger, limit, nowMs) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('workflow-execution: readback candidate limit must be positive and finite')
  return ledger.inspectFresh(attempts => attempts.filter(attempt => readbackCategory(attempt)
    && (attempt.readback?.nextCheckAtMs ?? 0) <= nowMs)
    .sort((a, b) => (a.readback?.nextCheckAtMs ?? 0) - (b.readback?.nextCheckAtMs ?? 0)
      || a.createdAtMs - b.createdAtMs || a.attemptId.localeCompare(b.attemptId))
    .slice(0, limit))
}
