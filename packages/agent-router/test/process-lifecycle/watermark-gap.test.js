/**
 * #707 watermark-gap deadlock — r9: disjoint evictedRanges metadata
 * compression carrying EXACT per-generation turnSeq bounds.
 *
 * REAL frozen shape (measured from the production durable preimage
 * turn-recovery-v3.json, agt_hr-agent, sha256 5d3d2eb2…): watermark-gen 34,
 * watermark-seq 2656, maxSeq 4946, live gens 70..301 (fences 70/73/78/86
 * active marker-only UNKNOWN, settled 92-301), legacy evicted map = 43
 * entries (38-42, 50-69, 71-72, 74-77, 79-85, 87-91 — EXACTLY excluding the
 * live fences), absent (never-issued) 35-37 + 43-49, metadata sum exactly
 * 43 + 213 = 256 (at the cap).
 *
 * History: the r7 skip-walk moved each evicted generation's entry 1:1
 * between maps (sum invariant 261 → 261, deadlock persisted); the r8
 * range-wide maxSeq collapsed per-generation identity (QA P0-A: range
 * [10,12,3] classified the never-issued g10:s3 as evicted) and its legacy
 * decode rejected the real at-cap production file BEFORE conversion could
 * run (QA P0-B). r9 tuples are [startGen, endGen, perGenMaxSeqs] with
 * perGenMaxSeqs[i] = the exact legacy bound of generation startGen + i —
 * the identical `seq <= maxSeq_g` predicate, compressed only in tuple
 * count — and the legacy decode converts FIRST, capping the COMPRESSED form.
 *
 * Frozen invariants (per Owner counterexamples P0-A/B, P1-C/D):
 *   - P0-A exactness: a never-issued (gen, seq) with seq beyond ITS OWN
 *     generation's bound classifies never_existed — the dense-run
 *     counterexample [10,12]→g10:s3 is frozen as banned;
 *   - P0-B: a legacy file OVER the 256 metadata sum loads (convert, then
 *     cap the compressed form);
 *   - P1-C: the fixture's evicted state is a legal duplicate-free legacy
 *     list (live fences excluded); re-issuance of the same generation has
 *     an explicit old/new turnSeq boundary;
 *   - P1-D: marker-only fences do NOT block admission
 *     (admissionBlockerForAgent) — HR admission recovers with NO new D6;
 *     unmarked UNKNOWN fences still block (unchanged);
 *   - the walk compresses the metadata sum under the cap, the fences stay
 *     pinned, the watermark stays honest (never claims absent 35-37), and
 *     a second walk is a no-op;
 *   - rollback: the persisted layout drops the legacy field — a pre-r8
 *     binary (whose validator requires the evictedGenerations array, base
 *     24401a34 durable-file.js) fails CLOSED at startup, never a silent
 *     misread; rollback = the paired binary+preimage deploy discipline.
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
// (P1-C) and the absent 35-37 + 43-49. Bounds are per-generation exact
// (mirroring the production preimage's dense per-gen seqs).
function seededLegacyRanges() {
  const span = (start, end, base) => {
    const bounds = []
    for (let generation = start; generation <= end; generation++) bounds.push(base + (generation - start))
    return [start, end, bounds]
  }
  return [
    span(38, 42, 34), // 5
    span(50, 69, 40), // 20
    span(71, 72, 42), // 2
    span(74, 77, 44), // 4
    span(79, 85, 48), // 7
    span(87, 91, 55), // 5  → 43 bounds total, production's exact count
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
  // Settled records at 92-343 (one per generation) — enough generation
  // entries that a NEW-generation mint hits the 256 cap.
  for (let generation = 92; generation <= 343; generation++) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  // The production measured state: watermark 34 (honest — absent 35-37),
  // the legal 43-entry legacy-evicted state (P1-C: fences excluded).
  issuance.evictedThroughGeneration = 34
  issuance.evictedRanges.push(...seededLegacyRanges())
  return { issuance, fenceHandles }
}

const rangeStarts = issuance => issuance.evictedRanges.map(range => range[0])

test('P1-C + r9 walk: legal legacy state compresses under the cap — the mint proceeds, fences stay pinned, the watermark stays honest, idempotent', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-r9' })
  const { issuance, fenceHandles } = frozenShape(store)
  const sum = () => issuance.generations.size + issuance.evictedRanges.length
  assert.equal(issuance.evictedRanges.reduce((total, range) => total + range[2].length, 0), 43,
    'the seeded legacy state carries exactly the production 43 per-generation bounds')
  assert.equal(sum(), 4 + 252 + 6, 'fixture at the cap shape (256 is the limit; the pre-mint check is >=)')
  // P1-C: no seeded range covers a LIVE fence generation.
  for (const range of issuance.evictedRanges) {
    for (const fence of [70, 73, 78, 86]) {
      assert.ok(!(fence >= range[0] && fence <= range[1]), `no range covers the live fence g${fence}`)
    }
  }

  // Pre-r8 the mint threw RECONCILIATION_CAPACITY_EXHAUSTED (1:1 metadata
  // relocation, sum invariant). r9 compresses and the mint proceeds.
  const handle = store.mintTurnExecution({ agentId: HR, processGeneration: 344, sessionId: 'main' })
  assert.equal(store.records.has(handle), true, 'the mint proceeds after the walk compressed the metadata')

  assert.equal(sum() < 256, true, `metadata sum dropped under the cap (now ${sum()})`)
  assert.equal(issuance.evictedRanges.length, 6, 'the settled run merged into the adjacent legacy range [87,343]')
  assert.deepEqual(rangeStarts(issuance), [38, 50, 71, 74, 79, 87])
  const last = issuance.evictedRanges[5]
  assert.equal(last[0], 87)
  assert.equal(last[1], 343)
  assert.equal(last[2].length, 257, 'the merged range carries EXACT bounds for all 257 generations')
  assert.equal(issuance.evictedThroughGeneration, 34, 'the watermark never claims the absent 35-37 were issued')

  // The unresolved fence generations stay pinned (they need evidence-based
  // settlement or Owner risk acceptance, not capacity-pressure eviction).
  for (const generation of [70, 73, 78, 86]) {
    const genEntry = issuance.generations.get(generation)
    assert.ok(genEntry !== undefined, `gen${generation} fence generation entry stays live`)
    assert.ok(genEntry.unresolvedCount > 0, `gen${generation} fence record stays pinned`)
  }

  // P1-C old/new boundary on the live fence generations: the fence's real
  // handle stays live; a phantom seq far outside its tight [seq, seq]
  // interval does not classify evicted.
  for (const fenceHandle of fenceHandles) {
    const live = store.classifyHandle(fenceHandle)
    assert.ok(live.record !== undefined, 'the fence record stays live')
    const phantomSeq = Number(fenceHandle.match(/:s(\d+)$/)[1]) + 300
    const phantom = store.classifyHandle(`${fenceHandle.slice(0, fenceHandle.lastIndexOf(':s')) }:s${phantomSeq}`)
    assert.equal(phantom.state, 'never_existed', 'a phantom seq on a live fence generation never classifies evicted')
  }

  // Idempotent: a second walk is a no-op on the already-compressed shape.
  const before = sum()
  store.evictSettledGenerationForCapacity(HR, issuance)
  assert.equal(sum(), before)
})

test('P0-A exactness: per-generation bounds — the dense-run counterexample g10:s3 is never_existed', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-p0a' })
  // Owner's minimal counterexample, verbatim: g10 mints s1, g11 mints s2,
  // g12 mints s3; all settle and evict → range [10,12] with bounds [1,2,3].
  for (const generation of [10, 11, 12]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  store.evictSettledGenerationForCapacity(HR, issuance)
  assert.deepEqual(issuance.evictedRanges, [[10, 12, [1, 2, 3]]],
    'the range carries the EXACT per-generation bound of every merged generation')

  const base = `turn:${store.runtimeEpoch}:a${issuance.discriminator}`
  // Real handles classify evicted (each gen's own bound).
  assert.deepEqual(store.classifyHandle(`${base}:g10:s1`), { state: 'evicted', agentId: HR })
  assert.deepEqual(store.classifyHandle(`${base}:g11:s2`), { state: 'evicted', agentId: HR })
  assert.deepEqual(store.classifyHandle(`${base}:g12:s3`), { state: 'evicted', agentId: HR })
  // THE COUNTEREXAMPLE: g10:s3 was NEVER issued (g10's bound is 1) — it must
  // be never_existed, which the r8 range-wide maxSeq (3) violated.
  assert.deepEqual(store.classifyHandle(`${base}:g10:s3`), { state: 'never_existed' })
  assert.deepEqual(store.classifyHandle(`${base}:g10:s2`), { state: 'never_existed' })
  assert.deepEqual(store.classifyHandle(`${base}:g11:s3`), { state: 'never_existed' })

  // Same exactness over the mixed dense/sparse production-like shape:
  // per-generation bounds stay exact after adjacency merges.
  const store2 = new TurnReconciliationStore({ runtimeEpoch: 'epoch-p0a-mixed' })
  for (const generation of [38, 39, 40, 41, 42, 50, 51, 60]) {
    const handle = store2.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store2.markPromptWriteAttempted(handle)
    store2.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance2 = store2.issuance.get(HR)
  store2.evictSettledGenerationForCapacity(HR, issuance2)
  assert.deepEqual(issuance2.evictedRanges, [[38, 42, [1, 2, 3, 4, 5]], [50, 51, [6, 7]], [60, 60, [8]]],
    'only generation-ADJACENT runs merge; the absent 43-49 gap is never covered')
  assert.equal(issuance2.maxIssuedTurnSeq, 8)
  const base2 = `turn:${store2.runtimeEpoch}:a${issuance2.discriminator}`
  assert.deepEqual(store2.classifyHandle(`${base2}:g40:s3`), { state: 'evicted', agentId: HR },
    'the REAL minted seq of g40 classifies evicted')
  assert.deepEqual(store2.classifyHandle(`${base2}:g50:s6`), { state: 'evicted', agentId: HR },
    'the REAL minted seq of g50 classifies evicted')
  assert.deepEqual(store2.classifyHandle(`${base2}:g50:s7`), { state: 'never_existed' },
    'seq 7 belongs to g51 — beyond g50\'s own bound, exactly the r8 collapse class')
  for (const generation of [35, 43, 49]) {
    assert.deepEqual(store2.classifyHandle(`${base2}:g${generation}:s1`), { state: 'never_existed' },
      `g${generation} was never issued — no range may claim it`)
  }
  assert.deepEqual(store2.classifyHandle(`${base2}:g50:s8`), { state: 'never_existed' },
    'seq 8 was minted in gen60, not gen50 — beyond g50\'s own bound')
  assert.deepEqual(store2.classifyHandle(`${base2}:g42:s8`), { state: 'never_existed' })
})

test('a re-mint into a range-covered generation stays live; its old handles stay evicted (explicit old/new turnSeq boundary)', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-r9-remint' })
  for (const generation of [10, 11]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  const gen20 = store.mintTurnExecution({ agentId: HR, processGeneration: 20, sessionId: 'main' })
  store.markPromptWriteAttempted(gen20)
  store.settleDirect(gen20, { outcome: 'completed' })
  store.evictSettledGenerationForCapacity(HR, issuance)
  assert.deepEqual(issuance.evictedRanges, [[10, 11, [1, 2]], [20, 20, [3]]])
  const base = `turn:${store.runtimeEpoch}:a${issuance.discriminator}`
  assert.deepEqual(store.classifyHandle(`${base}:g10:s1`), { state: 'evicted', agentId: HR })

  // Re-mint into the range-covered generation: legal, stays live.
  const reminted = store.mintTurnExecution({ agentId: HR, processGeneration: 10, sessionId: 'main' })
  assert.equal(store.records.has(reminted), true)
  const live = store.classifyHandle(reminted)
  assert.equal(live.state, 'pending')
  assert.equal(live.record.handle, reminted)
  // The OLD/new turnSeq boundary: the new globally-monotonic seq sits above
  // g10's own bound, so the range never swallows the live record while the
  // old seq stays evicted.
  const remintedSeq = Number(reminted.match(/:s(\d+)$/)[1])
  assert.ok(remintedSeq > 2, 'turn-seq monotonicity keeps the live record above the old bound')
  assert.deepEqual(store.classifyHandle(`${base}:g10:s1`), { state: 'evicted', agentId: HR })
  assert.deepEqual(store.classifyHandle(`${base}:g10:s2`), { state: 'never_existed' })

  // Evicting the re-minted record merges BACK into the same range and
  // overwrites ONLY its own generation's exact bound (gen10 → the new seq,
  // gen11's bound untouched). The old incarnation's s1 still classifies
  // evicted via the per-generation bound (identical to the legacy map,
  // which would also hold gen10 → maxSeq after its re-eviction).
  store.evictRecord(store.records.get(reminted))
  assert.deepEqual(issuance.evictedRanges, [[10, 11, [remintedSeq, 2]], [20, 20, [3]]])
  assert.deepEqual(store.classifyHandle(`${base}:g10:s1`), { state: 'evicted', agentId: HR })
})

test('P0-B: a legacy durable file OVER the 256 metadata sum loads — conversion first, caps on the compressed form', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'acr-wm-p0b-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const pf = join(dir, 'recovery.json')

  // A real store writes the r9 form: 261 settled generations 2..262 evict
  // (watermark 0 → one non-adjacent tuple).
  const store1 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-p0b' })
  for (let generation = 2; generation <= 262; generation++) {
    const handle = store1.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store1.markPromptWriteAttempted(handle)
    store1.settleDirect(handle, { outcome: 'completed' })
  }
  store1.evictSettledGenerationForCapacity(HR, store1.issuance.get(HR))
  store1.persistDurable()
  assert.deepEqual(store1.issuance.get(HR).evictedRanges,
    [[2, 262, Array.from({ length: 261 }, (_, index) => index + 1)]])

  // Simulate the LEGACY pre-r8 file: expand the tuple into 261 per-generation
  // pairs — a metadata sum of 261 > 256, exactly the production at-cap/
  // over-cap shape (agt_hr-agent measured 43 + 213 = 256, one non-contiguous
  // eviction from bricking BOTH the old restore and the r8 legacy decode).
  const legacy = JSON.parse(await readFile(pf, 'utf8'))
  for (const entry of legacy.issuance) {
    const pairs = []
    for (const [start, end, bounds] of entry.evictedRanges) {
      for (let offset = 0; offset < bounds.length; offset++) pairs.push([start + offset, bounds[offset]])
    }
    assert.ok(pairs.length + entry.generations.length > 256, 'the legacy fixture is genuinely over the 256 sum')
    delete entry.evictedRanges
    entry.evictedGenerations = pairs
  }
  await writeFile(pf, `${JSON.stringify(legacy)}\n`)

  // r9 LOADS it: per-tuple validation, conversion, THEN caps on the
  // compressed form (1 tuple + 0 live « 256; 261 bounds « 16384).
  const store2 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-p0b-loaded' })
  assert.equal(store2.startupBlockedReason, null, 'the over-cap legacy file loads')
  const migrated = store2.issuance.get(HR)
  assert.deepEqual(migrated.evictedRanges,
    [[2, 262, Array.from({ length: 261 }, (_, index) => index + 1)]])
  const next = store2.mintTurnExecution({ agentId: HR, processGeneration: 263, sessionId: 'main' })
  assert.equal(store2.records.has(next), true, 'capacity is recovered on the over-cap legacy shape')
})

test('legacy migration: adjacent pairs merge, a watermark+1 pair cascades, both-forms fail closed, the next persist writes the rollback-unsafe new form only', async (t) => {
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
  const r9Ranges = store1.issuance.get(HR).evictedRanges
  assert.deepEqual(r9Ranges, [[35, 36, [1, 2]], [40, 41, [3, 4]], [50, 50, [5]]])

  // Simulate the LEGACY pre-r8 file: expand the tuples into per-generation
  // pairs, plus a defensive pair at watermark+1 (gen 1, as if it was written
  // before the watermark advanced past it).
  const legacy = JSON.parse(await readFile(pf, 'utf8'))
  for (const entry of legacy.issuance) {
    const pairs = []
    for (const [start, end, bounds] of entry.evictedRanges) {
      for (let offset = 0; offset < bounds.length; offset++) pairs.push([start + offset, bounds[offset]])
    }
    pairs.push([1, 1])
    delete entry.evictedRanges
    entry.evictedGenerations = pairs
  }
  await writeFile(pf, `${JSON.stringify(legacy)}\n`)

  // Restore migrates 1:1 (exact bounds preserved): pairs merge back into the
  // SAME tuples, and the gen-1 pair (watermark+1) cascades into the
  // contiguous watermark — those generations were genuinely issued + evicted,
  // which the map entries proved.
  const store2 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-legacy-migrated' })
  const migrated = store2.issuance.get(HR)
  assert.deepEqual(migrated.evictedRanges, r9Ranges)
  assert.equal(migrated.evictedThroughGeneration, 1, 'the watermark+1 legacy pair cascaded honestly')
  assert.deepEqual(store2.classifyHandle(`turn:epoch-legacy:a${migrated.discriminator}:g35:s1`),
    { state: 'evicted', agentId: HR }, 'migrated ranges still resolve evicted handles')

  // The next persist writes ONLY the new form; the migration is stable.
  // ROLLBACK BOUNDARY: a pre-r8 binary requires the evictedGenerations array
  // (base 24401a34 validator: !Array.isArray → TypeError → startupBlocked,
  // fail-closed — never a silent misread). Rollback = the paired
  // binary+preimage deploy discipline.
  store2.persistDurable()
  const rewritten = JSON.parse(await readFile(pf, 'utf8'))
  for (const entry of rewritten.issuance) {
    assert.equal(entry.evictedGenerations, undefined, 'no legacy field is ever written again')
    assert.ok(Array.isArray(entry.evictedRanges))
  }

  // Both forms present = ambiguous = fail closed (startup-blocked, like any
  // malformed durable store — the constructor never throws, admission does).
  for (const entry of rewritten.issuance) {
    entry.evictedGenerations = entry.evictedRanges.flatMap(([start, end, bounds]) =>
      bounds.map((bound, offset) => [start + offset, bound]))
  }
  await writeFile(pf, `${JSON.stringify(rewritten)}\n`)
  const ambiguous = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-ambiguous' })
  assert.equal(ambiguous.startupBlockedReason, 'durable_store_invalid')
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
