import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { RECONCILIATION_CAPS } from '../../src/reconciliation/capacity.js'
import { makeFx } from './helpers.js'

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

test('V3 restart settles durable child exit but keeps REAP fence without registry cleanup proof', () => {
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
    assert.equal(query.snapshot.fenceState, 'active')
    assert.equal(query.snapshot.recoveryState, 'blocked')
    assert.equal(reopened.activeFenceForAgent('agt_exit_crash').handle, handle)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 restart completes a normal late-evidence fence cleanup without a new prompt', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-late-cleanup-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-late-cleanup' })
    const handle = first.mintTurnExecution({ agentId: 'agt_late_cleanup', processGeneration: 2, sessionId: 'main' })
    first.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'late', deadlineAtWallMs: Date.now() })
    first.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
    first.settleLate(handle, {
      lateOutcome: 'late_completed', outcomeEvidence: 'exact_turn_end_success',
      terminationEvidence: 'exact_terminal_then_idle',
    })
    assert.equal(first.activeFenceForAgent('agt_late_cleanup').handle, handle)

    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-after-late-cleanup' })
    const snapshot = reopened.getTurnReconciliation(handle).snapshot
    assert.equal(snapshot.fenceState, 'cleared')
    assert.equal(reopened.activeFenceForAgent('agt_late_cleanup'), null)
    assert.ok(snapshot.attemptedActions.some(action => (
      action.action === 'fence_cleanup' && action.reasonCode === 'startup_completed_proven_cleanup'
    )))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 restart clears a REAP fence only after durable registry cleanup proof', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-reap-cleanup-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-reap-cleanup' })
    const handle = first.mintTurnExecution({ agentId: 'agt_reap_cleanup', processGeneration: 5, sessionId: 'main' })
    first.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'reap', deadlineAtWallMs: Date.now() })
    first.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
    first.claimRecovery(handle, { operationId: 'op-reap-cleanup', claimantRuntimeEpoch: first.runtimeEpoch })
    first.commitRecoveryShutdown(handle)
    first.settleLate(handle, {
      lateOutcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit', exitObserved: true,
    })
    first.recordRecoveryAction(handle, {
      action: 'registry_cleanup', result: 'succeeded', reasonCode: 'exact_reap_empty',
    })
    assert.equal(first.activeFenceForAgent('agt_reap_cleanup').handle, handle)

    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-after-reap-cleanup' })
    assert.equal(reopened.getTurnReconciliation(handle).snapshot.fenceState, 'cleared')
    assert.equal(reopened.activeFenceForAgent('agt_reap_cleanup'), null)
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

test('V3 invalid durable top-level and issuance authority fail startup closed', () => {
  for (const mutate of [
    durable => { durable.discriminatorSeq = '1' },
    durable => { durable.issuance.push(structuredClone(durable.issuance[0])) },
    durable => { durable.correlationIndex.push(['occ\u0000run\u0000request', 'turn:missing:a1:g1:s1']) },
  ]) {
    const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-authority-'))
    const persistenceFile = join(root, 'turn-recovery.json')
    try {
      const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-authority' })
      first.mintTurnExecution({ agentId: 'agt_authority', processGeneration: 1, sessionId: 'main' })
      const durable = JSON.parse(readFileSync(persistenceFile, 'utf8'))
      mutate(durable)
      writeFileSync(persistenceFile, JSON.stringify(durable), 'utf8')
      const reopened = new TurnReconciliationStore({ persistenceFile })
      assert.deepEqual(reopened.businessAdmissionStatus(), { ready: false, reason: 'durable_store_invalid' })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

test('V3 repeated restart and mutation keeps durable runtime epochs bounded', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-epochs-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    let latestHandle
    for (let index = 0; index < RECONCILIATION_CAPS.MAX_RUNTIME_EPOCHS + 8; index += 1) {
      const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: `epoch-${index}` })
      latestHandle = store.mintTurnExecution({ agentId: 'agt_epoch_bound', processGeneration: 1, sessionId: 'main' })
      store.settleDirect(latestHandle, { outcome: 'completed', outcomeEvidence: 'exact_turn_end_success' })
    }
    const durable = JSON.parse(readFileSync(persistenceFile, 'utf8'))
    assert.equal(durable.runtimeEpochs.length, RECONCILIATION_CAPS.MAX_RUNTIME_EPOCHS)
    assert.ok(durable.records.length <= RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT)
    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-final-read' })
    assert.equal(reopened.getTurnReconciliation(latestHandle).state, 'settled')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 resolved record eviction atomically retires caller correlation capacity and bytes', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-correlation-bound' })
  const triples = []
  for (let index = 0; index <= RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT; index += 1) {
    const triple = { occurrenceId: `occ-${index}`, runId: `run-${index}`, requestId: `request-${index}` }
    triples.push(triple)
    const handle = store.mintTurnExecution({
      agentId: 'agt_correlation_bound', processGeneration: 1, sessionId: 'main', callerCorrelation: triple,
    })
    store.settleDirect(handle, { outcome: 'completed', outcomeEvidence: 'exact_turn_end_success' })
  }
  assert.equal(store.correlationIndex.size, RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT)
  assert.equal(store.resolveCallerCorrelation(triples[0]).state, 'never_existed')
  assert.equal(store.resolveCallerCorrelation(triples.at(-1)).state, 'settled')
  assert.ok(store.correlationBytes > 0)
  assert.ok(store.occupancy().globalBytes > store.correlationBytes)
})

test('V3 caller correlation keys are type-safe and byte-bounded before authority mutation', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-correlation-input-bound' })
  assert.throws(() => store.mintTurnExecution({
    agentId: 'agt_correlation_input', processGeneration: 1, sessionId: 'main',
    callerCorrelation: { requestId: 42 },
  }), /coordinates must be strings/)
  assert.throws(() => store.mintTurnExecution({
    agentId: 'agt_correlation_input', processGeneration: 1, sessionId: 'main',
    callerCorrelation: { requestId: '界'.repeat(RECONCILIATION_CAPS.MAX_CORRELATION_KEY_BYTES) },
  }), error => error?.code === 'RECONCILIATION_CAPACITY_EXHAUSTED')
  assert.equal(store.occupancy().records, 0)
  assert.equal(store.correlationIndex.size, 0)
})

test('V3 durable record correlation must match the durable exact secondary index', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-correlation-authority-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-correlation-authority' })
    store.mintTurnExecution({
      agentId: 'agt_correlation_authority', processGeneration: 1, sessionId: 'main',
      callerCorrelation: { occurrenceId: 'occ', runId: 'run', requestId: 'request' },
    })
    const durable = JSON.parse(readFileSync(persistenceFile, 'utf8'))
    durable.records[0].callerCorrelation.requestId = 'different-request'
    writeFileSync(persistenceFile, JSON.stringify(durable), 'utf8')
    const reopened = new TurnReconciliationStore({ persistenceFile })
    assert.deepEqual(reopened.businessAdmissionStatus(), { ready: false, reason: 'durable_store_invalid' })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 impossible unresolved-cleared durable state keeps startup admission fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-invariant-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-invariant' })
    const handle = first.mintTurnExecution({ agentId: 'agt_invariant', processGeneration: 1, sessionId: 'main' })
    first.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'invariant', deadlineAtWallMs: Date.now() })
    first.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
    const durable = JSON.parse(readFileSync(persistenceFile, 'utf8'))
    durable.records[0].fenceState = 'cleared'
    writeFileSync(persistenceFile, JSON.stringify(durable), 'utf8')

    const reopened = new TurnReconciliationStore({ persistenceFile })
    assert.deepEqual(reopened.businessAdmissionStatus(), {
      ready: false, reason: 'durable_store_invalid',
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('V3 durable recovery stores answer evidence without storing answer bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-recovery-v3-answer-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  const sentinel = 'SECRET_ANSWER_PAYLOAD'
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-answer' })
    const handle = store.mintTurnExecution({ agentId: 'agt_answer', processGeneration: 1, sessionId: 'main' })
    store.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'answer', deadlineAtWallMs: Date.now() })
    store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
    store.settleLate(handle, {
      lateOutcome: 'late_completed', outcomeEvidence: 'exact_turn_end_success',
      terminationEvidence: 'exact_terminal_then_idle',
      finalAssistantOutput: { text: sentinel, truncated: false },
    })

    const rawText = readFileSync(persistenceFile, 'utf8')
    const durable = JSON.parse(rawText)
    assert.equal(rawText.includes(sentinel), false)
    assert.equal(durable.records[0].finalAssistantOutput, null)
    assert.deepEqual(durable.records[0].finalAssistantOutputEvidence, {
      sha256: createHash('sha256').update(sentinel).digest('hex'),
      originalBytes: Buffer.byteLength(sentinel),
      truncated: false,
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

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
