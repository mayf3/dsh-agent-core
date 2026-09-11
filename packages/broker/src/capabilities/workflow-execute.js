// workflow-execute.js — the single workflow instance-execution write entry.
//
// Physically split from capabilities/workflow.js (structure gate: the
// capabilities barrel is a registered MUST_NOT_GROW legacy file; the accepted
// AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1 companion needed additive
// surface here, so the execute manifest moved to its own file and the barrel
// re-exports it — same resolution pattern as the scheduler structure
// reconciliation). Semantic bytes are unchanged except the accepted companion
// delta (optional executionClass + declared invalid_input error row +
// summary field-list documentation).
import { withTransportErrors } from '../transport.js'
import { authErrors, baseErrors } from './workflow-definition-authoring.js'

/** Shared read-side query codes (error.rs from_query WorkflowQueryError). */
export const queryErrors = [
  { code: 'principal_not_found', description: 'No principal projection exists for the caller (HTTP 404).' },
  { code: 'principal_disabled', description: 'The caller principal is disabled (HTTP 403).' },
  { code: 'internal_consistency_error', description: 'Downstream internal consistency failure (HTTP 500).' },
  { code: 'service_unavailable', description: 'Downstream storage unavailable (HTTP 503).' },
]

/**
 * The ONE unified workflow write tool (AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
 * §21 DEC-010 / CTR-010): operations `create_instance` + `transition`, the only
 * workflow write entry. `transition` migrates the production-verified
 * workflow_transition contract item-by-item (CTR-001..009 — endpoint, args,
 * CAS, trusted Idempotency-Key, error table); `create_instance` binds the
 * EXISTING svc-workflow endpoint POST /internal/v1/workflow-instances
 * (CASE A — service zero change). Initial assignee is resolved SERVER-SIDE
 * from the definition entry node; identity travels only through the
 * credential seam — no principalId/agentId/actor/assignee/Idempotency-Key is
 * model-facing. No broker-side automatic retry (DEC-004).
 */
export const workflowExecuteManifest = withTransportErrors({
  id: 'workflow_execute',
  toolName: 'workflow_execute',
  name: 'Workflow Execute',
  description:
    'Agent Core capability `workflow_execute` (svc-workflow) — the single workflow instance-execution write entry with four operations (AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1 §25 amendment: create_instance | transition | cancel_instance | archive_instance). ' +
    'operation="create_instance": create a workflow instance in a domain from a PUBLISHED definition version; the server resolves the initial assignee from the entry node and returns {workflowInstanceId, workflowStateVersion=1, ...}. ' +
    'operation="transition": first call `workflow_instance_detail` to read the current `workflow_state_version` and `outgoingTransitions[]`; use `executable_for_actor: true` only as an advisory preference, then submit the exact `transition_id` and payload matching `submission_schema`. The downstream atomic transaction is authoritative, so advisory false/stale values are never blocked locally. On `workflow_state_version_conflict`, read the detail again and explicitly resubmit with the new version. ' +
    'operation="cancel_instance": governance cleanup of an active/non-terminal instance; server-side authorization is DOMAIN_OWNER of the instance domain OR GLOBAL_WORKFLOW_COORDINATOR; transition is NEVER a substitute for cancel. ' +
    'operation="archive_instance": archive a terminal/cancelled instance; authority identical; coordinator authority does NOT bypass lifecycle legality. ' +
    'Cleanup discipline (advisory; the server is authoritative): active -> cancel_instance -> read-back verify -> archive_instance; already cancelled -> archive_instance; already terminal -> archive_instance; already archived -> no-op. No delete exists.',
  requiredScopes: ['workflow.execute'],
  errors: [
    ...baseErrors,
    ...authErrors,
    ...queryErrors,
    // create_instance family (svc-workflow error.rs from_create; CASE A).
    { code: 'domain_not_found', description: 'Target domain not found (HTTP 404).' },
    { code: 'domain_disabled', description: 'Target domain is disabled (HTTP 403).' },
    { code: 'domain_membership_required', description: 'Caller is not an active member of the target domain (HTTP 403).' },
    { code: 'cross_domain_violation', description: 'Caller may not create instances in this domain (HTTP 403).' },
    { code: 'definition_version_not_found', description: 'Workflow definition version not found (HTTP 404).' },
    { code: 'version_not_published', description: 'Workflow definition version is not PUBLISHED (HTTP 409).' },
    { code: 'context_validation_failed', description: 'contextPayload failed the entry node context schema (HTTP 422).' },
    { code: 'invalid_input', description: 'Request payload failed validation, e.g. an unknown executionClass value (HTTP 422; AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1).' },
    // transition family (CTR-005, migrated verbatim from workflow_transition).
    { code: 'instance_not_found', description: 'Workflow instance not found (HTTP 404).' },
    { code: 'current_visit_not_found', description: 'Current node visit not found (HTTP 404).' },
    { code: 'principal_not_assignee', description: 'Caller is not the current assignee (HTTP 403).' },
    { code: 'assistance_open', description: 'Open assistance prevents transition execution (HTTP 409).' },
    { code: 'source_node_terminal', description: 'The source node is terminal (HTTP 409).' },
    { code: 'definition_version_revoked', description: 'The workflow definition version is revoked (HTTP 409).' },
    { code: 'workflow_state_version_conflict', description: 'Expected workflow state version is stale (HTTP 409).' },
    { code: 'transition_not_applicable', description: 'Transition is not applicable to the current node (HTTP 409).' },
    { code: 'submission_required', description: 'This transition requires a submission payload (HTTP 422).' },
    { code: 'submission_validation_failed', description: 'Submission payload failed validation (HTTP 422).' },
    { code: 'size_limit_exceeded', description: 'Submission payload or metadata exceeds the service limit (HTTP 413).' },
    { code: 'invalid_return_references', description: 'Return transition references are invalid (HTTP 422).' },
    { code: 'assignee_resolution_failed', description: 'Assignee resolution failed (HTTP 422).' },
    { code: 'idempotency_conflict', description: 'Idempotency key was reused with a different request (HTTP 409).' },
    { code: 'command_still_processing', description: 'The idempotent command is still processing (HTTP 425).' },
    // cancel_instance family (CTR-011; dictated verbatim from svc-workflow error.rs from_cancel).
    { code: 'not_domain_owner', description: 'Caller holds neither DOMAIN_OWNER of the instance domain nor GLOBAL_WORKFLOW_COORDINATOR (HTTP 403).' },
    { code: 'already_cancelled', description: 'Instance is already cancelled (HTTP 409).' },
    { code: 'instance_archived', description: 'Instance is archived (HTTP 409).' },
    { code: 'invalid_reason', description: 'The cancel/archive reason is invalid (HTTP 422).' },
    // archive_instance family (CTR-012; dictated verbatim from svc-workflow error.rs from_archive).
    { code: 'instance_not_terminal', description: 'Instance is not in a terminal state (HTTP 409).' },
    { code: 'already_archived', description: 'Instance is already archived (HTTP 409).' },
    { code: 'active_activation_exists', description: 'Instance has an active canonical activation and cannot be archived (HTTP 409).' },
  ],
  operations: [
    {
      name: 'create_instance',
      description:
        'Create one workflow instance. Required: domainId, definitionVersionId (a PUBLISHED definition version), contextPayload (must satisfy the entry node context schema), metadata (JSON; pass null when empty). Optional: externalReference (<=512 chars), externalUrl, executionClass (BUSINESS | NON_BUSINESS_TEST; absent = BUSINESS. NON_BUSINESS_TEST marks explicit test/canary work, which the normal BUSINESS dispatch due feed never returns — marking requires DOMAIN_OWNER of the target domain server-side; others get not_domain_owner).',
      arguments: {
        properties: {
          domainId: { type: 'string', description: 'Target workflow domain id (UUID); caller must be an active member.' },
          definitionVersionId: { type: 'string', description: 'PUBLISHED workflow definition version id (UUID).' },
          contextPayload: { type: 'json', description: 'Initial context payload; validated against the entry node context schema.' },
          metadata: { type: 'json', description: 'Arbitrary metadata JSON (<=64 KiB); pass null when there is none.' },
          externalReference: { type: 'string', description: 'Optional external reference string (<=512 chars).' },
          externalUrl: { type: 'string', description: 'Optional external URL.' },
          executionClass: { type: 'string', enum: ['BUSINESS', 'NON_BUSINESS_TEST'], description: 'Optional work execution class (SVC_WORKFLOW_WORK_EXECUTION_CLASS_V1 / AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1). Absent = BUSINESS; the mapped svc body then OMITS this key entirely. NON_BUSINESS_TEST = explicit test/canary work, excluded from the normal BUSINESS dispatch due feed; requires DOMAIN_OWNER of the target domain (server-enforced).' },
        },
        required: ['domainId', 'definitionVersionId', 'contextPayload', 'metadata'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/workflow-instances',
        body: ['domainId', 'definitionVersionId', 'contextPayload', 'metadata', 'externalReference', 'externalUrl', 'executionClass'],
        idempotencyKey: true,
      },
    },
    {
      name: 'transition',
      description: 'Submit one transition using exact values read from workflow_instance_detail.',
      arguments: {
        properties: {
          workflowInstanceId: { type: 'string', description: 'Workflow instance id (UUID).' },
          transitionDefinitionId: { type: 'string', description: 'Exact outgoing transition definition id (UUID).' },
          expectedWorkflowStateVersion: { type: 'integer', minimum: 1, description: 'Current workflow state version used for CAS.' },
          submissionPayload: { type: 'json', description: 'Optional payload matching the selected transition submission schema.' },
        },
        required: ['workflowInstanceId', 'transitionDefinitionId', 'expectedWorkflowStateVersion'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/workflow-instances/{workflowInstanceId}/transitions',
        pathParams: ['workflowInstanceId'],
        body: ['transitionDefinitionId', 'expectedWorkflowStateVersion', 'submissionPayload'],
        idempotencyKey: true,
      },
    },
    {
      name: 'cancel_instance',
      description:
        'Cancel an active/non-terminal workflow instance (governance cleanup). Authorization is server-side: DOMAIN_OWNER of the instance domain OR GLOBAL_WORKFLOW_COORDINATOR. Only workflowInstanceId + reason are accepted — caller identity and Idempotency-Key are trusted seams.',
      arguments: {
        properties: {
          workflowInstanceId: { type: 'string', description: 'Workflow instance id (UUID).' },
          reason: { type: 'string', description: 'Cancellation reason (server-validated; required).' },
        },
        required: ['workflowInstanceId', 'reason'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/workflow-instances/{workflowInstanceId}/cancel',
        pathParams: ['workflowInstanceId'],
        body: ['reason'],
        idempotencyKey: true,
      },
    },
    {
      name: 'archive_instance',
      description:
        'Archive a terminal/cancelled workflow instance. Authorization is server-side: DOMAIN_OWNER OR GLOBAL_WORKFLOW_COORDINATOR; lifecycle legality (only terminal/cancelled can archive) is server-authoritative and never bypassed. Only workflowInstanceId + reason are accepted.',
      arguments: {
        properties: {
          workflowInstanceId: { type: 'string', description: 'Workflow instance id (UUID).' },
          reason: { type: 'string', description: 'Archive reason (server-validated; required).' },
        },
        required: ['workflowInstanceId', 'reason'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/workflow-instances/{workflowInstanceId}/archive',
        pathParams: ['workflowInstanceId'],
        body: ['reason'],
        idempotencyKey: true,
      },
    },
  ],
})
