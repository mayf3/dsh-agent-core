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
