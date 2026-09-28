/**
 * DOMAIN_OWNER_ASSISTANCE_V1 — thin broker transport over svc-workflow's
 * existing Assistance V1 API. Business authorization stays server-side.
 *
 * Read and mutation are split because broker scopes are capability-level:
 * owner inbox/detail need workflow.read; resolve/escalate need workflow.execute.
 */
import { withTransportErrors } from '../transport.js'
import { authErrors, baseErrors } from './workflow-definition-authoring.js'
import { queryErrors } from './workflow-execute.js'

const uuid = (description) => ({ type: 'string', description: description + ' (UUID).' })
const limit = {
  type: 'integer', minimum: 1, maximum: 100,
  validationError: 'invalid_pagination',
  description: 'Page size, 1-100 (server default when omitted).',
}

const readErrors = [
  ...baseErrors, ...authErrors, ...queryErrors,
  { code: 'assistance_case_not_found_or_not_visible', description: 'Case is absent or not visible.' },
  { code: 'invalid_pagination', description: 'Pagination is invalid.' },
  { code: 'invalid_cursor', description: 'Cursor is malformed or incomplete.' },
]

const actionErrors = [
  ...baseErrors, ...authErrors,
  { code: 'principal_not_found', description: 'Caller principal is not registered.' },
  { code: 'principal_disabled', description: 'Caller principal is disabled.' },
  { code: 'not_domain_owner', description: 'Caller is not the enabled Domain Owner.' },
  { code: 'assistance_case_not_found_or_not_visible', description: 'Case is absent or not visible.' },
  { code: 'assistance_status_conflict', description: 'Case status does not admit this action.' },
  { code: 'workflow_state_version_conflict', description: 'Workflow version CAS failed.' },
  { code: 'invalid_assistance_payload', description: 'Assistance payload is invalid.' },
  { code: 'size_limit_exceeded', description: 'Assistance payload is too large.' },
  { code: 'idempotency_conflict', description: 'Idempotency key conflicts with an earlier request.' },
  { code: 'command_still_processing', description: 'Idempotent command is still processing.' },
  { code: 'internal_consistency_error', description: 'Downstream consistency failure.' },
  { code: 'service_unavailable', description: 'Downstream storage unavailable.' },
]

const payload = (label) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    message: { type: 'string', description: label + ' message.' },
    supportingPayload: { type: 'object', description: 'Optional non-authoritative JSON context.' },
  },
  required: ['message'],
})

export const workflowAssistanceReadManifest = withTransportErrors({
  id: 'workflow_assistance_read',
  toolName: 'workflow_assistance_read',
  name: 'Workflow Assistance Read',
  description:
    'Read the calling Domain Owner\'s open assistance inbox or one visible case. '
    + 'svc-workflow remains the sole authority for Domain Owner visibility.',
  requiredScopes: ['workflow.read'],
  errors: readErrors,
  operations: [{
    name: 'owner_inbox',
    description: 'List open OWNER_PENDING/HUMAN_REQUIRED cases for domains owned by the caller.',
    arguments: {
      properties: {
        limit,
        beforeCreatedAt: { type: 'string', description: 'RFC3339 cursor time; pair with beforeId.' },
        beforeId: uuid('Cursor assistance case id; pair with beforeCreatedAt'),
      },
      required: [],
    },
    result: { type: 'json' },
    errors: ['invalid_arguments', 'invalid_pagination', 'invalid_cursor'],
    http: {
      target: 'svc-workflow', method: 'GET',
      path: '/internal/v1/assistance-cases/owner-inbox',
      query: ['limit', 'beforeCreatedAt', 'beforeId'],
    },
  }, {    name: 'detail',
    description: 'Read one assistance case visible to the caller as requester or Domain Owner.',
    arguments: {
      properties: { assistanceCaseId: uuid('Assistance case id') },
      required: ['assistanceCaseId'],
    },
    result: { type: 'json' },
    errors: ['invalid_arguments', 'assistance_case_not_found_or_not_visible'],
    http: {
      target: 'svc-workflow', method: 'GET',
      path: '/internal/v1/assistance-cases/{assistanceCaseId}',
      pathParams: ['assistanceCaseId'],
    },
  }],
})

export const workflowAssistanceActionManifest = withTransportErrors({
  id: 'workflow_assistance_action',
  toolName: 'workflow_assistance_action',
  name: 'Workflow Assistance Action',
  description:
    'Domain Owner action on an existing assistance case: resolve the blocker '
    + 'or explicitly escalate OWNER_PENDING to HUMAN_REQUIRED.',
  requiredScopes: ['workflow.execute'],
  errors: actionErrors,
  operations: [{    name: 'resolve',
    description: 'Resolve an open assistance case after the Domain Owner handles the blocker.',
    arguments: {
      properties: {
        assistanceCaseId: uuid('Assistance case id'),
        expectedWorkflowStateVersion: { type: 'integer', minimum: 1, description: 'Workflow version for CAS.' },
        resolution: payload('Resolution'),
      },
      required: ['assistanceCaseId', 'expectedWorkflowStateVersion', 'resolution'],
    },
    result: { type: 'json' },
    errors: ['invalid_arguments', 'not_domain_owner', 'assistance_case_not_found_or_not_visible',
      'assistance_status_conflict', 'workflow_state_version_conflict'],
    http: {
      target: 'svc-workflow', method: 'POST',
      path: '/internal/v1/assistance-cases/{assistanceCaseId}/resolve',
      pathParams: ['assistanceCaseId'],
      body: ['expectedWorkflowStateVersion', 'resolution'],
      idempotencyKey: true,
    },
  }, {
    name: 'escalate_to_human',
    description: 'Explicitly move OWNER_PENDING to HUMAN_REQUIRED when owner handling is insufficient.',
    arguments: {
      properties: {        assistanceCaseId: uuid('Assistance case id'),
        expectedWorkflowStateVersion: { type: 'integer', minimum: 1, description: 'Workflow version for CAS.' },
        escalation: payload('Escalation'),
      },
      required: ['assistanceCaseId', 'expectedWorkflowStateVersion', 'escalation'],
    },
    result: { type: 'json' },
    errors: ['invalid_arguments', 'not_domain_owner', 'assistance_case_not_found_or_not_visible',
      'assistance_status_conflict', 'workflow_state_version_conflict'],
    http: {
      target: 'svc-workflow', method: 'POST',
      path: '/internal/v1/assistance-cases/{assistanceCaseId}/escalate-to-human',
      pathParams: ['assistanceCaseId'],
      body: ['expectedWorkflowStateVersion', 'escalation'],
      idempotencyKey: true,
    },
  }],
})

export const workflowAssistanceManifests = [
  workflowAssistanceReadManifest,
  workflowAssistanceActionManifest,
]
