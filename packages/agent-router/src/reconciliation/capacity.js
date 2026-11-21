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
  MAX_ISSUANCE_GENERATIONS_PER_AGENT: 256,
  MAX_CORRELATION_INDEX_ENTRIES_GLOBAL: 8192,
  MAX_CORRELATION_KEY_BYTES: 1024,
  MAX_RUNTIME_EPOCHS: 256,
  MAX_ISSUANCE_AGENTS_GLOBAL: 8192,
  /** Bounded sparse set of evicted-but-non-contiguous turn sequences. */
  MAX_EVICTED_SPARSE_SEQS_PER_AGENT: 4096,
  /**
   * r9/r10 (#707): bounded count of HOT per-generation evicted issued-
   * intervals (the exact C-018 resolution data in evictedRanges). r10 adds
   * the versioned-retention path: when the hot budget approaches this cap,
   * the coldest resolved tuples move to the immutable archive (still
   * queryable — zero identity loss), so this cap never forces a resolution
   * failure in normal operation. The numeric backstop (64x the measured
   * production state of 256) fails LOUD at eviction/restore — never a
   * silent forgetting.
   */
  MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT: 16384,
  /**
   * r10 (#707): bounded ledger of PROVEN never-issued generations (no
   * issuance entry, no live record, a trace existing above the gap). Each
   * entry is one spawn-without-mint event or historical gap — one number
   * each, growing only on true skips; the fail-loud backstop stays far above
   * any realistic allocator behavior (production: 10).
   */
  MAX_NEVER_ISSUED_GENERATIONS_PER_AGENT: 4096,
  /**
   * r10 (#707): hot interval budget before the compaction moves the coldest
   * fully-resolved tuples into the immutable, still-queryable archive — the
   * versioned-retention answer to long-term liveness (exact facts retained
   * at O(bytes) cost, never dropped).
   */
  ARCHIVE_TRIGGER_INTERVALS: 12288,
  /** r10 (#707): per-compaction archive batch (whole tuples, oldest first). */
  ARCHIVE_BATCH_INTERVALS: 4096,
})

export const REQUIRED_RECORD_EVIDENCE_HEADROOM_BYTES = 1048576 + 65536

export class ReconciliationCapacityError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ReconciliationCapacityError'
    this.code = 'RECONCILIATION_CAPACITY_EXHAUSTED'
  }
}

function ownedValueBytes(value) {
  if (value === null || value === undefined) return 4
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8') + 2
  if (typeof value === 'number' || typeof value === 'boolean') return Buffer.byteLength(String(value), 'utf8')
  if (Array.isArray(value)) return 2 + Math.max(0, value.length - 1)
    + value.reduce((total, item) => total + ownedValueBytes(item), 0)
  let total = 2
  let fields = 0
  for (const [key, item] of Object.entries(value)) {
    if (key === 'bytes' || key === 'reservedMandatoryBytes') continue
    total += (fields > 0 ? 1 : 0) + Buffer.byteLength(key, 'utf8') + 3 + ownedValueBytes(item)
    fields += 1
  }
  return total
}

export function recordByteSize(record) {
  // Complete owned-state accounting uses actual retained UTF-8 leaf bytes,
  // not JSON wire escaping. Structural keys/separators count explicitly.
  return ownedValueBytes(record) + (record.reservedMandatoryBytes ?? 0)
}

export function correlationEntryByteSize(key, handle) {
  return ownedValueBytes([key, handle])
}
