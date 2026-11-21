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
      evictedRanges: entry.evictedRanges.map(range => [range[0], range[1], range[2].map(slot => slot.map(interval => [...interval]))]),
      neverIssuedGenerations: new Set(entry.neverIssuedGenerations),
      generations: new Map([...entry.generations].map(([generation, value]) => [generation, {
        ...value,
        issuedIntervals: (value.issuedIntervals ?? [[value.minSeq, value.maxSeq]]).map(interval => [...interval]),
      }])),
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
   * RECONCILIATION_ABANDONED_EVICTION_V1 r7 (#707): the walk SKIPS absent
   * (never-issued) generations instead of blocking on them; r10 ends with
   * the absence/forward compaction so capacity recovery stays exact AND
   * zero-growth long-term.
   */
  evictSettledGenerationForCapacity(agentId, issuance) {
    // One pass over the agent's records (r11: the per-generation filter
    // inside the generation loop made the walk O(entries x records) —
    // quadratic at the 10k-generation scale the retention contract must
    // survive).
    const recordsByGeneration = new Map()
    for (const record of this.records.values()) {
      if (record.agentId !== agentId) continue
      const list = recordsByGeneration.get(record.processGeneration)
      if (list === undefined) recordsByGeneration.set(record.processGeneration, [record])
      else list.push(record)
    }
    const sorted = [...issuance.generations.entries()].sort((a, b) => a[0] - b[0])
    for (const [generation, entry] of sorted) {
      if (generation <= issuance.evictedThroughGeneration) continue
      const recs = recordsByGeneration.get(generation) ?? []
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
    this.compactIssuanceWatermarks(agentId, issuance)
  },

  /**
   * r10 (#707): honest watermark compaction across PROVEN absence.
   *
   * The historical gaps (production: never-issued 35-37 + 43-49) permanently
   * blocked `evictedThroughGeneration` at 34, forcing every future eviction
   * into non-contiguous bounds entries — unbounded growth (QA P1). The
   * compaction instead PROVES absence from the store's own invariants: a
   * generation above the watermark with NO issuance entry and NO live record
   * was never issued (every full eviction leaves a durable issuance trace —
   * entry, range, or watermark). Proven-absent generations go into the
   * `neverIssuedGenerations` ledger and classify `never_existed` forever
   * (the identity fact is kept, never fabricated — this is what the
   * rejected r7 watermark-merge lacked); genuinely issued+evicted spans
   * cascade into the watermark; permanent pins (fences) stop the LOW span.
   *
   * The HIGH span mirrors this ABOVE the highest pinned generation
   * Versioned retention (the QA P1 answer): the hot interval budget never
   * exhausts — the coldest fully-resolved tuples move to the immutable,
   * still-queryable `evictedArchives` (exact facts retained at O(bytes)
   * cost, never dropped), so the system runs indefinitely with ZERO identity
   * loss. Ledger growth is one entry per proven-absent generation
   * (spawn-without-mint events), bounded fail-loud by
   * MAX_NEVER_ISSUED_GENERATIONS_PER_AGENT.
   */
  compactIssuanceWatermarks(agentId, issuance) {
    const liveGenerations = new Set()
    for (const record of this.records.values()) {
      if (record.agentId === agentId) liveGenerations.add(record.processGeneration)
    }
    // Proven-absent prefix: a generation above the watermark with no entry,
    // no live record, and an issuance trace ABOVE it was never issued (every
    // full eviction leaves a durable trace). Ledger it and advance — the
    // ledger answers `never_existed` forever, so the watermark never widens
    // a gap generation into a fabricated `evicted` (the rejected r7
    // watermark-merge lacked exactly this). The watermark stops at the first
    // REAL span: from there the evictedRanges carry the EXACT per-generation
    // intervals, and gaps BETWEEN ranges need no ledger (the fall-through
    // already answers never_existed for uncovered generations).
    const highestTrace = () => {
      let highest = issuance.evictedThroughGeneration
      for (const generation of issuance.generations.keys()) {
        if (generation > highest) highest = generation
      }
      for (const range of issuance.evictedRanges) {
        if (range[1] > highest) highest = range[1]
      }
      for (const archive of issuance.evictedArchives) {
        if (archive[1] > highest) highest = archive[1]
      }
      return highest
    }
    while (true) {
      const next = issuance.evictedThroughGeneration + 1
      // A range-covered generation is RESOLVED-ISSUED (exact intervals live
      // there) — the watermark stops at the first real span; only a gap with
      // no entry, no record, no coverage, and a trace above it is provably
      // never-issued.
      const covered = issuance.evictedRanges.some(tuple => next >= tuple[0] && next <= tuple[1])
        || (issuance.evictedArchives ?? []).some(tuple => next >= tuple[0] && next <= tuple[1])
      if (issuance.generations.has(next) || liveGenerations.has(next) || covered || highestTrace() < next) break
      if (issuance.neverIssuedGenerations.size >= RECONCILIATION_CAPS.MAX_NEVER_ISSUED_GENERATIONS_PER_AGENT) {
        throw new ReconciliationCapacityError(
          `reconciliation: never-issued generation ledger exhausted (${RECONCILIATION_CAPS.MAX_NEVER_ISSUED_GENERATIONS_PER_AGENT})`,
        )
      }
      issuance.neverIssuedGenerations.add(next)
      issuance.evictedThroughGeneration = next
    }
    // Versioned retention (QA P1): keep the HOT interval budget from ever
    // exhausting by moving the coldest fully-resolved tuples into the
    // immutable archive. The archive stays queryable forever (classify
    // falls back to it) — exact facts are retained at O(bytes) cost, never
    // dropped: the system runs indefinitely with ZERO identity loss.
    const hotIntervals = () => issuance.evictedRanges.reduce((total, tuple) => total
      + tuple[2].reduce((slotTotal, slot) => slotTotal + slot.length, 0), 0)
    // Archive WHOLE BATCHES until the hot budget is back under the trigger
    // (one batch per pass would leave hot above the trigger for many walks).
    const archivedIntervals = () => issuance.evictedArchives.reduce((total, tuple) => total
      + tuple[2].reduce((slotTotal, slot) => slotTotal + slot.length, 0), 0)
    while (hotIntervals() > RECONCILIATION_CAPS.ARCHIVE_TRIGGER_INTERVALS && issuance.evictedRanges.length > 0) {
      // r11 (QA P1): EVERY coldest tuple is archivable — pins no longer
      // block retention (the r10 pin-proximity guard starved the archive
      // behind the permanent fences and let hot re-accumulate to the cap).
      // The archive is exact + queryable, so coldness is purely a budget
      // question; the archive itself is bounded by its own fail-loud cap
      // (the operator rotation horizon, spec §0r6).
      if (archivedIntervals() > RECONCILIATION_CAPS.MAX_ARCHIVE_INTERVALS_PER_AGENT) {
        throw new ReconciliationCapacityError(
          `reconciliation: archived resolution intervals exhausted (${RECONCILIATION_CAPS.MAX_ARCHIVE_INTERVALS_PER_AGENT})`,
        )
      }
      let batch = 0
      while (issuance.evictedRanges.length > 0 && batch < RECONCILIATION_CAPS.ARCHIVE_BATCH_INTERVALS) {
        batch += issuance.evictedRanges[0][2].reduce((total, slot) => total + slot.length, 0)
        issuance.evictedArchives.push(issuance.evictedRanges.shift())
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
          this.markGenerationEvicted(issuance, record.processGeneration, generationEntry)
        }
      }
    }
  },

  /**
   * r10 (#707): disjoint evictedRanges metadata compression carrying EXACT
   * per-generation ISSUED INTERVALS. A fully-evicted generation EITHER
   * advances the contiguous `evictedThroughGeneration` watermark (cascading
   * across any range that now touches it) OR merges into the sorted,
   * disjoint, NON-ADJACENT `evictedRanges` list of
   * `[startGeneration, endGeneration, perGenBounds]` tuples, where
   * `perGenBounds[i]` is the sorted list of DISJOINT issued intervals
   * (`[minSeq, maxSeq]`, unioned across re-issuance incarnations) of
   * generation `startGeneration + i`. Under the durable disjointness
   * invariant (overlapping live intervals fail the persist — the T8 rule)
   * an incarnation's [minSeq, maxSeq] is dense, so the interval union is
   * EXACTLY the set of turn seqs that generation ever issued: a never-minted
   * `(gen, seq)` classifies `never_existed` — including the interior holes
   * the r9 upper-bound-only representation widened (QA P0: g11:s1, g10:s3).
   * Legacy-pair migration maps each generation to `[[1, maxSeq]]` — the
   * honest no-lower-bound-evidence representation with identical legacy
   * predicate fidelity (disclosed, not fabricated).
   *
   * Non-adjacent merging is the soundness core: a range only ever spans
   * CONSECUTIVE genuinely-evicted generations, so it never covers a
   * never-issued generation — those go to the never-issued ledger and stay
   * `never_existed` forever (compactIssuanceWatermarks). One tuple bounds
   * arbitrarily many generations, so the issuance metadata cap
   * (`generations.size + evictedRanges.length`) stops leaking with history
   * depth; the interval count is bounded separately
   * (MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT) and fails LOUD — never a
   * silent forgetting. Long-term: intervals only accumulate BETWEEN
   * permanent pins (bounded by the live-record cap); above the highest pin
   * the forward watermark advances contiguously (zero growth).
   */
  markGenerationEvicted(issuance, generation, generationEntry) {
    // r10: NO watermark cascade — the exact per-generation intervals are
    // ALWAYS kept (the r8/r9 lesson: any seq-blind widening fabricates
    // identities). The watermark advances only across LEDGERED proven
    // absence (compactIssuanceWatermarks); the issuance metadata cap now
    // counts LIVE generations only, so keeping every interval costs no
    // capacity.
    const ranges = issuance.evictedRanges
    // Scan for every generation-adjacent (or covering — a re-eviction of a
    // re-minted generation already inside a range) range around the
    // singleton, capturing the RANGE OBJECTS (indexes would go stale once we
    // splice). Absorbed ranges plus the singleton always form a contiguous
    // union [start, end].
    let index = 0
    let start = generation
    let end = generation
    const absorbed = []
    while (index < ranges.length && ranges[index][0] <= end + 1) {
      if (ranges[index][1] + 1 >= start) {
        absorbed.push(ranges[index])
        start = Math.min(start, ranges[index][0])
        end = Math.max(end, ranges[index][1])
      }
      index += 1
    }
    const intervalCount = ranges => ranges.reduce((total, range) => total
      + range[2].reduce((slotTotal, slot) => slotTotal + slot.length, 0), 0)
    const absorbedIntervals = intervalCount(absorbed)
    const covering = absorbed.some(range => range[0] <= generation && generation <= range[1])
    // Net interval count: absorbed spans collapse into ONE array and the
    // singleton's interval either UNION-merges into its own slot
    // (re-eviction of a re-minted generation — the slot already covers or
    // touches it, so the count cannot grow) or fills a new slot (+1).
    const intervalsAfter = intervalCount(ranges) - absorbedIntervals + (covering ? 0 : 1)
    if (intervalsAfter > RECONCILIATION_CAPS.MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT) {
      throw new ReconciliationCapacityError(
        `reconciliation: evicted-generation resolution intervals exhausted for issuance metadata (${RECONCILIATION_CAPS.MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT})`,
      )
    }
    // r11 (QA blocker 3): the budget gate precedes EVERY mutation — a throw
    // after generations.delete/records.delete leaves a trace-less genuinely-
    // issued generation that the next compaction would fabricate into the
    // never-issued ledger. Fail loud on the UNTOUCHED state; the caller's
    // transactional snapshot rolls the eviction back cleanly.
    issuance.generations.delete(generation)
    // Compose the per-generation bounds array slot-by-slot: each absorbed
    // range restores its own slots, then the singleton slot UNION-merges the
    // generation's EXACT issued intervals (r11: copied from the generation
    // entry — never fabricated from min/max spans; interleaved same-
    // generation issuance keeps its interior holes) with whatever the slot
    // already holds (re-eviction of a re-minted generation).
    const bounds = new Array(end - start + 1)
    for (const range of absorbed) {
      for (let offset = 0; offset < range[2].length; offset++) {
        bounds[range[0] - start + offset] = range[2][offset]
      }
    }
    const slotIndex = generation - start
    const merged = (generationEntry.issuedIntervals ?? [[generationEntry.minSeq, generationEntry.maxSeq]])
      .map(interval => [...interval])
    for (const [lo, hi] of bounds[slotIndex] ?? []) merged.push([lo, hi])
    merged.sort((a, b) => a[0] - b[0])
    const unioned = []
    for (const [lo, hi] of merged) {
      const last = unioned[unioned.length - 1]
      if (last !== undefined && lo <= last[1] + 1) last[1] = Math.max(last[1], hi)
      else unioned.push([lo, hi])
    }
    bounds[slotIndex] = unioned
    // Remove the absorbed ranges by identity, then insert at the scan's
    // sorted position (all ranges before `index` that were not absorbed lie
    // strictly below; all from `index` lie strictly above the merged span).
    for (const range of absorbed) ranges.splice(ranges.indexOf(range), 1)
    ranges.splice(index - absorbed.length, 0, [start, end, bounds])
  },

  canEvictRecord(record) {
    const issuance = this.issuance.get(record.agentId)
    const generationEntry = issuance?.generations.get(record.processGeneration)
    if (issuance === undefined || generationEntry === undefined || generationEntry.liveRecords > 1) return true
    const hotIntervals = issuance.evictedRanges.reduce((total, tuple) => total
      + tuple[2].reduce((slotTotal, slot) => slotTotal + slot.length, 0), 0)
    return record.processGeneration === issuance.evictedThroughGeneration + 1
      || issuance.evictedRanges.some(range => record.processGeneration >= range[0] && record.processGeneration <= range[1])
      || hotIntervals < RECONCILIATION_CAPS.MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT
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
          this.markGenerationEvicted(issuance, record.processGeneration, generationEntry)
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
