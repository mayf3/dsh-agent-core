/**
 * Pinned DSH compatibility layer (MOBILE_SESSION_HISTORY_V1 §3 item 5).
 *
 * - `decodeStorageRecord` / `SESSION_FORMAT_VERSION` come from the pinned
 *   `@deepseek-ai/dsh-session@0.1.0-rc.8` package — the public read-only
 *   decoder of the deployed DSH revision. It is consumed ONLY through the
 *   bounded seam in `./snapshot.js`, which enforces CTR-SH-011 ceilings before
 *   and during expansion (count-before-materialize pre-scan; the pinned
 *   decoder materializes one record's expansion eagerly, so the pre-scan is
 *   the CTR-SH-003-sanctioned wrapper).
 * - `projectKey` / `encodeSegment` are a verbatim transcription of
 *   `@deepseek-ai/dsh-session-persistence-jsonl@0.1.0-rc.8` `src/format.ts` (the
 *   locator encoding of the deployed revision; the pinned tarball's public
 *   entry does not export these helpers and the package drags the native zstd
 *   binding, which the plaintext-only read path must never load). Golden tests
 *   pin the transcription against real on-disk project directories.
 */

import { createHash } from 'node:crypto'
import { decodeStorageRecord, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'

export { decodeStorageRecord, SESSION_FORMAT_VERSION }

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex')

const SEGMENT_SAFE_RE = /^[A-Za-z0-9._-]$/

/**
 * Verbatim transcription of `encodeSegment` from the pinned revision: injective
 * single-segment escape over all UTF-16 code units; safe units literal, every
 * other unit (including `~`) becomes `~XXXX`; `.`/`..` whole-segment special cases.
 */
export function encodeSegment(raw) {
  if (raw.length === 0) throw new Error('cannot encode an empty path segment')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch !== '~' && SEGMENT_SAFE_RE.test(ch)) {
      out += ch
    } else {
      out += '~' + code.toString(16).toUpperCase().padStart(4, '0')
    }
  }
  return out
}

/**
 * Verbatim transcription of `projectKey` from the pinned revision: separators
 * (`/`, `\`, `:`) collapse to one `-`; safe code units literal; others `~XXXX`;
 * leading separator runs stripped (empty → `root`); wrapped `--<slug>--`.
 */
export function projectKey(cwd) {
  if (cwd.length === 0) throw new Error('cannot encode an empty project path')
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i++) {
    const code = cwd.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && SEGMENT_SAFE_RE.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  const slug = readable.replace(/^-+/, '') || 'root'
  return `--${slug.slice(0, 251)}--`
}

/** Storage-record tags whose expansion is 1:N (one event per `data.members` entry). */
export const CHUNK_ROW_TAGS = new Set(['text-chunks', 'reasoning-chunks', 'tool-call-chunks'])

/**
 * Bounded pre-scan (CTR-SH-003 count-before-expand): the exact number of
 * expanded events a parsed record yields under the pinned rc.8 decoder.
 * Chunk rows (envelope exactly `{type, seq0, time0, data}`) expand to one
 * `assistant/chunk` event per `data.texts` / `data.args` member; every other
 * value decodes to exactly one event. Returns 0 only for a malformed chunk
 * row (the pinned decoder's own validation then throws — committed
 * corruption), so the caller never materializes an over-ceiling expansion.
 */
export function expandedEventCount(parsedRecord) {
  if (parsedRecord !== null && typeof parsedRecord === 'object' && !Array.isArray(parsedRecord)) {
    if (CHUNK_ROW_TAGS.has(parsedRecord.type)) {
      const data = parsedRecord.data
      const members = parsedRecord.type === 'tool-call-chunks' ? data?.args : data?.texts
      return Array.isArray(members) ? members.length : 0
    }
  }
  return 1
}
