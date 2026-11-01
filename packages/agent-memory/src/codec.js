/** Formal c21c8f30 codec/guard baseline; Source decode is the strict escape inverse. */
import { randomUUID } from 'node:crypto'

/** Valid memory entry types. */
export const ENTRY_TYPES = new Set(['preference', 'project', 'decision', 'history'])

/** Types that are eligible for automatic context injection. */
export const INJECT_TYPES = new Set(['preference', 'project', 'decision'])

/** Escaping for the title/tags/source lines (content is stored verbatim). */
const ESCAPE = /([\\`*_[\]{}()#+.!|>~-])/g
const UNESCAPE = new RegExp('\\\\' + ESCAPE.source, 'g')

/**
 * Bounded-validation limits (SIGTRAP fix v1). Generous vs. real usage
 * (observed healthy corpus: titles ≤ 64, sources ≤ 51, contents ≤ 900
 * chars; files ≤ a few hundred KB) yet far below the ~2^26-char region where
 * the old runaway allocation reached V8 fatal. `maxFileBytes` gates LOAD so
 * an already-corrupted file fails loud instead of re-entering giant regexp
 * replacement; it also keeps such files frozen (unwritable) until migrated.
 */
export const MEMORY_GUARD_LIMITS = Object.freeze({
  maxFieldChars: 8192,      // one escaped string field (title / source / tag)
  maxContentChars: 65536,   // one entry content body (verbatim, no escaping)
  maxTagCount: 64,          // tags per entry
  maxFileBytes: 33554432,   // 32 MiB MEMORY.md load refusal threshold
  maxRenderChars: 33554432, // renderEntries document upper bound (chars)
  maxRecoveryLayers: 256,   // recoverSource() unwrap bound
})

/**
 * Explicit oversized allowances for the one-off migration tool, which MUST
 * be able to parse the legacy corrupted files the production limits refuse.
 * Never used by runtime call sites (they take MEMORY_GUARD_LIMITS defaults).
 */
export const MIGRATION_GUARD_LIMITS = Object.freeze({
  maxFieldChars: 268435456, // 2^28
  maxContentChars: 268435456,
  maxTagCount: 4096,
  maxFileBytes: Number.POSITIVE_INFINITY,
  maxRenderChars: Number.POSITIVE_INFINITY,
  maxRecoveryLayers: 256,
})

/** FAIL_LOUD_BUT_NON_FATAL guard violation (thrown BEFORE any replace/IO). */
export class MemoryGuardError extends TypeError {
  constructor(which, limit, actual) {
    super(`agent-memory guard: ${which} too large (limit ${limit}, got ${actual})`)
    this.name = 'MemoryGuardError'
    this.code = 'MEMORY_GUARD_LIMIT'
    this.which = which
    this.limit = limit
    this.actual = actual
  }
}

function guardField(text, which, limits) {
  const s = String(text)
  if (s.length > limits.maxFieldChars) throw new MemoryGuardError(which, limits.maxFieldChars, s.length)
  return s
}

function guardContent(text, limits) {
  const s = String(text)
  if (s.length > limits.maxContentChars) throw new MemoryGuardError('content', limits.maxContentChars, s.length)
  return s
}

/** Header written when a MEMORY.md file is first created. */
export const MEMORY_HEADER = [
  '# MEMORY.md — long-term memory (file-first)',
  '',
  '<!-- Human-editable: this file IS the memory. Machine writes re-read it first, so manual edits win. -->',
  '',
].join('\n')

function esc(text, limits) {
  const escaped = guardField(text, 'escaped field', limits).replace(ESCAPE, '\\$1')
  // The stored form is what parse() will decode, so the ESCAPED length is
  // bounded here as well: a legal write can never produce a value that a
  // later read would refuse (write-permits/read-refuses would brick the file).
  if (escaped.length > limits.maxFieldChars) {
    throw new MemoryGuardError('escaped field (stored)', limits.maxFieldChars, escaped.length)
  }
  return escaped
}

function unescape(text, limits) {
  return guardField(text, 'decoded field', limits).replace(UNESCAPE, '$1')
}

/**
 * Escape-canonicality: `esc(unescape(x)) === x` holds exactly on the image
 * of esc (esc is a left inverse of unescape precisely there). Exported for
 * the migration tool's mechanical layer analysis (see recoverSource).
 */
export function isEscapeCanonical(text, limits = MEMORY_GUARD_LIMITS) {
  const s = guardField(text, 'decoded field', limits)
  return esc(unescape(s, limits), limits) === s
}

/**
 * Recover the original source from one raw (as-stored) `- **Source**:` line
 * value written by the historical asymmetric codec.
 *
 * Mechanically: the stored value is esc^k(original) for the number of write
 * cycles k. Unwrapping while escape-canonical walks esc^k → esc^0; a
 * non-canonical state CANNOT be esc(anything), so it is exactly the original.
 * A fixpoint state (`unescape(x) === x`, no `\`+ESCAPE pairs at all) has
 * k = 0 and is its own original.
 *
 * All byte-level hypotheses agree on the backslash-free projection of the
 * value (unescape only removes `\`+ESCAPE pairs), so the LOGICAL recovery is
 * always unique. Where the original itself could have contained literal
 * `\`+ESCAPE pairs, it is indistinguishable from one extra amplification
 * layer — undecidable from bytes alone — and instead of guessing, the entry
 * is flagged: ambiguous = true iff the candidate still carries a `\`+ESCAPE
 * pair or the unwrap bound was hit. Callers must keep the raw evidence (the
 * immutable file backup) and report ambiguous entries separately.
 * @returns `{ source, layers, ambiguous, bounded }`.
 */
export function recoverSource(rawStoredSource, limits = MEMORY_GUARD_LIMITS) {
  let x = guardField(rawStoredSource, 'decoded field', limits)
  let layers = 0
  let bounded = false
  while (layers < limits.maxRecoveryLayers) {
    if (!isEscapeCanonical(x, limits)) break
    const next = unescape(x, limits)
    if (next === x) break
    x = next
    layers++
  }
  if (layers >= limits.maxRecoveryLayers) bounded = true
  const stillPairable = UNESCAPE.test(x)
  UNESCAPE.lastIndex = 0
  return { source: x, layers, ambiguous: bounded || stillPairable, bounded }
}

/**
 * Public codec surface: the render-side escape, one layer, under guard
 * limits. The frozen contract is `parse(render(entry))` symmetry, so the
 * migration tool re-encodes recovered sources with THIS function (never a
 * local re-implementation that could drift from the frozen ESCAPE set).
 */
export function escapeFieldValue(text, limits = MEMORY_GUARD_LIMITS) {
  return esc(text, limits)
}

function tagsToText(tags, limits) {
  if (tags.length > limits.maxTagCount) throw new MemoryGuardError('tag count', limits.maxTagCount, tags.length)
  const line = tags.map((t) => `\`${esc(t, limits)}\``).join(' ')
  // The joined line is what parse() decodes back, so it carries the same
  // stored-form bound as any other field (write-permits/read-refuses symmetry).
  if (line.length > limits.maxFieldChars) throw new MemoryGuardError('tags line', limits.maxFieldChars, line.length)
  return line
}

function tagsFromText(text, limits) {
  const out = []
  for (const match of guardField(text, 'decoded field', limits).matchAll(/`([^`]+)`/g)) {
    out.push(unescape(match[1], limits))
  }
  return out
}

/** Normalize an entry before persisting (id/type/importance/updated defaults). */
export function normalizeEntry(entry, now = new Date().toISOString()) {
  if (!entry || typeof entry !== 'object') throw new TypeError('entry must be an object')
  const type = entry.type
  if (!ENTRY_TYPES.has(type)) throw new TypeError(`invalid memory type: ${type}`)
  const title = typeof entry.title === 'string' ? entry.title.trim() : ''
  if (title === '') throw new TypeError('title must be a non-empty string')
  const content = typeof entry.content === 'string' ? entry.content : String(entry.content ?? '')
  return {
    id: typeof entry.id === 'string' && entry.id !== '' ? entry.id : randomUUID(),
    type,
    title,
    content,
    tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
    importance: Number.isInteger(entry.importance) ? Math.min(5, Math.max(1, entry.importance)) : 3,
    source: typeof entry.source === 'string' && entry.source !== '' ? entry.source : 'manual',
    updatedAt: typeof entry.updatedAt === 'string' && entry.updatedAt !== '' ? entry.updatedAt : now,
  }
}

/** Render one entry to its Markdown block. */
export function renderEntry(entry, { limits = MEMORY_GUARD_LIMITS } = {}) {
  const content = guardContent(entry.content, limits)
  const lines = [
    `## ${esc(entry.title, limits)}`,
    '',
    `- **ID**: \`${entry.id}\``,
    `- **Type**: ${entry.type}`,
    `- **Importance**: ${entry.importance}`,
    `- **Tags**: ${tagsToText(entry.tags ?? [], limits)}`,
    `- **Updated**: ${entry.updatedAt}`,
    `- **Source**: ${esc(entry.source ?? '', limits)}`,
    '',
    content,
    '',
    '---',
    '',
  ]
  return lines.join('\n')
}

/**
 * Render a full MEMORY.md document from entries. The document bound is
 * checked additively BEFORE any per-entry rendering. It is a strict upper
 * bound: escaped fields at most double (raw × 2), id/updatedAt render
 * verbatim (counted × 2 for margin), the tags line costs ≤ 5 chars per tag
 * plus 2× its content, and the fixed per-entry scaffolding is ≤ 320 chars.
 */
export function renderEntries(entries, { limits = MEMORY_GUARD_LIMITS } = {}) {
  let upper = MEMORY_HEADER.length
  for (const entry of entries) {
    upper += 320
      + 2 * String(entry.title ?? '').length
      + 2 * String(entry.source ?? '').length
      + 2 * String(entry.id ?? '').length
      + 2 * String(entry.updatedAt ?? '').length
      + String(entry.content ?? '').length
      + 5 * (entry.tags ?? []).length
      + 4 * (entry.tags ?? []).reduce((n, t) => n + String(t).length, 0)
  }
  if (upper > limits.maxRenderChars) {
    throw new MemoryGuardError('rendered document', limits.maxRenderChars, upper)
  }
  return MEMORY_HEADER + entries.map((e) => renderEntry(e, { limits })).join('')
}

const META_RE = {
  type: /^- \*\*Type\*\*: (.+)$/m,
  importance: /^- \*\*Importance\*\*: (\d+)$/m,
  tags: /^- \*\*Tags\*\*: (.*)$/m,
  updated: /^- \*\*Updated\*\*: (.+)$/m,
  source: /^- \*\*Source\*\*: (.+)$/m,
}

/**
 * Parse a MEMORY.md document back into entries. Entries are anchored on the
 * structural ID line (`- **ID**: \`x\`` immediately followed by
 * `- **Type**:`), so a body line that looks like metadata cannot forge an
 * entry or split a block. Title = the last `## ` heading before the anchor;
 * body = everything between the metadata head and the trailing `---`
 * separator, verbatim. Title/tags/source are decoded (strict esc inverse);
 * the source decode is the SIGTRAP-fix codec contract (frozen above).
 * @param text - the document text.
 * @param options - `{ limits }` guard limits (defaults MEMORY_GUARD_LIMITS).
 * @returns the parsed entries.
 */
export function parseEntries(text, { limits = MEMORY_GUARD_LIMITS } = {}) {
  const entries = []
  const anchors = [...String(text ?? '').matchAll(/^- \*\*ID\*\*: `([^`]+)`\n- \*\*Type\*\*:/gm)]
  let prevEnd = 0
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i]
    const blockStart = anchor.index
    const blockEnd = i + 1 < anchors.length ? anchors[i + 1].index : text.length

    const titleMatches = [...String(text).slice(prevEnd, blockStart).matchAll(/^## (.+)$/gm)]
    const titleMatch = titleMatches[titleMatches.length - 1]

    let head = String(text).slice(blockStart, blockEnd)
    // Strip the structural head (ID line + generated metadata run).
    head = head.replace(/^- \*\*ID\*\*: `[^`]+`\n?/, '')
    head = head.replace(/^(- \*\*(Type|Importance|Tags|Updated|Source)\*\*:.*\n?)+/, '')

    // Body ends at the last structural separator before the next anchor.
    const separators = [...head.matchAll(/^---\s*$/gm)]
    const lastSep = separators[separators.length - 1]
    if (lastSep) head = head.slice(0, lastSep.index)
    const content = head.trim()

    const meta = {}
    for (const [key, re] of Object.entries(META_RE)) {
      const m = String(text).slice(blockStart, blockEnd).match(re)
      if (m) meta[key] = m[1].trim()
    }
    const importance = Number.parseInt(meta.importance ?? '', 10)
    entries.push({
      id: anchor[1],
      title: titleMatch ? unescape(titleMatch[1], limits).trim() : '',
      type: meta.type ?? '',
      importance: Number.isInteger(importance) ? importance : 3,
      tags: meta.tags !== undefined ? tagsFromText(meta.tags, limits) : [],
      updatedAt: meta.updated ?? '',
      // Codec contract: stored = esc(value); decode the strict inverse here
      // (the historical defect read it raw, re-escaping once per write).
      source: meta.source !== undefined ? unescape(meta.source, limits) : '',
      content,
    })

    const lineEnd = String(text).indexOf('\n', blockStart)
    prevEnd = lineEnd === -1 ? text.length : lineEnd + 1
  }
  return entries
}

