import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { JobStore } from '../../src/store.js'
import {
  applyTransition,
  buildOccurrenceRecord,
  rebuildFences,
} from '../../src/occurrence-model.js'
import { createSelfOpsAccess } from '../../src/self-ops/index.js'
import { classifyRouter } from '../../src/self-ops/diagnosis.js'
import { TRUSTED_TERMINATION_EVIDENCE } from '../../src/self-ops/invoker-outcome.js'
import {
  diagnoseRouterReadback,
  UNSUPPORTED_READBACK_REASONS,
} from '../../src/self-ops/unsupported-diagnosis.js'

// Isolated attribution battery for the `unsupported` fold of the trusted
// Router-readback classification (self-ops diagnosis neighborhood).
//
// Scope guards baked into every section:
// - the public self_ops.status projection and its closed routerDisposition
//   enum are exercised through the REAL consumer chain and must stay
//   byte-compatible with CTR-V3-STATUS-001 (no new fields, no new values);
// - the diagnostic helper is internal, pure and synchronous — a thenable
//   provider return is a contract violation and is NEVER awaited;
// - nothing in this file performs a settlement, dispatch or store write:
//   byte-identity of the store plus mutation/audit counters are asserted.

const AGENT = 'agt_self'
const FOREIGN = 'agt_foreign_secret'

// ---- pure-classification fixtures (real classifyRouter / helper) ----------

const REC = {
  jobId: 'job-own',
  occurrenceId: 'occ:diag_secret_1',
  runId: 'run:occ:diag_secret_1',
  requestId: 'req_diag_secret_1',
}

function ownedSnapshot(overrides = {}) {
  return {
    agentId: AGENT,
    callerCorrelation: {
      occurrenceId: REC.occurrenceId,
      runId: REC.runId,
      requestId: REC.requestId,
    },
    ...overrides,
  }
}

function settledTerminated(overrides = {}, resultOverrides = {}) {
  return {
    state: 'settled',
    handle: 'turn:opaque:SECRET_HANDLE',
    snapshot: ownedSnapshot({
      lateOutcome: 'terminated_without_outcome',
      terminationEvidence: 'child_real_exit',
      ...overrides,
    }),
    ...resultOverrides,
  }
}

// Every structurally DISTINCT no-proof shape that classifyRouter folds into
// the `unsupported` disposition today. `bare` marks the folds that return
// the exact literal {disposition:'unsupported'}; the outcome-vocabulary
// misses return disposition:'unsupported' but still carry the raw snapshot
// and handle INTERNALLY (the public status() consumer reads only
// .disposition, so the public row is equally bare for every entry). Each
// entry names the missing evidence layer so the attribution expectations
// below stay auditable.
function foldFixtures() {
  const never = new Promise(() => {})
  return new Map(Object.entries({
    null_return: [null, ['providerReturnObject'], true],
    number_return: [42, ['providerReturnObject'], true],
    string_return: ['boom', ['providerReturnObject'], true],
    thenable_return: [never, ['synchronousProviderReturn'], true],
    state_missing_fetch_failed: [{ error: 'TRANSPORT fetch failed' }, ['closedUnionState'], true],
    state_not_string: [{ state: 7 }, ['closedUnionState'], true],
    state_running: [{ state: 'running' }, ['trustedSettlement'], true],
    state_unknown: [{ state: 'unknown' }, ['trustedSettlement'], true],
    settled_no_snapshot: [{ state: 'settled' }, ['readbackSnapshot'], true],
    terminated_no_handle: [
      settledTerminated({}, { handle: undefined }),
      ['opaqueHandle'], true,
    ],
    terminated_empty_handle: [
      settledTerminated({}, { handle: '' }),
      ['opaqueHandle'], true,
    ],
    terminated_untrusted_evidence: [
      settledTerminated({ terminationEvidence: 'model_claimed_done' }),
      ['trustedTerminationEvidence'], true,
    ],
    outcome_unknown_vocabulary: [
      { state: 'settled', handle: 'turn:opaque:x', snapshot: ownedSnapshot({ outcome: 'mystery' }) },
      ['recognizedClosedOutcome'], false,
    ],
    outcome_absent: [
      { state: 'settled', handle: 'turn:opaque:x', snapshot: ownedSnapshot() },
      ['recognizedClosedOutcome'], false,
    ],
  }))
}

test('RED characterization: classifyRouter folds structurally distinct no-proof returns into the same public unsupported', () => {
  for (const [name, [result, , bare]] of foldFixtures()) {
    const classified = classifyRouter(result, REC, AGENT)
    assert.equal(classified.disposition, 'unsupported', name)
    if (bare) {
      assert.deepEqual(classified, { disposition: 'unsupported' }, name)
    } else {
      // Outcome-vocabulary miss: still disposition:'unsupported', but the
      // internal return additionally carries the raw readback fields — the
      // helper must never forward those.
      assert.ok(classified.snapshot, name)
      assert.ok(classified.handle, name)
    }
    // The PUBLIC consumer chain sees the identical bare row either way
    // (status() reads only classified.disposition) — asserted by the
    // consumer-chain tests below.
  }
})

test('helper attributes each distinct fold point with a stable closed reason', () => {
  for (const [name, [result, missing]] of foldFixtures()) {
    const diagnosis = diagnoseRouterReadback(result, REC, AGENT)
    assert.equal(diagnosis.disposition, 'unsupported', name)
    assert.equal(diagnosis.foldedUnsupported, true, name)
    assert.notEqual(diagnosis.reason, null, name)
    assert.ok(UNSUPPORTED_READBACK_REASONS.has(diagnosis.reason), `${name}: ${diagnosis.reason}`)
    assert.deepEqual(diagnosis.missingEvidence, missing, name)
    assert.equal(typeof diagnosis.nextLegalAction, 'string', name)
    assert.ok(diagnosis.nextLegalAction.length > 0, name)
  }
})

test('helper reason is exact per fold family, not just non-null', () => {
  const expected = {
    null_return: 'EMPTY_OR_NON_OBJECT_RETURN',
    number_return: 'EMPTY_OR_NON_OBJECT_RETURN',
    string_return: 'EMPTY_OR_NON_OBJECT_RETURN',
    thenable_return: 'UNEXPECTED_THENABLE',
    state_missing_fetch_failed: 'PROVIDER_CONTRACT_MISMATCH',
    state_not_string: 'PROVIDER_CONTRACT_MISMATCH',
    state_running: 'NOT_SETTLED',
    state_unknown: 'NOT_SETTLED',
    settled_no_snapshot: 'MISSING_SNAPSHOT',
    terminated_no_handle: 'MISSING_HANDLE',
    terminated_empty_handle: 'MISSING_HANDLE',
    terminated_untrusted_evidence: 'UNTRUSTED_TERMINATION_KIND',
    outcome_unknown_vocabulary: 'UNKNOWN_OUTCOME',
    outcome_absent: 'UNKNOWN_OUTCOME',
  }
  for (const [name, reason] of Object.entries(expected)) {
    const [result] = foldFixtures().get(name)
    assert.equal(diagnoseRouterReadback(result, REC, AGENT).reason, reason, name)
  }
})

test('helper mirror agrees with the real classifyRouter verdict on every fixture', () => {
  for (const [result] of foldFixtures()) {
    assert.equal(
      diagnoseRouterReadback(result, REC, AGENT).disposition,
      classifyRouter(result, REC, AGENT).disposition,
    )
  }
})

test('helper is idempotent on identical inputs', () => {
  for (const [result] of foldFixtures()) {
    const first = diagnoseRouterReadback(result, REC, AGENT)
    const second = diagnoseRouterReadback(result, REC, AGENT)
    assert.deepEqual(first, second)
  }
})

test('helper output carries no payload: ids, handles, snapshots and foreign identities never leak', () => {
  const secrets = [
    REC.occurrenceId, REC.runId, REC.requestId,
    'turn:opaque:SECRET_HANDLE', 'agt_foreign_secret',
    'model_claimed_done',
  ]
  const samples = [
    ...[...foldFixtures().values()].map(([result]) => result),
    settledTerminated(),
    { state: 'settled', handle: 'turn:opaque:SECRET_HANDLE', snapshot: ownedSnapshot({ agentId: FOREIGN, outcome: 'late_completed' }) },
  ]
  for (const result of samples) {
    const rendered = JSON.stringify(diagnoseRouterReadback(result, REC, AGENT))
    for (const secret of secrets) {
      assert.ok(!rendered.includes(secret), `leak of ${secret}`)
    }
  }
})

test('supported dispositions pass through with accurate semantics and no fold', () => {
  const cases = [
    [{ state: 'pending' }, 'pending'],
    [{ state: 'restart_lost' }, 'restart_lost'],
    [{ state: 'evicted' }, 'evicted'],
    [{ state: 'never_existed' }, 'never_existed'],
    [{ state: 'conflict' }, 'conflict'],
    [{
      state: 'settled',
      handle: 'turn:opaque:SECRET_HANDLE',
      snapshot: ownedSnapshot({ lateOutcome: 'terminated_without_outcome', terminationEvidence: 'cancellation_ack' }),
    }, 'terminated_without_outcome'],
    [{ state: 'settled', snapshot: ownedSnapshot({ outcome: 'late_completed' }) }, 'late_completed'],
    [{ state: 'settled', snapshot: ownedSnapshot({ outcome: 'late_failed' }) }, 'late_failed'],
  ]
  for (const [result, disposition] of cases) {
    const diagnosis = diagnoseRouterReadback(result, REC, AGENT)
    assert.equal(diagnosis.disposition, disposition, disposition)
    assert.equal(diagnosis.foldedUnsupported, false, disposition)
    assert.equal(diagnosis.reason, null, disposition)
    assert.deepEqual(diagnosis.missingEvidence, [], disposition)
    assert.equal(classifyRouter(result, REC, AGENT).disposition, disposition, disposition)
  }
})

test('mismatch is split internally: owner mismatch vs wrong exact triple, both opaque', () => {
  const ownerMismatch = diagnoseRouterReadback(
    { state: 'settled', handle: 'h', snapshot: ownedSnapshot({ agentId: FOREIGN }) }, REC, AGENT,
  )
  assert.equal(classifyRouter({ state: 'settled', snapshot: ownedSnapshot({ agentId: FOREIGN }) }, REC, AGENT).disposition, 'mismatch')
  assert.equal(ownerMismatch.disposition, 'mismatch')
  assert.equal(ownerMismatch.reason, 'OWNER_MISMATCH')

  const tripleWrong = diagnoseRouterReadback(
    {
      state: 'settled', handle: 'h',
      snapshot: ownedSnapshot({ callerCorrelation: { occurrenceId: REC.occurrenceId, runId: REC.runId, requestId: 'req_other' } }),
    },
    REC, AGENT,
  )
  assert.equal(tripleWrong.disposition, 'mismatch')
  assert.equal(tripleWrong.reason, 'TRIPLE_MISSING_OR_WRONG')

  const tripleAbsent = diagnoseRouterReadback(
    { state: 'settled', handle: 'h', snapshot: ownedSnapshot({ callerCorrelation: undefined }) }, REC, AGENT,
  )
  assert.equal(tripleAbsent.reason, 'TRIPLE_MISSING_OR_WRONG')
  assert.ok(!JSON.stringify([ownerMismatch, tripleWrong, tripleAbsent]).includes(FOREIGN))
})

test('trusted termination and late business outcomes point at different legal authorities', () => {
  const termination = diagnoseRouterReadback(settledTerminated(), REC, AGENT)
  assert.equal(termination.disposition, 'terminated_without_outcome')
  assert.match(termination.nextLegalAction, /reconcile_turn/)
  assert.match(termination.nextLegalAction, /no write/)

  const lateCompleted = diagnoseRouterReadback(
    { state: 'settled', snapshot: ownedSnapshot({ outcome: 'late_completed' }) }, REC, AGENT,
  )
  assert.equal(lateCompleted.disposition, 'late_completed')
  assert.match(lateCompleted.nextLegalAction, /late-outcome authority/)
  assert.doesNotMatch(lateCompleted.nextLegalAction, /reconcile_turn/)

  const lateFailed = diagnoseRouterReadback(
    { state: 'settled', snapshot: ownedSnapshot({ outcome: 'late_failed' }) }, REC, AGENT,
  )
  assert.equal(lateFailed.disposition, 'late_failed')
  assert.match(lateFailed.nextLegalAction, /late-outcome authority/)
})

test('termination-evidence vocabularies agree across diagnosis and invoker-outcome authorities', () => {
  // If the trusted vocabulary ever drifts between the two modules, a fully
  // valid terminated_without_outcome readback would silently fold to
  // `unsupported` (or worse, pass with an untrusted kind) — pin the union.
  for (const kind of TRUSTED_TERMINATION_EVIDENCE) {
    const result = settledTerminated({ terminationEvidence: kind })
    assert.equal(classifyRouter(result, REC, AGENT).disposition, 'terminated_without_outcome', kind)
    const diagnosis = diagnoseRouterReadback(result, REC, AGENT)
    assert.equal(diagnosis.foldedUnsupported, false, kind)
    assert.equal(diagnosis.evidence.terminationEvidenceTrusted, true, kind)
  }
})

test('thenable provider return fails closed synchronously and is never awaited', async () => {
  let settled = false
  const lazy = new Promise((resolve) => { setTimeout(() => { settled = true; resolve({ state: 'settled' }) }, 5) })
  const started = Date.now()
  const diagnosis = diagnoseRouterReadback(lazy, REC, AGENT)
  assert.ok(Date.now() - started < 5, 'helper must not wait for the thenable')
  assert.equal(diagnosis.reason, 'UNEXPECTED_THENABLE')
  assert.equal(diagnosis.evidence.syncContractHeld, false)
  await lazy
  assert.ok(settled)
  // The late settlement value must NOT retroactively change the verdict.
  assert.equal(diagnoseRouterReadback(lazy, REC, AGENT).reason, 'UNEXPECTED_THENABLE')
})

// Real-store readback for an owned record: the provider envelope carries the
// record's own exact triple, as the production Router would.
function terminatedReadbackFor(record, overrides = {}) {
  return {
    state: 'settled',
    handle: `turn:opaque:${record.occurrenceId}`,
    snapshot: {
      agentId: AGENT,
      callerCorrelation: {
        occurrenceId: record.occurrenceId,
        runId: record.runId,
        requestId: record.requestId,
      },
      lateOutcome: 'terminated_without_outcome',
      terminationEvidence: 'child_real_exit',
      ...overrides,
    },
  }
}

// ---- real status consumer chain (store + provider doubles) ----------------

async function fixture(t, { occurrences: spec }) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scheduler-self-ops-unsupported-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const now = 1_800_000_000_000
  const store = new JobStore(path.join(dir, 'jobs.json'), { clock: () => now })
  const job = {
    id: 'job-own', name: 'owned', agentId: AGENT, enabled: true, scheduleRevision: 1,
    createdAtMs: now, updatedAtMs: now, revisionActivatedAtMs: now,
    schedule: { kind: 'every', everyMs: 60_000, anchorMs: now },
    payload: { kind: 'agentTurn', message: 'secret body' }, state: {},
  }
  const records = spec.map((entry, index) => {
    const admittedAt = now + index * 1000
    const record = buildOccurrenceRecord({
      job: entry.job ?? job, kind: 'natural', nominalScheduledAt: admittedAt, admittedAt,
    })
    applyTransition(record, { to: 'outcome_unknown', at: admittedAt + 10, reason: 'timeout' })
    entry.patch?.(record)
    return record
  })
  await store.mutateDoc((doc) => {
    doc.jobs = spec
      .map((entry) => entry.job ?? job)
      .filter((entry, index, all) => all.indexOf(entry) === index)
      .map((entry) => structuredClone(entry))
    doc.occurrences = structuredClone(records)
    doc.fences = rebuildFences(doc.occurrences)
  })
  const router = new Map()
  const access = createSelfOpsAccess({
    store,
    resolveCallerCorrelation: ({ occurrenceId }) => router.get(occurrenceId) ?? { state: 'never_existed' },
    runtimeStatus: () => ({ generationId: 'gen-opaque', health: 'healthy' }),
    clock: () => now + 10_000,
  })
  const counters = { mutations: 0, audits: 0 }
  const originalMutate = store.mutateDoc.bind(store)
  store.mutateDoc = async (...args) => {
    counters.mutations += 1
    return originalMutate(...args)
  }
  const originalAppend = store.appendRunEvent.bind(store)
  store.appendRunEvent = async (...args) => {
    counters.audits += 1
    return originalAppend(...args)
  }
  return {
    store, job, records, router, access, counters,
    jobsFile: path.join(dir, 'jobs.json'),
    runsFile: path.join(dir, 'runs.jsonl'),
  }
}

async function storeBytes(fx) {
  return {
    jobs: await readFile(fx.jobsFile),
    runs: await readFile(fx.runsFile).catch(() => null),
  }
}

const STATUS_KEYS = ['statusVersion', 'callerAgentId', 'runtime', 'scheduler']
const SCHEDULER_KEYS = [
  'ownedJobCount', 'activeFenceCount', 'unresolvedUnknownCount',
  'reconciliationCandidateCount', 'blockers', 'truncated',
]
const ROW_KEYS = [
  'jobId', 'occurrenceId', 'runId', 'businessState', 'fenceActive',
  'routerDisposition', 'selfReconcileEligible', 'blockerCode',
  'reconciliationState', 'reconciliationObservedAt',
]
const CLOSED_ROUTER_DISPOSITIONS = new Set([
  'terminated_without_outcome', 'pending', 'restart_lost', 'evicted', 'never_existed',
  'late_completed', 'late_failed', 'mismatch', 'conflict', 'unsupported',
])

test('status consumer chain: fetch-failed readback stays public-unsupported, helper attributes the fold, zero write', async (t) => {
  const fx = await fixture(t, { occurrences: [{}] })
  const record = fx.records[0]
  fx.router.set(record.occurrenceId, { error: 'TRANSPORT fetch failed' })

  const before = await storeBytes(fx)
  const result = await fx.access.status(AGENT)
  const diagnosis = diagnoseRouterReadback(fx.router.get(record.occurrenceId), record, AGENT)
  const after = await storeBytes(fx)

  // Public projection: unchanged bounded shape, closed enum, no new fields.
  assert.deepEqual(Object.keys(result), STATUS_KEYS)
  assert.deepEqual(Object.keys(result.scheduler), SCHEDULER_KEYS)
  assert.equal(result.statusVersion, 1)
  assert.equal(result.scheduler.unresolvedUnknownCount, 1)
  assert.equal(result.scheduler.blockers.length, 1)
  const row = result.scheduler.blockers[0]
  assert.deepEqual(Object.keys(row), ROW_KEYS)
  assert.equal(row.routerDisposition, 'unsupported')
  assert.equal(row.blockerCode, 'unsupported')
  assert.equal(row.selfReconcileEligible, false)
  assert.equal(row.fenceActive, true)
  assert.ok(CLOSED_ROUTER_DISPOSITIONS.has(row.routerDisposition))

  // Internal attribution for the same inputs.
  assert.equal(diagnosis.reason, 'PROVIDER_CONTRACT_MISMATCH')
  assert.deepEqual(diagnosis.missingEvidence, ['closedUnionState'])
  assert.equal(diagnosis.evidence.resultObject, true)
  assert.equal(diagnosis.evidence.settledStateClaimed, false)
  assert.match(diagnosis.nextLegalAction, /zero write/)

  // Zero write: store bytes identical, no mutation, no audit append, and no
  // settlement exists anywhere in the doc.
  assert.deepEqual(after, before)
  assert.equal(fx.counters.mutations, 0)
  assert.equal(fx.counters.audits, 0)
})

test('status chain: owned, foreign, legacy and retargeted stay isolated; mismatch attribution never bypasses opaque denial', async (t) => {
  const foreignJob = {
    id: 'job-foreign', name: 'foreign-secret', agentId: FOREIGN, enabled: true,
    scheduleRevision: 1, createdAtMs: 1_800_000_000_000, updatedAtMs: 1_800_000_000_000,
    revisionActivatedAtMs: 1_800_000_000_000,
    schedule: { kind: 'every', everyMs: 60_000, anchorMs: 1_800_000_000_000 },
    payload: { kind: 'agentTurn', message: 'foreign body' }, state: {},
  }
  const retargetedJob = {
    ...structuredClone(foreignJob), id: 'job-retargeted', name: 'retargeted', agentId: FOREIGN,
  }
  const fx = await fixture(t, {
    occurrences: [
      {},
      { job: foreignJob },
      // Legacy V2 shape: ownerAgentId/requestId must NOT be fabricated
      // (store fails loud on migrated V2 records carrying them).
      {
        patch: (record) => {
          record.recordSchemaVersion = 2
          delete record.ownerAgentId
          delete record.requestId
        },
      },
      { job: retargetedJob, patch: (record) => { record.ownerAgentId = AGENT } },
    ],
  })
  const [owned, foreign, legacy, retargeted] = fx.records
  fx.router.set(owned.occurrenceId, { state: 'running' })
  fx.router.set(foreign.occurrenceId, {
    state: 'settled', handle: 'h', snapshot: {
      agentId: FOREIGN,
      callerCorrelation: {
        occurrenceId: foreign.occurrenceId, runId: foreign.runId, requestId: foreign.requestId,
      },
      outcome: 'late_completed',
    },
  })

  const result = await fx.access.status(AGENT)
  const rowIds = result.scheduler.blockers.map((row) => row.occurrenceId)
  assert.deepEqual(rowIds.sort(), [owned.occurrenceId].sort())
  assert.equal(result.scheduler.unresolvedUnknownCount, 1)

  // The helper, fed the FOREIGN readback against the WRONG caller, lands in
  // the mismatch family without disclosing the foreign snapshot.
  const foreignDiagnosis = diagnoseRouterReadback(fx.router.get(foreign.occurrenceId), foreign, AGENT)
  assert.equal(foreignDiagnosis.disposition, 'mismatch')
  assert.equal(foreignDiagnosis.reason, 'OWNER_MISMATCH')
  assert.ok(!JSON.stringify(foreignDiagnosis).includes('late_completed'))
  assert.ok(!JSON.stringify(foreignDiagnosis).includes(FOREIGN))

  // Legacy (schema != 3) and retargeted records never reach the readback:
  // no legal producer surface exposes them, so the helper is never their
  // attribution path — asserted here by the projection's invisibility.
  assert.ok(!rowIds.includes(legacy.occurrenceId))
  assert.ok(!rowIds.includes(retargeted.occurrenceId))
})

test('multiple unknowns each keep their own verdict: one trusted termination never releases the unsupported sibling', async (t) => {
  const fx = await fixture(t, { occurrences: [{}, {}] })
  const [supported, unsupported] = fx.records
  fx.router.set(supported.occurrenceId, terminatedReadbackFor(supported))
  fx.router.set(unsupported.occurrenceId, { error: 'TRANSPORT fetch failed' })

  const before = await storeBytes(fx)
  const result = await fx.access.status(AGENT)
  assert.equal(result.scheduler.unresolvedUnknownCount, 2)
  const byOccurrence = new Map(result.scheduler.blockers.map((row) => [row.occurrenceId, row]))
  assert.equal(byOccurrence.get(supported.occurrenceId).routerDisposition, 'terminated_without_outcome')
  assert.equal(byOccurrence.get(supported.occurrenceId).selfReconcileEligible, true)
  assert.equal(byOccurrence.get(unsupported.occurrenceId).routerDisposition, 'unsupported')
  assert.equal(byOccurrence.get(unsupported.occurrenceId).selfReconcileEligible, false)
  // Fence scope is the Job: both unknowns are unresolved, so the fence stays.
  assert.equal(byOccurrence.get(unsupported.occurrenceId).fenceActive, true)

  // The unsupported sibling is refused by the REAL reconcile path — zero
  // write, settlement never minted. This round performs NO termination
  // write for the supported sibling either (diagnostic-only change).
  const refusal = await fx.access.reconcileTurn(AGENT, {
    jobId: unsupported.jobId,
    occurrenceId: unsupported.occurrenceId,
    runId: unsupported.runId,
  })
  assert.equal(refusal.ok, false)
  assert.equal(refusal.error.code, 'termination_not_proven')
  assert.deepEqual(await storeBytes(fx), before)
  assert.equal(fx.counters.mutations, 0)
  assert.equal(fx.counters.audits, 0)

  const doc = await fx.store.loadDoc({ force: true })
  const unsupportedRecord = doc.occurrences.find((entry) => entry.occurrenceId === unsupported.occurrenceId)
  assert.equal(unsupportedRecord.terminationSettlement, undefined)
  assert.equal(doc.fences[unsupported.jobId] !== undefined, true)
})

test('public Tools V4 snapshot: repeated status is deep-stable and row values stay closed-enum', async (t) => {
  const fx = await fixture(t, { occurrences: [{}, {}] })
  fx.router.set(fx.records[0].occurrenceId, { state: 'running' })
  fx.router.set(fx.records[1].occurrenceId, { state: 'settled' })

  const first = await fx.access.status(AGENT)
  const second = await fx.access.status(AGENT)
  assert.deepEqual(first, second)
  for (const row of first.scheduler.blockers) {
    assert.deepEqual(Object.keys(row), ROW_KEYS)
    assert.ok(CLOSED_ROUTER_DISPOSITIONS.has(row.routerDisposition))
    assert.equal(row.businessState, 'outcome_unknown')
  }
  // Helper over the same readbacks: closed internal reason enum, idempotent.
  for (const record of fx.records) {
    const diagnosis = diagnoseRouterReadback(fx.router.get(record.occurrenceId), record, AGENT)
    assert.ok(UNSUPPORTED_READBACK_REASONS.has(diagnosis.reason))
    assert.deepEqual(diagnosis, diagnoseRouterReadback(fx.router.get(record.occurrenceId), record, AGENT))
  }
})
