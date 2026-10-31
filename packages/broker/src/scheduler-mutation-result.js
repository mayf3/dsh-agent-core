/**
 * Trusted broker-side validation of scheduler mutation commit shapes
 * (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.2 strict result validation).
 *
 * Mechanical split from src/relay.js (file-line ceiling): the exact-key
 * committed-shape predicates for the five original mutations plus
 * clone_disabled (AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4_AMENDMENT1_
 * CLONE_DISABLED, DRAFT / PENDING_ACCEPTANCE) moved verbatim; only module
 * placement and import specifiers changed. A committed clone is ALWAYS
 * disabled with no due slot — an enabled result is a different definition
 * behind the key and stays unprovable.
 */

export function exactKeys(value, expected) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0')
}

export function nonEmpty(value) {
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

function validAuditStatus(value) {
  return value === 'appended' || value === 'append_failed' || value === 'reconciled'
}

const COMMITTED_FIELDS = [
  'auditStatus', 'autoRetry', 'deleteAfterRun', 'enabled',
  'exactPersistedDeliveryDestination', 'jobId', 'name', 'nextRunAt',
  'normalizedSchedule', 'targetAgentId', 'timezone',
]

export function validSchedulerMutationResult(operation, result) {
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
  if (operation === 'clone_disabled') {
    return exactKeys(result, COMMITTED_FIELDS)
      && nonEmpty(result.jobId)
      && nonEmpty(result.name)
      && result.enabled === false
      && result.nextRunAt === null
      && validSchedule(result.normalizedSchedule)
      && (result.normalizedSchedule.kind === 'cron'
        ? result.timezone === result.normalizedSchedule.timezone
        : result.timezone === null)
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

export { COMMITTED_FIELDS }
