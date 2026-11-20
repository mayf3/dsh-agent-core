/**
 * #707 QA round-4/5 watermark-gap deadlock — the r7 watermark-merge fix:
 * compactIssuanceWatermark absorbs proven fully-evicted / never-issued
 * generations into evictedThroughGeneration, so the contiguity filter
 * reaches the modern-era live generations again.
 *
 * REAL frozen shape (measured from the production durable file):
 *   - evictedThroughGeneration = 34
 *   - live generations 70-301 (213, all unresolved=0 except gen70/73/78/86 =1)
 *   - evictedGenerations 38-42 + 50-69 subset (25)
 *   - generations 35-37, 43-49 ABSENT (never issued)
 *   - the old contiguity filter (gen === 34+1 = 35, ABSENT) → candidate
 *     undefined → every mint throws capacity forever
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation/index.js'

const HR = 'agt_hr-agent'

test('r7 watermark-merge: the real frozen shape — compaction absorbs the gap, the walk frees capacity, the mint proceeds', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-gap' })
  for (let generation = 92; generation <= 301; generation++) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  for (const generation of [70, 73, 78, 86]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.markOutcomeUnknown(handle, { source: 'fixture' })
  }
  const issuance = store.issuance.get(HR)
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

  assert.throws(
    () => store.mintTurnExecution({ agentId: HR, processGeneration: 302, sessionId: 'main' }),
    error => error.code === 'RECONCILIATION_CAPACITY_EXHAUSTED',
  )

  // The Owner-authorised resolution: declare the full backlog with the
  // explicit risk acceptance → the fence records become releasable.
  const result = store.declareAdminAbandonment({ agentId: HR, declarationId: 'gap-decl', ownerRiskAcceptance: true })
  assert.ok(result.abandonedHandles.length >= 4, 'the fences are in scope')

  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))
  assert.ok(issuance.evictedThroughGeneration >= 92,
    `the watermark absorbed the gap and the settled prefix (now ${issuance.evictedThroughGeneration})`)

  const h = store.mintTurnExecution({ agentId: HR, processGeneration: 302, sessionId: 'main' })
  assert.equal(store.records.has(h), true)
})

test('r7: gen73/78/86 (marker-only, no audit) pin the walk honestly', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-gap-2' })
  for (const generation of [70, 73, 78, 86]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.markOutcomeUnknown(handle, { source: 'fixture' })
  }
  for (let generation = 92; generation <= 100; generation++) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  const issuance = store.issuance.get(HR)
  issuance.evictedThroughGeneration = 34
  for (const [g, maxSeq] of [[38, 1382], [42, 1905], [50, 1940], [69, 3508]]) {
    issuance.evictedGenerations.set(g, maxSeq)
  }

  store.declareAdminAbandonment({ agentId: HR, declarationId: 'gap-marker-only' })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'gap-accepted', ownerRiskAcceptance: true })

  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))
  assert.equal(issuance.evictedThroughGeneration, 69,
    'the compaction absorbed the gap but the walk stops at the marker-only generation')
  // The gen70 fence (marker-only) pins the walk — nothing past it is evicted.
  // The settled generations 92+ are still live because the walk can't reach
  // past the quarantined gen70 record.
  assert.equal(store.records.has(correlated), true, 'the marker-only fence stays')
})
