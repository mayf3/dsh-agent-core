import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ExecutionLedger } from '/private/tmp/h1364-budget/packages/workflow-execution/src/ledger.js'
import { createWorkflowExecutionEngine } from '/private/tmp/h1364-budget/packages/workflow-execution/src/engine.js'
import { completeCurrentActivationDetail } from '/private/tmp/h1364-budget/packages/workflow-execution/test-support/current-activation-detail.js'

const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_budget_probe'

async function reproduce(badCount) {
  const dir = mkdtempSync(join(tmpdir(), '1364-budget-ledger-'))
  const items = Array.from({ length: badCount + 1 }, (_, index) => {
    const suffix = String(index + 1).padStart(12, '0')
    return {
      dispatchIntentId: `bd5c2f0a-3f19-4a7e-9a3f-${suffix}`,
      nodeVisitId: `cd5c2f0a-3f19-4a7e-9a3f-${suffix}`,
      workflowInstanceId: `ed5c2f0a-3f19-4a7e-9a3f-${suffix}`,
      ownerPrincipalId: OWNER,
      nextEligibleAt: '2026-11-07T00:00:00Z',
      createdAt: '2026-11-07T00:00:00Z',
      updatedAt: '2026-11-07T00:00:00Z',
    }
  })
  const healthy = items.at(-1)
  let badChecks = 0
  let healthyChecks = 0
  const deliveries = []
  const ledger = new ExecutionLedger({
    dir,
    resolveManagedAttempt: async ({ nodeVisitId }) => {
      if (nodeVisitId === healthy.nodeVisitId) {
        healthyChecks += 1
        return false
      }
      badChecks += 1
      return undefined
    },
  })
  const engine = createWorkflowExecutionEngine({
    ledger,
    fetchDuePage: async () => ({ ok: true, items }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async (request) => {
      assert.equal(request.messageOrigin.nodeVisitId, healthy.nodeVisitId, 'abnormal items must never be delivered')
      assert.equal(ledger.get(healthy.nodeVisitId).phase, 'delivery_started', 'real WAL must precede delivery')
      deliveries.push(request)
      return { ok: true, sessionId: 'main', reconciliationHandle: 'turn:1364-budget' }
    },
    getTurnReconciliation: () => ({ state: 'pending' }),
    readInstanceDetail: async ({ workflowInstanceId }) => {
      const item = items.find(candidate => candidate.workflowInstanceId === workflowInstanceId)
      return { ok: true, body: completeCurrentActivationDetail({
        visibility: 'full', detail: {
          instance: { workflow_state_version: 1 }, current_node_visit_id: item.nodeVisitId,
        },
      }, { workflowInstanceId, ownerPrincipalId: OWNER }) }
    },
  })
  const rounds = []
  try {
    for (let round = 1; round <= 3; round += 1) {
      const beforeBad = badChecks
      const beforeHealthy = healthyChecks
      const result = await engine.pollOnce()
      assert.equal(result.ok, true, 'poll must complete normally')
      rounds.push({
        round, actions: result.admissions.map(item => item.action),
        badChecks: badChecks - beforeBad, healthyChecks: healthyChecks - beforeHealthy,
        attempts: ledger.snapshot().length, deliveries: deliveries.length,
      })
    }
    console.log(JSON.stringify({ badCount, rounds, healthyChecks, deliveries: deliveries.length }))
    assert.equal(deliveries.length, 1, `${badCount} stable pre-plan failures must not starve the healthy tail for three polls`)
    assert.equal(ledger.snapshot().length, 1, 'only the healthy visit may mint an attempt')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('control: 24 abnormal heads leave the 25th healthy intent reachable', () => reproduce(24))
test('regression: 25 abnormal heads must leave the 26th healthy intent reachable within three polls', () => reproduce(25))
