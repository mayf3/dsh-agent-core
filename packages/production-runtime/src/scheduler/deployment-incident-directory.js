import {
  closeSync, constants, existsSync, fchmodSync, fchownSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync,
} from 'node:fs'
import { join } from 'node:path'

import { hasExtendedAcl } from './deployment-file-metadata.js'

const fail = () => { throw new TypeError('unsafe incident state directory') }

function normalizeEntry(relative, path, kind, expectedUid, expectedGid, allowedLegacyGids, repaired, skipped) {
  const before = lstatSync(path)
  const typeOk = kind === 'directory' ? before.isDirectory() : before.isFile()
  if (!typeOk || before.isSymbolicLink()) {
    skipped.push(relative)
    return
  }
  if (before.uid !== expectedUid || (before.gid !== expectedGid && !allowedLegacyGids.includes(before.gid))) fail()
  if (hasExtendedAcl(path)) fail()
  const mode = before.mode & 0o777
  if (kind === 'directory' ? ![0o700, 0o755].includes(mode) : mode !== 0o600) fail()
  if (before.gid === expectedGid && (kind === 'file' || mode === 0o700)) return
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const opened = fstatSync(fd)
    if ((kind === 'directory' ? !opened.isDirectory() : !opened.isFile())
      || before.dev !== opened.dev || before.ino !== opened.ino) fail()
    fchownSync(fd, expectedUid, expectedGid)
    if (kind === 'directory' && (opened.mode & 0o777) === 0o755) fchmodSync(fd, 0o700)
    const final = fstatSync(fd)
    const readback = lstatSync(path)
    if (final.uid !== expectedUid || final.gid !== expectedGid
      || (final.mode & 0o777) !== (kind === 'directory' ? 0o700 : 0o600)
      || readback.dev !== final.dev || readback.ino !== final.ino || hasExtendedAcl(path)) fail()
  } finally { closeSync(fd) }
  repaired.push(relative)
}

export function preparePrivateRuntimeDirectory({ path, expectedUid, expectedGid, allowedLegacyGids = [] } = {}) {
  if (typeof path !== 'string' || path === '' || !Number.isInteger(expectedUid) || !Number.isInteger(expectedGid)
    || !Array.isArray(allowedLegacyGids) || allowedLegacyGids.some((gid) => !Number.isInteger(gid))) fail()
  let created = false
  if (!existsSync(path)) {
    mkdirSync(path, { mode: 0o700 })
    created = true
  }
  const before = lstatSync(path)
  if (!before.isDirectory() || before.isSymbolicLink() || hasExtendedAcl(path)) fail()
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    let opened = fstatSync(fd)
    if (!opened.isDirectory() || before.dev !== opened.dev || before.ino !== opened.ino) fail()
    if (created && process.getuid?.() === 0) {
      fchownSync(fd, expectedUid, expectedGid)
      opened = fstatSync(fd)
    }
    const mode = opened.mode & 0o777
    const legacyGid = opened.gid !== expectedGid && allowedLegacyGids.includes(opened.gid)
    if (opened.uid !== expectedUid || (!legacyGid && opened.gid !== expectedGid) || ![0o700, 0o755].includes(mode)) fail()
    if (legacyGid) {
      fchownSync(fd, expectedUid, expectedGid)
      opened = fstatSync(fd)
    }
    if (mode === 0o755) fchmodSync(fd, 0o700)
    const final = fstatSync(fd)
    const readback = lstatSync(path)
    if (final.uid !== expectedUid || final.gid !== expectedGid || (final.mode & 0o777) !== 0o700
      || readback.dev !== final.dev || readback.ino !== final.ino || hasExtendedAcl(path)) fail()
    return Object.freeze({ status: legacyGid ? (mode === 0o755 ? 'OWNERSHIP_AND_MODE_MIGRATED' : 'OWNERSHIP_MIGRATED') : mode === 0o755 ? 'NARROWED' : 'READY' })
  } finally { closeSync(fd) }
}

export function normalizeLegacyIncidentStateFiles({ stateDir, expectedUid, expectedGid, allowedLegacyGids = [] } = {}) {
  if (typeof stateDir !== 'string' || stateDir === '' || !Number.isInteger(expectedUid) || !Number.isInteger(expectedGid)
    || !Array.isArray(allowedLegacyGids) || allowedLegacyGids.some((gid) => !Number.isInteger(gid))) fail()
  const repaired = []
  const skipped = []
  let inspected = 0
  if (!existsSync(stateDir)) {
    return Object.freeze({ status: 'READY', repaired: Object.freeze([]), skipped: Object.freeze([]), inspected })
  }
  const consider = (relative, path, kind) => {
    inspected += 1
    normalizeEntry(relative, path, kind, expectedUid, expectedGid, allowedLegacyGids, repaired, skipped)
  }
  for (const entry of readdirSync(stateDir).sort()) {
    if (entry === 'incidents.json' || entry === 'incidents.json.lock' || entry.startsWith('incidents.json.lock.')) {
      consider(entry, join(stateDir, entry), 'file')
    } else if (entry === 'migration-backups') {
      const backupDir = join(stateDir, entry)
      consider(entry, backupDir, 'directory')
      if (lstatSync(backupDir).isDirectory() && !lstatSync(backupDir).isSymbolicLink()) {
        for (const child of readdirSync(backupDir).sort()) {
          consider(`${entry}/${child}`, join(backupDir, child), 'file')
        }
      }
    }
  }
  return Object.freeze({
    status: repaired.length > 0 ? 'NORMALIZED' : 'READY',
    repaired: Object.freeze([...repaired]),
    skipped: Object.freeze([...skipped]),
    inspected,
  })
}
