/**
 * @agent-core/production-runtime/src/shared-codex-migration.js — the fleet
 * shared-Codex auth migration selection/migration functions, extracted
 * verbatim from compose.js (structure-only move so the composition stays
 * within the CODE_STRUCTURE_GUARDRAILS_V1 file limit; zero semantic change).
 *
 * compose.js re-exports both names so the existing test imports
 * (`packages/production-runtime/test/shared-codex-migration.test.js`) and the
 * executable keep their stable module paths.
 */

export function selectAuthoritativeCodexGeneration(input) {
  if (input?.lunaDispatchQuiesced !== true || input?.refreshWritersQuiesced !== true) {
    throw Object.assign(new Error('shared-codex-migration: both quiesce fences are required before legacy inspection'), { code: 'SHARED_CODEX_QUIESCE_REQUIRED' })
  }
  const { expectedAccountIdentity, candidates } = input
  if (typeof expectedAccountIdentity !== 'string' || expectedAccountIdentity === '' || !Array.isArray(candidates)) {
    throw Object.assign(new Error('shared-codex-migration: invalid non-secret provenance input'), { code: 'SHARED_CODEX_PROVENANCE_INVALID' })
  }
  const ambiguous = candidates.some((candidate) => (
    candidate === null
    || typeof candidate !== 'object'
    || Object.keys(candidate).some((key) => /(?:access|refresh).*token|token.*(?:access|refresh)|credentialHash|tokenHash/iu.test(key))
    || candidate.accountIdentity !== expectedAccountIdentity
    || candidate.pendingRefreshIntent === true
    || candidate.laterOutcomeUnknown === true
    || candidate.competingCommittedGeneration === true
  ))
  const proven = ambiguous ? [] : candidates.filter((candidate) => (
    typeof candidate.storeId === 'string' && candidate.storeId !== ''
    && typeof candidate.generationId === 'string' && /^fs:[0-9]+:[0-9]+$/u.test(candidate.generationId)
    && candidate.remoteOperationSucceeded === true
    && candidate.atomicLocalCommitSucceeded === true
    && candidate.committedBeforeQuiesceFence === true
    && candidate.laterSuccessfulRefresh === false
    && candidate.laterOutcomeUnknown === false
    && candidate.pendingRefreshIntent === false
    && candidate.competingCommittedGeneration === false
    && candidate.lastRemoteRotationCommitted === true
  ))
  if (new Set(proven.map((candidate) => candidate.generationId)).size !== 1 || proven.length !== 1) {
    return Object.freeze({ legacyCredentialReuseAllowed: false, authoritativeStore: null, canonicalReauthRequired: true, canonicalReauthCountMax: 1 })
  }
  return Object.freeze({
    legacyCredentialReuseAllowed: true, authoritativeStore: proven[0].storeId,
    generationId: proven[0].generationId, canonicalReauthRequired: false, canonicalReauthCountMax: 1,
  })
}

export async function runFleetSharedCodexAuthMigrationV1(operations) {
  const required = [
    'quiesceLunaDispatch', 'quiesceRefreshWriters', 'inventoryLegacyProvenance', 'prepareCanonicalPermissionModelA',
    'commitAuthoritativeToCanonical', 'ownerReauthCanonical', 'writeSharedConfigV3', 'verifyZeroPerHomeRuntimeOpens', 'controlledRestart', 'runCanary', 'verifyFleetHealth',
  ]
  for (const name of required) {
    if (typeof operations?.[name] !== 'function') throw new TypeError(`shared-codex-migration: operation ${name} is required`)
  }
  const lunaDispatchQuiesced = await operations.quiesceLunaDispatch(); const refreshWritersQuiesced = await operations.quiesceRefreshWriters()
  if (lunaDispatchQuiesced !== true || refreshWritersQuiesced !== true) {
    throw Object.assign(new Error('shared-codex-migration: quiesce failed'), { code: 'SHARED_CODEX_QUIESCE_REQUIRED' })
  }
  const inventory = await operations.inventoryLegacyProvenance()
  const selection = selectAuthoritativeCodexGeneration({ lunaDispatchQuiesced, refreshWritersQuiesced, ...inventory })
  await operations.prepareCanonicalPermissionModelA()
  let canonicalReauthCount = 0
  if (selection.legacyCredentialReuseAllowed) await operations.commitAuthoritativeToCanonical(selection.authoritativeStore, selection.generationId)
  else { canonicalReauthCount += 1; await operations.ownerReauthCanonical() }
  if (canonicalReauthCount > 1) throw new Error('shared-codex-migration: canonical reauth count exceeded 1')
  await operations.writeSharedConfigV3()
  await operations.verifyZeroPerHomeRuntimeOpens()
  await operations.controlledRestart()
  for (const canary of ['CEO', 'HR', 'Podcast', 'Shopping']) await operations.runCanary(canary)
  await operations.verifyFleetHealth()
  return Object.freeze({ selection, canonicalReauthCount, canaries: Object.freeze(['CEO', 'HR', 'Podcast', 'Shopping']) })
}
