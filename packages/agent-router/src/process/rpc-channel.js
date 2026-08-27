/**
 * @agent-core/agent-router/src/process/rpc-channel.js — the newline-delimited
 * JSON-RPC stdio channel and the parent-RPC relay of the per-agent DSH
 * process client (AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-001..C-005,
 * C-009, C-012).
 *
 * `rpcChannelMethods` compose onto AgentProcess.prototype (agent-process.js).
 * Every request runs under ONE absolute total deadline (C-001); stdin
 * failures reject the pending entry (C-004) with zero-byte provenance
 * classification; the parent-RPC answer is bounded by the fixed
 * response-write reserve (C-005) with exactly one wire attempt.
 */

import { envelopeCarrier, monotonicNowMs } from './state-machine.js'
import { redactSensitiveText, sanitizeProviderError } from './provider-errors.js'
import { PROCESS_EVIDENCE_CAPS } from './evidence-buffer.js'

export const rpcChannelMethods = {
  onStdout(chunk) {
    if (this.state === 'EXITED' || this.inputFrozen) {
      this.auditBounded({ kind: 'parser_input_after_freeze', detail: 'stdout frame ignored after parser freeze' })
      return
    }
    this.buf += chunk
    if (Buffer.byteLength(this.buf, 'utf8') > PROCESS_EVIDENCE_CAPS.MAX_STDOUT_PARTIAL_BYTES
        || Buffer.byteLength(this.buf, 'utf8') > PROCESS_EVIDENCE_CAPS.MAX_RPC_FRAME_BYTES) {
      // BOUNDED rule 6: stdout partial/frame overflow is a fatal protocol
      // error -> C-009 DRAINING teardown.
      this.auditBounded({ kind: 'protocol_buffer_overflow', detail: `stdout partial buffer ${Buffer.byteLength(this.buf, 'utf8')} bytes` })
      this.buf = ''
      this.fatal('protocol_buffer_overflow')
      return
    }
    let index
    while ((index = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, index)
      this.buf = this.buf.slice(index + 1)
      if (line.trim() === '') continue
      if (Buffer.byteLength(line, 'utf8') > PROCESS_EVIDENCE_CAPS.MAX_RPC_FRAME_BYTES) {
        this.auditBounded({ kind: 'protocol_buffer_overflow', detail: `rpc frame ${Buffer.byteLength(line, 'utf8')} bytes` })
        this.fatal('protocol_buffer_overflow')
        return
      }
      let message
      try { message = JSON.parse(line) } catch { continue }
      if (message.id !== undefined) {
        this.onRpcResponse(message)
      } else if (message.method === 'session.event') {
        this.onSessionEvent(message.params)
      } else if (message.method === 'session.status') {
        this.onSessionStatus(message.params)
      } else if (message.method === 'rpc.request') {
        // A per-agent plugin asks the Control Plane to run a Router domain
        // operation; the answer goes back over stdin as rpc.response.
        void this.handleRpcRequest(message.params)
      }
    }
  },

  onRpcResponse(message) {
    const waiter = this.pending.get(message.id)
    if (waiter === undefined) {
      // Late response after settle: for an outcome_unknown prompt execution,
      // correlate the exact messageId via the bounded tombstone (C-012) so
      // reconciliation can continue — never re-settle the caller.
      const tombstone = this.latePromptTombstones.get(message.id)
      if (tombstone !== undefined) {
        this.latePromptTombstones.delete(message.id)
        const messageId = message.result?.messageId
        if (tombstone.execution !== undefined && messageId !== undefined) {
          tombstone.execution.receiptMessageId = messageId
          tombstone.execution.promptReceipt = 'accepted'
          tombstone.execution.phase = 'running'
          this.store.markPromptReceipt(tombstone.execution.handle, { messageId })
          this.replayExecutionFromWatermark(tombstone.execution)
          this.auditBounded({ kind: 'late_receipt_correlated', detail: `request ${message.id} -> ${messageId}` })
        }
      }
      return
    }
    // B09 / C-017: bind parser-received prompt evidence synchronously, before
    // resolving the waiter Promise. A child exit in the continuation gap must
    // replay this receipt and exact pre-receipt events before exit settlement.
    if (waiter.method === 'session/prompt' && waiter.execution !== null && message.error === undefined) {
      const messageId = message.result?.messageId
      if (messageId !== undefined) {
        waiter.execution.receiptMessageId = messageId
        waiter.execution.promptReceipt = 'accepted'
        this.store.markPromptReceipt(waiter.execution.handle, { messageId })
        this.replayExecutionFromWatermark(waiter.execution)
      }
    }
    this.settlePendingEntry(waiter, 'resolve-or-reject', message)
  },

  /**
   * Relay one parent-RPC request to the router-installed hook and answer the
   * child — bounded by ONE absolute deadline with the fixed response-write
   * reserve (C-005). One wire response attempt, no re-invocation.
   */
  async handleRpcRequest({ requestId, method, params, turnExecutionId } = {}) {
    if (typeof requestId !== 'string' || typeof method !== 'string') return
    const receivedAtMono = monotonicNowMs()
    // B03: an attributable execution contributes its original absolute
    // deadline even when already expired; expiry may never mint a fresh one.
    const activeExecution = [...this.executions.values()].find(execution => !execution.settled && execution.phase !== 'queued')
    const totalDeadlineMono = activeExecution?.turnDeadlineMono ?? (receivedAtMono + this.deadlines.turnTimeoutMs)
    const totalBudgetMs = Math.max(0, totalDeadlineMono - receivedAtMono)
    if (totalBudgetMs <= 0) {
      this.auditBounded({ kind: 'parent_rpc_budget_exhausted', detail: method })
      return
    }
    const responseWriteReserveMs = Math.min(250, Math.max(1, Math.floor(totalBudgetMs * 0.10)))
    const handlerDeadlineMono = totalDeadlineMono - responseWriteReserveMs
    const deadlineAtWallMs = Date.now() + totalBudgetMs
    let result
    let error
    let handlerStarted = false
    let timedOut = handlerDeadlineMono <= receivedAtMono
    if (!timedOut) {
      handlerStarted = true
      const controller = new AbortController()
      let abortTimer
      const timeout = new Promise((resolveTimeout) => {
        abortTimer = setTimeout(() => {
          controller.abort()
          resolveTimeout({ kind: 'timeout' })
        }, Math.max(0, handlerDeadlineMono - monotonicNowMs()))
        abortTimer.unref?.()
      })
      const handler = Promise.resolve().then(() => {
        if (typeof this.onRpcRequest !== 'function') {
          throw new Error(`process ${this.agentId}: no parent-RPC handler for ${method}`)
        }
        return this.onRpcRequest(method, params, {
          handlerDeadlineMono,
          totalDeadlineMono,
          deadlineAtWallMs,
          signal: controller.signal,
          turnExecutionId,
        })
      }).then(
        value => ({ kind: 'result', value }),
        cause => ({ kind: 'error', cause }),
      )
      const winner = await Promise.race([handler, timeout])
      clearTimeout(abortTimer)
      if (winner.kind === 'timeout') timedOut = true
      else if (winner.kind === 'error') error = winner.cause
      else result = winner.value
    }
    if (timedOut) {
      error = new Error(`parent-RPC ${method} exceeded its handler deadline (agent ${this.agentId})`)
      result = undefined
      this.auditBounded({ kind: 'parent_rpc_timeout', detail: `${method} sideEffectOutcome=${handlerStarted ? 'unknown' : 'proven_not_started'}` })
    }
    // Budget expiry after handler settlement forbids every wire attempt.
    if (monotonicNowMs() >= totalDeadlineMono) {
      this.auditBounded({ kind: 'parent_rpc_budget_exhausted', detail: `${method} before response write` })
      return
    }
    this.counters.rpcResponseWriteAttempts += 1
    let writeOutcome = 'unknown'
    try {
      await this.request('rpc.response', {
        requestId,
        ok: error === undefined,
        result,
        error: error === undefined ? undefined : (error instanceof Error ? error.message : String(error)),
      }, undefined, {
        deadlineMono: totalDeadlineMono,
        onWriteCompleted: (writeError) => { writeOutcome = writeError === null || writeError === undefined ? 'sent' : 'failed' },
      })
      if (writeOutcome === 'unknown') writeOutcome = 'sent'
    } catch { /* one best-effort response attempt only */ }
    this.auditBounded({ kind: 'parent_rpc_response', detail: `${method} responseWrite=${writeOutcome}` })
  },

  /**
   * JSON-RPC request to the demo-server child with one absolute total
   * deadline (C-001). The legacy third argument is honored as a per-call
   * budget (deadline = now + timeoutMs); internal callers pass
   * `opts.deadlineMono` directly (retries never reset it). stdin failures
   * reject the entry (C-004) with zero-byte provenance classification.
   * @param {string} method
   * @param {object|undefined} params
   * @param {number} [timeoutMs] legacy per-call budget
   * @param {object} [opts] { deadlineMono, execution, onWriteAttempted }
   */
  request(method, params, timeoutMs, opts = {}) {
    const deadlineMono = opts.deadlineMono
      ?? (timeoutMs !== undefined ? monotonicNowMs() + timeoutMs : undefined)
      ?? (monotonicNowMs() + this.deadlines.turnTimeoutMs) // generic lifecycle-budget derivation — never infinite
    if (method === 'session/prompt' && (opts.execution === null || opts.execution === undefined)) {
      return Promise.reject(envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_RAW_PROMPT_FORBIDDEN',
        `agent ${this.agentId}: raw session/prompt RPC must use the unified admission queue`))
    }
    if (this.inputFrozen) {
      return Promise.reject(envelopeCarrier('not_admitted', opts.execution?.handle ?? null, 'AGENT_PROCESS_INPUT_FROZEN',
        `agent ${this.agentId}: input frozen — request ${method} rejected before write`, { proven: 'zero_byte' }))
    }
    const stdin = this.child?.stdin
    const knownUnwritable = stdin === undefined || stdin === null || stdin.writable === false
      || stdin.destroyed === true || stdin.writableEnded === true || stdin.writableFinished === true || stdin.closed === true
    if (knownUnwritable) {
      const execution = opts.execution ?? null
      const carrier = envelopeCarrier(method === 'session/prompt' ? 'not_admitted' : 'failed', execution?.handle ?? null,
        'AGENT_PROCESS_STDIN_NOT_WRITABLE', `agent ${this.agentId}: stdin is known non-writable — request ${method} rejected before write`,
        { proven: 'zero_byte', source: 'stdin_not_writable' })
      if (method === 'session/prompt' && execution !== null && !execution.settled) {
        this.store.settleDirect(execution.handle, {
          outcome: 'not_admitted', outcomeEvidence: 'proven_zero_byte_rejection', errorClass: carrier.code,
        })
        execution.settled = true
        this.finishExecution(execution)
      }
      queueMicrotask(() => this.onStdinBroken(new Error('stdin known non-writable')))
      return Promise.reject(carrier)
    }
    if (deadlineMono <= monotonicNowMs()) {
      return Promise.reject(envelopeCarrier(method === 'session/prompt' ? 'not_admitted' : 'failed', opts.execution?.handle ?? null,
        'AGENT_PROCESS_RPC_DEADLINE', `request ${method} deadline expired before write (agent ${this.agentId})`, { proven: 'zero_byte', method }))
    }
    if (this.pending.size >= PROCESS_EVIDENCE_CAPS.MAX_PENDING_RPC) {
      return Promise.reject(envelopeCarrier('not_admitted', opts.execution?.handle ?? null, 'AGENT_PROCESS_PENDING_CAP',
        `agent ${this.agentId}: pending RPC cap ${PROCESS_EVIDENCE_CAPS.MAX_PENDING_RPC} reached — request ${method} rejected before write`))
    }
    return new Promise((resolveRequest, rejectRequest) => {
      const id = ++this.seq
      const entry = {
        id,
        method,
        deadlineMono,
        execution: opts.execution ?? null,
        resolve: resolveRequest,
        reject: rejectRequest,
        settled: false,
        timer: undefined,
        writeProven: false,
      }
      const remaining = Math.max(0, deadlineMono - monotonicNowMs())
      const budgetMsForMessage = Math.max(1, remaining)
      entry.timer = setTimeout(() => {
        const isPrompt = method === 'session/prompt'
        const handle = entry.execution?.handle ?? null
        if (isPrompt && entry.execution !== null && entry.execution !== undefined) {
          // C-012: receipt deadline with admission unproven -> outcome_unknown.
          this.recordLatePromptTombstone(entry)
          const carrier = envelopeCarrier('outcome_unknown', handle, 'AGENT_PROCESS_PROMPT_RECEIPT_TIMEOUT',
            `prompt receipt for session ${params?.sessionId} (agent ${this.agentId}) timed out — admission unproven, outcome_unknown`, { source: 'prompt_receipt_timeout', evidence: { method } })
          this.settlePendingEntry(entry, 'reject', carrier)
        } else {
          this.settlePendingEntry(entry, 'reject', Object.assign(
            new Error(`request ${method} timed out after ${budgetMsForMessage}ms (agent ${this.agentId})`),
            { code: 'AGENT_PROCESS_RPC_DEADLINE', method },
          ))
        }
      }, remaining)
      entry.timer.unref?.()
      this.pending.set(id, entry)
      if (method === 'session/prompt') this.counters.promptWriteAttempts += 1
      const payload = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`
      try {
        this.child.stdin.write(payload, (writeError) => {
          opts.onWriteCompleted?.(writeError ?? null)
          if (writeError !== undefined && writeError !== null && !entry.settled) {
            // Write callback error: bytes may or may not have reached the
            // child — admission unprovable (C-004).
            const handle = entry.execution?.handle ?? null
            const carrier = envelopeCarrier(entry.method === 'session/prompt' && entry.execution !== null ? 'outcome_unknown' : 'failed',
              handle, 'AGENT_PROCESS_PROMPT_WRITE_FAILED',
              `stdin write for ${entry.method} failed (agent ${this.agentId}): ${redactSensitiveText(String(writeError?.message ?? writeError))}`,
              { source: 'prompt_write_failed' })
            this.settlePendingEntry(entry, 'reject', carrier)
            this.onStdinBroken(writeError)
          }
        })
        opts.onWriteAttempted?.()
      } catch (syncError) {
        // Synchronous throw: PROVEN zero-byte rejection (C-004 not_admitted).
        const execution = entry.execution ?? null
        const handle = execution?.handle ?? null
        const carrier = envelopeCarrier(entry.method === 'session/prompt' ? 'not_admitted' : 'failed',
          handle, 'AGENT_PROCESS_PROMPT_WRITE_FAILED',
          `stdin write for ${entry.method} threw before any byte was sent (agent ${this.agentId}): ${redactSensitiveText(String(syncError?.message ?? syncError))}`,
          { proven: 'zero_byte', source: 'prompt_write_failed' })
        this.settlePendingEntry(entry, 'reject', carrier)
        // Settle the definitive not_admitted NOW, synchronously — the
        // deferred stream-level fatal below must never race a later
        // unknown classification onto the same execution.
        if (execution !== null && entry.method === 'session/prompt' && !execution.settled) {
          try {
            this.store.settleDirect(handle, {
              outcome: 'not_admitted',
              outcomeEvidence: 'proven_zero_byte_rejection',
              errorClass: carrier.code,
            })
          } catch { /* settlement conflict is audited below */ }
          this.finishExecution(execution)
        }
        queueMicrotask(() => this.onStdinBroken(syncError))
      }
    })
  },

  recordLatePromptTombstone(entry) {
    if (entry.execution === null || entry.execution === undefined) return
    this.latePromptTombstones.set(entry.id, { execution: entry.execution, atWallMs: Date.now() })
    if (this.latePromptTombstones.size > PROCESS_EVIDENCE_CAPS.MAX_LATE_PROMPT_TOMBSTONES) {
      const oldest = this.latePromptTombstones.keys().next().value
      this.latePromptTombstones.delete(oldest)
      this.lateTombstonesDropped += 1
    }
  },

  /** C-002: settle exactly once — delete the map entry + clear the timer. */
  settlePendingEntry(entry, mode, payload) {
    if (entry.settled) return false
    entry.settled = true
    if (entry.timer !== undefined) clearTimeout(entry.timer)
    this.pending.delete(entry.id)
    if (mode === 'reject') entry.reject(payload)
    else if (payload?.error !== undefined) {
      // STRUCTURED errors survive the wire: the demo-server rejects
      // cross-workspace session reuse with a string error code
      // (SESSION_WORKSPACE_MISMATCH); copying it onto the Error lets the
      // Router surface it verbatim.
      entry.reject(sanitizeProviderError(payload.error, {
        agentId: this.agentId,
        provider: this.provider,
        model: this.model,
      }))
    } else entry.resolve(payload?.result)
    return true
  },

  /** C-003: child error/exit rejects every pending RPC and clears timers. */
  rejectAllPending(code, evidence) {
    for (const entry of [...this.pending.values()]) {
      const error = Object.assign(new Error(
        `agent ${this.agentId} (generation ${this.processGeneration}) RPC ${entry.method} rejected: ${code}`,
      ), {
        code,
        agentId: this.agentId,
        processGeneration: this.processGeneration,
        method: entry.method,
        evidence,
      })
      this.settlePendingEntry(entry, 'reject', error)
    }
    this.pending.clear()
  },

  onStdinBroken(error) {
    if (this.inputFrozen || this.state === 'EXITED') return
    this.auditBounded({ kind: 'stdin_failure', detail: redactSensitiveText(String(error?.message ?? error)) })
    this.rejectAllPending('AGENT_PROCESS_UNAVAILABLE', { cause: 'stdin_failure' })
    for (const execution of [...this.executions.values()]) {
      if (!execution.settled && !execution.unknownMarked) {
        // Async/pipe failure: admission unprovable -> outcome_unknown (C-004).
        this.markExecutionUnknown(execution, 'stdin_write_failed')
        if (typeof execution.terminalReject === 'function') {
          execution.terminalReject(envelopeCarrier('outcome_unknown', execution.handle, 'AGENT_PROCESS_UNAVAILABLE',
            `stdin pipe failure while turn was in flight (agent ${this.agentId}) — admission unproven`, { source: 'stdin_write_failed', evidence: execution.evidenceSnapshot() }))
          execution.terminalReject = undefined
        }
      }
    }
    this.fatal('stdin_failure')
  },
}
