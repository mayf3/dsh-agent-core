/**
 * Agent-facing Scheduler V2 access layer.
 *
 * Broker owns the closed action schema and passes validated snake_case action
 * arguments plus trusted, turn-scoped caller context. This module owns only
 * authorization, normalization, control-op reuse, committed projections, and
 * sanitized mutation audit evidence.
 */

import { createHash } from 'node:crypto'

import {
  createJobOp,
  updateJobOp,
  enableJobOp,
  disableJobOp,
  deleteJobOp,
} from './control.js'
import { toPublicJob, cloneJob } from './job-model.js'
import { canonicalJSON } from './occurrence-model.js'
import { parseAtToMs } from './schedule.js'

export const SELF_SERVICE_ERROR_CODES = {
  INVALID_ARGUMENTS: 'invalid_arguments',
  ACCESS_DENIED: 'access_denied',
  JOB_NOT_FOUND: 'job_not_found',
  VALIDATION_ERROR: 'validation_error',
}

const MANAGE_ANY_SCOPE = 'scheduler.manage:any'
const SCHEDULER_RESOURCE = 'scheduler'

function err(code, detail) {
  return { ok: false, error: { code, detail } }
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function trustedCaller(context) {
  const callerAgentId = nonEmpty(context?.callerAgentId)
  if (callerAgentId === undefined
    || !Number.isSafeInteger(context?.processGeneration)
    || context.processGeneration < 1
    || nonEmpty(context?.turnExecutionId) === undefined) {
    return undefined
  }
  // Some gateway versions also carry the independently Router-bound agentId.
  // If present it must agree; a merged/forged context fails closed.
  if (context.agentId !== undefined && context.agentId !== callerAgentId) return undefined
  return callerAgentId
}

function currentConversationDestination(context) {
  if (context?.channelNamespace !== 'feishu') return undefined
  const chatId = context.feishuChatId
  if (typeof chatId !== 'string' || chatId.length === 0 || chatId.trim() !== chatId || /\s/.test(chatId)) {
    return undefined
  }
  return { channel: 'feishu', to: `chat:${chatId}` }
}

function definitionDigest(job) {
  if (job === undefined || job === null) return undefined
  const { state, ...definition } = cloneJob(job)
  return `sha256:${createHash('sha256').update(canonicalJSON(definition)).digest('hex')}`
}

function publicJobWithoutMessage(job) {
  const publicJob = toPublicJob(job)
  if (publicJob.payload && typeof publicJob.payload === 'object') {
    const { message, ...payload } = publicJob.payload
    publicJob.payload = payload
  }
  return publicJob
}

function occurrenceProjection(record, fences) {
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

function normalizedSchedule(schedule) {
  if (schedule.kind === 'cron') {
    return { kind: 'cron', expr: schedule.expr, timezone: schedule.tz }
  }
  if (schedule.kind === 'at') return { kind: 'at', at: schedule.at }
  return { kind: 'every', everyMs: schedule.everyMs }
}

function committedResult(job, auditStatus) {
  const nextRunAtMs = job.state?.nextRunAtMs
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

function scheduleFromArgs(args, nowMs) {
  if (args.schedule_kind === 'cron') {
    return { kind: 'cron', expr: args.cron_expr, tz: args.timezone }
  }
  if (args.schedule_kind === 'at') {
    const atMs = parseAtToMs(args.at, nowMs)
    if (atMs === null || atMs <= nowMs) {
      throw new TypeError('at must resolve to an instant later than the mutation timestamp')
    }
    return { kind: 'at', at: new Date(atMs).toISOString() }
  }
  if (args.schedule_kind === 'every') return { kind: 'every', everyMs: args.every_ms }
  throw new TypeError(`unsupported schedule_kind: ${String(args.schedule_kind)}`)
}

function payloadForCreate(args) {
  return {
    kind: 'agentTurn',
    message: args.message,
    ...(args.timeout !== undefined ? { timeoutSeconds: args.timeout } : {}),
    ...(args.light_context !== undefined ? { lightContext: args.light_context } : {}),
    ...(args.model !== undefined ? { model: args.model } : {}),
  }
}

function payloadPatch(current, args) {
  if (args.message === undefined && args.timeout === undefined
    && args.light_context === undefined && args.model === undefined) return undefined
  return {
    ...current,
    ...(args.message !== undefined ? { message: args.message } : {}),
    ...(args.timeout !== undefined ? { timeoutSeconds: args.timeout } : {}),
    ...(args.light_context !== undefined ? { lightContext: args.light_context } : {}),
    ...(args.model !== undefined ? { model: args.model } : {}),
  }
}

function deliveryFromArgs(args, context) {
  const mode = args.delivery_mode ?? 'none'
  if (mode !== 'announce') return { mode }
  if (args.delivery_target === 'current_conversation') {
    const destination = currentConversationDestination(context)
    if (destination === undefined) {
      throw Object.assign(new Error('current_conversation requires the exact active trusted Feishu chat context'), { accessDenied: true })
    }
    return { mode, ...destination, ...(args.best_effort === true ? { bestEffort: true } : {}) }
  }
  return { mode, ...args.destination, ...(args.best_effort === true ? { bestEffort: true } : {}) }
}

function validationFailure(error) {
  return err(
    error?.accessDenied === true ? SELF_SERVICE_ERROR_CODES.ACCESS_DENIED : SELF_SERVICE_ERROR_CODES.VALIDATION_ERROR,
    error instanceof Error ? error.message : String(error),
  )
}

/**
 * @param {object} opts
 * @param {import('./store.js').JobStore} opts.store
 * @param {(agentId:string, scope:string, resource:string)=>Promise<boolean>} [opts.assertGrant]
 * @param {(event:{operation:string,jobId:string})=>void} [opts.onAuditFailure]
 */
export function createSelfServiceSchedulerAccess({ store, assertGrant, onAuditFailure = () => {} }) {
  if (store === undefined || store === null) throw new TypeError('self-service: store is required')

  async function adminAuthorized(callerAgentId) {
    if (typeof assertGrant !== 'function') return false
    try {
      return await assertGrant(callerAgentId, MANAGE_ANY_SCOPE, SCHEDULER_RESOURCE) === true
    } catch {
      return false
    }
  }

  async function appendAudit(operation, { jobId, operatorAgentId, targetAgentId, before, after, nowMs }) {
    let status
    try {
      status = await store.appendRunEvent({
        ts: nowMs,
        action: 'self_service_mutation',
        operation,
        jobId,
        operatorAgentId,
        targetAgentId,
        ...(before !== undefined ? { beforeDigest: before } : {}),
        ...(after !== undefined ? { afterDigest: after } : {}),
      })
    } catch {
      status = { ok: false }
    }
    if (status?.ok === true) return 'appended'
    try { onAuditFailure({ operation, jobId }) } catch {}
    return 'append_failed'
  }

  function contextOrError(context, operation) {
    const caller = trustedCaller(context)
    return caller === undefined
      ? err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, `${operation}: trusted caller/process/turn context missing or inconsistent`)
      : caller
  }

  async function loadScopedJob(jobId, caller, requireAdmin) {
    const doc = await store.loadDoc({ force: true })
    const job = doc.jobs.find((candidate) => candidate.id === jobId)
    if (job === undefined) return { error: err(SELF_SERVICE_ERROR_CODES.JOB_NOT_FOUND, `no visible job with id ${jobId}`) }
    if (job.agentId !== caller && !(await requireAdmin())) {
      return { error: err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, `no visible job with id ${jobId}`) }
    }
    return { job, doc }
  }

  const handlers = {
    scheduler: {
      async create(args, context) {
        const caller = contextOrError(context, 'scheduler.create')
        if (typeof caller !== 'string') return caller
        let adminPromise
        const requireAdmin = () => (adminPromise ??= adminAuthorized(caller))
        if ((args.target_agent_id !== undefined || args.destination !== undefined) && !(await requireAdmin())) {
          return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, 'scheduler.manage:any grant required for explicit target or destination')
        }
        const targetAgentId = args.target_agent_id ?? caller
        const nowMs = Date.now()
        let schedule
        let delivery
        try {
          schedule = scheduleFromArgs(args, nowMs)
          delivery = deliveryFromArgs(args, context)
        } catch (error) {
          return validationFailure(error)
        }
        let created
        try {
          created = await createJobOp(store, {
            name: args.name,
            agentId: targetAgentId,
            enabled: true,
            schedule,
            payload: payloadForCreate(args),
            delivery,
            ...(args.delete_after_run !== undefined ? { deleteAfterRun: args.delete_after_run } : {}),
            ...(args.auto_retry === true ? { retry: { auto: true } } : {}),
          }, { nowMs })
        } catch (error) {
          return validationFailure(error)
        }
        const doc = await store.loadDoc({ force: true })
        const stored = doc.jobs.find((job) => job.id === created.id)
        const auditStatus = await appendAudit('create', {
          jobId: created.id,
          operatorAgentId: caller,
          targetAgentId: stored.agentId,
          after: definitionDigest(stored),
          nowMs,
        })
        return { ok: true, result: committedResult(stored, auditStatus) }
      },

      async list(args, context) {
        const caller = contextOrError(context, 'scheduler.list')
        if (typeof caller !== 'string') return caller
        if (args.all_agents === true && !(await adminAuthorized(caller))) {
          return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, 'scheduler.manage:any grant required for all_agents')
        }
        const doc = await store.loadDoc({ force: true })
        const jobs = doc.jobs
          .filter((job) => args.all_agents === true || job.agentId === caller)
          .map((job) => ({ ...publicJobWithoutMessage(job), fenced: doc.fences[job.id] !== undefined }))
        return { ok: true, result: { jobs } }
      },

      async runs(args, context) {
        const caller = contextOrError(context, 'scheduler.runs')
        if (typeof caller !== 'string') return caller
        let adminPromise
        const requireAdmin = () => (adminPromise ??= adminAuthorized(caller))
        if (args.all_agents === true && !(await requireAdmin())) {
          return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, 'scheduler.manage:any grant required for all_agents')
        }
        const doc = await store.loadDoc({ force: true })
        let visibleJobs = doc.jobs.filter((job) => args.all_agents === true || job.agentId === caller)
        if (args.job_id !== undefined) {
          const job = doc.jobs.find((candidate) => candidate.id === args.job_id)
          if (job === undefined) return err(SELF_SERVICE_ERROR_CODES.JOB_NOT_FOUND, `no visible job with id ${args.job_id}`)
          if (job.agentId !== caller && !(await requireAdmin())) {
            return err(SELF_SERVICE_ERROR_CODES.JOB_NOT_FOUND, `no visible job with id ${args.job_id}`)
          }
          visibleJobs = [job]
        }
        const visibleJobIds = new Set(visibleJobs.map((job) => job.id))
        const occurrences = doc.occurrences
          .filter((record) => visibleJobIds.has(record.jobId))
          .slice(-(args.limit ?? 10))
          .reverse()
          .map((record) => occurrenceProjection(record, doc.fences))
        return { ok: true, result: { occurrences } }
      },

      async update(args, context) {
        const caller = contextOrError(context, 'scheduler.update')
        if (typeof caller !== 'string') return caller
        let adminPromise
        const requireAdmin = () => (adminPromise ??= adminAuthorized(caller))
        const scoped = await loadScopedJob(args.job_id, caller, requireAdmin)
        if (scoped.error !== undefined) return scoped.error
        if ((args.target_agent_id !== undefined || args.destination !== undefined) && !(await requireAdmin())) {
          return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, 'scheduler.manage:any grant required for explicit target or destination')
        }
        const nowMs = Date.now()
        const patch = {}
        if (args.name !== undefined) patch.name = args.name
        if (args.target_agent_id !== undefined) patch.agentId = args.target_agent_id
        if (args.schedule_kind !== undefined) {
          try { patch.schedule = scheduleFromArgs(args, nowMs) } catch (error) { return validationFailure(error) }
        }
        const payload = payloadPatch(scoped.job.payload, args)
        if (payload !== undefined) patch.payload = payload
        if (args.delivery_mode !== undefined) {
          try { patch.delivery = deliveryFromArgs(args, context) } catch (error) { return validationFailure(error) }
        }
        if (args.delete_after_run !== undefined) patch.deleteAfterRun = args.delete_after_run
        if (args.auto_retry !== undefined) patch.retry = { auto: args.auto_retry }
        const before = definitionDigest(scoped.job)
        let updated
        try {
          updated = await updateJobOp(store, args.job_id, patch, { nowMs })
        } catch (error) {
          return validationFailure(error)
        }
        const doc = await store.loadDoc({ force: true })
        const stored = doc.jobs.find((job) => job.id === updated.id)
        const auditStatus = await appendAudit('update', {
          jobId: updated.id,
          operatorAgentId: caller,
          targetAgentId: stored.agentId,
          before,
          after: definitionDigest(stored),
          nowMs,
        })
        return { ok: true, result: committedResult(stored, auditStatus) }
      },

      async enable(args, context) {
        return mutateToggle('enable', args, context, enableJobOp)
      },

      async disable(args, context) {
        return mutateToggle('disable', args, context, disableJobOp)
      },

      async remove(args, context) {
        const caller = contextOrError(context, 'scheduler.remove')
        if (typeof caller !== 'string') return caller
        let adminPromise
        const scoped = await loadScopedJob(args.job_id, caller, () => (adminPromise ??= adminAuthorized(caller)))
        if (scoped.error !== undefined) return scoped.error
        const nowMs = Date.now()
        const before = definitionDigest(scoped.job)
        try {
          await deleteJobOp(store, args.job_id)
        } catch (error) {
          return validationFailure(error)
        }
        const auditStatus = await appendAudit('remove', {
          jobId: args.job_id,
          operatorAgentId: caller,
          targetAgentId: scoped.job.agentId,
          before,
          nowMs,
        })
        return { ok: true, result: { removed: true, jobId: args.job_id, auditStatus } }
      },
    },
  }

  async function mutateToggle(operation, args, context, controlOp) {
    const caller = contextOrError(context, `scheduler.${operation}`)
    if (typeof caller !== 'string') return caller
    let adminPromise
    const scoped = await loadScopedJob(args.job_id, caller, () => (adminPromise ??= adminAuthorized(caller)))
    if (scoped.error !== undefined) return scoped.error
    const nowMs = Date.now()
    const before = definitionDigest(scoped.job)
    let updated
    try {
      updated = await controlOp(store, args.job_id, { nowMs })
    } catch (error) {
      return validationFailure(error)
    }
    const doc = await store.loadDoc({ force: true })
    const stored = doc.jobs.find((job) => job.id === updated.id)
    const auditStatus = await appendAudit(operation, {
      jobId: updated.id,
      operatorAgentId: caller,
      targetAgentId: stored.agentId,
      before,
      after: definitionDigest(stored),
      nowMs,
    })
    return {
      ok: true,
      result: {
        jobId: stored.id,
        enabled: stored.enabled,
        nextRunAt: Number.isFinite(stored.state?.nextRunAtMs)
          ? new Date(stored.state.nextRunAtMs).toISOString()
          : null,
        auditStatus,
      },
    }
  }

  return { handlers }
}
