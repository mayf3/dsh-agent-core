/**
 * SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 — owner review findings battery (F1/F2/F4;
 * F3 lives in self-healing.test.js with its fixture). PR #305 merge gate;
 * companion to self-healing.test.js (T1-T6 + F3); same rigs, same fixtures style.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler, classifyAdmissionFailure } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createRecordingDelivery } from '../../src/seams.js'
import { applyTransition, buildOccurrenceRecord, deriveOccurrenceId } from '../../src/occurrence-model.js'
import { retryCandidate } from '../../src/eligibility.js'

function invoker(handler, assertRunnable = () => true) {
  const invokeAgent = async (request) => handler(request)
  invokeAgent.assertRunnable = assertRunnable
  return invokeAgent
}

function env({ now = 1_000, invoke } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-self-heal-'))
  const clock = { value: now }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const scheduler = new Scheduler({
    store,
    invoker: invoke,
    deliver: createRecordingDelivery(),
    nowMs: () => clock.value,
  })
  return { dir, clock, store, scheduler }
}

function everyJob(overrides = {}) {
  return {
    name: 'job', agentId: 'agent-a', enabled: true,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'work' },
    delivery: { mode: 'none' },
    ...overrides,
  }
}

async function runDue(ctx, dueAt) {
  ctx.clock.value = dueAt
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
}

async function readEvidence(ctx, action) {
  const events = await ctx.store.readRunEvents({ limit: null })
  return events.filter((event) => event.action === action)
}

// ---------------------------------------------------------------------------
// F1 — stale-revision verdict precedes one-shot exhaustion (review finding F1)
// ---------------------------------------------------------------------------

test('F1 exhausted one-shot chain on a superseded revision still earns the durable stale disposition', async (t) => {
  let calls = 0
  const invoke = invoker(async () => {
    calls += 1
    return calls === 1 ? { status: 'error', error: 'pre-start rejection', started: false } : { status: 'ok', summary: 'ok' }
  })
  const ctx = env({ now: 1_000, invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await ctx.scheduler.createJob({
    name: 'at-exhausted', agentId: 'agent-a', enabled: true,
    schedule: { kind: 'at', at: new Date(1_100).toISOString() },
    payload: { kind: 'agentTurn', message: 'v1' }, retry: { auto: true },
    delivery: { mode: 'none' },
  })
  await runDue(ctx, 1_100)
  const natural = ctx.scheduler.listOccurrences(job.id)[0]
  assert.equal(natural.state, 'failed')
  assert.equal(natural.scheduleRevision, 1)

  // Exhaust the one-shot retry chain with three failed rev1 retries; the LAST
  // member is the latest terminal and therefore the would-be retry's direct
  // predecessor.
  let lastChainMember = natural.occurrenceId
  await ctx.store.mutateDoc((doc) => {
    const rev1Job = doc.jobs.find((entry) => entry.id === job.id)
    let predecessor = natural.occurrenceId
    for (const backoff of [30_000, 60_000, 300_000]) {
      const record = buildOccurrenceRecord({ job: rev1Job, kind: 'retry', retryOfOccurrenceId: predecessor, admittedAt: natural.endedAt + backoff })
      applyTransition(record, {
        to: 'failed', at: record.admittedAt + 10, reason: 'chain member failed',
        executionOutcome: 'failed', endedAt: record.admittedAt + 10,
        terminalEvidence: { kind: 'turn-terminal', detailRef: 'chain failure' },
      })
      doc.occurrences.push(record)
      predecessor = record.occurrenceId
      lastChainMember = record.occurrenceId
    }
  })

  // Bump the revision; the whole chain is now superseded AND exhausted.
  ctx.clock.value = 400_000
  await ctx.scheduler.updateJob(job.id, { payload: { kind: 'agentTurn', message: 'v2' } })
  await ctx.scheduler.load()
  const jobAfter = ctx.scheduler.doc.jobs.find((entry) => entry.id === job.id)
  const verdict = retryCandidate({ job: jobAfter, occurrences: ctx.scheduler.listOccurrences(job.id), nowMs: 400_000 })
  assert.equal(verdict.staleRevision, true, 'revision mismatch must outrank exhaustion')
  assert.equal(verdict.exhausted, true)

  await runDue(ctx, 400_000)
  const superseded = (await readEvidence(ctx, 'retry_superseded_by_revision')).find((event) => event.jobId === job.id)
  assert.notEqual(superseded, undefined, 'the stale verdict must leave its durable disposition')
  assert.equal(superseded.retryOfOccurrenceId, lastChainMember,
    'the would-be retry\'s direct predecessor is the latest terminal (chain tail)')
  assert.equal(superseded.predecessorScheduleRevision, 1)
  assert.equal(superseded.jobScheduleRevision, 2)
  assert.equal(ctx.scheduler.listOccurrences(job.id).some((record) => record.kind === 'retry' && record.scheduleRevision === 2), false,
    'no retry may mint under the new revision')
  assert.equal(ctx.scheduler.listOccurrences(job.id).length, 4, 'one-shot natural semantics preserved: no replay of the past slot')
})

// ---------------------------------------------------------------------------
// F2 — retry candidates carry a durable admission-failure receipt coordinate
// ---------------------------------------------------------------------------

async function retryCandidateFixture(t) {
  let agentACalls = 0
  const invoke = invoker(async (request) => {
    if (request.agentId === 'agent-a') {
      agentACalls += 1
      if (agentACalls === 1) return { status: 'error', error: 'boom-v1', started: false }
      return { status: 'ok', summary: 'a-ok' }
    }
    return { status: 'ok', summary: 'b-ok' }
  })
  const ctx = env({ now: 1_000, invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const jobA = await ctx.scheduler.createJob(everyJob({ name: 'retry-a', retry: { auto: true } }))
  const jobB = await ctx.scheduler.createJob(everyJob({ name: 'retry-b', agentId: 'agent-b', payload: { kind: 'agentTurn', message: 'b' } }))
  await runDue(ctx, 1_100)
  const failed = ctx.scheduler.listOccurrences(jobA.id).find((record) => record.kind === 'natural')
  assert.equal(failed.state, 'failed')
  return { ctx, jobA, jobB, failed }
}

test('F2a a job-local retry admission failure is isolated and durably receipted on the retry coordinate', async (t) => {
  const { ctx, jobA, jobB, failed } = await retryCandidateFixture(t)
  const originalReserve = ctx.scheduler._reserve.bind(ctx.scheduler)
  t.after(() => { ctx.scheduler._reserve = originalReserve })
  ctx.scheduler._reserve = async (candidate, onRejection) => {
    if (candidate.kind === 'retry') {
      throw Object.assign(new Error('occurrence collision: candidate coordinates already bound'), {
        code: 'OCCURRENCE_STRUCTURED_COLLISION',
        existing: { jobId: candidate.job.id, scheduleRevision: 1, effectiveSlot: candidate.retryOfOccurrenceId },
        attempted: { jobId: candidate.job.id, scheduleRevision: 1, effectiveSlot: candidate.retryOfOccurrenceId },
      })
    }
    return originalReserve(candidate, onRejection)
  }

  await runDue(ctx, 40_000)

  assert.equal(ctx.scheduler.listOccurrences(jobA.id).some((record) => record.kind === 'retry'), false)
  assert.equal(ctx.scheduler.listOccurrences(jobB.id).length, 2, 'the tick continues past a job-local retry failure')
  const receipt = (await readEvidence(ctx, 'retry_admission_failure')).find((event) => event.jobId === jobA.id)
  assert.notEqual(receipt, undefined, 'the retry admission failure must leave a durable receipt (no fabricated slot)')
  assert.equal(receipt.classification, 'ADMISSION_INTERRUPTED')
  assert.equal(receipt.retryOfOccurrenceId, failed.occurrenceId)
  assert.equal(Number.isFinite(receipt.retryEligibleAtMs), true)
  assert.equal(receipt.occurrenceId, deriveOccurrenceId({
    jobId: jobA.id, scheduleRevision: 1, kind: 'retry', retryOfOccurrenceId: failed.occurrenceId,
  }))
})

test('F2b a global-fatal failure with a pending retry leaves the retry explainable too', async (t) => {
  const { ctx, jobA, jobB } = await retryCandidateFixture(t)
  const originalReserve = ctx.scheduler._reserve.bind(ctx.scheduler)
  t.after(() => { ctx.scheduler._reserve = originalReserve })
  ctx.scheduler._reserve = async (candidate, onRejection) => {
    if (candidate.kind === 'retry') throw new Error('scheduler store: atomic write failed: EIO')
    return originalReserve(candidate, onRejection)
  }

  ctx.clock.value = 40_000
  await assert.rejects(ctx.scheduler.tick(), /EIO/)
  await ctx.scheduler.whenIdle()

  const receipt = (await readEvidence(ctx, 'retry_admission_failure')).find((event) => event.jobId === jobA.id)
  assert.notEqual(receipt, undefined, 'the pending retry must have a fail-closed disposition')
  assert.equal(receipt.classification, 'ADMISSION_INTERRUPTED')
  assert.equal((await readEvidence(ctx, 'slot_accounting')).some((event) => event.jobId === jobB.id
    && event.classification === 'SKIPPED_POLICY'), true, 'the pending sibling is receipted as skipped')
  assert.notEqual((await readEvidence(ctx, 'global_tick_blocked'))[0], undefined)
})

test('F2c a refused retry candidate receipts ADMISSION_REJECTED on the retry coordinate', async (t) => {
  const { ctx, jobA, failed } = await retryCandidateFixture(t)
  const jobAfter = ctx.scheduler.doc.jobs.find((entry) => entry.id === jobA.id)
  await ctx.scheduler._admissionIsolation.recordRefusal(
    { kind: 'retry', job: jobAfter, retryOfOccurrenceId: failed.occurrenceId, retryEligibleAtMs: 31_000 },
    undefined, 'retry_not_eligible',
  )
  const receipt = (await readEvidence(ctx, 'retry_admission_failure')).find((event) => event.jobId === jobA.id)
  assert.notEqual(receipt, undefined)
  assert.equal(receipt.classification, 'ADMISSION_REJECTED')
  assert.equal(receipt.retryOfOccurrenceId, failed.occurrenceId)
})

// ---------------------------------------------------------------------------
// F4 — global blockade dedupe marks only on a successful append
// ---------------------------------------------------------------------------

test('F4 a failed global_tick_blocked append is retried on the next tick; success writes exactly once', async (t) => {
  const invoke = invoker(async () => ({ status: 'ok', summary: 'ok' }))
  const ctx = env({ now: 1_000, invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const jobA = await ctx.scheduler.createJob(everyJob({ name: 'fatal-a' }))
  const originalReserve = ctx.scheduler._reserve.bind(ctx.scheduler)
  t.after(() => { ctx.scheduler._reserve = originalReserve })
  ctx.scheduler._reserve = async (candidate, onRejection) => {
    if (candidate.job.id === jobA.id) throw new Error('scheduler store: atomic write failed: EIO')
    return originalReserve(candidate, onRejection)
  }
  const originalAppend = ctx.store.appendRunEvent.bind(ctx.store)
  t.after(() => { ctx.store.appendRunEvent = originalAppend })
  let blockadeWrites = 0
  ctx.store.appendRunEvent = async (event) => {
    if (event.action === 'global_tick_blocked' && blockadeWrites === 0) {
      blockadeWrites += 1
      return { ok: false, error: 'injected' }
    }
    return originalAppend(event)
  }

  ctx.clock.value = 1_100
  await assert.rejects(ctx.scheduler.tick(), /EIO/)
  assert.equal((await readEvidence(ctx, 'global_tick_blocked')).length, 0, 'failed append must not be marked as recorded')

  ctx.clock.value = 61_000
  await assert.rejects(ctx.scheduler.tick(), /EIO/)
  assert.equal((await readEvidence(ctx, 'global_tick_blocked')).length, 1, 'the next tick retries the append')

  ctx.clock.value = 121_000
  await assert.rejects(ctx.scheduler.tick(), /EIO/)
  assert.equal((await readEvidence(ctx, 'global_tick_blocked')).length, 1, 'successful dedupe holds afterwards')
})
