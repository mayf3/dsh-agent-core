import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor } from '../src/ledger.js'
import { normalizeProgressCheckpoint } from '../src/progress.js'

const INSTANCE = '11111111-1111-4111-8111-111111111111'
const VISIT = '22222222-2222-4222-8222-222222222222'
const INTENT = '33333333-3333-4333-8333-333333333333'
const OWNER = '44444444-4444-4444-8444-444444444444'

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'progress-checkpoint-'))
  let now = 100
  const ledger = new ExecutionLedger({ dir, clock: () => now })
  return {
    dir,
    ledger,
    setNow(value) { now = value },
    cleanup() { rmSync(dir, { recursive: true, force: true }) },
  }
}

async function deliver(fx) {
  await fx.ledger.beginAttemptIfAbsent({
    dispatchIntentId: INTENT,
    nodeVisitId: VISIT,
    workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER,
  })
  fx.setNow(110)
  await fx.ledger.recordDeliveryStarted({ nodeVisitId: VISIT })
  fx.setNow(120)
  await fx.ledger.recordRunDelivered({
    nodeVisitId: VISIT,
    agentId: 'agt_progress',
    requestId: 'req-1',
    sessionId: 'main',
  })
}
test('checkpoint is replayable resume metadata and never changes execution state', async () => {
  const fx = fixture()
  try {
    await deliver(fx)
    const before = fx.ledger.get(VISIT)
    fx.setNow(200)

    const out = await fx.ledger.recordProgressCheckpoint({
      nodeVisitId: VISIT,
      attemptId: attemptIdFor(VISIT),
      reporterAgentId: 'agt_progress',
      sessionId: 'main',
      turnExecutionId: 'turn-progress-1',
      checkpoint: {
        accomplished: ['loaded source'],
        current: ['writing focused tests'],
        next: ['run regression'],
        artifacts: ['commit:candidate'],
      },
    })

    assert.equal(out.committed, true)
    const after = fx.ledger.get(VISIT)
    assert.equal(after.state, before.state)
    assert.equal(after.phase, before.phase)
    assert.equal(after.judgment, before.judgment)
    assert.equal(after.delivered.atMs, before.delivered.atMs)
    assert.equal(after.progressCheckpointCount, 1)
    assert.deepEqual(after.latestProgressCheckpoint.checkpoint.current, ['writing focused tests'])

    const replay = new ExecutionLedger({ dir: fx.dir })
    const restarted = replay.get(VISIT)
    assert.equal(restarted.state, 'ACTIVE')
    assert.equal(restarted.phase, 'run_delivered')
    assert.deepEqual(restarted.latestProgressCheckpoint.checkpoint.next, ['run regression'])
  } finally {
    fx.cleanup()
  }
})
test('checkpoint does not reset stale-no-progress eligibility clock', async () => {
  const fx = fixture()
  try {
    await deliver(fx)

    const staleBefore = await fx.ledger.listStaleCandidatesFresh(50, 180)
    assert.deepEqual(staleBefore.map((item) => item.nodeVisitId), [VISIT])

    fx.setNow(500)
    await fx.ledger.recordProgressCheckpoint({
      nodeVisitId: VISIT,
      attemptId: attemptIdFor(VISIT),
      reporterAgentId: 'agt_progress',
      sessionId: 'main',
      checkpoint: { current: ['still working'] },
    })

    const staleAfter = await fx.ledger.listStaleCandidatesFresh(50, 500)
    assert.deepEqual(staleAfter.map((item) => item.nodeVisitId), [VISIT])
    assert.equal(staleAfter[0].delivered.atMs, 120)
  } finally {
    fx.cleanup()
  }
})
test('checkpoint rejects stale attempt, wrong reporter/session and terminal attempts', async () => {
  const fx = fixture()
  try {
    await deliver(fx)

    const stale = await fx.ledger.recordProgressCheckpoint({
      nodeVisitId: VISIT,
      attemptId: 'wfeat-000000000000000000000000',
      reporterAgentId: 'agt_progress',
      sessionId: 'main',
      checkpoint: { current: ['x'] },
    })
    assert.equal(stale.committed, false)
    assert.equal(stale.cause, 'stale_attempt')

    const wrongAgent = await fx.ledger.recordProgressCheckpoint({
      nodeVisitId: VISIT,
      attemptId: attemptIdFor(VISIT),
      reporterAgentId: 'agt_other',
      sessionId: 'main',
      checkpoint: { current: ['x'] },
    })
    assert.equal(wrongAgent.cause, 'reporter_mismatch')

    const wrongSession = await fx.ledger.recordProgressCheckpoint({
      nodeVisitId: VISIT,
      attemptId: attemptIdFor(VISIT),
      reporterAgentId: 'agt_progress',
      sessionId: 'other',
      checkpoint: { current: ['x'] },
    })
    assert.equal(wrongSession.cause, 'session_mismatch')

    await fx.ledger.recordReconciled({
      nodeVisitId: VISIT,
      expectedPhase: 'run_delivered',
      verdict: 'SETTLED',
      judgment: 'business_commitment_observed',
      reason: 'visit moved',
    })
    await assert.rejects(
      fx.ledger.recordProgressCheckpoint({
        nodeVisitId: VISIT,
        attemptId: attemptIdFor(VISIT),
        reporterAgentId: 'agt_progress',
        sessionId: 'main',
        checkpoint: { next: ['late write'] },
      }),
      /attempt is terminal/,
    )
  } finally {
    fx.cleanup()
  }
})
test('checkpoint schema is bounded and closed', () => {
  assert.deepEqual(
    normalizeProgressCheckpoint({ accomplished: [' done '], blocker: ' waiting ' }),
    {
      accomplished: ['done'],
      current: [],
      next: [],
      blocker: 'waiting',
      artifacts: [],
    },
  )

  assert.throws(() => normalizeProgressCheckpoint({}), /at least one/)
  assert.throws(() => normalizeProgressCheckpoint({ unknown: ['x'] }), /unknown checkpoint field/)
  assert.throws(() => normalizeProgressCheckpoint({ current: Array.from({ length: 9 }, () => 'x') }), /at most 8/)
  assert.throws(() => normalizeProgressCheckpoint({ current: ['x'.repeat(241)] }), /240/)
  assert.throws(() => normalizeProgressCheckpoint({ artifacts: Array.from({ length: 13 }, () => 'ref') }), /at most 12/)
})
