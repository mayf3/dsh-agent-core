import { chmodSync, chownSync, closeSync, constants, copyFileSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { capturePlainFileMetadata, clearGeneratedFileXattrs } from './deployment-file-metadata.js'

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
  copyFileSync(source, target, constants.COPYFILE_EXCL)
  restoreMetadata(target, metadata)
  syncFile(target); onStage('preimage-file-synced')
  if (crashAt === 'after-preimage-file-fsync') throw new Error('injected crash after preimage file fsync')
  syncDirectory(dirname(target)); onStage('preimage-directory-synced')
}

export function verifyAndSyncPreimage(source, target, metadata, { onStage = () => {} } = {}) {
  if (!readFileSync(source).equals(readFileSync(target))
    || JSON.stringify(capturePlainFileMetadata(target)) !== JSON.stringify(metadata)) throw new Error('durable preimage differs from protected predecessor')
  syncFile(target); onStage('preimage-file-synced')
  syncDirectory(dirname(target)); onStage('preimage-directory-synced')
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
