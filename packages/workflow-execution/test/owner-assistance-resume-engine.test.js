/**
 * CTR-WEC1-008 engine acceptance: same-visit Assistance resume and crash fences.
 * All svc and Router surfaces are producer-shaped injected read seams.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor } from '../src/ledger.js'
import { createWorkflowExecutionEngine } from '../src/engine.js'
import { completeCurrentActivationDetail } from '../test-support/current-activation-detail.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_target-agent'

function dueIntent() {
  return {
    dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER, nextEligibleAt: '2026-09-09T01:00:00Z',
    createdAt: '2026-09-09T00:00:00Z', updatedAt: '2026-09-09T00:30:00Z',
  }
}

function makeDeps({ turnState = () => 'pending', correlatedState = () => undefined,
  resumeEvidence = () => ({ ok: true, evidence: null }),
  now = () => Date.now(),
  escalateAttemptLimit = async () => ({ ok: true, assistanceCaseId: '6d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77' }),
  config,
  detailBody = () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: VISIT } } }),
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-owner-resume-'))
  const ledger = new ExecutionLedger({ dir, clock: now })
  const calls = { delivers: [], resumeReads: [] }
  const engine = createWorkflowExecutionEngine({
    ledger, log: { log() {}, warn() {}, error() {} },
    clock: now, config, escalateAttemptLimit,
    fetchDuePage: async () => ({ ok: true, items: [dueIntent()] }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async (req) => { calls.delivers.push(req); return { ok: true, sessionId: 'main', reconciliationHandle: 'turn:next' } },
    getTurnReconciliation: () => ({ state: turnState() }),
    resolveCallerCorrelation: () => {
      const state = correlatedState()
      return state === undefined ? { state: 'never_existed' } : { state, handle: 'turn:correlated' }
    },
    readInstanceDetail: async (req) => {
      const read = detailBody()
      return read?.ok ? { ...read, body: completeCurrentActivationDetail(read.body, {
        workflowInstanceId: req.workflowInstanceId, ownerPrincipalId: OWNER,
      }) } : read
    },
    readOwnerAssistanceResumeEvidence: async (req) => { calls.resumeReads.push(req); return resumeEvidence() },
    buildInstruction: (input) => `instruction:${input.attemptId}`,
  })
  return { engine, ledger, calls, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

async function seedRunEndedPredecessor(ledger) {
  const first = await ledger.beginAttemptIfAbsent(dueIntent(), async (attempt, { recordDeliveryStarted }) => {
    recordDeliveryStarted()
    return { kind: 'run_delivered', agentId: AGENT, requestId: attempt.attemptId, sessionId: 'main', reconciliationHandle: 'turn:prior' }
  }, undefined, async () => ({ preDeliveryWorkflowStateVersion: 1 }))
  await ledger.recordReconciled({ nodeVisitId: VISIT, expectedPhase: 'run_delivered', verdict: 'NEEDS_REVIEW',
    judgment: 'run_ended_no_submission', reason: 'run ended without submission' })
  return first.attempt
}

async function seedRunEndedAtGeneration(ledger, generation) {
  let attempt
  for (let currentGeneration = 1; currentGeneration <= generation; currentGeneration += 1) {
    const result = await ledger.beginAttemptIfAbsent(dueIntent(), async (planned, { recordDeliveryStarted }) => {
      recordDeliveryStarted()
      return { kind: 'run_delivered', agentId: AGENT, requestId: planned.attemptId,
        sessionId: 'main', reconciliationHandle: `turn:g${currentGeneration}`, workflowStateVersionAtDispatch: 1 }
    }, () => true, async () => ({ preDeliveryWorkflowStateVersion: 1 }))
    assert.equal(result.created, true, `expected generation ${currentGeneration} to be planned (${result.cause ?? 'no cause'})`)
    attempt = result.attempt
    await ledger.recordReconciled({ nodeVisitId: VISIT, expectedPhase: 'run_delivered', verdict: 'NEEDS_REVIEW',
      judgment: 'run_ended_no_submission', reason: 'run ended without submission' })
    if (currentGeneration < generation) {
      const terminal = ledger.snapshot()[0]
      await ledger.recordStaleSuperseded({ nodeVisitId: VISIT,
        expected: { state: terminal.state, phase: terminal.phase, deliveredAtMs: terminal.delivered.atMs },
        observedWorkflowStateVersion: 1 })
    }
  }
  return attempt
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

test('pre-plan refuses mismatched current activation identity and terminal instances', async (t) => {
  const cases = [
    ['instance identity', { instance: { workflow_instance_id: 'ed5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11' } }],
    ['visit identity', { current_visit: { node_visit_id: 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77' } }],
    ['assignee identity', { current_visit: { assignee_principal_id: 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77' } }],
    ['terminal instance', { instance: { is_terminal: true } }],
  ]
  for (const [label, drift] of cases) await t.test(label, async () => {
    const fixture = makeDeps({
      detailBody: () => ({ ok: true, body: { visibility: 'full', detail: {
        current_node_visit_id: VISIT,
        current_visit: { node_visit_id: VISIT, workflow_instance_id: INSTANCE, assignee_principal_id: OWNER },
        instance: { workflow_instance_id: INSTANCE, is_terminal: false, workflow_state_version: 12 },
        ...drift,
      } } }),
    })
    try {
      const result = await fixture.engine.pollOnce()
      assert.equal(result.admissions[0].action, 'pre_plan_unavailable')
      assert.equal(fixture.ledger.snapshot().length, 0)
      assert.equal(fixture.calls.delivers.length, 0)
    } finally { fixture.cleanup() }
  })
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

test('attempt-cap policy assistance preserves the run-ended predecessor and admits one authorized next generation', async () => {
  let nowMs = 1_000
  let evidence
  const policyCaseId = '6d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e78'
  const escalations = []
  const fixture = makeDeps({
    now: () => nowMs,
    config: { retryDelayMs: 1, staleNoProgressThresholdMs: 1 },
    turnState: () => 'settled',
    detailBody: () => ({ ok: true, body: { visibility: 'full', detail: {
      instance: { workflow_state_version: evidence?.workflowStateVersion ?? 1 }, current_node_visit_id: VISIT,
    } } }),
    resumeEvidence: () => ({ ok: true, evidence }),
    escalateAttemptLimit: async (payload) => {
      escalations.push(payload)
      return { ok: true, assistanceCaseId: policyCaseId }
    },
  })
  try {
    fixture.ledger.maxAttemptsPerVisit = 3
    const predecessor = await seedRunEndedAtGeneration(fixture.ledger, 3)
    assert.equal(predecessor.attemptId, attemptIdFor(VISIT, 3))
    nowMs += 10

    await fixture.engine.reconcileOnce()
    assert.equal(fixture.ledger.snapshot()[0].state, 'NEEDS_REVIEW')
    assert.equal(fixture.ledger.snapshot()[0].judgment, 'run_ended_no_submission')
    assert.equal(fixture.ledger.snapshot()[0].escalation.lastAttemptId, predecessor.attemptId)
    assert.equal(escalations.length, 1)
    assert.equal(fixture.calls.resumeReads.length, 0)

    evidence = {
      ...ownerEvidence(3), assistanceCaseId: policyCaseId,
      ingress: 'execution_policy', reason: 'ATTEMPTS_EXHAUSTED', lastAttemptId: predecessor.attemptId,
      requestEventSequence: 2, resolutionEventSequence: 3,
    }
    const result = await fixture.engine.pollOnce()
    assert.equal(result.admissions[0].action, 'admitted')
    assert.equal(result.admissions[0].attemptId, attemptIdFor(VISIT, 4))
    assert.equal(fixture.calls.delivers.length, 1)
    assert.equal(fixture.calls.resumeReads[0].previousAttemptId, predecessor.attemptId)
    assert.deepEqual(fixture.ledger.snapshot()[0].consumedAssistanceCaseIds, [policyCaseId])

    const repeated = await fixture.engine.pollOnce()
    assert.notEqual(repeated.admissions[0].action, 'admitted')
    assert.equal(fixture.calls.delivers.length, 1)
  } finally { fixture.cleanup() }
})

test('a higher-generation predecessor rejects its superseded policy case and UNKNOWN stays fenced', async (t) => {
  await t.test('policy evidence bound to a superseded generation cannot resume the latest attempt', async () => {
    let nowMs = 1_000
    let evidence
    const fixture = makeDeps({
      now: () => nowMs,
      config: { retryDelayMs: 1, staleNoProgressThresholdMs: 1 },
      turnState: () => 'settled',
      detailBody: () => ({ ok: true, body: { visibility: 'full', detail: {
        instance: { workflow_state_version: 3 }, current_node_visit_id: VISIT,
      } } }),
      resumeEvidence: () => ({ ok: true, evidence }),
    })
    try {
      const latest = await seedRunEndedAtGeneration(fixture.ledger, 2)
      const supersededAttemptId = attemptIdFor(VISIT, 1)
      evidence = {
        ...ownerEvidence(3), ingress: 'execution_policy', reason: 'ATTEMPTS_EXHAUSTED',
        lastAttemptId: supersededAttemptId, requestEventSequence: 2, resolutionEventSequence: 3,
      }
      nowMs += 10
      const result = await fixture.engine.pollOnce()
      assert.equal(result.admissions[0].action, 'already_attempted')
      assert.equal(fixture.calls.resumeReads[0].previousAttemptId, latest.attemptId)
      assert.equal(latest.attemptId, attemptIdFor(VISIT, 2))
      assert.equal(fixture.calls.delivers.length, 0)
      assert.equal(fixture.ledger.snapshot()[0].attemptId, latest.attemptId)
      assert.deepEqual(fixture.ledger.snapshot()[0].consumedAssistanceCaseIds ?? [], [])
    } finally { fixture.cleanup() }
  })

  await t.test('run_outcome_unknown does not read Owner evidence or resume', async () => {
    const fixture = makeDeps({
      turnState: () => 'settled',
      detailBody: () => ({ ok: true, body: { visibility: 'full', detail: {
        instance: { workflow_state_version: 12 }, current_node_visit_id: VISIT,
      } } }),
      resumeEvidence: () => ({ ok: true, evidence: ownerEvidence(12) }),
    })
    try {
      const attempt = await fixture.ledger.beginAttemptIfAbsent(dueIntent(), async (planned, { recordDeliveryStarted }) => {
        recordDeliveryStarted()
        return { kind: 'run_delivered', agentId: AGENT, requestId: planned.attemptId,
          sessionId: 'main', reconciliationHandle: 'turn:unknown', workflowStateVersionAtDispatch: 1 }
      }, undefined, async () => ({ preDeliveryWorkflowStateVersion: 1 }))
      await fixture.ledger.recordReconciled({ nodeVisitId: VISIT, expectedPhase: 'run_delivered',
        verdict: 'NEEDS_REVIEW', judgment: 'run_outcome_unknown', reason: 'execution outcome unknown' })
      const result = await fixture.engine.pollOnce()
      assert.equal(result.admissions[0].action, 'already_attempted')
      assert.equal(fixture.calls.resumeReads.length, 0)
      assert.equal(fixture.calls.delivers.length, 0)
      assert.equal(fixture.ledger.snapshot()[0].attemptId, attempt.attempt.attemptId)
      assert.equal(fixture.ledger.snapshot()[0].judgment, 'run_outcome_unknown')
    } finally { fixture.cleanup() }
  })
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

test('planned Owner-resume recheck drift falls through to delivery_unverified without a delivery failure event', async () => {
  let detailReads = 0
  const fixture = makeDeps({
    turnState: () => 'pending',
    detailBody: () => {
      detailReads += 1
      const currentNodeVisitId = detailReads === 1 ? VISIT : 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
      return { ok: true, body: { visibility: 'full', detail: {
        instance: { workflow_state_version: 12 }, current_node_visit_id: currentNodeVisitId,
      } } }
    },
  })
  try {
    await seedRunEndedPredecessor(fixture.ledger)
    const planned = await fixture.ledger.beginAttemptIfAbsent(dueIntent(), undefined, undefined,
      async () => ({ preDeliveryWorkflowStateVersion: 12, assistanceResume: ownerEvidence(12) }),
      async () => true)
    const result = await fixture.engine.reconcileOnce()
    const terminal = fixture.ledger.snapshot()[0]
    assert.equal(fixture.calls.delivers.length, 0)
    assert.deepEqual(result.needsReview, [VISIT])
    assert.equal(terminal.attemptId, planned.attempt.attemptId)
    assert.equal(terminal.judgment, 'delivery_unverified')
    assert.equal(terminal.reason, 'attempt has no verified Run linkage (planned but delivery not recorded)')
    assert.equal(terminal.phase, 'reconciled')
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

test('managed per-Visit cap cannot use the legacy Owner-resume exemption', async () => {
  const fixture = makeDeps({ turnState: () => 'settled',
    detailBody: () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 12 }, current_node_visit_id: VISIT } } }),
    resumeEvidence: () => ({ ok: true, evidence: ownerEvidence(12) }),
  })
  try {
    fixture.ledger.maxAttemptsPerVisit = 99
    fixture.ledger.resolveManagedAttempt = async () => true
    await seedRunEndedAtGeneration(fixture.ledger, 3)
    const prior = fixture.ledger.get(VISIT)
    const result = await fixture.engine.pollOnce()
    assert.equal(result.admissions[0].action, 'attempt_limit_reached')
    assert.equal(fixture.calls.delivers.length, 0)
    assert.equal(fixture.ledger.get(VISIT).attemptId, prior.attemptId)
    assert.equal(fixture.ledger.get(VISIT).generation, 3)
  } finally { fixture.cleanup() }
})
