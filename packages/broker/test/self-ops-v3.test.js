import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_MANIFESTS } from '../src/index.js'
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

test('Tools V3 registers exactly one infrastructure self_ops manifest with two actions', () => {
  assert.equal(DEFAULT_MANIFESTS.filter((manifest) => manifest.id === 'self_ops').length, 1)
  const canonical = validateManifest(selfOpsManifest)
  assert.equal(canonical.ok, true)
  assert.equal(canonical.manifest.infrastructure, true)
  assert.equal(canonical.manifest.selector, 'action')
  assert.deepEqual(canonical.manifest.operations.map((operation) => operation.name), ['status', 'reconcile_turn'])
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
    localHandlers: { self_ops: { status() {}, reconcile_turn() {} } },
  })
  const answer = await broker.execute({ capabilityId: 'broker', operation: 'availability', args: {} }, { agentId: AGENT })
  assert.deepEqual(answer.result.capabilities.self_ops, {
    ready: true,
    operations: { status: true, reconcile_turn: true },
  })
})
