/**
 * Unit tests for @agent-core/agent-switch — the DSH switch ADAPTER.
 *
 * Proves the adapter contract:
 *   1. registers exactly one tool named agent_core.switch_agent;
 *   2. execute() forwards {targetAgentId, targetSessionId} verbatim over the
 *      agentRpc relay to the Router's switch method (no policy of its own);
 *   3. explicit session passes through; omitted stays undefined (the Router
 *      decides "main");
 *   4. a failed parent answer becomes a tool error;
 *   5. the adapter owns no persistence / lookup / session-selection state.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { apply, TOOL_NAME, SWITCH_RPC_METHOD } from '../src/index.js'

/** Fake ctx: agentRpc records calls; tools capture the registered tool. */
function fakeCtx() {
  const rpcCalls = []
  let registeredTool
  const ctx = {
    rpcCalls,
    agentRpc: {
      // The demo-server contract: agentRpc.request resolves with the answer
      // envelope { ok, result } (the parent's rpc.response payload result).
      request: async (method, params) => {
        rpcCalls.push({ method, params })
        return { ok: true, result: { channelConversationId: 'feishu:chat-main', activeAgentId: 'agt_b', activeSessionId: 'main', updatedAt: '2026-08-15T00:00:00.000Z' } }
      },
    },
    inject: (deps, fn) => {
      assert.deepEqual(deps, ['tools'])
      fn({ tools: { register: (tool) => { registeredTool = tool; return () => {} } } })
    },
    get registeredTool() { return registeredTool },
  }
  return ctx
}

test('registers exactly the agent_core_switch_agent tool', () => {
  const ctx = fakeCtx()
  const dispose = apply(ctx, {})
  assert.equal(typeof dispose, 'function', 'arrow apply returns a disposer')
  assert.equal(ctx.registeredTool.name, TOOL_NAME)
  assert.equal(TOOL_NAME, 'agent_core_switch_agent')
  assert.match(TOOL_NAME, /^[a-zA-Z0-9_-]+$/, 'provider-safe tool name (opencode-go rejects dotted names)')
  // defineTool compiles the parameter spec into JSON Schema: targetAgentId
  // is required (top-level required array), targetSessionId optional.
  assert.ok(ctx.registeredTool.parameters.required.includes('targetAgentId'))
  assert.ok(!ctx.registeredTool.parameters.required.includes('targetSessionId'))
  dispose()
})

test('execute forwards args verbatim to the Router over agentRpc', async () => {
  const ctx = fakeCtx()
  apply(ctx, {})
  const result = await ctx.registeredTool.execute({ targetAgentId: 'agt_b' })

  assert.equal(ctx.rpcCalls.length, 1)
  assert.equal(ctx.rpcCalls[0].method, SWITCH_RPC_METHOD)
  assert.deepEqual(ctx.rpcCalls[0].params, { targetAgentId: 'agt_b', targetSessionId: undefined },
    'omitted session stays undefined — Router decides main')
  assert.equal(result.ok, true)
  assert.equal(result.binding.activeAgentId, 'agt_b')
})

test('explicit targetSessionId passes through untouched (Router policy)', async () => {
  const ctx = fakeCtx()
  apply(ctx, {})
  await ctx.registeredTool.execute({ targetAgentId: 'agt_b', targetSessionId: 'normal-1' })
  assert.deepEqual(ctx.rpcCalls[0].params, { targetAgentId: 'agt_b', targetSessionId: 'normal-1' })
})

test('a failed parent answer becomes a tool error', async () => {
  const ctx = fakeCtx()
  ctx.agentRpc.request = async () => ({ ok: false, error: 'AGENT_NOT_FOUND: agt_x' })
  apply(ctx, {})
  await assert.rejects(() => ctx.registeredTool.execute({ targetAgentId: 'agt_x' }), /AGENT_NOT_FOUND/)
})

test('adapter owns no policy state', () => {
  const ctx = fakeCtx()
  apply(ctx, {})
  // The only observable side effects are the tool registration and the RPC
  // forward — no files, no stores, no lookup tables on the ctx or module.
  assert.equal(Object.keys(ctx).filter((k) => k.startsWith('rpc') || k === 'agentRpc' || k === 'inject' || k === 'registeredTool').length, Object.keys(ctx).length)
})
