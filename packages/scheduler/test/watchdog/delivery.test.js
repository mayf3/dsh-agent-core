import { test } from 'node:test'
import assert from 'node:assert/strict'

import { attemptNotificationDelivery, buildIdempotentFeishuRequest, deliveryRecoveryAction, feishuHistoryContainsNotification, providerIdempotencyKey, recoverNotificationDelivery, retryableOutboxIntents, stableNotificationText } from '../../src/watchdog/delivery.js'
import { compileIncidents } from '../../src/watchdog/incident-compiler.js'
import { markNotificationDelivery, updateIncidentState } from '../../src/watchdog/incident-lifecycle.js'

test('T21/T26 ambiguous transport replay keeps the exact key, payload, and downstream idempotency coordinate', () => {
  const [incident] = compileIncidents([{ class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' }]).incidents
  const opened = updateIncidentState({}, [incident], { nowMs: 1 })
  const key = opened.notifications[0].notificationKey
  const intent = opened.state.outbox[key]
  const text = stableNotificationText(intent)
  const beforeRequest = buildIdempotentFeishuRequest(key, { receiveId: 'ops', text })
  const before = { key, text, url: beforeRequest.url.toString(), providerKey: beforeRequest.providerIdempotencyKey, body: beforeRequest.body }
  const ambiguous = markNotificationDelivery(opened.state, key, 'OUTCOME_UNKNOWN', 2)
  const [retry] = retryableOutboxIntents(ambiguous, { nowMs: 3 })
  const retryText = stableNotificationText(retry)
  const afterRequest = buildIdempotentFeishuRequest(retry.notificationKey, { receiveId: 'ops', text: retryText })
  const after = { key: retry.notificationKey, text: retryText, url: afterRequest.url.toString(), providerKey: afterRequest.providerIdempotencyKey, body: afterRequest.body }
  assert.deepEqual(after, before)
  assert.equal(after.body.uuid, providerIdempotencyKey(key))
  assert.equal(Buffer.from(after.providerKey, 'base64url').toString('hex'), key)
  assert.ok(after.providerKey.length <= 50)
  assert.match(JSON.parse(after.body.content).text, new RegExp(key))
})

test('T26 attempt start is durable before I/O and delayed restart remains eligible for readback', () => {
  const [incident] = compileIncidents([{ class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' }]).incidents
  const opened = updateIncidentState({}, [incident], { nowMs: 1 })
  const key = opened.notifications[0].notificationKey
  const attempted = markNotificationDelivery(opened.state, key, 'OUTCOME_UNKNOWN', 2)
  assert.equal(attempted.outbox[key].firstDeliveryAttemptAt, 2)
  assert.equal(retryableOutboxIntents(attempted, { nowMs: 54 * 60 * 1000 })[0].notificationKey, key)
  assert.equal(retryableOutboxIntents(attempted, { nowMs: 56 * 60 * 1000 })[0].notificationKey, key)
})

test('T21 delivered intents are never retried; failed route keeps the same logical opening pending repair', () => {
  const [incident] = compileIncidents([{ class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' }]).incidents
  const opened = updateIncidentState({}, [incident], { nowMs: 1 })
  const key = opened.notifications[0].notificationKey
  assert.deepEqual(retryableOutboxIntents(markNotificationDelivery(opened.state, key, 'DELIVERED', 2)), [])
  assert.equal(retryableOutboxIntents(markNotificationDelivery(opened.state, key, 'FAILED', 2), { nowMs: 9_999_999 })[0].notificationKey, key)
  const ambiguous = markNotificationDelivery(opened.state, key, 'OUTCOME_UNKNOWN', 2)
  assert.equal(retryableOutboxIntents(ambiguous, { nowMs: 60 * 60 * 1000 })[0].notificationKey, key, 'ambiguous delivery remains eligible only for provider readback before resend')
})

test('T26 provider readback recognizes only the exact durable notification marker', () => {
  const key = 'a'.repeat(64)
  assert.equal(feishuHistoryContainsNotification([{ body: { content: `{"text":"[notification-key:${key}]"}` } }], key), true)
  assert.equal(feishuHistoryContainsNotification([{ body: { content: `{"text":"[notification-key:${'b'.repeat(64)}]"}` } }], key), false)
})

test('T26 crash recovery sends only after complete provider readback proves absence', () => {
  const intent = { delivery: 'OUTCOME_UNKNOWN' }
  assert.equal(deliveryRecoveryAction(intent, { providerAccepted: true, readbackComplete: true }), 'MARK_DELIVERED')
  assert.equal(deliveryRecoveryAction(intent, { providerAccepted: false, readbackComplete: true }), 'SEND')
  assert.equal(deliveryRecoveryAction(intent, { providerAccepted: false, readbackComplete: false }), 'HOLD')
  assert.equal(deliveryRecoveryAction({ delivery: 'PENDING' }, { readbackComplete: false }), 'SEND')
})

test('T26 transport adapter separates definitive rejection from ambiguous post-send loss', async () => {
  assert.equal(await attemptNotificationDelivery(async () => true), 'DELIVERED')
  assert.equal(await attemptNotificationDelivery(async () => { throw Object.assign(new Error('rejected'), { deliveryState: 'FAILED' }) }), 'FAILED')
  assert.equal(await attemptNotificationDelivery(async () => { throw new Error('connection lost after write') }), 'OUTCOME_UNKNOWN')
})

test('T26 recovered runner delivery reads back before any resend and preserves ambiguous outcomes', async () => {
  const intent = { delivery: 'OUTCOME_UNKNOWN' }
  let sends = 0
  assert.equal(await recoverNotificationDelivery(intent, { readback: async () => true, send: async () => { sends += 1 } }), 'DELIVERED')
  assert.equal(sends, 0)
  assert.equal(await recoverNotificationDelivery(intent, { readback: async () => false, send: async () => { sends += 1 } }), 'DELIVERED')
  assert.equal(sends, 1)
  assert.equal(await recoverNotificationDelivery(intent, { readback: async () => { throw new Error('incomplete history') }, send: async () => { sends += 1 } }), 'OUTCOME_UNKNOWN')
  assert.equal(sends, 1)
  assert.equal(await recoverNotificationDelivery(intent, {
    readback: async () => false,
    send: async () => { sends += 1; throw Object.assign(new Error('rejected'), { deliveryState: 'FAILED' }) },
  }), 'FAILED')
  assert.equal(sends, 2)
})

test('T21 W2 cannot claim a W1 outbox intent', () => {
  const state = { outbox: {
    a: { notificationKey: 'a', producer: 'w1', delivery: 'PENDING' },
    b: { notificationKey: 'b', producer: 'w2', delivery: 'PENDING' },
  } }
  assert.deepEqual(retryableOutboxIntents(state, { producer: 'w2' }).map((item) => item.notificationKey), ['b'])
})
