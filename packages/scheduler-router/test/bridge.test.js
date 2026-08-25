/**
 * @agent-core/scheduler-router — bridge unit tests (no DSH, no network).
 * Fakes stand in for the Router / AgentProcess / feishu seam so the bridge
 * contract is pinned without spawning processes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRouterInvoker, createFeishuDeliver, chatIdFromDeliveryTo } from '../src/index.js'

function fakeProc({ reply = 'ok-reply', turnResult = null, turnError = null, turns = 0 } = {}) {
  return {
    agentId: 'agent-x',
    pid: 4242,
    exit: undefined,
    turn: async (sessionId, text, opts, timeoutMs) => {
      turns += 1
      if (turnError) throw turnError
      return turnResult ?? { reply, ms: 10, promptMs: 5, messageId: `m-${turns}` }
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
  const proc = fakeProc({ turnResult: { reply: 'ok-reply', reconciliationHandle: 'turn:h', evidence: { promptReceipt: 'accepted' } } })
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
  assert.equal(outcome.reconciliationHandle, 'turn:h')
  assert.deepEqual(outcome.evidence, { promptReceipt: 'accepted' })
  assert.equal(typeof outcome.durationMs, 'number')
  assert.equal(invokeAgent.calls.length, 1)
  assert.equal(invokeAgent.calls[0].aborted, false)
})

test('invoker: post-dispatch failure without termination proof is outcome_unknown', async () => {
  const proc = fakeProc({ turnError: new Error('turn timeout for session s (agent agent-x)') })
  const router = fakeRouter({ proc })
  const invokeAgent = createRouterInvoker(router)
  const outcome = await invokeAgent({ agentId: 'agent-x', sessionId: 's', message: 'hi' })
  assert.equal(outcome.status, 'outcome_unknown')
  assert.match(outcome.error, /turn timeout/)
  assert.equal(outcome.sessionId, 's')
})

test('invoker: exact terminal failure proof remains ordinary error', async () => {
  const terminal = Object.assign(new Error('exact turn failed'), {
    status: 'failed', evidence: { terminationEvidence: 'exact_terminal_then_idle' },
  })
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: terminal }) }))
  const outcome = await invokeAgent({ agentId: 'agent-x', sessionId: 's', message: 'hi' })
  assert.equal(outcome.status, 'error')
  assert.equal(outcome.started, true)
})

test('invoker: unrecognized termination evidence cannot downgrade unknown to failed', async () => {
  const carrier = Object.assign(new Error('ambiguous failure'), {
    status: 'failed', evidence: { terminationEvidence: 'best_effort_guess' },
  })
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: carrier }) }))
  const outcome = await invokeAgent({ agentId: 'agent-x', sessionId: 's', message: 'hi' })
  assert.equal(outcome.status, 'outcome_unknown')
})

test('invoker: occurrence/run/request correlation reaches AgentProcess', async () => {
  let seen
  const proc = {
    turn: async (sessionId, text, opts) => {
      seen = opts.callerCorrelation
      return { reply: 'ok' }
    },
  }
  const invokeAgent = createRouterInvoker(fakeRouter({ proc }))
  await invokeAgent({
    agentId: 'agent-x', sessionId: 'fresh', message: 'hi',
    occurrenceId: 'occ:1', runId: 'run:1', requestId: 'request:1',
  })
  assert.deepEqual(seen, { occurrenceId: 'occ:1', runId: 'run:1', requestId: 'request:1' })
})

test('C-008 same requestId/payload enqueues once; different payload conflicts pre-start', async () => {
  let turns = 0
  const proc = {
    turn: async () => { turns += 1; return { reply: 'once' } },
  }
  const invokeAgent = createRouterInvoker(fakeRouter({ proc }))
  const request = {
    agentId: 'agent-x', sessionId: 'fresh', message: 'hi', requestId: 'occ:one',
    payloadHash: 'sha256:same',
  }
  const [first, second] = await Promise.all([invokeAgent(request), invokeAgent({ ...request })])
  assert.equal(first.status, 'ok')
  assert.equal(second.status, 'ok')
  assert.equal(turns, 1)
  const recreatedInvoker = createRouterInvoker(fakeRouter({ proc }))
  assert.equal((await recreatedInvoker({ ...request })).status, 'ok')
  assert.equal(turns, 1, 'recreating the bridge in the same process does not enqueue again')
  const conflict = await invokeAgent({ ...request, payloadHash: 'sha256:different' })
  assert.equal(conflict.code, 'OCCURRENCE_PAYLOAD_CONFLICT')
  assert.equal(conflict.started, false)
  assert.equal(turns, 1)
})

test('B15 invoker preserves outcome_unknown handle/deadline/evidence', async () => {
  const carrier = Object.assign(new Error('unknown turn'), {
    status: 'outcome_unknown', envelope: 'outcome_unknown', reconciliationHandle: 'turn:unknown',
    deadlineAtWallMs: 1234, evidence: { source: 'turn_deadline_exceeded' },
  })
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: carrier }) }))
  const outcome = await invokeAgent({ agentId: 'agent-x', sessionId: 's', message: 'hi' })
  assert.equal(outcome.status, 'outcome_unknown')
  assert.equal(outcome.reconciliationHandle, 'turn:unknown')
  assert.equal(outcome.deadlineAtWallMs, 1234)
  assert.deepEqual(outcome.evidence, { source: 'turn_deadline_exceeded' })
})

test('invoker: definition validation rejects an unknown agent as error outcome', async () => {
  const proc = fakeProc()
  const router = fakeRouter({ proc })
  const definition = {
    getAgent: () => {
      throw Object.assign(new Error('agent-definition: agent not found: nope'), { code: 'AGENT_NOT_FOUND' })
    },
  }
  const invokeAgent = createRouterInvoker(router, { definition })
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

test('invoker: a DISABLED agent is rejected BEFORE ensureRunning (runnable-agent semantics)', async () => {
  const proc = fakeProc()
  const router = fakeRouter({ proc })
  const definition = {
    getAgent: () => ({ id: 'agent-x', name: 'X', description: null, disabled: true }),
  }
  const invokeAgent = createRouterInvoker(router, { definition })
  const outcome = await invokeAgent({ agentId: 'agent-x', sessionId: 's', message: 'hi' })
  assert.equal(outcome.status, 'error')
  assert.match(outcome.error, /disabled/)
  assert.equal(router.ensured.length, 0, 'ensureRunning must not be called for a disabled agent')
  assert.equal(invokeAgent.calls[0].outcome.status, 'error')
})
