export async function continuePlannedOwnerResume({ current, verify, complete, recordDeliveryStarted, recordRunDelivered, recordDeliveryFailed, recordResolutionBlocked }) {
  if (current === undefined || current.state !== 'ACTIVE' || current.phase !== 'planned'
    || current.retryReason !== 'owner_assistance_resolved' || current.deliveryStartedAtMs !== undefined) {
    return { resumed: false, cause: 'inapplicable', ...(current === undefined ? {} : { attempt: { ...current } }) }
  }
  let eligible = false
  try { eligible = await verify({ ...current }) === true } catch { eligible = false }
  if (!eligible) return { resumed: false, cause: 'proof_unavailable', attempt: { ...current } }
  const completion = await complete({ ...current }, { recordDeliveryStarted })
  if (completion?.kind === 'resume_proof_unavailable') {
    return { resumed: false, cause: 'proof_unavailable', attempt: { ...current } }
  }
  recordDeliveryCompletion({ completion, recordRunDelivered, recordDeliveryFailed, recordResolutionBlocked })
  return { resumed: true, attempt: current, completion }
}

export async function ownerResumeEligible(existing, staleReentry, canOwnerResume) {
  if (staleReentry || typeof canOwnerResume !== 'function'
    || existing.state !== 'NEEDS_REVIEW' || existing.phase !== 'reconciled'
    || existing.judgment !== 'run_ended_no_submission' || existing.delivered === undefined
    || existing.preDeliveryWorkflowStateVersion === undefined) return false
  try { return await canOwnerResume({ ...existing }) === true } catch { return false }
}

export function recordDeliveryCompletion({ completion, nodeVisitId, recordRunDelivered, recordDeliveryFailed, recordResolutionBlocked }) {
  if (completion?.kind === 'run_delivered') recordRunDelivered(completion, nodeVisitId)
  else if (completion?.kind === 'delivery_failed') recordDeliveryFailed(completion.reason, nodeVisitId)
  else if (completion?.kind === 'resolution_blocked') recordResolutionBlocked(completion.code, nodeVisitId)
  else throw new TypeError('workflow-execution: admission callback returned an unsupported completion')
}
