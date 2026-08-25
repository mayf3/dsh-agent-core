/**
 * @agent-core/scheduler — Agent Core Scheduler V2 (occurrence authority).
 *
 * Public surface:
 *   - Scheduler engine (V2 occurrence execution semantics + domain operations)
 *   - JobStore (single versioned state document v2: jobs/occurrences/fences,
 *     atomic persistence, v1->v2 upgrade + guarded rollback, run evidence log)
 *   - occurrence model (deterministic identity, record schema, state machine)
 *   - eligibility (due/next/retry computation from definition + ledger)
 *   - domain control ops (create/update/enable/disable/delete/submitOneShot/
 *     reconcileOccurrence — control-only)
 *   - job model (normalizeJob / toPublicJob)
 *   - schedule evaluation (cron/at/every + stagger)
 *   - injectable invocation + delivery seams + fakes
 *   - OpenClaw job import (definition-only mapping + guarded write)
 *
 * Zero Feishu SDK, zero distributed stack, zero Router/agent knowledge:
 * the engine talks to agents and channels exclusively through the injected
 * seams (src/seams.js).
 */

export { Scheduler, AGENT_TURN_SAFETY_TIMEOUT_MS, TIMEOUT_ERROR_TEXT } from './scheduler.js'
export { JobStore, STORE_VERSION } from './store.js'
export { normalizeJob, normalizeState, toPublicJob, cloneJob, DELIVERY_MODES, RUN_STATUSES } from './job-model.js'
export { computeNextRunAtMs, computePreviousRunAtMs, parseAtToMs, parseAbsoluteTimeMs, parseDurationMs, resolveCronStaggerMs, normalizeSchedule } from './schedule.js'
export { createFakeInvoker, createNoopInvoker, createRecordingDelivery, INVOKE_CONTRACT, DELIVER_CONTRACT } from './seams.js'
export {
  importOpenClawJobs, mapOpenClawJob, writeImportToStore,
} from './import-openclaw.js'
export {
  deriveOccurrenceId, deriveRunId, deriveNativeSessionId, computePayloadHash,
  canonicalJSON, canTransition, isTerminalState, isUnresolvedUnknown,
  buildOccurrenceRecord, applyTransition, rebuildFences, validateOccurrenceRecord,
  logicalCoordinates, OCCURRENCE_STATES, OCCURRENCE_KINDS,
} from './occurrence-model.js'
export {
  naturalCandidate, retryCandidate, computeNextRunAtMsV2, deriveJobStateSummary,
  latestTerminalOccurrence, hasNonTerminalOccurrence, retryChainLength,
  ONE_SHOT_RETRY_BACKOFF_MS, RECURRING_RETRY_BACKOFF_MS, DEFAULT_AT_CATCHUP_GRACE_MS,
} from './eligibility.js'
export {
  createJobOp, updateJobOp, enableJobOp, disableJobOp, deleteJobOp,
  submitOneShotOp, reconcileOccurrence,
} from './control.js'
