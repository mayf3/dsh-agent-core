/**
 * Deterministic unit tests for the AgentProcess Delivery V0 admission seam
 * (packages/agent-router/src/process.js `deliver`) under
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-010/C-012:
 *
 *   accepted=true  <=>  the demo-server wrote the session/prompt receipt,
 *                       which it sends ONLY after agent.followup() enqueued
 *                       the message into the DSH native inbox. It NEVER
 *                       implies the model turn finished.
 *
 *   receipt deadline exceeded with admission unproven
 *     -> outcome_unknown carrier (thrown, with the reconciliation handle),
 *        a bounded late-receipt tombstone keeps exact messageId correlation
 *        alive for late reconciliation, and NO prompt is ever re-written.
 *
 * Drives the REAL AgentProcess class with a fake OS child
 * (helpers/fake-child.js): fully deterministic, event-driven.
 *
 * Covered:
 *   1. deliver resolves on the receipt alone — NO assistant event, NO
 *      session.status idle, NO turn/end; the envelope carries the handle;
 *   2. deliver during an in-flight turn() resolves immediately and never
 *      touches the turn's activeBindingContext (delivery has no channel);
 *   3. a dead child (no receipt) rejects via the receipt deadline as
 *      outcome_unknown (admission unproven), cleans the pending entry and
 *      fences nothing terminally on the deliver path (no kill — the
 *      DELIVER_TIMEOUT_USES_PROMPT_RECEIPT_FIELD ruling);
 *   4. a late receipt after the deadline cannot resolve the timed-out call,
 *      but IS correlated through the tombstone so reconciliation continues
 *      (late_completed once exact success+idle finally arrives).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx } from './helpers/fake-child.js'

const prompts = (fx) => fx.writes.filter((write) => write.method === 'session/prompt')

test('DLV1 deliver resolves on the receipt alone — no event, no idle, no turn/end', async () => {
  const fx = makeFx()
  await fx.readyNow()

  const pending = fx.proc.deliver('main', 'hello inbox', {}, 10000)
  assert.equal(prompts(fx).length, 1, 'one session/prompt written')
  assert.equal(prompts(fx)[0].params.sessionId, 'main')
  assert.deepEqual(prompts(fx)[0].params.contentBlocks, [{ type: 'text', text: 'hello inbox' }])

  // Resolve the receipt WITHOUT injecting any event or setting any status —
  // the session never becomes idle in this test.
  fx.respondTo('session/prompt', { messageId: 'm-42' })
  const result = await pending
  assert.equal(result.accepted, true)
  assert.equal(result.sessionId, 'main')
  assert.equal(result.messageId, 'm-42')
  assert.ok(Number.isFinite(result.ms))
  assert.equal(result.status, 'completed')
  assert.equal(typeof result.reconciliationHandle, 'string', 'receipt-only delivery still carries the handle')
  assert.equal(fx.proc.eventSeq, 0, 'resolved before ANY assistant event')
  assert.equal(fx.proc.status['main'], undefined, 'resolved while the session never went idle')
  assert.equal(fx.proc.activeBindingContext, undefined, 'deliver has no binding context')
})

test('DLV2 deliver during an in-flight turn resolves immediately and leaves the turn alone', async () => {
  const fx = makeFx()
  await fx.readyNow()

  // A turn is running (receipt resolved, terminal wait active, NOT idle).
  const turn = fx.proc.turn('main', 'turn-text', { bindingContext: 'binding-a' })
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-turn' })
  await fx.tick()

  // Now deliver while the turn is in flight: the receipt must come back
  // immediately — the delivery is NOT queued behind the turn.
  const started = Date.now()
  const delivery = fx.proc.deliver('main', 'fast-delivery', {}, 10000)
  assert.equal(prompts(fx).length, 2, 'the delivery prompt is written at once, not queued')
  fx.respondTo('session/prompt', { messageId: 'm-deliv' })
  const result = await delivery
  assert.ok(Date.now() - started < 5000, 'delivery resolved on the receipt, no turn wait')
  assert.equal(result.sessionId, 'main')
  assert.equal(fx.proc.activeBindingContext, 'binding-a', 'delivery must not disturb the turn\'s binding context')

  // The turn itself still completes normally afterwards.
  fx.completeTurn('main', 'm-turn', 'TURN-REPLY')
  const turnResult = await turn
  assert.equal(turnResult.reply, 'TURN-REPLY')
})

test('DLV3 a dead child (no receipt) rejects via the receipt deadline as outcome_unknown and cleans up', async () => {
  const fx = makeFx({ deadlines: { promptReceiptTimeoutMs: 150 } })
  await fx.readyNow()

  const started = Date.now()
  const pending = fx.proc.deliver('main', 'into-the-void', {}, 300)
  assert.equal(prompts(fx).length, 1)
  await assert.rejects(() => pending, (error) => {
    assert.equal(error.status, 'outcome_unknown')
    assert.equal(error.code, 'AGENT_PROCESS_PROMPT_RECEIPT_TIMEOUT')
    assert.equal(typeof error.reconciliationHandle, 'string')
    return true
  })
  assert.ok(Date.now() - started >= 140, 'rejected by the receipt deadline, not by any turn state')
  assert.equal(fx.pendingSize(), 0, 'the timed-out pending entry was removed')
  // Deliver-path receipt timeout is NOT a kill-worthy fatal (the child may
  // just be slow): no kill, registry-relevant state stays READY.
  assert.equal(fx.counts().killSignals, 0)
  assert.equal(fx.proc.state, 'READY')
  assert.equal(prompts(fx).length, 1, 'no automatic re-write of the prompt')
  assert.equal(fx.counts().replayAdmissions, 0)
})

test('DLV4 a late receipt after the deadline cannot resolve the timed-out call — but correlation continues', async () => {
  const fx = makeFx({ deadlines: { promptReceiptTimeoutMs: 100, turnTimeoutMs: 3000 } })
  await fx.readyNow()

  const pending = fx.proc.deliver('main', 'late-receipt', {}, 200)
  const write = prompts(fx)[0]
  let observed = null
  pending.catch((error) => { observed = error })
  await fx.sleep(150)
  assert.equal(observed?.status, 'outcome_unknown', 'timed-out delivery rejected as outcome_unknown')
  assert.equal(fx.pendingSize(), 0, 'the timed-out entry is gone')

  // A receipt that arrives after the deadline travels the real stdout path:
  // the caller is never re-settled, but the bounded tombstone correlates
  // the exact messageId so reconciliation continues.
  fx.emit({ id: write.id, result: { messageId: 'm-late' } })
  await fx.tick()
  assert.equal(fx.pendingSize(), 0)
  assert.equal(observed.status, 'outcome_unknown', 'late receipt never re-settles the caller')

  const handle = observed.reconciliationHandle
  assert.equal(fx.store.getTurnReconciliation(handle).state, 'pending')
  assert.equal(fx.store.getTurnReconciliation(handle).snapshot.initialOutcome, 'outcome_unknown')
  // Exact success + idle finally arrives -> late_completed, exposed through
  // the reconciliation handle (C-017/C-018).
  fx.completeTurn('main', 'm-late', 'LATE-DELIVERY-REPLY')
  await fx.tick()
  const settled = fx.store.getTurnReconciliation(handle)
  assert.equal(settled.state, 'settled')
  assert.equal(settled.snapshot.lateOutcome, 'late_completed')
  const output = fx.store.readFinalAssistantOutput(handle)
  assert.equal(output.state, 'available')
  assert.equal(output.text, 'LATE-DELIVERY-REPLY')
  assert.equal(prompts(fx).length, 1, 'no second prompt was ever written')
})
