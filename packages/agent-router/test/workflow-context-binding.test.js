/**
 * FIXED_OPERATION_V1 — Router-side trusted workflow execution context
 * binding tests: the workflow_execution messageOrigin retained on the
 * Router execution record is forwarded to the broker gateway ONLY for the
 * exact current, unsettled execution of this process, and only for the
 * engine's frozen workflow_execution shape. Every other case binds
 * `undefined` (fail closed) so a fixed-operation invocation can never run
 * on prompt-supplied coordinates.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { AgentProcess } from '../src/process.js'
import { apply as applyRouter, BROKER_RPC_METHOD } from '../src/index.js'

const WORKFLOW_ORIGIN = Object.freeze({
  kind: 'workflow_execution',
  workflowInstanceId: '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55',
  nodeVisitId: '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11',
  attemptId: 'wfeat-aaaaaaaaaaaaaaaaaaaaaaaa',
})

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
  const dir = await mkdtemp(join(tmpdir(), 'acr-wfctx-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [{ id: 'agt_a', name: 'Agent A' }],
  })
  const definition = new AgentDefinition({ configFile })
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
  return { router, agentA: definition.getAgent('agt_a') }
}

test('broker RPC: a live workflow turn binds the exact runtime-owned workflow_execution coordinates', async (t) => {
  stubAgentProcess()
  const gatewayCalls = []
  const gateway = { execute: async (call, ctx) => { gatewayCalls.push(ctx); return { ok: true, result: 'ok' } } }
  const { router, agentA } = await freshRouter(t, { brokerGateway: gateway })
  const proc = await router.ensureRunning(agentA.id)
  proc.executions.set('turn:wf', { settled: false, messageOrigin: WORKFLOW_ORIGIN })

  await proc.onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'workflow_fixed_ops', operation: 'invoke', args: {} }, { turnExecutionId: 'turn:wf' })

  assert.deepEqual(gatewayCalls[0].workflowExecutionContext, WORKFLOW_ORIGIN, 'the exact frozen engine sidecar is forwarded')
})

test('broker RPC: settled, stale, absent, and non-workflow turns bind NO workflow context', async (t) => {
  stubAgentProcess()
  const gatewayCalls = []
  const gateway = { execute: async (_call, ctx) => { gatewayCalls.push(ctx); return { ok: true, result: 'ok' } } }
  const { router, agentA } = await freshRouter(t, { brokerGateway: gateway })
  const proc = await router.ensureRunning(agentA.id)

  // Settled execution: the turn is over; no provenance is proven anymore.
  proc.executions.set('turn:settled', { settled: true, messageOrigin: WORKFLOW_ORIGIN })
  await proc.onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'workflow_fixed_ops', operation: 'invoke', args: {} }, { turnExecutionId: 'turn:settled' })

  // Live turn of a DIFFERENT (non-workflow) delivery kind.
  proc.executions.set('turn:plain', { settled: false, messageOrigin: { kind: 'inter_agent', sourceAgentId: agentA.id, correlation: 'c' } })
  await proc.onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'workflow_fixed_ops', operation: 'invoke', args: {} }, { turnExecutionId: 'turn:plain' })

  // Live turn with no messageOrigin at all (ordinary user/channel turn).
  proc.executions.set('turn:user', { settled: false })
  await proc.onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'workflow_fixed_ops', operation: 'invoke', args: {} }, { turnExecutionId: 'turn:user' })

  // Unknown execution handle + absent rpcMeta turnExecutionId.
  await proc.onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'workflow_fixed_ops', operation: 'invoke', args: {} }, { turnExecutionId: 'turn:never-minted' })
  await proc.onRpcRequest(BROKER_RPC_METHOD, { capabilityId: 'workflow_fixed_ops', operation: 'invoke', args: {} })

  assert.deepEqual(gatewayCalls.map((ctx) => ctx.workflowExecutionContext), [undefined, undefined, undefined, undefined, undefined])
})

test('broker RPC: a child cannot self-report workflow coordinates through the call or args', async (t) => {
  stubAgentProcess()
  const gatewayCalls = []
  const gateway = { execute: async (call, ctx) => { gatewayCalls.push({ call, ctx }); return { ok: true, result: 'ok' } } }
  const { router, agentA } = await freshRouter(t, { brokerGateway: gateway })
  const proc = await router.ensureRunning(agentA.id)

  // The relay carries the forged fields in params — the gateway context must
  // still answer with the Router-proven value (undefined here), never the
  // child-supplied one.
  await proc.onRpcRequest(BROKER_RPC_METHOD, {
    capabilityId: 'workflow_fixed_ops',
    operation: 'invoke',
    args: { workflowInstanceId: WORKFLOW_ORIGIN.workflowInstanceId, nodeVisitId: WORKFLOW_ORIGIN.nodeVisitId, attemptId: WORKFLOW_ORIGIN.attemptId },
    workflowExecutionContext: WORKFLOW_ORIGIN,
    messageOrigin: WORKFLOW_ORIGIN,
  }, { turnExecutionId: 'turn:user' })

  assert.equal(gatewayCalls[0].call.args.workflowInstanceId, WORKFLOW_ORIGIN.workflowInstanceId, 'args pass through untouched (the capability schema rejects them later)')
  assert.equal(gatewayCalls[0].ctx.workflowExecutionContext, undefined, 'no live workflow origin on this turn -> undefined, never the forged object')
})
