import { withTransportErrors } from '../../transport.js'
import { authErrors, baseErrors } from './definition-authoring.js'

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
    'Raw list records are exactly {dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId, nextEligibleAt, createdAt, updatedAt}. ' +
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
          afterNextEligibleAt: {
            type: 'string',
            description: 'Keyset continuation cursor (DISPATCH_INTENT_KEYSET_CONTINUATION_V1): the EXACT nextEligibleAt string of the last record already consumed. Both-or-neither with afterDispatchIntentId.',
          },
          afterDispatchIntentId: {
            type: 'string',
            description: 'Keyset continuation cursor: the EXACT dispatchIntentId of the last record already consumed. Both-or-neither with afterNextEligibleAt.',
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
        query: ['limit', 'afterNextEligibleAt', 'afterDispatchIntentId'],
      },
    },
    {
      name: 'list_ready',
      description: 'List only active time-due READY intents. Copy the exact last returned keyset pair; no raw list fallback on failure.',
      arguments: {
        additionalProperties: false,
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, validationError: 'invalid_pagination' },
          afterNextEligibleAt: { type: 'string', nonBlank: true },
          afterDispatchIntentId: { type: 'string', nonBlank: true },
        },
        required: [],
        allOrNone: [{ properties: ['afterNextEligibleAt', 'afterDispatchIntentId'], validationError: 'invalid_arguments' }],
      },
      result: { type: 'json' }, errors: ['invalid_arguments'],
      http: { target: 'svc-workflow', method: 'GET', path: '/internal/v1/dispatch-intents/ready', query: ['limit', 'afterNextEligibleAt', 'afterDispatchIntentId'] },
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

/**
 * WORKFLOW_EXECUTION_CONTROL_V1 (companion svc Spec CTR-SWEC-004) — the
 * system execution-escalation ingress. The execution runtime (poller
 * principal, GLOBAL_SCHEDULER_READ bound server-side) reports an exhausted
 * attempt policy so svc-workflow can open an OWNER_PENDING assistance case
 * in one authoritative transaction. Domain Owner then resolves it or explicitly
 * escalates it to HUMAN_REQUIRED. Idempotent server-side:
 * an already-open case replays as escalated=false with the existing case id.
 * This manifest is a RUNTIME-ONLY transport: the execution engine invokes it
 * through the gateway as the poller principal; it is not part of any
 * model-facing toolset.
 */
export const workflowExecutionEscalationManifest = withTransportErrors({
  id: 'workflow_execution_escalation',
  toolName: 'workflow_execution_escalation',
  name: 'Workflow Execution Escalation',
  description:
    'svc-workflow system ingress: report an exhausted execution attempt policy for one node visit so an OWNER_PENDING assistance case is opened for Domain Owner attention (nothing force-advances). ' +
    'Idempotent: an already-open case on the visit answers escalated=false with the existing assistanceCaseId. ' +
    'The caller must hold the server-side GLOBAL_SCHEDULER_READ binding (403 scheduler_read_role_required otherwise).',
  requiredScopes: ['workflow.execute'],
  errors: [
    ...baseErrors,
    ...authErrors,
    { code: 'scheduler_read_role_required', description: 'Caller holds no enabled GLOBAL_SCHEDULER_READ binding (HTTP 403).' },
    { code: 'instance_not_found', description: 'Workflow instance not found (HTTP 404).' },
    { code: 'visit_not_current', description: 'The given nodeVisitId is not the instance current visit (HTTP 409).' },
    { code: 'instance_closed', description: 'The instance is cancelled, archived, or terminal (HTTP 409).' },
    { code: 'invalid_reason', description: 'reason must be ATTEMPTS_EXHAUSTED or STALE_LOOP_EXHAUSTED (HTTP 422).' },
    { code: 'idempotency_conflict', description: 'Idempotency key was reused with a different request (HTTP 409).' },
    { code: 'command_still_processing', description: 'The idempotent command is still processing (HTTP 425).' },
    { code: 'internal_consistency_error', description: 'Downstream internal consistency failure (HTTP 500).' },
    { code: 'service_unavailable', description: 'Downstream storage unavailable (HTTP 503).' },
  ],
  operations: [
    {
      name: 'create',
      description:
        'Open OWNER_PENDING assistance on one current node visit. Required: workflowInstanceId, nodeVisitId, reason. Optional evidence: attemptCount, lastAttemptId, dispatchIntentId.',
      arguments: {
        properties: {
          workflowInstanceId: { type: 'string', description: 'Workflow instance id (UUID).' },
          nodeVisitId: { type: 'string', description: 'The CURRENT node visit id (UUID) to escalate.' },
          reason: { type: 'string', enum: ['ATTEMPTS_EXHAUSTED', 'STALE_LOOP_EXHAUSTED'], description: 'Machine-readable escalation reason.' },
          attemptCount: { type: 'integer', minimum: 1, description: 'Executed attempt count evidence (system-counted).' },
          lastAttemptId: { type: 'string', description: 'Last attempt id evidence.' },
          dispatchIntentId: { type: 'string', description: 'Latest dispatch intent id evidence.' },
        },
        required: ['workflowInstanceId', 'nodeVisitId', 'reason'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/workflow-instances/{workflowInstanceId}/execution-escalations',
        pathParams: ['workflowInstanceId'],
        body: ['nodeVisitId', 'reason', 'attemptCount', 'lastAttemptId', 'dispatchIntentId'],
        idempotencyKey: true,
      },
    },
  ],
})
