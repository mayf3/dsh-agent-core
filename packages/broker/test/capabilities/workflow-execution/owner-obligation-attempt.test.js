import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { canonicalJSON, sha256Hex } from '../../../../fixed-operation/src/canonical.js'
import { ExecutionLedger, attemptIdFor } from '../../../../workflow-execution/src/ledger.js'
import { createPluginContext } from '../../../../production-runtime/src/context.js'
import { mountWorkflowExecutionContextRuntime } from '../../../../production-runtime/src/workflow-execution-context-runtime.js'
import { DEFAULT_MANIFESTS } from '../../../src/index.js'
import { createBrokerGateway } from '../../../src/gateway.js'
import { ownerOperationRegistry } from '../../../src/capabilities/workflow/owner-operation-registry.js'
import { json, mockTargets, startMockServer, startTokenServer } from '../../../test-support/capability-fixtures.js'

const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
const managedId = id(1), visitId = id(2), caseId = id(3), sourceId = id(4), sourceVisit = id(5)
const targetVersion = id(6), definitionId = id(7), nodeDefinitionId = id(8), ownerId = id(15)
const seed = { workflowInstanceId: managedId, nodeVisitId: visitId, dispatchIntentId: id(21), ownerPrincipalId: ownerId }
const digest = value => sha256Hex(canonicalJSON(value))

function scenario(operation) {
  const create = operation === 'create_instance'
  const key = create ? 'workflow.create_instance' : operation === 'resolve_current_governance_review'
    ? 'workflow.assistance.resolve_current_review' : 'workflow.assistance.escalate_to_human'
  const descriptor = structuredClone(ownerOperationRegistry.find(row => row.descriptor.key === key).descriptor)
  const proof = { bindingId: id(9), terminalEventId: id(16), submissionId: id(17),
    submissionDigest: 'e'.repeat(64), acceptanceContractDigest: 'f'.repeat(64) }
  const source = { assistanceCaseId: caseId, workflowInstanceId: sourceId, nodeVisitId: sourceVisit,
    currentNodeVisitId: sourceVisit, workflowStateVersion: 12, status: 'OWNER_PENDING',
    governanceBinding: { assistanceCaseId: caseId, bindingId: id(9), status: 'BOUND',
      source: { workflowInstanceId: sourceId, nodeVisitId: sourceVisit, definitionVersionId: id(10) },
      child: { workflowInstanceId: managedId, definitionVersionId: definitionId, acceptanceTransitionId: id(18) },
      acceptanceContractDigest: proof.acceptanceContractDigest },
    governanceTerminalProof: { ...proof, verdict: 'ACCEPTED', definitionVersionId: definitionId, transitionId: id(18) } }
  const managed = { version: 1, managedKind: create ? 'INTAKE' : 'REVIEW', workflowInstanceId: managedId,
    definitionVersionId: definitionId, caseId, policyDigest: 'a'.repeat(64), state: 'ACTIVE',
    currentNode: { nodeVisitId: visitId, nodeDefinitionId, workflowStateVersion: 9,
      operation: { slotKey: create ? 'supplier' : 'review', allowedOperations: [descriptor],
        ...(create ? { targetDefinitionVersionId: targetVersion, targetDefinitionDigest: 'b'.repeat(64) } : {}),
        effect: { state: 'NOT_STARTED' } },
      ...(!create ? { reviewAdmission: { version: 1, status: 'ADMISSIBLE',
        source: structuredClone(source.governanceBinding.source), owner: { principalId: ownerId, bindingId: id(19) }, proof } } : {}) } }
  const args = create ? { domainId: id(11), definitionVersionId: targetVersion, contextPayload: { actual: true }, metadata: {} }
    : { assistanceCaseId: caseId, expectedWorkflowStateVersion: 12,
      ...(operation === 'resolve_current_governance_review'
        ? { resolution: { message: 'Reviewed actual acceptance', supportingPayload: { note: 'inspect' } } }
        : { escalation: { message: 'Needs a decision' } }) }
  const result = create ? { workflowInstanceId: id(12), workflowStateVersion: 1, admissionObservation: { status: 'WAITING' } }
    : { assistanceCaseId: caseId, status: operation === 'resolve_current_governance_review' ? 'RESOLVED' : 'HUMAN_REQUIRED', workflowStateVersion: 13 }
  return { managed, source, result, descriptor,
    call: { capabilityId: create ? 'workflow_execute' : 'workflow_assistance_action', operation, args } }
}

async function fixture(t, operation, outcome) {
  const data = scenario(operation)
  const root = await mkdtemp(join(tmpdir(), 'ekr-p1b-attempt-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const credentialsFile = join(root, 'credentials.json')
  await writeFile(credentialsFile, JSON.stringify({ version: 1,
    credentials: { agt_test: { clientId: 'synthetic', clientSecret: 'fixture-only' } } }))
  const auth = await startTokenServer()
  t.after(() => auth.close())
  const effectsFile = join(root, 'workflow_operation_effects.json')
  await writeFile(effectsFile, '{}')
  const claimedKeys = [], executedKeys = [], receiptReplies = []
  let executions = 0, principalReads = 0
  const slot = data.managed.currentNode.operation.slotKey
  const effectPath = `/internal/v1/workflow-instances/${managedId}/node-visits/${visitId}/operation-effects/${slot}:execute`
  // Svc contract substitute only: this table is NOT the real Svc DB or a Core store.
  const stableKey = canonicalJSON([managedId, definitionId, nodeDefinitionId, slot, 1])
  async function handle(req, res, entry) {
    const table = JSON.parse(await readFile(effectsFile, 'utf8'))
    if (entry.method === 'GET' && entry.pathname === `/internal/v1/workflow-instances/${managedId}/owner-obligation`) {
      const projection = structuredClone(data.managed)
      if (table[stableKey]) projection.currentNode.operation.effect = table[stableKey].effect
      return json(res, 200, projection)
    }
    if (entry.method === 'GET' && entry.pathname === `/internal/v1/assistance-cases/${caseId}`) return json(res, 200, data.source)
    if (entry.method !== 'POST' || entry.pathname !== effectPath) return json(res, 500, { error: { code: 'unexpected_route' } })
    assert.deepEqual(Object.keys(entry.body).sort(), ['arguments', 'expectedSourceWorkflowStateVersion', 'expectedWorkflowStateVersion', 'operation'])
    assert.deepEqual(entry.body.operation, data.descriptor)
    assert.equal(entry.headers['idempotency-key'], undefined, 'Svc owns the stable business key')
    assert.deepEqual(entry.query, {})
    assert.doesNotMatch(entry.rawBody + entry.pathname + JSON.stringify(entry.headers), /wfeat-|attemptId|processGeneration|generation/)
    const intent = { operation: entry.body.operation, arguments: entry.body.arguments }
    const existing = table[stableKey]
    if (existing) {
      if (canonicalJSON(intent) !== canonicalJSON(existing.intent)) return json(res, 409, { error: { code: 'idempotency_conflict' } })
      const { requestDigest, ...receipt } = existing.effect
      const reply = { ...receipt, replayed: true }
      receiptReplies.push(reply)
      return json(res, 200, reply)
    }
    claimedKeys.push(stableKey)
    executedKeys.push(stableKey)
    executions++
    const effect = outcome === 'SUCCEEDED'
      ? { state: 'SUCCEEDED', effectId: id(13), commandId: id(14),
        requestDigest: digest({ managedInstanceId: managedId, nodeVisitId: visitId, slotKey: slot, body: entry.body }),
        result: data.result, resultDigest: digest(data.result) }
      : { state: 'UNKNOWN', effectId: id(13) }
    table[stableKey] = { intent, effect }
    await writeFile(effectsFile, JSON.stringify(table))
    if (outcome === 'SUCCEEDED') {
      data.managed.currentNode.workflowStateVersion = 19
      if (operation === 'create_instance') data.source.workflowStateVersion = 22
      else {
        data.source.status = data.result.status
        data.source.workflowStateVersion = 13
        data.source.currentNodeVisitId = id(20)
        if (operation === 'resolve_current_governance_review') data.source.resolution = structuredClone(entry.body.arguments.resolution)
        delete data.managed.currentNode.reviewAdmission
      }
    }
    // The external handler ran and its row was saved; no first response reaches Core.
    req.socket.destroy()
  }
  const service = await startMockServer((req, res, entry) => {
    handle(req, res, entry).catch(error => {
      serverErrors.push(error)
      json(res, 500, { error: { code: 'fixture_failure', message: error.message } })
    })
  })
  const serverErrors = []
  t.after(() => service.close())
  const ledgerOptions = { dir: join(root, 'attempt-ledger'), resolveManagedAttempt: async () => true }
  let ledger = new ExecutionLedger(ledgerOptions)
  const contexts = [], provenances = []
  function gatewayFor(attempt) {
    const access = mountWorkflowExecutionContextRuntime({ ctx: createPluginContext() })
    const provenance = { kind: 'workflow_execution', workflowInstanceId: managedId, nodeVisitId: visitId, attemptId: attempt.attemptId }
    const turnExecutionId = `ekr-p1b-turn-${attempt.generation}`
    assert.deepEqual(access.noteWorkflowTurn({ turnExecutionId, provenance, agentId: 'agt_test', sessionId: 'main' }), { ok: true })
    const context = { agentId: 'agt_test', processGeneration: attempt.generation, ingressContext: { turnExecutionId } }
    const gateway = createBrokerGateway({ manifests: DEFAULT_MANIFESTS,
      targets: mockTargets({ 'svc-workflow': service.origin }), authServiceOrigin: auth.origin, credentialsFile,
      resolveWorkflowProvenance: trusted => {
        const resolved = access.resolveWorkflowProvenance(trusted)
        assert.deepEqual(resolved, provenance)
        provenances.push(resolved)
        return resolved
      }, localHandlers: { agent_resolve_principal_by_agent: { resolve: async () => {
        principalReads++
        return { ok: true, result: { agentId: 'agt_test', principalId: ownerId } }
      } } } })
    contexts.push(context)
    return () => gateway.execute(structuredClone(data.call), context)
  }
  async function begin() {
    const admission = await ledger.beginAttemptIfAbsent(seed, undefined, () => true)
    assert.equal(admission.created, true)
    const attempt = admission.attempt
    assert.equal(attempt.attemptId, attemptIdFor(visitId, attempt.generation))
    await ledger.recordDeliveryStarted({ nodeVisitId: visitId })
    await ledger.recordRunDelivered({ nodeVisitId: visitId, agentId: 'agt_test', requestId: attempt.attemptId, sessionId: 'main' })
    return { attempt, call: gatewayFor(attempt) }
  }
  async function next() {
    const prior = ledger.get(visitId)
    // Seed an already eligible/quiescent predecessor, as in managed-obligation.test.js.
    // This test does not establish real stale eligibility or authorize live UNKNOWN recovery.
    const settled = await ledger.recordStaleSuperseded({ nodeVisitId: visitId,
      expectedAttemptId: prior.attemptId, expectedGeneration: prior.generation,
      expected: { state: 'ACTIVE', phase: 'run_delivered', deliveredAtMs: prior.delivered.atMs }, observedWorkflowStateVersion: 9 })
    assert.equal(settled.committed, true)
    ledger = new ExecutionLedger(ledgerOptions)
    return begin()
  }
  return { ...data, begin, next, contexts, provenances, claimedKeys, executedKeys, receiptReplies, serverErrors,
    effectPath, stableKey, requests: service.requests,
    executions: () => executions, principalReads: () => principalReads,
    table: async () => JSON.parse(await readFile(effectsFile, 'utf8')) }
}

for (const operation of ['create_instance', 'resolve_current_governance_review', 'escalate_to_human']) {
  for (const outcome of ['SUCCEEDED', 'UNKNOWN']) {
    test(`P1-B ${operation}: lost response then new attempts preserve ${outcome} effect`, async t => {
      const f = await fixture(t, operation, outcome)
      const first = await f.begin()
      const lost = await first.call()
      assert.equal(lost.ok, false)
      assert.equal(lost.error.code, 'transport_failure')
      assert.equal(f.executions(), 1)
      assert.equal(f.requests.filter(row => row.method === 'POST').length, 1, 'no automatic POST retry after loss')
      const saved = await f.table()
      assert.equal(saved[f.stableKey].effect.state, outcome)
      const attempts = [first.attempt]
      for (let generation = 2; generation <= 3; generation++) {
        const current = await f.next()
        attempts.push(current.attempt)
        assert.equal(current.attempt.generation, generation)
        assert.notEqual(current.attempt.attemptId, first.attempt.attemptId)
        const before = f.requests.length
        const result = await current.call()
        const reads = f.requests.slice(before)
        assert.equal(reads[0].pathname, `/internal/v1/workflow-instances/${managedId}/owner-obligation`)
        if (outcome === 'SUCCEEDED') {
          assert.deepEqual(result, { ok: true, result: f.result })
          assert.deepEqual(reads.map(row => row.pathname), [reads[0].pathname, `/internal/v1/assistance-cases/${caseId}`, f.effectPath])
          assert.equal(reads.at(-1).body.expectedWorkflowStateVersion, 19)
          assert.deepEqual({ operation: reads.at(-1).body.operation, arguments: reads.at(-1).body.arguments }, saved[f.stableKey].intent)
          const { requestDigest, ...original } = saved[f.stableKey].effect
          assert.deepEqual(f.receiptReplies.at(-1), { ...original, replayed: true })
        } else {
          assert.equal(result.ok, false)
          assert.equal(result.error.code, 'authoritative_reference_unavailable')
          assert.equal(reads.length, 1, 'UNKNOWN permits only the relation read; no generic fallback or effect POST')
        }
        assert.deepEqual(await f.table(), saved, 'no replacement row, command, result, or UNKNOWN rewrite')
        assert.equal(f.executions(), 1, 'external business handler is never repeated')
      }
      assert.deepEqual(attempts.map(attempt => attempt.generation), [1, 2, 3])
      assert.equal(new Set(attempts.map(attempt => attempt.attemptId)).size, 3)
      assert.deepEqual(f.contexts.map(context => context.processGeneration), [1, 2, 3])
      assert.deepEqual(f.provenances.map(origin => origin.attemptId), attempts.map(attempt => attempt.attemptId))
      assert.deepEqual(f.claimedKeys, [f.stableKey])
      assert.deepEqual(f.executedKeys, [f.stableKey])
      assert.equal(f.requests.filter(row => row.method === 'POST').length, outcome === 'SUCCEEDED' ? 3 : 1)
      assert.equal(f.principalReads(), operation === 'resolve_current_governance_review' ? 1 : 0)
      assert.deepEqual(f.serverErrors, [])
      t.diagnostic(JSON.stringify({ operation, outcome, attempts: attempts.map(({ attemptId, generation }) => ({ attemptId, generation })),
        effectId: saved[f.stableKey].effect.effectId, stableKey: f.stableKey,
        businessExecutions: f.executions(), guardedPosts: f.requests.filter(row => row.method === 'POST').length,
        limitations: 'real Core ledger/context/gateway + loopback HTTP; Svc table is a fixture; admission eligibility and quiescence seeded; no live DB/process/production proof' }))
    })
  }
}
