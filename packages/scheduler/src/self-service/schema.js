/**
 * Agent-facing Scheduler V2 access layer — wire schema + failure mapping face.
 *
 * AMENDMENT_3 C2 mechanical split from src/self-service.js: every body is
 * byte-verbatim; only module placement and import specifiers changed. This
 * module owns the snake_case argument decoding (expected_revision/schedule/
 * payload/delivery), the stable error-code vocabulary, and the exact
 * validation/mutation failure mapping.
 */

import { parseAtToMs } from '../schedule.js'

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

export function err(code, detail) {
  return { ok: false, error: { code, detail } }
}

export function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** Expected-revision wire shape -> op guard input (§5.1.4 compare-before-write). */
export function expectedRevisionFromArgs(args) {
  if (args.expected_revision === undefined) return undefined
  const raw = args.expected_revision
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)
    || !Number.isSafeInteger(raw.schedule_revision) || raw.schedule_revision < 1
    || !Number.isSafeInteger(raw.updated_at_ms) || raw.updated_at_ms < 1) {
    throw new TypeError('expected_revision must be {schedule_revision: integer >= 1, updated_at_ms: integer >= 1}')
  }
  return { scheduleRevision: raw.schedule_revision, updatedAtMs: raw.updated_at_ms }
}

function currentConversationDestination(context) {
  if (context?.channelNamespace !== 'feishu') return undefined
  const chatId = context.feishuChatId
  if (typeof chatId !== 'string' || chatId.length === 0 || chatId.trim() !== chatId || /\s/.test(chatId)) {
    return undefined
  }
  return { channel: 'feishu', to: `chat:${chatId}` }
}

export function scheduleFromArgs(args, nowMs) {
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

export function payloadForCreate(args) {
  return {
    kind: 'agentTurn',
    message: args.message,
    ...(args.timeout !== undefined ? { timeoutSeconds: args.timeout } : {}),
    ...(args.light_context !== undefined ? { lightContext: args.light_context } : {}),
    ...(args.model !== undefined ? { model: args.model } : {}),
  }
}

export function payloadPatch(current, args) {
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

export function deliveryFromArgs(args, context) {
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

export function validationFailure(error) {
  return err(
    error?.accessDenied === true ? SELF_SERVICE_ERROR_CODES.ACCESS_DENIED : SELF_SERVICE_ERROR_CODES.VALIDATION_ERROR,
    error instanceof Error ? error.message : String(error),
  )
}

export function mutationFailure(error) {
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
