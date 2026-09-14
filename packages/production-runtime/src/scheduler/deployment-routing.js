import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  chmodSync, chownSync, closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync,
  mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { ROUTE_CLASSES, resolveNotificationRoute, validateRoutingManifest } from '../../../scheduler/src/watchdog/routing.js'

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

function frozenCandidate(path, expectedSha256) {
  if (!isAbsolute(path) || resolve(path) !== path) throw new TypeError('routing candidate path must be canonical and absolute')
  const before = lstatSync(path)
  if (!before.isFile() || before.isSymbolicLink()) throw new TypeError('routing candidate must be a regular non-symlink file')
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const after = fstatSync(fd)
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino) throw new TypeError('routing candidate identity changed')
    const bytes = readFileSync(fd)
    const sha256 = digest(bytes)
    if (sha256 !== expectedSha256) throw new Error('routing candidate generation mismatch')
    return { bytes, sha256, stat: after }
  } finally { closeSync(fd) }
}

function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY)
  try { fsyncSync(fd) } finally { closeSync(fd) }
}

export function installSchedulerRoutingManifest({
  candidatePath, expectedSha256, targetPath, jobs = [], artifactsDir,
  expectedUid = 0, expectedGid, mode = 'apply',
} = {}) {
  if (!Number.isInteger(expectedUid) || !Number.isInteger(expectedGid)) throw new TypeError('routing ownership coordinates required')
  if (!isAbsolute(targetPath) || resolve(targetPath) !== targetPath) throw new TypeError('routing target path must be canonical and absolute')
  const candidate = frozenCandidate(candidatePath, expectedSha256)
  const manifest = validateRoutingManifest(JSON.parse(candidate.bytes.toString('utf8')))
  for (const job of jobs.filter((item) => item.enabled === true)) {
    const decision = resolveNotificationRoute({ routeClass: ROUTE_CLASSES.JOB_FAILURE, job, manifest })
    if (!decision.route) throw new Error(`missing failure route for enabled Job ${job.id}`)
  }
  const preimageDir = join(artifactsDir, 'rollback')
  const preimage = join(preimageDir, 'scheduler-routing.json.preimage')
  const preimageSha256 = existsSync(targetPath) ? digest(readFileSync(targetPath)) : null
  if (mode !== 'apply') return { candidateSha256: candidate.sha256, preimageSha256, enabledJobCount: jobs.filter((job) => job.enabled === true).length }
  mkdirSync(preimageDir, { recursive: true, mode: 0o700 })
  if (existsSync(targetPath) && !existsSync(preimage)) execFileSync('cp', ['-p', targetPath, preimage])
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
  const installed = frozenCandidate(targetPath, candidate.sha256)
  if (installed.stat.uid !== expectedUid || installed.stat.gid !== expectedGid || (installed.stat.mode & 0o777) !== 0o640) {
    throw new Error('routing manifest protected metadata readback mismatch')
  }
  return { candidateSha256: installed.sha256, preimageSha256, enabledJobCount: jobs.filter((job) => job.enabled === true).length }
}
