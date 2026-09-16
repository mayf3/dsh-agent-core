import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { canonicalJSON } from '../occurrence-model.js'
import { legacyFingerprint, migrateLegacyAlertState, notificationKey } from './incident-lifecycle.js'
import { providerIdempotencyKey, stableNotificationText } from './delivery.js'
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

function extendCommittedMigration(committed, candidate, migration) {
  if (!committed.migration) throw new Error('incident migration extension requires committed migration authority')
  const existingRoots = new Set(Object.keys(committed.incidents ?? {}))
  const identityFields = ['rootIdentity', 'rootCauseClass', 'routeClass']
  const fingerprints = (facts) => new Map((facts ?? []).map((fact) => [legacyFingerprint(fact), fact]))
  const incidents = structuredClone(candidate.incidents)
  for (const root of existingRoots) {
    const before = committed.incidents[root]
    const after = candidate.incidents?.[root]
    if (!after) {
      incidents[root] = structuredClone(before)
      continue
    }
    if (identityFields.some((field) => canonicalJSON(before[field]) !== canonicalJSON(after[field]))) {
      throw new Error('incident migration extension conflicts with committed root identity')
    }
    const beforeFingerprints = fingerprints(before.facts)
    const afterFingerprints = fingerprints(after.facts)
    if ([...beforeFingerprints.keys()].some((fingerprint) => !afterFingerprints.has(fingerprint))) {
      throw new Error('incident migration extension drops committed fact identity')
    }
    if ((before.symptoms ?? []).some((symptom) => !(after.symptoms ?? []).includes(symptom))) {
      throw new Error('incident migration extension drops committed symptom identity')
    }
    incidents[root] = {
      ...structuredClone(before),
      facts: structuredClone(after.facts),
      symptoms: structuredClone(after.symptoms),
    }
  }
  for (const [key, intent] of Object.entries(candidate.outbox ?? {})) {
    if (existingRoots.has(intent?.incident?.rootIdentity) && committed.outbox?.[key] === undefined) {
      throw new Error('incident migration extension would mint intent for committed root')
    }
  }
  return {
    ...structuredClone(candidate),
    migration,
    incidents,
    outbox: { ...structuredClone(candidate.outbox), ...structuredClone(committed.outbox) },
  }
}

const LIFECYCLES = new Set(['OPEN', 'CLOSED_ACKNOWLEDGED', 'CLOSED_RECOVERED'])
const DELIVERIES = new Set(['PENDING', 'DELIVERED', 'FAILED', 'OUTCOME_UNKNOWN'])
const SHA256 = /^[0-9a-f]{64}$/
const isPlainRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function hasValidMigration(value) {
  if (value.migration === undefined) return false
  const keys = ['evidenceSha256', 'factsSha256', 'legacySha256']
  if (!isPlainRecord(value.migration) || Object.keys(value.migration).sort().join(',') !== keys.sort().join(',')
    || keys.some((key) => !SHA256.test(value.migration[key] ?? ''))) throw new TypeError('incoherent incident migration')
  return value.migration
}

function verifiedMigrationAuthority(path, migration, ownership) {
  if (!migration) return undefined
  const backupDir = join(dirname(path), 'migration-backups')
  const sources = [
    ['legacySha256', `legacy-${migration.legacySha256}.json`],
    ['evidenceSha256', `evidence-${migration.evidenceSha256}.jsonl`],
    ['factsSha256', `facts-${migration.factsSha256}.json`],
  ]
  for (const [field, name] of sources) {
    const loaded = readPrivateFile(join(backupDir, name), ownership)
    if (hash(loaded.bytes) !== migration[field]) throw new TypeError('incident migration backup generation mismatch')
  }
  return migration
}

function requireIncidentRecord(root, record) {
  if (!isPlainRecord(record) || !isPlainRecord(record.alertState) || record.rootIdentity !== root || !LIFECYCLES.has(record.lifecycle)
    || !Number.isSafeInteger(record.episode) || record.episode < 1
    || record.incidentId !== `${root}|episode:${record.episode}` || !Number.isSafeInteger(record.transitionRevision)
    || record.transitionRevision < 1 || record.alertState?.incidentKey !== root
    || record.alertState?.lifecycle !== record.lifecycle || !DELIVERIES.has(record.alertState?.delivery)
    || typeof record.rootCauseClass !== 'string' || record.rootCauseClass.length === 0
    || !Array.isArray(record.facts) || !Array.isArray(record.symptoms)
    || typeof record.routeClass !== 'string' || record.routeClass.length === 0
    || typeof record.producer !== 'string' || record.producer.length === 0) {
    throw new TypeError(`incoherent incident record: ${root}`)
  }
}

function validateOutbox(value) {
  const identities = new Set()
  for (const [key, intent] of Object.entries(value.outbox)) {
    const embedded = intent?.incident
    const root = embedded?.rootIdentity
    const record = value.incidents[root]
    const identity = `${intent?.incidentId}|${intent?.transitionRevision}`
    if (record && isPlainRecord(embedded)) requireIncidentRecord(root, embedded)
    const expectedKind = intent?.transitionRevision === 1 ? 'OPEN'
      : intent?.transitionRevision === 2 && intent?.transitionKind?.startsWith('CLOSED_') ? intent.transitionKind : null
    if (!isPlainRecord(intent) || !isPlainRecord(embedded) || !record || expectedKind !== intent.transitionKind
      || !DELIVERIES.has(intent.delivery)
      || typeof intent.routeClass !== 'string' || intent.routeClass.length === 0
      || typeof intent.producer !== 'string' || intent.producer.length === 0
      || !Number.isSafeInteger(intent.transitionRevision) || intent.transitionRevision < 1
      || intent.payloadRevision !== intent.transitionRevision || intent.notificationKey !== key
      || key !== notificationKey(intent) || identities.has(identity)
      || embedded.incidentId !== intent.incidentId || embedded.transitionRevision !== intent.transitionRevision
      || embedded.lifecycle !== intent.transitionKind || embedded.routeClass !== intent.routeClass
      || embedded.producer !== intent.producer
      || intent.incidentId !== `${root}|episode:${embedded.episode}` || embedded.episode > record.episode
      || (embedded.episode === record.episode && intent.transitionRevision > record.transitionRevision)) {
      throw new TypeError(`incoherent incident outbox: ${key}`)
    }
    const binding = intent.deliveryBinding
    if (binding === undefined) {
      if (intent.deliveryBindingAt !== undefined) throw new TypeError(`incoherent incident delivery binding: ${key}`)
    } else {
      const allowedSources = intent.routeClass === 'SCHEDULER_CONTROL_PLANE_INCIDENT' ? ['canonicalOpsTarget']
        : intent.routeClass === 'JOB_FAILURE' ? ['jobFailureTargets', 'ownerTargets', 'canonicalOpsTarget'] : ['job.delivery']
      if (!isPlainRecord(binding) || Object.keys(binding).sort().join(',') !== 'payload,producer,providerKey,route,routeSource,routingSha256'
        || binding.producer !== intent.producer || !Number.isSafeInteger(intent.deliveryBindingAt)
        || intent.deliveryBindingAt < embedded.alertState.lastTransitionAt
        || binding.providerKey !== providerIdempotencyKey(key) || binding.payload !== stableNotificationText(intent)
        || !allowedSources.includes(binding.routeSource) || !SHA256.test(binding.routingSha256 ?? '')
        || !isPlainRecord(binding.route) || Object.keys(binding.route).sort().join(',') !== 'channel,to'
        || binding.route.channel !== 'feishu' || typeof binding.route.to !== 'string' || binding.route.to.trim() === '') {
        throw new TypeError(`incoherent incident delivery binding: ${key}`)
      }
    }
    const attempted = intent.firstDeliveryAttemptAt !== undefined
    const updated = intent.deliveryUpdatedAt !== undefined
    if ((intent.delivery === 'PENDING' && (attempted || updated))
      || (attempted && (!binding || !Number.isSafeInteger(intent.firstDeliveryAttemptAt)
      || intent.firstDeliveryAttemptAt < intent.deliveryBindingAt))
      || (updated && (!Number.isSafeInteger(intent.deliveryUpdatedAt)
        || intent.deliveryUpdatedAt < (attempted ? intent.firstDeliveryAttemptAt : embedded.alertState.lastTransitionAt)))
      || (['DELIVERED', 'OUTCOME_UNKNOWN'].includes(intent.delivery) && (!binding || !attempted || !updated))
      || (intent.delivery === 'FAILED' && binding && (!attempted || !updated))) {
      throw new TypeError(`incoherent incident delivery chronology: ${key}`)
    }
    identities.add(identity)
  }
}

function validateDeliveryCommitTransition(beforeState, afterState) {
  const allowed = {
    PENDING: new Set(['PENDING', 'FAILED', 'OUTCOME_UNKNOWN']),
    FAILED: new Set(['FAILED', 'OUTCOME_UNKNOWN']),
    OUTCOME_UNKNOWN: new Set(['OUTCOME_UNKNOWN', 'FAILED', 'DELIVERED']),
    DELIVERED: new Set(['DELIVERED']),
  }
  for (const [key, before] of Object.entries(beforeState.outbox ?? {})) {
    const after = afterState.outbox?.[key]
    if (!after || !allowed[before.delivery]?.has(after.delivery)) throw new TypeError(`invalid notification delivery transition: ${key}`)
    for (const field of ['deliveryBinding', 'deliveryBindingAt', 'firstDeliveryAttemptAt']) {
      if (before[field] !== undefined && canonicalJSON(after[field]) !== canonicalJSON(before[field])) {
        throw new TypeError(`notification delivery evidence is immutable: ${key}`)
      }
    }
    if (before.deliveryUpdatedAt !== undefined
      && (!Number.isSafeInteger(after.deliveryUpdatedAt) || after.deliveryUpdatedAt < before.deliveryUpdatedAt)) {
      throw new TypeError(`notification delivery update time cannot regress: ${key}`)
    }
  }
}

export function validateIncidentState(value, { migrationAuthority } = {}) {
  if (!isPlainRecord(value) || value.version !== 1 || !isPlainRecord(value.incidents) || !isPlainRecord(value.outbox)) {
    throw new TypeError('unsupported incident state')
  }
  const migration = hasValidMigration(value)
  const migrated = migration !== false
  if (migrated && canonicalJSON(migration) !== canonicalJSON(migrationAuthority)) throw new TypeError('incident migration authority mismatch')
  validateOutbox(value)
  for (const [root, record] of Object.entries(value.incidents)) {
    requireIncidentRecord(root, record)
    if ((record.lifecycle === 'OPEN' && record.transitionRevision !== 1)
      || (record.lifecycle !== 'OPEN' && record.transitionRevision !== 2 && !(migrated && record.transitionRevision === 1))) {
      throw new TypeError(`incoherent incident lifecycle history: ${root}`)
    }
    const entries = Object.entries(value.outbox).filter(([, intent]) => intent.incidentId === record.incidentId)
    if (entries.length === 0) {
      if (record.alertState.delivery !== 'DELIVERED' || !migrated) throw new TypeError(`incident lacks current outbox: ${root}`)
      continue
    }
    const revisions = new Set(entries.map(([, intent]) => intent.transitionRevision))
    if (!revisions.has(record.transitionRevision) || (!migrated && [...Array(record.transitionRevision)].some((_, index) => !revisions.has(index + 1)))) {
      throw new TypeError(`incident lifecycle history is incomplete: ${root}`)
    }
    const current = entries.filter(([, intent]) => intent.transitionRevision === record.transitionRevision)
    if (current.length !== 1) throw new TypeError(`incident lacks unique current outbox: ${root}`)
    const [key, intent] = current[0]
    const compatibleDelivery = intent.delivery === record.alertState.delivery
      || (migrated && record.alertState.delivery === 'FAILED' && intent.delivery === 'PENDING')
    if (key !== notificationKey(intent) || intent.notificationKey !== key || intent.transitionKind !== record.lifecycle
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
  try {
    const parsed = JSON.parse(bytes.toString('utf8'))
    const migrationAuthority = verifiedMigrationAuthority(path, hasValidMigration(parsed), ownership)
    state = validateIncidentState(parsed, { migrationAuthority })
  } catch (error) {
    throw Object.assign(new TypeError(`corrupt incident state: ${error?.message ?? error}`), { cause: error })
  }
  return { state, hash: hash(bytes) }
}

export function commitIncidentState(path, state, { expectedHash, crashAt, expectedUid = process.getuid?.(), expectedGid = process.getgid?.() } = {}) {
  const ownership = { expectedUid, expectedGid }
  const migrationAuthority = verifiedMigrationAuthority(path, hasValidMigration(state), ownership)
  validateIncidentState(state, { migrationAuthority })
  return withPrivateLock(path, ownership, () => {
    const current = loadIncidentState(path, { expectedUid, expectedGid })
    if (current.hash !== (expectedHash ?? null)) throw new Error('incident state generation mismatch')
    validateDeliveryCommitTransition(current.state, state)
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
  expectedUid = process.getuid?.(), expectedGid = process.getgid?.(),
  sourceExpectedUid = expectedUid, sourceExpectedGid = expectedGid, beforeCommit,
} = {}) {
  const initial = loadIncidentState(incidentStatePath, { expectedUid, expectedGid })
  const ownership = { expectedUid, expectedGid }
  const sourceOwnership = { expectedUid: sourceExpectedUid, expectedGid: sourceExpectedGid }
  const legacy = readStableFile(legacyStatePath, sourceOwnership)
  const evidence = readStableFile(legacyEvidencePath, sourceOwnership)
  const factsSha256 = hash(Buffer.from(canonicalJSON(findings ?? []), 'utf8'))
  if (legacy.sha256 !== expectedLegacySha256 || evidence.sha256 !== expectedEvidenceSha256 || factsSha256 !== expectedFactsSha256) {
    throw new Error('migration frozen source generation mismatch')
  }
  const migration = { legacySha256: legacy.sha256, evidenceSha256: evidence.sha256, factsSha256 }
  if (initial.hash !== null && canonicalJSON(initial.state.migration) === canonicalJSON(migration)) {
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
  let state = migrateLegacyAlertState(predecessor, findings, {
    deliveredFingerprints, failedFingerprints, legacyFacts: factsByFingerprint, nowMs,
  })
  state.migration = migration
  const extended = initial.hash !== null
  if (extended) state = extendCommittedMigration(initial.state, state, migration)
  beforeCommit?.()
  const legacyEnd = readStableFile(legacyStatePath, sourceOwnership)
  const evidenceEnd = readStableFile(legacyEvidencePath, sourceOwnership)
  if (legacyEnd.sha256 !== legacy.sha256 || evidenceEnd.sha256 !== evidence.sha256
    || legacyEnd.stat.dev !== legacy.stat.dev || legacyEnd.stat.ino !== legacy.stat.ino
    || evidenceEnd.stat.dev !== evidence.stat.dev || evidenceEnd.stat.ino !== evidence.stat.ino) {
    throw new Error('migration source generation drifted')
  }
  const backupDir = join(dirname(incidentStatePath), 'migration-backups')
  ensurePrivateDirectory(backupDir, { expectedUid, expectedGid })
  retainBackup(join(backupDir, `legacy-${legacy.sha256}.json`), legacy.bytes, ownership)
  retainBackup(join(backupDir, `evidence-${evidence.sha256}.jsonl`), evidence.bytes, ownership)
  retainBackup(join(backupDir, `facts-${factsSha256}.json`), Buffer.from(canonicalJSON(findings ?? []), 'utf8'), ownership)
  const committed = commitIncidentState(incidentStatePath, state, { expectedHash: initial.hash, expectedUid, expectedGid })
  const readback = loadIncidentState(incidentStatePath, { expectedUid, expectedGid })
  if (readback.hash !== committed.hash) throw new Error('incident migration readback mismatch')
  return { status: extended ? 'MIGRATION_EXTENDED' : 'MIGRATED', state: readback.state, incidentSha256: readback.hash, ...migration }
}
