/**
 * Deterministic unit tests for the per-process single-flight turn queue
 * (C-013: one active turn per AgentProcess; bounded queued turns; queue
 * never wedged) — packages/agent-router/src/process.js.
 *
 * Context (audit round 3, empirically verified): DSH's native queue is per
 * Agent instance = per native Session; two sessions of the same process CAN
 * run turns concurrently, and `activeBindingContext` is a single shared
 * field. Product semantics: ONE Agent processes ONE routed turn at a time.
 *
 * These tests drive the REAL AgentProcess class with a fake OS child
 * (helpers/fake-child.js — no DSH process, no model, fully deterministic).
 *
 * Covered:
 *   1. same session: turn B submitted while turn A is in flight never starts
 *      until A truly ends; activeBindingContext stays A's throughout;
 *   2. a switch-tool relay during turn A sees exactly A's bindingContext
 *      (the overwrite bug scenario from the audit);
 *   3. different native sessions of the same AgentProcess are serialized too;
 *   4. a failed turn does not wedge the queue (the next turn still runs);
 *   5. an unresolved outcome_unknown turn fences the queue: queued turns are
 *      structurally rejected (AGENT_PROCESS_TURN_FENCED) and a new
 *      submission after late settlement is a fresh explicit admission.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx } from './helpers/fake-child.js'

const prompts = (fx) => fx.writes.filter((write) => write.method === 'session/prompt')

const ingress = (suffix) => ({
  channelNamespace: 'feishu',
  channelConversationId: `feishu:conversation-${suffix}`,
  feishuChatId: `chat-${suffix}`,
  feishuConversationId: `conversation-${suffix}:topic-${suffix}`,
  feishuMessageId: `message-${suffix}`,
})

test('CTX exact active ingress context is immutable and bound to actual process/turn identity', async () => {
  const fx = makeFx({ generation: 7 })
  await fx.readyNow()

  const supplied = {
    ...ingress('a'),
    callerAgentId: 'agt_forged',
    processGeneration: 999,
    turnExecutionId: 'turn:forged',
    ignored: 'not allowlisted',
  }
  const turn = fx.proc.turn('main', 'text-a', {
    bindingContext: 'binding-a',
    ingressContext: supplied,
  })
  await fx.tick()

  const handle = fx.store.records.keys().next().value
  assert.deepEqual(fx.proc.activeIngressContext, {
    callerAgentId: 'agt_fx',
    processGeneration: 7,
    turnExecutionId: handle,
    ...ingress('a'),
  })
  assert.equal(Object.isFrozen(fx.proc.activeIngressContext), true)
  assert.throws(() => { fx.proc.activeIngressContext.feishuChatId = 'chat-mutated' }, TypeError)
  assert.equal(fx.proc.activeIngressContext.feishuChatId, 'chat-a')

  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()
  fx.completeTurn('main', 'm-a', 'A-REPLY')
  await turn
  assert.equal(fx.proc.activeIngressContext, undefined, 'context is stale immediately after turn completion')
})

test('FIX2.1 same session: turn B waits for turn A; bindingContext stays A\'s', async () => {
  const fx = makeFx()
  await fx.readyNow()

  const turnA = fx.proc.turn('main', 'text-a', { bindingContext: 'binding-a' })
  await fx.tick()
  assert.equal(prompts(fx).length, 1, 'turn A prompt sent')
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()

  // Submit turn B while A is still running.
  const turnB = fx.proc.turn('main', 'text-b', { bindingContext: 'binding-b' })
  await fx.tick()
  assert.equal(prompts(fx).length, 1, 'turn B must NOT be sent while A is in flight')
  assert.equal(fx.proc.activeBindingContext, 'binding-a', 'queued turn B must not overwrite A\'s binding context')

  // A completes (event + idle), THEN B may start.
  fx.completeTurn('main', 'm-a', 'A-REPLY')
  const resultA = await turnA
  assert.equal(resultA.status, 'completed')
  assert.equal(resultA.reply, 'A-REPLY')
  assert.equal(fx.proc.activeBindingContext, undefined, 'binding context released only after the turn truly ends')

  await fx.tick()
  assert.equal(prompts(fx).length, 2, 'turn B starts only after A completed')
  assert.equal(prompts(fx)[1].params.sessionId, 'main')
  assert.equal(prompts(fx)[1].params.contentBlocks[0].text, 'text-b')
  fx.respondTo('session/prompt', { messageId: 'm-b' })
  await fx.tick()
  fx.completeTurn('main', 'm-b', 'B-REPLY')
  const resultB = await turnB
  assert.equal(resultB.reply, 'B-REPLY')
})

test('CTX queued conversations install only their own context after stale clear', async () => {
  const fx = makeFx()
  await fx.readyNow()

  const turnA = fx.proc.turn('session-a', 'text-a', {
    bindingContext: 'binding-a',
    ingressContext: Object.freeze(ingress('a')),
  })
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()

  const turnB = fx.proc.turn('session-b', 'text-b', {
    bindingContext: 'binding-b',
    ingressContext: Object.freeze(ingress('b')),
  })
  await fx.tick()
  assert.equal(prompts(fx).length, 1)
  assert.equal(fx.proc.activeIngressContext.feishuChatId, 'chat-a')
  assert.equal(fx.proc.activeIngressContext.feishuConversationId, 'conversation-a:topic-a')

  fx.completeTurn('session-a', 'm-a', 'A-REPLY')
  await turnA
  assert.equal(fx.proc.activeIngressContext, undefined, 'A clears before B is installed')

  await fx.tick()
  assert.equal(fx.proc.activeIngressContext.feishuChatId, 'chat-b')
  assert.equal(fx.proc.activeIngressContext.feishuConversationId, 'conversation-b:topic-b')
  assert.notEqual(fx.proc.activeIngressContext.feishuChatId, 'chat-a')

  fx.respondTo('session/prompt', { messageId: 'm-b' })
  await fx.tick()
  fx.completeTurn('session-b', 'm-b', 'B-REPLY')
  await turnB
  assert.equal(fx.proc.activeIngressContext, undefined, 'B also clears without retaining last conversation')
})

test('FIX2.2 switch-tool relay during turn A sees exactly A\'s bindingContext', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const seen = []

  fx.proc.onRpcRequest = async (method, params) => {
    seen.push({ method, bindingContext: fx.proc.activeBindingContext, params })
    return { channelConversationId: 'binding-a', activeAgentId: 'agt_b', activeSessionId: 'main' }
  }

  const turnA = fx.proc.turn('main', 'text-a', { bindingContext: 'binding-a' })
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()

  const turnB = fx.proc.turn('main', 'text-b', { bindingContext: 'binding-b' })
  await fx.tick()

  // A's model calls the switch tool during its own turn (the response goes
  // back as one bounded rpc.response write).
  void fx.proc.handleRpcRequest({ requestId: 'r1', method: 'agent-core/switchAgent', params: { targetAgentId: 'agt_b' } })
  await fx.tick()
  assert.equal(seen.length, 1)
  assert.equal(seen[0].bindingContext, 'binding-a', 'switch must target A\'s conversation, not queued B\'s')
  assert.equal(seen[0].method, 'agent-core/switchAgent')

  fx.completeTurn('main', 'm-a', 'A-REPLY')
  await turnA
  await fx.tick()
  assert.equal(prompts(fx).length, 2, 'B starts only after A completed (switch test)')
  fx.respondTo('session/prompt', { messageId: 'm-b' })
  await fx.tick()
  fx.completeTurn('main', 'm-b', 'B-REPLY')
  await turnB
})

test('FIX2.3 different native sessions of one AgentProcess are serialized too', async () => {
  const fx = makeFx()
  await fx.readyNow()

  const turnA = fx.proc.turn('session-a', 'text-a', { bindingContext: 'binding-a' })
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()

  const turnB = fx.proc.turn('session-b', 'text-b', { bindingContext: 'binding-b' })
  await fx.tick()
  assert.equal(prompts(fx).length, 1, 'session-b turn must wait for session-a turn')
  assert.equal(fx.proc.activeBindingContext, 'binding-a')

  fx.completeTurn('session-a', 'm-a', 'A-REPLY')
  const resultA = await turnA
  assert.equal(resultA.reply, 'A-REPLY')

  await fx.tick()
  assert.equal(prompts(fx).length, 2)
  assert.equal(prompts(fx)[1].params.sessionId, 'session-b')
  fx.respondTo('session/prompt', { messageId: 'm-b' })
  await fx.tick()
  fx.completeTurn('session-b', 'm-b', 'B-REPLY')
  const resultB = await turnB
  assert.equal(resultB.reply, 'B-REPLY')
})

test('FIX2.4 a failed turn does not wedge the single-flight queue', async () => {
  const fx = makeFx()
  await fx.readyNow()

  const turnA = fx.proc.turn('main', 'text-a', {
    bindingContext: 'binding-a',
    ingressContext: Object.freeze(ingress('failed')),
  })
  await fx.tick()
  assert.equal(fx.proc.activeIngressContext.feishuChatId, 'chat-failed')
  const promptWrite = prompts(fx).at(-1)
  fx.emit({ id: promptWrite.id, error: { code: 'QUOTA', message: 'insufficient_quota' } })
  await assert.rejects(() => turnA, (error) => error.status === 'failed' && error.code === 'account_quota_exhausted')
  assert.equal(fx.proc.activeBindingContext, undefined, 'failed turn still releases the binding context')
  assert.equal(fx.proc.activeIngressContext, undefined, 'failed turn cannot leave stale ingress context')

  // The queue survives the rejection; the next turn runs normally.
  const turnB = fx.proc.turn('main', 'text-b', { bindingContext: 'binding-b' })
  await fx.tick()
  assert.equal(prompts(fx).length, 2)
  fx.respondTo('session/prompt', { messageId: 'm-b' })
  await fx.tick()
  fx.completeTurn('main', 'm-b', 'B-REPLY')
  const resultB = await turnB
  assert.equal(resultB.reply, 'B-REPLY')
})

test('FIX2.5 unresolved outcome_unknown fences the queue; re-admission after late settlement is explicit', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 120 } })
  await fx.readyNow()

  const turnA = fx.proc.turn('main', 'text-a', { bindingContext: 'binding-a' }, 60)
  await fx.tick()
  const writeA = prompts(fx).at(-1)
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()

  // B queues while A runs; A then passes its caller wait without terminal.
  const turnB = fx.proc.turn('main', 'text-b', { bindingContext: 'binding-b' })
  await assert.rejects(() => turnA, (error) => error.status === 'outcome_unknown' && error.source === 'caller_wait_exceeded')
  await assert.rejects(() => turnB, (error) => error.status === 'not_admitted' && error.code === 'AGENT_PROCESS_TURN_FENCED')
  assert.equal(prompts(fx).length, 1, 'fenced queue must not write B\'s prompt')

  // Late exact terminal for A settles late_completed and releases the fence.
  const handleA = fx.store.records.keys().next().value
  fx.completeTurn('main', 'm-a', 'A-LATE-REPLY')
  await fx.tick()
  assert.equal(fx.store.getTurnReconciliation(handleA).snapshot.lateOutcome, 'late_completed')
  assert.equal(fx.fence(), false, 'fence released by exact termination evidence')
  assert.equal(fx.counts().replayAdmissions, 0, 'no automatic replay after fence release')

  // A NEW explicit submission is admitted (not the fenced one replayed).
  const turnC = fx.proc.turn('main', 'text-c', { bindingContext: 'binding-c' })
  await fx.tick()
  assert.equal(prompts(fx).length, 2)
  assert.equal(prompts(fx)[1].params.contentBlocks[0].text, 'text-c')
  fx.respondTo('session/prompt', { messageId: 'm-c' })
  await fx.tick()
  fx.completeTurn('main', 'm-c', 'C-REPLY')
  const resultC = await turnC
  assert.equal(resultC.reply, 'C-REPLY')
})
