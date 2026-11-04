import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TurnReconciliationStore } from '../src/reconciliation/store.js'
import { ProcessHealthWatch } from '../src/r22-reliability-observability.js'
import { GovernanceEscalationDispatcher } from '../src/r30-escalation.js'
import { executeR28Recovery } from '../src/r28-recovery-state-machine.js'

const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
assert.match(candidateSha, /^[0-9a-f]{40}$/)

test('R33-1 fault persistence restores age and attempts without recount', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'r33-fault-')); const file = join(dir, 'turns.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile: file }); let now = 1000
    const watch = new ProcessHealthWatch({ snapshot: () => [{ agentId: 'agt_a', generation: 4, state: 'AGENT_PROCESS_EXITED' }], alert: async () => {}, now: () => new Date(now), faultStore: store })
    await watch.check(); now += 1000; await watch.check()
    const restartedStore = new TurnReconciliationStore({ persistenceFile: file })
    const restarted = new ProcessHealthWatch({ snapshot: () => [{ agentId: 'agt_a', generation: 4, state: 'AGENT_PROCESS_EXITED' }], alert: async () => {}, now: () => new Date(now), faultStore: restartedStore })
    assert.equal(restarted.openFaultsSnapshot()[0].attempts, 2)
    assert.equal(restarted.openFaultsSnapshot()[0].firstSeenAt, new Date(1000).toISOString())
    await restarted.check(); assert.equal(restarted.openFaultsSnapshot()[0].attempts, 3)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('R33-2 pending escalation survives restart and notification recovery is idempotent', async () => {
  const stored = new Map(); let itemCount = 0; let delivered = false
  const stateStore = { recoveryFaultSnapshot: () => [...stored].map(([key, value]) => ({ key, ...value })), upsertRecoveryFault: (key, value) => stored.set(key, value) }
  const deps = { createGovernanceItem: async () => ({ itemId: `item-${++itemCount}` }), resolveOwner: async () => 'itops-owner', notify: async () => ({ notificationId: 'n1' }), deliveryReceipt: async () => ({ delivered }) }
  const first = new GovernanceEscalationDispatcher({ deps, retries: 3, stateStore })
  const pending = await first.dispatch({ target: 'itops/HUMAN_GATE', agentId: 'agt_a', generation: 4 })
  assert.equal(pending.status, 'NOTIF_PENDING_RETRY'); assert.equal(itemCount, 1)
  const restarted = new GovernanceEscalationDispatcher({ deps, retries: 3, stateStore }); delivered = true
  const notified = await restarted.dispatch({ target: 'itops/HUMAN_GATE', agentId: 'agt_a', generation: 4 })
  assert.equal(notified.status, 'NOTIFIED'); assert.equal(itemCount, 1)
  assert.equal((await restarted.dispatch({ target: 'itops/HUMAN_GATE', agentId: 'agt_a', generation: 4 })).status, 'NOTIFIED')
})

test('R33-3 resumed recovery reuses original receipts without repeating adapters', async () => {
  const entries = []; const calls = { recover: 0, kick: 0, verify: 0, continue: 0 }
  const historyStore = { load: async () => entries.slice(), append: async entry => entries.push(entry) }
  const deps = { historyStore, detect: async () => true, terminationEvidence: async () => ({ agentId: 'agt_a', generation: 4, childRealExit: true, liveOwnership: false, registryCasToken: 'cas' }), recover: async () => { calls.recover++; return { recovered: true, generation: 4, receipt: 'r' } }, escalate: async () => {}, rewakeWorkflow: async () => { calls.kick++; return { workflowInstanceId: 'wf', nodeVisitId: 'visit', workflowStateVersion: 2 } }, verify: async () => { calls.verify++; return { newTurnId: 'turn', workflowEventId: 'event', workflowStateVersion: 2 } }, continueWorkflow: async () => { calls.continue++; return { terminal: true } } }
  await executeR28Recovery({ agentId: 'agt_a', generation: 4, workflow: {}, deps })
  await executeR28Recovery({ agentId: 'agt_a', generation: 4, workflow: {}, deps })
  assert.deepEqual(calls, { recover: 1, kick: 1, verify: 1, continue: 1 })
})

test('R33-4 unsafe generation/ownership refuses recovery and escalates', async () => {
  let recoverCalled = false; const escalations = []
  const result = await executeR28Recovery({ agentId: 'agt_a', generation: 3, workflow: {}, deps: { detect: async () => true, terminationEvidence: async () => ({ agentId: 'agt_a', generation: 2, childRealExit: true, liveOwnership: true, registryCasToken: 'old' }), recover: async () => { recoverCalled = true }, escalate: async event => escalations.push(event) } })
  assert.equal(recoverCalled, false); assert.equal(result.outcome, 'ESCALATED'); assert.equal(escalations[0].target, 'itops/HUMAN_GATE')
})
