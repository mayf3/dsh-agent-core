import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createWorkflowExecutionEngine } from '../src/engine.js'
import { ExecutionLedger } from '../src/ledger.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const intent = { nodeVisitId: VISIT, dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER }

// Keep the real durable ledger, admission and reconciliation. Only external
// Router/service reads and Run delivery are replaced; no worker is launched.
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-quiescence-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  let now = 1_700_000_000_000
  const observations = {
    primary: () => ({ state: 'pending' }),
    correlation: () => ({ state: 'pending' }),
  }
  const delivered = []
  const ledger = new ExecutionLedger({ dir, clock: () => now })
  const dependencies = {
    clock: () => now,
    fetchDuePage: async () => ({ ok: true, items: [] }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: 'agt_target-agent' }),
    deliverRun: async (request) => {
      delivered.push(request)
      return { ok: true, sessionId: 'main', reconciliationHandle: 'turn:current:a1:g1:s1' }
    },
    getTurnReconciliation: () => observations.primary(),
    resolveCallerCorrelation: () => observations.correlation(),
    readInstanceDetail: async () => ({
      ok: true,
      body: {
        visibility: 'full',
        detail: {
          current_node_visit_id: VISIT,
          instance: { is_terminal: false, workflow_state_version: 7 },
        },
      },
    }),
  }
  const engine = createWorkflowExecutionEngine({ ledger, ...dependencies })
  return {
    ledger, engine, observations, delivered,
    engineFor: (otherLedger, fetchDuePage) => createWorkflowExecutionEngine({
      ...dependencies, ledger: otherLedger, fetchDuePage,
    }),
    bytes: () => readFileSync(join(dir, 'attempts.jsonl')),
    age: () => { now += 3_600_001 },
    async seedStale() {
      await engine.admitDueIntent(intent)
      now += 3_600_001
      await engine.reconcileOnce()
      assert.equal(ledger.get(VISIT).judgment, 'stale_no_progress')
    },
  }
}

const unavailable = () => { throw new Error('Router read unavailable') }
const unresolvedObservations = [
  ['recovering with an active unknown fence', () => ({
    state: 'recovering', snapshot: {
      state: 'recovering', initialOutcome: 'outcome_unknown',
      recoveryState: 'shutdown_requested', fenceState: 'active',
      terminationEvidence: null,
    },
  }), () => ({ state: 'recovering' })],
  ['both Router reads throw', unavailable, unavailable],
  ['both Router reads return no result', () => undefined, () => undefined],
  ['Router response has no state', () => ({}), () => ({})],
  ['unsupported failure state', () => ({ state: 'failed' }), () => ({ state: 'failed' })],
  ['new unrecognized state', () => ({ state: 'future_state' }), () => ({ state: 'future_state' })],
  ['correlation fallback still recovering', () => ({ state: 'evicted' }), () => ({ state: 'recovering' })],
]

for (const [name, primary, correlation] of unresolvedObservations) {
  test('stale successor defers without a ledger append when ' + name, async (t) => {
    const f = fixture(t)
    await f.seedStale()
    const predecessor = f.ledger.get(VISIT)
    const before = f.bytes()
    f.observations.primary = primary
    f.observations.correlation = correlation

    for (let pass = 0; pass < 2; pass += 1) {
      const result = await f.engine.admitDueIntent(intent)
      assert.equal(result.action, 'deferred_quiescence')
      assert.equal(f.ledger.get(VISIT).attemptId, predecessor.attemptId)
      assert.equal(f.ledger.get(VISIT).generation, 1)
      assert.equal(f.delivered.length, 1)
      assert.deepEqual(f.bytes(), before, 'no attempt_planned or delivery_started append')
    }
  })
}

const positiveObservations = [
  ['trusted completed turn', () => ({
    state: 'settled', snapshot: {
      state: 'settled', outcome: 'completed', fenceState: 'cleared',
      terminationEvidence: 'exact_terminal_then_idle',
    },
  })],
  ['trusted failed turn', () => ({
    state: 'settled', snapshot: {
      state: 'settled', outcome: 'failed', fenceState: 'cleared',
      terminationEvidence: 'exact_terminal_then_idle',
    },
  })],
  ['settled-before-compaction', () => ({ state: 'evicted' })],
  ['exact process-generation restart convergence', () => ({ state: 'restart_lost' })],
  ['positive non-issuance proof', () => ({ state: 'never_existed' })],
]

for (const [name, primary] of positiveObservations) {
  test('stale successor admits one new generation after ' + name, async (t) => {
    const f = fixture(t)
    await f.seedStale()
    const predecessor = f.ledger.get(VISIT)
    f.observations.primary = primary
    // No matching request is found by the secondary lookup; keep the
    // primary authority's positive proof rather than inventing a new state.
    f.observations.correlation = () => ({ state: 'never_existed' })

    assert.equal((await f.engine.admitDueIntent(intent)).action, 'admitted')
    const successor = f.ledger.get(VISIT)
    assert.equal(successor.generation, 2)
    assert.equal(successor.previousAttemptId, predecessor.attemptId)
    assert.notEqual(successor.attemptId, predecessor.attemptId)
    assert.equal(successor.phase, 'run_delivered')
    assert.equal(f.delivered.length, 2)
    const after = f.bytes()
    assert.equal((await f.engine.admitDueIntent(intent)).action, 'already_attempted')
    assert.deepEqual(f.bytes(), after, 'duplicate trigger preserves the new attempt fence')
    assert.equal(f.delivered.length, 2)
  })
}

test('exact settled correlation still admits when the primary lookup is unavailable', async (t) => {
  const f = fixture(t)
  await f.seedStale()
  f.observations.primary = unavailable
  f.observations.correlation = () => ({ state: 'settled' })
  assert.equal((await f.engine.admitDueIntent(intent)).action, 'admitted')
  assert.equal(f.ledger.get(VISIT).generation, 2)
  assert.equal(f.delivered.length, 2)
})

for (const judgment of ['run_outcome_unknown', 'settle_check_unavailable', 'delivery_unverified']) {
  test('terminal ' + judgment + ' remains ineligible past the one-hour stale threshold', async (t) => {
    const f = fixture(t)
    await f.engine.admitDueIntent(intent)
    await f.ledger.recordReconciled({
      nodeVisitId: VISIT, expectedPhase: 'run_delivered',
      verdict: 'NEEDS_REVIEW', judgment, reason: 'unknown execution evidence',
    })
    const predecessor = f.ledger.get(VISIT)
    const before = f.bytes()
    f.age()

    assert.deepEqual(await f.ledger.listStaleCandidatesFresh(3_600_000), [])
    assert.deepEqual((await f.engine.reconcileOnce()).staleReentry, [])
    assert.equal((await f.engine.admitDueIntent(intent)).action, 'already_attempted')
    assert.equal(f.ledger.get(VISIT).attemptId, predecessor.attemptId)
    assert.equal(f.ledger.get(VISIT).judgment, judgment)
    assert.equal(f.delivered.length, 1)
    assert.deepEqual(f.bytes(), before, 'timeout never rewrites durable UNKNOWN as stale')
  })
}

test('proven run-ended-no-submission still continues after the stale threshold', async (t) => {
  const f = fixture(t)
  await f.engine.admitDueIntent(intent)
  f.observations.primary = () => ({ state: 'settled' })
  await f.engine.reconcileOnce()
  assert.equal(f.ledger.get(VISIT).judgment, 'run_ended_no_submission')
  f.age()
  assert.deepEqual((await f.engine.reconcileOnce()).staleReentry, [VISIT])
  assert.equal((await f.engine.admitDueIntent(intent)).action, 'admitted')
  assert.equal(f.ledger.get(VISIT).generation, 2)
  assert.equal(f.delivered.length, 2)
})

for (const [name, primary, correlation] of unresolvedObservations.slice(0, 3)) {
  test('parked second poller defers after another poller stale-settles: ' + name, async (t) => {
    const f = fixture(t)
    await f.engine.admitDueIntent(intent)
    const secondLedger = new ExecutionLedger({ dir: f.ledger.dir, clock: f.ledger.clock })
    let fetched, resume
    const fetching = new Promise((resolve) => { fetched = resolve })
    const feed = new Promise((resolve) => { resume = resolve })
    const second = f.engineFor(secondLedger, () => { fetched(); return feed })
    const polling = second.pollOnce()
    await fetching
    assert.equal(secondLedger.get(VISIT).state, 'ACTIVE')
    f.age()
    await f.engine.reconcileOnce()
    assert.equal(f.ledger.get(VISIT).judgment, 'stale_no_progress')
    assert.equal(secondLedger.get(VISIT).state, 'ACTIVE', 'second poller still has its cached predecessor')
    const before = f.bytes()
    f.observations.primary = primary
    f.observations.correlation = correlation
    const timestamp = new Date(f.ledger.clock()).toISOString()
    resume({ ok: true, items: [{ ...intent, nextEligibleAt: timestamp, createdAt: timestamp, updatedAt: timestamp }] })
    const pass = await polling
    assert.deepEqual(pass.admissions.map((a) => a.action), ['deferred_quiescence'])
    assert.equal(secondLedger.get(VISIT).generation, 1)
    assert.equal(f.delivered.length, 1)
    assert.deepEqual(f.bytes(), before, 'fresh locked predecessor cannot bypass execution proof')
  })
}

for (const [name, primary] of positiveObservations) {
  test('parked second poller admits with fresh positive evidence: ' + name, async (t) => {
    const f = fixture(t)
    await f.engine.admitDueIntent(intent)
    const secondLedger = new ExecutionLedger({ dir: f.ledger.dir, clock: f.ledger.clock })
    let fetched, resume
    const fetching = new Promise((resolve) => { fetched = resolve })
    const feed = new Promise((resolve) => { resume = resolve })
    const second = f.engineFor(secondLedger, () => { fetched(); return feed })
    const polling = second.pollOnce()
    await fetching
    f.age()
    await f.engine.reconcileOnce()
    const predecessor = f.ledger.get(VISIT)
    f.observations.primary = primary
    f.observations.correlation = () => ({ state: 'never_existed' })
    const timestamp = new Date(f.ledger.clock()).toISOString()
    resume({ ok: true, items: [{ ...intent, nextEligibleAt: timestamp, createdAt: timestamp, updatedAt: timestamp }] })
    const pass = await polling
    assert.deepEqual(pass.admissions.map((a) => a.action), ['admitted'])
    assert.equal(secondLedger.get(VISIT).generation, 2)
    assert.equal(secondLedger.get(VISIT).previousAttemptId, predecessor.attemptId)
    assert.equal(f.delivered.length, 2)
  })
}

for (const [name, guard] of [
  ['missing', undefined], ['undefined', () => undefined], ['truthy object', () => ({ quiescent: true })],
  ['async true', async () => true], ['throwing', () => { throw new Error('read failed') }],
  ['async rejection', async () => { throw new Error('async read failed') }],
  ['promise rejection', () => Promise.reject(new Error('promise read failed'))],
]) {
  test('locked stale admission refuses a ' + name + ' guard before any append', async (t) => {
    const f = fixture(t)
    await f.seedStale()
    const before = f.bytes()
    const result = await f.ledger.beginAttemptIfAbsent(intent, undefined, guard)
    assert.equal(result.created, false)
    assert.equal(result.cause, 'deferred_quiescence')
    assert.equal(f.ledger.get(VISIT).generation, 1)
    assert.deepEqual(f.bytes(), before)
    assert.equal(f.delivered.length, 1)
  })
}

test('missing locked re-entry guard never invokes a supplied delivery callback', async (t) => {
  const f = fixture(t)
  await f.seedStale()
  const before = f.bytes()
  let invoked = 0
  const result = await f.ledger.beginAttemptIfAbsent(intent, async (attempt) => {
    invoked += 1
    return { kind: 'run_delivered', agentId: 'agt_target-agent', requestId: attempt.attemptId, sessionId: 'main' }
  })
  assert.equal(result.created, false)
  assert.equal(result.cause, 'deferred_quiescence')
  assert.equal(invoked, 0)
  assert.equal(f.ledger.get(VISIT).generation, 1)
  assert.deepEqual(f.bytes(), before)
})
