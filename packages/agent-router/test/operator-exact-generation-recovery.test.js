import test from 'node:test'
import assert from 'node:assert/strict'
import { operatorExactGenerationRecovery } from '../src/operator-exact-generation-recovery.js'

function deps({ slot = { state: 'EMPTY' }, records = [{ handle: 'h1', agentId: 'agt_a', processGeneration: 23 }] } = {}) {
  let cleared = false
  const auditEvents = []
  return {
    auditEvents,
    reconciliationStore: {
      unresolvedRecoveryRecords: () => records,
      markFenceCleared: () => { cleared = true; return true },
      activeFenceForAgent: () => cleared ? null : 'h1',
    },
    registrySnapshot: () => [],
    lifecycleSlotSnapshot: () => slot,
    ensureRunning: async agentId => ({ pid: 4242, agentId }),
    audit: async event => auditEvents.push(event),
  }
}

test('fence-active exact generation recovery clears fence and spawns one target agent', async () => {
  const d = deps()
  const result = await operatorExactGenerationRecovery({ agentId: 'agt_a', generation: 23 }, d)
  assert.equal(result.result, 'recovered')
  assert.equal(result.process.pid, 4242)
  assert.deepEqual(d.auditEvents.map(event => event.result), ['fence_cleared', 'spawned'])
})

test('generation mismatch refuses recovery and cannot clear fence', async () => {
  const d = deps()
  await assert.rejects(
    () => operatorExactGenerationRecovery({ agentId: 'agt_a', generation: 22 }, d),
    error => error.code === 'RECOVERY_RECORD_NOT_FOUND',
  )
  assert.equal(d.auditEvents[0].reason, 'RECOVERY_RECORD_NOT_FOUND')
})

test('live ownership refuses recovery before fence mutation', async () => {
  const d = deps({ slot: { state: 'READY', generation: 23 } })
  await assert.rejects(
    () => operatorExactGenerationRecovery({ agentId: 'agt_a', generation: 23 }, d),
    error => error.code === 'LIVE_GENERATION_OWNERSHIP',
  )
  assert.equal(d.auditEvents[0].reason, 'LIVE_GENERATION_OWNERSHIP')
})

test('ambiguous or fuzzy operator requests are rejected', async () => {
  const d = deps()
  await assert.rejects(() => operatorExactGenerationRecovery({ agentId: 'all', generation: 23 }, d), /exact canonical/)
  await assert.rejects(() => operatorExactGenerationRecovery({ agentId: 'agt_a', generation: 23, all: true }, d), /exactly agentId and generation/)
})
