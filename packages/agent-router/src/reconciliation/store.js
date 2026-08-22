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

import {
  RECONCILIATION_CAPS, REQUIRED_RECORD_EVIDENCE_HEADROOM_BYTES,
  ReconciliationCapacityError, recordByteSize,
} from './capacity.js'
import { settlementMethods } from './state-machine.js'
import { queryMethods } from './query.js'

const MANDATORY_TRANSITION_HEADROOM_BYTES = 4096

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
    const correlationKey = callerCorrelation === null ? null : this.callerCorrelationKey(callerCorrelation)
    if (correlationKey !== null) {
      const existing = this.correlationIndex.get(correlationKey)
      if (existing !== undefined) {
        throw Object.assign(new Error(`reconciliation: caller correlation already bound to ${existing}; refusing a second authority mint`), { code: 'RECONCILIATION_CORRELATION_CONFLICT' })
      }
      if (this.correlationIndex.size >= RECONCILIATION_CAPS.MAX_CORRELATION_INDEX_ENTRIES_GLOBAL) {
        throw new ReconciliationCapacityError('reconciliation: caller correlation index capacity exhausted')
      }
    }
    const existingIssuance = this.issuance.get(agentId)
    const issuance = existingIssuance ?? {
      discriminator: this.discriminatorSeq + 1,
      maxIssuedTurnSeq: 0,
      evictedThroughTurnSeq: 0,
      evictedSparseSeqs: new Set(),
      evictedThroughGeneration: 0,
      evictedGenerations: new Map(),
      generations: new Map(),
    }
    if (!Number.isSafeInteger(issuance.maxIssuedTurnSeq + 1)) {
      throw new ReconciliationCapacityError(`reconciliation: turn sequence exhausted for agent ${agentId}`)
    }
    const authorityBefore = this.snapshotAuthority()
    try {
    if (!issuance.generations.has(processGeneration)
        && issuance.generations.size + issuance.evictedGenerations.size >= RECONCILIATION_CAPS.MAX_ISSUANCE_GENERATIONS_PER_AGENT) {
      this.evictSettledGenerationForCapacity(agentId, issuance)
      if (issuance.generations.size + issuance.evictedGenerations.size >= RECONCILIATION_CAPS.MAX_ISSUANCE_GENERATIONS_PER_AGENT) {
        throw new ReconciliationCapacityError(`reconciliation: issuance generation capacity exhausted for agent ${agentId}`)
      }
    }
    const turnSeq = issuance.maxIssuedTurnSeq + 1
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
      reservedMandatoryBytes: MANDATORY_TRANSITION_HEADROOM_BYTES,
      bytes: 0,
    }
    record.bytes = recordByteSize(record)
    if (record.bytes + REQUIRED_RECORD_EVIDENCE_HEADROOM_BYTES > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORD_BYTES) {
      throw new ReconciliationCapacityError(`reconciliation: reserved record for ${agentId} leaves insufficient terminal output/audit headroom`)
    }
    this.evictResolvedForByteCapacity(agentId, record.bytes)
    if ((this.agentBytes.get(agentId) ?? 0) + record.bytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT
        || this.globalBytes + record.bytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) {
      throw new ReconciliationCapacityError(
        `reconciliation: byte capacity exhausted for agent ${agentId} (agent ${this.agentBytes.get(agentId) ?? 0}B, global ${this.globalBytes}B) — unresolved records are not evictable`,
      )
    }
    if (existingIssuance === undefined) {
      this.discriminatorSeq = issuance.discriminator
      this.issuance.set(agentId, issuance)
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
    if (correlationKey !== null) this.correlationIndex.set(correlationKey, handle)
    return handle
    } catch (error) {
      this.restoreAuthority(authorityBefore)
      throw error
    }
  }

  snapshotAuthority() {
    const issuance = new Map([...this.issuance].map(([agentId, entry]) => [agentId, {
      ...entry,
      evictedSparseSeqs: new Set(entry.evictedSparseSeqs),
      evictedGenerations: new Map(entry.evictedGenerations),
      generations: new Map([...entry.generations].map(([generation, value]) => [generation, { ...value }])),
    }]))
    return {
      records: new Map(this.records), issuance, correlationIndex: new Map(this.correlationIndex),
      globalBytes: this.globalBytes, agentCounts: new Map(this.agentCounts), agentBytes: new Map(this.agentBytes),
      discriminatorSeq: this.discriminatorSeq,
    }
  }

  restoreAuthority(snapshot) {
    this.records = snapshot.records
    this.issuance = snapshot.issuance
    this.correlationIndex = snapshot.correlationIndex
    this.globalBytes = snapshot.globalBytes
    this.agentCounts = snapshot.agentCounts
    this.agentBytes = snapshot.agentBytes
    this.discriminatorSeq = snapshot.discriminatorSeq
  }

  callerCorrelationKey({ occurrenceId, runId, requestId }) {
    return `${occurrenceId ?? ''}\u0000${runId ?? ''}\u0000${requestId ?? ''}`
  }

  assertCorrelationCapacity() {
    if (this.correlationIndex.size >= RECONCILIATION_CAPS.MAX_CORRELATION_INDEX_ENTRIES_GLOBAL) {
      throw new ReconciliationCapacityError('reconciliation: caller correlation index capacity exhausted')
    }
  }

  evictSettledGenerationForCapacity(agentId, issuance) {
    const candidate = [...issuance.generations.entries()]
      .filter(([generation, entry]) => entry.unresolvedCount === 0
        && generation === issuance.evictedThroughGeneration + 1)
      .sort((a, b) => a[0] - b[0])[0]
    if (candidate === undefined) return
    const generation = candidate[0]
    for (const record of [...this.records.values()]) {
      if (record.agentId === agentId && record.processGeneration === generation && record.state === 'settled') {
        this.evictRecord(record)
      }
    }
  }

  canEvictRecord(record) {
    const issuance = this.issuance.get(record.agentId)
    const generationEntry = issuance?.generations.get(record.processGeneration)
    if (issuance === undefined || generationEntry === undefined || generationEntry.liveRecords > 1) return true
    return record.processGeneration === issuance.evictedThroughGeneration + 1
      || issuance.evictedGenerations.has(record.processGeneration)
      || issuance.evictedGenerations.size < RECONCILIATION_CAPS.MAX_ISSUANCE_GENERATIONS_PER_AGENT
  }

  evictResolvedForByteCapacity(agentId, additionalBytes, excludeHandle = null) {
    const candidates = [...this.records.values()].filter(record => record.state === 'settled'
      && record.handle !== excludeHandle && this.canEvictRecord(record))
    for (const record of candidates) {
      const agentPressure = (this.agentBytes.get(agentId) ?? 0) + additionalBytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT
      const globalPressure = this.globalBytes + additionalBytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL
      if (!agentPressure && !globalPressure) break
      if (!globalPressure && record.agentId !== agentId) continue
      this.evictRecord(record)
    }
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
      .filter(r => r.state === 'settled' && this.canEvictRecord(r))
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
    if (!this.canEvictRecord(record)) {
      throw new ReconciliationCapacityError(`reconciliation: evicting ${record.handle} would exceed issuance metadata cap`)
    }
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
    this.mutateRecord(record, (candidate) => {
      candidate.admitted = true
      candidate.eventWatermarkSeq = eventWatermarkSeq ?? null
      candidate.promptRequestId = promptRequestId ?? null
      candidate.deadlineAtWallMs = deadlineAtWallMs ?? null
    })
  }

  markPromptWriteAttempted(handle) {
    const record = this.requireRecord(handle)
    this.mutateRecord(record, candidate => { candidate.promptWriteAttempted = true })
  }

  markPromptReceipt(handle, { messageId }) {
    const record = this.requireRecord(handle)
    this.mutateRecord(record, candidate => { candidate.messageId = messageId ?? null })
  }

  markCancelRequested(handle) {
    const record = this.requireRecord(handle)
    if (record.cancelRequested) return
    this.mutateRecord(record, (candidate) => {
      candidate.cancelRequested = true
      candidate.cancelRequestedAtWallMs = Date.now()
    })
  }

  /**
   * Incremental final-assistant-output capture (C-018 + BOUNDED rule 10):
   * the caller (AgentProcess matcher) owns UTF-8-safe tail truncation and
   * pushes the bounded tail here; the store is the authoritative copy.
   */
  updateFinalOutput(handle, output) {
    const record = this.requireRecord(handle)
    this.mutateRecord(record, (candidate) => {
      candidate.finalAssistantOutput = output === null || output === undefined ? null : {
        text: String(output.text ?? ''),
        truncated: output.truncated === true,
        originalBytes: output.originalBytes ?? Buffer.byteLength(String(output.text ?? ''), 'utf8'),
      }
      if (candidate.finalAssistantOutput?.text !== '') {
        candidate.reservedMandatoryBytes = Math.min(candidate.reservedMandatoryBytes ?? 0, 2048)
      }
    })
  }

  /** Trim optional evidence before an authoritative mutation can exceed byte caps. */
  clampOptionalEvidence(candidate, record) {
    const agentBytes = this.agentBytes.get(record.agentId) ?? 0
    let reclaimableAgentBytes = 0
    let reclaimableGlobalBytes = 0
    for (const other of this.records.values()) {
      if (other.handle === record.handle || other.state !== 'settled' || !this.canEvictRecord(other)) continue
      reclaimableGlobalBytes += other.bytes
      if (other.agentId === record.agentId) reclaimableAgentBytes += other.bytes
    }
    const maxBytes = Math.min(
      RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORD_BYTES,
      record.bytes + RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT - agentBytes + reclaimableAgentBytes,
      record.bytes + RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL - this.globalBytes + reclaimableGlobalBytes,
    )
    while (recordByteSize(candidate) > maxBytes && candidate.audit.length > 0) {
      const dropped = candidate.audit.shift()
      candidate.auditDroppedCount = (candidate.auditDroppedCount ?? 0) + 1
      candidate.auditDroppedBytes = (candidate.auditDroppedBytes ?? 0)
        + Buffer.byteLength(JSON.stringify(dropped), 'utf8')
    }
    if (recordByteSize(candidate) <= maxBytes) return
    if (candidate.finalAssistantOutput !== null) {
      const output = candidate.finalAssistantOutput
      const source = Buffer.from(String(output.text ?? ''), 'utf8')
      let start = Math.min(source.length, Math.max(0, recordByteSize(candidate) - maxBytes))
      while (start < source.length && (source[start] & 0xc0) === 0x80) start += 1
      if (source.length > 0 && start >= source.length) {
        start = source.length - 1
        while (start > 0 && (source[start] & 0xc0) === 0x80) start -= 1
      }
      candidate.finalAssistantOutput = {
        text: source.subarray(start).toString('utf8'), truncated: true,
        originalBytes: Math.max(output.originalBytes ?? source.length, source.length),
      }
    }
    const excess = Math.max(0, recordByteSize(candidate) - maxBytes)
    candidate.reservedMandatoryBytes = Math.max(0, (candidate.reservedMandatoryBytes ?? 0) - excess)
  }

  mutateRecord(record, mutate) {
    const candidate = {
      ...record,
      callerCorrelation: record.callerCorrelation === null ? null : { ...record.callerCorrelation },
      finalAssistantOutput: record.finalAssistantOutput === null ? null : { ...record.finalAssistantOutput },
      audit: record.audit.map(entry => ({ ...entry })),
    }
    mutate(candidate)
    this.clampOptionalEvidence(candidate, record)
    const bytes = recordByteSize(candidate)
    if (bytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORD_BYTES) {
      throw new ReconciliationCapacityError(`reconciliation: record ${record.handle} exceeds per-record byte cap`)
    }
    const delta = bytes - record.bytes
    if (delta > 0) this.evictResolvedForByteCapacity(record.agentId, delta, record.handle)
    if ((this.agentBytes.get(record.agentId) ?? 0) + delta > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT
        || this.globalBytes + delta > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) {
      throw new ReconciliationCapacityError(`reconciliation: mutation byte capacity exhausted for ${record.handle}`)
    }
    const before = record.bytes
    Object.assign(record, candidate, { bytes })
    this.globalBytes += bytes - before
    this.agentBytes.set(record.agentId, (this.agentBytes.get(record.agentId) ?? before) + bytes - before)
    return record
  }

  appendAudit(record, entry) {
    const bounded = {
      kind: entry.kind,
      evidenceType: entry.evidenceType ?? null,
      observedAtWallMs: Date.now(),
    }
    this.mutateRecord(record, (candidate) => {
      candidate.audit.push(bounded)
      while (candidate.audit.length > RECONCILIATION_CAPS.MAX_RECONCILIATION_AUDIT_ENTRIES_PER_RECORD
          || Buffer.byteLength(JSON.stringify(candidate.audit), 'utf8') > RECONCILIATION_CAPS.MAX_RECONCILIATION_AUDIT_BYTES_PER_RECORD) {
        candidate.audit.shift()
        candidate.auditDroppedCount = (candidate.auditDroppedCount ?? 0) + 1
      }
    })
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
// Descriptors are normalized to enumerable: false before installation (B-1)
// to preserve the pre-refactor class prototype shape; value/get/set/
// writable/configurable pass through unchanged and `constructor` is never
// installed.
const composedMethodDescriptors = {}
for (const group of [settlementMethods, queryMethods]) {
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(group))) {
    if (key === 'constructor') continue
    composedMethodDescriptors[key] = { ...descriptor, enumerable: false }
  }
}
Object.defineProperties(TurnReconciliationStore.prototype, composedMethodDescriptors)
