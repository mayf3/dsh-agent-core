/**
 * @agent-core/agent-memory — file-first per-agent memory store (pure core).
 *
 * FILE-FIRST: the curated long-term memory of an agent IS a Markdown file
 * (`<workspace>/MEMORY.md`), not a database that mirrors to Markdown. Humans
 * read/edit/delete entries with any editor; every machine operation re-reads
 * the file before writing, so human edits win (no stale mirror to merge back —
 * the file is the source of truth). Writes are atomic (tmp + rename) so a
 * crash never leaves a torn file.
 *
 * Episodic layer: `<workspace>/memory/YYYY-MM-DD.md` daily notes. Every
 * consolidation attempt appends its raw evidence there, so information is
 * NEVER lost even when the LLM distillation fails — the daily note is the
 * reliable fallback ("MEMORY.md 类方案是可靠 fallback").
 *
 * Entry format (adapted from @modusensus/dsh-mneme's Markdown mirror, which
 * is battle-tested for human-edit round-trips):
 *
 *   ## <escaped title>
 *   - **ID**: `<uuid>`
 *   - **Type**: preference|project|decision|history
 *   - **Importance**: 1-5
 *   - **Tags**: `a` `b`
 *   - **Updated**: <ISO>
 *   - **Source**: <escaped provenance>
 *
 *   <content body>
 *
 *   ---
 *
 * The title, tags and source are markdown-escaped; the content body is stored
 * verbatim so user text round-trips exactly. Entries are anchored on the
 * structural `- **ID**:` line (always followed by `- **Type**:`), which a
 * body line cannot forge.
 *
 * SOURCE CODEC CONTRACT (frozen, SIGTRAP fix v1):
 *   render:  stored line = esc(value)   (every ESCAPE char prefixed with `\`)
 *   parse:   value      = unescape(stored line)   — the strict inverse.
 * The historical defect decoded title/tags but NOT source, so every
 * read-modify-write cycle escaped the source one more time (the ESCAPE set
 * includes `\`, so escaping is self-amplifying: esc^k grows ~2x per cycle)
 * until the String.prototype.replace replacement builder hit a V8 fatal
 * (SIGTRAP, uncatchable from JS). Source now decodes like title/tags, making
 * parse(render(e)) === e and render(parse(render(e))) === render(e)
 * fixpoints; legacy files written by the asymmetric codec are repaired by
 * scripts/agent-memory-sigtrap-migration-v1.mjs (a separate concern — a
 * parser-side unescape alone does NOT restore an already-amplified source).
 *
 * MEMORY GUARD (bounded validation BEFORE every String.replace):
 * V8 regexp replacement fatals cannot be recovered from JS, so every replace
 * is gated by explicit size bounds (MEMORY_GUARD_LIMITS). A limit violation
 * throws a MemoryGuardError (code MEMORY_GUARD_LIMIT) BEFORE the replace and
 * BEFORE any file mutation — FAIL_LOUD_BUT_NON_FATAL: callers catch it, the
 * agent turn keeps its exact outcome, the original MEMORY.md is never
 * touched, and no half-written file is produced. Corrupted (oversized) files
 * are refused at load, which also freezes them against further machine
 * writes until migrated.
 */

import { readFileSync } from 'node:fs'
import { chmod, chown, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import {
  resolveAgentWorkspace,
  resolveDailyNoteFile,
  resolveMemoryDir,
  resolveMemoryFile,
} from './paths.js'

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
  return guardField(text, 'escaped field', limits).replace(ESCAPE, '\\$1')
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
  return tags.map((t) => `\`${esc(t, limits)}\``).join(' ')
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
 * checked additively BEFORE any per-entry rendering: each field at most
 * doubles under escaping and the fixed per-entry overhead is < 128 chars, so
 * `2 × (raw input) + 128 × entries + header` is a strict upper bound.
 */
export function renderEntries(entries, { limits = MEMORY_GUARD_LIMITS } = {}) {
  let upper = MEMORY_HEADER.length
  for (const entry of entries) {
    upper += 128
      + 2 * String(entry.title ?? '').length
      + 2 * String(entry.source ?? '').length
      + String(entry.content ?? '').length
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

/**
 * Read and parse MEMORY.md; a missing file yields an empty list. The file
 * size is bounded (stat BEFORE reading): an oversized — e.g. historically
 * corrupted — file throws MemoryGuardError instead of re-entering giant
 * regexp work, which also freezes it against further machine writes until
 * the migration tool repairs it.
 */
export async function loadEntries(memoryFile, { limits = MEMORY_GUARD_LIMITS } = {}) {
  const info = await stat(memoryFile).catch((error) => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  if (info === undefined) return []
  if (info.size > limits.maxFileBytes) throw new MemoryGuardError('memory file', limits.maxFileBytes, info.size)
  const text = await readFile(memoryFile, 'utf8')
  return parseEntries(text, { limits })
}

/**
 * Synchronous variant for prompt-assembly providers (systemPrompt.context
 * evaluates text providers synchronously — a fresh file read per assembly,
 * so human edits are visible on the very next turn). Same size guard as
 * loadEntries (call sites catch and degrade to an empty injection block).
 */
export function loadEntriesSync(memoryFile, { limits = MEMORY_GUARD_LIMITS } = {}) {
  const info = readFileSync(memoryFile)
  if (info.byteLength > limits.maxFileBytes) throw new MemoryGuardError('memory file', limits.maxFileBytes, info.byteLength)
  return parseEntries(info.toString('utf8'), { limits })
}

/** fsync a directory so a completed rename is durable. */
async function fsyncDir(dir) {
  const handle = await open(dir, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

/**
 * Atomically write entries to MEMORY.md (tmp + fsync + rename on the same
 * fs, directory fsynced). The previous file's mode/uid/gid are carried onto
 * the replacement so repeated writes never drift metadata; on any failure
 * the tmp file is removed and the original stays untouched (no half-written
 * file). Guard limits throw BEFORE any byte is written.
 */
export async function writeEntries(memoryFile, entries, { limits = MEMORY_GUARD_LIMITS } = {}) {
  const rendered = renderEntries(entries, { limits })
  const dir = dirname(memoryFile)
  await mkdir(dir, { recursive: true })
  const previous = await stat(memoryFile).catch((error) => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  // Write-side freeze: an oversized (corrupted) file is refused exactly like
  // loadEntries refuses it, so no runtime path can silently replace a file
  // the guard declared unparseable — repair goes through the migration tool.
  if (previous && previous.size > limits.maxFileBytes) {
    throw new MemoryGuardError('memory file', limits.maxFileBytes, previous.size)
  }
  const tmp = `${memoryFile}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`
  try {
    const handle = await open(tmp, 'w', (previous?.mode ?? 0o644) & 0o7777)
    try {
      await handle.write(rendered, 0, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    if (previous) {
      // Carry owner/group/mode of the replaced file (same-user writes are
      // no-ops; a root-side repair write restores the original ownership).
      await chmod(tmp, previous.mode & 0o7777)
      if (process.getuid?.() === 0) await chown(tmp, previous.uid, previous.gid)
    }
    await rename(tmp, memoryFile)
  } catch (error) {
    await unlink(tmp).catch(() => {})
    throw error
  }
  await fsyncDir(dir)
}

/**
 * Save an entry, merging into the existing entry of the SAME TYPE with the
 * SAME title (title is the natural dedupe key; content is replaced by the
 * newest statement, importance/tags taken from the new entry when given).
 * @param entries - the current parsed entries.
 * @param entry - the new entry ({type,title,content,...}).
 * @param now - ISO timestamp for new/updated entries (defaults to now).
 * @returns `{ action: 'created'|'merged', entries, entry }` — the full list
 *   (already containing the saved entry) and the saved entry.
 */
export function saveWithDedupe(entries, entry, now = new Date().toISOString()) {
  const normalized = normalizeEntry(entry, now)
  const index = entries.findIndex((m) => m.type === normalized.type && m.title.trim() === normalized.title)
  if (index !== -1) {
    const existing = entries[index]
    const merged = normalizeEntry({
      ...existing,
      title: normalized.title,
      content: normalized.content,
      tags: normalized.tags,
      importance: normalized.importance,
      source: normalized.source,
      updatedAt: now, // content changed → refresh the human-visible timestamp
    }, now)
    const next = entries.slice()
    next[index] = merged
    return { action: 'merged', entries: next, entry: merged }
  }
  const next = entries.concat(normalized)
  return { action: 'created', entries: next, entry: normalized }
}

/** Update one entry by id (patch may contain any entry field). */
export function updateEntry(entries, id, patch, now = new Date().toISOString()) {
  const index = entries.findIndex((m) => m.id === id)
  if (index === -1) return { entries, entry: undefined }
  const updated = normalizeEntry({ ...entries[index], ...patch, id, updatedAt: now }, now)
  const next = entries.slice()
  next[index] = updated
  return { entries: next, entry: updated }
}

/** Remove one entry by id. */
export function removeEntry(entries, id) {
  const index = entries.findIndex((m) => m.id === id)
  if (index === -1) return { entries, removed: false }
  const next = entries.slice()
  next.splice(index, 1)
  return { entries: next, removed: true }
}

/** Substring search over title/content/tags (case-insensitive). */
export function searchEntries(entries, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (q === '') return []
  return entries.filter((m) =>
    m.title.toLowerCase().includes(q)
    || m.content.toLowerCase().includes(q)
    || m.tags.some((t) => t.toLowerCase().includes(q)))
}

/**
 * Render the injection block for a fresh session: summaries first, then
 * preferences, then items with importance >= threshold; capped by maxEntries
 * and maxChars. History is never auto-injected (it is episodic, not curated).
 * @param entries - the parsed entries.
 * @param options - `{ maxEntries=6, maxChars=2400, threshold=3 }`.
 * @returns the context text ('' when nothing qualifies).
 */
export function renderContextText(entries, { maxEntries = 6, maxChars = 2400, threshold = 3 } = {}) {
  const candidates = entries
    .filter((m) => INJECT_TYPES.has(m.type) && (m.type === 'preference' || m.importance >= threshold))
    .sort((a, b) => {
      const pa = a.type === 'preference' ? 0 : 1
      const pb = b.type === 'preference' ? 0 : 1
      return pa - pb || b.importance - a.importance
    })
  if (candidates.length === 0) return ''
  const lines = ['[memory] cross-session long-term memory of this agent:']
  let chars = lines[0].length + 1
  for (const m of candidates) {
    if (lines.length - 1 >= maxEntries) break
    const line = `- [${m.type}] ${m.title} (importance ${m.importance}): ${m.content}`
    if (chars + line.length > maxChars) break
    lines.push(line)
    chars += line.length + 1
  }
  if (lines.length === 1) return ''
  return lines.join('\n')
}

/** Append raw text to today's (or a given date's) daily note. */
export async function appendDailyNote(workspace, text, date = new Date()) {
  if (typeof text !== 'string' || text.trim() === '') return undefined
  const file = resolveDailyNoteFile(workspace, date)
  await mkdir(resolveMemoryDir(workspace), { recursive: true })
  await writeFile(file, `${text.trim()}\n\n`, { encoding: 'utf8', flag: 'a' })
  return file
}

/** Read recent daily notes: `[{date, file, text}]`, newest last. */
export async function readDailyNotes(workspace, { days = 7, now = new Date() } = {}) {
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    const file = resolveDailyNoteFile(workspace, d)
    let text
    try {
      text = await readFile(file, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
    out.push({ date: d.toISOString().slice(0, 10), file, text })
  }
  return out
}

/**
 * Consolidate one piece of session evidence into the curated memory.
 *
 * Input: raw evidence text (a distilled transcript of the session turn, built
 * by the caller from the session log). Output: curated entries written to
 * MEMORY.md via the injected `distill` function (LLM-backed in the plugin,
 * mock in tests).
 *
 * FAIL-SAFE (the reliable fallback): whenever distillation is unavailable,
 * fails, or yields nothing, the raw evidence is appended to the daily note
 * (`memory/YYYY-MM-DD.md`) so the information is preserved in the episodic
 * layer even though it did not reach the curated file. The daily note is
 * always appended on a successful run too (provenance / audit trail).
 *
 * A guard violation (oversized/corrupted MEMORY.md) surfaces AFTER the daily
 * note is appended — evidence is never lost — and propagates to the caller,
 * whose catch paths log loudly without losing the agent turn.
 *
 * @param options - `{ workspace, memoryFile?, evidence, distill?, dailyNotes?=true, logger?, now? }`.
 * @returns `{ saved: entry[], fallback: boolean, fallbackFile?, entries }`.
 */
export async function consolidate({
  workspace,
  memoryFile,
  evidence,
  distill,
  dailyNotes = true,
  logger,
  now = new Date(),
}) {
  const file = memoryFile ?? resolveMemoryFile(workspace)
  const result = { saved: [], fallback: false, fallbackFile: undefined, entries: [] }
  const evidenceText = String(evidence ?? '').trim()
  if (evidenceText === '') return result
  const nowDate = now instanceof Date ? now : new Date(now)
  const nowIso = nowDate.toISOString()

  if (dailyNotes) {
    const fallbackFile = await appendDailyNote(workspace, evidenceText, nowDate)
    result.fallbackFile = fallbackFile
  }

  let distilled = []
  if (typeof distill === 'function') {
    try {
      distilled = await distill(evidenceText)
    } catch (error) {
      logger?.warn?.(`agent-memory: consolidation distill failed, keeping raw evidence in daily note: ${String(error)}`)
    }
  } else {
    logger?.warn?.('agent-memory: no distill function; consolidation falls back to the daily note only')
  }

  // Validate distilled shape defensively (never let a bad LLM output corrupt
  // the curated file).
  const valid = (Array.isArray(distilled) ? distilled : []).filter((item) => {
    try {
      normalizeEntry(item)
      return true
    } catch {
      return false
    }
  })

  if (valid.length === 0) {
    result.fallback = true
    return result
  }

  let entries = await loadEntries(file)
  const saved = []
  for (const item of valid) {
    const outcome = saveWithDedupe(entries, item, nowIso)
    entries = outcome.entries
    saved.push(outcome.entry)
  }
  await writeEntries(file, entries)
  result.saved = saved
  result.entries = entries
  return result
}

/** Convenience glue: full load(agentId) — resolve workspace + parse file. */
export async function load(agentId, { workspaceRoot, memoryFile, limits } = {}) {
  const workspace = resolveAgentWorkspace(agentId, workspaceRoot)
  const file = memoryFile ?? resolveMemoryFile(workspace)
  return { workspace, memoryFile: file, entries: await loadEntries(file, { limits }) }
}

/** Convenience glue: renderForContext(agentId) — load + render. */
export async function renderForContext(agentId, { workspaceRoot, memoryFile, maxEntries, maxChars, threshold, limits } = {}) {
  const { workspace, memoryFile: file, entries } = await load(agentId, { workspaceRoot, memoryFile, limits })
  return {
    workspace,
    memoryFile: file,
    text: renderContextText(entries, { maxEntries, maxChars, threshold }),
  }
}

export { resolveAgentWorkspace } from './paths.js'
export { resolveMemoryDir, resolveMemoryFile, resolveDailyNoteFile } from './paths.js'
