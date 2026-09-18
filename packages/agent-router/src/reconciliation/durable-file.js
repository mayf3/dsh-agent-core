import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  renameSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

export const DURABLE_RECOVERY_VERSION = 3

const RECOVERY_STATES = new Set([
  'reserved', 'pending_unknown', 'recovery_claimed', 'shutdown_requested',
  'exit_observed', 'settled', 'blocked',
])
const QUERY_STATES = new Set(['pending', 'settled'])
const FENCE_STATES = new Set(['armed', 'active', 'cleared'])
const MISSING_EVIDENCE = new Set([
  'exact_terminal', 'exact_turn_idle', 'child_real_exit',
  'live_generation_ownership', 'no_concurrent_execution',
  'event_stream_continuity', 'one_active_turn_invariant',
])
const RECOVERY_ACTIONS = new Set([
  'coordinator_scheduled', 'ownership_check', 'reap_claim', 'graceful_shutdown',
  'forced_termination', 'exit_wait', 'settlement', 'registry_cleanup', 'fence_cleanup',
])
const ACTION_RESULTS = new Set(['started', 'succeeded', 'failed', 'blocked'])
const CLAIM_PHASES = new Set([
  'claimed', 'canceled_by_settlement', 'shutdown_committed', 'exit_observed', 'settled', 'blocked',
])
const TERMINATION_EVIDENCE = new Set([
  'exact_terminal_then_idle', 'exact_started_then_idle', 'exact_queued_removal',
  'child_real_exit', 'cancellation_ack',
])
const SETTLEMENT_RESULTS = new Set([
  'completed', 'failed', 'not_admitted', 'late_completed', 'late_failed',
  'terminated_without_outcome',
])
const NEXT_SAFE_ACTIONS = new Set([
  'await_late_evidence', 'await_real_exit', 'reestablish_exact_ownership',
  'operator_exact_generation_recovery', 'send_new_request_after_reopened', 'none',
])
const MANDATORY_RECORD_FIELDS = [
  'reconciliationHandle', 'runtimeEpoch', 'agentId', 'turnExecutionId',
  'processGeneration', 'sessionId', 'state', 'createdAt', 'hardDeadlineAt',
  'updatedAt',
  'terminationEvidence', 'missingEvidence', 'reapClaim', 'attemptedActions',
  'shutdownRequestedAt', 'exitObservedAt', 'settlementResult', 'failureReason',
  'nextSafeAction', 'fenceState',
]

function validNullableTimestamp(value) {
  return value === null || (Number.isSafeInteger(value) && value >= 0)
}

function assertDurableRecord(raw) {
  if (raw === null || typeof raw !== 'object') throw new TypeError('durable recovery record is invalid')
  for (const key of MANDATORY_RECORD_FIELDS) {
    if (!Object.hasOwn(raw, key)) throw new TypeError(`durable recovery record missing ${key}`)
  }
  if (typeof raw.reconciliationHandle !== 'string'
      || raw.turnExecutionId !== raw.reconciliationHandle
      || raw.handle !== raw.reconciliationHandle
      || typeof raw.runtimeEpoch !== 'string' || raw.runtimeEpoch === ''
      || typeof raw.agentId !== 'string' || raw.agentId === ''
      || !Number.isSafeInteger(raw.processGeneration) || raw.processGeneration <= 0
      || !Number.isSafeInteger(raw.createdAt) || raw.createdAt < 0
      || !Number.isSafeInteger(raw.updatedAt) || raw.updatedAt < raw.createdAt
      || !(raw.sessionId === null || typeof raw.sessionId === 'string')
      || !RECOVERY_STATES.has(raw.state)
      || !QUERY_STATES.has(raw.queryState)
      || !FENCE_STATES.has(raw.fenceState)
      || !validNullableTimestamp(raw.hardDeadlineAt)
      || !validNullableTimestamp(raw.shutdownRequestedAt)
      || !validNullableTimestamp(raw.exitObservedAt)
      || !(raw.terminationEvidence === null || TERMINATION_EVIDENCE.has(raw.terminationEvidence))
      || !(raw.settlementResult === null || SETTLEMENT_RESULTS.has(raw.settlementResult))
      || !(raw.failureReason === null || (typeof raw.failureReason === 'string' && raw.failureReason.length <= 256))
      || !NEXT_SAFE_ACTIONS.has(raw.nextSafeAction)
      || !Array.isArray(raw.missingEvidence)
      || raw.missingEvidence.some(value => !MISSING_EVIDENCE.has(value))
      || !Array.isArray(raw.attemptedActions) || raw.attemptedActions.length > 32) {
    throw new TypeError('durable recovery record schema is invalid')
  }
  for (const entry of raw.attemptedActions) {
    if (entry === null || typeof entry !== 'object'
        || !RECOVERY_ACTIONS.has(entry.action) || !ACTION_RESULTS.has(entry.result)
        || !Number.isSafeInteger(entry.observedAtWallMs) || entry.observedAtWallMs < 0
        || typeof entry.reasonCode !== 'string' || entry.reasonCode.length > 256) {
      throw new TypeError('durable recovery action is invalid')
    }
  }
  if (raw.reapClaim !== null) {
    if (typeof raw.reapClaim !== 'object'
        || !CLAIM_PHASES.has(raw.reapClaim.phase)
        || raw.reapClaim.reconciliationHandle !== raw.reconciliationHandle
        || raw.reapClaim.turnExecutionId !== raw.turnExecutionId
        || raw.reapClaim.agentId !== raw.agentId
        || raw.reapClaim.processGeneration !== raw.processGeneration
        || raw.reapClaim.runtimeEpoch !== raw.runtimeEpoch
        || typeof raw.reapClaim.operationId !== 'string' || raw.reapClaim.operationId === ''
        || raw.reapClaim.operationId.length > 128
        || typeof raw.reapClaim.claimantRuntimeEpoch !== 'string'
        || raw.reapClaim.claimantRuntimeEpoch === '' || raw.reapClaim.claimantRuntimeEpoch.length > 128
        || !validNullableTimestamp(raw.reapClaim.claimedAt) || raw.reapClaim.claimedAt === null) {
      throw new TypeError('durable recovery claim identity is invalid')
    }
  }
}

function encodeIssuance(issuance) {
  return [...issuance].map(([agentId, entry]) => ({
    agentId,
    ...entry,
    evictedSparseSeqs: [...entry.evictedSparseSeqs],
    evictedGenerations: [...entry.evictedGenerations],
    generations: [...entry.generations],
  }))
}

function decodeIssuance(entries) {
  const issuance = new Map()
  for (const entry of entries ?? []) {
    issuance.set(entry.agentId, {
      discriminator: entry.discriminator,
      maxIssuedTurnSeq: entry.maxIssuedTurnSeq,
      evictedThroughTurnSeq: entry.evictedThroughTurnSeq,
      evictedSparseSeqs: new Set(entry.evictedSparseSeqs ?? []),
      evictedThroughGeneration: entry.evictedThroughGeneration,
      evictedGenerations: new Map(entry.evictedGenerations ?? []),
      generations: new Map(entry.generations ?? []),
    })
  }
  return issuance
}

function durableRecord(record) {
  return {
    ...structuredClone(record),
    reconciliationHandle: record.handle,
    turnExecutionId: record.handle,
    queryState: record.state,
    state: record.recoveryState
      ?? (record.state === 'settled' ? 'settled' : 'reserved'),
  }
}

export function serializeDurableRecoveryStore(store) {
  return {
    version: DURABLE_RECOVERY_VERSION,
    runtimeEpoch: store.runtimeEpoch,
    runtimeEpochs: [...store.runtimeEpochs],
    discriminatorSeq: store.discriminatorSeq,
    records: [...store.records.values()].map(durableRecord),
    issuance: encodeIssuance(store.issuance),
    correlationIndex: [...store.correlationIndex],
  }
}

export function writeDurableRecoveryStore(file, store) {
  if (file === null) return
  mkdirSync(dirname(file), { recursive: true })
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  try {
    writeFileSync(temp, `${JSON.stringify(serializeDurableRecoveryStore(store))}\n`, { encoding: 'utf8', mode: 0o600 })
    const fd = openSync(temp, 'r')
    try { fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(temp, file)
    const directoryFd = openSync(dirname(file), 'r')
    try { fsyncSync(directoryFd) } finally { closeSync(directoryFd) }
  } finally {
    try { unlinkSync(temp) } catch { /* rename or cleanup already removed it */ }
  }
}

export function readDurableRecoveryStore(file) {
  if (file === null || !existsSync(file)) return null
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  if (parsed === null || typeof parsed !== 'object' || parsed.version !== DURABLE_RECOVERY_VERSION
      || typeof parsed.runtimeEpoch !== 'string' || parsed.runtimeEpoch === ''
      || !Array.isArray(parsed.records) || !Array.isArray(parsed.issuance)
      || !Array.isArray(parsed.correlationIndex)) {
    throw new TypeError('durable recovery store schema is invalid')
  }
  const records = new Map()
  for (const raw of parsed.records) {
    assertDurableRecord(raw)
    if (records.has(raw.reconciliationHandle)) throw new TypeError('duplicate durable recovery handle')
    const record = structuredClone(raw)
    record.recoveryState = raw.state
    record.state = raw.queryState ?? (raw.state === 'settled' ? 'settled' : 'pending')
    delete record.queryState
    delete record.reconciliationHandle
    delete record.turnExecutionId
    records.set(record.handle, record)
  }
  return {
    runtimeEpochs: new Set([
      parsed.runtimeEpoch,
      ...(Array.isArray(parsed.runtimeEpochs) ? parsed.runtimeEpochs : []),
    ]),
    discriminatorSeq: parsed.discriminatorSeq ?? 0,
    records,
    issuance: decodeIssuance(parsed.issuance),
    correlationIndex: new Map(parsed.correlationIndex),
  }
}
