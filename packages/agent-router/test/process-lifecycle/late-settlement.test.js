/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 fault-injection suite —
 * late settlement rows, evidence precedence, handoff ordering and the
 * scheduler seam (C-014..C-018 / C-020).
 *
 * Every test maps to one §10.3 table row (or a §10.2 supplementary item)
 * and asserts its unique oracle with the exact S/W/K/R counters and the
 * R[...]/P[...]/F[...] snapshots. Deterministic: the REAL AgentProcess
 * class with a fake OS child (helpers/fake-child.js).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx, rejectsWith, slotSeq } from './helpers.js'

// ---------------------------------------------------------------------------
// Turn deadline / outcome model (C-014..C-016)
// ---------------------------------------------------------------------------

test('TURN_TIMEOUT_THEN_LATE_SUCCESS: settlement=late_completed, output available via handle', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 130 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'slow', {}, 80)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-slow' })
  const observed = await rejectsWith(turn, (error) => {
    assert.equal(error.status, 'outcome_unknown')
    assert.equal(error.source, 'caller_wait_exceeded')
    assert.equal(typeof error.deadlineAtWallMs, 'number')
  })
  const handle = observed.reconciliationHandle
  assert.equal(fx.fence(), handle, 'same-process admission fenced')
  fx.completeTurn('main', 'm-slow', 'LATE-SUCCESS-REPLY')
  await fx.tick()
  const snapshot = fx.store.getTurnReconciliation(handle).snapshot
  assert.equal(snapshot.lateOutcome, 'late_completed')
  const output = fx.store.readFinalAssistantOutput(handle)
  assert.equal(output.state, 'available')
  assert.equal(output.text, 'LATE-SUCCESS-REPLY')
  assert.equal(fx.fence(), false)
  assert.equal(fx.counts().killSignals, 0, 'timeout alone never kills')
  assert.equal(fx.counts().replayAdmissions, 0)
})

test('TURN_TIMEOUT_THEN_LATE_FAILURE: settlement=late_failed, no_output', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 130 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'doomed', {}, 80)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-doom' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-doom' } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error: { code: 'QUOTA', message: 'insufficient_quota' } } } })
  fx.emitStatus('main', 'idle')
  await fx.tick()
  const snapshot = fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot
  assert.equal(snapshot.lateOutcome, 'late_failed')
  assert.equal(fx.store.readFinalAssistantOutput(observed.reconciliationHandle).state, 'no_output')
})

test('TURN_TIMEOUT_THEN_CHILD_EXIT_NO_TERMINAL: pending-first order; terminated_without_outcome; fence released', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'exit-no-terminal', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-ex' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  assert.equal(fx.fence(), observed.reconciliationHandle, 'F[true,...]')
  const order = []
  const originalSettleLate = fx.store.settleLate.bind(fx.store)
  fx.store.settleLate = (handle, payload) => {
    order.push('store')
    return originalSettleLate(handle, payload)
  }
  fx.childExit(0, null)
  await fx.proc.exitPromise
  assert.equal(fx.pendingSize(), 0)
  assert.equal(order.length, 1, 'store settlement ran during the exit sequence')
  const snapshot = fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot
  assert.equal(snapshot.lateOutcome, 'terminated_without_outcome', 'child exit proves termination, never invents an outcome')
  assert.equal(snapshot.terminationEvidence, 'child_real_exit')
  assert.equal(fx.fence(), false, 'F[...,false] — child_real_exit released the fence')
  assert.deepEqual(slotSeq(fx), ['casReap:g1', 'casEmpty:g1'])
})

test('B09 parser receipt/terminal evidence beats exit before the receipt Promise continuation', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 1000 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'same-stack-exit', {})
  await fx.tick()
  const prompt = fx.writes.find(write => write.method === 'session/prompt')
  const frames = [
    { id: prompt.id, result: { messageId: 'm-gap' } },
    { method: 'session.event', params: { sessionId: 'main', event: { type: 'turn/start', data: { turn: 9 } } } },
    { method: 'session.event', params: { sessionId: 'main', event: { type: 'user/message', data: { id: 'm-gap' } } } },
    { method: 'session.event', params: { sessionId: 'main', event: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'GAP-WINNER' }] } } } } },
    { method: 'session.event', params: { sessionId: 'main', event: { type: 'turn/end', data: { turn: 9, reason: { kind: 'completed' } } } } },
  ].map(frame => `${JSON.stringify(frame)}\n`).join('')
  fx.child.stdout.handler(frames)
  fx.childExit(0, null) // before await(promptWrite) continuation runs
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  await fx.proc.exitPromise
  const snapshot = fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot
  assert.equal(snapshot.lateOutcome, 'late_completed')
  assert.equal(snapshot.terminationEvidence, 'child_real_exit')
  assert.equal(fx.store.readFinalAssistantOutput(observed.reconciliationHandle).text, 'GAP-WINNER')
})

test('PARSED_OUTCOME_PRECEDES_CHILD_EXIT: exact turn/end received pre-exit wins over child_real_exit', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'parsed-wins', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-pw' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  // Parser receives the exact success BEFORE any idle status (store update
  // effectively paused) — then the child really exits.
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-pw' } })
  fx.emitEvent('main', { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'PARSED' }] } } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  fx.childExit(0, null) // NO idle status in between — exit snapshot must use the parsed evidence
  await fx.proc.exitPromise
  const snapshot = fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot
  assert.equal(snapshot.lateOutcome, 'late_completed', 'parsed exact outcome wins the precedence')
  assert.equal(snapshot.terminationEvidence, 'child_real_exit')
  assert.equal(fx.store.readFinalAssistantOutput(observed.reconciliationHandle).text, 'PARSED')
})

test('DUPLICATE_CONFLICTING_LATE_EVIDENCE: state/output unchanged; duplicate + conflict audits', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'dup', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-dup' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  fx.completeTurn('main', 'm-dup', 'ONCE')
  await fx.tick()
  const handle = observed.reconciliationHandle
  const before = JSON.stringify(fx.store.getTurnReconciliation(handle))
  // Duplicate same evidence + conflicting evidence on the reconciliation seam.
  fx.store.settleLate(handle, { lateOutcome: 'late_completed', outcomeEvidence: 'exact_turn_end_success', terminationEvidence: 'exact_terminal_then_idle' })
  fx.store.settleLate(handle, { lateOutcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit' })
  const snapshot = fx.store.getTurnReconciliation(handle).snapshot
  assert.equal(snapshot.lateOutcome, 'late_completed', 'state unchanged')
  assert.equal(fx.store.readFinalAssistantOutput(handle).text, 'ONCE', 'output unchanged')
  assert.deepEqual(snapshot.audit.map(entry => entry.kind), ['duplicate_ignored', 'conflict_ignored'])
  assert.equal(before.includes('late_completed'), true)
})

// ---------------------------------------------------------------------------
// Handoff ordering + late output retention (C-018 / C-020)
// ---------------------------------------------------------------------------

test('HANDOFF_VISIBLE_BEFORE_RELEASE: reconciliation visible before slot release — never not_found', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'handoff', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-ho' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  const handle = observed.reconciliationHandle
  const order = []
  const originalSettleLate = fx.store.settleLate.bind(fx.store)
  fx.store.settleLate = (h, payload) => {
    // Mid-sequence: the record must ALREADY be visible as pending+unknown.
    const mid = fx.store.getTurnReconciliation(handle)
    assert.equal(mid.state, 'pending')
    assert.equal(mid.snapshot.initialOutcome, 'outcome_unknown', 'visible continuously — no not_found window')
    order.push('store')
    return originalSettleLate(h, payload)
  }
  fx.childExit(0, null)
  await fx.proc.exitPromise
  assert.equal(order.length, 1)
  assert.deepEqual(slotSeq(fx), ['casReap:g1', 'casEmpty:g1'], 'REAP -> EMPTY strictly after the store CAS')
  assert.equal(fx.store.getTurnReconciliation(handle).snapshot.lateOutcome, 'terminated_without_outcome')
})

test('LATE_OUTPUT_AFTER_GENERATION_EXIT: late_completed output survives graceful real exit, identical on repeat reads', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'survive', {}, 70)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-surv' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  fx.completeTurn('main', 'm-surv', 'SURVIVED-OUTPUT')
  await fx.tick()
  const handle = observed.reconciliationHandle
  assert.equal(fx.store.getTurnReconciliation(handle).snapshot.lateOutcome, 'late_completed')
  const shutdown = fx.proc.shutdown()
  await fx.tick()
  fx.respondTo('shutdown', { ok: true })
  fx.childExit(0, null)
  await shutdown
  const first = fx.store.readFinalAssistantOutput(handle)
  const second = fx.store.readFinalAssistantOutput(handle)
  assert.deepEqual(first, second)
  assert.equal(first.state, 'available')
  assert.equal(first.text, 'SURVIVED-OUTPUT')
})

// ---------------------------------------------------------------------------
// Supplementary acceptance items (§10.2): scheduler seam + late readability
// ---------------------------------------------------------------------------

test('scheduler seam snapshot separates outcome evidence / cancel requested / termination proven', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 130 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'seam', {}, 80)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-seam' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  const handle = observed.reconciliationHandle
  fx.proc.store.markCancelRequested(handle)

  const unknown = fx.proc.turnExecutionSnapshot(handle)
  assert.equal(unknown.phase, 'outcome_unknown')
  assert.equal(unknown.promptReceipt, 'accepted')
  assert.equal(unknown.initialOutcome, 'outcome_unknown')
  assert.equal(unknown.reconciledOutcome, null, 'no outcome claimed yet')
  assert.equal(unknown.outcomeEvidence, null, 'outcome evidence distinct from termination evidence')
  assert.equal(unknown.cancelRequested, true, 'cancel requested is its own field')
  assert.equal(unknown.terminationProven, false, 'cancel requested != proven terminated')
  assert.equal(unknown.terminationEvidence, null)
  assert.equal(unknown.reconciliationHandle, handle)

  fx.completeTurn('main', 'm-seam', 'SEAM-REPLY')
  await fx.tick()
  const settled = fx.proc.turnExecutionSnapshot(handle)
  assert.equal(settled.phase, 'terminal')
  assert.equal(settled.reconciledOutcome, 'late_completed')
  assert.equal(settled.outcomeEvidence, 'exact_turn_end_success')
  assert.equal(settled.terminationProven, true)
  assert.equal(settled.terminationEvidence, 'exact_terminal_then_idle')
  assert.equal(settled.cancelRequested, true, 'cancelRequested survives independently')
  assert.equal(settled.finalAssistantOutputAvailable, true)
})

test('late output remains readable through the reconciliation handle after the generation exited', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'respawn-read', {}, 70)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-rr' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  fx.completeTurn('main', 'm-rr', 'RESPAWN-READABLE')
  await fx.tick()
  fx.childExit(0, null)
  await fx.proc.exitPromise
  assert.equal(fx.proc.state, 'EXITED')
  // The handle outlives its process generation within the runtime epoch.
  const output = fx.store.readFinalAssistantOutput(observed.reconciliationHandle)
  assert.equal(output.state, 'available')
  assert.equal(output.text, 'RESPAWN-READABLE')
  assert.equal(fx.store.getTurnReconciliation(observed.reconciliationHandle).snapshot.lateOutcome, 'late_completed')
})
