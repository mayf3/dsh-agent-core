import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'
import { createRecordingDelivery } from '../src/seams.js'
import { createSelfOpsAccess } from '../src/self-ops/index.js'

// SILENT_DUE_SLOT_LOSS_OR_UNACCOUNTED_MISSED_SLOT — real-engine red battery.
// Invariant under test: every ELAPSED scheduled slot of an enabled job must
// end in at least one durable accounting record — occurrence created |
// admission rejected + exact reason | explicitly skipped + exact reason |
// missed slot + recovery classification. Today the engine advances nextRun
// (pure schedule×wall-clock projection, C-030 cache) with ZERO accounting on
// every loss path below. NO_BLIND_RETRY / NO_FORCED_CATCHUP: these tests
// never demand a slot be REPLAYED — only that it be ACCOUNTED.

const MIN = 60_000

function env({ now = 1_800_000_000_000, assertRunnable } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-slot-loss-'))
  const clock = { value: now }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const calls = []
  const invoker = async (request) => {
    request.onStart()
    calls.push(request)
    return { status: 'ok', summary: 'ok' }
  }
  invoker.assertRunnable = assertRunnable ?? (() => true)
  invoker.calls = calls
  const scheduler = new Scheduler({
    store,
    invoker,
    deliver: createRecordingDelivery(),
    concurrency: 5,
    nowMs: () => clock.value,
  })
  return { dir, clock, store, invoker, scheduler }
}

const slotEvents = async (store, jobId) =>
  (await store.readRunEvents({ limit: 5_000 })).filter((event) =>
    event.action === 'slot_accounting' && (jobId === undefined || event.jobId === jobId))

async function addEveryJob(ctx, name, { everyMs = MIN, anchorOffsetMs = -50_000 } = {}) {
  return ctx.scheduler.createJob({
    name,
    agentId: `agt_${name}`,
    schedule: { kind: 'every', everyMs, anchorMs: ctx.clock.value + anchorOffsetMs },
    payload: { kind: 'agentTurn', message: `body ${name}` },
    delivery: { mode: 'none' },
  })
}

test('R1 MULTI-SLOT DOWNTIME: only the latest slot is caught up — older elapsed slots leave zero durable accounting', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEveryJob(ctx, 'r1', { everyMs: MIN, anchorOffsetMs: -50_000 })
  // Slot S0 (+10s) runs normally.
  ctx.clock.value += 15_000
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  const first = ctx.scheduler.listOccurrences(job.id)[0]
  assert.equal(first?.state, 'succeeded')

  // Engine DOWN across slots S1 (anchor+2*MIN) and S2 (anchor+3*MIN):
  // restart as a NEW engine process at +145s (start() is once-per-instance).
  await ctx.scheduler.stop()
  ctx.clock.value += 130_000
  const restarted = new Scheduler({
    store: ctx.store,
    invoker: ctx.invoker,
    deliver: createRecordingDelivery(),
    concurrency: 5,
    nowMs: () => ctx.clock.value,
  })
  await restarted.start({ autoStart: false, catchup: true })
  const occurrences = restarted.listOccurrences(job.id)
  assert.equal(occurrences.length, 2, 'native catch-up re-admits at most the latest slot')
  const missed = occurrences.find((entry) => entry.occurrenceId !== first.occurrenceId)
  assert.equal(missed.kind, 'catchup')

  // INVARIANT: slot S1 = anchor+2*everyMs elapsed while enabled and must be
  // durably accounted as a missed/unprocessed slot with an exact recovery
  // classification (the native catch-up only receipted S2 = anchor+3*everyMs).
  const anchor = job.schedule.anchorMs
  const s1Slot = anchor + 2 * MIN
  const accounting = await slotEvents(ctx.store, job.id)
  const s1 = accounting.find((event) => event.slot === s1Slot)
  assert.ok(s1, `R1 red: elapsed slot ${new Date(s1Slot).toISOString()} has NO durable accounting record`)
  assert.equal(s1.classification, 'MISSED_BEFORE_OCCURRENCE')
  assert.equal(s1.recoveryClassification, 'OWNER_POLICY_REQUIRED')
})

test('R2 LEASE LOSS: ticks return 0 silently — elapsed slots leave zero accounting and no engine-level evidence', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEveryJob(ctx, 'r2')
  // Lease reference lost (foreign supersede / handle drop): engine cannot verify.
  ctx.scheduler._engineLease = null
  const before = ctx.clock.value
  const fired = await ctx.scheduler.tick()
  assert.equal(fired, 0, 'lease-less tick must never admit')
  ctx.clock.value += 65_000
  await ctx.scheduler.tick()

  assert.equal(ctx.scheduler.listOccurrences(job.id).length, 0)
  const accounting = await slotEvents(ctx.store, job.id)
  assert.ok(accounting.length > 0, 'R2 red: slots elapsed with NO accounting while the engine could not tick')
  const leaseEvidence = (await ctx.store.readRunEvents({ limit: 5_000 }))
    .filter((event) => event.action === 'engine_lease_lost')
  assert.ok(leaseEvidence.length > 0, 'R2 red: no durable engine-level lease-loss evidence')
  assert.ok(ctx.clock.value - before >= MIN)
})

test('R3 SIBLING POISON: admission failure receipts the slot, skips remaining candidates with receipts, and stays fail-loud', async () => {
  const assertRunnable = (agentId) => {
    if (agentId === 'agt_r3a') throw Object.assign(new Error('disabled'), { code: 'AGENT_DISABLED' })
  }
  const ctx = env({ assertRunnable })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const jobA = await addEveryJob(ctx, 'r3a')
  const jobB = await addEveryJob(ctx, 'r3b')
  ctx.clock.value += 15_000
  // Accepted fail-closed semantics: the eligibility rejection PROPAGATES.
  await assert.rejects(() => ctx.scheduler.tick(), (error) => error.code === 'AGENT_DISABLED')
  await ctx.scheduler.whenIdle()

  // INVARIANT: nothing about either slot is silent — A's failed admission is
  // receipted as interrupted; B's unattempted slot is receipted as skipped.
  const aAccounting = await slotEvents(ctx.store, jobA.id)
  assert.ok(aAccounting.some((event) => event.classification === 'ADMISSION_INTERRUPTED'),
    'R3 red: job A admission interruption left zero durable accounting')
  assert.equal(ctx.invoker.calls.length, 0)
  const bAccounting = await slotEvents(ctx.store, jobB.id)
  assert.ok(bAccounting.some((event) => event.classification === 'SKIPPED_POLICY'
    && /aborted by an admission failure/.test(event.reason)),
    'R3 red: job B slot silently dropped by the aborted tick')
})

test('R4 POLICY SWALLOW: every-terminal-hold silently drops the held slot while nextRun advances past it', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEveryJob(ctx, 'r4', { everyMs: MIN, anchorOffsetMs: -50_000 })
  ctx.clock.value += 15_000
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  const first = ctx.scheduler.listOccurrences(job.id)[0]
  assert.equal(first.state, 'succeeded')
  // first.endedAt = T. The held slot is the anchor-grid slot inside the
  // every-terminal-hold window [T, T+everyMs): anchor + 2*MIN.
  const heldSlot = job.schedule.anchorMs + 2 * MIN
  ctx.clock.value = heldSlot + 1_000 // tick inside the hold window: heldSlot is the latest past slot
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  assert.equal(ctx.scheduler.listOccurrences(job.id).length, 1, 'hold window admits nothing (by design)')
  const accounting = await slotEvents(ctx.store, job.id)
  const held = accounting.find((event) => event.slot === heldSlot)
  assert.ok(held, `R4 red: held slot ${new Date(heldSlot).toISOString()} elapsed with zero accounting`)
  assert.equal(held.classification, 'SKIPPED_POLICY')
  assert.match(held.reason, /hold|terminal/)
  // nextRun projection advanced past the held slot with no receipt (the swallow).
  const state = (await ctx.store.loadDoc({ force: true })).jobs[0].state
  assert.ok(state.nextRunAtMs > heldSlot, 'precondition: nextRun advanced beyond the held slot')
  assert.ok(accounting.length > 0, 'R4 red: nextRun advanced while the slot carried zero accounting')
})

test('R5 RESERVE SILENT NULL: exact refusal reasons are threaded and durably receipted', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEveryJob(ctx, 'r5')
  ctx.clock.value += 15_000
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()

  // (a) The real reserve threads an exact machine-readable refusal reason.
  // The stale candidate carries the PRE-bump revision; the locked re-read in
  // reserve sees the bumped store and must refuse with the exact reason.
  const stale = { kind: 'natural', job: structuredClone(ctx.scheduler.doc.jobs[0]), nominalScheduledAt: ctx.clock.value }
  await ctx.store.mutateDoc((doc) => { doc.jobs[0].scheduleRevision += 1 })
  let rejection = null
  const reserved = await ctx.scheduler._reserve(stale, (reason) => { rejection = reason })
  assert.equal(reserved, null, 'precondition: stale candidate silently refused')
  assert.equal(rejection, 'schedule_revision_changed', 'reserve must expose the exact refusal reason')

  // (b) The tick wrapper durably receipts a captured refusal (admission is
  // never allowed to vanish without an accounting record).
  ctx.scheduler._reserve = async (candidate, onRejection) => {
    onRejection('schedule_revision_changed')
    return null
  }
  ctx.clock.value += MIN
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  const accounting = await slotEvents(ctx.store, job.id)
  const rejected = accounting.find((event) => event.classification === 'ADMISSION_REJECTED')
  assert.ok(rejected, 'R5 red: silent reserve refusal left zero durable accounting')
  assert.equal(rejected.reason, 'schedule_revision_changed')
})

test('R6 NEXT_RUN projection is wall-clock derived — advances with zero slot accounting (contract defect axis)', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEveryJob(ctx, 'r6')
  ctx.clock.value += 15_000
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  const first = ctx.scheduler.listOccurrences(job.id)[0]
  // Stop the engine entirely: no tick will ever observe the next slot.
  await ctx.scheduler.stop()
  ctx.clock.value += 125_000 // two slots elapse with no engine alive
  const state = (await ctx.store.loadDoc({ force: true })).jobs[0].state
  const events = await ctx.store.readRunEvents({ limit: 5_000 })
  const slotAccounting = events.filter((event) => event.action === 'slot_accounting')
  // The defect: the ONLY durable facts are the first run — the two elapsed
  // slots have no accounting, and nothing in the store distinguishes
  // "nextRun advanced" from "slots were accounted".
  assert.equal(slotAccounting.length, 0, 'R6 red: engine-down slots carried zero accounting')
  assert.ok(state.nextRunAtMs === undefined || state.nextRunAtMs < ctx.clock.value,
    'precondition shape: persisted nextRun is a stale projection; read-side recomputes from wall clock')
  assert.ok(first.occurrenceId)
})

test('A BASELINE (already correct): due slot normal execution leaves the occurrence as its accounting', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEveryJob(ctx, 'ok')
  ctx.clock.value += 15_000
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  const occurrences = ctx.scheduler.listOccurrences(job.id)
  assert.equal(occurrences.length, 1)
  assert.equal(occurrences[0].state, 'succeeded')
  const events = await ctx.store.readRunEvents({ limit: 5_000 })
  assert.ok(events.some((event) => event.action === 'occurrence_reserved'
    && event.occurrenceId === occurrences[0].occurrenceId), 'admitted slot is durably accounted by its occurrence')
})

test('E DISPOSITION QUERY: after nextRun advanced past the held slot, the owning Agent reads the exact skip disposition', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEveryJob(ctx, 'e1')
  ctx.clock.value += 15_000
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  const heldSlot = job.schedule.anchorMs + 2 * MIN
  ctx.clock.value = heldSlot + 60_000 // hold has cleared; nextRun advanced beyond the held slot
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()

  const access = createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    runtimeStatus: () => ({ generationId: 'gen', health: 'healthy' }),
    clock: () => ctx.clock.value,
  })
  const owner = `agt_${job.name}`
  // The held slot is no longer the LATEST past slot (the next slot ran) —
  // acceptance E: a previous slot stays queryable after nextRun advanced.
  const disposition = await access.jobDisposition(owner, { jobId: job.id, slot: heldSlot })
  assert.equal(disposition.jobId, job.id)
  assert.equal(disposition.expectedSlot, heldSlot)
  assert.equal(disposition.occurrenceId, 'NONE')
  assert.equal(disposition.fenceStatus, false)
  // The held slot was receipted at its tick; the query answers from the
  // durable record, not from runs=0.
  if (disposition.slotClassification === 'SKIPPED_POLICY') {
    assert.match(disposition.durableReason, /hold|terminal/)
    assert.equal(disposition.recommendedSafeAction, 'policy skip — no action; the next eligible slot proceeds normally')
  } else {
    assert.equal(disposition.slotClassification, 'MISSED_BEFORE_OCCURRENCE', disposition.durableReason)
  }
  assert.ok(disposition.nextRun > heldSlot, 'nextRun is returned with the disposition')
})

test('F OWNING-AGENT SURFACE: occurrence-accounted, missed-accounted, foreign-denied and NOT_PROVEN bounds', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEveryJob(ctx, 'f1')
  ctx.clock.value += 15_000
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  const ran = ctx.scheduler.listOccurrences(job.id)[0]
  const access = createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    runtimeStatus: () => ({ generationId: 'gen', health: 'healthy' }),
    clock: () => ctx.clock.value,
  })
  const owner = `agt_${job.name}`

  // (1) The ran slot answers with its occurrence — the "why" is the receipt.
  const ranQuery = await access.jobDisposition(owner, { jobId: job.id })
  // At this clock the latest past slot is the ran one (no further tick).
  assert.equal(ranQuery.slotClassification, 'OCCURRENCE_CREATED')
  assert.equal(ranQuery.occurrenceId, ran.occurrenceId)
  assert.equal(ranQuery.invocationStatus, 'succeeded')
  assert.match(ranQuery.recommendedSafeAction, /accounted by its occurrence/)

  // (2) Downtime-missed slot: restart across two slots, query the older one.
  await ctx.scheduler.stop()
  ctx.clock.value += 130_000
  const restarted = new Scheduler({
    store: ctx.store, invoker: ctx.invoker, deliver: createRecordingDelivery(),
    concurrency: 5, nowMs: () => ctx.clock.value,
  })
  await restarted.start({ autoStart: false, catchup: true })
  const missedSlot = job.schedule.anchorMs + 2 * MIN
  const access2 = createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    runtimeStatus: () => ({ generationId: 'gen', health: 'healthy' }),
    clock: () => ctx.clock.value,
  })
  const missedQuery = await access2.jobDisposition(owner, { jobId: job.id, slot: missedSlot })
  assert.equal(missedQuery.jobId, job.id)
  assert.equal(missedQuery.slotClassification, 'MISSED_BEFORE_OCCURRENCE')
  assert.equal(missedQuery.recoveryClassification, 'OWNER_POLICY_REQUIRED')
  assert.match(missedQuery.recommendedSafeAction, /NO_FORCED_CATCHUP/)

  // (3) Foreign job is opaque.
  const foreign = await access2.jobDisposition('agt_foreign', { jobId: job.id })
  assert.equal(foreign.error.code, 'not_found_or_not_owned')

  // (4) Legacy evidence gap: a slot with zero records answers NOT_PROVEN with
  // mechanical stage bounds — never a bare runs count.
  const legacyDir = mkdtempSync(join(tmpdir(), 'scheduler-slot-legacy-'))
  const legacyStore = new JobStore(join(legacyDir, 'jobs.json'), { clock: () => ctx.clock.value })
  const legacyScheduler = new Scheduler({
    store: legacyStore, invoker: ctx.invoker, deliver: createRecordingDelivery(),
    concurrency: 5, nowMs: () => ctx.clock.value,
  })
  await legacyScheduler.start({ autoStart: false, catchup: false })
  const legacyJob = await legacyScheduler.createJob({
    name: 'legacy', agentId: 'agt_legacy',
    schedule: { kind: 'every', everyMs: MIN, anchorMs: ctx.clock.value - 50_000 },
    payload: { kind: 'agentTurn', message: 'x' }, delivery: { mode: 'none' },
  })
  ctx.clock.value += 75_000 // slots elapse with NO engine ever ticking again
  const legacyAccess = createSelfOpsAccess({
    store: legacyStore,
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    runtimeStatus: () => ({ generationId: 'gen', health: 'healthy' }),
    clock: () => ctx.clock.value,
  })
  const legacyQuery = await legacyAccess.jobDisposition('agt_legacy', { jobId: legacyJob.id })
  assert.equal(legacyQuery.slotClassification, 'MISSED_BEFORE_OCCURRENCE')
  assert.equal(legacyQuery.rootCause, 'NOT_PROVEN')
  assert.equal(legacyQuery.lastProvenStage, 'SCHEDULE_CALCULATION')
  assert.equal(legacyQuery.firstMissingStage, 'TICK_OBSERVED')
  assert.ok('durableReason' in legacyQuery && 'recommendedSafeAction' in legacyQuery)
})
