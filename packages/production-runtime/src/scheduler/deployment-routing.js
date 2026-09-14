import { createHash } from 'node:crypto'
import {
  chmodSync, chownSync, closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync,
  mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import {
  ROUTE_CLASSES, resolveNotificationRoute, validateProtectedPathMetadata, validateRoutingManifest,
} from '../../../scheduler/src/watchdog/routing.js'

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

function metadata(path) {
  const stat = lstatSync(path)
  let extendedAcl = false
  if (process.platform === 'darwin') {
    const line = execFileSync('/bin/ls', ['-lde', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')[0] ?? ''
    extendedAcl = /^\S+\+/.test(line)
  }
  return { type: stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : 'other', symlink: stat.isSymbolicLink(), uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777, extendedAcl }
}

function protectedParents(path, boundary) {
  const parents = []
  let current = dirname(path)
  const stop = resolve(boundary)
  for (;;) {
    parents.push(metadata(current))
    if (current === stop) return parents
    const next = dirname(current)
    const inside = stop === '/' ? current.startsWith('/') : current.startsWith(`${stop}/`)
    if (next === current || !inside) throw new TypeError('protected routing path is outside boundary')
    current = next
  }
}

function frozenProtectedFile(path, expectedSha256, { expectedUid, expectedGid, maxMode, parentBoundary }) {
  if (!isAbsolute(path) || resolve(path) !== path) throw new TypeError('routing candidate path must be canonical and absolute')
  const before = lstatSync(path)
  validateProtectedPathMetadata({ file: metadata(path), parents: protectedParents(path, parentBoundary), expectedUid, allowedGids: [expectedGid], maxMode })
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const after = fstatSync(fd)
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino) throw new TypeError('routing candidate identity changed')
    const bytes = readFileSync(fd)
    const sha256 = digest(bytes)
    if (expectedSha256 !== undefined && sha256 !== expectedSha256) throw new Error('routing candidate generation mismatch')
    return { bytes, sha256, stat: after }
  } finally { closeSync(fd) }
}

function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY)
  try { fsyncSync(fd) } finally { closeSync(fd) }
}

function existingProtected(path, security) {
  try { lstatSync(path) } catch (error) { if (error?.code === 'ENOENT') return null; throw error }
  return frozenProtectedFile(path, undefined, security)
}

function validatePrivateDirectory(path, expectedUid, expectedGid, boundary) {
  const value = metadata(path)
  if (value.type !== 'directory' || value.symlink || value.extendedAcl || value.uid !== expectedUid
    || value.gid !== expectedGid || (value.mode & 0o077) !== 0
    || protectedParents(path, boundary).some((parent) => parent.type !== 'directory' || parent.symlink || parent.extendedAcl || (parent.mode & 0o022) !== 0)) {
    throw new TypeError('unsafe routing rollback directory')
  }
}

export function installSchedulerRoutingManifest({
  candidatePath, expectedSha256, targetPath, jobs = [], artifactsDir,
  expectedUid = 0, expectedGid, candidateUid = process.getuid?.(), candidateGid = process.getgid?.(), targetBoundary, mode = 'apply',
} = {}) {
  if (!Number.isInteger(expectedUid) || !Number.isInteger(expectedGid)) throw new TypeError('routing ownership coordinates required')
  if (!isAbsolute(targetPath) || resolve(targetPath) !== targetPath) throw new TypeError('routing target path must be canonical and absolute')
  if (!isAbsolute(targetBoundary) || resolve(targetBoundary) !== targetBoundary) throw new TypeError('trusted routing target boundary required')
  const targetParents = protectedParents(targetPath, targetBoundary)
  if (targetParents.some((parent) => parent.type !== 'directory' || parent.symlink || parent.extendedAcl || (parent.mode & 0o022) !== 0)) {
    throw new TypeError('unsafe routing target parent chain')
  }
  const candidate = frozenProtectedFile(candidatePath, expectedSha256, {
    expectedUid: candidateUid, expectedGid: candidateGid, maxMode: 0o600, parentBoundary: dirname(candidatePath),
  })
  const manifest = validateRoutingManifest(JSON.parse(candidate.bytes.toString('utf8')))
  for (const job of jobs.filter((item) => item.enabled === true)) {
    const decision = resolveNotificationRoute({ routeClass: ROUTE_CLASSES.JOB_FAILURE, job, manifest })
    if (!decision.route) throw new Error(`missing failure route for enabled Job ${job.id}`)
  }
  const preimageDir = join(artifactsDir, 'rollback')
  const preimage = join(preimageDir, 'scheduler-routing.json.preimage')
  const receiptPath = join(preimageDir, 'routing-install-receipt.json')
  const existing = existingProtected(targetPath, {
    expectedUid, expectedGid, maxMode: 0o640, parentBoundary: targetBoundary,
  })
  const preimageSha256 = existing?.sha256 ?? null
  if (mode !== 'apply') return { candidateSha256: candidate.sha256, preimageSha256, enabledJobCount: jobs.filter((job) => job.enabled === true).length }
  mkdirSync(preimageDir, { recursive: true, mode: 0o700 })
  if (process.getuid?.() === 0) chownSync(preimageDir, expectedUid, expectedGid)
  validatePrivateDirectory(preimageDir, expectedUid, expectedGid, dirname(artifactsDir))
  let receipt
  if (existsSync(receiptPath)) {
    receipt = JSON.parse(frozenProtectedFile(receiptPath, undefined, {
      expectedUid, expectedGid, maxMode: 0o600, parentBoundary: preimageDir,
    }).bytes.toString('utf8'))
    if (receipt.candidateSha256 !== candidate.sha256 || ![candidate.sha256, receipt.preimageSha256].includes(existing?.sha256 ?? null)) {
      throw new Error('routing deployment receipt generation mismatch')
    }
    if (existing?.sha256 === candidate.sha256) return { ...receipt, status: 'ALREADY_INSTALLED' }
  } else {
    receipt = { status: 'INSTALLING', candidateSha256: candidate.sha256, preimageSha256, enabledJobCount: jobs.filter((job) => job.enabled === true).length }
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    if (process.getuid?.() === 0) chownSync(receiptPath, expectedUid, expectedGid)
    const receiptFd = openSync(receiptPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    try { fsyncSync(receiptFd) } finally { closeSync(receiptFd) }
    syncDirectory(preimageDir)
  }
  if (existing && !existsSync(preimage)) {
    writeFileSync(preimage, existing.bytes, { mode: 0o600, flag: 'wx' })
    if (process.getuid?.() === 0) chownSync(preimage, expectedUid, expectedGid)
    const preFd = openSync(preimage, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    try { fsyncSync(preFd) } finally { closeSync(preFd) }
    syncDirectory(preimageDir)
  }
  mkdirSync(dirname(targetPath), { recursive: true })
  const temp = `${targetPath}.incoming.${process.pid}`
  try {
    writeFileSync(temp, candidate.bytes, { mode: 0o600, flag: 'wx' })
    chmodSync(temp, 0o640)
    chownSync(temp, expectedUid, expectedGid)
    const fd = openSync(temp, constants.O_RDONLY)
    try { fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(temp, targetPath)
    syncDirectory(dirname(targetPath))
  } finally { try { unlinkSync(temp) } catch { /* renamed or absent */ } }
  const installed = frozenProtectedFile(targetPath, candidate.sha256, {
    expectedUid, expectedGid, maxMode: 0o640, parentBoundary: targetBoundary,
  })
  if (installed.stat.uid !== expectedUid || installed.stat.gid !== expectedGid || (installed.stat.mode & 0o777) !== 0o640) {
    throw new Error('routing manifest protected metadata readback mismatch')
  }
  receipt.status = 'INSTALLED'
  const receiptTemp = `${receiptPath}.incoming.${process.pid}`
  writeFileSync(receiptTemp, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  if (process.getuid?.() === 0) chownSync(receiptTemp, expectedUid, expectedGid)
  renameSync(receiptTemp, receiptPath); syncDirectory(preimageDir)
  return receipt
}
