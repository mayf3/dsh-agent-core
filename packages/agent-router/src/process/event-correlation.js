/**
 * @agent-core/agent-router/src/process/event-correlation.js — exact event
 * attribution, terminal settlement and the outcome_unknown fence of the
 * per-agent DSH process client (AGENT_PROCESS_LIFECYCLE_HARDENING_V3
 * C-011..C-017 and C-023 precedence/recovery evidence).
 *
 * `eventCorrelationMethods` compose onto AgentProcess.prototype
 * (agent-process.js). The matcher attributes events incrementally at arrival
 * (watermark + exact sessionId + receipt messageId + exact turn number),
 * captures the final assistant output as a UTF-8-safe incremental tail and
 * drives the settle-once outcome machine; parsed exact outcomes always take
 * precedence over child_real_exit (C-017).
 */

import { randomUUID } from 'node:crypto'

import { sanitizeProviderError } from './provider-errors.js'
import { monotonicNowMs } from './state-machine.js'

/**
 * Bounded, secret-free classifications of one unresolved-unknown execution
 * (diagnostic only — never a settlement input). Distinguishes exactly why a
 * fenced execution is still pending instead of leaving one unified pending.
 */
export const UNKNOWN_FENCE_DIAGNOSTICS = Object.freeze([
  'RECEIPT_CORRELATION_MISSING',
  'TERMINAL_OBSERVED_IDLE_MISSING',
  'TERMINAL_OBSERVED_CURRENT_IDLE',
  'LATER_TURN_STARTED',
  'CHILD_EXITED',
  'EVENT_STREAM_LOST',
])

/** Pure classifier over boolean facts (unit-testable; no process state). */
export function classifyUnknownFence({
  exitSeen, streamLost, receiptCorrelated, terminalObserved, laterTurnStarted,
  currentIdle, idleAfterTurnStart,
}) {
  if (exitSeen) return 'CHILD_EXITED'
  if (streamLost) return 'EVENT_STREAM_LOST'
  if (!receiptCorrelated) return 'RECEIPT_CORRELATION_MISSING'
  if (terminalObserved && laterTurnStarted) return 'LATER_TURN_STARTED'
  if (terminalObserved && currentIdle && idleAfterTurnStart) return 'TERMINAL_OBSERVED_CURRENT_IDLE'
  return 'TERMINAL_OBSERVED_IDLE_MISSING'
}

export const eventCorrelationMethods = {
  /** Replay the bounded ring from the watermark through the matcher (C-011). */
  replayExecutionFromWatermark(execution) {
    if (execution.receiptMessageId === null || execution.settled) return
    execution.replaying = true
    try {
      for (let seq = execution.watermarkSeq + 1; seq <= this.eventSeq; seq += 1) {
        if (seq <= execution.lastFedSeq) continue
        const entry = this.eventLog.get(seq)
        if (entry === undefined) {
          execution.streamGapSeen = true
          continue // evicted ring head — exact-started-idle can no longer be trusted
        }
        if (entry.params?.sessionId !== execution.sessionId) continue
        this.feedExecution(execution, entry.params.event, seq, entry.observationSeq)
      }
    } finally {
      execution.replaying = false
    }
    this.trySettleExecution(execution)
  },

  feedExecution(execution, event, seq, observationSeq = this.observationSeq) {
    if (execution.settled || seq <= execution.lastFedSeq) return
    const type = event?.type
    try {
      if (type === 'agent/inbox/spliced') {
        if (!execution.receiptSeen && execution.receiptMessageId !== null) {
          const inserted = event.data?.inserted
          if (Array.isArray(inserted) && inserted.some(message => message?.id === execution.receiptMessageId)) {
            execution.receiptSeen = true
            execution.promptReceipt = 'accepted'
          }
        }
        return
      }
      if (type === 'user/message' && execution.receiptMessageId !== null
          && (event.data?.id === execution.receiptMessageId || event.data?.message?.id === execution.receiptMessageId)) {
        execution.receiptMessageSeen = true
        execution.promptReceipt = 'accepted'
        return
      }
      if (type === 'turn/start') {
        if (execution.terminalEvent !== null || execution.currentTurnNumber !== undefined) {
          // B08 / C-015: a later turn/start invalidates terminal->idle proof;
          // it is never itself a substitute for a subsequently observed idle.
          execution.laterTurnStartSeen = true
        } else {
          execution.currentTurnNumber = event.data?.turn
          execution.turnStartObservationSeq = observationSeq
        }
        return
      }
      if (type === 'assistant/message') {
        // Output attribution is scoped to the matched turn window: a prior
        // turn's late assistant event (before our turn/start or after our
        // terminal) must not leak into this execution's output (C-011).
        if (execution.currentTurnNumber === undefined || execution.terminalEvent !== null) return
        const text = (event.data?.message?.content ?? [])
          .filter(block => block?.type === 'text').map(block => block.text).join('')
        execution.appendAssistantText(text)
        this.store.updateFinalOutput(execution.handle, execution.hasOutput() ? execution.outputSnapshot() : null)
        return
      }
      if (type === 'turn/end' && execution.currentTurnNumber !== undefined
          && event.data?.turn === execution.currentTurnNumber
          && execution.receiptMessageSeen) {
        execution.terminalEvent = event
        execution.terminalReason = event.data?.reason ?? { kind: 'unknown' }
        execution.terminalObservationSeq = observationSeq
        if (!execution.replaying) this.trySettleExecution(execution)
      }
    } finally {
      execution.lastFedSeq = seq
    }
  },

  /**
   * Exact terminal + idle => settle once. In-deadline callers get the
   * envelope; already-unknown executions go through the late machine and
   * release the fence (same handle only — C-016).
   */
  trySettleExecution(execution, allowTerminationOnly = false) {
    if (execution.settled) return
    if (execution.laterTurnStartSeen) return
    // C-015 exact_terminal_then_idle admits two idle legs:
    // (a) an idle observation ordered after the terminal observation, or
    // (b) the CURRENT session lifecycle state is idle AND that idle
    //     observation postdates this execution's matched turn/start. The DSH
    //     stream may flush the post-terminal session.status line before the
    //     correlated turn/end event; requiring (a) alone then self-locks the
    //     fence — the fenced process admits no new prompt, so no later
    //     status transition can ever be observed. A pre-turn stale idle
    //     never satisfies (b), preserving the B08 frozen semantics.
    const idleObservedAfterTerminal = execution.idleObservationSeq !== null
      && execution.terminalObservationSeq !== null
      && execution.idleObservationSeq > execution.terminalObservationSeq
    const currentIdlePastTurnStart = this.status[execution.sessionId] === 'idle'
      && execution.idleObservationSeq !== null
      && execution.turnStartObservationSeq !== null
      && execution.idleObservationSeq > execution.turnStartObservationSeq
    if (execution.terminalEvent === null) {
      // V3 C-015/C-023: receipt + exact matched start + post-start idle is
      // termination-only proof when the stream stayed continuous and the
      // one-active-turn invariant still holds. It settles only an execution
      // that already became outcome_unknown; it never fabricates a business
      // result and never kills the resident child.
      if (!execution.unknownMarked || !execution.receiptCorrelated()
          || execution.currentTurnNumber === undefined
          || execution.streamGapSeen || !currentIdlePastTurnStart
          || this.executions.size !== 1 || this.executions.get(execution.handle) !== execution) return
      // Give the current parser batch one event-loop turn to deliver an exact
      // turn/end. Exact outcome always wins over termination-only evidence.
      if (!allowTerminationOnly) {
        if (execution.terminationOnlyCheck === undefined) {
          execution.terminationOnlyCheck = setImmediate(() => {
            execution.terminationOnlyCheck = undefined
            this.trySettleExecution(execution, true)
          })
          execution.terminationOnlyCheck.unref?.()
        }
        return
      }
      this.store.settleLate(execution.handle, {
        lateOutcome: 'terminated_without_outcome',
        terminationEvidence: 'exact_started_then_idle',
        finalAssistantOutput: execution.hasOutput() ? execution.outputSnapshot() : undefined,
      })
      execution.settled = true
      execution.terminationEvidence = 'exact_started_then_idle'
      execution.phase = 'terminal'
      this.finishExecution(execution)
      this.releaseFence(execution.handle)
      return
    }
    if (!idleObservedAfterTerminal && !currentIdlePastTurnStart) return
    const failed = execution.terminalReason?.kind === 'error'
    if (execution.unknownMarked) {
      this.store.settleLate(execution.handle, {
        lateOutcome: failed ? 'late_failed' : 'late_completed',
        outcomeEvidence: failed ? 'exact_turn_end_failure' : 'exact_turn_end_success',
        terminationEvidence: 'exact_terminal_then_idle',
        finalAssistantOutput: execution.hasOutput() ? execution.outputSnapshot() : undefined,
      })
      execution.settled = true
      execution.terminationEvidence = 'exact_terminal_then_idle'
      execution.phase = 'terminal'
      this.finishExecution(execution)
      this.releaseFence(execution.handle)
      return
    }
    if (failed) {
      const error = sanitizeProviderError(execution.terminalReason.error, {
        agentId: this.agentId,
        provider: this.provider,
        model: this.model,
      })
      error.status = 'failed'
      error.envelope = 'failed'
      error.reconciliationHandle = execution.handle
      error.evidence = execution.evidenceSnapshot()
      this.store.settleDirect(execution.handle, {
        outcome: 'failed',
        outcomeEvidence: 'exact_turn_end_failure',
        terminationEvidence: 'exact_terminal_then_idle',
        errorClass: error.code,
      })
      execution.settled = true
      execution.terminationEvidence = 'exact_terminal_then_idle'
      execution.phase = 'terminal'
      execution.terminalReject?.(error)
    } else {
      this.store.settleDirect(execution.handle, {
        outcome: 'completed',
        outcomeEvidence: 'exact_turn_end_success',
        terminationEvidence: 'exact_terminal_then_idle',
      })
      execution.settled = true
      execution.terminationEvidence = 'exact_terminal_then_idle'
      execution.phase = 'terminal'
      execution.terminalResolve?.({
        reply: execution.finalAssistantText(),
        messageId: execution.receiptMessageId,
        terminationEvidence: execution.terminationEvidence,
      })
    }
    execution.terminalReject = undefined
    execution.terminalResolve = undefined
    this.finishExecution(execution)
  },

  finishExecution(execution) {
    if (execution.deadlineTimer !== undefined) {
      clearTimeout(execution.deadlineTimer)
      execution.deadlineTimer = undefined
    }
    if (execution.recoveryTimer !== undefined) {
      clearTimeout(execution.recoveryTimer)
      execution.recoveryTimer = undefined
    }
    if (execution.terminationOnlyCheck !== undefined) {
      clearImmediate(execution.terminationOnlyCheck)
      execution.terminationOnlyCheck = undefined
    }
    execution.releaseQueueOwnership?.()
    this.executions.delete(execution.handle)
  },

  markExecutionUnknown(execution, source) {
    if (execution.settled || execution.unknownMarked) return
    const hardDeadlineAt = Date.now() + Math.max(0, execution.turnDeadlineMono - monotonicNowMs())
    this.store.markOutcomeUnknown(execution.handle, { source, deadlineAtWallMs: hardDeadlineAt })
    execution.unknownMarked = true
    execution.unknownSource = source
    execution.phase = 'outcome_unknown'
    this.installUnknownFence(execution)
    execution.releaseQueueOwnership?.()
    // Evidence may already have arrived before the caller/deadline callback.
    // Re-evaluate synchronously so recovery never waits for another prompt or
    // a future status transition that may never occur.
    this.trySettleExecution(execution)
    if (!execution.settled) this.scheduleUnknownRecovery(execution)
  },

  installUnknownFence(execution) {
    if (this.activeUnknownFences.has(execution.handle)) return
    const wasEmpty = this.activeUnknownFences.size === 0
    const fence = { handle: execution.handle, sessionId: execution.sessionId }
    this.activeUnknownFences.set(execution.handle, fence)
    if (wasEmpty) {
      this.activeUnknownFence = fence
      // C-013: reject every queued-not-sent prompt structurally; they never
      // auto-send after fence release (re-admission is an explicit caller act).
      this.rejectQueuedTurns('AGENT_PROCESS_TURN_FENCED', 'outcome_unknown fence', execution.handle)
    }
  },

  /** C-016: settlement removes only that handle; every other unknown remains fenced. */
  releaseFence(handle) {
    // Durable cleanup is the linearization point. If persistence fails, keep
    // the local fence installed so every direct and outer admission stays
    // fail closed.
    this.store.markFenceCleared?.(handle)
    this.activeUnknownFences.delete(handle)
    this.activeUnknownFence = this.activeUnknownFences.values().next().value ?? null
  },

  // WORKFLOW_STALE_REENTRY_V1 r2: the r1 `resolveStaleExecution` method was
  // REMOVED. It tore down a live execution slot and released a fence without
  // exact termination evidence (C-015/C-016) and re-opened C-013's forbidden
  // same-process admission. Fence release stays exactly where the accepted
  // authority puts it: the stream/exit late settlement paths above.

  /**
   * Bounded, secret-free diagnostic of one unresolved execution (booleans +
   * one classification enum only — never a settlement input). `execution`
   * may be undefined for a pending record without a live matcher (defensive:
   * the stream facts then dominate).
   */
  unknownFenceDiagnostic(execution, sessionIdFallback) {
    const facts = {
      exitSeen: this.exit !== undefined,
      streamLost: this.inputFrozen || this.state === 'DRAINING' || this.state === 'EXITED'
        || execution === undefined || execution === null,
      receiptCorrelated: execution?.receiptMessageSeen === true,
      terminalObserved: execution?.terminalEvent != null,
      laterTurnStarted: execution?.laterTurnStartSeen === true,
      currentIdle: this.status[execution?.sessionId ?? sessionIdFallback] === 'idle',
      idleAfterTurnStart: execution !== undefined && execution !== null
        && execution.idleObservationSeq !== null
        && execution.turnStartObservationSeq !== null
        && execution.idleObservationSeq > execution.turnStartObservationSeq,
    }
    return { classification: classifyUnknownFence(facts), ...facts }
  },

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
    if (!this.store.commitRecoveryShutdown(handle)) {
      this.store.cancelRecoveryClaim(handle, 'settlement_won_before_shutdown_commit')
      return { status: 'canceled_by_settlement' }
    }
    const reap = this.registryIntegration?.casReap?.(this, `outcome_unknown:${handle}`)
    if (reap === null) {
      this.store.abortRecoveryShutdown(handle, 'registry_generation_mismatch')
      return { status: 'blocked', reason: 'registry_generation_mismatch' }
    }
    this.recoveryReapCommittedHandle = handle
    await this.shutdown(this.deadlines.shutdownGraceMs)
    return { status: 'settled_after_exit' }
  },
}
