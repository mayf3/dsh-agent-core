// workflow-collaboration.js — G7 Workflow collaboration broker capability
// (Product #480; claim g7-workflow-collaboration-r330).
//
// Thin broker transport over the Workflow collaboration proposal's two routes
// (SVC_WORKFLOW_INSTANCE_COLLABORATION_V1 @183c85c, PR #60 — CTR-7/8/9/10):
//   GET  /internal/v1/workflow-instances/{id}/collaboration          (unified feed)
//   POST /internal/v1/workflow-instances/{id}/collaboration/entries  (side-band append)
//
// Read and write are separate manifests because broker scopes are
// capability-level (workflow.read vs workflow.execute — same split as
// workflow-assistance.js). The append is a NON-STATE side-band command
// (proposal CTR-3: zero workflow_instances/workflow_events rows, no CAS
// input), so it is deliberately NOT a workflow_execute operation and does not
// touch the §25 four-op instance-execution surface.
//
// Authorization stays server-side (CTR-5/CTR-8): the broker models no
// principal/domain/role input, declares the proposal §3 error catalogue, and
// passes service codes through verbatim with no retry
// (AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1).
//
// GOVERNANCE: rides the proposed AGENT_CORE_WORKFLOW_COLLABORATION_BROKER_V1
// (docs-first candidate in this same slice); implementation is NOT authorized
// for merge until that Spec's Owner acceptance flips
// implementation_authority to contracts (merged-main precedent 7655a817).
import { withTransportErrors } from '../transport.js'
import { authErrors, baseErrors } from './workflow-definition-authoring.js'
import { queryErrors } from './workflow-execute.js'

const uuid = (description) => ({ type: 'string', description: description + ' (UUID).' })
const limit = {
  type: 'integer', minimum: 1, maximum: 100,
  validationError: 'invalid_pagination',
  description: 'Page size, 1-100 (server default 50 when omitted; CTR-9).',
}

/** Instance-scoped read codes: visibility 404 family + CTR-9 pagination/cursor. */
const readErrors = [
  ...baseErrors, ...authErrors, ...queryErrors,
  { code: 'workflow_instance_not_found_or_not_visible', description: 'Instance absent or not visible to the caller (HTTP 404).' },
  { code: 'invalid_pagination', description: 'Pagination is invalid (HTTP 422).' },
  { code: 'invalid_cursor', description: 'Cursor triple is incomplete or malformed (HTTP 422).' },
]

/** Append codes: proposal §3 error catalogue (CTR-5 precedence is server-side). */
const appendErrors = [
  ...baseErrors, ...authErrors, ...queryErrors,
  { code: 'workflow_instance_not_found_or_not_visible', description: 'Instance absent or not visible to the caller (HTTP 404).' },
  { code: 'collaboration_write_forbidden', description: 'Caller is visible but holds no write relation (owner/creator/current assignee/historical participant) (HTTP 403).' },
  { code: 'instance_archived', description: 'Instance is archived; the side-band is closed (HTTP 409).' },
  { code: 'idempotency_conflict', description: 'Idempotency key was reused with a different request (HTTP 409).' },
  { code: 'command_still_processing', description: 'The idempotent append command is still processing (HTTP 425).' },
  { code: 'invalid_input', description: 'Body bounds/UUIDs/unknown-field validation failed (HTTP 422).' },
  { code: 'invalid_collaboration_references', description: 'reply/reference does not resolve to the same instance (HTTP 422; aggregated detail).' },
]

export const workflowCollaborationReadManifest = withTransportErrors({
  id: 'workflow_collaboration_read',
  toolName: 'workflow_collaboration_read',
  name: 'Workflow Collaboration Feed',
  description:
    'Read the unified collaboration feed of one workflow instance: a stable ascending stream of '
    + 'COLLABORATION_ENTRY items (kind-free side-band clarifications) and minimal WORKFLOW_FACT items '
    + '(submission/return/terminal/cancel/assistance lifecycle), projected from canonical rows. '
    + 'svc-workflow remains the sole authority for instance visibility (CTR-8); the response carries '
    + 'visibility and keyset continuation exactly like the proposal contract.',
  requiredScopes: ['workflow.read'],
  errors: readErrors,
  operations: [{
    name: 'feed',
    description: 'Read one page of the unified collaboration feed; continue with the full keyset triple (afterCreatedAt + afterItemType + afterId, all-or-none).',
    arguments: {
      properties: {
        workflowInstanceId: uuid('Workflow instance id'),
        limit,
        afterCreatedAt: { type: 'string', description: 'RFC3339 cursor time; pair with afterItemType and afterId (CTR-9).' },
        afterItemType: { type: 'string', enum: ['COLLABORATION_ENTRY', 'WORKFLOW_FACT'], description: 'Cursor item type; pair with afterCreatedAt and afterId.' },
        afterId: { type: 'string', description: 'Cursor item id (event/submission id for facts, collaboration_entry_id for entries); pair with afterCreatedAt and afterItemType.' },
      },
      required: ['workflowInstanceId'],
      allOrNone: [{ properties: ['afterCreatedAt', 'afterItemType', 'afterId'], validationError: 'invalid_cursor' }],
    },
    result: { type: 'json' },
    errors: ['invalid_arguments', 'invalid_pagination', 'invalid_cursor', 'workflow_instance_not_found_or_not_visible', 'forbidden'],
    http: {
      target: 'svc-workflow', method: 'GET',
      path: '/internal/v1/workflow-instances/{workflowInstanceId}/collaboration',
      pathParams: ['workflowInstanceId'],
      query: ['limit', 'afterCreatedAt', 'afterItemType', 'afterId'],
    },
  }],
})

export const workflowCollaborationAppendManifest = withTransportErrors({
  id: 'workflow_collaboration_append',
  toolName: 'workflow_collaboration_append',
  name: 'Workflow Collaboration Append',
  description:
    'Append one kind-free clarification entry to a workflow instance\'s collaboration side-band '
    + '(proposal CTR-3/CTR-5: non-state idempotent command; TERMINAL/CANCELLED instances that are not '
    + 'archived remain writable; archived instances refuse with instance_archived). Write authorization '
    + '(enabled Domain Owner | creator | current assignee | historical participant) is enforced entirely '
    + 'by svc-workflow; author and observation snapshot are server-authored and are never model input.',
  requiredScopes: ['workflow.execute'],
  errors: appendErrors,
  operations: [{
    name: 'append_entry',
    description: 'Append one entry (body 1..16384 chars) with optional same-instance references (replyToEntryId, relatedEventId, relatedSubmissionId, relatedAssistanceCaseId); returns the created entry DTO with a replayed flag on idempotent retry.',
    arguments: {
      properties: {
        workflowInstanceId: uuid('Workflow instance id'),
        body: { type: 'string', description: 'Entry body, 1..16384 chars (service-enforced).' },
        replyToEntryId: uuid('Optional entry being replied to; must belong to the same instance'),
        relatedEventId: uuid('Optional workflow event referenced; must belong to the same instance'),
        relatedSubmissionId: uuid('Optional submission referenced; must belong to the same instance'),
        relatedAssistanceCaseId: uuid('Optional assistance case referenced; must belong to the same instance'),
      },
      required: ['workflowInstanceId', 'body'],
    },
    result: { type: 'json' },
    errors: [
      'invalid_arguments', 'unauthenticated', 'forbidden', 'principal_not_found', 'principal_disabled',
      'workflow_instance_not_found_or_not_visible', 'collaboration_write_forbidden', 'instance_archived',
      'idempotency_conflict', 'command_still_processing', 'invalid_input', 'invalid_collaboration_references',
      'internal_consistency_error', 'service_unavailable',
    ],
    http: {
      target: 'svc-workflow', method: 'POST',
      path: '/internal/v1/workflow-instances/{workflowInstanceId}/collaboration/entries',
      pathParams: ['workflowInstanceId'],
      body: ['body', 'replyToEntryId', 'relatedEventId', 'relatedSubmissionId', 'relatedAssistanceCaseId'],
      idempotencyKey: true,
    },
  }],
})

/** Family array wired through capabilities/manifests.js (one line) into DEFAULT_MANIFESTS. */
export const workflowCollaborationManifests = [
  workflowCollaborationReadManifest,
  workflowCollaborationAppendManifest,
]
