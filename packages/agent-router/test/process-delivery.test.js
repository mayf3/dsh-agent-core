/**
 * Deterministic unit tests for the AgentProcess Delivery V0 admission seam
 * (packages/agent-router/src/process.js `deliver`) — the "inbox accepted,
 * return immediately" contract:
 *
 *   accepted=true  <=>  the demo-server wrote the session/prompt receipt,
 *                       which it sends ONLY after agent.followup() enqueued
 *                       the message into the DSH native inbox. It NEVER
 *                       implies the model turn finished.
 *
 * Drives the REAL AgentProcess class with a fake child (single-flight
 * pattern): request writes are captured, pending responses resolved
 * manually, session events/status injected only when a test wants them.
 *
 * Covered:
 *   1. deliver resolves on the receipt alone — NO assistant event, NO
 *      session.status idle, NO turn/end: the strongest form of "does not
 *      wait for the model round";
 *   2. deliver during an in-flight turn() resolves immediately and never
 *      touches the turn's activeBindingContext (delivery has no channel);
 *   3. a dead child (no receipt) rejects via the receipt timeout instead of
 *      hanging, and the pending entry is cleaned up;
 *   4. a late receipt after a timeout cannot resolve the timed-out call.
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
  return { proc, writes, resolveNext, injectAssistant, prompts, sleep }
}

test('DLV1 deliver resolves on the receipt alone — no event, no idle, no turn/end', async () => {
  const f = fakeAgentProcess()
  const { proc, resolveNext, prompts } = f

  const pending = proc.deliver('main', 'hello inbox', {}, 10000)
  assert.equal(prompts().length, 1, 'one session/prompt written')
  assert.equal(prompts()[0].params.sessionId, 'main')
  assert.deepEqual(prompts()[0].params.contentBlocks, [{ type: 'text', text: 'hello inbox' }])

  // Resolve the receipt WITHOUT injecting any event or setting any status —
  // the session never becomes idle in this test.
  resolveNext('session/prompt', { messageId: 'm-42' })
  const result = await pending
  assert.equal(result.accepted, true)
  assert.equal(result.sessionId, 'main')
  assert.equal(result.messageId, 'm-42')
  assert.ok(Number.isFinite(result.ms))
  assert.equal(proc.events.length, 0, 'resolved before ANY assistant event')
  assert.equal(proc.status['main'], undefined, 'resolved while the session never went idle')
  assert.equal(proc.activeBindingContext, undefined, 'deliver has no binding context')
})

test('DLV2 deliver during an in-flight turn resolves immediately and leaves the turn alone', async () => {
  const f = fakeAgentProcess()
  const { proc, writes, resolveNext, injectAssistant, prompts, sleep } = f

  // A turn is running (receipt resolved, poll loop active, status NOT idle).
  const turn = proc.turn('main', 'turn-text', { bindingContext: 'binding-a' })
  await sleep(20)
  resolveNext('session/prompt', { messageId: 'm-turn' })
  await sleep(150)

  // Now deliver while the turn is in flight: the receipt must come back
  // immediately — the delivery is NOT queued behind the turn.
  const started = Date.now()
  const delivery = proc.deliver('main', 'fast-delivery', {}, 10000)
  assert.equal(prompts().length, 2, 'the delivery prompt is written at once, not queued')
  resolveNext('session/prompt', { messageId: 'm-deliv' })
  const result = await delivery
  assert.ok(Date.now() - started < 5000, 'delivery resolved on the receipt, no turn wait')
  assert.equal(result.sessionId, 'main')
  assert.equal(proc.activeBindingContext, 'binding-a', 'delivery must not disturb the turn\'s binding context')

  // The turn itself still completes normally afterwards.
  injectAssistant('main', 'm-turn', 'TURN-REPLY')
  proc.status['main'] = 'idle'
  const turnResult = await turn
  assert.equal(turnResult.reply, 'TURN-REPLY')
})

test('DLV3 a dead child (no receipt) rejects via the timeout and cleans up', async () => {
  const f = fakeAgentProcess()
  const { proc, prompts } = f

  const started = Date.now()
  const pending = proc.deliver('main', 'into-the-void', {}, 300)
  assert.equal(prompts().length, 1)
  await assert.rejects(() => pending, /timed out after 300ms/)
  assert.ok(Date.now() - started >= 250, 'rejected by the receipt timeout, not by any turn state')
  assert.equal(proc.pending.size, 0, 'the timed-out pending entry was removed')
})

test('DLV4 a late receipt after the timeout cannot resolve the timed-out call', async () => {
  const f = fakeAgentProcess()
  const { proc, prompts, sleep } = f

  const pending = proc.deliver('main', 'late-receipt', {}, 200)
  const write = prompts()[0]
  await assert.rejects(() => pending, /timed out/)
  assert.equal(proc.pending.size, 0, 'the timed-out entry is gone')
  // A receipt that arrives after the timeout travels the real stdout path:
  // the id is no longer pending, so the message is silently ignored and
  // nothing throws or resolves a ghost promise.
  proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', id: write.id, result: { messageId: 'm-late' } })}\n`)
  await sleep(50)
  assert.equal(proc.pending.size, 0)
})
