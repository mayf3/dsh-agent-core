import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BROKER_RPC_METHOD, SWITCH_RPC_METHOD, createParentRpcHandler } from '../../src/parent-rpc-relay.js'

test('draining old HR child cannot invoke Broker or switch after the stop barrier', async () => {
  let effects = 0
  const proc = { state: 'DRAINING', fixedAdminQualification: null,
    activeBindingContext: { channelConversationId: 'feishu:old' }, executions: new Map() }
  const handler = createParentRpcHandler({
    agentId: 'agt_hr-agent', log: { log() {} }, getProc: () => proc,
    getBrokerGateway: () => ({ execute: async () => { effects++; return { ok: true } } }),
    switchAgent: async () => { effects++; return { ok: true } },
  })
  const broker = await handler(BROKER_RPC_METHOD, { capabilityId: 'scheduler', operation: 'create', args: {} })
  const switched = await handler(SWITCH_RPC_METHOD, { targetAgentId: 'agt_hr-agent' })
  assert.equal(broker.ok, false)
  assert.equal(switched.ok, false)
  assert.equal(effects, 0)
})

test('a child bound to the old runtime epoch cannot invoke Broker after a fresh HR cut', async () => {
  let effects = 0
  const proc = { state: 'READY', fixedAdminQualification: null,
    store: { runtimeEpoch: 'old-runtime', freshHrLineage: {
      agentId: 'agt_hr-agent', newRuntimeEpoch: 'new-runtime', oldProcessGeneration: 1,
    } }, processGeneration: 1, executions: new Map() }
  const handler = createParentRpcHandler({
    agentId: 'agt_hr-agent', log: { log() {} }, getProc: () => proc,
    getBrokerGateway: () => ({ execute: async () => { effects++; return { ok: true } } }),
    switchAgent: async () => { effects++; return { ok: true } },
  })
  const result = await handler(BROKER_RPC_METHOD, { capabilityId: 'scheduler', operation: 'create', args: {} })
  assert.equal(result.ok, false)
  assert.equal(effects, 0)
})
