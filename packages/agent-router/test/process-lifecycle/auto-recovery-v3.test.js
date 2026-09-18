import assert from 'node:assert/strict'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { makeFx as makeBaseFx, prompts, rejectsWith } from './helpers.js'

function makeFx({ reconciliationStore, recoveryBeforeShutdownCommit, ...options } = {}) {
  const fx = makeBaseFx(options)
  if (reconciliationStore !== undefined) {
    fx.proc.store = reconciliationStore
    fx.store = reconciliationStore
  }
  if (recoveryBeforeShutdownCommit !== undefined) {
    fx.proc.recoveryBeforeShutdownCommit = recoveryBeforeShutdownCommit
  }
  return fx
}

test('V3 trusted exact-started-then-idle settles unknown without killing resident child', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 45, shutdownGraceMs: 30 } })
  await fx.readyNow()

  const turn = fx.proc.turn('main', 'harmless')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-idle' })
  fx.emitEvent('main', { type: 'agent/inbox/spliced', data: { inserted: [{ id: 'm-idle' }] } })
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-idle' } })

  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  assert.equal(fx.fence(), unknown.reconciliationHandle)
  fx.emitStatus('main', 'idle')
  await fx.tick()

  const query = fx.store.getTurnReconciliation(unknown.reconciliationHandle)
  assert.equal(query.state, 'settled')
  assert.equal(query.snapshot.lateOutcome, 'terminated_without_outcome')
  assert.equal(query.snapshot.terminationEvidence, 'exact_started_then_idle')
  assert.equal(fx.fence(), false)
  assert.equal(fx.proc.state, 'READY')
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0)
  assert.equal(fx.counts().killSignals, 0)
  assert.equal(prompts(fx).length, 1)
})

for (const scenario of [
  {
    name: 'missing exact receipt correlation',
    arrange(fx, messageId) {
      fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
      fx.emitStatus('main', 'idle')
    },
  },
  {
    name: 'idle observed before the matched start',
    arrange(fx, messageId) {
      fx.emitStatus('main', 'idle')
      fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
      fx.emitEvent('main', { type: 'user/message', data: { id: messageId } })
    },
  },
  {
    name: 'later turn start',
    arrange(fx, messageId) {
      fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
      fx.emitEvent('main', { type: 'user/message', data: { id: messageId } })
      fx.emitEvent('main', { type: 'turn/start', data: { turn: 2 } })
      fx.emitStatus('main', 'idle')
    },
  },
  {
    name: 'second turn start before exact receipt',
    arrange(fx, messageId) {
      fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
      fx.emitEvent('main', { type: 'turn/start', data: { turn: 2 } })
      fx.emitEvent('main', { type: 'user/message', data: { id: messageId } })
      fx.emitStatus('main', 'idle')
    },
  },
  {
    name: 'event stream gap',
    arrange(fx, messageId, execution) {
      fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
      fx.emitEvent('main', { type: 'user/message', data: { id: messageId } })
      execution.streamGapSeen = true
      fx.emitStatus('main', 'idle')
    },
  },
  {
    name: 'one-active-turn invariant violation',
    arrange(fx, messageId) {
      fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
      fx.emitEvent('main', { type: 'user/message', data: { id: messageId } })
      fx.proc.executions.set('competing-execution', { handle: 'competing-execution' })
      fx.emitStatus('main', 'idle')
    },
    cleanup(fx) { fx.proc.executions.delete('competing-execution') },
  },
]) {
  test(`V3 exact-started-then-idle negative control: ${scenario.name} stays fenced`, async () => {
    const fx = makeFx({ deadlines: { turnTimeoutMs: 250, shutdownGraceMs: 30 } })
    await fx.readyNow()
    const turn = fx.proc.turn('main', `negative control: ${scenario.name}`, {}, 25)
    await fx.tick()
    const messageId = `m-negative-${scenario.name}`
    fx.respondTo('session/prompt', { messageId })
    const execution = [...fx.proc.executions.values()][0]
    scenario.arrange(fx, messageId, execution)
    const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
    await fx.tick()
    assert.equal(fx.store.getTurnReconciliation(unknown.reconciliationHandle).state, 'pending')
    assert.equal(fx.fence(), unknown.reconciliationHandle)
    assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0)
    assert.equal(fx.counts().killSignals, 0)
    scenario.cleanup?.(fx)
    fx.childExit(0, null)
    await fx.tick()
  })
}

test('V3 hard deadline performs one exact REAP and waits for real child exit before reopening', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 35, shutdownGraceMs: 80 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless reap fixture')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-reap' })

  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  for (let i = 0; i < 20 && !fx.writes.some(write => write.method === 'shutdown'); i += 1) await fx.sleep(5)
  assert.equal(fx.writes.filter(write => write.method === 'shutdown').length, 1)
  assert.equal(fx.fence(), unknown.reconciliationHandle)
  assert.equal(fx.store.getTurnReconciliation(unknown.reconciliationHandle).state, 'recovering')

  fx.childExit(0, null)
  await fx.tick()
  const settled = fx.store.getTurnReconciliation(unknown.reconciliationHandle)
  assert.equal(settled.state, 'settled')
  assert.equal(settled.snapshot.lateOutcome, 'terminated_without_outcome')
  assert.equal(settled.snapshot.terminationEvidence, 'child_real_exit')
  assert.equal(settled.snapshot.reapClaim.phase, 'settled')
  assert.notEqual(settled.snapshot.exitObservedAt, null)
  assert.equal(settled.snapshot.fenceState, 'cleared')
  const actionOrder = settled.snapshot.attemptedActions.map(entry => entry.action)
  assert.ok(actionOrder.indexOf('reap_claim') < actionOrder.indexOf('graceful_shutdown'))
  assert.ok(actionOrder.indexOf('graceful_shutdown') < actionOrder.indexOf('exit_wait'))
  assert.ok(actionOrder.indexOf('exit_wait') < actionOrder.indexOf('settlement'))
  assert.ok(actionOrder.indexOf('settlement') < actionOrder.indexOf('registry_cleanup'))
  assert.ok(actionOrder.indexOf('registry_cleanup') < actionOrder.indexOf('fence_cleanup'))
  assert.equal(fx.fence(), false)
  assert.deepEqual(fx.slotOps.map(entry => entry.op).slice(-1), ['casEmpty'])
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 1)
  assert.equal(fx.counts().shutdownInvocations, 1)
  assert.equal(fx.counts().killSignals, 0)
  assert.equal(prompts(fx).length, 1)
})

test('V3 registry cleanup CAS mismatch keeps DRAINING and preserves the settled fence', async () => {
  const fx = makeFx({
    deadlines: { turnTimeoutMs: 35, shutdownGraceMs: 80 },
    integration: { casEmpty: () => false },
  })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless cleanup mismatch fixture')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-cleanup-mismatch' })
  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  fx.childExit(0, null)
  await fx.tick()

  const snapshot = fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot
  assert.equal(fx.proc.state, 'DRAINING')
  assert.equal(fx.fence(), unknown.reconciliationHandle)
  assert.equal(snapshot.recoveryState, 'blocked')
  assert.equal(snapshot.fenceState, 'active')
  assert.equal(fx.store.activeFenceForAgent('agt_fx').handle, unknown.reconciliationHandle)
  assert.equal(snapshot.nextSafeAction, 'operator_exact_generation_recovery')
  assert.ok(snapshot.attemptedActions.some(action => action.action === 'registry_cleanup' && action.result === 'blocked'))
  assert.equal(snapshot.attemptedActions.some(action => action.action === 'fence_cleanup'), false)
  let exitResolved = false
  fx.proc.exitPromise.then(() => { exitResolved = true })
  await fx.tick()
  assert.equal(exitResolved, false)
})

test('V3 caller unknown before the hard deadline does not start REAP early', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 140, shutdownGraceMs: 40 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless early unknown', {}, 25)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-early' })
  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  await fx.sleep(35)
  assert.equal(fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot.reapClaim, null)
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0)
  assert.equal(fx.counts().killSignals, 0)
  fx.childExit(0, null)
  await fx.tick()
  assert.equal(fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot.terminationEvidence, 'child_real_exit')
})

test('V3 child exit before hard deadline settles without a second shutdown', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 140, shutdownGraceMs: 40 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless already-exited fixture', {}, 25)
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-already-exited' })
  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  fx.childExit(0, null)
  await fx.tick()
  const result = await fx.proc.recoverUnknownExecution(unknown.reconciliationHandle)
  assert.equal(result.status, 'already_settled')
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0)
  assert.equal(fx.counts().killSignals, 0)
})

test('V3 failed exact ownership keeps the fence and never signals the child', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 35, shutdownGraceMs: 25 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless ownership mismatch')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-ownership' })
  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  fx.proc.ownershipToken = 'mismatched-token'
  for (let i = 0; i < 20; i += 1) {
    if (fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot.recoveryState === 'blocked') break
    await fx.sleep(5)
  }
  const query = fx.store.getTurnReconciliation(unknown.reconciliationHandle)
  assert.equal(query.snapshot.recoveryState, 'blocked')
  assert.deepEqual(query.snapshot.missingEvidence, ['live_generation_ownership'])
  assert.equal(fx.fence(), unknown.reconciliationHandle)
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0)
  assert.equal(fx.counts().killSignals, 0)
  await fx.tick()
  const reapAttemptsBeforeRetry = fx.slotOps.filter(entry => entry.op === 'casReap').length
  fx.proc.ownershipToken = fx.proc.ownership.token
  const retry = await fx.proc.recoverUnknownExecution(unknown.reconciliationHandle)
  assert.equal(retry.status, 'claim_blocked')
  assert.equal(fx.slotOps.filter(entry => entry.op === 'casReap').length, reapAttemptsBeforeRetry)
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0)
  assert.equal(fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot.reapClaim.phase, 'blocked')
})

test('V3 registry REAP CAS failure rolls durable shutdown eligibility back to blocked', async () => {
  const fx = makeFx({
    deadlines: { turnTimeoutMs: 35, shutdownGraceMs: 25 },
    integration: { casReap: () => null },
  })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless registry mismatch')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-registry-mismatch' })
  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  for (let i = 0; i < 20; i += 1) {
    if (fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot.failureReason === 'registry_generation_mismatch') break
    await fx.sleep(5)
  }
  const snapshot = fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot
  assert.equal(snapshot.recoveryState, 'blocked')
  assert.equal(snapshot.reapClaim.phase, 'blocked')
  assert.equal(snapshot.shutdownRequestedAt, null)
  assert.equal(snapshot.failureReason, 'registry_generation_mismatch')
  assert.equal(snapshot.fenceState, 'active')
  assert.equal(fx.proc.state, 'READY')
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0)
  assert.equal(fx.counts().killSignals, 0)
})

test('V3 grace expiry sends one forced termination and still waits for real exit', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 35, shutdownGraceMs: 25 } })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless forced termination fixture')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-force' })
  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  for (let i = 0; i < 30 && fx.counts().killSignals === 0; i += 1) await fx.sleep(5)
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 1)
  assert.equal(fx.counts().killSignals, 1)
  assert.equal(fx.fence(), unknown.reconciliationHandle)
  assert.equal(fx.store.getTurnReconciliation(unknown.reconciliationHandle).state, 'recovering')
  fx.childExit(null, 'SIGKILL')
  await fx.tick()
  const settled = fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot
  assert.equal(settled.terminationEvidence, 'child_real_exit')
  const actions = settled.attemptedActions.map(entry => entry.action)
  assert.ok(actions.indexOf('forced_termination') < actions.indexOf('exit_wait'))
  assert.equal(fx.fence(), false)
})

test('V3 late evidence after claim but before shutdown commit cancels REAP with zero shutdown', async () => {
  let releaseCommit
  const commitGate = new Promise(resolve => { releaseCommit = resolve })
  const fx = makeFx({
    deadlines: { turnTimeoutMs: 35, shutdownGraceMs: 30 },
    recoveryBeforeShutdownCommit: async () => commitGate,
  })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless race fixture')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-race' })
  fx.emitEvent('main', { type: 'agent/inbox/spliced', data: { inserted: [{ id: 'm-race' }] } })
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-race' } })

  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))
  for (let i = 0; i < 20; i += 1) {
    const snapshot = fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot
    if (snapshot.reapClaim?.phase === 'claimed') break
    await fx.sleep(5)
  }
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  fx.emitStatus('main', 'idle')
  releaseCommit()
  await fx.tick()

  const settled = fx.store.getTurnReconciliation(unknown.reconciliationHandle)
  assert.equal(settled.state, 'settled')
  assert.equal(settled.snapshot.lateOutcome, 'late_completed')
  assert.equal(settled.snapshot.reapClaim.phase, 'canceled_by_settlement')
  assert.equal(fx.proc.state, 'READY')
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 0)
  assert.equal(fx.counts().killSignals, 0)
})

test('V3 duplicate and concurrent recovery triggers join one logical operation', async () => {
  let releaseCommit
  const commitGate = new Promise(resolve => { releaseCommit = resolve })
  const fx = makeFx({
    deadlines: { turnTimeoutMs: 35, shutdownGraceMs: 80 },
    recoveryBeforeShutdownCommit: async () => commitGate,
  })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless duplicate fixture')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-dupe' })
  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))

  const first = fx.proc.recoverUnknownExecution(unknown.reconciliationHandle)
  const second = fx.proc.recoverUnknownExecution(unknown.reconciliationHandle)
  assert.equal(first, second)
  releaseCommit()
  for (let i = 0; i < 20 && !fx.writes.some(write => write.method === 'shutdown'); i += 1) await fx.sleep(5)
  fx.childExit(0, null)
  await Promise.all([first, second])

  const snapshot = fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot
  assert.equal(snapshot.attemptedActions.filter(action => action.action === 'reap_claim' && action.result === 'succeeded').length, 1)
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 1)
  assert.equal(fx.counts().shutdownInvocations, 1)
  assert.equal(fx.counts().killSignals, 0)
  assert.equal(prompts(fx).length, 1)
  assert.deepEqual({
    originalPromptReplayWrites: fx.counts().originalPromptReplayWrites,
    originalAnswerResends: fx.counts().originalAnswerResends,
    historicalSideEffectReplays: fx.counts().historicalSideEffectReplays,
    rejectedRequestAutoAdmissions: fx.counts().rejectedRequestAutoAdmissions,
  }, {
    originalPromptReplayWrites: 0,
    originalAnswerResends: 0,
    historicalSideEffectReplays: 0,
    rejectedRequestAutoAdmissions: 0,
  })
})

test('V3 coordinator restart rejoins the durable claim with one shutdown', async () => {
  let releaseFirst
  let releaseResumed
  const firstGate = new Promise(resolve => { releaseFirst = resolve })
  const resumedGate = new Promise(resolve => { releaseResumed = resolve })
  let coordinatorPass = 0
  const fx = makeFx({
    deadlines: { turnTimeoutMs: 35, shutdownGraceMs: 80 },
    recoveryBeforeShutdownCommit: async () => {
      coordinatorPass += 1
      await (coordinatorPass === 1 ? firstGate : resumedGate)
    },
  })
  await fx.readyNow()
  const turn = fx.proc.turn('main', 'harmless coordinator restart fixture')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-coordinator-restart' })
  const unknown = await rejectsWith(turn, error => assert.equal(error.status, 'outcome_unknown'))

  for (let i = 0; i < 20; i += 1) {
    const claim = fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot.reapClaim
    if (claim?.phase === 'claimed') break
    await fx.sleep(5)
  }
  const abandonedWorker = fx.proc.recoveryPromises.get(unknown.reconciliationHandle)
  assert.ok(abandonedWorker instanceof Promise)
  fx.proc.recoveryPromises = new Map() // simulate coordinator-local state loss
  const resumedWorker = fx.proc.recoverUnknownExecution(unknown.reconciliationHandle)
  releaseResumed()
  for (let i = 0; i < 20 && !fx.writes.some(write => write.method === 'shutdown'); i += 1) await fx.sleep(5)
  fx.childExit(0, null)
  await resumedWorker
  releaseFirst()
  await abandonedWorker

  const snapshot = fx.store.getTurnReconciliation(unknown.reconciliationHandle).snapshot
  assert.equal(snapshot.lateOutcome, 'terminated_without_outcome')
  assert.equal(snapshot.attemptedActions.filter(action => action.action === 'reap_claim').length, 1)
  assert.equal(fx.counts().shutdownInvocations, 1)
  assert.equal(fx.counts().gracefulShutdownWriteAttempts, 1)
  assert.equal(fx.counts().killSignals, 0)
  assert.equal(fx.fence(), false)
})


test('V3 simulated-child real outer entry recovers without a new prompt, then accepts exactly one new request', async () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-outer-e2e' })
  const first = makeFx({
    reconciliationStore: store,
    generation: 1,
    deadlines: { turnTimeoutMs: 35, shutdownGraceMs: 80 },
  })
  await first.readyNow()
  let current = first
  let executions = 0
  const delivery = createIngressDelivery({
    log: { log() {}, error() {} },
    feishu: undefined,
    workspaceBootstrap: { async ensureWorkspace() {} },
    store: {},
    reconciliationStore: store,
    routeChain: {
      async runTurnWithRouteChain(_agentId, args) {
        executions += 1
        return current.proc.turn(args.sessionId, args.message, args.opts)
      },
    },
    resolveAgentRef() { throw new Error('not used') },
    resolveAgentById() { throw new Error('not used') },
    async resolveChannelConversation() {
      return {
        channelConversation: { id: 'feishu:oc_outer_e2e' },
        binding: { activeAgentId: 'agt_fx', activeSessionId: 'main' },
      }
    },
    resolveEffectiveWorkspace() { return { workspaceId: null, workspacePath: '/tmp/fx-ws' } },
  })
  const ingress = (messageId, text) => ({
    channel: 'group', chatId: 'oc_outer_e2e', conversationId: 'oc_outer_e2e',
    messageId, sender: { openId: 'ou_test' }, text,
  })

  const firstCall = delivery.onIngress(ingress('om_old', 'old harmless unknown'))
  await first.tick()
  first.respondTo('session/prompt', { messageId: 'm-old' })
  const firstResult = await firstCall
  assert.equal(firstResult.failureStage, 'execution')
  assert.equal(firstResult.requestAdmission, 'accepted')
  assert.equal(firstResult.nextSafeAction, 'await_late_evidence')
  const oldHandle = firstResult.reconciliationHandle
  assert.equal(typeof oldHandle, 'string')
  for (let i = 0; i < 20 && !first.writes.some(write => write.method === 'shutdown'); i += 1) await first.sleep(5)
  assert.equal(first.fence(), oldHandle)
  first.childExit(0, null)
  await first.tick()
  assert.equal(store.getTurnReconciliation(oldHandle).snapshot.fenceState, 'cleared')

  const second = makeFx({ reconciliationStore: store, generation: 2 })
  await second.readyNow()
  current = second
  const secondCall = delivery.onIngress(ingress('om_new', 'new harmless canary'))
  await second.tick()
  second.respondTo('session/prompt', { messageId: 'm-new' })
  second.completeTurn('main', 'm-new', 'canary-ok')
  const secondResult = await secondCall

  assert.equal(secondResult.reply, 'canary-ok')
  assert.equal(executions, 2)
  assert.equal(prompts(first).length, 1)
  assert.equal(prompts(second).length, 1)
  assert.equal(first.counts().originalPromptReplayWrites, 0)
  assert.equal(first.counts().originalAnswerResends, 0)
  assert.equal(first.counts().historicalSideEffectReplays, 0)
  assert.equal(first.counts().rejectedRequestAutoAdmissions, 0)
})
