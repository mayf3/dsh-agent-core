/**
 * @agent-core/broker — Agent Definition capability manifests
 * (AGENT_DEFINITION_ACCESS_V1).
 *
 * Pure DATA (JSON-serializable) describing the two Agent Definition
 * capabilities every agent's DSH process carries:
 *
 *   agent.definition.read   list | get
 *     -> open to EVERY credentialed agent (no scope): an agent can see
 *        which agents exist in the organization (identity + display only).
 *   agent.definition.write  create | update | disable | set_default
 *     -> REQUIRES the Auth grant for scope `agent.definition.write`: the
 *        auth-service (the ONLY grant authority) decides, per MachineClient
 *        credential, whether the scope is granted. NO agent id, name or
 *        role is ever compared anywhere.
 *
 * Both capabilities are LOCAL (in-process) capabilities: no `http` binding
 * exists — the parent executes them inside the control plane against the
 * Agent Definition config (single authority). In child mode the tools RELAY
 * to the parent through the existing `agent-core/broker` parent-RPC; in
 * gateway mode the parent dispatches them to the injected local handlers
 * (`agentDefinitionAccess` service).
 *
 * `local: { resource }` declares the nominal token resource used for the
 * write grant check (the auth-service grant config is deployment-side).
 */

import { withTransportErrors } from '../transport.js'

/** Shared error codes (per-manifest; transport codes merged generically). */
const baseErrors = [
  { code: 'invalid_arguments', description: 'Arguments did not satisfy the operation schema.' },
  { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
]

/** READ capability — every credentialed agent may call it (no scope). */
export const agentDefinitionReadManifest = withTransportErrors({
  id: 'agent.definition.read',
  toolName: 'agent_definition_read',
  name: 'Agent Definition Read',
  description:
    'Agent Core capability `agent.definition.read`: read which Agents exist in the organization ' +
    '(identity + display only: id, name, description, disabled). ' +
    'Open to every credentialed agent. Returns {ok: true, result: {...}} on success.',
  // no requiredScopes: read is ALLOWED for all credentialed agents.
  local: true,
  errors: baseErrors,
  operations: [
    {
      name: 'list',
      description: 'List every defined Agent, in config order (id/name/description/disabled).',
      arguments: { properties: {}, required: [] },
      result: { type: 'json' },
      errors: [],
    },
    {
      name: 'get',
      description: 'Resolve one Agent by its opaque id.',
      arguments: {
        properties: { agentId: { type: 'string', description: 'The agent\'s opaque agt_* id.' } },
        required: ['agentId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
    },
  ],
})

/** WRITE capability — allowed only when the Auth grant covers the scope. */
export const agentDefinitionWriteManifest = withTransportErrors({
  id: 'agent.definition.write',
  toolName: 'agent_definition_write',
  name: 'Agent Definition Write',
  description:
    'Agent Core capability `agent.definition.write`: modify the Agent Definition config ' +
    '(create / update / disable / set_default). Every call is authorized by the Auth grant ' +
    'for scope `agent.definition.write` — agents without that grant are denied. ' +
    'An agent id is minted ONCE at create and NEVER changes on rename/update. ' +
    'Returns {ok: true, result: {...}} on success.',
  requiredScopes: ['agent.definition.write'],
  local: { resource: 'agent-definition' },
  errors: [
    ...baseErrors,
    { code: 'access_denied', description: 'The caller credential has no grant for agent.definition.write.' },
    { code: 'agent_not_found', description: 'The referenced agent id does not exist.' },
    { code: 'validation_error', description: 'The requested mutation violates the Agent Definition config rules.' },
  ],
  operations: [
    {
      name: 'create',
      description: 'Create a new Agent: mint ONE stable agt_* id and persist it into the config.',
      arguments: {
        properties: {
          name: { type: 'string', description: 'Display name (renaming later never changes the id).' },
          description: { type: 'string', description: 'Optional display metadata.' },
        },
        required: ['name'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'validation_error'],
    },
    {
      name: 'update',
      description: 'Update display fields of an existing Agent (name / description). The id NEVER changes.',
      arguments: {
        properties: {
          agentId: { type: 'string', description: 'The agent\'s opaque agt_* id.' },
          name: { type: 'string', description: 'New display name (optional).' },
          description: { type: 'string', description: 'New display metadata; null clears it (optional).' },
        },
        required: ['agentId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'agent_not_found', 'validation_error'],
    },
    {
      name: 'disable',
      description: 'Disable an existing Agent: it keeps its stable identity but is no longer routable. ' +
        'Disabling the current default agent is refused (set_default first).',
      arguments: {
        properties: { agentId: { type: 'string', description: 'The agent\'s opaque agt_* id.' } },
        required: ['agentId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'agent_not_found', 'validation_error'],
    },
    {
      name: 'set_default',
      description: 'Set which Agent is the default (first-contact bindings route to it). The target must be enabled.',
      arguments: {
        properties: { agentId: { type: 'string', description: 'The agent\'s opaque agt_* id.' } },
        required: ['agentId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'agent_not_found', 'validation_error'],
    },
  ],
})

/** Both Agent Definition manifests, in registration order. */
export const agentDefinitionManifests = [agentDefinitionReadManifest, agentDefinitionWriteManifest]
