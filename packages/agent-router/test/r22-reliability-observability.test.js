import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMISSION_REJECTION_CODES,
  ProcessHealthWatch,
  sessionInjectionReceipt,
  snapshotAgentProcessHealth,
  structureAdmissionRejection,
} from '../src/r22-reliability-observability.js'

test('process snapshot exposes exited agent instead of silent absence', () => {
  const result = snapshotAgentProcessHealth({
    registrySnapshot: [],
    lifecycleSlotSnapshot: () => ({ state: 'REAP', generation: 4, cause: 'AGENT_PROCESS_EXITED' }),
    agentIds: ['agt_cto'],
  })
  assert.deepEqual(result[0], {
    type: 'agent.process.health', agentId: 'agt_cto', state: 'REAP', generation: 4,
    pid: null, alive: false, cause: 'AGENT_PROCESS_EXITED',
  })
})

test('process snapshot marks a live registry process ready and alive', () => {
  const result = snapshotAgentProcessHealth({
    registrySnapshot: [{ agentId: 'agt_a', pid: 10, alive: true }],
    lifecycleSlotSnapshot: () => ({ state: 'READY', generation: 2 }),
    agentIds: ['agt_a'],
  })
  assert.equal(result[0].state, 'READY_ALIVE'); assert.equal(result[0].alive, true)
})

test('process watch alerts once and invokes controlled recovery on exit', async () => {
  const alerts = []; const recoveries = []
  const watch = new ProcessHealthWatch({
    snapshot: () => [{ agentId: 'agt_a', state: 'AGENT_PROCESS_EXITED', generation: 3 }],
    alert: async event => alerts.push(event), recover: async event => recoveries.push(event),
  })
  await watch.check(); await watch.check()
  assert.equal(alerts.length, 1); assert.deepEqual(recoveries[0], { agentId: 'agt_a', reason: 'AGENT_PROCESS_EXITED', generation: 3 })
})

test('process watch alerts again after a healthy interval', async () => {
  const states = ['AGENT_PROCESS_EXITED', 'READY_ALIVE', 'AGENT_PROCESS_EXITED']; const alerts = []
  const watch = new ProcessHealthWatch({ snapshot: () => [{ agentId: 'agt_a', state: states.shift() }], alert: async event => alerts.push(event) })
  await watch.check(); await watch.check(); await watch.check(); assert.equal(alerts.length, 2)
})

test('admission rejection exposes a stable fence classification', () => {
  const event = structureAdmissionRejection({ requestId: 'r', agentId: 'a', fenceId: 'f', code: 'FENCE_ACTIVE', detail: 'fenced' })
  assert.equal(event.type, 'admission.rejected'); assert.equal(event.fenceId, 'f'); assert.ok(ADMISSION_REJECTION_CODES.includes(event.code))
})

test('admission rejection rejects unknown classifications', () => {
  assert.throws(() => structureAdmissionRejection({ requestId: 'r', agentId: 'a', code: 'UNKNOWN' }), TypeError)
})

test('injection receipt binds transport message to session', () => {
  const event = sessionInjectionReceipt({ requestId: 'r', messageId: 'm', agentId: 'a', sessionId: 's', turnId: 't', status: 'INJECTED' })
  assert.deepEqual(event, { type: 'session.injection_receipt', requestId: 'r', messageId: 'm', agentId: 'a', sessionId: 's', turnId: 't', status: 'INJECTED', at: event.at })
})

test('transport rejection is not an injection success', () => {
  const event = sessionInjectionReceipt({ requestId: 'r', messageId: 'm', agentId: 'a', sessionId: 's', status: 'REJECTED' })
  assert.equal(event.status, 'REJECTED')
})
