/**
 * MEMORY guard tests (SIGTRAP fix v1): bounded validation BEFORE any
 * String.replace / IO. FAIL_LOUD_BUT_NON_FATAL — a MemoryGuardError must
 * leave the original file untouched, produce no tmp residue, and be
 * catchable at every runtime call site (injection → '', consolidation →
 * daily-note fallback, tools → error response; the agent turn survives).
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, describe } from 'node:test'

import {
  loadEntries,
  loadEntriesSync,
  MEMORY_GUARD_LIMITS,
  MemoryGuardError,
  normalizeEntry,
  parseEntries,
  renderEntries,
  renderEntry,
  writeEntries,
  consolidate,
} from '../src/memory.js'

const NOW = '2026-09-02T00:00:00.000Z'

function entry(overrides = {}) {
  return normalizeEntry({
    type: 'preference',
    title: 'codeword',
    content: 'body',
    importance: 4,
    tags: ['t'],
    source: 'test',
    ...overrides,
  }, NOW)
}

function guardError(fn) {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof MemoryGuardError, `expected MemoryGuardError, got ${error?.constructor?.name}: ${error}`)
    assert.equal(error.code, 'MEMORY_GUARD_LIMIT')
    return error
  }
  assert.fail('expected a MemoryGuardError')
}

async function guardErrorAsync(fn) {
  try {
    await fn()
  } catch (error) {
    assert.ok(error instanceof MemoryGuardError, `expected MemoryGuardError, got ${error?.constructor?.name}: ${error}`)
    assert.equal(error.code, 'MEMORY_GUARD_LIMIT')
    return error
  }
  assert.fail('expected a MemoryGuardError')
}

describe('memory guard: bounds precede every String.replace', () => {
  test('oversized source field refuses render (before replace)', () => {
    const err = guardError(() => renderEntry(entry({ source: 's'.repeat(MEMORY_GUARD_LIMITS.maxFieldChars + 1) })))
    assert.equal(err.which, 'escaped field')
  })

  test('oversized title field refuses render', () => {
    const err = guardError(() => renderEntry(entry({ title: 't'.repeat(MEMORY_GUARD_LIMITS.maxFieldChars + 1) })))
    assert.equal(err.which, 'escaped field')
  })

  test('oversized content refuses render (no escaping involved, still bounded)', () => {
    const err = guardError(() => renderEntry(entry({ content: 'c'.repeat(MEMORY_GUARD_LIMITS.maxContentChars + 1) })))
    assert.equal(err.which, 'content')
  })

  test('too many tags refuse render', () => {
    const tags = Array.from({ length: MEMORY_GUARD_LIMITS.maxTagCount + 1 }, (_, i) => `t${i}`)
    const err = guardError(() => renderEntry(entry({ tags })))
    assert.equal(err.which, 'tag count')
  })

  test('oversized document bound refuses renderEntries before any per-entry work', () => {
    const fat = Array.from({ length: 600 }, (_, i) => entry({ title: `t${i}`, content: 'c'.repeat(MEMORY_GUARD_LIMITS.maxContentChars) }))
    const err = guardError(() => renderEntries(fat))
    assert.equal(err.which, 'rendered document')
  })

  test('oversized parse-side field (decoded) refuses parseEntries', () => {
    const doc = `## t\n\n- **ID**: \`x\`\n- **Type**: preference\n- **Importance**: 3\n- **Tags**: \`\`\n- **Updated**: ${NOW}\n- **Source**: ${'s'.repeat(MEMORY_GUARD_LIMITS.maxFieldChars + 1)}\n\nbody\n\n---\n\n`
    const err = guardError(() => parseEntries(doc))
    assert.equal(err.which, 'decoded field')
  })

  test('writeEntries: guard fires before ANY byte is written; original untouched; no tmp residue', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-guard-'))
    try {
      const file = join(dir, 'MEMORY.md')
      const original = '# MEMORY.md — long-term memory (file-first)\n\ntiny\n'
      await writeFile(file, original)
      await assert.rejects(
        () => writeEntries(file, [entry({ source: 's'.repeat(MEMORY_GUARD_LIMITS.maxFieldChars + 1) })]),
        MemoryGuardError,
      )
      assert.equal(await readFile(file, 'utf8'), original)
      assert.deepEqual(await readdir(dir), ['MEMORY.md'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('loadEntries refuses an oversized file BEFORE reading/parsing it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-guard-'))
    try {
      const file = join(dir, 'MEMORY.md')
      await writeFile(file, 'x'.repeat(MEMORY_GUARD_LIMITS.maxFileBytes + 1))
      const err = await guardErrorAsync(() => loadEntries(file))
      assert.equal(err.which, 'memory file')
      const errSync = guardError(() => loadEntriesSync(file))
      assert.equal(errSync.which, 'memory file')
      assert.equal((await stat(file)).size, MEMORY_GUARD_LIMITS.maxFileBytes + 1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('corrupted-but-under-file-bound file refuses at the decoded-field guard', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-guard-'))
    try {
      const file = join(dir, 'MEMORY.md')
      const doc = `## t\n\n- **ID**: \`x\`\n- **Type**: preference\n- **Importance**: 3\n- **Tags**: \`\`\n- **Updated**: ${NOW}\n- **Source**: ${'\\s'.repeat(6000)}\n\nbody\n\n---\n\n`
      await writeFile(file, doc)
      const err = await guardErrorAsync(() => loadEntries(file))
      assert.equal(err.which, 'decoded field')
      assert.throws(() => loadEntriesSync(file), MemoryGuardError)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('consolidate() fails loud but non-fatal: daily note kept, MEMORY.md untouched, turn outcome preserved', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-guard-'))
    try {
      const workspace = join(dir, 'ws')
      const file = join(workspace, 'MEMORY.md')
      await mkdir(workspace, { recursive: true })
      const original = `## t\n\n- **ID**: \`x\`\n- **Type**: preference\n- **Importance**: 3\n- **Tags**: \`\`\n- **Updated**: ${NOW}\n- **Source**: ${'\\s'.repeat(6000)}\n\nbody\n\n---\n\n`
      await writeFile(file, original)
      const warnings = []
      await assert.rejects(
        () => consolidate({
          workspace,
          memoryFile: file,
          evidence: 'user: hello\nassistant: hi',
          distill: async () => [{ type: 'preference', title: 'n', content: 'c' }],
          logger: { warn: (m) => warnings.push(m) },
          now: new Date(NOW),
        }),
        MemoryGuardError,
      )
      // Evidence was preserved in the episodic layer BEFORE the guard tripped.
      const daily = await readFile(join(workspace, 'memory', `${NOW.slice(0, 10)}.md`), 'utf8')
      assert.match(daily, /hello/)
      // The corrupted MEMORY.md was NOT mutated (it stays frozen for migration).
      assert.equal(await readFile(file, 'utf8'), original)
      const residue = (await readdir(workspace, { recursive: true })).filter((p) => p.includes('.tmp-'))
      assert.deepEqual(residue, [])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('system-prompt injection pattern: loadEntriesSync throw degrades to an empty block', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-guard-'))
    try {
      const file = join(dir, 'MEMORY.md')
      await writeFile(file, 'x'.repeat(MEMORY_GUARD_LIMITS.maxFileBytes + 1))
      let injected = 'SENTINEL-NOT-REACHED'
      try {
        injected = renderEntries(loadEntriesSync(file))
      } catch (error) {
        injected = '' // the plugin's exact catch-and-degrade shape
      }
      assert.equal(injected, '')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
