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
  trySettleExecution(execution) {
    if (execution.settled || execution.terminalEvent === null) return
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
}
