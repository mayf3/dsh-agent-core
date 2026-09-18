/**
 * @agent-core/agent-router/src/reconciliation/query.js — the non-consuming
 * query surface of the Router reconciliation store
 * (AGENT_PROCESS_LIFECYCLE_HARDENING_V3 C-018/C-019/C-026).
 *
 * These methods compose onto TurnReconciliationStore.prototype (store.js).
 * All reads are non-consuming, repeatable and idempotent — a read never
 * deletes a record, never advances state and never changes the result of a
 * later read. Handle identity classification (restart_lost / evicted /
 * never_existed) resolves against current and durably observed runtime
 * epochs; V3 records remain queryable across control-plane restarts.
 */

import { correlationEntryByteSize } from './capacity.js'

const RECOVERY_PROJECTION_KEYS = Object.freeze([
  'failureStage', 'fencedBy', 'reconciliationHandle', 'processGeneration', 'terminationEvidence',
  'missingEvidence', 'attemptedActions', 'nextSafeAction', 'replyDelivery',
  'partialDelivery', 'requestAdmission',
])

export function outerFailureProjection(error, failureStage, recovery = {}) {
  const projection = {
    failureStage,
    fencedBy: null,
    reconciliationHandle: null,
    processGeneration: null,
    terminationEvidence: null,
    missingEvidence: [],
    attemptedActions: [],
    nextSafeAction: 'none',
    replyDelivery: 'not_attempted',
    partialDelivery: 'none',
    requestAdmission: failureStage === 'admission' ? 'not_admitted' : 'accepted',
  }
  for (const key of RECOVERY_PROJECTION_KEYS) {
    if (error?.[key] !== undefined) projection[key] = error[key]
    if (recovery?.[key] !== undefined) projection[key] = recovery[key]
  }
  return projection
}

export const queryMethods = {
  recordQueryState(record) {
    if (record.state === 'settled') return 'settled'
    return ['recovery_claimed', 'shutdown_requested', 'exit_observed', 'blocked'].includes(record.recoveryState)
      ? 'recovering'
      : 'pending'
  },

  recoveryDiagnostic(handle, { failureStage = 'admission', requestAdmission = 'not_admitted' } = {}) {
    const classified = this.classifyHandle(handle)
    const record = classified.record
    return {
      failureStage,
      fencedBy: record?.fenceState === 'active' ? handle : null,
      reconciliationHandle: record?.handle ?? null,
      processGeneration: record?.processGeneration ?? null,
      terminationEvidence: record?.terminationEvidence ?? null,
      missingEvidence: [...(record?.missingEvidence ?? [])],
      attemptedActions: (record?.attemptedActions ?? []).map(entry => ({ ...entry })),
      nextSafeAction: record?.nextSafeAction ?? 'await_late_evidence',
      replyDelivery: 'not_attempted',
      partialDelivery: 'none',
      requestAdmission,
    }
  },

  settledSnapshot(record) {
    return {
      handle: record.handle,
      turnExecutionId: record.handle,
      runtimeEpoch: record.runtimeEpoch,
      agentId: record.agentId,
      processGeneration: record.processGeneration,
      callerCorrelation: record.callerCorrelation === null ? null : { ...record.callerCorrelation },
      sessionId: record.sessionId,
      eventWatermarkSeq: record.eventWatermarkSeq,
      promptRequestId: record.promptRequestId,
      messageId: record.messageId,
      state: this.recordQueryState(record),
      initialOutcome: record.initialOutcome,
      initialSource: record.initialSource,
      outcome: record.outcome,
      lateOutcome: record.lateOutcome,
      outcomeEvidence: record.outcomeEvidence,
      terminationEvidence: record.terminationEvidence,
      errorClass: record.errorClass ?? null,
      cancelRequested: record.cancelRequested === true,
      cancelRequestedAtWallMs: record.cancelRequestedAtWallMs ?? null,
      settledAtWallMs: record.settledAtWallMs,
      updatedAt: record.updatedAt,
      deadlineAtWallMs: record.deadlineAtWallMs,
      hardDeadlineAt: record.hardDeadlineAt ?? record.deadlineAtWallMs,
      recoveryState: record.recoveryState ?? null,
      missingEvidence: [...(record.missingEvidence ?? [])],
      reapClaim: record.reapClaim === null || record.reapClaim === undefined ? null : { ...record.reapClaim },
      attemptedActions: (record.attemptedActions ?? []).map(entry => ({ ...entry })),
      shutdownRequestedAt: record.shutdownRequestedAt ?? null,
      exitObservedAt: record.exitObservedAt ?? null,
      settlementResult: record.settlementResult ?? null,
      failureReason: record.failureReason ?? null,
      nextSafeAction: record.nextSafeAction ?? 'none',
      fenceState: record.fenceState ?? 'none',
      finalAssistantOutput: record.finalAssistantOutput === null ? null : { ...record.finalAssistantOutput },
      audit: record.audit.map(entry => ({ ...entry })),
      ...(record.auditDroppedCount === undefined ? {} : { auditDroppedCount: record.auditDroppedCount }),
    }
  },

  /** Parse + classify one handle against current-epoch issuance metadata. */
  classifyHandle(handle) {
    if (typeof handle !== 'string') return { state: 'never_existed' }
    const match = handle.match(/^turn:([^:]+):a(\d+):g(\d+):s(\d+)$/)
    if (match === null) return { state: 'never_existed' }
    const [, epoch, discriminator, generationRaw, seqRaw] = match
    const durableRecord = this.records.get(handle)
    if (durableRecord !== undefined) {
      return { state: this.recordQueryState(durableRecord), agentId: durableRecord.agentId, record: durableRecord }
    }
    if (!this.runtimeEpochs.has(epoch)) return { state: 'restart_lost' }
    const discriminatorNumber = Number(discriminator)
    const generation = Number(generationRaw)
    const seq = Number(seqRaw)
    if (![discriminatorNumber, generation, seq].every(value => Number.isSafeInteger(value) && value > 0)
        || String(discriminatorNumber) !== discriminator || String(generation) !== generationRaw || String(seq) !== seqRaw) {
      return { state: 'never_existed' }
    }
    let issuance = null
    let agentId = null
    for (const [candidateId, candidate] of this.issuance) {
      if (candidate.discriminator === discriminatorNumber) { issuance = candidate; agentId = candidateId }
    }
    if (issuance === null || agentId === null) return { state: 'never_existed' }
    if (seq > issuance.maxIssuedTurnSeq) return { state: 'never_existed' }
    // Rule 11: compacted (fully evicted) generations resolve as `evicted`.
    if (generation <= issuance.evictedThroughGeneration) return { state: 'evicted', agentId }
    const evictedGenerationMax = issuance.evictedGenerations.get(generation)
    if (evictedGenerationMax !== undefined && seq <= evictedGenerationMax) return { state: 'evicted', agentId }
    const generationEntry = issuance.generations.get(generation)
    if (generationEntry === undefined || seq < generationEntry.minSeq || seq > generationEntry.maxSeq) {
      return { state: 'never_existed' }
    }
    if (seq <= issuance.evictedThroughTurnSeq || issuance.evictedSparseSeqs.has(seq)) {
      return { state: 'evicted', agentId }
    }
    const record = this.records.get(handle)
    if (record === undefined) return { state: 'evicted', agentId }
    return { state: this.recordQueryState(record), agentId, record }
  },

  /**
   * Non-consuming record query (C-018):
   *   {state:'pending'|'recovering'|'settled', snapshot} | {state:'evicted'|'restart_lost'|'never_existed'}
   */
  getTurnReconciliation(handle) {
    const classified = this.classifyHandle(handle)
    if (classified.record === undefined) return { state: classified.state }
    return { state: classified.state, snapshot: this.settledSnapshot(classified.record) }
  },

  /**
   * Non-consuming output query (C-018):
   *   available {text,truncated,originalBytes,terminalState}
   *   | pending | no_output {terminalState}
   *   | evicted | restart_lost | never_existed
   */
  readFinalAssistantOutput(handle) {
    const classified = this.classifyHandle(handle)
    if (classified.record === undefined) return { state: classified.state }
    const record = classified.record
    if (record.state !== 'settled') return { state: 'pending' }
    const terminalState = record.lateOutcome ?? record.outcome
    if (record.finalAssistantOutput === null || record.finalAssistantOutput === undefined) {
      return { state: 'no_output', terminalState }
    }
    return {
      state: 'available',
      text: record.finalAssistantOutput.text,
      truncated: record.finalAssistantOutput.truncated === true,
      originalBytes: record.finalAssistantOutput.originalBytes,
      terminalState,
    }
  },

  /**
   * Exact secondary index (C-010): the (occurrenceId, runId, requestId)
   * triple -> reconciliationHandle. Same triple + same handle rebind is
   * idempotent; same triple + different handle fails loud.
   */
  bindCallerCorrelation({ occurrenceId, runId, requestId }, handle) {
    const key = this.callerCorrelationKey({ occurrenceId, runId, requestId })
    const existing = this.correlationIndex.get(key)
    if (existing !== undefined) {
      if (existing !== handle) {
        throw Object.assign(new Error(`reconciliation: caller correlation (${occurrenceId},${runId},${requestId}) already bound to ${existing}, refusing rebind to ${handle}`), { code: 'RECONCILIATION_CORRELATION_CONFLICT' })
      }
      return handle
    }
    const bytes = correlationEntryByteSize(key, handle)
    const authorityBefore = this.snapshotAuthority()
    try {
      this.assertCorrelationCapacity(bytes, handle)
      this.correlationIndex.set(key, handle)
      this.correlationBytes += bytes
      this.globalBytes += bytes
      this.persistDurable()
      return handle
    } catch (error) {
      this.restoreAuthority(authorityBefore)
      throw error
    }
  },

  /**
   * Scheduler restart recovery query (C-018 / §13.2): exact triple ->
   * handle, or the absence semantics of the underlying record.
   */
  resolveCallerCorrelation({ occurrenceId, runId, requestId }) {
    const key = this.callerCorrelationKey({ occurrenceId, runId, requestId })
    const handle = this.correlationIndex.get(key)
    if (handle === undefined) return { state: 'never_existed' }
    const classified = this.classifyHandle(handle)
    if (classified.record === undefined) return { state: classified.state }
    return { state: classified.state, handle, snapshot: this.settledSnapshot(classified.record) }
  },

  /** At-most-once reconciliation notification subscriber (§13.2). */
  onTurnReconciled(listener) {
    if (typeof listener !== 'function') throw new TypeError('onTurnReconciled: listener function required')
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  },

  /** Test/ops: current store occupancy. */
  occupancy() {
    return {
      records: this.records.size,
      globalBytes: this.globalBytes,
      runtimeEpoch: this.runtimeEpoch,
    }
  },
}
