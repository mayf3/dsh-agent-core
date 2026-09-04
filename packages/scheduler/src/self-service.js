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
  MUTATION_OUTCOME_UNKNOWN: 'mutation_outcome_unknown',
  INTERNAL_ERROR: 'internal_error',
}

// AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2 (CTR-AUTH-002): the exact R8
// wire-proof mapping. Local predicates (scheduler.read:self /
// scheduler.manage:self / scheduler.manage:any) are Agent Core authorization
// outcomes, NOT token scopes, and never travel in an Auth request. Only these
// two exact wire scope literals may be requested, each with
// resource='scheduler'; neither implies the other, no alias, normalization,
// alternate spelling, or post-denial fallback exists.
const ADMIN_WIRE_SCOPE = 'scheduler.admin' // proves local scheduler.manage:any (cross-agent definition mutation/control/destination)
const AUDIT_WIRE_SCOPE = 'scheduler.audit' // proves global/foreign execution-history visibility only
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
  if (args.schedule_kind === 'every') return { kind: 'every', everyMs: args.every_ms, anchorMs: nowMs }
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

function mutationFailure(error) {
  if (error?.code === 'SELF_SERVICE_ACCESS_DENIED') {
    return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, 'job is not visible to the trusted caller')
  }
  if (error instanceof TypeError || error?.code === 'RESTORE_GATE_CLOSED') return validationFailure(error)
  if (error?.mutationOutcome === 'not_committed') {
    return err(SELF_SERVICE_ERROR_CODES.INTERNAL_ERROR, 'scheduler mutation failed before commit')
  }
  if (/^unknown job id:/u.test(error?.message ?? '')) {
    return err(SELF_SERVICE_ERROR_CODES.JOB_NOT_FOUND, 'job no longer exists')
  }
  return err(
    SELF_SERVICE_ERROR_CODES.MUTATION_OUTCOME_UNKNOWN,
    'scheduler mutation outcome is unknown; inspect current state before any manual retry',
  )
}

// A KNOWN commit must never surface as mutation_outcome_unknown (that code is
// reserved by CTR-FAIL-001 for genuinely unknown outcomes and would invite a
// duplicate mutation). When the store committed but the post-commit response
// could not be assembled (committedValue lost or projection failure), return
// this deterministic partial-success envelope instead; jobId is null when the
// committed definition bytes were not carried on the error, and the caller
// observes current state via scheduler.list.
function degradedCommittedResult(jobId) {
  return {
    ok: true,
    result: { mutationStatus: 'committed', responseStatus: 'degraded', jobId: jobId ?? null },
  }
}

// Recovery for a control-op error the store tagged as committed: with
// committedValue the exact committed projection is recoverable; without it the
// commit is still certain, so the envelope degrades instead of going unknown.
function recoverCommitted(error, jobIdIfKnown) {
  if (error?.mutationOutcome !== 'committed') return undefined
  if (error.committedValue !== undefined) return toPublicJob(error.committedValue)
  return degradedCommittedResult(jobIdIfKnown)
}

function isDegradedEnvelope(value) {
  return value?.result?.mutationStatus === 'committed' && value?.result?.responseStatus === 'degraded'
}

function ownershipGuard(callerAgentId, allowAny, captureCurrent) {
  return (current) => {
    if (!allowAny && current.agentId !== callerAgentId) {
      throw Object.assign(new Error('job ownership changed before mutation'), { code: 'SELF_SERVICE_ACCESS_DENIED' })
    }
    if (typeof captureCurrent === 'function') captureCurrent(cloneJob(current))
  }
}

/**
 * @param {object} opts
 * @param {import('./store.js').JobStore} opts.store
 * @param {(agentId:string, scope:'scheduler.admin'|'scheduler.audit', resource:'scheduler')=>Promise<boolean>} [opts.assertGrant]
 *     Exact external wire-proof seam (CTR-AUTH-002). `scope` is only the R8
 *     wire literal 'scheduler.admin' (cross-agent definition mutation/control/
 *     destination -> local scheduler.manage:any) or 'scheduler.audit'
 *     (runs(all_agents=true)/foreign history). Local colon-form labels are
 *     never requested.
 * @param {(event:{operation:string,jobId:string})=>void} [opts.onAuditFailure]
 */
export function createSelfServiceSchedulerAccess({ store, assertGrant, onAuditFailure = () => {} }) {
  if (store === undefined || store === null) throw new TypeError('self-service: store is required')

  /** Admin proof: exact (scheduler, scheduler.admin) — establishes local scheduler.manage:any only. */
  async function adminAuthorized(callerAgentId) {
    return externalProof(callerAgentId, ADMIN_WIRE_SCOPE)
  }

  /** Audit proof: exact (scheduler, scheduler.audit) — global/foreign history visibility only. */
  async function auditAuthorized(callerAgentId) {
    return externalProof(callerAgentId, AUDIT_WIRE_SCOPE)
  }

  /**
   * Exact external wire proof (CTR-AUTH-002). `wireScope` is exactly
   * 'scheduler.admin' or 'scheduler.audit' — never a colon-form local label.
   * Auth denial, error, or uncertainty fails closed to `false`.
   */
  async function externalProof(callerAgentId, wireScope) {
    if (typeof assertGrant !== 'function') return false
    try {
      return await assertGrant(callerAgentId, wireScope, SCHEDULER_RESOURCE) === true
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
    let doc
    try {
      doc = await store.loadDoc({ force: true })
    } catch {
      return { error: err(SELF_SERVICE_ERROR_CODES.INTERNAL_ERROR, 'scheduler store read failed before mutation') }
    }
    const job = doc.jobs.find((candidate) => candidate.id === jobId)
    if (job === undefined) return { error: err(SELF_SERVICE_ERROR_CODES.JOB_NOT_FOUND, `no visible job with id ${jobId}`) }
    const allowAny = job.agentId !== caller ? await requireAdmin() : false
    if (job.agentId !== caller && !allowAny) {
      return { error: err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, `no visible job with id ${jobId}`) }
    }
    return { job, doc, allowAny }
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
          created = recoverCommitted(error, null)
          if (created === undefined) return mutationFailure(error)
          if (isDegradedEnvelope(created)) return created
        }
        // Post-commit response assembly: any failure here must still report the
        // known commit, never an ambiguous outcome.
        try {
          const auditStatus = await appendAudit('create', {
            jobId: created.id,
            operatorAgentId: caller,
            targetAgentId: created.agentId,
            after: definitionDigest(created),
            nowMs,
          })
          return { ok: true, result: committedResult(created, auditStatus) }
        } catch {
          return degradedCommittedResult(created.id)
        }
      },

      async list(args, context) {
        const caller = contextOrError(context, 'scheduler.list')
        if (typeof caller !== 'string') return caller
        // CTR-AUTH-002: list(all_agents=true) is normatively unavailable — no
        // accepted global job-definition-read scope exists. Stable fail-closed
        // denial BEFORE any store read with ZERO Auth requests, regardless of
        // any admin/audit/local manage-any entitlement the caller may hold.
        if (args.all_agents === true) {
          return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, 'all_agents job-definition list is unavailable: no accepted global job-definition-read scope')
        }
        const doc = await store.loadDoc({ force: true })
        const jobs = doc.jobs
          .filter((job) => job.agentId === caller)
          .map((job) => ({ ...publicJobWithoutMessage(job), fenced: doc.fences[job.id] !== undefined }))
        return { ok: true, result: { jobs } }
      },

      async runs(args, context) {
        const caller = contextOrError(context, 'scheduler.runs')
        if (typeof caller !== 'string') return caller
        // CTR-AUTH-002: runs(all_agents=true) and foreign-job history require
        // exactly (scheduler, scheduler.audit); an admin proof alone is never
        // consulted for or substituted into this row. Self runs: zero Auth.
        let auditPromise
        const requireAudit = () => (auditPromise ??= auditAuthorized(caller))
        if (args.all_agents === true && !(await requireAudit())) {
          return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, 'scheduler.audit grant required for all_agents history')
        }
        const doc = await store.loadDoc({ force: true })
        let visibleJobs = doc.jobs.filter((job) => args.all_agents === true || job.agentId === caller)
        if (args.job_id !== undefined) {
          const job = doc.jobs.find((candidate) => candidate.id === args.job_id)
          if (job === undefined) return err(SELF_SERVICE_ERROR_CODES.JOB_NOT_FOUND, `no visible job with id ${args.job_id}`)
          if (job.agentId !== caller && !(await requireAudit())) {
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
        if (args.delivery_mode !== undefined) {
          try { patch.delivery = deliveryFromArgs(args, context) } catch (error) { return validationFailure(error) }
        }
        if (args.delete_after_run !== undefined) patch.deleteAfterRun = args.delete_after_run
        if (args.auto_retry !== undefined) patch.retry = { auto: args.auto_retry }
        let lockedBefore
        let updated
        try {
          updated = await updateJobOp(store, args.job_id, patch, {
            nowMs,
            assertJob: ownershipGuard(caller, scoped.allowAny, (current) => { lockedBefore = current }),
            buildPatch: (current, basePatch) => {
              const effective = { ...basePatch }
              const payload = payloadPatch(current.payload, args)
              if (payload !== undefined) effective.payload = payload
              return effective
            },
          })
        } catch (error) {
          updated = recoverCommitted(error, args.job_id)
          if (updated === undefined) return mutationFailure(error)
          if (isDegradedEnvelope(updated)) return updated
        }
        // Post-commit response assembly: any failure here must still report the
        // known commit, never an ambiguous outcome.
        try {
          const auditStatus = await appendAudit('update', {
            jobId: updated.id,
            operatorAgentId: caller,
            targetAgentId: updated.agentId,
            before: definitionDigest(lockedBefore),
            after: definitionDigest(updated),
            nowMs,
          })
          return { ok: true, result: committedResult(updated, auditStatus) }
        } catch {
          return degradedCommittedResult(updated.id)
        }
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
        let lockedBefore
        try {
          await deleteJobOp(store, args.job_id, {
            assertJob: ownershipGuard(caller, scoped.allowAny, (current) => { lockedBefore = current }),
          })
        } catch (error) {
          if (error?.mutationOutcome !== 'committed') return mutationFailure(error)
        }
        // Post-commit response assembly: any failure here must still report the
        // known commit, never an ambiguous outcome.
        try {
          const auditStatus = await appendAudit('remove', {
            jobId: args.job_id,
            operatorAgentId: caller,
            targetAgentId: lockedBefore.agentId,
            before: definitionDigest(lockedBefore),
            nowMs,
          })
          return { ok: true, result: { removed: true, jobId: args.job_id, auditStatus } }
        } catch {
          return degradedCommittedResult(args.job_id)
        }
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
    let lockedBefore
    let updated
    try {
      updated = await controlOp(store, args.job_id, {
        nowMs,
        assertJob: ownershipGuard(caller, scoped.allowAny, (current) => { lockedBefore = current }),
      })
    } catch (error) {
      updated = recoverCommitted(error, args.job_id)
      if (updated === undefined) return mutationFailure(error)
      if (isDegradedEnvelope(updated)) return updated
    }
    // Post-commit response assembly: any failure here must still report the
    // known commit, never an ambiguous outcome.
    try {
      const auditStatus = await appendAudit(operation, {
        jobId: updated.id,
        operatorAgentId: caller,
        targetAgentId: updated.agentId,
        before: definitionDigest(lockedBefore),
        after: definitionDigest(updated),
        nowMs,
      })
      return {
        ok: true,
        result: {
          jobId: updated.id,
          enabled: updated.enabled,
          nextRunAt: Number.isFinite(updated.nextRunAtMs)
            ? new Date(updated.nextRunAtMs).toISOString()
            : null,
          auditStatus,
        },
      }
    } catch {
      return degradedCommittedResult(updated.id)
    }
  }

  return { handlers }
}
