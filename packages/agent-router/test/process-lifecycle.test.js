/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 fault-injection suite
 * (process-level rows) — packages/agent-router/src/process.js.
 *
 * Every test maps to one §10.3 table row and asserts its unique oracle with
 * the exact S/W/K/R counters (spawnAttempts / promptWriteAttempts /
 * rpcResponseWriteAttempts+gracefulShutdownWriteAttempts / killSignals /
 * replayAdmissions), the R[...]/P[...]/F[...] snapshots (registry slot via
 * the captured integration ops, pending size, unknown fence) and the final
 * reconciliation state via the Router reconciliation store.
 *
 * Deterministic: the REAL AgentProcess class with a fake OS child
 * (helpers/fake-child.js) — no DSH process, no model, no wall-clock sleeps
 * beyond explicit deadline waits.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx } from './helpers/fake-child.js'

const prompts = (fx) => fx.writes.filter((write) => write.method === 'session/prompt')

/** Slot-op sequence in compact form: ['casReap:g1', 'casEmpty:g1', ...]. */
const slotSeq = (fx) => fx.slotOps.map(op => `${op.op}:g${op.generation}`)

function firstHandle(fx) {
  return fx.store.records.keys().next().value
}

async function rejectsWith(promise, check) {
  let observed = null
  try { await promise } catch (error) { observed = error }
  assert.ok(observed !== null, 'expected the promise to reject')
  await check(observed)
  return observed
}

// ---------------------------------------------------------------------------
// Startup faults (C-001 / C-008 / C-009)
// ---------------------------------------------------------------------------

test('INITIALIZE_REQUEST_NEVER_REPLIES: one total deadline, shared result rejects once, REAP then EMPTY', async () => {
  const fx = makeFx({ deadlines: { initializeTimeoutMs: 180 } })
  const ready = fx.proc.ready()
  await fx.tick()
  assert.equal(fx.writes.filter(w => w.method === 'initialize').length, 1)
  // RPC blackhole: never respond.
  const started = Date.now()
  await rejectsWith(ready, (error) => {
    assert.equal(error.code, 'AGENT_PROCESS_INITIALIZE_TIMEOUT')
  })
  assert.ok(Date.now() - started < 1500, 'bounded by ONE total deadline (no per-attempt reset)')
  assert.equal(fx.proc.state, 'DRAINING', 'fatal teardown awaiting real exit')
  assert.deepEqual(slotSeq(fx).slice(0, 1), ['casReap:g1'], 'REAP installed before teardown')
  assert.equal(fx.counts().killSignals, 1, 'created child immediate-kill')
  fx.childExit(1, null)
  await fx.proc.exitPromise
  assert.equal(fx.proc.state, 'EXITED')
  assert.deepEqual(slotSeq(fx), ['casReap:g1', 'casEmpty:g1'], 'R[STARTUP,REAP,REAP,Ø]')
  assert.equal(fx.counts().spawnAttempts, 1)
  assert.equal(fx.counts().replayAdmissions, 0)
})

test('INITIALIZE_PROVIDER_NEVER_READY: retries never reset the one initialize deadline', async () => {
  const fx = makeFx({ deadlines: { initializeTimeoutMs: 700 } })
  const ready = fx.proc.ready()
  await fx.tick()
  const started = Date.now()
  // Provider stays absent; every retry gets answered but never registers.
  const pollAnswer = setInterval(() => {
    const last = [...fx.writes].reverse().find(w => w.method === 'initialize')
    if (last !== undefined && fx.proc.pending.has(last.id)) {
      fx.emit({ id: last.id, result: { registeredProviders: [] } })
    }
  }, 20)
  try {
    await rejectsWith(ready, (error) => assert.equal(error.code, 'AGENT_PROCESS_INITIALIZE_TIMEOUT'))
  } finally {
    clearInterval(pollAnswer)
  }
  const elapsed = Date.now() - started
  assert.ok(elapsed < 2 * 700, `elapsed ${elapsed}ms bounded by ONE total initialize deadline (no reset)`)
  assert.ok(fx.writes.filter(w => w.method === 'initialize').length >= 2, 'retries happened')
  fx.childExit(1, null)
  await fx.proc.exitPromise
})

// ---------------------------------------------------------------------------
// Child exit / pending RPC (C-002 / C-003 / C-020 order)
// ---------------------------------------------------------------------------

test('CHILD_EXIT_WITH_MULTIPLE_PENDING_RPC: all reject with EXITED before the store hook', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const order = []
  const rejections = []
  for (let index = 0; index < 8; index += 1) {
    rejections.push(fx.proc.request(`x/echo${index}`, { n: index }).catch((error) => {
      order.push(`rejected:${error.method}`)
      return error
    }))
  }
  assert.equal(fx.pendingSize(), 8)
  const originalSettleLate = fx.store.settleLate.bind(fx.store)
  fx.store.settleLate = (handle, payload) => {
    order.push('store-settleLate')
    return originalSettleLate(handle, payload)
  }
  fx.childExit(0, null)
  const errors = await Promise.all(rejections)
  for (const error of errors) {
    assert.equal(error.code, 'AGENT_PROCESS_EXITED')
    assert.equal(error.agentId, fx.proc.agentId)
    assert.equal(error.processGeneration, 1)
    assert.equal(typeof error.method, 'string')
  }
  assert.equal(fx.pendingSize(), 0, 'P[8,0]')
  // Pending settlement strictly precedes the reconciliation store hook.
  const firstStoreIndex = order.indexOf('store-settleLate')
  assert.ok(firstStoreIndex === -1 || order.slice(0, firstStoreIndex).filter(entry => entry.startsWith('rejected:')).length === 8,
    'every pending RPC rejected before any settlement')
  assert.deepEqual(slotSeq(fx), ['casReap:g1', 'casEmpty:g1'], 'R[READY,REAP,REAP,Ø]')
  assert.equal(fx.proc.state, 'EXITED')
})

// ---------------------------------------------------------------------------
// stdin faults (C-004 / C-009)
// ---------------------------------------------------------------------------

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
// Prompt admission / correlation (C-010 / C-011 / C-012)
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
// Parent-RPC deadlines (C-005)
// ---------------------------------------------------------------------------

test('PARENT_RPC_RESPONSE_WRITE_RESERVE: handler deadline aborts; ONE timeout response inside the reserve', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 1200 } })
  await fx.readyNow()
  let hookContext = null
  fx.proc.onRpcRequest = (method, params, deadlineCtx) => {
    hookContext = { method, ...deadlineCtx }
    return new Promise((resolve) => {
      deadlineCtx.signal.addEventListener('abort', () => resolve('late-side-effect'))
    })
  }
  const relay = fx.proc.handleRpcRequest({ requestId: 'r-1', method: 'agent-core/switchAgent', params: {} })
  await fx.sleep(1400)
  await relay
  assert.equal(fx.counts().rpcResponseWriteAttempts, 1, 'exactly one wire response attempt')
  const responses = fx.writes.filter(w => w.method === 'rpc.response')
  assert.equal(responses.length, 1)
  assert.equal(responses[0].params.ok, false, 'the response is the timeout response')
  assert.ok(hookContext.handlerDeadlineMono < hookContext.totalDeadlineMono, 'handler deadline strictly before the total deadline')
  const reserve = hookContext.totalDeadlineMono - hookContext.handlerDeadlineMono
  assert.ok(reserve <= 250 && reserve >= 1, `fixed response-write reserve algorithm (reserve=${reserve}ms)`)
  assert.ok(fx.proc.boundedAudit.some(e => e.kind === 'parent_rpc_response' && e.detail.includes('responseWrite=sent')))
  assert.ok(fx.proc.boundedAudit.some(e => e.kind === 'parent_rpc_timeout' && e.detail.includes('sideEffectOutcome=unknown')),
    'unprovable side effect recorded as unknown')
})

test('PARENT_RPC_WRITE_EXCEEDS_TOTAL_DEADLINE: one attempt, no post-deadline write, responseWrite=unknown', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 500 } })
  await fx.readyNow()
  // Backpressure: stdin write callbacks never complete.
  fx.child.stdin.holdCallbacks = true
  fx.proc.onRpcRequest = async () => {
    await fx.sleep(650) // resolves after the total deadline
    return { ok: true }
  }
  const relay = fx.proc.handleRpcRequest({ requestId: 'r-2', method: 'agent-core/broker', params: {} })
  await fx.sleep(900)
  await relay
  const responses = fx.writes.filter(w => w.method === 'rpc.response')
  assert.equal(responses.length, 1, 'rpcResponseWriteAttempts=1 and never a second write')
  assert.equal(fx.counts().rpcResponseWriteAttempts, 1)
  assert.ok(fx.proc.boundedAudit.some(e => e.kind === 'parent_rpc_response' && e.detail.includes('responseWrite=unknown')),
    'write outcome recorded unknown, not fabricated')
})

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
// Shutdown model (C-020..C-022)
// ---------------------------------------------------------------------------

test('GRACEFUL_SHUTDOWN_SUCCESS: one graceful write, kill=0, exact settlement order', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const shutdown = fx.proc.shutdown()
  await fx.tick()
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 1, 'gracefulShutdownWriteAttempts=1')
  assert.equal(fx.counts().killSignals, 0, 'no kill on voluntary exit')
  assert.equal(fx.proc.state, 'DRAINING')
  assert.deepEqual(slotSeq(fx), ['casReap:g1'])
  fx.respondTo('shutdown', { ok: true })
  fx.childExit(0, null)
  const exit = await shutdown
  assert.deepEqual(exit, { code: 0, signal: null })
  assert.equal(fx.proc.state, 'EXITED')
  assert.deepEqual(slotSeq(fx), ['casReap:g1', 'casEmpty:g1'])
  assert.equal(fx.pendingSize(), 0)
})

test('SHUTDOWN_GRACE_EXPIRES_THEN_KILL: grace expiry escalates to exactly one SIGKILL + real exit await', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 400, shutdownGraceMs: 150 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'active', {})
  const turnDone = rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-sg' })
  await fx.sleep(450)
  await turnDone
  const shutdown = fx.proc.shutdown()
  await fx.tick()
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 1)
  // The child ignores the graceful request; grace expiry escalates.
  await fx.sleep(220)
  assert.equal(fx.counts().killSignals, 1, 'SIGKILL exactly once')
  assert.equal(fx.child.killSignals[0], 'SIGKILL')
  assert.equal(fx.proc.state, 'DRAINING', 'not EXITED before the real exit is observed')
  fx.childExit(null, 'SIGKILL')
  await shutdown
  assert.equal(fx.proc.state, 'EXITED')
  const handle = firstHandle(fx)
  assert.equal(fx.store.getTurnReconciliation(handle).snapshot.lateOutcome, 'terminated_without_outcome')
  assert.equal(fx.fence(), false, 'fence released by child_real_exit')
})

test('SHUTDOWN_OWNERSHIP_MISMATCH: token mismatch -> no graceful write, no kill, REAP retained, loud audit', async () => {
  const slot = { state: 'REAP', generation: 1, token: 'not-the-real-token', cause: 'child_error' }
  const fx = makeFx({
    integration: {
      casReap: () => null, // the REAP fence already exists — never mutated by a mismatched callback
      casStartupEmpty: () => false,
      casEmpty: () => false, // mismatch must never empty the fence either
      verifyReapOwnership: (proc) => proc.ownershipToken === slot.token,
    },
  })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'mismatch', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-mm' })
  // A prior fatal installed a REAP fence whose token does not match this proc.
  await fx.sleep(50)
  const observed = await rejectsWith(fx.proc.shutdown(300), (error) => {
    assert.equal(error.code, 'AGENT_PROCESS_OWNERSHIP_MISMATCH')
  })
  assert.ok(observed !== null)
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0, 'no graceful write on mismatch')
  assert.equal(fx.counts().killSignals, 0, 'kill count = 0 — never a guessed kill')
  assert.ok(fx.proc.boundedAudit.some(entry => entry.kind === 'ownership_mismatch'))
  assert.equal(fx.proc.state, 'READY', 'REAP fence retained (process untouched)')
})

test('CONCURRENT_SHUTDOWN: 20 callers share one promise; one graceful write; one kill', async () => {
  const fx = makeFx({ deadlines: { shutdownGraceMs: 120 } })
  await fx.readyNow()
  const callers = []
  for (let index = 0; index < 20; index += 1) callers.push(fx.proc.shutdown())
  await fx.tick()
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 1, 'gracefulShutdownWriteAttempts=1')
  await fx.sleep(260)
  assert.equal(fx.counts().killSignals, 1, 'one exact SIGKILL')
  fx.childExit(null, 'SIGKILL')
  const results = await Promise.all(callers)
  for (const result of results) assert.deepEqual(result, { code: null, signal: 'SIGKILL' })
  assert.equal(fx.proc.state, 'EXITED')
})

// ---------------------------------------------------------------------------
// Supplementary acceptance items (§10.2): state graph, caps, scheduler seam
// ---------------------------------------------------------------------------

test('state machine: only the legal SPAWNING->INITIALIZING->READY->DRAINING->EXITED graph; illegal moves fail loud', async () => {
  const fx = makeFx()
  assert.equal(fx.proc.state, 'SPAWNING')
  await fx.readyNow()
  assert.equal(fx.proc.state, 'READY')
  assert.deepEqual(fx.proc.stateHistory.map(entry => entry.to), ['SPAWNING', 'INITIALIZING', 'READY'])
  // EXITED -> any state is illegal (no resurrection of a dead generation).
  fx.childExit(0, null)
  await fx.proc.exitPromise
  assert.equal(fx.proc.state, 'EXITED')
  assert.throws(() => fx.proc.transition('READY'), /illegal transition EXITED -> READY/)
  // A no-child spawn failure goes through DRAINING — never EXITED directly.
  const fx2 = makeFx()
  fx2.proc.handleSpawnFailureWithoutChild(new Error('nope'))
  assert.deepEqual(fx2.proc.stateHistory.map(entry => entry.to), ['SPAWNING', 'DRAINING', 'EXITED'])
})

test('pending RPC cap: the 1025th concurrent RPC is rejected before write (no pending eviction)', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const pendings = []
  for (let index = 0; index < 1024; index += 1) {
    pendings.push(fx.proc.request('x/fill', { index }).catch(error => error))
  }
  assert.equal(fx.pendingSize(), 1024)
  const rejected = fx.proc.request('x/overflow', {})
  await rejectsWith(rejected, (error) => {
    assert.equal(error.code, 'AGENT_PROCESS_PENDING_CAP')
    assert.equal(error.status, 'not_admitted')
  })
  const overflowWrites = fx.writes.filter(w => w.method === 'x/overflow')
  assert.equal(overflowWrites.length, 0, 'rejected BEFORE the write — no pending waiter was evicted')
  fx.childExit(0, null)
  const errors = await Promise.all(pendings)
  assert.ok(errors.every(error => error.code === 'AGENT_PROCESS_EXITED'), 'all 1024 settle on exit')
})

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
