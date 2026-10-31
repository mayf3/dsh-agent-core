/** Pure read view. AGENT_CORE_BUSINESS_RESULT_PROJECTION_V1; never used by dispatch. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const id = (value) => typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null
const sameId = (a, b) => id(a) !== null && id(a) === id(b)
const positive = (n) => Number.isSafeInteger(n) && n > 0
const TRANSITIONS = new Set(['WORKFLOW_TRANSITION_COMMITTED', 'WORKFLOW_CONTEXT_REVISED_AND_TRANSITION_COMMITTED'])
const canonical = (v) => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
}
const clone = (value) => JSON.parse(JSON.stringify(value))

function currentEvent(input, version, gaps) {
  if (input.timelineComplete !== true) gaps.push('TIMELINE_INCOMPLETE')
  const events = new Map()
  const ids = new Map()
  if (!Array.isArray(input.timeline)) gaps.push('TIMELINE_UNREADABLE')
  for (const event of Array.isArray(input.timeline) ? input.timeline : []) {
    if (!event || typeof event !== 'object') { gaps.push('EVENT_COORDINATES_INVALID'); continue }
    if (!sameId(event.workflow_instance_id, input.workflowInstanceId)) {
      gaps.push('EVENT_INSTANCE_MISMATCH')
      continue
    }
    if (!positive(event.event_sequence) || id(event.event_id) === null
      || !positive(event.new_workflow_state_version) || !Number.isSafeInteger(event.old_workflow_state_version)
      || event.old_workflow_state_version < 0 || event.new_workflow_state_version !== event.old_workflow_state_version + 1) {
      gaps.push('EVENT_COORDINATES_INVALID')
      continue
    }
    const previous = events.get(event.event_sequence)
    if ((previous && canonical(previous) !== canonical(event))
      || (ids.has(id(event.event_id)) && ids.get(id(event.event_id)) !== event.event_sequence)) gaps.push('EVENT_CONFLICT')
    events.set(event.event_sequence, event)
    ids.set(id(event.event_id), event.event_sequence)
  }
  const sorted = [...events.values()].sort((a, b) => a.event_sequence - b.event_sequence)
  for (let n = 1; n < sorted.length; n += 1) {
    if (sorted[n].new_workflow_state_version <= sorted[n - 1].new_workflow_state_version) gaps.push('EVENT_VERSION_CONFLICT')
  }
  const latest = sorted.at(-1)
  if (!latest) gaps.push('CURRENT_EVENT_UNAVAILABLE')
  else if (latest.new_workflow_state_version !== version) gaps.push('DETAIL_TIMELINE_VERSION_MISMATCH')
  else if (id(latest.command_id) === null) gaps.push('COMMAND_LINK_UNAVAILABLE')
  return gaps.length === 0 ? latest : null
}

function eventEvidence(event) {
  const evidence = { eventId: event.event_id, eventSequence: event.event_sequence,
    commandId: event.command_id, workflowInstanceId: event.workflow_instance_id,
    oldWorkflowStateVersion: event.old_workflow_state_version, newWorkflowStateVersion: event.new_workflow_state_version }
  for (const [field, source] of Object.entries({ sourceNodeVisitId: 'source_node_visit_id', targetNodeVisitId: 'target_node_visit_id',
    contextRevisionId: 'context_revision_id', submissionId: 'submission_id', createdAt: 'created_at' })) {
    if (event[source] !== undefined && event[source] !== null) evidence[field] = event[source]
  }
  if (id(event.event_data?.transition_definition_id)) evidence.transitionId = event.event_data.transition_definition_id
  return evidence
}

function movement(event, gaps) {
  if (event.event_type === 'WORKFLOW_INSTANCE_CANCELLED') return 'CANCELLED'
  if (!TRANSITIONS.has(event.event_type)) {
    gaps.push('CURRENT_EVENT_NOT_BUSINESS_MOVEMENT')
    return 'UNKNOWN'
  }
  const data = event.event_data
  const effect = event.transition_effect
  const state = { ADVANCE: 'FORWARD', RETURN: 'RETURNED', TERMINATE: 'TERMINATED' }[effect]
  const joins = [['from_node_id', 'source_node_id'], ['to_node_id', 'target_node_id'],
    ['source_node_visit_id', 'source_node_visit_id'], ['target_node_visit_id', 'target_node_visit_id'],
    ['context_revision_id', 'context_revision_id']]
  if (!state || !data || data.transition_effect !== effect || id(data.transition_definition_id) === null
    || joins.some(([top, nested]) => !sameId(event[top], data[nested]))) {
    gaps.push('TRANSITION_LINK_UNAVAILABLE')
    return 'UNKNOWN'
  }
  return state
}

function acceptanceProof(input, event, instance) {
  const graph = input.definition
  if (!graph || !sameId(graph.version?.id, instance.definition_version_id)
    || graph.version?.version_status !== 'PUBLISHED' || graph.version?.semantic_model_version !== 3
    || !sameId(graph.definition?.domain_id, instance.domain_id)
    || !sameId(graph.definition?.id, graph.version?.workflow_definition_id)
    || !Array.isArray(graph.nodes) || !Array.isArray(graph.transitions)
    || graph.nodes_count !== graph.nodes.length || graph.transitions_count !== graph.transitions.length) return 'DEFINITION_PROOF_UNAVAILABLE'
  const transitions = graph.transitions.filter((t) => sameId(t?.transition_id, event.event_data.transition_definition_id))
  const sources = graph.nodes.filter((n) => sameId(n?.node_id, event.from_node_id))
  const targets = graph.nodes.filter((n) => sameId(n?.node_id, event.to_node_id))
  if (transitions.length !== 1 || sources.length !== 1 || targets.length !== 1) return 'DEFINITION_JOIN_UNAVAILABLE'
  const transition = transitions[0]
  const source = sources[0]
  const target = targets[0]
  if (![transition, source, target].every((r) => sameId(r.definition_version_id, instance.definition_version_id))
    || transition.transition_effect !== 'ADVANCE' || !sameId(transition.source_node_id, event.from_node_id)
    || !sameId(transition.target_node_id, event.to_node_id) || source.node_type !== 'TASK'
    || !sameId(source.primary_advance_transition_id, transition.transition_id) || target.node_type !== 'TERMINAL'
    || instance.is_terminal !== true || !sameId(input.detail.detail.current_node_visit_id, event.target_node_visit_id)) return 'ACCEPTANCE_TRANSITION_UNPROVEN'
  const annotation = transition.submission_schema?.['x-workflow-acceptance-binding-v1']
  if (!annotation || canonical(annotation) !== canonical({ contextCatalogPointer: '/acceptanceCriteria', submissionReportPointer: '/acceptanceReport' })) return 'ACCEPTANCE_NOT_DECLARED'
  const matches = (Array.isArray(input.submissions?.items) ? input.submissions.items : [])
    .filter((s) => sameId(s?.submission_id, event.submission_id))
  if (matches.length !== 1) return 'SUBMISSION_PROOF_UNAVAILABLE'
  const submission = matches[0]
  if (!sameId(submission.workflow_instance_id, input.workflowInstanceId)
    || !sameId(submission.source_node_visit_id, event.source_node_visit_id)
    || !sameId(submission.transition_id, transition.transition_id) || submission.transition_effect !== 'ADVANCE'
    || !sameId(submission.context_revision_id, event.context_revision_id)
    || typeof submission.payload_digest !== 'string' || submission.payload_digest === ''
    || submission.payload_digest !== event.event_data.submission_payload_digest) return 'SUBMISSION_LINK_MISMATCH'
  const detail = input.detail.detail
  const context = detail.current_context
  if (!sameId(context?.workflow_instance_id, input.workflowInstanceId)
    || !sameId(context?.context_revision_id, event.context_revision_id)
    || !sameId(detail.current_context_revision_id, event.context_revision_id)) return 'CONTEXT_PROOF_UNAVAILABLE'
  const catalog = context.payload?.acceptanceCriteria
  if (!Array.isArray(catalog) || catalog.length < 1 || catalog.length > 128) return 'CRITERIA_UNPROVEN'
  const criterionIds = new Set()
  const encoder = new TextEncoder()
  for (const criterion of catalog) {
    if (!criterion || canonical(Object.keys(criterion).sort()) !== canonical(['description', 'id'])
      || typeof criterion.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(criterion.id)
      || criterionIds.has(criterion.id) || typeof criterion.description !== 'string'
      || !criterion.description.trim() || encoder.encode(criterion.description).length > 4096) return 'CRITERIA_UNPROVEN'
    criterionIds.add(criterion.id)
  }
  const report = submission.payload?.acceptanceReport
  if (report?.contextRevisionId !== id(event.context_revision_id)
    || !Array.isArray(report.results) || report.results.length !== criterionIds.size) return 'REPORT_UNPROVEN'
  const resultIds = new Set()
  for (const row of report.results) {
    if (!row || !criterionIds.has(row.id) || resultIds.has(row.id) || row.verdict !== 'PASS') return 'REPORT_UNPROVEN'
    resultIds.add(row.id)
  }
  return null
}

export function projectBusinessResult(input) {
  const detail = input.detail?.visibility === 'full' ? input.detail.detail : null
  const instance = detail?.instance
  const version = positive(instance?.workflow_state_version) ? instance.workflow_state_version : null
  const gaps = []
  if (!instance || !sameId(instance.workflow_instance_id, input.workflowInstanceId) || version === null) gaps.push('DETAIL_UNAVAILABLE')
  const event = currentEvent(input, version, gaps)
  const state = event ? movement(event, gaps) : 'UNKNOWN'
  const evidence = event && state !== 'UNKNOWN' ? eventEvidence(event) : null
  const acceptance = { state: 'UNPROVEN', evidence: null }
  if (state === 'FORWARD') {
    const failure = acceptanceProof(input, event, instance)
    if (failure) gaps.push(failure)
    else {
      acceptance.state = 'ACCEPTED'
      acceptance.evidence = { ...evidence, definitionVersionId: instance.definition_version_id,
        submissionDigest: event.event_data.submission_payload_digest,
        contract: 'SVC_WORKFLOW_ACCEPTANCE_CONTEXT_BINDING_V2', meaning: 'STRUCTURAL_BINDING_ONLY' }
    }
  } else gaps.push('ACCEPTANCE_UNPROVEN')
  if (input.submissions?.next_cursor != null) gaps.push('SUBMISSIONS_INCOMPLETE')
  const currentVisit = sameId(instance?.workflow_instance_id, input.workflowInstanceId) ? id(detail?.current_node_visit_id) : null
  return {
    workflowInstanceId: input.workflowInstanceId,
    execution: (input.execution ?? []).map((entry) => ({
      nodeVisitId: entry.nodeVisitId, attemptId: entry.attemptId, generation: entry.generation,
      executionState: entry.executionState,
      attemptClosure: ['SETTLED', 'STALE_NO_PROGRESS'].includes(entry.executionState) ? 'SETTLED' : 'UNRESOLVED',
      visitLeft: currentVisit && id(entry.nodeVisitId) ? currentVisit !== id(entry.nodeVisitId) : null,
    })),
    businessOutcome: { state, workflowStateVersion: version, evidence, acceptance, gaps: [...new Set(gaps)] },
    observations: clone(input.observations ?? []), consistency: 'NON_ATOMIC',
  }
}
