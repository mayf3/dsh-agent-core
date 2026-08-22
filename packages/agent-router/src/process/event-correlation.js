/**
 * @agent-core/agent-router/src/process/event-correlation.js — exact event
 * attribution, terminal settlement and the outcome_unknown fence of the
 * per-agent DSH process client (AGENT_PROCESS_LIFECYCLE_HARDENING_V2
 * C-011..C-016, C-017 precedence).
 *
 * `eventCorrelationMethods` compose onto AgentProcess.prototype
 * (agent-process.js). The matcher attributes events incrementally at arrival
 * (watermark + exact sessionId + receipt messageId + exact turn number),
 * captures the final assistant output as a UTF-8-safe incremental tail and
 * drives the settle-once outcome machine; parsed exact outcomes always take
 * precedence over child_real_exit (C-017).
 */

import { sanitizeProviderError } from './provider-errors.js'

export const eventCorrelationMethods = {
  /** Replay the bounded ring from the watermark through the matcher (C-011). */
  replayExecutionFromWatermark(execution) {
    if (execution.receiptMessageId === null || execution.settled) return
    execution.replaying = true
    try {
      for (let seq = execution.watermarkSeq + 1; seq <= this.eventSeq; seq += 1) {
        if (seq <= execution.lastFedSeq) continue
        const entry = this.eventLog.get(seq)
        if (entry === undefined) continue // evicted ring head — bounded history
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
        if (execution.terminalEvent !== null) {
          // B08 / C-015: a later turn/start invalidates terminal->idle proof;
          // it is never itself a substitute for a subsequently observed idle.
          execution.laterTurnStartSeen = true
        } else {
          execution.currentTurnNumber = event.data?.turn
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
  trySettleExecution(execution) {
    if (execution.settled || execution.terminalEvent === null) return
    const idleAfterTerminal = execution.idleObservationSeq !== null
      && execution.terminalObservationSeq !== null
      && execution.idleObservationSeq > execution.terminalObservationSeq
      && !execution.laterTurnStartSeen
    if (!idleAfterTerminal) return
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
      this.releaseFence(execution.handle)
      this.finishExecution(execution)
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
    execution.releaseQueueOwnership?.()
    this.executions.delete(execution.handle)
  },

  markExecutionUnknown(execution, source) {
    if (execution.settled || execution.unknownMarked) return
    this.store.markOutcomeUnknown(execution.handle, { source, deadlineAtWallMs: Date.now() })
    execution.unknownMarked = true
    execution.unknownSource = source
    execution.phase = 'outcome_unknown'
    this.installUnknownFence(execution)
    execution.releaseQueueOwnership?.()
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
    this.activeUnknownFences.delete(handle)
    this.activeUnknownFence = this.activeUnknownFences.values().next().value ?? null
  },
}
