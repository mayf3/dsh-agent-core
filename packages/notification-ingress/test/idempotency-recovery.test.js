import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'

import { NotificationIdempotencyStore } from '../src/idempotency.js'
import {
  FORUM, STORE_URL, VALID_BODY, WORKFLOW, basic, deliver, makeRoot, mount, okFetch,
  readStoreDoc, recordOf, runCrashChild, stubRouter,
} from './idempotency-test-support.js'

// ── C-IDM-012 / AC-IDM-03 / F-13 — restart persistence (real kill -9) ─────

test('C-IDM-012 AC-IDM-03 F-13: delivered record survives a SIGKILLed process; same key reuses after restart', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'service', root.root)
  const { port } = rig.readMarker('ready')

  const first = await fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify(VALID_BODY),
  })
  assert.equal(first.status, 200)
  assert.equal((await first.json()).outcome, 'delivered')

  await rig.sigkill() // kill -9 with the record delivered

  // Reopen the authority: boot loads the delivered record untouched.
  const reopened = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  assert.equal(reopened.lookup(FORUM.clientId, VALID_BODY.requestId).state, 'delivered')

  // A fresh mount on the same store must REUSE the outcome, not re-deliver.
  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.duplicate, true)
  assert.equal(router.calls.length, 0)
  reopened.stop()
})

// ── C-IDM-009 / AC-IDM-04 / F-14 — crash windows W1..W4 ────────────────────

test('C-IDM-009 AC-IDM-04 F-14 W1: crash BEFORE the reserve commit -> no record -> clean retry delivers', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'w1', root.root)
  assert.equal(rig.readMarker('ready').phase, 'pre-reserve')
  await rig.sigkill()
  assert.equal(existsSync(root.storeFile), false, 'W1 leaves NO record — nothing was reserved')

  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.outcome, 'delivered', 'clean retry: a fresh delivery, no double-delivery risk')
  assert.equal(router.calls.length, 1)
})

test('C-IDM-009 AC-IDM-04 F-14 W2: crash AFTER reserve, BEFORE Router -> boot sweep -> outcome_unknown, no re-delivery', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'w2', root.root)
  assert.equal(rig.readMarker('ready').phase, 'reserved')
  assert.equal(recordOf(root)?.state, 'reserved')
  await rig.sigkill()

  // Reopen: boot sweep migrates the unresolved record to outcome_unknown.
  const reopened = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  const migrated = reopened.lookup(FORUM.clientId, VALID_BODY.requestId)
  assert.equal(migrated.state, 'outcome_unknown')
  assert.equal(migrated.outcomeUnknown.source, 'restart_unresolved')
  reopened.stop()

  // Same key through a fresh mount: reuse the unknown outcome, ZERO Router calls.
  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.outcome, 'outcome_unknown')
  assert.equal(retry.body.duplicate, true)
  assert.equal(router.calls.length, 0, 'no automatic re-delivery of a reserved record')
})

test('C-IDM-009 AC-IDM-04 F-14 W3: crash DURING the Router call (in-flight HTTP) -> restart sweep -> outcome_unknown', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'service-hang', root.root)
  const { port } = rig.readMarker('ready')

  // Fire a request whose Router call never settles, then SIGKILL mid-flight.
  const inflight = fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify(VALID_BODY),
  }).catch((error) => ({ killed: true, error: String(error) }))
  await new Promise((resolve) => setTimeout(resolve, 250)) // reserve committed + router hanging
  await rig.sigkill()
  await inflight

  // The durable state is `reserved` (admission unprovable).
  assert.equal(recordOf(root)?.state, 'reserved')

  const reopened = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  assert.equal(reopened.lookup(FORUM.clientId, VALID_BODY.requestId).state, 'outcome_unknown')
  reopened.stop()

  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.outcome, 'outcome_unknown')
  assert.equal(router.calls.length, 0)
})

test('C-IDM-009 AC-IDM-04 F-14 W4: Router ACCEPTED, crash BEFORE the terminal write -> outcome_unknown (no auto-completion)', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'w4', root.root)
  assert.equal(rig.readMarker('router-accepted').phase, 'router-returned-accepted')
  assert.equal(recordOf(root)?.state, 'reserved', 'accepted-but-unrecorded stays reserved on disk')
  await rig.sigkill()

  const reopened = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  const migrated = reopened.lookup(FORUM.clientId, VALID_BODY.requestId)
  assert.equal(migrated.state, 'outcome_unknown', 'W4: admission may have happened but is unprovable')
  assert.notEqual(migrated.state, 'delivered', 'never auto-completed to delivered')
  reopened.stop()

  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.outcome, 'outcome_unknown')
  assert.equal(router.calls.length, 0)
})
