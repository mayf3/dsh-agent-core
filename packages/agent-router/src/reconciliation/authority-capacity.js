/** Capacity, eviction and transactional mutation methods for the V3 reconciliation store. */
import {
  correlationEntryByteSize, RECONCILIATION_CAPS, ReconciliationCapacityError, recordByteSize,
} from './capacity.js'

export const authorityCapacityMethods = {
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
  },

  canEvictRecord(record) {
    const issuance = this.issuance.get(record.agentId)
    const generationEntry = issuance?.generations.get(record.processGeneration)
    if (issuance === undefined || generationEntry === undefined || generationEntry.liveRecords > 1) return true
    return record.processGeneration === issuance.evictedThroughGeneration + 1
      || issuance.evictedGenerations.has(record.processGeneration)
      || issuance.evictedGenerations.size < RECONCILIATION_CAPS.MAX_ISSUANCE_GENERATIONS_PER_AGENT
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
