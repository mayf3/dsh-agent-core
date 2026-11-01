/** File-first workspace store. Formal Source codec/guards are in codec.js;
 * writes preserve mode/uid/gid and fsync file+directory. See MEMORY_V1 and #1248. */
import { readFileSync } from 'node:fs'
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { dirname } from 'node:path'
import {
  resolveAgentWorkspace,
  resolveDailyNoteFile,
  resolveMemoryDir,
  resolveMemoryFile,
} from './paths.js'

import { INJECT_TYPES, MEMORY_GUARD_LIMITS, MemoryGuardError, normalizeEntry, renderEntries, parseEntries } from './codec.js'
export { ENTRY_TYPES, INJECT_TYPES, MEMORY_GUARD_LIMITS, MIGRATION_GUARD_LIMITS, MemoryGuardError, MEMORY_HEADER, isEscapeCanonical, recoverSource, escapeFieldValue, normalizeEntry, renderEntry, renderEntries, parseEntries } from './codec.js'

export const ASSEMBLY_GUARD_LIMITS = Object.freeze({maxAssemblyParseBytes:524288,warnFileBytes:262144})
let assemblyBloomWarned = false

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

/** Installed assembly parse-window guard; reads remain subject to maxFileBytes. */
export function loadEntriesTailSync(memoryFile, { limits = MEMORY_GUARD_LIMITS, assembly = ASSEMBLY_GUARD_LIMITS, onSnapshot } = {}) {
  const info = readFileSync(memoryFile)
  onSnapshot?.({sha256:createHash('sha256').update(info).digest('hex'),bytes:info.byteLength})
  if (info.byteLength > limits.maxFileBytes) throw new MemoryGuardError('memory file', limits.maxFileBytes, info.byteLength)
  if (info.byteLength > assembly.warnFileBytes && !assemblyBloomWarned) {
    assemblyBloomWarned = true
    process.stderr.write(
      `agent-memory: MEMORY.md is ${info.byteLength} bytes (operational bound `
      + `${assembly.warnFileBytes}); assembly parses only the newest `
      + `${assembly.maxAssemblyParseBytes} bytes — archive/rotate old entries `
      + `to keep curated memory effective\n`)
  }
  return parseAssemblyEntries(info,{limits,assembly})
}

/** Pure installed assembly window semantics, shared by inspection predictions. */
export function parseAssemblyEntries(bytes,{limits=MEMORY_GUARD_LIMITS,assembly=ASSEMBLY_GUARD_LIMITS}={}) {
  if (bytes.byteLength > limits.maxFileBytes) throw new MemoryGuardError('memory file',limits.maxFileBytes,bytes.byteLength)
  if (bytes.byteLength <= assembly.maxAssemblyParseBytes) {
    return parseEntries(bytes.toString('utf8'), { limits })
  }
  const tail = bytes.subarray(bytes.byteLength - assembly.maxAssemblyParseBytes).toString('utf8')
  const firstTitle = tail.indexOf('\n## ')
  const text = firstTitle === -1 ? tail : tail.slice(firstTitle + 1)
  return parseEntries(text, { limits })
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
      if (previous) {
        // Carry owner/group/mode of the replaced file (same-user writes are
        // no-ops; a root-side repair write restores the original ownership),
        // BEFORE the fsync so the synced metadata is final.
        await handle.chmod(previous.mode & 0o7777)
        if (process.getuid?.() === 0) await handle.chown(previous.uid, previous.gid)
      }
      await handle.sync()
    } finally {
      await handle.close()
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
export function renderContextText(entries, { maxEntries = 6, maxChars = 2400, threshold = 3, onSelection } = {}) {
  const candidates = entries
    .filter((m) => INJECT_TYPES.has(m.type) && (m.type === 'preference' || m.importance >= threshold))
    .sort((a, b) => {
      const pa = a.type === 'preference' ? 0 : 1
      const pb = b.type === 'preference' ? 0 : 1
      return pa - pb || b.importance - a.importance
    })
  const selectedIds = []
  if (candidates.length === 0) { onSelection?.(selectedIds); return '' }
  const lines = ['[memory] cross-session long-term memory of this agent:']
  let chars = lines[0].length + 1
  for (const m of candidates) {
    if (lines.length - 1 >= maxEntries) break
    const line = `- [${m.type}] ${m.title} (importance ${m.importance}): ${m.content}`
    if (chars + line.length > maxChars) break
    lines.push(line)
    selectedIds.push(m.id)
    chars += line.length + 1
  }
  onSelection?.(selectedIds)
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
