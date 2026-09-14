export const FEISHU_IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000
export const FEISHU_SAFE_RETRY_WINDOW_MS = 55 * 60 * 1000

export function buildIdempotentFeishuRequest(notificationKey, { receiveId, text }) {
  if (typeof notificationKey !== 'string' || !/^[0-9a-f]{64}$/.test(notificationKey)) throw new TypeError('notificationKey must be a sha256 hex digest')
  const url = new URL('https://open.feishu.cn/open-apis/im/v1/messages')
  url.searchParams.set('receive_id_type', 'chat_id')
  const providerIdempotencyKey = notificationKey.slice(0, 50)
  return {
    url,
    providerIdempotencyKey,
    body: {
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
      uuid: providerIdempotencyKey,
    },
  }
}

export function retryableOutboxIntents(state, { nowMs = Date.now(), ambiguousRetryWindowMs = FEISHU_SAFE_RETRY_WINDOW_MS } = {}) {
  return Object.values(state?.outbox ?? {}).filter((intent) => {
    if (['PENDING', 'FAILED'].includes(intent.delivery)) return true
    if (intent.delivery !== 'OUTCOME_UNKNOWN') return false
    return Number.isFinite(intent.firstDeliveryAttemptAt) && nowMs - intent.firstDeliveryAttemptAt <= ambiguousRetryWindowMs
  })
}

export function stableNotificationText(intent) {
  const label = intent.transitionKind === 'CLOSED_RECOVERED' ? 'RECOVERED'
    : intent.transitionKind === 'CLOSED_ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'NEW'
  return `Scheduler watchdog ${label} [${intent.incident.rootIdentity}] ${intent.incident.rootCauseClass} [notification-key:${intent.notificationKey}]`
}
