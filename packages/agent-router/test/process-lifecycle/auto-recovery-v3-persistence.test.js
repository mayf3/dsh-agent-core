import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { createIngressDelivery } from '../../src/ingress-delivery.js'

test('V3 durable unknown reservation and fence survive a store reopen', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-v3' })
    const handle = first.mintTurnExecution({
      agentId: 'agt_durable', processGeneration: 7, sessionId: 'main',
    })
    first.markAdmitted(handle, {
      eventWatermarkSeq: 0,
      promptRequestId: 'req-7-1',
      deadlineAtWallMs: Date.now() + 60_000,
    })
    first.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })

    const durable = JSON.parse(readFileSync(persistenceFile, 'utf8'))
    assert.equal(durable.version, 3)
    assert.equal(durable.records[0].turnExecutionId, handle)
    assert.equal(durable.records[0].reconciliationHandle, handle)
    assert.equal(durable.records[0].state, 'pending_unknown')
    assert.ok(Number.isSafeInteger(durable.records[0].updatedAt))
    assert.ok(durable.records[0].updatedAt >= durable.records[0].createdAt)
    assert.deepEqual(durable.records[0].missingEvidence, [
      'exact_terminal', 'exact_turn_idle', 'child_real_exit',
    ])

    const reopened = new TurnReconciliationStore({ persistenceFile })
    const query = reopened.getTurnReconciliation(handle)
    assert.equal(query.state, 'pending')
    assert.equal(query.snapshot.recoveryState, 'pending_unknown')
    assert.equal(reopened.activeFenceForAgent('agt_durable').handle, handle)
    assert.equal(reopened.businessAdmissionStatus().ready, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 restart mints a fresh runtime epoch while old durable handles remain queryable', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-epoch-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-before-restart' })
    const oldHandle = first.mintTurnExecution({ agentId: 'agt_epoch', processGeneration: 1, sessionId: 'main' })
    first.markAdmitted(oldHandle, { eventWatermarkSeq: 0, promptRequestId: 'old', deadlineAtWallMs: Date.now() + 1000 })
    first.markOutcomeUnknown(oldHandle, { source: 'turn_deadline_exceeded' })

    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-after-restart' })
    assert.equal(reopened.runtimeEpoch, 'epoch-after-restart')
    assert.equal(reopened.getTurnReconciliation(oldHandle).state, 'pending')
    const newHandle = reopened.mintTurnExecution({ agentId: 'agt_epoch', processGeneration: 2, sessionId: 'main' })
    assert.match(newHandle, /^turn:epoch-after-restart:/)
    assert.equal(reopened.getTurnReconciliation(oldHandle).state, 'pending')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 restart converts a crash-interrupted prompt write into a durable blocked fence', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-write-crash-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-write' })
    const handle = first.mintTurnExecution({ agentId: 'agt_write_crash', processGeneration: 3, sessionId: 'main' })
    first.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'write', deadlineAtWallMs: Date.now() + 1000 })
    first.markPromptWriteAttempted(handle)

    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-restarted' })
    const query = reopened.getTurnReconciliation(handle)
    assert.equal(query.state, 'recovering')
    assert.equal(query.snapshot.initialOutcome, 'outcome_unknown')
    assert.equal(query.snapshot.recoveryState, 'blocked')
    assert.deepEqual(query.snapshot.missingEvidence, ['live_generation_ownership'])
    assert.equal(reopened.activeFenceForAgent('agt_write_crash').handle, handle)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 restart settles a reservation with no prompt-write attempt as proven not admitted', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-prewrite-crash-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-prewrite' })
    const handle = first.mintTurnExecution({ agentId: 'agt_prewrite', processGeneration: 1, sessionId: 'main' })

    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-after-prewrite' })
    const query = reopened.getTurnReconciliation(handle)
    assert.equal(query.state, 'settled')
    assert.equal(query.snapshot.outcome, 'not_admitted')
    assert.equal(query.snapshot.outcomeEvidence, 'prompt_write_not_attempted')
    assert.equal(reopened.activeFenceForAgent('agt_prewrite'), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 durable write failure rolls back the transition and closes business admission', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-write-failure-'))
  const persistenceFile = join(root, 'control', 'turn-recovery.json')
  const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-write-failure' })
  const handle = store.mintTurnExecution({ agentId: 'agt_write_failure', processGeneration: 1, sessionId: 'main' })
  rmSync(root, { recursive: true, force: true })
  writeFileSync(root, 'blocks-directory-recreation', 'utf8')
  try {
    assert.throws(() => store.markAdmitted(handle, {
      eventWatermarkSeq: 0, promptRequestId: 'must-not-commit', deadlineAtWallMs: Date.now() + 1000,
    }))
    assert.equal(store.businessAdmissionStatus().ready, false)
    assert.equal(store.businessAdmissionStatus().reason, 'durable_store_unavailable')
    assert.equal(store.getTurnReconciliation(handle).snapshot.promptRequestId, null)
  } finally {
    rmSync(root, { force: true })
  }
})

test('V3 restart finishes settlement when exact child exit was durable before the crash', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-exit-crash-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-exit' })
    const handle = first.mintTurnExecution({ agentId: 'agt_exit_crash', processGeneration: 4, sessionId: 'main' })
    first.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'exit', deadlineAtWallMs: Date.now() })
    first.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
    first.claimRecovery(handle, { operationId: 'op-exit', claimantRuntimeEpoch: first.runtimeEpoch })
    first.commitRecoveryShutdown(handle)
    first.markExitObserved(handle)

    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-after-exit' })
    const query = reopened.getTurnReconciliation(handle)
    assert.equal(query.state, 'settled')
    assert.equal(query.snapshot.lateOutcome, 'terminated_without_outcome')
    assert.equal(query.snapshot.terminationEvidence, 'child_real_exit')
    assert.equal(query.snapshot.fenceState, 'cleared')
    assert.equal(reopened.activeFenceForAgent('agt_exit_crash'), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 invalid durable store keeps startup business admission fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-invalid-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    writeFileSync(persistenceFile, '{not-json', 'utf8')
    const store = new TurnReconciliationStore({ persistenceFile })
    const status = store.businessAdmissionStatus()
    assert.equal(status.ready, false)
    assert.equal(status.reason, 'durable_store_invalid')
    assert.throws(
      () => store.assertBusinessAdmissionReady(),
      error => error?.code === 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED'
        && error?.requestAdmission === 'not_admitted',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 durable schema drift keeps startup business admission fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-schema-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-schema' })
    first.mintTurnExecution({ agentId: 'agt_schema', processGeneration: 1, sessionId: 'main' })
    const durable = JSON.parse(readFileSync(persistenceFile, 'utf8'))
    durable.records[0].nextSafeAction = 'unsafe_unknown_action'
    writeFileSync(persistenceFile, JSON.stringify(durable), 'utf8')

    const reopened = new TurnReconciliationStore({ persistenceFile })
    assert.deepEqual(reopened.businessAdmissionStatus(), {
      ready: false, reason: 'durable_store_invalid',
    })
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
    assert.equal(result.error.code, 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED')
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
