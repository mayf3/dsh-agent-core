/**
 * Generic parent-RPC stop barrier (Product #434): the old-worker effect fence
 * is agent-agnostic. A child that is draining, exited, or whose exit the
 * parent already observed loses EVERY parent-side effect path (Broker
 * capability call and Binding switch) before any gateway lookup or effect
 * dispatch — for ANY agent, not just the incident's original subject. A live
 * READY child keeps the ordinary semantics (broker executes under the
 * Router-owned identity; switch resolves through the domain operation).
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { createParentRpcHandler, BROKER_RPC_METHOD, SWITCH_RPC_METHOD } from '../../src/parent-rpc-relay.js'

const log = { log: () => {}, error: () => {} }

function handler({ proc, gateway, switchAgent }) {
  return createParentRpcHandler({
    agentId: 'agt_parity-subject',
    log,
    getProc: () => proc,
    getBrokerGateway: () => gateway,
    switchAgent: switchAgent ?? (async () => ({ switched: true })),
  })
}

const liveProc = () => ({ state: 'READY', processGeneration: 2, exit: undefined,
  activeIngressContext: undefined, executions: new Map() })

test('draining child of an ordinary agent loses broker and switch at the stop barrier', async () => {
  for (const state of ['DRAINING', 'EXITED']) {
    const gatewayExecutions = []
    const switchCalls = []
    const onRpcRequest = handler({
      proc: { ...liveProc(), state },
      gateway: { execute: async (req) => { gatewayExecutions.push(req); return { ok: true, result: {} } } },
      switchAgent: async (...args) => { switchCalls.push(args); return {} },
    })
    const broker = await onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'cap', operation: 'op', args: {} })
    assert.deepEqual(broker, { ok: false, error: { code: 'PROCESS_STOP_BARRIER_EFFECT_DENIED' } })
    const sw = await onRpcRequest(SWITCH_RPC_METHOD, { targetAgentId: 'agt_other' })
    assert.deepEqual(sw, { ok: false, error: { code: 'PROCESS_STOP_BARRIER_EFFECT_DENIED' } })
    assert.equal(gatewayExecutions.length, 0, 'gateway must never be reached past the barrier')
    assert.equal(switchCalls.length, 0, 'switch must never be reached past the barrier')
  }
})

test('a child whose exit the parent observed is denied even while its socket lingers', async () => {
  const gatewayExecutions = []
  const onRpcRequest = handler({
    proc: { ...liveProc(), exit: { code: 0 } },
    gateway: { execute: async (req) => { gatewayExecutions.push(req); return { ok: true, result: {} } } },
  })
  const broker = await onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'cap', operation: 'op', args: {} })
  assert.deepEqual(broker, { ok: false, error: { code: 'PROCESS_STOP_BARRIER_EFFECT_DENIED' } })
  assert.equal(gatewayExecutions.length, 0)
})

test('live READY child keeps the ordinary broker and switch semantics', async () => {
  const executions = []
  const switchCalls = []
  const onRpcRequest = handler({
    proc: { ...liveProc(), activeBindingContext: { binding: 'live-turn' } },
    gateway: { execute: async (req) => { executions.push(req); return { ok: true, result: { done: true } } } },
    switchAgent: async (...args) => { switchCalls.push(args); return { switched: true } },
  })
  const broker = await onRpcRequest(BROKER_RPC_METHOD,
    { capabilityId: 'cap', operation: 'op', args: { n: 1 } }, { turnExecutionId: undefined })
  assert.deepEqual(broker, { ok: true, result: { done: true } })
  assert.equal(executions.length, 1)
  assert.equal(executions[0].capabilityId, 'cap')
  assert.deepEqual(executions[0].args, { n: 1 })
  const sw = await onRpcRequest(SWITCH_RPC_METHOD, { targetAgentId: 'agt_other' })
  assert.deepEqual(sw, { switched: true })
  assert.equal(switchCalls.length, 1)
  assert.deepEqual(switchCalls[0][0], { binding: 'live-turn' })
})

test('real AgentProcess captures workflow origin before first prompt RPC and keeps it immutable', async t => {
  const { makeFx } = await import('../helpers/fake-child.js')
  const fx = makeFx()
  t.after(() => fx.childExit())
  await fx.readyNow()
  const origin = { kind: 'workflow_execution', workflowInstanceId: '11111111-1111-4111-8111-111111111111',
    nodeVisitId: '22222222-2222-4222-8222-222222222222', attemptId: 'wfeat-' + 'b'.repeat(24) }
  const expected = { ...origin }
  const pending = fx.proc.deliver('main', 'ordinary task', { messageOrigin: origin })
  await fx.tick()
  const prompt = fx.writes.filter(w => w.method === 'session/prompt').at(-1)
  const turnId = prompt.params.turnExecutionId
  assert.ok(turnId)
  const execution = fx.proc.executions.get(turnId)
  assert.deepEqual(execution.workflowProvenance, expected)
  assert.equal(Object.isFrozen(execution.workflowProvenance), true)
  assert.throws(() => { execution.workflowProvenance = {} }, TypeError)
  origin.workflowInstanceId = 'forged-after-capture'
  const seen = []
  const rpc = createParentRpcHandler({ agentId: fx.proc.agentId, getProc: () => fx.proc, log,
    getBrokerGateway: () => ({ execute: async (call, trusted) => { seen.push(trusted); return { ok: true } } }) })
  assert.equal((await rpc(BROKER_RPC_METHOD, { capabilityId: 'workflow_execute', operation: 'create_instance', args: {},
    sourceTurnExecutionId: 'forged', workflowProvenance: {} }, { turnExecutionId: turnId })).ok, true)
  assert.deepEqual(seen[0].workflowProvenance, expected)
  assert.equal(seen[0].sourceTurnExecutionId, turnId)
  // Only now return the prompt receipt: classification did not depend on it.
  fx.respondTo('session/prompt', { messageId: 'managed-message' })
  await pending
  fx.completeTurn('main', 'managed-message', 'done')
  await fx.tick()
})

test('real completed managed turn cannot erase stale RPC correlation into ordinary fallback', async t => {
  const { makeFx } = await import('../helpers/fake-child.js')
  const fx = makeFx(); t.after(() => fx.childExit()); await fx.readyNow()
  const calls = []
  fx.proc.onRpcRequest = handler({ proc: fx.proc,
    gateway: { execute: async call => { calls.push(call); return { ok: true, result: {} } } } })
  const pending = fx.proc.deliver('main', 'managed task', { messageOrigin: {
    kind: 'workflow_execution', workflowInstanceId: '11111111-1111-4111-8111-111111111111',
    nodeVisitId: '22222222-2222-4222-8222-222222222222', attemptId: 'wfeat-' + 'b'.repeat(24) } })
  await fx.tick()
  const turnId = fx.writes.filter(w => w.method === 'session/prompt').at(-1).params.turnExecutionId
  fx.respondTo('session/prompt', { messageId: 'managed-message' }); await pending
  fx.completeTurn('main', 'managed-message', 'done'); await fx.tick()
  assert.equal(fx.proc.executions.has(turnId), false)
  const late = fx.proc.handleRpcRequest({ requestId: 'late-managed-create', method: BROKER_RPC_METHOD,
    params: { capabilityId: 'workflow_execute', operation: 'create_instance', args: {} }, turnExecutionId: turnId })
  for (let i = 0; i < 1000 && !fx.writes.some(w => w.method === 'rpc.response'); i++) await fx.tick()
  const reply = fx.writes.find(w => w.method === 'rpc.response')
  if (reply) fx.respondTo('rpc.response', {})
  await late
  assert.equal(calls.length, 0)
  assert.deepEqual(reply?.params.result, { ok: false, error: { code: 'authoritative_reference_unavailable' } })
})

test('invalid supplied turn correlation refuses while proven live unmanaged turns retain ordinary routing', async () => {
  const proc = liveProc(), calls = []
  proc.executions.set('live-unmanaged', { settled: false })
  const rpc = handler({ proc, gateway: { execute: async call => { calls.push(call); return { ok: true } } } })
  for (const turnExecutionId of ['missing', '', null]) {
    assert.equal((await rpc(BROKER_RPC_METHOD, {}, { turnExecutionId })).error.code, 'authoritative_reference_unavailable')
  }
  assert.equal(calls.length, 0)
  assert.equal((await rpc(BROKER_RPC_METHOD, {}, { turnExecutionId: 'live-unmanaged' })).ok, true)
  assert.equal(calls.length, 1)
})
