/**
 * DSH_AGENT_CORE_MODULARITY_PHASE_A_V1 closure amendment — TRACKED-ONLY
 * package closure regression (FRESH_TRACKED_CLOSURE_RESOLVES_IDENTITY_PACKAGE).
 *
 * The production composition must depend on this package's public entry
 * through a TRACKED relative path, so that a checkout containing ONLY git
 * tracked bytes resolves it: no untracked node_modules bridge, no manual
 * symlink registration, no deployment-side step. (A bare
 * `@agent-core/agent-identity-capabilities` specifier only resolves where
 * an untracked @agent-core link exists — exactly the bridge this closure
 * removes.)
 *
 * This test never touches node_modules and never calls any bridge/ensure
 * helper. It (1) scans the composition source for any bare workspace
 * specifier of this package, (2) extracts the actual import specifier,
 * resolves it the way ESM would from the importing file, and (3) imports
 * that exact tracked entry, asserting the full public surface — the same
 * resolution a `git archive` checkout performs.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PKG_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const PRODUCTION_RUNTIME_SRC = join(PKG_ROOT, '..', 'production-runtime', 'src')
const IDENTITY_SPECIFIER_RE = /['"]@agent-core\/agent-identity-capabilities['"]/

test('tracked closure: the package declares its package-root file as the public entry', () => {
  const manifest = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'))
  assert.equal(manifest.exports['.'], './index.js')
  assert.equal(existsSync(join(PKG_ROOT, 'index.js')), true,
    'the stable tracked public entry packages/agent-identity-capabilities/index.js must exist')
  // The tracked entry must re-export the same surface as the src barrel —
  // one package, one public face.
  const entry = readFileSync(join(PKG_ROOT, 'index.js'), 'utf8')
  assert.match(entry, /export \* from '\.\/src\/index\.js'/)
})

test('tracked closure: no production-runtime composition source carries a bare identity-package specifier', () => {
  const offenders = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.js')) {
        if (IDENTITY_SPECIFIER_RE.test(readFileSync(full, 'utf8'))) offenders.push(full)
      }
    }
  }
  walk(PRODUCTION_RUNTIME_SRC)
  assert.deepEqual(offenders, [],
    'composition must import the tracked public entry path, not a bare workspace specifier that only resolves over an untracked node_modules bridge')
})

test('tracked closure: the composition import resolves as a tracked file and yields the public surface', async () => {
  const composeSource = readFileSync(join(PRODUCTION_RUNTIME_SRC, 'compose.js'), 'utf8')
  const importLine = composeSource
    .split('\n')
    .find((line) => line.includes('agent-identity-capabilities/index.js'))
  assert.notEqual(importLine, undefined,
    'compose.js must import the identity package public entry by its tracked path')

  // Resolve exactly what the composition resolves: relative to compose.js,
  // with NO node_modules involvement — the git-archive-closure semantics.
  const specifier = importLine.match(/from\s+'([^']+)'/)?.[1]
  assert.notEqual(specifier, undefined)
  assert.equal(specifier.startsWith('.'), true, 'the import must be a tracked relative path')
  const resolvedPath = resolve(dirname(join(PRODUCTION_RUNTIME_SRC, 'compose.js')), specifier)
  assert.equal(existsSync(resolvedPath), true)

  const entry = await import(pathToFileURL(resolvedPath).href)
  for (const name of [
    'createAgentDirectoryAccess',
    'createAgentPrincipalResolutionAccess',
    'createAgentPrincipalReverseResolutionAccess',
  ]) {
    assert.equal(typeof entry[name], 'function', `public entry must export ${name}`)
  }
  assert.equal(entry.AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID, 'agent_resolve_principal_by_agent')
})
