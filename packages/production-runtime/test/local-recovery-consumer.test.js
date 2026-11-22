import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLocalRecoveryConsumer } from '../src/local-recovery-consumer.js'

function harness(overrides = {}) {
  const calls = []
  const queue = overrides.queue ?? [{
    eventKey: 'kick:instance-1:visit-1', agentId: 'agt-target', generation: 3,
    ownerActorId: 'agt-health-responsible', recoveryActorId: 'agt-independent-recovery',
  }]
  const diagnostics = {
    register: async item => { calls.push(['diagnostic', item.eventKey]); return { diagnosticId: `d:${item.eventKey}` } },
    recordFailure: async item => calls.push(['failure', item.error.code]),
  }
  const outbox = {
    poll: async () => queue,
    ack: async item => calls.push(['ack', item.eventKey]),
  }
  const readiness = { waitUntilWakeable: async item => calls.push(['wakeable', item.eventKey]) }
  const recovery = {
    takeover: async item => { calls.push(['takeover', item.recoveryActorId]); return { cleared: true } },
    acceptOriginalRole: async item => { calls.push(['accept', item.ownerActorId]); return { accepted: true } },
  }
  const consumer = createLocalRecoveryConsumer({ outbox, diagnostics, readiness, recovery, recoveryActorId: 'agt-independent-recovery', ...overrides })
  return { consumer, calls }
}

test('processes outbox kick without Core, HR, Feishu, or user token dependencies', async () => {
  const { consumer, calls } = harness()
  const result = await consumer.pollOnce()
  assert.equal(result[0].status, 'recovered')
  assert.deepEqual(calls.map(([kind]) => kind), ['diagnostic', 'wakeable', 'takeover', 'accept', 'ack'])
})

test('independent recovery actor is enforced and failure is observable', async () => {
  const { consumer, calls } = harness({ recoveryActorId: 'agt-wrong-recovery' })
  const result = await consumer.pollOnce()
  assert.equal(result[0].status, 'failed')
  assert.equal(result[0].error.code, 'WRONG_RECOVERY_ACTOR')
  assert.deepEqual(calls, [['failure', 'WRONG_RECOVERY_ACTOR']])
})

test('same event key is idempotent and is acked only once', async () => {
  const { consumer, calls } = harness()
  const first = await consumer.pollOnce()
  const second = await consumer.pollOnce()
  assert.equal(first[0].status, 'recovered')
  assert.equal(second[0].status, 'duplicate')
  assert.equal(calls.filter(([kind]) => kind === 'ack').length, 1)
})

test('403 or unavailable takeover is retained for replay and recorded', async () => {
  const { consumer, calls } = harness({ recovery: {
    takeover: async () => { throw Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' }) },
    acceptOriginalRole: async () => ({ accepted: true }),
  } })
  const result = await consumer.pollOnce()
  assert.equal(result[0].status, 'failed')
  assert.equal(result[0].error.code, 'FORBIDDEN')
  assert.deepEqual(calls, [['diagnostic', 'kick:instance-1:visit-1'], ['wakeable', 'kick:instance-1:visit-1'], ['failure', 'FORBIDDEN']])
})

test('owner cannot be used as the recovery actor', async () => {
  const { consumer } = harness({ recoveryActorId: 'agt-health-responsible' })
  await assert.rejects(() => consumer.processItem({
    eventKey: 'x', agentId: 'a', generation: 1,
    ownerActorId: 'agt-health-responsible', recoveryActorId: 'agt-health-responsible',
  }), error => error.code === 'RECOVERY_ACTOR_NOT_INDEPENDENT')
})

test('a failed attempt is replayable after the outbox remains unacked', async () => {
  let attempts = 0
  const base = harness({ recovery: {
    takeover: async () => {
      attempts += 1
      if (attempts === 1) throw Object.assign(new Error('temporarily unavailable'), { code: 'UNAVAILABLE' })
      return { cleared: true }
    },
    acceptOriginalRole: async () => ({ accepted: true }),
  } })
  const first = await base.consumer.pollOnce()
  const second = await base.consumer.pollOnce()
  assert.equal(first[0].status, 'failed')
  assert.equal(second[0].status, 'recovered')
  assert.equal(base.calls.filter(([kind]) => kind === 'ack').length, 1)
})
