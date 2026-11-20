/**
 * RECONCILIATION_ABANDONED_EVICTION_V1 (#707 structural slice) — capacity
 * recovery for declaration-abandoned generations:
 *
 *   - r0 deadlock (frozen): with generations full of stuck-but-ABANDONED
 *     turns (unresolvedCount zeroed by the declaration), a NEW-generation
 *     mint still threw RECONCILIATION_CAPACITY_EXHAUSTED forever, because
 *     evictSettledGenerationForCapacity only evicted `state === 'settled'`
 *     records — abandoned records (state pending, outcome UNKNOWN, owner
 *     risk accepted) had no eviction path and pinned their generation entry.
 *   - r1 fix: the contiguous-prefix walk also evicts declaration-abandoned
 *     records via the store's OWN evictRecord machinery — the outcome stays
 *     UNKNOWN and resolves as `evicted` through the watermarks (never as a
 *     business settled; no bare deletion outside the bounded machinery).
 *   - Idempotency: eviction is watermark-driven; re-walks are no-ops.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation/index.js'

const HR = 'agt_hr-agent'

function stuckTurn(store, agentId, { generation = 1 } = {}) {
  const handle = store.mintTurnExecution({ agentId, processGeneration: generation, sessionId: 'main' })
  store.markPromptWriteAttempted(handle)
  store.markOutcomeUnknown(handle, { source: 'unit-fixture' })
  return handle
}

test('r0 deadlock frozen: at the 256 generation cap, a NEW-generation mint throws even though every record is declaration-abandoned... then r1 frees it', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-cap' })
  for (let generation = 1; generation <= 256; generation++) stuckTurn(store, HR, { generation })
  assert.throws(
    () => stuckTurn(store, HR, { generation: 257 }),
    error => error.code === 'RECONCILIATION_CAPACITY_EXHAUSTED',
    'pre-fix behavior: the cap throws once full',
  )

  // Owner risk-accepted abandonment zeroes unresolvedCount for every
  // generation (the existing declaration semantics — store.js unresolved
  // zeroing at application).
  const result = store.declareAdminAbandonment({
    agentId: HR, declarationId: 'cap-decl-1', ownerRiskAcceptance: true,
  })
  assert.ok(result.abandonedHandles.length >= 256, `expected the full backlog abandoned, got ${result.abandonedHandles.length}`)

  // r1: the next NEW-generation mint SUCCEEDS — the contiguous abandoned
  // prefix is evicted through the store's own machinery, freeing capacity.
  const h257 = stuckTurn(store, HR, { generation: 257 })
  assert.equal(h257.split(':')[3], 'g257')
  assert.equal(store.records.has(h257), true)
})

test('evicted abandoned records keep UNKNOWN and resolve as evicted — never as a business settled', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-cap-2' })
  const firstStuck = stuckTurn(store, HR, { generation: 1 })
  for (let generation = 2; generation <= 256; generation++) stuckTurn(store, HR, { generation })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'cap-decl-2', ownerRiskAcceptance: true })
  stuckTurn(store, HR, { generation: 257 })

  const snapshot = store.getTurnReconciliation(firstStuck)
  assert.equal(snapshot.state, 'evicted', 'the abandoned record resolves via the eviction watermark')
  assert.notEqual(snapshot.state, 'settled', 'abandonment must never become a business settled')
})

test('eviction is idempotent and keeps the audit linkage on the declaration registry', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-cap-3' })
  for (let generation = 1; generation <= 256; generation++) stuckTurn(store, HR, { generation })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'cap-decl-3', ownerRiskAcceptance: true })
  stuckTurn(store, HR, { generation: 257 })

  // Re-declare with the SAME id: retry stays possible, nothing re-stamps.
  const repeat = store.declareAdminAbandonment({ agentId: HR, declarationId: 'cap-decl-3', ownerRiskAcceptance: true })
  assert.deepEqual(repeat.abandonedHandles, [])
})
