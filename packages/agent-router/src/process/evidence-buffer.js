/**
 * @agent-core/agent-router/src/process/evidence-buffer.js — the bounded
 * process-evidence surfaces of AGENT_PROCESS_LIFECYCLE_HARDENING_V2
 * (CLAUSE-PROC-BOUNDED frozen ceilings + the event ring / stderr tail /
 * creation records / status map intake).
 *
 * `evidenceBufferMethods` compose onto AgentProcess.prototype
 * (agent-process.js). The bounded event ring is the replay source for exact
 * correlation (C-011): events that arrive BEFORE the receipt messageId is
 * bound are retained here and replayed on binding.
 */

import { redactSensitiveText } from './provider-errors.js'

/** CLAUSE-PROC-BOUNDED frozen safety ceilings (count + bytes, per surface). */
export const PROCESS_EVIDENCE_CAPS = Object.freeze({
  MAX_EVENT_RECORDS: 10000,
  MAX_EVENT_BUFFER_BYTES: 8388608,
  MAX_EVENT_RECORD_BYTES: 1048576,
  MAX_STDERR_BYTES: 1048576,
  MAX_CREATION_RECORDS: 256,
  MAX_CREATION_RECORD_BYTES: 4096,
  MAX_STDOUT_PARTIAL_BYTES: 1048576,
  MAX_RPC_FRAME_BYTES: 1048576,
  MAX_PENDING_RPC: 1024,
  MAX_FINAL_ASSISTANT_OUTPUT_BYTES: 1048576,
  MAX_QUEUED_TURNS_PER_PROCESS: 64,
  MAX_QUEUED_PROMPT_BYTES_PER_PROCESS: 4194304,
  MAX_PROMPT_BYTES: 1048576,
  /** Bounded late-receipt correlation tombstones (C-012). */
  MAX_LATE_PROMPT_TOMBSTONES: 256,
  MAX_PROCESS_AUDIT_ENTRIES: 64,
  MAX_PROCESS_AUDIT_BYTES: 65536,
})

export const evidenceBufferMethods = {
  auditBounded(entry) {
    const bounded = { kind: entry.kind, detail: String(entry.detail ?? ''), observedAtWallMs: Date.now() }
    let bytes = Buffer.byteLength(JSON.stringify(bounded), 'utf8')
    while (bytes > PROCESS_EVIDENCE_CAPS.MAX_PROCESS_AUDIT_BYTES && bounded.detail.length > 0) {
      bounded.detail = bounded.detail.slice(0, Math.floor(bounded.detail.length / 2))
      bytes = Buffer.byteLength(JSON.stringify(bounded), 'utf8')
    }
    this.boundedAudit.push(bounded)
    this.boundedAuditBytes += bytes
    while (this.boundedAudit.length > PROCESS_EVIDENCE_CAPS.MAX_PROCESS_AUDIT_ENTRIES
        || this.boundedAuditBytes > PROCESS_EVIDENCE_CAPS.MAX_PROCESS_AUDIT_BYTES) {
      const dropped = this.boundedAudit.shift()
      const droppedBytes = Buffer.byteLength(JSON.stringify(dropped), 'utf8')
      this.boundedAuditBytes -= droppedBytes
      this.boundedAuditDroppedCount += 1
      this.boundedAuditDroppedBytes += droppedBytes
    }
  },

  onStderr(chunk) {
    const safeChunk = redactSensitiveText(chunk)
    const appended = this.stderr + safeChunk
    if (Buffer.byteLength(appended, 'utf8') > PROCESS_EVIDENCE_CAPS.MAX_STDERR_BYTES) {
      // Keep the newest tail; account every dropped byte.
      const buffer = Buffer.from(appended, 'utf8')
      let start = buffer.length - PROCESS_EVIDENCE_CAPS.MAX_STDERR_BYTES
      while (start < buffer.length && (buffer[start] & 0xc0) === 0x80) start += 1
      const keep = buffer.subarray(start)
      this.stderrDroppedBytes += start
      this.stderr = keep.toString('utf8')
    } else {
      this.stderr = appended
    }
    for (const line of safeChunk.split('\n')) {
      const match = line.match(/\[demo-server\] session (\S+) (created|resumed) \((\d+) events\)/)
      if (match !== null) {
        const record = { sessionId: match[1], mode: match[2], events: Number(match[3]) }
        const recordBytes = Buffer.byteLength(JSON.stringify(record), 'utf8')
        if (recordBytes > PROCESS_EVIDENCE_CAPS.MAX_CREATION_RECORD_BYTES) {
          this.creationsDroppedBytes += recordBytes
          continue
        }
        this.creations.push(record)
        if (this.creations.length > PROCESS_EVIDENCE_CAPS.MAX_CREATION_RECORDS) {
          const dropped = this.creations.shift()
          this.creationsDroppedCount += 1
          this.creationsDroppedBytes += Buffer.byteLength(JSON.stringify(dropped), 'utf8')
        }
        this.log.log?.(`[router] agent ${this.agentId}: session ${match[1]} ${match[2]} (${match[3]} events)`)
      }
    }
  },

  onSessionEvent(params) {
    if (params === null || typeof params !== 'object') return
    this.eventSeq += 1
    this.observationSeq += 1
    const seq = this.eventSeq
    const observationSeq = this.observationSeq
    let stored = params
    let bytes = Buffer.byteLength(JSON.stringify(params ?? null), 'utf8')
    if (bytes > PROCESS_EVIDENCE_CAPS.MAX_EVENT_RECORD_BYTES) {
      // Oversized single event: correlation header + explicit truncated
      // metadata — never allocate the unbounded payload.
      stored = {
        __truncatedEvent: true,
        sessionId: params.sessionId ?? null,
        eventType: params.event?.type ?? null,
        originalBytes: bytes,
      }
      bytes = Buffer.byteLength(JSON.stringify(stored), 'utf8')
    }
    this.eventLog.set(seq, { params: stored, bytes, observationSeq })
    this.eventLogBytes += bytes
    while (this.eventLog.size > PROCESS_EVIDENCE_CAPS.MAX_EVENT_RECORDS
        || this.eventLogBytes > PROCESS_EVIDENCE_CAPS.MAX_EVENT_BUFFER_BYTES) {
      const oldestKey = this.eventLog.keys().next().value
      if (oldestKey === undefined) break
      const oldest = this.eventLog.get(oldestKey)
      this.eventLog.delete(oldestKey) // O(1); sequence numbers are never reused
      this.eventLogBytes -= oldest.bytes
      this.eventsDroppedCount += 1
    }
    // Live matcher: incremental attribution at event arrival (BOUNDED rule 2).
    // Events that arrive BEFORE the receipt messageId is bound are retained
    // in the bounded ring and replayed on binding (C-011: a receipt event
    // arriving before the JSON-RPC response must never be lost).
    for (const execution of [...this.executions.values()]) {
      if (seq <= execution.watermarkSeq || seq <= execution.lastFedSeq) continue
      if (params.sessionId !== execution.sessionId) continue
      if (execution.receiptMessageId === null) continue
      this.feedExecution(execution, params.event, seq, observationSeq)
    }
  },

  onSessionStatus(params) {
    if (params === null || typeof params !== 'object') return
    this.observationSeq += 1
    this.status[params.sessionId] = params.status
    for (const execution of [...this.executions.values()]) {
      if (execution.sessionId !== params.sessionId) continue
      if (params.status === 'idle') execution.idleObservationSeq = this.observationSeq
      if (execution.terminalEvent !== null) this.trySettleExecution(execution)
    }
  },
}
