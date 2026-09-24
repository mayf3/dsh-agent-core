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

import { existsSync, openSync, readSync, closeSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { decodeSegment, extractJournalCoordinates } from './session-index.js'
import { listAgentSessionFiles } from './loaders/session-journal.js'

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
  const callerRoot = existsSync(join(homesRoot, viewerAgentId, 'sessions'))
    ? join(homesRoot, viewerAgentId)
    : null
  const anomalies = { headersMissing: 0, idMismatch: 0 }
  const rows = []
  if (callerRoot !== null) {
    const maxScanBytes = opts.maxScanBytes ?? 8 * 1024 * 1024
    for (const session of listAgentSessionFiles(homesRoot, viewerAgentId)) {
      const lastActiveAtMs = Number.isFinite(session.mtimeMs) ? Math.trunc(session.mtimeMs) : null
      const header = readSessionHeader(session.file)
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
      // Keyset filter on the RESOLVED identity (the same value the cursor was
      // built from), so pages never overlap regardless of directory encoding.
      // Sort order is (lastActiveAtMs DESC, sessionId ASC): the next page holds
      // entries strictly AFTER the cursor — smaller atMs, or the same atMs with
      // a greater sessionId.
      if (cursorKey !== null) {
        const at = lastActiveAtMs ?? 0
        const id = String(sessionId)
        if (at > cursorKey.atMs || (at === cursorKey.atMs && id <= cursorKey.sessionId)) continue
      }
      let coordinates = {}
      try {
        coordinates = extractJournalCoordinates(session.file, { maxScanBytes }).coordinates
      } catch { /* best-effort origins; listing never fails on one file */ }
      const occurrenceIds = new Set(coordinates.occurrenceIds ?? [])
      if (typeof sessionId === 'string' && sessionId.startsWith(CRON_RUN_PREFIX)) {
        occurrenceIds.add(sessionId.slice(CRON_RUN_PREFIX.length))
      }
      const occCoordList = [...occurrenceIds].sort()
      const wfCoordList = [...(coordinates.workflowInstanceIds ?? [])].sort()
      rows.push({
        sessionId,
        kind: kindOf(sessionId),
        createdAtUtc: header !== null && Number.isFinite(header.createdAt) ? new Date(header.createdAt).toISOString() : null,
        lastActiveAtUtc: lastActiveAtMs !== null ? new Date(lastActiveAtMs).toISOString() : null,
        origins: {
          user: coordinates.hasUserSource === true,
          inter_agent: coordinates.hasInterAgent === true,
          workflow_execution: coordinates.hasWorkflowExecutionSidecar === true,
        },
        schedulerOccurrenceIds: occCoordList.slice(0, COORDINATE_LIMIT),
        schedulerOccurrenceIdsTruncated: occCoordList.length > COORDINATE_LIMIT,
        workflowInstanceIds: wfCoordList.slice(0, COORDINATE_LIMIT),
        workflowInstanceIdsTruncated: wfCoordList.length > COORDINATE_LIMIT,
      })
    }
  }
  rows.sort((a, b) => {
    const atA = Date.parse(a.lastActiveAtUtc ?? '0') || 0
    const atB = Date.parse(b.lastActiveAtUtc ?? '0') || 0
    if (atB !== atA) return atB - atA
    return a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0
  })
  const limit = opts.limit === undefined || opts.limit === null ? PAGE_LIMIT : opts.limit
  const page = rows.slice(0, limit)
  const truncated = rows.length > page.length
  let nextCursor = null
  if (truncated && page.length > 0) {
    const last = page[page.length - 1]
    nextCursor = Buffer.from(`${Date.parse(last.lastActiveAtUtc ?? '0') || 0}:${last.sessionId}`, 'utf8').toString('base64url')
  }
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

/** Best-effort header read: first JSON line of the journal. */
function readSessionHeader(file) {
  let fd
  try {
    statSync(file)
    fd = openSync(file, 'r')
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
