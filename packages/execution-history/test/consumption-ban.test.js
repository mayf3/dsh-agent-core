/**
 * T7 — §4.5 consumption ban, asserted structurally: packages/execution-history
 * is a rebuildable READ VIEW; no production execution path may import it.
 * Lawful importers (frozen list): the broker manifest aggregation, the
 * production-runtime provider, and the compose wiring.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const LAWFUL_IMPORTERS = new Set([
  'packages/production-runtime/src/compose.js',
  'packages/production-runtime/src/execution-history/runtime.js',
  'packages/broker/src/capabilities/manifests.js',
])
const FORBIDDEN_PREFIXES = [
  'packages/scheduler/src/',
  'packages/agent-router/src/',
  'packages/workflow-execution/src/',
  'packages/notification-ingress/src/',
  'packages/broker/src/gateway.js',
  'packages/broker/src/relay.js',
]

function* walkJs(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      yield* walkJs(full)
    } else if (entry.isFile() && /\.m?js$/.test(entry.name)) {
      yield full
    }
  }
}

test('T7: no production execution path imports the execution-history read view (§4.5)', () => {
  const violations = []
  const packagesDir = join(repoRoot, 'packages')
  for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!pkg.isDirectory() || pkg.name === 'execution-history') continue
    const srcDir = join(packagesDir, pkg.name, 'src')
    try { if (!statSync(srcDir).isDirectory()) continue } catch { continue }
    for (const file of walkJs(srcDir)) {
      const rel = file.slice(repoRoot.length + 1).replaceAll('\\', '/')
      const text = readFileSync(file, 'utf8')
      if (!/execution-history/.test(text)) continue
      if (LAWFUL_IMPORTERS.has(rel)) continue
      // Mentions outside import statements (comments in unrelated files) are
      // only a violation when they resolve as a module specifier.
      if (/from\s+'[^']*execution-history[^']*'|import\(\s*'[^']*execution-history/.test(text)) {
        violations.push(rel)
      }
    }
  }
  assert.deepEqual(violations, [], `execution-history imported from unlawful production paths: ${violations.join(', ')}`)
})

test('T7: the lawful importer set is exactly the wiring surface (no drift)', () => {
  const found = new Set()
  const srcRoot = join(repoRoot, 'packages')
  for (const pkg of readdirSync(srcRoot, { withFileTypes: true })) {
    if (!pkg.isDirectory() || pkg.name === 'execution-history') continue
    const srcDir = join(srcRoot, pkg.name, 'src')
    try { if (!statSync(srcDir).isDirectory()) continue } catch { continue }
    for (const file of walkJs(srcDir)) {
      const text = readFileSync(file, 'utf8')
      if (/from\s+'[^']*execution-history[^']*'|import\(\s*'[^']*execution-history/.test(text)) {
        found.add(file.slice(repoRoot.length + 1).replaceAll('\\', '/'))
      }
    }
  }
  assert.deepEqual([...found].sort(), [...LAWFUL_IMPORTERS].sort())
})

test('T7: forbidden execution paths are structurally clean even if refactored later', () => {
  for (const prefix of FORBIDDEN_PREFIXES) {
    const target = join(repoRoot, prefix)
    let text = ''
    try { text = readFileSync(target, 'utf8') } catch { continue }
    assert.doesNotMatch(text, /execution-history/, `${prefix} must never import the read view`)
  }
})
