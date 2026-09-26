/**
 * V2 RQ-003 V4/V5/V8/V9 structural comparison only. This pure gate does not
 * establish root custody, journal registration, a live window, or permission
 * to settle.
 * A startup consumer must independently prove those before using its result.
 */
import { createHash } from 'node:crypto'

const HASH = /^[a-f0-9]{64}$/
const RECEIPT_FIELDS = [
  'receiptVersion', 'operationId', 'hostId', 'startupNonce',
  'reconciliationHandle', 'subject', 'subjectPreimageSha256',
  'launchAuthorizationReceiptSha256', 'bundleSha256', 'bundleByteLength',
  'sealedAtWallMs', 'producerId',
]
const SUBJECT_FIELDS = [
  'turnExecutionId', 'runtimeEpoch', 'agentId', 'processGeneration',
]

function reject(code) {
  throw Object.assign(new Error(code), { code })
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactFields(value, fields) {
  return object(value) && Object.keys(value).length === fields.length
    && fields.every(field => Object.hasOwn(value, field))
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

/**
 * Compare a durable record with an externally resolved, immutable original
 * bundle commitment. `resolvedCommitment` must come from the separately
 * authenticated root journal; passing an object here proves no provenance.
 * Full closed-bundle parsing, a live window and the crash-interrupted active
 * fence path are outside this comparator. It returns only a structural branch
 * candidate and never mutates a store.
 */
export function compareQuiescenceReplayPreimage({
  record, bundleBytes, commitment: resolvedCommitment,
  consumingRuntimeEpoch, durableRuntimeEpochs,
}) {
  if (!Buffer.isBuffer(bundleBytes) || bundleBytes.length === 0
      || bundleBytes.length > 65536 || !exactFields(resolvedCommitment, RECEIPT_FIELDS)
      || !exactFields(resolvedCommitment.subject, SUBJECT_FIELDS)
      || !Number.isSafeInteger(resolvedCommitment.receiptVersion)
      || resolvedCommitment.receiptVersion < 1
      || !Number.isSafeInteger(resolvedCommitment.bundleByteLength)
      || resolvedCommitment.bundleByteLength !== bundleBytes.length
      || !Number.isSafeInteger(resolvedCommitment.sealedAtWallMs)
      || resolvedCommitment.sealedAtWallMs < 0
      || resolvedCommitment.producerId !== 'trusted root recovery control plane'
      || typeof resolvedCommitment.operationId !== 'string'
      || resolvedCommitment.operationId === ''
      || typeof resolvedCommitment.hostId !== 'string'
      || resolvedCommitment.hostId === ''
      || typeof resolvedCommitment.startupNonce !== 'string'
      || resolvedCommitment.startupNonce === ''
      || !HASH.test(resolvedCommitment.bundleSha256)
      || !HASH.test(resolvedCommitment.subjectPreimageSha256)
      || !HASH.test(resolvedCommitment.launchAuthorizationReceiptSha256)) {
    reject('V9_quiescence_commitment_invalid')
  }
  let bundle
  try { bundle = JSON.parse(bundleBytes.toString('utf8')) } catch { reject('V9_quiescence_bundle_invalid') }
  const subject = bundle?.subject
  const cut = bundle?.recoveryCutover
  if (!object(record) || !object(subject) || !object(cut)
      || typeof record.handle !== 'string' || record.handle === ''
      || typeof record.runtimeEpoch !== 'string' || record.runtimeEpoch === ''
      || typeof record.agentId !== 'string' || record.agentId === ''
      || !Number.isSafeInteger(record.processGeneration)
      || record.processGeneration < 1
      || (Object.hasOwn(record, 'reconciliationHandle') && record.handle !== record.reconciliationHandle)
      || (Object.hasOwn(record, 'turnExecutionId') && record.handle !== record.turnExecutionId)
      || subject.reconciliationHandle !== record.handle
      || subject.turnExecutionId !== record.handle
      || subject.runtimeEpoch !== record.runtimeEpoch
      || subject.agentId !== record.agentId
      || subject.processGeneration !== record.processGeneration
      || resolvedCommitment.reconciliationHandle !== record.handle
      || resolvedCommitment.subject.turnExecutionId !== record.handle
      || resolvedCommitment.subject.runtimeEpoch !== record.runtimeEpoch
      || resolvedCommitment.subject.agentId !== record.agentId
      || resolvedCommitment.subject.processGeneration !== record.processGeneration
      || record.initialOutcome !== 'outcome_unknown') {
    reject('V8_quiescence_subject_mismatch')
  }
  if (resolvedCommitment.operationId !== cut.operationId
      || resolvedCommitment.hostId !== cut.hostId
      || resolvedCommitment.startupNonce !== cut.startupNonce
      || resolvedCommitment.launchAuthorizationReceiptSha256
        !== cut.launchAuthorizationReceiptSha256
      || resolvedCommitment.subjectPreimageSha256 !== cut.subjectPreimageSha256
      || resolvedCommitment.bundleSha256 !== sha256(bundleBytes)) {
    reject('V9_quiescence_original_commitment_mismatch')
  }
  // These are value checks only. The startup consumer must bind runtime epochs
  // to the validated durable store and observations to trusted root receipts.
  if (!object(bundle.epochRetirement)
      || typeof consumingRuntimeEpoch !== 'string' || consumingRuntimeEpoch === ''
      || !(durableRuntimeEpochs instanceof Set)
      || bundle.epochRetirement.retiredEpoch !== record.runtimeEpoch
      || record.runtimeEpoch === consumingRuntimeEpoch
      || !durableRuntimeEpochs.has(record.runtimeEpoch)) {
    reject('V4_quiescence_epoch_invalid')
  }
  const census = bundle.hostCensus
  const holders = bundle.holderCheck
  const afterStop = cut.oldTreeQuiescedAtWallMs
  const beforeStartup = cut.authorizedStartupAtWallMs
  if (!object(census) || !object(holders)
      || !Number.isSafeInteger(afterStop) || afterStop < 0
      || !Number.isSafeInteger(beforeStartup) || beforeStartup <= afterStop
      || census.operationId !== cut.operationId || census.hostId !== cut.hostId
      || holders.operationId !== cut.operationId
      || census.runtimeTreeProcessCount !== 0 || holders.openHolderCount !== 0
      || !Number.isSafeInteger(census.executedAtWallMs)
      || !Number.isSafeInteger(holders.executedAtWallMs)
      || census.executedAtWallMs <= afterStop
      || holders.executedAtWallMs <= afterStop
      || census.executedAtWallMs >= beforeStartup
      || holders.executedAtWallMs >= beforeStartup) {
    reject('V5_quiescence_census_invalid')
  }
  if (record.state !== 'settled') {
    // The durable-file reader reconstructs internal records by removing the
    // redundant public aliases and mapping queryState back to state. Compare
    // that existing representation without adding fields or changing its hash.
    if ((Object.hasOwn(record, 'queryState') ? record.queryState : record.state) !== 'pending' || record.recoveryState !== 'blocked'
        || record.failureReason !== 'runtime_restart_ownership_unavailable'
        || record.terminationEvidence !== null || record.exitObservedAt !== null
        || record.fenceState !== 'active') reject('V8_quiescence_pending_preimage_invalid')
    if (sha256(JSON.stringify(record)) !== cut.subjectPreimageSha256) {
      reject('V9_quiescence_pending_preimage_mismatch')
    }
    return { branch: 'pending', handle: record.handle }
  }
  if (record.lateOutcome !== 'terminated_without_outcome'
      || (Object.hasOwn(record, 'queryState') ? record.queryState : record.state) !== 'settled'
      || record.settlementResult !== 'terminated_without_outcome'
      || record.terminationEvidence !== 'restart_quiescence_proven'
      || record.recoveryState !== 'settled' || record.exitObservedAt !== null
      || record.fenceState !== 'cleared') {
    reject('V8_quiescence_settled_replay_invalid')
  }
  // The settled record necessarily differs from its pending preimage. V2 binds
  // exact replay to the original root commitment, never a new settled hash.
  return { branch: 'settled_exact_replay_candidate', handle: record.handle }
}
