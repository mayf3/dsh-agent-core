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
  // INVOKE-SHAPED envelope returned verbatim (no extra transport wrapper):
  // rpc-channel + the child-side RPC server build the single {ok,result}
  // transport layer themselves — see the seam regression test below.
  assert.deepEqual(result, { ok: true, result: { items: [] } })
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
  assert.deepEqual(result, { ok: true, result: 'ok' })
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
  assert.equal(result.ok, false)
  assert.match(result.error.detail, /broker gateway unavailable/)

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

// ── SCHEDULER_TOOL_SURFACE_RESPONSE_FIX_V1 seam regression: the envelope
// DEPTH contract across the real wire. The handler's return value travels:
// rpc-channel rpc.response params.result -> child RPC server resolves
// {ok:true, result: params.result} -> broker relay unwraps exactly TWO
// layers. An extra {ok,result} wrapper at the handler made every scheduler
// create come back as mutation_outcome_unknown while the store had committed
// (reads merely leaked an extra envelope layer into the model-visible JSON).
import { schedulerManifests } from '../../broker/src/capabilities/scheduler.js'
import { createRelayHandlers } from '../../broker/src/relay.js'

/** Verbatim child-side wire resolution (demo-server rpc.response branch). */
function childResolved(handlerValue) {
  // rpc-channel response construction (ok:true, result: winner.value), then
  // a real stdio JSON round-trip, then the demo-server waiter resolution.
  const params = JSON.parse(JSON.stringify({ requestId: 'rpc-1', ok: true, result: handlerValue }))
  if (params?.ok !== true) throw new Error('parent RPC failed')
  return { ok: true, result: params.result }
}

const ELEVEN_FIELDS = {
  jobId: 'job-1', name: 'daily', enabled: true,
  normalizedSchedule: { kind: 'every', everyMs: 60_000 }, timezone: null,
  nextRunAt: '2030-01-01T00:00:00.000Z', targetAgentId: 'agt_a',
  exactPersistedDeliveryDestination: null, autoRetry: false,
  deleteAfterRun: false, auditStatus: 'appended',
}

function schedulerSeamDefinition(gatewayExecute) {
  const requestFn = async (call) => {
    let handlerValue
    try {
      handlerValue = await gatewayExecute(call)
    } catch (error) {
      // rpc-channel error path: the response carries ok:false + message and
      // the child REJECTS the agentRpc.request promise.
      throw new Error(error instanceof Error ? error.message : String(error))
    }
    return childResolved(handlerValue)
  }
  return createRelayHandlers(schedulerManifests[0], requestFn)
}

test('seam: a committed scheduler create reaches the model as the exact 11-field success (no double transport envelope)', async () => {
  const calls = []
  const relay = schedulerSeamDefinition(async (call) => {
    calls.push(call)
    return { ok: true, result: ELEVEN_FIELDS } // gateway invoke shape
  })
  const out = await relay.create({}, { name: 'daily', schedule_kind: 'every', every_ms: 60_000, message: 'work' })
  assert.deepEqual(out, ELEVEN_FIELDS)
  assert.equal(calls.length, 1, 'one relay hop — zero automatic retry')
})

test('seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept)', async () => {
  const calls = []
  const relay = schedulerSeamDefinition(async (call) => {
    calls.push(call)
    throw new Error('response channel lost after possible commit')
  })
  const out = await relay.create({}, { name: 'daily', schedule_kind: 'every', every_ms: 60_000, message: 'work' })
  assert.equal(out.errorCode, 'mutation_outcome_unknown')
  assert.match(out.detail, /response was lost/)
  assert.equal(calls.length, 1, 'no automatic retry of an outcome-unknown mutation')
})

test('seam: a structured gateway failure passes through declared codes verbatim at the correct depth', async () => {
  const relay = schedulerSeamDefinition(async () => ({
    ok: false, error: { code: 'mutation_outcome_unknown', detail: 'scheduler mutation outcome is unknown; inspect current state before any manual retry' },
  }))
  const out = await relay.create({}, { name: 'daily', schedule_kind: 'every', every_ms: 60_000, message: 'work' })
  assert.equal(out.errorCode, 'mutation_outcome_unknown')
  assert.match(out.detail, /outcome is unknown/)
})

// Same seam, same fix, cross-goal consumer (ASM): agent_session_send results
// must survive the corrected envelope depth — accepted/replied/timeout are
// the strict-shape successes the relay's validSessionSendResult demands, and
// an extra transport layer would turn every one into outcome_unknown.
import { agentSessionMessagingManifest } from '../../broker/src/capabilities/agent-session-messaging.js'

test('seam: agent_session_send accepted/replied/timeout survive the corrected depth; a gateway throw stays outcome_unknown with zero retry', async () => {
  const cases = [
    { status: 'accepted' },
    { status: 'timeout' },
    { status: 'replied', reply: 'the target answered' },
  ]
  for (const business of cases) {
    const relay = createRelayHandlers(agentSessionMessagingManifest, async () => childResolved({ ok: true, result: business }))
    const out = await relay.send({}, { targetAgentId: 'agt_b-target', message: 'hi', timeoutSeconds: 1 })
    assert.deepEqual(out, business, `wire result for ${business.status}`)
  }

  const calls = []
  const relay = createRelayHandlers(agentSessionMessagingManifest, async (call) => {
    calls.push(call)
    throw new Error('parent RPC channel died mid-send')
  })
  const out = await relay.send({}, { targetAgentId: 'agt_b-target', message: 'hi', timeoutSeconds: 1 })
  assert.equal(out.errorCode, 'outcome_unknown')
  assert.match(out.detail, /do not retry automatically/)
  assert.equal(calls.length, 1, 'zero automatic retry')
})
