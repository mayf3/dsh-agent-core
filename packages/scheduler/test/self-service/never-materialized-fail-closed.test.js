/**
 * WORKFLOW_546_D2 — the "queued-but-never-materialized" shape stays FAIL-CLOSED.
 *
 * Incident shape (Product #546, 2026-10-21 21:02): the invoker seam recorded
 * exact start evidence but the dispatched turn never minted a Router turn
 * record, so the exact-triple readback is `never_existed` and the occurrence
 * stays outcome_unknown + fenced.
 *
 * Review-reconciliation r2 (PR #547 finding 2, 2026-10-22): the accepted
 * Scheduler contracts do NOT admit `never_existed` as termination proof —
 * SCHEDULER_TIMEOUT_OUTCOME_V3 C-040: "pending/restart_lost/evicted/
 * never_existed/mismatch/conflict/unsupported 均不是 proof"; SELF_SERVICE_V4
 * CTR-V3-RECON-002 maps it to `termination_not_proven`. The Router also
 * reports `never_existed` after capacity eviction removes a settled record's
 * correlation index, so the state cannot mechanically establish
 * "never materialized". An implementation that settles on it would widen
 * termination authority without an accepted Spec amendment — that behavior
 * was REMOVED from this candidate. These tests pin the fail-closed posture
 * the contracts require, INCLUDING the exact incident shape (start evidence
 * + elapsed accepted execution deadline), so the settlement cannot silently
 * return without its governing Spec amendment (INTERNAL_DEPENDENCY).
 *
 * The ACCEPTED termination evidence path (router-reported
 * terminated_without_outcome, e.g. child_real_exit) must keep settling —
 * pinned here too as the regression guard.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createRecordingDelivery } from '../../src/seams.js'
import { createSelfOpsAccess } from '../../src/self-ops/index.js'

const AGENT = 'agt_self'

function hangInvoker() {
  let resolvePending
  let pending
  const calls = []
  const invoker = async (request) => {
    calls.push(request)
    if (typeof request.onStart === 'function') request.onStart()
    pending = new Promise((resolve) => { resolvePending = resolve })
    pending.resolveForTest = (value) => resolvePending(value)
    return pending
  }
  invoker.assertRunnable = () => true
  invoker.calls = calls
  invoker.flushPending = (value = { status: 'outcome_unknown' }) => {
    try { pending?.resolveForTest(value) } catch { /* already settled */ }
  }
  return invoker
}

function env({ now = 1_800_000_000_000, invoker } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-never-materialized-'))
  const clock = { value: now }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const resolvedInvoker = invoker ?? hangInvoker()
  const scheduler = new Scheduler({
    store,
    invoker: resolvedInvoker,
    deliver: createRecordingDelivery(),
    concurrency: 2,
    nowMs: () => clock.value,
    deadlineSetTimeout: (fn) => { queueMicrotask(fn); return 1 },
    deadlineClearTimeout: () => {},
    reconciliation: { resolveCallerCorrelation: (coords) => coords },
  })
  return { dir, clock, store, invoker: resolvedInvoker, scheduler }
}

async function runDue(ctx, dueAt) {
  ctx.clock.value = dueAt
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
}

/** Drive the REAL engine into the incident shape: start evidence + unknown. */
async function realNeverMaterialized(ctx, { everyMs = 60_000 } = {}) {
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
  assert.equal(typeof record.startedAt, 'number', 'the invoker seam recorded exact start evidence')
  assert.equal(typeof record.endedAt, 'number')
  return record
}

const neverExisted = () => ({ state: 'never_existed' })

/** Readback stub; `never_existed` by default, overridable per test. */
function readbackSays(record, result = neverExisted()) {
  return ({ occurrenceId }) => occurrenceId !== record.occurrenceId
    ? { state: 'never_existed' }
    : result
}

function selfOps(ctx, record, readback) {
  return createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: readback ?? readbackSays(record),
    runtimeStatus: () => ({ generationId: 'gen-opaque', health: 'healthy' }),
    clock: () => ctx.clock.value,
  })
}

const pastDeadline = (record) => record.executionDeadlineAtMs + 1_000

async function assertStillFencedAndUnwritten(ctx, record, historyLength) {
  const doc = await ctx.store.loadDoc({ force: true })
  const current = doc.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.equal(current.state, 'outcome_unknown', 'business state stays outcome_unknown')
  assert.equal(current.terminationSettlement, undefined, 'no termination settlement was written')
  assert.equal(current.lateSettlement, undefined, 'no business settlement was written')
  assert.equal(current.history.length, historyLength, 'zero history growth')
  assert.ok(doc.fences[record.jobId] !== undefined, 'the fence stays up')
  assert.equal(ctx.invoker.calls.length, 1, 'the turn is never re-invoked')
  assert.equal(ctx.scheduler.listOccurrences().length, 1, 'no parallel admission was created')
  return doc
}

test('D2 guard (C-040): the exact incident shape — start evidence + elapsed deadline + never_existed readback — stays termination_not_proven, zero-write, fenced', async () => {
  const ctx = env()
  const record = await realNeverMaterialized(ctx)
  const historyLength = record.history.length
  ctx.clock.value = pastDeadline(record)
  ctx.scheduler.reconciliationReadback = readbackSays(record)
  const access = selfOps(ctx, record)

  const status = await access.status(AGENT)
  const row = status.scheduler.blockers.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.ok(row, 'the never-materialized unknown is surfaced')
  assert.equal(row.routerDisposition, 'never_existed')
  assert.equal(row.selfReconcileEligible, false, 'never_existed is NOT reconcile-eligible')
  assert.equal(row.blockerCode, 'never_existed')

  const result = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(result.ok, false, 'the reconcile must refuse')
  assert.equal(result.error.code, 'termination_not_proven', 'CTR-V3-RECON-002: never_existed -> termination_not_proven')
  await assertStillFencedAndUnwritten(ctx, record, historyLength)

  // Idempotent refusal: a second attempt is the same structured refusal.
  const again = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(again.ok, false)
  assert.equal(again.error.code, 'termination_not_proven')
  await assertStillFencedAndUnwritten(ctx, record, historyLength)
  ctx.invoker.flushPending()
})

test('D2 guard: the engine readback consult never settles never_existed (settle-once, zero-write)', async () => {
  const ctx = env()
  const record = await realNeverMaterialized(ctx)
  const historyLength = record.history.length
  ctx.scheduler.reconciliationReadback = readbackSays(record)

  const settled = await ctx.scheduler._reconcileTrustedOutcomes({ nowMs: pastDeadline(record) })
  assert.deepEqual(settled, [], 'the engine consult is zero-write for never_existed')
  await assertStillFencedAndUnwritten(ctx, record, historyLength)

  const again = await ctx.scheduler._reconcileTrustedOutcomes({ nowMs: pastDeadline(record) + 60_000 })
  assert.deepEqual(again, [], 'still zero-write on the next consult')
  await assertStillFencedAndUnwritten(ctx, record, historyLength)
  ctx.invoker.flushPending()
})

test('D2 guard: retention-ambiguity dispositions (pending/evicted/restart_lost) stay UNKNOWN + fenced before and after the deadline', async () => {
  for (const [label, readbackResult] of [
    ['pending', { state: 'pending' }],
    ['evicted', { state: 'evicted' }],
    ['restart_lost', { state: 'restart_lost' }],
  ]) {
    const ctx = env()
    const record = await realNeverMaterialized(ctx)
    const historyLength = record.history.length
    const readback = readbackSays(record, readbackResult)
    ctx.scheduler.reconciliationReadback = readback

    const before = await ctx.scheduler._reconcileTrustedOutcomes({ nowMs: record.endedAt + 1_000 })
    assert.deepEqual(before, [], `engine consult zero-write for ${label} pre-deadline`)
    ctx.clock.value = pastDeadline(record)
    const access = selfOps(ctx, record, readback)
    const result = await access.reconcileTurn(AGENT, {
      jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
    })
    assert.equal(result.ok, false, `reconcile refuses ${label}`)
    assert.equal(result.error.code, 'termination_not_proven', `refusal code for ${label}`)
    const settled = await ctx.scheduler._reconcileTrustedOutcomes({ nowMs: pastDeadline(record) })
    assert.deepEqual(settled, [], `engine consult zero-write for ${label} post-deadline`)
    await assertStillFencedAndUnwritten(ctx, record, historyLength)
    ctx.invoker.flushPending()
  }
})

test('D2 guard regression: the ACCEPTED router-reported termination evidence (child_real_exit) still settles termination-only', async () => {
  const ctx = env()
  const record = await realNeverMaterialized(ctx)
  const historyBefore = JSON.stringify(record.history)
  const routerTerminated = ({ occurrenceId }) => occurrenceId !== record.occurrenceId
    ? { state: 'never_existed' }
    : {
      state: 'settled',
      handle: `turn:opaque:${record.occurrenceId}`,
      snapshot: {
        agentId: AGENT,
        callerCorrelation: { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId },
        lateOutcome: 'terminated_without_outcome',
        terminationEvidence: 'child_real_exit',
      },
    }
  ctx.clock.value = pastDeadline(record)
  const access = selfOps(ctx, record, routerTerminated)
  const first = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(first.ok, true)
  assert.equal(first.result.disposition, 'reconciled_terminated_without_outcome')
  assert.equal(first.result.businessState, 'outcome_unknown', 'business outcome stays unknown')
  assert.equal(first.result.fenceAfter, false, 'the settled fence is released')

  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.equal(settled.terminationSettlement.kind, 'terminated_without_outcome')
  assert.equal(settled.terminationSettlement.evidenceKind, 'child_real_exit')
  assert.equal(settled.lateSettlement, undefined)
  assert.deepEqual(doc.fences, {})
  assert.equal(settled.history.length, record.history.length + 1)
  assert.equal(JSON.stringify(settled.history.slice(0, record.history.length)), historyBefore,
    'original history preserved verbatim as a prefix')

  // C-045 replay: the second reconcile returns the same receipt zero-write.
  const replay = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(replay.ok, true)
  assert.equal(replay.result.disposition, 'reconciled_terminated_without_outcome')
  assert.equal(replay.result.operationId, first.result.operationId)
  const after = await ctx.store.loadDoc({ force: true })
  assert.equal(after.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId).history.length,
    settled.history.length, 'the replay added no history')
  ctx.invoker.flushPending()
})
