import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fixture, delivered, runEnded, advance, barrier, detail, engine, identity,
  snapshot, assertUnchanged, assertStale, receipt, intent, VISIT } from './fixture.js'

test('P0-A normal turn: old probe cannot settle a new delivered attempt in the same phase', { timeout: 10_000 }, async (t) => {
  const fx = fixture()
  const gate = barrier({ ok: true, body: { visibility: 'historical_participant' } })
  let running
  try {
    const old = await delivered(fx.writer)
    const observer = engine(fx, { readInstanceDetail: gate.call })
    running = observer.engine.reconcileOnce()
    await gate.arrived
    const current = await advance(fx.writer, old)
    assert.equal(current.phase, old.phase)
    const before = await snapshot(fx.writer)
    gate.release()
    const result = await running
    assert.equal(result.settled.length, 0)
    assert.equal(result.needsReview.length, 0)
    assertStale(result.staleObservations[0], old, 'reconciled')
    assert.equal(result.staleObservations[0].observation.judgment, 'business_commitment_observed')
    await assertUnchanged(fx.writer, before)
    assert.deepEqual(observer.calls.errors, [])
    const legal = await fx.writer.recordReconciled({ nodeVisitId: VISIT, ...identity(current),
      expectedPhase: current.phase, verdict: 'SETTLED', judgment: 'business_commitment_observed', reason: 'fresh exact probe' })
    assert.equal(legal.committed, true)
    receipt(t, 'normal-turn/same-phase/legal-same-generation', old, current, result.staleObservations[0])
  } finally { gate.release(); await running?.catch(() => {}); fx.cleanup() }
})

test('P0-A pending stale: same phase AND delivered timestamp across generations cannot pass CAS', { timeout: 10_000 }, async (t) => {
  const fx = fixture({ age: 2_000 })
  const gate = barrier(detail())
  let running
  try {
    const old = await delivered(fx.writer)
    const observer = engine(fx, { getTurnReconciliation: () => ({ state: 'pending' }), readInstanceDetail: gate.call })
    running = observer.engine.reconcileOnce()
    await gate.arrived
    const current = await advance(fx.writer, old)
    assert.equal(current.state, old.state)
    assert.equal(current.phase, old.phase)
    assert.equal(current.delivered.atMs, old.delivered.atMs)
    const before = await snapshot(fx.writer)
    gate.release()
    const result = await running
    assert.deepEqual(result.staleReentry, [])
    assertStale(result.staleObservations[0], old, 'stale_superseded')
    assert.equal(result.staleObservations[0].observation.observedWorkflowStateVersion, 7)
    await assertUnchanged(fx.writer, before)
    assert.deepEqual(observer.calls.errors, [])
    receipt(t, 'pending-stale/timestamp-collision', old, current, result.staleObservations[0])
  } finally { gate.release(); await running?.catch(() => {}); fx.cleanup() }
})

for (const scenario of [
  { name: 'terminal stale', age: 2_000, config: { staleNoProgressThresholdMs: 1_000, retryDelayMs: 5_000 } },
  { name: 'run-ended retry', age: 100, config: { staleNoProgressThresholdMs: 1_000, retryDelayMs: 50 } },
]) {
  test(`P0-A ${scenario.name}: old terminal candidate cannot supersede same-phase generation 2`, { timeout: 10_000 }, async (t) => {
    const fx = fixture({ age: scenario.age })
    const gate = barrier(detail())
    let running
    try {
      const old = await runEnded(fx.writer, await delivered(fx.writer))
      const observer = engine(fx, { config: scenario.config, readInstanceDetail: gate.call })
      running = observer.engine.reconcileOnce()
      await gate.arrived
      const current = await advance(fx.writer, old, { terminal: true })
      assert.equal(current.state, old.state)
      assert.equal(current.phase, old.phase)
      const before = await snapshot(fx.writer)
      gate.release()
      const result = await running
      assert.deepEqual(result.staleReentry, [])
      assertStale(result.staleObservations[0], old, 'stale_superseded')
      await assertUnchanged(fx.writer, before)
      assert.deepEqual(observer.calls.errors, [])
      receipt(t, scenario.name, old, current, result.staleObservations[0])
    } finally { gate.release(); await running?.catch(() => {}); fx.cleanup() }
  })
}

test('P0-A escalation receipt: old success cannot annotate a legal Owner-resumed successor', { timeout: 10_000 }, async (t) => {
  const fx = fixture({ maxAttemptsPerVisit: 1 })
  const gate = barrier({ ok: true, assistanceCaseId: '6d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77' })
  let running
  try {
    const old = await runEnded(fx.writer, await delivered(fx.writer))
    const observer = engine(fx, { escalateAttemptLimit: gate.call })
    running = observer.engine.reconcileOnce()
    await gate.arrived
    // Same accepted Owner-resume proof used by the existing acceptance suite;
    // this bypasses the automatic cap without weakening it or editing the log.
    const current = await advance(fx.writer, old, { ownerResume: true, terminal: true })
    assert.equal(current.retryReason, 'owner_assistance_resolved')
    const before = await snapshot(fx.writer)
    gate.release()
    const result = await running
    assertStale(result.staleObservations[0], old, 'escalation_requested')
    assert.equal(result.staleObservations[0].observation.lastAttemptId, old.attemptId)
    await assertUnchanged(fx.writer, before)
    assert.deepEqual(observer.calls.errors, [])
    const fresh = await fx.writer.recordEscalationRequested({ nodeVisitId: VISIT, ...identity(current),
      reason: 'ATTEMPTS_EXHAUSTED', attemptCount: 2, lastAttemptId: current.attemptId,
      dispatchIntentId: current.dispatchIntentId })
    assert.equal(fresh.committed, true)
    receipt(t, 'escalation/Owner-resume', old, current, result.staleObservations[0])
  } finally { gate.release(); await running?.catch(() => {}); fx.cleanup() }
})

test('P0-A concurrent scheduling: a held old poll cannot settle the other poller admission', { timeout: 10_000 }, async (t) => {
  const fx = fixture()
  const gate = barrier({ ok: true, body: { visibility: 'historical_participant' } })
  let running
  try {
    const old = await delivered(fx.writer)
    const observer = engine(fx, { readInstanceDetail: gate.call,
      fetchDuePage: async () => ({ ok: true, items: [intent()] }) })
    running = observer.engine.pollOnce()
    await gate.arrived
    // A second actual engine owns its own ledger handle and the normal due
    // admission path. Its stale probe confirms gen1 before the due sweep.
    let queries = 0
    const peer = engine({ ...fx, reader: fx.writer, age: 2_000 }, {
      getTurnReconciliation: () => ({ state: queries++ === 0 ? 'pending' : 'settled' }),
      fetchDuePage: async () => ({ ok: true, items: [intent()] }),
    })
    // The old Router turn converges after the stale probe and before the
    // admission quiescence check. Both are ordinary read-only observations.
    const peerResult = await peer.engine.pollOnce()
    assert.equal(peerResult.admissions[0].action, 'admitted')
    const current = fx.writer.get(VISIT)
    assert.equal(current.generation, 2)
    assert.equal(peer.calls.delivers.length, 1)
    const before = await snapshot(fx.writer)
    gate.release()
    const result = await running
    assertStale(result.reconciled.staleObservations[0], old, 'reconciled')
    assert.equal(result.admissions[0].action, 'already_attempted')
    assert.equal(observer.calls.delivers.length, 0)
    await assertUnchanged(fx.writer, before)
    assert.deepEqual(observer.calls.errors, [])
    assert.deepEqual(peer.calls.errors, [])
    receipt(t, 'concurrent-pollOnce/two-ledger-handles', old, current, result.reconciled.staleObservations[0])
  } finally { gate.release(); await running?.catch(() => {}); fx.cleanup() }
})
