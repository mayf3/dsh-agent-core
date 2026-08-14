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
 *   - **Source**: <provenance>
 *
 *   <content body>
 *
 *   ---
 *
 * Only the title is markdown-escaped; the content body is stored verbatim so
 * user text round-trips exactly. Entries are anchored on the structural
 * `- **ID**:` line (always followed by `- **Type**:`), which a body line
 * cannot forge.
 */

import { readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
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

/** Escaping for the title line only (content is stored verbatim). */
const ESCAPE = /([\\`*_[\]{}()#+.!|>~-])/g
const UNESCAPE = new RegExp('\\\\' + ESCAPE.source, 'g')

/** Header written when a MEMORY.md file is first created. */
export const MEMORY_HEADER = [
  '# MEMORY.md — long-term memory (file-first)',
  '',
  '<!-- Human-editable: this file IS the memory. Machine writes re-read it first, so manual edits win. -->',
  '',
].join('\n')

function esc(text) {
  return String(text).replace(ESCAPE, '\\$1')
}

function unescape(text) {
  return String(text).replace(UNESCAPE, '$1')
}

function tagsToText(tags) {
  return (tags ?? []).map((t) => `\`${esc(t)}\``).join(' ')
}

function tagsFromText(text) {
  const out = []
  for (const match of String(text ?? '').matchAll(/`([^`]+)`/g)) out.push(unescape(match[1]))
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
export function renderEntry(entry) {
  const lines = [
    `## ${esc(entry.title)}`,
    '',
    `- **ID**: \`${entry.id}\``,
    `- **Type**: ${entry.type}`,
    `- **Importance**: ${entry.importance}`,
    `- **Tags**: ${tagsToText(entry.tags)}`,
    `- **Updated**: ${entry.updatedAt}`,
    `- **Source**: ${esc(entry.source ?? '')}`,
    '',
    entry.content,
    '',
    '---',
    '',
  ]
  return lines.join('\n')
}

/** Render a full MEMORY.md document from entries. */
export function renderEntries(entries) {
  return MEMORY_HEADER + entries.map(renderEntry).join('')
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
 * separator, verbatim.
 * @param text - the document text.
 * @returns the parsed entries.
 */
export function parseEntries(text) {
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
      title: titleMatch ? unescape(titleMatch[1]).trim() : '',
      type: meta.type ?? '',
      importance: Number.isInteger(importance) ? importance : 3,
      tags: tagsFromText(meta.tags),
      updatedAt: meta.updated ?? '',
      source: meta.source ?? '',
      content,
    })

    const lineEnd = String(text).indexOf('\n', blockStart)
    prevEnd = lineEnd === -1 ? text.length : lineEnd + 1
  }
  return entries
}

/** Read and parse MEMORY.md; a missing file yields an empty list. */
export async function loadEntries(memoryFile) {
  let text
  try {
    text = await readFile(memoryFile, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  return parseEntries(text)
}

/**
 * Synchronous variant for prompt-assembly providers (systemPrompt.context
 * evaluates text providers synchronously — a fresh file read per assembly,
 * so human edits are visible on the very next turn).
 */
export function loadEntriesSync(memoryFile) {
  let text
  try {
    text = readFileSync(memoryFile, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  return parseEntries(text)
}

/** Atomically write entries to MEMORY.md (tmp + rename on the same fs). */
export async function writeEntries(memoryFile, entries) {
  await mkdir(dirname(memoryFile), { recursive: true })
  const tmp = `${memoryFile}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`
  await writeFile(tmp, renderEntries(entries), 'utf8')
  await rename(tmp, memoryFile)
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
  const updated = normalizeEntry({ ...entries[index], ...patch, id }, now)
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
export async function load(agentId, { workspaceRoot, memoryFile } = {}) {
  const workspace = resolveAgentWorkspace(agentId, workspaceRoot)
  const file = memoryFile ?? resolveMemoryFile(workspace)
  return { workspace, memoryFile: file, entries: await loadEntries(file) }
}

/** Convenience glue: renderForContext(agentId) — load + render. */
export async function renderForContext(agentId, { workspaceRoot, memoryFile, maxEntries, maxChars, threshold } = {}) {
  const { workspace, memoryFile: file, entries } = await load(agentId, { workspaceRoot, memoryFile })
  return {
    workspace,
    memoryFile: file,
    text: renderContextText(entries, { maxEntries, maxChars, threshold }),
  }
}

export { resolveAgentWorkspace } from './paths.js'
export { resolveMemoryDir, resolveMemoryFile, resolveDailyNoteFile } from './paths.js'
