/**
 * Unit tests for @agent-core/agent-memory — the file-first memory store.
 *
 * Covers the full pure core: parse/render round-trip, dedupe, update/remove,
 * search, context rendering, atomic writes, human-edit round-trip, daily
 * notes, and consolidation (distill success + reliable fallback).
 * Uses `node:test` with throwaway os.tmpdir() trees only.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, describe } from 'node:test'

import {
  appendDailyNote,
  consolidate,
  loadEntries,
  normalizeEntry,
  parseEntries,
  readDailyNotes,
  removeEntry,
  renderContextText,
  renderEntries,
  saveWithDedupe,
  searchEntries,
  updateEntry,
  writeEntries,
} from '../src/memory.js'
import { resolveMemoryFile } from '../src/paths.js'

const NOW = '2026-08-15T10:00:00.000Z'

function entry(overrides = {}) {
  return normalizeEntry({
    type: 'preference',
    title: 'codeword',
    content: 'The codeword is ALPHA.',
    importance: 4,
    tags: ['secret'],
    source: 'test',
    ...overrides,
  }, NOW)
}

describe('parse/render round-trip', () => {
  test('entries survive a full render→parse cycle with content verbatim', () => {
    const e1 = entry({ title: 'codeword', content: 'The codeword is ALPHA.\n\nSecond paragraph with `code` and #hash and --- inside.' })
    const e2 = entry({ type: 'decision', title: 'Stack', content: 'Use DSH.', importance: 5 })
    const text = renderEntries([e1, e2])
    const parsed = parseEntries(text)
    assert.equal(parsed.length, 2)
    assert.equal(parsed[0].id, e1.id)
    assert.equal(parsed[0].title, 'codeword')
    assert.equal(parsed[0].content, e1.content)
    assert.equal(parsed[0].type, 'preference')
    assert.equal(parsed[0].importance, 4)
    assert.deepEqual(parsed[0].tags, ['secret'])
    assert.equal(parsed[0].source, 'test')
    assert.equal(parsed[0].updatedAt, NOW)
    assert.equal(parsed[1].type, 'decision')
  })

  test('titles are escaped on render and unescaped on parse', () => {
    const e = entry({ title: 'a *b* `c` [d]' })
    const parsed = parseEntries(renderEntries([e]))
    assert.equal(parsed[0].title, 'a *b* `c` [d]')
  })

  test('a body ID line NOT followed by a Type line cannot forge an entry', () => {
    const e = entry({ content: '- **ID**: `fake`\n\nbody' })
    const parsed = parseEntries(renderEntries([e]))
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].id, e.id)
    assert.ok(parsed[0].content.includes('fake'))
  })

  test('empty / missing text parses to no entries', () => {
    assert.deepEqual(parseEntries(''), [])
    assert.deepEqual(parseEntries('# header only'), [])
  })
})

describe('saveWithDedupe / update / remove', () => {
  test('same (type, title) merges; different titles create', () => {
    const e1 = entry({ title: 'codeword', content: 'v1' })
    let { action, entries } = saveWithDedupe([], e1, NOW)
    assert.equal(action, 'created')
    assert.equal(entries.length, 1)
    const e2 = entry({ title: 'codeword', content: 'v2', importance: 5 })
    ;({ action, entries } = saveWithDedupe(entries, e2, NOW))
    assert.equal(action, 'merged')
    assert.equal(entries.length, 1)
    assert.equal(entries[0].content, 'v2')
    assert.equal(entries[0].importance, 5)
    // Same title under a different type is a different entry.
    ;({ action, entries } = saveWithDedupe(entries, entry({ type: 'history', title: 'codeword', content: 'note' }), NOW))
    assert.equal(action, 'created')
    assert.equal(entries.length, 2)
  })

  test('updateEntry patches by id; unknown id is a no-op', () => {
    const e = entry()
    const { entries } = saveWithDedupe([], e, NOW)
    const { entry: updated } = updateEntry(entries, e.id, { content: 'new body' }, NOW)
    assert.equal(updated.content, 'new body')
    assert.equal(updated.id, e.id)
    const noop = updateEntry(entries, 'nope', { content: 'x' }, NOW)
    assert.equal(noop.entry, undefined)
  })

  test('removeEntry deletes by id; unknown id is a no-op', () => {
    const e = entry()
    const { entries } = saveWithDedupe([], e, NOW)
    const { removed, entries: next } = removeEntry(entries, e.id)
    assert.equal(removed, true)
    assert.equal(next.length, 0)
    assert.equal(removeEntry(entries, 'nope').removed, false)
  })

  test('normalizeEntry rejects bad types / empty titles', () => {
    assert.throws(() => normalizeEntry({ type: 'bogus', title: 'x', content: 'y' }), TypeError)
    assert.throws(() => normalizeEntry({ type: 'preference', title: '  ', content: 'y' }), TypeError)
    assert.throws(() => normalizeEntry(null), TypeError)
  })
})

describe('search / render', () => {
  test('searchEntries matches title, content and tags, case-insensitive', () => {
    const entries = [entry({ title: 'codeword', content: 'ALPHA', tags: ['secret'] })]
    assert.equal(searchEntries(entries, 'alpha').length, 1)
    assert.equal(searchEntries(entries, 'secret').length, 1)
    assert.equal(searchEntries(entries, 'codeword').length, 1)
    assert.equal(searchEntries(entries, 'zzz').length, 0)
    assert.equal(searchEntries(entries, '').length, 0)
  })

  test('renderContextText: preferences first, threshold-gated, capped', () => {
    const entries = [
      entry({ type: 'history', title: 'h', content: 'x', importance: 5 }),
      entry({ type: 'preference', title: 'p', content: 'pref' }),
      entry({ type: 'decision', title: 'd', content: 'dec', importance: 2 }),
      entry({ type: 'decision', title: 'd2', content: 'dec2', importance: 4 }),
    ]
    const text = renderContextText(entries, { maxEntries: 10, maxChars: 10000 })
    assert.ok(text.includes('[preference] p'))
    assert.ok(text.includes('[decision] d2'))
    assert.ok(!text.includes('[history]'))
    assert.ok(!text.includes('d (importance 2)')) // below threshold
    assert.ok(text.startsWith('[memory]'))
  })

  test('renderContextText: empty entries render empty; maxChars truncates', () => {
    assert.equal(renderContextText([]), '')
    const entries = [entry({ title: 'long', content: 'x'.repeat(500) })]
    const text = renderContextText(entries, { maxEntries: 5, maxChars: 60 })
    assert.ok(text.length < 200) // capped well below content length
  })
})

describe('file store', () => {
  test('writeEntries is atomic and loadEntries round-trips; missing file = []', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'mem-file-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const file = join(dir, 'MEMORY.md')
    assert.deepEqual(await loadEntries(file), [])
    const e = entry()
    await writeEntries(file, [e])
    const loaded = await loadEntries(file)
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0].title, e.title)
    assert.equal(loaded[0].content, e.content)
    // No tmp litter left behind.
    const { readdir } = await import('node:fs/promises')
    assert.deepEqual(await readdir(dir), ['MEMORY.md'])
  })

  test('human edits win: a manual edit of MEMORY.md is what loadEntries returns', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'mem-human-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const file = join(dir, 'MEMORY.md')
    const e = entry({ title: 'nickname', content: 'old' })
    await writeEntries(file, [e])
    // A human edits the file directly (plain markdown edit of the body).
    const edited = (await readFile(file, 'utf8')).replace('old', 'AlphaUser')
    await writeFile(file, edited, 'utf8')
    const loaded = await loadEntries(file)
    assert.equal(loaded[0].content, 'AlphaUser')
    assert.equal(loaded[0].id, e.id) // id preserved → machine can still update
  })

  test('daily notes append and read back', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'mem-daily-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const ws = join(dir, 'ws')
    const d1 = new Date('2026-08-15T10:00:00Z')
    const d2 = new Date('2026-08-16T10:00:00Z')
    const f1 = await appendDailyNote(ws, 'evidence one', d1)
    const f2 = await appendDailyNote(ws, 'evidence two', d2)
    assert.ok(f1.endsWith('memory/2026-08-15.md'))
    assert.ok(f2.endsWith('memory/2026-08-16.md'))
    const notes = await readDailyNotes(ws, { days: 3, now: d2 })
    assert.equal(notes.length, 2)
    assert.ok(notes[0].text.includes('evidence one'))
    assert.ok(notes[1].text.includes('evidence two'))
    // Empty text is a no-op.
    assert.equal(await appendDailyNote(ws, '   ', d1), undefined)
  })
})

describe('consolidate', () => {
  test('success: distill output is validated, deduped and written to MEMORY.md', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'mem-cons-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const ws = join(dir, 'ws')
    const file = resolveMemoryFile(ws)
    const distill = async () => [
      { type: 'preference', title: 'birthday', content: 'birthday is 1990-01-01', importance: 4 },
      { type: 'bogus', title: 'bad', content: 'never lands' },
    ]
    const result = await consolidate({ workspace: ws, evidence: 'user: my birthday is 1990-01-01', distill, now: new Date(NOW) })
    assert.equal(result.saved.length, 1)
    assert.equal(result.fallback, false)
    assert.equal(result.saved[0].title, 'birthday')
    const loaded = await loadEntries(file)
    assert.equal(loaded.length, 1)
    // Raw evidence always lands in the daily note (audit trail).
    const notes = await readDailyNotes(ws, { now: new Date(NOW) })
    assert.equal(notes.length, 1)
    assert.ok(notes[0].text.includes('my birthday is 1990-01-01'))
  })

  test('fallback: distill failure keeps raw evidence in the daily note, MEMORY.md untouched', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'mem-fb-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const ws = join(dir, 'ws')
    const file = resolveMemoryFile(ws)
    const distill = async () => { throw new Error('llm down') }
    const result = await consolidate({ workspace: ws, evidence: 'user: important fact', distill, now: new Date(NOW) })
    assert.equal(result.saved.length, 0)
    assert.equal(result.fallback, true)
    assert.ok(result.fallbackFile.endsWith('memory/2026-08-15.md'))
    assert.deepEqual(await loadEntries(file), [])
    const notes = await readDailyNotes(ws, { now: new Date(NOW) })
    assert.ok(notes[0].text.includes('important fact'))
  })

  test('fallback: no distill function at all still preserves evidence', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'mem-nodist-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const ws = join(dir, 'ws')
    const result = await consolidate({ workspace: ws, evidence: 'user: fact', distill: undefined, now: new Date(NOW) })
    assert.equal(result.saved.length, 0)
    assert.equal(result.fallback, true)
  })

  test('empty evidence is a no-op (no daily note either)', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'mem-empty-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const ws = join(dir, 'ws')
    const result = await consolidate({ workspace: ws, evidence: '   ', distill: async () => [], now: new Date(NOW) })
    assert.equal(result.saved.length, 0)
    assert.equal(result.fallbackFile, undefined)
  })

  test('dedupe across consolidations: same title merges, does not duplicate', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'mem-dedupe-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const ws = join(dir, 'ws')
    const file = resolveMemoryFile(ws)
    const distill = async () => [{ type: 'preference', title: 'birthday', content: 'birthday is 1990-01-01', importance: 4 }]
    await consolidate({ workspace: ws, evidence: 'e1', distill, now: new Date(NOW) })
    const result = await consolidate({ workspace: ws, evidence: 'e2', distill, now: new Date(NOW) })
    assert.equal(result.saved.length, 1)
    assert.equal((await loadEntries(file)).length, 1)
  })
})
