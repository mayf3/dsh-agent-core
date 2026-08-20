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

  // D.7.1 step 3: full store read + validation BEFORE any Auth identity mutation.
  const store = await readCredentialStoreDocument(credentialsFile)
  const stored = store.credentials[agentId]

  // D.7.1 steps 4/6: target entry classification; an existing entry is Phase B
  // reconciliation territory — zero Auth, S1, S2, claim, rotation, store writes.
  if (stored !== undefined) {
    fail('existing_credential_resolution_required', 'existing_credential_resolution_required', {
      agentId,
      reason: 'store_entry_present',
      clientId: stored.clientId,
    })
  }

  // D.7.1 step 5: entry absent — (c) gate, then S1, S2, secret write, mint.
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

  if (!clientCreated) {
    // The deterministic Auth client already exists while the store has no
    // entry (State E/F shape). Reconciliation — including rotation, claim,
    // or a read-only client resolve — is Phase B (D.7.3): fail loud, keep
    // the existing identity, create no second client, write nothing.
    fail('existing_credential_resolution_required', 'existing_credential_resolution_required', {
      agentId,
      reason: 'auth_client_present_without_store_entry',
      clientId,
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
    // Ownerless-v1 401: prerequisite (d) evidence. Never rotate, never delete
    // the freshly created identity, never bind a fake owner.
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

export { createAuthProvisioningClient } from './auth-client.js'
export {
  readCredentialStoreDocument,
  removeCredentialForAgent,
  writeCredentialForAgent,
} from './store-writer.js'
