/**
 * @agent-core/agent-router/src/reconciliation/capacity.js — reconciliation
 * capacity ceilings and byte accounting of AGENT_PROCESS_LIFECYCLE_HARDENING_V2
 * (CLAUSE-PROC-BOUNDED reconciliation caps + rule 8 admission discipline).
 *
 * Admission capacity is enforced fail-loud BEFORE reservation: when caps
 * cannot be satisfied by evicting resolved records, new prompt admission
 * fails loud (RECONCILIATION_CAPACITY_EXHAUSTED) — evidence is never dropped
 * after the fact, and unresolved records are never evictable.
 */

/** CLAUSE-PROC-BOUNDED reconciliation safety ceilings (frozen). */
export const RECONCILIATION_CAPS = Object.freeze({
  MAX_RECONCILIATION_RECORD_BYTES: 1179648,
  MAX_RECONCILIATION_RECORDS_PER_AGENT: 256,
  MAX_RECONCILIATION_BYTES_PER_AGENT: 33554432,
  MAX_RECONCILIATION_RECORDS_GLOBAL: 8192,
  MAX_RECONCILIATION_BYTES_GLOBAL: 268435456,
  MAX_RECONCILIATION_AUDIT_ENTRIES_PER_RECORD: 32,
  MAX_RECONCILIATION_AUDIT_BYTES_PER_RECORD: 65536,
  /** Bounded sparse set of evicted-but-non-contiguous turn sequences. */
  MAX_EVICTED_SPARSE_SEQS_PER_AGENT: 4096,
})

export class ReconciliationCapacityError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ReconciliationCapacityError'
    this.code = 'RECONCILIATION_CAPACITY_EXHAUSTED'
  }
}

export function recordByteSize(record) {
  // Rule 3: metadata + caller correlation + audit + output bytes — no
  // shallow object-count evasion.
  return Buffer.byteLength(JSON.stringify({
    handle: record.handle,
    agentId: record.agentId,
    processGeneration: record.processGeneration,
    turnSeq: record.turnSeq,
    sessionId: record.sessionId,
    callerCorrelation: record.callerCorrelation,
    initialOutcome: record.initialOutcome,
    initialSource: record.initialSource,
    outcome: record.outcome,
    lateOutcome: record.lateOutcome,
    outcomeEvidence: record.outcomeEvidence,
    terminationEvidence: record.terminationEvidence,
    messageId: record.messageId,
    deadlineAtWallMs: record.deadlineAtWallMs,
    settledAtWallMs: record.settledAtWallMs,
    cancelRequested: record.cancelRequested,
    cancelRequestedAtWallMs: record.cancelRequestedAtWallMs,
    finalAssistantOutput: record.finalAssistantOutput,
    audit: record.audit,
  }), 'utf8')
}
