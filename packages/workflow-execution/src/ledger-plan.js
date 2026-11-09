export const DELIVERY_WAL_PROTOCOL = 'write_ahead_v1'

export async function prepareLedgerAttemptPlan(preparePlan, context) {
  if (typeof preparePlan !== 'function') return { ok: true, plan: {} }
  try {
    const plan = await preparePlan(context)
    return Number.isInteger(plan?.preDeliveryWorkflowStateVersion) ? { ok: true, plan } : { ok: false }
  } catch { return { ok: false } }
}

/** WEC4's engine-only collection stages. Arbitrary legacy callbacks retain
 * their original held-lock discipline; only these named reads may leave it. */
export function isBoundedCollection(preparePlan) {
  return preparePlan !== null && typeof preparePlan === 'object'
    && ['capture', 'collect', 'validate'].every(key => typeof preparePlan[key] === 'function')
}

export function ledgerAttemptPlanContext({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId, existing, generation, ownerResume }) {
  return {
    intent: { dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId },
    existing: existing === undefined ? undefined : { ...existing },
    generation,
    retryReason: ownerResume ? 'owner_assistance_resolved' : existing === undefined ? undefined : 'stale_no_progress',
  }
}

export function buildAttemptPlannedEvent({
  attemptId, nodeVisitId, dispatchIntentId, workflowInstanceId, ownerPrincipalId,
  generation, existing, ownerResume, plan, atMs,
}) {
  return {
    kind: 'attempt_planned', attemptId, deliveryProtocol: DELIVERY_WAL_PROTOCOL,
    nodeVisitId: nodeVisitId.toLowerCase(), dispatchIntentId: dispatchIntentId.toLowerCase(),
    workflowInstanceId: workflowInstanceId.toLowerCase(), ownerPrincipalId: ownerPrincipalId.toLowerCase(),
    atMs,
    ...(generation === 1 ? {} : { generation }),
    ...(existing === undefined ? {} : { retryReason: ownerResume ? 'owner_assistance_resolved' : 'stale_no_progress' }),
    preDeliveryWorkflowStateVersion: plan.preDeliveryWorkflowStateVersion,
    ...(ownerResume ? {
      retryReason: 'owner_assistance_resolved', previousAttemptId: existing.attemptId,
      assistanceResume: plan.assistanceResume,
    } : {}),
  }
}
