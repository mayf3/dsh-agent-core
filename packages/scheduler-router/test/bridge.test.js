/**
 * @agent-core/scheduler-router — bridge unit tests (no DSH, no network).
 * Fakes stand in for the Router / AgentProcess / feishu seam so the bridge
 * contract is pinned without spawning processes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRouterInvoker, createFeishuDeliver, chatIdFromDeliveryTo } from '../src/index.js'

function fakeProc({ reply = 'ok-reply', turnError = null, turns = 0 } = {}) {
  return {
    agentId: 'agent-x',
    pid: 4242,
    exit: undefined,
    turn: async (sessionId, text, opts, timeoutMs) => {
      turns += 1
      if (turnError) throw turnError
      return { reply, ms: 10, promptMs: 5, messageId: `m-${turns}` }
    },
  }
}

function fakeRouter({ proc, ensureError = null, ensured = [] } = {}) {
  return {
    ensureRunning: async (agentId) => {
      ensured.push(agentId)
      if (ensureError) throw ensureError
      return proc
    },
    ensured,
  }
}

function fakeFeishu({ replyError = null, replies = [] } = {}) {
  return {
    reply: async (target, text) => {
      if (replyError) throw replyError
      const result = { messageId: `om_${replies.length + 1}`, chatId: target.receiveId, method: 'create', code: 0 }
      replies.push({ target, text, result })
      return result
    },
    replies,
  }
}

test('invoker: happy path maps turn reply into the scheduler outcome envelope', async () => {
  const proc = fakeProc()
  const router = fakeRouter({ proc })
  const invokeAgent = createRouterInvoker(router)
  const outcome = await invokeAgent({
    agentId: 'agent-x',
    sessionId: 'agent:agent-x:cron:j1',
    message: 'hello',
    timeoutMs: 1000,
  })
  assert.equal(outcome.status, 'ok')
  assert.equal(outcome.summary, 'ok-reply')
  assert.equal(outcome.sessionId, 'agent:agent-x:cron:j1')
  assert.equal(typeof outcome.durationMs, 'number')
  assert.equal(invokeAgent.calls.length, 1)
  assert.equal(invokeAgent.calls[0].aborted, false)
})

test('invoker: turn failure becomes an error outcome, never a throw', async () => {
  const proc = fakeProc({ turnError: new Error('turn timeout for session s (agent agent-x)') })
  const router = fakeRouter({ proc })
  const invokeAgent = createRouterInvoker(router)
  const outcome = await invokeAgent({ agentId: 'agent-x', sessionId: 's', message: 'hi' })
  assert.equal(outcome.status, 'error')
  assert.match(outcome.error, /turn timeout/)
  assert.equal(outcome.sessionId, 's')
})

test('invoker: registry validation rejects an unknown agent as error outcome', async () => {
  const proc = fakeProc()
  const router = fakeRouter({ proc })
  const registry = {
    getAgent: () => {
      throw Object.assign(new Error('agent-registry: agent not found: nope'), { code: 'AGENT_NOT_FOUND' })
    },
  }
  const invokeAgent = createRouterInvoker(router, { registry })
  const outcome = await invokeAgent({ agentId: 'nope', sessionId: 's', message: 'hi' })
  assert.equal(outcome.status, 'error')
  assert.match(outcome.error, /not found/)
  assert.equal(router.ensured.length, 0, 'ensureRunning must not be called for unknown agents')
})

test('invoker: an aborted signal is recorded on the call log', async () => {
  const proc = fakeProc()
  const router = fakeRouter({ proc })
  const invokeAgent = createRouterInvoker(router)
  const controller = new AbortController()
  const pending = invokeAgent({ agentId: 'agent-x', sessionId: 's', message: 'hi', signal: controller.signal })
  controller.abort()
  await pending
  assert.equal(invokeAgent.calls[0].aborted, true)
})

test('invoker: turn poll gets a margin over the scheduler timeout so the scheduler race wins', async () => {
  let seenTimeout
  const proc = {
    pid: 1,
    turn: async (sessionId, text, opts, timeoutMs) => {
      seenTimeout = timeoutMs
      return { reply: 'r', ms: 1, promptMs: 1, messageId: 'm' }
    },
  }
  const invokeAgent = createRouterInvoker(fakeRouter({ proc }))
  await invokeAgent({ agentId: 'a', sessionId: 's', message: 'hi', timeoutMs: 1000 })
  assert.equal(seenTimeout, 31_000)
})

test('chatIdFromDeliveryTo: accepts chat: prefix and bare chat id, rejects others', () => {
  assert.equal(chatIdFromDeliveryTo('chat:oc_abc123'), 'oc_abc123')
  assert.equal(chatIdFromDeliveryTo('oc_abc123'), 'oc_abc123')
  assert.throws(() => chatIdFromDeliveryTo('p2p:ou_1'), /unsupported delivery target/)
  assert.throws(() => chatIdFromDeliveryTo(''), /non-empty/)
})

test('deliver: announce maps job.delivery.to onto the feishu.reply seam', async () => {
  const feishu = fakeFeishu()
  const deliver = createFeishuDeliver(feishu)
  const job = { id: 'j1', delivery: { mode: 'announce', channel: 'feishu', to: 'chat:oc_abc123' } }
  const sent = await deliver({ job, result: { status: 'ok' }, text: 'hello announce' })
  assert.equal(sent.messageId, 'om_1')
  assert.equal(feishu.replies.length, 1)
  const { target, text } = feishu.replies[0]
  assert.equal(target.kind, 'create')
  assert.equal(target.receiveId, 'oc_abc123')
  assert.equal(target.receiveIdType, 'chat_id')
  assert.equal(text, 'hello announce')
  assert.equal(deliver.deliveries.length, 1)
  assert.equal(deliver.deliveries[0].chatId, 'oc_abc123')
})

test('deliver: non-feishu channel throws -> scheduler marks not-delivered', async () => {
  const feishu = fakeFeishu()
  const deliver = createFeishuDeliver(feishu)
  const job = { id: 'j2', delivery: { mode: 'announce', channel: 'telegram', to: 'chat:oc_x' } }
  await assert.rejects(() => deliver({ job, result: { status: 'ok' }, text: 'x' }), /unsupported delivery channel/)
  assert.equal(feishu.replies.length, 0)
})

test('deliver: feishu.reply failure propagates -> not-delivered', async () => {
  const feishu = fakeFeishu({ replyError: new Error('im.message.create: 99991661 chat not found') })
  const deliver = createFeishuDeliver(feishu)
  const job = { id: 'j3', delivery: { mode: 'announce', channel: 'feishu', to: 'chat:oc_x' } }
  await assert.rejects(() => deliver({ job, result: { status: 'ok' }, text: 'x' }), /chat not found/)
})
