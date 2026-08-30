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
 *   workflow_domain_instances  GET /internal/v1/workflow-instances/domain              workflow.read
 *
 * workflow_domain_instances (AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1):
 * read-only domain-wide instance enumeration for DOMAIN_OWNERs. The DOMAIN_OWNER
 * check is enforced SERVER-SIDE by svc-workflow (query_service.list_domain_instances
 * -> check_domain_owner; non-owner -> workflow_instance_not_found_or_not_visible);
 * the broker never replicates or relaxes it. Wire param is `domainId` (downstream
 * serde rename_all=camelCase + deny_unknown_fields); cursors and filter params
 * (lifecycle/status/definitionKey/currentNodeKey/assigneePrincipalId) are
 * deliberately NOT exposed (first-batch cursor discipline).
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

/**
 * Domain-wide instance enumeration (read-only).
 *
 * Proxies the deployed svc-workflow endpoint GET /internal/v1/workflow-instances/domain.
 * Authorization is wholly server-side: only DOMAIN_OWNERs of `domainId` pass
 * (others get workflow_instance_not_found_or_not_visible, which also covers a
 * nonexistent domain). The summary projection passes through untouched
 * (items: workflow_instance_id / title / is_terminal / current_node /
 * current_assignee_principal_id / created_at / updated_at, + next_cursor);
 * cursor params are NOT exposed, so the model-facing contract is single-page.
 */
export const workflowDomainInstancesManifest = withTransportErrors({
  id: 'workflow_domain_instances',
  toolName: 'workflow_domain_instances',
  name: 'Workflow Domain Instances',
  description:
    'Agent Core capability `workflow_domain_instances` (svc-workflow): list all workflow instances in one domain (read-only; DOMAIN_OWNER of the domain only — enforced server-side). ' +
    'Returns {ok: true, result: <domain instance page>} on success.',
  requiredScopes: ['workflow.read'],
  errors: [
    ...baseErrors,
    ...authErrors,
    ...queryErrors,
    ...paginationErrors,
    { code: 'workflow_instance_not_found_or_not_visible', description: 'Caller is not the owner of the domain, or the domain does not exist (HTTP 404).' },
  ],
  operations: [
    {
      name: 'list',
      description: 'List the instances of the given domainId (UUID). Optional: limit (1-20).',
      arguments: {
        properties: {
          domainId: { type: 'string', description: 'Workflow domain id (UUID) to enumerate.' },
          limit: limitProperty,
        },
        required: ['domainId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'invalid_pagination'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/workflow-instances/domain',
        query: ['domainId', 'limit'],
      },
    },
  ],
})

/**
 * Global (all-domain) read-only instance enumeration
 * (AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2).
 *
 * Proxies the deployed svc-workflow endpoint GET
 * /internal/v1/workflow-instances/global. Authorization is wholly
 * server-side: only callers holding a global read role
 * (GLOBAL_WORKFLOW_READER or GLOBAL_WORKFLOW_COORDINATOR — target
 * contract; coordinator-only on pre-READER-deployment installs) pass;
 * everyone else fails closed with 403 global_read_role_required /
 * global_coordinator_required (both declared to cover the two deployment
 * timelines). The broker never replicates, relaxes or caches any role
 * decision; the tool is generic — no per-agent wiring (DEC-008), and
 * assigneePrincipalId is a server-side RESULT filter that can never
 * influence the caller identity (DEC-003).
 *
 * Cursor discipline — explicit deviation (DEC-002): unlike the
 * first-batch capabilities, the paired cursor beforeCreatedAt + beforeId
 * IS exposed here, because fleet-wide enumeration must be pageable. The
 * pair must be given together; a half cursor is forwarded untouched and
 * rejected downstream with 422 invalid_cursor (declared). Enum / UUID /
 * RFC3339 format checks are NOT replicated broker-side (CTR-002): only
 * `limit` fails fast locally (1-20 -> invalid_pagination); illegal
 * lifecycle/status values pass through and are rejected downstream with
 * 422 invalid_lifecycle / invalid_status (declared).
 */
export const workflowGlobalInstancesManifest = withTransportErrors({
  id: 'workflow_global_instances',
  toolName: 'workflow_global_instances',
  name: 'Workflow Global Instances',
  description:
    'Agent Core capability `workflow_global_instances` (svc-workflow): enumerate workflow-instance summaries across ALL domains (read-only; caller must hold GLOBAL_WORKFLOW_READER or GLOBAL_WORKFLOW_COORDINATOR — enforced server-side). ' +
    'Returns {ok: true, result: <global instance page>} on success.',
  requiredScopes: ['workflow.read'],
  errors: [
    ...baseErrors,
    ...authErrors,
    ...queryErrors,
    { code: 'invalid_pagination', description: 'Pagination parameters are invalid (limit must be 1-20).' },
    { code: 'invalid_cursor', description: 'Cursor parameters are invalid (beforeCreatedAt and beforeId must be given together).' },
    { code: 'invalid_lifecycle', description: 'lifecycle is not one of active|terminal|all (HTTP 422).' },
    { code: 'invalid_status', description: 'status is not one of active|cancelled|archived|all (HTTP 422).' },
    { code: 'global_coordinator_required', description: 'Caller holds no global read role — transition code of installs deployed before the READER revision (HTTP 403).' },
    { code: 'global_read_role_required', description: 'Caller holds neither GLOBAL_WORKFLOW_READER nor GLOBAL_WORKFLOW_COORDINATOR (HTTP 403).' },
  ],
  operations: [
    {
      name: 'list',
      description:
        'List workflow-instance summaries across all domains. Optional: limit (1-20), lifecycle (active|terminal|all), status (active|cancelled|archived|all), definitionKey, currentNodeKey, assigneePrincipalId (result filter only), beforeCreatedAt + beforeId (paired cursor).',
      arguments: {
        properties: {
          limit: limitProperty,
          lifecycle: { type: 'string', description: 'Lifecycle filter: active | terminal | all (validated server-side).' },
          status: { type: 'string', description: 'Status filter: active | cancelled | archived | all (validated server-side).' },
          definitionKey: { type: 'string', description: 'Filter by workflow definition key.' },
          currentNodeKey: { type: 'string', description: 'Filter by current node key.' },
          assigneePrincipalId: { type: 'string', description: 'Filter results by assignee principal id (UUID). Result filter only — never affects the caller identity.' },
          beforeCreatedAt: { type: 'string', description: 'Cursor: RFC 3339 timestamp of the last item seen; must be paired with beforeId.' },
          beforeId: { type: 'string', description: 'Cursor: workflow instance id (UUID) of the last item seen; must be paired with beforeCreatedAt.' },
        },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'invalid_pagination'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/workflow-instances/global',
        query: ['limit', 'lifecycle', 'status', 'definitionKey', 'currentNodeKey', 'assigneePrincipalId', 'beforeCreatedAt', 'beforeId'],
      },
    },
  ],
})

/** All first-batch Workflow manifests. */
export const manifests = [
  workflowMyTasksManifest,
  workflowInstanceDetailManifest,
  workflowSubmissionHistoryManifest,
  workflowMyDomainsManifest,
  workflowDomainInstancesManifest,
  workflowGlobalInstancesManifest,
]
