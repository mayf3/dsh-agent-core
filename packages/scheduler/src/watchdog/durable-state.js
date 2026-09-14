import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { canonicalJSON } from '../occurrence-model.js'
import { legacyFingerprint, migrateLegacyAlertState } from './incident-lifecycle.js'
import { atomicReplacePrivateFile, ensurePrivateDirectory, readPrivateFile, withPrivateLock } from './private-state-io.js'

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function appendPrivateJsonl(path, value, { expectedUid = process.getuid?.(), expectedGid = process.getgid?.() } = {}) {
  const ownership = { expectedUid, expectedGid }
  return withPrivateLock(path, ownership, () => {
    const prior = readPrivateFile(path, { ...ownership, allowMissing: true })?.bytes ?? Buffer.alloc(0)
    atomicReplacePrivateFile(path, Buffer.concat([prior, Buffer.from(`${JSON.stringify(value)}\n`)]), ownership)
  })
}

function readStableFile(path, ownership) {
  const loaded = readPrivateFile(path, ownership)
  return { bytes: loaded.bytes, sha256: hash(loaded.bytes), stat: loaded.stat }
}

function retainBackup(path, bytes, ownership) {
  const existing = readPrivateFile(path, { ...ownership, allowMissing: true })
  if (existing) {
    if (hash(existing.bytes) !== hash(bytes)) throw new Error('migration backup hash collision')
    return
  }
  atomicReplacePrivateFile(path, bytes, ownership)
}

function validateState(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || value.version !== 1
    || value.incidents === null || typeof value.incidents !== 'object'
    || value.outbox === null || typeof value.outbox !== 'object') {
    throw new TypeError('unsupported incident state')
  }
  return value
}

export function loadIncidentState(path, ownership = {}) {
  const loaded = readPrivateFile(path, { ...ownership, allowMissing: true })
  if (!loaded) return { state: { version: 1, incidents: {}, outbox: {} }, hash: null }
  const bytes = loaded.bytes
  let state
  try { state = validateState(JSON.parse(bytes.toString('utf8'))) } catch (error) {
    throw Object.assign(new TypeError(`corrupt incident state: ${error?.message ?? error}`), { cause: error })
  }
  return { state, hash: hash(bytes) }
}

export function commitIncidentState(path, state, { expectedHash, crashAt, expectedUid = process.getuid?.(), expectedGid = process.getgid?.() } = {}) {
  validateState(state)
  const ownership = { expectedUid, expectedGid }
  return withPrivateLock(path, ownership, () => {
    const current = loadIncidentState(path, { expectedUid, expectedGid })
    if (current.hash !== (expectedHash ?? null)) throw new Error('incident state generation mismatch')
    const bytes = Buffer.from(`${JSON.stringify(state, null, 2)}\n`, 'utf8')
    if (crashAt === 'before-rename') throw new Error('injected crash before rename')
    atomicReplacePrivateFile(path, bytes, ownership)
    return { hash: hash(bytes) }
  })
}

export function migrateLegacyIncidentStateFiles({
  legacyStatePath, legacyEvidencePath, incidentStatePath, findings,
  expectedLegacySha256, expectedEvidenceSha256, expectedFactsSha256,
  nowMs = Date.now(),
  expectedUid = process.getuid?.(), expectedGid = process.getgid?.(), beforeCommit,
} = {}) {
  const initial = loadIncidentState(incidentStatePath, { expectedUid, expectedGid })
  if (initial.hash !== null) throw new Error('incident state already exists; migration is one-time only')
  const ownership = { expectedUid, expectedGid }
  const legacy = readStableFile(legacyStatePath, ownership)
  const evidence = readStableFile(legacyEvidencePath, ownership)
  const factsSha256 = hash(Buffer.from(canonicalJSON(findings ?? []), 'utf8'))
  if (legacy.sha256 !== expectedLegacySha256 || evidence.sha256 !== expectedEvidenceSha256 || factsSha256 !== expectedFactsSha256) {
    throw new Error('migration frozen source generation mismatch')
  }
  let predecessor
  try { predecessor = JSON.parse(legacy.bytes.toString('utf8')) } catch (error) {
    throw Object.assign(new TypeError('corrupt legacy incident state'), { cause: error })
  }
  const deliveryByFingerprint = new Map()
  const factsByFingerprint = new Map()
  for (const line of evidence.bytes.toString('utf8').split('\n').filter(Boolean)) {
    let row
    try { row = JSON.parse(line) } catch (error) { throw Object.assign(new TypeError('corrupt legacy delivery evidence'), { cause: error }) }
    if (!row || typeof row !== 'object' || typeof row.fingerprint !== 'string'
      || !['DELIVERED', 'FAILED'].includes(row.delivery) || !row.fact || legacyFingerprint(row.fact) !== row.fingerprint) {
      throw new TypeError('invalid legacy delivery evidence row')
    }
    if (deliveryByFingerprint.has(row.fingerprint)) throw new TypeError('duplicate or conflicting migration evidence')
    deliveryByFingerprint.set(row.fingerprint, row.delivery)
    factsByFingerprint.set(row.fingerprint, row.fact)
  }
  const deliveredFingerprints = new Set([...deliveryByFingerprint].filter(([, value]) => value === 'DELIVERED').map(([key]) => key))
  const failedFingerprints = new Set([...deliveryByFingerprint].filter(([, value]) => value === 'FAILED').map(([key]) => key))
  const state = migrateLegacyAlertState(predecessor, findings, {
    deliveredFingerprints, failedFingerprints, legacyFacts: factsByFingerprint, nowMs,
  })
  beforeCommit?.()
  const legacyEnd = readStableFile(legacyStatePath, ownership)
  const evidenceEnd = readStableFile(legacyEvidencePath, ownership)
  if (legacyEnd.sha256 !== legacy.sha256 || evidenceEnd.sha256 !== evidence.sha256
    || legacyEnd.stat.dev !== legacy.stat.dev || legacyEnd.stat.ino !== legacy.stat.ino
    || evidenceEnd.stat.dev !== evidence.stat.dev || evidenceEnd.stat.ino !== evidence.stat.ino) {
    throw new Error('migration source generation drifted')
  }
  const backupDir = join(dirname(incidentStatePath), 'migration-backups')
  ensurePrivateDirectory(backupDir, { expectedUid, expectedGid })
  retainBackup(join(backupDir, `legacy-${legacy.sha256}.json`), legacy.bytes, ownership)
  retainBackup(join(backupDir, `evidence-${evidence.sha256}.jsonl`), evidence.bytes, ownership)
  const committed = commitIncidentState(incidentStatePath, state, { expectedHash: null, expectedUid, expectedGid })
  const readback = loadIncidentState(incidentStatePath, { expectedUid, expectedGid })
  if (readback.hash !== committed.hash) throw new Error('incident migration readback mismatch')
  return { state: readback.state, incidentSha256: readback.hash, legacySha256: legacy.sha256, evidenceSha256: evidence.sha256, factsSha256 }
}
