import { DELIVERY_PROJECTION_VERSION } from './delivery-projection.js'

export { DELIVERY_PROJECTION_VERSION }

export const FEISHU_IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000
export const FEISHU_SAFE_RETRY_WINDOW_MS = 55 * 60 * 1000

export function providerIdempotencyKey(notificationKey) {
  if (typeof notificationKey !== 'string' || !/^[0-9a-f]{64}$/.test(notificationKey)) throw new TypeError('notificationKey must be a sha256 hex digest')
  return Buffer.from(notificationKey, 'hex').toString('base64url')
}

export function buildIdempotentFeishuRequest(notificationKey, { receiveId, text }) {
  if (typeof notificationKey !== 'string' || !/^[0-9a-f]{64}$/.test(notificationKey)) throw new TypeError('notificationKey must be a sha256 hex digest')
  const url = new URL('https://open.feishu.cn/open-apis/im/v1/messages')
  url.searchParams.set('receive_id_type', 'chat_id')
  const providerKey = providerIdempotencyKey(notificationKey)
  return {
    url,
    providerIdempotencyKey: providerKey,
    body: {
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
      uuid: providerKey,
    },
  }
}

export function retryableOutboxIntents(state, { producer } = {}) {
  return Object.values(state?.outbox ?? {}).filter((intent) => {
    if (producer !== undefined && intent.producer !== producer) return false
    const regressedPending = intent.delivery === 'PENDING'
      && (intent.firstDeliveryAttemptAt !== undefined || intent.deliveryUpdatedAt !== undefined)
    const attemptedWithoutEvidence = ['OUTCOME_UNKNOWN', 'DELIVERED'].includes(intent.delivery)
      && (!intent.deliveryBinding || !Number.isSafeInteger(intent.firstDeliveryAttemptAt))
    if (regressedPending || attemptedWithoutEvidence) {
      throw new TypeError('attempted notification intent requires immutable binding and firstDeliveryAttemptAt')
    }
    if (['PENDING', 'FAILED'].includes(intent.delivery)) return true
    return intent.delivery === 'OUTCOME_UNKNOWN'
  })
}

export function feishuHistoryContainsNotification(items, notificationKey) {
  const marker = `[notification-key:${notificationKey}]`
  return (items ?? []).some((item) => typeof item?.body?.content === 'string' && item.body.content.includes(marker))
}

export function deliveryRecoveryAction(intent, { providerAccepted, readbackComplete }) {
  if (intent?.delivery !== 'OUTCOME_UNKNOWN') return 'SEND'
  if (readbackComplete !== true) return 'HOLD'
  return providerAccepted === true ? 'MARK_DELIVERED' : 'SEND'
}

export async function attemptNotificationDelivery(send) {
  try { await send(); return 'DELIVERED' } catch (error) {
    return error?.deliveryState === 'FAILED' ? 'FAILED' : 'OUTCOME_UNKNOWN'
  }
}

export async function recoverNotificationDelivery(intent, { readback, send }) {
  if (intent?.delivery !== 'OUTCOME_UNKNOWN') return attemptNotificationDelivery(send)
  let providerAccepted
  try { providerAccepted = await readback() } catch { return 'OUTCOME_UNKNOWN' }
  const action = deliveryRecoveryAction(intent, { providerAccepted, readbackComplete: true })
  return action === 'MARK_DELIVERED' ? 'DELIVERED' : attemptNotificationDelivery(send)
}

const ROOT_CAUSE_SUMMARY = Object.freeze({
  RUN_STUCK_OUTCOME_UNKNOWN: 'run ended without a known outcome (same-job admission fenced)',
  RUN_STUCK: 'run stuck without finishing',
  RUN_FAILED: 'run failed',
  CONSECUTIVE_FAILURE: 'job failing repeatedly',
  EXPECTED_RUN_MISSED: 'expected scheduled run missed',
  SCHEDULER_RUNTIME_UNHEALTHY: 'scheduler runtime unhealthy',
  CREDENTIAL_PROVIDER_DEGRADED: 'scheduler credential provider degraded',
  SCHEDULER_WATCHDOG_FAILURE: 'scheduler watchdog W1 liveness failure',
  SCHEDULER_WATCHDOG_W2_FAILURE: 'scheduler watchdog W2 liveness failure',
  MUTATION_STILL_UNKNOWN: 'scheduler mutation outcome still unknown',
})

const OPEN_ACTIONS = Object.freeze({
  RUN_STUCK_OUTCOME_UNKNOWN: 'operator reconcile required to release the same-job admission fence',
  RUN_STUCK: 'watching for completion; reconcile the occurrence if it never terminates',
  RUN_FAILED: 'investigate the failed run; repeated failures aggregate into the job incident',
  CONSECUTIVE_FAILURE: 'automatic recovery monitoring active; investigate the failing job',
  EXPECTED_RUN_MISSED: 'watching for the next scheduled slot; investigate why the slot did not run',
  SCHEDULER_RUNTIME_UNHEALTHY: 'automatic recovery monitoring active; attributable occurrence alerts are recorded as evidence',
})

function incidentDeliveryText(intent) {
  const incident = intent.incident
  const label = intent.transitionKind === 'CLOSED_RECOVERED' ? 'RECOVERED'
    : intent.transitionKind === 'CLOSED_ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'OPEN'
  const fact = incident.facts?.[0] ?? {}
  const subject = incident.stableSubjectId
    ? `Subject: ${incident.stableSubjectId}`
    : `Agent: ${fact.agentId ?? 'unknown'}  Job: ${fact.logicalKey ?? 'unknown'} (${incident.jobId ?? 'unknown'})`
  const summary = ROOT_CAUSE_SUMMARY[incident.rootCauseClass] ?? incident.rootCauseClass
  const lines = [
    `Scheduler incident ${label} — ${summary}`,
    subject,
    `First detected: ${new Date(incident.firstSeenAt).toISOString()}`,
  ]
  if (label === 'OPEN') {
    const symptoms = Array.isArray(incident.symptoms) && incident.symptoms.length ? ` (also observed: ${incident.symptoms.join(', ')})` : ''
    lines.push(
      `Current state: ACTIVE${symptoms}`,
      `Action: ${OPEN_ACTIONS[incident.rootCauseClass] ?? 'automatic recovery monitoring active'}`,
    )
  } else {
    lines.push(
      `Current state: ${label} at ${new Date(incident.alertState.lastTransitionAt).toISOString()}`,
      'Recovery: resolved — no further action required for this incident',
    )
  }
  lines.push(`Evidence: ${incident.incidentId}`)
  lines.push(`[notification-key:${intent.notificationKey}]`)
  return lines.join('\n')
}

export function stableNotificationText(intent) {
  // Delivery-projection v2 intents carry the human-readable, action-oriented
  // text; pre-projection durable intents keep the exact frozen wire format so
  // existing immutable delivery bindings stay valid (durable-state re-derives
  // the payload from the intent alone on every load).
  if (intent?.incident?.deliveryProjection === DELIVERY_PROJECTION_VERSION) return incidentDeliveryText(intent)
  const label = intent.transitionKind === 'CLOSED_RECOVERED' ? 'RECOVERED'
    : intent.transitionKind === 'CLOSED_ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'NEW'
  return `Scheduler watchdog ${label} [${intent.incident.rootIdentity}] ${intent.incident.rootCauseClass} [notification-key:${intent.notificationKey}]`
}
