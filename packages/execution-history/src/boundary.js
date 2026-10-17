/**
 * @agent-core/execution-history/src/boundary.js — boundary freezing, reportId
 * determinism, vector cursor, and the deterministic (NON_AUTHORITY-marked)
 * merge order (Spec §4.1).
 *
 * reportId hash input = root + args + sourceGenerationToken; wall-clock
 * asOfUtc is recorded in the body but NEVER hashed. The token is derived from
 * what the loaders actually read ({file, size, mtimeMs, rows} per source), so
 * an unchanged corpus yields an unchanged reportId (T4) and any source growth
 * yields a new boundary (new reportId).
 */

import { createHash } from 'node:crypto'

/** Fixed source enumeration — the stable sourceRank for merge ordering. */
export const SOURCE_RANKS = [
  'scheduler_store',
  'scheduler_history',
  'attempts_ledger',
  'asm_audit',
  'runtime_evidence',
  'session_journal',
  'svc_detail',
  'svc_timeline',
  'svc_submissions',
]

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

/** Build the token from loader outputs: {sourceName: [{file,size,mtimeMs}, ...], rows}. */
export function sourceGenerationToken(sourceFiles) {
  const token = {}
  const names = [...new Set([...SOURCE_RANKS, ...Object.keys(sourceFiles)])].sort()
  for (const name of names) {
    const entry = sourceFiles[name]
    if (entry === undefined) continue
    token[name] = {
      rows: entry.rows ?? 0,
      files: (entry.files ?? []).map((f) => ({ file: f.file, size: f.size, mtimeMs: f.mtimeMs ?? 0 })).sort((a, b) => a.file.localeCompare(b.file)),
    }
  }
  return token
}

export function computeReportId(root, args, token) {
  const hash = createHash('sha256').update(stableStringify({ root, args, token })).digest('hex')
  return `ehq-${hash.slice(0, 16)}`
}

// ── merge order + pagination ────────────────────────────────────────────────

/**
 * Deterministic NON_AUTHORITY merge: per-source native order preserved;
 * cross-source interleaving by (atMs, sourceRank, nativeSeq). Cross-system
 * clock proximity is explicitly not causal evidence (Spec §5) — `order` is a
 * pagination total order only.
 */
export function mergeTimeline(entries) {
  const rankOf = new Map(SOURCE_RANKS.map((name, index) => [name, index]))
  return [...entries].sort((a, b) => {
    const at = (a.atMs ?? Number.MAX_SAFE_INTEGER) - (b.atMs ?? Number.MAX_SAFE_INTEGER)
    if (at !== 0) return at
    const ra = rankOf.get(a.source) ?? SOURCE_RANKS.length
    const rb = rankOf.get(b.source) ?? SOURCE_RANKS.length
    if (ra !== rb) return ra - rb
    const sa = a.nativeSeq ?? 0
    const sb = b.nativeSeq ?? 0
    if (sa !== sb) return sa - sb
    return String(a.dedupeKey ?? '').localeCompare(String(b.dedupeKey ?? ''))
  }).map((entry, index) => ({ ...entry, order: index + 1, orderAuthority: 'NON_AUTHORITY_PAGINATION_ONLY' }))
}

/** Vector cursor: per-source position (last emitted merge order index). */
export function encodeCursor(lastOrder) {
  return Buffer.from(JSON.stringify({ v: 1, afterOrder: lastOrder }), 'utf8').toString('base64url')
}

export function decodeCursor(cursor) {
  if (cursor === undefined || cursor === null || cursor === '') return { afterOrder: 0 }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (parsed?.v !== 1 || !Number.isInteger(parsed.afterOrder) || parsed.afterOrder < 0) throw new Error('bad cursor')
    return parsed
  } catch {
    throw Object.assign(new Error('invalid cursor'), { code: 'invalid_arguments' })
  }
}

export function paginateTimeline(entries, { cursor, limit = 200 }) {
  const { afterOrder } = decodeCursor(cursor)
  const merged = mergeTimeline(entries)
  const start = merged.findIndex((e) => e.order > afterOrder)
  const slice = start < 0 ? [] : merged.slice(start, start + limit)
  const hasMore = start >= 0 && merged.length > start + limit
  const nextCursor = hasMore ? encodeCursor(slice[slice.length - 1].order) : undefined
  return { entries: slice, nextCursor, totalOrders: merged.length, cursorSemantics: 'vector: per-source native order preserved; cross-source (atMs, sourceRank, nativeSeq) is NON_AUTHORITY' }
}

export function utcIso(ms) {
  return Number.isFinite(ms) && ms !== null ? new Date(ms).toISOString() : null
}
