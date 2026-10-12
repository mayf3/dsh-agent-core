/**
 * @agent-core/broker — Workflow Definition Read capability manifest (candidate:
 * AGENT_CORE_WORKFLOW_DEFINITION_VERSION_READ_V1, issue #555).
 *
 * PURE-DATA manifest like every capability family. Read-only, SAME-DOMAIN:
 *
 *   workflow_definition_read.list_definitions      GET .../definitions                     (page)
 *   workflow_definition_read.get_definition    GET .../definitions/{id}   (detail)
 *   workflow_definition_read.get_definition_version GET .../definitions/{id}/versions/{vid} (owner graph detail, AMENDMENT_1)
 *   workflow_definition_read.get_published_version_input_contract
 *       GET /internal/v1/definition-versions/{definitionVersionId}/input-contract
 *       (AMENDMENT_2 candidate, PROPOSED — member-readable PUBLISHED input
 *       contract; admission is svc's create-instance predicate, NOT H-5)
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

import { withTransportErrors } from '../transport.js'
import { authErrors, baseErrors } from './workflow-definition-authoring.js'

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
    'list_definitions pages a domain\u2019s definitions; get_definition returns the definition plus EVERY version row, each carrying version_status (DRAFT|PUBLISHED|…) and the exact context_schema; get_definition_version returns ONE version with its complete graph — these three are OWNER management reads (service-internal H-5 domain-owner check). ' +
    'get_published_version_input_contract (AMENDMENT_2 candidate, PROPOSED) is the MEMBER-readable input-contract read: any caller who could create instances of that version (same five admission conditions and same membership SQL as create) reads ONLY {definitionId, definitionVersionId, versionNumber, versionStatus, contextSchema} of a PUBLISHED version — no graph, no draft, no management data. ' +
    'Authorization is svc-workflow\u2019s own per operation: H-5 domain-owner for the three management reads, the create-instance admission predicate for the member input-contract read (no global read permission is involved or granted; global instance enumeration is not a prerequisite for instance creation). ' +
    'Returns {ok: true, result: <definition page, detail, version graph, or input contract>} on success; nonexistent versions/definitions, foreign domains and unauthorized callers fail exactly as the service reports them.',
  requiredScopes: ['workflow.read'],
  errors: [
    ...baseErrors,
    ...authErrors,
    ...paginationErrors,
    { code: 'definition_not_found', description: 'Definition is absent or intentionally not visible to the caller (HTTP 404).' },
    { code: 'domain_disabled', description: 'The owning domain is disabled (HTTP 403).' },
    { code: 'version_not_published', description: 'The requested version is not PUBLISHED, so its input contract is not readable (HTTP 409; get_published_version_input_contract only).' },
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
    {
      name: 'get_published_version_input_contract',
      description:
        'Read the INPUT CONTRACT of a PUBLISHED definition version as a domain member: exactly {definitionId, definitionVersionId, versionNumber, versionStatus, contextSchema} — the schema workflow_execute(create_instance) validates contextPayload against. Admission is the service\u2019s own create-instance predicate (same five conditions / same membership SQL as create, member-safe order): any caller authorized to create instances of this version may read its published input contract. No graph, no draft, no owner management data; non-PUBLISHED versions answer version_not_published (409); denials are opaque definition_not_found (404).',
      arguments: {
        properties: {
          definitionVersionId: { type: 'string', description: 'Workflow definition version id (UUID), e.g. from get_definition\u2019s version rows or a prior create receipt.' },
        },
        required: ['definitionVersionId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-workflow',
        method: 'GET',
        path: '/internal/v1/definition-versions/{definitionVersionId}/input-contract',
        pathParams: ['definitionVersionId'],
      },
    },
  ],
})
