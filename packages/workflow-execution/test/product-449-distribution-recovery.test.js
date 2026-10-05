/**
 * PRODUCT #449 direct-consumer regressions — "Workflow v5: distribution nodes
 * loop on missing targetPlatforms and lack scoped recovery".
 *
 * The production defect (instances 86c0cff2 / 44dee9da stuck at `distribution`
 * with missing/empty targetPlatforms) is a CONSUMER-side loop class: a visit
 * whose assignee cannot produce the required submission stays due forever and
 * must never receive unbounded re-dispatch. These tests pin, end-to-end on the
 * REAL engine + ledger (no mocks of the machinery under test):
 *
 *   AC2  repeated identical no-progress attempts are BOUNDED per visit and
 *        produce exactly ONE durable OWNER_PENDING escalation (ATTEMPTS_
 *        EXHAUSTED), after which no further Run is ever delivered;
 *   AC4  every retry is idempotent: duplicate due records (same page and
 *        across sweeps) mint exactly ONE attempt; the ledger event trail is
 *        the exact audit;
 *   AC4b UNKNOWN is never replayed: a delivery whose outcome is unproven is
 *        never re-dispatched on a later sweep;
 *   AC-scoped  a canonical principal resolution failure (access_denied family)
 *        stops dispatch at the fence and stays visible as BLOCKED.
 *
 * The formal input-repair/HUMAN_REQUIRED path itself (the assignee-declared
 * assistance case that makes svc-workflow narrow the due feed) is the broker
 * surface covered by packages/broker/test/workflow-assistance-request.test.js.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, DEFAULT_MAX_ATTEMPTS_PER_VISIT } from '../src/ledger.js'
import { createWorkflowExecutionEngine } from '../src/engine.js'
import { projectExecutionAttention } from '../src/attention.js'
import { projectExecutionTrace } from '../src/projection.js'

const VISIT = '1d6c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e01'
const INTENT = '1d6c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e02'
const INSTANCE = '1d6c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e03'
const OWNER = '1d6c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e04'
const AGENT = 'agt_article_publisher'

function dueIntent(overrides = {}) {
  return {
    dispatchIntentId: INTENT,
    nodeVisitId: VISIT,
    workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER,
    nextEligibleAt: '2026-10-04T00:00:00Z',
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    ...overrides,
  }
}

// The stuck-distribution world: the visit stays current and the instance
// version never moves (no authoritative progress), sweep after sweep.
const unchangedWorld = {
  visibility: 'full',
  detail: {
    instance: { workflow_state_version: 9, is_terminal: false },
    current_node_visit_id: VISIT,
  },
}

test('AC2: a no-progress visit is dispatched at most maxAttempts times, then escalates exactly once and is never dispatched again', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf449-loop-'))
  const deliveries = []
  const escalations = []
  try {
    let t = 1_000_000
    const clock = () => t
    const ledger = new ExecutionLedger({ dir, clock })
    const engine = createWorkflowExecutionEngine({
      ledger,
      clock,
      config: { staleNoProgressThresholdMs: 3_600_000, retryDelayMs: 60_000 },
      fetchDuePage: async () => ({ ok: true, items: [dueIntent()] }),
      resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
      deliverRun: async ({ requestId }) => {
        deliveries.push(requestId)
        return { ok: true, sessionId: 'main', reconciliationHandle: `turn:${requestId}` }
      },
      getTurnReconciliation: () => ({ state: 'settled' }),
      readInstanceDetail: async () => ({ ok: true, body: unchangedWorld }),
      escalateAttemptLimit: async (payload) => {
        escalations.push(payload)
        return { ok: true, escalated: true, assistanceCaseId: 'case-449' }
      },
    })

    // Ten sweeps of the identical unchanged blocker. Each sweep advances the
    // shared clock 120s: past the 60s run-ended retry delay (the fast
    // continuation that re-enters generation N+1) yet far below the 1h stale
    // clock — the re-entry here is fence-driven policy, never a timeout.
    const actions = []
    for (let sweep = 0; sweep < 10; sweep++) {
      const result = await engine.pollOnce()
      actions.push(...result.admissions.map((a) => a.action))
      t += 120_000
    }

    const dispatched = deliveries.length
    assert.equal(dispatched, DEFAULT_MAX_ATTEMPTS_PER_VISIT,
      `the no-progress visit is dispatched exactly maxAttempts times, got ${dispatched}`)
    assert.equal(escalations.length, 1, 'exactly ONE durable escalation')
    assert.equal(escalations[0].reason, 'ATTEMPTS_EXHAUSTED')
    assert.equal(ledger.get(VISIT).escalation?.reason, 'ATTEMPTS_EXHAUSTED')
    assert.ok(actions.includes('attempt_limit_reached'), 'the fence refusal is observable')
    // After the cap: no further dispatch happens on later sweeps.
    const deliveriesAtCap = deliveries.length
    for (let sweep = 0; sweep < 3; sweep++) {
      await engine.pollOnce()
      t += 120_000
    }
    assert.equal(deliveries.length, deliveriesAtCap, 'no re-dispatch after the durable escalation')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('AC4: duplicate due records (same page and across sweeps) mint exactly ONE attempt — the ledger is the audit', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf449-dedupe-'))
  const deliveries = []
  try {
    let t = 2_000_000
    const clock = () => t
    const ledger = new ExecutionLedger({ dir, clock })
    const engine = createWorkflowExecutionEngine({
      ledger,
      clock,
      fetchDuePage: async () => ({ ok: true, items: [dueIntent(), dueIntent()] }),
      resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
      deliverRun: async ({ requestId }) => {
        deliveries.push(requestId)
        return { ok: true, sessionId: 'main', reconciliationHandle: `turn:${requestId}` }
      },
      getTurnReconciliation: () => ({ state: 'settled' }),
      readInstanceDetail: async () => ({ ok: true, body: unchangedWorld }),
      escalateAttemptLimit: async () => ({ ok: true, escalated: true, assistanceCaseId: 'case-x' }),
    })

    const first = await engine.pollOnce()
    assert.equal(first.admissions.filter((a) => a.action === 'admitted').length, 1)
    assert.equal(deliveries.length, 1)

    // The same intent again on later sweeps: never a second delivery.
    t += 500_000
    const second = await engine.pollOnce()
    assert.ok(second.admissions.every((a) => a.action === 'already_attempted'))
    assert.equal(deliveries.length, 1)

    // Audit trail: exactly one attempt chain, one delivery linkage.
    const snapshot = ledger.snapshot()
    assert.equal(snapshot.length, 1)
    assert.equal(snapshot[0].nodeVisitId, VISIT)
    assert.equal(snapshot[0].delivered?.requestId, deliveries[0])
    const trace = projectExecutionTrace(await ledger.snapshotFresh(), { workflowInstanceId: INSTANCE })
    assert.equal(trace.nodeVisits.length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('AC4b: UNKNOWN is never replayed — a delivery whose outcome is unproven is never re-dispatched', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf449-unknown-'))
  const deliveries = []
  try {
    let t = 3_000_000
    const clock = () => t
    const ledger = new ExecutionLedger({ dir, clock })
    const engine = createWorkflowExecutionEngine({
      ledger,
      clock,
      config: { staleNoProgressThresholdMs: 3_600_000, retryDelayMs: 60_000 },
      fetchDuePage: async () => ({ ok: true, items: [dueIntent()] }),
      resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
      // The runtime seam preserves a handle-carrying outcome_unknown as an
      // admitted delivery (workflow-execution-runtime deliverRun: "no replay
      // is attempted") — the reconciliation record itself is then lost.
      deliverRun: async ({ requestId }) => {
        deliveries.push(requestId)
        return { ok: true, sessionId: 'main', reconciliationHandle: 'turn:lost' }
      },
      getTurnReconciliation: () => undefined,
      resolveCallerCorrelation: () => undefined,
      readInstanceDetail: async () => ({ ok: true, body: unchangedWorld }),
      escalateAttemptLimit: async () => ({ ok: true, escalated: true, assistanceCaseId: 'case-x' }),
    })

    await engine.admitDueIntent(dueIntent())
    assert.equal(deliveries.length, 1)
    assert.equal(ledger.get(VISIT).delivered?.reconciliationHandle, 'turn:lost')

    // First reconcile: no verified Run linkage → terminal delivery_unverified,
    // never silently re-run.
    const summary = await engine.reconcileOnce()
    assert.deepEqual(summary.needsReview, [VISIT])
    assert.equal(ledger.get(VISIT).judgment, 'delivery_unverified')

    // Many sweeps later (past every threshold): still never a second delivery.
    for (let sweep = 0; sweep < 4; sweep++) {
      t += 3_600_000
      const result = await engine.pollOnce()
      assert.ok(result.admissions.every((a) => a.action === 'already_attempted'))
    }
    assert.equal(deliveries.length, 1, 'UNKNOWN is never re-dispatched')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('scoped: canonical principal resolution failure stops dispatch at the fence and stays visible as BLOCKED', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf449-blocked-'))
  const deliveries = []
  try {
    let t = 4_000_000
    const clock = () => t
    const ledger = new ExecutionLedger({ dir, clock })
    const engine = createWorkflowExecutionEngine({
      ledger,
      clock,
      fetchDuePage: async () => ({ ok: true, items: [dueIntent()] }),
      // The issue's observed `access_denied` from canonical principal resolution.
      resolvePrincipalToAgent: async () => ({ ok: false, code: 'access_denied' }),
      deliverRun: async ({ requestId }) => {
        deliveries.push(requestId)
        return { ok: true, sessionId: 'main' }
      },
      getTurnReconciliation: () => undefined,
      readInstanceDetail: async () => ({ ok: true, body: unchangedWorld }),
      escalateAttemptLimit: async () => ({ ok: true, escalated: true, assistanceCaseId: 'case-x' }),
    })

    for (let sweep = 0; sweep < 5; sweep++) {
      const result = await engine.pollOnce()
      if (sweep === 0) {
        assert.equal(result.admissions[0].action, 'blocked')
        assert.equal(result.admissions[0].code, 'access_denied')
      } else {
        assert.equal(result.admissions[0].action, 'already_attempted')
      }
      t += 60_000
    }
    assert.equal(deliveries.length, 0, 'a resolution-blocked visit is never delivered')

    const attention = projectExecutionAttention(await ledger.snapshotFresh())
    assert.equal(attention.counts.BLOCKED, 1)
    const item = attention.items.find((i) => i.nodeVisitId === VISIT)
    assert.equal(item.executionState, 'BLOCKED')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
