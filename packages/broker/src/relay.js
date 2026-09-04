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

const SCHEDULER_MUTATIONS = new Set(['create', 'update', 'enable', 'disable', 'remove'])
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
  return value === 'appended' || value === 'append_failed'
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

function validDegradedMutationResult(result) {
  return exactKeys(result, ['jobId', 'mutationStatus', 'responseStatus'])
    && result.mutationStatus === 'committed'
    && result.responseStatus === 'degraded'
    && (result.jobId === null || nonEmpty(result.jobId))
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
      const ambiguousError = uncertainMutation
        ? {
            errorCode: 'mutation_outcome_unknown',
            detail: 'scheduler mutation response was lost; inspect current state before any manual retry',
          }
        : {
            errorCode: 'outcome_unknown',
            detail: 'parent_rpc_ambiguous: agent session send response was lost; do not retry automatically',
          }
      let envelope
      try {
        // Transport envelope from the parent RPC: { ok: true, result: <invoke> }.
        envelope = await requestFn({
          capabilityId: manifest.id,
          operation: op.name,
          args,
        })
      } catch (err) {
        if (uncertainMutation || uncertainSessionSend) return ambiguousError
        return { errorCode: 'invalid_arguments', detail: `broker relay failed: ${err instanceof Error ? err.message : String(err)}` }
      }
      const structuredTransport = exactKeys(envelope, ['ok', 'result']) && envelope.ok === true
      const parent = structuredTransport ? envelope.result : undefined
      // A degraded partial-success (known commit, degraded response) is a
      // STRUCTURED success: rewriting it to mutation_outcome_unknown would be
      // false and could induce a duplicate mutation. Mirrors the scheduler
      // self-service degradedCommittedResult shape.
      const structuredParentSuccess = parent?.ok === true
        && (!uncertainMutation || validSchedulerMutationResult(op.name, parent.result)
          || validDegradedMutationResult(parent.result))
        && (!uncertainSessionSend || validSessionSendResult(parent.result))
      const structuredParentFailure = uncertainMutation
        ? validSchedulerFailure(parent, manifest)
        : validDeclaredFailure(parent, manifest)
      if (uncertainMutation && !structuredParentSuccess && !structuredParentFailure) {
        return ambiguousError
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
