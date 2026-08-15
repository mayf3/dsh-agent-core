/**
 * @agent-core/scheduler — Agent Core Scheduler Replacement V1.
 *
 * Public surface:
 *   - Scheduler engine (execution semantics + domain operations)
 *   - JobStore (atomic JSON persistence + append-only run log)
 *   - job model (normalizeJob / toPublicJob)
 *   - schedule evaluation (cron/at/every + stagger)
 *   - injectable invocation + delivery seams + fakes
 *   - OpenClaw job import (lossless mapping + gap report)
 *
 * Zero Feishu SDK, zero distributed stack, zero Router/agent knowledge:
 * the engine talks to agents and channels exclusively through the injected
 * seams (src/seams.js).
 */

export { Scheduler, isRunnableJob, computeJobNextRunAtMs, isTransientError, errorBackoffMs, STUCK_RUN_MS } from './scheduler.js'
export { JobStore } from './store.js'
export { normalizeJob, normalizeState, toPublicJob, cloneJob, DELIVERY_MODES, SESSION_TARGETS } from './job-model.js'
export { computeNextRunAtMs, computePreviousRunAtMs, parseAtToMs, parseAbsoluteTimeMs, parseDurationMs, resolveCronStaggerMs, normalizeSchedule } from './schedule.js'
export { createFakeInvoker, createNoopInvoker, createRecordingDelivery, defaultSessionId, INVOKE_CONTRACT, DELIVER_CONTRACT } from './seams.js'
export { importOpenClawJobs, mapOpenClawJob } from './import-openclaw.js'
