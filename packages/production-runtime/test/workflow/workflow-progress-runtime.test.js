import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createPluginContext } from '../../src/context.js'
import { mountWorkflowExecutionContextRuntime } from '../../src/workflow-execution-context-runtime.js'
import { mountWorkflowProgressRuntime } from '../../src/workflow-progress-runtime.js'
import { ExecutionLedger, attemptIdFor } from '../../../workflow-execution/src/ledger.js'

const INSTANCE = '11111111-1111-4111-8111-111111111111'
const VISIT = '22222222-2222-4222-8222-222222222222'
const INTENT = '33333333-3333-4333-8333-333333333333'
const OWNER = '44444444-4444-4444-8444-444444444444'

async function harness() {
  const dir = mkdtempSync(join(tmpdir(), 'workflow-progress-runtime-'))
  let now = 100
  const ledger = new ExecutionLedger({ dir, clock: () => now })
  await ledger.beginAttemptIfAbsent({
    dispatchIntentId: INTENT,
    nodeVisitId: VISIT,
    workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER,
  })
  now = 110
  await ledger.recordDeliveryStarted({ nodeVisitId: VISIT })
  now = 120
  await ledger.recordRunDelivered({
    nodeVisitId: VISIT,
    agentId: 'agt_progress',
    requestId: 'req-1',
    sessionId: 'main',
  })

  const ctx = createPluginContext()
  const workflowContext = mountWorkflowExecutionContextRuntime({ ctx })
  const progress = mountWorkflowProgressRuntime({ ctx, ledger, log: { log() {} } })
  return {
    dir, ledger, ctx, workflowContext, progress,
    setNow(value) { now = value },
    cleanup() { rmSync(dir, { recursive: true, force: true }) },
  }
}
test('trusted Workflow turn records and reads the current checkpoint', async () => {
  const fx = await harness()
  try {
    assert.deepEqual(fx.workflowContext.noteWorkflowTurn({
      turnExecutionId: 'turn-progress-1',
      provenance: {
        kind: 'workflow_execution',
        workflowInstanceId: INSTANCE,
        nodeVisitId: VISIT,
        attemptId: attemptIdFor(VISIT),
      },
      agentId: 'agt_progress',
      sessionId: 'main',
    }), { ok: true })

    const trustedContext = {
      agentId: 'agt_progress',
      ingressContext: { turnExecutionId: 'turn-progress-1' },
    }
    const write = await fx.progress.handlers.workflow_progress.checkpoint({
      accomplished: ['source loaded'],
      current: ['implementing'],
      next: ['run tests'],
      artifacts: ['file:result.json'],
    }, trustedContext)

    assert.equal(write.ok, true)
    assert.equal(write.result.recorded, true)
    assert.equal(write.result.attemptId, attemptIdFor(VISIT))
    assert.deepEqual(write.result.checkpoint.checkpoint.next, ['run tests'])

    const read = await fx.progress.handlers.workflow_progress.read_current({}, trustedContext)
    assert.equal(read.ok, true)
    assert.deepEqual(read.result.checkpoint.checkpoint.current, ['implementing'])
    assert.equal(fx.ledger.get(VISIT).state, 'ACTIVE')
    assert.equal(fx.ledger.get(VISIT).phase, 'run_delivered')
  } finally {
    fx.cleanup()
  }
})
test('ordinary, wrong-agent and conflicting-turn contexts fail closed', async () => {
  const fx = await harness()
  try {
    fx.workflowContext.noteWorkflowTurn({
      turnExecutionId: 'turn-progress-2',
      provenance: {
        kind: 'workflow_execution',
        workflowInstanceId: INSTANCE,
        nodeVisitId: VISIT,
        attemptId: attemptIdFor(VISIT),
      },
      agentId: 'agt_progress',
      sessionId: 'main',
    })

    const ordinary = await fx.progress.handlers.workflow_progress.checkpoint(
      { current: ['x'] },
      { agentId: 'agt_progress', ingressContext: { turnExecutionId: 'ordinary' } },
    )
    assert.equal(ordinary.ok, false)
    assert.equal(ordinary.error.code, 'missing_workflow_context')

    const wrongAgent = await fx.progress.handlers.workflow_progress.checkpoint(
      { current: ['x'] },
      { agentId: 'agt_other', ingressContext: { turnExecutionId: 'turn-progress-2' } },
    )
    assert.equal(wrongAgent.error.code, 'missing_workflow_context')

    const conflict = await fx.progress.handlers.workflow_progress.checkpoint(
      { current: ['x'] },
      {
        agentId: 'agt_progress',
        turnExecutionId: 'turn-progress-2',
        ingressContext: { turnExecutionId: 'turn-other' },
      },
    )
    assert.equal(conflict.error.code, 'missing_workflow_context')
  } finally {
    fx.cleanup()
  }
})
test('model-carried workflow coordinates and transcript-sized payloads are rejected', async () => {
  const fx = await harness()
  try {
    fx.workflowContext.noteWorkflowTurn({
      turnExecutionId: 'turn-progress-3',
      provenance: {
        kind: 'workflow_execution',
        workflowInstanceId: INSTANCE,
        nodeVisitId: VISIT,
        attemptId: attemptIdFor(VISIT),
      },
      agentId: 'agt_progress',
      sessionId: 'main',
    })
    const trusted = { agentId: 'agt_progress', ingressContext: { turnExecutionId: 'turn-progress-3' } }

    const forged = await fx.progress.handlers.workflow_progress.checkpoint({
      current: ['x'],
      workflowInstanceId: INSTANCE,
      nodeVisitId: VISIT,
      attemptId: attemptIdFor(VISIT),
    }, trusted)
    assert.equal(forged.ok, false)
    assert.equal(forged.error.code, 'invalid_arguments')

    const huge = await fx.progress.handlers.workflow_progress.checkpoint({
      current: ['x'.repeat(241)],
    }, trusted)
    assert.equal(huge.error.code, 'invalid_arguments')
  } finally {
    fx.cleanup()
  }
})
test('terminal attempts cannot accept another checkpoint', async () => {
  const fx = await harness()
  try {
    fx.workflowContext.noteWorkflowTurn({
      turnExecutionId: 'turn-progress-4',
      provenance: {
        kind: 'workflow_execution',
        workflowInstanceId: INSTANCE,
        nodeVisitId: VISIT,
        attemptId: attemptIdFor(VISIT),
      },
      agentId: 'agt_progress',
      sessionId: 'main',
    })
    await fx.ledger.recordReconciled({
      nodeVisitId: VISIT,
      expectedPhase: 'run_delivered',
      verdict: 'SETTLED',
      judgment: 'business_commitment_observed',
      reason: 'visit moved',
    })

    const out = await fx.progress.handlers.workflow_progress.checkpoint(
      { next: ['late'] },
      { agentId: 'agt_progress', ingressContext: { turnExecutionId: 'turn-progress-4' } },
    )
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'stale_attempt')
    assert.match(out.error.detail, /terminal/)
  } finally {
    fx.cleanup()
  }
})
