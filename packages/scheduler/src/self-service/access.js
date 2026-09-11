/**
 * Agent-facing Scheduler V2 access layer — authorization, normalization,
 * control-op reuse, committed projections, and sanitized mutation audit.
 *
 * AMENDMENT_3 C2 mechanical split from src/self-service.js: every handler
 * body is byte-verbatim; only module placement, import specifiers, and the
 * guard plumbing (delegated to ./critical-job-guard.js) changed. Ownership is
 * composed first, then the critical assert; inventory loads stay eager for
 * disable/remove and absent for enable.
 */

import { readFileSync } from 'node:fs'

import {
  createOrReconcileJobOp,
  updateJobOp,
  enableJobOp,
  disableJobOp,
  deleteJobOp,
} from '../control.js'
import { toPublicJob } from '../job-model.js'
import { createCriticalJobGuard, ownershipGuard, DEFAULT_CRITICAL_INVENTORY_PATH } from './critical-job-guard.js'
import {
  SELF_SERVICE_ERROR_CODES,
  err,
  nonEmpty,
  expectedRevisionFromArgs,
  scheduleFromArgs,
  payloadForCreate,
  payloadPatch,
  deliveryFromArgs,
  validationFailure,
  mutationFailure,
} from './schema.js'
import {
  definitionDigest,
  publicJobWithoutMessage,
  occurrenceProjection,
  committedResult,
} from './projections.js'

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

/**
 * @param {object} opts
 * @param {import('../store.js').JobStore} opts.store
 * @param {(agentId:string, scope:'scheduler.admin'|'scheduler.audit', resource:'scheduler')=>Promise<boolean>} [opts.assertGrant]
 *     Exact external wire-proof seam (CTR-AUTH-002). `scope` is only the R8
 *     wire literal 'scheduler.admin' (cross-agent definition mutation/control/
 *     destination -> local scheduler.manage:any) or 'scheduler.audit'
 *     (runs(all_agents=true)/foreign history). Local colon-form labels are
 *     never requested.
 * @param {(event:{operation:string,jobId:string})=>void} [opts.onAuditFailure]
 * @param {string} [opts.criticalInventoryPath]
 *     AMENDMENT_1 critical inventory source. Resolution: explicit argument >
 *     SCHEDULER_DESIRED_STATE env > DEFAULT_CRITICAL_INVENTORY_PATH (the fixed
 *     accepted production path — an unset env NEVER disables the guard, Owner
 *     B1 repair 2026-09-10). Read-only, re-read fresh at every guarded
 *     mutation; unreadable/invalid ⇒ self-service disable/remove FAIL_CLOSED.
 * @param {(path:string)=>string} [opts.readInventoryFile]
 *     Test seam for the inventory read; production default is readFileSync.
 */
export function createSelfServiceSchedulerAccess({ store, assertGrant, onAuditFailure = () => {}, criticalInventoryPath = process.env.SCHEDULER_DESIRED_STATE ?? DEFAULT_CRITICAL_INVENTORY_PATH, readInventoryFile = (p) => readFileSync(p, 'utf8') }) {
  if (store === undefined || store === null) throw new TypeError('self-service: store is required')

  const criticalGuard = createCriticalJobGuard({ store, criticalInventoryPath, readInventoryFile, onAuditFailure })

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
        // AMENDMENT_1: classification runs on the LOCKED current job —
        // ownership first, then the critical assert (SELF path only — allowAny
        // proves scheduler.manage:any, CRITICAL != IMMUTABLE); the inventory
        // load inside guardFor stays eager, before the locked mutation.
        // Denial audit in catch.
        const ownership = ownershipGuard(caller, scoped.allowAny, (current) => { lockedBefore = current })
        const criticalAssert = criticalGuard.guardFor('remove', scoped.allowAny, (current) => { lockedBefore = current })
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
            assertJob: (current) => {
              ownership(current)
              criticalAssert(current)
            },
          })
        } catch (error) {
          if (error?.code === 'CRITICAL_SELF_MUTATION_DENIED') {
            const auditStatus = await criticalGuard.appendDenialAudit('remove', { jobId: scoped.job.id, operatorAgentId: caller, reason: error.reason })
            return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, `${error.reason}: critical jobs cannot be removed via self-service (zero mutation performed; evidence: ${auditStatus})`)
          }
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
    // AMENDMENT_1: classification runs on the LOCKED current job — ownership
    // first, then the critical assert (disable only; enable is NOT guarded and
    // loads no inventory; SELF path only — allowAny proves
    // scheduler.manage:any, CRITICAL != IMMUTABLE). Denial audit in catch.
    const ownership = ownershipGuard(caller, scoped.allowAny, (current) => { lockedBefore = current })
    const criticalAssert = operation === 'disable' ? criticalGuard.guardFor(operation, scoped.allowAny, (current) => { lockedBefore = current }) : undefined
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
        assertJob: criticalAssert === undefined
          ? ownership
          : (current) => {
            ownership(current)
            criticalAssert(current)
          },
      })
    } catch (error) {
      if (error?.code === 'CRITICAL_SELF_MUTATION_DENIED') {
        const auditStatus = await criticalGuard.appendDenialAudit(operation, { jobId: args.job_id, operatorAgentId: caller, reason: error.reason })
        return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, `${error.reason}: critical jobs cannot be disabled via self-service (zero mutation performed; evidence: ${auditStatus})`)
      }
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
