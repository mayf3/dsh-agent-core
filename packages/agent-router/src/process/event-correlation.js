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
    for (let seq = execution.watermarkSeq + 1; seq <= this.eventSeq; seq += 1) {
      if (seq <= execution.lastFedSeq) continue
      const entry = this.eventLog.get(seq)
      if (entry === undefined) continue // evicted ring head — bounded history
      if (entry.params?.sessionId !== execution.sessionId) continue
      this.feedExecution(execution, entry.params.event, seq)
    }
  },

  feedExecution(execution, event, seq) {
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
          // A later turn of the same session started after our terminal — the
          // session necessarily passed through idle in between.
          execution.laterTurnStartSeen = true
          this.trySettleExecution(execution)
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
        this.trySettleExecution(execution)
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
    const idle = this.status[execution.sessionId] === 'idle' || execution.laterTurnStartSeen
    if (!idle) return
    execution.settled = true
    execution.terminationEvidence = 'exact_terminal_then_idle'
    execution.phase = 'terminal'
    if (execution.deadlineTimer !== undefined) clearTimeout(execution.deadlineTimer)
    const failed = execution.terminalReason?.kind === 'error'
    if (execution.unknownMarked) {
      this.store.settleLate(execution.handle, {
        lateOutcome: failed ? 'late_failed' : 'late_completed',
        outcomeEvidence: failed ? 'exact_turn_end_failure' : 'exact_turn_end_success',
        terminationEvidence: 'exact_terminal_then_idle',
        finalAssistantOutput: execution.hasOutput() ? execution.outputSnapshot() : undefined,
      })
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
      execution.terminalReject?.(error)
    } else {
      this.store.settleDirect(execution.handle, {
        outcome: 'completed',
        outcomeEvidence: 'exact_turn_end_success',
        terminationEvidence: 'exact_terminal_then_idle',
      })
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
    this.executions.delete(execution.handle)
  },

  markExecutionUnknown(execution, source) {
    if (execution.settled || execution.unknownMarked) return
    execution.unknownMarked = true
    execution.unknownSource = source
    execution.phase = 'outcome_unknown'
    this.store.markOutcomeUnknown(execution.handle, { source, deadlineAtWallMs: Date.now() })
    this.installUnknownFence(execution)
  },

  installUnknownFence(execution) {
    if (this.activeUnknownFence === null) {
      this.activeUnknownFence = { handle: execution.handle, sessionId: execution.sessionId }
      // C-013: reject every queued-not-sent turn structurally; they never
      // auto-send after fence release (re-admission is an explicit caller act).
      this.rejectQueuedTurns('AGENT_PROCESS_TURN_FENCED', 'outcome_unknown fence', execution.handle)
    }
  },

  /** C-016: only termination evidence of the SAME active unknown handle releases. */
  releaseFence(handle) {
    if (this.activeUnknownFence?.handle === handle) this.activeUnknownFence = null
  },
}
