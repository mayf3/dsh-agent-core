/**
 * @agent-core/broker — First-batch Workflow capability manifests (V1, P1).
 *
 * Pure DATA (JSON-serializable) describing the deployed svc-workflow read
 * capabilities a DSH agent needs first. capabilityId / method / path / scope
 * follow docs/investigations/broker-capability-parity.md §1.2 (deployed
 * registry) and were cross-checked against svc-workflow route & scope-guard
 * source (svc-workflow/src/http/mod.rs + handlers/*.rs):
 *
 *   workflow_my_tasks          GET /internal/v1/worklists/assigned-to-me              workflow.read
 *   workflow_instance_detail   GET /internal/v1/workflow-instances/{workflowInstanceId} workflow.read
 *   workflow_submission_history GET /internal/v1/workflow-instances/{workflowInstanceId}/submissions workflow.read
 *   workflow_my_domains        GET /internal/v1/principals/me/domains                 workflow.read
 *
 * Opaque-cursor paging (before_created_at/before_id, after_created_at/after_id)
 * is deliberately NOT exposed in the first batch (deferred, see report); only
 * `limit` is surfaced — the transport forwards ONLY manifest-declared query
 * names, so cursor parameters can never reach svc-workflow (not even "half"
 * a cursor). The write surface (transitions / create_instance / cancel /
 * archive / domain ops) is deferred with the Idempotency-Key generic
 * mechanism already in place for it (transport `idempotencyKey` flag).
 *
 * Downstream error preservation: each manifest DECLARES the svc-workflow
 * read-side error codes its endpoints can produce (evidence: svc-workflow
 * src/http/error.rs `from_query` WorkflowQueryError mapping + auth-layer
 * `unauthenticated`/`forbidden` + worklist cursor parsing `invalid_cursor`).
 * The transport extracts the service `code` from the error envelope
 * {"error":{"code","message"}}; the mapping layer resolves it against THIS
 * table, so a missing projection surfaces as `principal_not_found` (with
 * status + sanitized detail + x-request-id) instead of a generic `http_4xx`.
 *
 * Broker-side pagination validation: workflow_my_tasks declares
 * `limit ∈ [1, 20]` (minimum/maximum + validationError). Out-of-range values
 * fail fast in the mapping layer with `invalid_pagination` BEFORE any token
 * request or HTTP call reaches svc-workflow.
 */

import { withTransportErrors } from '../transport.js'

const baseErrors = [
  { code: 'invalid_arguments', description: 'Arguments did not satisfy the operation schema.' },
  { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
]

/** Auth-layer codes every svc-workflow endpoint can produce (claims.rs / error.rs). */
const authErrors = [
  { code: 'unauthenticated', description: 'Downstream rejected the bearer token (HTTP 401).' },
  { code: 'forbidden', description: 'Downstream rejected the required scope (HTTP 403).' },
]

/** Shared read-side query codes (error.rs from_query WorkflowQueryError). */
const queryErrors = [
  { code: 'principal_not_found', description: 'No principal projection exists for the caller (HTTP 404).' },
  { code: 'principal_disabled', description: 'The caller principal is disabled (HTTP 403).' },
  { code: 'internal_consistency_error', description: 'Downstream internal consistency failure (HTTP 500).' },
  { code: 'service_unavailable', description: 'Downstream storage unavailable (HTTP 503).' },
]

const paginationErrors = [
  { code: 'invalid_pagination', description: 'Pagination parameters are invalid (limit must be 1-20).' },
  { code: 'invalid_cursor', description: 'Cursor parameters are invalid (cursors are not exposed by this capability).' },
]

/** `limit` bound contract: Broker-side fail-fast before any HTTP request. */
const limitProperty = {
  type: 'integer',
  minimum: 1,
  maximum: 20,
  validationError: 'invalid_pagination',
  description: 'Page size, 1-20 (server default when omitted).',
}

export const workflowMyTasksManifest = withTransportErrors({
  id: 'workflow_my_tasks',
  toolName: 'workflow_my_tasks',
  name: 'Workflow My Tasks',
  description:
    'Agent Core capability `workflow_my_tasks` (svc-workflow): list workflow instances currently assigned to the calling agent. ' +
    'Returns {ok: true, result: <worklist page>} on success.',
  requiredScopes: ['workflow.read'],
  errors: [...baseErrors, ...authErrors, ...queryErrors, ...paginationErrors],
  operations: [
    {
      name: 'list',
      description: 'List my assigned worklist items. Optional: limit.',
      arguments: {
        properties: { limit: limitProperty },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'invalid_pagination'],
      http: { target: 'svc-workflow', method: 'GET', path: '/internal/v1/worklists/assigned-to-me', query: ['limit'] },
    },
  ],
})

export const workflowInstanceDetailManifest = withTransportErrors({
  id: 'workflow_instance_detail',
  toolName: 'workflow_instance_detail',
  name: 'Workflow Instance Detail',
  description:
    'Agent Core capability `workflow_instance_detail` (svc-workflow): read one workflow instance by id, ' +
    'including visibility, detail, outgoingTransitions and submissionSchema. ' +
    'Returns {ok: true, result: <instance>} on success.',
  requiredScopes: ['workflow.read'],
  errors: [
    ...baseErrors,
    ...authErrors,
    ...queryErrors,
    { code: 'workflow_instance_not_found_or_not_visible', description: 'Workflow instance not found or not visible to the caller (HTTP 404).' },
  ],
  operations: [
    {
      name: 'read',
      description: 'Read the workflow instance with the given workflowInstanceId (UUID).',
      arguments: {
        properties: { workflowInstanceId: { type: 'string', description: 'Workflow instance id (UUID).' } },
        required: ['workflowInstanceId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-workflow', method: 'GET', path: '/internal/v1/workflow-instances/{workflowInstanceId}', pathParams: ['workflowInstanceId'] },
    },
  ],
})

export const workflowSubmissionHistoryManifest = withTransportErrors({
  id: 'workflow_submission_history',
  toolName: 'workflow_submission_history',
  name: 'Workflow Submission History',
  description:
    'Agent Core capability `workflow_submission_history` (svc-workflow): list the submission history of one workflow instance. ' +
    'Returns {ok: true, result: <submissions page>} on success.',
  requiredScopes: ['workflow.read'],
  errors: [
    ...baseErrors,
    ...authErrors,
    ...queryErrors,
    ...paginationErrors,
    { code: 'workflow_instance_not_found_or_not_visible', description: 'Workflow instance not found or not visible to the caller (HTTP 404).' },
    { code: 'restricted_history_not_visible', description: 'Restricted workflow history is not visible to the caller (HTTP 403).' },
    { code: 'global_coordinator_required', description: 'Caller must hold the GLOBAL_WORKFLOW_COORDINATOR role (HTTP 403).' },
  ],
  operations: [
    {
      name: 'list',
      description: 'List submissions for the given workflowInstanceId (UUID). Optional: limit.',
      arguments: {
        properties: {
          workflowInstanceId: { type: 'string', description: 'Workflow instance id (UUID).' },
          limit: { type: 'integer', description: 'Page size (default server-side).' },
        },
        required: ['workflowInstanceId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/workflow-instances/{workflowInstanceId}/submissions',
        pathParams: ['workflowInstanceId'],
        query: ['limit'],
      },
    },
  ],
})

export const workflowMyDomainsManifest = withTransportErrors({
  id: 'workflow_my_domains',
  toolName: 'workflow_my_domains',
  name: 'Workflow My Domains',
  description:
    'Agent Core capability `workflow_my_domains` (svc-workflow): list the workflow domains the calling agent belongs to. ' +
    'Returns {ok: true, result: <domains>} on success.',
  requiredScopes: ['workflow.read'],
  errors: [...baseErrors, ...authErrors, ...queryErrors],
  operations: [
    {
      name: 'list',
      description: 'List my domains.',
      arguments: { properties: {}, required: [] },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-workflow', method: 'GET', path: '/internal/v1/principals/me/domains' },
    },
  ],
})

/** All first-batch Workflow manifests. */
export const manifests = [
  workflowMyTasksManifest,
  workflowInstanceDetailManifest,
  workflowSubmissionHistoryManifest,
  workflowMyDomainsManifest,
]
