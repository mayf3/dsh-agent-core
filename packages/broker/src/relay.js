/**
 * @agent-core/broker/src/relay.js — child-side broker RELAY (trusted
 * credential broker model).
 *
 * The per-agent DSH process holds NO credential and NO token. Every HTTP
 * capability tool registered in the child is executed as a RELAY:
 *
 *   model -> broker tool { operation, args } -> agentRpc.request(
 *     'agent-core/broker', { capabilityId, operation, args }) -> parent
 *
 * The parent (trusted Router / Broker boundary, authsvc/505) resolves the
 * caller from the ACTUAL spawning relationship (proc.agentId), reads the
 * MachineClient credential from the 505-private store, runs the existing
 * client_credentials -> JWT -> downstream pipeline, and returns the SAME
 * wire shape the local transport would have produced — so the model-visible
 * result is byte-identical to direct execution (ok/result or
 * ok:false/error{code,status,detail}).
 *
 * Envelope chain (two layers, both unwrapped here):
 *
 *   agentRpc.request -> { ok: true, result: <invoke shape> }   (transport)
 *   invoke shape     -> { ok: true, result } | { ok: false, error }  (business)
 *
 * The parent-RPC failure channel only carries a message string, so the
 * Router ALWAYS answers broker calls inside the success envelope and the
 * business envelope is delivered intact. A REJECTED transport (e.g. the
 * channel dying mid-call) is caught and fails closed with a descriptive
 * detail.
 *
 * The relay NEVER reads identity from the model or the args, NEVER attaches
 * an Authorization header, and NEVER sees a secret/token: the request body
 * is exactly { capabilityId, operation, args }.
 */

/**
 * The parent-RPC method the router dispatches to the trusted broker gateway.
 * Kept in sync with packages/agent-router/src/index.js (BROKER_RPC_METHOD).
 */
export const BROKER_RPC_METHOD = 'agent-core/broker'

/** Scheduler mutation operations subject to the outcome state machine
 *  (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.2). Exported for the child-side
 *  readiness mask (index.js): the same set is withheld from tool registration
 *  when this runtime has no credential provider configured. */
export const SCHEDULER_MUTATIONS = new Set(['create', 'update', 'enable', 'disable', 'remove'])
const COMMITTED_FIELDS = [
  'auditStatus', 'autoRetry', 'deleteAfterRun', 'enabled',
  'exactPersistedDeliveryDestination', 'jobId', 'name', 'nextRunAt',
  'normalizedSchedule', 'targetAgentId', 'timezone',
]

function exactKeys(value, expected) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0')
}

function validAuditStatus(value) {
  return value === 'appended' || value === 'append_failed' || value === 'reconciled'
}

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0
}

function validIso(value) {
  if (!nonEmpty(value)) return false
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}

function validSchedule(value) {
  if (value?.kind === 'at') return exactKeys(value, ['at', 'kind']) && validIso(value.at)
  if (value?.kind === 'every') {
    return exactKeys(value, ['everyMs', 'kind'])
      && Number.isSafeInteger(value.everyMs)
      && value.everyMs >= 1
  }
  return value?.kind === 'cron'
    && exactKeys(value, ['expr', 'kind', 'timezone'])
    && nonEmpty(value.expr)
    && nonEmpty(value.timezone)
}

function validDestination(value) {
  return value === null
    || (exactKeys(value, ['channel', 'to']) && nonEmpty(value.channel) && nonEmpty(value.to))
}

function validSchedulerFailure(parent, manifest) {
  if (!exactKeys(parent, ['error', 'ok']) || parent.ok !== false) return false
  const error = parent.error
  return exactKeys(error, ['code', 'detail'])
    && nonEmpty(error.code)
    && typeof error.detail === 'string'
    && manifest.errors.some((candidate) => candidate.code === error.code)
}

function validSchedulerMutationResult(operation, result) {
  if (operation === 'create' || operation === 'update') {
    return exactKeys(result, COMMITTED_FIELDS)
      && nonEmpty(result.jobId)
      && nonEmpty(result.name)
      && typeof result.enabled === 'boolean'
      && validSchedule(result.normalizedSchedule)
      && (result.normalizedSchedule.kind === 'cron'
        ? result.timezone === result.normalizedSchedule.timezone
        : result.timezone === null)
      && (result.nextRunAt === null || validIso(result.nextRunAt))
      && (operation !== 'create' || (result.enabled === true && result.nextRunAt !== null))
      && nonEmpty(result.targetAgentId)
      && validDestination(result.exactPersistedDeliveryDestination)
      && typeof result.autoRetry === 'boolean'
      && typeof result.deleteAfterRun === 'boolean'
      && validAuditStatus(result.auditStatus)
  }
  if (operation === 'enable' || operation === 'disable') {
    return exactKeys(result, ['auditStatus', 'enabled', 'jobId', 'nextRunAt'])
      && nonEmpty(result.jobId)
      && typeof result.enabled === 'boolean'
      && (result.nextRunAt === null || validIso(result.nextRunAt))
      && validAuditStatus(result.auditStatus)
  }
  return operation === 'remove'
    && exactKeys(result, ['auditStatus', 'jobId', 'removed'])
    && result.removed === true
    && nonEmpty(result.jobId)
    && validAuditStatus(result.auditStatus)
}

function validSessionSendResult(result) {
  if (result?.status === 'accepted' || result?.status === 'timeout') {
    return exactKeys(result, ['status'])
  }
  return result?.status === 'replied'
    && exactKeys(result, ['reply', 'status'])
    && typeof result.reply === 'string'
    && result.reply.length > 0
}

function validDeclaredFailure(parent, manifest) {
  return parent?.ok === false
    && parent.error !== null
    && typeof parent.error === 'object'
    && typeof parent.error.code === 'string'
    && manifest.errors.some((candidate) => candidate.code === parent.error.code)
}

/**
 * Canonical read-back + synthetic committed result after a lost mutation
 * response (outcome state machine §5.2). The child relay is one of the TWO
 * unknown capture points: a raw `mutation_outcome_unknown` must NEVER reach
 * the model as a terminal state when the identity allows a read-back.
 *
 *   create   (logical_key)          -> found+matches: APPLIED (synthetic result)
 *                                      absent: NOT_APPLIED (mutation_not_applied)
 *   update/enable/disable (job_id +
 *     expected_revision)            -> revision moved past expected: APPLIED
 *                                      unchanged/absent: NOT_APPLIED (a committed
 *                                      update/toggle never removes the target, so
 *                                      absence PROVES non-application; a retry then
 *                                      fails loud as job_not_found — the dangerous
 *                                      direction, a fabricated APPLIED, is never
 *                                      produced here)
 *   remove (job_id)                 -> absent: APPLIED; still present: NOT_APPLIED
 *   anything unprovable (no identity, read-back failure, projection mismatch)
 *                                   -> STILL_UNKNOWN with reconciliation evidence
 *                                   in the error detail AND persisted to
 *                                   SCHEDULER_RECONCILIATION_EVIDENCE_FILE (one
 *                                   JSON line: ts/operation/identity/reason) for
 *                                   the W1 watchdog alert surface (§5.2/§5.6).
 *
 * Known residual (documented, fail-loud): an `at` job with deleteAfterRun that
 * already executed deletes its definition, so its read-back is empty and the
 * reconcile reports NOT_APPLIED; the blind retry then fails LOUD (past `at` is
 * rejected) — a duplicate is still impossible (logical-key uniqueness).
 *
 * @returns {Promise<{ok:true, result:object}|{ok:false, error:{code:string, detail:string}}>}
 */
import { appendFileSync } from 'node:fs'

function persistReconciliationEvidence(entry) {
  const file = process.env.SCHEDULER_RECONCILIATION_EVIDENCE_FILE
  if (file === undefined || file === '') return
  try {
    appendFileSync(file, `${JSON.stringify({ ts: Date.now(), ...entry })}\n`)
  } catch { /* evidence is best-effort; the model still sees the detail */ }
}

async function reconcileAfterLostResponse(requestFn, operation, args) {
  const identity = args?.logical_key !== undefined
    ? { logicalKey: args.logical_key }
    : args?.job_id !== undefined ? { jobId: args.job_id } : {}
  const evidence = (reason) => JSON.stringify({ state: 'STILL_UNKNOWN', operation, ...identity, reason })
  const stillUnknown = (reason) => {
    const detail = `scheduler mutation outcome STILL_UNKNOWN after canonical read-back: ${evidence(reason)}`
    // §5.2/§5.6: STILL_UNKNOWN is never silent — the same evidence is persisted
    // (fire-and-forget) for the W1 watchdog alert surface.
    try {
      persistReconciliationEvidence({ operation, ...identity, reason })
    } catch { /* never let evidence persistence affect the answer */ }
    return { ok: false, error: { code: 'mutation_outcome_unknown', detail } }
  }
  const notApplied = () => ({
    ok: false,
    error: {
      code: 'mutation_not_applied',
      detail: 'canonical read-back proved the mutation never committed; a retry with the SAME logical identity is safe',
    },
  })
  const isoOrNull = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null)
  const committedFromJob = (job) => {
    const schedule = job.schedule ?? {}
    return {
      jobId: job.id,
      name: job.name,
      enabled: job.enabled,
      normalizedSchedule: schedule.kind === 'cron'
        ? { kind: 'cron', expr: schedule.expr, timezone: schedule.tz }
        : schedule.kind === 'at' ? { kind: 'at', at: schedule.at } : { kind: 'every', everyMs: schedule.everyMs },
      timezone: schedule.kind === 'cron' ? schedule.tz : null,
      nextRunAt: isoOrNull(job.nextRunAtMs),
      targetAgentId: job.agentId,
      exactPersistedDeliveryDestination: job.delivery?.mode === 'announce'
        ? { channel: job.delivery.channel, to: job.delivery.to }
        : null,
      autoRetry: job.retry?.auto === true,
      deleteAfterRun: job.deleteAfterRun === true,
      auditStatus: 'reconciled',
    }
  }
  const toggledFromJob = (job) => ({
    jobId: job.id,
    enabled: job.enabled,
    nextRunAt: isoOrNull(job.nextRunAtMs),
    auditStatus: 'reconciled',
  })

  // Read-back goes over the SAME trusted channel as the mutation, as the SAME
  // caller — list is visibility-scoped, so "absent" for a job_id target can
  // also mean invisible (kept as STILL_UNKNOWN; only remove treats absence as
  // applied, because the caller must have seen the job to request removal).
  let readBack
  try {
    const listArgs = args?.logical_key !== undefined
      ? { logical_key: args.logical_key }
      : { job_id: args?.job_id }
    const envelope = await requestFn({ capabilityId: 'scheduler', operation: 'list', args: listArgs })
    const structured = exactKeys(envelope, ['ok', 'result']) && envelope.ok === true
    readBack = structured && envelope.result?.ok === true ? envelope.result.result : undefined
  } catch {
    return stillUnknown('read-back transport failed')
  }
  if (readBack === undefined || !Array.isArray(readBack.jobs)) return stillUnknown('read-back response unusable')
  const [job] = readBack.jobs

  if (operation === 'create') {
    if (job === undefined) return notApplied()
    // Shallow sanity: the committed create must at least carry the requested
    // display name; anything else means the key is bound to a foreign shape.
    if (args?.name !== undefined && job.name !== args.name) return stillUnknown('logical key bound to a different definition')
    return { ok: true, result: committedFromJob(job) }
  }
  if (operation === 'remove') {
    if (job === undefined) return { ok: true, result: { removed: true, jobId: args.job_id, auditStatus: 'reconciled' } }
    return notApplied()
  }
  // update / enable / disable: deterministic with a compare anchor. Absence in
  // the caller-visible store PROVES non-application (a committed update/toggle
  // never removes the target); a retry then fails loud as job_not_found. The
  // dangerous direction — a fabricated APPLIED — is never produced here.
  if (args?.expected_revision === undefined) {
    return stillUnknown('no expected_revision anchor for a deterministic read-back')
  }
  if (job === undefined) return notApplied()
  const movedPast = job.scheduleRevision !== args.expected_revision.schedule_revision
    || job.updatedAtMs !== args.expected_revision.updated_at_ms
  if (!movedPast) return notApplied()
  return { ok: true, result: operation === 'update' ? committedFromJob(job) : toggledFromJob(job) }
}

/**
 * Build per-operation relay handlers for one HTTP capability manifest.
 *
 * Each handler forwards the call to the parent and UNWRAPS the parent's wire
 * shape back into the local `invoke` conventions:
 *
 *   parent { ok: true, result }   -> return result
 *   parent { ok: false, error }   -> return { errorCode, status, detail }
 *
 * so the child-side `invoke` (mapping.js) re-produces the identical final
 * envelope. A missing relay (no agentRpc service) fails closed with a
 * descriptive detail; the code is resolved through the manifest's declared
 * error table (fails closed to invalid_arguments otherwise).
 *
 * @param {object} manifest - validated capability manifest.
 * @param {(call: {capabilityId:string, operation:string, args:object}) =>
 *   Promise<{ok:boolean, result?:unknown, error?:{code:string, status?:number,
 *   detail?:string}}>} requestFn - the parent-RPC relay function.
 * @returns {Record<string, Function>} operationName -> handler.
 */
export function createRelayHandlers(manifest, requestFn) {
  const handlers = {}
  // LOCAL (in-process) capabilities relay exactly like HTTP-bound ones: the
  // parent's gateway executes them and answers in the same envelope shape,
  // so the child-side wire result is identical either way.
  const isLocalManifest = manifest?.local !== undefined
  for (const op of manifest.operations) {
    if (!op.http && !isLocalManifest) continue
    handlers[op.name] = async (_operation, args) => {
      const uncertainMutation = manifest.id === 'scheduler' && SCHEDULER_MUTATIONS.has(op.name)
      const uncertainSessionSend = manifest.id === 'agent_session_send' && op.name === 'send'
      const ambiguousError = {
        errorCode: 'outcome_unknown',
        detail: 'parent_rpc_ambiguous: agent session send response was lost; do not retry automatically',
      }
      // §5.2 outcome state machine (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1): a
      // lost scheduler-mutation response is NEVER a terminal raw unknown —
      // reconcile by stable identity first (APPLIED / NOT_APPLIED /
      // STILL_UNKNOWN-with-evidence). agent_session_send (outside this spec's
      // scope) keeps the pre-existing ambiguous envelope verbatim.
      const reconcileUnknown = uncertainMutation
        ? () => reconcileAfterLostResponse(requestFn, op.name, args).then((r) => {
            if (r.ok === true) return r.result
            return { errorCode: r.error.code, detail: r.error.detail }
          })
        : undefined
      let envelope
      try {
        // Transport envelope from the parent RPC: { ok: true, result: <invoke> }.
        envelope = await requestFn({
          capabilityId: manifest.id,
          operation: op.name,
          args,
        })
      } catch (err) {
        if (reconcileUnknown !== undefined) return reconcileUnknown()
        if (uncertainSessionSend) return ambiguousError
        return {
          errorCode: 'invalid_arguments',
          detail: `broker relay failed: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
      const structuredTransport = exactKeys(envelope, ['ok', 'result']) && envelope.ok === true
      const parent = structuredTransport ? envelope.result : undefined
      const structuredParentSuccess = parent?.ok === true
        && (!uncertainMutation || validSchedulerMutationResult(op.name, parent.result))
        && (!uncertainSessionSend || validSessionSendResult(parent.result))
      const structuredParentFailure = uncertainMutation
        ? validSchedulerFailure(parent, manifest)
        : validDeclaredFailure(parent, manifest)
      if (uncertainMutation && !structuredParentSuccess && !structuredParentFailure) {
        return reconcileUnknown()
      }
      if (uncertainSessionSend && !structuredParentSuccess && !structuredParentFailure) {
        return ambiguousError
      }
      if (parent && parent.ok === true) {
        // Unwrap: child-side invoke re-wraps as { ok: true, result }.
        return parent.result
      }
      const error = (parent && parent.error) || { code: 'invalid_arguments', detail: 'broker relay returned no result' }
      return {
        errorCode: typeof error.code === 'string' ? error.code : 'invalid_arguments',
        ...(typeof error.status === 'number' ? { status: error.status } : {}),
        ...(typeof error.detail === 'string' ? { detail: error.detail } : {}),
        // Downstream x-request-id travels the relay unchanged (null/absent
        // when the parent had none — never fabricated here either).
        ...(typeof error.requestId === 'string' && error.requestId.length > 0 ? { requestId: error.requestId } : {}),
      }
    }
  }
  return handlers
}
