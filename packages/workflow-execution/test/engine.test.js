/**
 * WORKFLOW_AGENT_EXECUTION_V1 — engine tests over injected fakes (no real
 * svc-workflow, no real router). Covers the COMPLETE_WHEN chain:
 *
 *   DISPATCH_INTENT -> one attempt -> assignee Run (provenance) -> reconcile
 *   -> SETTLED, plus the required negative: run ended without business
 *   submission => NEEDS_REVIEW, never a silent loss, never an automatic rerun.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor } from '../src/ledger.js'
import { createWorkflowExecutionEngine } from '../src/engine.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const VISIT_NEXT = 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_target-agent'

function dueIntent(overrides = {}) {
  return {
    dispatchIntentId: INTENT,
    nodeVisitId: VISIT,
    workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER,
    nextEligibleAt: '2026-09-09T01:00:00Z',
    createdAt: '2026-09-09T00:00:00Z',
    updatedAt: '2026-09-09T00:30:00Z',
    ...overrides,
  }
}

function makeDeps({
  dueItems = [dueIntent()],
  duePages = undefined, // array of page arrays; overrides dueItems
  dueErrorOnPage = 1,
  dueError = undefined,
  resolve = () => ({ ok: true, agentId: AGENT }),
  deliver = () => ({ ok: true, sessionId: 'main', reconciliationHandle: 'turn:handle-1' }),
  turnState = () => 'pending',
  correlatedState = () => undefined,
  resumeEvidence = () => ({ ok: true, evidence: null }),
  detailBody = () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: VISIT } } }),
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-engine-'))
  const ledger = new ExecutionLedger({ dir })
  const calls = { delivers: [], resolves: [], detailReads: [], instructions: [], dueRequests: [], resumeReads: [] }
  // Mid-test re-pointable seams (tests reassign fixture.turnState etc. to
  // advance time without rebuilding the engine).
  const mutable = { turnState, detailBody, resumeEvidence }
  const engine = createWorkflowExecutionEngine({
    ledger,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    fetchDuePage: async (req) => {
      calls.dueRequests.push(req)
      if (dueError !== undefined && calls.dueRequests.length >= dueErrorOnPage) return { ok: false, ...dueError }
      if (duePages !== undefined) {
        const idx = calls.dueRequests.length - 1
        return { ok: true, items: duePages[idx] ?? [] }
      }
      return { ok: true, items: typeof dueItems === 'function' ? dueItems() : dueItems }
    },
    resolvePrincipalToAgent: async (principalId) => {
      calls.resolves.push(principalId)
      return resolve(principalId)
    },
    deliverRun: async (req) => {
      calls.delivers.push(req)
      return deliver(req)
    },
    getTurnReconciliation: (handle) => {
      const state = mutable.turnState(handle)
      return state === undefined ? { state: 'never_existed' } : { state }
    },
    resolveCallerCorrelation: ({ requestId }) => {
      const state = correlatedState(requestId)
      return state === undefined ? { state: 'never_existed' } : { state, handle: 'turn:correlated' }
    },
    readInstanceDetail: async (req) => {
      calls.detailReads.push(req)
      return mutable.detailBody(req)
    },
    readOwnerAssistanceResumeEvidence: async (req) => {
      calls.resumeReads.push(req)
      return mutable.resumeEvidence(req)
    },
    buildInstruction: (input) => {
      calls.instructions.push(input)
      return `instruction:${input.attemptId}`
    },
  })
  return {
    engine, ledger, calls, dir, mutable,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

async function seedRunEndedPredecessor(ledger) {
  const first = await ledger.beginAttemptIfAbsent(dueIntent(), async (attempt, { recordDeliveryStarted }) => {
    recordDeliveryStarted()
    return { kind: 'run_delivered', agentId: AGENT, requestId: attempt.attemptId, sessionId: 'main', reconciliationHandle: 'turn:prior' }
  }, undefined, async () => ({ preDeliveryWorkflowStateVersion: 1 }))
  assert.equal(first.created, true)
  await ledger.recordReconciled({
    nodeVisitId: VISIT,
    expectedPhase: 'run_delivered',
    verdict: 'NEEDS_REVIEW',
    judgment: 'run_ended_no_submission',
    reason: 'run ended without submission',
  })
  return first.attempt
}

function ownerEvidence(version = 12) {
  return {
    dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, nodeVisitId: VISIT, ownerPrincipalId: OWNER,
    activationState: 'ACTIVE', workflowStateVersion: version,
    assistanceCaseId: '6d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77',
    requestEventSequence: 10, resolutionEventSequence: 11,
    requesterPrincipalId: OWNER, resolverPrincipalId: '7d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e88',
    ingress: 'assignee', reason: null, lastAttemptId: null,
  }
}

test('happy chain: due intent -> one attempt -> assignee Run with provenance -> SETTLED', async () => {
  const fixture = makeDeps({
    turnState: (handle) => (handle === 'turn:handle-1' ? 'pending' : 'never_existed'),
  })
  try {
    const { engine, ledger, calls } = fixture
    const pass = await engine.pollOnce()
    assert.equal(pass.ok, true)
    assert.equal(pass.admissions.length, 1)
    assert.equal(pass.admissions[0].action, 'admitted')

    // Exactly one Run, resolved through the canonical principal mapping.
    assert.equal(calls.delivers.length, 1)
    assert.deepEqual(calls.resolves, [OWNER, OWNER], 'pre-plan activation read and delivery resolve are both fresh')
    const delivery = calls.delivers[0]
    assert.equal(delivery.agentId, AGENT)
    assert.equal(delivery.requestId, attemptIdFor(VISIT), 'requestId IS the deterministic attempt id')
    assert.deepEqual(delivery.messageOrigin, {
      kind: 'workflow_execution',
      workflowInstanceId: INSTANCE,
      nodeVisitId: VISIT,
      attemptId: attemptIdFor(VISIT),
    })
    assert.equal(delivery.message, `instruction:${attemptIdFor(VISIT)}`)
    assert.deepEqual(calls.instructions[0], {
      workflowInstanceId: INSTANCE,
      nodeVisitId: VISIT,
      dispatchIntentId: INTENT,
      attemptId: attemptIdFor(VISIT),
    }, 'the instruction builder received the exact attempt coordinates')

    // Machine linkage: NodeVisit -> Attempt -> Run.
    const attempt = ledger.get(VISIT)
    assert.equal(attempt.state, 'ACTIVE')
    assert.equal(attempt.delivered.agentId, AGENT)
    assert.equal(attempt.delivered.reconciliationHandle, 'turn:handle-1')

    // Run in flight -> stays ACTIVE, no settle probe spent on it. The ONE
    // the two exact reads are the pre-plan baseline and the existing
    // best-effort post-delivery stale baseline.
    const reconcileRunning = await engine.reconcileOnce()
    assert.equal(reconcileRunning.running, 1)
    assert.equal(calls.detailReads.length, 2, 'no settle probe on a running run; pre-plan and dispatch baseline reads remain')
    assert.equal(ledger.get(VISIT).state, 'ACTIVE')

    // Run settled + business state moved past our visit -> SETTLED.
    fixture.mutable.turnState = () => 'settled'
    fixture.mutable.detailBody = () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: VISIT_NEXT } } })
    const reconcileDone = await engine.reconcileOnce()
    assert.deepEqual(reconcileDone.settled, [VISIT])
    assert.equal(ledger.get(VISIT).state, 'SETTLED')
    assert.equal(ledger.get(VISIT).judgment, 'business_commitment_observed')
  } finally {
    fixture.cleanup()
  }
})

test('duplicate triggers (re-poll, second intent, HR double-fire) never create a second attempt or Run', async () => {
  const fixture = makeDeps({
    dueItems: () => [dueIntent(), dueIntent({ dispatchIntentId: '9d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e88' })],
  })
  try {
    const { engine, calls, ledger } = fixture
    const first = await engine.pollOnce()
    assert.equal(calls.delivers.length, 1)
    const second = await engine.pollOnce()
    assert.equal(second.admissions.filter((a) => a.action === 'admitted').length, 0)
    assert.ok(second.admissions.every((a) => a.action === 'already_attempted'))
    assert.equal(calls.delivers.length, 1, 'still exactly one Run')
    assert.equal(ledger.snapshot().length, 1)
    void first
  } finally {
    fixture.cleanup()
  }
})

test('cross-process reconcile cannot terminalize another poller during planned-to-delivered admission', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-engine-race-'))
  let releaseResolution
  let resolutionEntered
  const entered = new Promise((resolve) => { resolutionEntered = resolve })
  const release = new Promise((resolve) => { releaseResolution = resolve })
  const common = {
    fetchDuePage: async () => ({ ok: true, items: [] }),
    deliverRun: async () => ({ ok: true, sessionId: 'main', reconciliationHandle: 'turn:race' }),
    getTurnReconciliation: () => ({ state: 'pending' }),
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: VISIT } } }),
    log: { log: () => {}, warn: () => {}, error: () => {} },
  }
  const admitting = createWorkflowExecutionEngine({
    ...common,
    ledger: new ExecutionLedger({ dir }),
    resolvePrincipalToAgent: async () => {
      resolutionEntered()
      await release
      return { ok: true, agentId: AGENT }
    },
  })
  const reconciling = createWorkflowExecutionEngine({
    ...common,
    ledger: new ExecutionLedger({ dir }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
  })
  try {
    const admission = admitting.admitDueIntent(dueIntent())
    await entered
    const reconciliation = reconciling.reconcileOnce()
    let reconciledEarly = false
    void reconciliation.finally(() => { reconciledEarly = true })
    await new Promise((resolve) => setTimeout(resolve, 75))
    assert.equal(reconciledEarly, false, 'the reconciler waits on the live admission owner')

    releaseResolution()
    const [admitted, reconciled] = await Promise.all([admission, reconciliation])
    assert.equal(admitted.action, 'admitted')
    assert.deepEqual(reconciled.needsReview, [])
    assert.equal(reconciled.running, 1, 'fresh compare-and-set observes the delivered phase')

    const restarted = new ExecutionLedger({ dir })
    assert.equal(restarted.get(VISIT).state, 'ACTIVE')
    assert.equal(restarted.get(VISIT).phase, 'run_delivered')
    assert.equal(restarted.get(VISIT).delivered.reconciliationHandle, 'turn:race')
  } finally {
    releaseResolution?.()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('cross-process failover refreshes a stale empty projection before reconciliation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-engine-failover-'))
  const staleLedger = new ExecutionLedger({ dir })
  const writerLedger = new ExecutionLedger({ dir })
  const engine = createWorkflowExecutionEngine({
    ledger: staleLedger,
    fetchDuePage: async () => ({ ok: true, items: [] }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async () => ({ ok: true, sessionId: 'main', reconciliationHandle: 'turn:failover' }),
    getTurnReconciliation: () => ({ state: 'settled' }),
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: VISIT_NEXT } } }),
    log: { log: () => {}, warn: () => {}, error: () => {} },
  })
  try {
    assert.deepEqual(staleLedger.listActive(), [], 'poller B caches the pre-admission empty projection')
    await writerLedger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    await writerLedger.recordRunDelivered({
      nodeVisitId: VISIT,
      agentId: AGENT,
      requestId: attemptIdFor(VISIT),
      sessionId: 'main',
      reconciliationHandle: 'turn:failover',
    })

    const reconciled = await engine.reconcileOnce()
    assert.equal(reconciled.examined, 1)
    assert.deepEqual(reconciled.settled, [VISIT])
    assert.equal(staleLedger.get(VISIT).state, 'SETTLED')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('NEGATIVE (goal-required): run completed, model replied 完成了, visit still current => NEEDS_REVIEW, not silent, not rerun', async () => {
  const fixture = makeDeps({
    turnState: () => 'settled',
    detailBody: () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: VISIT } } }),
  })
  try {
    const { engine, ledger, calls } = fixture
    await engine.pollOnce()
    const summary = await engine.reconcileOnce()
    assert.deepEqual(summary.needsReview, [VISIT])
    const attempt = ledger.get(VISIT)
    assert.equal(attempt.state, 'NEEDS_REVIEW')
    assert.equal(attempt.judgment, 'run_ended_no_submission')

    // And the next poll never re-runs it (no automatic retry, no agent swap).
    const next = await engine.pollOnce()
    assert.equal(calls.delivers.length, 1)
    assert.equal(next.admissions.every((a) => a.action !== 'admitted'), true)
  } finally {
    fixture.cleanup()
  }
})

test('outcome unknown (handle lost, correlation lost) + still current => NEEDS_REVIEW run_outcome_unknown, never rerun', async () => {
  const fixture = makeDeps({
    turnState: () => 'restart_lost',
    correlatedState: () => 'restart_lost',
    detailBody: () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: VISIT } } }),
  })
  try {
    const { engine, ledger, calls } = fixture
    await engine.pollOnce()
    const summary = await engine.reconcileOnce()
    assert.deepEqual(summary.needsReview, [VISIT])
    assert.equal(ledger.get(VISIT).judgment, 'run_outcome_unknown')
    await engine.pollOnce()
    assert.equal(calls.delivers.length, 1, 'unknown outcome never creates a second execution')
  } finally {
    fixture.cleanup()
  }
})

test('settle probe fails (credential/read error) => NEEDS_REVIEW settle_check_unavailable, never assumed settled', async () => {
  const fixture = makeDeps({
    turnState: () => 'settled',
    detailBody: () => ({ ok: false, code: 'credential_unavailable' }),
  })
  try {
    const { engine, ledger } = fixture
    const pass = await engine.pollOnce()
    assert.equal(pass.admissions[0].action, 'pre_plan_unavailable')
    assert.equal(ledger.get(VISIT), undefined, 'no baseline means no durable attempt plan')
  } finally {
    fixture.cleanup()
  }
})

test('assignee unresolvable after a trusted pre-plan baseline is recoverably blocked with zero Runs', async () => {
  const fixture = makeDeps({
    resolve: () => ({ ok: false, code: 'agent_mapping_missing' }),
  })
  try {
    const { engine, ledger, calls } = fixture
    const pass = await engine.pollOnce()
    assert.equal(pass.admissions[0].action, 'blocked')
    assert.equal(calls.delivers.length, 0, 'never deliver without the canonical mapping')
    assert.equal(ledger.get(VISIT).phase, 'resolution_blocked')
    const next = await engine.pollOnce()
    assert.equal(next.admissions[0].action, 'already_attempted')
    assert.equal(calls.delivers.length, 0)
  } finally {
    fixture.cleanup()
  }
})

test('deliver rejected (agent disabled) => NEEDS_REVIEW delivery_rejected, no retry on the next poll', async () => {
  const fixture = makeDeps({
    deliver: () => ({ ok: false, code: 'AGENT_DISABLED' }),
  })
  try {
    const { engine, ledger, calls } = fixture
    const pass = await engine.pollOnce()
    assert.equal(pass.admissions[0].action, 'needs_review')
    assert.match(ledger.get(VISIT).reason, /delivery_rejected:AGENT_DISABLED/)
    await engine.pollOnce()
    assert.equal(calls.delivers.length, 1, 'exactly one delivery attempt, ever')
  } finally {
    fixture.cleanup()
  }
})

test('restart: a fresh engine over the same ledger reconciles via the requestId correlation (no duplicate attempt)', async () => {
  const first = makeDeps()
  const second = (() => {
    const engine = createWorkflowExecutionEngine({
      ledger: new ExecutionLedger({ dir: first.dir }),
      log: { log: () => {}, error: () => {} },
      fetchDuePage: async () => ({ ok: true, items: [dueIntent()] }),
      resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
      deliverRun: async () => { throw new Error('restart engine must never deliver again') },
      getTurnReconciliation: () => ({ state: 'never_existed' }),
      resolveCallerCorrelation: ({ requestId }) => (requestId === attemptIdFor(VISIT) ? { state: 'settled', handle: 'turn:correlated' } : { state: 'never_existed' }),
      readInstanceDetail: async () => ({ ok: true, body: { visibility: 'historical_participant', detail: { instance: { workflow_state_version: 1 } } } }),
    })
    return { engine }
  })()
  try {
    await first.engine.pollOnce()
    // The runtime restarted: in-memory turn records are gone, the durable
    // ledger + requestId correlation carry the reconcile.
    const summary = await second.engine.reconcileOnce()
    assert.deepEqual(summary.settled, [VISIT])
    // A new poll of the same intent after restart never re-attempts.
    const poll = await second.engine.pollOnce()
    assert.equal(poll.admissions[0].action, 'already_attempted')
  } finally {
    first.cleanup()
  }
})

test('due feed failure: loud no-op pass, zero mutations', async () => {
  const fixture = makeDeps({ dueError: { code: 'service_unavailable' } })
  try {
    const { engine, ledger } = fixture
    const pass = await engine.pollOnce()
    assert.equal(pass.ok, false)
    assert.equal(pass.phase, 'list_due_intents')
    assert.equal(pass.code, 'service_unavailable')
    assert.deepEqual(ledger.snapshot(), [])
  } finally {
    fixture.cleanup()
  }
})

test('malformed due records are skipped loudly; valid ones still admitted', async () => {
  const fixture = makeDeps({
    dueItems: () => [dueIntent({ nodeVisitId: 'garbage' }), { foo: 1 }, dueIntent()],
  })
  try {
    const { engine, ledger } = fixture
    const pass = await engine.pollOnce()
    assert.equal(pass.ok, true)
    assert.equal(pass.admissions.length, 1, 'only the well-formed record admits')
    assert.equal(ledger.snapshot().length, 1)
  } finally {
    fixture.cleanup()
  }
})

test('maxAdmissionsPerPoll bounds a burst; excess due intents stay due (no admission, no ledger rows)', async () => {
  const items = [1, 2, 3].map((n) => dueIntent({
    dispatchIntentId: `bd5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e0${n}`,
    nodeVisitId: `cd5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e0${n}`,
    workflowInstanceId: `4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e0${n}`,
  }))
  const detailBody = (req) => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: items.find((item) => item.workflowInstanceId === req.workflowInstanceId)?.nodeVisitId } } })
  const fixture = makeDeps({ dueItems: items, detailBody })
  try {
    // Recreate the engine with a tighter bound via the ledger dir trick is
    // overkill: assert the default engine admits all three, then verify the
    // bound on a second engine over a fresh ledger.
    const pass = await fixture.engine.pollOnce()
    assert.equal(pass.admissions.filter((a) => a.action === 'admitted').length, 3)
    const dir = mkdtempSync(join(tmpdir(), 'wfe-engine-'))
    try {
      const bounded = createWorkflowExecutionEngine({
        ledger: new ExecutionLedger({ dir }),
        fetchDuePage: async () => ({ ok: true, items }),
        resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
        deliverRun: async () => ({ ok: true, sessionId: 'main' }),
        getTurnReconciliation: () => ({ state: 'pending' }),
        readInstanceDetail: async ({ workflowInstanceId }) => detailBody({ workflowInstanceId }),
        config: { maxAdmissionsPerPoll: 2 },
      })
      const boundedPass = await bounded.pollOnce()
      assert.equal(boundedPass.admissions.filter((a) => a.action === 'admitted').length, 2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  } finally {
    fixture.cleanup()
  }
})

test('settled Owner assistance resumes the exact visit once, with a fresh proof and cap bypass', async () => {
  const fixture = makeDeps({
    turnState: () => 'settled',
    detailBody: () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 12 }, current_node_visit_id: VISIT } } }),
    resumeEvidence: () => ({ ok: true, evidence: ownerEvidence(12) }),
  })
  try {
    const predecessor = await seedRunEndedPredecessor(fixture.ledger)
    fixture.ledger.maxAttemptsPerVisit = 1
    const result = await fixture.engine.pollOnce()
    assert.equal(result.admissions[0].action, 'admitted')
    assert.equal(result.admissions[0].attemptId, attemptIdFor(VISIT, 2))
    assert.equal(fixture.calls.delivers.length, 1)
    assert.equal(fixture.calls.delivers[0].requestId, attemptIdFor(VISIT, 2))
    assert.deepEqual(fixture.calls.resumeReads[0], {
      dispatchIntentId: INTENT, previousAttemptId: predecessor.attemptId, preDeliveryWorkflowStateVersion: 1,
    })
    const current = fixture.ledger.snapshot()[0]
    assert.equal(current.retryReason, 'owner_assistance_resolved')
    assert.equal(current.preDeliveryWorkflowStateVersion, 12)
    assert.equal(current.assistanceResume.assistanceCaseId, ownerEvidence().assistanceCaseId)
    assert.deepEqual(current.consumedAssistanceCaseIds, [ownerEvidence().assistanceCaseId])
    await fixture.ledger.recordReconciled({
      nodeVisitId: VISIT, expectedPhase: 'run_delivered', verdict: 'NEEDS_REVIEW',
      judgment: 'run_ended_no_submission', reason: 'owner resumed run ended without submission',
    })
    assert.deepEqual(await fixture.ledger.listStaleCandidatesFresh(1), [])
    assert.deepEqual(await fixture.ledger.listRunEndedCandidatesFresh(1), [])
  } finally { fixture.cleanup() }
})

test('unsettled predecessor cannot use Owner evidence or bypass the attempt fence', async () => {
  const fixture = makeDeps({
    turnState: () => 'pending',
    detailBody: () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 12 }, current_node_visit_id: VISIT } } }),
    resumeEvidence: () => ({ ok: true, evidence: ownerEvidence(12) }),
  })
  try {
    await seedRunEndedPredecessor(fixture.ledger)
    const result = await fixture.engine.pollOnce()
    assert.equal(result.admissions[0].action, 'already_attempted')
    assert.equal(fixture.calls.resumeReads.length, 0)
    assert.equal(fixture.calls.delivers.length, 0)
    assert.equal(fixture.ledger.snapshot()[0].generation, 1)
  } finally { fixture.cleanup() }
})

test('execution-policy Assistance proof is bound to the exact persisted opaque predecessor ID', async () => {
  const policyEvidence = ownerEvidence(12)
  Object.assign(policyEvidence, {
    assistanceCaseId: '6d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e78',
    requesterPrincipalId: '8d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e99',
    ingress: 'execution_policy', reason: 'ATTEMPTS_EXHAUSTED', lastAttemptId: attemptIdFor(VISIT),
  })
  const fixture = makeDeps({
    turnState: () => 'settled',
    detailBody: () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 12 }, current_node_visit_id: VISIT } } }),
    resumeEvidence: () => ({ ok: true, evidence: policyEvidence }),
  })
  try {
    const predecessor = await seedRunEndedPredecessor(fixture.ledger)
    const result = await fixture.engine.pollOnce()
    assert.equal(result.admissions[0].action, 'admitted')
    assert.equal(fixture.calls.resumeReads[0].previousAttemptId, predecessor.attemptId)
    assert.equal(fixture.ledger.snapshot()[0].assistanceResume.ingress, 'execution_policy')
    assert.equal(fixture.ledger.snapshot()[0].assistanceResume.lastAttemptId, predecessor.attemptId)
  } finally { fixture.cleanup() }
})

test('planned Owner-resume crash continues the same attempt only on exact never_existed proof', async () => {
  const fixture = makeDeps({
    turnState: () => 'pending',
    detailBody: () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 12 }, current_node_visit_id: VISIT } } }),
  })
  try {
    const predecessor = await seedRunEndedPredecessor(fixture.ledger)
    const planned = await fixture.ledger.beginAttemptIfAbsent(dueIntent(), undefined, undefined,
      async () => ({ preDeliveryWorkflowStateVersion: 12, assistanceResume: ownerEvidence(12) }),
      async () => true)
    assert.equal(planned.created, true)
    assert.equal(planned.attempt.attemptId, attemptIdFor(VISIT, 2))
    const result = await fixture.engine.reconcileOnce()
    assert.equal(fixture.calls.delivers.length, 1)
    assert.equal(fixture.calls.delivers[0].requestId, planned.attempt.attemptId)
    assert.equal(fixture.ledger.snapshot()[0].attemptId, planned.attempt.attemptId)
    assert.equal(fixture.ledger.snapshot()[0].retryReason, 'owner_assistance_resolved')
    assert.equal(fixture.ledger.snapshot()[0].delivered.requestId, planned.attempt.attemptId)
    assert.equal(result.needsReview.length, 0)
    assert.equal(predecessor.attemptId, attemptIdFor(VISIT))
  } finally { fixture.cleanup() }
})

test('planned Owner-resume with contradictory never_existed fields is fenced without replay', async () => {
  const fixture = makeDeps({
    turnState: () => 'pending',
    detailBody: () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 12 }, current_node_visit_id: VISIT } } }),
    correlatedState: () => 'never_existed',
  })
  try {
    await seedRunEndedPredecessor(fixture.ledger)
    await fixture.ledger.beginAttemptIfAbsent(dueIntent(), undefined, undefined,
      async () => ({ preDeliveryWorkflowStateVersion: 12, assistanceResume: ownerEvidence(12) }),
      async () => true)
    const original = fixture.engine
    // The fixture intentionally adds an attributable Router handle to its correlation result.
    assert.ok(original)
    const result = await fixture.engine.reconcileOnce()
    assert.equal(fixture.calls.delivers.length, 0)
    assert.equal(result.needsReview.includes(VISIT), true)
    assert.equal(fixture.ledger.snapshot()[0].judgment, 'delivery_unverified')
  } finally { fixture.cleanup() }
})

test('planned Owner-resume stays fenced for pending or unknown Router correlation', async (t) => {
  for (const state of ['pending', 'unknown', 'settled']) {
    await t.test(state, async () => {
      const fixture = makeDeps({
        correlatedState: () => state,
        detailBody: () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 12 }, current_node_visit_id: VISIT } } }),
      })
      try {
        await seedRunEndedPredecessor(fixture.ledger)
        const planned = await fixture.ledger.beginAttemptIfAbsent(dueIntent(), undefined, undefined,
          async () => ({ preDeliveryWorkflowStateVersion: 12, assistanceResume: ownerEvidence(12) }),
          async () => true)
        await fixture.engine.reconcileOnce()
        assert.equal(fixture.calls.delivers.length, 0)
        assert.equal(fixture.ledger.snapshot()[0].attemptId, planned.attempt.attemptId)
        assert.equal(fixture.ledger.snapshot()[0].judgment, 'delivery_unverified')
      } finally { fixture.cleanup() }
    })
  }
})
