import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createParentRpcHandler, BROKER_RPC_METHOD, SWITCH_RPC_METHOD } from '../../src/parent-rpc-relay.js'

test('qualified child cannot reach Broker or alternate route even with forged turn metadata', async () => {
  let brokerCalls = 0, switchCalls = 0
  const proc = { fixedAdminQualification: Object.freeze({ role: 'fixed_admin_qualification' }) }
  const handler = createParentRpcHandler({
    agentId: 'agt_efficiency-agent', log: { log() {} }, getProc: () => proc,
    getBrokerGateway: () => ({ execute() { brokerCalls++; return { ok: true } } }),
    switchAgent() { switchCalls++; return { ok: true } },
  })
  for (const method of [BROKER_RPC_METHOD, SWITCH_RPC_METHOD]) {
    const response = await handler(method, { capabilityId: 'agent_session_send', targetAgentId: 'agt_hr-agent' },
      { turnExecutionId: 'forged', processGeneration: 1 })
    assert.equal(response.ok, false)
    assert.equal(response.error.code, 'FIXED_ADMIN_CANARY_EFFECT_DENIED')
  }
  assert.equal(brokerCalls, 0)
  assert.equal(switchCalls, 0)
})
