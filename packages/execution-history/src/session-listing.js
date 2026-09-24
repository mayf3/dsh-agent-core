/**
 * @agent-core/execution-history/src/session-listing.js —
 * AGENT_CORE_SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 CTR-SCT-002: the
 * `agent_session_list` (MY_SESSIONS) query core. SELF-ONLY (viewer agentId
 * comes from the trusted gateway context), COORDINATE-ONLY: no message text,
 * tool argument/result body, or model output ever enters the result.
 *
 * Data source (C1/C2 closure): a DIRECT scan of the CALLER'S OWN subtree
 * `homes/<viewerAgentId>/sessions/**` — never the fleet-wide tree. The global
 * coordinate index is deliberately NOT consulted or built here: building it
 * would read other Agents' journals (a caller-triggered fleet-wide scan,
 * against the CTR-SCT-002 caller-home boundary) and its fleet-wide file cap
 * could silently truncate the caller's own listing. Every read is bounded
 * (header ≤ 4 KiB, coordinate scan ≤ maxScanBytes per file). No store is
 * created and production execution paths never import this module
 * (consumption ban, Spec §5).
 */

import { existsSync, fstatSync, lstatSync, openSync, readSync, closeSync, realpathSync, statSync } from 'node:fs'
import os from 'node:os'
import { join, sep } from 'node:path'

import { decodeSegment } from './session-index.js'
import { listAgentSessionFiles, loadSessionJournal, projectJournal } from './loaders/session-journal.js'

const AGENT_ID_RE = /^agt_[A-Za-z0-9_-]+$/
const HEADER_READ_BYTES = 4096
const PAGE_LIMIT = 200
const COORDINATE_LIMIT = 10
const CRON_RUN_PREFIX = 'cron-run-'

const err = (code, detail) => ({ ok: false, code, detail })

/**
 * @param {object} opts
 * @param {string} opts.homesRoot - <root>/homes
 * @param {string} opts.viewerAgentId - trusted caller identity (never model args)
 * @param {number} [opts.maxScanBytes] - per-file bounded scan
 * @param {string} [opts.cursor] - keyset cursor from a previous page
 * @param {number} [opts.limit]
 */
export function listAgentSessions(opts) {
  const viewerAgentId = opts.viewerAgentId
  if (typeof viewerAgentId !== 'string' || !AGENT_ID_RE.test(viewerAgentId)) {
    return err('forbidden_not_owner', 'trusted caller identity unavailable')
  }
  const homesRoot = opts.homesRoot
  if (typeof homesRoot !== 'string' || !existsSync(homesRoot)) {
    return err('history_unavailable', 'session homes root is not readable')
  }
  // F1 (trusted-handler parity): authoritative validation at the core too —
  // invalid pagination input is REJECTED, never clamped or silently dropped.
  // `null` is a present-but-wrong value for limit (an integer is required);
  // for cursor `null` reads as absent (the §3 F1 matrix keeps the two asymmetric).
  if (opts.cursor !== undefined && opts.cursor !== null && typeof opts.cursor !== 'string') {
    return err('invalid_arguments', 'cursor must be a string')
  }
  if (opts.limit !== undefined && (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > 200)) {
    return err('invalid_arguments', 'limit must be an integer in 1..200')
  }

  // Keyset cursor: base64url("<lastActiveAtMs>:<sessionId>") — the sort key.
  let cursorKey = null
  if (typeof opts.cursor === 'string' && opts.cursor !== '') {
    try {
      const decoded = Buffer.from(opts.cursor, 'base64url').toString('utf8')
      const splitAt = decoded.indexOf(':')
      if (splitAt > 0) {
        const atMs = Number(decoded.slice(0, splitAt))
        // C5: a non-finite timestamp (e.g. 'NaN:main') makes every keyset
        // comparison false — the first page would repeat forever. Reject.
        if (!Number.isFinite(atMs)) cursorKey = null
        else cursorKey = { atMs, sessionId: decoded.slice(splitAt + 1) }
      }
    } catch { cursorKey = null }
  }
  if (opts.cursor !== undefined && opts.cursor !== null && cursorKey === null) {
    // Includes '' — an empty cursor is malformed, never silently treated as absent.
    return err('invalid_arguments', 'malformed cursor')
  }

  // C1/C2: enumerate the CALLER'S OWN journals directly (stat + header +
  // bounded coordinate scan per file). Never touches other Agents' trees and
  // never inherits any fleet-wide cap, so the caller's listing is complete.
  const callerSessionsRoot = join(homesRoot, viewerAgentId, 'sessions')
  const callerRoot = existsSync(callerSessionsRoot) ? join(homesRoot, viewerAgentId) : null
  // B-B (authority round-3 review closure): canonical-root binding — resolve
  // EVERY path component (including intermediate directory symlinks) and
  // require the journal's REAL path to remain inside the caller's own
  // sessions root. An ancestor swapped for a symlink to another agent's
  // directory fails this prefix check even though the final file itself is a
  // plain regular file with nlink===1.
  let callerRealRoot = null
  try { callerRealRoot = realpathSync(callerSessionsRoot) } catch { callerRealRoot = null }
  const anomalies = { headersMissing: 0, idMismatch: 0 }
  const rows = []
  if (callerRoot !== null) {
    const maxScanBytes = opts.maxScanBytes ?? 8 * 1024 * 1024
    // S3 (security review closure): two-phase enumeration. Phase 1 is
    // stat-level only (no journal content read): confinement, keyset filter
    // and ordering. Phase 2 pays the content cost (header + structured
    // coordinate scan) ONLY for the rows entering the page — aggregate work
    // per request is proportional to the response, never a full-subtree
    // content sweep.
    const candidates = []
    for (const session of listAgentSessionFiles(homesRoot, viewerAgentId)) {
      // B-B: canonical-root binding over the fully resolved path.
      let realFile = null
      try { realFile = realpathSync(session.file) } catch { continue }
      if (callerRealRoot === null || !(realFile === callerRealRoot || realFile.startsWith(callerRealRoot + sep))) continue
      // A3 (authority round-3): confined-reader gate. A symlink or hardlink
      // planted in the caller subtree must never be followed — it could make
      // this zero-Auth handler read ANOTHER agent's journal and leak its
      // coordinates as the caller's own. lstat must be a plain regular file
      // with exactly one link; the header read re-verifies device+inode.
      const confined = confinedJournalStat(realFile)
      if (confined === null) continue
      const lastActiveAtMs = Number.isFinite(confined.mtimeMs) ? Math.trunc(confined.mtimeMs) : null
      const stableId = decodeSegment(session.sessionId)
      // Keyset filter on the stable stat-level identity (decoded directory id)
      // — the same total order the cursor continues, so pages never overlap.
      if (cursorKey !== null) {
        const at = lastActiveAtMs ?? 0
        const id = String(stableId)
        if (at > cursorKey.atMs || (at === cursorKey.atMs && id <= cursorKey.sessionId)) continue
      }
      candidates.push({ session, realFile, confined, lastActiveAtMs, stableId })
    }
    candidates.sort((a, b) => {
      const atA = a.lastActiveAtMs ?? 0
      const atB = b.lastActiveAtMs ?? 0
      if (atB !== atA) return atB - atA
      const idA = String(a.stableId)
      const idB = String(b.stableId)
      return idA < idB ? -1 : idA > idB ? 1 : 0
    })
    // S3 (security review closure): per-request CONTENT budget (bytes of
    // journal actually read). Once exhausted, remaining page rows are emitted
    // with scanTruncated=true and unproven (false/empty) origin faces — an
    // honest degradation, never a fabricated complete answer; the keyset
    // cursor lets a later call continue from the same position.
    let contentBudgetBytes = 64 * 1024 * 1024
    for (const { session, realFile, confined, lastActiveAtMs, stableId } of candidates.slice(0, opts.limit === undefined || opts.limit === null ? PAGE_LIMIT : opts.limit)) {
      const header = readSessionHeader(realFile, confined)
      // Directory names are the DSH-encoded form of the native session id
      // (canonical encoder: packages/session-history/src/dsh-compat.js
      // encodeSegment — ':' escapes as '~003A' etc.). Decode BEFORE any
      // comparison or coordinate derivation so healthy encodings never count
      // as anomalies and degraded (header-less) dirs still yield the native id.
      const decodedDir = decodeSegment(session.sessionId)
      let sessionId = decodedDir
      if (header === null) {
        anomalies.headersMissing += 1
      } else if (header.id !== undefined && header.id !== decodedDir) {
        // Existing resolution rule: the header id is authoritative; a real
        // (decode-normalized) mismatch stays visible as an anomaly count.
        anomalies.idMismatch += 1
        sessionId = header.id
      }
      // E2 (authority round-3 closure-2): origin/coordinate faces come from
      // STRUCTURED journal parsing (loadSessionJournal + projectJournal —
      // recognized event fields: message provenance source and
      // toolCallCoordinates), never from raw-text regex matches on serialized
      // bytes: message text quoting a coordinate must not corrupt the
      // traceability view. Message text is READ here for classification only
      // and never enters the output rows.
      let projected = null
      let scanTruncated = false
      try {
        if (contentBudgetBytes <= 0) {
          scanTruncated = true
        } else {
          const fileBudget = Math.min(maxScanBytes, contentBudgetBytes)
          const raw = loadSessionJournal({ file: realFile, maxFileBytes: fileBudget, maxRecords: 10000 })
          contentBudgetBytes -= Math.min(raw.size ?? fileBudget, fileBudget)
          scanTruncated = raw.truncated === true
          if (raw.readFailed === undefined) projected = projectJournal(raw.events, { briefMaxChars: 0 })
        }
      } catch { scanTruncated = true }
      const occurrenceIds = new Set()
      const workflowInstanceIds = new Set()
      const origins = { user: false, inter_agent: false, workflow_execution: false }
      if (projected !== null) {
        for (const msg of projected.messages ?? []) {
          const kind = msg?.source?.kind
          if (kind === 'user') origins.user = true
          else if (kind === 'inter_agent') origins.inter_agent = true
          else if (kind === 'workflow_execution') {
            origins.workflow_execution = true
            if (typeof msg.source.workflowInstanceId === 'string') workflowInstanceIds.add(msg.source.workflowInstanceId)
          }
        }
        for (const call of projected.toolCalls ?? []) {
          if (typeof call?.coordinates?.occurrenceId === 'string') occurrenceIds.add(call.coordinates.occurrenceId)
          if (typeof call?.coordinates?.workflowInstanceId === 'string') workflowInstanceIds.add(call.coordinates.workflowInstanceId)
        }
        for (const coord of projected.workflowCoordinates ?? []) {
          if (typeof coord?.workflowInstanceId === 'string') workflowInstanceIds.add(coord.workflowInstanceId)
        }
      }
      if (typeof sessionId === 'string' && sessionId.startsWith(CRON_RUN_PREFIX)) {
        occurrenceIds.add(sessionId.slice(CRON_RUN_PREFIX.length))
      }
      const occCoordList = [...occurrenceIds].sort()
      const wfCoordList = [...workflowInstanceIds].sort()
      rows.push({
        sessionId,
        kind: kindOf(sessionId),
        createdAtUtc: header !== null && Number.isFinite(header.createdAt) ? new Date(header.createdAt).toISOString() : null,
        lastActiveAtUtc: lastActiveAtMs !== null ? new Date(lastActiveAtMs).toISOString() : null,
        origins: {
          user: origins.user,
          inter_agent: origins.inter_agent,
          workflow_execution: origins.workflow_execution,
        },
        schedulerOccurrenceIds: occCoordList.slice(0, COORDINATE_LIMIT),
        schedulerOccurrenceIdsTruncated: occCoordList.length > COORDINATE_LIMIT,
        workflowInstanceIds: wfCoordList.slice(0, COORDINATE_LIMIT),
        workflowInstanceIdsTruncated: wfCoordList.length > COORDINATE_LIMIT,
        scanTruncated,
      })
      rows[rows.length - 1]._cursorKey = `${lastActiveAtMs ?? 0}:${stableId}`
    }
  }
  const limit = opts.limit === undefined || opts.limit === null ? PAGE_LIMIT : opts.limit
  const page = rows.slice(0, limit)
  const truncated = rows.length > page.length
  let nextCursor = null
  if (truncated && page.length > 0) {
    // The cursor carries the STAT-level sort key (A4: both components) so
    // pages compose even when a header-resolved id differs from the dir id.
    nextCursor = Buffer.from(page[page.length - 1]._cursorKey, 'utf8').toString('base64url')
  }
  for (const row of page) delete row._cursorKey
  return {
    ok: true,
    result: {
      agentId: viewerAgentId,
      sessions: page,
      truncated,
      nextCursor,
      anomalies,
    },
  }
}

function kindOf(sessionId) {
  if (sessionId === 'main') return 'main'
  if (typeof sessionId === 'string' && sessionId.startsWith(CRON_RUN_PREFIX)) return 'scheduler'
  return 'other'
}

/**
 * Decode one DSH session directory segment back to the native session id:
 * moved to session-index.js (decodeSegment) so the index lookups and the
 * listing share one implementation; re-exported for the parity tests.
 */
export { decodeSegment } from './session-index.js'

/**
 * A3 confined-reader gate: lstat (never follow) must be a plain regular file
 * with exactly one link; returns the lstat for the open/fstat re-check.
 */
function confinedJournalStat(file) {
  try {
    const lst = lstatSync(file)
    if (!lst.isFile() || lst.isSymbolicLink() || lst.nlink > 1) return null
    return lst
  } catch { return null }
}

/**
 * Best-effort header read: first JSON line of the journal. The open/fstat
 * device+inode check closes the check/open TOCTOU window against the A3
 * lstat pre-check; any drift fails closed.
 */
function readSessionHeader(file, confined) {
  let fd
  try {
    if (confined === undefined) confined = confinedJournalStat(file)
    if (confined === null) return null
    // E1: O_NOFOLLOW binds the final component at the kernel level — even if
    // the checked path is swapped for a symlink in the realpath/open window,
    // the open fails instead of following.
    fd = openSync(file, os.constants.O_RDONLY | os.constants.O_NOFOLLOW)
    const opened = fstatSync(fd)
    if (opened.dev !== confined.dev || opened.ino !== confined.ino || !opened.isFile()) return null
    const buffer = Buffer.allocUnsafe(HEADER_READ_BYTES)
    const n = readSync(fd, buffer, 0, buffer.length, 0)
    if (n <= 0) return null
    const firstLine = buffer.subarray(0, n).toString('utf8').split('\n')[0]
    const parsed = JSON.parse(firstLine)
    if (parsed === null || typeof parsed !== 'object' || parsed.type !== 'session') return null
    return { id: typeof parsed.id === 'string' ? parsed.id : undefined, createdAt: parsed.createdAt }
  } catch {
    return null
  } finally {
    if (fd !== undefined) { try { closeSync(fd) } catch { /* best effort */ } }
  }
}
