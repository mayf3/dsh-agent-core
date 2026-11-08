import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { serializeDurableRecoveryStore } from '../../src/reconciliation/durable-file.js'

// R129 Gap B: a legacy unproven fence clear is admission-quarantined
// (admissionBlockerForAgent), but the D6 abandonment scope excluded cleared
// records — the quarantined class had NO release path. After the fix the D6
// owner-risk acceptance covers the class, and only that acceptance releases
// the quarantine; pre-D6 markers and non-legacy cleared records stay put.

function legacyClearedFixture(t, { withOldMarker = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'legacy-release-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'recovery.json')
  const store = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'gapb-unit' })
  const handle = store.mintTurnExecution({ agentId: 'agt_legacy', processGeneration: 1, sessionId: 'main' })
  store.markPromptWriteAttempted(handle)
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  store.markRecoveryBlocked(handle, ['live_generation_ownership'], 'runtime_restart_ownership_unavailable')
  const doc = serializeDurableRecoveryStore(store)
  doc.records[0].fenceState = 'cleared'
  if (withOldMarker) doc.records[0].adminAbandonment = { declarationId: 'historical-pre-d6', declaredAt: 1 }
  writeFileSync(file, JSON.stringify(doc))
  const reopened = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'gapb-next' })
  return { root, file, store: reopened, handle }
}

test('legacy-cleared record is admission-quarantined and reported as stuck (D6-visible)', t => {
  const { store, handle } = legacyClearedFixture(t)
  assert.notEqual(store.admissionBlockerForAgent('agt_legacy'), null)
  const stuck = store.stuckFenceWithoutDurableExitEvidenceForAgent('agt_legacy')
  assert.notEqual(stuck, null)
  assert.equal(stuck.handle, handle)
})

test('GREEN: D6 owner-risk abandonment covers the legacy-cleared class and releases admission quarantine', t => {
  const { store, handle } = legacyClearedFixture(t)
  const result = store.declareAdminAbandonment({
    agentId: 'agt_legacy', declarationId: 'r129-gapb-release', ownerRiskAcceptance: true,
  })
  assert.deepEqual(result.abandonedHandles, [handle])
  // Admission unblocks.
  assert.equal(store.admissionBlockerForAgent('agt_legacy'), null)
  // The record itself stays fenced + outcome_unknown + no-replay.
  const record = store.requireRecord(handle)
  assert.equal(record.fenceState, 'cleared')
  assert.equal(record.initialOutcome, 'outcome_unknown')
  assert.equal(record.settlementResult, null)
  assert.equal(record.terminationEvidence, null)
  assert.equal((record.audit ?? []).some(e => e.kind === 'owner_risk_acceptance_unproven_termination'), true)
})

test('GREEN: a pre-D6 marker without the acceptance audit keeps the quarantine (never restamped)', t => {
  const { store } = legacyClearedFixture(t, { withOldMarker: true })
  assert.notEqual(store.admissionBlockerForAgent('agt_legacy'), null)
  // Already-stamped records are never restamped (no-replay discipline), so a
  // pre-D6 marker cannot be upgraded in place; the record stays quarantined.
  // Production has no such records (all four legacy-cleared rows are
  // marker-free), so this documents the boundary rather than a live path.
  const result = store.declareAdminAbandonment({
    agentId: 'agt_legacy', declarationId: 'r129-gapb-release-old', ownerRiskAcceptance: true,
  })
  assert.deepEqual(result.abandonedHandles, [])
  assert.deepEqual(result.completedHandles, [])
  assert.notEqual(store.admissionBlockerForAgent('agt_legacy'), null)
})

test('GREEN: non-legacy cleared records (settled+cleared) are never adoption targets', t => {
  const root = mkdtempSync(join(tmpdir(), 'legacy-release-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'recovery.json')
  const store = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'gapb-unit' })
  const handle = store.mintTurnExecution({ agentId: 'agt_normal', processGeneration: 1, sessionId: 'main' })
  store.markPromptWriteAttempted(handle)
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  store.settleLate(handle, { lateOutcome: 'late_failed', terminationEvidence: 'child_real_exit' })
  store.markFenceCleared(handle)
  const result = store.declareAdminAbandonment({
    agentId: 'agt_normal', declarationId: 'r129-gapb-normal', ownerRiskAcceptance: true,
  })
  assert.deepEqual(result.abandonedHandles, [])
  assert.equal(store.admissionBlockerForAgent('agt_normal'), null)
})

test('GREEN: without acceptance flag the stamp records no release (default D6-off path)', t => {
  const { store } = legacyClearedFixture(t)
  const result = store.declareAdminAbandonment({
    agentId: 'agt_legacy', declarationId: 'r129-gapb-noacceptance',
  })
  assert.deepEqual(result.abandonedHandles, [handle0Of(result)])
  // Stamped but no acceptance audit → quarantine stays.
  assert.notEqual(store.admissionBlockerForAgent('agt_legacy'), null)
})
function handle0Of(result) { return result.abandonedHandles[0] }
