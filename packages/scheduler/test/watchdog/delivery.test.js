import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildIdempotentFeishuRequest, providerIdempotencyKey, retryableOutboxIntents, stableNotificationText } from '../../src/watchdog/delivery.js'
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

test('T26 attempt start is durable before I/O and bounds the crash-after-acceptance replay window', () => {
  const [incident] = compileIncidents([{ class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' }]).incidents
  const opened = updateIncidentState({}, [incident], { nowMs: 1 })
  const key = opened.notifications[0].notificationKey
  const attempted = markNotificationDelivery(opened.state, key, 'OUTCOME_UNKNOWN', 2)
  assert.equal(attempted.outbox[key].firstDeliveryAttemptAt, 2)
  assert.equal(retryableOutboxIntents(attempted, { nowMs: 54 * 60 * 1000 })[0].notificationKey, key)
  assert.deepEqual(retryableOutboxIntents(attempted, { nowMs: 56 * 60 * 1000 }), [])
})

test('T21 delivered intents are never retried; failed route keeps the same logical opening pending repair', () => {
  const [incident] = compileIncidents([{ class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' }]).incidents
  const opened = updateIncidentState({}, [incident], { nowMs: 1 })
  const key = opened.notifications[0].notificationKey
  assert.deepEqual(retryableOutboxIntents(markNotificationDelivery(opened.state, key, 'DELIVERED', 2)), [])
  assert.equal(retryableOutboxIntents(markNotificationDelivery(opened.state, key, 'FAILED', 2), { nowMs: 9_999_999 })[0].notificationKey, key)
  const ambiguous = markNotificationDelivery(opened.state, key, 'OUTCOME_UNKNOWN', 2)
  assert.deepEqual(retryableOutboxIntents(ambiguous, { nowMs: 60 * 60 * 1000 }), [], 'no blind replay after provider dedupe window')
})
