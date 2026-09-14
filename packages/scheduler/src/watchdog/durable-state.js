import { createHash, randomUUID } from 'node:crypto'
import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync,
  fchownSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { canonicalJSON } from '../occurrence-model.js'
import { migrateLegacyAlertState } from './incident-lifecycle.js'

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function appendPrivateJsonl(path, value, { expectedUid = process.getuid?.(), expectedGid = process.getgid?.() } = {}) {
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  assertPrivateDirectory(dir, { expectedUid, expectedGid })
  const lockPath = `${path}.lock`
  let lockFd
  let fd
  try {
    lockFd = openSync(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600)
    const existed = (() => { try { lstatSync(path); return true } catch (error) { if (error?.code === 'ENOENT') return false; throw error } })()
    if (existed) assertStateFile(path, { expectedUid, expectedGid })
    fd = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0), 0o600)
    if (!existed && process.getuid?.() === 0 && Number.isInteger(expectedUid) && Number.isInteger(expectedGid)) fchownSync(fd, expectedUid, expectedGid)
    const stat = fstatSync(fd)
    if (!stat.isFile() || (stat.mode & 0o177) !== 0 || (Number.isInteger(expectedUid) && stat.uid !== expectedUid)
      || (Number.isInteger(expectedGid) && stat.gid !== expectedGid)) throw new TypeError('unsafe private jsonl sink')
    writeFileSync(fd, `${JSON.stringify(value)}\n`)
    fsyncSync(fd)
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('concurrent writer owns private jsonl sink lock')
    throw error
  } finally {
    if (fd !== undefined) closeSync(fd)
    if (lockFd !== undefined) {
      closeSync(lockFd)
      try { unlinkSync(lockPath) } catch { /* absent */ }
    }
  }
}

function readStableFile(path) {
  const before = lstatSync(path)
  if (!before.isFile() || before.isSymbolicLink()) throw new TypeError('unsafe migration source')
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const after = fstatSync(fd)
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino) throw new TypeError('migration source identity changed')
    const bytes = readFileSync(fd)
    return { bytes, sha256: hash(bytes) }
  } finally { closeSync(fd) }
}

function retainBackup(path, bytes) {
  let fd
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600)
    writeFileSync(fd, bytes)
    fsyncSync(fd)
  } catch (error) {
    if (error?.code !== 'EEXIST' || hash(assertStateFile(path, {})) !== hash(bytes)) throw error
  } finally { if (fd !== undefined) closeSync(fd) }
}

function assertPrivateDirectory(path, { expectedUid = process.getuid?.(), expectedGid } = {}) {
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    throw new TypeError('unsafe incident state directory')
  }
  if (Number.isInteger(expectedUid) && stat.uid !== expectedUid) throw new TypeError('unsafe incident state directory owner')
  if (Number.isInteger(expectedGid) && stat.gid !== expectedGid) throw new TypeError('unsafe incident state directory group')
}

function assertStateFile(path, { expectedUid = process.getuid?.(), expectedGid } = {}) {
  const before = lstatSync(path)
  if (!before.isFile() || before.isSymbolicLink() || (before.mode & 0o177) !== 0) {
    throw new TypeError('unsafe incident state file')
  }
  if (Number.isInteger(expectedUid) && before.uid !== expectedUid) throw new TypeError('unsafe incident state file owner')
  if (Number.isInteger(expectedGid) && before.gid !== expectedGid) throw new TypeError('unsafe incident state file group')
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const after = fstatSync(fd)
    if (before.dev !== after.dev || before.ino !== after.ino || !after.isFile()) throw new TypeError('unsafe incident state file identity')
    return readFileSync(fd)
  } finally {
    closeSync(fd)
  }
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
  let bytes
  try {
    bytes = assertStateFile(path, ownership)
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: { version: 1, incidents: {}, outbox: {} }, hash: null }
    throw error
  }
  let state
  try { state = validateState(JSON.parse(bytes.toString('utf8'))) } catch (error) {
    throw Object.assign(new TypeError(`corrupt incident state: ${error?.message ?? error}`), { cause: error })
  }
  return { state, hash: hash(bytes) }
}

export function commitIncidentState(path, state, { expectedHash, crashAt, expectedUid = process.getuid?.(), expectedGid = process.getgid?.() } = {}) {
  validateState(state)
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  assertPrivateDirectory(dir, { expectedUid, expectedGid })
  const lockPath = `${path}.lock`
  let lockFd
  try {
    lockFd = openSync(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600)
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('concurrent writer owns incident state lock')
    throw error
  }
  const temp = join(dir, `.${randomUUID()}.incident.tmp`)
  try {
    const current = loadIncidentState(path, { expectedUid, expectedGid })
    if (current.hash !== (expectedHash ?? null)) throw new Error('incident state generation mismatch')
    const bytes = Buffer.from(`${JSON.stringify(state, null, 2)}\n`, 'utf8')
    const tempFd = openSync(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600)
    try {
      if (process.getuid?.() === 0 && Number.isInteger(expectedUid) && Number.isInteger(expectedGid)) fchownSync(tempFd, expectedUid, expectedGid)
      writeFileSync(tempFd, bytes)
      fsyncSync(tempFd)
    } finally {
      closeSync(tempFd)
    }
    if (crashAt === 'before-rename') throw new Error('injected crash before rename')
    renameSync(temp, path)
    const dirFd = openSync(dir, constants.O_RDONLY)
    try { fsyncSync(dirFd) } finally { closeSync(dirFd) }
    return { hash: hash(bytes) }
  } finally {
    try { unlinkSync(temp) } catch { /* absent after rename */ }
    if (lockFd !== undefined) closeSync(lockFd)
    try { unlinkSync(lockPath) } catch { /* best effort after close */ }
  }
}

export function migrateLegacyIncidentStateFiles({
  legacyStatePath, legacyEvidencePath, incidentStatePath, findings, legacyFacts,
  expectedLegacySha256, expectedEvidenceSha256, expectedFactsSha256,
  deliveredFingerprints = new Set(), failedFingerprints = new Set(), nowMs = Date.now(),
  expectedUid = process.getuid?.(), expectedGid = process.getgid?.(), beforeCommit,
} = {}) {
  const initial = loadIncidentState(incidentStatePath, { expectedUid, expectedGid })
  if (initial.hash !== null) throw new Error('incident state already exists; migration is one-time only')
  const legacy = readStableFile(legacyStatePath)
  const evidence = readStableFile(legacyEvidencePath)
  const factsSha256 = hash(Buffer.from(canonicalJSON(findings ?? []), 'utf8'))
  if (legacy.sha256 !== expectedLegacySha256 || evidence.sha256 !== expectedEvidenceSha256 || factsSha256 !== expectedFactsSha256) {
    throw new Error('migration frozen source generation mismatch')
  }
  let predecessor
  try { predecessor = JSON.parse(legacy.bytes.toString('utf8')) } catch (error) {
    throw Object.assign(new TypeError('corrupt legacy incident state'), { cause: error })
  }
  const state = migrateLegacyAlertState(predecessor, findings, {
    deliveredFingerprints, failedFingerprints, legacyFacts, nowMs,
  })
  beforeCommit?.()
  const legacyEnd = readStableFile(legacyStatePath)
  const evidenceEnd = readStableFile(legacyEvidencePath)
  if (legacyEnd.sha256 !== legacy.sha256 || evidenceEnd.sha256 !== evidence.sha256) throw new Error('migration source generation drifted')
  const backupDir = join(dirname(incidentStatePath), 'migration-backups')
  mkdirSync(backupDir, { recursive: true, mode: 0o700 })
  assertPrivateDirectory(backupDir, { expectedUid, expectedGid })
  retainBackup(join(backupDir, `legacy-${legacy.sha256}.json`), legacy.bytes)
  retainBackup(join(backupDir, `evidence-${evidence.sha256}.jsonl`), evidence.bytes)
  const committed = commitIncidentState(incidentStatePath, state, { expectedHash: null, expectedUid, expectedGid })
  const readback = loadIncidentState(incidentStatePath, { expectedUid, expectedGid })
  if (readback.hash !== committed.hash) throw new Error('incident migration readback mismatch')
  return { state: readback.state, incidentSha256: readback.hash, legacySha256: legacy.sha256, evidenceSha256: evidence.sha256, factsSha256 }
}
