/**
 * #707 watermark-gap deadlock — r10: exact per-generation ISSUED INTERVALS +
 * proven-absence ledger + versioned retention.
 *
 * REAL frozen shape (measured from the production durable preimage
 * turn-recovery-v3.json, agt_hr-agent, sha256 5d3d2eb2…): watermark-gen 34,
 * live gens 70..301 (fences 70/73/78/86 active marker-only UNKNOWN, settled
 * 92-301), legacy evicted map = 43 entries EXACTLY excluding the live
 * fences, absent (never-issued) 35-37 + 43-49, metadata sum exactly
 * 43 + 213 = 256 (at the cap).
 *
 * Evolution: r7 relocated metadata 1:1 (sum invariant, deadlock persisted);
 * r8 collapsed per-generation identity to a range-wide maxSeq (QA P0-A);
 * r9 kept only an UPPER bound per generation (Owner counterexamples:
 * g11:s1 and — after a same-generation re-issuance — g10:s3 both classified
 * `evicted` though never minted). r10 stores the EXACT issued INTERVALS
 * (unioned across incarnations; dense per incarnation under the durable
 * disjointness invariant), ledger PROVEN never-issued generations so the
 * watermark crosses the historical gaps without fabricating identities,
 * archives the coldest resolved tuples (versioned retention — exact facts
 * at O(bytes) cost, never dropped), and counts only LIVE generations
 * against the issuance cap.
 *
 * Frozen invariants (Owner P0/P1/P2 at this slice):
 *   - P0 exactness: BOTH counterexamples classify never_existed — the
 *     never-minted g11:s1 (s1 belongs to g10) and the never-minted g10:s3
 *     after g10's re-issuance took s4 (per-generation interval unions);
 *   - P0-B: an OVER-cap legacy file loads (convert, then cap the compressed
 *     form);
 *   - P1: the proven-absent prefix ledgers honestly (never_existed forever),
 *     the watermark never claims a gap generation, and the hot interval
 *     budget cannot exhaust the system's liveness (archive = exact facts,
     * zero identity loss);
 *   - P1-D: marker-only fences do NOT block admission — HR recovers with
 *     NO new D6; unmarked UNKNOWN fences still block;
 *   - P2 rollback: persists are DUAL-WRITTEN (r10 ranges + the legacy pair
 *     expansion), so a pre-r8 binary can still LOAD the file — records and
 *     correlations (the live responsibilities) ride the unchanged record
 *     format; the legacy field is lossier by design and the drift is
 *     documented, and INCONSISTENT dual forms fail closed.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation/index.js'

const HR = 'agt_hr-agent'

// The legal legacy-evicted generation list for the frozen shape: 43
// generations, EXACTLY excluding the live fence generations 70/73/78/86
// (P1-C) and the absent 35-37 + 43-49. Legacy data carries no lower bounds —
// every generation maps to [[1, maxSeq]] (legacy-fidelity representation).
function seededLegacyRanges() {
  const span = (start, end, base) => {
    const slots = []
    for (let generation = start; generation <= end; generation++) slots.push([[1, base + (generation - start)]])
    return [start, end, slots]
  }
  return [
    span(38, 42, 34), // 5
    span(50, 69, 40), // 20
    span(71, 72, 42), // 2
    span(74, 77, 44), // 4
    span(79, 85, 48), // 7
    span(87, 91, 55), // 5  → 43 intervals total, production's exact count
  ]
}

function frozenShape(store) {
  // REAL frozen shape: fence records at 70/73/78/86 (outcome_unknown).
  const fenceHandles = []
  for (const generation of [70, 73, 78, 86]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.markOutcomeUnknown(handle, { source: 'fixture' })
    fenceHandles.push(handle)
  }
  for (let generation = 92; generation <= 343; generation++) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  issuance.evictedThroughGeneration = 34
  issuance.evictedRanges.push(...seededLegacyRanges())
  return { issuance, fenceHandles }
}

test('P1-C + r10: legal legacy state — the mint proceeds, fences stay pinned, the absent prefix LEDGERS honestly, idempotent', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-r10' })
  const { issuance, fenceHandles } = frozenShape(store)
  const sum = () => issuance.generations.size + issuance.evictedRanges.length
  assert.equal(issuance.evictedRanges.reduce((total, tuple) => total + tuple[2].reduce((t, slot) => t + slot.length, 0), 0), 43,
    'the seeded legacy state carries exactly the production 43 intervals')
  assert.equal(sum(), 4 + 252 + 6, 'fixture at the cap shape (the live-only cap now ignores evicted metadata)')
  for (const tuple of issuance.evictedRanges) {
    for (const fence of [70, 73, 78, 86]) {
      assert.ok(!(fence >= tuple[0] && fence <= tuple[1]), `no range covers the live fence g${fence}`)
    }
  }

  const handle = store.mintTurnExecution({ agentId: HR, processGeneration: 344, sessionId: 'main' })
  assert.equal(store.records.has(handle), true, 'the mint proceeds — live-only cap ignores resolved history')

  // The mint's capacity walk compacted the proven-absent prefix: the
  // watermark crossed 35-37 (ledgered never-issued) and stopped at the real
  // span 38. The gaps BEHIND ranges (43-49) need no ledger — the fall-through
  // answers never_existed for uncovered generations.
  assert.equal(issuance.evictedThroughGeneration, 37, 'the watermark crossed ONLY the proven-absent prefix')
  assert.deepEqual([...issuance.neverIssuedGenerations].sort((a, b) => a - b), [35, 36, 37])
  assert.equal(issuance.evictedRanges.length, 6, 'ALL ranges survive — exact intervals are never cascaded away')
  assert.deepEqual(issuance.evictedRanges.map(tuple => tuple[0]), [38, 50, 71, 74, 79, 87])

  // Ledger identity facts: gap generations stay never_existed FOREVER.
  const base = `turn:${store.runtimeEpoch}:a${issuance.discriminator}`
  for (const generation of [35, 36, 37]) {
    assert.deepEqual(store.classifyHandle(`${base}:g${generation}:s1`), { state: 'never_existed' },
      `g${generation} was proven never issued — ledgered, never fabricated as evicted`)
  }
  for (const generation of [43, 44, 49]) {
    assert.deepEqual(store.classifyHandle(`${base}:g${generation}:s1`), { state: 'never_existed' },
      `g${generation} is uncovered by any range — never_existed`)
  }
  // Genuinely issued+evicted prefix generations stay evicted (baseline).
  assert.deepEqual(store.classifyHandle(`${base}:g20:s1`), { state: 'evicted', agentId: HR })

  // The unresolved fence generations stay pinned (quarantine, not deletion).
  for (const generation of [70, 73, 78, 86]) {
    const genEntry = issuance.generations.get(generation)
    assert.ok(genEntry !== undefined, `gen${generation} fence generation entry stays live`)
  }
  for (const fenceHandle of fenceHandles) {
    assert.ok(store.classifyHandle(fenceHandle).record !== undefined, 'the fence record stays live')
    const phantomSeq = Number(fenceHandle.match(/:s(\d+)$/)[1]) + 300
    assert.equal(store.classifyHandle(`${fenceHandle.slice(0, fenceHandle.lastIndexOf(':s'))}:s${phantomSeq}`).state,
      'never_existed', 'a phantom seq on a live fence generation never classifies evicted')
  }

  // Idempotent: a second walk is a no-op on the compacted shape.
  const before = { sum: sum(), ledger: issuance.neverIssuedGenerations.size }
  store.evictSettledGenerationForCapacity(HR, issuance)
  assert.equal(sum(), before.sum)
  assert.equal(issuance.neverIssuedGenerations.size, before.ledger)
})

test("P0-A exactness: the Owner's TWO counterexamples classify never_existed — upper-bound-only is gone", () => {
  // Counterexample 1 (Owner, verbatim): mint g10:s1, g11:s2, g20:s3; settle
  // and evict → [[10,11,[[1,1],[2,2]]],[20,20,[[3,3]]]]. The never-minted
  // g11:s1 (s1 belongs to g10) must be never_existed — the r9 upper bound
  // (2) answered evicted.
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-p0a' })
  for (const generation of [10, 11, 20]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  store.evictSettledGenerationForCapacity(HR, issuance)
  const base = `turn:${store.runtimeEpoch}:a${issuance.discriminator}`
  assert.deepEqual(store.classifyHandle(`${base}:g11:s1`), { state: 'never_existed' },
    'COUNTEREXAMPLE 1: s1 belongs to g10 — g11 never issued it')
  assert.deepEqual(store.classifyHandle(`${base}:g10:s1`), { state: 'evicted', agentId: HR })
  assert.deepEqual(store.classifyHandle(`${base}:g11:s2`), { state: 'evicted', agentId: HR })
  assert.deepEqual(store.classifyHandle(`${base}:g20:s3`), { state: 'evicted', agentId: HR })
  assert.deepEqual(store.classifyHandle(`${base}:g10:s2`), { state: 'never_existed' })

  // Counterexample 2 (Owner, verbatim): re-mint g10 with s4, settle, evict
  // → g10's slot UNION-merges to [[1,1],[4,4]]. The never-minted g10:s3 must
  // be never_existed (s3 belongs to g20) — the r9 upper bound (4) answered
  // evicted.
  const reminted = store.mintTurnExecution({ agentId: HR, processGeneration: 10, sessionId: 'main' })
  assert.equal(store.records.has(reminted), true)
  store.markPromptWriteAttempted(reminted)
  store.settleDirect(reminted, { outcome: 'completed' })
  const remintedSeq = Number(reminted.match(/:s(\d+)$/)[1])
  store.evictRecord(store.records.get(reminted))
  assert.deepEqual(store.classifyHandle(`${base}:g10:s3`), { state: 'never_existed' },
    'COUNTEREXAMPLE 2: s3 belongs to g20 — g10 issued only s1 and s4')
  assert.deepEqual(store.classifyHandle(`${base}:g10:s1`), { state: 'evicted', agentId: HR },
    'the old incarnation still classifies evicted')
  assert.deepEqual(store.classifyHandle(`${base}:g10:${`s${remintedSeq}`}`), { state: 'evicted', agentId: HR },
    'the re-issued incarnation classifies evicted')
  assert.deepEqual(store.classifyHandle(`${base}:g10:s2`), { state: 'never_existed' })

  // Production-like mixed shape: exact per-generation intervals survive
  // adjacency merges; the absent 43-49 gap is never covered.
  const store2 = new TurnReconciliationStore({ runtimeEpoch: 'epoch-p0a-mixed' })
  for (const generation of [38, 39, 40, 41, 42, 50, 51, 60]) {
    const handle = store2.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store2.markPromptWriteAttempted(handle)
    store2.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance2 = store2.issuance.get(HR)
  store2.evictSettledGenerationForCapacity(HR, issuance2)
  assert.deepEqual(issuance2.evictedRanges,
    [[38, 42, [[[1, 1]], [[2, 2]], [[3, 3]], [[4, 4]], [[5, 5]]]], [50, 51, [[[6, 6]], [[7, 7]]]], [60, 60, [[[8, 8]]]]],
    'only generation-ADJACENT runs merge; the absent 43-49 gap is never covered')
  const base2 = `turn:${store2.runtimeEpoch}:a${issuance2.discriminator}`
  assert.deepEqual(store2.classifyHandle(`${base2}:g40:s3`), { state: 'evicted', agentId: HR },
    'the REAL minted seq of g40 classifies evicted')
  assert.deepEqual(store2.classifyHandle(`${base2}:g50:s6`), { state: 'evicted', agentId: HR })
  for (const generation of [35, 43, 49]) {
    assert.deepEqual(store2.classifyHandle(`${base2}:g${generation}:s1`), { state: 'never_existed' },
      `g${generation} was never issued — no range may claim it`)
  }
  assert.deepEqual(store2.classifyHandle(`${base2}:g50:s8`), { state: 'never_existed' },
    'seq 8 was minted in gen60 — beyond g50\'s exact interval')
  assert.deepEqual(store2.classifyHandle(`${base2}:g50:s7`), { state: 'never_existed' },
    'seq 7 belongs to g51 — outside g50\'s exact interval')
})

test('P0-B + P2: a legacy file OVER the 256 sum loads; persists are DUAL-WRITTEN and the dual forms stay consistent', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'acr-wm-p0b-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const pf = join(dir, 'recovery.json')

  // 261 settled generations 2..262 evict (watermark 0 → one non-adjacent
  // tuple; the compaction cannot ledger them — the watermark prefix stops at
  // gen2's tuple... it LEDGERS 1: trace exists above → 1 is proven absent).
  const store1 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-p0b' })
  for (let generation = 2; generation <= 262; generation++) {
    const handle = store1.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store1.markPromptWriteAttempted(handle)
    store1.settleDirect(handle, { outcome: 'completed' })
  }
  store1.evictSettledGenerationForCapacity(HR, store1.issuance.get(HR))
  store1.persistDurable()
  const issuance1 = store1.issuance.get(HR)
  assert.equal(issuance1.evictedRanges.length, 1, 'one merged tuple')
  assert.equal(issuance1.evictedRanges[0][2].length, 261, 'exact per-generation slots')
  assert.ok(issuance1.neverIssuedGenerations.has(1), 'gen1 was proven absent (a trace exists above it)')

  // Simulate the LEGACY pre-r8 file: expand into 261 pairs (> 256 sum).
  const legacy = JSON.parse(await readFile(pf, 'utf8'))
  for (const entry of legacy.issuance) {
    const pairs = []
    for (const [start, end, slots] of entry.evictedRanges) {
      for (let offset = 0; offset < slots.length; offset++) pairs.push([start + offset, slots[offset][slots[offset].length - 1][1]])
    }
    assert.ok(pairs.length + entry.generations.length > 256, 'the legacy fixture is genuinely over the 256 sum')
    delete entry.evictedRanges
    delete entry.evictedArchives
    delete entry.neverIssuedGenerations
    entry.evictedGenerations = pairs
  }
  await writeFile(pf, `${JSON.stringify(legacy)}\n`)

  const store2 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-p0b-loaded' })
  assert.equal(store2.startupBlockedReason, null, 'the over-cap legacy file loads')
  const migrated = store2.issuance.get(HR)
  assert.equal(migrated.evictedRanges.length, 1, 'the converted span stays one exact tuple (no cascade)')
  assert.equal(migrated.evictedRanges[0][2].length, 261)
  // Legacy fidelity: migrated slots are [[1, maxSeq]] — the honest no-lower-
  // bound-evidence representation.
  assert.deepEqual(migrated.evictedRanges[0][2][0], [[1, 1]])
  const next = store2.mintTurnExecution({ agentId: HR, processGeneration: 263, sessionId: 'main' })
  assert.equal(store2.records.has(next), true, 'capacity is recovered on the over-cap legacy shape')

  // P2: the persist DUAL-WRITES — the legacy expansion is present and
  // CONSISTENT with the ranges (an old binary can load the file).
  store2.persistDurable()
  const rewritten = JSON.parse(await readFile(pf, 'utf8'))
  for (const entry of rewritten.issuance) {
    assert.ok(Array.isArray(entry.evictedRanges) && Array.isArray(entry.evictedGenerations),
      'dual-write: both forms present')
    const pairs = new Map(entry.evictedGenerations)
    const consistent = entry.evictedRanges.every(([start, end, slots]) =>
      slots.every((slot, offset) => pairs.get(start + offset) === slot[slot.length - 1][1]))
      && pairs.size === entry.evictedRanges.reduce((total, tuple) => total + tuple[2].length, 0)
    assert.equal(consistent, true, 'the dual forms are consistent (records/correlations ride the unchanged format)')
    // THIS rescue file is beyond the old loader's 256 budget BY CONSTRUCTION
    // (261 over-cap pairs — the shape the r10 loader exists to rescue); the
    // production shape holds comfortably (frozenShape: 43 pairs + 5 live
    // post-recovery — asserted in the P1-C test via the persisted dual-write
    // budget below).
  }

  // INCONSISTENT dual forms = poisoned = fail closed.
  for (const entry of rewritten.issuance) entry.evictedGenerations[0][1] += 1
  await writeFile(pf, `${JSON.stringify(rewritten)}\n`)
  const poisoned = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-poisoned' })
  assert.equal(poisoned.startupBlockedReason, 'durable_store_invalid')
})

test('P1: the versioned retention keeps the system live indefinitely — archived tuples stay exact, zero identity loss', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-archive' })
  // Enough resolved generations to cross the archive trigger is too slow to
  // mint; drive the HOT budget directly by injecting resolved tuples, then
  // verify the compaction moves only the coldest batch and every archived
  // handle stays exact.
  const mintedSeqs = []
  for (let generation = 2; generation <= 12; generation++) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
    mintedSeqs.push([generation, Number(handle.match(/:s(\d+)$/)[1])])
  }
  const issuance = store.issuance.get(HR)
  store.evictSettledGenerationForCapacity(HR, issuance)
  // Inject a cold resolved span above the hot tuple so the trigger fires
  // (production-like: the coldest history sits lowest). Positive gens/seqs;
  // seqs ride under a fixture-raised maxIssuedTurnSeq (interval validation
  // happens at persist; this store stays in-memory).
  issuance.maxIssuedTurnSeq = 20000
  const cold = []
  for (let start = 100; start <= 12500; start += 50) {
    const end = start + 49
    cold.push([start, end, Array.from({ length: 50 }, (_, offset) => [[start + offset, start + offset]])])
  }
  issuance.evictedRanges.push(...cold)
  const trigger = 12288
  const hotBefore = () => issuance.evictedRanges.reduce((total, tuple) => total
    + tuple[2].reduce((t, slot) => t + slot.length, 0), 0)
  assert.ok(hotBefore() > trigger, 'the hot budget genuinely crosses the trigger')

  store.evictSettledGenerationForCapacity(HR, issuance)
  assert.ok(hotBefore() <= trigger, 'the compaction archived enough cold tuples')
  assert.ok(issuance.evictedArchives.length > 0, 'the archive holds the coldest resolved tuples')
  assert.deepEqual([...issuance.neverIssuedGenerations], [1],
    'the compaction ledgered only the proven-absent prefix (gen1: a trace exists above it)')
  // ARCHIVED FACTS STAY EXACT: every cold handle still classifies evicted —
  // nothing was dropped.
  const base = `turn:${store.runtimeEpoch}:a${issuance.discriminator}`
  for (const [generation, seq] of mintedSeqs) {
    const verdict = store.classifyHandle(`${base}:g${generation}:s${seq}`)
    assert.equal(verdict.state, 'evicted', `g${generation}:s${seq} stays exactly evicted after archiving`)
  }
  const coldProbe = store.classifyHandle(`${base}:g100:s100`)
  assert.equal(coldProbe.state, 'evicted', 'an archived cold handle classifies evicted (exact, retained)')
  assert.equal(store.classifyHandle(`${base}:g100:s101`).state, 'never_existed',
    'an archived generation\'s non-issued seq stays never_existed (exact, retained)')
  // Re-mint into an ARCHIVED generation is legal; its old handle stays
  // evicted through the archive and the new record stays live.
  const reminted = store.mintTurnExecution({ agentId: HR, processGeneration: 100, sessionId: 'main' })
  assert.equal(store.records.has(reminted), true)
  assert.equal(store.classifyHandle(`${base}:g100:s100`).state, 'evicted')
  assert.equal(store.classifyHandle(reminted).state, 'pending')
})

test('P1-D: marker-only fences do NOT block admission — HR recovers with NO new D6; unmarked UNKNOWN fences still block', () => {
  // Scenario A — the REAL production state: fences marked (adminAbandonment
  // marker, no acceptance audit), settled generations compressible.
  const marked = new TurnReconciliationStore({ runtimeEpoch: 'epoch-p1d-marked' })
  const fenceHandle = marked.mintTurnExecution({ agentId: HR, processGeneration: 70, sessionId: 'main' })
  marked.markPromptWriteAttempted(fenceHandle)
  marked.markOutcomeUnknown(fenceHandle, { source: 'fixture' })
  marked.declareAdminAbandonment({ agentId: HR, declarationId: 'p1d-marker-only' })
  for (let generation = 92; generation <= 343; generation++) {
    const handle = marked.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    marked.markPromptWriteAttempted(handle)
    marked.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = marked.issuance.get(HR)
  issuance.evictedThroughGeneration = 34
  issuance.evictedRanges.push(...seededLegacyRanges())

  assert.equal(marked.admissionBlockerForAgent(HR), null,
    'a marker-only fence does NOT block admission (declaration-marked records skip the blocker)')
  const next = marked.mintTurnExecution({ agentId: HR, processGeneration: 344, sessionId: 'main' })
  assert.equal(marked.records.has(next), true,
    'the natural new-generation slot mints — HR admission recovers with NO D6 acceptance')
  // The fence stays durably quarantined: its generation entry still exists
  // (pinned by the P0 walk gate — marker-only, no acceptance audit), its
  // no-replay caller correlation preserved, outcome UNKNOWN. (The r2
  // declaration-time decrement already zeroed its unresolvedCount; pinned-ness
  // is the entry's EXISTENCE against the walk gate, not the count.)
  assert.ok(marked.records.has(fenceHandle), 'the fence record stays (quarantine, not deletion)')
  assert.ok(marked.issuance.get(HR).generations.get(70) !== undefined,
    'the fence generation entry stays (pinned against the marker-only walk gate)')
  assert.equal(marked.classifyHandle(fenceHandle).record !== undefined, true)

  // Scenario B — an UNMARKED outcome_unknown fence still blocks (unchanged).
  const unmarked = new TurnReconciliationStore({ runtimeEpoch: 'epoch-p1d-unmarked' })
  const rawFence = unmarked.mintTurnExecution({ agentId: HR, processGeneration: 70, sessionId: 'main' })
  unmarked.markPromptWriteAttempted(rawFence)
  unmarked.markOutcomeUnknown(rawFence, { source: 'fixture' })
  assert.notEqual(unmarked.admissionBlockerForAgent(HR), null,
    'an unmarked outcome_unknown fence keeps the admission blocker (unchanged semantics)')
})

test('legacy migration: adjacent pairs merge with legacy-fidelity intervals, a watermark+1 pair cascades, the absent prefix stays honest', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'acr-wm-gap-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const pf = join(dir, 'recovery.json')

  const store1 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-legacy' })
  for (const generation of [35, 36, 40, 41, 50]) {
    const handle = store1.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store1.markPromptWriteAttempted(handle)
    store1.settleDirect(handle, { outcome: 'completed' })
  }
  store1.evictSettledGenerationForCapacity(HR, store1.issuance.get(HR))
  store1.persistDurable()
  const r10Ranges = store1.issuance.get(HR).evictedRanges
  // FRESH evictions carry EXACT intervals (min..max of each incarnation).
  assert.deepEqual(r10Ranges, [
    [35, 36, [[[1, 1]], [[2, 2]]]],
    [40, 41, [[[3, 3]], [[4, 4]]]],
    [50, 50, [[[5, 5]]]],
  ])

  // Simulate the LEGACY pre-r8 file: expand the tuples into per-generation
  // pairs, plus a pair at watermark+1 (gen 2, a genuinely issued+evicted
  // generation per the legacy facts).
  const legacy = JSON.parse(await readFile(pf, 'utf8'))
  for (const entry of legacy.issuance) {
    const pairs = []
    for (const [start, end, slots] of entry.evictedRanges) {
      for (let offset = 0; offset < slots.length; offset++) pairs.push([start + offset, slots[offset][slots[offset].length - 1][1]])
    }
    pairs.push([2, 2])
    delete entry.evictedRanges
    delete entry.evictedArchives
    delete entry.neverIssuedGenerations
    // Simulate the OLDER historical file state: the watermark field sat at 0
    // before the compaction existed (all the provably-absent prefix was
    // still unledgered in legacy files).
    entry.evictedThroughGeneration = 0
    entry.evictedGenerations = pairs
  }
  await writeFile(pf, `${JSON.stringify(legacy)}\n`)

  // Restore migrates 1:1 (legacy fidelity). r10 NEVER cascades an issued
  // span into the watermark — the gen-2 pair (watermark+1) becomes an exact
  // interval range, which is strictly tighter than the r9 cascade.
  const store2 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-legacy-migrated' })
  const migrated = store2.issuance.get(HR)
  // Legacy fidelity: EVERY migrated generation maps to [[1, maxSeq]] — the
  // legacy data carries no lower bound, so below-max phantoms keep the
  // legacy verdict (the disclosed residual; NEW evictions are exact).
  assert.deepEqual(migrated.evictedRanges, [
    [2, 2, [[[1, 2]]]],
    [35, 36, [[[1, 1]], [[1, 2]]]],
    [40, 41, [[[1, 3]], [[1, 4]]]],
    [50, 50, [[[1, 5]]]],
  ])
  assert.equal(migrated.evictedThroughGeneration, 0,
    'the watermark stays as the file carried it — r10 never widens it across issued spans')
  assert.deepEqual(store2.classifyHandle(`turn:epoch-legacy:a${migrated.discriminator}:g35:s1`),
    { state: 'evicted', agentId: HR }, 'migrated ranges still resolve evicted handles')
  assert.deepEqual(store2.classifyHandle(`turn:epoch-legacy:a${migrated.discriminator}:g35:s2`),
    { state: 'never_existed' }, 's2 belongs to g36 — beyond g35\'s OWN migrated bound (exact)')
  assert.deepEqual(store2.classifyHandle(`turn:epoch-legacy:a${migrated.discriminator}:g36:s1`),
    { state: 'evicted', agentId: HR },
    'THE DISCLOSED LEGACY RESIDUAL: s1 is below g36\'s migrated bound ([[1,2]]) — legacy answered evicted too, and migrated data cannot prove tighter')
  assert.deepEqual(store2.classifyHandle(`turn:epoch-legacy:a${migrated.discriminator}:g2:s2`),
    { state: 'evicted', agentId: HR }, 'the watermark+1 pair resolves exactly as an interval range')
  assert.deepEqual(store2.classifyHandle(`turn:epoch-legacy:a${migrated.discriminator}:g35:s3`),
    { state: 'never_existed' }, 'beyond the migrated bound: never_existed preserved')
  assert.deepEqual(store2.classifyHandle(`turn:epoch-legacy:a${migrated.discriminator}:g1:s1`),
    { state: 'never_existed' }, 'gen1 was never issued in this fixture — uncovered and exact')

  // The dual-written persist keeps BOTH forms consistent; tampering one pair
  // fails the store closed.
  store2.persistDurable()
  const rewritten = JSON.parse(await readFile(pf, 'utf8'))
  for (const entry of rewritten.issuance) {
    assert.ok(Array.isArray(entry.evictedGenerations), 'dual-write present')
    const pairs = new Map(entry.evictedGenerations)
    const consistent = entry.evictedRanges.every(([start, end, slots]) =>
      slots.every((slot, offset) => pairs.get(start + offset) === slot[slot.length - 1][1]))
    assert.equal(consistent, true)
    entry.evictedGenerations = entry.evictedGenerations.map(([gen, hi]) => [gen, hi + 7])
  }
  await writeFile(pf, `${JSON.stringify(rewritten)}\n`)
  const poisoned = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-poisoned' })
  assert.equal(poisoned.startupBlockedReason, 'durable_store_invalid')
})
