import test from 'node:test'
import assert from 'node:assert/strict'
import { RecoveryRecurrenceMonitor, createSafeRecoveryCallback } from '../src/r28-recovery-control.js'

test('safe recovery invokes exact callback only for empty non-owned slot', async () => {
  const recovered = []
  const callback = createSafeRecoveryCallback({
    registrySnapshot: () => [], lifecycleSlotSnapshot: () => ({ state: 'EMPTY' }),
    recover: async input => { recovered.push(input); return 'ok' }, escalate: async () => { throw new Error('unexpected') },
  })
  const result = await callback({ agentId: 'agt_a', generation: 23, reason: 'AGENT_PROCESS_EXITED' })
  assert.equal(result.outcome, 'recovered'); assert.deepEqual(recovered, [{ agentId: 'agt_a', generation: 23 }])
})

test('unsafe recovery escalates and never calls recover', async () => {
  const escalations = []; let called = false
  const callback = createSafeRecoveryCallback({
    registrySnapshot: () => [{ agentId: 'agt_a', alive: true }], lifecycleSlotSnapshot: () => ({ state: 'READY', generation: 23 }),
    recover: async () => { called = true }, escalate: async event => escalations.push(event),
  })
  const result = await callback({ agentId: 'agt_a', generation: 23, reason: 'AGENT_PROCESS_EXITED' })
  assert.equal(result.outcome, 'escalated'); assert.equal(called, false); assert.equal(escalations[0].target, 'itops/HUMAN_GATE')
})

test('recurrence escalates once at threshold', async () => {
  const escalations = []
  const monitor = new RecoveryRecurrenceMonitor({ threshold: 2, escalate: async event => escalations.push(event) })
  await monitor.observe({ agentId: 'agt_a', generation: 23, reason: 'recovery_failed' })
  await monitor.observe({ agentId: 'agt_a', generation: 23, reason: 'recovery_failed' })
  await monitor.observe({ agentId: 'agt_a', generation: 23, reason: 'recovery_failed' })
  assert.equal(escalations.length, 1); assert.equal(escalations[0].target, 'itops/HUMAN_GATE'); assert.equal(escalations[0].count, 2)
})
