import { withTransportErrors } from '../../transport.js'
import { authErrors, baseErrors } from './definition-authoring.js'

export const ownerObligationErrors = [
  ...baseErrors, ...authErrors,
  ...['owner_obligation_not_managed', 'workflow_instance_not_found_or_not_visible',
    'operation_effect_not_found_or_not_visible', 'governed_operation_required',
    'authoritative_reference_unavailable', 'service_unavailable', 'internal_consistency_error',
    'workflow_state_version_conflict', 'not_domain_owner', 'owner_changed_unsupported',
    'operation_rejected_zero_facts', 'idempotency_conflict', 'command_still_processing',
    'visit_not_current', 'outcome_unknown', 'policy_actor_mismatch', 'system_policy_actor_unavailable',
    'operation_target_mismatch', 'owner_node_gate_binding_required', 'owner_node_gate_binding_mismatch', 'review_outcome_mismatch']
    .map(code => ({ code, description: 'Authoritative owner-obligation guard or read failure.' })),
]
const uuid = { type: 'string', format: 'uuid', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' }
export const workflowOwnerObligationManifest = withTransportErrors({
  id: 'workflow_owner_obligation', toolName: 'workflow_owner_obligation', name: 'Workflow Owner Obligation',
  description: 'Read the authoritative managed relation or a known durable operation effect. Reads never replay mutations.',
  requiredScopes: ['workflow.read'], errors: ownerObligationErrors,
  operations: ['read', 'read_effect'].map(name => ({
    name, description: name === 'read' ? 'Read current managed node and stable effect, including after response loss.' : 'Read a known operation effect.',
    arguments: { type: 'object', additionalProperties: false,
      properties: { workflowInstanceId: uuid, ...(name === 'read_effect' ? { effectId: uuid } : {}) },
      required: ['workflowInstanceId', ...(name === 'read_effect' ? ['effectId'] : [])] },
    result: { type: 'json' }, errors: ['invalid_arguments'],
    http: { target: 'svc-workflow', method: 'GET',
      path: '/internal/v1/workflow-instances/{workflowInstanceId}/' + (name === 'read' ? 'owner-obligation' : 'operation-effects/{effectId}'),
      pathParams: ['workflowInstanceId', ...(name === 'read_effect' ? ['effectId'] : [])] },
  })),
})

// These are also declared by the existing child-side write tools: relay invoke
// must preserve the parent's managed guard failures rather than recode them.
export function withManagedWriteErrors(manifest) {
  const codes = ['governed_operation_required', 'authoritative_reference_unavailable',
    'owner_changed_unsupported', 'operation_rejected_zero_facts', 'outcome_unknown',
    'visit_not_current', 'policy_actor_mismatch', 'system_policy_actor_unavailable',
    'operation_target_mismatch', 'owner_node_gate_binding_required',
    'owner_node_gate_binding_mismatch', 'review_outcome_mismatch']
  const declared = new Map(manifest.errors.map(e => [e.code, e]))
  for (const code of codes) if (!declared.has(code)) declared.set(code, { code, description: 'Svc-owned managed workflow admission or effect refusal; never automatically replay.' })
  return { ...manifest, errors: [...declared.values()] }
}
