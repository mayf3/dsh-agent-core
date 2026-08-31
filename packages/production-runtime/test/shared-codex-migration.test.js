import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  runFleetSharedCodexAuthMigrationV1,
  selectAuthoritativeCodexGeneration,
} from '../src/compose.js'
import {
  FLEET_SHARED_CODEX_ARTIFACT_PIN,
} from '../src/shared-codex-migration-executable.js'
import { CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE } from '../src/model-overrides.js'

const ENVIRONMENT = Object.freeze({ lunaDispatchQuiesced: true, refreshWritersQuiesced: true })
const ACCOUNT = 'expected-account-identity'

function candidate(overrides = {}) {
  return {
    storeId: 'legacy/agent-1',
    accountIdentity: ACCOUNT,
    generationId: 'fs:1:101',
    remoteOperationSucceeded: true,
    atomicLocalCommitSucceeded: true,
    committedBeforeQuiesceFence: true,
    laterSuccessfulRefresh: false,
    laterOutcomeUnknown: false,
    pendingRefreshIntent: false,
    competingCommittedGeneration: false,
    lastRemoteRotationCommitted: true,
    ...overrides,
  }
}

function select(candidates) {
  return selectAuthoritativeCodexGeneration({ ...ENVIRONMENT, expectedAccountIdentity: ACCOUNT, candidates })
}

test('A ONE_PROVEN_GENERATION: complete commit provenance permits reuse', () => {
  assert.deepEqual(select([candidate()]), {
    legacyCredentialReuseAllowed: true,
    authoritativeStore: 'legacy/agent-1',
    generationId: 'fs:1:101',
    canonicalReauthRequired: false,
    canonicalReauthCountMax: 1,
  })
})

test('B MULTIPLE_CANDIDATES_ONE_PROVEN: only the mechanically proven generation wins', () => {
  const stale = candidate({
    storeId: 'legacy/agent-2',
    generationId: 'fs:1:99',
    remoteOperationSucceeded: false,
    atomicLocalCommitSucceeded: false,
    lastRemoteRotationCommitted: false,
  })
  assert.equal(select([stale, candidate()]).authoritativeStore, 'legacy/agent-1')
})

test('C STALE_STORE_WITH_NEWER_MTIME: mtime is ignored and cannot outrank provenance', () => {
  const stale = candidate({
    storeId: 'legacy/newer-mtime',
    generationId: 'fs:1:99',
    laterSuccessfulRefresh: true,
    mtime: Number.MAX_SAFE_INTEGER,
  })
  assert.equal(select([stale, candidate({ mtime: 0 })]).authoritativeStore, 'legacy/agent-1')
})

test('D TWO_CONFLICTING_PROVEN_GENERATIONS: fail closed to one canonical reauth', () => {
  const result = select([candidate(), candidate({ storeId: 'legacy/agent-2', generationId: 'fs:1:102' })])
  assert.equal(result.legacyCredentialReuseAllowed, false)
  assert.equal(result.canonicalReauthRequired, true)
  assert.equal(result.authoritativeStore, null)
})

test('E TIE_OR_INSUFFICIENT_PROVENANCE: fail closed', () => {
  assert.equal(select([candidate({ atomicLocalCommitSucceeded: false })]).canonicalReauthRequired, true)
  assert.equal(select([candidate(), candidate({ storeId: 'legacy/tie' })]).canonicalReauthRequired, true)
})

test('F ACCESS_TOKEN_VALID_BUT_REFRESH_GENERATION_UNKNOWN: access validity is ignored', () => {
  const result = select([candidate({
    remoteOperationSucceeded: false,
    lastRemoteRotationCommitted: false,
    accessTokenValid: true,
  })])
  assert.equal(result.canonicalReauthRequired, true)
})

test('secret-bearing provenance fields are rejected without using or returning their values', () => {
  const result = select([candidate({ accessToken: 'synthetic-sensitive-value' })])
  assert.equal(result.canonicalReauthRequired, true)
  assert.equal(JSON.stringify(result).includes('synthetic-sensitive-value'), false)
})

test('G PENDING_REFRESH_INTENT_EXISTS: fail closed without selecting a store', () => {
  const result = select([candidate({ pendingRefreshIntent: true })])
  assert.equal(result.authoritativeStore, null)
  assert.equal(result.canonicalReauthRequired, true)
})

test('H NO_LEGACY_PROVEN_GENERATION: runner performs exactly one canonical Owner reauth and ordered canaries', async () => {
  const events = []
  const operation = (name, result = true) => async (...args) => { events.push([name, ...args]); return result }
  const report = await runFleetSharedCodexAuthMigrationV1({
    quiesceLunaDispatch: operation('quiesce Luna dispatch'),
    quiesceRefreshWriters: operation('quiesce refresh writers'),
    inventoryLegacyProvenance: operation('inventory legacy provenance', {
      expectedAccountIdentity: ACCOUNT,
      candidates: [],
    }),
    prepareCanonicalPermissionModelA: operation('prepare canonical Model A'),
    commitAuthoritativeToCanonical: operation('commit legacy'),
    ownerReauthCanonical: operation('canonical Owner reauth'),
    writeSharedConfigV3: operation('write shared config v3'),
    verifyZeroPerHomeRuntimeOpens: operation('verify zero per-home opens'),
    controlledRestart: operation('controlled restart'),
    runCanary: operation('canary'),
    verifyFleetHealth: operation('fleet health'),
  })
  assert.equal(report.canonicalReauthCount, 1)
  assert.equal(events.filter(([name]) => name === 'canonical Owner reauth').length, 1)
  assert.equal(events.some(([name]) => name === 'commit legacy'), false)
  assert.deepEqual(events.filter(([name]) => name === 'canary').map(([, name]) => name), ['CEO', 'HR', 'Podcast', 'Shopping'])
  assert.ok(events.findIndex(([name]) => name === 'inventory legacy provenance') > events.findIndex(([name]) => name === 'quiesce refresh writers'))
})

test('legacy inspection is rejected until both quiesce fences are established', () => {
  assert.throws(
    () => selectAuthoritativeCodexGeneration({
      lunaDispatchQuiesced: true,
      refreshWritersQuiesced: false,
      expectedAccountIdentity: ACCOUNT,
      candidates: [candidate()],
    }),
    (error) => error.code === 'SHARED_CODEX_QUIESCE_REQUIRED',
  )
})

test('real executable bindings complete isolated production-like migrate and safe rollback', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'shared-codex-production-like-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const rooted = (absolute) => join(root, absolute.slice(1))
  const provenancePath = '/control/provenance.json'
  const sharedConfigPath = '/Users/authsvc/.agent-core/agent-model-overrides.json'
  const artifactReceiptPath = '/control/artifact-receipt.json'
  const events = rooted('/control/events.jsonl')
  mkdirSync(rooted('/control'), { recursive: true })
  mkdirSync(join(rooted(sharedConfigPath), '..'), { recursive: true })
  writeFileSync(rooted(provenancePath), JSON.stringify({
    expectedAccountIdentity: ACCOUNT,
    candidates: Array.from({ length: 91 }, (_, index) => candidate({
      storeId: `/legacy/agent-${index + 1}`,
      generationId: `fs:1:${index + 1}`,
      remoteOperationSucceeded: false,
      atomicLocalCommitSucceeded: false,
      lastRemoteRotationCommitted: false,
    })),
  }))
  writeFileSync(rooted(sharedConfigPath), JSON.stringify({
    version: 3,
    routeCatalog: { luna: { provider: 'openai-codex', model: 'gpt-5.6-luna', credentialFile: '/tmp/legacy/.openai-codex-auth.json' } },
    overrides: {},
  }))
  const command = (name, body = '') => [process.execPath, '-e', `
    const fs=require('node:fs'); fs.appendFileSync(${JSON.stringify(events)}, ${JSON.stringify(`${name}\n`)}); ${body}
  `]
  const commands = {
    quiesceLunaDispatch: command('quiesce-dispatch'),
    quiesceRefreshWriters: command('quiesce-refresh'),
    ownerReauthCanonical: command('owner-reauth', "fs.mkdirSync(require('node:path').dirname(process.env.AGENT_CORE_CANONICAL_CREDENTIAL),{recursive:true});fs.writeFileSync(process.env.AGENT_CORE_CANONICAL_CREDENTIAL,'{}',{mode:0o600})"),
    grantControlPlaneAcl: command('grant-acl'),
    probeUid502Read: command('uid502-read', "fs.accessSync(process.env.AGENT_CORE_CANONICAL_CREDENTIAL,fs.constants.R_OK)"),
    probeUid502AtomicReplace: command('uid502-replace', "const p=process.env.AGENT_CORE_CANONICAL_CREDENTIAL,t=p+'.probe';fs.copyFileSync(p,t);fs.chmodSync(t,0o600);fs.renameSync(t,p)"),
    probeAuthsvcControlPlane: command('authsvc-control'),
    probeThirdUidDenied: command('third-uid-denied', "if((fs.statSync(process.env.AGENT_CORE_CANONICAL_CREDENTIAL).mode&0o077)!==0)process.exit(9)"),
    installPinnedArtifact: command('install-artifact', `fs.writeFileSync(process.env.AGENT_CORE_ARTIFACT_RECEIPT,JSON.stringify(${JSON.stringify({ ...FLEET_SHARED_CODEX_ARTIFACT_PIN, sourceStamp: 'dsh-codex-source-stamp-v1' })}))`),
    verifyZeroPerHomeRuntimeOpens: command('zero-per-home-opens'),
    controlledRestart: command('restart'),
    canaries: Object.fromEntries(['CEO', 'HR', 'Podcast', 'Shopping'].map((name) => [name, command(`canary-${name}`)])),
    verifyFleetHealth: command('fleet-health'),
    rollbackRuntime: command('rollback-retain-canonical'),
  }
  const config = {
    root,
    canonicalCredentialPath: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
    provenancePath, sharedConfigPath, artifactReceiptPath,
    artifact: FLEET_SHARED_CODEX_ARTIFACT_PIN,
    sourceStamp: 'dsh-codex-source-stamp-v1',
    commands,
  }
  const configFile = join(root, 'migration-config.json')
  writeFileSync(configFile, JSON.stringify(config))
  const cli = fileURLToPath(new URL('../src/shared-codex-migration-cli.js', import.meta.url))
  const migration = spawnSync(process.execPath, [cli, 'migrate', configFile], { encoding: 'utf8' })
  assert.equal(migration.status, 0, migration.stderr)
  const report = JSON.parse(migration.stdout)
  assert.equal(report.canonicalReauthCount, 1)
  assert.equal(readFileSync(events, 'utf8').split('\n').filter((line) => line === 'owner-reauth').length, 1)
  assert.equal(readFileSync(events, 'utf8').includes('canary-CEO\ncanary-HR\ncanary-Podcast\ncanary-Shopping\nfleet-health'), true)
  assert.equal(readFileSync(rooted(sharedConfigPath), 'utf8').includes(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE), true)
  assert.deepEqual(JSON.parse(readFileSync(rooted('/Users/authsvc/.agent-core/control/shared-codex-migration-fence.json'), 'utf8')), {
    version: 1, lunaDispatchQuiesced: true, refreshWritersQuiesced: true,
  })
  assert.equal((statSync(report.canonicalCredential).mode & 0o077), 0)
  const rollback = spawnSync(process.execPath, [cli, 'rollback', configFile], { encoding: 'utf8' })
  assert.equal(rollback.status, 0, rollback.stderr)
  assert.deepEqual(JSON.parse(rollback.stdout), { canonicalCredentialRetained: true, legacyCredentialRollback: false })
})
