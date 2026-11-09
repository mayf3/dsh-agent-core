import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { readDurableRecoveryStore, serializeDurableRecoveryStore } from '../../src/reconciliation/durable-file.js'
import { promptFenceError } from '../../src/process/state-machine.js'
import { makeFx } from '../helpers/fake-child.js'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'recovery-compat-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'recovery.json')
  const store = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'compat-unit' })
  const handle = store.mintTurnExecution({ agentId: 'agt_legacy', processGeneration: 1, sessionId: 'main' })
  store.markPromptWriteAttempted(handle)
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  store.markRecoveryBlocked(handle, ['live_generation_ownership'], 'runtime_restart_ownership_unavailable')
  return { root, file, store, handle }
}

test('exact legacy tuple decodes without normalization; malformed neighbors still fail closed', t => {
  const { file, store, handle } = fixture(t)
  const doc = serializeDurableRecoveryStore(store)
  doc.records[0].fenceState = 'cleared'
  doc.records[0].adminAbandonment = { declarationId: 'historical', declaredAt: 1 }
  const write = value => writeFileSync(file, JSON.stringify(value))
  write(doc)
  const bytes = readFileSync(file)
  const reopened = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'unit-next' })
  assert.equal(reopened.businessAdmissionStatus().ready, true)
  const snapshot = reopened.getTurnReconciliation(handle).snapshot
  assert.equal(snapshot.legacyFormat, 'unproven_fence_clear')
  assert.equal(snapshot.state, 'recovering')
  assert.equal(snapshot.fenceState, 'cleared')
  assert.equal(snapshot.settlementResult, null)
  assert.equal(snapshot.terminationEvidence, null)
  assert.equal(snapshot.initialOutcome, 'outcome_unknown')
  assert.equal(promptFenceError(reopened, 'agt_legacy').fencedBy, handle)
  assert.equal(reopened.recoveryDiagnostic(handle).fencedBy, handle)
  assert.equal(reopened.markRecoveryBlocked(handle, ['child_real_exit'], 'not_proof'), false)
  assert.deepEqual(readFileSync(file), bytes)
  for (const delta of [
    { state: 'pending_unknown' }, { queryState: 'settled' }, { initialOutcome: null },
    { exitObservedAt: 1 }, { terminationEvidence: 'child_real_exit' },
    { settlementResult: 'terminated_without_outcome' }, { failureReason: null },
    { reapClaim: { phase: 'settled' } }, { adminAbandonment: { declarationId: '' } },
  ]) {
    const invalid = structuredClone(doc)
    Object.assign(invalid.records[0], delta)
    write(invalid)
    assert.throws(() => readDurableRecoveryStore(file), TypeError, JSON.stringify(delta))
    const blocked = new TurnReconciliationStore({ persistenceFile: file })
    assert.equal(blocked.businessAdmissionStatus().reason, 'durable_store_invalid')
  }
})

test('writer rejects pending/partial evidence and a prior bad clear with zero persistent/local effect', t => {
  const { file, store, handle } = fixture(t)
  const fx = makeFx({ reconciliationStore: store })
  fx.proc.activeUnknownFences.set(handle, { handle, sessionId: 'main' })
  fx.proc.activeUnknownFence = fx.proc.activeUnknownFences.get(handle)
  const record = store.requireRecord(handle)
  const initial = structuredClone(record)
  const bytes = readFileSync(file)
  for (const delta of [
    {}, { fenceState: 'cleared' }, { state: 'settled' },
    { state: 'settled', settlementResult: 'terminated_without_outcome' },
    { terminationEvidence: 'child_real_exit' },
    { state: 'settled', settlementResult: 'invented', terminationEvidence: 'child_real_exit' },
  ]) {
    Object.assign(record, initial, delta)
    const before = structuredClone(record)
    assert.throws(() => fx.proc.releaseFence(handle), { code: 'RECONCILIATION_FENCE_CLEAR_UNPROVEN' })
    assert.deepEqual(record, before)
    assert.equal(fx.proc.activeUnknownFences.has(handle), true)
    assert.deepEqual(readFileSync(file), bytes)
  }
  Object.assign(record, initial)
  assert.throws(() => fx.proc.releaseFence('missing-handle'), /unknown handle/)
  store.settleLate(handle, { lateOutcome: 'terminated_without_outcome', terminationEvidence: 'exact_started_then_idle' })
  fx.proc.releaseFence(handle)
  assert.equal(fx.proc.activeUnknownFences.size, 0)
  assert.equal(store.markFenceCleared(handle), false)
  assert.equal(store.requireRecord(handle).initialOutcome, 'outcome_unknown')
  assert.equal(store.requireRecord(handle).lateOutcome, 'terminated_without_outcome')
})

test('fence persistence failure rolls back the durable transition and retains the local fence', t => {
  const { root, file, store, handle } = fixture(t)
  store.settleLate(handle, { lateOutcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit' })
  const fx = makeFx({ reconciliationStore: store })
  fx.proc.activeUnknownFences.set(handle, { handle, sessionId: 'main' })
  fx.proc.activeUnknownFence = fx.proc.activeUnknownFences.get(handle)
  const bytes = readFileSync(file)
  const before = structuredClone(store.requireRecord(handle))
  const obstruction = join(root, 'not-a-directory')
  writeFileSync(obstruction, 'obstruction')
  store.persistenceFile = join(obstruction, 'recovery.json')
  assert.throws(() => fx.proc.releaseFence(handle))
  assert.deepEqual(store.requireRecord(handle), before)
  assert.deepEqual(readFileSync(file), bytes)
  assert.equal(fx.proc.activeUnknownFences.has(handle), true)
  assert.equal(store.businessAdmissionStatus().ready, false)
})

test('normal abandonment and exact settlement retain their distinct admission semantics', t => {
  const { store, handle } = fixture(t)
  store.declareAdminAbandonment({ agentId: 'agt_legacy', declarationId: 'valid', ownerRiskAcceptance: true })
  assert.equal(store.admissionBlockerForAgent('agt_legacy'), null)
  assert.equal(store.activeFenceForAgent('agt_legacy').handle, handle)
  assert.equal(store.requireRecord(handle).fenceState, 'active')
  store.settleLate(handle, { lateOutcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit' })
  assert.equal(store.markFenceCleared(handle), true)
  assert.equal(store.admissionBlockerForAgent('agt_legacy'), null)
})

test('answer digest survives cold open, another durable write and restart without answer text', t => {
  const { file, store, handle } = fixture(t)
  store.settleLate(handle, {
    lateOutcome: 'late_completed', outcomeEvidence: 'exact_terminal',
    terminationEvidence: 'exact_terminal_then_idle', finalAssistantOutput: { text: 'ok' },
  })
  const original = JSON.parse(readFileSync(file)).records[0].finalAssistantOutputEvidence
  assert.equal(original.sha256, '2689367b205c16ce32ed4200942b8b8b1e262dfc70d9bc9fbc77c49699a4f1df')
  const reopened = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'digest-next' })
  assert.equal(reopened.requireRecord(handle).finalAssistantOutput, null)
  reopened.persistDurable()
  const restarted = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'digest-restart' })
  restarted.persistDurable()
  const persisted = JSON.parse(readFileSync(file)).records[0]
  assert.deepEqual(persisted.finalAssistantOutputEvidence, original)
  assert.equal(persisted.finalAssistantOutput, null)
  assert.equal(persisted.lateOutcome, 'late_completed')
})
