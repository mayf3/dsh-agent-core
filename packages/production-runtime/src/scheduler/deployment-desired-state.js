import { createHash } from 'node:crypto'
import { chmodSync, chownSync, closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, readlinkSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { capturePlainFileMetadata, clearGeneratedFileXattrs } from './deployment-file-metadata.js'

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
function syncDirectory(path) { const fd = openSync(path, constants.O_RDONLY); try { fsyncSync(fd) } finally { closeSync(fd) } }

function protectedParents(path) {
  let current = dirname(path)
  for (;;) {
    const stat = lstatSync(current)
    const trustedMacVarAlias = process.platform === 'darwin' && current === '/var'
      && stat.isSymbolicLink() && stat.uid === 0 && stat.gid === 0
      && readlinkSync(current) === 'private/var' && realpathSync(current) === '/private/var'
    if (trustedMacVarAlias) { current = '/private/var'; continue }
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o022) !== 0) throw new TypeError(`unsafe desired-state parent: ${current}`)
    if (current === '/') return
    current = dirname(current)
  }
}

const metadataMatches = (actual, expected) => Boolean(actual && expected
  && actual.uid === expected.uid && actual.gid === expected.gid && actual.mode === expected.mode
  && actual.acl === expected.acl && actual.xattrs === expected.xattrs)

const sameOpenFileSnapshot = (left, right) => left.dev === right.dev && left.ino === right.ino
  && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode
  && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs

function frozenCurrent(path, expectedUid, expectedGid, { allowLegacyReadable = false } = {}) {
  if (!existsSync(path)) return null
  const before = lstatSync(path)
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const opened = fstatSync(fd, { bigint: true })
    const mode = Number(opened.mode & 0o777n)
    const protectedMode = (mode & ~0o640) === 0
    if (!opened.isFile() || Number(opened.uid) !== expectedUid || Number(opened.gid) !== expectedGid
      || (!protectedMode && !(allowLegacyReadable && mode === 0o644))
      || BigInt(before.dev) !== opened.dev || BigInt(before.ino) !== opened.ino) throw new TypeError('unsafe desired-state target')
    const fileMetadata = capturePlainFileMetadata(path)
    const bytes = readFileSync(fd)
    const after = fstatSync(fd, { bigint: true })
    const pathAfter = lstatSync(path, { bigint: true })
    if (!sameOpenFileSnapshot(opened, after) || pathAfter.dev !== after.dev || pathAfter.ino !== after.ino
      || Number(pathAfter.uid) !== expectedUid || Number(pathAfter.gid) !== expectedGid
      || Number(pathAfter.mode & 0o777n) !== mode) throw new TypeError('desired-state target changed')
    return { bytes, stat: after, metadata: fileMetadata }
  } finally { closeSync(fd) }
}

export function installSchedulerDesiredState({ bytes, expectedJobs, targetPath, candidatePath, preimagePath, receipt, writeReceipt, expectedUid, expectedGid, controlUid = expectedUid, controlGid = expectedGid }) {
  protectedParents(targetPath)
  protectedParents(preimagePath)
  protectedParents(candidatePath)
  if (!existsSync(candidatePath)) {
    writeFileSync(candidatePath, bytes, { mode: 0o600, flag: 'wx' })
    clearGeneratedFileXattrs(candidatePath)
    const candidateFd = openSync(candidatePath, constants.O_RDONLY); try { fsyncSync(candidateFd) } finally { closeSync(candidateFd) }
    syncDirectory(dirname(candidatePath))
  }
  const candidateBytes = frozenCurrent(candidatePath, controlUid, controlGid).bytes
  if (JSON.stringify(JSON.parse(candidateBytes).jobs) !== JSON.stringify(expectedJobs)) throw new Error('desired-state semantic generation drift')
  const candidateSha256 = digest(candidateBytes)
  const current = frozenCurrent(targetPath, expectedUid, expectedGid, { allowLegacyReadable: true })
  if (receipt) {
    const currentSha256 = current ? digest(current.bytes) : null
    const installedMode = receipt.preimageMetadata?.mode === 0o644 ? 0o640 : receipt.preimageMetadata?.mode ?? 0o640
    const installedMetadata = { uid: expectedUid, gid: expectedGid, mode: installedMode, acl: 'NONE', xattrs: 'NONE' }
    const preimageMatches = currentSha256 === receipt.preimageSha256
      && (currentSha256 === null ? receipt.preimageMetadata === null : metadataMatches(current?.metadata, receipt.preimageMetadata))
    const installedMatches = currentSha256 === candidateSha256 && metadataMatches(current?.metadata, installedMetadata)
    if (receipt.targetPath !== targetPath || receipt.candidatePath !== candidatePath || receipt.preimagePath !== preimagePath
      || receipt.candidateSha256 !== candidateSha256 || !['INSTALLING', 'INSTALLED'].includes(receipt.status)
      || (receipt.status === 'INSTALLED' ? !installedMatches : !preimageMatches && !installedMatches)) {
      throw new Error('desired-state deployment generation mismatch')
    }
    if (installedMatches) {
      if (receipt.status === 'INSTALLING') writeReceipt({ ...receipt, status: 'INSTALLED' })
      return { ...receipt, status: 'ALREADY_INSTALLED' }
    }
    if (receipt.preimageSha256 !== null) {
      const frozenPreimage = frozenCurrent(preimagePath, controlUid, controlGid)
      if (!frozenPreimage || digest(frozenPreimage.bytes) !== receipt.preimageSha256) throw new Error('desired-state preimage generation mismatch')
    }
  } else {
    const preimageSha256 = current ? digest(current.bytes) : null
    receipt = { status: 'INSTALLING', targetPath, candidatePath, preimagePath, preimageSha256,
      preimageMetadata: current?.metadata ?? null, candidateSha256 }
    if (current) {
      writeFileSync(preimagePath, current.bytes, { mode: 0o600, flag: 'wx' })
      clearGeneratedFileXattrs(preimagePath)
      const preimageFd = openSync(preimagePath, constants.O_RDONLY); try { fsyncSync(preimageFd) } finally { closeSync(preimageFd) }
      syncDirectory(dirname(preimagePath))
    }
    writeReceipt(receipt)
  }
  const temp = `${targetPath}.incoming.${process.pid}`
  writeFileSync(temp, candidateBytes, { mode: 0o600, flag: 'wx' })
  clearGeneratedFileXattrs(temp)
  const currentMode = current ? Number(current.stat.mode & 0o777n) : null
  chmodSync(temp, currentMode === 0o644 ? 0o640 : currentMode ?? 0o640)
  // best-effort ownership set: root always lands uid/gid exactly; unprivileged runs may
  // still set a supplementary group they belong to — the readback below fails closed
  // whenever the installed metadata does not match the expected contract
  try { chownSync(temp, expectedUid, expectedGid) } catch { /* non-root: creator gid retained */ }
  const fd = openSync(temp, constants.O_RDONLY); try { fsyncSync(fd) } finally { closeSync(fd) }
  renameSync(temp, targetPath)
  syncDirectory(dirname(targetPath))
  if (digest(frozenCurrent(targetPath, expectedUid, expectedGid).bytes) !== candidateSha256) throw new Error('desired-state readback mismatch')
  receipt = { ...receipt, status: 'INSTALLED' }; writeReceipt(receipt)
  return receipt
}
