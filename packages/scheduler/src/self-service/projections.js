/**
 * Agent-facing Scheduler V2 access layer — committed projection face.
 *
 * AMENDMENT_3 C2 mechanical split from src/self-service.js: every body is
 * byte-verbatim; only module placement and import specifiers changed. This
 * module owns the definition digest, message-stripped public job, occurrence
 * projection, normalized schedule, and the exact 11-field committed result.
 */

import { createHash } from 'node:crypto'

import { toPublicJob, cloneJob } from '../job-model.js'
import { canonicalJSON } from '../occurrence-model.js'

export function definitionDigest(job) {
  if (job === undefined || job === null) return undefined
  const definition = cloneJob(job)
  // Control operations return toPublicJob(value). Strip that public projection
  // exactly as we strip stored `state`, leaving the persisted definition bytes.
  delete definition.state
  for (const key of [
    'nextRunAtMs', 'lastRunAtMs', 'lastStatus', 'lastRunStatus', 'lastDurationMs',
    'lastDeliveryStatus', 'lastError', 'consecutiveErrors',
  ]) delete definition[key]
  return `sha256:${createHash('sha256').update(canonicalJSON(definition)).digest('hex')}`
}

export function publicJobWithoutMessage(job) {
  const publicJob = toPublicJob(job)
  if (publicJob.payload && typeof publicJob.payload === 'object') {
    const { message, ...payload } = publicJob.payload
    publicJob.payload = payload
  }
  return publicJob
}

export function occurrenceProjection(record, fences) {
  return {
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    jobId: record.jobId,
    kind: record.kind,
    state: record.state,
    executionOutcome: record.executionOutcome,
    deliveryStatus: record.deliveryStatus,
    nominalScheduledAt: record.nominalScheduledAt,
    admittedAt: record.admittedAt,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    ...(record.lateSettlement !== undefined ? { lateSettlement: record.lateSettlement } : {}),
    fenceActive: fences?.[record.jobId] !== undefined,
  }
}

export function normalizedSchedule(schedule) {
  if (schedule.kind === 'cron') {
    return { kind: 'cron', expr: schedule.expr, timezone: schedule.tz }
  }
  if (schedule.kind === 'at') return { kind: 'at', at: schedule.at }
  return { kind: 'every', everyMs: schedule.everyMs }
}

export function committedResult(job, auditStatus) {
  const nextRunAtMs = job.state?.nextRunAtMs ?? job.nextRunAtMs
  const destination = job.delivery?.mode === 'announce'
    ? { channel: job.delivery.channel, to: job.delivery.to }
    : null
  return {
    jobId: job.id,
    name: job.name,
    enabled: job.enabled,
    normalizedSchedule: normalizedSchedule(job.schedule),
    timezone: job.schedule.kind === 'cron' ? job.schedule.tz : null,
    nextRunAt: Number.isFinite(nextRunAtMs) ? new Date(nextRunAtMs).toISOString() : null,
    targetAgentId: job.agentId,
    exactPersistedDeliveryDestination: destination,
    autoRetry: job.retry?.auto === true,
    deleteAfterRun: job.deleteAfterRun,
    auditStatus,
  }
}
