import test from 'node:test'
import assert from 'node:assert/strict'

import { FIXTURE_TRUSTED_CONTEXT } from '../../fixed-operation/src/fixtures.js'
import { mountBrokerGateway } from '../src/broker-composition.js'
import { createPluginContext } from '../src/context.js'
import { mountFixedOperationRuntime } from '../src/fixed-operation-runtime.js'

function createHarness() {
  const ctx = createPluginContext()

  // Match production order: the Broker mounts before sibling LOCAL providers.
  // Correctness therefore depends on the execute-time handler resolver.
  mountBrokerGateway({
    ctx,
    credentialsFile: undefined,
    authServiceOrigin: 'http://127.0.0.1:9',
  })

  const runtime = mountFixedOperationRuntime({ ctx, log: { log() {} } })
  return { ctx, runtime, gateway: ctx.get('brokerGateway') }
}
test('production composition resolves fixedOperationAccess after broker mount', async () => {
  const { ctx, runtime, gateway } = createHarness()
  const access = ctx.get('fixedOperationAccess')

  assert.ok(access?.handlers?.fixed_operation?.fixture_echo)
  assert.equal(access.registry, runtime.registry)

  assert.deepEqual(access.noteWorkflowTurn({
    turnExecutionId: 'turn-wf-runtime-1',
    provenance: FIXTURE_TRUSTED_CONTEXT,
  }), { ok: true })

  const hash = access.registry.get('fixture.echo').hash
  const outcome = await gateway.execute(
    {
      capabilityId: 'fixed_operation',
      operation: 'fixture_echo',
      args: { version: '1.0.0', hash, message: 'hello-runtime' },
    },
    {
      agentId: 'agt_a',
      ingressContext: { turnExecutionId: 'turn-wf-runtime-1' },
    },
  )

  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.result, { echo: 'hello-runtime' })
  assert.deepEqual(outcome.receipt.workflow, FIXTURE_TRUSTED_CONTEXT)
  assert.deepEqual(outcome.receipt.operation, {
    key: 'fixture.echo',
    version: '1.0.0',
    hash,
  })
  assert.equal(outcome.receipt.status, 'succeeded')
  assert.match(outcome.receipt.invocationId, /^opinv-[0-9a-f]{24}$/)
})

test('production composition denies an ordinary unnoted turn', async () => {
  const { runtime, gateway } = createHarness()
  const hash = runtime.registry.get('fixture.echo').hash

  const outcome = await gateway.execute(
    {
      capabilityId: 'fixed_operation',
      operation: 'fixture_echo',
      args: { version: '1.0.0', hash, message: 'ordinary' },
    },
    {
      agentId: 'agt_a',
      ingressContext: { turnExecutionId: 'turn-ordinary-1' },
    },
  )

  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'missing_trusted_context')
})
test('production composition rejects model-carried workflow coordinates', async () => {
  const { runtime, gateway } = createHarness()
  const hash = runtime.registry.get('fixture.echo').hash

  const outcome = await gateway.execute(
    {
      capabilityId: 'fixed_operation',
      operation: 'fixture_echo',
      args: {
        version: '1.0.0',
        hash,
        message: 'forged',
        kind: 'workflow_execution',
        workflowInstanceId: FIXTURE_TRUSTED_CONTEXT.workflowInstanceId,
        nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId,
        attemptId: FIXTURE_TRUSTED_CONTEXT.attemptId,
      },
    },
    {
      agentId: 'agt_a',
      ingressContext: { turnExecutionId: 'turn-forged-1' },
    },
  )

  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'invalid_arguments')
})
test('conflicting flat and nested turn ids fail closed', async () => {
  const { ctx, runtime, gateway } = createHarness()
  const access = ctx.get('fixedOperationAccess')

  access.noteWorkflowTurn({
    turnExecutionId: 'turn-wf-runtime-2',
    provenance: FIXTURE_TRUSTED_CONTEXT,
  })
  const hash = runtime.registry.get('fixture.echo').hash

  const outcome = await gateway.execute(
    {
      capabilityId: 'fixed_operation',
      operation: 'fixture_echo',
      args: { version: '1.0.0', hash, message: 'conflict' },
    },
    {
      agentId: 'agt_a',
      turnExecutionId: 'turn-wf-runtime-2',
      ingressContext: { turnExecutionId: 'turn-other' },
    },
  )

  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'missing_trusted_context')
})
