/**
 * WORKFLOW_546_D2 — the "queued-but-never-materialized" settlement path.
 *
 * Incident shape (Product #546, 2026-10-21 21:02): the invoker seam recorded
 * exact start evidence (admitted -> running, "turn start evidence from
 * invoker seam") but the dispatched turn NEVER minted a Router turn record —
 * no session, no reconciliation record. The Router readback for the exact
 * (occurrenceId, runId, requestId) triple is `never_existed`, so neither the
 * engine readback consult nor self_ops.reconcile_turn had ANY accepted
 * settlement path: the occurrence stayed outcome_unknown + fenced forever
 * ("termination_not_proven"), and only an operator could unblock it.
 *
 * The fix: when — and only when — the system can MECHANICALLY prove
 *   (1) durable start evidence exists (startedAt set by the invoker seam),
 *   (2) the occurrence's accepted execution deadline has elapsed (no new
 *       timers/cadence — the already-accepted bounded condition), and
 *   (3) the exact-triple Router readback is `never_existed` (no turn record
 *       was ever minted in the store's durable history),
 * the EXISTING C-039 termination-only settlement commits with the new
 * trusted evidence kind `never_materialized`: business state stays
 * outcome_unknown (no fabricated business outcome), the fence is released,
 * and there is no automatic retry and no replay of the occurrence. Every
 * other readback state (pending/live, evicted, restart_lost, mismatch,
 * settled something else) keeps the fail-closed UNKNOWN + fence.
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
const ONE_HOUR = 3_600_000

function hangInvoker() {
  let resolvePending
  let pending
  let hang = true
  const calls = []
  const invoker = async (request) => {
    calls.push(request)
    if (typeof request.onStart === 'function') request.onStart()
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

/** A never-dispatched unknown: the invoker hangs WITHOUT start evidence. */
function hangInvokerWithoutStart() {
  const invoker = hangInvoker()
  const raw = invoker
  const wrapped = async (request) => {
    const patched = { ...request, onStart: undefined }
    return raw(patched)
  }
  wrapped.assertRunnable = raw.assertRunnable
  wrapped.calls = raw.calls
  wrapped.flushPending = raw.flushPending
  return wrapped
}

function env({ now = 1_800_000_000_000, invoker, reconciliation } = {}) {
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
    reconciliation,
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
async function realNeverMaterialized(ctx, { everyMs = 60_000, expectStartEvidence = true } = {}) {
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
  if (expectStartEvidence) {
    assert.equal(typeof record.startedAt, 'number', 'the invoker seam recorded exact start evidence')
  }
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
    clock: () => ctx.clock.value + 5_000,
  })
}

const pastDeadline = (record) => record.executionDeadlineAtMs + 1_000

test('D2 engine consult settles the never-materialized unknown termination-only after the accepted deadline', async () => {
  const ctx = env({ reconciliation: { resolveCallerCorrelation: (coords) => coords } })
  const record = await realNeverMaterialized(ctx)
  const readback = readbackSays(record)
  ctx.scheduler.reconciliationReadback = readback

  const settled = await ctx.scheduler._reconcileTrustedOutcomes({ nowMs: pastDeadline(record) })
  assert.equal(settled.length, 1, 'exactly one trusted termination settlement')
  assert.equal(settled[0].classification, 'TERMINATION_ONLY_SETTLED')

  const doc = await ctx.store.loadDoc({ force: true })
  const settledRecord = doc.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId)
  // The EXISTING C-039 termination-only settlement — no new settlement shape.
  assert.equal(settledRecord.state, 'outcome_unknown', 'business state stays outcome_unknown (no fabricated outcome)')
  assert.equal(settledRecord.terminationSettlement.kind, 'terminated_without_outcome')
  assert.equal(settledRecord.terminationSettlement.evidenceKind, 'never_materialized')
  assert.equal(settledRecord.terminationSettlement.businessStateAtCommit, 'outcome_unknown')
  assert.equal(settledRecord.terminationSettlement.actorKind, 'self-agent')
  assert.equal(settledRecord.terminationSettlement.actorId, AGENT)
  assert.equal(settledRecord.terminationSettlement.fenceBefore, true)
  assert.equal(settledRecord.terminationSettlement.fenceAfter, false)
  assert.deepEqual(doc.fences, {}, 'the fence is released through the existing rebuild')
  assert.equal(settledRecord.lateSettlement, undefined, 'no business late settlement was fabricated')

  // Durable structured evidence: the engine termination_settlement line.
  const events = await ctx.store.readRunEvents({ limit: null })
  const evidenceLine = events.filter((event) => event.action === 'termination_settlement'
    && event.occurrenceId === record.occurrenceId)
  assert.equal(evidenceLine.length, 1)
  assert.equal(evidenceLine[0].evidenceKind, 'never_materialized')
  assert.equal(evidenceLine[0].basis, 'engine-trusted-readback')
  assert.equal(evidenceLine[0].replayOccurrence, false)

  // Settle-once: a second consult is zero-write.
  const again = await ctx.scheduler._reconcileTrustedOutcomes({ nowMs: pastDeadline(record) + 60_000 })
  assert.deepEqual(again, [])
  ctx.invoker.flushPending()
})

test('D2 self_ops reconcile_turn commits reconciled_never_materialized on the incident shape', async () => {
  const ctx = env()
  const record = await realNeverMaterialized(ctx)
  const historyBefore = JSON.stringify(record.history)
  ctx.clock.value = pastDeadline(record)
  const access = selfOps(ctx, record)

  const status = await access.status(AGENT)
  const row = status.scheduler.blockers.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.ok(row, 'the never-materialized unknown is surfaced')
  assert.equal(row.selfReconcileEligible, true, 'the owning agent can discover the settlement path')
  assert.equal(row.blockerCode, 'never_materialized_reconcile_available')

  const result = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(result.ok, true, `never-materialized reconcile must commit: ${JSON.stringify(result.error ?? result)}`)
  assert.equal(result.result.disposition, 'reconciled_never_materialized')
  assert.equal(result.result.businessState, 'outcome_unknown', 'business outcome stays unknown')
  assert.equal(result.result.fenceAfter, false, 'the settled fence is released')
  assert.equal(result.result.evidenceKind, 'never_materialized')

  // Persisted readback through the real store (commit-time validation ran).
  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.equal(settled.state, 'outcome_unknown')
  assert.equal(settled.terminationSettlement.evidenceKind, 'never_materialized')
  assert.equal(settled.terminationSettlement.actorProvenance, 'trusted-parent-context')
  assert.equal(settled.lateSettlement, undefined)
  assert.deepEqual(doc.fences, {})
  // Original history preserved verbatim as a prefix; exactly one annotation.
  assert.equal(settled.history.length, record.history.length + 1)
  assert.equal(JSON.stringify(settled.history.slice(0, record.history.length)), historyBefore)
  const annotation = settled.history.at(-1)
  assert.equal(annotation.from, 'outcome_unknown')
  assert.equal(annotation.to, 'outcome_unknown')
  assert.equal(settled.endedAt, annotation.at, 'endedAt tracks the termination-only annotation')

  // C-045 replay: the second reconcile returns the same receipt zero-write.
  const replay = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(replay.ok, true)
  assert.equal(replay.result.disposition, 'reconciled_never_materialized')
  assert.equal(replay.result.operationId, result.result.operationId)
  const after = await ctx.store.loadDoc({ force: true })
  assert.equal(after.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId).history.length,
    settled.history.length, 'the replay added no history')
  ctx.invoker.flushPending()
})

test('D2 no replay and no parallel writer: the settlement never re-invokes or re-admits the old turn', async () => {
  const ctx = env()
  const record = await realNeverMaterialized(ctx)
  const readback = readbackSays(record)
  ctx.scheduler.reconciliationReadback = readback
  ctx.clock.value = pastDeadline(record)
  const access = selfOps(ctx, record, readback)
  await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })

  const invokerCallsAfterSettlement = ctx.invoker.calls.length
  const occurrencesAfterSettlement = ctx.scheduler.listOccurrences().length
  assert.equal(invokerCallsAfterSettlement, 1, 'the settled turn is never re-invoked')
  assert.equal(occurrencesAfterSettlement, 1, 'no parallel admission was created')

  // The natural schedule continues at the next future slot — and only there.
  const doc = await ctx.store.loadDoc({ force: true })
  const nextRunAtMs = doc.jobs[0].state.nextRunAtMs
  assert.ok(nextRunAtMs > ctx.clock.value, 'projection waits for a strictly-future slot')
  const everyMs = doc.jobs[0].schedule.everyMs
  await runDue(ctx, Math.max(nextRunAtMs, ctx.clock.value + everyMs) + 1_000)
  const occurrences = ctx.scheduler.listOccurrences()
  assert.equal(occurrences.length, 2, 'exactly one new admission — the settled occurrence is never replayed')
  const fresh = occurrences.find((entry) => entry.occurrenceId !== record.occurrenceId)
  assert.ok(fresh, 'the next natural slot was admitted fresh')
  assert.equal(ctx.invoker.calls.length, invokerCallsAfterSettlement + 1)
  ctx.invoker.flushPending()
})

test('D2 fail-closed: before the accepted deadline elapses nothing settles (bounded condition unmet)', async () => {
  const ctx = env()
  const record = await realNeverMaterialized(ctx)
  const readback = readbackSays(record)
  ctx.scheduler.reconciliationReadback = readback
  const access = selfOps(ctx, record, readback) // clock still BEFORE the deadline

  const settled = await ctx.scheduler._reconcileTrustedOutcomes({ nowMs: record.endedAt + 1_000 })
  assert.deepEqual(settled, [], 'the engine consult is zero-write before the deadline')

  const result = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'termination_not_proven', 'missing bounded condition stays fail-closed')

  const doc = await ctx.store.loadDoc({ force: true })
  const current = doc.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.equal(current.terminationSettlement, undefined)
  assert.notDeepEqual(doc.fences, {}, 'the fence stays up')
  ctx.invoker.flushPending()
})

test('D2 fail-closed: missing start evidence never settles (dispatch not proven)', async () => {
  const ctx = env({ invoker: hangInvokerWithoutStart() })
  const record = await realNeverMaterialized(ctx, { expectStartEvidence: false })
  assert.equal(record.startedAt, undefined, 'fixture: the invoker never reported dispatch')
  const readback = readbackSays(record)
  ctx.scheduler.reconciliationReadback = readback
  ctx.clock.value = pastDeadline(record)
  const access = selfOps(ctx, record, readback)

  const settled = await ctx.scheduler._reconcileTrustedOutcomes({ nowMs: pastDeadline(record) })
  assert.deepEqual(settled, [], 'no start evidence -> no never-materialized settlement')
  const result = await access.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'termination_not_proven')
  const doc = await ctx.store.loadDoc({ force: true })
  assert.notDeepEqual(doc.fences, {}, 'the fence stays up')
  ctx.invoker.flushPending()
})

test('D2 fail-closed: live / evicted / restart_lost / mismatched readbacks keep UNKNOWN + fence', async () => {
  for (const [label, readbackResult, expectedCode] of [
    ['pending', { state: 'pending' }, 'termination_not_proven'],
    ['evicted', { state: 'evicted' }, 'termination_not_proven'],
    ['restart_lost', { state: 'restart_lost' }, 'termination_not_proven'],
    ['mismatch', {
      state: 'settled',
      handle: 'turn:opaque:other',
      snapshot: {
        agentId: AGENT,
        callerCorrelation: { occurrenceId: 'other', runId: 'other', requestId: 'other' },
        lateOutcome: 'late_completed',
      },
    }, 'correlation_mismatch'],
  ]) {
    const ctx = env()
    const record = await realNeverMaterialized(ctx)
    const readback = readbackSays(record, readbackResult)
    ctx.scheduler.reconciliationReadback = readback
    ctx.clock.value = pastDeadline(record)
    const access = selfOps(ctx, record, readback)

    const settled = await ctx.scheduler._reconcileTrustedOutcomes({ nowMs: pastDeadline(record) })
    assert.deepEqual(settled, [], `engine consult zero-write for ${label}`)
    const result = await access.reconcileTurn(AGENT, {
      jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
    })
    assert.equal(result.ok, false, `reconcile refuses ${label}`)
    assert.equal(result.error.code, expectedCode, `refusal code for ${label}`)
    const doc = await ctx.store.loadDoc({ force: true })
    assert.notDeepEqual(doc.fences, {}, `the fence stays up for ${label}`)
    ctx.invoker.flushPending()
  }
})

test('D2 conflict: an existing trusted settlement is never overwritten by the never-materialized path', async () => {
  const ctx = env()
  const record = await realNeverMaterialized(ctx)
  // Settle first through the router-reported termination evidence path.
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

  // Now the readback claims never_existed: the committed settlement stands.
  const neverAfter = selfOps(ctx, record, readbackSays(record))
  const second = await neverAfter.reconcileTurn(AGENT, {
    jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(second.ok, true)
  assert.equal(second.result.disposition, 'reconciled_terminated_without_outcome', 'the first settlement replays')
  assert.equal(second.result.evidenceKind, 'child_real_exit')

  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.equal(settled.terminationSettlement.evidenceKind, 'child_real_exit', 'no overwrite')
  assert.equal(settled.history.length, record.history.length + 1, 'still exactly one annotation')
  ctx.invoker.flushPending()
})
