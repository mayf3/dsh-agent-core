/**
 * @agent-core/agent-router/src/reconciliation/store.js — the Router
 * reconciliation store of AGENT_PROCESS_LIFECYCLE_HARDENING_V2
 * (CLAUSE-PROC-RECONCILIATION C-017..C-019 + the reconciliation caps of
 * CLAUSE-PROC-BOUNDED).
 *
 * This store is the SINGLE query authority for late turn reconciliation:
 * the AgentProcess local matcher is bounded working state only and never a
 * second truth source. All reads are non-consuming, repeatable and
 * idempotent — a read never deletes a record, never advances state and
 * never changes the result of a later read.
 *
 * Handle identity (C-018): every handle embeds an opaque
 *   runtimeEpoch + agentId discriminator + processGeneration + monotonicTurnSeq
 * minted by this store. `monotonicTurnSeq` is continuous per (runtime epoch,
 * Agent) with no gaps, enabling exact distinction between `evicted` (legally
 * issued, resolved payload removed) and `never_existed` (seq beyond the
 * high-water / illegal agent-generation combination / never minted). A
 * runtime-epoch mismatch is uniformly `restart_lost`; this Spec promises no
 * disk persistence across control-plane restarts.
 *
 * Settle-once (C-017): every `outcome_unknown` record may transition exactly
 * once into exactly one of late_completed | late_failed |
 * terminated_without_outcome (mutually exclusive). Winning settlement is a
 * CAS on state pending->settled; duplicate same evidence and conflicting
 * evidence afterwards NEVER rewrite state/output — they only append bounded
 * audit entries (duplicate_ignored / conflict_ignored).
 *
 * Module split (structure refactor, semantics unchanged): capacity ceilings
 * and byte accounting live in capacity.js, the settle-once machines in
 * state-machine.js and the non-consuming queries in query.js; they compose
 * onto this class's prototype below — one class, one state machine.
 */

import { randomUUID } from 'node:crypto'

import { RECONCILIATION_CAPS, ReconciliationCapacityError, recordByteSize } from './capacity.js'
import { settlementMethods } from './state-machine.js'
import { queryMethods } from './query.js'

export class TurnReconciliationStore {
  /**
   * @param {object} [opts]
   * @param {string} [opts.runtimeEpoch] opaque epoch id (default: fresh UUID —
   *   a new control-plane runtime never claims a previous epoch's handles).
   */
  constructor({ runtimeEpoch } = {}) {
    this.runtimeEpoch = runtimeEpoch ?? randomUUID()
    /** handle -> record */
    this.records = new Map()
    /** agentId -> { discriminator, maxIssuedTurnSeq, evictedThroughTurnSeq, evictedSparseSeqs:Set, generations: Map<generation, {minSeq,maxSeq,hasUnresolved}> } */
    this.issuance = new Map()
    /** `${occurrenceId}\0${runId}\0${requestId}` -> handle (exact secondary index) */
    this.correlationIndex = new Map()
    this.listeners = new Set()
    /** Incremental capacity accounting (O(1) per mint/evict, no scans). */
    this.globalBytes = 0
    this.agentCounts = new Map()
    this.agentBytes = new Map()
    this.discriminatorSeq = 0
  }

  // ---------------------------------------------------------------- mint

  /**
   * Mint one turnExecutionId == reconciliationHandle and RESERVE the
   * authoritative pending record. Must be called before the event watermark
   * and any prompt bytes. Capacity is enforced fail-loud BEFORE reservation.
   * @returns {string} reconciliationHandle
   */
  mintTurnExecution({ agentId, processGeneration, sessionId, callerCorrelation = null }) {
    if (typeof agentId !== 'string' || agentId === '') throw new TypeError('mintTurnExecution: agentId required')
    if (!Number.isSafeInteger(processGeneration) || processGeneration <= 0) throw new TypeError('mintTurnExecution: processGeneration must be a positive integer')
    let issuance = this.issuance.get(agentId)
    if (issuance === undefined) {
      this.discriminatorSeq += 1
      issuance = {
        discriminator: this.discriminatorSeq,
        maxIssuedTurnSeq: 0,
        evictedThroughTurnSeq: 0,
        evictedSparseSeqs: new Set(),
        evictedThroughGeneration: 0,
        evictedGenerations: new Map(), // generation -> maxSeq (bounded, rule 11)
        generations: new Map(),
      }
      this.issuance.set(agentId, issuance)
    }
    if (!Number.isSafeInteger(issuance.maxIssuedTurnSeq + 1)) {
      throw new ReconciliationCapacityError(`reconciliation: turn sequence exhausted for agent ${agentId}`)
    }
    const turnSeq = issuance.maxIssuedTurnSeq + 1

    // Capacity: admission must fail BEFORE reservation when eviction of
    // resolved records cannot free enough space (rule 8). Unresolved records
    // are never evictable.
    this.assertMintCapacity(agentId)

    const handle = `turn:${this.runtimeEpoch}:a${issuance.discriminator}:g${processGeneration}:s${turnSeq}`
    const record = {
      handle,
      runtimeEpoch: this.runtimeEpoch,
      agentId,
      processGeneration,
      turnSeq,
      sessionId: sessionId ?? null,
      callerCorrelation: callerCorrelation === null ? null : { ...callerCorrelation },
      createdAtWallMs: Date.now(),
      admitted: false,
      promptWriteAttempted: false,
      eventWatermarkSeq: null,
      promptRequestId: null,
      messageId: null,
      deadlineAtWallMs: null,
      initialOutcome: null,
      initialSource: null,
      outcome: null,
      state: 'pending',
      lateOutcome: null,
      outcomeEvidence: null,
      terminationEvidence: null,
      settledAtWallMs: null,
      cancelRequested: false,
      cancelRequestedAtWallMs: null,
      finalAssistantOutput: null,
      audit: [],
      bytes: 0,
    }
    record.bytes = recordByteSize(record)
    if (record.bytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORD_BYTES) {
      throw new ReconciliationCapacityError(`reconciliation: reserved record for ${agentId} exceeds per-record byte cap`)
    }
    if ((this.agentBytes.get(agentId) ?? 0) + record.bytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT
        || this.globalBytes + record.bytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) {
      throw new ReconciliationCapacityError(
        `reconciliation: byte capacity exhausted for agent ${agentId} (agent ${this.agentBytes.get(agentId) ?? 0}B, global ${this.globalBytes}B) — unresolved records are not evictable`,
      )
    }
    issuance.maxIssuedTurnSeq = turnSeq
    const generationEntry = issuance.generations.get(processGeneration)
    if (generationEntry === undefined) {
      issuance.generations.set(processGeneration, { minSeq: turnSeq, maxSeq: turnSeq, unresolvedCount: 1, liveRecords: 1 })
    } else {
      generationEntry.maxSeq = turnSeq
      generationEntry.unresolvedCount += 1
      generationEntry.liveRecords += 1
    }
    this.records.set(handle, record)
    this.globalBytes += record.bytes
    this.agentCounts.set(agentId, (this.agentCounts.get(agentId) ?? 0) + 1)
    this.agentBytes.set(agentId, (this.agentBytes.get(agentId) ?? 0) + record.bytes)
    if (record.callerCorrelation !== null) {
      this.bindCallerCorrelation(record.callerCorrelation, handle)
    }
    return handle
  }

  /**
   * Admission capacity precheck (CLAUSE-PROC-BOUNDED rule 8): fails loud
   * BEFORE any reservation when neither per-Agent nor global count/byte caps
   * can be satisfied — first attempting oldest-first eviction of RESOLVED
   * records. Unresolved records are never evictable. Router-level admission
   * calls this BEFORE spawning / writing so capacity exhaustion never costs a
   * spawn or a prompt byte (§10.3 ROUTER_GLOBAL_RECONCILIATION_CAP: S=0).
   */
  assertMintCapacity(agentId) {
    const agentCount = this.agentCounts.get(agentId) ?? 0
    const agentBytes = this.agentBytes.get(agentId) ?? 0
    if (agentCount + 1 <= RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT
        && this.records.size + 1 <= RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_GLOBAL) {
      return true
    }
    this.evictResolvedForCapacity(agentId)
    const agentCountAfter = this.agentCounts.get(agentId) ?? 0
    if (agentCountAfter + 1 > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT
        || this.records.size + 1 > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_GLOBAL) {
      throw new ReconciliationCapacityError(
        `reconciliation: record capacity exhausted (agent records ${agentCountAfter}/${RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT}, global ${this.records.size}/${RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_GLOBAL}) — unresolved records are not evictable`,
      )
    }
    return true
  }

  /** Oldest-first eviction of RESOLVED records only (rule: unresolved never evicted). */
  evictResolvedForCapacity(agentId) {
    const agentCountPressure = () => (this.agentCounts.get(agentId) ?? 0) + 1 > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT
    const globalCountPressure = () => this.records.size + 1 > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_GLOBAL
    // Per-Agent pressure evicts THAT agent's oldest resolved records; global
    // pressure evicts globally-oldest resolved records.
    const candidates = [...this.records.values()]
      .filter(r => r.state === 'settled')
      .sort((a, b) => {
        const aPinned = a.agentId === agentId
        const bPinned = b.agentId === agentId
        if (aPinned !== bPinned) return aPinned ? -1 : 1
        return a.agentId === b.agentId ? a.turnSeq - b.turnSeq : (a.agentId < b.agentId ? -1 : 1)
      })
    for (const record of candidates) {
      if (!agentCountPressure() && !globalCountPressure()
          && this.globalBytes < RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) break
      this.evictRecord(record)
    }
  }

  evictRecord(record) {
    this.records.delete(record.handle)
    this.globalBytes -= record.bytes
    this.agentCounts.set(record.agentId, (this.agentCounts.get(record.agentId) ?? 1) - 1)
    this.agentBytes.set(record.agentId, (this.agentBytes.get(record.agentId) ?? record.bytes) - record.bytes)
    const issuance = this.issuance.get(record.agentId)
    if (issuance !== undefined) {
      if (record.turnSeq === issuance.evictedThroughTurnSeq + 1) {
        issuance.evictedThroughTurnSeq = record.turnSeq
      } else {
        issuance.evictedSparseSeqs.add(record.turnSeq)
        if (issuance.evictedSparseSeqs.size > RECONCILIATION_CAPS.MAX_EVICTED_SPARSE_SEQS_PER_AGENT) {
          // Bounded: drop the oldest sparse entry; the contiguous watermark
          // plus record-presence checks remain the authoritative signals.
          const oldest = issuance.evictedSparseSeqs.values().next().value
          issuance.evictedSparseSeqs.delete(oldest)
        }
      }
      // Rule 11: compact the generation range once none of its records are
      // live — legally-evicted handles of the removed generation still
      // resolve as `evicted` through the watermarks above.
      const generationEntry = issuance.generations.get(record.processGeneration)
      if (generationEntry !== undefined) {
        generationEntry.liveRecords -= 1
        if (generationEntry.liveRecords <= 0) {
          const generation = record.processGeneration
          issuance.generations.delete(generation)
          if (generation === issuance.evictedThroughGeneration + 1) {
            issuance.evictedThroughGeneration = generation
          } else {
            issuance.evictedGenerations.set(generation, generationEntry.maxSeq)
            if (issuance.evictedGenerations.size > 256) {
              const oldest = issuance.evictedGenerations.keys().next().value
              issuance.evictedGenerations.delete(oldest)
              this.evictedGenerationRangesDropped = (this.evictedGenerationRangesDropped ?? 0) + 1
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------ record lifecycle

  requireRecord(handle) {
    const record = this.records.get(handle)
    if (record === undefined) throw new Error(`reconciliation: unknown handle ${JSON.stringify(handle)}`)
    return record
  }

  /** Pre-write authoritative visibility (C-010: record exists before prompt bytes). */
  markAdmitted(handle, { eventWatermarkSeq, promptRequestId, deadlineAtWallMs }) {
    const record = this.requireRecord(handle)
    record.admitted = true
    record.eventWatermarkSeq = eventWatermarkSeq ?? null
    record.promptRequestId = promptRequestId ?? null
    record.deadlineAtWallMs = deadlineAtWallMs ?? null
    this.retally(record)
  }

  markPromptWriteAttempted(handle) {
    const record = this.requireRecord(handle)
    record.promptWriteAttempted = true
    this.retally(record)
  }

  markPromptReceipt(handle, { messageId }) {
    const record = this.requireRecord(handle)
    record.messageId = messageId ?? null
    this.retally(record)
  }

  markCancelRequested(handle) {
    const record = this.requireRecord(handle)
    if (record.cancelRequested) return
    record.cancelRequested = true
    record.cancelRequestedAtWallMs = Date.now()
    this.retally(record)
  }

  /**
   * Incremental final-assistant-output capture (C-018 + BOUNDED rule 10):
   * the caller (AgentProcess matcher) owns UTF-8-safe tail truncation and
   * pushes the bounded tail here; the store is the authoritative copy.
   */
  updateFinalOutput(handle, output) {
    const record = this.requireRecord(handle)
    record.finalAssistantOutput = output === null || output === undefined ? null : {
      text: String(output.text ?? ''),
      truncated: output.truncated === true,
      originalBytes: output.originalBytes ?? Buffer.byteLength(String(output.text ?? ''), 'utf8'),
    }
    this.retally(record)
  }

  appendAudit(record, entry) {
    const bounded = {
      kind: entry.kind,
      evidenceType: entry.evidenceType ?? null,
      observedAtWallMs: Date.now(),
    }
    record.audit.push(bounded)
    // Bounded audit list: count + bytes caps; oldest entries drop first with
    // a counter (never silently unbounded).
    while (record.audit.length > RECONCILIATION_CAPS.MAX_RECONCILIATION_AUDIT_ENTRIES_PER_RECORD) {
      record.audit.shift()
      record.auditDroppedCount = (record.auditDroppedCount ?? 0) + 1
    }
    this.retally(record)
  }

  retally(record) {
    const before = record.bytes
    record.bytes = recordByteSize(record)
    this.globalBytes += record.bytes - before
    this.agentBytes.set(record.agentId, (this.agentBytes.get(record.agentId) ?? before) + record.bytes - before)
  }
}

// Settlement machines (state-machine.js) + non-consuming queries (query.js)
// compose onto the single store class — one prototype, one state machine.
Object.assign(TurnReconciliationStore.prototype, settlementMethods, queryMethods)
