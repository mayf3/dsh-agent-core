/**
 * AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2 CTR-ACT2-002/003 —
 * yanfenma-domain realignment focus tests. Proves: (1) the canonical
 * credential constant is the yanfenma path in both carrying modules and the
 * authsvc-frame canonical is rejected; (2) the executable's normal (reauth)
 * path is reachable in this domain with a NON-92 provenance inventory (the
 * EXPECTED_FLEET=92 constant binds only the bootstrap branch, which this
 * activation does not select); (3) canaries execute in the realigned
 * STOCK → CEO → CTO order; (4) the v1→v3 migrated target document (real
 * redacted snapshot shape) loads under the realigned loader with
 * providerEnv + canonical credentialFile passthrough into resolve().
 * The compose-frame op-runner canary list (shared-codex-migration.js) stays
 * verbatim per CTR-ACT2-002 — compose is not in this domain's closure.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

import {
  executeFleetSharedCodexMigration,
  FLEET_SHARED_CODEX_ARTIFACT_PIN,
} from '../../src/shared-codex-migration-executable.js'
import {
  CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
  loadAgentModelOverrides,
} from '../../src/model-overrides.js'
import {
  CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE as PROVISIONING_CANONICAL,
  assertOAuthCredentialBoundary,
  persistOpenAICodexCredentialFile,
} from '../../../agent-provisioning/src/shared-codex.js'

const YANFENMA_CANONICAL = '/Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json'
const AUTHSVC_CANONICAL = '/Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json'
const SHARED = '/Users/yanfenma/.agent-core/agent-model-overrides.json'
const OK = ['node', '-e', 'process.exit(0)']

const codeOf = (error) => error?.code

function lunaRoute(extra = {}) {
  return {
    routeKind: 'subscription', provider: 'openai-codex', model: 'gpt-5.6-luna',
    plugin: 'dsh-codex', pluginVersion: '0.2.3',
    credentialReadiness: 'shared-canonical-oauth',
    credentialFile: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
    ...extra,
  }
}

test('canonical credential constant is the yanfenma path in both carrying modules', () => {
  assert.equal(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE, YANFENMA_CANONICAL)
  assert.equal(PROVISIONING_CANONICAL, YANFENMA_CANONICAL)
  assert.notEqual(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE, AUTHSVC_CANONICAL)
})

test('provisioning boundary accepts the realigned default and stamps the patch block with it', (t) => {
  // realpath: macOS /var is a symlink; the boundary walks and rejects symlink
  // path components by design.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'acr-realign-boundary-')))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const store = join(dir, 'store', '.openai-codex-auth.json')
  mkdirSync(dirname(store), { recursive: true, mode: 0o700 })
  chmodSync(dirname(store), 0o700)
  writeFileSync(store, '{"synthetic":true}', { mode: 0o600 })
  assert.equal(assertOAuthCredentialBoundary(dir, store, { expectedCredentialFile: store }), store)
  const patchFile = join(dir, 'cordis.patch.yml')
  writeFileSync(patchFile, 'base: {}\n', { mode: 0o600 })
  // persistOpenAICodexCredentialFile is locked to the canonical constant by
  // design — prove the lock AND that the stamped block carries the realigned
  // yanfenma path.
  assert.throws(() => persistOpenAICodexCredentialFile(patchFile, store), (e) => e?.code === 'credential_path_invalid')
  persistOpenAICodexCredentialFile(patchFile, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  assert.equal(readFileSync(patchFile, 'utf8').includes(YANFENMA_CANONICAL), true)
})

function normalPathRig({ candidates, canaryBindingKeys = ['STOCK', 'CEO', 'CTO'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'acr-realign-run-'))
  const events = join(root, 'events.jsonl')
  const proven = candidates ?? [{
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
  mkdirSync(dirname(join(root, SHARED)), { recursive: true })
  writeFileSync(join(root, SHARED), `${JSON.stringify({
    version: 3,
    routeCatalog: { luna: lunaRoute() },
    overrides: { 'agt_cto-agent': { model: { primary: 'luna', fallbacks: [] } } },
  }, null, 2)}\n`, { mode: 0o644 })
  const stubReceipt = `const fs=require('fs');fs.writeFileSync(process.env.AGENT_CORE_ARTIFACT_RECEIPT, JSON.stringify({version:'0.2.3',sourceCommit:'75d98d5b10bb926d53108e49019668c1bde2a9eb',artifactSha256:'2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0',sourceStamp:'test'}))`
  const canaryCommand = (name) => ['node', '-e', `require('fs').appendFileSync(${JSON.stringify(events)}, ${JSON.stringify(`${name}\n`)})`]
  const config = {
    root,
    canonicalCredentialPath: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
    sharedConfigPath: SHARED,
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
      canaries: Object.fromEntries(canaryBindingKeys.map((name) => [name, canaryCommand(name)])),
    },
  }
  const cleanup = () => rmSync(root, { recursive: true, force: true })
  return { root, config, events, cleanup, sharedPath: join(root, SHARED), canonicalPath: join(root, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE) }
}

test('normal reauth path accepts a 1-candidate (non-92) inventory: cardinality gate is bootstrap-only', () => {
  const t = normalPathRig()
  try {
    const report = executeFleetSharedCodexMigration(t.config)
    assert.equal(report.canonicalReauthCount, 0)
    assert.equal(report.selection.legacyCredentialReuseAllowed, true)
    assert.equal(report.selection.authoritativeStore, '/legacy/agt_cto-agent/.openai-codex-auth.json')
  } finally { t.cleanup() }
})

test('canaries execute in the realigned STOCK → CEO → CTO order', () => {
  const t = normalPathRig()
  try {
    executeFleetSharedCodexMigration(t.config)
    assert.equal(readFileSync(t.events, 'utf8'), 'STOCK\nCEO\nCTO\n')
  } finally { t.cleanup() }
})

test('validateConfig fails closed on a missing realigned canary binding', () => {
  const t = normalPathRig({ canaryBindingKeys: ['STOCK', 'CEO'] })
  try {
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_BINDING_INVALID')
  } finally { t.cleanup() }
})

test('authsvc-frame canonical and fleet-config paths are rejected in this domain', () => {
  const t = normalPathRig()
  try {
    t.config.canonicalCredentialPath = AUTHSVC_CANONICAL
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_PATH_INVALID')
  } finally { t.cleanup() }
})

test('ACC-ACT2-003 migrated real-snapshot-shape v3 document loads with providerEnv + canonical passthrough', (t) => {
  const { file } = (() => {
    const dir = mkdtempSync(join(tmpdir(), 'acr-realign-loader-'))
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    return { file: join(dir, 'agent-model-overrides.json') }
  })()
  // Exact structure the v1→v3 migrator emits for this domain's real v1
  // preimage plus the stock/ceo route-addition annex (identical routes are
  // distinguished by credentialReadiness — the loader dedups identical
  // canonical route identities).
  const migrated = {
    version: 3,
    routeCatalog: {
      'cto-luna': lunaRoute({
        credentialReadiness: 'shared-canonical-cto',
        providerEnv: {
          HTTP_PROXY: 'http://127.0.0.1:7890',
          HTTPS_PROXY: 'http://127.0.0.1:7890',
          NO_PROXY: 'localhost,127.0.0.1,::1',
          NODE_USE_ENV_PROXY: '1',
        },
      }),
      'stock-luna': lunaRoute({ credentialReadiness: 'shared-canonical-stock' }),
      'ceo-luna': lunaRoute({ credentialReadiness: 'shared-canonical-ceo' }),
    },
    overrides: {
      'agt_cto-agent': { model: { primary: 'cto-luna', fallbacks: [] } },
      'agt_stock_agent': { model: { primary: 'stock-luna', fallbacks: [] } },
      'agt_ceo-agent': { model: { primary: 'ceo-luna', fallbacks: [] } },
    },
  }
  writeFileSync(file, `${JSON.stringify(migrated, null, 2)}\n`, { mode: 0o644 })
  const registered = ['agt_cto-agent', 'agt_stock_agent', 'agt_ceo-agent', 'agt_other-agent']
  const loaded = loadAgentModelOverrides(file, registered)
  assert.equal(loaded.filePresent, true)
  const cto = loaded.resolve('agt_cto-agent', { provider: 'oc-go', model: 'deepseek-v4-flash' })
  assert.equal(cto.provider, 'openai-codex')
  assert.equal(cto.model, 'gpt-5.6-luna')
  assert.equal(cto.credentialFile, YANFENMA_CANONICAL)
  assert.equal(cto.providerEnv.HTTP_PROXY, 'http://127.0.0.1:7890')
  assert.equal(cto.plugin, 'dsh-codex')
  const stock = loaded.resolve('agt_stock_agent', { provider: 'oc-go', model: 'deepseek-v4-flash' })
  assert.equal(stock.credentialFile, YANFENMA_CANONICAL)
  assert.equal(stock.providerEnv, undefined)
  const other = loaded.resolve('agt_other-agent', { provider: 'oc-go', model: 'deepseek-v4-flash' })
  assert.deepEqual(other, { provider: 'oc-go', model: 'deepseek-v4-flash' })
})

test('loader rejects the migrated document when identical routes are not distinguished', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'acr-realign-dedup-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'agent-model-overrides.json')
  const route = lunaRoute()
  writeFileSync(file, JSON.stringify({
    version: 3,
    routeCatalog: { 'stock-luna': route, 'ceo-luna': { ...route } },
    overrides: { 'agt_stock_agent': { model: { primary: 'stock-luna', fallbacks: [] } } },
  }), { mode: 0o644 })
  assert.throws(() => loadAgentModelOverrides(file, ['agt_stock_agent', 'agt_ceo-agent']), /same canonical route identity/)
})

test('loader rejects an authsvc credentialFile on a codex subscription route in this domain', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'acr-realign-authsvc-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'agent-model-overrides.json')
  writeFileSync(file, JSON.stringify({
    version: 3,
    routeCatalog: { luna: lunaRoute({ credentialFile: AUTHSVC_CANONICAL }) },
    overrides: { 'agt_cto-agent': { model: { primary: 'luna', fallbacks: [] } } },
  }), { mode: 0o644 })
  assert.throws(() => loadAgentModelOverrides(file, ['agt_cto-agent']), (e) => codeOf(e) === 'AGENT_MODEL_OVERRIDE_INVALID')
})
