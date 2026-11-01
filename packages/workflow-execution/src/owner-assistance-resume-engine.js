import { judgeDispatchVersionFromDetail, normalizeDueIntent } from './judgment.js'
import { validateOwnerAssistanceResumeEvidence } from './owner-assistance-resume.js'

function sameId(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase()
}

function detailMatchesActivation(body, identity) {
  const detail = body?.detail
  const visit = detail?.current_visit
  const instance = detail?.instance
  return body?.visibility === 'full'
    && instance?.is_terminal === false
    && sameId(instance?.workflow_instance_id, identity.workflowInstanceId)
    && sameId(detail?.current_node_visit_id, identity.nodeVisitId)
    && sameId(visit?.node_visit_id, identity.nodeVisitId)
    && sameId(visit?.workflow_instance_id, identity.workflowInstanceId)
    && sameId(visit?.assignee_principal_id, identity.ownerPrincipalId)
}

export function createOwnerAssistanceResumeOperations({
  fetchDuePage, resolvePrincipalToAgent, readInstanceDetail,
  readOwnerAssistanceResumeEvidence, resolveCallerCorrelation, getTurnReconciliation, deliverRun,
  buildInstruction, provenanceFor, duePageLimit,
}) {
  async function prepareAttemptPlan({ intent, existing, retryReason }) {
    try {
      const resolved = await resolvePrincipalToAgent(intent.ownerPrincipalId)
      const read = await readInstanceDetail({
        ...(resolved?.ok && typeof resolved.agentId === 'string' ? { agentId: resolved.agentId } : {}),
        workflowInstanceId: intent.workflowInstanceId,
      })
      const version = read?.body?.detail?.instance?.workflow_state_version
      if (!read?.ok || !detailMatchesActivation(read.body, intent)
        || !Number.isInteger(version) || version < 1) return undefined
      const plan = { preDeliveryWorkflowStateVersion: version }
      if (retryReason === 'owner_assistance_resolved') {
        if (typeof readOwnerAssistanceResumeEvidence !== 'function' || existing === undefined) return undefined
        const result = await readOwnerAssistanceResumeEvidence({
          dispatchIntentId: intent.dispatchIntentId,
          previousAttemptId: existing.attemptId,
          preDeliveryWorkflowStateVersion: existing.preDeliveryWorkflowStateVersion,
        })
        const checked = validateOwnerAssistanceResumeEvidence(result?.evidence, {
          dispatchIntentId: intent.dispatchIntentId,
          workflowInstanceId: intent.workflowInstanceId,
          nodeVisitId: intent.nodeVisitId,
          ownerPrincipalId: intent.ownerPrincipalId,
          previousAttemptId: existing.attemptId,
          previousPreDeliveryWorkflowStateVersion: existing.preDeliveryWorkflowStateVersion,
          preDeliveryWorkflowStateVersion: version,
        })
        if (!checked.ok) return undefined
        plan.assistanceResume = checked.evidence
      }
      return plan
    } catch { return undefined }
  }

  function queryTurnReconciliation(attempt) {
    const delivered = attempt.delivered
    if (delivered === undefined) return undefined
    let result
    if (typeof delivered.reconciliationHandle === 'string') {
      try { result = getTurnReconciliation(delivered.reconciliationHandle) } catch { result = undefined }
    }
    if ((result === undefined || ['evicted', 'restart_lost', 'never_existed'].includes(result?.state))
      && typeof resolveCallerCorrelation === 'function') {
      try {
        const correlated = resolveCallerCorrelation({ requestId: delivered.requestId })
        if (correlated?.state !== undefined && correlated.state !== 'never_existed') result = correlated
      } catch { /* keep the primary answer */ }
    }
    return result
  }

  function canOwnerResume(attempt, queryTurnReconciliation) {
    if (attempt.state !== 'NEEDS_REVIEW' || attempt.judgment !== 'run_ended_no_submission'
      || attempt.delivered === undefined) return false
    return queryTurnReconciliation(attempt)?.state === 'settled'
  }

  async function verifyPlannedOwnerResume(attempt) {
    if (typeof resolveCallerCorrelation !== 'function'
      || !Number.isInteger(attempt.preDeliveryWorkflowStateVersion)) return false
    let correlation
    try { correlation = resolveCallerCorrelation({ requestId: attempt.attemptId }) } catch { return false }
    if (correlation?.state !== 'never_existed' || Object.keys(correlation).length !== 1) return false
    let cursor
    for (let pageIndex = 0; pageIndex < 1000; pageIndex += 1) {
      const page = await fetchDuePage({
        limit: duePageLimit,
        ...(cursor === undefined ? {} : { afterNextEligibleAt: cursor.afterNextEligibleAt, afterDispatchIntentId: cursor.afterDispatchIntentId }),
      })
      if (!page?.ok) return false
      const items = Array.isArray(page.items) ? page.items : []
      for (const raw of items) {
        const normalized = normalizeDueIntent(raw)
        if (!normalized.ok) continue
        const intent = normalized.intent
        if (intent.dispatchIntentId !== attempt.dispatchIntentId
          || intent.nodeVisitId !== attempt.nodeVisitId
          || intent.workflowInstanceId !== attempt.workflowInstanceId
          || intent.ownerPrincipalId !== attempt.ownerPrincipalId) continue
        const resolved = await resolvePrincipalToAgent(attempt.ownerPrincipalId)
        if (!resolved?.ok || typeof resolved.agentId !== 'string') return false
        const read = await readInstanceDetail({ agentId: resolved.agentId, workflowInstanceId: attempt.workflowInstanceId })
        const detail = read?.body?.detail
        return read?.ok === true && read.body?.visibility === 'full'
          && detailMatchesActivation(read.body, attempt)
          && detail?.instance?.workflow_state_version === attempt.preDeliveryWorkflowStateVersion
      }
      if (items.length < duePageLimit) return false
      const last = items.at(-1)
      if (typeof last?.nextEligibleAt !== 'string' || typeof last?.dispatchIntentId !== 'string') return false
      const next = { afterNextEligibleAt: last.nextEligibleAt, afterDispatchIntentId: last.dispatchIntentId }
      if (cursor !== undefined && cursor.afterNextEligibleAt === next.afterNextEligibleAt && cursor.afterDispatchIntentId === next.afterDispatchIntentId) return false
      cursor = next
    }
    return false
  }

  async function continuePlannedOwnerResume(attempt, recordDeliveryStarted) {
    let deliveryStarted = false
    try {
      const resolved = await resolvePrincipalToAgent(attempt.ownerPrincipalId)
      if (!resolved?.ok || typeof resolved.agentId !== 'string') {
        return { kind: 'resume_proof_unavailable' }
      }
      const read = await readInstanceDetail({ agentId: resolved.agentId, workflowInstanceId: attempt.workflowInstanceId })
      if (!read?.ok || read.body?.visibility !== 'full'
        || !detailMatchesActivation(read.body, attempt)
        || read.body.detail?.instance?.workflow_state_version !== attempt.preDeliveryWorkflowStateVersion) {
        return { kind: 'resume_proof_unavailable' }
      }
      recordDeliveryStarted()
      deliveryStarted = true
      const delivery = await deliverRun({
        requestId: attempt.attemptId,
        agentId: resolved.agentId,
        message: buildInstruction({ workflowInstanceId: attempt.workflowInstanceId, nodeVisitId: attempt.nodeVisitId, dispatchIntentId: attempt.dispatchIntentId, attemptId: attempt.attemptId }),
        messageOrigin: provenanceFor(attempt),
      })
      if (!delivery?.ok) return { kind: 'delivery_failed', reason: `delivery_rejected:${delivery?.code ?? 'unknown'}` }
      let workflowStateVersionAtDispatch
      try {
        const after = await readInstanceDetail({ agentId: resolved.agentId, workflowInstanceId: attempt.workflowInstanceId })
        if (after?.ok) {
          const judged = judgeDispatchVersionFromDetail({ body: after.body })
          if (judged.ok) workflowStateVersionAtDispatch = judged.version
        }
      } catch { /* dispatch version remains optional for stale eligibility */ }
      return { kind: 'run_delivered', agentId: resolved.agentId, requestId: attempt.attemptId, sessionId: delivery.sessionId,
        reconciliationHandle: delivery.reconciliationHandle, messageId: delivery.messageId,
        ...(workflowStateVersionAtDispatch === undefined ? {} : { workflowStateVersionAtDispatch }) }
    } catch (error) {
      if (!deliveryStarted) return { kind: 'resume_proof_unavailable' }
      return { kind: 'delivery_failed', reason: `delivery_unverified: owner-resume continuation failed (${error?.code ?? error?.name ?? 'Error'})` }
    }
  }

  return { prepareAttemptPlan, canOwnerResume, queryTurnReconciliation, verifyPlannedOwnerResume, continuePlannedOwnerResume }
}
