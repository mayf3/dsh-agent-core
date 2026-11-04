import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JobStore } from '../src/store.js'
import { buildOccurrenceRecord, applyTransition, rebuildFences } from '../src/occurrence-model.js'
import {
  evaluateAutoReconcileDecision, planAutoReconcilePass,
  autoReconcileOccurrences, createRouterRecoveryEvidenceLookup, AUTO_RECONCILE_DEFAULT_ACTOR_ID,
} from '../src/auto-reconcile.js'

const NOW = 10_000
const recurringJob = {
  id: 'job-rec', name: 'recurring fixture', agentId: 'agent-a', enabled: true,
  scheduleRevision: 1, revisionActivatedAtMs: 1_000, createdAtMs: 1_000, updatedAtMs: 1_000,
  schedule: { kind: 'every', everyMs: 60_000 },
  payload: { kind: 'agentTurn', message: 'work' }, delivery: { mode: 'none' },
  deleteAfterRun: false, state: {},
}
const atJob = { ...recurringJob, id: 'job-at', schedule: { kind: 'at', at: '2030-01-01T00:00:00.000Z' } }

function unknown(job = recurringJob, nominalScheduledAt = 2_000) {
  const record = buildOccurrenceRecord({ job, kind: 'natural', nominalScheduledAt, admittedAt: 3_000, timeoutMs: 60_000 })
  applyTransition(record, { to: 'outcome_unknown', at: 4_000, reason: 'unproven exit' })
  return record
}

function proof(record, status = 'terminated_without_outcome', kind = 'child_real_exit') {
  const handle = 'turn:current:a1:g2:s1'
  return {
    state: 'settled', handle, source: 'router-current-readback', trusted: true, currentEpoch: 'current', observedAt: NOW,
    snapshot: {
      handle, turnExecutionId: handle, runtimeEpoch: 'current', processGeneration: 2,
      agentId: record.ownerAgentId, state: 'settled',
      callerCorrelation: { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId ?? record.idempotencyKey },
      outcome: null, lateOutcome: status, settlementResult: status,
      outcomeEvidence: status === 'late_completed' ? 'exact_turn_end_success' : status === 'late_failed' ? 'exact_turn_end_failure' : null,
      terminationEvidence: kind,
    },
  }
}

async function fixture(records, jobs = [recurringJob]) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-527-d2-'))
  const store = new JobStore(join(dir, 'jobs.json'))
  await store.mutateDoc((doc) => {
    doc.jobs = structuredClone(jobs)
    doc.occurrences = structuredClone(records)
    doc.fences = rebuildFences(doc.occurrences)
  })
  return store
}
const bytes = (store) => ({ jobs: readFileSync(store.filePath, 'utf8'), runs: existsSync(store.runLogPath) ? readFileSync(store.runLogPath, 'utf8') : null })
async function consume(store, lookup, nowMs = NOW) {
  const doc = await store.loadDoc({ force: true })
  const plan = planAutoReconcilePass(doc, lookup, { nowMs })
  return autoReconcileOccurrences(store, { settlements: plan.targets, evidenceLookup: lookup, nowMs })
}

test('D2 three-state mapping: exact coherent success, failure, termination-only', () => {
  const record = unknown()
  for (const [status, expected] of [['late_completed', 'succeeded'], ['late_failed', 'failed'], ['terminated_without_outcome', 'terminated_without_outcome']]) {
    assert.equal(evaluateAutoReconcileDecision({ job: recurringJob, record, evidence: proof(record, status), nowMs: NOW }).decision, expected)
  }
  assert.equal(evaluateAutoReconcileDecision({ job: recurringJob, record, evidence: proof(record, 'terminated_without_outcome', 'exact_terminal_then_idle'), nowMs: NOW }).decision, 'terminated_without_outcome')
})

test('D2 missing, bare, pending, wrong identity/owner/epoch, stale, untrusted and conflicts plan zero', () => {
  const record = unknown()
  const negative = [null, undefined, {}, { terminationEvidence: 'child_real_exit' }, { outcomeEvidence: 'exact_turn_end_success' }]
  for (const state of ['pending', 'restart_lost', 'evicted', 'never_existed', 'conflict']) negative.push({ ...proof(record), state })
  for (const [path, bad] of [
    ['agentId', 'other'], ['runtimeEpoch', 'old'], ['processGeneration', 3], ['handle', 'turn:other:a1:g2:s1'],
    ['outcomeEvidence', 'some_label'], ['settlementResult', 'late_failed'],
  ]) {
    const evidence = proof(record)
    evidence.snapshot[path] = bad
    negative.push(evidence)
  }
  for (const key of ['occurrenceId', 'runId', 'requestId']) {
    const evidence = proof(record)
    evidence.snapshot.callerCorrelation[key] = 'wrong'
    negative.push(evidence)
  }
  negative.push({ ...proof(record), trusted: false }, { ...proof(record), observedAt: NOW - 300001 }, { ...proof(record), observedAt: NOW + 1 })
  const conflict = proof(record, 'late_completed')
  conflict.snapshot.outcome = 'failed'
  negative.push(conflict)
  const nakedTerminal = proof(record)
  nakedTerminal.snapshot.lateOutcome = null
  nakedTerminal.snapshot.settlementResult = null
  nakedTerminal.snapshot.terminationEvidence = 'exact_terminal_then_idle'
  negative.push(nakedTerminal)
  for (const evidence of negative) {
    assert.equal(planAutoReconcilePass({ jobs: [recurringJob], occurrences: [record] }, () => evidence, { nowMs: NOW }).targets.length, 0, JSON.stringify(evidence))
  }
  assert.equal(evaluateAutoReconcileDecision({ job: recurringJob, record: { ...record, ownerAgentId: 'other' }, evidence: proof(record), nowMs: NOW }).decision, null)
})

test('D2 UNKNOWN protection: all absent or invalid registry facts preserve authoritative bytes, no admission', async () => {
  const record = unknown()
  const store = await fixture([record])
  const before = bytes(store)
  let mutations = 0
  const mutate = store.mutateDoc.bind(store)
  store.mutateDoc = (...args) => { mutations += 1; return mutate(...args) }
  for (const evidence of [null, { state: 'never_existed' }, { ...proof(record), trusted: false }, { terminationEvidence: 'child_real_exit' }]) {
    await consume(store, () => evidence)
    assert.deepEqual(bytes(store), before)
  }
  assert.equal(mutations, 0)
  const doc = await store.loadDoc()
  assert.equal(doc.occurrences.length, 1)
  assert.equal(doc.occurrences[0].state, 'outcome_unknown')
  assert.ok(doc.fences[recurringJob.id])
})

test('D2 default OFF and one-shot HUMAN_REQUIRED stay zero-write', async () => {
  const record = unknown(atJob)
  const store = await fixture([record], [atJob])
  const before = bytes(store)
  assert.equal(planAutoReconcilePass({ jobs: [atJob], occurrences: [record] }).targets.length, 0)
  await consume(store, () => proof(record))
  assert.deepEqual(bytes(store), before)
  assert.equal(evaluateAutoReconcileDecision({ job: atJob, record, evidence: proof(record), nowMs: NOW }).reason, 'one_shot_at_human_required')
})

test('D2 termination-only preserves UNKNOWN and history, releases its contribution, machine receipt, idempotent', async () => {
  const record = unknown()
  const store = await fixture([record])
  const result = await consume(store, () => proof(record))
  assert.equal(result.results[0].resolvedTo, 'terminated_without_outcome')
  assert.equal(result.results[0].receipt, 'ok')
  assert.equal(result.identity.actorId, AUTO_RECONCILE_DEFAULT_ACTOR_ID)
  const after = await store.loadDoc({ force: true })
  const settled = after.occurrences[0]
  assert.equal(settled.state, 'outcome_unknown')
  assert.equal(settled.executionOutcome, undefined)
  assert.equal(settled.lateSettlement, undefined)
  assert.deepEqual(settled.history.slice(0, record.history.length), record.history)
  assert.equal(settled.terminationSettlement.kind, 'terminated_without_outcome')
  assert.equal(settled.terminationSettlement.actorKind, 'scheduler-policy')
  assert.equal(settled.terminationSettlement.actorId, AUTO_RECONCILE_DEFAULT_ACTOR_ID)
  assert.equal(after.fences[recurringJob.id], undefined)
  const stable = bytes(store)
  await consume(store, () => proof(record), NOW + 1)
  assert.deepEqual(bytes(store), stable)
  assert.equal(after.occurrences.length, 1, 'no retry or second admission')
  const audit = JSON.parse(stable.runs.trim().split('\n').at(-1))
  assert.equal(audit.action, 'termination_settlement')
  assert.equal(audit.evidenceRef, 'turn:current:a1:g2:s1')
})

for (const [status, terminal] of [['late_completed', 'succeeded'], ['late_failed', 'failed']]) {
  test(`D2 late ${terminal} after termination appends outcome without replay`, async () => {
    const record = unknown()
    const store = await fixture([record])
    await consume(store, () => proof(record))
    const prior = (await store.loadDoc({ force: true })).occurrences[0]
    await consume(store, () => proof(record, status), NOW + 1)
    const after = await store.loadDoc({ force: true })
    assert.equal(after.occurrences[0].state, terminal)
    assert.deepEqual(after.occurrences[0].terminationSettlement, prior.terminationSettlement)
    assert.deepEqual(after.occurrences[0].history.slice(0, prior.history.length), prior.history)
    assert.equal(after.occurrences[0].lateSettlement.resolvedTo, terminal)
    assert.equal(after.occurrences.length, 1)
    assert.equal(after.fences[recurringJob.id], undefined)
  })
}

test('D2 aggregate fence retains another unresolved UNKNOWN; no missed slots or retries synthesized', async () => {
  const first = unknown()
  const second = unknown(recurringJob, 2_001)
  const store = await fixture([first, second])
  await consume(store, (record) => record.occurrenceId === first.occurrenceId ? proof(first) : null)
  const after = await store.loadDoc({ force: true })
  assert.ok(after.fences[recurringJob.id])
  assert.equal(after.occurrences[0].terminationSettlement.fenceAfter, true)
  assert.deepEqual(after.occurrences[1], second)
  assert.equal(after.occurrences.length, 2)
})

test('D2 plan/commit evidence drift and malformed caller targets are atomic zero-write', async () => {
  const record = unknown()
  const store = await fixture([record])
  const before = bytes(store)
  const plan = planAutoReconcilePass(await store.loadDoc(), () => proof(record), { nowMs: NOW })
  const result = await autoReconcileOccurrences(store, { settlements: plan.targets, evidenceLookup: () => null, nowMs: NOW })
  assert.equal(result.results[0].outcome, 'skipped')
  assert.deepEqual(bytes(store), before)
  await autoReconcileOccurrences(store, {
    settlements: [{ occurrenceId: record.occurrenceId, runId: 'wrong', resolvedTo: 'succeeded' }],
    evidenceLookup: () => proof(record, 'late_completed'), nowMs: NOW,
  })
  assert.deepEqual(bytes(store), before)
  await assert.rejects(autoReconcileOccurrences(store, { settlements: plan.targets, actorId: 'human:501', evidenceLookup: () => proof(record), nowMs: NOW }), /machine identity/)
  assert.deepEqual(bytes(store), before)
})

test('D2 Router adapter reads exact triple and current epoch each time, never session-name inference', () => {
  const record = unknown()
  const seen = []
  const router = {
    resolveCallerCorrelation: (triple) => { seen.push(triple); return { state: 'never_existed' } },
    reconciliationRuntimeStatus: () => ({ generationId: 'new' }),
  }
  const lookup = createRouterRecoveryEvidenceLookup(router, () => NOW)
  assert.equal(lookup(record).currentEpoch, 'new')
  assert.deepEqual(seen, [{ occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.idempotencyKey }])
  assert.equal(createRouterRecoveryEvidenceLookup({}), null)
})

// Effect-free composition evidence: the actual Router registry supplies the
// exact query; the mounted pass writes only a disposable scheduler store.
import { TurnReconciliationStore } from '../../agent-router/src/reconciliation-store.js'
import { mountSchedulerAutoReconcileRuntime } from '../../production-runtime/src/scheduler/auto-reconcile-runtime.js'

test('D2 mounted pass: missing registry zero-write, real current Router exit settles once without retry', async (t) => {
  const record = unknown()
  const store = await fixture([record])
  const registry = new TurnReconciliationStore({ runtimeEpoch: 'current' })
  const router = {
    resolveCallerCorrelation: (triple) => registry.resolveCallerCorrelation(triple),
    reconciliationRuntimeStatus: () => ({ generationId: registry.runtimeEpoch }),
  }
  let time = NOW
  const errors = []
  const runtime = mountSchedulerAutoReconcileRuntime({
    layout: { jobsStore: store.filePath }, store, router, enabled: true, intervalMs: 60_000,
    clock: () => time++, log: { error: (message) => errors.push(message) },
  })
  t.after(() => runtime.stop())
  const before = bytes(store)
  await runtime.tick()
  assert.deepEqual(bytes(store), before)
  const handle = registry.mintTurnExecution({
    agentId: record.ownerAgentId, processGeneration: 2, sessionId: `cron-run-${record.occurrenceId}`,
    callerCorrelation: { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.idempotencyKey },
  })
  registry.markOutcomeUnknown(handle, { source: 'prompt_receipt_timeout', deadlineAtWallMs: NOW })
  registry.settleLate(handle, { lateOutcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit', exitObserved: true })
  await runtime.tick()
  assert.deepEqual(errors, [])
  const after = await store.loadDoc({ force: true })
  assert.equal(after.occurrences[0].state, 'outcome_unknown')
  assert.equal(after.occurrences[0].terminationSettlement.evidenceKind, 'child_real_exit')
  assert.equal(after.fences[recurringJob.id], undefined)
  assert.equal(after.occurrences.length, 1)
  const once = bytes(store)
  await runtime.tick()
  assert.deepEqual(bytes(store), once)
})

test('D2 mounted pass remains OFF without explicit enable and fails closed without Router seams', async () => {
  const previous = process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
  delete process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
  try {
    const disabled = mountSchedulerAutoReconcileRuntime({})
    assert.equal(disabled.enabled, false)
    disabled.stop()
  } finally {
    if (previous === undefined) delete process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
    else process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = previous
  }
  const enabled = mountSchedulerAutoReconcileRuntime({ enabled: true, layout: {}, router: {} })
  try { await enabled.tick() } finally { enabled.stop() }
})

test('D2 current Router readback rejects preserved old-epoch settlement and same-session wrong triple', () => {
  const record = unknown()
  const registry = new TurnReconciliationStore({ runtimeEpoch: 'old' })
  const handle = registry.mintTurnExecution({
    agentId: record.ownerAgentId, processGeneration: 2, sessionId: `cron-run-${record.occurrenceId}`,
    callerCorrelation: { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.idempotencyKey },
  })
  registry.markOutcomeUnknown(handle, { source: 'prompt_receipt_timeout', deadlineAtWallMs: NOW })
  registry.settleLate(handle, { lateOutcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit', exitObserved: true })
  const lookup = createRouterRecoveryEvidenceLookup({
    resolveCallerCorrelation: (triple) => registry.resolveCallerCorrelation(triple),
    reconciliationRuntimeStatus: () => ({ generationId: 'current' }),
  }, () => NOW)
  const doc = { jobs: [recurringJob], occurrences: [record] }
  assert.equal(planAutoReconcilePass(doc, lookup, { nowMs: NOW }).targets.length, 0)
  assert.equal(lookup({ ...record, runId: 'wrong' }).state, 'never_existed')
})


test('D2 late business outcome preserves the original aggregate-fence receipt snapshot', async () => {
  const first = unknown()
  const second = unknown(recurringJob, 2_001)
  const store = await fixture([first, second])
  await consume(store, (record) => record.occurrenceId === first.occurrenceId ? proof(first) : null)
  const originalReceipt = structuredClone((await store.loadDoc({ force: true })).occurrences[0].terminationSettlement)
  assert.equal(originalReceipt.fenceAfter, true)
  await consume(store, (record) => record.occurrenceId === second.occurrenceId ? proof(second) : null, NOW + 1)
  await consume(store, (record) => record.occurrenceId === first.occurrenceId ? proof(first, 'late_completed') : null, NOW + 2)
  const after = await store.loadDoc({ force: true })
  assert.deepEqual(after.occurrences[0].terminationSettlement, originalReceipt)
  assert.equal(after.occurrences[0].state, 'succeeded')
  assert.equal(after.fences[recurringJob.id], undefined)
})
