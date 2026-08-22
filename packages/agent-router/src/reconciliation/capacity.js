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
  /** Bounded sparse set of evicted-but-non-contiguous turn sequences. */
  MAX_EVICTED_SPARSE_SEQS_PER_AGENT: 4096,
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
