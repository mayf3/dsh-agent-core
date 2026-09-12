// Trust-domain tests for the canonical credential path (owner ruling
// TRUST_DOMAIN_AUTHORITY_MISMATCH, 2026-09-12): the deployment owns the
// canonical path and BOTH provisioning checks must honor the declaration —
// actual subscription.credentialFile MUST equal it exactly, with no
// cross-domain acceptance and no weakening to arbitrary paths.
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
  assertOAuthCredentialBoundary,
  persistOpenAICodexCredentialFile,
  provisionAgentHome,
} from '../src/index.js'

const AUTHSVC_CANONICAL = '/Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json'
// macOS /var is itself a symlink — the boundary's component scan requires a
// realpath base for fixture stores.
const BASE = () => mkdtempSync(join(realpathSync(tmpdir()), 'trust-domain-'))
const YANFENMA_CANONICAL = CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE

function canonicalStoreFixture(dir) {
  const storeDir = join(dir, 'shared-credentials', 'openai-codex')
  mkdirSync(storeDir, { recursive: true, mode: 0o700 })
  const file = join(storeDir, '.openai-codex-auth.json')
  mkdirSync(storeDir, { recursive: true, mode: 0o700 })
  writeFileSync(file, '{"token":"fixture"}\n', { mode: 0o600 })
  chmodSync(file, 0o600)
  return file
}

test('authsvc domain: expected==actual canonical passes both provisioning checks (cases 1,2)', (t) => {
  const dir = BASE()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const store = canonicalStoreFixture(dir)
  const patch = join(dir, 'cordis.patch.yml')
  writeFileSync(patch, '', { mode: 0o644 })
  // persist accepts the declared authsvc canonical path
  persistOpenAICodexCredentialFile(patch, store, { expectedCredentialFile: store })
  // boundary accepts it (real 0600-in-0700 fixture)
  assert.equal(assertOAuthCredentialBoundary(dir, store, { expectedCredentialFile: store }), store)
})

test('cross-domain: authsvc declaration with yanfenma actual fails credential_path_invalid (cases 3,4,5)', () => {
  const patch = join(tmpdir(), `patch-${Math.random().toString(36).slice(2)}.yml`)
  // persist: expected authsvc, actual yanfenma — rejected before any filesystem touch
  assert.throws(
    () => persistOpenAICodexCredentialFile(patch, YANFENMA_CANONICAL, { expectedCredentialFile: AUTHSVC_CANONICAL }),
    (e) => e.code === 'credential_path_invalid',
  )
  // boundary: same mismatch — rejected before any filesystem touch
  assert.throws(
    () => assertOAuthCredentialBoundary('/tmp', YANFENMA_CANONICAL, { expectedCredentialFile: AUTHSVC_CANONICAL }),
    (e) => e.code === 'credential_path_invalid',
  )
})

test('yanfenma domain remains valid by default (no options): path check passes, only the absent store stats-fails', () => {
  const patch = join(tmpdir(), `patch-${Math.random().toString(36).slice(2)}.yml`)
  writeFileSync(patch, '', { mode: 0o644 })
  persistOpenAICodexCredentialFile(patch, YANFENMA_CANONICAL)
  // The real yanfenma-domain canonical store exists on this machine: the
  // default declaration must remain fully valid end-to-end.
  assert.equal(assertOAuthCredentialBoundary('/tmp', YANFENMA_CANONICAL), YANFENMA_CANONICAL)
})

test('case 7: a fresh ordinary Agent home provisions with the authsvc canonical path end-to-end', (t) => {
  const dir = BASE()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const store = canonicalStoreFixture(dir)
  const home = join(dir, 'home')
  mkdirSync(home, { recursive: true, mode: 0o700 })
  chmodSync(home, 0o700)
  const boundaryCalls = []
  provisionAgentHome(home, join(dir, 'ws'), {
    profile: 'agent-core-production',
    expectedCredentialFile: store,
    subscription: {
      plugin: 'dsh-codex', pluginVersion: '0.2.3',
      sourceCommit: '75d98d5b10bb926d53108e49019668c1bde2a9eb',
      artifactSha256: '2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0',
      dshVersion: '0.1.0-rc.5',
      dshCommit: 'a12bb03c6861969985f066bfbf0cb7e5dd5ac567',
      credentialFile: store,
    },
    pluginInstaller(input) {
      const pluginDir = join(input.profilesRoot, 'node_modules', input.plugin)
      mkdirSync(pluginDir, { recursive: true })
      writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({ name: input.plugin, version: input.version }), 'utf8')
    },
    artifactIdentity: { version: 1, sourceCommit: '75d98d5b10bb926d53108e49019668c1bde2a9eb', artifactSha256: '2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0' },
    harnessIdentity: { version: '0.1.0-rc.5', commit: 'a12bb03c6861969985f066bfbf0cb7e5dd5ac567' },
    credentialBoundary(...args) { boundaryCalls.push(args) },
  })
  const patch = readFileSync(join(home, 'profiles', 'agent-core-production', 'cordis.patch.yml'), 'utf8')
  assert.ok(patch.includes(`credentialFile: ${JSON.stringify(store)}`))
  assert.equal(boundaryCalls.length, 1)
  assert.equal(boundaryCalls[0][1], store)
  assert.deepEqual(boundaryCalls[0][2], { expectedCredentialFile: store })
})
