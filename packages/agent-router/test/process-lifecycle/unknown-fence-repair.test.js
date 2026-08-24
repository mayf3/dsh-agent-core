/**
 * Unknown-fence late-settlement self-lock repair — the fence release must
 * never depend on an event that only a NEW prompt admission can produce
 * (AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-015/C-016/C-017 within-contract
 * defect repair; task: unknown fence 修复).
 *
 * Rows:
 *  1. unknown + exact terminal + idle delivered BEFORE the same-batch
 *     turn/end + child currently idle + no later turn/start → late_completed
 *     + fence release with ZERO new admission; the next admission PASSES.
 *  2. receiptMessageSeen=false with a terminal in the stream → still
 *     pending, no fake release (RECEIPT_CORRELATION_MISSING).
 *  3. later turn/start after the terminal → never settles onto the old turn
 *     (LATER_TURN_STARTED).
 *  4. multiple unresolved unknown fences stay isolated (C-016).
 *  5. child exit → terminated_without_outcome + fence release.
 *  6. deliver-mode release flow: no second business prompt, no duplicate
 *     delivery.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx, prompts, rejectsWith } from './helpers.js'
import { TurnExecution } from '../../src/process/turn-execution.js'
import { UNKNOWN_FENCE_DIAGNOSTICS, classifyUnknownFence, monotonicNowMs } from '../../src/process.js'

test('UNKNOWN_FENCE_SELF_LOCK_REPAIRED: idle before the same-batch turn/end settles late and releases the fence without any new admission', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 130 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'locked', {}, 80)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-lock' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  const handle = observed.reconciliationHandle
  assert.equal(fx.fence(), handle, 'unknown installed the fence')
  // Correlate the receipt into a matched turn, no idle yet: the diagnostic
  // must already distinguish the wait — never one unified pending blob.
  fx.emitEvent('main', { type: 'agent/inbox/spliced', data: { inserted: [{ id: 'm-lock' }] } })
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-lock' } })
  await fx.tick()
  assert.equal(fx.proc.turnExecutionSnapshot(handle).diagnostic.classification, 'TERMINAL_OBSERVED_IDLE_MISSING')
  // The self-lock batch: IDLE FIRST, then the correlated terminal.
  fx.emitEvent('main', { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'LOCK-FREE-REPLY' }] } } })
  fx.emitStatus('main', 'idle')
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  await fx.tick()
  const record = fx.store.getTurnReconciliation(handle)
  assert.equal(record.state, 'settled')
  assert.equal(record.snapshot.lateOutcome, 'late_completed')
  assert.equal(record.snapshot.terminationEvidence, 'exact_terminal_then_idle')
  assert.equal(fx.store.readFinalAssistantOutput(handle).text, 'LOCK-FREE-REPLY')
  assert.equal(fx.fence(), false, 'fence released without receiving a new prompt')
  assert.equal(prompts(fx).length, 1, 'no second business prompt during release')
  assert.equal(fx.counts().replayAdmissions, 0)
  // The next prompt admission PASSES after the release.
  const next = fx.proc.turn('main', 'after-release')
  await fx.tick()
  assert.equal(prompts(fx).length, 2, 'exactly one new admission write')
  fx.respondTo('session/prompt', { messageId: 'm-next' })
  fx.completeTurn('main', 'm-next', 'NEXT-OK', { turn: 2 })
  const envelope = await next
  assert.equal(envelope.status, 'completed')
  assert.equal(envelope.reply, 'NEXT-OK')
})

test('RECEIPT_CORRELATION_MISSING: terminal present but receipt never correlated — pending, no fake release', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 130 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'no-receipt', {}, 80)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-nr' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  const handle = observed.reconciliationHandle
  // A terminal turn/end exists in the stream, but the receipt messageId was
  // never attributed as the session's user message inside the matched turn.
  fx.emitEvent('main', { type: 'agent/inbox/spliced', data: { inserted: [{ id: 'm-nr' }] } })
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'UNATTRIBUTED' }] } } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  fx.emitStatus('main', 'idle')
  await fx.tick()
  const record = fx.store.getTurnReconciliation(handle)
  assert.equal(record.state, 'pending', 'missing correlation is never settled')
  assert.equal(fx.fence(), handle, 'fence stays active')
  const snapshot = fx.proc.turnExecutionSnapshot(handle)
  assert.equal(snapshot.diagnostic.classification, 'RECEIPT_CORRELATION_MISSING')
  assert.equal(snapshot.diagnostic.receiptCorrelated, false)
})

test('LATER_TURN_STARTED: a later turn/start after the terminal never settles the old turn', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 130 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'superseded', {}, 80)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-sup' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  const handle = observed.reconciliationHandle
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-sup' } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 2 } }) // later turn began
  fx.emitStatus('main', 'idle')
  await fx.tick()
  const record = fx.store.getTurnReconciliation(handle)
  assert.equal(record.state, 'pending', 'no settlement onto the old turn')
  assert.equal(fx.fence(), handle, 'fence stays active')
  const snapshot = fx.proc.turnExecutionSnapshot(handle)
  assert.equal(snapshot.diagnostic.classification, 'LATER_TURN_STARTED')
  assert.equal(snapshot.diagnostic.terminalObserved, true)
  assert.equal(snapshot.diagnostic.laterTurnStarted, true)
})

test('MULTI_UNKNOWN_ISOLATED: releasing one fence never releases another (C-016)', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 200 } })
  await fx.readyNow()
  // The single-flight admission queue serializes executions, so the only
  // faithful way to pin the multi-unknown isolation invariant is the real
  // fence seam itself: two REAL executions on distinct sessions, each
  // unknown-marked through the real markExecutionUnknown path.
  const handleA = fx.store.mintTurnExecution({ agentId: 'agt_fx', processGeneration: 1, sessionId: 's1' })
  const handleB = fx.store.mintTurnExecution({ agentId: 'agt_fx', processGeneration: 1, sessionId: 's2' })
  const execA = new TurnExecution({ handle: handleA, sessionId: 's1', mode: 'turn', watermarkSeq: fx.proc.eventSeq, startMono: monotonicNowMs(), deadlines: fx.proc.deadlines, bindingContext: undefined })
  const execB = new TurnExecution({ handle: handleB, sessionId: 's2', mode: 'turn', watermarkSeq: fx.proc.eventSeq, startMono: monotonicNowMs(), deadlines: fx.proc.deadlines, bindingContext: undefined })
  fx.proc.executions.set(handleA, execA)
  fx.proc.executions.set(handleB, execB)
  fx.proc.markExecutionUnknown(execA, 'test_unknown_a')
  fx.proc.markExecutionUnknown(execB, 'test_unknown_b')
  assert.equal(fx.proc.activeUnknownFences.size, 2)
  assert.equal(fx.fence(), handleA, 'oldest unresolved fence projects first')
  await rejectsWith(fx.proc.turn('main', 'blocked'), error => {
    assert.equal(error.code, 'AGENT_PROCESS_TURN_FENCED')
    assert.equal(error.fencedBy, handleA)
  })
  // Settlement of A removes ONLY A's fence.
  fx.proc.releaseFence(handleA)
  assert.equal(fx.fence(), handleB, 'the other unknown remains fenced')
  await rejectsWith(fx.proc.turn('main', 'still-blocked'), error => {
    assert.equal(error.code, 'AGENT_PROCESS_TURN_FENCED')
    assert.equal(error.fencedBy, handleB)
  })
  fx.proc.releaseFence(handleB)
  assert.equal(fx.fence(), false, 'last release opens admission')
  const reopened = fx.proc.turn('main', 'open')
  await fx.tick()
  assert.equal(prompts(fx).length, 1, 'admission flows again after every fence is released')
  fx.respondTo('session/prompt', { messageId: 'm-open' })
  fx.completeTurn('main', 'm-open', 'OPEN')
  assert.equal((await reopened).status, 'completed')
})

test('CHILD_EXIT_SETTLES_TERMINATED_WITHOUT_OUTCOME: fence released, no new admission needed', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'exit-path', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-exit' })
  const observed = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  const handle = observed.reconciliationHandle
  assert.equal(fx.fence(), handle)
  const promptWrites = prompts(fx).length
  fx.childExit(0, null)
  await fx.proc.exitPromise
  const snapshot = fx.store.getTurnReconciliation(handle).snapshot
  assert.equal(snapshot.lateOutcome, 'terminated_without_outcome')
  assert.equal(snapshot.terminationEvidence, 'child_real_exit')
  assert.equal(fx.fence(), false, 'child_real_exit released the fence')
  assert.equal(prompts(fx).length, promptWrites, 'exit settlement sends no prompt')
})

test('RELEASE_SENDS_NOTHING_NEW: deliver-mode late settlement produces no second business prompt and no duplicate delivery', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()
  const deliverPromise = fx.proc.deliver('main', 'bg')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-bg' })
  const delivered = await deliverPromise
  assert.equal(delivered.accepted, true)
  // Background watch fires at the turn deadline -> unknown + fence.
  await fx.sleep(150)
  const handle = delivered.reconciliationHandle
  assert.equal(fx.fence(), handle)
  assert.equal(prompts(fx).length, 1)
  // Idle BEFORE the terminal line — the repaired judgment must settle.
  fx.emitEvent('main', { type: 'agent/inbox/spliced', data: { inserted: [{ id: 'm-bg' }] } })
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-bg' } })
  fx.emitEvent('main', { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'BG-LATE' }] } } })
  fx.emitStatus('main', 'idle')
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  await fx.tick()
  assert.equal(fx.store.getTurnReconciliation(handle).snapshot.lateOutcome, 'late_completed')
  assert.equal(fx.fence(), false)
  assert.equal(prompts(fx).length, 1, 'no second business prompt')
  assert.equal(fx.counts().promptWriteAttempts, 1, 'no duplicate delivery write')
  assert.equal(fx.counts().replayAdmissions, 0)
  // C-018: the late reply is RETAINED and exposed via the handle only —
  // never re-prompted, never pushed to any product surface.
  assert.equal(fx.store.readFinalAssistantOutput(handle).text, 'BG-LATE')
})

test('classifyUnknownFence covers the six bounded, secret-free categories', () => {
  const base = {
    exitSeen: false, streamLost: false, receiptCorrelated: true,
    terminalObserved: true, laterTurnStarted: false,
    currentIdle: false, idleAfterTurnStart: false,
  }
  assert.equal(classifyUnknownFence({ ...base, exitSeen: true }), 'CHILD_EXITED')
  assert.equal(classifyUnknownFence({ ...base, exitSeen: true, streamLost: true }), 'CHILD_EXITED', 'exit dominates')
  assert.equal(classifyUnknownFence({ ...base, streamLost: true }), 'EVENT_STREAM_LOST')
  assert.equal(classifyUnknownFence({ ...base, receiptCorrelated: false }), 'RECEIPT_CORRELATION_MISSING')
  assert.equal(classifyUnknownFence({ ...base, laterTurnStarted: true }), 'LATER_TURN_STARTED')
  assert.equal(classifyUnknownFence({ ...base, currentIdle: true, idleAfterTurnStart: true }), 'TERMINAL_OBSERVED_CURRENT_IDLE')
  assert.equal(classifyUnknownFence(base), 'TERMINAL_OBSERVED_IDLE_MISSING')
  assert.equal(classifyUnknownFence({ ...base, terminalObserved: false }), 'TERMINAL_OBSERVED_IDLE_MISSING')
  assert.deepEqual([...UNKNOWN_FENCE_DIAGNOSTICS], [
    'RECEIPT_CORRELATION_MISSING',
    'TERMINAL_OBSERVED_IDLE_MISSING',
    'TERMINAL_OBSERVED_CURRENT_IDLE',
    'LATER_TURN_STARTED',
    'CHILD_EXITED',
    'EVENT_STREAM_LOST',
  ])
})
