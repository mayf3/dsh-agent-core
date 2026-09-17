/**
 * SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 — self-healing regression battery.
 *
 * T1  CROSS_REVISION_AUTO_RETRY_POISON: a failed predecessor bound to an old
 *     scheduleRevision must NEVER mint an illegal retry (store invariant)
 *     nor abort the global tick — it expires stale with a durable,
 *     explainable disposition while the current revision's natural schedule
 *     continues. First counterexample: production occ:8ac05871 (HR job,
 *     predecessor rev1 failed, job updated to rev2, retry.auto=true,
 *     fleet-wide zero mint from 2026-09-13 07:47).
 * T2  ONE_BAD_JOB != GLOBAL_TICK_FAILURE: job-local admission failures are
 *     receipted and isolated; global-fatal failures stay fail-closed with a
 *     durable global-tick-blockade receipt (the Goal's GLOBAL_RUNTIME_BLOCKED
 *     marker; event action `global_tick_blocked`).
 * T3  job_disposition explains the stale-retry family from canonical state.
 * T4  diagnose -> self_ops.reconcile_turn -> receipt readback chain.
 * T5  insufficient evidence fails closed (zero write, HUMAN_REQUIRED).
 * T6  recovery replay: same coordinates -> byte-equivalent receipt, zero
 *     second write.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler, classifyAdmissionFailure } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createRecordingDelivery } from '../../src/seams.js'
import { applyTransition, buildOccurrenceRecord, deriveOccurrenceId, rebuildFences } from '../../src/occurrence-model.js'
import { createSelfOpsAccess } from '../../src/self-ops/index.js'

const sleep = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms))

function invoker(handler, assertRunnable = () => true) {
  const invokeAgent = async (request) => handler(request)
  invokeAgent.assertRunnable = assertRunnable
  return invokeAgent
}

function env({ now = 1_000, invoke, deliver } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-self-heal-'))
  const clock = { value: now }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const scheduler = new Scheduler({
    store,
    invoker: invoke,
    deliver: deliver ?? createRecordingDelivery(),
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
  const events = await ctx.store.readRunEvents({ limit: 1000 })
  return events.filter((event) => event.action === action)
}

function selfOps(ctx, router = () => ({ state: 'never_existed' })) {
  return createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: router,
    runtimeStatus: () => ({ generationId: 'gen-test', health: 'healthy' }),
    clock: () => ctx.clock.value,
  })
}

// ---------------------------------------------------------------------------
// T1 — CROSS_REVISION_AUTO_RETRY_POISON
// ---------------------------------------------------------------------------

test('T1 stale cross-revision auto-retry expires with durable disposition and never stops the tick', async (t) => {
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

  const jobA = await ctx.scheduler.createJob(everyJob({ name: 'poison-a', retry: { auto: true } }))
  const jobB = await ctx.scheduler.createJob(everyJob({ name: 'healthy-b', agentId: 'agent-b', payload: { kind: 'agentTurn', message: 'b' } }))

  // Revision 1: both run at slot 1100; A fails with proven terminal failure.
  await runDue(ctx, 1_100)
  const failed = ctx.scheduler.listOccurrences(jobA.id).find((r) => r.kind === 'natural')
  assert.equal(failed.state, 'failed')
  assert.equal(failed.scheduleRevision, 1)

  // Semantic update -> scheduleRevision 2 while the rev1 retry is pending.
  ctx.clock.value = 1_200
  await ctx.scheduler.updateJob(jobA.id, { payload: { kind: 'agentTurn', message: 'a-v2' } })

  // Past the 30s recurring retry backoff: the minter used to derive the retry
  // under the CURRENT revision (2) while the predecessor is revision 1 — the
  // store invariant rejected it, the tick aborted, and job B starved.
  await runDue(ctx, 40_000)

  const occurrencesA = ctx.scheduler.listOccurrences(jobA.id)
  const poisonId = deriveOccurrenceId({
    jobId: jobA.id, scheduleRevision: 2, kind: 'retry', retryOfOccurrenceId: failed.occurrenceId,
  })
  assert.equal(occurrencesA.some((r) => r.occurrenceId === poisonId), false, 'illegal cross-revision retry must never persist')
  assert.equal(occurrencesA.some((r) => r.kind === 'retry'), false, 'stale retry must not mint')
  assert.equal(occurrencesA.some((r) => r.scheduleRevision === 2 && r.kind === 'natural' && r.nominalScheduledAt === 40_000), true,
    'current revision natural schedule continues')
  assert.equal(ctx.scheduler.listOccurrences(jobB.id).length, 2, 'unrelated due job still mints')

  const staleEvents = await readEvidence(ctx, 'retry_superseded_by_revision')
  const event = staleEvents.find((e) => e.jobId === jobA.id)
  assert.notEqual(event, undefined, 'stale expiry must leave a durable disposition')
  assert.equal(event.retryOfOccurrenceId, failed.occurrenceId)
  assert.equal(event.predecessorScheduleRevision, 1)
  assert.equal(event.jobScheduleRevision, 2)

  // The natural continuation actually runs and settles.
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
  const rev2 = ctx.scheduler.listOccurrences(jobA.id).find((r) => r.scheduleRevision === 2)
  assert.equal(rev2.state, 'succeeded')
})

// ---------------------------------------------------------------------------
// T2 — ONE_BAD_JOB != GLOBAL_TICK_FAILURE
// ---------------------------------------------------------------------------

test('T2a an unrunnable agent is receipted and isolated; other due jobs still mint', async (t) => {
  const invoke = invoker(
    async () => ({ status: 'ok', summary: 'ok' }),
    (agentId) => {
      if (agentId === 'agent-a') throw new Error('agent router: not runnable')
      return true
    },
  )
  const ctx = env({ now: 1_000, invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const jobA = await ctx.scheduler.createJob(everyJob({ name: 'bad-agent' }))
  const jobB = await ctx.scheduler.createJob(everyJob({ name: 'good-b', agentId: 'agent-b' }))
  const jobC = await ctx.scheduler.createJob(everyJob({ name: 'good-c', agentId: 'agent-c' }))

  await runDue(ctx, 1_100)

  assert.deepEqual(ctx.scheduler.listOccurrences(jobA.id), [], 'job-local refusal must not admit')
  assert.equal(ctx.scheduler.listOccurrences(jobB.id).length, 1)
  assert.equal(ctx.scheduler.listOccurrences(jobC.id).length, 1)
  const receipts = await readEvidence(ctx, 'slot_accounting')
  const refused = receipts.find((e) => e.jobId === jobA.id)
  assert.notEqual(refused, undefined)
  assert.equal(refused.classification, 'ADMISSION_REJECTED')
  assert.match(refused.reason, /agent_not_runnable/)
})

test('T2b a job-local reserve throw is isolated: affected job receipted, remaining jobs mint, tick completes', async (t) => {
  const invoke = invoker(async () => ({ status: 'ok', summary: 'ok' }))
  const ctx = env({ now: 1_000, invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const jobA = await ctx.scheduler.createJob(everyJob({ name: 'throws-a' }))
  const jobB = await ctx.scheduler.createJob(everyJob({ name: 'good-b', agentId: 'agent-b' }))
  const jobC = await ctx.scheduler.createJob(everyJob({ name: 'good-c', agentId: 'agent-c' }))

  const originalReserve = ctx.scheduler._reserve.bind(ctx.scheduler)
  t.after(() => { ctx.scheduler._reserve = originalReserve })
  ctx.scheduler._reserve = async (candidate, onRejection) => {
    if (candidate.job.id === jobA.id) {
      // Job-local failure shape: this candidate's own coordinates collide.
      throw Object.assign(new Error('occurrence collision: id occ:deadbeef already bound to different logical coordinates'), {
        code: 'OCCURRENCE_STRUCTURED_COLLISION',
        existing: { jobId: jobA.id, scheduleRevision: 1, effectiveSlot: 1_100 },
        attempted: { jobId: jobA.id, scheduleRevision: 2, effectiveSlot: 1_100 },
      })
    }
    return originalReserve(candidate, onRejection)
  }

  await runDue(ctx, 1_100)

  assert.equal(ctx.scheduler.listOccurrences(jobB.id).length, 1, 'healthy job mints past a job-local failure')
  assert.equal(ctx.scheduler.listOccurrences(jobC.id).length, 1)
  const receipts = await readEvidence(ctx, 'slot_accounting')
  const interrupted = receipts.find((e) => e.jobId === jobA.id)
  assert.notEqual(interrupted, undefined)
  assert.equal(interrupted.classification, 'ADMISSION_INTERRUPTED')
})

test('T2c a global-fatal reserve failure stays fail-closed with a durable global_tick_blocked receipt', async (t) => {
  const invoke = invoker(async () => ({ status: 'ok', summary: 'ok' }))
  const ctx = env({ now: 1_000, invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const jobA = await ctx.scheduler.createJob(everyJob({ name: 'fatal-a' }))
  const jobB = await ctx.scheduler.createJob(everyJob({ name: 'good-b', agentId: 'agent-b' }))

  const originalReserve = ctx.scheduler._reserve.bind(ctx.scheduler)
  t.after(() => { ctx.scheduler._reserve = originalReserve })
  ctx.scheduler._reserve = async (candidate, onRejection) => {
    if (candidate.job.id === jobA.id) throw new Error('scheduler store: atomic write failed: EIO')
    return originalReserve(candidate, onRejection)
  }

  await assert.rejects(
    (async () => {
      ctx.clock.value = 1_100
      await ctx.scheduler.tick()
    })(),
    /EIO/,
    'unclassifiable store failures must keep failing loud',
  )
  await ctx.scheduler.whenIdle()
  const receipts = await readEvidence(ctx, 'slot_accounting')
  assert.equal(receipts.find((e) => e.jobId === jobB.id)?.classification, 'SKIPPED_POLICY')
  const blocked = await readEvidence(ctx, 'global_tick_blocked')
  assert.equal(blocked.length >= 1, true, 'global blockade must be durably receipted')
  assert.equal(ctx.scheduler.listOccurrences(jobA.id).length, 0)
})

// ---------------------------------------------------------------------------
// T2 classifier — admission-failure attribution (C-SH-002)
// ---------------------------------------------------------------------------

test('classifyAdmissionFailure binds the cross-revision poison to its own candidate and nothing else', () => {
  const job = { id: 'job-p', scheduleRevision: 2 }
  const retryOf = 'occ:1111111111111111'
  const candidate = { kind: 'retry', job, retryOfOccurrenceId: retryOf }
  const derivedPoisonId = deriveOccurrenceId({
    jobId: job.id, scheduleRevision: 2, kind: 'retry', retryOfOccurrenceId: retryOf,
  })
  const poison = (occId) => Object.assign(
    new Error(`scheduler store: occurrence authority corrupted: invalid retry predecessor for ${occId}`),
    { cause: new Error(`invalid retry predecessor for ${occId}`) },
  )
  assert.equal(classifyAdmissionFailure(poison(derivedPoisonId), candidate), 'job_local')
  assert.equal(classifyAdmissionFailure(poison(retryOf), candidate), 'job_local')
  // The same error naming a DIFFERENT occurrence is authority corruption — global.
  assert.equal(classifyAdmissionFailure(poison('occ:2222222222222222'), candidate), 'global')
  // A natural candidate can never own a retry-predecessor rejection.
  assert.equal(classifyAdmissionFailure(poison(derivedPoisonId), { kind: 'natural', job, nominalScheduledAt: 1 }), 'global')
  // Structured collisions are job-local only when they name this job.
  const collision = (jobId) => Object.assign(new Error('collision'), {
    code: 'OCCURRENCE_STRUCTURED_COLLISION',
    existing: { jobId, scheduleRevision: 1, effectiveSlot: 1 },
    attempted: { jobId, scheduleRevision: 2, effectiveSlot: 1 },
  })
  assert.equal(classifyAdmissionFailure(collision('job-p'), candidate), 'job_local')
  assert.equal(classifyAdmissionFailure(collision('job-other'), candidate), 'global')
  // Unclassified failures stay global (fail-closed preserved).
  assert.equal(classifyAdmissionFailure(new Error('scheduler store: atomic write failed: EIO'), candidate), 'global')
  assert.equal(classifyAdmissionFailure(new Error('anything'), candidate), 'global')
})

// ---------------------------------------------------------------------------
// T3 — job_disposition explains the stale-retry family
// ---------------------------------------------------------------------------

async function poisonedFixture(t) {
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
  const jobA = await ctx.scheduler.createJob(everyJob({ name: 'poison-a', retry: { auto: true } }))
  await runDue(ctx, 1_100)
  const failed = ctx.scheduler.listOccurrences(jobA.id).find((r) => r.kind === 'natural')
  ctx.clock.value = 1_200
  await ctx.scheduler.updateJob(jobA.id, { payload: { kind: 'agentTurn', message: 'a-v2' } })
  // Deterministic live-stale window: no tick since the revision bump, so the
  // rev1 failed predecessor is still the latest terminal and nothing new minted.
  ctx.clock.value = 1_500
  return { ctx, jobA, failed, access: selfOps(ctx) }
}

test('T3 job_disposition diagnoses the live stale cross-revision retry from canonical state', async (t) => {
  const { ctx, jobA, failed, access } = await poisonedFixture(t)
  const disposition = await access.jobDisposition('agent-a', { jobId: jobA.id, slot: 1_100 })
  assert.equal(disposition.scheduleRevision, 2)
  assert.equal(disposition.classification, 'STALE_RETRY_AFTER_SCHEDULE_REVISION')
  assert.equal(disposition.retryState.autoRetry, true)
  assert.equal(disposition.retryState.retryPredecessor, failed.occurrenceId)
  assert.equal(disposition.retryState.retryPredecessorRevision, 1)
  assert.equal(disposition.retryState.currentScheduleRevision, 2)
  assert.equal(disposition.recoveryEligibility, 'SELF_HEALED_NO_MUTATION_REQUIRED')
  assert.notEqual(disposition.lastProvenStage, undefined)
  assert.notEqual(disposition.firstMissingStage, undefined)
  assert.notEqual(disposition.durableReason, undefined)
  assert.match(disposition.recommendedSafeAction, /no mutation|none/i)
  assert.equal(disposition.globalSchedulerHealth, 'healthy')
  assert.equal(disposition.jobLocalHealth, 'stale_retry_isolated')
})

test('T3b job_disposition keeps the stale classification explainable after recovery', async (t) => {
  const { ctx, jobA, access } = await poisonedFixture(t)
  await runDue(ctx, 40_000)
  const disposition = await access.jobDisposition('agent-a', { jobId: jobA.id })
  assert.equal(disposition.classification, 'STALE_RETRY_AFTER_SCHEDULE_REVISION', 'historical stale must stay explainable')
  assert.equal(disposition.retryState.retryPredecessorRevision, 1)
  assert.equal(disposition.recoveryEligibility, 'NONE_REQUIRED')
})

// ---------------------------------------------------------------------------
// T4/T5/T6 — Feishu recovery chain (diagnose -> recover -> readback)
// ---------------------------------------------------------------------------

const AGENT = 'agt_self-heal'

async function unknownFixture(t, routerDisposition = 'terminated_without_outcome') {
  const dir = await mkdtempTmp()
  const now = 1_800_000_000_000
  const clock = { value: now }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const job = {
    id: 'job-own', name: 'owned', agentId: AGENT, enabled: true, scheduleRevision: 2,
    createdAtMs: now, updatedAtMs: now, revisionActivatedAtMs: now,
    schedule: { kind: 'every', everyMs: 60_000, anchorMs: now },
    payload: { kind: 'agentTurn', message: 'secret body' }, state: {},
    retry: { auto: true },
  }
  const admittedAt = now
  const record = buildOccurrenceRecord({ job, kind: 'natural', nominalScheduledAt: admittedAt, admittedAt })
  applyTransition(record, { to: 'outcome_unknown', at: admittedAt + 10, reason: 'timeout' })
  await store.mutateDoc((doc) => {
    doc.jobs = [structuredClone(job)]
    doc.occurrences = [structuredClone(record)]
    doc.fences = rebuildFences(doc.occurrences)
  })
  clock.value = now + 60_000
  const router = new Map([[record.occurrenceId, {
    state: 'settled',
    handle: `turn:opaque:${record.occurrenceId}`,
    snapshot: {
      agentId: AGENT,
      callerCorrelation: { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId },
      lateOutcome: routerDisposition,
      terminationEvidence: 'child_real_exit',
    },
  }]])
  const access = createSelfOpsAccess({
    store,
    resolveCallerCorrelation: ({ occurrenceId }) => router.get(occurrenceId) ?? { state: 'never_existed' },
    runtimeStatus: () => ({ generationId: 'gen-opaque', health: 'healthy' }),
    clock: () => clock.value,
  })
  t.after(() => rm(dir, { recursive: true, force: true }))
  return { store, job, record, access, clock }
}

async function mkdtempTmp() {
  return mkdtemp(join(tmpdir(), 'scheduler-self-heal-ops-'))
}

test('T4 diagnose -> reconcile_turn -> receipt readback through the formal tool surface', async (t) => {
  const { store, job, record, access } = await unknownFixture(t)

  const before = await access.jobDisposition(AGENT, { jobId: job.id })
  assert.equal(before.fenceStatus, true)
  assert.equal(before.recoveryEligibility, 'SELF_RECONCILE_AVAILABLE')
  assert.equal(before.jobLocalHealth, 'quarantined_unknown')

  const recovered = await access.reconcileTurn(AGENT, {
    jobId: job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(recovered.ok, true)
  assert.equal(recovered.result.disposition, 'reconciled_terminated_without_outcome')
  assert.equal(recovered.result.fenceBefore, true)
  assert.equal(recovered.result.fenceAfter, false)
  assert.notEqual(recovered.result.operationId, undefined)
  assert.notEqual(recovered.result.committedAt, undefined)

  const after = await access.jobDisposition(AGENT, { jobId: job.id })
  assert.equal(after.fenceStatus, false)
  assert.equal(after.recoveryEligibility, 'NONE_REQUIRED')
})

test('T5 insufficient evidence fails closed: denial, HUMAN_REQUIRED diagnosis, zero mutation', async (t) => {
  const { store, job, record, access } = await unknownFixture(t, 'pending')
  const file = store.filePath
  const beforeBytes = await readFile(file)

  const diagnosis = await access.jobDisposition(AGENT, { jobId: job.id })
  assert.equal(diagnosis.fenceStatus, true)
  assert.equal(diagnosis.recoveryEligibility, 'HUMAN_REQUIRED')

  const denied = await access.reconcileTurn(AGENT, {
    jobId: job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'termination_not_proven')

  const afterBytes = await readFile(file)
  assert.equal(afterBytes.equals(beforeBytes), true, 'denied recovery must be zero-write')
})

test('T6 recovery replay: same coordinates return the same receipt with zero second write', async (t) => {
  const { store, job, record, access } = await unknownFixture(t)
  const file = store.filePath

  const first = await access.reconcileTurn(AGENT, {
    jobId: job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(first.ok, true)
  const afterFirst = await readFile(file)

  const replay = await access.reconcileTurn(AGENT, {
    jobId: job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(replay.ok, true)
  assert.deepEqual(replay.result, first.result, 'replay must be byte-equivalent')

  const afterReplay = await readFile(file)
  assert.equal(afterReplay.equals(afterFirst), true, 'replay must not mutate the authority store')
})
