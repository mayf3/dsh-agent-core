/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 fault-injection suite —
 * the shutdown model rows (C-020..C-022).
 *
 * Every test maps to one §10.3 table row and asserts its unique oracle
 * with the exact S/W/K/R counters and the R[...]/P[...]/F[...] snapshots.
 * Deterministic: the REAL AgentProcess class with a fake OS child
 * (helpers/fake-child.js).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx, firstHandle, rejectsWith, slotSeq } from './helpers.js'

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

test('B14 graceful ACK waits the remaining grace and shutdown awaits real exitPromise', async () => {
  const fx = makeFx({ deadlines: { shutdownGraceMs: 180 } })
  await fx.readyNow()
  let settled = false
  const shutdown = fx.proc.shutdown().then(value => { settled = true; return value })
  await fx.tick()
  fx.respondTo('shutdown', { ok: true })
  await fx.sleep(80)
  assert.equal(fx.counts().killSignals, 0, 'ACK does not trigger immediate SIGKILL')
  assert.equal(settled, false)
  await fx.sleep(140)
  assert.equal(fx.counts().killSignals, 1, 'kill only after the absolute grace')
  assert.equal(settled, false, 'kill request is not real exit')
  fx.childExit(null, 'SIGKILL')
  await shutdown
  assert.equal(settled, true)
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
  const turnError = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  assert.equal(fx.store.getTurnReconciliation(turnError.reconciliationHandle).snapshot.initialOutcome, 'outcome_unknown')
  assert.equal(fx.pendingSize(), 0, 'pending-first cleanup completes before mismatch rejection')
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0, 'no graceful write on mismatch')
  assert.equal(fx.counts().killSignals, 0, 'kill count = 0 — never a guessed kill')
  assert.ok(fx.proc.boundedAudit.some(entry => entry.kind === 'ownership_mismatch'))
  assert.equal(fx.proc.state, 'DRAINING', 'REAP fence retained while the mismatched child awaits legitimate exit evidence')
  assert.equal(fx.fence(), turnError.reconciliationHandle)
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
