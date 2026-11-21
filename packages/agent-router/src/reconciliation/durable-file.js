import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  renameSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'
import { RECONCILIATION_CAPS } from './capacity.js'
import { validatedIngressCorrelation } from './ingress-correlation.js'
import { MAX_ADMIN_ABANDONMENT_DECLARATIONS } from './admin-abandonment.js'
import { isLegacyUnprovenFenceClear } from './state-machine.js'

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
  'child_real_exit', 'cancellation_ack', 'restart_quiescence_proven',
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

/**
 * Durable admin-abandonment scope registry (HR_RESET_AND_RESUME_V1):
 * declarationId -> exact original operation scope, persisted BEFORE any
 * record stamp so retries can never adopt a later task. The registry lives
 * in its OWN sibling file next to the recovery store, NOT inside the
 * recovery file: binaries that predate the registry rewrite the recovery
 * file with a fixed top-level shape and would silently drop a registry
 * stored there, stranding an unstamped scope after a rollback/reupgrade
 * (review finding). A sibling file is never read or written by older
 * binaries, so the scope survives every rollback. Absent registry file (or
 * absent per-store path) => null (the store then reconstructs scopes from
 * the per-record markers); present values are the closed entry shape,
 * fail-closed.
 */
export function abandonmentDeclarationRegistryPathFor(file) {
  return file === null || file === undefined ? null : `${file}.abandonment-declarations.json`
}

function assertDurableAbandonmentDeclarations(entries) {
  if (entries === undefined) return null
  if (!Array.isArray(entries) || entries.length > MAX_ADMIN_ABANDONMENT_DECLARATIONS) {
    throw new TypeError('durable abandonment declaration registry is invalid')
  }
  const ids = new Set()
  for (const entry of entries) {
    // RECONCILIATION_ABANDONED_EVICTION_V1 r2 (#707): entries MAY carry an
    // explicit durable risk acceptance (`ownerRiskAcceptance: true` + a
    // `decisionRef` naming the authorizing decision). Restore-apply stamps
    // the acceptance audit ONLY for entries carrying the explicit flag;
    // legacy 4-key entries stay marker-only (quarantine preserved).
    const keys = Object.keys(entry).sort().join(',')
    const baseKeys = ['declarationId', 'agentId', 'handles', 'declaredAt'].sort().join(',')
    const extendedKeys = ['declarationId', 'agentId', 'handles', 'declaredAt', 'decisionRef', 'ownerRiskAcceptance'].sort().join(',')
    const extended = keys === extendedKeys
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)
        || (keys !== baseKeys && !extended)
        || typeof entry.declarationId !== 'string' || entry.declarationId === '' || entry.declarationId.length > 128
        || typeof entry.agentId !== 'string' || entry.agentId === '' || entry.agentId.length > 256
        || !Number.isSafeInteger(entry.declaredAt) || entry.declaredAt < 0
        || !Array.isArray(entry.handles) || entry.handles.length > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT
        || entry.handles.some(handle => typeof handle !== 'string' || handle === '' || handle.length > 512)
        || new Set(entry.handles).size !== entry.handles.length
        || ids.has(entry.declarationId)) {
      throw new TypeError('durable abandonment declaration entry is invalid')
    }
    if (extended && (entry.ownerRiskAcceptance !== true || typeof entry.decisionRef !== 'string'
        || entry.decisionRef === '' || entry.decisionRef.length > 256)) {
      throw new TypeError('durable abandonment declaration entry is invalid')
    }
    ids.add(entry.declarationId)
  }
  return entries.map(entry => ({ ...entry, handles: [...entry.handles] }))
}

/** Write the sibling scope registry atomically (same discipline as the
 *  recovery store: temp file + fsync + rename + directory fsync). */
export function writeAbandonmentDeclarationRegistry(file, entries) {
  if (file === null || file === undefined) return
  mkdirSync(dirname(file), { recursive: true })
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  try {
    writeFileSync(temp, `${JSON.stringify({ version: DURABLE_RECOVERY_VERSION, declarations: entries })}\n`,
      { encoding: 'utf8', mode: 0o600 })
    const fd = openSync(temp, 'r')
    try { fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(temp, file)
    const directoryFd = openSync(dirname(file), 'r')
    try { fsyncSync(directoryFd) } finally { closeSync(directoryFd) }
  } finally {
    try { unlinkSync(temp) } catch { /* rename or cleanup already removed it */ }
  }
}

/** Read the sibling scope registry; null when absent, fail-closed on any
 *  malformed content (the registry authorizes retry completion scope). */
export function readAbandonmentDeclarationRegistry(file) {
  if (file === null || file === undefined || !existsSync(file)) return null
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)
      || parsed.version !== DURABLE_RECOVERY_VERSION
      || !Array.isArray(parsed.declarations)) {
    throw new TypeError('durable abandonment declaration registry file is invalid')
  }
  return assertDurableAbandonmentDeclarations(parsed.declarations)
}

function assertDurableRecord(raw) {
  if (raw === null || typeof raw !== 'object') throw new TypeError('durable recovery record is invalid')
  for (const key of MANDATORY_RECORD_FIELDS) {
    if (!Object.hasOwn(raw, key)) throw new TypeError(`durable recovery record missing ${key}`)
  }
  // Older V3 records omitted this optional field. Present non-null data has
  // exactly the closed authenticated-ingress shape.
  validatedIngressCorrelation(raw.ingressCorrelation ?? null)
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
  const answerEvidence = raw.finalAssistantOutputEvidence
  if (raw.finalAssistantOutput !== null
      || !(answerEvidence === null || (typeof answerEvidence === 'object'
        && /^[a-f0-9]{64}$/.test(answerEvidence.sha256)
        && Number.isSafeInteger(answerEvidence.originalBytes) && answerEvidence.originalBytes >= 0
        && typeof answerEvidence.truncated === 'boolean'))) {
    throw new TypeError('durable recovery answer evidence is invalid')
  }
  // Optional admin-abandonment marker (HR_RESET_AND_RESUME_V1). Absent on
  // pre-marker records; present values are the closed declaration shape.
  // Older binaries tolerate this field (unknown-field passthrough) and keep
  // fencing — an unmarked record never loses its fence.
  const abandonment = raw.adminAbandonment
  if (abandonment !== undefined && abandonment !== null
      && (typeof abandonment !== 'object' || Array.isArray(abandonment)
        || Object.keys(abandonment).sort().join(',') !== ['declarationId', 'declaredAt'].sort().join(',')
        || typeof abandonment.declarationId !== 'string' || abandonment.declarationId === ''
        || abandonment.declarationId.length > 128
        || !Number.isSafeInteger(abandonment.declaredAt) || abandonment.declaredAt < 0)) {
    throw new TypeError('durable recovery abandonment declaration is invalid')
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
  const pendingUnknown = new Set([
    'pending_unknown', 'recovery_claimed', 'shutdown_requested', 'exit_observed',
  ])
  const legacyUnprovenClear = isLegacyUnprovenFenceClear(raw)
  if ((raw.queryState === 'settled') !== (raw.settlementResult !== null)
      || (raw.queryState === 'pending'
        && (raw.state === 'settled' || (raw.fenceState === 'cleared' && !legacyUnprovenClear)))
      || (raw.queryState === 'settled' && !['settled', 'blocked'].includes(raw.state))
      || (raw.fenceState === 'cleared' && raw.queryState !== 'settled' && !legacyUnprovenClear)
      || (raw.state === 'reserved' && (raw.queryState !== 'pending' || raw.fenceState !== 'armed'))
      || (pendingUnknown.has(raw.state)
        && (raw.queryState !== 'pending' || raw.initialOutcome !== 'outcome_unknown' || raw.fenceState !== 'active'))
      || (raw.state === 'blocked'
        && ((raw.fenceState !== 'active' && !legacyUnprovenClear) || raw.failureReason === null))
      || (raw.state === 'recovery_claimed' && raw.reapClaim?.phase !== 'claimed')
      || (raw.state === 'shutdown_requested' && raw.reapClaim?.phase !== 'shutdown_committed')
      || (raw.state === 'exit_observed'
        && (raw.exitObservedAt === null || (raw.reapClaim !== null && raw.reapClaim.phase !== 'exit_observed')))
      || (raw.reapClaim?.phase === 'settled' && raw.queryState !== 'settled')
      || (raw.reapClaim?.phase === 'canceled_by_settlement' && raw.queryState !== 'settled')) {
    throw new TypeError('durable recovery record state invariants are invalid')
  }
}

function encodeIssuance(issuance) {
  return [...issuance].map(([agentId, entry]) => ({
    agentId,
    ...entry,
    evictedSparseSeqs: [...entry.evictedSparseSeqs],
    evictedRanges: entry.evictedRanges.map(range => [range[0], range[1], [...range[2]]]),
    generations: [...entry.generations],
  }))
}

/**
 * r9 (#707) legacy migration: convert the per-generation evictedGenerations
 * map pairs into disjoint evictedRanges carrying the EXACT per-generation
 * turnSeq bounds (1:1 — the identical resolution predicate, compressed only
 * in tuple count). Only GENERATION-ADJACENT pairs merge (a range never spans
 * a never-issued generation — `never_existed` verdicts are preserved
 * exactly); a run starting at watermark+1 cascades into the contiguous
 * watermark (those generations were genuinely issued + evicted, which is
 * what the map entries proved).
 *
 * CAP ORDERING (r9, QA P0-B): the legacy pairs are validated PER TUPLE and
 * converted FIRST — the r8 pre-conversion `pairs + live > 256` check
 * rejected the real production file (agt_hr-agent at exactly 43 + 213 = 256,
 * and any further non-contiguous eviction pushes it over) BEFORE compression
 * could ever run, bricking the upgrade. Caps are enforced AFTER conversion on
 * the COMPRESSED form (tuple count via the restored-cap check; exactness
 * arrays via MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT below). The live
 * generation entries stay capped 1:1 — they are live metadata, never
 * compressible.
 */
function evictedRangesFromLegacyPairs(evictedThroughGeneration, legacyPairs) {
  const ranges = []
  for (const [generation, maxSeq] of [...legacyPairs].sort((a, b) => a[0] - b[0])) {
    const last = ranges[ranges.length - 1]
    if (last !== undefined && last[1] + 1 === generation) {
      last[1] = generation
      last[2].push(maxSeq)
    } else {
      ranges.push([generation, generation, [maxSeq]])
    }
  }
  let watermark = evictedThroughGeneration
  while (ranges.length > 0 && ranges[0][0] === watermark + 1) {
    watermark = ranges[0][1]
    ranges.shift()
  }
  return { watermark, ranges }
}

function decodeIssuance(entries, discriminatorSeq) {
  if (entries.length > RECONCILIATION_CAPS.MAX_ISSUANCE_AGENTS_GLOBAL) {
    throw new TypeError('durable issuance agent capacity is invalid')
  }
  const issuance = new Map()
  const discriminators = new Set()
  for (const entry of entries ?? []) {
    const sparse = entry?.evictedSparseSeqs
    const evictedRanges = entry?.evictedRanges
    const legacyEvictedGenerations = entry?.evictedGenerations
    const generations = entry?.generations
    // r8 (#707): exactly one evicted-metadata form — the r8 evictedRanges
    // tuples or the legacy evictedGenerations pairs (converted at restore).
    if ((evictedRanges === undefined) === (legacyEvictedGenerations === undefined)) {
      throw new TypeError('durable issuance evicted metadata form is invalid')
    }
    if (entry === null || typeof entry !== 'object'
        || typeof entry.agentId !== 'string' || entry.agentId === '' || entry.agentId.length > 256
        || issuance.has(entry.agentId)
        || !Number.isSafeInteger(entry.discriminator) || entry.discriminator <= 0
        || entry.discriminator > discriminatorSeq || discriminators.has(entry.discriminator)
        || !Number.isSafeInteger(entry.maxIssuedTurnSeq) || entry.maxIssuedTurnSeq < 0
        || !Number.isSafeInteger(entry.evictedThroughTurnSeq) || entry.evictedThroughTurnSeq < 0
        || entry.evictedThroughTurnSeq > entry.maxIssuedTurnSeq
        || !Number.isSafeInteger(entry.evictedThroughGeneration) || entry.evictedThroughGeneration < 0
        || !Array.isArray(sparse) || sparse.length > RECONCILIATION_CAPS.MAX_EVICTED_SPARSE_SEQS_PER_AGENT
        || !Array.isArray(generations)) {
      throw new TypeError('durable issuance entry is invalid')
    }
    const validRangeTuple = tuple => Array.isArray(tuple) && tuple.length === 3
      && Number.isSafeInteger(tuple[0]) && tuple[0] > 0 && tuple[0] > entry.evictedThroughGeneration
      && Number.isSafeInteger(tuple[1]) && tuple[1] >= tuple[0]
      && Array.isArray(tuple[2]) && tuple[2].length === tuple[1] - tuple[0] + 1
      && tuple[2].every(bound => Number.isSafeInteger(bound) && bound > 0 && bound <= entry.maxIssuedTurnSeq)
    if (Array.isArray(evictedRanges)) {
      if (evictedRanges.length + generations.length > RECONCILIATION_CAPS.MAX_ISSUANCE_GENERATIONS_PER_AGENT
          || evictedRanges.reduce((total, tuple) => total + (Array.isArray(tuple?.[2]) ? tuple[2].length : 0), 0)
            > RECONCILIATION_CAPS.MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT
          || evictedRanges.some(tuple => !validRangeTuple(tuple))
          || evictedRanges.some((range, index) => index > 0 && range[0] <= evictedRanges[index - 1][1] + 1)) {
        throw new TypeError('durable issuance evicted ranges are invalid')
      }
    }
    const validGenerationTuple = tuple => Array.isArray(tuple) && tuple.length === 2
      && Number.isSafeInteger(tuple[0]) && tuple[0] > 0
      && tuple[1] !== null && typeof tuple[1] === 'object'
    if (sparse.some(seq => !Number.isSafeInteger(seq) || seq <= entry.evictedThroughTurnSeq || seq > entry.maxIssuedTurnSeq)
        || new Set(sparse).size !== sparse.length
        || generations.some(tuple => !validGenerationTuple(tuple)
          || tuple[0] <= entry.evictedThroughGeneration
          || !Number.isSafeInteger(tuple[1].minSeq) || tuple[1].minSeq <= 0
          || !Number.isSafeInteger(tuple[1].maxSeq) || tuple[1].maxSeq < tuple[1].minSeq
          || tuple[1].maxSeq > entry.maxIssuedTurnSeq)) {
      throw new TypeError('durable issuance metadata is invalid')
    }
    let decodedRanges = null
    let decodedWatermark = entry.evictedThroughGeneration
    if (Array.isArray(evictedRanges)) {
      decodedRanges = evictedRanges.map(tuple => [tuple[0], tuple[1], [...tuple[2]]])
    } else {
      // r9 (QA P0-B): NO pre-conversion cap on the legacy pairs — the real
      // production file sits at/over the 256 metadata sum, and rejecting it
      // here would brick the upgrade before compression ever runs. Per-tuple
      // validity + live-generation cap stay; the compressed form is capped
      // after conversion (tuple count at the restored-cap check; exactness
      // arrays right below).
      if (!Array.isArray(legacyEvictedGenerations) || generations.length > RECONCILIATION_CAPS.MAX_ISSUANCE_GENERATIONS_PER_AGENT) {
        throw new TypeError('durable issuance entry is invalid')
      }
      if (legacyEvictedGenerations.some(tuple => !Array.isArray(tuple) || tuple.length !== 2
          || !Number.isSafeInteger(tuple[0]) || tuple[0] <= 0
          || tuple[0] <= entry.evictedThroughGeneration
          || !Number.isSafeInteger(tuple[1]) || tuple[1] <= 0 || tuple[1] > entry.maxIssuedTurnSeq)) {
        throw new TypeError('durable issuance metadata is invalid')
      }
      const generationIds = [...legacyEvictedGenerations, ...generations].map(tuple => tuple[0])
      if (new Set(generationIds).size !== generationIds.length) throw new TypeError('duplicate durable issuance generation')
      const migrated = evictedRangesFromLegacyPairs(entry.evictedThroughGeneration, legacyEvictedGenerations)
      decodedRanges = migrated.ranges
      decodedWatermark = migrated.watermark
      if (decodedRanges.length + generations.length > RECONCILIATION_CAPS.MAX_ISSUANCE_GENERATIONS_PER_AGENT
          || decodedRanges.reduce((total, tuple) => total + tuple[2].length, 0)
            > RECONCILIATION_CAPS.MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT) {
        throw new TypeError('durable issuance metadata exceeds frozen caps')
      }
    }
    const liveRanges = generations.map(tuple => tuple[1]).sort((a, b) => a.minSeq - b.minSeq)
    if (liveRanges.some((range, index) => index > 0 && range.minSeq <= liveRanges[index - 1].maxSeq)) {
      throw new TypeError('overlapping durable issuance generation ranges')
    }
    discriminators.add(entry.discriminator)
    issuance.set(entry.agentId, {
      discriminator: entry.discriminator,
      maxIssuedTurnSeq: entry.maxIssuedTurnSeq,
      evictedThroughTurnSeq: entry.evictedThroughTurnSeq,
      evictedSparseSeqs: new Set(entry.evictedSparseSeqs ?? []),
      evictedThroughGeneration: decodedWatermark,
      evictedRanges: decodedRanges,
      generations: new Map(entry.generations ?? []),
    })
  }
  return issuance
}

function durableRecord(record) {
  const output = record.finalAssistantOutput
  // Decoded durable records intentionally contain no answer text. Retain their
  // validated digest when a later write serializes that record again.
  const finalAssistantOutputEvidence = output === null || output === undefined
    ? structuredClone(record.finalAssistantOutputEvidence ?? null) : {
    sha256: createHash('sha256').update(String(output.text ?? ''), 'utf8').digest('hex'),
    originalBytes: output.originalBytes ?? Buffer.byteLength(String(output.text ?? ''), 'utf8'),
    truncated: output.truncated === true,
  }
  return {
    ...structuredClone(record),
    finalAssistantOutput: null,
    finalAssistantOutputEvidence,
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
      || parsed.runtimeEpoch.length > 128
      || !Number.isSafeInteger(parsed.discriminatorSeq) || parsed.discriminatorSeq < 0
      || !Array.isArray(parsed.runtimeEpochs)
      || parsed.runtimeEpochs.length > RECONCILIATION_CAPS.MAX_RUNTIME_EPOCHS
      || parsed.runtimeEpochs.some(epoch => typeof epoch !== 'string' || epoch === '' || epoch.length > 128)
      || new Set(parsed.runtimeEpochs).size !== parsed.runtimeEpochs.length
      || !parsed.runtimeEpochs.includes(parsed.runtimeEpoch)
      || !Array.isArray(parsed.records) || !Array.isArray(parsed.issuance)
      || !Array.isArray(parsed.correlationIndex)
      || parsed.correlationIndex.length > RECONCILIATION_CAPS.MAX_CORRELATION_INDEX_ENTRIES_GLOBAL
      || parsed.correlationIndex.some(entry => !Array.isArray(entry) || entry.length !== 2
        || typeof entry[0] !== 'string'
        || Buffer.byteLength(entry[0], 'utf8') > RECONCILIATION_CAPS.MAX_CORRELATION_KEY_BYTES
        || entry[0].split('\u0000').length !== 3
        || typeof entry[1] !== 'string' || entry[1].length > 512)) {
    throw new TypeError('durable recovery store schema is invalid')
  }
  const records = new Map()
  for (const raw of parsed.records) {
    assertDurableRecord(raw)
    if (records.has(raw.reconciliationHandle)) throw new TypeError('duplicate durable recovery handle')
    const record = structuredClone(raw)
    record.ingressCorrelation = validatedIngressCorrelation(raw.ingressCorrelation ?? null)
    record.adminAbandonment = raw.adminAbandonment ?? null
    record.recoveryState = raw.state
    record.state = raw.queryState ?? (raw.state === 'settled' ? 'settled' : 'pending')
    delete record.queryState
    delete record.reconciliationHandle
    delete record.turnExecutionId
    records.set(record.handle, record)
  }
  const correlationIndex = new Map(parsed.correlationIndex)
  if (correlationIndex.size !== parsed.correlationIndex.length) {
    throw new TypeError('duplicate durable caller correlation')
  }
  return {
    runtimeEpochs: new Set([
      parsed.runtimeEpoch,
      ...(Array.isArray(parsed.runtimeEpochs) ? parsed.runtimeEpochs : []),
    ]),
    discriminatorSeq: parsed.discriminatorSeq ?? 0,
    records,
    issuance: decodeIssuance(parsed.issuance, parsed.discriminatorSeq),
    correlationIndex,
  }
}
