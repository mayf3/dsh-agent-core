/** Owned synthetic benchmark; never reads production data or purges OS caches. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { cpus, platform, arch, release, tmpdir, totalmem } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createHistorySearch } from '../../src/history.js'
import { resolveMemoryBinding } from '../../src/inspect.js'
import { normalizeEntry, renderEntries } from '../../src/memory.js'

const NOW = '2026-10-31T12:00:00.000Z'
const ARCHIVE = 'MEMORY.md.bloated-20261022'
const ARCHIVE_BYTES = 2_112_509
const ARCHIVE_ENTRIES = 5_337
const DAILY_BYTES = 329_725
const ARCHIVE_NEEDLE = 'synthetic archive unique observation 1248'
const DAILY_NEEDLE = 'synthetic daily unique observation 1248'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const rounded = value => Math.round(value * 1000) / 1000

function structuredEntry(id, content) {
  return normalizeEntry({ id, type: 'decision', title: `Synthetic ${id}`,
    content, importance: 4, tags: ['synthetic'], source: 'owned benchmark' }, NOW)
}

function archiveBytes() {
  const entries = Array.from({ length: ARCHIVE_ENTRIES }, (_, i) =>
    structuredEntry(`archive-${String(i).padStart(4, '0')}`,
      i === ARCHIVE_ENTRIES - 1 ? ARCHIVE_NEEDLE : `Synthetic archived observation ${i}.`))
  const baseline = Buffer.byteLength(renderEntries(entries))
  assert.ok(baseline <= ARCHIVE_BYTES, 'archive scaffolding must fit the target')
  const padding = ARCHIVE_BYTES - baseline
  for (let i = 0; i < entries.length; i++) {
    entries[i].content += 'x'.repeat(Math.floor(padding / entries.length) + (i < padding % entries.length ? 1 : 0))
  }
  const bytes = Buffer.from(renderEntries(entries))
  assert.equal(bytes.length, ARCHIVE_BYTES)
  return bytes
}

function dailyBytes(date) {
  const paragraphs = Array.from({ length: 200 }, (_, i) =>
    i === 199 ? `${date} ${DAILY_NEEDLE}` : `${date} synthetic event ${i}. `)
  const baseline = Buffer.byteLength(paragraphs.join('\n\n') + '\n')
  const padding = DAILY_BYTES - baseline
  for (let i = 0; i < paragraphs.length; i++) {
    paragraphs[i] += 'y'.repeat(Math.floor(padding / paragraphs.length) + (i < padding % paragraphs.length ? 1 : 0))
  }
  const bytes = Buffer.from(paragraphs.join('\n\n') + '\n')
  assert.equal(bytes.length, DAILY_BYTES)
  return bytes
}

function summarize(samples) {
  const values = samples.map(s => s.elapsedMs).sort((a, b) => a - b)
  const percentile = p => values[Math.ceil(values.length * p) - 1]
  return {
    samples: samples.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95),
    minMs: values[0], maxMs: values.at(-1),
    bytesRead: [...new Set(samples.map(s => s.bytesRead))],
    partialRate: samples.filter(s => s.status === 'PARTIAL').length / samples.length,
    completeRate: samples.filter(s => s.status === 'COMPLETE' && s.exhausted).length / samples.length,
    allCompleteUnder1s: samples.every(s => s.status === 'COMPLETE' && s.exhausted && s.elapsedMs < 1000),
    observations: samples,
  }
}

async function measure(search, query, expectedHits, label) {
  const start = performance.now()
  // Omit sources, dates, and scanBudget to exercise the complete default corpus.
  const result = await search({ query, limit: 50 })
  const elapsedMs = rounded(performance.now() - start)
  const observation = { label, elapsedMs, status: result.status,
    exhausted: result.exhausted, bytesRead: result.coverage.bytesRead,
    filesPlanned: result.coverage.filesPlanned, filesVerified: result.coverage.filesVerified,
    hits: result.items.length, reasons: result.coverage.reasons,
    unsearchedReasons: result.coverage.unsearchedSources.map(s => s.reason) }
  if (result.status === 'COMPLETE' && result.exhausted) {
    assert.equal(result.items.length, expectedHits, 'complete search must find every synthetic source hit')
    assert.equal(result.nextCursor, null)
  }
  return observation
}

const root = await mkdtemp(join(tmpdir(), 'agent-memory-history-benchmark-'))
try {
  await mkdir(join(root, 'memory'))
  const archive = archiveBytes()
  const corpus = [
    { relativePath: 'MEMORY.md', bytes: Buffer.from(renderEntries([structuredEntry('core', 'Synthetic current decision.')])), entries: 1 },
    { relativePath: ARCHIVE, bytes: archive, entries: ARCHIVE_ENTRIES },
  ]
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.parse(NOW) - i * 86400000).toISOString().slice(0, 10)
    corpus.push({ relativePath: `memory/${date}.md`, bytes: dailyBytes(date), paragraphs: 200 })
  }
  const manifest = Buffer.from(JSON.stringify({ schema: 'AGENT_MEMORY_HISTORY_MANIFEST_V1',
    archives: [{ relativePath: ARCHIVE, sha256: sha256(archive), bytes: archive.length }] }))
  corpus.push({ relativePath: 'memory/history-manifest.json', bytes: manifest })
  for (const source of corpus) await writeFile(join(root, source.relativePath), source.bytes)
  const binding = await resolveMemoryBinding({ agentId: 'owned-synthetic-benchmark', primaryWorkspace: root })
  assert.equal(binding.status, 'COMPLETE')
  const makeSearch = () => createHistorySearch({ binding, now: () => new Date(NOW) })
  const scenarios = []
  for (const [name, query, expectedHits] of [
    ['archive-only-phrase', ARCHIVE_NEEDLE, 1], ['daily-phrase', DAILY_NEEDLE, 7],
  ]) {
    const fresh = []
    for (let i = 0; i < 10; i++) {
      fresh.push(await measure(makeSearch(), query, expectedHits,
        i === 0 ? 'first-read-for-scenario; no OS cache purge' : `fresh-factory-${i + 1}`))
    }
    const warmedSearch = makeSearch()
    const warmup = await measure(warmedSearch, query, expectedHits, 'unmeasured-factory-warmup')
    const warmed = []
    for (let i = 0; i < 10; i++) warmed.push(await measure(warmedSearch, query, expectedHits, `warmed-${i + 1}`))
    scenarios.push({ name, query, expectedHits, freshFactory: summarize(fresh), warmed: summarize(warmed), warmup })
  }
  for (const source of corpus) {
    assert.equal(sha256(await readFile(join(root, source.relativePath))), sha256(source.bytes), 'queries must preserve corpus bytes')
  }
  const report = {
    schema: 'AGENT_MEMORY_HISTORY_SYNTHETIC_BENCHMARK_V1', observedAt: new Date().toISOString(),
    environment: { cpu: cpus()[0]?.model ?? null, logicalCpus: cpus().length,
      ramBytes: totalmem(), platform: platform(), arch: arch(), osRelease: release(), node: process.version },
    methodology: { syntheticOnly: true, fixedQueryDate: NOW, queriesPerScenario: { freshFactory: 10, warmed: 10, warmup: 1 },
      cacheState: 'Files were just written. First-read labels describe first API queries only; OS caches were not purged, so no true disk-cold claim.',
      factoryState: 'Every fresh sample constructs a new search factory; warmed samples reuse one factory. Source snapshots are reverified by the API.',
      defaultBudget: { bytes: 8 * 1024 * 1024, files: 32, ms: 1000 }, limit: 50,
      percentileMethod: 'nearest rank', maxRssUnit: 'KiB as reported by process.resourceUsage()' },
    corpus: { sources: corpus.map(({ relativePath, bytes, ...rest }) => ({ relativePath, bytes: bytes.length, sha256: sha256(bytes), ...rest })),
      searchedBytes: corpus.filter(s => s.relativePath !== 'memory/history-manifest.json').reduce((n, s) => n + s.bytes.length, 0),
      totalBytesIncludingManifest: corpus.reduce((n, s) => n + s.bytes.length, 0), unchangedAfterQueries: true },
    scenarios, processResourceUsage: process.resourceUsage(),
    allDefaultQueriesCompleteUnder1s: scenarios.every(s => s.freshFactory.allCompleteUnder1s && s.warmed.allCompleteUnder1s),
  }
  console.log(JSON.stringify(report, null, 2))
} finally {
  // This is the only cleanup target; it was created by this process above.
  await rm(root, { recursive: true, force: true })
}
