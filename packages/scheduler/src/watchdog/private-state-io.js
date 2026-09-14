import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  chownSync, closeSync, constants, fchownSync, fstatSync, fsyncSync, linkSync, lstatSync,
  mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

function hasExtendedAcl(path) {
  if (process.platform !== 'darwin') return false
  const first = execFileSync('/bin/ls', ['-lde', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')[0] ?? ''
  return /^\S+\+/.test(first)
}

export function ensurePrivateDirectory(path, { expectedUid = process.getuid?.(), expectedGid = process.getgid?.() } = {}) {
  let created = false
  try { created = mkdirSync(path, { recursive: true, mode: 0o700 }) !== undefined } catch (error) { if (error?.code !== 'EEXIST') throw error }
  if (created && process.getuid?.() === 0 && Number.isInteger(expectedUid) && Number.isInteger(expectedGid)) chownSync(path, expectedUid, expectedGid)
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || hasExtendedAcl(path)
    || (Number.isInteger(expectedUid) && stat.uid !== expectedUid) || (Number.isInteger(expectedGid) && stat.gid !== expectedGid)) {
    throw new TypeError('unsafe incident state directory')
  }
  return stat
}

function validateTreeDirectory(path, { expectedUid, expectedGid, privateLeaf = false }) {
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || hasExtendedAcl(path) || (stat.mode & 0o022) !== 0
    || (privateLeaf && (stat.mode & 0o077) !== 0)
    || (Number.isInteger(expectedUid) && stat.uid !== expectedUid)
    || (Number.isInteger(expectedGid) && stat.gid !== expectedGid)) throw new TypeError(`unsafe protected directory tree: ${path}`)
  return stat
}

export function ensureProtectedDirectoryTree(path, { boundary, expectedUid = process.getuid?.(), expectedGid = process.getgid?.() } = {}) {
  if (!isAbsolute(path) || resolve(path) !== path || !isAbsolute(boundary) || resolve(boundary) !== boundary) throw new TypeError('protected directory coordinates must be canonical and absolute')
  const rel = relative(boundary, path)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new TypeError('protected directory lies outside trusted boundary')
  validateTreeDirectory(boundary, { expectedUid, expectedGid })
  let current = boundary
  const parts = rel === '' ? [] : rel.split(sep)
  for (const [index, part] of parts.entries()) {
    current = join(current, part)
    try { lstatSync(current) } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      mkdirSync(current, { mode: 0o700 })
      if (process.getuid?.() === 0 && Number.isInteger(expectedUid) && Number.isInteger(expectedGid)) chownSync(current, expectedUid, expectedGid)
    }
    validateTreeDirectory(current, { expectedUid, expectedGid, privateLeaf: index === parts.length - 1 })
  }
  return validateTreeDirectory(path, { expectedUid, expectedGid, privateLeaf: true })
}

export function readPrivateFile(path, { expectedUid = process.getuid?.(), expectedGid = process.getgid?.(), allowMissing = false } = {}) {
  let before
  try { before = lstatSync(path) } catch (error) { if (allowMissing && error?.code === 'ENOENT') return null; throw error }
  if (!before.isFile() || before.isSymbolicLink() || (before.mode & 0o177) !== 0 || hasExtendedAcl(path)
    || (Number.isInteger(expectedUid) && before.uid !== expectedUid) || (Number.isInteger(expectedGid) && before.gid !== expectedGid)) {
    throw new TypeError('unsafe incident state file')
  }
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const after = fstatSync(fd)
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino) throw new TypeError('unsafe incident state file identity')
    return { bytes: readFileSync(fd), stat: after }
  } finally { closeSync(fd) }
}

export function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY)
  try { fsyncSync(fd) } finally { closeSync(fd) }
}

function ownerAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null
  try { process.kill(pid, 0); return true } catch (error) { return error?.code === 'ESRCH' ? false : null }
}

function stagePrivate(path, bytes, ownership) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600)
  try {
    if (process.getuid?.() === 0 && Number.isInteger(ownership.expectedUid) && Number.isInteger(ownership.expectedGid)) {
      fchownSync(fd, ownership.expectedUid, ownership.expectedGid)
    }
    writeFileSync(fd, bytes)
    fsyncSync(fd)
  } finally { closeSync(fd) }
}

function publishLock(lockPath, serialized, ownership) {
  const temp = `${lockPath}.${process.pid}.${randomUUID()}.tmp`
  try {
    stagePrivate(temp, serialized, ownership)
    linkSync(temp, lockPath)
    syncDirectory(dirname(lockPath))
    return true
  } catch (error) {
    if (error?.code === 'EEXIST') return false
    throw error
  } finally { try { unlinkSync(temp) } catch { /* absent */ } }
}

export function withPrivateLock(path, ownership, operation) {
  const dir = dirname(path)
  ensurePrivateDirectory(dir, ownership)
  const lockPath = `${path}.lock`
  const owner = { pid: process.pid, token: randomUUID() }
  const serialized = Buffer.from(`${JSON.stringify(owner)}\n`)
  if (!publishLock(lockPath, serialized, ownership)) {
    const observed = readPrivateFile(lockPath, ownership)
    let parsed
    try { parsed = JSON.parse(observed.bytes.toString('utf8')) } catch { parsed = null }
    if (ownerAlive(parsed?.pid) !== false) throw new Error('concurrent writer owns private state lock')
    const reapPath = `${lockPath}.reaped.${process.pid}.${randomUUID()}`
    try {
      renameSync(lockPath, reapPath)
      syncDirectory(dir)
      const current = readPrivateFile(reapPath, ownership)
      if (current.stat.dev !== observed.stat.dev || current.stat.ino !== observed.stat.ino || !current.bytes.equals(observed.bytes)) {
        throw new Error('private state lock changed during recovery')
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    } finally { try { unlinkSync(reapPath); syncDirectory(dir) } catch { /* absent */ } }
    if (!publishLock(lockPath, serialized, ownership)) throw new Error('concurrent writer owns private state lock')
  }
  try { return operation() } finally {
    const current = readPrivateFile(lockPath, { ...ownership, allowMissing: true })
    if (current?.bytes.equals(serialized)) { unlinkSync(lockPath); syncDirectory(dir) }
  }
}

export function atomicReplacePrivateFile(path, bytes, ownership) {
  const dir = dirname(path)
  ensurePrivateDirectory(dir, ownership)
  const temp = join(dir, `.${randomUUID()}.private.tmp`)
  try {
    stagePrivate(temp, bytes, ownership)
    renameSync(temp, path)
    syncDirectory(dir)
  } finally { try { unlinkSync(temp) } catch { /* absent after rename */ } }
}
