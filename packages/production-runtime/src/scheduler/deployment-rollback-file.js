import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs'

import { atomicInstallDurableFile } from './deployment-durable-file.js'
import { capturePlainFileMetadata } from './deployment-file-metadata.js'

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const validMetadata = (value) => value?.acl === 'NONE' && value?.xattrs === 'NONE'
  && Number.isInteger(value.uid) && Number.isInteger(value.gid) && Number.isInteger(value.mode)

function frozenBytes(path) {
  const before = lstatSync(path)
  if (!before.isFile() || before.isSymbolicLink() || (before.mode & 0o022) !== 0) throw new Error(`unsafe rollback preimage: ${path}`)
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const opened = fstatSync(fd)
    if (!opened.isFile() || before.dev !== opened.dev || before.ino !== opened.ino) throw new Error(`rollback preimage changed: ${path}`)
    return readFileSync(fd)
  } finally { closeSync(fd) }
}

export function restoreRollbackFile({
  preimagePath, targetPath, installedSha256, preimageSha256, preimageMetadata,
} = {}) {
  if (!validMetadata(preimageMetadata) || !/^[0-9a-f]{64}$/.test(installedSha256 ?? '')
    || !/^[0-9a-f]{64}$/.test(preimageSha256 ?? '')) throw new Error('invalid rollback metadata authority')
  const targetMetadata = capturePlainFileMetadata(targetPath)
  const currentSha256 = digest(readFileSync(targetPath))
  if (![installedSha256, preimageSha256].includes(currentSha256)) throw new Error(`rollback generation mismatch: ${targetPath}`)
  if (currentSha256 === preimageSha256 && JSON.stringify(targetMetadata) === JSON.stringify(preimageMetadata)) {
    return Object.freeze({ status: 'ALREADY_RESTORED' })
  }
  const bytes = frozenBytes(preimagePath)
  if (digest(bytes) !== preimageSha256) throw new Error(`rollback preimage generation mismatch: ${preimagePath}`)
  atomicInstallDurableFile(targetPath, bytes, preimageMetadata)
  if (digest(readFileSync(targetPath)) !== preimageSha256
    || JSON.stringify(capturePlainFileMetadata(targetPath)) !== JSON.stringify(preimageMetadata)) {
    throw new Error(`rollback readback mismatch: ${targetPath}`)
  }
  return Object.freeze({ status: currentSha256 === preimageSha256 ? 'METADATA_REPAIRED' : 'RESTORED' })
}
