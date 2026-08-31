import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  runFleetSharedCodexAuthMigrationV1,
  selectAuthoritativeCodexGeneration,
} from '../src/compose.js'

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
