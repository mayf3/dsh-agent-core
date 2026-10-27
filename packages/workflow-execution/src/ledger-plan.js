export async function prepareLedgerAttemptPlan(preparePlan, context) {
  if (typeof preparePlan !== 'function') return { ok: true, plan: {} }
  try {
    const plan = await preparePlan(context)
    return Number.isInteger(plan?.preDeliveryWorkflowStateVersion) ? { ok: true, plan } : { ok: false }
  } catch { return { ok: false } }
}
