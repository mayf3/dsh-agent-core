/**
 * @agent-core/broker — Workflow Definition Read capability manifest (candidate:
 * AGENT_CORE_WORKFLOW_DEFINITION_VERSION_READ_V1, issue #555).
 *
 * PURE-DATA manifest like every capability family. Read-only, SAME-DOMAIN:
 *
 *   workflow_definition_read.list_definitions      GET .../definitions                     (page)
 *   workflow_definition_read.get_definition    GET .../definitions/{id}   (detail)
 *
 * Both operations bind the svc-workflow endpoints that ALREADY exist and
 * already enforce their own authorization — endpoint scope `workflow.read`
 * (the same scope every workflow read capability here uses) plus the
 * service-internal H-5 DOMAIN OWNER check inside DefinitionService — so a
 * legitimate same-domain owner can read the precise definition/version data
 * (each listed version row carries `version_status` and `context_schema`)
 * WITHOUT any global-read permission prerequisite. No new scope, no new
 * role, no global enumeration, no write: GET-only bindings, no idempotency
 * key, response JSON passed through unchanged.
 *
 * The motivating defect (#555): an agent preparing `workflow_execute
 * (create_instance)` input could not read its own domain's published version
 * schema through any capability, and the unrelated GLOBAL instance
 * enumeration (`workflow_global_instances`) is NOT a prerequisite for
 * instance creation — dedup stays on the existing same-domain contracts.
 */

import { withTransportErrors } from '../../transport.js'
import { authErrors, baseErrors } from '../workflow/definition-authoring.js'
import { COMPLETE_BODY_ID, COMPLETE_ERRORS } from './complete-contract.js'
import { queryErrors } from '../workflow/execute.js'

/** Same pagination error rows the other workflow read capabilities declare. */
const paginationErrors = [
  { code: 'invalid_pagination', description: 'Pagination parameters are invalid (limit must be 1-20).' },
  { code: 'invalid_cursor', description: 'Cursor parameters are invalid (cursor fields must be given as a complete all-or-none group).' },
]

/** `limit` bound contract: Broker-side fail-fast before any HTTP request. */
const limitProperty = {
  type: 'integer',
  minimum: 1,
  maximum: 20,
  validationError: 'invalid_pagination',
  description: 'Page size, 1-20 (server default when omitted).',
}

const domainIdProperty = {
  type: 'string',
  description: 'Workflow domain id (UUID). Resolve canonically via workflow_my_domains (choose the domain where caller_role is DOMAIN_OWNER); the service still enforces same-domain ownership server-side. Never guess ids or use display names.',
}

export const workflowDefinitionReadManifest = withTransportErrors({
  id: 'workflow_definition_read',
  toolName: 'workflow_definition_read',
  name: 'Workflow Definition Read',
  description:
    'Agent Core capability `workflow_definition_read` (svc-workflow): SAME-DOMAIN read-only access to workflow definitions and their versions. ' +
    'Use it to read the precise context schema and version status of YOUR domain before preparing workflow_execute(create_instance) input, or to independently read back a draft after authoring. ' +
    'list_definitions pages a domain\u2019s definitions; get_definition returns the definition plus EVERY version row, each carrying version_status (DRAFT|PUBLISHED|…) and the exact context_schema. ' +
    'Authorization is svc-workflow\u2019s own: the caller must hold the domain-owner role of the domain that owns the definition (no global read permission is involved or granted; global instance enumeration is not a prerequisite for instance creation). ' +
    'Returns {ok: true, result: <definition page or detail>} on success; nonexistent versions/definitions, foreign domains and non-owner callers fail exactly as the service reports them.',
  requiredScopes: ['workflow.read'],
  errors: [
    ...baseErrors,
    ...authErrors,
    ...paginationErrors,
    { code: 'definition_not_found', description: 'Definition is absent or intentionally not visible to the caller (HTTP 404).' },
    { code: 'domain_disabled', description: 'The owning domain is disabled (HTTP 403).' },
  ],
  operations: [
    {
      name: 'list_definitions',
      description:
        'List the definitions of one domain (page). Optional: limit (1-20); beforeCreatedAt + beforeId (all-or-none cursor pair copied verbatim from next_cursor).',
      arguments: {
        properties: {
          domainId: domainIdProperty,
          limit: limitProperty,
          beforeCreatedAt: {
            type: 'string',
            description: 'Cursor: next_cursor.created_at from the previous page (RFC 3339, forwarded verbatim). Must be paired with beforeId.',
          },
          beforeId: {
            type: 'string',
            description: 'Cursor: next_cursor.id from the previous page (UUID, forwarded verbatim). Must be paired with beforeCreatedAt.',
          },
        },
        required: ['domainId'],
        allOrNone: [{ properties: ['beforeCreatedAt', 'beforeId'], validationError: 'invalid_cursor' }],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'invalid_pagination', 'invalid_cursor'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/domains/{domainId}/definitions',
        pathParams: ['domainId'],
        query: ['limit', 'beforeCreatedAt', 'beforeId'],
      },
    },
    {
      name: 'get_definition_version',
      description:
        'Read ONE precise version by definitionVersionId: the full version row plus its COMPLETE graph — every node (assignee_ref, instructions, primary_advance_transition_id, metadata) and every transition (transition_effect, submission_schema, metadata). Use it to verify exactly what a version contains before creating instances or after authoring. Same-domain owner visibility enforced by the service; nonexistent versions, foreign definitions and non-owner callers return the service\u2019s own opaque errors.',
      arguments: {
        properties: {
          domainId: domainIdProperty,
          definitionId: { type: 'string', description: 'Workflow definition id (UUID) the version belongs to.' },
          definitionVersionId: { type: 'string', description: 'Workflow definition version id (UUID), e.g. from get_definition\u2019s version rows.' },
        },
        required: ['domainId', 'definitionId', 'definitionVersionId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/domains/{domainId}/definitions/{definitionId}/versions/{definitionVersionId}',
        pathParams: ['domainId', 'definitionId', 'definitionVersionId'],
      },
    },
    {
      name: 'get_definition',
      description:
        'Read one definition with EVERY version row: version id, version_status and the exact context_schema (plus digest/semantic-model metadata). This is the precise pre-creation schema read; pass a version\u2019s context_schema requirements when composing workflow_execute(create_instance) input.',
      arguments: {
        properties: {
          domainId: domainIdProperty,
          definitionId: { type: 'string', description: 'Workflow definition id (UUID), e.g. from list_definitions.' },
        },
        required: ['domainId', 'definitionId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/domains/{domainId}/definitions/{definitionId}',
        pathParams: ['domainId', 'definitionId'],
      },
    },
  ],
})

// Instance-input reads share the generic read-only transport with definition
// reads. Selection, authorization and conditional argument validation stay in
// svc-workflow; this manifest must not reconstruct history or interpret it.
export const workflowCurrentTaskInputManifest = withTransportErrors({
  id: 'workflow_current_task_input',
  toolName: 'workflow_current_task_input',
  name: 'Workflow Current Task Input',
  description:
    'Read current task input for your exact assigned workflow instance BEFORE evaluating it, including after compaction. ' +
    'Use the returned current coordinates, entry source, recent submissions, RETURN feedback and original body descriptors instead of a remembered opinion. ' +
    'The bounded selection is NOT all history: preserve input_status, content_complete, history_window_complete and truncation qualifications. ' +
    'For omitted/truncated bodies, read view=body using the complete binding tuple and expectedBodySha256 from the descriptor; ' +
    'follow next_offset, assemble original UTF-8 bytes from offset zero, then verify the complete SHA-256 before treating a body as complete. ' +
    'A suffix alone is not a complete body. On current_task_input_stale reread input. On current_task_body_changed discard old chunks and obtain a new descriptor. ' +
    'Neither a read nor COMPLETE_FOR_SELECTION proves evidence correctness or authorizes a transition: independently evaluate evidence and use existing workflow_execute CAS. ' +
    'A missing capability, invisible source or unavailable service is an input/environment failure, not a business rejection. No automatic retry or history fallback.',
  requiredScopes: ['workflow.read'],
  errors: [
    ...baseErrors,
    ...authErrors,
    ...queryErrors,
    { code: 'invalid_current_task_input', description: 'Current-input parameters or conditional combinations are invalid (HTTP 422).' },
    { code: 'current_task_input_stale', description: 'Current visit/state/context differs from the expected tuple; reread input (HTTP 409).' },
    { code: 'current_task_body_changed', description: 'Body digest changed; discard assembled chunks and obtain a new descriptor (HTTP 409).' },
    { code: 'current_task_body_not_found_or_not_visible', description: 'Body is absent or not visible for this instance (HTTP 404).' },
    { code: 'workflow_instance_not_found_or_not_visible', description: 'Instance is absent or not visible (HTTP 404).' },
    { code: 'restricted_history_not_visible', description: 'Full current-input history is not visible to the caller (HTTP 403).' },
  ],
  operations: [{
    name: 'read',
    description:
      'Read one current input snapshot (default view=input) or one original body chunk (view=body). ' +
      'body requires all three expected coordinates plus bodyKind, bodyId and expectedBodySha256 from the descriptor; offset defaults to zero. ' +
      'input may supply all three expected coordinates together and up to eight explicit submissionIds. Conditional combinations are validated by the service.',
    arguments: {
      additionalProperties: false,
      properties: {
        workflowInstanceId: { type: 'string', description: 'Exact assigned workflow instance UUID; never substitute another instance.' },
        view: { type: 'string', enum: ['input', 'body'], description: 'input (default) selects current sources; body retrieves one original byte chunk.' },
        expectedNodeVisitId: { type: 'string', description: 'binding.node_visit_id UUID; all three expected coordinates must be supplied together.' },
        expectedWorkflowStateVersion: { type: 'integer', minimum: 1, description: 'binding.workflow_state_version, copied exactly.' },
        expectedContextRevisionId: { type: 'string', description: 'binding.context_revision_id UUID, copied exactly.' },
        submissionIds: { type: 'string', description: 'input only: comma-separated list of 1-8 distinct submission UUIDs explicitly needed for evaluation.' },
        bodyKind: { type: 'string', enum: ['CURRENT_DETAIL', 'SUBMISSION_PAYLOAD'], description: 'body only: kind from the returned body descriptor.' },
        bodyId: { type: 'string', description: 'body only: UUID from the returned body descriptor.' },
        expectedBodySha256: { type: 'string', description: 'Required for body: exact 64-character lowercase SHA-256 from the descriptor.' },
        offset: { type: 'integer', minimum: 0, description: 'body only: UTF-8 byte offset, initially zero; then use next_offset exactly.' },
      },
      required: ['workflowInstanceId'],
    },
    result: { type: 'json' },
    errors: ['invalid_arguments'],
    http: {
      target: 'svc-workflow',
      method: 'GET',
      path: '/internal/v1/workflow-instances/{workflowInstanceId}/current-task-input',
      pathParams: ['workflowInstanceId'],
      query: ['view', 'expectedNodeVisitId', 'expectedWorkflowStateVersion', 'expectedContextRevisionId',
        'submissionIds', 'bodyKind', 'bodyId', 'offset', 'expectedBodySha256'],
    },
  }],
})


/** Separate LOCAL consumer; the existing HTTP reader remains unchanged. */
export const workflowCurrentTaskBodyCompleteManifest = {
  id: COMPLETE_BODY_ID, toolName: COMPLETE_BODY_ID, name: 'Workflow Complete Original',
  local: true, requiredScopes: ['workflow.read'],
  description: 'First obtain an authoritative current-input descriptor. Supply its exact full binding, body identity and digest to retrieve one complete original from offset zero. '
    + 'Fetch every distinct required original separately. The Broker verifies full UTF-8 bytes and SHA-256; it does not evaluate meaning or evidence sufficiency. '
    + 'Failure provides no partial original and does not authorize a transition or automatic retry. Existing actor/CAS rules remain required.',
  errors: [...workflowCurrentTaskInputManifest.errors,
    ...COMPLETE_ERRORS.map(code => ({ code, description: 'Complete original read failed without partial data.' }))],
  operations: [{ name: 'read', description: 'Return exactly one bounded complete original, or one failure; no retries or descriptor refresh.',
    arguments: { additionalProperties: false, properties: {
      workflowInstanceId: { type: 'string', description: 'Exact binding.workflow_instance_id UUID.' },
      expectedDefinitionVersionId: { type: 'string', description: 'Exact binding.definition_version_id UUID.' },
      expectedNodeVisitId: { type: 'string', description: 'Exact binding.node_visit_id UUID.' },
      expectedWorkflowStateVersion: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, description: 'Exact binding.workflow_state_version.' },
      expectedContextRevisionId: { type: 'string', description: 'Exact binding.context_revision_id UUID.' },
      bodyKind: { type: 'string', enum: ['CURRENT_DETAIL', 'SUBMISSION_PAYLOAD'], description: 'Exact descriptor.kind.' },
      bodyId: { type: 'string', description: 'Exact descriptor.id UUID; CURRENT_DETAIL requires node visit ID.' },
      expectedBodySha256: { type: 'string', description: 'Exact descriptor.sha256, 64 lowercase hex characters.' },
    }, required: ['workflowInstanceId', 'expectedDefinitionVersionId', 'expectedNodeVisitId', 'expectedWorkflowStateVersion',
      'expectedContextRevisionId', 'bodyKind', 'bodyId', 'expectedBodySha256'] }, result: { type: 'json' }, errors: ['invalid_arguments'] }],
}
