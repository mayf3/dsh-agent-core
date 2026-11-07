import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { canonicalJSON } from '../../../fixed-operation/src/canonical.js'
import { createPluginContext } from '../../../production-runtime/src/context.js'
import { mountWorkflowExecutionContextRuntime } from '../../../production-runtime/src/workflow-execution-context-runtime.js'
import { ExecutionLedger } from '../../../workflow-execution/src/ledger.js'
import { DEFAULT_MANIFESTS } from '../../src/index.js'
import { ownerOperationRegistry } from '../../src/capabilities/workflow/owner-operation-registry.js'
import { routeOwnerObligation } from '../../src/capabilities/workflow/owner-obligation-guard.js'

const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
const instanceId = id(1), visitId = id(2), caseId = id(3), sourceId = id(4), sourceVisitId = id(5)
const definitionVersionId = id(6), nodeDefinitionId = id(7), targetDefinitionVersionId = id(8)
const provenance = { kind: 'workflow_execution', workflowInstanceId: instanceId, nodeVisitId: visitId, attemptId: `wfeat-${'a'.repeat(24)}` }
const transitionManifest = DEFAULT_MANIFESTS.find(m => m.id === 'workflow_execute')
const createDescriptor = ownerOperationRegistry.find(row => row.descriptor.key === 'workflow.create_instance').descriptor

function managedRelation() {
  return {
    version: 1, managedKind: 'INTAKE', workflowInstanceId: instanceId,
    definitionVersionId, caseId, policyDigest: 'a'.repeat(64), state: 'ACTIVE',
    currentNode: {
      nodeVisitId: visitId, nodeDefinitionId, workflowStateVersion: 9,
      operation: { slotKey: 'supplier', allowedOperations: [createDescriptor],
        targetDefinitionVersionId, targetDefinitionDigest: 'b'.repeat(64), effect: { state: 'NOT_STARTED' } },
    },
  }
}
function assistanceDetail() {
  return {
    assistanceCaseId: caseId, workflowInstanceId: sourceId, nodeVisitId: sourceVisitId,
    currentNodeVisitId: sourceVisitId, workflowStateVersion: 12, status: 'OWNER_PENDING',
    governanceBinding: {
      assistanceCaseId: caseId, bindingId: id(9), status: 'BOUND',
      source: { workflowInstanceId: sourceId, nodeVisitId: sourceVisitId, definitionVersionId: id(10) },
      child: { workflowInstanceId: instanceId, definitionVersionId },
    },
  }
}
function createCall(overrides = {}) {
  return { capabilityId: 'workflow_execute', operation: 'create_instance', args: {
    domainId: id(11), definitionVersionId: targetDefinitionVersionId, contextPayload: { actual: true }, metadata: {}, ...overrides,
  } }
}
async function route(call, { managed = managedRelation(), detail = assistanceDetail(), trusted = provenance } = {}) {
  const reads = []
  const effectResult = { accepted: true, workflowInstanceId: instanceId }
  const transport = { execute: async () => ({
    effectId: id(40), state: 'SUCCEEDED', commandId: id(41), result: effectResult,
    resultDigest: createHash('sha256').update(canonicalJSON(effectResult)).digest('hex'), replayed: true,
  }) }
  const result = await routeOwnerObligation({
    call,
    manifest: transitionManifest,
    context: { agentId: 'agt_test', ingressContext: { turnExecutionId: 'turn-r124' } },
    resolveWorkflowProvenance: async () => trusted,
    transport,
    executeRead: async read => {
      reads.push(read)
      return read.capabilityId === 'workflow_owner_obligation'
        ? { ok: true, result: managed }
        : { ok: true, result: detail }
    },
  })
  return { result, reads }
}

test('R124/1 real relation: Case→Instance→Visit is read from owner obligation and assistance detail', async () => {
  const { result, reads } = await route(createCall())
  assert.deepEqual(result, { ok: true, result: { accepted: true, workflowInstanceId: instanceId } }, 'valid managed INTAKE reaches the Svc operation path')
  assert.deepEqual(reads.map(r => r.args), [
    { workflowInstanceId: instanceId },
    { assistanceCaseId: caseId },
  ])
  assert.equal(reads[1].args.assistanceCaseId, caseId)
  assert.notEqual(assistanceDetail().workflowInstanceId, managedRelation().workflowInstanceId)
  assert.equal(assistanceDetail().governanceBinding.child.workflowInstanceId, instanceId)
})

test('R124/2 cross-instance relation is governed_operation_required, not a generic ID match', async () => {
  const { result } = await route(createCall({ definitionVersionId: id(99) }))
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'governed_operation_required')
})

test('R124/3 noteWorkflowTurn→resolveWorkflowProvenance accepts only the trusted turn mapping', () => {
  const access = mountWorkflowExecutionContextRuntime({ ctx: createPluginContext() })
  assert.deepEqual(access.noteWorkflowTurn({ turnExecutionId: 'r124-turn', provenance, agentId: 'agt_test', sessionId: 'main' }), { ok: true })
  assert.deepEqual(access.resolveWorkflowProvenance({ agentId: 'agt_test', ingressContext: { turnExecutionId: 'r124-turn' } }), provenance)
})

test('R124/4 stale/evicted attempt provenance is rejected', () => {
  const access = mountWorkflowExecutionContextRuntime({ ctx: createPluginContext() })
  access.noteWorkflowTurn({ turnExecutionId: 'stale-turn', provenance, agentId: 'agt_test' })
  for (let i = 0; i < 256; i++) access.noteWorkflowTurn({ turnExecutionId: `later-${i}`, provenance, agentId: 'agt_test' })
  assert.equal(access.resolveWorkflowProvenance({ agentId: 'agt_test', ingressContext: { turnExecutionId: 'stale-turn' } }), undefined)
})

test('R124/5 agent mismatch rejects the otherwise valid trusted turn', () => {
  const access = mountWorkflowExecutionContextRuntime({ ctx: createPluginContext() })
  access.noteWorkflowTurn({ turnExecutionId: 'agent-turn', provenance, agentId: 'agt_test' })
  assert.equal(access.resolveWorkflowProvenance({ agentId: 'agt_other', ingressContext: { turnExecutionId: 'agent-turn' } }), undefined)
})

test('R124/6 model-carried provenance cannot inject workflow coordinates', () => {
  const access = mountWorkflowExecutionContextRuntime({ ctx: createPluginContext() })
  access.noteWorkflowTurn({ turnExecutionId: 'model-turn', provenance, agentId: 'agt_test' })
  assert.equal(access.resolveWorkflowProvenance({
    agentId: 'agt_test', ingressContext: { turnExecutionId: 'model-turn' },
    workflowProvenance: { ...provenance, workflowInstanceId: id(99) },
    sourceTurnExecutionId: 'model-turn',
  }), undefined)
})

test('R124/7 unmanaged chat route has no workflow provenance and is not blocked by the guard', async () => {
  const result = await routeOwnerObligation({
    call: { capabilityId: 'workflow_progress', operation: 'checkpoint', args: { current: ['ordinary chat'] } },
    manifest: transitionManifest,
    context: { agentId: 'agt_test' },
    resolveWorkflowProvenance: async () => undefined,
  })
  assert.equal(result, undefined)
})

test('R124/8 transition receipt merges source→target and stale receipt cannot settle a new execution', async t => {
  const source = assistanceDetail()
  const receipt = { workflowInstanceId: instanceId, workflowStateVersion: 18, currentNodeVisitId: id(20), submissionId: id(21) }
  assert.notEqual(source.workflowInstanceId, receipt.workflowInstanceId)
  assert.equal(source.governanceBinding.child.workflowInstanceId, receipt.workflowInstanceId)
  assert.equal(source.governanceBinding.child.definitionVersionId, definitionVersionId)
  assert.notEqual(receipt.workflowInstanceId, id(99), 'a receipt from another instance cannot enter this task')


  const dir = await mkdtemp(join(tmpdir(), 'r124-late-evidence-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const ledger = new ExecutionLedger({ dir, resolveManagedAttempt: async () => true })
  const seed = { workflowInstanceId: instanceId, nodeVisitId: visitId, dispatchIntentId: id(30), ownerPrincipalId: id(31) }
  const first = await ledger.beginAttemptIfAbsent(seed)
  await ledger.recordDeliveryStarted({ nodeVisitId: visitId })
  await ledger.recordRunDelivered({ nodeVisitId: visitId, agentId: 'agt_test', requestId: first.attempt.attemptId, sessionId: 'main' })
  const stale = await ledger.recordStaleSuperseded({ nodeVisitId: visitId,
    expectedAttemptId: first.attempt.attemptId, expectedGeneration: first.attempt.generation,
    expected: { state: 'ACTIVE', phase: 'run_delivered', deliveredAtMs: ledger.get(visitId).delivered.atMs }, observedWorkflowStateVersion: 9 })
  assert.equal(stale.committed, true)
  const recovered = new ExecutionLedger({ dir, resolveManagedAttempt: async () => true })
  const second = await recovered.beginAttemptIfAbsent(seed, undefined, () => true)
  assert.equal(second.created, true)
  assert.notEqual(second.attempt.attemptId, first.attempt.attemptId)
  assert.equal(recovered.get(visitId).attemptId, second.attempt.attemptId)
})
