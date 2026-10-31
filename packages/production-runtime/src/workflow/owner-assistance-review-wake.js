const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const SHA256_RE = /^[0-9a-f]{64}$/i

/** Deliver one Svc-authored governance-child review wake to its current Owner. */
export async function wakeDomainOwnerAssistanceReview({
  router,
  principalAccess,
  pollerAgentId,
  workflowInstanceId,
  nodeVisitId,
  assistanceCaseId,
  ownerPrincipalId,
  ownerBindingId,
  reviewWakeId,
  bindingId,
  governanceChildInstanceId,
  childNodeVisitId,
  childDefinitionVersionId,
  childTerminalEventId,
  acceptanceTransitionId,
  acceptanceContractDigest,
  childSubmissionId,
  childSubmissionDigest,
}) {
  const requiredIds = [
    workflowInstanceId, nodeVisitId, assistanceCaseId, ownerPrincipalId, ownerBindingId,
    reviewWakeId, bindingId, governanceChildInstanceId, childNodeVisitId,
    childDefinitionVersionId, childTerminalEventId, acceptanceTransitionId,
  ]
  if (requiredIds.some((value) => typeof value !== 'string' || !UUID_RE.test(value))
    || typeof acceptanceContractDigest !== 'string' || !SHA256_RE.test(acceptanceContractDigest)
    || ((childSubmissionId === undefined) !== (childSubmissionDigest === undefined))
    || (childSubmissionId !== undefined && (!UUID_RE.test(childSubmissionId)
      || typeof childSubmissionDigest !== 'string' || !SHA256_RE.test(childSubmissionDigest)))) {
    return { ok: false, code: 'invalid_governance_child_review_wake' }
  }

  const resolved = await principalAccess.handlers.agent_resolve_principal.resolve(
    { principalId: ownerPrincipalId },
    { callerAgentId: pollerAgentId },
  )
  if (!resolved?.ok || typeof resolved.result?.agentId !== 'string') {
    return { ok: false, code: resolved?.error?.code ?? 'owner_resolution_failed', detail: resolved?.error?.detail }
  }

  const ownerAgentId = resolved.result.agentId
  const requestId = `wfassist-review-${bindingId}-${childTerminalEventId}-${ownerPrincipalId}-${reviewWakeId}`
  const correlation = `workflow-assistance-review:${assistanceCaseId}:${bindingId}:${childTerminalEventId}:${ownerPrincipalId}:${reviewWakeId}`
  const existing = typeof router.resolveCallerCorrelation === 'function'
    ? router.resolveCallerCorrelation({ requestId })
    : undefined
  if (existing?.state === 'pending' || existing?.state === 'settled') {
    return { ok: true, ownerAgentId, requestId, reused: true }
  }

  const message = [
    '[WORKFLOW_GOVERNANCE_CHILD_REVIEW]',
    `Assistance case: ${assistanceCaseId}; source workflow ${workflowInstanceId}, visit ${nodeVisitId}.`,
    `Binding ${bindingId}; governance child ${governanceChildInstanceId}, visit ${childNodeVisitId}, DefinitionVersion ${childDefinitionVersionId}.`,
    `Exact child terminal event: ${childTerminalEventId}; acceptance transition: ${acceptanceTransitionId}.`,
    ...(childSubmissionId === undefined ? ['No exact selected-transition submission is recorded. Inspect the terminal event and escalate if acceptance cannot be established.'] : [
      `Exact child submission: ${childSubmissionId}; digest: ${childSubmissionDigest}.`,
    ]),
    `Acceptance contract digest: ${acceptanceContractDigest}.`,
    'You are the current enabled Domain Owner. First use workflow_assistance_read detail to re-read the case and its binding/terminal proof.',
    'Then use workflow_instance_detail and workflow_submission_history to inspect this exact child terminal event and submission under your existing Svc visibility.',
    'If the exact evidence supports resolution, explicitly call workflow_assistance_action resolve_current_governance_review; the Broker reads current case detail and supplies exact service-owned review references. Do not copy or guess reference values. If it does not, explicitly use workflow_assistance_action escalate_to_human.',
    'If a mutation outcome is unknown, read case detail and the existing Workflow resume evidence before deciding; if they do not establish the result, leave it UNKNOWN and do not submit a new mutation.',
    'Delivery is only a review request. Do not infer that the original case is resolved or that the original Workflow resumed.',
  ].join('\n')

  try {
    const receipt = await router.deliver(
      { requestId, agentId: ownerAgentId, sessionMode: 'main', message },
      { messageOrigin: Object.freeze({ kind: 'inter_agent', sourceAgentId: pollerAgentId, correlation }) },
    )
    return { ok: true, ownerAgentId, requestId, sessionId: receipt?.sessionId }
  } catch (error) {
    const after = typeof router.resolveCallerCorrelation === 'function'
      ? router.resolveCallerCorrelation({ requestId })
      : undefined
    if (after?.state === 'pending' || after?.state === 'settled') {
      return { ok: true, ownerAgentId, requestId, reused: true }
    }
    return {
      ok: false,
      code: error?.code ?? error?.status ?? 'owner_wake_failed',
      detail: String(error?.message ?? error).slice(0, 200),
    }
  }
}
