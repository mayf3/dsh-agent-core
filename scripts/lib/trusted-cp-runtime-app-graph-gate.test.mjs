// RUNTIME_APP_GRAPH_GATE_V1 — hermetic unit + fixture tests.
//
// RED/GREEN contract (agent-control#193 Defect A, Product #414):
//  - GREEN: an app closure whose production-runtime entry graph resolves every
//    specifier imports cleanly; the gate reports ok with the ready marker.
//  - RED:   the exact #193 production failure shape — the entry graph hits a
//    missing transitive package (proxy-agent-negotiate class) — is classified
//    as ERR_MODULE_NOT_FOUND with the failing spec + origin; non-resolution
//    import errors and never-settling imports fail closed too.
//
// The hermetic fixtures stub the app closure with a minimal entry that imports
// the same missing-package surface. The REAL whole-graph integration (the
// packed app closure incl. @larksuite/channel → https-proxy-agent →
// proxy-agent-negotiate) runs at installer §3b / executor G2.6 and in the
// packet's fresh-pack RED/GREEN evidence; set DSH_B7_GATE_APP_GRAPH_UNDER_TEST
// to a candidate APP DIR to run the live seam here (skipped by default).

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGate } from './trusted-cp-runtime-app-graph-gate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = join(HERE, 'trusted-cp-runtime-app-graph-gate.mjs')

function scratch() {
  return mkdtempSync(join(tmpdir(), 'dsh-app-graph-gate-test-'))
}

/**
 * Stub app closure: entry imports `proxy-agent-negotiate` — the exact missing
 * package of the #193 production FATAL. `withDep` materializes the vendored
 * copy at app/node_modules (the §3 FIX A position).
 */
function stubApp(root, { withDep, entryBody }) {
  const app = join(root, 'app')
  const entryDir = join(app, 'packages/production-runtime/src')
  mkdirSync(entryDir, { recursive: true })
  writeFileSync(join(entryDir, 'entry.js'), entryBody
    ?? (withDep
      ? "import 'proxy-agent-negotiate'\nexport {}\n"
      : "import 'proxy-agent-negotiate'\nexport {}\n"))
  if (withDep) {
    const dep = join(app, 'node_modules/proxy-agent-negotiate')
    mkdirSync(dep, { recursive: true })
    writeFileSync(join(dep, 'package.json'), JSON.stringify({ name: 'proxy-agent-negotiate', version: '1.1.0', type: 'module', main: 'index.js' }))
    writeFileSync(join(dep, 'index.js'), 'export const negotiate = () => true\n')
  }
  return app
}

describe('RUNTIME_APP_GRAPH_GATE_V1 hermetic fixtures', () => {
  test('GREEN: entry graph with the vendored dep present imports cleanly', async () => {
    const root = scratch()
    try {
      const app = stubApp(root, { withDep: true })
      const result = await runGate({ appDir: app, node: process.execPath, timeoutMs: 30000 })
      assert.equal(result.ok, true)
      assert.equal(result.importSettled, true)
      assert.equal(result.timedOut, false)
      assert.deepEqual(result.missingPackages, [])
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: missing transitive dep reproduces the #193 class with spec+origin classified', async () => {
    const root = scratch()
    try {
      const app = stubApp(root, { withDep: false })
      const result = await runGate({ appDir: app, node: process.execPath, timeoutMs: 30000 })
      assert.equal(result.ok, false)
      assert.equal(result.importSettled, false)
      assert.equal(result.missingPackages.length, 1)
      assert.equal(result.missingPackages[0].spec, 'proxy-agent-negotiate')
      assert.match(result.missingPackages[0].origin, /entry\.js$/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: a non-resolution import error fails closed with the reason in tail', async () => {
    const root = scratch()
    try {
      const app = stubApp(root, { withDep: true, entryBody: "throw new Error('compose-time boom')\n" })
      const result = await runGate({ appDir: app, node: process.execPath, timeoutMs: 30000 })
      assert.equal(result.ok, false)
      assert.equal(result.importSettled, false)
      assert.deepEqual(result.missingPackages, [])
      assert.ok(result.tail.join('\n').includes('compose-time boom'))
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: an import that never settles hits the timeout and fails closed', async () => {
    const root = scratch()
    try {
      const app = stubApp(root, { withDep: true, entryBody: "setInterval(() => {}, 1000)\nawait new Promise(() => {})\n" })
      const result = await runGate({ appDir: app, node: process.execPath, timeoutMs: 700 })
      assert.equal(result.ok, false)
      assert.equal(result.timedOut, true)
      assert.equal(result.importSettled, false)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: missing entry module fails closed before spawning', async () => {
    const root = scratch()
    try {
      const app = join(root, 'app')
      mkdirSync(app, { recursive: true })
      const result = await runGate({ appDir: app, node: process.execPath, timeoutMs: 30000 })
      assert.equal(result.ok, false)
      assert.equal(result.importSettled, false)
      assert.ok(result.tail[0].includes('entry module missing'))
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('CLI: --json verdict on the GREEN fixture exits 0', () => {
    const root = scratch()
    try {
      const app = stubApp(root, { withDep: true })
      const out = spawnSync(process.execPath, [GATE, '--app-dir', app, '--timeout-ms', '30000', '--json'], { encoding: 'utf8' })
      assert.equal(out.status, 0)
      const verdict = JSON.parse(out.stdout)
      assert.equal(verdict.gate, 'RUNTIME_APP_GRAPH_GATE_V1')
      assert.equal(verdict.ok, true)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('CLI: exit 2 on the RED fixture (missing dep)', () => {
    const root = scratch()
    try {
      const app = stubApp(root, { withDep: false })
      const out = spawnSync(process.execPath, [GATE, '--app-dir', app, '--timeout-ms', '30000'], { encoding: 'utf8' })
      assert.equal(out.status, 2)
      assert.match(out.stdout, /MISSING proxy-agent-negotiate/)
      assert.match(out.stdout, /RUNTIME_APP_GRAPH_GATE FAIL/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})

// ---- Live whole-graph seam (skipped by default) ----------------------------
// DSH_B7_GATE_APP_GRAPH_UNDER_TEST=<candidate APP DIR> runs the REAL packed
// graph (bridges + node_modules + vendored dep populated). Optional
// DSH_B7_GATE_APP_GRAPH_EXPECT={pass|fail} asserts the expected verdict.
describe('RUNTIME_APP_GRAPH_GATE_V1 live-closure integration', { skip: !process.env.DSH_B7_GATE_APP_GRAPH_UNDER_TEST }, () => {
  test('real app closure imports the full production-runtime graph', async () => {
    const appDir = process.env.DSH_B7_GATE_APP_GRAPH_UNDER_TEST
    assert.ok(existsSync(join(appDir, 'packages/production-runtime/src/entry.js')), 'candidate app dir must carry the entry')
    const result = await runGate({ appDir, node: process.execPath, timeoutMs: 120000 })
    const expect = process.env.DSH_B7_GATE_APP_GRAPH_EXPECT ?? 'pass'
    if (expect === 'pass') {
      assert.equal(result.ok, true, `expected GREEN, got: ${JSON.stringify(result.tail.slice(-10))}`)
    } else {
      assert.equal(result.ok, false)
      assert.equal(result.missingPackages.length > 0 || result.importSettled === false, true)
    }
  })
})
