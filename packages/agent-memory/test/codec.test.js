/**
 * SOURCE codec contract tests (SIGTRAP fix v1).
 *
 * Freezes: parse(render(entry)) === entry (including source), render/parse
 * byte fixpoints, mixed-source coverage, backward compatibility with files
 * written by the historical asymmetric codec (stable, non-growing), and
 * repeated write stability (100 cycles, zero growth).
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, describe } from 'node:test'

import {
  loadEntries,
  normalizeEntry,
  parseEntries,
  renderEntries,
  renderEntry,
  saveWithDedupe,
  writeEntries,
} from '../src/memory.js'

const NOW = '2026-09-02T00:00:00.000Z'

// The historical asymmetric codec (source escaped on render, never decoded
// on parse) — the exact pre-fix semantics, for building legacy fixtures.
const ESCAPE = /([\\`*_[\]{}()#+.!|>~-])/g
const oldEsc = (t) => String(t).replace(ESCAPE, '\\$1')

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

describe('source codec contract (SIGTRAP fix v1)', () => {
  const ESCAPE_CHARS = '\\`*_[]{}()#+.!|>~-'

  test('every ESCAPE-set character round-trips in source', () => {
    const source = [...ESCAPE_CHARS].map((c, i) => `x${i}${c}y`).join('')
    const e = entry({ source })
    const parsed = parseEntries(renderEntries([e]))
    assert.equal(parsed[0].source, source)
  })

  test('parse(render(entry)) is exact for title, tags, source and content', () => {
    const e = entry({
      title: 't *i* `c` [b] {p} (q) #h +1 .5 !x |y| >r ~z -d \\e',
      tags: ['a*b', 'c\\d', '中文-标签'],
      source: 'session 2026-08-24 (调研) v1.0 \\path',
      content: 'body with `code`, --- line, and **md**\nsecond line',
    })
    const parsed = parseEntries(renderEntries([e]))
    assert.deepEqual(parsed[0], { ...e, id: e.id })
  })

  test('render(parse(render(e))) === render(e) byte fixpoint', () => {
    const e = entry({ source: 'consolidation:session:cron-run-occ:47081' })
    const once = renderEntries([e])
    const twice = renderEntries(parseEntries(once))
    const thrice = renderEntries(parseEntries(twice))
    assert.equal(twice, once)
    assert.equal(thrice, twice)
  })

  test('mixed sources: normal, path, URL, literal backslash, repeated backslash, markdown, unicode, empty', () => {
    const sources = [
      'plain text',
      'C:\\Users\\yanfenma\\notes',
      'https://example.com/a?b=c#frag',
      '\\',
      '\\\\\\',
      '**bold** _under_ `tick`',
      '中文来源：京东购物车 2026-08-24 🛒',
      '',
    ]
    for (const source of sources) {
      const stored = renderEntry({ ...entry(), source })
      assert.equal(parseEntries(stored)[0].source, source, JSON.stringify(source))
    }
  })

  test('legacy one-layer files (historical codec) parse back to the original source', () => {
    // A file written ONCE by the historical codec stores esc(source); the
    // fixed parser decodes exactly that layer.
    const source = 'session 2026-08-24 床笠调研'
    const legacyStored = oldEsc(source)
    const legacyDoc = `## t\n\n- **ID**: \`id-1\`\n- **Type**: preference\n- **Importance**: 3\n- **Tags**: \`\`\n- **Updated**: ${NOW}\n- **Source**: ${legacyStored}\n\nbody\n\n---\n`
    assert.equal(parseEntries(legacyDoc)[0].source, source)
  })

  test('legacy amplified sources are STABLE under the fixed codec (no growth per write cycle)', () => {
    // A pre-fix file carries esc^k(source); with the fix, read→write keeps
    // the stored value byte-identical (decode one layer, re-encode one layer)
    // — the amplification loop is broken even before migration.
    const source = 'consolidation:session:x-1'
    let stored = source
    for (let i = 0; i < 6; i++) stored = oldEsc(stored) // k = 6 layers
    let doc = `## t\n\n- **ID**: \`id-1\`\n- **Type**: preference\n- **Importance**: 3\n- **Tags**: \`\`\n- **Updated**: ${NOW}\n- **Source**: ${stored}\n\nbody\n\n---\n`
    const first = parseEntries(doc)
    // Exact: one read decodes EXACTLY one amplification layer.
    const UNESCAPE = new RegExp('\\\\' + ESCAPE.source, 'g')
    const expectedAfterOneRead = stored.replace(UNESCAPE, '$1')
    assert.equal(first[0].source, expectedAfterOneRead)
    for (let cycle = 0; cycle < 5; cycle++) {
      const parsed = parseEntries(doc)
      doc = renderEntries(parsed)
    }
    // After any number of fixed-codec cycles the stored source length is
    // IDENTICAL to the initial legacy value (zero growth).
    assert.ok(doc.includes(`- **Source**: ${stored}\n`), 'stored source line byte-identical across cycles (zero growth)')
  })

  test('repeated write stability 100x: SOURCE_LENGTH_GROWTH = 0, byte-identical document', () => {
    const nasty = [
      entry({ title: 'a', source: 'consolidation:session:cron-run-occ:47081' }),
      entry({ title: 'b', source: 'C:\\temp\\*wildcard* file (v1.2)#3' }),
      entry({ title: 'c', source: '中文 🛒 ~~strike~~ > quote #tag' }),
      entry({ title: 'd', source: 'x'.repeat(4000) }),
    ]
    let doc = renderEntries(nasty)
    let parsed = parseEntries(doc)
    const sourceLens = parsed.map((e) => e.source.length)
    for (let i = 0; i < 100; i++) {
      parsed = parseEntries(doc)
      doc = renderEntries(parsed)
      assert.deepEqual(parsed.map((e) => e.source.length), sourceLens, `cycle ${i}: source length changed`)
    }
    // Byte-stable from the first cycle: the very first render is the fixpoint.
    assert.equal(renderEntries(parseEntries(doc)), doc)
  })

  test('repeated disk write/read stability 100x (writeEntries + loadEntries)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-stability-'))
    try {
      const file = join(dir, 'MEMORY.md')
      const base = [
        entry({ title: 'disk-a', source: 'consolidation:session:x-1', content: 'body `x` ---\nline2' }),
        entry({ type: 'decision', title: 'disk-b', source: 'tool (v1.0)', tags: ['t*g'] }),
      ]
      let lastBytes = ''
      for (let i = 0; i < 100; i++) {
        const entries = await loadEntries(file) // ENOENT → [] on first cycle
        const merged = saveWithDedupe(entries.length ? entries : base, {
          type: 'preference', title: 'disk-a', content: 'body `x` ---\nline2', source: 'consolidation:session:x-1',
        }, NOW)
        await writeEntries(file, merged.entries)
        const bytes = await readFile(file, 'utf8')
        if (lastBytes !== '') assert.equal(bytes, lastBytes, `cycle ${i}: file drifted`)
        lastBytes = bytes
      }
      const parsed = await loadEntries(file)
      assert.equal(parsed[0].source, 'consolidation:session:x-1')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
