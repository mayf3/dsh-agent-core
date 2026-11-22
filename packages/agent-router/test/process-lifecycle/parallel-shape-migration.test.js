/**
 * r13 (#707 production incident 2026-11-21/22): the UNREVIEWED parallel
 * build installed into production (2026-11-21 17:42, runtime boot 23:35)
 * wrote evictedRanges in its own OBJECT form —
 * {fromGen, toGen, maxTurnSeq} with a per-TUPLE max (per-generation
 * precision lost, the r8-era collapse class) — and dropped
 * evictedGenerations entirely. The reviewed line must LOAD that state
 * (restart must not brick on the incident's own writes), migrate it to the
 * legacy-fidelity interval representation, mint through it, and re-persist
 * the r12 form.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { TurnReconciliationStore } from '../../src/reconciliation/index.js';
import { readDurableRecoveryStore } from '../../src/reconciliation/durable-file.js';

const HR = 'agt_hr-agent';

// Build a VALID store envelope via a real persist, then transform the
// issuance into the parallel object form (the incident's exact shape).
function writeParallelFormDurable(pf) {
  const staging = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-parallel' })
  for (const generation of [38, 39, 40, 41, 42, 50, 51]) {
    const handle = staging.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    staging.markPromptWriteAttempted(handle)
    staging.settleDirect(handle, { outcome: 'completed' })
  }
  staging.persistDurable()
  const raw = JSON.parse(readFileSync(pf, 'utf8'))
  for (const entry of raw.issuance) {
    if (entry.agentId !== HR) continue
    entry.maxIssuedTurnSeq = 20000
    // Collapse the persisted exact ranges into the parallel object form
    // (per-TUPLE maxTurnSeq — the incident's precision-lost shape).
    const tuples = []
    for (const [start, end, slots] of entry.evictedRanges) {
      let max = 0
      for (const slot of slots) for (const [, hi] of slot) max = Math.max(max, hi)
      tuples.push({ fromGen: start, toGen: end, maxTurnSeq: max })
    }
    // Merge ADJACENT tuples like the parallel writer did (its own runs).
    const merged = []
    for (const tuple of tuples) {
      const last = merged[merged.length - 1]
      if (last && last.toGen + 1 === tuple.fromGen) { last.toGen = tuple.toGen; last.maxTurnSeq = Math.max(last.maxTurnSeq, tuple.maxTurnSeq) }
      else merged.push({ ...tuple })
    }
    // Inject the historical fence-spanning ranges (38..42, 50..69, ...) by
    // replacing with the measured incident list, plus the real ones kept.
    entry.evictedRanges = [
      { fromGen: 38, toGen: 42, maxTurnSeq: 1905 },
      { fromGen: 50, toGen: 69, maxTurnSeq: 3508 },
      { fromGen: 71, toGen: 72, maxTurnSeq: 3602 },
      { fromGen: 74, toGen: 77, maxTurnSeq: 3703 },
      { fromGen: 79, toGen: 85, maxTurnSeq: 3860 },
      { fromGen: 87, toGen: 91, maxTurnSeq: 4662 },
      ...merged,
    ]
    entry.evictedGenerations = undefined
    delete entry.evictedGenerations
    entry.neverIssuedGenerations = []
    // The incident file carried wm=34 (its own compaction had crossed the
    // proven-absent prefix 1..34 before the fences).
    entry.evictedThroughGeneration = 34
  }
  writeFileSync(pf, `${JSON.stringify(raw)}\n`)
}

test('r13: the parallel object-form durable loads, migrates to exact-slot form, and HR mints through it', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'awd-par-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pf = join(dir, 'recovery.json');
  writeParallelFormDurable(pf);

  const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-parallel' });
  assert.equal(store.startupBlockedReason, null, 'the incident shape loads (no restart brick)');
  const issuance = store.issuance.get(HR);
  // Legacy fidelity: each parallel tuple maps to [[1, maxTurnSeq]] slots per
  // generation — the disclosed no-lower-bound representation.
  assert.equal(issuance.evictedRanges[0][0], 38);
  assert.deepEqual(issuance.evictedRanges[0][2][0], [[1, 1905]]);
  assert.ok(issuance.evictedRanges.length >= 6);
  assert.equal(issuance.evictedThroughGeneration, 34, 'the incident watermark is preserved');

  // Resolution through the migrated slots (legacy fidelity: below-max keeps
  // the legacy verdict; beyond it never_existed).
  const base = `turn:epoch-parallel:a${issuance.discriminator}`;
  assert.equal(store.classifyHandle(`${base}:g38:s1382`).state, 'evicted');
  assert.equal(store.classifyHandle(`${base}:g38:s1906`).state, 'never_existed');

  // The mint proceeds — the P0 production fix (HR admission recovers).
  const handle = store.mintTurnExecution({ agentId: HR, processGeneration: 302, sessionId: 'main' });
  assert.equal(store.records.has(handle), true, 'HR admission recovers on the incident state');

  // The next persist writes the r12 form (normalize the incident away).
  store.persistDurable();
  const raw = JSON.parse(readFileSync(pf, 'utf8'));
  for (const entry of raw.issuance) {
    for (const tuple of entry.evictedRanges) {
      assert.ok(Array.isArray(tuple), 'the persisted form is the r12 array form');
      assert.equal(tuple[2].length, tuple[1] - tuple[0] + 1);
    }
  }
});

test('r13: an object tuple violating the budget still fails closed', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'awd-par-bad-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pf = join(dir, 'recovery.json');
  writeParallelFormDurable(pf);
  const badRaw = JSON.parse(readFileSync(pf, 'utf8'));
  for (const entry of badRaw.issuance) {
    if (entry.agentId === HR) entry.evictedRanges[0].maxTurnSeq = 999999; // > maxIssuedTurnSeq
  }
  writeFileSync(pf, `${JSON.stringify(badRaw)}\n`);
  const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-par-bad' });
  assert.equal(store.startupBlockedReason, 'durable_store_invalid', 'poisoned object tuples fail closed');
});
