import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { json, proofFixture } from '../helpers/restart-quiescence-fixture.js'

function reseal(fx, dir, name, digestField, change) {
  const path = join(dir, name)
  const receipt = JSON.parse(readFileSync(path, 'utf8'))
  change(receipt)
  const bytes = json(receipt)
  writeFileSync(path, bytes)
  fx.bundle[digestField[0]][digestField[1]] = createHash('sha256').update(bytes).digest('hex')
  writeFileSync(fx.bundleFile, json(fx.bundle))
}

function planControlledStop(fx, atWallMs) {
  const method = 'trusted_cp_controlled_stop_v1'
  const receipt = json({
    operationId: fx.bundle.recoveryCutover.operationId,
    hostId: fx.bundle.recoveryCutover.hostId,
    method, atWallMs,
  })
  writeFileSync(join(fx.evidenceDir, 'controlled-stop.json'), receipt)
  fx.bundle.controlledStop = {
    method, receiptSha256: createHash('sha256').update(receipt).digest('hex'), atWallMs,
  }
  fx.startup.recoveryPlanStopsRuntime = true
  writeFileSync(fx.bundleFile, json(fx.bundle))
}

for (const [name, mutate, reason] of [
  ['B1 floor time missing', fx => reseal(fx, fx.deploymentDir, 'floor-proven.json', ['deploymentProof', 'floorProvenReceiptSha256'], r => { delete r.provedAtWallMs }), 'V10_deployment_time_invalid'],
  ['B1 validator time string', fx => reseal(fx, fx.deploymentDir, 'validator-installed.json', ['deploymentProof', 'validatorInstalledReceiptSha256'], r => { r.installedAtWallMs = '90' }), 'V10_deployment_time_invalid'],
  ['B1 inhibition time missing', fx => reseal(fx, fx.evidenceDir, 'launch-sources-inhibited.json', ['recoveryCutover', 'launchSourcesInhibitedReceiptSha256'], r => { delete r.atWallMs }), 'V9_receipt_time_invalid'],
  ['B2 inhibition after authorization', fx => reseal(fx, fx.evidenceDir, 'launch-sources-inhibited.json', ['recoveryCutover', 'launchSourcesInhibitedReceiptSha256'], r => { r.atWallMs = fx.bundle.recoveryCutover.authorizedStartupAtWallMs + 1 }), 'V9_window_order_invalid'],
  ['B2 quiescence before inhibition', fx => { const time = fx.bundle.recoveryCutover.windowOpenedAtWallMs + 1; fx.bundle.recoveryCutover.oldTreeQuiescedAtWallMs = time; reseal(fx, fx.evidenceDir, 'old-tree-quiesced.json', ['recoveryCutover', 'oldTreeQuiescedReceiptSha256'], r => { r.atWallMs = time }) }, 'V9_window_order_invalid'],
  ['B2 subject history after cut', fx => { fx.bundle.recoveryCutover.windowOpenedAtWallMs = 1; writeFileSync(fx.bundleFile, json(fx.bundle)) }, 'V9_subject_after_cut'],
  ['B2 stop before deployment proof', fx => planControlledStop(fx, fx.bundle.recoveryCutover.windowOpenedAtWallMs - 30), 'V7_stop_order_invalid'],
]) {
  test(`NEG-RQ reviewed ${name} rejects without settlement`, (t) => {
    const fx = proofFixture(cleanup => t.after(cleanup))
    mutate(fx)
    const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
    const before = readFileSync(fx.persistenceFile)
    const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir, deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
    assert.equal(result[0].status, 'rejected')
    assert.equal(result[0].reason, reason)
    assert.deepEqual(readFileSync(fx.persistenceFile), before)
    assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
  })
}

test('ACC-RQ-007 planned stop within the prospective cut verifies without historical floor inference', (t) => {
  const fx = proofFixture(cleanup => t.after(cleanup))
  planControlledStop(fx, fx.bundle.recoveryCutover.windowOpenedAtWallMs + 15)
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir, deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.equal(result[0].status, 'settled', JSON.stringify(result))
})

test('ACC-RQ-001 one startup bundle settles only its exact old turn, preserving unknown outcome and null exit', (t) => {
  const fx = proofFixture(cleanup => t.after(cleanup))
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
  const fx = proofFixture(cleanup => t.after(cleanup))
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
    const fx = proofFixture(cleanup => t.after(cleanup))
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
  const fx = proofFixture(cleanup => t.after(cleanup))
  writeFileSync(join(fx.evidenceDir, 'second.bundle.json'), json(fx.bundle))
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const before = readFileSync(fx.persistenceFile)
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir, deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.deepEqual(result.map(row => row.reason), ['duplicate_subject_bundle', 'duplicate_subject_bundle'])
  assert.deepEqual(readFileSync(fx.persistenceFile), before)
})

for (const [name, secondName, mutate, replaceDuringVerify] of [
  ['stable differing duplicate', 'aaa.bundle.json', b => { b.recoveryCutover.startupNonce = 'different-nonce' }, false],
  ['stable malformed duplicate', 'aaa.bundle.json', b => { b.bundleSchemaVersion = 999 }, false],
  ['replacement collision before subject', 'aaa.bundle.json', b => { b.subject.reconciliationHandle = 'other-handle'; b.subject.turnExecutionId = 'other-handle' }, true],
  ['replacement collision after subject', 'zzz.bundle.json', b => { b.subject.reconciliationHandle = 'other-handle'; b.subject.turnExecutionId = 'other-handle' }, true],
]) {
  test(`NEG-RQ-007 ${name} is batch zero-write`, t => {
    const fx = proofFixture(cleanup => t.after(cleanup))
    const secondPath = join(fx.evidenceDir, secondName)
    const second = structuredClone(fx.bundle)
    mutate(second)
    writeFileSync(secondPath, json(second))
    if (replaceDuringVerify) {
      const originalStat = fx.io.stat
      let observations = 0
      fx.io.stat = path => {
        if (path === secondPath && ++observations === 3) writeFileSync(secondPath, json(fx.bundle))
        return originalStat(path)
      }
    }
    const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
    const recordBefore = JSON.stringify(store.records.get(fx.handle))
    const durableBefore = readFileSync(fx.persistenceFile)
    const emitted = []
    store.onTurnReconciled(event => emitted.push(event))
    const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
      deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
    assert.deepEqual(result.map(row => row.status), ['rejected', 'rejected'], JSON.stringify(result))
    assert.equal(JSON.stringify(store.records.get(fx.handle)), recordBefore)
    assert.deepEqual(readFileSync(fx.persistenceFile), durableBefore)
    assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
    assert.equal(emitted.length, 0)
  })
}

test('NEG-RQ-007 same-subject bytes replaced during verification are zero-write', t => {
  const fx = proofFixture(cleanup => t.after(cleanup))
  const originalStat = fx.io.stat
  let observations = 0
  fx.io.stat = path => {
    if (path === fx.bundleFile && ++observations === 3) writeFileSync(fx.bundleFile, `${json(fx.bundle)}\n`)
    return originalStat(path)
  }
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const recordBefore = JSON.stringify(store.records.get(fx.handle))
  const durableBefore = readFileSync(fx.persistenceFile)
  const emitted = []
  store.onTurnReconciled(event => emitted.push(event))
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
    deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.deepEqual(result.map(row => row.reason), ['bundle_subject_scan_changed'])
  assert.equal(JSON.stringify(store.records.get(fx.handle)), recordBefore)
  assert.deepEqual(readFileSync(fx.persistenceFile), durableBefore)
  assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
  assert.equal(emitted.length, 0)
})

function twoSubjectsOneWindow(t) {
  const fx = proofFixture(cleanup => t.after(cleanup))
  const extra = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'old-extra' })
  const secondHandle = extra.mintTurnExecution({ agentId: 'agt_extra', processGeneration: 1, sessionId: 'main' })
  extra.markAdmitted(secondHandle, { eventWatermarkSeq: 0, promptRequestId: 'extra-prompt',
    deadlineAtWallMs: Date.now() + 1000 })
  extra.markPromptWriteAttempted(secondHandle)
  const blocked = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'extra-intermediate' })
  const record = blocked.records.get(secondHandle)
  const second = structuredClone(fx.bundle)
  second.subject = { reconciliationHandle: secondHandle, turnExecutionId: secondHandle,
    runtimeEpoch: record.runtimeEpoch, agentId: record.agentId, processGeneration: record.processGeneration }
  second.epochRetirement.retiredEpoch = record.runtimeEpoch
  second.recoveryCutover.subjectPreimageSha256 = createHash('sha256').update(JSON.stringify(record)).digest('hex')
  writeFileSync(join(fx.evidenceDir, 'zzz.bundle.json'), json(second))
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const before = readFileSync(fx.persistenceFile)
  const recordsBefore = [fx.handle, secondHandle].map(handle => JSON.stringify(store.records.get(handle)))
  const emitted = []
  store.onTurnReconciled(event => emitted.push(event))
  return { fx, store, secondHandle, before, recordsBefore, emitted }
}

for (const [name, continuity] of [
  ['lost during batch', call => call === 1],
  ['loss followed by positive during batch', call => call !== 1],
  ['lost after batch before settlement', call => call <= 2],
]) {
  test(`NEG-RQ-003 same-window ${name} rejects both cached proofs`, t => {
    const { fx, store, secondHandle, before, recordsBefore, emitted } = twoSubjectsOneWindow(t)
    let challenges = 0
    fx.io.challengeWindow = (_fd, challenge) => {
      const held = continuity(++challenges)
      return { ...challenge, exclusiveWindowHeld: held, launchSourcesStillInhibited: held, windowClosed: !held }
    }
    const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
      deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
    assert.deepEqual(result.map(row => row.status), ['rejected', 'rejected'], JSON.stringify(result))
    assert.deepEqual([fx.handle, secondHandle].map(handle => JSON.stringify(store.records.get(handle))), recordsBefore)
    assert.deepEqual(readFileSync(fx.persistenceFile), before)
    assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
    assert.equal(store.activeFenceForAgent('agt_extra').handle, secondHandle)
    assert.equal(emitted.length, 0)
  })
}

test('ACC-RQ-003 stable shared window settles both distinct subjects once', t => {
  const { fx, store, secondHandle, emitted } = twoSubjectsOneWindow(t)
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
    deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.deepEqual(result.map(row => row.status), ['settled', 'settled'], JSON.stringify(result))
  assert.equal(store.activeFenceForAgent('agt_subject'), null)
  assert.equal(store.activeFenceForAgent('agt_extra'), null)
  assert.equal(store.records.get(fx.handle).terminationEvidence, 'restart_quiescence_proven')
  assert.equal(store.records.get(secondHandle).terminationEvidence, 'restart_quiescence_proven')
  assert.equal(emitted.length, 2)
})

test('NEG-RQ-003 transient window-lock stat failure remains sticky after recovery', t => {
  const { fx, store, secondHandle, before, recordsBefore, emitted } = twoSubjectsOneWindow(t)
  const originalStat = fx.io.stat
  let windowStats = 0
  fx.io.stat = path => {
    if (path === join(fx.evidenceDir, 'window.lock') && ++windowStats === 2) {
      throw Object.assign(new Error('transient window lock absence'), { code: 'ENOENT' })
    }
    return originalStat(path)
  }
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
    deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.deepEqual(result.map(row => row.status), ['rejected', 'rejected'], JSON.stringify(result))
  assert.deepEqual([fx.handle, secondHandle].map(handle => JSON.stringify(store.records.get(handle))), recordsBefore)
  assert.deepEqual(readFileSync(fx.persistenceFile), before)
  assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
  assert.equal(store.activeFenceForAgent('agt_extra').handle, secondHandle)
  assert.equal(emitted.length, 0)
})

test('NEG-RQ-018 shared window lost between settlements leaves second record untouched', t => {
  const { fx, store, secondHandle, recordsBefore, emitted } = twoSubjectsOneWindow(t)
  let held = true
  fx.io.challengeWindow = (_fd, challenge) => ({ ...challenge,
    exclusiveWindowHeld: held, launchSourcesStillInhibited: held, windowClosed: !held })
  store.onTurnReconciled(() => { held = false })
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
    deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.deepEqual(result.map(row => row.status), ['settled', 'rejected'], JSON.stringify(result))
  assert.equal(result[1].reason, 'window_continuity_lost')
  assert.equal(store.activeFenceForAgent('agt_subject'), null)
  assert.equal(JSON.stringify(store.records.get(secondHandle)), recordsBefore[1])
  assert.equal(store.activeFenceForAgent('agt_extra').handle, secondHandle)
  assert.equal(emitted.length, 1)
  const reopened = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'later-epoch' })
  assert.equal(JSON.stringify(reopened.records.get(secondHandle)), recordsBefore[1])
})

test('NEG-RQ-008 replay of a valid already-settled bundle is settle-once audit only', (t) => {
  const fx = proofFixture(cleanup => t.after(cleanup))
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

for (const [name, priorSettlement] of [
  ['different business result', { lateOutcome: 'late_completed', outcomeEvidence: 'exact_terminal_then_idle' }],
  ['different termination evidence', { lateOutcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit', exitObserved: true }],
]) {
  test(`NEG-RQ-002 settled ${name} fails V8 P5 with zero-write`, t => {
    const fx = proofFixture(cleanup => t.after(cleanup))
    const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
    assert.equal(store.settleLate(fx.handle, priorSettlement).won, true)
    const recordBefore = JSON.stringify(store.records.get(fx.handle))
    const durableBefore = readFileSync(fx.persistenceFile)
    const emitted = []
    store.onTurnReconciled(event => emitted.push(event))
    const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
      deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
    assert.deepEqual(result.map(row => row.status), ['rejected'], JSON.stringify(result))
    assert.match(result[0].reason, /^V8_.*P5/)
    assert.equal(JSON.stringify(store.records.get(fx.handle)), recordBefore)
    assert.deepEqual(readFileSync(fx.persistenceFile), durableBefore)
    assert.equal(emitted.length, 0)
  })
}

test('ACC-RQ-007 persistence failure rolls the exact record back and leaves its fence active', (t) => {
  const fx = proofFixture(cleanup => t.after(cleanup))
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
