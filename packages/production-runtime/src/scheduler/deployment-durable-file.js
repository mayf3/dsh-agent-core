import { chmodSync, chownSync, closeSync, constants, copyFileSync, existsSync, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'
import { capturePlainFileMetadata, clearGeneratedFileXattrs, listFileXattrs } from './deployment-file-metadata.js'

export function syncFile(path) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try { fsyncSync(fd) } finally { closeSync(fd) }
}

export function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY)
  try { fsyncSync(fd) } finally { closeSync(fd) }
}

function restoreMetadata(path, metadata) {
  clearGeneratedFileXattrs(path)
  chmodSync(path, metadata.mode)
  if (process.getuid?.() === 0) chownSync(path, metadata.uid, metadata.gid)
}

export function durableCopyPreimage(source, target, metadata, { crashAt, onStage = () => {} } = {}) {
  const temp = `${target}.incoming`
  try {
    if (existsSync(temp)) {
      const abandoned = lstatSync(temp)
      if (!abandoned.isFile() || abandoned.isSymbolicLink() || abandoned.uid !== metadata.uid || abandoned.gid !== metadata.gid) throw new Error('unsafe abandoned preimage candidate')
      unlinkSync(temp); syncDirectory(dirname(temp)); onStage('abandoned-preimage-cleaned')
    }
    if (crashAt === 'before-preimage-copy') throw new Error('injected crash before preimage copy')
    copyFileSync(source, temp, constants.COPYFILE_EXCL)
    restoreMetadata(temp, metadata)
    if (crashAt === 'during-preimage-copy') throw new Error('injected crash during preimage copy')
    syncFile(temp); onStage('preimage-file-synced')
    if (crashAt === 'after-preimage-file-fsync') throw new Error('injected crash after preimage file fsync')
    renameSync(temp, target); onStage('preimage-renamed')
    if (crashAt === 'after-preimage-rename') throw new Error('injected crash after preimage rename')
    syncDirectory(dirname(target)); onStage('preimage-directory-synced')
  } finally { try { unlinkSync(temp) } catch { /* renamed or absent */ } }
}

export function verifyAndSyncPreimage(source, target, metadata, { onStage = () => {} } = {}) {
  if (!readFileSync(source).equals(readFileSync(target))
    || JSON.stringify(capturePlainFileMetadata(target)) !== JSON.stringify(metadata)) throw new Error('durable preimage differs from protected predecessor')
  syncFile(target); onStage('preimage-file-synced')
  syncDirectory(dirname(target)); onStage('preimage-directory-synced')
}

export function verifyReceiptedPreimage({ path, expectedPath, expectedSha256, expectedMetadata, expectedXattrs }) {
  if (path !== expectedPath) throw new Error('receipted preimage path mismatch')
  if (expectedSha256 === null) {
    if (expectedMetadata !== null || expectedXattrs?.length !== 0 || existsSync(path)) throw new Error('unexpected preimage for absent predecessor')
    return
  }
  if (!/^[0-9a-f]{64}$/.test(expectedSha256 ?? '') || !expectedMetadata || !Array.isArray(expectedXattrs) || !existsSync(path)) throw new Error('receipted preimage is missing or malformed')
  const before = lstatSync(path)
  const firstMetadata = capturePlainFileMetadata(path)
  if (JSON.stringify(listFileXattrs(path)) !== JSON.stringify(expectedXattrs)) throw new Error('receipted preimage generation mismatch')
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const opened = fstatSync(fd)
    const bytes = readFileSync(fd)
    const secondMetadata = capturePlainFileMetadata(path)
    if (!opened.isFile() || before.dev !== opened.dev || before.ino !== opened.ino
      || JSON.stringify(firstMetadata) !== JSON.stringify(expectedMetadata)
      || JSON.stringify(secondMetadata) !== JSON.stringify(expectedMetadata)
      || JSON.stringify(listFileXattrs(path)) !== JSON.stringify(expectedXattrs)
      || createHash('sha256').update(bytes).digest('hex') !== expectedSha256) throw new Error('receipted preimage generation mismatch')
    fsyncSync(fd)
  } finally { closeSync(fd) }
  syncDirectory(dirname(path))
}

export function atomicInstallDurableFile(target, bytes, metadata, { crashAt, onStage = () => {} } = {}) {
  const temp = `${target}.incoming.${process.pid}`
  try {
    writeFileSync(temp, bytes, { flag: 'wx' })
    restoreMetadata(temp, metadata)
    syncFile(temp); onStage('candidate-file-synced')
    if (crashAt === 'after-candidate-file-fsync') throw new Error('injected crash after candidate file fsync')
    renameSync(temp, target); onStage('candidate-renamed')
    if (crashAt === 'after-candidate-rename') throw new Error('injected crash after candidate rename')
    syncDirectory(dirname(target)); onStage('target-directory-synced')
  } finally { try { unlinkSync(temp) } catch { /* renamed or absent */ } }
}
