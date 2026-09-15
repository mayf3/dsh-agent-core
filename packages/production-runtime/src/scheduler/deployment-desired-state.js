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

function frozenCurrent(path, expectedUid, expectedGid) {
  if (!existsSync(path)) return null
  const before = lstatSync(path)
  const fileMetadata = capturePlainFileMetadata(path)
  if (before.uid !== expectedUid || before.gid !== expectedGid || ((before.mode & 0o777) & ~0o640) !== 0) throw new TypeError('unsafe desired-state target')
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const after = fstatSync(fd)
    if (before.dev !== after.dev || before.ino !== after.ino) throw new TypeError('desired-state target changed')
    return { bytes: readFileSync(fd), stat: after, metadata: fileMetadata }
  } finally { closeSync(fd) }
}

export function installSchedulerDesiredState({ bytes, expectedJobs, targetPath, candidatePath, preimagePath, receipt, writeReceipt, expectedUid, expectedGid }) {
  protectedParents(targetPath)
  protectedParents(preimagePath)
  protectedParents(candidatePath)
  if (!existsSync(candidatePath)) {
    writeFileSync(candidatePath, bytes, { mode: 0o600, flag: 'wx' })
    clearGeneratedFileXattrs(candidatePath)
    const candidateFd = openSync(candidatePath, constants.O_RDONLY); try { fsyncSync(candidateFd) } finally { closeSync(candidateFd) }
    syncDirectory(dirname(candidatePath))
  }
  const candidateBytes = frozenCurrent(candidatePath, expectedUid, expectedGid).bytes
  if (JSON.stringify(JSON.parse(candidateBytes).jobs) !== JSON.stringify(expectedJobs)) throw new Error('desired-state semantic generation drift')
  const candidateSha256 = digest(candidateBytes)
  const current = frozenCurrent(targetPath, expectedUid, expectedGid)
  if (receipt) {
    if (receipt.candidatePath !== candidatePath || receipt.candidateSha256 !== candidateSha256 || ![candidateSha256, receipt.preimageSha256].includes(current ? digest(current.bytes) : null)) throw new Error('desired-state deployment generation mismatch')
    if (current && digest(current.bytes) === candidateSha256) return { ...receipt, status: 'ALREADY_INSTALLED' }
    if (receipt.preimageSha256 !== null) {
      const frozenPreimage = frozenCurrent(preimagePath, expectedUid, expectedGid)
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
  chmodSync(temp, current ? current.stat.mode & 0o777 : 0o640)
  if (process.getuid?.() === 0) chownSync(temp, expectedUid, expectedGid)
  const fd = openSync(temp, constants.O_RDONLY); try { fsyncSync(fd) } finally { closeSync(fd) }
  renameSync(temp, targetPath)
  syncDirectory(dirname(targetPath))
  if (digest(frozenCurrent(targetPath, expectedUid, expectedGid).bytes) !== candidateSha256) throw new Error('desired-state readback mismatch')
  receipt = { ...receipt, status: 'INSTALLED' }; writeReceipt(receipt)
  return receipt
}
