import { createHash } from 'node:crypto'
import { chmodSync, chownSync, closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

function protectedParents(path) {
  let current = dirname(path)
  for (;;) {
    const stat = lstatSync(current)
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o022) !== 0) throw new TypeError(`unsafe desired-state parent: ${current}`)
    if (current === '/') return
    current = dirname(current)
  }
}

function frozenCurrent(path, expectedUid, expectedGid) {
  if (!existsSync(path)) return null
  const before = lstatSync(path)
  if (!before.isFile() || before.isSymbolicLink() || before.uid !== expectedUid || before.gid !== expectedGid || ((before.mode & 0o777) & ~0o640) !== 0) throw new TypeError('unsafe desired-state target')
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const after = fstatSync(fd)
    if (before.dev !== after.dev || before.ino !== after.ino) throw new TypeError('desired-state target changed')
    return { bytes: readFileSync(fd), stat: after }
  } finally { closeSync(fd) }
}

export function installSchedulerDesiredState({ bytes, targetPath, preimagePath, receipt, writeReceipt, expectedUid, expectedGid }) {
  protectedParents(targetPath)
  mkdirSync(dirname(preimagePath), { recursive: true, mode: 0o700 })
  const candidateSha256 = digest(bytes)
  const current = frozenCurrent(targetPath, expectedUid, expectedGid)
  if (receipt) {
    if (receipt.candidateSha256 !== candidateSha256 || ![candidateSha256, receipt.preimageSha256].includes(current ? digest(current.bytes) : null)) throw new Error('desired-state deployment generation mismatch')
    if (current && digest(current.bytes) === candidateSha256) return { ...receipt, status: 'ALREADY_INSTALLED' }
  } else {
    const preimageSha256 = current ? digest(current.bytes) : null
    receipt = { status: 'INSTALLING', targetPath, preimagePath, preimageSha256, candidateSha256 }
    if (current) writeFileSync(preimagePath, current.bytes, { mode: 0o600, flag: 'wx' })
    writeReceipt(receipt)
  }
  const temp = `${targetPath}.incoming.${process.pid}`
  writeFileSync(temp, bytes, { mode: 0o600, flag: 'wx' })
  chmodSync(temp, current ? current.stat.mode & 0o777 : 0o640)
  if (process.getuid?.() === 0) chownSync(temp, expectedUid, expectedGid)
  const fd = openSync(temp, constants.O_RDONLY); try { fsyncSync(fd) } finally { closeSync(fd) }
  renameSync(temp, targetPath)
  if (digest(frozenCurrent(targetPath, expectedUid, expectedGid).bytes) !== candidateSha256) throw new Error('desired-state readback mismatch')
  receipt = { ...receipt, status: 'INSTALLED' }; writeReceipt(receipt)
  return receipt
}
