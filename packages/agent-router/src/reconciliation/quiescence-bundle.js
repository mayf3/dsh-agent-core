/** RQ-002/003: closed bundle, exact subject, receipts and prospective ordering. */
import { join } from 'node:path'
import {
  defaultEvidenceIO, namedReceipt, ownedFile, proofReject, sha256,
  verifyCurrentWindow,
} from './quiescence-custody.js'

const HASH = /^[a-f0-9]{64}$/
const MAX_BUNDLE_BYTES = 65536
const FIXED_S256_OPERATION_ID = 'hr-s256-trusted-quiescence-cut-20260925-v1'

function exactKeys(value, names, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== names.length
      || names.some(name => !Object.hasOwn(value, name))) proofReject(code)
}

function same(a, b, code) { if (a !== b) proofReject(code) }
function hash(value, code) { if (typeof value !== 'string' || !HASH.test(value)) proofReject(code) }
function time(value, code) { if (!Number.isSafeInteger(value) || value < 0) proofReject(code) }
function receiptTime(receipt, key, code) {
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) proofReject(code)
  time(receipt[key], code)
}

function verifyShape(bundle) {
  exactKeys(bundle, ['bundleSchemaVersion', 'subject', 'epochRetirement', 'recoveryCutover',
    'deploymentProof', 'hostCensus', 'holderCheck', 'custody', 'controlledStop'], 'V2_bundle_shape')
  same(bundle.bundleSchemaVersion, 2, 'V2_bundle_version')
  exactKeys(bundle.subject, ['reconciliationHandle', 'turnExecutionId', 'runtimeEpoch', 'agentId', 'processGeneration'], 'V2_subject_shape')
  exactKeys(bundle.epochRetirement, ['retiredEpoch'], 'V2_epoch_shape')
  exactKeys(bundle.recoveryCutover, ['operationId', 'hostId', 'startupNonce', 'subjectPreimageSha256',
    'exclusiveWindowReceiptSha256', 'launchSourcesInhibitedReceiptSha256',
    'oldTreeQuiescedReceiptSha256', 'launchAuthorizationReceiptSha256',
    'windowOpenedAtWallMs', 'oldTreeQuiescedAtWallMs', 'authorizedStartupAtWallMs',
    'consumingBinarySha256'], 'V2_cutover_shape')
  exactKeys(bundle.deploymentProof, ['floorProvenReceiptSha256', 'validatorInstalledReceiptSha256',
    'deployedBinarySha256'], 'V2_deployment_shape')
  exactKeys(bundle.hostCensus, ['operationId', 'executedAtWallMs', 'hostId', 'tools',
    'outputsSha256', 'archiveRef', 'runtimeTreeProcessCount'], 'V2_census_shape')
  exactKeys(bundle.holderCheck, ['operationId', 'executedAtWallMs', 'method', 'paths', 'openHolderCount'], 'V2_holder_shape')
  exactKeys(bundle.custody, ['executedAs', 'producedBy', 'evidenceDir'], 'V2_custody_shape')
  const cut = bundle.recoveryCutover
  if (typeof cut.operationId !== 'string'
      || (cut.operationId !== FIXED_S256_OPERATION_ID && !/^op-[a-z0-9-]{1,64}$/.test(cut.operationId))
      || typeof cut.hostId !== 'string' || cut.hostId.length < 1 || cut.hostId.length > 128
      || typeof cut.startupNonce !== 'string' || cut.startupNonce.length < 8 || cut.startupNonce.length > 128) proofReject('V2_identity_invalid')
  for (const key of ['subjectPreimageSha256', 'exclusiveWindowReceiptSha256',
    'launchSourcesInhibitedReceiptSha256', 'oldTreeQuiescedReceiptSha256',
    'launchAuthorizationReceiptSha256', 'consumingBinarySha256']) hash(cut[key], 'V2_digest_invalid')
  for (const value of Object.values(bundle.deploymentProof)) hash(value, 'V2_deployment_digest_invalid')
  for (const key of ['windowOpenedAtWallMs', 'oldTreeQuiescedAtWallMs', 'authorizedStartupAtWallMs']) time(cut[key], 'V2_time_invalid')
  time(bundle.hostCensus.executedAtWallMs, 'V2_census_time_invalid')
  time(bundle.holderCheck.executedAtWallMs, 'V2_holder_time_invalid')
  if (!Array.isArray(bundle.hostCensus.tools) || bundle.hostCensus.tools.length !== 2
      || new Set(bundle.hostCensus.tools).size !== 2
      || !bundle.hostCensus.tools.includes('ps') || !bundle.hostCensus.tools.includes('lsof')) proofReject('V2_census_methods_invalid')
  if (!Array.isArray(bundle.hostCensus.outputsSha256) || bundle.hostCensus.outputsSha256.length !== 2) proofReject('V2_outputs_invalid')
  bundle.hostCensus.outputsSha256.forEach(value => hash(value, 'V2_outputs_invalid'))
  if (bundle.hostCensus.archiveRef !== 'census-archive.json'
      || bundle.holderCheck.method !== 'lsof' || !Array.isArray(bundle.holderCheck.paths)
      || bundle.holderCheck.paths.length < 1 || bundle.holderCheck.paths.length > 16
      || bundle.holderCheck.paths.some(path => typeof path !== 'string' || !path.startsWith('/') || path.length > 512)) proofReject('V2_holder_shape_invalid')
  if (bundle.custody.executedAs !== 'root'
      || bundle.custody.producedBy !== 'trusted_cp_recovery_evidence_collector_v1') proofReject('V6_custody_invalid')
  if (bundle.controlledStop !== null) {
    exactKeys(bundle.controlledStop, ['method', 'receiptSha256', 'atWallMs'], 'V7_stop_shape')
    if (bundle.controlledStop.method !== 'trusted_cp_controlled_stop_v1') proofReject('V7_stop_method')
    hash(bundle.controlledStop.receiptSha256, 'V7_stop_digest')
    time(bundle.controlledStop.atWallMs, 'V7_stop_time')
  }
}

function verifyRecord(store, bundle) {
  const subject = bundle.subject
  const record = store.records.get(subject.reconciliationHandle)
  const failed = []
  if (record === undefined) failed.push('P1')
  if (record?.handle !== subject.reconciliationHandle || subject.turnExecutionId !== subject.reconciliationHandle) failed.push('P1')
  if (record?.runtimeEpoch !== subject.runtimeEpoch) failed.push('P2')
  if (record?.agentId !== subject.agentId) failed.push('P3')
  if (record?.processGeneration !== subject.processGeneration) failed.push('P4')
  const alreadySettled = record?.state === 'settled'
  const quiescenceReplay = alreadySettled && record.lateOutcome === 'terminated_without_outcome'
    && record.terminationEvidence === 'restart_quiescence_proven'
  if (alreadySettled && !quiescenceReplay) failed.push('P5')
  if (!alreadySettled && record?.state === undefined) failed.push('P5')
  if (quiescenceReplay) {
    if (failed.length) proofReject(`V8_${failed.join('_')}`)
    store.validateRestoredAuthority()
    return { record, alreadySettled }
  }
  if (record?.initialOutcome !== 'outcome_unknown') failed.push('P6')
  if (record?.recoveryState !== 'blocked') failed.push('P7')
  if (record?.failureReason !== 'runtime_restart_ownership_unavailable') failed.push('P8')
  if (record?.terminationEvidence !== null || record?.exitObservedAt !== null) failed.push('P9')
  if (record?.fenceState !== 'active') failed.push('P10')
  if (failed.length) proofReject(`V8_${failed.join('_')}`)
  store.validateRestoredAuthority()
  return { record, alreadySettled: false }
}

function verifyReceipts(bundle, evidenceDir, deploymentDir, startup, io) {
  const cut = bundle.recoveryCutover
  const window = namedReceipt(evidenceDir, 'exclusive-window.json', cut.exclusiveWindowReceiptSha256, io)
  const inhibited = namedReceipt(evidenceDir, 'launch-sources-inhibited.json', cut.launchSourcesInhibitedReceiptSha256, io)
  const quiesced = namedReceipt(evidenceDir, 'old-tree-quiesced.json', cut.oldTreeQuiescedReceiptSha256, io)
  const authorization = namedReceipt(evidenceDir, 'launch-authorization.json', cut.launchAuthorizationReceiptSha256, io)
  receiptTime(window, 'windowOpenedAtWallMs', 'V9_receipt_time_invalid')
  receiptTime(inhibited, 'atWallMs', 'V9_receipt_time_invalid')
  receiptTime(quiesced, 'atWallMs', 'V9_receipt_time_invalid')
  receiptTime(authorization, 'authorizedStartupAtWallMs', 'V9_receipt_time_invalid')
  for (const receipt of [window, inhibited, quiesced, authorization]) {
    if (receipt?.operationId !== cut.operationId || receipt?.hostId !== cut.hostId
        || receipt?.startupNonce !== cut.startupNonce) proofReject('V9_receipt_identity_mismatch')
  }
  if (window.windowLockPath !== join(evidenceDir, 'window.lock')
      || window.windowOpenedAtWallMs !== cut.windowOpenedAtWallMs
      || inhibited.complete !== true || quiesced.complete !== true
      || !(cut.windowOpenedAtWallMs < inhibited.atWallMs
        && inhibited.atWallMs < quiesced.atWallMs
        && quiesced.atWallMs === cut.oldTreeQuiescedAtWallMs
        && quiesced.atWallMs < cut.authorizedStartupAtWallMs)) proofReject('V9_window_order_invalid')
  const census = bundle.hostCensus
  const holders = bundle.holderCheck
  if (census.operationId !== cut.operationId || census.hostId !== cut.hostId
      || holders.operationId !== cut.operationId || census.runtimeTreeProcessCount !== 0
      || holders.openHolderCount !== 0
      || census.executedAtWallMs < cut.oldTreeQuiescedAtWallMs
      || holders.executedAtWallMs < cut.oldTreeQuiescedAtWallMs
      || census.executedAtWallMs >= cut.authorizedStartupAtWallMs
      || holders.executedAtWallMs >= cut.authorizedStartupAtWallMs) proofReject('V5_census_invalid')
  const outputs = ['census-ps.txt', 'census-lsof.txt'].map(name => sha256(ownedFile(join(evidenceDir, name), 65536, io)))
  if (outputs.some((value, index) => value !== census.outputsSha256[index])) proofReject('V5_output_digest_mismatch')
  const archiveBytes = ownedFile(join(evidenceDir, census.archiveRef), 65536, io)
  let archive
  try { archive = JSON.parse(archiveBytes.toString('utf8')) } catch { proofReject('V5_archive_invalid') }
  if (archive.operationId !== cut.operationId || archive.hostId !== cut.hostId
      || JSON.stringify(archive.tools) !== JSON.stringify(census.tools)
      || JSON.stringify(archive.outputsSha256) !== JSON.stringify(census.outputsSha256)
      || archive.runtimeTreeProcessCount !== 0) proofReject('V5_archive_mismatch')
  if (authorization.consumingBinarySha256 !== cut.consumingBinarySha256
      || authorization.archiveSha256 !== sha256(archiveBytes)
      || JSON.stringify(authorization.outputsSha256) !== JSON.stringify(census.outputsSha256)
      || JSON.stringify(authorization.holderCheck) !== JSON.stringify(holders)
      || authorization.authorizedStartupAtWallMs !== cut.authorizedStartupAtWallMs
      || Math.max(census.executedAtWallMs, holders.executedAtWallMs) >= authorization.authorizedStartupAtWallMs) proofReject('V9_launch_authorization_mismatch')
  const floor = namedReceipt(deploymentDir, 'floor-proven.json', bundle.deploymentProof.floorProvenReceiptSha256, io)
  const validator = namedReceipt(deploymentDir, 'validator-installed.json', bundle.deploymentProof.validatorInstalledReceiptSha256, io)
  receiptTime(floor, 'provedAtWallMs', 'V10_deployment_time_invalid')
  receiptTime(validator, 'installedAtWallMs', 'V10_deployment_time_invalid')
  if (floor.status !== 'ROUTER_RESTART_SAFETY=PROVEN' || floor.floorCommit !== '2097e4f9'
      || floor.deployedBinarySha256 !== startup.consumingBinarySha256
      || validator.deployedBinarySha256 !== startup.consumingBinarySha256
      || validator.evidenceKind !== 'restart_quiescence_proven'
      || floor.provedAtWallMs >= cut.windowOpenedAtWallMs
      || validator.installedAtWallMs >= cut.windowOpenedAtWallMs) proofReject('V10_deployment_prerequisite_invalid')
  if (bundle.controlledStop !== null) {
    const stop = namedReceipt(evidenceDir, 'controlled-stop.json', bundle.controlledStop.receiptSha256, io)
    receiptTime(stop, 'atWallMs', 'V7_stop_time_invalid')
    if (stop.operationId !== cut.operationId || stop.hostId !== cut.hostId
        || stop.method !== bundle.controlledStop.method || stop.atWallMs !== bundle.controlledStop.atWallMs) proofReject('V7_stop_receipt_mismatch')
    if (!(floor.provedAtWallMs < stop.atWallMs && validator.installedAtWallMs < stop.atWallMs
        && cut.windowOpenedAtWallMs < inhibited.atWallMs && inhibited.atWallMs < stop.atWallMs
        && stop.atWallMs < cut.oldTreeQuiescedAtWallMs)) proofReject('V7_stop_order_invalid')
  }
}

export function verifyQuiescenceBundle(store, bundleFile, { evidenceDir, deploymentDir, startup, io = defaultEvidenceIO }) {
  const bytes = ownedFile(bundleFile, MAX_BUNDLE_BYTES, io)
  let bundle
  try { bundle = JSON.parse(bytes.toString('utf8')) } catch { proofReject('V2_bundle_json_invalid') }
  verifyShape(bundle)
  const cut = bundle.recoveryCutover
  if (bundle.custody.evidenceDir !== evidenceDir || cut.hostId !== startup.hostId
      || cut.startupNonce !== startup.startupNonce
      || cut.consumingBinarySha256 !== startup.consumingBinarySha256
      || bundle.deploymentProof.deployedBinarySha256 !== startup.consumingBinarySha256) proofReject('V9_startup_binding_mismatch')
  if (bundle.epochRetirement.retiredEpoch !== bundle.subject.runtimeEpoch
      || bundle.subject.runtimeEpoch === store.runtimeEpoch
      || !store.runtimeEpochs.has(bundle.subject.runtimeEpoch)) proofReject('V4_epoch_invalid')
  const { record, alreadySettled } = verifyRecord(store, bundle)
  time(record.createdAtWallMs, 'V9_subject_time_invalid')
  if (!(record.createdAtWallMs < cut.windowOpenedAtWallMs)) proofReject('V9_subject_after_cut')
  if (!alreadySettled) {
    time(record.updatedAt, 'V9_subject_time_invalid')
    if (!(record.updatedAt < cut.windowOpenedAtWallMs)) proofReject('V9_subject_after_cut')
  }
  if (!alreadySettled && sha256(JSON.stringify(record)) !== cut.subjectPreimageSha256) proofReject('V9_preimage_mismatch')
  if ((bundle.controlledStop !== null) !== (startup.recoveryPlanStopsRuntime === true)) proofReject('V7_stop_plan_mismatch')
  verifyReceipts(bundle, evidenceDir, deploymentDir, startup, io)
  verifyCurrentWindow(evidenceDir, bundle, startup, io)
  return { handle: bundle.subject.reconciliationHandle, bundle, bundleSha256: sha256(bytes), alreadySettled }
}
