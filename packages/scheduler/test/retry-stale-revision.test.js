/**
 * @agent-core/scheduler — retry-minter cross-revision defect (stale-retry skip)
 *
 * Production incident (2026-09-17, job b115cb96): a failed occurrence at
 * scheduleRevision 1 + a later schedule edit (job -> revision 2) + retry
 * auto=true made retryCandidate propose a retry stamped with the job's
 * CURRENT revision while its predecessor held the OLD one. The store's
 * occurrence-authority invariant (failLoud, unchanged here) rejects exactly
 * that shape, so EVERY tick died inside reserve with
 * "invalid retry predecessor" — aborting admission for all later
 * candidates — while nothing was ever persisted (the store refused the
 * write; disk stayed clean). 753,986 consecutive failed ticks.
 *
 * Contract under test:
 *   - a retry candidate whose terminal predecessor carries a different
 *     scheduleRevision than the job is NOT mintable (staleRevision marker,
 *     exhausted=true so every existing non-mintable path stays closed);
 *   - the engine records a durable retry_superseded_by_revision run event
 *     and falls through to the natural schedule (the job's slots resume);
 *   - the store invariant itself is UNCHANGED (failLoud stays failLoud).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { Scheduler } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'
import { createFakeInvoker, createRecordingDelivery } from '../src/seams.js'
import { retryCandidate, computeNextRunAtMsV2 } from '../src/eligibility.js'

const sleep = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms))

function invoker(handler) {
  const calls = []
  const invokeAgent = async (request) => {
    calls.push(request)
    return handler(request, calls.length)
  }
  invokeAgent.calls = calls
  invokeAgent.assertRunnable = () => true
  return invokeAgent
}

function env({ now = 1_000, invoke } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-retry-stale-'))
  const clock = { value: now }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const scheduler = new Scheduler({
    store,
    invoker: invoke ?? invoker(() => ({ status: 'ok', summary: 'done' })),
    deliver: createRecordingDelivery(),
    concurrency: 5,
    nowMs: () => clock.value,
  })
  return { clock, store, scheduler }
}

async function runDue(ctx, dueAt) {
  ctx.clock.value = dueAt
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
}

function runLogEvents(store) {
  return readFileSync(store.runLogPath, 'utf8').trim().split('\n')
    .filter((line) => line.length > 0).map((line) => JSON.parse(line))
}

test('RED prod-shape: failed occurrence at rev1 + schedule edit to rev2 + retry.auto must NOT kill the tick', async () => {
  const invoke = invoker((request, count) => {
    if (count === 1) return { status: 'error', error: 'pre-start rejection', started: false }
    return { status: 'ok', summary: 'recovered' }
  })
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })

  // Poisoned job: fails on its first (rev 1) run — mirrors agt_hr-agent.
  const poisoned = await ctx.scheduler.createJob({
    name: 'poisoned', agentId: 'agent-a', enabled: true,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'p' }, retry: { auto: true },
  })
  // Healthy job created AFTER the poisoned one: its candidate sits behind
  // the poisoned candidate in the firing order (starvation witness).
  const healthy = await ctx.scheduler.createJob({
    name: 'healthy', agentId: 'agent-a', enabled: true,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'h' },
  })
  await runDue(ctx, 1_100)
  const [failedRecord] = ctx.scheduler.listOccurrences(poisoned.id)
  assert.equal(failedRecord.state, 'failed')
  assert.equal(failedRecord.scheduleRevision, 1)
  assert.equal(healthy.id !== poisoned.id, true)

  // Schedule edit bumps the job to revision 2; the failed predecessor
  // stays at revision 1 — exactly the production store shape.
  await ctx.scheduler.updateJob(poisoned.id, {
    schedule: { kind: 'every', everyMs: 200, anchorMs: 1_000 },
  })
  await ctx.scheduler.load()
  const [jobAfterEdit] = ctx.scheduler.doc.jobs.filter((j) => j.id === poisoned.id)
  assert.equal(jobAfterEdit.scheduleRevision, 2)

  // Past the recurring retry backoff (30s) and past natural rev-2 slots.
  await runDue(ctx, 62_000)

  const poisonedRows = ctx.scheduler.listOccurrences(poisoned.id)
  const healthyRows = ctx.scheduler.listOccurrences(healthy.id)
  assert.equal(ctx.scheduler.isFenced(poisoned.id), false)
  // The stale retry was never minted (no cross-revision retry record).
  assert.equal(poisonedRows.some((r) => r.kind === 'retry'), false)
  // The natural schedule resumed for the poisoned job (rev-2 slot minted).
  assert.equal(poisonedRows.some((r) => r.kind === 'natural' && r.scheduleRevision === 2), true)
  // The healthy job was not starved by the poisoned candidate.
  assert.equal(healthyRows.length >= 1, true)
  // Durable, explainable supersession event (MISSED_RUN_EXPLAINABLE).
  const superseded = runLogEvents(ctx.store)
    .filter((e) => e.action === 'retry_superseded_by_revision' && e.jobId === poisoned.id)
  assert.equal(superseded.length >= 1, true)
  assert.equal(superseded[0].predecessorScheduleRevision, 1)
  assert.equal(superseded[0].jobScheduleRevision, 2)
  assert.equal(superseded[0].retryOfOccurrenceId, failedRecord.occurrenceId)

  // The next tick stays healthy and mints nothing new for the poisoned job
  // (its rev-2 slot is covered; no duplicate, no crash).
  const before = ctx.scheduler.listOccurrences(poisoned.id).length
  await runDue(ctx, 62_500)
  assert.equal(ctx.scheduler.listOccurrences(poisoned.id).length, before)
  await sleep()
})

test('stale-retry receipt is deduped per engine session (no per-tick spam)', async () => {
  const invoke = invoker((request, count) => {
    if (count === 1) return { status: 'error', error: 'pre-start rejection', started: false }
    return { status: 'ok', summary: 'recovered' }
  })
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await ctx.scheduler.createJob({
    name: 'stale-at', agentId: 'agent-a', enabled: true,
    schedule: { kind: 'at', at: new Date(2_000).toISOString() },
    payload: { kind: 'agentTurn', message: 'p' }, retry: { auto: true },
  })
  await runDue(ctx, 2_000)
  assert.equal(ctx.scheduler.listOccurrences(job.id)[0].state, 'failed')
  // Edit moves the one-shot target into the future (revision bump): the
  // stale retry persists AND the natural slot is not due, so consecutive
  // ticks keep re-deriving the same stale candidate.
  await ctx.scheduler.updateJob(job.id, {
    schedule: { kind: 'at', at: new Date(600_000).toISOString() },
  })
  ctx.clock.value = 40_000
  await ctx.scheduler.tick()
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
  const events = runLogEvents(ctx.store)
    .filter((e) => e.action === 'retry_superseded_by_revision' && e.jobId === job.id)
  assert.equal(events.length, 1, 'exactly one supersession receipt per engine session')
  assert.equal(ctx.scheduler.listOccurrences(job.id).some((r) => r.kind === 'retry'), false)
})

test('unit: retryCandidate marks cross-revision predecessor stale (not mintable) and leaves same-revision untouched', () => {
  const baseJob = {
    id: 'job-1', enabled: true, scheduleRevision: 2,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    retry: { auto: true },
  }
  const failedAtRev1 = {
    occurrenceId: 'occ-old', jobId: 'job-1', kind: 'natural', state: 'failed',
    scheduleRevision: 1, admittedAt: 1_000, endedAt: 1_500,
  }
  const stale = retryCandidate({ job: baseJob, occurrences: [failedAtRev1], nowMs: 62_000 })
  assert.equal(stale.exhausted, true, 'stale candidate must be non-mintable on the existing flag')
  assert.equal(stale.staleRevision, true)
  assert.equal(stale.terminal.occurrenceId, 'occ-old')
  assert.equal(stale.due, undefined)
  assert.equal(stale.eligibleAtMs, undefined)

  const sameRevision = retryCandidate({
    job: { ...baseJob, scheduleRevision: 1 },
    occurrences: [{ ...failedAtRev1, scheduleRevision: 1 }],
    nowMs: 62_000,
  })
  assert.equal(sameRevision.exhausted, false)
  assert.equal(sameRevision.staleRevision, undefined)
  assert.equal(sameRevision.retryOfOccurrenceId, 'occ-old')
  assert.equal(sameRevision.due, true)

  // retry.auto absent -> unchanged: null (explicit opt-in policy intact).
  assert.equal(retryCandidate({
    job: { ...baseJob, retry: undefined }, occurrences: [failedAtRev1], nowMs: 62_000,
  }), null)
})

test('unit: computeNextRunAtMsV2 ignores a stale cross-revision retry (natural schedule owns the projection)', () => {
  const job = {
    id: 'job-1', enabled: true, scheduleRevision: 2, createdAtMs: 1_000,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    retry: { auto: true },
  }
  const occurrences = [{
    occurrenceId: 'occ-old', jobId: 'job-1', kind: 'natural', state: 'failed',
    scheduleRevision: 1, admittedAt: 1_000, endedAt: 1_500,
  }]
  const withStaleRetry = computeNextRunAtMsV2({ job, occurrences, nowMs: 62_000 })
  const withoutRetry = computeNextRunAtMsV2({
    job: { ...job, retry: { auto: false } }, occurrences, nowMs: 62_000,
  })
  assert.equal(withStaleRetry, withoutRetry)
})
