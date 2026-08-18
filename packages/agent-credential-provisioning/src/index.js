import { readDefinition } from '../../agent-definition/src/config.js'
import { normalizeCredential } from '../../broker/src/credential-store.js'

import { readCredentialStoreDocument, writeCredentialForAgent } from './store-writer.js'

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

async function rotateAndPersist({ auth, prerequisites, credentialsFile, agentId, clientId, verification, storeWriteOptions }) {
  requirePrerequisite(prerequisites, 'b')
  if (typeof auth.rotateClientSecret !== 'function') requirePrerequisite({}, 'b')
  const rotated = await auth.rotateClientSecret({ clientId })
  const returnedClientId = entityId(rotated, 'client')
  const credential = normalizeCredential({ clientId: returnedClientId, clientSecret: rotated?.client_secret ?? rotated?.clientSecret })
  if (returnedClientId !== clientId || credential === undefined) {
    fail('auth_rotation_malformed_response', 'Auth same-client rotation response is invalid', { agentId, clientId })
  }
  await writeCredentialForAgent(credentialsFile, agentId, credential, storeWriteOptions)
  const result = await auth.verifyCredential({ credential, ...verification })
  const classification = classifyVerificationResult(result, verification)
  if (classification.kind !== 'credential_valid') {
    fail('credential_verification_inconclusive', 'Rotated credential could not be conclusively verified', {
      agentId,
      clientId,
      verification: classification,
    })
  }
  return { outcome: 'rotated_same_client', agentId, clientId, verification: classification }
}

/**
 * Frozen A-G deployment-side state machine. Auth and store writes are injected
 * seams; no production endpoint is contacted unless the caller explicitly
 * establishes prerequisite (c).
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
  const definition = readDefinition(agentDefinitionFile)
  const agent = definition?.agents.find((candidate) => candidate.id === agentId)
  if (agent === undefined) fail('agent_not_found', 'agent_not_found', { agentId })

  requirePrerequisite(prerequisites, 'c')
  if (auth === null || typeof auth !== 'object') fail('auth_configuration_error', 'Auth provisioning client is required')
  const verificationContext = {
    ...verification,
    prerequisiteDReady: prerequisites.d === true,
  }

  const principal = await auth.ensurePrincipal({
    external_ref: principalExternalRef(agentId),
    principal_type: 'agent',
    agent_id: agentId,
    display_name: agent.name || agentId,
  })
  const principalId = entityId(principal, 'principal')
  created(principal)
  assertActive(principal, 'auth_principal_not_active', { agentId, principalId })

  const client = await auth.ensureClient({
    external_ref: clientExternalRef(agentId),
    principal_id: principalId,
  })
  const clientId = entityId(client, 'client')
  const clientCreated = created(client)
  assertActive(client, 'auth_client_missing_or_revoked', { agentId, clientId })

  const store = await readCredentialStoreDocument(credentialsFile)
  const stored = store.credentials[agentId]

  if (clientCreated) {
    if (stored !== undefined) {
      fail('auth_client_missing_or_revoked', 'Existing store entry conflicts with newly-created Auth client', {
        agentId,
        clientId: stored.clientId,
      })
    }
    const credential = normalizeCredential({ clientId, clientSecret: client?.client_secret ?? client?.clientSecret })
    if (credential === undefined) fail('auth_client_secret_missing', 'New Auth client response has no usable secret', { agentId, clientId })
    await writeCredentialForAgent(credentialsFile, agentId, credential, storeWriteOptions)
    const result = await auth.verifyCredential({ credential, ...verificationContext })
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
  }

  if (stored === undefined) {
    return rotateAndPersist({ auth, prerequisites, credentialsFile, agentId, clientId, verification: verificationContext, storeWriteOptions })
  }
  if (stored.clientId !== clientId) {
    fail('auth_client_missing_or_revoked', 'Stored client does not match deterministic Auth client', {
      agentId,
      clientId: stored.clientId,
    })
  }

  const credential = normalizeCredential(stored)
  const result = await auth.verifyCredential({ credential, ...verificationContext })
  const classification = classifyVerificationResult(result, verificationContext)
  if (classification.kind === 'credential_valid') {
    return { outcome: 'noop', agentId, principalId, clientId, verification: classification }
  }
  if (classification.kind === 'external_prerequisite') {
    fail('external_prerequisite_missing', 'external_prerequisite_missing(d)', {
      prerequisite: 'd',
      agentId,
      clientId,
      profile401DoesNotTriggerRotation: true,
    })
  }
  if (classification.kind === 'credential_invalid') {
    return rotateAndPersist({ auth, prerequisites, credentialsFile, agentId, clientId, verification: verificationContext, storeWriteOptions })
  }
  fail(
    classification.kind === 'configuration_drift' ? 'auth_configuration_drift' : 'credential_verification_inconclusive',
    'Existing credential could not be conclusively verified',
    { agentId, clientId, verification: classification },
  )
}

export { createAuthProvisioningClient } from './auth-client.js'
export {
  readCredentialStoreDocument,
  removeCredentialForAgent,
  writeCredentialForAgent,
} from './store-writer.js'
