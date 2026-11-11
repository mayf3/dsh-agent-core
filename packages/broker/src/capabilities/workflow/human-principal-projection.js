/**
 * AGENT_CORE_WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_V0 — one exact LOCAL
 * provisioning capability. The trusted production-runtime handler owns the
 * authoritative validation and all service I/O; this manifest is pure data
 * and exposes no URL, credential, wire body, idempotency key, or caller input.
 */

export const TARGET_HUMAN_PRINCIPAL_ID = '8902db0d-429a-4e37-985c-f8b92d4b78fb'
export const WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID = 'workflow_human_principal_projection'

const errorTable = [
  { code: 'invalid_arguments', description: 'Arguments differ from the exact frozen Human projection target.' },
  { code: 'credential_unavailable', description: 'No trusted caller credential is bound.' },
  { code: 'credential_invalid', description: 'The trusted caller credential was rejected.' },
  { code: 'access_denied', description: 'The caller lacks workflow.admin.' },
  { code: 'provisioning_not_allowed', description: 'The caller is not an allowed active Agent provisioning actor.' },
  { code: 'provisioning_actor_not_provisioned', description: 'The provisioning actor has not bootstrapped its own Principal.' },
  { code: 'principal_not_found', description: 'The exact Principal is absent.' },
  { code: 'principal_type_conflict', description: 'The UUID already belongs to a non-Human Principal; no POST is performed after preflight detects it.' },
  { code: 'principal_type_invalid', description: 'The service rejected the fixed Principal type.' },
  { code: 'invalid_input', description: 'The service rejected the fixed provisioning body.' },
  { code: 'invalid_idempotency_key', description: 'The service rejected the trusted runtime-generated idempotency key.' },
  { code: 'idempotency_conflict', description: 'The service observed an idempotency-key conflict.' },
  { code: 'command_still_processing', description: 'The service reports that the exact command is still processing.' },
  { code: 'internal_consistency_error', description: 'The Workflow service reported an internal consistency failure.' },
  { code: 'service_unavailable', description: 'The Workflow service or its storage is unavailable.' },
  { code: 'transport_failure', description: 'Trusted token acquisition or service transport failed before a known projection outcome.' },
  { code: 'malformed_response', description: 'A service response could not be interpreted safely.' },
  { code: 'readback_mismatch', description: 'The mandatory post-write readback is not the exact active Human projection.' },
  { code: 'projection_outcome_unknown', description: 'A possible write cannot be reconciled by the mandatory fresh readback; do not blind-retry.' },
  { code: 'unsupported_operation', description: 'The execute-time LOCAL handler is unavailable.' },
  { code: 'internal_error', description: 'The trusted handler failed closed without exposing secret detail.' },
]

export const workflowHumanPrincipalProjectionManifest = {
  id: WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID,
  toolName: 'workflow_human_principal_projection',
  selector: 'operation',
  name: 'Workflow Human Principal Projection',
  description: 'Provision exactly one Owner-authorized canonical Human identity into svc-workflow as an active HUMAN Principal. This tool cannot select another identity, type, state, source, URL, credential, or idempotency key.',
  local: { resource: 'svc-workflow' },
  requiredScopes: ['workflow.admin'],
  errors: errorTable,
  operations: [
    {
      name: 'provision',
      description: 'Project the one frozen canonical Human identity after fresh preflight and verify the exact post-state by fresh readback.',
      arguments: {
        additionalProperties: false,
        properties: {
          principalId: {
            type: 'string',
            enum: [TARGET_HUMAN_PRINCIPAL_ID],
            description: 'Exact Owner-authorized canonical Human UUID.',
          },
          principalType: {
            type: 'string',
            enum: ['HUMAN'],
            description: 'Frozen executor type.',
          },
          status: {
            type: 'string',
            enum: ['active'],
            description: 'Frozen enabled state.',
          },
        },
        required: ['principalId', 'principalType', 'status'],
      },
      result: { type: 'json' },
      errors: errorTable.map((entry) => entry.code),
    },
  ],
}

export const manifests = [workflowHumanPrincipalProjectionManifest]
