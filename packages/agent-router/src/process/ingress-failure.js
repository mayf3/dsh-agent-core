/** Classify ingress failures from bounded route and recovery evidence. */
import { ROUTE_HOP_FAILURE_CLASSES } from '../route-chain.js'
const PROVEN_NO_ADMISSION_ROUTE_FAILURES = new Set([
  ROUTE_HOP_FAILURE_CLASSES.SPAWN_FAILED_WITHOUT_CHILD,
  ROUTE_HOP_FAILURE_CLASSES.INITIALIZE_PROVIDER_UNAVAILABLE,
  ROUTE_HOP_FAILURE_CLASSES.SESSION_CREATE_RESUME_REJECTION,
  ROUTE_HOP_FAILURE_CLASSES.TURNQUEUE_NOT_ADMITTED,
])
export function classifyFailureStage(error, turnStarted) {
  if (!turnStarted) return 'admission'
  if (error?.status === 'not_admitted' || error?.envelope === 'not_admitted') return 'admission'
  if (error?.code === 'AGENT_ROUTE_CHAIN_DEADLINE_EXCEEDED'
      && error?.envelope === 'chain_deadline_exceeded') return 'admission'
  if (PROVEN_NO_ADMISSION_ROUTE_FAILURES.has(error?.routeChain?.failureClass)) return 'admission'
  return 'execution'
}
export function isRecoveryFenceResult(error) {
  return error?.status === 'outcome_unknown'
    || error?.envelope === 'outcome_unknown'
    || error?.code === 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN'
    || error?.code === 'AGENT_PROCESS_TURN_FENCED'
    || error?.code === 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED'
    || typeof error?.fencedBy === 'string'
}
