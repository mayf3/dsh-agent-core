/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 fault-injection suite —
 * pending-RPC settlement and parent-RPC deadline rows (C-002 / C-003 / C-005).
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
// Parent-RPC deadlines (C-005)
// ---------------------------------------------------------------------------

test('PARENT_RPC_RESPONSE_WRITE_RESERVE: handler deadline aborts; ONE timeout response inside the reserve', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 1200 } })
  await fx.readyNow()
  let hookContext = null
  let aborted = false
  fx.proc.onRpcRequest = (method, params, deadlineCtx) => {
    hookContext = { method, ...deadlineCtx }
    deadlineCtx.signal.addEventListener('abort', () => { aborted = true })
    return new Promise(() => {}) // deliberately ignores AbortSignal forever
  }
  const relay = fx.proc.handleRpcRequest({
    requestId: 'r-1', method: 'agent-core/switchAgent', params: {}, turnExecutionId: 'turn:origin',
  })
  await fx.sleep(1400)
  await relay
  assert.equal(aborted, true, 'uncooperative handler receives cooperative abort')
  assert.equal(hookContext.turnExecutionId, 'turn:origin', 'wire carrier preserves the originating prompt token')
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

test('B03: expired inherited turn budget invokes no handler and writes no response', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 100 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'expire-parent-budget', {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-expired-parent' })
  await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  let handlerCalls = 0
  fx.proc.onRpcRequest = async () => { handlerCalls += 1 }
  await fx.proc.handleRpcRequest({ requestId: 'expired', method: 'agent-core/broker', params: {} })
  assert.equal(handlerCalls, 0)
  assert.equal(fx.writes.filter(write => write.method === 'rpc.response').length, 0)
  assert.equal(fx.counts().rpcResponseWriteAttempts, 0)
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
// Supplementary acceptance items (§10.2): pending cap
// ---------------------------------------------------------------------------

test('B04 known broken stdin takes precedence over pending/deadline guards and drains existing RPCs', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const pending = Array.from({ length: 1024 }, (_, index) => fx.proc.request('x/fill', { index }).catch(error => error))
  fx.child.stdin.writable = false
  await rejectsWith(fx.proc.request('x/closed', {}, undefined, { deadlineMono: 0 }), (error) => {
    assert.equal(error.code, 'AGENT_PROCESS_STDIN_NOT_WRITABLE')
  })
  await fx.tick()
  assert.equal(fx.pendingSize(), 0)
  assert.ok((await Promise.all(pending)).every(error => error.code === 'AGENT_PROCESS_UNAVAILABLE'))
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
