/**
 * @agent-core/agent-router/src/reconciliation/state-machine.js — the
 * settle-once and recovery state machine of AGENT_PROCESS_LIFECYCLE_HARDENING_V3
 * (C-017 direct/late settlement and C-019/C-024/C-025 recovery state).
 *
 * These methods compose onto TurnReconciliationStore.prototype (store.js);
 * they operate on the store's own record fields through `this` and stay the
 * SINGLE settlement authority — the AgentProcess local matcher is bounded
 * working state only, never a second truth source.
 */

/** The mutually exclusive late outcomes (C-017). */
export const LATE_OUTCOMES = Object.freeze(['late_completed', 'late_failed', 'terminated_without_outcome'])
/** Direct (in-deadline) terminal outcomes (C-010 closed envelope). */
export const DIRECT_OUTCOMES = Object.freeze(['completed', 'failed', 'not_admitted'])
/** The trusted termination evidence types (C-015). */
export const TERMINATION_EVIDENCE_TYPES = Object.freeze([
  'exact_terminal_then_idle',
  'exact_started_then_idle',
  'exact_queued_removal',
  'child_real_exit',
  'cancellation_ack',
])

export const settlementMethods = {
  recordRecoveryAction(handle, { action, result, reasonCode }) {
    const record = this.requireRecord(handle)
    this.mutateRecord(record, (candidate) => {
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action,
        result,
        observedAtWallMs: Date.now(),
        reasonCode,
      }].slice(-32)
    })
    return true
  },

  claimRecovery(handle, { operationId, claimantRuntimeEpoch }) {
    const record = this.requireRecord(handle)
    if (record.state === 'settled') return { won: false, reason: 'already_settled', claim: record.reapClaim }
    if (record.initialOutcome !== 'outcome_unknown') return { won: false, reason: 'not_outcome_unknown', claim: null }
    if (record.reapClaim !== null && record.reapClaim !== undefined) {
      const sameRuntimeClaim = record.reapClaim.phase === 'claimed'
        && record.reapClaim.claimantRuntimeEpoch === claimantRuntimeEpoch
      return {
        won: false,
        reason: sameRuntimeClaim ? 'joined' : `claim_${record.reapClaim.phase}`,
        claim: { ...record.reapClaim },
      }
    }
    const claimedAt = Date.now()
    this.mutateRecord(record, (candidate) => {
      candidate.recoveryState = 'recovery_claimed'
      candidate.reapClaim = {
        operationId, claimantRuntimeEpoch, claimedAt, phase: 'claimed',
        runtimeEpoch: candidate.runtimeEpoch,
        agentId: candidate.agentId,
        processGeneration: candidate.processGeneration,
        turnExecutionId: candidate.handle,
        reconciliationHandle: candidate.handle,
      }
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action: 'reap_claim', result: 'succeeded', observedAtWallMs: claimedAt, reasonCode: 'hard_deadline_reached',
      }].slice(-32)
      candidate.nextSafeAction = 'await_late_evidence'
    })
    return { won: true, claim: { ...record.reapClaim } }
  },

  cancelRecoveryClaim(handle, reasonCode = 'late_evidence_won') {
    const record = this.requireRecord(handle)
    if (record.reapClaim === null || record.reapClaim === undefined
        || record.reapClaim.phase === 'canceled_by_settlement') return false
    if (record.reapClaim.phase !== 'claimed') return false
    this.mutateRecord(record, (candidate) => {
      candidate.reapClaim = { ...candidate.reapClaim, phase: 'canceled_by_settlement' }
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action: 'ownership_check', result: 'blocked', observedAtWallMs: Date.now(), reasonCode,
      }].slice(-32)
      candidate.recoveryState = candidate.state === 'settled' ? 'settled' : 'pending_unknown'
    })
    return true
  },

  commitRecoveryShutdown(handle) {
    const record = this.requireRecord(handle)
    if (record.state === 'settled' || record.reapClaim?.phase !== 'claimed') return false
    this.mutateRecord(record, (candidate) => {
      candidate.reapClaim = { ...candidate.reapClaim, phase: 'shutdown_committed' }
      candidate.recoveryState = 'shutdown_requested'
      candidate.shutdownRequestedAt = Date.now()
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action: 'graceful_shutdown', result: 'started', observedAtWallMs: candidate.shutdownRequestedAt, reasonCode: 'exact_generation_reap',
      }].slice(-32)
      candidate.nextSafeAction = 'await_real_exit'
    })
    return true
  },

  abortRecoveryShutdown(handle, reasonCode) {
    const record = this.requireRecord(handle)
    if (record.state === 'settled' || record.reapClaim?.phase !== 'shutdown_committed') return false
    this.mutateRecord(record, (candidate) => {
      candidate.reapClaim = { ...candidate.reapClaim, phase: 'blocked' }
      candidate.recoveryState = 'blocked'
      candidate.shutdownRequestedAt = null
      candidate.failureReason = reasonCode
      candidate.missingEvidence = ['live_generation_ownership']
      candidate.nextSafeAction = 'reestablish_exact_ownership'
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action: 'ownership_check', result: 'blocked', observedAtWallMs: Date.now(), reasonCode,
      }].slice(-32)
    })
    return true
  },

  markRecoveryBlocked(handle, missingEvidence, reasonCode) {
    const record = this.requireRecord(handle)
    if (record.state === 'settled') return false
    this.mutateRecord(record, (candidate) => {
      candidate.recoveryState = 'blocked'
      candidate.missingEvidence = [...new Set(missingEvidence)]
      candidate.failureReason = reasonCode
      candidate.nextSafeAction = candidate.reapClaim?.phase === 'shutdown_committed'
        ? 'await_real_exit'
        : missingEvidence.includes('live_generation_ownership')
          ? 'reestablish_exact_ownership' : 'await_late_evidence'
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action: 'ownership_check', result: 'blocked', observedAtWallMs: Date.now(), reasonCode,
      }].slice(-32)
      if (candidate.reapClaim?.phase === 'claimed') {
        candidate.reapClaim = { ...candidate.reapClaim, phase: 'blocked' }
      }
    })
    return true
  },

  markExitObserved(handle) {
    const record = this.requireRecord(handle)
    if (record.state === 'settled' || record.exitObservedAt !== null) return false
    this.mutateRecord(record, (candidate) => {
      candidate.exitObservedAt = Date.now()
      candidate.recoveryState = 'exit_observed'
      candidate.missingEvidence = candidate.missingEvidence.filter(value => value !== 'child_real_exit')
      if (candidate.reapClaim !== null && candidate.reapClaim !== undefined) {
        candidate.reapClaim = { ...candidate.reapClaim, phase: 'exit_observed' }
      }
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action: 'exit_wait', result: 'succeeded', observedAtWallMs: candidate.exitObservedAt, reasonCode: 'child_real_exit',
      }].slice(-32)
    })
    return true
  },

  markFenceCleared(handle) {
    const record = this.requireRecord(handle)
    if (record.fenceState === 'cleared') return false
    this.mutateRecord(record, (candidate) => {
      candidate.fenceState = 'cleared'
      if (candidate.state === 'settled') candidate.nextSafeAction = 'send_new_request_after_reopened'
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action: 'fence_cleanup', result: 'succeeded', observedAtWallMs: Date.now(), reasonCode: 'exact_fence_cleared',
      }].slice(-32)
    })
    return true
  },

  markRegistryCleanupBlocked(handle, reasonCode = 'exact_reap_empty_cas_failed') {
    const record = this.requireRecord(handle)
    this.mutateRecord(record, (candidate) => {
      candidate.recoveryState = 'blocked'
      candidate.failureReason = reasonCode
      candidate.nextSafeAction = 'operator_exact_generation_recovery'
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action: 'registry_cleanup', result: 'blocked', observedAtWallMs: Date.now(), reasonCode,
      }].slice(-32)
    })
    return true
  },

  /** Initial outcome for every unresolved-unknown source (C-017). Idempotent. */
  markOutcomeUnknown(handle, { source, deadlineAtWallMs }) {
    const record = this.requireRecord(handle)
    if (record.state === 'settled') {
      this.appendAudit(record, { kind: 'conflict_ignored', evidenceType: `initial_unknown_after_${record.lateOutcome}` })
      return
    }
    if (record.initialOutcome === 'outcome_unknown') return
    this.mutateRecord(record, (candidate) => {
      candidate.initialOutcome = 'outcome_unknown'
      candidate.initialSource = source ?? null
      candidate.deadlineAtWallMs = deadlineAtWallMs ?? candidate.deadlineAtWallMs
      candidate.hardDeadlineAt = candidate.deadlineAtWallMs
      candidate.recoveryState = 'pending_unknown'
      candidate.missingEvidence = ['exact_terminal', 'exact_turn_idle', 'child_real_exit']
      candidate.reapClaim = null
      candidate.attemptedActions = [{
        action: 'coordinator_scheduled', result: 'started', observedAtWallMs: Date.now(), reasonCode: 'outcome_unknown',
      }]
      candidate.shutdownRequestedAt = null
      candidate.exitObservedAt = null
      candidate.settlementResult = null
      candidate.failureReason = null
      candidate.nextSafeAction = 'await_late_evidence'
      candidate.fenceState = 'active'
      candidate.reservedMandatoryBytes = Math.min(candidate.reservedMandatoryBytes ?? 0, 2048)
    })
  },

  /**
   * Direct in-deadline terminal settlement (C-010 closed envelope):
   * `completed` / `failed` with exact outcome+termination evidence, or
   * `not_admitted` with proven pre-send rejection. Also settle-once; a
   * record that already entered `outcome_unknown` must use settleLate.
   * @returns {{won:boolean, outcome?:string}}
   */
  settleDirect(handle, { outcome, outcomeEvidence = null, terminationEvidence = null, errorClass = null }) {
    if (!DIRECT_OUTCOMES.includes(outcome)) {
      throw new TypeError(`settleDirect: illegal outcome ${JSON.stringify(outcome)}`)
    }
    const record = this.requireRecord(handle)
    if (record.state === 'settled') {
      const duplicate = (record.outcome ?? record.lateOutcome) === outcome
      this.appendAudit(record, {
        kind: duplicate ? 'duplicate_ignored' : 'conflict_ignored',
        evidenceType: outcome,
      })
      return { won: false, outcome: record.outcome ?? record.lateOutcome }
    }
    if (record.initialOutcome === 'outcome_unknown') {
      throw new Error(`settleDirect: handle ${handle} already entered outcome_unknown — use settleLate (late machine)`)
    }
    this.mutateRecord(record, (candidate) => {
      candidate.state = 'settled'
      candidate.reservedMandatoryBytes = 64
      candidate.outcome = outcome
      candidate.outcomeEvidence = outcomeEvidence
      candidate.terminationEvidence = terminationEvidence
      candidate.errorClass = errorClass
      candidate.settledAtWallMs = Date.now()
      candidate.recoveryState = 'settled'
      candidate.settlementResult = outcome
      candidate.nextSafeAction = 'none'
    }, { resolveGeneration: true })
    for (const listener of this.listeners) {
      try { listener({ handle, ...this.settledSnapshot(record) }) } catch { /* listener isolation */ }
    }
    return { won: true, outcome }
  },

  /**
   * The single settle-once late-state-machine transition (C-017).
   * `lateOutcome` ∈ late_completed | late_failed | terminated_without_outcome.
   * The CALLER owns evidence precedence (parsed exact outcome must beat
   * child_real_exit); this store only guarantees: first settlement wins,
   * later evidence never rewrites state or output, duplicates/conflicts
   * append bounded audit entries.
   * @returns {{won:boolean, lateOutcome?:string}}
   */
  settleLate(handle, {
    lateOutcome, outcomeEvidence = null, terminationEvidence = null,
    finalAssistantOutput = undefined, exitObserved = false,
  }) {
    if (!LATE_OUTCOMES.includes(lateOutcome)) {
      throw new TypeError(`settleLate: illegal lateOutcome ${JSON.stringify(lateOutcome)}`)
    }
    if (terminationEvidence !== null && !TERMINATION_EVIDENCE_TYPES.includes(terminationEvidence)) {
      throw new TypeError(`settleLate: illegal terminationEvidence ${JSON.stringify(terminationEvidence)}`)
    }
    const record = this.requireRecord(handle)
    if (record.state === 'settled') {
      const duplicate = record.lateOutcome === lateOutcome
        && (record.terminationEvidence ?? null) === (terminationEvidence ?? null)
      this.appendAudit(record, {
        kind: duplicate ? 'duplicate_ignored' : 'conflict_ignored',
        evidenceType: terminationEvidence ?? lateOutcome,
      })
      return { won: false, lateOutcome: record.lateOutcome }
    }
    if (record.initialOutcome !== 'outcome_unknown') {
      // Direct terminal without an intermediate unknown is only legal for
      // ordinary in-deadline completion/failure — those do not pass through
      // the late machine. Late settlement requires the unknown source first.
      throw new Error(`settleLate: handle ${handle} has no outcome_unknown source (initialOutcome=${JSON.stringify(record.initialOutcome)})`)
    }
    this.mutateRecord(record, (candidate) => {
      if (exitObserved) {
        candidate.exitObservedAt = Date.now()
        candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
          action: 'exit_wait', result: 'succeeded', observedAtWallMs: candidate.exitObservedAt,
          reasonCode: 'child_real_exit',
        }].slice(-32)
        if (candidate.reapClaim !== null && candidate.reapClaim !== undefined) {
          candidate.reapClaim = { ...candidate.reapClaim, phase: 'exit_observed' }
        }
      }
      candidate.state = 'settled'
      candidate.reservedMandatoryBytes = 64
      candidate.lateOutcome = lateOutcome
      candidate.outcomeEvidence = outcomeEvidence
      candidate.terminationEvidence = terminationEvidence
      candidate.settledAtWallMs = Date.now()
      candidate.recoveryState = 'settled'
      candidate.settlementResult = lateOutcome
      candidate.missingEvidence = []
      candidate.nextSafeAction = 'send_new_request_after_reopened'
      candidate.attemptedActions = [...(candidate.attemptedActions ?? []), {
        action: 'settlement', result: 'succeeded', observedAtWallMs: Date.now(), reasonCode: lateOutcome,
      }].slice(-32)
      if (candidate.reapClaim?.phase === 'exit_observed' || candidate.reapClaim?.phase === 'shutdown_committed') {
        candidate.reapClaim = { ...candidate.reapClaim, phase: 'settled' }
      }
      if (finalAssistantOutput !== undefined) {
        candidate.finalAssistantOutput = {
          text: String(finalAssistantOutput.text ?? ''),
          truncated: finalAssistantOutput.truncated === true,
          originalBytes: finalAssistantOutput.originalBytes ?? Buffer.byteLength(String(finalAssistantOutput.text ?? ''), 'utf8'),
        }
      }
    }, { resolveGeneration: true })
    for (const listener of this.listeners) {
      try { listener({ handle, ...this.settledSnapshot(record) }) } catch { /* listener isolation */ }
    }
    return { won: true, lateOutcome }
  },

}
