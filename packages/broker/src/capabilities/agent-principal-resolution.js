/**
 * AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1 — the
 * `agent_resolve_principal` LOCAL capability manifest (accepted,
 * implementation_authority: contracts).
 *
 * One capability, one READ-ONLY operation (`resolve`): one exact AGENT
 * Principal UUID in, the canonical enabled agentId out. The manifest is pure
 * data in the same shape as agent-session-messaging.js: the UUID grammar and
 * the closed two-field response contract are enforced authoritatively by the
 * TRUSTED handler in the control plane (packages/production-runtime); the
 * broker structural validator cannot express the UUID pattern, so what is
 * declared here is the model-facing schema hint plus defense-in-depth, never
 * the authority.
 *
 * Identity: `local.resource = 'agent-principal-resolution'` names the
 * auth-service audience registered by AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1
 * (CTR-EAPR-001); `requiredScopes = ['auth.agent.resolve']` is that audience's
 * only registered scope. The `principalId` argument names the TARGET to
 * resolve — it must never select caller credentials, source identity or the
 * audit actor: the gateway derives the caller from the actual gateway caller
 * relationship (identity.js), never from tool arguments, and the trusted
 * handler re-derives the credential for the token it spends on the Auth read.
 *
 * The error table is the CLOSED §5/CTR-EPAR-004 taxonomy. Auth target errors
 * map to stable lower-case codes (`principal_not_found`,
 * `principal_not_agent`, `principal_disabled`, `agent_mapping_missing`,
 * `identity_resolution_ambiguous`); every 500/504/timeout/malformed response
 * is `identity_resolution_unavailable` — never a fabricated absence and never
 * a success. `credential_unavailable` (not `credential_missing`) matches the
 * sibling ASM manifest's broker-layer naming (review SPEC_GAP closure).
 * `transport_failure` / `unsupported_operation` are permanent emissions of the
 * broker's own grant/handler pipeline, declared for the same reason as ASM.
 */

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const errorTable = [
  { code: 'invalid_arguments', description: 'Arguments violate the exact single-field input contract (principalId UUID required).' },
  { code: 'credential_unavailable', description: 'No trusted caller credential is bound.' },
  { code: 'credential_invalid', description: 'The trusted caller credential was rejected by the auth-service.' },
  { code: 'access_denied', description: 'The caller lacks the auth.agent.resolve grant.' },
  { code: 'principal_not_found', description: 'No MachinePrincipal exists for the exact UUID (auth 404).' },
  { code: 'principal_not_agent', description: 'The Principal exists but is not of type AGENT (auth 422).' },
  { code: 'principal_disabled', description: 'The AGENT Principal exists but is disabled (auth 409).' },
  { code: 'agent_mapping_missing', description: 'The AGENT Principal has no non-empty canonical agentId (auth 409).' },
  { code: 'identity_resolution_ambiguous', description: 'The exact UUID or its reverse agentId relation is ambiguous (auth 409).' },
  { code: 'identity_resolution_unavailable', description: 'The Auth read failed, timed out, or returned a malformed body; nothing is retried or fabricated.' },
  { code: 'target_not_found', description: 'No Agent Definition exists for the resolved exact agentId.' },
  { code: 'target_disabled', description: 'The resolved Agent Definition exists but is disabled (not deliverable).' },
  { code: 'transport_failure', description: 'The auth-service/broker transport failed before the Auth read could be classified.' },
  { code: 'unsupported_operation', description: 'The execute-time local handler is not resolvable (missing or miswired provider).' },
  { code: 'internal_error', description: 'The trusted handler failed before producing a resolution outcome.' },
]

/** Wire capability id (also the provider handlers key — see broker index). */
export const AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID = 'agent_resolve_principal'

export const agentPrincipalResolutionManifest = {
  id: AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID,
  toolName: 'agent_resolve_principal',
  selector: 'operation',
  name: 'Agent Principal Resolution',
  description: 'Resolve one exact Workflow assignee AGENT Principal UUID to its canonical enabled Agent id (read-only; auth-service is the identity authority, the local Agent Definition registry proves deliverability). No guessing, no display-name or fuzzy matching, no writes, no message delivery, no retries.',
  local: { resource: 'agent-principal-resolution' },
  requiredScopes: ['auth.agent.resolve'],
  errors: errorTable,
  operations: [
    {
      name: 'resolve',
      description: 'Resolve one exact AGENT Principal UUID (canonical 8-4-4-4-12 hex, case-insensitive) to the exact enabled agentId.',
      arguments: {
        additionalProperties: false,
        properties: {
          principalId: {
            type: 'string',
            minLength: 36,
            maxLength: 36,
            description: `Exact AGENT Principal UUID (${UUID_PATTERN.source}); hex case is equivalent.`,
          },
        },
        required: ['principalId'],
      },
      result: { type: 'json' },
      errors: errorTable.map((e) => e.code),
    },
  ],
}

export const manifests = [agentPrincipalResolutionManifest]
