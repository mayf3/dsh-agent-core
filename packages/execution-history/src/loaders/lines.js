/**
 * @agent-core/execution-history/src/loaders/lines.js — shared bounded JSONL
 * reading for the read-only history loaders (AGENT_CORE_EXECUTION_HISTORY_QUERY_V1 §2).
 *
 * Every loader is FAIL-SOFT PER SOURCE: a malformed line is skipped and
 * counted (SOURCE_DEGRADED), a missing file is SOURCE_ABSENT — neither ever
 * fails a query. Caps make worst-case reads bounded; exceeding a cap marks
 * the source TRUNCATED (visible in the result, never silently dropped).
 */

import { closeSync, existsSync, fstatSync, openSync, readSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const DEFAULT_MAX_FILE_BYTES = 64 * 1024 * 1024
export const DEFAULT_MAX_RECORDS = 50_000

/**
 * Read one JSONL file into parsed lines with byte-offset provenance.
 * @returns {{
 *   absent: boolean,
 *   lines: Array<{ text: string, startByte: number, sha256: string }>,
 *   parsed: Array<object|null>,
 *   badLines: number,
 *   truncated: boolean,
 *   size: number, mtimeMs: number,
 * }}
 */
export function readJsonlFile(filePath, {
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  maxRecords = DEFAULT_MAX_RECORDS,
  fromByte = 0,
} = {}) {
  if (!existsSync(filePath)) {
    return { absent: true, lines: [], parsed: [], badLines: 0, truncated: false, size: 0, mtimeMs: 0 }
  }
  const st = statSync(filePath)
  if (!st.isFile()) throw new Error(`not a regular file: ${filePath}`)
  const size = Number(st.size)
  const scanEnd = Math.min(size, fromByte + maxFileBytes)
  const truncated = scanEnd < size
  const fd = openSync(filePath, 'r')
  let text = ''
  try {
    const buffer = Buffer.allocUnsafe(scanEnd - fromByte)
    let off = 0
    while (off < buffer.length) {
      const n = readSync(fd, buffer, off, buffer.length - off, fromByte + off)
      if (n === 0) break
      off += n
    }
    text = buffer.subarray(0, off).toString('utf8')
  } finally {
    closeSync(fd)
  }
  const lines = []
  const parsed = []
  let badLines = 0
  let cursor = fromByte
  let recordCount = 0
  let sawTruncation = truncated
  const rawLines = text.split('\n')
  // The final element after split is '' for a complete file, or a partial
  // line when truncated mid-line — a partial tail is never emitted.
  const complete = text.endsWith('\n') ? rawLines.length - 1 : rawLines.length - 1
  for (let i = 0; i < complete; i += 1) {
    const line = rawLines[i]
    const startByte = cursor
    cursor += Buffer.byteLength(line, 'utf8') + 1
    if (recordCount >= maxRecords) { sawTruncation = true; break }
    if (line.trim() === '') continue
    let row = null
    try {
      row = JSON.parse(line)
      if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error('not an object')
    } catch {
      badLines += 1
      continue
    }
    recordCount += 1
    lines.push({ text: line, startByte, sha256: createHash('sha256').update(line).digest('hex') })
    parsed.push(row)
  }
  return { absent: false, lines, parsed, badLines, truncated: sawTruncation, size, mtimeMs: Number(st.mtimeMs) }
}

/** Whole-line content hash — the WPA-1 dedupe key (Spec §6.3). */
export function lineHash(text) {
  return createHash('sha256').update(text).digest('hex')
}

/** Merge status objects across reads of one source.
 * ABSENT only when EVERY input was absent; any badLines/truncation degrades. */
export function mergeStatus(statuses) {
  const present = statuses.filter((s) => s && s.status !== 'ABSENT')
  if (present.length === 0) {
    const reason = statuses.find((s) => s?.reason)?.reason
    return { status: 'ABSENT', ...(reason !== undefined ? { reason } : {}) }
  }
  const degraded = present.some((s) => s.status === 'DEGRADED' || s.truncated === true || (s.badLines ?? 0) > 0)
  const out = { status: degraded ? 'DEGRADED' : 'OK' }
  const reasons = present.filter((s) => s.reason !== undefined).map((s) => s.reason)
  if (reasons.length > 0) out.reason = reasons.join('; ')
  const bad = present.reduce((n, s) => n + (s.badLines ?? 0), 0)
  if (bad > 0) out.badLines = bad
  if (present.some((s) => s.truncated === true)) out.truncated = true
  return out
}
