import { normalizeSchedule, parseAtToMs } from '../../scheduler/src/schedule.js'

const SCHEDULE_LEAVES = ['cron_expr', 'at', 'every_ms', 'timezone']
const DELIVERY_LEAVES = ['delivery_target', 'destination', 'best_effort']
const MUTABLE = [
  'name', 'schedule_kind', ...SCHEDULE_LEAVES, 'message', 'timeout',
  'light_context', 'model', 'delivery_mode', ...DELIVERY_LEAVES,
  'delete_after_run', 'auto_retry', 'target_agent_id',
]

const present = (args, key) => Object.hasOwn(args, key)
const presentAny = (args, keys) => keys.some((key) => present(args, key))

/** Trim every Scheduler string leaf after structural validation. */
function trimmedArgs(args) {
  const out = {}
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') out[key] = value.trim()
    else if (key === 'destination' && value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = Object.fromEntries(Object.entries(value).map(([nestedKey, nestedValue]) => [
        nestedKey,
        typeof nestedValue === 'string' ? nestedValue.trim() : nestedValue,
      ]))
    } else out[key] = value
  }
  return out
}

/**
 * Enforce Scheduler V1's exact cross-field conditions without touching a
 * credential, grant, handler, or store.
 */
export function validateSchedulerArguments(operation, rawArgs, { nowMs = Date.now() } = {}) {
  const args = trimmedArgs(rawArgs)
  const violations = []

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.length === 0) violations.push(`property "${key}" must not be empty or whitespace-only`)
  }
  if (args.destination) {
    for (const key of ['channel', 'to']) {
      if (typeof args.destination[key] === 'string' && args.destination[key].length === 0) {
        violations.push(`property "destination.${key}" must not be empty or whitespace-only`)
      }
    }
  }

  if (operation === 'update' && !presentAny(args, MUTABLE)) {
    violations.push('update requires at least one mutable property besides job_id')
  }

  const hasScheduleKind = present(args, 'schedule_kind')
  if (!hasScheduleKind && presentAny(args, SCHEDULE_LEAVES)) {
    violations.push('schedule leaves require schedule_kind')
  }
  if (hasScheduleKind) {
    const kind = args.schedule_kind
    const required = kind === 'cron' ? ['cron_expr', 'timezone'] : kind === 'at' ? ['at'] : kind === 'every' ? ['every_ms'] : []
    const forbidden = kind === 'cron' ? ['at', 'every_ms']
      : kind === 'at' ? ['cron_expr', 'every_ms', 'timezone']
        : kind === 'every' ? ['cron_expr', 'at', 'timezone'] : []
    for (const key of required) if (!present(args, key)) violations.push(`schedule_kind=${kind} requires ${key}`)
    for (const key of forbidden) if (present(args, key)) violations.push(`schedule_kind=${kind} forbids ${key}`)

    if (required.every((key) => present(args, key)) && forbidden.every((key) => !present(args, key))) {
      try {
        if (kind === 'cron') normalizeSchedule({ kind: 'cron', expr: args.cron_expr, tz: args.timezone }, { nowMs })
        if (kind === 'every') normalizeSchedule({ kind: 'every', everyMs: args.every_ms }, { nowMs })
      } catch (error) {
        violations.push(error instanceof Error ? error.message : String(error))
      }
      if (kind === 'at') {
        const atMs = parseAtToMs(args.at, nowMs)
        if (atMs === null) violations.push('at must be a valid relative duration or ISO instant')
        else if (atMs <= nowMs) violations.push('at must normalize to an instant later than the mutation timestamp')
      }
    }
  }

  const hasDeliveryMode = present(args, 'delivery_mode')
  if (!hasDeliveryMode && presentAny(args, DELIVERY_LEAVES)) {
    violations.push('delivery leaves require delivery_mode')
  }
  if (hasDeliveryMode) {
    if (args.delivery_mode === 'announce') {
      const targetCount = Number(present(args, 'delivery_target')) + Number(present(args, 'destination'))
      if (targetCount !== 1) violations.push('delivery_mode=announce requires exactly one of delivery_target or destination')
    } else if (presentAny(args, DELIVERY_LEAVES)) {
      violations.push(`delivery_mode=${args.delivery_mode} forbids delivery_target, destination, and best_effort`)
    }
  }

  return { violations, args }
}

function requireTrustedString(context, key, violations) {
  const value = context?.[key]
  if (typeof value !== 'string' || value.trim() === '') {
    violations.push(`trusted context ${key} is required`)
    return undefined
  }
  return value.trim()
}

/** Validate the Parent-owned identity/turn context before any local access. */
export function validateSchedulerTrustedContext(context, args) {
  const violations = []
  const callerAgentId = requireTrustedString(context, 'callerAgentId', violations)
  if (!Number.isSafeInteger(context?.processGeneration) || context.processGeneration < 1) {
    violations.push('trusted context processGeneration must be a positive safe integer')
  }
  requireTrustedString(context, 'turnExecutionId', violations)

  if (typeof context?.agentId !== 'string' || context.agentId.trim() === ''
    || context.agentId !== callerAgentId || context.callerAgentId !== callerAgentId) {
    violations.push('trusted context callerAgentId must exactly match the actual gateway agentId')
  }

  if (args.delivery_target === 'current_conversation') {
    if (context?.channelNamespace !== 'feishu') violations.push('current_conversation requires trusted channelNamespace=feishu')
    const chatId = context?.feishuChatId
    if (typeof chatId !== 'string' || chatId.length === 0 || chatId.trim() !== chatId || /\s/.test(chatId)) {
      violations.push('current_conversation requires an exact trusted feishuChatId')
    }
  }
  return violations
}
