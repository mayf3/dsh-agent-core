/**
 * Canonical Session-root confinement and bounded stable-snapshot artifact read
 * (MOBILE_SESSION_HISTORY_V1 CTR-SH-003 / CTR-SH-007 / CTR-SH-013).
 *
 * Deterministic current-main resolver: the ONLY candidate path is
 * `<canonical session root>/<projectKey(workspaceDir)>/main/session.jsonl`
 * (pinned DSH locator encoding, no user input); absence is SESSION_NOT_FOUND,
 * any confinement/corruption failure is fail-closed INTERNAL_ERROR with zero
 * content bytes read, and there is no heuristic, fallback or cross-request
 * cache.
 */

import { lstatSync, realpathSync, openSync, readSync, closeSync, fstatSync, constants as fsConstants } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import {
  HistoryError,
  internalError,
  resourceLimit,
  sessionNotFound,
} from './errors.js'
import { MAX_ARTIFACT_BYTES } from './constants.js'
import { projectKey } from './dsh-compat.js'

const FILE_TYPE_REGULAR = fsConstants.S_IFREG
const FILE_TYPE_DIRECTORY = fsConstants.S_IFDIR
const FILE_TYPE_SYMLINK = fsConstants.S_IFLNK

const fileType = (st) => Number(st.mode) & fsConstants.S_IFMT

const lstatBig = (path) => lstatSync(path, { bigint: true })

/** Internal signal: the artifact changed under the snapshot — retry once. */
class SnapshotUnstableError extends Error {}

/**
 * Resolve the canonical locator paths for one Agent's current main trajectory:
 * the canonical Agent Home (realpath'd), the canonical configured Session root
 * (strict subtree of the home), and the unique canonical candidate artifact
 * path. An absent home means the canonical artifact is absent
 * (SESSION_NOT_FOUND, CTR-SH-007 step 7); a configured Session root that is
 * not a strict subtree of the home is a fail-closed INTERNAL_ERROR.
 */
export function resolveCanonicalTarget({ agentHome, workspaceDir, sessionRootFor }) {
  let homeCanonical
  try {
    homeCanonical = realpathSync(agentHome)
  } catch {
    throw sessionNotFound()
  }
  const sessionRoot = sessionRootFor
    ? sessionRootFor(homeCanonical)
    : join(homeCanonical, 'sessions')
  const rootRel = relative(homeCanonical, sessionRoot)
  if (rootRel === '' || rootRel.startsWith('..') || isAbsolute(rootRel)) {
    throw internalError()
  }
  const projectDir = join(sessionRoot, projectKey(workspaceDir))
  const artifactPath = join(projectDir, 'main', 'session.jsonl')
  return { homeCanonical, sessionRoot, projectDir, artifactPath }
}

function statComponent(path, { absent }) {
  try {
    return lstatBig(path)
  } catch (error) {
    if (error.code === 'ENOENT' && absent === 'not_found') throw sessionNotFound()
    throw new SnapshotUnstableError()
  }
}

const sameRevision = (a, b) =>
  a.dev === b.dev && a.ino === b.ino && a.size === b.size
  && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs

/**
 * CTR-SH-007 component confinement: lstat EVERY path component from the
 * canonical Session root down to the final artifact. Any symlink/alias at any
 * component (including intermediate symlinks pointing inside or outside the
 * home) and any non-directory intermediate fails closed BEFORE the pre-open
 * stat; the final component must be a regular file. Absent components are
 * SESSION_NOT_FOUND (absent artifact, CTR-SH-013 rule 3).
 */
function walkConfinementComponents(sessionRoot, artifactPath) {
  const components = relative(sessionRoot, artifactPath).split(sep)
  let prefix = sessionRoot
  for (let i = 0; i < components.length; i++) {
    prefix = join(prefix, components[i])
    const isFinal = i === components.length - 1
    const st = statComponent(prefix, { absent: 'not_found' })
    const type = fileType(st)
    if (type === FILE_TYPE_SYMLINK) throw internalError()
    if (isFinal) {
      if (type !== FILE_TYPE_REGULAR) throw internalError()
    } else if (type !== FILE_TYPE_DIRECTORY) {
      throw internalError()
    }
  }
}

/**
 * One bounded snapshot attempt (CTR-SH-003): pre-open canonical stat P, open
 * the exact artifact read-only with no symlink following, descriptor stat D0 —
 * identity closure of the check/open window, hardlink exclusion (`st_nlink =
 * 1`) and same-device-as-Session-root confinement, all BEFORE the first
 * content byte — then read exactly D0.size and re-stat descriptor D1 and
 * canonical path P1. Success requires P = D0 = D1 = P1 across all five
 * revision fields, a full-length read, and a re-verified confinement chain.
 * Absent artifact is SESSION_NOT_FOUND (not instability); every other
 * deviation is a retry signal.
 */
function attemptStableRead(artifactPath, sessionRoot) {
  const rootStat = statComponent(sessionRoot, { absent: 'not_found' })
  if (fileType(rootStat) !== FILE_TYPE_DIRECTORY) throw internalError()
  walkConfinementComponents(sessionRoot, artifactPath)

  const preStat = statComponent(artifactPath, { absent: 'not_found' })
  if (fileType(preStat) === FILE_TYPE_SYMLINK || fileType(preStat) !== FILE_TYPE_REGULAR) {
    throw internalError()
  }
  // Artifact-size ceiling BEFORE opening any content (CTR-SH-011).
  if (preStat.size > BigInt(MAX_ARTIFACT_BYTES)) throw resourceLimit()

  const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
  let fd
  try {
    fd = openSync(artifactPath, flags)
  } catch (error) {
    if (error.code === 'ENOENT') throw sessionNotFound()
    throw internalError()
  }
  try {
    const d0 = fstatSync(fd, { bigint: true })
    if (d0.dev !== preStat.dev || d0.ino !== preStat.ino) throw internalError()
    if (d0.nlink !== 1n) throw internalError()
    if (d0.dev !== rootStat.dev) throw internalError()

    const size = Number(d0.size)
    if (size > MAX_ARTIFACT_BYTES) throw resourceLimit()
    const bytes = Buffer.allocUnsafe(size)
    let read = 0
    while (read < size) {
      const n = readSync(fd, bytes, read, size - read, read)
      if (n <= 0) throw new SnapshotUnstableError()
      read += n
    }

    const d1 = fstatSync(fd, { bigint: true })
    const p1 = statComponent(artifactPath, { absent: 'unstable' })
    if (!sameRevision(preStat, d0) || !sameRevision(d0, d1) || !sameRevision(p1, d1)) {
      throw new SnapshotUnstableError()
    }
    if (fileType(p1) === FILE_TYPE_SYMLINK || fileType(p1) !== FILE_TYPE_REGULAR) {
      throw new SnapshotUnstableError()
    }
    // Re-verify the whole confinement chain after the read: an intermediate
    // component swapped to a symlink mid-snapshot is an instability signal.
    try {
      walkConfinementComponents(sessionRoot, artifactPath)
    } catch (error) {
      if (HistoryErrorIsInstance(error)) throw error
      throw new SnapshotUnstableError()
    }
    return bytes
  } finally {
    closeSync(fd)
  }
}

const HistoryErrorIsInstance = (error) => error instanceof HistoryError

/**
 * Read the artifact as a stable complete-prefix snapshot: at most two bounded
 * attempts; an append/replacement/truncation/short-read/identity change
 * retries once; a stable second attempt succeeds; persistent instability is
 * INTERNAL_ERROR (CTR-SH-003).
 */
export function readStableArtifact(artifactPath, sessionRoot) {
  try {
    return attemptStableRead(artifactPath, sessionRoot)
  } catch (error) {
    if (error instanceof SnapshotUnstableError) {
      try {
        return attemptStableRead(artifactPath, sessionRoot)
      } catch (retryError) {
        if (retryError instanceof SnapshotUnstableError) throw internalError()
        throw retryError
      }
    }
    throw error
  }
}

export { HistoryError }
