/**
 * AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1 — the
 * `agent_resolve_principal_by_agent` LOCAL capability manifest (accepted,
 * implementation_authority: contracts).
 *
 * One capability, one READ-ONLY operation (`resolve`): one exact Agent ID in,
 * the exact stored Auth Agent Principal UUID out. Pure data in the same shape
 * as the forward sibling agent-principal-resolution.js: the agentId grammar
 * and the closed two-field response contract are enforced authoritatively by
 * the TRUSTED handler in the control plane (packages/production-runtime); the
 * broker structural validator cannot express the agt_ pattern, so what is
 * declared here is the model-facing schema hint plus defense-in-depth, never
 * the authority.
 *
 * Identity: `local.resource = 'identity-directory'` names the auth-service
 * audience registered by AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
 * (CTR-AID-001); `requiredScopes = ['auth.directory.read']` is that audience's
 * baseline internal directory scope, which canonical internal callers already
 * hold — no new scope, audience, or grant is created by this capability. The
 * `agentId` argument names the TARGET to resolve — it must never select caller
 * credentials, source identity or any authorization input: the gateway derives
 * the caller from the actual gateway caller relationship, never from tool
 * arguments, and the trusted handler re-derives the credential for the token
 * it spends on the Auth read.
 *
 * STRICT_CANONICAL boundary (Owner semantic correction): this resolves the
 * production-effective STORED identity relation. No canonical-lifecycle claim
 * is made anywhere; the tool is deliberately NOT named `…canonical…`.
 *
 * The error table is the CLOSED CTR-APR-004 taxonomy. Auth target outcomes map
 * to stable lower-case codes (`agent_not_found`, `principal_not_agent`,
 * `principal_disabled`, `identity_resolution_ambiguous`); every
 * 500/504/timeout/malformed/mismatched response is
 * `identity_resolution_unavailable` — never a fabricated absence and never a
 * success. `credential_unavailable` (not `credential_missing`) matches the
 * sibling manifest's broker-layer naming. `transport_failure` /
 * `unsupported_operation` are permanent emissions of the broker's own
 * grant/handler pipeline, declared for the same reason as the sibling.
 */

const AGENT_ID_PATTERN = '^agt_[a-z0-9-]+$'

const errorTable = [
  { code: 'invalid_arguments', description: 'Arguments violate the exact single-field input contract (agentId matching ^agt_[a-z0-9-]+$ length 5..128 required).' },
  { code: 'credential_unavailable', description: 'No trusted caller credential is bound.' },
  { code: 'credential_invalid', description: 'The trusted caller credential was rejected by the auth-service.' },
  { code: 'access_denied', description: 'The caller lacks auth.directory.read on the auth-service side.' },
  { code: 'agent_not_found', description: 'No Principal exists for the exact agentId (auth 404 AGENT_NOT_FOUND).' },
  { code: 'principal_not_agent', description: 'The relation row is not an AGENT Principal (auth 422).' },
  { code: 'principal_disabled', description: 'The AGENT Principal exists but is disabled (auth 200 principalStatus=disabled).' },
  { code: 'identity_resolution_ambiguous', description: 'The exact agentId relation is ambiguous (auth 409).' },
  { code: 'identity_resolution_unavailable', description: 'The Auth read failed, timed out, or returned a malformed/mismatched body; nothing is retried or fabricated.' },
  { code: 'target_not_found', description: 'No Agent Definition exists for the resolved exact agentId.' },
  { code: 'target_disabled', description: 'The resolved Agent Definition exists but is disabled (not deliverable).' },
  { code: 'transport_failure', description: 'The auth-service/broker transport failed before the Auth read could be classified.' },
  { code: 'unsupported_operation', description: 'The execute-time local handler is not resolvable (missing or miswired provider).' },
  { code: 'internal_error', description: 'The trusted handler failed before producing a resolution outcome.' },
]

/** Wire capability id (also the provider handlers key — see broker index). */
export const AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID = 'agent_resolve_principal_by_agent'

export const agentPrincipalReverseResolutionManifest = {
  id: AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID,
  toolName: 'agent_resolve_principal_by_agent',
  selector: 'operation',
  name: 'Agent Principal Resolution By Agent',
  description: 'Resolve one exact Agent ID to its exact stored auth-service AGENT Principal UUID (read-only; auth-service is the identity authority, the local Agent Definition registry proves deliverability). When downstream Workflow needs a Principal UUID and you only know an Agent name or agentId, FIRST resolve the exact agentId through agent_directory, THEN call this tool. Never guess, recall, or embed a UUID from anywhere else. No display-name or fuzzy matching here, no writes, no message delivery, no retries.',
  local: { resource: 'identity-directory' },
  requiredScopes: ['auth.directory.read'],
  errors: errorTable,
  operations: [
    {
      name: 'resolve',
      description: 'Resolve one exact Agent ID to the exact stored AGENT Principal UUID.',
      arguments: {
        additionalProperties: false,
        properties: {
          agentId: {
            type: 'string',
            minLength: 5,
            maxLength: 128,
            pattern: AGENT_ID_PATTERN,
            description: `Exact Agent ID (${AGENT_ID_PATTERN}); obtain it from agent_directory when given a display name.`,
          },
        },
        required: ['agentId'],
      },
      result: { type: 'json' },
      errors: errorTable.map((e) => e.code),
    },
  ],
}

export const manifests = [agentPrincipalReverseResolutionManifest]
