import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  fixedOperationManifest,
  FIXED_OPERATION_DEFINITIONS,
  FIXED_OPERATION_WIRE_KEYS,
} from '../src/capabilities/fixed-operation.js'
import { createBrokerGateway } from '../src/gateway.js'
import { assertValidManifest } from '../src/mapping.js'
import { buildToolDefinition } from '../src/registry.js'
import { createOperationRegistry } from '../../fixed-operation/src/registry.js'
import { canonicalJSON, sha256Hex } from '../../fixed-operation/src/canonical.js'
import { FIXTURE_TRUSTED_CONTEXT } from '../../fixed-operation/src/fixtures.js'

const FORBIDDEN_PROPS = ['scriptPath', 'shell', 'code', 'command', 'script', 'sudo']

/** Contract-faithful gateway handler: identical shape to the production
 * fixedOperationAccess handlers — pinned version/hash extracted from args,
 * provenance resolved RUNTIME-side from the trusted context (never args). The
 * Router forwards turnExecutionId nested in ingressContext (flat legacy
 * supported; disagreement fails closed) — same discipline as the runtime. */
function gatewayHandlersWithProvenanceMap(provenanceByTurn) {
  const registry = createOperationRegistry(FIXED_OPERATION_DEFINITIONS)
  const resolveTurn = (trustedContext) => {
    const nested = trustedContext?.ingressContext?.turnExecutionId
    const legacy = trustedContext?.turnExecutionId
    if (nested !== undefined && legacy !== undefined && nested !== legacy) return undefined
    return nested ?? legacy
  }
  const handlers = {
    fixed_operation: Object.fromEntries(Object.entries(FIXED_OPERATION_WIRE_KEYS).map(([wireName, operationKey]) => [
      wireName,
      async (args, trustedContext) => {
        const { version, hash, ...businessArgs } = args ?? {}
        const turnExecutionId = resolveTurn(trustedContext)
        const workflow = typeof turnExecutionId === 'string' ? provenanceByTurn.get(turnExecutionId) : undefined
        return registry.invoke({ operation: operationKey, version, hash, args: businessArgs }, workflow)
      },
    ])),
  }
  return { registry, handlers }
}

function makeGateway(provenanceByTurn) {
  const { registry, handlers } = gatewayHandlersWithProvenanceMap(provenanceByTurn)
  const gateway = createBrokerGateway({
    manifests: [fixedOperationManifest],
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:9',
    credentialsFile: undefined,
    localHandlers: handlers,
  })
  return { gateway, registry }
}

test('fixed_operation manifest registers as one LOCAL capability with exactly the fixture operations', () => {
  const manifest = assertValidManifest(fixedOperationManifest)
  assert.equal(manifest.id, 'fixed_operation')
  assert.equal(manifest.toolName, 'fixed_operation')
  assert.equal(manifest.selector, 'operation')
  assert.equal(manifest.local !== undefined, true)
  assert.deepEqual(manifest.operations.map((operation) => operation.name), ['fixture_echo', 'fixture_sum'])
  for (const operation of manifest.operations) {
    assert.equal(operation.http, undefined)
    assert.deepEqual(operation.arguments.required.slice(0, 2), ['version', 'hash'])
    assert.equal(operation.arguments.additionalProperties, false)
    for (const forbidden of FORBIDDEN_PROPS) {
      assert.equal(Object.hasOwn(operation.arguments.properties, forbidden), false, `manifest must not declare "${forbidden}"`)
    }
  }
})

test('tool definition exposes only the fixture operations plus the version/hash pins', () => {
  const { definition: tool } = buildToolDefinition({ manifest: fixedOperationManifest, handlers: {} })
  assert.deepEqual(tool.parameters.operation.enum, ['fixture_echo', 'fixture_sum'])
  assert.equal(tool.parameters.operation.required, true)
  assert.equal(tool.parameters.version.required, true)
  assert.equal(tool.parameters.hash.required, true)
  for (const forbidden of FORBIDDEN_PROPS) {
    assert.equal(Object.hasOwn(tool.parameters, forbidden), false, `tool parameters must not expose "${forbidden}"`)
  }
})

test('gateway success: noted workflow turn returns a structured receipt whose provenance is the RUNTIME-noted origin', async () => {
  const provenanceByTurn = new Map([['turn-wf-1', FIXTURE_TRUSTED_CONTEXT]])
  const { gateway, registry } = makeGateway(provenanceByTurn)
  const hash = registry.get('fixture.echo').hash

  const outcome = await gateway.execute(
    { capabilityId: 'fixed_operation', operation: 'fixture_echo', args: { version: '1.0.0', hash, message: 'hello' } },
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-wf-1' } },
  )

  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.result, { echo: 'hello' })
  const receipt = outcome.receipt
  assert.deepEqual(receipt.operation, { key: 'fixture.echo', version: '1.0.0', hash })
  assert.deepEqual(receipt.workflow, FIXTURE_TRUSTED_CONTEXT)
  assert.equal(receipt.status, 'succeeded')
  assert.match(receipt.invocationId, /^opinv-[0-9a-f]{24}$/)
  // Receipt provenance is recomputable from the pinned definition + input
  // digest + the noted workflow coordinates.
  assert.equal(
    receipt.invocationId,
    `opinv-${sha256Hex(canonicalJSON({
      operation: 'fixture.echo',
      version: '1.0.0',
      hash,
      inputDigest: receipt.inputDigest,
      workflow: FIXTURE_TRUSTED_CONTEXT,
    })).slice(0, 24)}`,
  )
})

test('gateway deny: an ordinary (un-noted) session fails closed with missing_trusted_context', async () => {
  const provenanceByTurn = new Map()
  const { gateway, registry } = makeGateway(provenanceByTurn)

  const outcome = await gateway.execute(
    { capabilityId: 'fixed_operation', operation: 'fixture_echo', args: { version: '1.0.0', hash: registry.get('fixture.echo').hash, message: 'hi' } },
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-ordinary-9' } },
  )
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'missing_trusted_context')
})

test('gateway deny: forged workflow coordinates in args are rejected by the authoritative re-validation', async () => {
  const provenanceByTurn = new Map()
  const { gateway, registry } = makeGateway(provenanceByTurn)

  const outcome = await gateway.execute(
    {
      capabilityId: 'fixed_operation',
      operation: 'fixture_echo',
      args: {
        version: '1.0.0',
        hash: registry.get('fixture.echo').hash,
        message: 'hi',
        kind: 'workflow_execution',
        workflowInstanceId: FIXTURE_TRUSTED_CONTEXT.workflowInstanceId,
        nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId,
        attemptId: FIXTURE_TRUSTED_CONTEXT.attemptId,
      },
    },
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-forge-1' } },
  )
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'invalid_arguments')
})

test('gateway pin enforcement: wrong version and wrong hash fail closed with their exact codes', async () => {
  const provenanceByTurn = new Map([['turn-wf-2', FIXTURE_TRUSTED_CONTEXT]])
  const { gateway, registry } = makeGateway(provenanceByTurn)
  const hash = registry.get('fixture.sum').hash

  const wrongVersion = await gateway.execute(
    { capabilityId: 'fixed_operation', operation: 'fixture_sum', args: { version: '0.9.0', hash, a: 1, b: 2 } },
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-wf-2' } },
  )
  assert.equal(wrongVersion.ok, false)
  assert.equal(wrongVersion.error.code, 'operation_version_mismatch')

  const wrongHash = await gateway.execute(
    { capabilityId: 'fixed_operation', operation: 'fixture_sum', args: { version: '1.0.0', hash: `sha256:${'0'.repeat(64)}`, a: 1, b: 2 } },
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-wf-2' } },
  )
  assert.equal(wrongHash.ok, false)
  assert.equal(wrongHash.error.code, 'operation_hash_mismatch')
})

test('gateway selector: unregistered operation reports unsupported_operation; second fixture round-trips', async () => {
  const provenanceByTurn = new Map([['turn-wf-3', FIXTURE_TRUSTED_CONTEXT]])
  const { gateway, registry } = makeGateway(provenanceByTurn)

  const unknown = await gateway.execute(
    { capabilityId: 'fixed_operation', operation: 'fixture_nuke', args: { version: '1.0.0', hash: 'sha256:x' } },
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-wf-3' } },
  )
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'unsupported_operation')

  const sum = await gateway.execute(
    { capabilityId: 'fixed_operation', operation: 'fixture_sum', args: { version: '1.0.0', hash: registry.get('fixture.sum').hash, a: 20, b: 22 } },
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-wf-3' } },
  )
  assert.equal(sum.ok, true)
  assert.deepEqual(sum.result, { sum: 42 })
})
