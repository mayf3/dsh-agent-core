import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { makeFx } from './helpers.js'

test('V3 parsed terminal and child exit remain uncommitted together when durable settlement fails', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-atomic-exit-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-atomic-exit' })
    const fx = makeFx({ deadlines: { turnTimeoutMs: 70 } })
    fx.proc.store = store
    fx.store = store
    await fx.readyNow()
    const turn = fx.proc.turn('main', 'atomic exit fixture', {}, 25)
    await fx.tick()
    fx.respondTo('session/prompt', { messageId: 'm-atomic-exit' })
    const unknown = await new Promise((resolve, reject) => turn.then(reject, resolve))
    assert.equal(unknown.status, 'outcome_unknown')
    fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
    fx.emitEvent('main', { type: 'user/message', data: { id: 'm-atomic-exit' } })
    fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })

    const originalPersist = store.persistDurable.bind(store)
    store.persistDurable = () => { throw new Error('injected durable settlement failure') }
    assert.throws(() => fx.childExit(0, null), /injected durable settlement failure/)
    store.persistDurable = originalPersist

    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-after-atomic-failure' })
    const snapshot = reopened.getTurnReconciliation(unknown.reconciliationHandle).snapshot
    assert.equal(snapshot.lateOutcome, null)
    assert.equal(snapshot.exitObservedAt, null)
    assert.notEqual(snapshot.settlementResult, 'terminated_without_outcome')
    assert.equal(snapshot.fenceState, 'active')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 over-cap durable record keeps startup business admission fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-cap-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-cap' })
    first.mintTurnExecution({ agentId: 'agt_cap', processGeneration: 1, sessionId: 'main' })
    const durable = JSON.parse(readFileSync(persistenceFile, 'utf8'))
    durable.records[0].finalAssistantOutput = {
      text: 'x'.repeat(1_200_000), truncated: false, originalBytes: 1_200_000,
    }
    writeFileSync(persistenceFile, JSON.stringify(durable), 'utf8')

    const reopened = new TurnReconciliationStore({ persistenceFile })
    assert.deepEqual(reopened.businessAdmissionStatus(), {
      ready: false, reason: 'durable_store_invalid',
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 unavailable durable path keeps startup business admission fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-unavailable-'))
  const blockedParent = join(root, 'not-a-directory')
  writeFileSync(blockedParent, 'file', 'utf8')
  try {
    const store = new TurnReconciliationStore({ persistenceFile: join(blockedParent, 'turn-recovery.json') })
    assert.deepEqual(store.businessAdmissionStatus(), {
      ready: false, reason: 'durable_store_unavailable',
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})


function outerIngressHarness(reconciliationStore) {
  let executions = 0
  const delivery = createIngressDelivery({
    log: { log() {}, error() {} },
    feishu: undefined,
    workspaceBootstrap: { async ensureWorkspace() {} },
    store: {},
    reconciliationStore,
    routeChain: {
      async runTurnWithRouteChain() {
        executions += 1
        return { reply: 'must not run' }
      },
    },
    resolveAgentRef() { throw new Error('not used') },
    resolveAgentById() { throw new Error('not used') },
    async resolveChannelConversation() {
      return {
        channelConversation: { id: 'feishu:oc_recovery' },
        binding: { activeAgentId: 'agt_durable', activeSessionId: 'main' },
      }
    },
    resolveEffectiveWorkspace() { return { workspaceId: null, workspacePath: '/tmp/agt-durable' } },
  })
  return { delivery, executions: () => executions }
}

test('V3 restored durable fence blocks the real outer entry with closed structured diagnostics', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-outer-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-outer' })
    const handle = first.mintTurnExecution({ agentId: 'agt_durable', processGeneration: 9, sessionId: 'main' })
    first.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'req-9-1', deadlineAtWallMs: Date.now() + 10_000 })
    first.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })

    const reopened = new TurnReconciliationStore({ persistenceFile })
    reopened.markRecoveryBlocked(handle, ['live_generation_ownership'], 'runtime_restart_ownership_unavailable')
    const fx = outerIngressHarness(reopened)
    const result = await fx.delivery.onIngress({
      channel: 'group', chatId: 'oc_recovery', conversationId: 'oc_recovery',
      messageId: 'om_new_rejected', sender: { openId: 'ou_test' }, text: 'new request while fenced',
    })

    assert.equal(fx.executions(), 0)
    assert.equal(result.failureStage, 'admission')
    assert.equal(result.fencedBy, handle)
    assert.equal(result.reconciliationHandle, handle)
    assert.equal(result.processGeneration, 9)
    assert.equal(result.requestAdmission, 'not_admitted')
    assert.equal(result.replyDelivery, 'not_attempted')
    assert.equal(result.partialDelivery, 'none')
    assert.deepEqual(result.missingEvidence, ['live_generation_ownership'])
    assert.equal(result.nextSafeAction, 'reestablish_exact_ownership')
    assert.ok(result.attemptedActions.some(action => action.action === 'ownership_check'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 invalid durable store blocks the real outer entry before route execution', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-outer-invalid-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    writeFileSync(persistenceFile, '[]', 'utf8')
    const store = new TurnReconciliationStore({ persistenceFile })
    const fx = outerIngressHarness(store)
    const result = await fx.delivery.onIngress({
      channel: 'group', chatId: 'oc_recovery', conversationId: 'oc_recovery',
      messageId: 'om_blocked', sender: { openId: 'ou_test' }, text: 'must not admit',
    })
    assert.equal(fx.executions(), 0)
    assert.deepEqual(Object.keys(result).sort(), [
      'attemptedActions', 'failureStage', 'fencedBy', 'missingEvidence',
      'nextSafeAction', 'partialDelivery', 'processGeneration', 'reconciliationHandle',
      'replyDelivery', 'requestAdmission', 'terminationEvidence',
    ])
    assert.equal(result.requestAdmission, 'not_admitted')
    assert.equal(result.replyDelivery, 'not_attempted')
    assert.equal(result.partialDelivery, 'none')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 old-generation cleanup cannot clear a newer generation fence', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-stale' })
  const oldHandle = store.mintTurnExecution({ agentId: 'agt_stale', processGeneration: 1, sessionId: 'main' })
  store.markAdmitted(oldHandle, { eventWatermarkSeq: 0, promptRequestId: 'old', deadlineAtWallMs: Date.now() })
  store.markOutcomeUnknown(oldHandle, { source: 'turn_deadline_exceeded' })
  const newHandle = store.mintTurnExecution({ agentId: 'agt_stale', processGeneration: 2, sessionId: 'main' })
  store.markAdmitted(newHandle, { eventWatermarkSeq: 0, promptRequestId: 'new', deadlineAtWallMs: Date.now() })
  store.markOutcomeUnknown(newHandle, { source: 'turn_deadline_exceeded' })

  store.settleLate(oldHandle, { lateOutcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit' })
  store.markFenceCleared(oldHandle)
  assert.equal(store.activeFenceForAgent('agt_stale').handle, newHandle)
  assert.equal(store.getTurnReconciliation(newHandle).state, 'pending')
})
