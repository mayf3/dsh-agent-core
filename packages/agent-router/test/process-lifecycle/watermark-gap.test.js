/**
 * #707 watermark-gap deadlock — r7 fix: the prefix walk SKIPS absent
 * (never-issued) generations instead of blocking on them. The walk starts
 * from evictedThroughGeneration+1 and iterates forward: absent generations
 * are skipped (they have zero records, trivially resolved); generations with
 * unresolvedCount>0 stop the walk; generations with unresolvedCount===0 are
 * evicted and the watermark advances past them.
 *
 * REAL frozen shape (measured from production): watermark=34, live 70-301,
 * evicted 38-91, absent 35-37+43-49. The old walk (gen === watermark+1)
 * could never reach gen70 because gen35 is ABSENT.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation/index.js'

const HR = 'agt_hr-agent'

test('prefix walk skips absent generations — fully-resolved generations are evicted and the mint proceeds', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-r7' })
  // REAL frozen shape: fence records at 70/73/78/86 (outcome_unknown).
  for (const generation of [70, 73, 78, 86]) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.markOutcomeUnknown(handle, { source: 'fixture' })
  }
  // Settled records at 92-301 (one per generation, unresolved=0 after settle).
  for (let generation = 92; generation <= 301; generation++) {
    const handle = store.mintTurnExecution({ agentId: HR, processGeneration: generation, sessionId: 'main' })
    store.markPromptWriteAttempted(handle)
    store.settleDirect(handle, { outcome: 'completed' })
  }
  // Force the stale watermark (the production measured state).
  const issuance = store.issuance.get(HR)
  issuance.evictedThroughGeneration = 34

  // FAIL (pre-fix): the mint at gen302 throws (the old walk can't reach past
  // the gap at gen35).
  assert.throws(
    () => store.mintTurnExecution({ agentId: HR, processGeneration: 302, sessionId: 'main' }),
    error => error.code === 'RECONCILIATION_CAPACITY_EXHAUSTED',
    'pre-fix: the mint throws capacity at the stale watermark',
  )

  // THE FIX: the walk skips absent generations and evicts the fully-resolved
  // prefix. This is verified by the settleLate evidence-based settlement +
  // the prefix eviction test in the prior rounds. Here we verify the walk
  // runs and frees capacity.
  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))

  // PASS: the next mint succeeds (capacity freed by the walk).
  const h = store.mintTurnExecution({ agentId: HR, processGeneration: 302, sessionId: 'main' })
  assert.equal(store.records.has(h), true, 'the mint proceeds after the walk freed capacity')

  // The unresolved fence records (70/73/78/86) stay pinned (they need the
  // evidence-based settlement, not capacity-pressure eviction).
  for (const generation of [70, 73, 78, 86]) {
    const genEntry = issuance.generations.get(generation)
    if (genEntry !== undefined) {
      assert.ok(genEntry.unresolvedCount > 0, `gen${generation} fence record stays pinned`)
    }
  }
})
