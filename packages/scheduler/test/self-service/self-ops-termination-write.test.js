import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createRecordingDelivery } from '../../src/seams.js'
import { createSelfOpsAccess } from '../../src/self-ops/index.js'
import { reconcileOccurrence } from '../../src/control.js'

// RED repro for the real write defect: the REAL engine writeback
// (writeOccurrenceOutcome) always sets `endedAt` when it classifies
// outcome_unknown, but the termination-only settlement writers append a
// same-state history annotation WITHOUT maintaining `endedAt` — so the
// commit-time validator (occurrence-model: "endedAt must match the final
// history transition") rejects the settlement for EVERY real unknown.
// The pre-existing self-ops-v3 fixture built unknowns without `endedAt`,
// which is why this never surfaced there. No fixture bypass: the unknown
// below is produced by the real Scheduler/JobStore engine paths.

const AGENT = 'agt_self'

function hangInvoker() {
  let resolvePending
  let pending
  let hang = true
  const calls = []
  const invoker = async (request) => {
    request.onStart()
    calls.push(request)
    if (!hang) return { status: 'ok', summary: 'post-recovery slot run' }
    pending = new Promise((resolve) => { resolvePending = resolve })
    pending.resolveForTest = (value) => resolvePending(value)
    return pending
  }
  invoker.assertRunnable = () => true
  invoker.calls = calls
  invoker.flushPending = (value = { status: 'outcome_unknown' }) => {
    hang = false
    try { pending?.resolveForTest(value) } catch { /* already settled */ }
  }
  return invoker
}

function env({ now = 1_800_000_000_000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-self-ops-real-'))
  const clock = { value: now }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const invoker = hangInvoker()
  const scheduler = new Scheduler({
    store,
    invoker,
    deliver: createRecordingDelivery(),
    concurrency: 2,
    nowMs: () => clock.value,
    deadlineSetTimeout: (fn) => { queueMicrotask(fn); return 1 },
    deadlineClearTimeout: () => {},
  })
  return { dir, clock, store, invoker, scheduler }
}

async function runDue(ctx, dueAt) {
  ctx.clock.value = dueAt
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
}

/** Drive the REAL engine into the real-shaped outcome_unknown (with endedAt). */
async function realUnknown(ctx, { everyMs = 60_000 } = {}) {
  // Real engine lifecycle: lease -> sweep -> admission, exactly like production.
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  await ctx.scheduler.createJob({
    name: 'recurring-owned',
    agentId: AGENT,
    schedule: { kind: 'every', everyMs, anchorMs: ctx.clock.value - 50_000 },
    payload: { kind: 'agentTurn', message: 'work' },
    delivery: { mode: 'none' },
  })
  await ctx.scheduler.load()
  await runDue(ctx, ctx.clock.value + 15_000)
  const record = ctx.scheduler.listOccurrences().at(-1)
  assert.equal(record.state, 'outcome_unknown')
  // The REAL writeback shape this goal must survive: endedAt present and
  // equal to the final history entry (unlike the legacy v3 fixture shape).
  assert.equal(typeof record.endedAt, 'number', 'real unknown carries endedAt')
  assert.equal(record.history.at(-1).at, record.endedAt, 'real unknown history ends at endedAt')
  return record
}

function routerSays(record, disposition = 'terminated_without_outcome') {
  return ({ occurrenceId }) => occurrenceId !== record.occurrenceId
    ? { state: 'never_existed' }
    : {
      state: 'settled',
      handle: `turn:opaque:${record.occurrenceId}`,
      snapshot: {
        agentId: AGENT,
        callerCorrelation: { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId },
        lateOutcome: disposition,
        terminationEvidence: 'child_real_exit',
      },
    }
}

function selfOps(ctx, record) {
  return createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: routerSays(record),
    runtimeStatus: () => ({ generationId: 'gen-opaque', health: 'healthy' }),
    clock: () => ctx.clock.value + 5_000,
  })
}

test('self-ops termination-only reconcile COMMITS on a real engine unknown (endedAt-bearing)', async () => {
  const ctx = env()
  const record = await realUnknown(ctx)
  const historyBefore = JSON.stringify(record.history)
  const access = selfOps(ctx, record)

  const status = await access.status(AGENT)
  assert.equal(status.scheduler.reconciliationCandidateCount, 1)
  assert.equal(status.scheduler.blockers[0].blockerCode, 'safe_reconcile_available')

  const result = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(result.ok, true, `safe reconcile must commit: ${JSON.stringify(result.error ?? result)}`)
  assert.equal(result.result.disposition, 'reconciled_terminated_without_outcome')
  assert.equal(result.result.businessState, 'outcome_unknown', 'business outcome stays unknown')
  assert.equal(result.result.fenceAfter, false, 'the settled fence is released')

  // Persisted readback through the real store (commit-time validation ran).
  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.equal(settled.state, 'outcome_unknown')
  assert.equal(settled.terminationSettlement.kind, 'terminated_without_outcome')
  assert.equal(settled.terminationSettlement.evidenceKind, 'child_real_exit')
  assert.deepEqual(doc.fences, {}, 'fence projection rebuilt without the settled unknown')
  // Original history preserved verbatim as a prefix; exactly one annotation appended.
  assert.equal(settled.history.length, record.history.length + 1)
  assert.equal(JSON.stringify(settled.history.slice(0, record.history.length)), historyBefore)
  const annotation = settled.history.at(-1)
  assert.equal(annotation.from, 'outcome_unknown')
  assert.equal(annotation.to, 'outcome_unknown')
  assert.equal(annotation.at, settled.terminationSettlement.settledAt)
  // The writer must maintain endedAt — this is the repaired invariant.
  assert.equal(settled.endedAt, annotation.at, 'endedAt tracks the termination-only annotation')
  assert.equal(settled.endedAt >= record.endedAt, true)
  ctx.invoker.flushPending()
})

test('operator termination-only reconcile COMMITS on a real engine unknown (endedAt-bearing)', async () => {
  const ctx = env()
  const record = await realUnknown(ctx)
  const historyBefore = JSON.stringify(record.history)

  const settledView = await reconcileOccurrence(ctx.store, {
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    resolvedTo: 'terminated_without_outcome',
    evidenceNote: 'operator trusted termination observation',
    nowMs: ctx.clock.value + 5_000,
  })
  assert.equal(settledView.record.state, 'outcome_unknown')
  assert.equal(settledView.record.terminationSettlement.actorKind, 'operator')
  assert.equal(settledView.fenceRemaining, false, 'the settled fence is released')

  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.equal(settled.history.length, record.history.length + 1)
  assert.equal(JSON.stringify(settled.history.slice(0, record.history.length)), historyBefore)
  assert.equal(settled.endedAt, settled.history.at(-1).at, 'endedAt tracks the operator annotation')
  assert.equal(settled.endedAt, settled.terminationSettlement.settledAt)
  ctx.invoker.flushPending()
})

test('next future natural slot runs normally after a real-shape termination settlement', async () => {
  const ctx = env()
  const record = await realUnknown(ctx)
  const access = selfOps(ctx, record)
  const result = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(result.ok, true)
  const settledAt = result.result.committedAt

  ctx.invoker.flushPending()
  // The invoker stops hanging: later turns succeed.
  const doc = await ctx.store.loadDoc({ force: true })
  const nextRunAtMs = doc.jobs[0].state.nextRunAtMs
  assert.ok(nextRunAtMs > settledAt, 'projection waits for a strictly-future slot')
  ctx.invoker.calls.length = 0
  // 'every' cadence: the first post-termination slot is eligible no earlier
  // than lastRun + everyMs (naturalCandidate every-terminal-hold).
  const everyMs = doc.jobs[0].schedule.everyMs
  await runDue(ctx, Math.max(nextRunAtMs, settledAt + everyMs) + 1_000)
  const occurrences = ctx.scheduler.listOccurrences()
  assert.equal(occurrences.length, 2, 'exactly one new admission — the settled occurrence is never replayed')
  const fresh = occurrences.find((entry) => entry.occurrenceId !== record.occurrenceId)
  assert.ok(fresh, 'a new occurrence was admitted for the future natural slot')
  assert.equal(fresh.state, 'succeeded', 'the post-recovery natural slot runs to success')
  assert.ok(fresh.nominalScheduledAt > settledAt)
  // The settled record is untouched by the later run.
  const settled = (await ctx.store.loadDoc({ force: true })).occurrences
    .find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.equal(settled.terminationSettlement.operationId, result.result.operationId)
  assert.equal(settled.history.length, record.history.length + 1)
})

test('unproven occurrences stay rejected: pending Router disposition never reconciles', async () => {
  const ctx = env()
  const record = await realUnknown(ctx)
  const before = JSON.stringify(await ctx.store.loadDoc({ force: true }))
  const access = createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: ({ occurrenceId }) => occurrenceId === record.occurrenceId
      ? { state: 'pending' }
      : { state: 'never_existed' },
    runtimeStatus: () => ({ generationId: 'gen-opaque', health: 'healthy' }),
    clock: () => ctx.clock.value + 5_000,
  })
  const status = await access.status(AGENT)
  assert.equal(status.scheduler.reconciliationCandidateCount, 0)
  assert.equal(status.scheduler.blockers[0].blockerCode, 'pending')
  const answer = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(answer.ok, false)
  assert.equal(answer.error.code, 'termination_not_proven')
  assert.equal(JSON.stringify(await ctx.store.loadDoc({ force: true })), before, 'byte-for-byte zero-write')
  ctx.invoker.flushPending()
})
