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
    if (['PENDING', 'FAILED'].includes(intent.delivery)) return true
    return intent.delivery === 'OUTCOME_UNKNOWN' && Number.isFinite(intent.firstDeliveryAttemptAt)
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

export function stableNotificationText(intent) {
  const label = intent.transitionKind === 'CLOSED_RECOVERED' ? 'RECOVERED'
    : intent.transitionKind === 'CLOSED_ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'NEW'
  return `Scheduler watchdog ${label} [${intent.incident.rootIdentity}] ${intent.incident.rootCauseClass} [notification-key:${intent.notificationKey}]`
}
