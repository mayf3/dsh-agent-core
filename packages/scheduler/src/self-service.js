/**
 * Agent-facing Scheduler V2 access layer.
 *
 * Broker owns the closed action schema and passes validated snake_case action
 * arguments plus trusted, turn-scoped caller context. This module owns only
 * authorization, normalization, control-op reuse, committed projections, and
 * sanitized mutation audit evidence.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  createOrReconcileJobOp,
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
  LOGICAL_KEY_CONFLICT: 'logical_key_conflict',
  STALE_TARGET_CONFLICT: 'stale_target_conflict',
  MUTATION_OUTCOME_UNKNOWN: 'mutation_outcome_unknown',
  INTERNAL_ERROR: 'internal_error',
}

// AMENDMENT_1 — CRITICAL_JOB_SELF_DISABLE_GUARD (accepted authority, PR #249):
// stable denial reason codes for the two fail-closed classes. Denials carry
// ZERO job/definition content and perform ZERO store mutation.
export const CRITICAL_GUARD_REASONS = {
  SELF_DISABLE: 'critical_job_self_disable',
  INVENTORY_UNAVAILABLE: 'critical_inventory_unavailable',
}

/** Expected-revision wire shape -> op guard input (§5.1.4 compare-before-write). */
function expectedRevisionFromArgs(args) {
  if (args.expected_revision === undefined) return undefined
  const raw = args.expected_revision
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)
    || !Number.isSafeInteger(raw.schedule_revision) || raw.schedule_revision < 1
    || !Number.isSafeInteger(raw.updated_at_ms) || raw.updated_at_ms < 1) {
    throw new TypeError('expected_revision must be {schedule_revision: integer >= 1, updated_at_ms: integer >= 1}')
  }
  return { scheduleRevision: raw.schedule_revision, updatedAtMs: raw.updated_at_ms }
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
  if (error?.code === 'LOGICAL_KEY_CONFLICT') {
    return err(
      SELF_SERVICE_ERROR_CODES.LOGICAL_KEY_CONFLICT,
      `logical key already bound to job ${error.existingJobId} with a different desired definition (differing: ${Array.isArray(error.differingFields) ? error.differingFields.join(', ') : 'unknown'})`,
    )
  }
  if (error?.code === 'STALE_TARGET_CONFLICT') {
    return err(SELF_SERVICE_ERROR_CODES.STALE_TARGET_CONFLICT, 'target job state moved past the expected revision; re-read and re-apply — zero write performed')
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

function ownershipGuard(callerAgentId, allowAny, captureCurrent) {
  return (current) => {
    if (!allowAny && current.agentId !== callerAgentId) {
      throw Object.assign(new Error('job ownership changed before mutation'), { code: 'SELF_SERVICE_ACCESS_DENIED' })
    }
    if (typeof captureCurrent === 'function') captureCurrent(cloneJob(current))
  }
}

/**
 * AMENDMENT_1 — CRITICAL_JOB_SELF_DISABLE_GUARD (accepted, PR #249): parse the
 * critical desired-state inventory (the reliability authority's frozen §5.4
 * manifest). Returns the Set of critical logicalKeys, or throws on any
 * unreadable/invalid/unsupported-version input (caller maps that to the
 * fail-closed `critical_inventory_unavailable` class). Read-only; no caching —
 * the inventory is consulted fresh at mutation time.
 */
export function parseCriticalInventory(raw) {
  const parsed = JSON.parse(raw)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('critical inventory must be an object')
  }
  if (parsed.version !== 1) throw new TypeError(`unsupported critical inventory version: ${String(parsed.version)}`)
  if (!Array.isArray(parsed.jobs)) throw new TypeError('critical inventory jobs must be an array')
  const logicalKeys = new Set()
  for (const entry of parsed.jobs) {
    if (entry === null || typeof entry !== 'object' || typeof entry.logicalKey !== 'string' || entry.logicalKey.trim() === '') {
      throw new TypeError('critical inventory job entry requires a non-empty logicalKey')
    }
    logicalKeys.add(entry.logicalKey)
  }
  return logicalKeys
}

/**
 * Pure guard decision (AMENDMENT_1): `null` = not blocked; otherwise the stable
 * denial reason. Only the SELF path (no manage:any proof) ever reaches this.
 * Identity is EXACTLY the job's persisted logicalKey against the inventory —
 * never name/substring/prompt. `inventory.state`:
 *   'unconfigured' → guard inert (no inventory provisioned in this deployment)
 *   'unavailable'  → configured but unreadable/invalid → FAIL_CLOSED for
 *                    disable/remove (critical_inventory_unavailable)
 *   'ok'           → exact match ⇒ critical_job_self_disable; absent ⇒ null
 */
export function evaluateCriticalJobGuard({ operation, logicalKey, inventory }) {
  if (operation !== 'disable' && operation !== 'remove') return null
  if (inventory.state === 'unconfigured') return null
  if (inventory.state === 'unavailable') return CRITICAL_GUARD_REASONS.INVENTORY_UNAVAILABLE
  if (inventory.logicalKeys.has(logicalKey)) return CRITICAL_GUARD_REASONS.SELF_DISABLE
  return null
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
 * @param {string} [opts.criticalInventoryPath]
 *     AMENDMENT_1 critical inventory source (read-only, re-read at every
 *     guarded mutation; never cached as authority). Unset ⇒ the guard is
 *     inert in this deployment (no critical inventory provisioned). Production
 *     provisiones SCHEDULER_DESIRED_STATE (same file the §5.4 watchdog reads).
 */
export function createSelfServiceSchedulerAccess({ store, assertGrant, onAuditFailure = () => {}, criticalInventoryPath = process.env.SCHEDULER_DESIRED_STATE }) {
  if (store === undefined || store === null) throw new TypeError('self-service: store is required')

  /**
   * Mutation-time critical-inventory read (AMENDMENT_1 A3): fresh, read-only,
   * zero caching. unconfigured ⇒ guard inert; any read/parse/version failure
   * on a CONFIGURED source ⇒ 'unavailable' (fail-closed, never fail-open).
   */
  function loadCriticalInventory() {
    if (criticalInventoryPath === undefined) return { state: 'unconfigured' }
    try {
      return { state: 'ok', logicalKeys: parseCriticalInventory(readFileSync(criticalInventoryPath, 'utf8')) }
    } catch {
      return { state: 'unavailable' }
    }
  }

  /**
   * T9 durable denial attribution (AMENDMENT_1): sanitized evidence-only event
   * on the EXISTING run-event ledger channel — whitelisted fields, zero
   * payload/credential bytes; best-effort exactly like mutation audit.
   */
  async function appendDenialAudit(operation, { jobId, operatorAgentId, reason }) {
    let status
    try {
      status = await store.appendRunEvent({
        ts: Date.now(),
        action: 'self_service_denied',
        operation,
        jobId,
        operatorAgentId,
        reason,
      })
    } catch {
      status = { ok: false }
    }
    if (status?.ok === true) return 'appended'
    try { onAuditFailure({ operation, jobId }) } catch {}
    return 'append_failed'
  }

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

  async function appendAudit(operation, { jobId, operatorAgentId, targetAgentId, before, after, nowMs, alreadyApplied }) {
    let status
    try {
      status = await store.appendRunEvent({
        ts: nowMs,
        action: 'self_service_mutation',
        operation,
        jobId,
        operatorAgentId,
        targetAgentId,
        ...(alreadyApplied === true ? { alreadyApplied } : {}),
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
        // Logical identity is REQUIRED on the agent-facing create surface
        // (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.1): it is the persisted
        // idempotency/reconcile anchor — name is never a basis.
        const logicalKey = nonEmpty(args.logical_key)
        if (logicalKey === undefined) {
          return err(SELF_SERVICE_ERROR_CODES.INVALID_ARGUMENTS, 'create requires logical_key (stable caller-provided logical identity)')
        }
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
        let alreadyApplied = false
        try {
          const reconciled = await createOrReconcileJobOp(store, {
            name: args.name,
            agentId: targetAgentId,
            enabled: true,
            logicalKey,
            schedule,
            payload: payloadForCreate(args),
            delivery,
            ...(args.delete_after_run !== undefined ? { deleteAfterRun: args.delete_after_run } : {}),
            ...(args.auto_retry === true ? { retry: { auto: true } } : {}),
          }, { nowMs })
          created = reconciled.job
          alreadyApplied = reconciled.outcome === 'already_applied'
        } catch (error) {
          if (error?.mutationOutcome === 'committed' && error.committedValue !== undefined) {
            // Post-commit fault: the store hands back the exact committed
            // mutateDoc value — createOrReconcileJobOp wraps { job, alreadyApplied }.
            const committed = error.committedValue
            created = toPublicJob(committed?.job ?? committed)
            alreadyApplied = committed?.alreadyApplied === true
          } else {
            return mutationFailure(error)
          }
        }
        const auditStatus = await appendAudit('create', {
          jobId: created.id,
          operatorAgentId: caller,
          targetAgentId: created.agentId,
          after: definitionDigest(created),
          nowMs,
          ...(alreadyApplied ? { alreadyApplied } : {}),
        })
        // The committed-result shape is an exact wire contract (relay strict
        // validation): an already-applied create answers with the EXISTING
        // job's committed projection — the outcome distinction lives in the
        // audit event, never as an extra result field.
        return { ok: true, result: committedResult(created, auditStatus) }
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
        let visible = doc.jobs.filter((job) => job.agentId === caller)
        // Exact-match read filters (canonical read-back §5.1.5): logical_key is
        // the reconcile anchor; job_id supports targeted read-back after a
        // lost mutation response. No fuzzy/name matching — ever.
        if (args.logical_key !== undefined) visible = visible.filter((job) => job.logicalKey === args.logical_key)
        if (args.job_id !== undefined) visible = visible.filter((job) => job.id === args.job_id)
        const jobs = visible
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
        let expectedRevision
        try {
          expectedRevision = expectedRevisionFromArgs(args)
        } catch (error) {
          return validationFailure(error)
        }
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
            expectedRevision,
            assertJob: ownershipGuard(caller, scoped.allowAny, (current) => { lockedBefore = current }),
            buildPatch: (current, basePatch) => {
              const effective = { ...basePatch }
              const payload = payloadPatch(current.payload, args)
              if (payload !== undefined) effective.payload = payload
              return effective
            },
          })
        } catch (error) {
          if (error?.mutationOutcome === 'committed' && error.committedValue !== undefined) {
            updated = toPublicJob(error.committedValue)
          } else {
            return mutationFailure(error)
          }
        }
        const auditStatus = await appendAudit('update', {
          jobId: updated.id,
          operatorAgentId: caller,
          targetAgentId: updated.agentId,
          before: definitionDigest(lockedBefore),
          after: definitionDigest(updated),
          nowMs,
        })
        return { ok: true, result: committedResult(updated, auditStatus) }
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
        // AMENDMENT_1 guard (SELF path only — allowAny proves scheduler.manage:any,
        // which keeps full remove authority; CRITICAL != IMMUTABLE). Zero store
        // mutation on denial; sanitized denial evidence per T9.
        if (!scoped.allowAny) {
          const reason = evaluateCriticalJobGuard({ operation: 'remove', logicalKey: scoped.job.logicalKey, inventory: loadCriticalInventory() })
          if (reason !== null) {
            const auditStatus = await appendDenialAudit('remove', { jobId: scoped.job.id, operatorAgentId: caller, reason })
            return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, `${reason}: critical jobs cannot be removed via self-service (zero mutation performed; evidence: ${auditStatus})`)
          }
        }
        const nowMs = Date.now()
        let expectedRevision
        try {
          expectedRevision = expectedRevisionFromArgs(args)
        } catch (error) {
          return validationFailure(error)
        }
        let lockedBefore
        try {
          await deleteJobOp(store, args.job_id, {
            expectedRevision,
            assertJob: ownershipGuard(caller, scoped.allowAny, (current) => { lockedBefore = current }),
          })
        } catch (error) {
          if (error?.mutationOutcome !== 'committed') return mutationFailure(error)
        }
        const auditStatus = await appendAudit('remove', {
          jobId: args.job_id,
          operatorAgentId: caller,
          targetAgentId: lockedBefore.agentId,
          before: definitionDigest(lockedBefore),
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
    // AMENDMENT_1 guard: disable (SELF path only — allowAny proves
    // scheduler.manage:any, which keeps full disable authority over critical
    // jobs; CRITICAL != IMMUTABLE, operator emergency stop preserved). Enable is
    // NOT guarded. Zero store mutation on denial; sanitized denial evidence (T9).
    if (operation === 'disable' && !scoped.allowAny) {
      const reason = evaluateCriticalJobGuard({ operation, logicalKey: scoped.job.logicalKey, inventory: loadCriticalInventory() })
      if (reason !== null) {
        const auditStatus = await appendDenialAudit(operation, { jobId: scoped.job.id, operatorAgentId: caller, reason })
        return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, `${reason}: critical jobs cannot be disabled via self-service (zero mutation performed; evidence: ${auditStatus})`)
      }
    }
    const nowMs = Date.now()
    let expectedRevision
    try {
      expectedRevision = expectedRevisionFromArgs(args)
    } catch (error) {
      return validationFailure(error)
    }
    let lockedBefore
    let updated
    try {
      updated = await controlOp(store, args.job_id, {
        nowMs,
        expectedRevision,
        assertJob: ownershipGuard(caller, scoped.allowAny, (current) => { lockedBefore = current }),
      })
    } catch (error) {
      if (error?.mutationOutcome === 'committed' && error.committedValue !== undefined) {
        updated = toPublicJob(error.committedValue)
      } else {
        return mutationFailure(error)
      }
    }
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
  }

  return { handlers }
}
