import { fail } from './protocol.js'
import { digest, resolutionBinding } from './codec.js'
export const WORKFLOW_FIELDS = ['workflow_instance_id', 'definition_id', 'definition_version', 'instance_state_version',
  'node_id', 'node_visit_id', 'workflow_owner_principal', 'node_assignee_principal']
export function selectRegistry(entries, caller, operation) {
  if (!Array.isArray(entries) || entries.length === 0) fail('NOT_PROVISIONED')
  const matches = entries.filter(entry => caller.kind === 'human'
    ? entry.human_principal_id === caller.principalId && entry.auth_subject === caller.principalId
    : entry.transport_principal_id === caller.principalId && entry.transport_client_id === caller.clientId)
  if (matches.length === 0) fail('FORBIDDEN')
  if (matches.length !== 1) fail('NOT_PROVISIONED')
  const entry = matches[0]
  if (entry.enabled !== true) fail('FORBIDDEN')
  if (entry.issuer !== 'auth-service' || !entry.binding_id || !entry.version || !entry.communication_scope_id
    || !entry.site_owner_id || !entry.site_project_id || !entry.exact_web_origin
    || !entry.pilot_surface?.channel || !entry.pilot_surface.external_id
    || !/^agt_[A-Za-z0-9_-]+$/.test(entry.pilot_surface.expected_agent_id)
    || ['mobile', 'feishu'].includes(entry.pilot_surface.channel)) fail('NOT_PROVISIONED')
  const permission = { resolve: 'bound_resolve', authorize: 'preauthorize', read: 'own_read', history: 'own_read', events: 'own_events', redeem: 'preauthorize' }[operation]
  if (!entry.allowed_operations?.includes(permission)) fail('FORBIDDEN')
  return structuredClone(entry)
}
export async function resolveBound({ entry, router, definition, native, now }) {
  const pilot = entry.pilot_surface
  const id = router.channelConversationId(pilot.channel, pilot.external_id)
  const binding = await router.getBinding(id)
  if (!binding || binding.activeAgentId !== pilot.expected_agent_id || binding.activeSessionId !== 'main') fail('NOT_FOUND_OR_NOT_VISIBLE')
  const agent = await definition.getAgent(binding.activeAgentId)
  if (!agent || agent.id !== binding.activeAgentId || agent.disabled === true) fail('NOT_FOUND_OR_NOT_VISIBLE')
  const metadata = await native.metadata(agent.id)
  if (!metadata || !['exists', 'absent'].includes(metadata.state)
    || (metadata.state === 'exists' && !/^[a-f0-9]{64}$/.test(metadata.generation))) fail('SOURCE_UNAVAILABLE')
  const observed_at = new Date(now()).toISOString()
  return { resolution_mode: 'BOUND_AGENT_PILOT', ...Object.fromEntries(WORKFLOW_FIELDS.map(field => [field, null])),
    canonical_agent_id: agent.id, agent_domain: { kind: 'agent_security_domain', agent_id: agent.id },
    agent_definition_version: digest(agent), binding_ref: id, binding_version: digest(binding),
    binding_source: { kind: 'router_product_surface_binding', observed_at }, main_state: metadata.state,
    main_generation: metadata.generation ?? null, context_refs: [], allowed_operations: entry.allowed_operations,
    observed_at, field_availability: WORKFLOW_FIELDS.map(field => ({ field, reason: 'NOT_PROJECTED' })) }
}
export function assertSameTarget(old, current) {
  if (old.main_state !== current.main_state || old.main_generation !== current.main_generation) fail('SESSION_GENERATION_CHANGED')
  if (digest(resolutionBinding(old)) !== digest(resolutionBinding(current))) fail('BINDING_CHANGED')
}
