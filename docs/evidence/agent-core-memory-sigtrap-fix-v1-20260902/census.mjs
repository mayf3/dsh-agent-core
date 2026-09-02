/**
 * SIGTRAP fix v1 — READ-ONLY census over ISOLATED COPIES of corrupted
 * MEMORY.md files. Never touches production. Measures, per file:
 *   - entry count, per-entry field sizes (title/content/tags/source as stored)
 *   - escape-amplification layer count per source/title (canonical-unwrap)
 *   - recovery candidates + ambiguity flags under the planned migration rule
 *   - headroom check for the proposed guard limits
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const WORKTREE = '/Users/yanfenma/workspace/project/dsh-agent-core-sigtrap-v1'
const { parseEntries } = await import(`${WORKTREE}/packages/agent-memory/src/memory.js`)

// Same charset as memory.js ESCAPE (single source of truth: the regex source).
const ESCAPE = /([\\`*_[\]{}()#+.!|>~-])/g
const UNESCAPE = new RegExp('\\\\' + ESCAPE.source, 'g')
const esc = (t) => String(t).replace(ESCAPE, '\\$1')
const unescape = (t) => String(t).replace(UNESCAPE, '$1')
// x is escape-canonical iff esc(unescape(x)) === x (esc is a left inverse of
// unescape exactly on the image of esc).
const isCanonical = (x) => esc(unescape(x)) === x

// Guard limit candidates (mirrors the planned PRODUCTION_LIMITS).
const LIMITS = { field: 8192, content: 65536, file: 33554432 }

const files = ['hr', 'efficiency', 'shopping', 'ceo'].map((n) => `${n}-MEMORY.md`)
const report = {}

for (const name of files) {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'corpus', name)
  const buf = readFileSync(path)
  const text = buf.toString('utf8')
  const t0 = Date.now()
  const entries = parseEntries(text)
  const parseMs = Date.now() - t0

  let maxSourceRaw = 0, maxTitleRaw = 0, maxContent = 0, maxTags = 0
  let sourcesWithLayers = 0, maxLayers = 0
  let oversizedUnderGuard = { source: 0, title: 0, content: 0 }
  let ambiguous = 0
  const largest = []
  const layerHist = new Map()

  for (const e of entries) {
    const src = String(e.source ?? '')
    const title = String(e.title ?? '')
    maxSourceRaw = Math.max(maxSourceRaw, src.length)
    maxTitleRaw = Math.max(maxTitleRaw, title.length)
    maxContent = Math.max(maxContent, String(e.content ?? '').length)
    maxTags = Math.max(maxTags, (e.tags ?? []).length)
    if (src.length > LIMITS.source ?? LIMITS.field) oversizedUnderGuard.source++
    if (title.length > LIMITS.field) oversizedUnderGuard.title++
    if (String(e.content ?? '').length > LIMITS.content) oversizedUnderGuard.content++

    // Recovery: unwrap while escape-canonical, bounded.
    let x = src, layers = 0, stoppedBy = 'non-canonical'
    if (x.length > 0) {
      while (isCanonical(x)) {
        const next = unescape(x)
        if (next === x) { stoppedBy = 'fixpoint'; break }
        x = next; layers++
        if (layers > 64) { stoppedBy = 'max-layers'; ambiguous++; break }
      }
    }
    // Over-unwrap check: if the recovered candidate is itself canonical, the
    // true original layer count is ambiguous from the line alone.
    if (stoppedBy !== 'max-layers' && x.length > 0 && isCanonical(x)) ambiguous++
    if (stoppedBy === 'non-canonical' && layers > 0 && !isCanonical(x)) { /* unique recovery */ }
    if (layers > 0) sourcesWithLayers++
    maxLayers = Math.max(maxLayers, layers)
    layerHist.set(layers, (layerHist.get(layers) ?? 0) + 1)
    largest.push({ id: e.id, srcLen: src.length, layers, recovered: x.length, stoppedBy, head: src.slice(0, 48), recoveredHead: x.slice(0, 48) })
  }
  largest.sort((a, b) => b.srcLen - a.srcLen)

  report[name] = {
    bytes: buf.length, chars: text.length, entries: entries.length, parseMs,
    maxSourceRaw, maxTitleRaw, maxContent, maxTags,
    sourcesWithLayers, maxLayers, ambiguousCount: ambiguous,
    layerHist: Object.fromEntries([...layerHist.entries()].sort((a, b) => a[0] - b[0]).slice(0, 12)),
    oversizedUnderGuard,
    top5: largest.slice(0, 5),
  }
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), `census-${name}.json`), JSON.stringify({ ...report[name], allTop50: largest.slice(0, 50) }, null, 1))
}

console.log(JSON.stringify(report, null, 1))
