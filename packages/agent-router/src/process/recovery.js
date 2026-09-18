/**
 * Parent-runtime outcome_unknown recovery coordinator (V3 C-023..C-025).
 * These methods compose onto AgentProcess.prototype and remain outside
 * ordinary prompt admission.
 */

import { randomUUID } from 'node:crypto'
import { monotonicNowMs } from './state-machine.js'

export const recoveryMethods = {
  ensureRecoveryRuntimeState() {
    this.recoveryPromises ??= new Map()
    this.counters.originalPromptReplayWrites ??= 0
    this.counters.originalAnswerResends ??= 0
    this.counters.historicalSideEffectReplays ??= 0
    this.counters.rejectedRequestAutoAdmissions ??= 0
    this.counters.explicitNewRequestExecutions ??= 0
    this.counters.shutdownInvocations ??= 0
  },

  scheduleUnknownRecovery(execution) {
    this.ensureRecoveryRuntimeState()
    if (execution.settled || execution.recoveryTimer !== undefined) return
    const remaining = Math.max(0, execution.turnDeadlineMono - monotonicNowMs())
    execution.recoveryTimer = setTimeout(() => {
      execution.recoveryTimer = undefined
      void this.recoverUnknownExecution(execution.handle).catch((cause) => {
        this.log.error?.(`[router] agent ${this.agentId}: recovery worker failed for ${execution.handle} (${cause?.code ?? 'unclassified'})`)
        try {
          const snapshot = this.store.getTurnReconciliation(execution.handle).snapshot
          const shutdownCommitted = snapshot?.reapClaim?.phase === 'shutdown_committed'
          this.store.markRecoveryBlocked(
            execution.handle,
            shutdownCommitted ? ['child_real_exit'] : ['live_generation_ownership'],
            'recovery_worker_failed',
          )
        } catch { /* durable-store failure already holds admission fail closed */ }
      })
    }, remaining)
    execution.recoveryTimer.unref?.()
  },

  recoverUnknownExecution(handle) {
    this.ensureRecoveryRuntimeState()
    const existing = this.recoveryPromises.get(handle)
    if (existing !== undefined) return existing
    const operation = this.performUnknownRecovery(handle)
      .finally(() => this.recoveryPromises.delete(handle))
    this.recoveryPromises.set(handle, operation)
    return operation
  },

  async performUnknownRecovery(handle) {
    const execution = this.executions.get(handle)
    const record = this.store.getTurnReconciliation(handle)
    if (record.state === 'settled') return { status: 'already_settled' }
    if (execution === undefined || !execution.unknownMarked) {
      this.store.markRecoveryBlocked(handle, ['live_generation_ownership'], 'live_execution_unavailable')
      return { status: 'blocked', reason: 'live_execution_unavailable' }
    }
    const beforeHardDeadline = execution.turnDeadlineMono - monotonicNowMs()
    if (beforeHardDeadline > 0) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, beforeHardDeadline)
        timer.unref?.()
      })
      if (execution.settled || this.store.getTurnReconciliation(handle).state === 'settled') {
        return { status: 'settled_before_hard_deadline' }
      }
    }
    const claimed = this.store.claimRecovery(handle, {
      operationId: randomUUID(), claimantRuntimeEpoch: this.store.runtimeEpoch,
    })
    if (!claimed.won && claimed.reason !== 'joined') return { status: claimed.reason }

    if (typeof this.recoveryBeforeShutdownCommit === 'function') {
      await this.recoveryBeforeShutdownCommit({ handle, execution, claim: claimed.claim })
    } else {
      await Promise.resolve()
    }
    if (execution.settled || this.store.getTurnReconciliation(handle).state === 'settled') {
      this.store.cancelRecoveryClaim(handle)
      return { status: 'canceled_by_settlement' }
    }
    const exactSingleExecution = this.executions.size === 1 && this.executions.get(handle) === execution
    const exactFence = this.activeUnknownFences.has(handle)
    const locallyOwned = this.verifyOwnership()
    if (this.state !== 'READY' || !exactSingleExecution || !exactFence || !locallyOwned) {
      const missing = []
      if (!locallyOwned || this.state !== 'READY') missing.push('live_generation_ownership')
      if (!exactSingleExecution) missing.push('no_concurrent_execution', 'one_active_turn_invariant')
      this.store.markRecoveryBlocked(handle, missing.length > 0 ? missing : ['live_generation_ownership'], 'reap_eligibility_failed')
      return { status: 'blocked', reason: 'reap_eligibility_failed' }
    }
    const reap = this.registryIntegration?.casReap?.(this, `outcome_unknown:${handle}`)
    if (reap === null) {
      this.store.markRecoveryBlocked(handle, ['live_generation_ownership'], 'registry_generation_mismatch')
      return { status: 'blocked', reason: 'registry_generation_mismatch' }
    }
    this.recoveryReapCommittedHandle = handle
    if (!this.store.commitRecoveryShutdown(handle)) {
      this.store.cancelRecoveryClaim(handle, 'settlement_won_before_shutdown_commit')
      return { status: 'canceled_by_settlement' }
    }
    await this.shutdown(this.deadlines.shutdownGraceMs)
    return { status: 'settled_after_exit' }
  },
}
