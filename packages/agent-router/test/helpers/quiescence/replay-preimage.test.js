import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { compareQuiescenceReplayPreimage } from '../../../src/reconciliation/quiescence-replay-preimage.js'

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const handle = 'turn:fixture-epoch:a2:g1:s256'

function fixture() {
  const record = {
    handle, reconciliationHandle: handle, turnExecutionId: handle,
    runtimeEpoch: 'fixture-epoch', agentId: 'agt_hr-agent', processGeneration: 1,
    state: 'blocked', queryState: 'pending', initialOutcome: 'outcome_unknown', recoveryState: 'blocked',
    failureReason: 'runtime_restart_ownership_unavailable',
    terminationEvidence: null, exitObservedAt: null, fenceState: 'active',
  }
  const preimage = sha256(JSON.stringify(record))
  const bundle = {
    subject: { reconciliationHandle: handle, turnExecutionId: handle,
      runtimeEpoch: record.runtimeEpoch, agentId: record.agentId,
      processGeneration: record.processGeneration },
    epochRetirement: { retiredEpoch: record.runtimeEpoch },
    hostCensus: { operationId: 'op-fixture', hostId: 'fixture-host',
      executedAtWallMs: 20, runtimeTreeProcessCount: 0 },
    holderCheck: { operationId: 'op-fixture', executedAtWallMs: 21,
      openHolderCount: 0 },
    recoveryCutover: { operationId: 'op-fixture', hostId: 'fixture-host',
      startupNonce: 'fixture-nonce', subjectPreimageSha256: preimage,
      launchAuthorizationReceiptSha256: 'a'.repeat(64),
      oldTreeQuiescedAtWallMs: 10, authorizedStartupAtWallMs: 30 },
  }
  const bundleBytes = Buffer.from(JSON.stringify(bundle))
  const commitment = {
    receiptVersion: 1, operationId: 'op-fixture', hostId: 'fixture-host',
    startupNonce: 'fixture-nonce', reconciliationHandle: handle,
    subject: { turnExecutionId: handle, runtimeEpoch: record.runtimeEpoch,
      agentId: record.agentId, processGeneration: record.processGeneration },
    subjectPreimageSha256: preimage,
    launchAuthorizationReceiptSha256: 'a'.repeat(64),
    bundleSha256: sha256(bundleBytes), bundleByteLength: bundleBytes.length,
    sealedAtWallMs: 101, producerId: 'trusted root recovery control plane',
  }
  return { record, bundle, bundleBytes, commitment,
    consumingRuntimeEpoch: 'consuming-epoch',
    durableRuntimeEpochs: new Set(['fixture-epoch', 'consuming-epoch']) }
}

function changedBundle(original, change) {
  const bundle = structuredClone(original.bundle)
  change(bundle)
  const bundleBytes = Buffer.from(JSON.stringify(bundle))
  return { ...original, bundle, bundleBytes,
    commitment: { ...original.commitment,
      bundleSha256: sha256(bundleBytes), bundleByteLength: bundleBytes.length } }
}

function settledRecord(record) {
  return { ...record, state: 'settled', queryState: 'settled',
    recoveryState: 'settled', failureReason: null, fenceState: 'cleared',
    settlementResult: 'terminated_without_outcome',
    lateOutcome: 'terminated_without_outcome',
    terminationEvidence: 'restart_quiescence_proven' }
}

test('V2 V4 rejects non-retired, absent, or consuming epochs before either branch', () => {
  const original = fixture()
  const bad = [
    { ...original, consumingRuntimeEpoch: original.record.runtimeEpoch },
    { ...original, durableRuntimeEpochs: new Set(['consuming-epoch']) },
    { ...original, durableRuntimeEpochs: ['fixture-epoch'] },
    changedBundle(original, bundle => { bundle.epochRetirement.retiredEpoch = 'other-epoch' }),
  ]
  for (const input of bad) {
    assert.throws(() => compareQuiescenceReplayPreimage(input), /V4_quiescence_epoch_invalid/)
    assert.throws(() => compareQuiescenceReplayPreimage({
      ...input, record: settledRecord(input.record),
    }), /V4_quiescence_epoch_invalid/)
  }
})

test('V2 V5 rejects nonzero, cross-operation, or out-of-window observations', () => {
  const original = fixture()
  const bad = [
    changedBundle(original, bundle => { bundle.hostCensus.runtimeTreeProcessCount = 1 }),
    changedBundle(original, bundle => { bundle.holderCheck.openHolderCount = 1 }),
    changedBundle(original, bundle => { bundle.hostCensus.operationId = 'other-operation' }),
    changedBundle(original, bundle => { bundle.hostCensus.hostId = 'other-host' }),
    changedBundle(original, bundle => { bundle.holderCheck.operationId = 'other-operation' }),
    changedBundle(original, bundle => { bundle.hostCensus.executedAtWallMs = 10 }),
    changedBundle(original, bundle => { bundle.holderCheck.executedAtWallMs = 30 }),
    changedBundle(original, bundle => { bundle.recoveryCutover.authorizedStartupAtWallMs = 10 }),
  ]
  for (const input of bad) {
    assert.throws(() => compareQuiescenceReplayPreimage(input), /V5_quiescence_census_invalid/)
    assert.throws(() => compareQuiescenceReplayPreimage({
      ...input, record: settledRecord(input.record),
    }), /V5_quiescence_census_invalid/)
  }
})

test('V2 pending preimage and settled replay candidate use the original commitment', () => {
  const original = fixture()
  const pendingBefore = JSON.stringify(original.record)
  assert.equal(compareQuiescenceReplayPreimage(original).branch, 'pending')
  assert.equal(JSON.stringify(original.record), pendingBefore)

  const settled = settledRecord(original.record)
  assert.notEqual(sha256(JSON.stringify(settled)),
                  original.bundle.recoveryCutover.subjectPreimageSha256)
  const settledBefore = JSON.stringify(settled)
  assert.equal(compareQuiescenceReplayPreimage({ ...original, record: settled }).branch,
               'settled_exact_replay_candidate')
  assert.equal(JSON.stringify(settled), settledBefore)
})

test('V2 replay rejects changed bytes, preimage, key, or settled outcome without touching record', () => {
  const original = fixture()
  const settled = settledRecord(original.record)
  const before = JSON.stringify(settled)
  const reject = changed => {
    assert.throws(() => compareQuiescenceReplayPreimage({
      ...original, record: settled, ...changed,
    }), /QUiescence|quiescence|V[89]/)
    assert.equal(JSON.stringify(settled), before)
  }
  reject({ commitment: null })
  reject({ bundleBytes: Buffer.from(`${original.bundleBytes.toString()} `) })
  reject({ commitment: { ...original.commitment, subjectPreimageSha256: 'b'.repeat(64) } })
  reject({ commitment: { ...original.commitment, startupNonce: 'other-nonce' } })
  reject({ commitment: { ...original.commitment, privatePayload: 'forbidden' } })
  reject({ record: { ...settled, terminationEvidence: 'child_real_exit' } })
  reject({ record: { ...settled, settlementResult: 'late_completed' } })
  reject({ record: { ...settled, fenceState: 'armed' } })
  reject({ record: { ...settled, queryState: 'pending' } })
})

test('V2 pending record does not accept a changed durable preimage', () => {
  const original = fixture()
  assert.throws(() => compareQuiescenceReplayPreimage({
    ...original, record: { ...original.record, failureReason: 'other' },
  }), /V8|V9/)
})
