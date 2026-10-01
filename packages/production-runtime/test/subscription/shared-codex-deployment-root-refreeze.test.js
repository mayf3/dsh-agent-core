/**
 * B7 SHARED_CODEX deploymentRoot/security-surface re-freeze tests
 * (PRODUCT #414 / frozen-package R4 re-pin; 2026-10-01 STAGE 1 incident).
 *
 * The frozen 2097e4f pack failed its own authsvc cross-surface gate because
 * three source seams hardcoded the user-domain credential/fence paths. These
 * tests prove the re-parameterized contract end to end:
 *   seam A = agent-provisioning/src/shared-codex.js (canonical store constant)
 *   seam B = production-runtime/src/model-overrides.js (loader acceptance,
 *            options.deploymentRoot)
 *   seam C = production-runtime/src/shared-codex-migration-executable.js
 *            (shared-config/fence/canonical domain expectations derived from
 *            the config's own canonical store root)
 * Invariants under test (amendment A2/A4, §5, CTR-ACT2-002):
 *   - exactly ONE accepted canonical per load/transaction: the deployment
 *     root's own store; a foreign surface's lineage (or any other path) fails
 *     closed on every seam;
 *   - all three seams agree on the domain owner for a given root;
 *   - the yanfenma user-domain values stay byte-identical to the CTR-ACT2-002
 *     realignment (same config validates, same fence path);
 *   - mechanically mirroring the installer's cross-surface gate
 *     (trusted-cp-deploy-install.sh section-8 scan): none of the three seam
 *     SOURCE files carries a /Users/yanfenma literal, so the packed authsvc
 *     app closure is self-consistent.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE as PROVISIONING_CANONICAL,
  canonicalOpenAICodexCredentialFileFor,
} from '../../../agent-provisioning/src/shared-codex.js'
import {
  CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
  loadAgentModelOverrides,
} from '../../src/model-overrides.js'
import {
  executeFleetSharedCodexMigration,
  FLEET_SHARED_CODEX_ARTIFACT_PIN,
} from '../../src/shared-codex-migration-executable.js'

const USER_ROOT = join(homedir(), '.agent-core')
const YANFENMA_ROOT = '/Users/yanfenma/.agent-core'
const AUTHSVC_ROOT = '/Users/authsvc/.agent-core'
const YANFENMA_CANONICAL = canonicalOpenAICodexCredentialFileFor(YANFENMA_ROOT)
const AUTHSVC_CANONICAL = canonicalOpenAICodexCredentialFileFor(AUTHSVC_ROOT)
const FOREIGN_PATH = '/tmp/some-other-surface/.openai-codex-auth.json'
const OK = ['node', '-e', 'process.exit(0)']

const codeOf = (error) => error?.code

function lunaRoute(credentialFile, extra = {}) {
  return {
    routeKind: 'subscription', provider: 'openai-codex', model: 'gpt-5.6-luna',
    plugin: 'dsh-codex', pluginVersion: '0.2.3',
    credentialReadiness: 'shared-canonical-oauth',
    credentialFile,
    ...extra,
  }
}

function writeCatalog(file, credentialFile) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({
    version: 3,
    routeCatalog: { luna: lunaRoute(credentialFile) },
    overrides: { 'agt_cto-agent': { model: { primary: 'luna', fallbacks: [] } } },
  }, null, 2)}\n`, { mode: 0o644 })
}

/** Root-relative relocate used by the sandbox rigs (mirrors rooted()). */
function under(root, absolutePath) {
  return join(root, absolutePath.slice(1))
}

/** Full-transaction rig for the migration executable (normal reauth path). */
function migrationRig({ canonical, sharedConfig, thirdPartyPath = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'acr-refreeze-run-'))
  const events = join(root, 'events.jsonl')
  const proven = [{
    storeId: '/legacy/agt_cto-agent/.openai-codex-auth.json',
    accountIdentity: 'acct',
    generationId: 'fs:1:101',
    remoteOperationSucceeded: true,
    atomicLocalCommitSucceeded: true,
    committedBeforeQuiesceFence: true,
    laterSuccessfulRefresh: false,
    laterOutcomeUnknown: false,
    pendingRefreshIntent: false,
    competingCommittedGeneration: false,
    lastRemoteRotationCommitted: true,
  }]
  mkdirSync(join(root, 'legacy/agt_cto-agent'), { recursive: true })
  mkdirSync(join(root, 'control'), { recursive: true })
  writeFileSync(join(root, 'legacy/agt_cto-agent/.openai-codex-auth.json'), '{"synthetic-generation":1}', { mode: 0o600 })
  writeFileSync(join(root, 'control/provenance.json'), JSON.stringify({ expectedAccountIdentity: 'acct', candidates: proven }))
  const sharedPath = under(root, sharedConfig)
  mkdirSync(dirname(sharedPath), { recursive: true })
  writeFileSync(sharedPath, `${JSON.stringify({
    version: 3,
    routeCatalog: { luna: lunaRoute(canonical) },
    overrides: { 'agt_cto-agent': { model: { primary: 'luna', fallbacks: [] } } },
  }, null, 2)}\n`, { mode: 0o644 })
  const stubReceipt = `const fs=require('fs');fs.writeFileSync(process.env.AGENT_CORE_ARTIFACT_RECEIPT, JSON.stringify({version:'0.2.3',sourceCommit:'75d98d5b10bb926d53108e49019668c1bde2a9eb',artifactSha256:'2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0',sourceStamp:'test'}))`
  const canaryCommand = (name) => ['node', '-e', `require('fs').appendFileSync(${JSON.stringify(events)}, ${JSON.stringify(`${name}\n`)})`]
  const config = {
    root,
    canonicalCredentialPath: canonical,
    sharedConfigPath: sharedConfig,
    provenancePath: '/control/provenance.json',
    artifactReceiptPath: '/control/artifact-receipt.json',
    artifact: FLEET_SHARED_CODEX_ARTIFACT_PIN,
    sourceStamp: 'test',
    commands: {
      quiesceLunaDispatch: OK, quiesceRefreshWriters: OK,
      ownerReauthCanonical: OK,
      grantControlPlaneAcl: OK,
      probeUid502Read: OK, probeUid502AtomicReplace: OK, probeCanonicalOwnerControlPlane: OK, probeThirdUidDenied: OK,
      installPinnedArtifact: ['node', '-e', stubReceipt],
      controlledRestart: OK, verifyFleetHealth: OK, rollbackRuntime: OK,
      verifyZeroPerHomeRuntimeOpens: OK,
      canaries: Object.fromEntries(['STOCK', 'CEO', 'CTO'].map((name) => [name, canaryCommand(name)])),
    },
  }
  if (thirdPartyPath) config.sharedConfigPath = FOREIGN_PATH
  const cleanup = () => rmSync(root, { recursive: true, force: true })
  return { root, config, events, cleanup, sharedPath }
}

test('gate mirror: no /Users/yanfenma literal in any of the three seam source files', () => {
  // Mechanically mirrors the trusted-cp-deploy-install.sh cross-surface scan
  // over the PACKED app tree (src only — tests are never packed). The frozen
  // 2097e4f pack failed exactly this scan on these three files.
  const seamFiles = [
    ['seam-A agent-provisioning', '../../../agent-provisioning/src/shared-codex.js'],
    ['seam-B model-overrides', '../../src/model-overrides.js'],
    ['seam-C migration-executable', '../../src/shared-codex-migration-executable.js'],
  ]
  for (const [seam, relative] of seamFiles) {
    const file = fileURLToPath(new URL(relative, import.meta.url))
    const source = readFileSync(file, 'utf8')
    assert.equal(source.includes('/Users/yanfenma'), false, `${seam} must not hardcode the user-domain path literal`)
  }
})

test('seam A: the canonical constant is the EXECUTING surface canonical and agrees with the per-root math', () => {
  assert.equal(PROVISIONING_CANONICAL, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  assert.equal(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE, canonicalOpenAICodexCredentialFileFor(USER_ROOT))
  // The frozen user-domain value is preserved when this suite runs on the
  // yanfenma surface (CTR-ACT2-002 byte-freeze), and the authsvc root derives
  // ITS OWN canonical — never the user-domain path.
  if (USER_ROOT === YANFENMA_ROOT) {
    assert.equal(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE, '/Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json')
  }
  assert.equal(canonicalOpenAICodexCredentialFileFor(AUTHSVC_ROOT), '/Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json')
  assert.notEqual(canonicalOpenAICodexCredentialFileFor(AUTHSVC_ROOT), CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
})

test('seam B: loader with options.deploymentRoot accepts the authsvc own canonical and resolve() carries it', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'acr-refreeze-loader-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'agent-model-overrides.json')
  writeCatalog(file, AUTHSVC_CANONICAL)
  const loaded = loadAgentModelOverrides(file, ['agt_cto-agent'], { deploymentRoot: AUTHSVC_ROOT })
  assert.equal(loaded.filePresent, true)
  const resolved = loaded.resolve('agt_cto-agent', { provider: 'oc-go', model: 'deepseek-v4-flash' })
  assert.equal(resolved.credentialFile, AUTHSVC_CANONICAL)
})

test('seam B: loader refuses a foreign surface lineage under a pinned deploymentRoot (fail closed)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'acr-refreeze-foreign-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'agent-model-overrides.json')
  // The user-domain canonical referenced from the authsvc surface — the exact
  // contamination shape the B7 gate exists to prevent (§5).
  writeCatalog(file, YANFENMA_CANONICAL)
  assert.throws(
    () => loadAgentModelOverrides(file, ['agt_cto-agent'], { deploymentRoot: AUTHSVC_ROOT }),
    (e) => codeOf(e) === 'AGENT_MODEL_OVERRIDE_INVALID',
  )
  // Any third-party path is equally refused.
  writeCatalog(file, FOREIGN_PATH)
  assert.throws(
    () => loadAgentModelOverrides(file, ['agt_cto-agent'], { deploymentRoot: AUTHSVC_ROOT }),
    (e) => codeOf(e) === 'AGENT_MODEL_OVERRIDE_INVALID',
  )
})

test('seam B: explicit user-domain deploymentRoot preserves the frozen loader contract exactly', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'acr-refreeze-userdomain-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'agent-model-overrides.json')
  writeCatalog(file, YANFENMA_CANONICAL)
  const loaded = loadAgentModelOverrides(file, ['agt_cto-agent'], { deploymentRoot: YANFENMA_ROOT })
  assert.equal(loaded.resolve('agt_cto-agent', { provider: 'oc-go', model: 'deepseek-v4-flash' }).credentialFile, YANFENMA_CANONICAL)
  // And the authsvc canonical stays foreign on the user domain.
  writeCatalog(file, AUTHSVC_CANONICAL)
  assert.throws(
    () => loadAgentModelOverrides(file, ['agt_cto-agent'], { deploymentRoot: YANFENMA_ROOT }),
    (e) => codeOf(e) === 'AGENT_MODEL_OVERRIDE_INVALID',
  )
})

test('seam B: loader default (no option) accepts exactly the executing-surface canonical', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'acr-refreeze-default-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'agent-model-overrides.json')
  writeCatalog(file, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  const loaded = loadAgentModelOverrides(file, ['agt_cto-agent'])
  assert.equal(loaded.resolve('agt_cto-agent', { provider: 'oc-go', model: 'deepseek-v4-flash' }).credentialFile, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  writeCatalog(file, AUTHSVC_CANONICAL)
  if (USER_ROOT !== AUTHSVC_ROOT) {
    assert.throws(() => loadAgentModelOverrides(file, ['agt_cto-agent']), (e) => codeOf(e) === 'AGENT_MODEL_OVERRIDE_INVALID')
  }
})

test('seam C: the migration executable runs the authsvc domain end to end — own paths, own fence', () => {
  const t = migrationRig({
    canonical: AUTHSVC_CANONICAL,
    sharedConfig: '/Users/authsvc/.agent-core/agent-model-overrides.json',
  })
  try {
    const report = executeFleetSharedCodexMigration(t.config)
    assert.equal(report.selection.legacyCredentialReuseAllowed, true)
    // The fence is the authsvc domain's own control fence, relocated under the
    // transaction root by the same rooted() math as the user domain.
    const fence = JSON.parse(readFileSync(under(t.root, '/Users/authsvc/.agent-core/control/shared-codex-migration-fence.json'), 'utf8'))
    assert.deepEqual(fence, { version: 1, lunaDispatchQuiesced: true, refreshWritersQuiesced: true })
    // The fleet config was stamped with the authsvc canonical — never the
    // user-domain path.
    assert.equal(readFileSync(t.sharedPath, 'utf8').includes(AUTHSVC_CANONICAL), true)
    assert.equal(readFileSync(t.sharedPath, 'utf8').includes('/Users/yanfenma'), false)
    assert.equal(readFileSync(t.events, 'utf8'), 'STOCK\nCEO\nCTO\n')
  } finally { t.cleanup() }
})

test('seam C: a config mixing two surfaces fails closed (SHARED_CODEX_PATH_INVALID)', () => {
  const t = migrationRig({
    canonical: AUTHSVC_CANONICAL,
    sharedConfig: '/Users/authsvc/.agent-core/agent-model-overrides.json',
    thirdPartyPath: true,
  })
  try {
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_PATH_INVALID')
  } finally { t.cleanup() }
  const mixed = migrationRig({
    canonical: AUTHSVC_CANONICAL,
    sharedConfig: '/Users/yanfenma/.agent-core/agent-model-overrides.json',
  })
  try {
    assert.throws(() => executeFleetSharedCodexMigration(mixed.config), (e) => codeOf(e) === 'SHARED_CODEX_PATH_INVALID')
  } finally { mixed.cleanup() }
})

test('seam C: a non-canonical-shaped credential path fails closed', () => {
  const t = migrationRig({ canonical: '/Users/authsvc/.agent-core/some-other-store.json', sharedConfig: '/Users/authsvc/.agent-core/agent-model-overrides.json' })
  try {
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_PATH_INVALID')
  } finally { t.cleanup() }
})

test('seam C: the user-domain transaction keeps the frozen CTR-ACT2-002 behavior byte-identically', () => {
  const t = migrationRig({
    canonical: YANFENMA_CANONICAL,
    sharedConfig: '/Users/yanfenma/.agent-core/agent-model-overrides.json',
  })
  try {
    const report = executeFleetSharedCodexMigration(t.config)
    assert.equal(report.canonicalReauthCount, 0)
    // Exactly the historical fence location under the transaction root.
    const fence = JSON.parse(readFileSync(under(t.root, '/Users/yanfenma/.agent-core/control/shared-codex-migration-fence.json'), 'utf8'))
    assert.deepEqual(fence, { version: 1, lunaDispatchQuiesced: true, refreshWritersQuiesced: true })
    assert.equal(readFileSync(t.sharedPath, 'utf8').includes(YANFENMA_CANONICAL), true)
  } finally { t.cleanup() }
})

test('all three seams agree on the domain owner for a given deployment root', (t) => {
  for (const root of [YANFENMA_ROOT, AUTHSVC_ROOT]) {
    const own = canonicalOpenAICodexCredentialFileFor(root)
    // seam A produces it, seam B accepts it (and only it) under the root,
    // seam C accepts it as the transaction's canonical (shape check is the
    // same canonicalOpenAICodexCredentialFileFor math).
    const dir = mkdtempSync(join(tmpdir(), 'acr-refreeze-agree-'))
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    const file = join(dir, 'agent-model-overrides.json')
    writeCatalog(file, own)
    const loaded = loadAgentModelOverrides(file, ['agt_cto-agent'], { deploymentRoot: root })
    assert.equal(loaded.resolve('agt_cto-agent', { provider: 'oc-go', model: 'deepseek-v4-flash' }).credentialFile, own)
    assert.equal(own, canonicalOpenAICodexCredentialFileFor(root))
  }
})
