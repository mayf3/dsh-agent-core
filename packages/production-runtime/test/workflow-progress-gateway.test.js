import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createPluginContext } from '../src/context.js'
import { mountBrokerGateway } from '../src/broker-composition.js'
import { mountWorkflowExecutionContextRuntime } from '../src/workflow-execution-context-runtime.js'
import { mountWorkflowProgressRuntime } from '../src/workflow-progress-runtime.js'
import { ExecutionLedger, attemptIdFor } from '../../workflow-execution/src/ledger.js'

const INSTANCE = '11111111-1111-4111-8111-111111111111'
const VISIT = '22222222-2222-4222-8222-222222222222'
const INTENT = '33333333-3333-4333-8333-333333333333'
const OWNER = '44444444-4444-4444-8444-444444444444'

async function gatewayHarness() {
  const dir = mkdtempSync(join(tmpdir(), 'workflow-progress-gateway-'))
  const credentialsFile = join(dir, 'credentials.json')
  writeFileSync(credentialsFile, JSON.stringify({
    version: 1,
    credentials: {
      agt_progress: { clientId: 'client-progress', clientSecret: 'secret-progress' },
    },
  }))

  const ledger = new ExecutionLedger({ dir: join(dir, 'ledger') })
  await ledger.beginAttemptIfAbsent({
    dispatchIntentId: INTENT,
    nodeVisitId: VISIT,
    workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER,
  })
  await ledger.recordDeliveryStarted({ nodeVisitId: VISIT })
  await ledger.recordRunDelivered({
    nodeVisitId: VISIT,
    agentId: 'agt_progress',
    requestId: 'req-gateway',
    sessionId: 'main',
  })
  const ctx = createPluginContext()

  // Same late-binding order as production: Broker first, LOCAL providers later.
  mountBrokerGateway({
    ctx,
    credentialsFile,
    authServiceOrigin: 'http://127.0.0.1:9',
  })
  const workflowContext = mountWorkflowExecutionContextRuntime({ ctx })
  mountWorkflowProgressRuntime({ ctx, ledger, log: { log() {} } })

  return {
    dir,
    ctx,
    ledger,
    workflowContext,
    gateway: ctx.get('brokerGateway'),
    cleanup() { rmSync(dir, { recursive: true, force: true }) },
  }
}

function provenance() {
  return {
    kind: 'workflow_execution',
    workflowInstanceId: INSTANCE,
    nodeVisitId: VISIT,
    attemptId: attemptIdFor(VISIT),
  }
}
test('real gateway resolves late-mounted workflowProgressAccess and records checkpoint', async () => {
  const fx = await gatewayHarness()
  try {
    assert.deepEqual(fx.workflowContext.noteWorkflowTurn({
      turnExecutionId: 'turn-gateway-1',
      provenance: provenance(),
      agentId: 'agt_progress',
      sessionId: 'main',
    }), { ok: true })

    const outcome = await fx.gateway.execute(
      {
        capabilityId: 'workflow_progress',
        operation: 'checkpoint',
        args: { current: ['gateway write'], next: ['continue'] },
      },
      {
        agentId: 'agt_progress',
        ingressContext: { turnExecutionId: 'turn-gateway-1' },
      },
    )

    assert.equal(outcome.ok, true)
    assert.equal(outcome.result.recorded, true)
    assert.deepEqual(fx.ledger.get(VISIT).latestProgressCheckpoint.checkpoint.current, ['gateway write'])
  } finally {
    fx.cleanup()
  }
})
test('real gateway rejects untrusted turn and model-carried coordinates', async () => {
  const fx = await gatewayHarness()
  try {
    fx.workflowContext.noteWorkflowTurn({
      turnExecutionId: 'turn-gateway-2',
      provenance: provenance(),
      agentId: 'agt_progress',
      sessionId: 'main',
    })

    const ordinary = await fx.gateway.execute(
      {
        capabilityId: 'workflow_progress',
        operation: 'checkpoint',
        args: { current: ['ordinary'] },
      },
      { agentId: 'agt_progress', ingressContext: { turnExecutionId: 'ordinary-turn' } },
    )
    assert.equal(ordinary.ok, false)
    assert.equal(ordinary.error.code, 'missing_workflow_context')

    const forged = await fx.gateway.execute(
      {
        capabilityId: 'workflow_progress',
        operation: 'checkpoint',
        args: {
          current: ['forged'],
          workflowInstanceId: INSTANCE,
          nodeVisitId: VISIT,
          attemptId: attemptIdFor(VISIT),
        },
      },
      { agentId: 'agt_progress', ingressContext: { turnExecutionId: 'turn-gateway-2' } },
    )
    assert.equal(forged.ok, false)
    assert.equal(forged.error.code, 'invalid_arguments')
  } finally {
    fx.cleanup()
  }
})
test('workflow_progress tool shape exposes no identity/provenance arguments', async () => {
  const broker = await import('../../broker/src/registry.js')
  const capability = await import('../../broker/src/capabilities/workflow-progress.js')
  const { definition } = broker.buildToolDefinition({ manifest: capability.workflowProgressManifest, handlers: {} })

  assert.deepEqual(definition.parameters.operation.enum, ['checkpoint', 'read_current'])
  for (const forbidden of [
    'workflowInstanceId', 'nodeVisitId', 'attemptId', 'agentId', 'sessionId',
    'turnExecutionId', 'messageOrigin', 'scriptPath', 'shell', 'code', 'command',
  ]) {
    assert.equal(Object.hasOwn(definition.parameters, forbidden), false, forbidden)
  }
})
