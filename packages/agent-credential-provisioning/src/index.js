import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

import { readDefinition } from '../../agent-definition/src/config.js'
import { CREDENTIALS_STORE_ERROR, normalizeCredential } from '../../broker/src/credential-store.js'

import {
  readCredentialStoreDocument,
  withCredentialStoreLock,
  writeCredentialForAgent,
} from './store-writer.js'

export const AUTH_CONTRACT_MODES = Object.freeze({ v1: 'v1', v0: 'v0', v1Shadow: 'v1_shadow' })

export class CredentialProvisioningError extends Error {
  constructor(code, message, fields = {}) {
    super(message)
    this.name = 'CredentialProvisioningError'
    this.code = code
    Object.assign(this, fields)
  }
}

export const principalExternalRef = (agentId) => `agentcore:v1:principal:${agentId}`
export const clientExternalRef = (agentId) => `agentcore:v1:client:${agentId}`

function fail(code, message, fields = {}) {
  throw new CredentialProvisioningError(code, message, fields)
}

function requirePrerequisite(prerequisites, prerequisite) {
  if (prerequisites?.[prerequisite] !== true) {
    fail('external_prerequisite_missing', `external_prerequisite_missing(${prerequisite})`, { prerequisite })
  }
}

function entityId(value, kind) {
  const id = value?.id ?? value?.[`${kind}_id`] ?? value?.[`${kind}Id`]
  if (typeof id !== 'string' || id === '') fail('auth_malformed_response', `Auth ${kind} ensure response has no id`)
  return id
}

function created(value) {
  if (typeof value?.created !== 'boolean') fail('auth_malformed_response', 'Auth ensure response has no created flag')
  return value.created
}

function assertActive(value, code, fields) {
  if (value?.status !== 'active') fail(code, code, fields)
}

function secretsEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  const leftBytes = Buffer.from(left, 'utf8')
  const rightBytes = Buffer.from(right, 'utf8')
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

function assertPersistedCredentialMatches(persisted, createdCredential, agentId) {
  if (normalizeCredential(persisted) === undefined
    || persisted.clientId !== createdCredential.clientId
    || !secretsEqual(persisted.clientSecret, createdCredential.clientSecret)) {
    fail(CREDENTIALS_STORE_ERROR, 'credential provisioning: post-write consistency mismatch', {
      reason: 'post_write_consistency_mismatch',
      agentId,
      clientId: createdCredential.clientId,
    })
  }
}

/** Mode-aware interpretation of one verification mint result. */
export function classifyVerificationResult(result, {
  mode = AUTH_CONTRACT_MODES.v1,
  validDeployedAudience = true,
  prerequisiteDReady = false,
} = {}) {
  if (result?.status === 200) return { kind: 'credential_valid', authorization: 'granted' }
  if (result?.status === 503 && result.oauthError === 'temporarily_unavailable') {
    return { kind: 'inconclusive', reason: 'auth_server_state' }
  }
  if (result?.status === 401 && result.oauthError === 'invalid_client') {
    if (mode === AUTH_CONTRACT_MODES.v1 && !prerequisiteDReady) {
      return { kind: 'external_prerequisite', prerequisite: 'd', rotationAllowed: false }
    }
    return { kind: 'credential_invalid', rotationAllowed: true }
  }
  if (result?.status === 400 && result.oauthError === 'invalid_scope') {
    return { kind: 'credential_valid', authorization: 'denied' }
  }
  if (
    result?.status === 400
    && mode !== AUTH_CONTRACT_MODES.v1
    && ['invalid_grant', 'invalid_resource'].includes(result.oauthError)
  ) return { kind: 'credential_valid', authorization: 'denied' }
  if (result?.status === 400 && result.oauthError === 'invalid_target') {
    return validDeployedAudience
      ? { kind: 'configuration_drift', credentialValidated: true }
      : { kind: 'tool_configuration_error', credentialValidated: false }
  }
  return { kind: 'inconclusive', reason: 'unexpected_verification_response' }
}

/**
 * Phase A clean bootstrap only (Spec D.7.1/D.7.2). Auth and store writes are
 * injected seams; no production endpoint is contacted unless the caller
 * explicitly establishes prerequisite (c). Existing credentials (store entry
 * present, or an Auth client already holding the deterministic external_ref)
 * fail loud as existing_credential_resolution_required — their reconciliation
 * is Phase B and is deliberately not implemented here.
 */
export async function ensureAgentCredential({
  agentId,
  agentDefinitionFile,
  credentialsFile,
  auth,
  prerequisites = {},
  storeWriteOptions,
  verification = {
    mode: AUTH_CONTRACT_MODES.v1,
    resource: 'svc-forum',
    scope: 'forum.read',
    validDeployedAudience: true,
    prerequisiteDReady: false,
  },
}) {
  // D.7.1 steps 1-2: Agent Definition read; State A precedes every store/Auth step.
  const definition = readDefinition(agentDefinitionFile)
  const agent = definition?.agents.find((candidate) => candidate.id === agentId)
  if (agent === undefined) fail('agent_not_found', 'agent_not_found', { agentId })

  // The same-directory lock covers store classification, management-token
  // preflight, S1/S2, and the one write. Concurrent same-Agent ensures queue
  // before observing/mutating Auth, so only one clean bootstrap can run.
  return withCredentialStoreLock(credentialsFile, storeWriteOptions, async (lock) => {
    // D.7.1 step 3: full trusted store read + validation BEFORE Auth mutation.
    const store = await readCredentialStoreDocument(credentialsFile, {
      ...storeWriteOptions,
      expectedDirectoryIdentity: lock.directoryIdentity,
    })
    const stored = store.credentials[agentId]

    // D.7.1 steps 4/6: existing entry is Phase B territory — zero Auth/write.
    if (stored !== undefined) {
      fail('existing_credential_resolution_required', 'existing_credential_resolution_required', {
        agentId,
        reason: 'store_entry_present',
        clientId: stored.clientId,
      })
    }

    // D.7.1 step 5: entry absent — explicit (c), then acquire its operation-
    // scoped authorization once before S1. S1 and S2 reuse the same closure.
    requirePrerequisite(prerequisites, 'c')
    if (auth === null || typeof auth !== 'object' || typeof auth.beginManagementOperation !== 'function') {
      fail('auth_configuration_error', 'Auth provisioning client is required')
    }
    let management
    try {
      management = await auth.beginManagementOperation()
    } catch (error) {
      if (error?.code === 'EXTERNAL_PREREQUISITE_MISSING') {
        fail('external_prerequisite_missing', 'external_prerequisite_missing(c)', { prerequisite: 'c' })
      }
      throw error
    }
    if (
      management === null
      || typeof management !== 'object'
      || typeof management.ensurePrincipal !== 'function'
      || typeof management.ensureClient !== 'function'
    ) fail('auth_configuration_error', 'Auth management operation is invalid')

    const verificationContext = {
      ...verification,
      prerequisiteDReady: prerequisites.d === true,
    }
    const principal = await management.ensurePrincipal({
      external_ref: principalExternalRef(agentId),
      principal_type: 'agent',
      agent_id: agentId,
      display_name: agent.name || agentId,
    })
    const principalId = entityId(principal, 'principal')
    created(principal)
    assertActive(principal, 'auth_principal_not_active', { agentId, principalId })

    const client = await management.ensureClient({
      external_ref: clientExternalRef(agentId),
      principal_id: principalId,
    })
    const clientId = entityId(client, 'client')
    const clientCreated = created(client)
    assertActive(client, 'auth_client_missing_or_revoked', { agentId, clientId })

    if (!clientCreated) {
      fail('existing_credential_resolution_required', 'existing_credential_resolution_required', {
        agentId,
        reason: 'auth_client_present_without_store_entry',
        clientId,
      })
    }

    const credential = normalizeCredential({ clientId, clientSecret: client?.client_secret ?? client?.clientSecret })
    if (credential === undefined) fail('auth_client_secret_missing', 'New Auth client response has no usable secret', { agentId, clientId })
    await writeCredentialForAgent(credentialsFile, agentId, credential, { ...storeWriteOptions, lock })
    const persistedDocument = await readCredentialStoreDocument(credentialsFile, {
      ...storeWriteOptions,
      expectedDirectoryIdentity: lock.directoryIdentity,
    })
    const persistedCredential = persistedDocument.credentials[agentId]
    assertPersistedCredentialMatches(persistedCredential, credential, agentId)
    const result = await auth.verifyCredential({ credential: persistedCredential, ...verificationContext })
    const classification = classifyVerificationResult(result, verificationContext)
    if (classification.kind === 'credential_valid') {
      return { outcome: 'provisioned', agentId, principalId, clientId, verification: classification }
    }
    if (classification.kind === 'external_prerequisite') {
      fail('external_prerequisite_missing', 'external_prerequisite_missing(d)', {
        prerequisite: 'd',
        agentId,
        clientId,
        profile401DoesNotTriggerRotation: true,
      })
    }
    fail(
      classification.kind === 'configuration_drift' ? 'auth_configuration_drift' : 'credential_verification_inconclusive',
      'New credential could not be conclusively verified',
      { agentId, clientId, verification: classification },
    )
  })
}

export { createAuthProvisioningClient } from './auth-client.js'
export {
  readCredentialStoreDocument,
  writeCredentialForAgent,
} from './store-writer.js'
