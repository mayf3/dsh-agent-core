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
 *   workflow_dispatch_intents  GET /internal/v1/dispatch-intents                       workflow.read
 *   workflow_wake_dispatch_intent POST .../node-visits/{nodeVisitId}/wake              workflow.execute
 *   workflow_execute           POST /internal/v1/workflow-instances                   workflow.execute
 *                              POST /internal/v1/workflow-instances/{workflowInstanceId}/transitions
 *   (workflow_execute per AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
 *   §21 DEC-010/CTR-010: the ONLY workflow write tool — operations
 *   `create_instance` + `transition`; workflow_transition was removed from the
 *   model tool face in the same cutover and must never coexist.)
 *
 * workflow_domain_instances (AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1 +
 * AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V2):
 * read-only domain-wide instance enumeration for DOMAIN_OWNERs. The DOMAIN_OWNER
 * check is enforced SERVER-SIDE by svc-workflow (query_service.list_domain_instances
 * -> check_domain_owner; non-owner -> workflow_instance_not_found_or_not_visible);
 * the broker never replicates or relaxes it. Wire param is `domainId` (downstream
 * serde rename_all=camelCase + deny_unknown_fields); filter params
 * (lifecycle/status/definitionKey/currentNodeKey/assigneePrincipalId) remain
 * deliberately NOT exposed. Pagination exposes the server's composite keyset
 * cursor as beforeCreatedAt + beforeId. Both absent means page one; both present
 * means a later page; either alone fails fast locally with `invalid_cursor`
 * before credential, token, or HTTP work. Full cursor strings are forwarded
 * verbatim and the downstream page, including next_cursor, is not reshaped.
 * The sole workflow write tool exposed here is `workflow_execute` (DEC-010:
 * ONE unified write entry; `create_instance` + `transition` operations);
 * svc-workflow remains authoritative for actor, initial assignee resolution
 * and transition legality, and the transport's trusted `idempotencyKey` seam
 * generates the model-inaccessible Idempotency-Key for both write operations.
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
import { authErrors, baseErrors, workflowDefinitionAuthoringManifest } from './workflow-definition-authoring.js'

/** Shared read-side query codes (error.rs from_query WorkflowQueryError). */
const queryErrors = [
  { code: 'principal_not_found', description: 'No principal projection exists for the caller (HTTP 404).' },
  { code: 'principal_disabled', description: 'The caller principal is disabled (HTTP 403).' },
  { code: 'internal_consistency_error', description: 'Downstream internal consistency failure (HTTP 500).' },
  { code: 'service_unavailable', description: 'Downstream storage unavailable (HTTP 503).' },
]

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
 * current_assignee_principal_id / created_at / updated_at, + next_cursor).
 *
 * PAGINATION_V2 exposes the optional composite keyset cursor pair
 * beforeCreatedAt + beforeId. A generic manifest allOrNone group rejects either
 * half locally before credentials, tokens, handlers, or HTTP. Complete cursor
 * strings are forwarded verbatim through the query allowlist; no timestamp
 * precision, timezone, UUID, field names, or downstream response are changed.
 */
export const workflowDomainInstancesManifest = withTransportErrors({
  id: 'workflow_domain_instances',
  toolName: 'workflow_domain_instances',
  name: 'Workflow Domain Instances',
  description:
    'Agent Core capability `workflow_domain_instances` (svc-workflow): list all workflow instances in one domain (read-only; DOMAIN_OWNER of the domain only — enforced server-side). ' +
    'To continue, pass next_cursor.created_at as beforeCreatedAt and next_cursor.id as beforeId; provide both cursor fields or neither. ' +
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
      description:
        'List the instances of the given domainId (UUID). Optional: limit (1-20); beforeCreatedAt + beforeId (all-or-none cursor pair copied verbatim from next_cursor).',
      arguments: {
        properties: {
          domainId: { type: 'string', description: 'Workflow domain id (UUID) to enumerate.' },
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
        path: '/internal/v1/workflow-instances/domain',
        query: ['domainId', 'limit', 'beforeCreatedAt', 'beforeId'],
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
    'Agent Core capability `workflow_execute` (svc-workflow) — the single workflow write entry with two operations. ' +
    'operation="create_instance": create a workflow instance in a domain from a PUBLISHED definition version; the server resolves the initial assignee from the entry node and returns {workflowInstanceId, workflowStateVersion=1, ...}. ' +
    'operation="transition": first call `workflow_instance_detail` to read the current `workflow_state_version` and `outgoingTransitions[]`; use `executable_for_actor: true` only as an advisory preference, then submit the exact `transition_id` and payload matching `submission_schema`. ' +
    'The downstream atomic transaction is authoritative, so advisory false/stale values are never blocked locally. On `workflow_state_version_conflict`, read the detail again and explicitly resubmit with the new version.',
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
  ],
  operations: [
    {
      name: 'create_instance',
      description:
        'Create one workflow instance. Required: domainId, definitionVersionId (a PUBLISHED definition version), contextPayload (must satisfy the entry node context schema), metadata (JSON; pass null when empty). Optional: externalReference (<=512 chars), externalUrl.',
      arguments: {
        properties: {
          domainId: { type: 'string', description: 'Target workflow domain id (UUID); caller must be an active member.' },
          definitionVersionId: { type: 'string', description: 'PUBLISHED workflow definition version id (UUID).' },
          contextPayload: { type: 'json', description: 'Initial context payload; validated against the entry node context schema.' },
          metadata: { type: 'json', description: 'Arbitrary metadata JSON (<=64 KiB); pass null when there is none.' },
          externalReference: { type: 'string', description: 'Optional external reference string (<=512 chars).' },
          externalUrl: { type: 'string', description: 'Optional external URL.' },
        },
        required: ['domainId', 'definitionVersionId', 'contextPayload', 'metadata'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/workflow-instances',
        body: ['domainId', 'definitionVersionId', 'contextPayload', 'metadata', 'externalReference', 'externalUrl'],
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
  ],
})

/**
 * Due Dispatch Intent poll (VISIT_ACTIVATION_V1 scheduler read).
 *
 * AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1 CTR-DIB-001. Proxies the
 * deployed svc-workflow endpoint GET /internal/v1/dispatch-intents
 * (svc main 22e862a). The projection is the accepted v0.4.0 §5.7 minimum
 * Scheduler-facing record — exactly dispatchIntentId, nodeVisitId,
 * workflowInstanceId, ownerPrincipalId, nextEligibleAt, createdAt,
 * updatedAt — and is passed through verbatim: the broker never filters,
 * orders, augments, or caches. The GLOBAL_SCHEDULER_READ authorization is
 * enforced SERVER-SIDE (fail-closed; a caller holding only the legacy
 * GLOBAL_WORKFLOW_READER role gets 403 scheduler_read_role_required); the
 * broker never replicates or relaxes it. This tool is an additive
 * consumer of the canonical activation model — per the Owner ruling
 * KEEP_ACCEPTED_V6 it is NOT a retrofitted dispatch feed on
 * workflow_global_instances / workflow_domain_instances, and it carries no
 * scheduler policy (fairness/quota/retry/mapping stay external).
 */
export const workflowDispatchIntentsManifest = withTransportErrors({
  id: 'workflow_dispatch_intents',
  toolName: 'workflow_dispatch_intents',
  name: 'Workflow Dispatch Intents',
  description:
    'Agent Core capability `workflow_dispatch_intents` (svc-workflow): poll ACTIVE due Dispatch Intents ' +
    '(canonical Agent work units of the VISIT_ACTIVATION_V1 activation model; read-only). ' +
    'Each record is exactly {dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId, nextEligibleAt, createdAt, updatedAt}. ' +
    'The caller must hold the server-side GLOBAL_SCHEDULER_READ binding (enforced by svc-workflow; 403 scheduler_read_role_required otherwise). ' +
    'Returns {ok: true, result: {items: [...]}}; poll again for new due intents rather than retrying.',
  requiredScopes: ['workflow.read'],
  errors: [
    ...baseErrors,
    ...authErrors,
    { code: 'scheduler_read_role_required', description: 'Caller holds no enabled GLOBAL_SCHEDULER_READ binding (HTTP 403; also returned to GLOBAL_WORKFLOW_READER holders — the legacy read role is not mapped onto the scheduler capability).' },
    { code: 'invalid_pagination', description: 'limit is outside 1-100 (HTTP 422).' },
    { code: 'internal_consistency_error', description: 'Downstream internal consistency failure (HTTP 500).' },
    { code: 'service_unavailable', description: 'Downstream storage unavailable (HTTP 503).' },
  ],
  operations: [
    {
      name: 'list',
      description:
        'List active due Dispatch Intents (nextEligibleAt <= server now), ordered by (nextEligibleAt, activation id). Optional: limit (1-100, default 50).',
      arguments: {
        properties: {
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            validationError: 'invalid_pagination',
            description: 'Maximum records returned, 1-100 (server default 50).',
          },
        },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/dispatch-intents',
        query: ['limit'],
      },
    },
  ],
})

/**
 * Authorized early wake of one DISPATCH_INTENT (VISIT_ACTIVATION_V1).
 *
 * AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1 CTR-DIB-002. Proxies the
 * deployed svc-workflow endpoint POST
 * /internal/v1/workflow-instances/{workflowInstanceId}/node-visits/{nodeVisitId}/wake.
 * The wake binds the exact Visit, is authorized SERVER-SIDE by the
 * GLOBAL_SCHEDULER_READ binding (fail-closed), and either advances the
 * intent's nextEligibleAt to the authoritative server now (wakeApplied=true;
 * one workflowStateVersion increment + one WAKE event downstream) or is a
 * durable no-op (HTTP 200 wakeApplied=false with a machine-readable reason:
 * INSTANCE_CLOSED | ACTIVATION_CLOSED | VISIT_NOT_CURRENT | VERSION_MISMATCH
 * | ALREADY_DUE) — the no-op is a SUCCESS response, never an error. The
 * wake can never choose a timestamp, create an activation, mutate node or
 * owner, perform a transition, or start an Agent. The trusted credential
 * seam generates the model-inaccessible Idempotency-Key (same-key replay,
 * changed-request conflict) and the broker performs NO automatic retry
 * (command_still_processing passes through).
 */
export const workflowWakeDispatchIntentManifest = withTransportErrors({
  id: 'workflow_wake_dispatch_intent',
  toolName: 'workflow_wake_dispatch_intent',
  name: 'Workflow Wake Dispatch Intent',
  description:
    'Agent Core capability `workflow_wake_dispatch_intent` (svc-workflow): authorized early wake of one Dispatch Intent so the Scheduler may consider it immediately. ' +
    'Bind the exact workflowInstanceId + nodeVisitId (from workflow_dispatch_intents) and the current workflowStateVersion (from workflow_instance_detail). ' +
    'wakeApplied=false with a reason is a durable SUCCESS no-op (e.g. ALREADY_DUE, VERSION_MISMATCH, ACTIVATION_CLOSED) — do not treat it as an error and do not blind-retry with a new identity. ' +
    'The caller must hold the server-side GLOBAL_SCHEDULER_READ binding (403 scheduler_read_role_required otherwise).',
  requiredScopes: ['workflow.execute'],
  errors: [
    ...baseErrors,
    ...authErrors,
    { code: 'scheduler_read_role_required', description: 'Caller holds no enabled GLOBAL_SCHEDULER_READ binding (HTTP 403).' },
    { code: 'principal_not_found', description: 'No principal projection exists for the caller (HTTP 404).' },
    { code: 'principal_disabled', description: 'The caller principal is disabled (HTTP 403).' },
    { code: 'instance_not_found', description: 'Workflow instance not found (HTTP 404).' },
    { code: 'dispatch_intent_not_found', description: 'No DISPATCH_INTENT activation exists for the given instance and node visit (HTTP 404; also covers HUMAN_WORK_ITEM visits — those are never wakeable).' },
    { code: 'invalid_cause', description: 'The optional wake cause is invalid (empty, >64 chars, or control characters) (HTTP 422).' },
    { code: 'idempotency_conflict', description: 'Idempotency key was reused with a different request (HTTP 409).' },
    { code: 'command_still_processing', description: 'The idempotent command is still processing (HTTP 425).' },
    { code: 'internal_consistency_error', description: 'Downstream internal consistency failure (HTTP 500).' },
    { code: 'service_unavailable', description: 'Downstream storage unavailable (HTTP 503).' },
  ],
  operations: [
    {
      name: 'wake',
      description:
        'Wake one Dispatch Intent. Required: workflowInstanceId, nodeVisitId, expectedWorkflowStateVersion. Optional: cause (<=64 chars, non-sensitive label recorded in the wake event).',
      arguments: {
        properties: {
          workflowInstanceId: { type: 'string', description: 'Workflow instance id (UUID) owning the dispatch intent.' },
          nodeVisitId: { type: 'string', description: 'Exact current node visit id (UUID) bound to the activation.' },
          expectedWorkflowStateVersion: { type: 'integer', minimum: 1, description: 'Current workflow state version used for CAS; a mismatch is a durable no-op (wakeApplied=false, reason=VERSION_MISMATCH).' },
          cause: { type: 'string', description: 'Optional non-sensitive cause label (<=64 chars); becomes part of the request identity.' },
        },
        required: ['workflowInstanceId', 'nodeVisitId', 'expectedWorkflowStateVersion'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/workflow-instances/{workflowInstanceId}/node-visits/{nodeVisitId}/wake',
        pathParams: ['workflowInstanceId', 'nodeVisitId'],
        body: ['expectedWorkflowStateVersion', 'cause'],
        idempotencyKey: true,
      },
    },
  ],
})

/** Workflow manifests: instance execution and Definition Authoring are distinct write families. */
export const manifests = [
  workflowMyTasksManifest,
  workflowInstanceDetailManifest,
  workflowSubmissionHistoryManifest,
  workflowMyDomainsManifest,
  workflowDomainInstancesManifest,
  workflowGlobalInstancesManifest,
  workflowExecuteManifest,
  workflowDefinitionAuthoringManifest,
  workflowDispatchIntentsManifest,
  workflowWakeDispatchIntentManifest,
]
