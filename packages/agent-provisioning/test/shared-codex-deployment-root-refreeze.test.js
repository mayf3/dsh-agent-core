/**
 * B7 deploymentRoot/security-surface refreeze tests — seam A
 * (agent-provisioning/src/shared-codex.js).
 *
 * The canonical store constant is the EXECUTING surface's own canonical
 * (yanfenma-domain value preserved byte-identically on that surface per
 * CTR-ACT2-002; every other deployment domain resolves its own canonical per
 * amendment A2), and the persistence seam keeps refusing any cross-surface
 * lineage reference (§5: one lineage per security surface, fail closed).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
  assertSameDomainCredentialFile,
  canonicalOpenAICodexCredentialFileFor,
  deploymentRootOfAgentHome,
  persistOpenAICodexCredentialFile,
} from '../src/shared-codex.js'

const USER_ROOT = join(homedir(), '.agent-core')
const YANFENMA_ROOT = '/Users/yanfenma/.agent-core'
const AUTHSVC_ROOT = '/Users/authsvc/.agent-core'
const AUTHSVC_CANONICAL = canonicalOpenAICodexCredentialFileFor(AUTHSVC_ROOT)
const YANFENMA_CANONICAL = canonicalOpenAICodexCredentialFileFor(YANFENMA_ROOT)

test('the canonical constant is derived from the executing deployment root, never a foreign literal', () => {
  assert.equal(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE, canonicalOpenAICodexCredentialFileFor(USER_ROOT))
  // CTR-ACT2-002 byte-freeze on the yanfenma surface (the suite's home machine).
  if (USER_ROOT === YANFENMA_ROOT) {
    assert.equal(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE, '/Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json')
  }
  // The authsvc surface's own canonical is a DIFFERENT store.
  assert.notEqual(AUTHSVC_CANONICAL, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  assert.equal(AUTHSVC_CANONICAL, '/Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json')
})

test('deploymentRootOfAgentHome + same-domain guard keep attributing homes to their own root', () => {
  assert.equal(deploymentRootOfAgentHome(join(AUTHSVC_ROOT, 'homes', 'agt_cto-agent')), AUTHSVC_ROOT)
  assert.equal(deploymentRootOfAgentHome(join(YANFENMA_ROOT, 'homes', 'agt_cto-agent')), YANFENMA_ROOT)
  // authsvc home + authsvc canonical: same domain, accepted.
  assert.equal(assertSameDomainCredentialFile(join(AUTHSVC_ROOT, 'homes', 'agt_cto-agent'), AUTHSVC_CANONICAL), AUTHSVC_CANONICAL)
  // authsvc home + user-domain canonical: cross-surface, refused (§5).
  assert.throws(
    () => assertSameDomainCredentialFile(join(AUTHSVC_ROOT, 'homes', 'agt_cto-agent'), YANFENMA_CANONICAL),
    (e) => e?.code === 'credential_path_invalid',
  )
})

test('persist keeps the same-domain pin: authsvc deploymentRoot accepts only the authsvc canonical', (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'acr-refreeze-persist-')))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const patchFile = join(dir, 'cordis.patch.yml')
  writeFileSync(patchFile, 'base: {}\n', { mode: 0o644 })
  persistOpenAICodexCredentialFile(patchFile, AUTHSVC_CANONICAL, { deploymentRoot: AUTHSVC_ROOT })
  assert.equal(readFileSync(patchFile, 'utf8').includes(AUTHSVC_CANONICAL), true)
  assert.throws(
    () => persistOpenAICodexCredentialFile(patchFile, YANFENMA_CANONICAL, { deploymentRoot: AUTHSVC_ROOT }),
    (e) => e?.code === 'credential_path_invalid',
  )
})

test('unpinned persist keeps the reviewed A4 shape-lock contract; the pins enforce same-domain', (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'acr-refreeze-persist2-')))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const patchFile = join(dir, 'cordis.patch.yml')
  writeFileSync(patchFile, 'base: {}\n', { mode: 0o644 })
  // A4 (reviewed PASS @81382b7): unpinned persist enforces the canonical
  // SHAPE only — the deploymentRoot/agentHome pins are the same-domain
  // enforcement points. Both surfaces' canonical-shaped stores persist;
  // a non-canonical path is refused.
  persistOpenAICodexCredentialFile(patchFile, AUTHSVC_CANONICAL)
  assert.equal(readFileSync(patchFile, 'utf8').includes(AUTHSVC_CANONICAL), true)
  persistOpenAICodexCredentialFile(patchFile, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  assert.equal(readFileSync(patchFile, 'utf8').includes(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE), true)
  assert.throws(
    () => persistOpenAICodexCredentialFile(patchFile, '/tmp/not-canonical-shape.json'),
    (e) => e?.code === 'credential_path_invalid',
  )
})
