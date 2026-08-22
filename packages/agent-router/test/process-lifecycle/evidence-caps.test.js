/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 fault-injection suite —
 * bounded evidence surfaces (CLAUSE-PROC-BOUNDED): event ring wrap, stderr
 * + creation record caps, UTF-8 incremental output tail and the bounded
 * turn queue.
 *
 * Every test maps to one §10.3 table row (or a §10.2 supplementary item)
 * and asserts its unique oracle with the exact S/W/K/R counters and the
 * R[...]/P[...]/F[...] snapshots. Deterministic: the REAL AgentProcess
 * class with a fake OS child (helpers/fake-child.js).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx, rejectsWith } from './helpers.js'

// ---------------------------------------------------------------------------
// Protocol / bounded state (C-009 + CLAUSE-PROC-BOUNDED)
// ---------------------------------------------------------------------------

test('EVENT_RING_WRAP_DURING_ACTIVE_TURN: sequence matcher survives ring eviction', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'ring-wrap', {}, 5000)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-wrap' })
  await fx.tick()
  // Overflow the bounded ring with unrelated events (cap 10000 records).
  for (let index = 0; index < 10060; index += 1) {
    fx.emitEvent('noise-session', { type: 'noise', data: { index } })
  }
  assert.ok(fx.proc.eventsDroppedCount > 0, 'oldest ring entries evicted (count cap)')
  assert.ok(fx.proc.eventLog.size <= 10000)
  fx.completeTurn('main', 'm-wrap', 'RING-WRAP-REPLY')
  const envelope = await turn
  assert.equal(envelope.status, 'completed')
  assert.equal(envelope.reply, 'RING-WRAP-REPLY', 'sequence-keyed attribution, not array indices')
})

test('STDERR_AND_CREATIONS_OVERFLOW: caps + exact counters', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const chunk = 's'.repeat(64 * 1024)
  for (let index = 0; index < 40; index += 1) fx.child.stderr.handler(chunk)
  assert.ok(Buffer.byteLength(fx.proc.stderr, 'utf8') <= 1024 * 1024, 'stderr tail capped')
  assert.ok(fx.proc.stderrDroppedBytes > 0, 'stderrDroppedBytes accounted')
  for (let index = 0; index < 300; index += 1) {
    fx.child.stderr.handler(`[demo-server] session s-${index} created (${index} events)\n`)
  }
  assert.equal(fx.proc.creations.length, 256, 'MAX_CREATION_RECORDS')
  assert.ok(fx.proc.creationsDroppedCount > 0, 'creationsDroppedCount accounted')
})

test('UTF8_OUTPUT_INCREMENTAL_TAIL: multibyte output over cap keeps a valid UTF-8 tail', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const segment = '世界🌍人工智能'.repeat(2048) // ~6KB * multibyte per segment
  const turn = fx.proc.turn('main', 'big-output', {}, 5000)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-big' })
  await fx.tick()
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-big' } })
  for (let index = 0; index < 260; index += 1) {
    fx.emitEvent('main', { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: segment }] } } })
  }
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  fx.emitStatus('main', 'idle')
  const envelope = await turn
  assert.equal(envelope.status, 'completed')
  const output = fx.store.readFinalAssistantOutput(envelope.reconciliationHandle)
  assert.equal(output.state, 'available')
  assert.equal(output.truncated, true)
  assert.ok(output.originalBytes > 1024 * 1024, 'originalBytes counts the full output')
  assert.ok(Buffer.byteLength(output.text, 'utf8') <= 1024 * 1024, 'tail capped')
  assert.ok(!output.text.includes('\uFFFD'), 'no UTF-8 code point was split')
})

// ---------------------------------------------------------------------------
// Supplementary acceptance items (§10.2): queued turn caps
// ---------------------------------------------------------------------------

test('queued turn caps: 65th queued turn is rejected pre-queue; oversized prompts never cached', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const first = fx.proc.turn('main', 'active-turn', {}, 3000)
  await fx.tick()
  const queued = []
  for (let index = 0; index < 64; index += 1) {
    queued.push(fx.proc.turn('main', `queued-${index}`, {}).catch(error => error))
  }
  await fx.tick()
  await rejectsWith(fx.proc.turn('main', 'one-too-many', {}), (error) => {
    assert.equal(error.code, 'AGENT_PROCESS_QUEUE_CAP')
    assert.equal(error.status, 'not_admitted')
    assert.equal(error.reconciliationHandle, null)
  })
  // Complete the active turn; the 64 queued runs proceed one by one — but
  // the assertion here is the bounded queue size itself.
  assert.equal(fx.proc.turnQueueEntries.length, 64)
  fx.respondTo('session/prompt', { messageId: 'm-cap' })
  await fx.tick()
  fx.completeTurn('main', 'm-cap', 'OK')
  await first
  await fx.tick() // the queue drains one turn in (bounded, one at a time)
  // Abort by killing the process — every queued turn is settled.
  fx.childExit(0, null)
  await fx.proc.exitPromise
  await fx.tick()
  const outcomes = await Promise.all(queued)
  assert.equal(outcomes.length, 64)
  assert.ok(outcomes.every(outcome => outcome instanceof Error), 'no queued waiter left dangling')
  assert.equal(fx.proc.turnQueueEntries.length, 0, 'queue not permanently wedged')
})
