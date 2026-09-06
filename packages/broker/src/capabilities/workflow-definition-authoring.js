/**
 * @agent-core/broker — Workflow Definition Authoring capability manifest (V3).
 *
 * Mechanical extraction from capabilities/workflow.js (structure-gate
 * UNREGISTERED_LEGACY_TOUCHED fix under CODE_STRUCTURE_GUARDRAILS_V1): the
 * workflow_definition_authoring manifest data lives here so the legacy
 * workflow.js file stops growing; workflow.js keeps only the import and
 * manifests-inventory wiring. The shared svc-workflow base/auth error rows
 * moved with it as the single source; workflow.js imports them back.
 *
 * Contract: AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V3 (accepted).
 * ONE existing tool, FOUR operations: create_definition,
 * create_draft_version, replace_draft_graph, publish_version. svc-workflow
 * stays authoritative for identity, Domain Owner authorization, graph
 * validation and lifecycle; the transport trusted seam supplies the
 * Idempotency-Key; the model cannot override caller identity or credentials.
 * Linear steps carry only canonical work-assignment Principal references.
 */

import { withTransportErrors } from '../transport.js'

export const baseErrors = [
  { code: 'invalid_arguments', description: 'Arguments did not satisfy the operation schema.' },
  { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
]

/** Auth-layer codes every svc-workflow endpoint can produce (claims.rs / error.rs). */
export const authErrors = [
  { code: 'unauthenticated', description: 'Downstream rejected the bearer token (HTTP 401).' },
  { code: 'forbidden', description: 'Downstream rejected the required scope (HTTP 403).' },
]

const definitionAuthoringErrors = [
  { code: 'unknown_field', description: 'Request contains an unknown field (HTTP 400).' },
  { code: 'invalid_json', description: 'Request JSON is invalid for the endpoint (HTTP 400).' },
  { code: 'missing_idempotency_key', description: 'Idempotency-Key is missing (HTTP 400).' },
  { code: 'invalid_idempotency_key', description: 'Idempotency-Key is invalid (HTTP 400).' },
  { code: 'direct_token_required', description: 'Definition writes require a Direct Machine Token (HTTP 403).' },
  { code: 'domain_disabled', description: 'The owning domain is disabled (HTTP 403).' },
  { code: 'definition_not_found', description: 'Definition/version is absent or intentionally not visible (HTTP 404).' },
  { code: 'definition_key_conflict', description: 'Definition key already exists (HTTP 409).' },
  { code: 'definition_not_editable', description: 'Definition is not editable (HTTP 409).' },
  { code: 'definition_version_immutable', description: 'Definition version is immutable (HTTP 409).' },
  { code: 'revision_conflict', description: 'Expected revision is stale (HTTP 409).' },
  { code: 'idempotency_conflict', description: 'Idempotency key was reused for a different request (HTTP 409).' },
  { code: 'size_limit_exceeded', description: 'Request body exceeds the service limit (HTTP 413).' },
  { code: 'graph_validation_failed', description: 'Canonical graph rejected (HTTP 422). Read the safe rule name and correction in detail; correct that rule before retrying.' },
  { code: 'invalid_semantic_model_version', description: 'Semantic model version is not supported (HTTP 422).' },
  { code: 'command_still_processing', description: 'The idempotent command is still processing (HTTP 425).' },
  { code: 'internal_consistency_error', description: 'Downstream validation/consistency failure (HTTP 500).' },
  { code: 'service_unavailable', description: 'Downstream storage or parsing failure (HTTP 503).' },
]

const definitionNodeItem = {
  type: 'object',
  additionalProperties: false,
  properties: {
    node_key: { type: 'string' },
    display_name: { type: 'string' },
    order_index: { type: 'integer' },
    node_type: { type: 'string', enum: ['DRAFT', 'NORMAL', 'TASK', 'TERMINAL'] },
    assignee_ref_type: { type: 'string', enum: ['WORKFLOW_CREATOR', 'DOMAIN_OWNER', 'FIXED_PRINCIPAL', 'INSTANCE_INPUT_PRINCIPAL'] },
    fixed_principal_id: { type: 'string' },
    assignee_input_key: { type: 'string' },
    instructions: { type: 'string' },
    primary_advance_transition_key: { type: 'string' },
    metadata: { type: 'json' },
  },
  required: ['node_key', 'display_name', 'order_index', 'node_type'],
}

const definitionTransitionItem = {
  type: 'object',
  additionalProperties: false,
  properties: {
    transition_key: { type: 'string' },
    display_name: { type: 'string' },
    source_node_key: { type: 'string' },
    target_node_key: { type: 'string' },
    transition_effect: { type: 'string', enum: ['ADVANCE', 'RETURN', 'TERMINATE'] },
    submission_schema: { type: 'json' },
    metadata: { type: 'json' },
  },
  required: ['transition_key', 'display_name', 'source_node_key', 'target_node_key', 'transition_effect'],
}

/** Definition-management writes, intentionally separate from instance execution. */
export const workflowDefinitionAuthoringManifest = withTransportErrors({
  id: 'workflow_definition_authoring',
  toolName: 'workflow_definition_authoring',
  name: 'Workflow Definition Authoring',
  description: 'Create a workflow definition, create its draft version, replace the draft using simple ordered steps or a complete graph, then publish the version. For a common linear workflow, create the draft explicitly with semanticModelVersion=3 and replace it with steps + terminalOutcome; the service validates the generated graph. Publish separately and instantiate the exact published version through workflow_execute. svc-workflow remains authoritative for identity, Domain Owner authorization, graph validation and lifecycle. Resolve the domainId argument first via workflow_my_domains (choose a domain where caller_role is DOMAIN_OWNER).',
  requiredScopes: ['workflow.execute'],
  errors: [...baseErrors, ...authErrors, ...definitionAuthoringErrors],
  operations: [
    {
      name: 'create_definition',
      description: 'Create a workflow definition in a domain.',
      arguments: {
        additionalProperties: false,
        properties: {
          domainId: { type: 'string', description: 'Target workflow domain id (UUID). Resolve canonically via the workflow_my_domains capability: list your domains and pass one where caller_role is DOMAIN_OWNER (only owners may author); never guess, use display names, or hard-code a UUID. The service still enforces Domain Owner authorization server-side.' }, definitionKey: { type: 'string' }, displayName: { type: 'string' },
          description: { type: 'string' }, metadata: { type: 'json' },
        },
        required: ['domainId', 'definitionKey', 'displayName'],
      },
      result: { type: 'json' }, errors: ['invalid_arguments'],
      http: { target: 'svc-workflow', method: 'POST', path: '/internal/v1/domains/{domainId}/definitions', pathParams: ['domainId'], body: ['definitionKey', 'displayName', 'description', 'metadata'], idempotencyKey: true },
    },
    {
      name: 'create_draft_version',
      description: 'Create a DRAFT version of an existing definition.',
      arguments: {
        additionalProperties: false,
        properties: {
          domainId: { type: 'string', description: 'Target workflow domain id (UUID). Resolve canonically via the workflow_my_domains capability: list your domains and pass one where caller_role is DOMAIN_OWNER (only owners may author); never guess, use display names, or hard-code a UUID. The service still enforces Domain Owner authorization server-side.' }, definitionId: { type: 'string' }, contextSchema: { type: 'json' },
          jsonSchemaDialect: { type: 'string' }, validatorVersion: { type: 'string' }, metadata: { type: 'json' },
          semanticModelVersion: { type: 'integer', enum: [1, 2, 3], description: 'Omitted means Legacy (1); 2 is Minimal; 3 is Visit Activation. These are semantic choices, not quality or newness rankings. Use explicit 3 for linear steps + terminalOutcome authoring; omission is forwarded unchanged to preserve the service default.' },
        },
        required: ['domainId', 'definitionId'],
      },
      result: { type: 'json' }, errors: ['invalid_arguments'],
      http: { target: 'svc-workflow', method: 'POST', path: '/internal/v1/domains/{domainId}/definitions/{definitionId}/versions', pathParams: ['domainId', 'definitionId'], body: ['contextSchema', 'jsonSchemaDialect', 'validatorVersion', 'metadata', 'semanticModelVersion'], idempotencyKey: true },
    },
    {
      name: 'replace_draft_graph',
      description: 'Atomically replace a DRAFT graph using exactly one form: full nodes + transitions, OR linear steps + terminalOutcome on a model-3 draft. Linear supports 1..32 ordered work steps with exact Principal UUID assignments discovered canonically, not display-name routing. Do not supply graph identifiers or transitions for linear input. Branches, loops and custom effects use the existing full form. Success means the service canonical validator accepted the graph; publish separately. On rejection, correct the named rule in the error detail.',
      arguments: {
        additionalProperties: false,
        properties: {
          domainId: { type: 'string', description: 'Target workflow domain id (UUID). Resolve canonically via the workflow_my_domains capability: list your domains and pass one where caller_role is DOMAIN_OWNER (only owners may author); never guess, use display names, or hard-code a UUID. The service still enforces Domain Owner authorization server-side.' }, definitionId: { type: 'string' }, definitionVersionId: { type: 'string' },
          contextSchema: { type: 'json' }, nodes: { type: 'array', items: definitionNodeItem },
          transitions: { type: 'array', items: definitionTransitionItem },
          steps: { type: 'array', description: 'Linear form only: 1..32 ordered work steps. Requires terminalOutcome; excludes nodes and transitions.', items: {
            type: 'object', additionalProperties: false,
            properties: {
              displayName: { type: 'string', description: 'Nonblank step name, 1..200 Unicode characters.' },
              assigneePrincipalId: { type: 'string', description: 'Exact canonical assignee Principal UUID from existing identity discovery; never an Agent display name or caller identity override.' },
              instructions: { type: 'string', description: 'Nonblank task instructions, 1..4000 Unicode characters, preserved verbatim.' },
            },
            required: ['displayName', 'assigneePrincipalId', 'instructions'],
          } },
          terminalOutcome: { type: 'string', description: 'Linear form only: nonblank terminal outcome name, 1..200 Unicode characters. Requires steps.' },
        },
        required: ['domainId', 'definitionId', 'definitionVersionId'],
      },
      result: { type: 'json' }, errors: ['invalid_arguments'],
      http: { target: 'svc-workflow', method: 'PUT', path: '/internal/v1/domains/{domainId}/definitions/{definitionId}/draft', pathParams: ['domainId', 'definitionId'], body: ['definitionVersionId', 'contextSchema', 'nodes', 'transitions'], idempotencyKey: true },
    },
    {
      name: 'publish_version',
      description: 'Publish a DRAFT version; expectedRevision is optional in the current service contract.',
      arguments: {
        additionalProperties: false,
        properties: { domainId: { type: 'string', description: 'Target workflow domain id (UUID). Resolve canonically via the workflow_my_domains capability: list your domains and pass one where caller_role is DOMAIN_OWNER (only owners may author); never guess, use display names, or hard-code a UUID. The service still enforces Domain Owner authorization server-side.' }, definitionId: { type: 'string' }, versionId: { type: 'string' }, expectedRevision: { type: 'string' } },
        required: ['domainId', 'definitionId', 'versionId'],
      },
      result: { type: 'json' }, errors: ['invalid_arguments'],
      http: { target: 'svc-workflow', method: 'POST', path: '/internal/v1/domains/{domainId}/definitions/{definitionId}/publish', pathParams: ['domainId', 'definitionId'], body: ['versionId', 'expectedRevision'], idempotencyKey: true },
    },
  ],
})
