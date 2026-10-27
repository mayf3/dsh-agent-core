export async function continuePlannedOwnerResume({ current, verify, complete, recordDeliveryStarted, recordRunDelivered, recordDeliveryFailed, recordResolutionBlocked }) {
  if (current === undefined || current.state !== 'ACTIVE' || current.phase !== 'planned'
    || current.retryReason !== 'owner_assistance_resolved' || current.deliveryStartedAtMs !== undefined) {
    return { resumed: false, cause: 'inapplicable', ...(current === undefined ? {} : { attempt: { ...current } }) }
  }
  let eligible = false
  try { eligible = await verify({ ...current }) === true } catch { eligible = false }
  if (!eligible) return { resumed: false, cause: 'proof_unavailable', attempt: { ...current } }
  const completion = await complete({ ...current }, { recordDeliveryStarted })
  if (completion?.kind === 'run_delivered') recordRunDelivered(completion)
  else if (completion?.kind === 'delivery_failed') recordDeliveryFailed(completion.reason)
  else if (completion?.kind === 'resolution_blocked') recordResolutionBlocked(completion.code)
  else throw new TypeError('workflow-execution: planned Owner-resume callback returned an unsupported completion')
  return { resumed: true, attempt: current, completion }
}
