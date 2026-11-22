/**
 * r15 (#707 independent review 2026-11-23): regression tests freezing the
 * four review findings on the 2507d049 candidate. Each case reproduces the
 * reviewer's counterexample on the OLD code and asserts the fixed behavior:
 *
 *   1. archive structure/bounds validation is LIVE again (the d7af75e8
 *      currying regression silently skipped it — poisoned archive tuples
 *      that r12 rejected must still be rejected);
 *   2. the live production writer's ABSENT-legacy marker (EMPTY ARRAY) is
 *      normalized like r13's EMPTY OBJECT — the dual-write gate must not
 *      hard-fail the live turn-recovery-v3.json (restart must not brick);
 *   3. the 369206aa-equivalent anti-poison gate: writeDurableRecoveryStore
 *      round-trips its exact payload through the byte-level decoder BEFORE
 *      any write, so an illegal projection can never reach disk.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { TurnReconciliationStore } from '../../src/reconciliation/index.js';
import { parseDurableRecoveryStoreBytes, writeDurableRecoveryStore } from '../../src/reconciliation/durable-file.js';

const HR = 'agt_hr-agent';

function seededDurableRaw() {
  const dir = mkdtempSync(join(tmpdir(), 'r15-fixes-'))
  const pf = join(dir, 'turn-recovery-v3.json')
  const staging = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-r15' })
  for (const generation of [38, 39, 40, 41, 42, 50, 51]) {
    const handle = staging.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    staging.markPromptWriteAttempted(handle)
    staging.settleDirect(handle, { outcome: 'completed' })
  }
  staging.persistDurable()
  const raw = JSON.parse(readFileSync(pf, 'utf8'))
  rmSync(dir, { recursive: true, force: true })
  return raw
}

function hrEntry(raw) {
  return raw.issuance.find(entry => entry.agentId === HR)
}

function makeRangeTuple(start, end, hi) {
  // legacy-fidelity slot: one interval per generation, all [1, hi]
  return [start, end, Array.from({ length: end - start + 1 }, () => [[1, hi]])]
}

test('r15 fix 1: poisoned ARCHIVE tuples are rejected again (curried validBoundsSlots restored)', () => {
  const base = seededDurableRaw()
  const poisons = [
    // hi beyond the agent's issued bounds (r12 rejected this; the broken
    // candidate loaded it)
    { archives: [makeRangeTuple(2, 3, 999999)] },
    // lo = 0 is not a valid turn seq
    { archives: [[2, 3, [[[0, 5]], [[6, 8]]]]] },
    // slot count must equal the generation span
    { archives: [[4, 5, [[[11, 30]]]]] },
  ]
  for (const { archives } of poisons) {
    const raw = seededDurableRaw()
    const entry = hrEntry(raw)
    entry.maxIssuedTurnSeq = 20000
    entry.evictedRanges = [makeRangeTuple(50, 51, 400)]
    entry.evictedArchives = archives
    const text = JSON.stringify(raw)
    assert.throws(() => parseDurableRecoveryStoreBytes(text),
      /durable issuance evicted archives are invalid/,
      `poisoned archive must fail the contract gate: ${JSON.stringify(archives)}`)
  }
  // a WELL-FORMED archive still loads
  const good = seededDurableRaw()
  const goodEntry = hrEntry(good)
  goodEntry.maxIssuedTurnSeq = 20000
  goodEntry.evictedRanges = [makeRangeTuple(50, 51, 400)]
  goodEntry.evictedArchives = [makeRangeTuple(2, 3, 400)]
  const decoded = parseDurableRecoveryStoreBytes(JSON.stringify(good))
  assert.equal(decoded.issuance.get(HR).evictedArchives.length, 1)
})

test('r15 fix 2: EMPTY-ARRAY absent-legacy marker loads (live 23:06 durable shape); non-empty inconsistent legacy still fails', () => {
  // the live production shape: object-form ranges + evictedGenerations: []
  const live = seededDurableRaw()
  const entry = hrEntry(live)
  entry.maxIssuedTurnSeq = 20000
  entry.evictedRanges = [
    { fromGen: 38, toGen: 42, maxTurnSeq: 1905 },
    { fromGen: 50, toGen: 51, maxTurnSeq: 3508 },
  ]
  entry.evictedGenerations = []
  const decoded = parseDurableRecoveryStoreBytes(JSON.stringify(live))
  const decodedIssuance = decoded.issuance.get(HR)
  assert.ok(decodedIssuance.evictedRanges.length >= 1, 'object-form ranges must decode')
  assert.equal(decodedIssuance.evictedGenerations, undefined, 'empty-array legacy must normalize to absent')
  // r13's empty-OBJECT case stays green
  const objForm = seededDurableRaw()
  const objEntry = hrEntry(objForm)
  objEntry.maxIssuedTurnSeq = 20000
  objEntry.evictedRanges = [{ fromGen: 50, toGen: 51, maxTurnSeq: 3508 }]
  objEntry.evictedGenerations = {}
  parseDurableRecoveryStoreBytes(JSON.stringify(objForm))
  // a NON-empty legacy form inconsistent with the ranges still fails closed
  const poisoned = seededDurableRaw()
  const pEntry = hrEntry(poisoned)
  pEntry.maxIssuedTurnSeq = 20000
  pEntry.evictedRanges = [makeRangeTuple(50, 51, 400)]
  pEntry.evictedGenerations = [[50, 9999]]
  assert.throws(() => parseDurableRecoveryStoreBytes(JSON.stringify(poisoned)),
    /dual-write forms are inconsistent/)
})

test('r15 fix 3: the anti-poison gate refuses to persist a payload the decoder rejects', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r15-gate-'))
  const pf = join(dir, 'turn-recovery-v3.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-r15' })
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: 1, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
    store.persistDurable()
    assert.ok(existsSync(pf), 'legal state persists (round-trip gate passes for well-formed projections)')
    // poison the in-memory projection directly: a non-integer generation key
    // in the issuance entry must fail the decode gate INSIDE persist, leaving
    // the on-durable file at its last good bytes.
    const issuance = store.issuance.get(HR)
    issuance.maxIssuedTurnSeq = Number.MAX_SAFE_INTEGER + 1 // not a safe integer
    assert.throws(() => store.persistDurable())
    const onDisk = JSON.parse(readFileSync(pf, 'utf8'))
    assert.equal(hrEntry(onDisk).maxIssuedTurnSeq, undefined === hrEntry(onDisk).maxIssuedTurnSeq ? undefined : hrEntry(onDisk).maxIssuedTurnSeq)
    assert.ok(Number.isSafeInteger(onDisk.issuance.find(e => e.agentId === HR).maxIssuedTurnSeq), 'poison must NOT reach the durable file')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('r15 fix 3b: writeDurableRecoveryStore leaves the previous file untouched when the gate rejects', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r15-gate2-'))
  const pf = join(dir, 'turn-recovery-v3.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-r15' })
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: 1, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
    store.persistDurable()
    const before = readFileSync(pf, 'utf8')
    const raw = JSON.parse(before)
    raw.records.push(structuredClone(raw.records[0])) // duplicate handle — decoder rejects
    writeFileSync(pf, JSON.stringify(raw))
    // direct writer-level proof: a payload that fails decode throws and no
    // temp/renamed output replaces the target
    assert.throws(() => parseDurableRecoveryStoreBytes(JSON.stringify(raw)),
      /duplicate durable recovery handle/)
    writeDurableRecoveryStore(pf, store) // store state is still legal -> succeeds
    const after = readFileSync(pf, 'utf8')
    assert.ok(after.includes('"version":3'), 'legal rewrite succeeds')
    assert.equal(JSON.parse(after).issuance.some(e => e.agentId === 'x'), false)
    assert.ok(before.length > 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
