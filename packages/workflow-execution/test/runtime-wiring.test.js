import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { mountWorkflowExecutionRuntime } from '../../production-runtime/src/workflow-execution-runtime.js'

const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_target-agent'

test('Router outcome_unknown preserves its reconciliation handle as active Run linkage with no replay', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wfe-runtime-unknown-'))
  const handle = 'turn:runtime:a1:g1:s1'
  let deliveries = 0
  const gateway = {
    execute: async () => ({ ok: true, result: { visibility: 'full', detail: { current_node_visit_id: VISIT } } }),
  }
  const principalAccess = {
    handlers: {
      agent_resolve_principal: {
        resolve: async () => ({ ok: true, result: { principalId: OWNER, agentId: AGENT } }),
      },
    },
  }
  const ctx = {
    get: (name) => ({ brokerGateway: gateway, agentPrincipalResolutionAccess: principalAccess })[name],
  }
  const router = {
    deliver: async () => {
      deliveries += 1
      throw Object.assign(new Error('prompt receipt lost'), {
        status: 'outcome_unknown',
        envelope: 'outcome_unknown',
        code: 'AGENT_PROCESS_PROMPT_RECEIPT_TIMEOUT',
        reconciliationHandle: handle,
      })
    },
    getTurnReconciliation: (candidate) => ({ state: candidate === handle ? 'pending' : 'never_existed' }),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
  }
  try {
    const runtime = mountWorkflowExecutionRuntime({
      ctx,
      layout: { workflowExecutionDir: join(root, 'workflow-execution') },
      router,
      log: { log() {}, warn() {}, error() {} },
      config: { pollerAgentId: 'agt_workflow-dispatcher-hr-agent' },
    })
    const admitted = await runtime.engine.admitDueIntent({
      dispatchIntentId: INTENT,
      nodeVisitId: VISIT,
      workflowInstanceId: INSTANCE,
      ownerPrincipalId: OWNER,
    })
    assert.equal(admitted.action, 'admitted')
    assert.equal(deliveries, 1)
    const attempt = runtime.ledger.get(VISIT)
    assert.equal(attempt.state, 'ACTIVE')
    assert.equal(attempt.phase, 'run_delivered')
    assert.equal(attempt.delivered.requestId, attempt.attemptId)
    assert.equal(attempt.delivered.reconciliationHandle, handle)

    const reconciled = await runtime.engine.reconcileOnce()
    assert.equal(reconciled.running, 1)
    assert.deepEqual(reconciled.needsReview, [])

    const duplicate = await runtime.engine.admitDueIntent({
      dispatchIntentId: INTENT,
      nodeVisitId: VISIT,
      workflowInstanceId: INSTANCE,
      ownerPrincipalId: OWNER,
    })
    assert.equal(duplicate.action, 'already_attempted')
    assert.equal(deliveries, 1, 'outcome_unknown is never replayed')

    // V2 CTR-WAE-013: the runtime component exposes the ONE controlled
    // recovery as a control-plane METHOD (authorityRef-gated inside the
    // engine) — and a replayed/foreign recovery against the admitted attempt
    // is delivery-domain evidence: RECOVERY_INAPPLICABLE, zero appends, zero
    // second delivery.
    assert.equal(typeof runtime.recoverAttempt, 'function')
    const sizeBefore = (await import('node:fs')).statSync(join(root, 'workflow-execution', 'attempts.jsonl')).size
    const replay = await runtime.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'TEST_AUTH_REF' })
    assert.equal(replay.outcome, 'RECOVERY_INAPPLICABLE')
    assert.equal(replay.evidenceClass, 'delivery_domain:run_delivered')
    const sizeAfter = (await import('node:fs')).statSync(join(root, 'workflow-execution', 'attempts.jsonl')).size
    assert.equal(sizeAfter, sizeBefore, 'zero recovery append')
    assert.equal(deliveries, 1, 'never a second delivery')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
