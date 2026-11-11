/** Bounded V3 authoring input compiler. svc-workflow remains the validator. */
const fields = new Set(['domainId', 'definitionId', 'definitionVersionId', 'contextSchema',
  'nodes', 'transitions', 'steps', 'terminalOutcome'])
const stepFields = new Set(['displayName', 'assigneePrincipalId', 'instructions'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const has = (value, key) => Object.hasOwn(value, key)
const textWithin = (value, limit) => typeof value === 'string' && value.trim().length > 0
  && [...value].length <= limit
const invalid = detail => ({ ok: false, error: { code: 'invalid_arguments', detail } })

/** Called at the trusted gateway before credential access, including direct parent RPC. */
export function prepareWorkflowDraft(args) {
  if (!object(args)) return invalid('replace_draft_graph arguments must be an object.')
  if (Object.keys(args).some(key => !fields.has(key))) {
    return invalid('Unknown authoring field. For branches, loops or effects use the full nodes + transitions form.')
  }
  for (const key of ['domainId', 'definitionId', 'definitionVersionId']) {
    if (!has(args, key) || typeof args[key] !== 'string') return invalid(`${key} must be supplied as a string.`)
  }
  const full = has(args, 'nodes') || has(args, 'transitions')
  const linear = has(args, 'steps') || has(args, 'terminalOutcome')
  if (full === linear) return invalid('Supply exactly one form: nodes + transitions OR steps + terminalOutcome.')
  if (full) {
    if (!Array.isArray(args.nodes) || !Array.isArray(args.transitions)) {
      return invalid('Full graph form requires both nodes and transitions arrays.')
    }
    return { ok: true, args }
  }
  if (!Array.isArray(args.steps) || args.steps.length < 1 || args.steps.length > 32) {
    return invalid('steps must contain 1..32 ordered work steps; use full graph form for complex structures.')
  }
  if (!textWithin(args.terminalOutcome, 200)) return invalid('terminalOutcome must be nonblank text of 1..200 characters.')
  for (let i = 0; i < args.steps.length; i++) {
    const step = args.steps[i]
    const at = `steps[${i}]`
    if (!object(step) || Object.keys(step).some(key => !stepFields.has(key))) {
      return invalid(`${at} must contain only displayName, assigneePrincipalId and instructions; use full graph form for complex structures.`)
    }
    if (!textWithin(step.displayName, 200)) return invalid(`${at}.displayName must be nonblank text of 1..200 characters.`)
    if (typeof step.assigneePrincipalId !== 'string' || !uuid.test(step.assigneePrincipalId)) {
      return invalid(`${at}.assigneePrincipalId must be an exact canonical Principal UUID, not an Agent display name.`)
    }
    if (!textWithin(step.instructions, 4000)) return invalid(`${at}.instructions must be nonblank text of 1..4000 characters.`)
  }
  const nodes = args.steps.map((step, i) => ({
    node_key: `step_${i + 1}`, display_name: step.displayName, order_index: i, node_type: 'TASK',
    assignee_ref_type: 'FIXED_PRINCIPAL', fixed_principal_id: step.assigneePrincipalId,
    instructions: step.instructions, primary_advance_transition_key: `advance_${i + 1}`,
  }))
  nodes.push({ node_key: 'done', display_name: args.terminalOutcome, order_index: args.steps.length, node_type: 'TERMINAL' })
  const transitions = args.steps.map((_, i) => ({
    transition_key: `advance_${i + 1}`, display_name: '继续', source_node_key: `step_${i + 1}`,
    target_node_key: i + 1 === args.steps.length ? 'done' : `step_${i + 2}`, transition_effect: 'ADVANCE',
  }))
  const { steps, terminalOutcome, ...rest } = args
  return { ok: true, args: { ...rest, nodes, transitions } }
}
