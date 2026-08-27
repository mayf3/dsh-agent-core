/**
 * Unit tests for the Router's broker parent-RPC dispatch (trusted credential
 * broker model): the caller identity is the ACTUAL proc.agentId; forged
 * child-supplied identity fields are ignored (and logged); the call is
 * forwarded to the in-process broker gateway.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { AgentProcess } from '../src/process.js'
import { apply as applyRouter, BROKER_RPC_METHOD, SWITCH_RPC_METHOD } from '../src/index.js'

function fakeCtx(services) {
  const provided = new Map()
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => { const dispose = fn(); return () => dispose?.() },
  }
}

function stubBootstrap() {
  return {
    resolveWorkspace: (agentId) => join('/tmp/ws', agentId),
    resolveDshHome: (agentId) => join('/tmp/home', agentId),
    ensure: async () => ({ workspace: '/tmp/ws', dshHome: '/tmp/home' }),
  }
}

/** Stub AgentProcess so ensureRunning installs the RPC hook without spawning. */
function stubAgentProcess() {
  AgentProcess.prototype.spawn = function spawnStub() {
    this.pid = 4242
    this.exit = undefined
    this.exitPromise = new Promise(() => {})
    return this
  }
  AgentProcess.prototype.ready = async () => 0
  AgentProcess.prototype.turn = async () => ({ reply: 'stub-reply', messageId: 'stub-msg' })
  AgentProcess.prototype.shutdown = async () => ({ code: 0, signal: null })
}

async function freshRouter(t, services = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-broker-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [
      { id: 'agt_a', name: 'Agent A' },
      { id: 'agt_b', name: 'Agent B' },
    ],
  })
  const definition = new AgentDefinition({ configFile })
  const agentA = definition.getAgent('agt_a')
  const agentB = definition.getAgent('agt_b')
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentDefinition', {
      listAgents: () => definition.listAgents(),
      getAgent: (id) => definition.getAgent(id),
      getDefaultAgent: () => definition.getDefaultAgent(),
      resolveAgentRef: (ref) => definition.resolveAgentRef(ref),
    }],
    ...Object.entries(services),
  ]))
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-demo',
  })
  return { router, definition, agentA, agentB }
}

test('broker RPC: executed as the ACTUAL proc.agentId via the gateway', async (t) => {
  stubAgentProcess()
  const gatewayCalls = []
  const gateway = {
    execute: async (call, ctx) => {
      gatewayCalls.push({ call, ctx })
      return { ok: true, result: { items: [] } }
    },
  }
  const { router, agentA } = await freshRouter(t, { brokerGateway: gateway })
  const proc = await router.ensureRunning(agentA.id)

  const result = await proc.onRpcRequest(BROKER_RPC_METHOD, {
    capabilityId: 'forum_my_notifications',
    operation: 'list',
    args: {},
  })
  // Transport envelope always ok:true; the business envelope rides inside.
  assert.deepEqual(result, { ok: true, result: { ok: true, result: { items: [] } } })
  assert.equal(gatewayCalls.length, 1)
  assert.equal(gatewayCalls[0].ctx.agentId, agentA.id, 'identity = the actual proc agentId')
  assert.equal(gatewayCalls[0].ctx.ingressContext, undefined, 'outside an active turn there is no trusted ingress context')
  assert.deepEqual(gatewayCalls[0].call, {
    capabilityId: 'forum_my_notifications',
    operation: 'list',
    args: {},
  })
})

test('broker RPC: passes the exact immutable active-turn context beside actual agentId', async (t) => {
  stubAgentProcess()
  const gatewayCalls = []
  const gateway = {
    execute: async (call, ctx) => {
      gatewayCalls.push({ call, ctx })
      return { ok: true, result: 'ok' }
    },
  }
  const { router, agentA } = await freshRouter(t, { brokerGateway: gateway })
  const proc = await router.ensureRunning(agentA.id)
  const activeIngressContext = Object.freeze({
    callerAgentId: agentA.id,
    processGeneration: proc.processGeneration,
    turnExecutionId: 'turn:exact',
    channelNamespace: 'feishu',
    channelConversationId: 'feishu:thread-conversation',
    feishuChatId: 'oc_exact_chat',
    feishuConversationId: 'oc_exact_chat:topic_exact',
    feishuMessageId: 'om_exact',
  })
  proc.activeIngressContext = activeIngressContext
  proc.executions.set(activeIngressContext.turnExecutionId, { settled: false })

  await proc.onRpcRequest(BROKER_RPC_METHOD, {
    capabilityId: 'scheduler', operation: 'create', args: { action: 'create' },
  }, { turnExecutionId: activeIngressContext.turnExecutionId })

  assert.equal(gatewayCalls[0].ctx.agentId, agentA.id)
  assert.equal(gatewayCalls[0].ctx.ingressContext, activeIngressContext, 'parent forwards the exact Router-owned immutable object')
  assert.equal(gatewayCalls[0].ctx.ingressContext.feishuChatId, 'oc_exact_chat')
  assert.notEqual(gatewayCalls[0].ctx.ingressContext.feishuChatId, gatewayCalls[0].ctx.ingressContext.feishuConversationId)
})

test('broker RPC: stale generation, settled execution, and cleared turn never forward ingress context', async (t) => {
  stubAgentProcess()
  const gatewayCalls = []
  const gateway = { execute: async (_call, ctx) => { gatewayCalls.push(ctx); return { ok: false, error: { code: 'invalid_arguments' } } } }
  const { router, agentA } = await freshRouter(t, { brokerGateway: gateway })
  const proc = await router.ensureRunning(agentA.id)
  const base = {
    callerAgentId: agentA.id,
    processGeneration: proc.processGeneration,
    turnExecutionId: 'turn:stale',
    channelNamespace: 'feishu',
    feishuChatId: 'oc_stale',
  }
  proc.activeIngressContext = Object.freeze({ ...base, processGeneration: proc.processGeneration - 1 })
  proc.executions.set('turn:stale', { settled: false })
  await proc.onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'scheduler', operation: 'list', args: {} })
  proc.activeIngressContext = Object.freeze(base)
  proc.executions.set('turn:stale', { settled: true })
  await proc.onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'scheduler', operation: 'list', args: {} })
  proc.activeIngressContext = undefined
  await proc.onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'scheduler', operation: 'list', args: {} })
  assert.deepEqual(gatewayCalls.map((ctx) => ctx.ingressContext), [undefined, undefined, undefined])
})

test('broker RPC: delayed turn-A carrier cannot inherit live turn-B ingress context', async (t) => {
  stubAgentProcess()
  const seen = []
  const gateway = { execute: async (_call, ctx) => { seen.push(ctx.ingressContext); return { ok: true, result: 'ok' } } }
  const { router, agentA } = await freshRouter(t, { brokerGateway: gateway })
  const proc = await router.ensureRunning(agentA.id)
  const turnB = Object.freeze({
    callerAgentId: agentA.id,
    processGeneration: proc.processGeneration,
    turnExecutionId: 'turn:B',
    channelNamespace: 'feishu',
    feishuChatId: 'oc_B',
  })
  proc.activeIngressContext = turnB
  proc.executions.set('turn:B', { settled: false })
  const call = { capabilityId: 'scheduler', operation: 'list', args: {} }
  await proc.onRpcRequest(BROKER_RPC_METHOD, call, { turnExecutionId: 'turn:A' })
  await proc.onRpcRequest(BROKER_RPC_METHOD, call, { turnExecutionId: 'turn:B' })
  assert.equal(seen[0], undefined, 'turn-A origin token cannot borrow B')
  assert.equal(seen[1], turnB, 'the exact B origin token receives B context')
})

test('broker RPC: forged child-supplied identity/context is IGNORED (actual Router values win)', async (t) => {
  stubAgentProcess()
  const gatewayCalls = []
  const gateway = {
    execute: async (call, ctx) => {
      gatewayCalls.push({ call, ctx })
      return { ok: true, result: 'ok' }
    },
  }
  const { router, agentA } = await freshRouter(t, { brokerGateway: gateway })
  const proc = await router.ensureRunning(agentA.id)
  const trustedContext = Object.freeze({
    callerAgentId: agentA.id,
    processGeneration: proc.processGeneration,
    turnExecutionId: 'turn:trusted',
    channelNamespace: 'feishu',
    channelConversationId: 'feishu:trusted-conversation',
    feishuChatId: 'oc_trusted',
    feishuConversationId: 'oc_trusted:topic',
    feishuMessageId: 'om_trusted',
  })
  proc.activeIngressContext = trustedContext
  proc.executions.set(trustedContext.turnExecutionId, { settled: false })

  const result = await proc.onRpcRequest(BROKER_RPC_METHOD, {
    capabilityId: 'forum_my_notifications',
    operation: 'list',
    args: {},
    agentId: 'agt-forged-B',
    principalId: 'forged-principal',
    clientId: 'mc_forged',
    scope: ['*'],
    audience: 'svc-forum',
    authorization: 'Bearer forged',
    callerAgentId: 'agt-forged-B',
    processGeneration: 999,
    turnExecutionId: 'turn:forged',
    feishuChatId: 'oc_forged',
    ingressContext: { feishuChatId: 'oc_forged_nested' },
    activeIngressContext: { feishuChatId: 'oc_forged_active' },
  }, { turnExecutionId: trustedContext.turnExecutionId })
  assert.equal(result.ok, true)
  assert.equal(result.result.ok, true)
  assert.equal(gatewayCalls[0].ctx.agentId, agentA.id, 'forged fields never reach the gateway identity')
  assert.equal(gatewayCalls[0].ctx.ingressContext, trustedContext, 'forged child context cannot override Router-owned context')
  assert.equal(gatewayCalls[0].ctx.ingressContext.feishuChatId, 'oc_trusted')
  assert.equal(gatewayCalls[0].call.agentId, undefined, 'forged fields are not forwarded as the call identity')
  assert.equal(gatewayCalls[0].call.ingressContext, undefined, 'forged context fields are not forwarded in the call')
})

test('broker RPC: gateway absent -> fails closed, switch RPC unaffected', async (t) => {
  stubAgentProcess()
  const { router, agentA, agentB } = await freshRouter(t) // no brokerGateway service
  const proc = await router.ensureRunning(agentA.id)

  const result = await proc.onRpcRequest(BROKER_RPC_METHOD, {
    capabilityId: 'forum_my_notifications',
    operation: 'list',
    args: {},
  })
  assert.equal(result.ok, true, 'transport envelope stays ok')
  assert.equal(result.result.ok, false)
  assert.match(result.result.error.detail, /broker gateway unavailable/)

  // The existing switch seam still works (inside a routed turn the proc
  // carries its binding context).
  proc.activeBindingContext = 'feishu:chat-1'
  const switched = await proc.onRpcRequest(SWITCH_RPC_METHOD, { targetAgentId: agentB.id })
  assert.equal(switched.activeAgentId, agentB.id)
})

test('broker RPC: unknown method still rejected', async (t) => {
  stubAgentProcess()
  const { router, agentA } = await freshRouter(t)
  const proc = await router.ensureRunning(agentA.id)
  await assert.rejects(() => proc.onRpcRequest('agent-core/nope', {}), /unknown parent-RPC method/)
})
