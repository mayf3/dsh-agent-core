/**
 * @agent-core/execution-history/src/session-index.js — the rebuildable
 * read-view index (Spec §8): `<controlDir>/execution-history-index/sessions.idx.jsonl`,
 * one JSON line per journal with COORDINATE KEYS ONLY (no message text — no
 * new privacy surface). Deletable at any time; lazily rebuilt on size/mtime
 * mismatch; production execution paths never import this module (Spec §4.5).
 */

import { join } from 'node:path'
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from 'node:fs'

import { listAgentSessionFiles } from './loaders/session-journal.js'

export const INDEX_VERSION = 2

const RE_MESSAGE_ID = /\\?"messageId\\?":\\?"([^"\\]{1,128})\\?"/g
const RE_WF_INSTANCE = /\\?"workflowInstanceId\\?":\\?"([0-9a-fA-F-]{36})\\?"/g
const RE_DISPATCH_INTENT = /\\?"dispatchIntentId\\?":\\?"([0-9a-fA-F-]{36})\\?"/g
// CTR-SCT-002 (SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1): scheduler
// occurrence coordinates mentioned in tool call arguments/result payloads.
const RE_OCCURRENCE_ID = /\\?"occurrenceId\\?":\\?"(occ:[^"\\]{1,80})\\?"/g
// ASM V2 provenance: inserted[]/user-message sidecars carry correlation =
// the SOURCE turnExecutionId ('turn:...') — the target-side anchor of every
// inter_agent dispatch (R1/R6 reverse coordinate).
const RE_CORRELATION = /\\?"correlation\\?":\\?"(turn:[^"\\]{1,160})\\?"/g
const RE_INTER_AGENT = /"kind":"inter_agent"/
const RE_WF_SIDECAR = /"kind":"workflow_execution"/
// CTR-SCT-002: presence boolean for plain user-origin messages
// (source.kind === 'user') — the origins.user listing face.
const RE_USER_SOURCE = /"kind":"user"/

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

/** Extract coordinate keys from one journal's raw text (bounded scan). */
export function extractJournalCoordinates(file, { maxScanBytes = 8 * 1024 * 1024 } = {}) {
  const st = statSync(file)
  const size = Number(st.size)
  const scan = Math.min(size, maxScanBytes)
  let text = ''
  if (scan > 0) {
    const fd = openSync(file, 'r')
    try {
      const buffer = Buffer.allocUnsafe(scan)
      let off = 0
      while (off < buffer.length) {
        const n = readSync(fd, buffer, off, buffer.length - off, off)
        if (n === 0) break
        off += n
      }
      text = buffer.subarray(0, off).toString('utf8')
    } finally { closeSync(fd) }
  }
  const messageIds = []
  for (const m of text.matchAll(RE_MESSAGE_ID)) messageIds.push(m[1])
  const workflowInstanceIds = []
  for (const m of text.matchAll(RE_WF_INSTANCE)) workflowInstanceIds.push(m[1].toLowerCase())
  const dispatchIntentIds = []
  for (const m of text.matchAll(RE_DISPATCH_INTENT)) dispatchIntentIds.push(m[1].toLowerCase())
  const interAgentCorrelations = []
  for (const m of text.matchAll(RE_CORRELATION)) interAgentCorrelations.push(m[1])
  const occurrenceIds = []
  for (const m of text.matchAll(RE_OCCURRENCE_ID)) occurrenceIds.push(m[1])
  return {
    size,
    mtimeMs: Number(st.mtimeMs),
    scannedBytes: scan,
    partialScan: scan < size,
    coordinates: {
      messageIds: uniqueSorted(messageIds).slice(0, 2000),
      workflowInstanceIds: uniqueSorted(workflowInstanceIds).slice(0, 200),
      dispatchIntentIds: uniqueSorted(dispatchIntentIds).slice(0, 200),
      interAgentCorrelations: uniqueSorted(interAgentCorrelations).slice(0, 500),
      occurrenceIds: uniqueSorted(occurrenceIds).slice(0, 200),
      hasUserSource: RE_USER_SOURCE.test(text),
      hasInterAgent: RE_INTER_AGENT.test(text),
      hasWorkflowExecutionSidecar: RE_WF_SIDECAR.test(text),
    },
  }
}

// Small lazy fs seam keeps the module importable from pure tests that stub paths.
let fsCache = null
function lazyFs() {
  if (fsCache === null) fsCache = { openSync: require('node:fs').openSync, readSync: require('node:fs').readSync, closeSync: require('node:fs').closeSync }
  return fsCache
}
function require_fd(_file) { return true }

/**
 * Build (or rebuild) the whole index. One JSON line per session file.
 * Returns {entries, coverage:{files, partialScanCount, truncatedFileCount}}.
 */
export function buildSessionIndex({ homesRoot, indexDir, maxFiles = 4000, maxScanBytes }) {
  const entries = []
  let partialScanCount = 0
  let unreadableCount = 0
  const agents = safeReaddir(homesRoot)
  for (const agentId of agents) {
    for (const session of listAgentSessionFiles(homesRoot, agentId)) {
      if (entries.length >= maxFiles) break
      let extracted
      try { extracted = extractJournalCoordinates(session.file, { maxScanBytes }) } catch { unreadableCount += 1; continue }
      if (extracted.partialScan) partialScanCount += 1
      entries.push({
        v: INDEX_VERSION,
        agentId: session.agentId,
        projectKey: session.projectKey,
        sessionId: session.sessionId,
        file: session.file,
        size: extracted.size,
        mtimeMs: extracted.mtimeMs,
        partialScan: extracted.partialScan,
        coordinates: extracted.coordinates,
      })
    }
  }
  try {
    mkdirSync(indexDir, { recursive: true })
    const tmp = join(indexDir, `.sessions.idx.jsonl.tmp-${process.pid}`)
    writeFileSync(tmp, entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length > 0 ? '\n' : ''))
    renameSync(tmp, join(indexDir, 'sessions.idx.jsonl'))
  } catch { /* index write is best-effort; queries fall back to direct scans */ }
  return { entries, coverage: { files: entries.length, partialScanCount, unreadableCount } }
}

/** Load the index; null when absent/corrupt (caller rebuilds). */
export function loadSessionIndex(indexDir) {
  const file = join(indexDir, 'sessions.idx.jsonl')
  if (!existsSync(file)) return null
  try {
    const parsed = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l))
    if (!Array.isArray(parsed) || parsed.some((e) => e?.v !== INDEX_VERSION)) return null
    return parsed
  } catch { return null }
}

/**
 * Bounded journal-tree inventory: directory walk + stat ONLY (no journal
 * content is read). Used by `ensureFreshSessionIndex` to discover journals
 * CREATED AFTER the index was built — a per-file drift check alone can never
 * see them (B2 closure; the inventory is derived state, not a registry).
 */
function journalInventory(homesRoot, { maxFiles = 20000 } = {}) {
  const files = new Set()
  let truncated = false
  for (const agentId of safeReaddir(homesRoot)) {
    for (const session of listAgentSessionFiles(homesRoot, agentId)) {
      if (files.size >= maxFiles) { truncated = true; break }
      files.add(session.file)
    }
    if (truncated) break
  }
  return { files, truncated }
}

/**
 * Fresh index: load, verify against the live tree, rebuild on any drift —
 * including journals that appeared after the index was written (B2).
 * @returns {{ entries: object[], coverage: object, rebuilt: boolean }}
 */
export function ensureFreshSessionIndex({ homesRoot, indexDir, maxScanBytes }) {
  const loaded = loadSessionIndex(indexDir)
  if (loaded !== null) {
    let fresh = true
    for (const entry of loaded) {
      if (!existsSync(entry.file)) { fresh = false; break }
      let st
      try { st = statSync(entry.file) } catch { fresh = false; break }
      if (Number(st.size) !== entry.size || Number(st.mtimeMs) !== entry.mtimeMs) { fresh = false; break }
    }
    if (fresh) {
      // Drift is not the only staleness: compare against the live journal
      // inventory so NEWLY CREATED journals are discovered too.
      const inventory = journalInventory(homesRoot)
      for (const entry of loaded) inventory.files.delete(entry.file)
      if (inventory.files.size > 0 || inventory.truncated) return { ...buildSessionIndex({ homesRoot, indexDir, maxScanBytes }), rebuilt: true }
      return { entries: loaded, coverage: { files: loaded.length, partialScanCount: loaded.filter((e) => e.partialScan).length }, rebuilt: false }
    }
  }
  const built = buildSessionIndex({ homesRoot, indexDir, maxScanBytes })
  return { ...built, rebuilt: true }
}

export function indexLookups(entries) {
  return {
    byWorkflowInstanceId: (id) => entries.filter((e) => e.coordinates.workflowInstanceIds.includes(String(id).toLowerCase())),
    byDispatchIntentId: (id) => entries.filter((e) => e.coordinates.dispatchIntentIds.includes(String(id).toLowerCase())),
    byMessageId: (id) => entries.filter((e) => e.coordinates.messageIds.includes(id)),
    byCorrelation: (correlation) => entries.filter((e) => e.coordinates.interAgentCorrelations?.includes(correlation)),
    bySessionId: (sessionId) => entries.filter((e) => e.sessionId === sessionId),
    // B1 (SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 closure): EXACT canonical
    // identity only — the decoded native sessionId must equal the canonical
    // scheduler session id `cron-run-<occurrenceId>` for the EXACT occurrence.
    // The former suffix/final-segment fallback let an unrelated or foreign
    // journal (e.g. `unrelated-<occBody>`) be promoted to a session join;
    // fuzzy fallbacks never upgrade to exact (SC-2).
    byCronOccurrence: (occurrenceId) => {
      const expected = `cron-run-${occurrenceId}`
      return entries.filter((e) => decodeSegment(e.sessionId) === expected)
    },
    all: () => entries,
  }
}

/**
 * Decode one DSH session directory segment back to the native session id
 * (escape form '~XXXX' = one char with charCode 0xXXXX; canonical encoder is
 * `encodeSegment` in packages/session-history/src/dsh-compat.js, a verbatim
 * transcription of @deepseek-ai/dsh-session-persistence-jsonl format.ts).
 */
export function decodeSegment(segment) {
  if (typeof segment !== 'string') return segment
  return segment.replace(/~([0-9A-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function safeReaddir(dir) {
  try { return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) } catch { return [] }
}
