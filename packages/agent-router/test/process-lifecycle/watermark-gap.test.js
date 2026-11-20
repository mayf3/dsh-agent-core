/**
 * #707 QA round-4/5 watermark-gap deadlock — r7 revised fix.
 *
 * The candidate is the OLDEST LIVE generation with unresolvedCount === 0
 * (no contiguity requirement). Never-issued generations (absent from
 * `generations`) are naturally skipped. The evictedThroughGeneration
 * watermark is NOT advanced past never-issued generations — preserving
 * never_existed for their handles.
 *
 * REAL frozen shape (measured from production): watermark=34, live 70-301,
 * evicted 38-42+50-69 subset, absent 35-37+43-49.
 *
 * Coverage matrix (QA-mandated): new mint, same-correlation CONFLICT,
 * old handle query semantics, cross-restart, unknown no-replay,
 * long-term capacity bounded.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation/index.js'

const HR = 'agt_hr-agent'

async function freshPersistentStore(t, epoch) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-wmgap-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const pf = join(dir, 'recovery.json')
  return { store: new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: epoch }), pf }
}

function buildFrozenShape(store) {
  // 4 fence records (70/73/78/86) — outcome_unknown
  for (const generation of [70, 73, 78, 86]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.markOutcomeUnknown(handle, { source: 'fixture' })
  }
  // 210 settled records (92-301) — settleDirect (the 219-class: state=settled, io=null)
  for (let generation = 92; generation <= 301; generation++) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  // Freeze the production watermark + evicted gap
  issuance.evictedThroughGeneration = 34
  for (const [g, maxSeq] of [[38, 1382], [39, 1383], [40, 1384], [41, 1776], [42, 1905],
    [50, 1940], [51, 2053], [52, 2095], [53, 2402], [54, 2544], [55, 2545], [56, 2546],
    [57, 2656], [58, 2997], [59, 3005], [60, 3006], [61, 3017], [62, 3023], [63, 3028],
    [64, 3048], [65, 3050], [66, 3119], [67, 3198], [68, 3478], [69, 3508],
    [71, 3510], [72, 3520], [74, 3530], [75, 3540], [76, 3550], [77, 3560],
    [79, 3570], [80, 3580], [81, 3590], [82, 3600], [83, 3610], [84, 3620],
    [85, 3630], [87, 3640], [88, 3650], [89, 3660], [90, 3670], [91, 3680]]) {
    issuance.evictedGenerations.set(g, maxSeq)
  }
  return issuance
}

test('FAIL→PASS: the frozen shape (watermark 34, gap 35-69, live 70-301) — mint succeeds after the walk', async (t) => {
  const { store, pf } = await freshPersistentStore(t, 'epoch-wmgap')
  buildFrozenShape(store)
  const issuance = store.issuance.get(HR)

  // FAIL (pre-fix): the mint at gen 302 throws
  assert.throws(
    () => store.mintTurnExecution({ agentId: HR, processGeneration: 302, sessionId: 'main' }),
    error => error.code === 'RECONCILIATION_CAPACITY_EXHAUSTED',
  )

  // The Owner-authorized resolution: declare the backlog with acceptance
  const result = store.declareAdminAbandonment({ agentId: HR, declarationId: 'wmgap-decl', ownerRiskAcceptance: true })
  assert.ok(result.abandonedHandles.length >= 4)

  // PASS: the walk + the mint proceed
  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))
  const h = store.mintTurnExecution({ agentId: HR, processGeneration: 302, sessionId: 'main' })
  assert.equal(store.records.has(h), true)
})

test('never_existed negative control: a fabricated g35 handle keeps never_existed after eviction', async (t) => {
  const { store, pf } = await freshPersistentStore(t, 'epoch-wmgap-ne')
  buildFrozenShape(store)
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'ne-decl', ownerRiskAcceptance: true })
  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))

  // A fabricated g35 handle (never issued): must stay never_existed
  const fabricated = store.records.keys().next().value // any handle from the live set for epoch ref
  const epoch = fabricated.split(':')[1]
  const fakeHandle = `turn:${epoch}:a2:g35:s100`
  const snap = store.getTurnReconciliation(fakeHandle)
  assert.equal(snap.state, 'never_existed', 'a never-issued generation handle stays never_existed')

  // A real evicted handle (e.g. from gen92, now evicted): must be evicted
  const gen92Handle = [...store.records.keys()].length > 0
    ? null : null // the settled gen92 records were evicted
  // Instead, mint one first and then evict it
  const h92 = store.mintTurnExecution({ agentId: HR, processGeneration: 302, sessionId: 'main' })
  store.markPromptWriteAttempted(h92)
  store.settleDirect(h92, { outcome: 'completed' })
  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))
  const snap92 = store.getTurnReconciliation(h92)
  assert.equal(snap92.state, 'evicted', 'a real settled+evicted handle resolves as evicted')
})

test('cross-restart: capacity recovery + no-replay survive the durable round-trip', async (t) => {
  const { store, pf } = await freshPersistentStore(t, 'epoch-wmgap-cr')
  buildFrozenShape(store)
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'cr-decl', ownerRiskAcceptance: true })
  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))
  store.persistDurable()

  // Restart
  const store2 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-wmgap-cr2' })
  assert.equal(store2.startupBlockedReason ?? null, null, 'restart is admission-ready')

  // Capacity is freed: a new mint succeeds
  const h = store2.mintTurnExecution({ agentId: HR, processGeneration: 302, sessionId: 'main' })
  assert.equal(store2.records.has(h), true)

  // Long-term capacity bounded: after the walk, the generation count is well under 256
  const iss = store2.issuance.get(HR)
  const totalGens = iss.generations.size + iss.evictedGenerations.size
  assert.ok(totalGens < 256, `generation count bounded: ${totalGens} < 256`)
})

test('no-replay: same-correlation CONFLICT across the eviction and restart', async (t) => {
  const { store, pf } = await freshPersistentStore(t, 'epoch-wmgap-nr')
  buildFrozenShape(store)
  const correlated = store.mintTurnExecution({ agentId: HR, processGeneration: 92, sessionId: 'main',
    callerCorrelation: { requestId: 'req-nr-1' } })
  store.markPromptWriteAttempted(correlated)
  store.markOutcomeUnknown(correlated, { source: 'fixture' })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'nr-decl', ownerRiskAcceptance: true })
  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))
  store.persistDurable()

  // Same correlation in-memory: CONFLICT
  assert.throws(
    () => store.mintTurnExecution({ agentId: HR, processGeneration: 999, sessionId: 'main',
      callerCorrelation: { requestId: 'req-nr-1' } }),
    error => error.code === 'RECONCILIATION_CORRELATION_CONFLICT',
  )
  // Same correlation across restart: CONFLICT
  const store2 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-wmgap-nr2' })
  assert.throws(
    () => store2.mintTurnExecution({ agentId: HR, processGeneration: 999, sessionId: 'main',
      callerCorrelation: { requestId: 'req-nr-1' } }),
    error => error.code === 'RECONCILIATION_CORRELATION_CONFLICT',
  )
})
