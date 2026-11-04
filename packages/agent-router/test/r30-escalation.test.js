import test from 'node:test'
import assert from 'node:assert/strict'
import { GovernanceEscalationDispatcher } from '../src/r30-escalation.js'
import { executeR28Recovery } from '../src/r28-recovery-state-machine.js'

test('escalation persists governance item, resolves owner, notifies and confirms receipt', async () => {
  const calls = []
  const dispatcher = new GovernanceEscalationDispatcher({ deps: {
    createGovernanceItem: async event => { calls.push('item'); return { itemId: 'i1', event } },
    resolveOwner: async () => { calls.push('owner'); return 'itops-owner' },
    notify: async () => { calls.push('notify'); return { notificationId: 'n1' } },
    deliveryReceipt: async () => { calls.push('receipt'); return { delivered: true, receiptId: 'r1' } },
  } })
  const result = await dispatcher.dispatch({ target: 'itops/HUMAN_GATE', agentId: 'agt_a', generation: 1 })
  assert.equal(result.delivered, true); assert.deepEqual(calls, ['item', 'owner', 'notify', 'receipt'])
})

test('recovery history store is used on every state receipt', async () => {
  const entries = []; const historyStore = { load: async () => entries.slice(), append: async entry => entries.push(entry) }
  await executeR28Recovery({ agentId: 'agt_a', generation: 1, workflow: {}, deps: {
    historyStore, detect: async () => false,
    terminationEvidence: async () => ({}), recover: async () => ({}), escalate: async () => {},
  } })
  assert.equal(entries[0].state, 'DETECT'); assert.equal(entries.length, 1)
})

test('three notification failures remain pending and retry idempotently', async () => {
  const stored = new Map(); let notifications = 0; let items = 0
  const stateStore = {
    recoveryFaultSnapshot: () => [...stored].map(([key, value]) => ({ key, ...value })),
    upsertRecoveryFault: (key, value) => stored.set(key, value),
  }
  const dispatcher = new GovernanceEscalationDispatcher({ stateStore, retries: 3, deps: {
    createGovernanceItem: async () => ({ itemId: `i${++items}` }),
    resolveOwner: async () => 'itops-owner',
    notify: async () => ({ notificationId: `n${++notifications}` }),
    deliveryReceipt: async () => ({ delivered: false }),
  } })
  const first = await dispatcher.dispatch({ target: 'itops/HUMAN_GATE', agentId: 'agt_a', generation: 1 })
  assert.equal(first.status, 'NOTIF_PENDING_RETRY'); assert.equal(items, 1); assert.equal(stored.get('escalation:agt_a:1').status, 'NOTIF_PENDING_RETRY')
  dispatcher.deps.deliveryReceipt = async () => ({ delivered: true, receiptId: 'r1' })
  const second = await dispatcher.dispatch({ target: 'itops/HUMAN_GATE', agentId: 'agt_a', generation: 1 })
  assert.equal(second.status, 'NOTIFIED'); assert.equal(items, 1); assert.equal(stored.get('escalation:agt_a:1').status, 'NOTIFIED')
  const third = await dispatcher.dispatch({ target: 'itops/HUMAN_GATE', agentId: 'agt_a', generation: 1 })
  assert.equal(third.status, 'NOTIFIED'); assert.equal(items, 1)
})
