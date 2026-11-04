/**
 * R22 operator-only exact-generation recovery.
 *
 * This is deliberately narrow: one canonical agentId + one generation, one
 * unresolved recovery record, and an explicit cleanup proof. It never accepts
 * "all", prefixes, a missing generation, or a fence handle supplied by the
 * operator. The reconciliation store remains the CAS authority.
 */

const AGENT_ID = /^agt_[a-z0-9-]+$/

function validateRequest(request) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    throw Object.assign(new TypeError('exact recovery request must be an object'), { code: 'INVALID_RECOVERY_REQUEST' })
  }
  const keys = Object.keys(request).sort().join(',')
  if (keys !== 'agentId,generation') {
    throw Object.assign(new TypeError('exact recovery requires exactly agentId and generation'), { code: 'INVALID_RECOVERY_REQUEST' })
  }
  if (typeof request.agentId !== 'string' || !AGENT_ID.test(request.agentId)) {
    throw Object.assign(new TypeError('agentId must be an exact canonical Agent id'), { code: 'INVALID_RECOVERY_REQUEST' })
  }
  if (!Number.isSafeInteger(request.generation) || request.generation <= 0) {
    throw Object.assign(new TypeError('generation must be a positive integer'), { code: 'INVALID_RECOVERY_REQUEST' })
  }
}

export async function operatorExactGenerationRecovery(request, {
  reconciliationStore,
  registrySnapshot,
  lifecycleSlotSnapshot,
  ensureRunning,
  audit = async () => {},
}) {
  validateRequest(request)
  const { agentId, generation } = request
  const records = reconciliationStore.unresolvedRecoveryRecords().filter(record =>
    record.agentId === agentId && record.processGeneration === generation)
  if (records.length !== 1) {
    await audit({ type: 'operator.exact_generation_recovery', agentId, generation, result: 'rejected', reason: records.length === 0 ? 'RECOVERY_RECORD_NOT_FOUND' : 'RECOVERY_RECORD_AMBIGUOUS' })
    throw Object.assign(new Error('exact recovery record not found or ambiguous'), { code: 'RECOVERY_RECORD_NOT_FOUND' })
  }
  const record = records[0]
  const processes = registrySnapshot().filter(row => row.agentId === agentId)
  const slot = lifecycleSlotSnapshot(agentId)
  const hasLiveOwnership = processes.some(row => row.alive === true)
    || ['READY', 'STARTUP'].includes(slot.state) && slot.generation === generation
  if (hasLiveOwnership || slot.state === 'REAP' && slot.generation === generation) {
    await audit({ type: 'operator.exact_generation_recovery', agentId, generation, handle: record.handle, result: 'rejected', reason: 'LIVE_GENERATION_OWNERSHIP' })
    throw Object.assign(new Error('live ownership or REAP slot remains; refusing fence cleanup'), { code: 'LIVE_GENERATION_OWNERSHIP' })
  }
  // The empty/non-owning slot plus the exact unresolved record is the cleanup
  // proof. markFenceCleared is the store's durable CAS mutation.
  const changed = reconciliationStore.markFenceCleared(record.handle)
  if (!changed && reconciliationStore.activeFenceForAgent?.(agentId)) {
    await audit({ type: 'operator.exact_generation_recovery', agentId, generation, handle: record.handle, result: 'rejected', reason: 'FENCE_CAS_FAILED' })
    throw Object.assign(new Error('fence CAS did not clear the exact record'), { code: 'FENCE_CAS_FAILED' })
  }
  await audit({ type: 'operator.exact_generation_recovery', agentId, generation, handle: record.handle, result: 'fence_cleared' })
  const process = await ensureRunning(agentId)
  await audit({ type: 'operator.exact_generation_recovery', agentId, generation, handle: record.handle, result: 'spawned', pid: process?.pid ?? null })
  return { agentId, generation, handle: record.handle, result: 'recovered', process }
}
