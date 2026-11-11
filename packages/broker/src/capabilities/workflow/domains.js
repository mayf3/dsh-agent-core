import { withTransportErrors } from '../../transport.js'
import { authErrors, baseErrors } from './definition-authoring.js'
import { queryErrors } from './execute.js'
import { limitProperty } from './reads.js'

/**
 * Coordinator control-plane capabilities (AGENT_CORE_WORKFLOW_COORDINATOR_CONTROL_PLANE_BROKER_V1;
 * upstream wire/authorization authority SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 @ svc-workflow).
 * Domain create carries the AGENT_CORE_DOMAIN_CREATE_CANONICAL_CONTRACT_BROKER_V1
 * amendment: business inputs only — svc-workflow generates the domainId server-side
 * and makes the authenticated caller the domain's DOMAIN_OWNER (creator-becomes-owner).
 * Grouped tools expose the GLOBAL_WORKFLOW_COORDINATOR control plane plus
 * DOMAIN_OWNER own-domain autonomy for members. Authorization is ZERO-REPLICATED:
 * every operation is enforced server-side from role bindings; the broker only
 * declares the downstream error codes and forwards fail-closed outcomes verbatim.
 * All principal inputs are exact canonical UUIDs (via agent_resolve_principal or
 * an exact upstream UUID field) — there is NO name-to-UUID channel. Write
 * operations ride the trusted transport Idempotency-Key seam (model-inaccessible);
 * server responses (including the member-add `outcome` field) are forwarded
 * verbatim — the broker never synthesizes, retries or translates outcomes.
 */
const domainMetadataErrors = [
  ...baseErrors,
  ...authErrors,
  ...queryErrors,
  { code: 'domain_not_found', description: 'Domain not found (HTTP 404).' },
  { code: 'domain_disabled', description: 'Domain is disabled (HTTP 403).' },
  { code: 'invalid_input', description: 'Field validation failed, e.g. displayName constraints (HTTP 422).' },
  { code: 'domain_owner_missing', description: 'No enabled DOMAIN_OWNER exists for the domain (HTTP 404, get_owner).' },
  { code: 'idempotency_conflict', description: 'Idempotency key was reused with a different request (HTTP 409).' },
  { code: 'command_still_processing', description: 'The idempotent command is still processing (HTTP 425).' },
  { code: 'not_domain_owner', description: 'Caller holds neither DOMAIN_OWNER of the domain nor GLOBAL_WORKFLOW_COORDINATOR (HTTP 403).' },
  { code: 'global_coordinator_required', description: 'Caller must hold GLOBAL_WORKFLOW_COORDINATOR (HTTP 403).' },
  { code: 'invalid_pagination', description: 'Pagination parameters are invalid (limit must be 1-20).' },
  { code: 'invalid_cursor', description: 'Cursor parameters are invalid (beforeCreatedAt and beforeId must be given together).' },
]

const uuidField = (what) => ({
  type: 'string',
  description: what + ' (UUID).',
})

export const workflowDomainAdminManifest = withTransportErrors({
  id: 'workflow_domain_admin',
  toolName: 'workflow_domain_admin',
  name: 'Workflow Domain Admin',
  description:
    'Agent Core capability `workflow_domain_admin` (svc-workflow coordinator control plane): governance metadata for workflow domains. ' +
    'operations: list (keyset cursor over minimal governance metadata), get, create (canonical contract: business inputs only — the server generates the domainId and the authenticated caller becomes the DOMAIN_OWNER), update (displayName ONLY in V1), get_owner, set_owner (atomic owner replacement). ' +
    'Server-side role bindings are the only authority (GLOBAL_WORKFLOW_COORDINATOR; get_owner also allows the domain own enabled DOMAIN_OWNER; create needs no role — creator-becomes-owner). Principal ids must come from agent_resolve_principal or an exact upstream UUID field.',
  requiredScopes: ['workflow.read', 'workflow.execute'],
  errors: domainMetadataErrors,
  operations: [
    {
      name: 'list',
      description: 'List domains with minimal governance metadata. Optional: limit, beforeCreatedAt + beforeId (paired keyset cursor).',
      arguments: {
        properties: {
          limit: limitProperty,
          beforeCreatedAt: { type: 'string', description: 'Cursor: RFC 3339 timestamp of the last item seen; must be paired with beforeId.' },
          beforeId: uuidField('Cursor: domain id of the last item seen; must be paired with beforeCreatedAt'),
        },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'invalid_pagination', 'invalid_cursor'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/domains',
        query: ['limit', 'beforeCreatedAt', 'beforeId'],
      },
    },
    {
      name: 'get',
      description: 'Read one domain governance metadata record.',
      arguments: {
        properties: { domainId: uuidField('Domain id') },
        required: ['domainId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/domains/{domainId}',
        pathParams: ['domainId'],
      },
    },
    {
      name: 'create',
      description: 'Create a domain (canonical contract: business inputs only). Required: domainKey, enabled. Optional: displayName. The server generates the domainId and the authenticated caller becomes the domain DOMAIN_OWNER (creator-becomes-owner); the response returns {domainId, domainKey, displayName, enabled, ownerPrincipalId}.',
      arguments: {
        properties: {
          domainKey: { type: 'string', description: 'Unique domain key (1-128 chars, no whitespace/control).' },
          displayName: { type: 'string', description: 'Optional display name (1-256 chars).' },
          enabled: { type: 'boolean', description: 'Whether the domain is enabled.' },
        },
        required: ['domainKey', 'enabled'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/domains',
        body: ['domainKey', 'displayName', 'enabled'],
        idempotencyKey: true,
      },
    },
    {
      name: 'update',
      description: 'Update a domain governance metadata field. V1: displayName only (domainId/domainKey/enabled are immutable).',
      arguments: {
        properties: {
          domainId: uuidField('Domain id'),
          displayName: { type: 'string', description: 'New display name (1-256 chars).' },
        },
        required: ['domainId', 'displayName'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'PATCH',
        path: '/internal/v1/domains/{domainId}',
        pathParams: ['domainId'],
        body: ['displayName'],
        idempotencyKey: true,
      },
    },
    {
      name: 'get_owner',
      description: 'Read the current enabled DOMAIN_OWNER of a domain. Returns {domainId, ownerPrincipalId, ownerDisplayName, ownerEnabled}; 404 domain_owner_missing when absent.',
      arguments: {
        properties: { domainId: uuidField('Domain id') },
        required: ['domainId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'domain_owner_missing', 'domain_not_found'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/domains/{domainId}/owner',
        pathParams: ['domainId'],
      },
    },
    {
      name: 'set_owner',
      description: 'Atomically replace the domain owner (GLOBAL_WORKFLOW_COORDINATOR only). AT-MOST-ONE-ENABLED-DOMAIN-OWNER is enforced server-side; never manage DOMAIN_OWNER through the members tool.',
      arguments: {
        properties: {
          domainId: uuidField('Domain id'),
          newOwnerPrincipalId: uuidField('New owner canonical principal id (from canonical discovery)'),
        },
        required: ['domainId', 'newOwnerPrincipalId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'PUT',
        path: '/internal/v1/domains/{domainId}/owner',
        pathParams: ['domainId'],
        body: ['newOwnerPrincipalId'],
        idempotencyKey: true,
      },
    },
  ],
})

const memberFamilyErrors = [
  ...baseErrors,
  ...authErrors,
  ...queryErrors,
  { code: 'domain_not_found', description: 'Domain not found (HTTP 404).' },
  { code: 'principal_not_registered', description: 'Target principal has not completed self-projection (HTTP 404/422).' },
  { code: 'principal_projection_conflict', description: 'Principal exists with a different type (HTTP 409).' },
  { code: 'member_not_found', description: 'No enabled DOMAIN_MEMBER binding for the target (HTTP 404, remove).' },
  { code: 'principal_is_owner', description: 'Target is the domain owner and cannot be added as a member (HTTP 409).' },
  { code: 'not_domain_owner', description: 'Caller holds neither DOMAIN_OWNER of the domain nor GLOBAL_WORKFLOW_COORDINATOR (HTTP 403).' },
  { code: 'direct_token_required', description: 'Only direct access tokens may manage domain members (HTTP 403).' },
  { code: 'global_coordinator_required', description: 'Caller must hold GLOBAL_WORKFLOW_COORDINATOR for cross-domain member governance (HTTP 403).' },
  { code: 'idempotency_conflict', description: 'Idempotency key was reused with a different request (HTTP 409).' },
  { code: 'command_still_processing', description: 'The idempotent command is still processing (HTTP 425).' },
  { code: 'invalid_pagination', description: 'Pagination parameters are invalid (limit must be 1-20).' },
  { code: 'invalid_cursor', description: 'Cursor parameters are invalid (beforeCreatedAt and beforeId must be given together).' },
]

export const workflowDomainMembersManifest = withTransportErrors({
  id: 'workflow_domain_members',
  toolName: 'workflow_domain_members',
  name: 'Workflow Domain Members',
  description:
    'Agent Core capability `workflow_domain_members` (svc-workflow): DOMAIN_MEMBER binding governance. Serves BOTH Domain Owner own-domain autonomy AND GLOBAL_WORKFLOW_COORDINATOR cross-domain governance — the coordinator does not replace the owner. ' +
    'operations: list, add, remove. add is idempotent with a three-state outcome contract: first logical add returns outcome=added; a NEW idempotency key against an already-enabled member returns outcome=already_member (zero binding mutation, zero duplicate audit — server-side); the SAME key replay returns the original response. remove only ever touches DOMAIN_MEMBER (never DOMAIN_OWNER) and returns 404 member_not_found when absent. ' +
    'The server `outcome` field is forwarded verbatim. Authorization is server-side: DOMAIN_OWNER(domain) OR GLOBAL_WORKFLOW_COORDINATOR.',
  requiredScopes: ['workflow.read', 'workflow.execute'],
  errors: memberFamilyErrors,
  operations: [
    {
      name: 'list',
      description: 'List enabled DOMAIN_MEMBER bindings of a domain. Optional: limit, beforeCreatedAt + beforeId (paired keyset cursor).',
      arguments: {
        properties: {
          domainId: uuidField('Domain id'),
          limit: limitProperty,
          beforeCreatedAt: { type: 'string', description: 'Cursor: RFC 3339 timestamp of the last item seen; must be paired with beforeId.' },
          beforeId: uuidField('Cursor: principal id of the last item seen; must be paired with beforeCreatedAt'),
        },
        required: ['domainId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'invalid_pagination', 'invalid_cursor'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/domains/{domainId}/members',
        pathParams: ['domainId'],
        query: ['limit', 'beforeCreatedAt', 'beforeId'],
      },
    },
    {
      name: 'add',
      description: 'Add a principal as DOMAIN_MEMBER (idempotent). Response outcome: added | already_member — forwarded verbatim from the server.',
      arguments: {
        properties: {
          domainId: uuidField('Domain id'),
          principalId: uuidField('Target canonical principal id (from canonical discovery)'),
        },
        required: ['domainId', 'principalId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'PUT',
        path: '/internal/v1/domains/{domainId}/members/{principalId}',
        pathParams: ['domainId', 'principalId'],
        idempotencyKey: true,
      },
    },
    {
      name: 'remove',
      description: 'Remove the DOMAIN_MEMBER binding (never DOMAIN_OWNER). 404 member_not_found when no enabled binding exists.',
      arguments: {
        properties: {
          domainId: uuidField('Domain id'),
          principalId: uuidField('Target canonical principal id'),
        },
        required: ['domainId', 'principalId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'member_not_found'],
      http: {
        target: 'svc-workflow',
        method: 'DELETE',
        path: '/internal/v1/domains/{domainId}/members/{principalId}',
        pathParams: ['domainId', 'principalId'],
        idempotencyKey: true,
      },
    },
  ],
})

const reconcileFamilyErrors = [
  ...baseErrors,
  ...authErrors,
  ...queryErrors,
  { code: 'domain_not_found', description: 'Domain not found (HTTP 404).' },
  { code: 'identity_not_found', description: 'Reconcile input exact UUID does not exist (HTTP 404).' },
  // principal_disabled arrives via the shared queryErrors table: on this
  // family it means the TARGET principal is disabled (a disabled SOURCE is
  // not an error — it is the repairable input, DEC-CP-007 mirror).
  { code: 'binding_conflict', description: 'Exact preimage mismatch, target conflict, or single-owner invariant conflict — zero mutation (HTTP 409).' },
  { code: 'invalid_input', description: 'Malformed role/reason/UUID (HTTP 422).' },
  { code: 'not_domain_owner', description: 'Caller is not authorized for this surface (HTTP 403).' },
  { code: 'global_coordinator_required', description: 'Caller must hold GLOBAL_WORKFLOW_COORDINATOR (HTTP 403).' },
  { code: 'idempotency_conflict', description: 'Idempotency key was reused with a different request (HTTP 409).' },
  { code: 'command_still_processing', description: 'The idempotent command is still processing (HTTP 425).' },
]

export const workflowDomainBindingReconcileManifest = withTransportErrors({
  id: 'workflow_domain_binding_reconcile',
  toolName: 'workflow_domain_binding_reconcile',
  name: 'Workflow Domain Binding Reconcile',
  description:
    'Agent Core capability `workflow_domain_binding_reconcile` (svc-workflow coordinator control plane): narrow canonical binding reconciliation for broken domain role bindings. GLOBAL_WORKFLOW_COORDINATOR only. ' +
    'operations: plan (read-only judgment with explicit source/target quads and blockers; a disabled SOURCE principal is NOT a blocker — it is the repairable input) and apply (atomic disable-old + establish-new behind exact enabled-preimage re-assertion; outcomes applied | noop; replay returns the original response; any preimage drift is 409 binding_conflict with zero mutation). role is DOMAIN_OWNER | DOMAIN_MEMBER. ' +
    'Both principal ids must be exact canonical UUIDs from formal discovery — malformed input is 422 invalid_input, a missing exact UUID is 404 identity_not_found, a disabled TARGET is 403 principal_disabled.',
  requiredScopes: ['workflow.read', 'workflow.execute'],
  errors: reconcileFamilyErrors,
  operations: [
    {
      name: 'plan',
      description: 'Read-only reconciliation plan. Returns sourcePrincipalExists/Enabled, sourceBindingExists/Enabled, targetPrincipalExists/Enabled, targetHasEnabledBinding, singleOwnerInvariantOk, plan, blockers[].',
      arguments: {
        properties: {
          domainId: uuidField('Domain id'),
          role: { type: 'string', description: 'DOMAIN_OWNER | DOMAIN_MEMBER.' },
          fromPrincipalId: uuidField('Source canonical principal id'),
          toPrincipalId: uuidField('Target canonical principal id (must exist and be enabled)'),
          reason: { type: 'string', description: 'Why this reconciliation is needed (1-512 chars).' },
        },
        required: ['domainId', 'role', 'fromPrincipalId', 'toPrincipalId', 'reason'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/domains/{domainId}/binding-reconcile/plan',
        pathParams: ['domainId'],
        body: ['role', 'fromPrincipalId', 'toPrincipalId', 'reason'],
      },
    },
    {
      name: 'apply',
      description: 'Apply the reconciliation atomically. Response outcome: applied | noop; same-key replay returns the original response.',
      arguments: {
        properties: {
          domainId: uuidField('Domain id'),
          role: { type: 'string', description: 'DOMAIN_OWNER | DOMAIN_MEMBER.' },
          fromPrincipalId: uuidField('Source canonical principal id (exact enabled binding preimage)'),
          toPrincipalId: uuidField('Target canonical principal id (must exist and be enabled)'),
          reason: { type: 'string', description: 'Why this reconciliation is needed (1-512 chars).' },
        },
        required: ['domainId', 'role', 'fromPrincipalId', 'toPrincipalId', 'reason'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'POST',
        path: '/internal/v1/domains/{domainId}/binding-reconcile/apply',
        pathParams: ['domainId'],
        body: ['role', 'fromPrincipalId', 'toPrincipalId', 'reason'],
        idempotencyKey: true,
      },
    },
  ],
})
