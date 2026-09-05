/**
 * CTR-ACT-005 bootstrap candidate class — bounded runner delta focus tests.
 * Every production binding is a stub; only the bootstrap selection/receipt/
 * cardinality semantics are exercised. Non-bootstrap regression is asserted
 * at the validateConfig surface (binding still required) and by the existing
 * shared-codex-migration suite.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

import {
  executeFleetSharedCodexMigration,
  FLEET_SHARED_CODEX_ARTIFACT_PIN,
} from '../src/shared-codex-migration-executable.js'
import { CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE } from '../src/model-overrides.js'

const SHARED = '/Users/authsvc/.agent-core/agent-model-overrides.json'
const FLEET = 92
const OK = ['node', '-e', 'process.exit(0)']

function rig({ count = FLEET, receiptResult = 'PASS', phase = 'pre', withRoot = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'acr-bootstrap-'))
  const homes = join(root, 'homes')
  mkdirSync(homes, { recursive: true })
  mkdirSync(join(root, 'control'), { recursive: true })
  const CRED = JSON.stringify({ accessToken: 'FAKE-SANDBOX-INERT', expiresAt: '2031-01-01T00:00:00.000Z', accountId: 'acct' })
  const paths = []
  for (let i = 0; i < count; i++) {
    const id = `agt_b-${String(i).padStart(3, '0')}`
    mkdirSync(join(homes, id), { recursive: true })
    writeFileSync(join(homes, id, '.openai-codex-auth.json'), CRED, { mode: 0o600 })
    paths.push(`/homes/${id}/.openai-codex-auth.json`)
  }
  const receipt = {
    gate: 'CTR_SCA_017_TEN_GATE',
    phase,
    result: receiptResult,
    root: withRoot ? root : '/somewhere-else',
    captured_at: new Date().toISOString(),
    inventory_count: count,
    inventory_paths: paths,
    items: [],
  }
  writeFileSync(join(root, 'ten-gate-receipt.json'), JSON.stringify(receipt, null, 2))
  const v2 = {
    version: 3, // switchFleetConfig requires the fleet config to be v3 already
    routeCatalog: {
      luna: { routeKind: 'subscription', provider: 'openai-codex', model: 'gpt-5.6-luna', plugin: 'dsh-codex', pluginVersion: '0.2.3', credentialReadiness: 'shared-cto-oauth-breakglass', credentialFile: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE },
    },
    overrides: { 'agt_b-000': { model: { primary: 'luna', fallbacks: [] } } },
  }
  const sharedPath = join(root, SHARED)
  mkdirSync(dirname(sharedPath), { recursive: true })
  writeFileSync(sharedPath, `${JSON.stringify(v2, null, 2)}\n`, { mode: 0o644 })
  writeFileSync(join(root, 'provenance.json'), JSON.stringify({ expectedAccountIdentity: 'acct', candidates: [] }))

  const stubReceipt = `const fs=require('fs');fs.writeFileSync(process.env.AGENT_CORE_ARTIFACT_RECEIPT, JSON.stringify({version:'0.2.3',sourceCommit:'75d98d5b10bb926d53108e49019668c1bde2a9eb',artifactSha256:'2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0',sourceStamp:'test'}))`
  const config = {
    root,
    candidateClass: 'BOOTSTRAP_FROM_CONVERGED_SNAPSHOT',
    bootstrapGateReceiptPath: '/ten-gate-receipt.json',
    bootstrapStore: paths[41],
    canonicalCredentialPath: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
    sharedConfigPath: SHARED,
    provenancePath: '/provenance.json',
    artifactReceiptPath: '/control/artifact-receipt.json',
    artifact: FLEET_SHARED_CODEX_ARTIFACT_PIN,
    sourceStamp: 'test',
    commands: {
      quiesceLunaDispatch: OK, quiesceRefreshWriters: OK,
      grantControlPlaneAcl: OK,
      probeUid502Read: OK, probeUid502AtomicReplace: OK, probeAuthsvcControlPlane: OK, probeThirdUidDenied: OK,
      installPinnedArtifact: ['node', '-e', stubReceipt],
      controlledRestart: OK, verifyFleetHealth: OK, rollbackRuntime: OK,
      verifyZeroPerHomeRuntimeOpens: OK,
      canaries: { CEO: OK, HR: OK, Podcast: OK, Shopping: OK },
    },
  }
  const cleanup = () => rmSync(root, { recursive: true, force: true })
  return { root, config, paths, cleanup, sharedPath, canonicalPath: join(root, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE) }
}

const codeOf = (error) => error?.code

test('CTR-ACT-005 bootstrap happy path: receipt governs, reuse forced, reauth never bound', () => {
  const t = rig()
  try {
    const report = executeFleetSharedCodexMigration(t.config)
    assert.deepEqual(report.selection, {
      legacyCredentialReuseAllowed: true,
      authoritativeStore: t.config.bootstrapStore,
      bootstrap: true,
      canonicalReauthRequired: false,
    })
    assert.equal(report.canonicalReauthCount, 0)
    const st = statSync(t.canonicalPath)
    assert.equal(st.mode & 0o777, 0o600)
    assert.equal(readFileSync(t.canonicalPath, 'utf8'), readFileSync(join(t.root, t.config.bootstrapStore), 'utf8'))
    const cfg = JSON.parse(readFileSync(t.sharedPath, 'utf8'))
    assert.equal(cfg.version, 3)
    assert.equal(cfg.routeCatalog.luna.credentialFile, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  } finally { t.cleanup() }
})

test('bootstrap fails closed when an ownerReauthCanonical binding is present', () => {
  const t = rig()
  try {
    t.config.commands.ownerReauthCanonical = OK
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_REAUTH_FORBIDDEN')
  } finally { t.cleanup() }
})

test('bootstrap fails closed on a missing / corrupt ten-gate receipt', () => {
  const t = rig()
  try {
    rmSync(join(t.root, 'ten-gate-receipt.json'))
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_GATE_RECEIPT_INVALID')
  } finally { t.cleanup() }
})

test('bootstrap fails closed on a FAIL (or wrong phase / wrong root) receipt', () => {
  for (const patch of [{ receiptResult: 'FAIL' }, { phase: 'post' }, { withRoot: false }]) {
    const t = rig(patch)
    try {
      assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_GATE_RECEIPT_INVALID')
    } finally { t.cleanup() }
  }
})

test('bootstrap fails closed on wrong fleet cardinality: 91 (91+unknown), 93 (extra)', () => {
  for (const count of [91, 93]) {
    const t = rig({ count })
    try {
      assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_FLEET_CARDINALITY_INVALID')
    } finally { t.cleanup() }
  }
})

test('bootstrap fails closed when bootstrapStore is outside the receipt equality set', () => {
  const t = rig()
  try {
    t.config.bootstrapStore = '/homes/agt_orphan/.openai-codex-auth.json'
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_BOOTSTRAP_STORE_INVALID')
  } finally { t.cleanup() }
})

test('bootstrap rejects an unknown candidateClass', () => {
  const t = rig()
  try {
    t.config.candidateClass = 'SOMETHING_ELSE'
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_CONFIG_INVALID')
  } finally { t.cleanup() }
})

test('non-bootstrap regression: ownerReauthCanonical binding is still REQUIRED and reauth still fires on non-reuse selection', () => {
  const t = rig()
  try {
    delete t.config.candidateClass
    delete t.config.bootstrapGateReceiptPath
    delete t.config.bootstrapStore
    // empty provenance candidates => no proven generation => reauth branch requires the binding
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_BINDING_INVALID' || codeOf(e) === 'SHARED_CODEX_PROVENANCE_INVALID')
    // and with the binding present it proceeds into the reauth branch (stub exits 0, then Owner-reauth copy path fails at validateCanonical — which is the documented legacy failure surface)
    t.config.commands.ownerReauthCanonical = OK
    assert.throws(() => executeFleetSharedCodexMigration(t.config), (e) => codeOf(e) === 'SHARED_CODEX_CREDENTIAL_MISSING')
  } finally { t.cleanup() }
})
