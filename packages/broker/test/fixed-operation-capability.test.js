import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fixedOperationManifest, FIXED_OPERATION_DEFINITIONS } from '../src/capabilities/fixed-operation.js'
import { createBrokerGateway } from '../src/gateway.js'
import { assertValidManifest } from '../src/mapping.js'
import { buildToolDefinition } from '../src/registry.js'
import { createOperationRegistry } from '../../fixed-operation/src/registry.js'
import { canonicalJSON, sha256Hex } from '../../fixed-operation/src/canonical.js'
import { FIXTURE_TRUSTED_CONTEXT } from '../../fixed-operation/src/fixtures.js'

const FORBIDDEN_PROPS = ['scriptPath', 'shell', 'code', 'command', 'script', 'sudo', 'env', 'path']

/** Contract-faithful gateway handler: identical shape to the production
 * fixedOperationAccess execute handler — pinned envelope extracted from the
 * closed { operation, version, hash, args } wire shape, provenance resolved
 * RUNTIME-side from the trusted context (never from args). */
function gatewayHandlersWithProvenanceMap(provenanceByTurn) {
  const registry = createOperationRegistry(FIXED_OPERATION_DEFINITIONS)
  const resolveTurn = (trustedContext) => {
    const nested = trustedContext?.ingressContext?.turnExecutionId
    const legacy = trustedContext?.turnExecutionId
    if (nested !== undefined && legacy !== undefined && nested !== legacy) return undefined
    return nested ?? legacy
  }
  const handlers = {
    fixed_operation: {
      execute: async (wireArgs, trustedContext) => {
        const { operation, version, hash, args } = wireArgs ?? {}
        const workflow = provenanceByTurn.get(resolveTurn(trustedContext))
        if (workflow === undefined || workflow.kind !== 'workflow_execution') {
          return { ok: false, error: { code: 'missing_trusted_context', detail: 'fixed_operation requires the trusted workflow_execution provenance injected by the runtime' } }
        }
        return registry.invoke({ operation, version, hash, args }, workflow)
      },
    },
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

const executeCall = ({ operation, version, hash, args }) => ({
  capabilityId: 'fixed_operation',
  operation: 'execute',
  args: { operation, version, hash, args },
})

test('fixed_operation manifest registers as one LOCAL capability exposing only operation/version/hash/args', () => {
  const manifest = assertValidManifest(fixedOperationManifest)
  assert.equal(manifest.id, 'fixed_operation')
  assert.equal(manifest.toolName, 'fixed_operation')
  assert.equal(manifest.local.resource, 'fixed-operation')
  assert.deepEqual(manifest.operations.map((operation) => operation.name), ['execute'])

  const envelope = manifest.operations[0].arguments
  assert.equal(envelope.additionalProperties, false)
  assert.deepEqual(envelope.required, ['operation', 'version', 'hash', 'args'])
  assert.deepEqual(Object.keys(envelope.properties), ['operation', 'version', 'hash', 'args'])
  for (const forbidden of FORBIDDEN_PROPS) {
    assert.equal(Object.hasOwn(envelope.properties, forbidden), false, `manifest must not declare "${forbidden}"`)
  }
  for (const declared of ['unknown_operation', 'operation_version_mismatch', 'operation_hash_mismatch', 'missing_trusted_context']) {
    assert.equal(manifest.errors.some((e) => e.code === declared), true, `error table must declare "${declared}"`)
  }
})

test('tool definition exposes exactly the execute selector and the four-key envelope', () => {
  const { definition: tool } = buildToolDefinition({ manifest: fixedOperationManifest, handlers: {} })
  assert.deepEqual(tool.parameters.operation.enum, ['execute'])
  assert.equal(tool.parameters.operation.required, true)
  for (const key of ['operation', 'version', 'hash', 'args']) {
    assert.equal(Object.hasOwn(tool.parameters, key), true, `tool parameters must expose "${key}"`)
  }
  for (const forbidden of FORBIDDEN_PROPS) {
    assert.equal(Object.hasOwn(tool.parameters, forbidden), false, `tool parameters must not expose "${forbidden}"`)
  }
})

test('gateway success: noted workflow turn returns a structured receipt whose provenance is the RUNTIME-noted origin', async () => {
  const provenanceByTurn = new Map([['turn-wf-1', FIXTURE_TRUSTED_CONTEXT]])
  const { gateway, registry } = makeGateway(provenanceByTurn)
  const hash = registry.get('fixture.echo').hash

  const outcome = await gateway.execute(
    executeCall({ operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hello' } }),
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
    executeCall({ operation: 'fixture.echo', version: '1.0.0', hash: registry.get('fixture.echo').hash, args: { message: 'hi' } }),
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-ordinary-9' } },
  )
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'missing_trusted_context')
})

test('gateway deny: forged workflow coordinates fail closed — top-level by the envelope, nested by the registry schema', async () => {
  const provenanceByTurn = new Map([['turn-noted', FIXTURE_TRUSTED_CONTEXT]])
  const { gateway, registry } = makeGateway(provenanceByTurn)
  const hash = registry.get('fixture.echo').hash
  const smuggled = {
    kind: 'workflow_execution',
    workflowInstanceId: FIXTURE_TRUSTED_CONTEXT.workflowInstanceId,
    nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId,
    attemptId: FIXTURE_TRUSTED_CONTEXT.attemptId,
  }

  // Top-level smuggling: the closed envelope rejects it before the handler.
  const topLevel = await gateway.execute(
    {
      capabilityId: 'fixed_operation',
      operation: 'execute',
      args: { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hi' }, ...smuggled },
    },
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-unnoted' } },
  )
  assert.equal(topLevel.ok, false)
  assert.equal(topLevel.error.code, 'invalid_arguments')

  // Nested smuggling on a NOTED turn: args never carry provenance; the
  // registry's closed operation schema rejects it.
  const nested = await gateway.execute(
    executeCall({ operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hi', ...smuggled } }),
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-noted' } },
  )
  assert.equal(nested.ok, false)
  assert.equal(nested.error.code, 'invalid_arguments')
})

test('gateway pin enforcement: wrong version and wrong hash fail closed with their exact codes', async () => {
  const provenanceByTurn = new Map([['turn-wf-2', FIXTURE_TRUSTED_CONTEXT]])
  const { gateway, registry } = makeGateway(provenanceByTurn)
  const hash = registry.get('fixture.sum').hash

  const wrongVersion = await gateway.execute(
    executeCall({ operation: 'fixture.sum', version: '0.9.0', hash, args: { a: 1, b: 2 } }),
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-wf-2' } },
  )
  assert.equal(wrongVersion.ok, false)
  assert.equal(wrongVersion.error.code, 'operation_version_mismatch')

  const wrongHash = await gateway.execute(
    executeCall({ operation: 'fixture.sum', version: '1.0.0', hash: `sha256:${'0'.repeat(64)}`, args: { a: 1, b: 2 } }),
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-wf-2' } },
  )
  assert.equal(wrongHash.ok, false)
  assert.equal(wrongHash.error.code, 'operation_hash_mismatch')
})

test('gateway: unregistered operation key fails closed as unknown_operation; fixture.sum round-trips', async () => {
  const provenanceByTurn = new Map([['turn-wf-3', FIXTURE_TRUSTED_CONTEXT]])
  const { gateway, registry } = makeGateway(provenanceByTurn)

  const unknown = await gateway.execute(
    executeCall({ operation: 'fixture.nuke', version: '1.0.0', hash: registry.get('fixture.echo').hash, args: {} }),
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-wf-3' } },
  )
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'unknown_operation')

  const sum = await gateway.execute(
    executeCall({ operation: 'fixture.sum', version: '1.0.0', hash: registry.get('fixture.sum').hash, args: { a: 20, b: 22 } }),
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-wf-3' } },
  )
  assert.equal(sum.ok, true)
  assert.deepEqual(sum.result, { sum: 42 })
})
