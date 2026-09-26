/**
 * @agent-core/agent-router/src/reconciliation/store.js — the Router
 * reconciliation store of AGENT_PROCESS_LIFECYCLE_HARDENING_V3
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
 * runtime-epoch mismatch is `restart_lost` only when the epoch was never
 * durably observed. V3 records remain queryable across control-plane restarts.
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
  ReconciliationCapacityError, correlationEntryByteSize, recordByteSize,
} from './capacity.js'
import { settlementMethods } from './state-machine.js'
import { queryMethods } from './query.js'
import { authorityCapacityMethods } from './authority-capacity.js'
import { startupRecoveryMethods } from './startup-recovery.js'
import { readDurableRecoveryStore, writeDurableRecoveryStore } from './durable-file.js'
import { validatedIngressCorrelation } from './ingress-correlation.js'

const MANDATORY_TRANSITION_HEADROOM_BYTES = 4096

export class TurnReconciliationStore {
  /**
   * @param {object} [opts]
   * @param {string} [opts.runtimeEpoch] opaque epoch id (default: fresh UUID —
   *   a new control-plane runtime never claims a previous epoch's handles).
   */
  constructor({ runtimeEpoch, persistenceFile = null } = {}) {
    this.runtimeEpoch = runtimeEpoch ?? randomUUID()
    this.runtimeEpochs = new Set([this.runtimeEpoch])
    this.persistenceFile = persistenceFile
    this.startupBlockedReason = null
    /** handle -> record */
    this.records = new Map()
    /** agentId -> { discriminator, maxIssuedTurnSeq, evictedThroughTurnSeq, evictedSparseSeqs:Set, generations: Map<generation, {minSeq,maxSeq,hasUnresolved}> } */
    this.issuance = new Map()
    /** `${occurrenceId}\0${runId}\0${requestId}` -> handle (exact secondary index) */
    this.correlationIndex = new Map()
    this.correlationBytes = 0
    this.listeners = new Set()
    /** Incremental capacity accounting (O(1) per mint/evict, no scans). */
    this.globalBytes = 0
    this.agentCounts = new Map()
    this.agentBytes = new Map()
    this.discriminatorSeq = 0
    if (this.persistenceFile !== null) {
      try {
        const durable = readDurableRecoveryStore(this.persistenceFile)
        if (durable !== null) {
          for (const epoch of durable.runtimeEpochs) this.runtimeEpochs.add(epoch)
          this.records = durable.records
          this.issuance = durable.issuance
          this.correlationIndex = durable.correlationIndex
          this.discriminatorSeq = durable.discriminatorSeq
          this.recountCapacity()
          this.restoreCrashInterruptedRecords()
        } else {
          this.persistDurable()
        }
      } catch (error) {
        this.records.clear()
        this.issuance.clear()
        this.correlationIndex.clear()
        this.correlationBytes = 0
        this.globalBytes = 0
        this.agentCounts.clear()
        this.agentBytes.clear()
        this.startupBlockedReason = error instanceof SyntaxError
          || error instanceof TypeError
          || error instanceof ReconciliationCapacityError
          ? 'durable_store_invalid'
          : 'durable_store_unavailable'
      }
    }
  }

  recountCapacity() {
    this.validateRestoredAuthority()
    this.globalBytes = 0
    this.agentCounts = new Map()
    this.agentBytes = new Map()
    this.correlationBytes = 0
    for (const issuance of this.issuance.values()) {
      for (const generation of issuance.generations.values()) {
        generation.unresolvedCount = 0
        generation.liveRecords = 0
      }
    }
    for (const record of this.records.values()) {
      record.bytes = recordByteSize(record)
      if (record.bytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORD_BYTES) {
        throw new ReconciliationCapacityError(`reconciliation: restored record ${record.handle} exceeds byte cap`)
      }
      this.globalBytes += record.bytes
      this.agentCounts.set(record.agentId, (this.agentCounts.get(record.agentId) ?? 0) + 1)
      this.agentBytes.set(record.agentId, (this.agentBytes.get(record.agentId) ?? 0) + record.bytes)
      const generation = this.issuance.get(record.agentId)?.generations.get(record.processGeneration)
      if (generation !== undefined) {
        generation.liveRecords += 1
        if (record.state !== 'settled') generation.unresolvedCount += 1
      }
    }
    for (const [key, handle] of this.correlationIndex) {
      if (!this.records.has(handle)) throw new ReconciliationCapacityError('reconciliation: orphan caller correlation')
      this.correlationBytes += correlationEntryByteSize(key, handle)
    }
    this.globalBytes += this.correlationBytes
    if (this.records.size > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_GLOBAL
        || this.globalBytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) {
      throw new ReconciliationCapacityError('reconciliation: restored global capacity exceeds frozen caps')
    }
    for (const [agentId, count] of this.agentCounts) {
      if (count > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT
          || (this.agentBytes.get(agentId) ?? 0) > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT) {
        throw new ReconciliationCapacityError(`reconciliation: restored capacity exceeds frozen caps for ${agentId}`)
      }
    }
    for (const [agentId, issuance] of this.issuance) {
      if (issuance.generations.size + issuance.evictedGenerations.size
          > RECONCILIATION_CAPS.MAX_ISSUANCE_GENERATIONS_PER_AGENT) {
        throw new ReconciliationCapacityError(`reconciliation: restored issuance capacity exceeds frozen caps for ${agentId}`)
      }
    }
    if (this.correlationIndex.size > RECONCILIATION_CAPS.MAX_CORRELATION_INDEX_ENTRIES_GLOBAL) {
      throw new ReconciliationCapacityError('reconciliation: restored correlation capacity exceeds frozen caps')
    }
  }

  persistDurable() {
    if (this.startupBlockedReason !== null) {
      throw Object.assign(new Error(`reconciliation durable store blocked: ${this.startupBlockedReason}`), {
        code: 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED',
      })
    }
    try {
      this.compactRuntimeEpochs()
      writeDurableRecoveryStore(this.persistenceFile, this)
    } catch (error) {
      this.startupBlockedReason = 'durable_store_unavailable'
      throw error
    }
  }

  businessAdmissionStatus() {
    return this.startupBlockedReason === null
      ? { ready: true, reason: null }
      : { ready: false, reason: this.startupBlockedReason }
  }

  assertBusinessAdmissionReady() {
    if (this.startupBlockedReason === null) return true
    throw Object.assign(new Error(`agent-router: recovery startup blocked (${this.startupBlockedReason})`), {
      code: 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED',
      status: 'not_admitted',
      envelope: 'not_admitted',
      requestAdmission: 'not_admitted',
      failureStage: 'admission',
      fencedBy: null,
      reconciliationHandle: null,
      processGeneration: null,
      terminationEvidence: null,
      missingEvidence: ['live_generation_ownership'],
      attemptedActions: [],
      nextSafeAction: 'operator_exact_generation_recovery',
      replyDelivery: 'not_attempted',
      partialDelivery: 'none',
    })
  }

  activeFenceForAgent(agentId) {
    for (const record of this.records.values()) {
      if (record.agentId === agentId && record.initialOutcome === 'outcome_unknown'
          && record.fenceState !== 'cleared') return record
    }
    return null
  }

  /**
   * Restart-safety floor for the process-generation allocator (durable
   * generation restart safety): the HIGHEST generation id this agent has ever
   * recorded in its issuance history — live buckets, evicted buckets, and the
   * eviction watermark included. A fresh allocation must be strictly greater:
   * after a runtime restart the in-memory allocator restarts at 1, and
   * reissuing any of these ids would extend an old generation's range past a
   * newer one (overlapping ranges => the store is rejected at its next load)
   * or duplicate an evicted id (duplicate-generation rejection). Read-only:
   * never mutates store state; returns 0 when the agent has no history. A
   * store whose durable file failed to load is cleared + admission-blocked by
   * the constructor, so this accessor is only ever consulted on a store whose
   * contents provably loaded.
   */
  highestIssuedGeneration(agentId) {
    const issuance = this.issuance.get(agentId)
    if (issuance === undefined) return 0
    let highest = Number.isSafeInteger(issuance.evictedThroughGeneration) ? issuance.evictedThroughGeneration : 0
    for (const generation of issuance.generations.keys()) {
      if (generation > highest) highest = generation
    }
    for (const generation of issuance.evictedGenerations.keys()) {
      if (generation > highest) highest = generation
    }
    return highest
  }

  unresolvedRecoveryRecords() {
    return [...this.records.values()]
      .filter(record => record.initialOutcome === 'outcome_unknown' && record.state !== 'settled')
      .map(record => ({
        handle: record.handle,
        agentId: record.agentId,
        processGeneration: record.processGeneration,
        recoveryState: record.recoveryState,
      }))
  }

  // ---------------------------------------------------------------- mint

  /**
   * Mint one turnExecutionId == reconciliationHandle and RESERVE the
   * authoritative pending record. Must be called before the event watermark
   * and any prompt bytes. Capacity is enforced fail-loud BEFORE reservation.
   * @returns {string} reconciliationHandle
   */
  mintTurnExecution({ agentId, processGeneration, sessionId, callerCorrelation = null, ingressCorrelation = null }) {
    if (typeof agentId !== 'string' || agentId === '') throw new TypeError('mintTurnExecution: agentId required')
    if (!Number.isSafeInteger(processGeneration) || processGeneration <= 0) throw new TypeError('mintTurnExecution: processGeneration must be a positive integer')
    const correlationKey = callerCorrelation === null ? null : this.callerCorrelationKey(callerCorrelation)
    const checkedIngress = validatedIngressCorrelation(ingressCorrelation)
    if (correlationKey !== null) {
      const existing = this.correlationIndex.get(correlationKey)
      if (existing !== undefined) {
        throw Object.assign(new Error(`reconciliation: caller correlation already bound to ${existing}; refusing a second authority mint`), { code: 'RECONCILIATION_CORRELATION_CONFLICT' })
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
    const correlationBytes = correlationKey === null ? 0 : correlationEntryByteSize(correlationKey, `turn:${this.runtimeEpoch}:a${issuance.discriminator}:g${processGeneration}:s${issuance.maxIssuedTurnSeq + 1}`)
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
    if (correlationKey !== null) this.assertCorrelationCapacity(correlationBytes)
    const createdAt = Date.now()
    const record = {
      handle,
      runtimeEpoch: this.runtimeEpoch,
      agentId,
      processGeneration,
      turnSeq,
      sessionId: sessionId ?? null,
      callerCorrelation: callerCorrelation === null ? null : { ...callerCorrelation },
      ingressCorrelation: checkedIngress,
      createdAtWallMs: createdAt,
      createdAt,
      updatedAt: createdAt,
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
      hardDeadlineAt: null,
      recoveryState: 'reserved',
      missingEvidence: [],
      reapClaim: null,
      attemptedActions: [],
      shutdownRequestedAt: null,
      exitObservedAt: null,
      settlementResult: null,
      failureReason: null,
      nextSafeAction: 'none',
      fenceState: 'armed',
      reservedMandatoryBytes: MANDATORY_TRANSITION_HEADROOM_BYTES,
      bytes: 0,
    }
    record.bytes = recordByteSize(record)
    if (record.bytes + REQUIRED_RECORD_EVIDENCE_HEADROOM_BYTES > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORD_BYTES) {
      throw new ReconciliationCapacityError(`reconciliation: reserved record for ${agentId} leaves insufficient terminal output/audit headroom`)
    }
    this.evictResolvedForByteCapacity(agentId, record.bytes)
    if ((this.agentBytes.get(agentId) ?? 0) + record.bytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT
        || this.globalBytes + record.bytes + correlationBytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) {
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
    if (correlationKey !== null) {
      this.correlationIndex.set(correlationKey, handle)
      this.correlationBytes += correlationBytes
      this.globalBytes += correlationBytes
    }
    this.persistDurable()
    return handle
    } catch (error) {
      this.restoreAuthority(authorityBefore)
      throw error
    }
  }


  callerCorrelationKey({ occurrenceId, runId, requestId }) {
    const coordinates = [occurrenceId, runId, requestId]
    if (coordinates.some(value => value !== null && value !== undefined && typeof value !== 'string')) {
      throw new TypeError('reconciliation: caller correlation coordinates must be strings when present')
    }
    const key = coordinates.map(value => value ?? '').join('\u0000')
    if (Buffer.byteLength(key, 'utf8') > RECONCILIATION_CAPS.MAX_CORRELATION_KEY_BYTES) {
      throw new ReconciliationCapacityError('reconciliation: caller correlation key exceeds byte cap')
    }
    return key
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
      candidate.hardDeadlineAt = deadlineAtWallMs ?? null
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

}

// Settlement machines (state-machine.js) + non-consuming queries (query.js)
// compose onto the single store class — one prototype, one state machine.
// Descriptors are normalized to enumerable: false before installation (B-1)
// to preserve the pre-refactor class prototype shape; value/get/set/
// writable/configurable pass through unchanged and `constructor` is never
// installed.
const composedMethodDescriptors = {}
for (const group of [authorityCapacityMethods, settlementMethods, queryMethods, startupRecoveryMethods]) {
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(group))) {
    if (key === 'constructor') continue
    composedMethodDescriptors[key] = { ...descriptor, enumerable: false }
  }
}
Object.defineProperties(TurnReconciliationStore.prototype, composedMethodDescriptors)
