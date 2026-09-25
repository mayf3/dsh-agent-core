import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { json, proofFixture } from '../helpers/restart-quiescence-fixture.js'

test('ACC-RQ-001 one startup bundle settles only its exact old turn, preserving unknown outcome and null exit', (t) => {
  const fx = proofFixture(t)
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir, deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.deepEqual(result.map(row => row.status), ['settled'], JSON.stringify(result))
  const record = store.getTurnReconciliation(fx.handle)
  assert.equal(record.state, 'settled')
  assert.equal(record.snapshot.lateOutcome, 'terminated_without_outcome')
  assert.equal(record.snapshot.initialOutcome, 'outcome_unknown')
  assert.equal(record.snapshot.terminationEvidence, 'restart_quiescence_proven')
  assert.equal(record.snapshot.exitObservedAt, null)
  assert.equal(record.snapshot.failureReason, null)
  assert.equal(store.activeFenceForAgent('agt_subject'), null)
  const reopened = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'later-epoch' })
  assert.equal(reopened.getTurnReconciliation(fx.handle).snapshot.terminationEvidence, 'restart_quiescence_proven')
})

test('NEG-RQ-015 new evidence kind cannot enter through ordinary settlement constructors', (t) => {
  const fx = proofFixture(t)
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  assert.throws(() => store.settleLate(fx.handle, {
    lateOutcome: 'terminated_without_outcome', terminationEvidence: 'restart_quiescence_proven',
  }), /requires startup verification/)
  assert.throws(() => store.settleDirect(fx.handle, {
    outcome: 'completed', terminationEvidence: 'restart_quiescence_proven',
  }), /startup-only/)
  assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
})

for (const [name, damage, expected] of [
  ['subject agent differs', fx => { fx.bundle.subject.agentId = 'agt_other' }, 'V8_P3'],
  ['old tree still present', fx => { fx.bundle.hostCensus.runtimeTreeProcessCount = 1 }, 'V5_census_invalid'],
  ['bundle preimage digest differs', fx => { fx.bundle.recoveryCutover.subjectPreimageSha256 = 'f'.repeat(64) }, 'V9_preimage_mismatch'],
  ['floor proof is missing', fx => { fx.bundle.deploymentProof.floorProvenReceiptSha256 = 'f'.repeat(64) }, 'digest_mismatch'],
  ['launch authorization digest differs', fx => { fx.bundle.recoveryCutover.launchAuthorizationReceiptSha256 = 'f'.repeat(64) }, 'digest_mismatch'],
  ['controlled stop missing for planned restart', fx => { fx.startup.recoveryPlanStopsRuntime = true }, 'V7_stop_plan_mismatch'],
  ['window descriptor is absent', fx => { fx.startup.windowFd = -1 }, 'window_fd_missing'],
  ['host differs', fx => { fx.startup.hostId = 'foreign-host' }, 'V9_startup_binding_mismatch'],
]) {
  test(`NEG-RQ zero-write: ${name}`, (t) => {
    const fx = proofFixture(t)
    damage(fx)
    writeFileSync(fx.bundleFile, json(fx.bundle))
    const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
    const before = readFileSync(fx.persistenceFile)
    const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir, deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
    assert.deepEqual(result.map(row => row.status), ['rejected'])
    assert.equal(result[0].reason, expected)
    assert.deepEqual(readFileSync(fx.persistenceFile), before)
    assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
  })
}

test('NEG-RQ-007 two bundles for one handle reject both before either can settle', (t) => {
  const fx = proofFixture(t)
  writeFileSync(join(fx.evidenceDir, 'second.bundle.json'), json(fx.bundle))
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const before = readFileSync(fx.persistenceFile)
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir, deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.deepEqual(result.map(row => row.reason), ['duplicate_subject_bundle', 'duplicate_subject_bundle'])
  assert.deepEqual(readFileSync(fx.persistenceFile), before)
})

test('NEG-RQ-008 replay of a valid already-settled bundle is settle-once audit only', (t) => {
  const fx = proofFixture(t)
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const opts = { evidenceDir: fx.evidenceDir, deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io }
  assert.equal(store.consumeStartupQuiescence(opts)[0].status, 'settled')
  const before = store.getTurnReconciliation(fx.handle)
  const replay = store.consumeStartupQuiescence(opts)
  assert.equal(replay[0].status, 'duplicate_ignored')
  const after = store.getTurnReconciliation(fx.handle)
  assert.equal(after.snapshot.terminationEvidence, before.snapshot.terminationEvidence)
  assert.equal(after.snapshot.exitObservedAt, null)
  assert.equal(after.snapshot.audit.at(-1).kind, 'duplicate_ignored')
})

test('ACC-RQ-007 persistence failure rolls the exact record back and leaves its fence active', (t) => {
  const fx = proofFixture(t)
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const before = structuredClone(store.records.get(fx.handle))
  const original = store.persistDurable
  store.persistDurable = () => { throw new Error('injected persist failure') }
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir, deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  store.persistDurable = original
  assert.equal(result[0].status, 'rejected')
  assert.deepEqual(store.records.get(fx.handle), before)
  assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
})
