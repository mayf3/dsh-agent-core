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
import { retryCandidate } from '../../src/eligibility.js'

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
// F3 — diagnosis scans the full retained window (no count-based false negative)
// ---------------------------------------------------------------------------

test('F3 more than 500 later unrelated events cannot bury stale or global evidence', async (t) => {
  const { ctx, jobA, access } = await poisonedFixture(t)
  await runDue(ctx, 40_000) // durable retry_superseded_by_revision + rev2 natural recovery
  ctx.clock.value = 42_000
  await ctx.store.appendRunEvent({
    ts: 42_000, action: 'global_tick_blocked', reason: 'injected blockade', engineSessionId: 'sess-f3',
  })
  ctx.clock.value = 43_000
  for (let index = 0; index < 505; index += 1) {
    await ctx.store.appendRunEvent({
      ts: 43_000 + index, action: 'slot_accounting', jobId: 'job-noise', agentId: 'agent-noise',
      slot: 9_000_000_000_000 + index, classification: 'SKIPPED_POLICY', reason: 'noise',
    })
  }
  ctx.clock.value = 44_000

  const disposition = await access.jobDisposition('agent-a', { jobId: jobA.id })
  assert.equal(disposition.classification, 'STALE_RETRY_AFTER_SCHEDULE_REVISION',
    'historical stale must survive a >500-event tail of unrelated evidence')
  assert.equal(disposition.retryState.retryPredecessorRevision, 1)
  assert.equal(disposition.globalSchedulerHealth, 'degraded',
    'global_tick_blocked inside the health window must not be counted out of the tail')
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
