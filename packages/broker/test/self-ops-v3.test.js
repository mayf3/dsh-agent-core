import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_MANIFESTS, apply as applyBroker } from '../src/index.js'
import { schedulerManifest } from '../src/capabilities/scheduler.js'
import { agentSessionReconcileManifest } from '../src/capabilities/agent-session-reconcile.js'
import { selfOpsManifest } from '../src/capabilities/self-ops.js'
import { createBrokerGateway } from '../src/gateway.js'
import { buildToolDefinition } from '../src/registry.js'
import { validateManifest } from '../src/schema.js'

const AGENT = 'agt_self'

function gateway(handlers) {
  return createBrokerGateway({
    manifests: [selfOpsManifest],
    targets: [],
    credentialsFile: undefined,
    localHandlers: { self_ops: handlers },
  })
}

test('Tools V4 registers exactly one model-visible self_ops manifest with three actions', () => {
  assert.equal(DEFAULT_MANIFESTS.filter((manifest) => manifest.id === 'self_ops').length, 1)
  const canonical = validateManifest(selfOpsManifest)
  assert.equal(canonical.ok, true)
  assert.equal(canonical.manifest.infrastructure, undefined) // Tools V4: infrastructure=true superseded for self_ops (model-visible)
  assert.equal(canonical.manifest.selector, 'action')
  assert.deepEqual(canonical.manifest.operations.map((operation) => operation.name), ['status', 'reconcile_turn', 'job_disposition'])
  const { definition } = buildToolDefinition({ manifest: selfOpsManifest, handlers: {} })
  assert.deepEqual(Object.keys(definition.parameters).sort(), ['action', 'job_id', 'occurrence_id', 'run_id'])
  for (const forbidden of ['principal_id', 'agent_id', 'target_agent_id', 'request_id', 'router_handle', 'force']) {
    assert.equal(Object.hasOwn(definition.parameters, forbidden), false)
  }
})

test('self_ops uses trusted caller with zero credential/Auth dependency', async () => {
  const calls = []
  const broker = gateway({
    status: (args, context) => {
      calls.push({ args, context })
      return { ok: true, result: { callerAgentId: context.callerAgentId } }
    },
    reconcile_turn: () => ({ ok: true, result: { disposition: 'ok' } }),
  })
  const result = await broker.execute({ capabilityId: 'self_ops', operation: 'status', args: {} }, { agentId: AGENT })
  assert.deepEqual(result, { ok: true, result: { callerAgentId: AGENT } })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].args, {})
  assert.equal(calls[0].context.callerAgentId, AGENT)
})

test('closed arguments and missing trusted provider fail before any handler', async () => {
  let hits = 0
  const broker = gateway({
    status: () => { hits += 1; return { ok: true, result: {} } },
    reconcile_turn: () => { hits += 1; return { ok: true, result: {} } },
  })
  const forged = await broker.execute({
    capabilityId: 'self_ops', operation: 'status', args: { agent_id: 'agt_forged' },
  }, { agentId: AGENT })
  assert.equal(forged.error.code, 'invalid_arguments')
  const partial = await broker.execute({
    capabilityId: 'self_ops', operation: 'reconcile_turn', args: { job_id: 'j' },
  }, { agentId: AGENT })
  assert.equal(partial.error.code, 'invalid_arguments')
  assert.equal(hits, 0)

  const missing = createBrokerGateway({ manifests: [selfOpsManifest], targets: [], localHandlers: {} })
  const unavailable = await missing.execute({ capabilityId: 'self_ops', operation: 'status', args: {} }, { agentId: AGENT })
  assert.equal(unavailable.error.code, 'capability_unavailable')
})

test('availability reports self_ops provider readiness without credentials', async () => {
  const broker = createBrokerGateway({
    manifests: [selfOpsManifest],
    targets: [],
    localHandlers: { self_ops: { status() {}, reconcile_turn() {}, job_disposition() {} } },
  })
  const answer = await broker.execute({ capabilityId: 'broker', operation: 'availability', args: {} }, { agentId: AGENT })
  assert.deepEqual(answer.result.capabilities.self_ops, {
    ready: true,
    operations: { status: true, reconcile_turn: true, job_disposition: true },
  })
})

// ─── Tools V4: the REAL model tool list (production registration path) ──────
// AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4 acceptance regression:
//   MODEL_TOOL_LIST_CONTAINS_SELF_OPS=YES (actions exactly three)
//   MODEL_TOOL_LIST_CONTAINS_AGENT_SESSION_RECONCILE=NO (stays infrastructure/hidden)
//   MODEL_TOOL_LIST_CONTAINS_SCHEDULER=YES (unchanged)

function fakeCtx() {
  const names = []
  const ctx = {}
  ctx.tools = { register: (definition) => names.push(definition) }
  ctx.get = () => undefined
  ctx.provide = () => undefined
  return { ctx, names }
}

test('model tool list contains self_ops with exactly three actions, keeps scheduler, excludes agent_session_send_reconcile', () => {
  const { ctx, names } = fakeCtx()
  applyBroker(ctx, {
    mode: 'child',
    manifests: [selfOpsManifest, schedulerManifest, agentSessionReconcileManifest],
  })
  const toolNames = names.map((definition) => definition.name)
  assert.ok(toolNames.includes('self_ops'), `self_ops missing from model tool list: ${toolNames.join(',')}`)
  assert.ok(toolNames.includes('scheduler'), 'scheduler must remain model-visible')
  assert.ok(!toolNames.includes('agent_session_send_reconcile'), 'agent_session_send_reconcile must stay infrastructure-hidden')
  const selfOpsTool = names.find((definition) => definition.name === 'self_ops')
  assert.match(selfOpsTool.description, /\bstatus\b/)
  assert.match(selfOpsTool.description, /\breconcile_turn\b/)
  assert.match(selfOpsTool.description, /\bjob_disposition\b/)
})
