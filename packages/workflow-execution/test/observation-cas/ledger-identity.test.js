import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fixture, delivered, advance, identity, staleInput, snapshot,
  assertUnchanged, assertStale, runEnded, intent, VISIT } from './fixture.js'

function reconcileInput(attempt) {
  return { nodeVisitId: VISIT, ...identity(attempt), expectedPhase: attempt.phase,
    verdict: 'SETTLED', judgment: 'business_commitment_observed', reason: 'exact observed business fact' }
}

test('P0-A ledger identity: attempt ID and generation are independently required CAS fields', async (t) => {
  const fx = fixture()
  try {
    const old = await delivered(fx.writer)
    const current = await advance(fx.writer, old)
    for (const change of [
      { expectedAttemptId: old.attemptId },
      { expectedGeneration: 1 },
      identity(old),
    ]) {
      const before = await snapshot(fx.writer)
      const input = { ...reconcileInput(current), ...change }
      const result = await fx.reader.recordReconciled(input)
      assert.equal(result.action, 'stale_observation')
      assert.equal(result.committed, false)
      assert.equal(result.observation.expectedAttemptId, input.expectedAttemptId)
      assert.equal(result.observation.expectedGeneration, input.expectedGeneration)
      assert.equal(result.observation.reason, input.reason)
      await assertUnchanged(fx.writer, before)
    }
    assert.equal((await fx.reader.recordReconciled(reconcileInput(current))).committed, true)
    t.diagnostic('same phase generation1 -> generation2: ID-only mismatch rejected; generation-only mismatch rejected; both rejected; exact generation committed; new attempt/event bytes unchanged on rejection')
  } finally { fx.cleanup() }
})

test('P0-A stale settlement and escalation independently compare generation, retaining proposed facts', async () => {
  const fx = fixture()
  try {
    const old = await delivered(fx.writer)
    const current = await advance(fx.writer, old)
    const before = await snapshot(fx.writer)
    const result = await fx.reader.recordStaleSuperseded({ ...staleInput(current), expectedGeneration: 1 })
    assert.equal(result.action, 'stale_observation')
    assert.equal(result.observation.observedWorkflowStateVersion, 7)
    await assertUnchanged(fx.writer, before)
    assert.equal((await fx.writer.recordStaleSuperseded(staleInput(current))).committed, true)
    const terminal = fx.writer.get(VISIT)
    const escalatedBefore = await snapshot(fx.writer)
    const rejected = await fx.reader.recordEscalationRequested({ nodeVisitId: VISIT, ...identity(terminal),
      expectedGeneration: 1, reason: 'ATTEMPTS_EXHAUSTED', attemptCount: 2,
      lastAttemptId: terminal.attemptId, dispatchIntentId: terminal.dispatchIntentId })
    assert.equal(rejected.action, 'stale_observation')
    assert.equal(rejected.observation.reason, 'ATTEMPTS_EXHAUSTED')
    await assertUnchanged(fx.writer, escalatedBefore)
    assert.equal((await fx.reader.recordEscalationRequested({ nodeVisitId: VISIT, ...identity(terminal),
      reason: 'ATTEMPTS_EXHAUSTED', attemptCount: 2, lastAttemptId: terminal.attemptId,
      dispatchIntentId: terminal.dispatchIntentId })).committed, true)
  } finally { fx.cleanup() }
})

test('P0-A required identities: omitted/malformed CAS fields fail before any append', async () => {
  const fx = fixture()
  try {
    const attempt = await delivered(fx.writer)
    for (const fields of [
      { expectedAttemptId: undefined }, { expectedGeneration: undefined },
      { expectedAttemptId: '' }, { expectedGeneration: 0 }, { expectedGeneration: 1.5 },
    ]) {
      for (const [method, input] of [
        ['recordReconciled', reconcileInput(attempt)],
        ['recordStaleSuperseded', staleInput(attempt)],
        ['recordEscalationRequested', { nodeVisitId: VISIT, ...identity(attempt), reason: 'ATTEMPTS_EXHAUSTED' }],
        ['recordDeliveryFailed', { nodeVisitId: VISIT, ...identity(attempt), reason: 'delivery_rejected:TEST' }],
        ['recordRecoveryRefused', { nodeVisitId: VISIT, ...identity(attempt), authorityRef: 'test:ekr', refused: 'visit_changed' }],
      ]) {
        const before = await snapshot(fx.writer)
        await assert.rejects(fx.reader[method]({ ...input, ...fields }), TypeError)
        await assertUnchanged(fx.writer, before)
      }
    }
  } finally { fx.cleanup() }
})

test('P0-A same-generation phase CAS and terminal refusal retain their existing semantics', async () => {
  const fx = fixture()
  try {
    const attempt = await delivered(fx.writer)
    const before = await snapshot(fx.writer)
    const changed = await fx.writer.recordReconciled({ ...reconcileInput(attempt), expectedPhase: 'planned' })
    assert.equal(changed.committed, false)
    assert.equal(changed.cause, 'attempt_changed')
    await assertUnchanged(fx.writer, before)
    const terminal = await runEnded(fx.writer, attempt)
    const terminalBefore = await snapshot(fx.writer)
    const lost = await fx.reader.recordReconciled(reconcileInput(attempt))
    assert.equal(lost.committed, false)
    assert.equal(lost.cause, 'attempt_changed')
    await assertUnchanged(fx.writer, terminalBefore)
    await assert.rejects(fx.writer.recordReconciled(reconcileInput(terminal)), /terminal/)
    await assertUnchanged(fx.writer, terminalBefore)
  } finally { fx.cleanup() }
})

test('P0-A stale identity is recognized before a successor terminal guard', async () => {
  const fx = fixture()
  try {
    const old = await delivered(fx.writer)
    await advance(fx.writer, old, { terminal: true })
    const before = await snapshot(fx.writer)
    const rejected = await fx.reader.recordReconciled(reconcileInput(old))
    assertStale(rejected, old, 'reconciled')
    await assertUnchanged(fx.writer, before)
  } finally { fx.cleanup() }
})

test('P0-A public terminal wrappers reject old identities before invoking private append guards', async () => {
  const fx = fixture()
  try {
    const old = await delivered(fx.writer)
    const current = await advance(fx.writer, old)
    for (const [method, facts] of [
      ['recordDeliveryFailed', { reason: 'delivery_rejected:TEST' }],
      ['recordRecoveryRefused', { authorityRef: 'test:ekr', refused: 'visit_changed' }],
    ]) {
      const before = await snapshot(fx.writer)
      const rejected = await fx.reader[method]({ nodeVisitId: VISIT, ...identity(old), ...facts })
      assert.equal(rejected.action, 'stale_observation')
      assert.equal(rejected.observation.expectedAttemptId, old.attemptId)
      for (const [key, value] of Object.entries(facts)) assert.equal(rejected.observation[key], value)
      await assertUnchanged(fx.writer, before)
    }
    await fx.writer.recordDeliveryFailed({ nodeVisitId: VISIT, ...identity(current), reason: 'delivery_rejected:TEST' })
    assert.equal(fx.writer.get(VISIT).state, 'NEEDS_REVIEW')
  } finally { fx.cleanup() }

  const blocked = fixture()
  try {
    await blocked.writer.beginAttemptIfAbsent(intent())
    await blocked.writer.recordResolutionBlocked({ nodeVisitId: VISIT, code: 'agent_mapping_missing' })
    const fresh = blocked.writer.get(VISIT)
    await blocked.writer.recordRecoveryRefused({ nodeVisitId: VISIT, ...identity(fresh),
      authorityRef: 'test:ekr', refused: 'visit_changed' })
    assert.equal(blocked.writer.get(VISIT).state, 'NEEDS_REVIEW')
    assert.equal(blocked.writer.get(VISIT).phase, 'recovery_refused')
  } finally { blocked.cleanup() }
})
