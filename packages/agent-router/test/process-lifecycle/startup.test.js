/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 fault-injection suite —
 * startup faults + the legal state graph (C-001 / C-008 / C-009).
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
// Supplementary acceptance items (§10.2): the legal state graph
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
