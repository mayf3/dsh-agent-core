/**
 * @agent-core/agent-router/src/reconciliation/query.js — the non-consuming
 * query surface of the Router reconciliation store
 * (AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-018).
 *
 * These methods compose onto TurnReconciliationStore.prototype (store.js).
 * All reads are non-consuming, repeatable and idempotent — a read never
 * deletes a record, never advances state and never changes the result of a
 * later read. Handle identity classification (restart_lost / evicted /
 * never_existed) resolves against the issuance metadata of the CURRENT
 * runtime epoch; this Spec promises no disk persistence across
 * control-plane restarts.
 */

export const queryMethods = {
  settledSnapshot(record) {
    return {
      handle: record.handle,
      state: record.state,
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
      deadlineAtWallMs: record.deadlineAtWallMs,
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
    if (epoch !== this.runtimeEpoch) return { state: 'restart_lost' }
    const discriminatorNumber = Number.parseInt(discriminator, 10)
    const generation = Number.parseInt(generationRaw, 10)
    const seq = Number.parseInt(seqRaw, 10)
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
    return { state: record.state, agentId, record }
  },

  /**
   * Non-consuming record query (C-018):
   *   {state:'pending'|'settled', snapshot} | {state:'evicted'|'restart_lost'|'never_existed'}
   */
  getTurnReconciliation(handle) {
    const classified = this.classifyHandle(handle)
    if (classified.record === undefined) return { state: classified.state }
    return { state: classified.record.state, snapshot: this.settledSnapshot(classified.record) }
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
    const terminalState = record.state === 'settled' ? (record.lateOutcome ?? record.outcome) : (record.initialOutcome ?? 'pending')
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
    const key = `${occurrenceId ?? ''}\u0000${runId ?? ''}\u0000${requestId ?? ''}`
    const existing = this.correlationIndex.get(key)
    if (existing !== undefined) {
      if (existing !== handle) {
        throw Object.assign(new Error(`reconciliation: caller correlation (${occurrenceId},${runId},${requestId}) already bound to ${existing}, refusing rebind to ${handle}`), { code: 'RECONCILIATION_CORRELATION_CONFLICT' })
      }
      return handle
    }
    this.correlationIndex.set(key, handle)
    return handle
  },

  /**
   * Scheduler restart recovery query (C-018 / §13.2): exact triple ->
   * handle, or the absence semantics of the underlying record.
   */
  resolveCallerCorrelation({ occurrenceId, runId, requestId }) {
    const key = `${occurrenceId ?? ''}\u0000${runId ?? ''}\u0000${requestId ?? ''}`
    const handle = this.correlationIndex.get(key)
    if (handle === undefined) return { state: 'never_existed' }
    const classified = this.classifyHandle(handle)
    if (classified.record === undefined) return { state: classified.state }
    return { state: classified.record.state, handle, snapshot: this.settledSnapshot(classified.record) }
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
