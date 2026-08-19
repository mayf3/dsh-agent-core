/**
 * Deterministic unit tests for FIX 2 — AgentProcess per-process single-flight
 * turns (packages/agent-router/src/process.js).
 *
 * Context (audit round 3, empirically verified): DSH's native queue is per
 * Agent instance = per native Session; two sessions of the same process CAN
 * run turns concurrently, and `activeBindingContext` is a single shared
 * field. Product semantics: ONE Agent processes ONE routed turn at a time.
 *
 * These tests drive the REAL AgentProcess class with a fake child (no DSH
 * process, no model): request writes are captured, pending responses are
 * resolved manually, and session events/status are injected — fully
 * deterministic, no timers beyond the 100ms turn poll.
 *
 * Covered:
 *   1. same session: turn B submitted while turn A is in flight never starts
 *      until A truly ends; activeBindingContext stays A's throughout;
 *   2. a switch-tool relay during turn A sees exactly A's bindingContext
 *      (the overwrite bug scenario from the audit);
 *   3. different native sessions of the same AgentProcess are serialized too
 *      (Router product-layer single-flight covers DSH's cross-session
 *      parallelism);
 *   4. a failed turn does not wedge the queue (the next turn still runs).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { AgentProcess } from '../src/process.js'

/** Build an AgentProcess with a fake child; captures every stdin write. */
function fakeAgentProcess() {
  const writes = []
  const proc = new AgentProcess({
    agentId: 'test-agent',
    home: '/tmp/test-home',
    workspace: '/tmp/test-ws',
    profile: 'test-profile',
    log: { log() {}, error() {} },
  })
  proc.child = {
    stdin: { write: (line) => writes.push(JSON.parse(line)) },
  }
  /** Resolve the pending request of the LAST write of `method`. */
  const resolveNext = (method, result) => {
    const match = [...writes].reverse().find(w => w.method === method)
    assert.ok(match !== undefined, `expected a pending ${method} request`)
    const waiter = proc.pending.get(match.id)
    assert.ok(waiter !== undefined, `expected pending request #${match.id}`)
    waiter.resolve(result)
  }
  /** Reject the pending request of the LAST write of `method`. */
  const rejectNext = (method, error) => {
    const match = [...writes].reverse().find(w => w.method === method)
    assert.ok(match !== undefined, `expected a pending ${method} request`)
    const waiter = proc.pending.get(match.id)
    assert.ok(waiter !== undefined, `expected pending request #${match.id}`)
    waiter.reject(error)
  }
  /** Inject the real DSH activity interval for one completed prompt. */
  const injectAssistant = (sessionId, messageId, text) => {
    const events = [
      { type: 'agent/inbox/spliced', data: { inserted: [{ id: messageId }] } },
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'user/message', data: { id: messageId } },
      { type: 'assistant/message', data: { message: { id: `a-${messageId}`, content: [{ type: 'text', text }] } } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]
    for (const event of events) proc.events.push({ sessionId, event })
  }
  const prompts = () => writes.filter(w => w.method === 'session/prompt')
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  return { proc, writes, resolveNext, rejectNext, injectAssistant, prompts, sleep }
}

test('FIX2.1 same session: turn B waits for turn A; bindingContext stays A\'s', async () => {
  const f = fakeAgentProcess()
  const { proc, writes, resolveNext, injectAssistant, prompts, sleep } = f

  const turnA = proc.turn('main', 'text-a', { bindingContext: 'binding-a' })
  await sleep(20)
  assert.equal(prompts().length, 1, 'turn A prompt sent')
  resolveNext('session/prompt', { messageId: 'm-a' }) // receipt -> A enters its poll loop

  await sleep(150)
  // Submit turn B while A is still running (its event loop is in the poll).
  const turnB = proc.turn('main', 'text-b', { bindingContext: 'binding-b' })
  await sleep(300)
  assert.equal(prompts().length, 1, 'turn B must NOT be sent while A is in flight')
  assert.equal(proc.activeBindingContext, 'binding-a', 'queued turn B must not overwrite A\'s binding context')

  // A completes (event + idle), THEN B may start.
  injectAssistant('main', 'm-a', 'A-REPLY')
  proc.status['main'] = 'idle'
  const resultA = await turnA
  assert.equal(resultA.reply, 'A-REPLY')
  assert.equal(proc.activeBindingContext, undefined, 'binding context released only after the turn truly ends')

  await sleep(150)
  assert.equal(prompts().length, 2, 'turn B starts only after A completed')
  // B's payload is byte-identical to what was submitted.
  assert.equal(prompts()[1].params.sessionId, 'main')
  assert.equal(prompts()[1].params.contentBlocks[0].text, 'text-b')
  resolveNext('session/prompt', { messageId: 'm-b' })
  // Let B's poll loop capture its `before` watermark, then complete it.
  await sleep(150)
  injectAssistant('main', 'm-b', 'B-REPLY')
  proc.status['main'] = 'idle'
  const resultB = await turnB
  assert.equal(resultB.reply, 'B-REPLY')
})

test('FIX2.2 switch-tool relay during turn A sees exactly A\'s bindingContext', async () => {
  const f = fakeAgentProcess()
  const { proc, writes, resolveNext, injectAssistant, prompts, sleep } = f
  const seen = []

  proc.onRpcRequest = async (method, params) => {
    seen.push({ method, bindingContext: proc.activeBindingContext, params })
    return { channelConversationId: 'binding-a', activeAgentId: 'agt_b', activeSessionId: 'main' }
  }

  const turnA = proc.turn('main', 'text-a', { bindingContext: 'binding-a' })
  await sleep(20)
  resolveNext('session/prompt', { messageId: 'm-a' })
  await sleep(150)

  // Turn B is submitted (queued) while A runs — the audit scenario.
  const turnB = proc.turn('main', 'text-b', { bindingContext: 'binding-b' })
  await sleep(200)

  // A's model calls the switch tool during its own turn:
  proc.handleRpcRequest({ requestId: 'r1', method: 'agent-core/switchAgent', params: { targetAgentId: 'agt_b' } })
  await sleep(50)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].bindingContext, 'binding-a', 'switch must target A\'s conversation, not queued B\'s')
  assert.equal(seen[0].method, 'agent-core/switchAgent')

  injectAssistant('main', 'm-a', 'A-REPLY')
  proc.status['main'] = 'idle'
  await turnA
  // Let B's runTurn start and write its prompt (microtask after A settles).
  await sleep(150)
  assert.equal(prompts().length, 2, 'B starts only after A completed (switch test)')
  resolveNext('session/prompt', { messageId: 'm-b' })
  // Let B's poll loop capture its `before` watermark, then complete it.
  await sleep(150)
  injectAssistant('main', 'm-b', 'B-REPLY')
  proc.status['main'] = 'idle'
  await turnB
})

test('FIX2.3 different native sessions of one AgentProcess are serialized too', async () => {
  const f = fakeAgentProcess()
  const { proc, writes, resolveNext, injectAssistant, prompts, sleep } = f

  const turnA = proc.turn('session-a', 'text-a', { bindingContext: 'binding-a' })
  await sleep(20)
  resolveNext('session/prompt', { messageId: 'm-a' })
  await sleep(150)

  // Second session, same process — DSH natively allows overlap; the
  // AgentProcess single-flight must serialize it at the Router layer.
  const turnB = proc.turn('session-b', 'text-b', { bindingContext: 'binding-b' })
  await sleep(300)
  assert.equal(prompts().length, 1, 'session-b turn must wait for session-a turn')
  assert.equal(proc.activeBindingContext, 'binding-a')

  injectAssistant('session-a', 'm-a', 'A-REPLY')
  proc.status['session-a'] = 'idle'
  const resultA = await turnA
  assert.equal(resultA.reply, 'A-REPLY')

  await sleep(150)
  assert.equal(prompts().length, 2)
  assert.equal(prompts()[1].params.sessionId, 'session-b')
  resolveNext('session/prompt', { messageId: 'm-b' })
  await sleep(150)
  injectAssistant('session-b', 'm-b', 'B-REPLY')
  proc.status['session-b'] = 'idle'
  const resultB = await turnB
  assert.equal(resultB.reply, 'B-REPLY')
})

test('FIX2.4 a failed turn does not wedge the single-flight queue', async () => {
  const f = fakeAgentProcess()
  const { proc, resolveNext, rejectNext, injectAssistant, prompts, sleep } = f

  const turnA = proc.turn('main', 'text-a', { bindingContext: 'binding-a' })
  await sleep(20)
  rejectNext('session/prompt', new Error('boom: initialize failed'))
  await assert.rejects(() => turnA, /boom/)
  assert.equal(proc.activeBindingContext, undefined, 'failed turn still releases the binding context')

  // The queue survives the rejection; the next turn runs normally.
  const turnB = proc.turn('main', 'text-b', { bindingContext: 'binding-b' })
  await sleep(50)
  assert.equal(prompts().length, 2)
  resolveNext('session/prompt', { messageId: 'm-b' })
  await sleep(150)
  injectAssistant('main', 'm-b', 'B-REPLY')
  proc.status['main'] = 'idle'
  const resultB = await turnB
  assert.equal(resultB.reply, 'B-REPLY')
})
