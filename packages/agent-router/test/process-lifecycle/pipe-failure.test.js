/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 fault-injection suite —
 * stdin pipe faults and fatal protocol frame overflow (C-004 / C-009 +
 * CLAUSE-PROC-BOUNDED rule 6).
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
// stdin faults (C-004 / C-009)
// ---------------------------------------------------------------------------

test('B04: known non-writable stdin rejects before any write attempt', async () => {
  const fx = makeFx()
  await fx.readyNow()
  fx.child.stdin.writable = false
  const writesBefore = fx.writes.length
  const turn = fx.proc.turn('main', 'known-closed', {})
  const observed = await rejectsWith(turn, (error) => {
    assert.equal(error.status, 'not_admitted')
    assert.equal(error.proven, 'zero_byte')
    assert.equal(error.code, 'AGENT_PROCESS_STDIN_NOT_WRITABLE')
  })
  assert.equal(fx.writes.length, writesBefore, 'underlying stdin.write was never called')
  assert.equal(fx.pendingSize(), 0)
  assert.equal(fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot.outcome, 'not_admitted')
})

test('STDIN_SYNC_THROW_ZERO_BYTE: proven zero-byte -> not_admitted; broken stream still tears down', async () => {
  const fx = makeFx()
  await fx.readyNow()
  fx.child.stdin.syncThrowNext = new Error('EPIPE: sync write throw')
  const turn = fx.proc.turn('main', 'zero-byte', {}, 5000)
  await rejectsWith(turn, (error) => {
    assert.equal(error.status, 'not_admitted')
    assert.equal(error.proven, 'zero_byte')
    assert.equal(typeof error.reconciliationHandle, 'string', 'stable handle + not_admitted')
  })
  const handle = firstHandle(fx)
  const record = fx.store.getTurnReconciliation(handle)
  assert.equal(record.state, 'settled')
  assert.equal(record.snapshot.outcome, 'not_admitted')
  assert.equal(fx.store.readFinalAssistantOutput(handle).state, 'no_output')
  await fx.tick() // the deferred stream-level fatal
  assert.equal(fx.counts().killSignals, 1, 'broken stdin -> immediate kill (K=1)')
  fx.childExit(1, null)
  await fx.proc.exitPromise
  assert.deepEqual(slotSeq(fx), ['casReap:g1', 'casEmpty:g1'])
  assert.equal(prompts(fx).length, 1, 'W=1 (the attempted write)')
  assert.equal(fx.counts().replayAdmissions, 0)
})

test('STDIN_ASYNC_WRITE_ERROR: admission unknown -> outcome_unknown visible pre-exit, then terminated_without_outcome', async () => {
  const fx = makeFx()
  await fx.readyNow()
  fx.child.stdin.callbackErrorNext = new Error('EPIPE: async write failure')
  const turn = fx.proc.turn('main', 'async-write', {}, 5000)
  const observed = await rejectsWith(turn, (error) => {
    assert.equal(error.status, 'outcome_unknown')
    assert.equal(error.source, 'prompt_write_failed')
  })
  // Initial outcome_unknown is authoritative BEFORE the real exit.
  assert.equal(fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot.initialOutcome, 'outcome_unknown')
  fx.childExit(1, null)
  await fx.proc.exitPromise
  const snapshot = fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot
  assert.equal(snapshot.lateOutcome, 'terminated_without_outcome')
  assert.equal(fx.counts().killSignals, 1)
  assert.equal(fx.counts().replayAdmissions, 0)
})

test('STDIN_CLOSE_AFTER_PARTIAL_WRITE: pipe close with unknown admission -> unknown, no replay, teardown', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'partial-then-close', {}, 5000)
  await fx.tick()
  fx.stdinClose()
  const observed = await rejectsWith(turn, (error) => {
    assert.equal(error.status, 'outcome_unknown')
  })
  assert.equal(fx.counts().killSignals, 1, 'stdin close is a fatal stream failure')
  fx.childExit(1, null)
  await fx.proc.exitPromise
  assert.equal(fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot.lateOutcome, 'terminated_without_outcome')
  assert.equal(prompts(fx).length, 1, 'no not_admitted claim and no replay write')
})

// ---------------------------------------------------------------------------
// Protocol / bounded state (C-009 + CLAUSE-PROC-BOUNDED)
// ---------------------------------------------------------------------------

test('FATAL_PROTOCOL_FRAME_OVERFLOW: oversized stdout frame -> immediate teardown, buffers capped', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'overflow', {}, 5000)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-of' })
  await fx.tick()
  const huge = 'x'.repeat(1.1 * 1024 * 1024)
  fx.emit({ jsonrpc: '2.0', method: 'session.event', params: { sessionId: 'main', pad: huge } })
  const observed = await rejectsWith(turn, (error) => assert.equal(error.status, 'outcome_unknown'))
  assert.ok(Buffer.byteLength(fx.proc.buf, 'utf8') <= 1024 * 1024, 'partial buffer capped')
  assert.equal(fx.counts().killSignals, 1)
  fx.childExit(1, null)
  await fx.proc.exitPromise
  assert.equal(fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot.lateOutcome, 'terminated_without_outcome')
  assert.ok(fx.proc.boundedAudit.some(entry => entry.kind === 'protocol_buffer_overflow'))
})
