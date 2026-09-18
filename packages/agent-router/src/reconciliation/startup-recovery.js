/** Crash-restart reconciliation for the V3 durable recovery authority. */
export const startupRecoveryMethods = {
  restoreCrashInterruptedRecords() {
    let changed = false
    for (const record of this.records.values()) {
      if (record.state === 'settled') {
        if (record.initialOutcome === 'outcome_unknown' && record.fenceState === 'active') {
          const registryCleanupProven = record.attemptedActions?.some(action =>
            action.action === 'registry_cleanup' && action.result === 'succeeded') === true
          const mayFinishCleanup = record.terminationEvidence !== null
            && (record.reapClaim === null || registryCleanupProven)
          if (mayFinishCleanup) {
            record.fenceState = 'cleared'
            record.recoveryState = 'settled'
            record.failureReason = null
            record.nextSafeAction = 'send_new_request_after_reopened'
            record.attemptedActions = [...(record.attemptedActions ?? []), {
              action: 'fence_cleanup', result: 'succeeded', observedAtWallMs: Date.now(), reasonCode: 'startup_completed_proven_cleanup',
            }].slice(-32)
          } else {
            record.recoveryState = 'blocked'
            record.failureReason = 'registry_cleanup_proof_unavailable'
            record.nextSafeAction = 'operator_exact_generation_recovery'
          }
          record.updatedAt = Date.now()
          changed = true
        }
        continue
      }
      if (record.exitObservedAt !== null && record.exitObservedAt !== undefined) {
        record.state = 'settled'
        record.lateOutcome = 'terminated_without_outcome'
        record.terminationEvidence = 'child_real_exit'
        record.settledAtWallMs = record.settledAtWallMs ?? Date.now()
        record.recoveryState = 'settled'
        record.settlementResult = 'terminated_without_outcome'
        record.missingEvidence = []
        const reapCleanupPending = record.reapClaim !== null && record.reapClaim !== undefined
        record.nextSafeAction = reapCleanupPending ? 'operator_exact_generation_recovery' : 'send_new_request_after_reopened'
        record.fenceState = reapCleanupPending ? 'active' : 'cleared'
        record.failureReason = reapCleanupPending ? 'registry_cleanup_proof_unavailable' : null
        if (reapCleanupPending) record.recoveryState = 'blocked'
        record.updatedAt = Date.now()
        if (record.reapClaim !== null && record.reapClaim !== undefined) {
          record.reapClaim = { ...record.reapClaim, phase: 'settled' }
        }
        changed = true
        continue
      }
      if (record.promptWriteAttempted === true && record.initialOutcome === null) {
        record.initialOutcome = 'outcome_unknown'
        record.initialSource = 'runtime_restart_after_prompt_write'
        record.recoveryState = 'blocked'
        record.missingEvidence = ['live_generation_ownership']
        record.failureReason = 'runtime_restart_ownership_unavailable'
        record.nextSafeAction = 'reestablish_exact_ownership'
        record.fenceState = 'active'
        record.updatedAt = Date.now()
        changed = true
      }
      if (record.promptWriteAttempted !== true && record.initialOutcome === null) {
        record.state = 'settled'
        record.outcome = 'not_admitted'
        record.outcomeEvidence = 'prompt_write_not_attempted'
        record.settledAtWallMs = Date.now()
        record.recoveryState = 'settled'
        record.settlementResult = 'not_admitted'
        record.missingEvidence = []
        record.nextSafeAction = 'send_new_request_after_reopened'
        record.fenceState = 'cleared'
        record.updatedAt = Date.now()
        changed = true
      }
    }
    if (changed) {
      this.recountCapacity()
      this.persistDurable()
    }
  },
}
