/** CTR-R3/R5: local durable dead letters and independently countable failure events. */
import { randomUUID } from 'node:crypto'
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CATEGORIES = ['transport_death', 'caller_bound_exceeded', 'child_exit_without_outcome', 'other']

function recoveryBlock(error, reason) {
  if (error?.code === 'AGENT_PROCESS_TURN_FENCED') {
    return { code: error.code, reason: 'unresolved_turn_fence' }
  }
  if (error?.code !== 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED') return null
  return { code: error.code, reason: ['durable_store_invalid', 'durable_store_unavailable'].includes(reason)
    ? reason : 'recovery_startup_blocked' }
}

export function deliveryFailureCategory(error) {
  if (error?.deliveryPreparation || error?.transportFailure === 'connection_failure') return 'transport_death'
  if (error?.source === 'caller_wait_exceeded' || error?.source === 'turn_deadline_exceeded'
      || /DEADLINE|TIMEOUT/u.test(error?.code ?? '')) return 'caller_bound_exceeded'
  if (['AGENT_PROCESS_EXITED', 'AGENT_PROCESS_CHILD_EXITED'].includes(error?.code) || error?.source === 'child_exit_without_parsed_outcome'
      || error?.source === 'child_exit_without_outcome') return 'child_exit_without_outcome'
  return 'other'
}

export function createDeliveryFailureStore({ log, directory, alertThreshold = 3, windowMs = 300_000, now = Date.now }) {
  if (!Number.isSafeInteger(alertThreshold) || alertThreshold < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new TypeError('delivery alert threshold and window must be positive safe integers')
  }
  const counts = Object.fromEntries(CATEGORIES.map(category => [category, 0]))
  const recent = []
  let sequence = 0
  let windowStart = now()
  let windowCount = 0
  let alerts = 0
  function failure(error, coordinates) {
    const tsWallMs = now()
    if (tsWallMs - windowStart >= windowMs) {
      windowStart = tsWallMs
      windowCount = 0
    }
    const category = deliveryFailureCategory(error)
    const blocked = recoveryBlock(error, coordinates.reason)
    counts[category] += 1
    windowCount += 1
    const event = { kind: 'delivery_failure', tsWallMs, sequence: ++sequence, category,
      ...coordinates, ...blocked, categoryCount: counts[category], windowCount }
    recent.push(event)
    if (recent.length > 256) recent.shift()
    log.error?.(`delivery-failure ${JSON.stringify(event)}`)
    // A blocked request cannot reach the retry path: its static count threshold
    // is one. Transport failures retain the existing window/threshold policy.
    if (blocked !== null || windowCount % alertThreshold === 0) {
      alerts += 1
      log.error?.(`delivery-failure-alert ${JSON.stringify({ kind: 'delivery_failure_alert', tsWallMs,
        category, windowCount, threshold: blocked === null ? alertThreshold : 1, windowMs,
        agentId: coordinates.agentId, ...blocked })}`)
    }
    return category
  }
  function blocked(error, { agentId, reason } = {}) {
    const details = recoveryBlock(error, reason)
    if (details === null) return null
    return failure(error, { agentId: typeof agentId === 'string' && /^agt_[a-z0-9-]{1,124}$/u.test(agentId)
      ? agentId : null, ...details })
  }
  function deadLetter({ agentId, sessionId, message, opts, route, attempts, error }) {
    if (!directory) throw Object.assign(new Error('dead-letter directory unavailable'), { code: 'DEAD_LETTER_UNAVAILABLE' })
    const id = randomUUID()
    const record = { schemaVersion: 1, id, createdAtWallMs: now(), agentId, sessionId, message,
      routeRef: route.routeRef ?? null, transportAttempts: attempts,
      callerCorrelation: opts?.callerCorrelation ?? null,
      ingress: opts?.ingressContext === undefined ? null : {
        channelNamespace: opts.ingressContext.channelNamespace,
        channelConversationId: opts.ingressContext.channelConversationId,
        feishuMessageId: opts.ingressContext.feishuMessageId,
      },
      reconciliationHandle: error?.reconciliationHandle ?? null,
      category: deliveryFailureCategory(error), disposition: 'retry_exhausted_no_replay' }
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const fd = openSync(join(directory, `${id}.json`), 'wx', 0o600)
    try {
      writeFileSync(fd, JSON.stringify(record) + '\n', 'utf8')
      fsyncSync(fd)
    } finally { closeSync(fd) }
    const dirFd = openSync(directory, 'r')
    try { fsyncSync(dirFd) } finally { closeSync(dirFd) }
    return id
  }
  function get(id) {
    if (!directory || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(id)) {
      throw new TypeError('exact dead-letter id required')
    }
    return JSON.parse(readFileSync(join(directory, `${id}.json`), 'utf8'))
  }
  return { failure, blocked, deadLetter, get,
    snapshot: () => ({ counts: { ...counts }, alerts, windowCount, windowMs, recent: recent.map(row => ({ ...row })) }) }
}
