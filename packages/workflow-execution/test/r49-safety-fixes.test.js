import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ExecutionLedger } from '../src/ledger.js'
import { workflowEffectId } from '../src/effect-identity.js'

const INSTANCE = '11111111-1111-4111-8111-111111111111'
const VISIT = '22222222-2222-4222-8222-222222222222'
const INTENT = '33333333-3333-4333-8333-333333333333'
const OWNER = '44444444-4444-4444-8444-444444444444'
const INTENT_2 = '55555555-5555-4555-8555-555555555555'

function ledgerFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'r49-safety-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return new ExecutionLedger({ dir })
}

test('R49 counterexample: late old identity cannot reconcile the active successor', async t => {
  const ledger = ledgerFixture(t)
  const first = await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
  const result = await ledger.recordReconciled({ nodeVisitId: VISIT, expectedPhase: 'planned', verdict: 'NEEDS_REVIEW', judgment: 'delivery_unverified', reason: 'old', expectedIdentity: {
    workflowInstanceId: INSTANCE, nodeVisitId: VISIT, dispatchIntentId: INTENT_2, generation: first.attempt.generation, workflowStateVersionAtDispatch: 1,
  } })
  assert.equal(result.committed, false)
  assert.equal(result.cause, 'identity_conflict')
  assert.equal(ledger.get(VISIT).state, 'ACTIVE')
})

test('R49 counterexample: stale settlement without version baseline is rejected', async t => {
  const ledger = ledgerFixture(t)
  const created = await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER }, async (attempt, { recordDeliveryStarted }) => {
    recordDeliveryStarted()
    return { kind: 'run_delivered', agentId: 'agt_a', requestId: attempt.attemptId, sessionId: 'main', workflowStateVersionAtDispatch: 7 }
  })
  await assert.rejects(() => ledger.recordStaleSuperseded({ nodeVisitId: VISIT, expected: { state: created.attempt.state, phase: created.attempt.phase, deliveredAtMs: created.attempt.delivered.atMs }, observedWorkflowStateVersion: undefined }), /requires observedWorkflowStateVersion baseline/)
  assert.equal(ledger.get(VISIT).state, 'ACTIVE')
})

test('R49 stable external effect id survives attempt generation changes', () => {
  const first = workflowEffectId({ workflowInstanceId: INSTANCE, nodeVisitId: VISIT, generation: 1 })
  const successor = workflowEffectId({ workflowInstanceId: INSTANCE, nodeVisitId: VISIT, generation: 2 })
  assert.equal(first, successor)
  assert.equal(first, `workflow-effect:${INSTANCE}:${VISIT}:dispatch`)
})
