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
import { resolveTrustedNativeToolPolicy } from '../../../agent-provisioning/src/trusted-native-tool-policy.js'

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
  assert.ok(elapsed >= 650 && elapsed < 850, `B02 sleep is clamped to the absolute 700ms deadline (elapsed ${elapsed}ms)`)
  assert.ok(fx.writes.filter(w => w.method === 'initialize').length >= 2, 'retries happened')
  fx.childExit(1, null)
  await fx.proc.exitPromise
})

test('trusted native policy is sent at initialize and readiness requires its exact acknowledgement', async () => {
  const nativeToolPolicy = resolveTrustedNativeToolPolicy({
    version: 1,
    agentId: 'agt_fx',
    mode: 'native-allowlist',
    allowedCalls: [{ toolName: 'read' }],
  }, 'agt_fx')
  const fx = makeFx({ nativeToolPolicy })
  assert.equal(Object.getOwnPropertyDescriptor(fx.proc, 'nativeToolPolicy').writable, false)
  const ready = fx.proc.ready()
  await fx.tick()

  const initialize = fx.writes.find((write) => write.method === 'initialize')
  assert.deepEqual(initialize.params.nativeToolPolicy, nativeToolPolicy)
  fx.emit({ id: initialize.id, result: {
    registeredProviders: [fx.proc.provider],
    nativeToolPolicy: {
      version: 1,
      agentId: 'agt_fx',
      policyDigest: nativeToolPolicy.policyDigest,
    },
  } })
  await ready
  assert.equal(fx.proc.state, 'READY')
})

test('trusted native policy acknowledgement mismatch fails initialize before readiness', async () => {
  const nativeToolPolicy = resolveTrustedNativeToolPolicy({
    version: 1,
    agentId: 'agt_fx',
    mode: 'native-allowlist',
    allowedCalls: [{ toolName: 'read' }],
  }, 'agt_fx')
  const fx = makeFx({ nativeToolPolicy })
  const ready = fx.proc.ready()
  await fx.tick()
  const initialize = fx.writes.find((write) => write.method === 'initialize')

  fx.emit({ id: initialize.id, result: {
    registeredProviders: [fx.proc.provider],
    nativeToolPolicy: { version: 1, agentId: 'agt_fx', policyDigest: '0'.repeat(64) },
  } })
  await assert.rejects(ready, { code: 'AGENT_PROCESS_NATIVE_TOOL_POLICY_ACK_MISMATCH' })
  assert.equal(fx.writes.filter((write) => write.method === 'initialize').length, 1)
  assert.equal(fx.proc.state, 'DRAINING')
  fx.childExit(1, null)
  await fx.proc.exitPromise
})

test('legacy initialize omits trusted native policy and accepts the existing acknowledgement', async () => {
  const fx = makeFx()
  await fx.readyNow()

  const initialize = fx.writes.find((write) => write.method === 'initialize')
  assert.equal(Object.hasOwn(initialize.params, 'nativeToolPolicy'), false)
  assert.equal(fx.proc.state, 'READY')
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
