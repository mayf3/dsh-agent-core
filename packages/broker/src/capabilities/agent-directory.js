/**
 * AGENT_CORE_AGENT_DIRECTORY_TOOL_V1 — the `agent_directory` LOCAL
 * capability manifest (read-only Agent discovery).
 *
 * One capability, two READ-ONLY operations over the SAME authoritative
 * snapshot (the Agent Definition — the single canonical source of Agent
 * existence/identity/enabled truth; no second registry, no cache, no
 * mapping state):
 *
 *   resolve  one exact reference (canonical `agt_*` id bytes first, else
 *            exact trimmed-lowercase display name) -> exactly one of
 *            {status:'resolved', agent:{agentId,name,description,enabled}},
 *            {status:'ambiguous', query, candidates:[...]}, or
 *            {status:'not_found', query}. Never a silent first-match pick;
 *            never substring/fuzzy matching; a disabled Agent resolves
 *            explicitly with enabled:false (CTR-IAD-003 observation
 *            semantics — existence truth, the caller decides).
 *   list     every defined Agent in config order, INCLUDING disabled ones,
 *            as {agentId, name, description, enabled}. The field names are
 *            deliberately distinct from the sibling `agent_definition_read`
 *            list shape (`id`/`disabled`).
 *
 * Identity/authorization: `local: true`, NO requiredScopes — visibility is
 * byte-identical to the accepted `agent.definition.read` baseline (every
 * credentialed agent may read identity + display + enabled;
 * PER_CONSUMER_DIRECTORY_GRANT_DECISION_REQUIRED=NO). No auth-service
 * audience, scope, grant or client is created; no `local.resource` is
 * declared because the resource is consulted only for the grant check.
 *
 * The manifest is PURE DATA; the classification lives in the TRUSTED
 * handler (packages/production-runtime/src/agent-directory.js), which is
 * the validation authority — the gateway performs no argument-schema
 * re-validation for local non-scheduler capabilities, so the schemas here
 * are the model-facing hint plus defense-in-depth (`additionalProperties:
 * false`, `nonBlank: true`). `internal_error` is DECLARED because the
 * gateway converts any thrown local handler to it and the child relay
 * fail-closes undeclared codes to `invalid_arguments`, which would
 * mislabel a wiring fault as a model input fault.
 */

import { withTransportErrors } from '../transport.js'

/** Closed error table (per-manifest; generic transport codes merged below). */
const baseErrors = [
  { code: 'invalid_arguments', description: 'Arguments violate the operation schema (resolve needs exactly one non-blank string query; list takes no arguments).' },
  { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
  { code: 'internal_error', description: 'The trusted directory handler failed before producing a discovery outcome; never fabricated as a status.' },
]

/** Wire capability id (also the provider handlers key — see broker index). */
export const AGENT_DIRECTORY_CAPABILITY_ID = 'agent.directory'

export const agentDirectoryManifest = withTransportErrors({
  id: AGENT_DIRECTORY_CAPABILITY_ID,
  toolName: 'agent_directory',
  selector: 'operation',
  name: 'Agent Directory',
  description:
    'Search or list Agents available to you and resolve a human-readable Agent reference to its ' +
    'canonical agent_id. Use this BEFORE any cross-Agent operation (agent_session_send targetAgentId, ' +
    'workflow assignee, dispatch) whenever you do not already know the target canonical agent_id. ' +
    'Do not guess UUIDs, do not ask the user for a UUID, and do not reuse an id copied from an old ' +
    'conversation: pass the returned agent.agentId VERBATIM as the canonical reference, and never send ' +
    'to a result whose enabled is false. Matching is exact only (canonical agt_* id, or exact display ' +
    'name, case-insensitive): ambiguous matches return every candidate instead of picking one, and ' +
    'unknown references return not_found instead of a guess. The list operation reports every Agent as ' +
    '{agentId, name, description, enabled} — a different field shape from agent_definition_read.',
  local: true,
  // No requiredScopes: read is ALLOWED for all credentialed agents
  // (agent.definition.read baseline; no boundary expansion).
  errors: baseErrors,
  operations: [
    {
      name: 'resolve',
      description: 'Resolve one exact Agent reference to resolved/ambiguous/not_found. Exact id bytes first, then exact display name (trim + case fold). Disabled Agents resolve with enabled:false.',
      arguments: {
        additionalProperties: false,
        properties: {
          query: {
            type: 'string',
            nonBlank: true,
            description: "The exact canonical agent id (agt_*) or the Agent's exact display name.",
          },
        },
        required: ['query'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'internal_error'],
    },
    {
      name: 'list',
      description: 'List every Agent in the directory, in config order, including disabled ones (enabled:false).',
      arguments: { additionalProperties: false, properties: {}, required: [] },
      result: { type: 'json' },
      errors: ['internal_error'],
    },
  ],
})

export const manifests = [agentDirectoryManifest]
