/** Concrete, read-only root-custody adapter for restart-quiescence evidence. */
import { createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fstatSync, lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE_KIND = 0o100000
const DIR_KIND = 0o040000
const TYPE_MASK = 0o170000
const HASH = /^[a-f0-9]{64}$/

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

function bad(code) {
  throw Object.assign(new Error(`restart quiescence proof rejected: ${code}`), { code })
}

export const defaultEvidenceIO = Object.freeze({
  stat: lstatSync,
  fstat: fstatSync,
  readFile: readFileSync,
  challengeWindow(fd, challenge) {
    // A separate bounded child probes the inherited launcher socket. A dead
    // or stalled root launcher cannot hang Router startup indefinitely.
    const probe = `const fs=require('node:fs');const q=process.env.RQ_CHALLENGE;
      fs.writeSync(3,q+'\\n');const b=Buffer.alloc(4096);const n=fs.readSync(3,b,0,b.length,null);
      if(n<=0||n>=b.length)process.exit(2);process.stdout.write(b.subarray(0,n));`
    const result = spawnSync(process.execPath, ['-e', probe], {
      stdio: ['ignore', 'pipe', 'pipe', fd],
      env: { RQ_CHALLENGE: JSON.stringify(challenge) },
      timeout: 750,
      maxBuffer: 4096,
      encoding: 'utf8',
    })
    if (result.error || result.status !== 0) bad('window_challenge_unavailable')
    try { return JSON.parse(result.stdout.trim()) }
    catch { bad('window_challenge_invalid') }
  },
})

function owned(stat, kind) {
  return stat?.uid === 0 && (stat.mode & TYPE_MASK) === kind
    && (stat.mode & 0o022) === 0
}

export function ownedDirectory(path, io = defaultEvidenceIO) {
  let stat
  try { stat = io.stat(path) } catch { bad('custody_directory_unavailable') }
  if (!owned(stat, DIR_KIND)) bad('custody_directory_invalid')
  return stat
}

export function ownedFile(path, maxBytes, io = defaultEvidenceIO) {
  let stat
  try { stat = io.stat(path) } catch { bad('custody_file_unavailable') }
  if (!owned(stat, FILE_KIND) || stat.size > maxBytes || stat.size < 1) bad('custody_file_invalid')
  let bytes
  try { bytes = (io.readFile ?? readFileSync)(path) } catch { bad('custody_file_unreadable') }
  if (bytes.length !== stat.size) bad('custody_file_changed')
  const after = io.stat(path)
  if (after.dev !== stat.dev || after.ino !== stat.ino || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) {
    bad('custody_file_changed')
  }
  return bytes
}

export function ownedJson(path, expectedDigest, io = defaultEvidenceIO, maxBytes = 65536) {
  if (!HASH.test(expectedDigest)) bad('digest_invalid')
  const bytes = ownedFile(path, maxBytes, io)
  if (sha256(bytes) !== expectedDigest) bad('digest_mismatch')
  try { return JSON.parse(bytes.toString('utf8')) } catch { bad('json_invalid') }
}

export function namedReceipt(dir, name, digest, io = defaultEvidenceIO) {
  if (!/^[a-z][a-z0-9-]{0,63}\.json$/.test(name)) bad('receipt_name_invalid')
  return ownedJson(join(dir, name), digest, io)
}

function verifyCurrentWindowState(evidenceDir, bundle, startup, io) {
  const windowPath = join(evidenceDir, 'window.lock')
  const lock = io.stat(windowPath)
  if (!owned(lock, FILE_KIND) || (lock.mode & 0o077) !== 0) bad('window_lock_custody_invalid')
  if (!Number.isSafeInteger(startup.windowFd) || startup.windowFd < 3
      || !Number.isSafeInteger(startup.challengeFd) || startup.challengeFd < 3) bad('window_fd_missing')
  let inherited
  try { inherited = io.fstat(startup.windowFd) } catch { bad('window_fd_unavailable') }
  if (!owned(inherited, FILE_KIND) || inherited.dev !== lock.dev || inherited.ino !== lock.ino) {
    bad('window_fd_identity_mismatch')
  }
  const challenge = {
    operationId: bundle.recoveryCutover.operationId,
    hostId: bundle.recoveryCutover.hostId,
    startupNonce: bundle.recoveryCutover.startupNonce,
    challenge: randomBytes(16).toString('hex'),
  }
  let response
  try { response = io.challengeWindow(startup.challengeFd, challenge) } catch { bad('window_challenge_unavailable') }
  if (response?.operationId !== challenge.operationId || response?.hostId !== challenge.hostId
      || response?.startupNonce !== challenge.startupNonce || response?.challenge !== challenge.challenge
      || response?.exclusiveWindowHeld !== true || response?.launchSourcesStillInhibited !== true
      || response?.windowClosed !== false) {
    bad('window_challenge_mismatch')
  }
  return true
}

export function verifyCurrentWindow(evidenceDir, bundle, startup, io = defaultEvidenceIO) {
  try { return verifyCurrentWindowState(evidenceDir, bundle, startup, io) }
  catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('window_')) throw error
    bad('window_validation_unavailable')
  }
}

export function proofReject(code) { bad(code) }
