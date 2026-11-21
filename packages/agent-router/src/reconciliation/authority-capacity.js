/** Capacity, eviction and transactional mutation methods for the V3 reconciliation store. */
import {
  correlationEntryByteSize, RECONCILIATION_CAPS, ReconciliationCapacityError, recordByteSize,
} from './capacity.js'
import { hasAcceptanceAudit } from './admin-abandonment.js'

export const authorityCapacityMethods = {
  snapshotAuthority() {
    const issuance = new Map([...this.issuance].map(([agentId, entry]) => [agentId, {
      ...entry,
      evictedSparseSeqs: new Set(entry.evictedSparseSeqs),
      evictedRanges: entry.evictedRanges.map(range => [...range]),
      generations: new Map([...entry.generations].map(([generation, value]) => [generation, { ...value }])),
    }]))
    return {
      records: new Map(this.records), issuance, correlationIndex: new Map(this.correlationIndex),
      globalBytes: this.globalBytes, agentCounts: new Map(this.agentCounts), agentBytes: new Map(this.agentBytes),
      correlationBytes: this.correlationBytes, discriminatorSeq: this.discriminatorSeq,
    }
  },

  restoreAuthority(snapshot) {
    this.records = snapshot.records
    this.issuance = snapshot.issuance
    this.correlationIndex = snapshot.correlationIndex
    this.globalBytes = snapshot.globalBytes
    this.agentCounts = snapshot.agentCounts
    this.agentBytes = snapshot.agentBytes
    this.correlationBytes = snapshot.correlationBytes
    this.discriminatorSeq = snapshot.discriminatorSeq
  },

  assertCorrelationCapacity(additionalBytes = 0, excludeHandle = null) {
    while (this.correlationIndex.size >= RECONCILIATION_CAPS.MAX_CORRELATION_INDEX_ENTRIES_GLOBAL
        || this.globalBytes + additionalBytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) {
      const candidate = [...this.correlationIndex.values()]
        .map(handle => this.records.get(handle))
        .find(record => record?.state === 'settled' && record.handle !== excludeHandle && this.canEvictRecord(record))
      if (candidate === undefined) break
      this.evictRecord(candidate)
    }
    if (this.correlationIndex.size >= RECONCILIATION_CAPS.MAX_CORRELATION_INDEX_ENTRIES_GLOBAL
        || this.globalBytes + additionalBytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) {
      throw new ReconciliationCapacityError('reconciliation: caller correlation index capacity exhausted')
    }
  },

  compactRuntimeEpochs() {
    const required = new Set([this.runtimeEpoch, ...[...this.records.values()].map(record => record.runtimeEpoch)])
    // RECONCILIATION_ABANDONED_EVICTION_V1 r3 (#707 review blocker): epochs
    // referenced by correlation no-replay tombstones are REQUIRED — dropping
    // one would turn its tombstone into an orphan at the next restore
    // (startup brick, the exact failure the round-4 review probe proved).
    // Tombstone epochs are bounded by the live tombstones themselves (each
    // boot's tombstones share one epoch); the pathological multi-thousand-
    // epoch case stays fail-loud via the cap check below, never a silent
    // brick.
    for (const handle of this.correlationIndex.values()) {
      const epochMatch = /^turn:([^:]+):/.exec(handle)
      if (epochMatch !== null) required.add(epochMatch[1])
    }
    if (required.size > RECONCILIATION_CAPS.MAX_RUNTIME_EPOCHS) {
      throw new ReconciliationCapacityError('reconciliation: live runtime epoch capacity exhausted')
    }
    const historical = [...this.runtimeEpochs].reverse()
    this.runtimeEpochs = new Set(required)
    for (const epoch of historical) {
      if (this.runtimeEpochs.size >= RECONCILIATION_CAPS.MAX_RUNTIME_EPOCHS) break
      this.runtimeEpochs.add(epoch)
    }
  },

  validateRestoredAuthority() {
    for (const record of this.records.values()) {
      const match = record.handle.match(/^turn:([^:]+):a(\d+):g(\d+):s(\d+)$/)
      const issuance = this.issuance.get(record.agentId)
      const generation = issuance?.generations.get(record.processGeneration)
      if (match === null || match[1] !== record.runtimeEpoch
          || Number(match[2]) !== issuance?.discriminator
          || Number(match[3]) !== record.processGeneration || Number(match[4]) !== record.turnSeq
          || generation === undefined || record.turnSeq < generation.minSeq || record.turnSeq > generation.maxSeq) {
        throw new ReconciliationCapacityError('reconciliation: restored record authority mismatch')
      }
      if (record.callerCorrelation !== null && record.callerCorrelation !== undefined) {
        const key = this.callerCorrelationKey(record.callerCorrelation)
        if (this.correlationIndex.get(key) !== record.handle) {
          throw new ReconciliationCapacityError('reconciliation: restored caller correlation authority mismatch')
        }
      }
    }
  },

  /**
   * #707 (RECONCILIATION_ABANDONED_EVICTION_V1): walk the contiguous settled
   * prefix, evicting each fully-resolved generation — settled records AND
   * declaration-abandoned records (adminAbandonment marker = the owner's
   * audited decision that the turn never settles: the outcome stays UNKNOWN
   * and resolves as `evicted` through the watermarks below, never as a
   * business settled). Without the abandoned arm, one never-settling record
   * permanently pins its generation entry and the agent deadlocks at
   * MAX_ISSUANCE_GENERATIONS_PER_AGENT (measured 256-cap lockout, #707).
   * Iterates the contiguous prefix (progress-guarded) so one
   * call frees every releasable generation, not just the first.
   */
  /**
   * r2 (#707 review blocker 2): whether an absent record's handle resolves as
   * legally evicted via the issuance watermarks (contiguous watermark or the
   * bounded sparse set). Used by recountCapacity to keep correlation
   * tombstones legal across restarts.
   */
  handleResolvesEvicted(handle) {
    const match = typeof handle === 'string' ? handle.match(/^turn:([^:]+):a(\d+):g(\d+):s(\d+)$/) : null
    if (match === null) return false
    // r2 tightening (review non-blocking 2): the handle's epoch must belong
    // to this store's known runtime epochs — a foreign-epoch handle never
    // resolves via this store's watermarks.
    if (!this.runtimeEpochs.has(match[1])) return false
    const seq = Number.parseInt(match[4], 10)
    if (!Number.isSafeInteger(seq)) return false
    for (const issuance of this.issuance.values()) {
      if (seq <= issuance.evictedThroughTurnSeq || issuance.evictedSparseSeqs.has(seq)) return true
    }
    return false
  },

  /**
   * RECONCILIATION_ABANDONED_EVICTION_V1 r7 (#707): the prefix walk SKIPS
   * absent (never-issued) generations instead of blocking on them.
   */
  evictSettledGenerationForCapacity(agentId, issuance) {
    const sorted = [...issuance.generations.entries()].sort((a, b) => a[0] - b[0])
    for (const [generation, entry] of sorted) {
      if (generation <= issuance.evictedThroughGeneration) continue
      const recs = [...this.records.values()].filter(r => r.agentId === agentId && r.processGeneration === generation)
      if (recs.length === 0) continue
      // P0 security gate (#707 QA round-6): every record must be either
      // settled OR (marker + D6 acceptance audit) for the generation to be
      // releasable. Marker-only records keep the generation pinned.
      const allReleasable = recs.every(r =>
        r.state === 'settled' ||
        ((r.adminAbandonment ?? null) !== null && hasAcceptanceAudit(r)))
      if (!allReleasable) continue
      for (const record of recs) {
        if (record.state === 'settled') {
          this.evictRecord(record)
        } else {
          this.evictAbandonedRecordPreserveCorrelation(record)
        }
      }
    }
  },

  /**
   * r2 (#707 review blocker 2): abandoned-record eviction that PRESERVES the
   * caller-correlation index entry as a durable no-replay tombstone. Mirrors
   * evictRecord's bookkeeping except the correlation cleanup: the entry keeps
   * resolving (RECONCILIATION_CORRELATION_CONFLICT on any re-mint) while the
   * record itself resolves as `evicted` through the watermarks.
   */
  evictAbandonedRecordPreserveCorrelation(record) {
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
          const oldest = issuance.evictedSparseSeqs.values().next().value
          issuance.evictedSparseSeqs.delete(oldest)
        }
      }
      const generationEntry = issuance.generations.get(record.processGeneration)
      if (generationEntry !== undefined) {
        generationEntry.liveRecords -= 1
        if (generationEntry.liveRecords <= 0) {
          this.markGenerationEvicted(issuance, record.processGeneration, generationEntry.maxSeq)
        }
      }
    }
  },

  /**
   * r8 (#707): disjoint evictedRanges metadata compression. A fully-evicted
   * generation EITHER advances the contiguous `evictedThroughGeneration`
   * watermark (cascading across any range that now touches it) OR merges into
   * the sorted, disjoint, NON-ADJACENT `evictedRanges` list
   * ([startGeneration, endGeneration, maxSeq] tuples — maxSeq is the max
   * eviction-time turn-seq of every generation merged into the range, the
   * per-handle `evicted` resolution bound in query.js). Non-adjacent merging
   * is the soundness core: a range only ever spans CONSECUTIVE
   * genuinely-evicted generations, so it never covers a never-issued
   * generation and `never_existed` verdicts are preserved exactly (the
   * rejected watermark-merge candidate claimed absent generations as evicted —
   * ranges never do). One range bounds unboundedly many generations, so the
   * issuance metadata cap (`generations.size + evictedRanges.length`) stops
   * leaking with history depth — the measured #707 256-cap lockout,
   * where per-generation map entries moved 1:1 between the live map
   * and the evicted map, leaving the sum invariant and the deadlock intact.
   */
  markGenerationEvicted(issuance, generation, maxSeq) {
    issuance.generations.delete(generation)
    if (generation === issuance.evictedThroughGeneration + 1) {
      issuance.evictedThroughGeneration = generation
      while (issuance.evictedRanges.length > 0
          && issuance.evictedRanges[0][0] === issuance.evictedThroughGeneration + 1) {
        issuance.evictedThroughGeneration = issuance.evictedRanges[0][1]
        issuance.evictedRanges.shift()
      }
      return
    }
    const ranges = issuance.evictedRanges
    let merged = [generation, generation, maxSeq]
    let index = 0
    while (index < ranges.length && ranges[index][0] <= merged[1] + 1) {
      if (ranges[index][1] + 1 >= merged[0]) {
        merged = [
          Math.min(ranges[index][0], merged[0]),
          Math.max(ranges[index][1], merged[1]),
          Math.max(ranges[index][2], merged[2]),
        ]
        ranges.splice(index, 1)
      } else {
        index += 1
      }
    }
    ranges.splice(index, 0, merged)
  },

  canEvictRecord(record) {
    const issuance = this.issuance.get(record.agentId)
    const generationEntry = issuance?.generations.get(record.processGeneration)
    if (issuance === undefined || generationEntry === undefined || generationEntry.liveRecords > 1) return true
    return record.processGeneration === issuance.evictedThroughGeneration + 1
      || issuance.evictedRanges.some(range => record.processGeneration >= range[0] && record.processGeneration <= range[1])
      || issuance.evictedRanges.length < RECONCILIATION_CAPS.MAX_ISSUANCE_GENERATIONS_PER_AGENT
  },

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
  },

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
  },

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
  },

  evictRecord(record) {
    if (!this.canEvictRecord(record)) {
      throw new ReconciliationCapacityError(`reconciliation: evicting ${record.handle} would exceed issuance metadata cap`)
    }
    this.records.delete(record.handle)
    this.globalBytes -= record.bytes
    this.agentCounts.set(record.agentId, (this.agentCounts.get(record.agentId) ?? 1) - 1)
    this.agentBytes.set(record.agentId, (this.agentBytes.get(record.agentId) ?? record.bytes) - record.bytes)
    for (const [key, handle] of [...this.correlationIndex]) {
      if (handle !== record.handle) continue
      const bytes = correlationEntryByteSize(key, handle)
      this.correlationIndex.delete(key)
      this.correlationBytes -= bytes
      this.globalBytes -= bytes
    }
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
          this.markGenerationEvicted(issuance, record.processGeneration, generationEntry.maxSeq)
        }
      }
    }
  },

  clampOptionalEvidence(candidate, record) {
    const agentBytes = this.agentBytes.get(record.agentId) ?? 0
    const initialBytes = recordByteSize(candidate)
    const initialDelta = initialBytes - record.bytes
    if (initialBytes <= RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORD_BYTES
        && agentBytes + initialDelta <= RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT
        && this.globalBytes + initialDelta <= RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) return
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
  },

  mutateRecord(record, mutate, { resolveGeneration = false } = {}) {
    const recordBefore = structuredClone(record)
    const generationEntry = this.issuance.get(record.agentId)?.generations.get(record.processGeneration)
    const unresolvedBefore = generationEntry?.unresolvedCount
    let authorityBefore = null
    const candidate = structuredClone(record)
    mutate(candidate)
    candidate.updatedAt = Date.now()
    this.clampOptionalEvidence(candidate, record)
    const bytes = recordByteSize(candidate)
    if (bytes > RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORD_BYTES) {
      throw new ReconciliationCapacityError(`reconciliation: record ${record.handle} exceeds per-record byte cap`)
    }
    const delta = bytes - record.bytes
    const evictionNeeded = delta > 0
      && ((this.agentBytes.get(record.agentId) ?? 0) + delta > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT
        || this.globalBytes + delta > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL)
    if (evictionNeeded) {
      authorityBefore = this.snapshotAuthority()
      this.evictResolvedForByteCapacity(record.agentId, delta, record.handle)
    }
    if ((this.agentBytes.get(record.agentId) ?? 0) + delta > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_PER_AGENT
        || this.globalBytes + delta > RECONCILIATION_CAPS.MAX_RECONCILIATION_BYTES_GLOBAL) {
      if (authorityBefore !== null) this.restoreAuthority(authorityBefore)
      throw new ReconciliationCapacityError(`reconciliation: mutation byte capacity exhausted for ${record.handle}`)
    }
    try {
      const before = record.bytes
      Object.assign(record, candidate, { bytes })
      this.globalBytes += bytes - before
      this.agentBytes.set(record.agentId, (this.agentBytes.get(record.agentId) ?? before) + bytes - before)
      if (resolveGeneration && generationEntry !== undefined) {
        generationEntry.unresolvedCount = Math.max(0, generationEntry.unresolvedCount - 1)
      }
      this.persistDurable()
      return record
    } catch (error) {
      if (authorityBefore !== null) {
        this.restoreAuthority(authorityBefore)
        this.records.set(recordBefore.handle, recordBefore)
      } else {
        for (const key of Object.keys(record)) delete record[key]
        Object.assign(record, recordBefore)
        this.records.set(record.handle, record)
        this.globalBytes -= bytes - recordBefore.bytes
        this.agentBytes.set(record.agentId, (this.agentBytes.get(record.agentId) ?? bytes) - (bytes - recordBefore.bytes))
        if (generationEntry !== undefined && unresolvedBefore !== undefined) {
          generationEntry.unresolvedCount = unresolvedBefore
        }
      }
      throw error
    }
  },

  retally(record) {
    const before = record.bytes
    record.bytes = recordByteSize(record)
    this.globalBytes += record.bytes - before
    this.agentBytes.set(record.agentId, (this.agentBytes.get(record.agentId) ?? before) + record.bytes - before)
  },
}
