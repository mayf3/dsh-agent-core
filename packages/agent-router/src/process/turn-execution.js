/**
 * @agent-core/agent-router/src/process/turn-execution.js — one tracked
 * prompt execution (C-010..C-016) and the bounded turn admission queue
 * (C-013) of the per-agent DSH process client.
 *
 * TurnExecution is the matcher-side execution record: it incrementally
 * attributes events (by watermark + exact sessionId + receipt messageId +
 * exact turn number), captures the final assistant output as a UTF-8-safe
 * incremental tail and drives the settle-once outcome machine.
 *
 * `turnExecutionMethods` compose onto AgentProcess.prototype
 * (agent-process.js): turn()/deliver() admission, the bounded queue and the
 * prompt write / terminal wait / caller-error settlement paths.
 */

import { envelopeCarrier, fencedRejection, monotonicNowMs } from './state-machine.js'
import { redactSensitiveText } from './provider-errors.js'
import { PROCESS_EVIDENCE_CAPS } from './evidence-buffer.js'

export class TurnExecution {
  constructor({ handle, sessionId, mode, watermarkSeq, startMono, deadlines, bindingContext }) {
    this.handle = handle
    this.sessionId = sessionId
    this.mode = mode // 'turn' | 'deliver'
    this.watermarkSeq = watermarkSeq
    this.lastFedSeq = watermarkSeq
    this.startMono = startMono
    this.deadlines = deadlines
    this.bindingContext = bindingContext
    this.phase = 'queued'
    // Deadlines: prompt receipt + turn terminal, both anchored immediately
    // before the prompt write (C-001 / §5.1 table).
    this.promptReceiptDeadlineMono = startMono + deadlines.promptReceiptTimeoutMs
    this.turnDeadlineMono = startMono + deadlines.turnTimeoutMs
    this.promptRequestId = null
    this.receiptMessageId = null
    this.promptReceipt = 'unknown' // unknown | accepted | proven_not_accepted
    this.receiptSeen = false
    this.receiptMessageSeen = false
    this.currentTurnNumber = undefined
    this.terminalEvent = null
    this.terminalReason = null
    this.terminalObservationSeq = null
    this.idleObservationSeq = null
    this.turnStartObservationSeq = null
    this.laterTurnStartSeen = false
    this.assistantSegments = []
    this.assistantOriginalBytes = 0
    this.assistantTruncated = false
    this.unknownMarked = false
    this.unknownSource = null
    this.settled = false
    this.terminationEvidence = null
    this.deadlineTimer = undefined
    // The terminal deferred exists from construction: settlement may happen
    // synchronously DURING the prompt-receipt continuation (watermark
    // replay), before the turn caller arms its wait — a late-created
    // promise would silently drop that settlement.
    this.terminalPromise = new Promise((resolveTerminal, rejectTerminal) => {
      this.terminalResolve = resolveTerminal
      this.terminalReject = rejectTerminal
    })
    // Receipt-only (deliver) executions have no terminal waiter; a provider
    // failure settlement must never surface as an unhandled rejection.
    this.terminalPromise.catch(() => {})
    this.queueReleasePromise = new Promise((resolveQueueRelease) => {
      this.resolveQueueRelease = resolveQueueRelease
    })
    this.queueReleased = false
  }

  releaseQueueOwnership() {
    if (this.queueReleased) return
    this.queueReleased = true
    this.resolveQueueRelease()
  }

  /** The exact receipt correlation is proven once the bound messageId was
   *  observed as the session's user message inside the matched turn. */
  receiptCorrelated() {
    return this.receiptMessageSeen
  }

  /** BOUNDED rule 10: incremental UTF-8-safe tail capture — never buffers the full output. */
  appendAssistantText(text) {
    if (typeof text !== 'string' || text === '') return
    const bytes = Buffer.byteLength(text, 'utf8')
    this.assistantOriginalBytes += bytes
    this.assistantSegments.push({ text, bytes })
    let kept = this.assistantSegments.reduce((sum, segment) => sum + segment.bytes, 0)
    while (kept > PROCESS_EVIDENCE_CAPS.MAX_FINAL_ASSISTANT_OUTPUT_BYTES && this.assistantSegments.length > 1) {
      const dropped = this.assistantSegments.shift()
      kept -= dropped.bytes
      this.assistantTruncated = true
    }
    if (kept > PROCESS_EVIDENCE_CAPS.MAX_FINAL_ASSISTANT_OUTPUT_BYTES && this.assistantSegments.length === 1) {
      const buffer = Buffer.from(this.assistantSegments[0].text, 'utf8')
      let start = buffer.length - PROCESS_EVIDENCE_CAPS.MAX_FINAL_ASSISTANT_OUTPUT_BYTES
      while (start < buffer.length && (buffer[start] & 0xc0) === 0x80) start += 1 // never split or exceed the byte cap
      this.assistantSegments[0] = { text: buffer.subarray(start).toString('utf8'), bytes: buffer.length - start }
      this.assistantTruncated = true
    }
  }

  finalAssistantText() {
    return this.assistantSegments.map(segment => segment.text).join('')
  }

  outputSnapshot() {
    return {
      text: this.finalAssistantText(),
      truncated: this.assistantTruncated,
      originalBytes: this.assistantOriginalBytes,
    }
  }

  hasOutput() {
    return this.assistantOriginalBytes > 0 || this.assistantSegments.length > 0
  }

  evidenceSnapshot() {
    return {
      eventWatermarkSeq: this.watermarkSeq,
      promptRequestId: this.promptRequestId,
      messageId: this.receiptMessageId,
      promptReceipt: this.promptReceipt,
      terminationEvidence: this.terminationEvidence,
      phase: this.phase,
    }
  }
}

export const turnExecutionMethods = {
  enqueuePromptExecution(mode, sessionId, text, opts, callerBoundMs) {
    return new Promise((resolve, reject) => {
      const promptBytes = Buffer.byteLength(String(text ?? ''), 'utf8')
      const preError = this.preAdmissionError(mode, sessionId, text, promptBytes)
      if (preError !== null) {
        reject(preError)
        return
      }
      // B05 / C-013: every prompt-producing path shares this one bounded
      // admission queue. Receipt-only delivery may resolve its caller early,
      // but it retains queue ownership until terminal or outcome_unknown.
      if (this.turnQueueEntries.length >= PROCESS_EVIDENCE_CAPS.MAX_QUEUED_TURNS_PER_PROCESS
          || this.queuedPromptBytes + promptBytes > PROCESS_EVIDENCE_CAPS.MAX_QUEUED_PROMPT_BYTES_PER_PROCESS) {
        reject(envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_QUEUE_CAP',
          `agent ${this.agentId}: queued prompt caps exceeded (${this.turnQueueEntries.length} entries / ${this.queuedPromptBytes}B)`))
        return
      }
      this.turnQueueEntries.push({ mode, sessionId, text, opts, callerBoundMs, promptBytes, resolve, reject })
      this.queuedPromptBytes += promptBytes
      this.drainTurnQueue()
    })
  },

  /** Pre-reservation admission gate (envelope not_admitted with handle=null). */
  preAdmissionError(mode, sessionId, text, promptBytes) {
    if (typeof sessionId !== 'string' || sessionId === '') {
      return envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_INVALID_INPUT', 'sessionId must be a non-empty string')
    }
    if (typeof text !== 'string') {
      return envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_INVALID_INPUT', 'prompt text must be a string')
    }
    if (promptBytes > PROCESS_EVIDENCE_CAPS.MAX_PROMPT_BYTES) {
      return envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_PROMPT_TOO_LARGE',
        `prompt of ${promptBytes} bytes exceeds MAX_PROMPT_BYTES ${PROCESS_EVIDENCE_CAPS.MAX_PROMPT_BYTES} — rejected before queueing (input is never cached)`)
    }
    if (this.activeUnknownFences.size > 0) {
      return fencedRejection(this.activeUnknownFence?.handle ?? this.activeUnknownFences.keys().next().value)
    }
    if (this.state !== 'READY') {
      return envelopeCarrier('not_admitted', null, this.state === 'DRAINING' || this.state === 'EXITED' ? 'AGENT_PROCESS_DRAINING' : 'AGENT_PROCESS_NOT_READY',
        `agent ${this.agentId} is ${this.state} — prompt admission rejected`)
    }
    return null
  },

  drainTurnQueue() {
    if (this.turnInFlight || this.turnQueueEntries.length === 0) return
    if (this.activeUnknownFences.size > 0 || this.state !== 'READY') {
      this.rejectQueuedTurns('AGENT_PROCESS_TURN_FENCED', `admission blocked (state=${this.state})`, this.activeUnknownFence?.handle)
      return
    }
    const entry = this.turnQueueEntries.shift()
    this.queuedPromptBytes -= entry.promptBytes
    this.turnInFlight = true
    void this.runPromptExecution(entry).catch((cause) => {
      entry.reject(cause)
      this.auditBounded({ kind: 'prompt_execution_internal_failure', detail: String(cause?.message ?? cause) })
    }).finally(() => {
      this.turnInFlight = false
      this.drainTurnQueue()
    })
  },

  rejectQueuedTurns(code, detail, fenceHandle) {
    for (const entry of this.turnQueueEntries.splice(0)) {
      this.queuedPromptBytes -= entry.promptBytes
      entry.reject(envelopeCarrier('not_admitted', null, code,
        `agent ${this.agentId}: queued turn rejected (${detail})`, { fencedBy: fenceHandle ?? null }))
    }
  },

  async runPromptExecution(entry) {
    const { mode, sessionId, text, opts, callerBoundMs, resolve, reject } = entry
    // Re-gate at the unified session/prompt write boundary (C-013).
    const gate = this.preAdmissionError(mode, sessionId, text, entry.promptBytes)
    if (gate !== null) {
      reject(gate)
      return
    }
    let handle
    try {
      // C-010: handle minted by the Router reconciliation store BEFORE the
      // watermark and any prompt bytes; capacity fails loud pre-reservation.
      handle = this.store.mintTurnExecution({
        agentId: this.agentId,
        processGeneration: this.processGeneration,
        sessionId,
        callerCorrelation: opts?.callerCorrelation ?? null,
      })
    } catch (cause) {
      reject(envelopeCarrier('not_admitted', null, cause?.code ?? 'RECONCILIATION_CAPACITY_EXHAUSTED', cause?.message ?? String(cause)))
      return
    }
    const execution = new TurnExecution({
      handle,
      sessionId,
      mode,
      watermarkSeq: this.eventSeq,
      startMono: monotonicNowMs(),
      deadlines: this.deadlines,
      bindingContext: opts?.bindingContext,
    })
    execution.promptRequestId = `req-${this.processGeneration}-${this.seq + 1}`
    try {
      this.store.markAdmitted(handle, {
        eventWatermarkSeq: execution.watermarkSeq,
        promptRequestId: execution.promptRequestId,
        deadlineAtWallMs: Date.now() + this.deadlines.turnTimeoutMs,
      })
    } catch (cause) {
      try {
        this.store.settleDirect(handle, {
          outcome: 'not_admitted', outcomeEvidence: 'pre_write_capacity_rejection',
          errorClass: cause?.code ?? 'RECONCILIATION_CAPACITY_EXHAUSTED',
        })
      } catch { /* the original capacity failure remains authoritative */ }
      reject(envelopeCarrier('not_admitted', handle, cause?.code ?? 'RECONCILIATION_CAPACITY_EXHAUSTED',
        `agent ${this.agentId}: prompt admission capacity failed before write`, { evidence: { source: 'admission_capacity' } }))
      return
    }
    this.executions.set(handle, execution)
    if (mode === 'turn') this.activeBindingContext = opts?.bindingContext
    const startedWall = Date.now()
    execution.phase = 'prompt_sending'
    try {
      execution.phase = 'receipt_pending'
      const receipt = await this.promptWrite(execution, sessionId, text, opts)
      execution.promptMs = Date.now() - startedWall
      if (!execution.settled) execution.phase = 'running'
      if (mode === 'deliver') {
        // Receipt-only: the caller returns now; the execution keeps its
        // terminal/unknown fence tracking in the background (C-010).
        resolve({
          accepted: true,
          sessionId,
          messageId: execution.receiptMessageId,
          ms: Date.now() - startedWall,
          reconciliationHandle: handle,
          evidence: execution.evidenceSnapshot(),
        })
        if (!execution.settled) this.installBackgroundTurnWatch(execution)
        await execution.queueReleasePromise
        return
      }
      const terminal = await this.awaitTerminal(execution, callerBoundMs)
      resolve({
        status: 'completed',
        reconciliationHandle: handle,
        reply: terminal.reply ?? '',
        ms: Date.now() - startedWall,
        promptMs: execution.promptMs,
        messageId: execution.receiptMessageId,
        evidence: execution.evidenceSnapshot(),
      })
    } catch (error) {
      this.handleExecutionCallerError(execution, error, reject)
    } finally {
      if (mode === 'turn') this.activeBindingContext = undefined
    }
  },

  async promptWrite(execution, sessionId, text, opts) {
    const receiptDeadlineMono = Math.min(execution.promptReceiptDeadlineMono, execution.turnDeadlineMono)
    const requestId = execution.promptRequestId
    const receipt = await this.request('session/prompt', {
      sessionId,
      contentBlocks: [{ type: 'text', text }],
      ...(opts?.cwd === undefined ? {} : { cwd: opts.cwd }),
    }, undefined, {
      deadlineMono: receiptDeadlineMono,
      execution,
      onWriteAttempted: () => {
        execution.phase = 'prompt_sending'
        this.store.markPromptWriteAttempted(execution.handle)
      },
    })
    execution.receiptMessageId = receipt?.messageId ?? null
    execution.promptReceipt = receipt?.messageId !== undefined ? 'accepted' : 'unknown'
    this.store.markPromptReceipt(execution.handle, { messageId: execution.receiptMessageId })
    // C-011: exact receipt messageId is now bound — replay the bounded ring
    // from the watermark so events that arrived before this JSON-RPC
    // response are correctly attributed to this execution.
    this.replayExecutionFromWatermark(execution)
    return receipt
  },

  /** Wait for exact terminal + idle within min(turn deadline, caller bound). */
  awaitTerminal(execution, callerBoundMs) {
    const callerDeadlineMono = callerBoundMs !== undefined
      ? execution.startMono + callerBoundMs
      : Number.POSITIVE_INFINITY
    const waitDeadlineMono = Math.min(execution.turnDeadlineMono, callerDeadlineMono)
    const remaining = waitDeadlineMono - monotonicNowMs()
    execution.deadlineTimer = setTimeout(() => {
      if (execution.settled) return
      const source = callerDeadlineMono <= execution.turnDeadlineMono ? 'caller_wait_exceeded' : 'turn_deadline_exceeded'
      // C-014: timeout without termination proof -> outcome_unknown.
      this.markExecutionUnknown(execution, source)
      execution.terminalReject?.(envelopeCarrier('outcome_unknown', execution.handle, 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN',
        `turn for session ${execution.sessionId} (agent ${this.agentId}) passed its ${source === 'turn_deadline_exceeded' ? 'turn deadline' : 'caller wait bound'} without termination proof — outcome_unknown`,
        {
          source,
          deadlineAtWallMs: Date.now(),
          evidence: execution.evidenceSnapshot(),
        }))
      execution.terminalReject = undefined
    }, Math.max(0, remaining))
    execution.deadlineTimer.unref?.()
    return execution.terminalPromise
  },

  /** deliver(): background turn-deadline watch — unknown + fence, no caller. */
  installBackgroundTurnWatch(execution) {
    const remaining = execution.turnDeadlineMono - monotonicNowMs()
    execution.deadlineTimer = setTimeout(() => {
      if (execution.settled) return
      this.markExecutionUnknown(execution, 'turn_deadline_exceeded')
    }, Math.max(0, remaining))
    execution.deadlineTimer.unref?.()
  },

  handleExecutionCallerError(execution, error, reject) {
    if (error?.envelope === 'outcome_unknown') {
      if (!execution.unknownMarked) this.markExecutionUnknown(execution, error.source ?? 'unknown_source')
      // Turn-path prompt-receipt timeout is fatal per §10.3
      // PROMPT_RECEIPT_NEVER_REPLIES; deliver-path keeps reconciling.
      if (execution.mode === 'turn' && error.source === 'prompt_receipt_timeout') {
        void this.fatal('prompt_receipt_timeout')
      }
      reject(error)
      return
    }
    if (error?.envelope === 'not_admitted' && error.proven === 'zero_byte') {
      // Proven zero-byte: definitive not_admitted — no unknown fence. The
      // settlement usually already happened synchronously at the write
      // boundary (request sync-throw path); this is the idempotent backstop.
      if (!execution.settled) {
        try {
          this.store.settleDirect(execution.handle, {
            outcome: 'not_admitted',
            outcomeEvidence: 'proven_zero_byte_rejection',
            errorClass: error.code,
          })
        } catch (cause) {
          this.auditBounded({ kind: 'settlement_conflict', detail: redactSensitiveText(String(cause?.message ?? cause)) })
        }
        this.finishExecution(execution)
      }
      reject(error)
      return
    }
    // Stream/process-level rejection with the outcome unproven (C-004 /
    // C-017): stdin failure, child error/exit, input freeze — admission or
    // termination cannot be proven, so the execution enters outcome_unknown;
    // the fatal/exit machinery owns its late settlement.
    const admissionUnproven = error?.code === 'AGENT_PROCESS_UNAVAILABLE'
      || error?.code === 'AGENT_PROCESS_EXITED'
      || error?.source === 'stdin_write_failed'
    if (admissionUnproven && !execution.settled) {
      if (!execution.unknownMarked) this.markExecutionUnknown(execution, error?.source ?? 'process_unavailable')
      if (error instanceof Error && error.status === undefined) {
        error.status = 'outcome_unknown'
        error.envelope = 'outcome_unknown'
        error.reconciliationHandle = execution.handle
        error.evidence = execution.evidenceSnapshot()
      }
      reject(error)
      return
    }
    if (!execution.settled) {
      // Structured RPC error response (e.g. SESSION_WORKSPACE_MISMATCH) or
      // another definitive rejection with admission proven by the response.
      try {
        this.store.settleDirect(execution.handle, {
          outcome: 'failed',
          outcomeEvidence: 'rpc_error_response',
          terminationEvidence: null,
          errorClass: error?.code ?? null,
        })
      } catch (cause) {
        this.auditBounded({ kind: 'settlement_conflict', detail: redactSensitiveText(String(cause?.message ?? cause)) })
      }
      this.finishExecution(execution)
    }
    if (error instanceof Error && error.status === undefined) {
      error.status = 'failed'
      error.envelope = 'failed'
      error.reconciliationHandle = execution.handle
      error.evidence = execution.evidenceSnapshot()
    }
    reject(error)
  },
}
