import { canonicalJSON, sha256Hex } from '../../../../fixed-operation/src/canonical.js'
import { validateInvocation, validateArguments, invoke } from '../../mapping.js'
import { createHttpHandlers, withTransportErrors } from '../../transport.js'
import { ownerObligationErrors } from './owner-obligation.js'
import { ownerOperationRegistry } from './owner-operation-registry.js'

const UUID = /^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/
const HASH = /^[0-9a-f]{64}$/
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const closed = (v, required, optional = []) => object(v) && required.every(k => Object.hasOwn(v, k))
  && Object.keys(v).every(k => required.includes(k) || optional.includes(k))
const equal = (a, b) => canonicalJSON(a) === canonicalJSON(b)
const failure = (code = 'authoritative_reference_unavailable') => ({ ok: false, error: { code } })
const keys = {
  'workflow_execute.create_instance': 'workflow.create_instance',
  'workflow_assistance_action.resolve_current_governance_review': 'workflow.assistance.resolve_current_review',
  'workflow_assistance_action.escalate_to_human': 'workflow.assistance.escalate_to_human',
}
const validVersion = v => Number.isSafeInteger(v) && v > 0
const validSource = s => closed(s, ['workflowInstanceId', 'nodeVisitId', 'definitionVersionId'])
  && Object.values(s).every(v => UUID.test(v))

function validRelation(m, origin) {
  return closed(m, ['version', 'managedKind', 'workflowInstanceId', 'definitionVersionId', 'caseId', 'policyDigest', 'state'], ['currentNode', 'stop'])
    && m.version === 1 && ['INTAKE', 'REVIEW', 'DEPENDENCY'].includes(m.managedKind)
    && ['ACTIVE', 'STOPPED', 'RETIRED', 'COMPLETED'].includes(m.state)
    && m.workflowInstanceId === origin.workflowInstanceId && UUID.test(m.definitionVersionId)
    && UUID.test(m.caseId) && HASH.test(m.policyDigest)
}
function validNode(node, origin) {
  return closed(node, ['nodeVisitId', 'nodeDefinitionId', 'workflowStateVersion'], ['operation', 'reviewAdmission'])
    && node.nodeVisitId === origin.nodeVisitId && UUID.test(node.nodeDefinitionId) && validVersion(node.workflowStateVersion)
}
function validSuccess(e, post = false) {
  const required = ['effectId', 'state', 'commandId', 'result', 'resultDigest', ...(post ? ['replayed'] : ['requestDigest'])]
  return closed(e, required) && e.state === 'SUCCEEDED' && UUID.test(e.effectId) && UUID.test(e.commandId)
    && HASH.test(e.resultDigest) && e.resultDigest === sha256Hex(canonicalJSON(e.result))
    && (post ? typeof e.replayed === 'boolean' : HASH.test(e.requestDigest))
}
function descriptorFor(op, key) {
  if (!closed(op, ['slotKey', 'allowedOperations', 'effect'], ['targetDefinitionVersionId', 'targetDefinitionDigest'])
    || typeof op.slotKey !== 'string' || op.slotKey.length === 0
    || !Array.isArray(op.allowedOperations) || op.allowedOperations.length === 0) return undefined
  const matches = op.allowedOperations.filter(d => d?.key === key)
  const entry = ownerOperationRegistry.find(e => e.descriptor.key === key)
  if (matches.length !== 1 || !entry || !equal(matches[0], entry.descriptor)
    || sha256Hex(canonicalJSON(entry.canonicalInput)) !== entry.descriptor.hash) return undefined
  return entry
}
function validDetail(d, m, priorSuccess) {
  const b = d?.governanceBinding
  return d?.assistanceCaseId === m.caseId && validVersion(d.workflowStateVersion)
    && UUID.test(d.workflowInstanceId) && UUID.test(d.nodeVisitId)
    && (priorSuccess || (d.status === 'OWNER_PENDING' && d.currentNodeVisitId === d.nodeVisitId))
    && b?.assistanceCaseId === m.caseId && b.status === 'BOUND' && UUID.test(b.bindingId)
    && b.source?.workflowInstanceId === d.workflowInstanceId && b.source.nodeVisitId === d.nodeVisitId
    && UUID.test(b.source.definitionVersionId)
    && (m.managedKind !== 'INTAKE' || (b.child?.workflowInstanceId === m.workflowInstanceId
      && b.child.definitionVersionId === m.definitionVersionId))
}
function validReviewProof(proof, detail) {
  const b = detail.governanceBinding, p = detail.governanceTerminalProof
  return closed(proof, ['bindingId', 'terminalEventId', 'submissionId', 'submissionDigest', 'acceptanceContractDigest'])
    && UUID.test(proof.bindingId) && UUID.test(proof.terminalEventId) && UUID.test(proof.submissionId)
    && HASH.test(proof.submissionDigest) && HASH.test(proof.acceptanceContractDigest)
    && p?.verdict === 'ACCEPTED' && b.child?.definitionVersionId === p.definitionVersionId
    && b.child?.acceptanceTransitionId === p.transitionId && b.acceptanceContractDigest === p.acceptanceContractDigest
    && equal(proof, { bindingId: b.bindingId, terminalEventId: p.terminalEventId,
      submissionId: p.submissionId, submissionDigest: p.submissionDigest, acceptanceContractDigest: b.acceptanceContractDigest })
}
function validReview(admission, detail, principalId) {
  const b = detail.governanceBinding
  if (!closed(admission, ['version', 'status', 'source', 'owner', 'proof']) || admission.version !== 1
    || admission.status !== 'ADMISSIBLE' || !validSource(admission.source)
    || !closed(admission.owner, ['principalId', 'bindingId']) || admission.owner.principalId !== principalId
    || !UUID.test(admission.owner.bindingId) || !UUID.test(principalId)) return false
  if (!equal(admission.source, { workflowInstanceId: b.source.workflowInstanceId,
    nodeVisitId: b.source.nodeVisitId, definitionVersionId: b.source.definitionVersionId })) return false
  return validReviewProof(admission.proof, detail)
}

/** Parent-only wrapper; undefined is an explicitly proven unmanaged route, never an unknown read. */
export async function routeOwnerObligation({ call, manifest, context, resolveWorkflowProvenance, executeRead, transport }) {
  if (!['workflow_execute', 'workflow_assistance_action', 'workflow_assistance_request'].includes(call.capabilityId)) return undefined
  const contextTransition = call.capabilityId === 'workflow_execute' && call.operation === 'transition'
    && Object.hasOwn(call.args ?? {}, 'contextPayload')
  let origin
  try { origin = await resolveWorkflowProvenance?.(context) } catch { return failure() }
  if (!origin) return context.workflowProvenance ? failure() : (contextTransition ? failure('invalid_arguments') : undefined)
  if (!closed(origin, ['kind', 'workflowInstanceId', 'nodeVisitId', 'attemptId'])
    || origin.kind !== 'workflow_execution' || !UUID.test(origin.workflowInstanceId)
    || !UUID.test(origin.nodeVisitId) || !/^wfeat-[0-9a-f]{24}$/.test(origin.attemptId)) return failure()
  const validation = validateInvocation(manifest, { operation: call.operation, args: call.args })
  if (!validation.ok) return { ok: false, error: validation.error }
  const read = await executeRead({ capabilityId: 'workflow_owner_obligation', operation: 'read',
    args: { workflowInstanceId: origin.workflowInstanceId } })
  if (!read?.ok) return read?.error?.code === 'owner_obligation_not_managed'
    ? (contextTransition ? failure('invalid_arguments') : undefined) : (read ?? failure())
  const m = read.result
  if (!validRelation(m, origin)) return failure()
  // Existing transition route remains Svc guarded, but cannot target another instance from this turn.
  if (call.capabilityId === 'workflow_execute' && call.operation === 'transition') {
    if (contextTransition && (m.managedKind !== 'INTAKE' || m.state !== 'ACTIVE'
      || !validNode(m.currentNode, origin) || call.args.workflowInstanceId !== origin.workflowInstanceId)) return failure('invalid_arguments')
    return call.args.workflowInstanceId === origin.workflowInstanceId ? undefined : failure('governed_operation_required')
  }
  const key = keys[`${call.capabilityId}.${call.operation}`]
  if (!key || m.managedKind === 'DEPENDENCY') return failure('governed_operation_required')
  const node = m.currentNode
  if (!validNode(node, origin)) return failure()
  const entry = descriptorFor(node.operation, key)
  if (!entry) return failure('governed_operation_required')
  const op = node.operation, e = op.effect
  const priorSuccess = e?.state === 'SUCCEEDED'
  if (priorSuccess ? !validSuccess(e) : (m.state !== 'ACTIVE' || !closed(e, ['state']) || e.state !== 'NOT_STARTED')) return failure()
  if (validateArguments(entry.canonicalInput.inputSchema, call.args).length) return failure('invalid_arguments')
  const args = structuredClone(call.args)
  if (key === 'workflow.create_instance') {
    if (args.definitionVersionId !== op.targetDefinitionVersionId || !UUID.test(op.targetDefinitionVersionId)
      || !HASH.test(op.targetDefinitionDigest)) return failure('governed_operation_required')
  } else if (args.assistanceCaseId !== m.caseId) return failure('governed_operation_required')
  const detailResult = await executeRead({ capabilityId: 'workflow_assistance_read', operation: 'detail',
    args: { assistanceCaseId: m.caseId } })
  if (!detailResult?.ok) return detailResult ?? failure()
  const detail = detailResult.result
  if (!validDetail(detail, m, priorSuccess)) return failure()
  const sourceVersion = key === 'workflow.create_instance' ? detail.workflowStateVersion : args.expectedWorkflowStateVersion
  if (!priorSuccess && sourceVersion !== detail.workflowStateVersion) return failure('workflow_state_version_conflict')
  if (key === 'workflow.assistance.resolve_current_review') {
    if (m.managedKind !== 'REVIEW' || Object.hasOwn(args.resolution.supportingPayload ?? {}, 'governanceChildReview')) return failure()
    let proof
    if (priorSuccess) {
      // Own resolution removes fresh admission. Only its immutable, same-caller
      // case proof can reconstruct the original business request for replay.
      proof = detail.resolution?.supportingPayload?.governanceChildReview
      if (!validReviewProof(proof, detail)) return failure()
    } else {
      const identity = await executeRead({ capabilityId: 'agent_resolve_principal_by_agent', operation: 'resolve',
        args: { agentId: context.agentId } })
      if (!identity?.ok || !validReview(node.reviewAdmission, detail, identity.result?.principalId)) return failure()
      proof = node.reviewAdmission.proof
    }
    args.resolution.supportingPayload = { ...(args.resolution.supportingPayload ?? {}), governanceChildReview: proof }
  }
  const internal = withTransportErrors({ ...manifest, errors: [...new Map([...manifest.errors, ...ownerObligationErrors].map(e => [e.code, e])).values()],
    operations: [{ name: 'execute', arguments: { properties: {}, required: [] }, result: { type: 'json' },
      http: { target: 'svc-workflow', method: 'POST',
        path: '/internal/v1/workflow-instances/{managedInstanceId}/node-visits/{nodeVisitId}/operation-effects/{slotKey}:execute',
        pathParams: ['managedInstanceId', 'nodeVisitId', 'slotKey'],
        body: ['expectedWorkflowStateVersion', 'expectedSourceWorkflowStateVersion', 'operation', 'arguments'] } }],
  })
  const result = await invoke(internal, createHttpHandlers(internal, transport), { operation: 'execute', args: {
    managedInstanceId: origin.workflowInstanceId, nodeVisitId: origin.nodeVisitId, slotKey: op.slotKey,
    expectedWorkflowStateVersion: node.workflowStateVersion, expectedSourceWorkflowStateVersion: sourceVersion,
    operation: entry.descriptor, arguments: args,
  } }, { resolvePrincipal: () => undefined })
  if (!result.ok) return result
  const receipt = result.result
  if (!validSuccess(receipt, true)) return failure()
  // Svc compares descriptor + fully materialized arguments before its replay
  // branch. GET requestDigest also contains old visit/CAS and is not that hash.
  if (priorSuccess && (receipt.replayed !== true || receipt.effectId !== e.effectId
    || receipt.commandId !== e.commandId || receipt.resultDigest !== e.resultDigest || !equal(receipt.result, e.result))) return failure()
  return { ok: true, result: receipt.result }
}
