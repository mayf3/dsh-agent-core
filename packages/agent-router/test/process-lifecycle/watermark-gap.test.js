/**
 * #707 watermark-gap deadlock — r8: disjoint evictedRanges metadata
 * compression. The REAL frozen shape (measured from production): watermark=34,
 * live settled 92-301 with fences at 70/73/78/86, legacy evicted map holding
 * 38-42 + 50-91, absent (never-issued) 35-37 + 43-49.
 *
 * The r7 walk (skip unresolved, evict resolved) moved each fully-evicted
 * generation's map entry 1:1 from `generations` into `evictedGenerations` —
 * the metadata SUM stayed invariant (probe: 261 → 261) and the 256-cap mint
 * kept throwing. r8 compresses: evicted generations merge into
 * generation-ADJACENT [start, end, maxSeq] ranges, so one tuple bounds
 * arbitrarily many generations and the cap counts ranges, not generations.
 *
 * Frozen invariants:
 *   - the production-shape mint at cap SUCCEEDS after the walk; the metadata
 *     sum drops below the cap; the fences stay pinned; the watermark stays
 *     honest (it never claims the absent 35-37 were issued);
 *   - a range never spans a never-issued generation: `never_existed` verdicts
 *     are preserved exactly (the QA-rejected watermark-merge claimed absent
 *     generations as evicted — ranges must not);
 *   - range resolution is bounded by the range's eviction-time maxSeq, so a
 *     re-mint into a range-covered generation stays live and its old handles
 *     stay `evicted`;
 *   - legacy durable files (evictedGenerations pairs) migrate at restore:
 *     adjacent pairs merge, a pair at watermark+1 cascades into the watermark,
 *     both-forms files fail closed, and the next persist writes the new form.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation/index.js'

const HR = 'agt_hr-agent'

function frozenShape(store) {
  // REAL frozen shape: fence records at 70/73/78/86 (outcome_unknown).
  for (const generation of [70, 73, 78, 86]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.markOutcomeUnknown(handle, { source: 'fixture' })
  }
  // Settled records at 92-343 (one per generation) — enough generation
  // entries that a NEW-generation mint hits the 256 cap.
  for (let generation = 92; generation <= 343; generation++) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  // The production measured state: watermark 34, legacy-evicted 38-42 +
  // 50-91 (absent 43-49 between them), absent 35-37.
  issuance.evictedThroughGeneration = 34
  issuance.evictedRanges.push([38, 42, 42], [50, 91, 91])
  return issuance
}

test('r8 walk compresses the metadata sum — the production-shape mint at cap proceeds, fences stay pinned, the watermark stays honest', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-r8' })
  const issuance = frozenShape(store)
  const sum = () => issuance.generations.size + issuance.evictedRanges.length
  assert.equal(sum(), 4 + 252 + 2, 'fixture reaches the cap shape (256 is the limit; the pre-mint check is >=)')

  // Pre-r8 the mint threw RECONCILIATION_CAPACITY_EXHAUSTED here: the walk
  // moved 252 map entries 1:1 into the evicted map (sum invariant) and then
  // threw mid-walk on the metadata cap. r8 merges them into ONE adjacent
  // range, so the mint's own capacity branch frees enough and proceeds.
  const handle = store.mintTurnExecution({ agentId: HR, processGeneration: 344, sessionId: 'main' })
  assert.equal(store.records.has(handle), true, 'the mint proceeds after the walk compressed the metadata')

  assert.equal(sum() < 256, true, `metadata sum dropped under the cap (was ${sum()})`)
  assert.deepEqual(issuance.evictedRanges, [[38, 42, 42], [50, 343, 256]],
    'the settled run merged into ONE adjacent range pinned to the legacy-evicted run (maxSeq = the highest globally-allocated turnSeq merged in)')
  assert.equal(issuance.evictedThroughGeneration, 34, 'the watermark never claims the absent 35-37 were issued')

  // The unresolved fence generations stay pinned (they need evidence-based
  // settlement or risk acceptance, not capacity-pressure eviction).
  for (const generation of [70, 73, 78, 86]) {
    const genEntry = issuance.generations.get(generation)
    assert.ok(genEntry !== undefined, `gen${generation} fence generation entry stays live`)
    assert.ok(genEntry.unresolvedCount > 0, `gen${generation} fence record stays pinned`)
  }

  // Idempotent: a second walk is a no-op on the already-compressed shape.
  const before = sum()
  store.evictSettledGenerationForCapacity(HR, issuance)
  assert.equal(sum(), before)
})

test('a range never spans a never-issued generation — never_existed verdicts are preserved exactly', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-r8-gap' })
  // Settled runs 38-42 and 50-51; 43-49 stay ABSENT (never issued).
  for (const generation of [38, 39, 40, 41, 42, 50, 51, 60]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  store.evictSettledGenerationForCapacity(HR, issuance)

  assert.deepEqual(issuance.evictedRanges, [[38, 42, 5], [50, 51, 7], [60, 60, 8]],
    'only generation-ADJACENT runs merge; the absent 43-49 gap is never covered (seqs are globally allocated 1..8)')
  // gen60 settled LAST so the global maxIssuedTurnSeq (8) exceeds both
  // ranges' maxSeq — the phantom-seq probe needs that headroom.
  assert.equal(issuance.maxIssuedTurnSeq, 8)

  const base = `turn:${store.runtimeEpoch}:a${issuance.discriminator}`
  // Evicted handles inside a range resolve as evicted (seq <= range maxSeq).
  assert.deepEqual(store.classifyHandle(`${base}:g40:s1`), { state: 'evicted', agentId: HR })
  assert.deepEqual(store.classifyHandle(`${base}:g50:s7`), { state: 'evicted', agentId: HR })
  // THE QA-REJECTED CLASS, frozen as banned: a never-issued generation inside
  // the gap must NEVER resolve as evicted.
  for (const generation of [35, 43, 49]) {
    assert.deepEqual(store.classifyHandle(`${base}:g${generation}:s1`), { state: 'never_existed' },
      `g${generation} was never issued — no range may claim it`)
  }
  // A seq beyond the range's eviction-time maxSeq in a range-covered
  // generation with no live entry is still never_existed (seq 8 was minted
  // in gen60, never in gen50/gen42).
  assert.deepEqual(store.classifyHandle(`${base}:g50:s8`), { state: 'never_existed' })
  assert.deepEqual(store.classifyHandle(`${base}:g42:s8`), { state: 'never_existed' })
})

test('a re-mint into a range-covered generation stays live; its old handles stay evicted', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-r8-remint' })
  for (const generation of [10, 11]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  // gen 10-11 are non-contiguous with the watermark (0), so they compact into
  // a range; the later gen 20 keeps the global seq headroom above the range.
  const gen20 = store.mintTurnExecution({ agentId: HR, processGeneration: 20, sessionId: 'main' })
  store.markPromptWriteAttempted(gen20)
  store.settleDirect(gen20, { outcome: 'completed' })
  store.evictSettledGenerationForCapacity(HR, issuance)
  // gen20 is fully settled too, so the walk releases it as its own range.
  assert.deepEqual(issuance.evictedRanges, [[10, 11, 2], [20, 20, 3]])
  const base = `turn:${store.runtimeEpoch}:a${issuance.discriminator}`
  assert.deepEqual(store.classifyHandle(`${base}:g10:s1`), { state: 'evicted', agentId: HR })

  // Re-mint into the range-covered generation: legal, stays live.
  const reminted = store.mintTurnExecution({ agentId: HR, processGeneration: 10, sessionId: 'main' })
  assert.equal(store.records.has(reminted), true)
  const live = store.classifyHandle(reminted)
  assert.equal(live.state, 'pending')
  assert.equal(live.record.handle, reminted)
  // The NEW seq sits above the range's eviction-time maxSeq, so the range
  // never swallows the live record; the OLD seq still resolves as evicted.
  const remintedSeq = Number(reminted.match(/:s(\d+)$/)[1])
  assert.ok(remintedSeq > 2, 'turn-seq monotonicity keeps the live record above the range bound')
  assert.deepEqual(store.classifyHandle(`${base}:g10:s1`), { state: 'evicted', agentId: HR })

  // Evicting the re-minted record merges BACK into the same range (not a
  // second, adjacent one) and the range's maxSeq grows to the new max.
  store.evictRecord(store.records.get(reminted))
  assert.deepEqual(issuance.evictedRanges, [[10, 11, remintedSeq], [20, 20, 3]])
})

test('legacy durable files migrate at restore: adjacent pairs merge, a watermark+1 pair cascades, both-forms fail closed, the next persist writes the new form', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'acr-wm-gap-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const pf = join(dir, 'recovery.json')

  // A real store writes the r8 form: settled gens 35-36 + 40-41 compact into
  // adjacent ranges (the watermark is 0, so nothing cascades yet).
  const store1 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-legacy' })
  for (const generation of [35, 36, 40, 41, 50]) {
    const handle = store1.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store1.markPromptWriteAttempted(handle)
    store1.settleDirect(handle, { outcome: 'completed' })
  }
  store1.evictSettledGenerationForCapacity(HR, store1.issuance.get(HR))
  store1.persistDurable()
  const r8Ranges = store1.issuance.get(HR).evictedRanges
  assert.deepEqual(r8Ranges, [[35, 36, 2], [40, 41, 4], [50, 50, 5]])

  // Simulate the LEGACY pre-r8 file: expand the ranges into per-generation
  // pairs and rename the field, plus a defensive pair at watermark+1 (gen 1,
  // as if it was written before the watermark advanced past it).
  const legacy = JSON.parse(await readFile(pf, 'utf8'))
  for (const entry of legacy.issuance) {
    const pairs = []
    for (const [start, end, maxSeq] of entry.evictedRanges) {
      for (let generation = start; generation <= end; generation++) pairs.push([generation, maxSeq])
    }
    pairs.push([1, 1])
    delete entry.evictedRanges
    entry.evictedGenerations = pairs
  }
  await writeFile(pf, `${JSON.stringify(legacy)}\n`)

  // Restore migrates: pairs merge back into the SAME ranges, and the gen-1
  // pair (watermark+1) cascades into the contiguous watermark — those
  // generations were genuinely issued+evicted, which the map entries proved.
  const store2 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-legacy-migrated' })
  const migrated = store2.issuance.get(HR)
  assert.deepEqual(migrated.evictedRanges, r8Ranges)
  assert.equal(migrated.evictedThroughGeneration, 1, 'the watermark+1 legacy pair cascaded honestly')
  assert.deepEqual(store2.classifyHandle(`turn:epoch-legacy:a${migrated.discriminator}:g35:s1`),
    { state: 'evicted', agentId: HR }, 'migrated ranges still resolve evicted handles')

  // The next persist writes ONLY the new form; the migration is stable.
  store2.persistDurable()
  const rewritten = JSON.parse(await readFile(pf, 'utf8'))
  for (const entry of rewritten.issuance) {
    assert.equal(entry.evictedGenerations, undefined, 'no legacy field is ever written again')
    assert.ok(Array.isArray(entry.evictedRanges))
  }

  // Both forms present = ambiguous = fail closed (startup-blocked, like any
  // malformed durable store — the constructor never throws, admission does).
  for (const entry of rewritten.issuance) entry.evictedGenerations = entry.evictedRanges.flatMap(([s, e, m]) => [[s, m]])
  await writeFile(pf, `${JSON.stringify(rewritten)}\n`)
  const ambiguous = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-ambiguous' })
  assert.equal(ambiguous.startupBlockedReason, 'durable_store_invalid')
})
