import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { canonicalJSON } from '../occurrence-model.js'
import { legacyFingerprint, migrateLegacyAlertState, notificationKey } from './incident-lifecycle.js'
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
  for (const [root, record] of Object.entries(value.incidents)) {
    if (record?.rootIdentity !== root || !Number.isSafeInteger(record.episode) || record.episode < 1
      || record.incidentId !== `${root}|episode:${record.episode}` || !Number.isSafeInteger(record.transitionRevision)
      || record.transitionRevision < 1 || record.alertState?.incidentKey !== root || record.alertState?.lifecycle !== record.lifecycle) {
      throw new TypeError(`incoherent incident record: ${root}`)
    }
    if (record.lifecycle !== 'OPEN') continue
    const entries = Object.entries(value.outbox).filter(([, intent]) => intent.incidentId === record.incidentId)
    if (entries.length === 0) {
      if (record.alertState.delivery !== 'DELIVERED' || value.migration === undefined) throw new TypeError(`open incident lacks outbox: ${root}`)
      continue
    }
    if (entries.length !== 1) throw new TypeError(`open incident has duplicate outbox: ${root}`)
    const [key, intent] = entries[0]
    const compatibleDelivery = intent.delivery === record.alertState.delivery
      || (value.migration !== undefined && record.alertState.delivery === 'FAILED' && intent.delivery === 'PENDING')
    if (key !== notificationKey(intent) || intent.notificationKey !== key || intent.transitionKind !== 'OPEN'
      || intent.transitionRevision !== record.transitionRevision || intent.routeClass !== record.routeClass
      || intent.producer !== record.producer || intent.incident?.rootIdentity !== root || !compatibleDelivery) {
      throw new TypeError(`incoherent incident outbox: ${root}`)
    }
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
  const ownership = { expectedUid, expectedGid }
  const legacy = readStableFile(legacyStatePath, ownership)
  const evidence = readStableFile(legacyEvidencePath, ownership)
  const factsSha256 = hash(Buffer.from(canonicalJSON(findings ?? []), 'utf8'))
  if (legacy.sha256 !== expectedLegacySha256 || evidence.sha256 !== expectedEvidenceSha256 || factsSha256 !== expectedFactsSha256) {
    throw new Error('migration frozen source generation mismatch')
  }
  const migration = { legacySha256: legacy.sha256, evidenceSha256: evidence.sha256, factsSha256 }
  if (initial.hash !== null) {
    if (canonicalJSON(initial.state.migration) !== canonicalJSON(migration)) throw new Error('incident state already exists with a different migration generation')
    return { status: 'ALREADY_MIGRATED', state: initial.state, incidentSha256: initial.hash, ...migration }
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
  state.migration = migration
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
  return { status: 'MIGRATED', state: readback.state, incidentSha256: readback.hash, ...migration }
}
