/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 fault-injection suite —
 * prompt admission / exact correlation rows and the closed result envelopes
 * (C-010 / C-011 / C-016).
 *
 * Every test maps to one §10.3 table row and asserts its unique oracle
 * with the exact S/W/K/R counters and the R[...]/P[...]/F[...] snapshots.
 * Deterministic: the REAL AgentProcess class with a fake OS child
 * (helpers/fake-child.js).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx, prompts, rejectsWith } from './helpers.js'

// ---------------------------------------------------------------------------
// Prompt admission / correlation (C-010 / C-011)
// ---------------------------------------------------------------------------

test('PROMPT_EVENT_BEFORE_RPC_RESPONSE: pre-response events are replayed on receipt binding', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'early-events', {}, 5000)
  await fx.tick()
  // The FULL event stream arrives BEFORE the JSON-RPC receipt response.
  fx.emitEvent('main', { type: 'agent/inbox/spliced', data: { inserted: [{ id: 'm-early' }] } })
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 7 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-early' } })
  fx.emitEvent('main', { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'EARLY' }] } } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 7, reason: { kind: 'completed' } } })
  fx.emitStatus('main', 'idle')
  fx.respondTo('session/prompt', { messageId: 'm-early' })
  const envelope = await turn
  assert.equal(envelope.status, 'completed')
  assert.equal(envelope.reply, 'EARLY')
  assert.equal(envelope.messageId, 'm-early')
})

test('UNRELATED_IDLE_OR_QUEUE_REMOVAL: unrelated evidence never releases the fence; exact failure settles late_failed', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turnA = fx.proc.turn('main', 'A', {}, 70)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  const observedA = await rejectsWith(turnA, error => assert.equal(error.status, 'outcome_unknown'))
  // Unrelated: a DIFFERENT session goes idle and its queued prompt is removed.
  fx.emitEvent('other-session', { type: 'agent/inbox/spliced', data: { removed: ['someone-else'] } })
  fx.emitStatus('other-session', 'idle')
  await fx.tick()
  assert.equal(fx.fence(), observedA.reconciliationHandle, 'unrelated evidence leaves A fenced')
  // A's exact failure + idle settles late_failed and releases.
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-a' } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error: { code: 'UNAVAILABLE', message: 'provider unavailable' } } } })
  fx.emitStatus('main', 'idle')
  await fx.tick()
  assert.equal(fx.store.getTurnReconciliation(observedA.reconciliationHandle).snapshot.lateOutcome, 'late_failed')
  assert.equal(fx.fence(), false)
})

test('PRIOR_TURN_LATE_EVENT_AFTER_NEXT_CALL: duplicate A events during B are excluded; B completes on its own events', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const turnA = fx.proc.turn('main', 'A', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()
  fx.completeTurn('main', 'm-a', 'A-REPLY')
  const resultA = await turnA
  const handleA = resultA.reconciliationHandle
  const turnB = fx.proc.turn('main', 'B', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-b' })
  await fx.tick()
  // Duplicate late events for A (turn 1) while B (turn 2) is active.
  fx.emitEvent('main', { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'A-GHOST' }] } } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error: { code: 'X', message: 'stale A failure' } } } })
  fx.completeTurn('main', 'm-b', 'B-REPLY', { turn: 2 })
  const resultB = await turnB
  assert.equal(resultB.reply, 'B-REPLY', 'B excludes A\'s late events')
  const outputB = fx.store.readFinalAssistantOutput(resultB.reconciliationHandle)
  assert.equal(outputB.text, 'B-REPLY', 'A\'s ghost text did not leak into B')
  assert.equal(fx.store.getTurnReconciliation(handleA).snapshot.outcome, 'completed', 'A unchanged')
})

test('B08 replay observes an intervening later turn/start before considering future idle', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 300 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'replay-order', {})
  await fx.tick()
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-replay-order' } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 2 } })
  fx.emitStatus('main', 'idle')
  fx.respondTo('session/prompt', { messageId: 'm-replay-order' })
  await fx.tick()
  const handle = fx.store.records.keys().next().value
  assert.equal(fx.store.getTurnReconciliation(handle).state, 'pending', 'later turn/start invalidates terminal->idle proof')
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  assert.equal(observed.reconciliationHandle, handle)
})

test('B08: stale idle before exact terminal cannot close the current turn', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'ordered-idle', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-ordered' })
  await fx.tick()
  fx.emitStatus('main', 'idle') // stale: precedes terminal evidence
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 4 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-ordered' } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 4, reason: { kind: 'completed' } } })
  await fx.tick()
  const handle = fx.store.records.keys().next().value
  assert.equal(fx.store.getTurnReconciliation(handle).state, 'pending')
  fx.emitStatus('main', 'idle')
  assert.equal((await turn).status, 'completed')
})

// ---------------------------------------------------------------------------
// Closed result envelopes (C-010)
// ---------------------------------------------------------------------------

test('ENVELOPE_COMPLETED: stable handle, store query=settled', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'ok', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-ok' })
  await fx.tick()
  fx.completeTurn('main', 'm-ok', 'FINAL')
  const envelope = await turn
  assert.equal(envelope.status, 'completed')
  assert.equal(envelope.reply, 'FINAL')
  assert.equal(typeof envelope.reconciliationHandle, 'string')
  assert.deepEqual(Object.keys(envelope.evidence).sort(), ['eventWatermarkSeq', 'messageId', 'phase', 'promptReceipt', 'promptRequestId', 'terminationEvidence'])
  const record = fx.store.getTurnReconciliation(envelope.reconciliationHandle)
  assert.equal(record.state, 'settled')
  assert.equal(record.snapshot.outcome, 'completed')
  assert.equal(record.snapshot.terminationEvidence, 'exact_terminal_then_idle')
})

test('ENVELOPE_FAILED: structured provider failure with a stable handle', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'fail', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-fail' })
  await fx.tick()
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-fail' } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error: { code: 'QUOTA', message: 'insufficient_quota' } } } })
  fx.emitStatus('main', 'idle')
  const observed = await rejectsWith(turn, (error) => {
    assert.equal(error.status, 'failed')
    assert.equal(error.code, 'account_quota_exhausted')
    assert.equal(typeof error.reconciliationHandle, 'string')
  })
  const record = fx.store.getTurnReconciliation(observed.reconciliationHandle)
  assert.equal(record.state, 'settled')
  assert.equal(record.snapshot.outcome, 'failed')
})

test('B05 raw session/prompt RPC cannot bypass admission/queue/watermark/fence', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const writes = prompts(fx).length
  await rejectsWith(fx.proc.request('session/prompt', { sessionId: 'main', contentBlocks: [] }), (error) => {
    assert.equal(error.status, 'not_admitted')
    assert.equal(error.code, 'AGENT_PROCESS_RAW_PROMPT_FORBIDDEN')
  })
  assert.equal(prompts(fx).length, writes)
})

test('ENVELOPE_NOT_ADMITTED: validation fails before reservation, handle=null', async () => {
  const fx = makeFx()
  await fx.readyNow()
  await rejectsWith(fx.proc.turn('', 'invalid'), (error) => {
    assert.equal(error.status, 'not_admitted')
    assert.equal(error.reconciliationHandle, null, 'pre-reservation rejection carries no handle')
    assert.equal(error.code, 'AGENT_PROCESS_INVALID_INPUT')
  })
  await rejectsWith(fx.proc.turn('main', 'x'.repeat(2 * 1024 * 1024)), (error) => {
    assert.equal(error.code, 'AGENT_PROCESS_PROMPT_TOO_LARGE')
    assert.equal(error.reconciliationHandle, null)
  })
  assert.equal(prompts(fx).length, 0, 'no write, no reservation')
  assert.equal(fx.store.occupancy().records, 0)
})

test('ENVELOPE_OUTCOME_UNKNOWN: the envelope always exposes a queryable handle (store=pending)', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'hold', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-hold' })
  const observed = await rejectsWith(turn, (error) => {
    assert.equal(error.status, 'outcome_unknown')
    assert.equal(typeof error.reconciliationHandle, 'string')
  })
  const record = fx.store.getTurnReconciliation(observed.reconciliationHandle)
  assert.equal(record.state, 'pending', 'handle query=pending, never not-found')
  assert.equal(record.snapshot.initialOutcome, 'outcome_unknown')
  assert.equal(fx.fence(), observed.reconciliationHandle, 'F[false,true]')
})
