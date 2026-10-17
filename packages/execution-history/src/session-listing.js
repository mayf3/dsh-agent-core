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
  // Existence alone is not readability: a regular FILE at the configured
  // path (or a traversal that cannot be stat-ed) must surface the frozen
  // `history_unavailable` error, never a fabricated "no sessions" answer.
  let homesStat = null
  try { homesStat = typeof homesRoot === 'string' ? statSync(homesRoot) : null } catch { homesStat = null }
  if (homesStat === null || !homesStat.isDirectory()) {
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
  try {
    const realHomes = realpathSync(homesRoot)
    const realSessions = realpathSync(callerSessionsRoot)
    // Root-substitution closure (fresh exact-head review): the sessions dir
    // must resolve to the CALLER-OWNED expected path — never a symlink
    // planted at the <agentId> or `sessions` level pointing into another
    // Agent's tree. A symlinked root would make the victim tree the prefix
    // anchor and pass every journal's containment check, leaking foreign
    // coordinates on this zero-Auth self surface. Substitution = honest
    // absence (empty listing), never the substituted tree.
    if (realSessions === join(realHomes, viewerAgentId, 'sessions')) callerRealRoot = realSessions
  } catch { callerRealRoot = null }
  const anomalies = { headersMissing: 0, idMismatch: 0 }
  const rows = []
  let candidateCount = 0
  let unprocessedCandidates = 0
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
      // A3: lstat the ENUMERATED path before any resolution — resolving a
      // symlinked session.jsonl first would erase the symlink fact and let
      // the in-tree target pass confinement as a duplicate native session.
      // Only a plain regular file proceeds (symlink/other → skipped).
      try { if (!lstatSync(session.file).isFile()) continue } catch { continue }
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
    candidateCount = candidates.length
    // S3 (security review closure): per-request CONTENT budget (bytes of
    // journal actually read). Once exhausted, remaining page rows are emitted
    // with scanTruncated=true and unproven (false/empty) origin faces — an
    // honest degradation, never a fabricated complete answer; the keyset
    // cursor lets a later call continue from the same position.
    const limit = opts.limit === undefined || opts.limit === null ? PAGE_LIMIT : opts.limit
    let contentBudgetBytes = 64 * 1024 * 1024
    // Tip-head review P2 closure: the page FILLS to `limit` from the ordered
    // candidates — a candidate that fails its hardened open/drift re-check is
    // skipped WITHOUT consuming a page slot, so one unreadable newest journal
    // can no longer strand every older readable session behind an empty page
    // with a dead cursor. Iteration stays bounded by the caller's own
    // candidate count; the per-request content budget is unchanged (budget
    // exhaustion degrades rows honestly, it never skips them).
    let processedCandidates = 0
    for (; processedCandidates < candidates.length && rows.length < limit; processedCandidates++) {
      const { session, realFile, confined, lastActiveAtMs, stableId } = candidates[processedCandidates]
      // Internal exact-head re-audit closure: ONE hardened open per row
      // (O_NOFOLLOW + fstat dev/ino/size match against the phase-1 lstat)
      // pins the fd serving BOTH the header and the content scan. The plain
      // path re-open left the coordinate scan outside the confined reader (a
      // final-component swap between the phase-1 check and the content open
      // would feed foreign coordinates into the row, and a confinement-failed
      // header open did not stop the scan). Frozen contract: 任何不满足 →
      // 跳过该 journal（不输出其任何坐标）.
      const opened = openConfinedJournal(realFile, confined)
      if (opened === null) continue
      // Directory names are the DSH-encoded form of the native session id
      // (canonical encoder: packages/session-history/src/dsh-compat.js
      // encodeSegment — ':' escapes as '~003A' etc.). Decode BEFORE any
      // comparison or coordinate derivation so healthy encodings never count
      // as anomalies and degraded (header-less) dirs still yield the native id.
      const decodedDir = decodeSegment(session.sessionId)
      let sessionId = decodedDir
      const header = readHeaderFromFd(opened.fd)
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
          // Content scan reads from the SAME confined fd — no path re-open
          // (the fd variant never closes it; the caller owns the descriptor).
          const raw = loadSessionJournal({ fd: opened.fd, maxFileBytes: fileBudget, maxRecords: 10000 })
          contentBudgetBytes -= Math.min(raw.size ?? fileBudget, fileBudget)
          // G2: skipped (malformed / over-record-cap) rows are coverage loss —
          // the EH governing rule requires visibly degraded coverage, never a
          // silently complete answer.
          scanTruncated = raw.truncated === true || (raw.skipped ?? 0) > 0
          if (raw.readFailed === undefined) projected = projectJournal(raw.events, { briefMaxChars: 0 })
        }
      } catch { scanTruncated = true }
      // Post-scan re-verify (frozen contract: 坐标扫描结束后复核文件未发生变化):
      // the fd pins dev/ino; GROWTH is a live append beyond the scanned prefix
      // (F-B live-pagination semantics — the parsed prefix stays the file's
      // true prefix), a SHRINK means the journal changed under the scan —
      // drift skips the row entirely, never emitting coordinates from an
      // unverifiable read.
      let post = null
      try { post = fstatSync(opened.fd) } catch { post = null }
      try { closeSync(opened.fd) } catch { /* best effort */ }
      if (post === null || post.dev !== opened.st.dev || post.ino !== opened.st.ino || post.size < opened.st.size) continue
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
    unprocessedCandidates = candidates.length - processedCandidates
  }
  // Keyset honesty derives from the UN-capped stat-level population: rows is
  // already the page (content cost bounded by the response, S3), so comparing
  // rows against its own slice could never observe truncation and the listing
  // would claim false completeness for callers holding more sessions than the
  // limit (internal exact-head re-audit blocker closure). truncated stays
  // TRUE for every candidate that did not become a row — unreadable/skipped
  // journals are visible coverage loss (G2 governing rule), never silence.
  const page = rows
  const truncated = candidateCount > rows.length
  // The cursor advances only when ordered candidates remain UNPROCESSED
  // beyond the filled page — a page that exhausted its candidates ends with
  // nextCursor=null even when truncated, so a caller never loops on a cursor
  // that can no longer yield rows (deterministic/exhaustive keyset).
  let nextCursor = null
  if (unprocessedCandidates > 0 && page.length > 0) {
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
 * Confined single-open (internal exact-head re-audit closure): open with
 * O_NOFOLLOW (final component kernel-bound — a swap in the realpath/open
 * window fails instead of following) and verify the opened fd against the
 * A3 phase-1 lstat: plain regular file, same device, same inode, same size
 * (frozen contract: 打开后 fstat 的 device/inode/size 必须与预检一致).
 * Returns { fd, st } for the row's header + content reads, or null when any
 * confinement requirement fails (caller skips the journal entirely).
 */
function openConfinedJournal(file, confined) {
  let fd
  try {
    fd = openSync(file, os.constants.O_RDONLY | os.constants.O_NOFOLLOW)
    const st = fstatSync(fd)
    if (!st.isFile() || st.dev !== confined.dev || st.ino !== confined.ino || st.size !== confined.size) {
      try { closeSync(fd) } catch { /* best effort */ }
      return null
    }
    return { fd, st }
  } catch {
    if (fd !== undefined) { try { closeSync(fd) } catch { /* best effort */ } }
    return null
  }
}

/**
 * Best-effort header read from an already-confined fd: first JSON line of
 * the journal. A null here is a BENIGN content anomaly (empty/garbage
 * header) — confinement failures never reach this function.
 */
function readHeaderFromFd(fd) {
  try {
    const buffer = Buffer.allocUnsafe(HEADER_READ_BYTES)
    const n = readSync(fd, buffer, 0, buffer.length, 0)
    if (n <= 0) return null
    const firstLine = buffer.subarray(0, n).toString('utf8').split('\n')[0]
    const parsed = JSON.parse(firstLine)
    if (parsed === null || typeof parsed !== 'object' || parsed.type !== 'session') return null
    return { id: typeof parsed.id === 'string' ? parsed.id : undefined, createdAt: parsed.createdAt }
  } catch {
    return null
  }
}
