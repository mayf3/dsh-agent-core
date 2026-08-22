/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 fault-injection suite —
 * prompt-receipt/turn deadline rows and the outcome_unknown fence admission
 * rules (C-012 / C-013 / C-014).
 *
 * Every test maps to one §10.3 table row and asserts its unique oracle
 * with the exact S/W/K/R counters and the R[...]/P[...]/F[...] snapshots.
 * Deterministic: the REAL AgentProcess class with a fake OS child
 * (helpers/fake-child.js).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx, firstHandle, prompts, rejectsWith, slotSeq } from './helpers.js'

// ---------------------------------------------------------------------------
// Prompt admission / correlation (C-010 / C-012) — deadline rows
// ---------------------------------------------------------------------------

test('PROMPT_RECEIPT_NEVER_REPLIES (turn path): receipt deadline -> unknown, fatal kill, exit settlement', async () => {
  const fx = makeFx({ deadlines: { promptReceiptTimeoutMs: 140 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'void', {}, 5000)
  await fx.tick()
  const observed = await rejectsWith(turn, (error) => {
    assert.equal(error.status, 'outcome_unknown')
    assert.equal(error.source, 'prompt_receipt_timeout')
  })
  // The unknown is queryable BEFORE the kill lands.
  assert.equal(fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot.initialOutcome, 'outcome_unknown')
  assert.equal(fx.counts().killSignals, 1, 'turn-path receipt timeout is fatal (kill)')
  fx.childExit(1, null)
  await fx.proc.exitPromise
  const snapshot = fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot
  assert.equal(snapshot.lateOutcome, 'terminated_without_outcome')
  assert.deepEqual(slotSeq(fx), ['casReap:g1', 'casEmpty:g1'])
  assert.equal(prompts(fx).length, 1, 'no second request was created')
})

test('DELIVER_TIMEOUT_USES_PROMPT_RECEIPT_FIELD: the config field is the binding receipt deadline', async () => {
  const fx = makeFx({ deadlines: { promptReceiptTimeoutMs: 180 } })
  await fx.readyNow()
  const started = Date.now()
  // A caller bound LARGER than the field must still be cut off by the field.
  await rejectsWith(fx.proc.deliver('main', 'field-bound', {}, 5000), (error) => {
    assert.equal(error.status, 'outcome_unknown')
  })
  const elapsed = Date.now() - started
  assert.ok(elapsed >= 170 && elapsed < 2000, `receipt deadline came from promptReceiptTimeoutMs (${elapsed}ms)`)
  assert.equal(fx.proc.state, 'READY', 'deliver-path timeout does not kill')
  assert.equal(fx.counts().killSignals, 0)
})

test('DELIVER_CANNOT_BYPASS_UNKNOWN_FENCE: a second deliver while unknown is not_admitted with write delta 0', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const first = fx.proc.deliver('main', 'first', {}, 60)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-f1' })
  await first
  // The first delivery's execution passes its turn deadline unresolved.
  await fx.sleep(180)
  assert.equal(fx.fence() !== false, true, 'unknown fence installed by the background watch')
  const beforeWrites = prompts(fx).length
  await rejectsWith(fx.proc.deliver('main', 'second', {}, 5000), (error) => {
    assert.equal(error.status, 'not_admitted')
    assert.equal(error.code, 'AGENT_PROCESS_TURN_FENCED')
  })
  assert.equal(prompts(fx).length, beforeWrites, 'second write delta = 0')
  // The ORIGINAL execution reconciles late through its handle.
  const handle = firstHandle(fx)
  fx.completeTurn('main', 'm-f1', 'FIRST-LATE')
  await fx.tick()
  assert.equal(fx.store.getTurnReconciliation(handle).snapshot.lateOutcome, 'late_completed')
  assert.equal(fx.fence(), false, 'exact termination released the fence')
})

// ---------------------------------------------------------------------------
// Turn deadline / outcome model (C-014..C-016) — fence admission
// ---------------------------------------------------------------------------

test('UNKNOWN_REJECTS_QUEUED_TURNS: B/C write delta 0; A late_completed', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turnA = fx.proc.turn('main', 'A', {}, 70)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  const turnB = fx.proc.turn('main', 'B', {})
  const turnC = fx.proc.turn('main', 'C', {})
  await fx.tick()
  await rejectsWith(turnA, error => assert.equal(error.status, 'outcome_unknown'))
  await rejectsWith(turnB, error => assert.equal(error.code, 'AGENT_PROCESS_TURN_FENCED'))
  await rejectsWith(turnC, error => assert.equal(error.code, 'AGENT_PROCESS_TURN_FENCED'))
  assert.equal(prompts(fx).length, 1, 'B/C write delta = 0')
  fx.completeTurn('main', 'm-a', 'A-LATE')
  await fx.tick()
  assert.equal(fx.store.getTurnReconciliation(firstHandle(fx)).snapshot.lateOutcome, 'late_completed')
})
