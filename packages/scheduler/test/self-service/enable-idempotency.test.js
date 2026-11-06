import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Scheduler } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createFakeInvoker } from '../../src/seams.js'
import { createOrReconcileJobOp } from '../../src/control.js'
import { deriveJobStateSummary, naturalCandidate } from '../../src/eligibility.js'

const every = { kind: 'every', everyMs: 60_000, anchorMs: 0 }
const definition = (extra = {}) => ({
  name: 'enable confirmation', agentId: 'agent-test', schedule: every,
  payload: { kind: 'agentTurn', message: 'isolated work' },
  delivery: { mode: 'none' }, deleteAfterRun: false, ...extra,
})

async function fixture(t, outcome) {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-638-'))
  const clock = { value: 1_000 }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const invoke = createFakeInvoker({ outcome })
  const scheduler = new Scheduler({ store, invoker: invoke, nowMs: () => clock.value })
  t.after(async () => {
    await scheduler.stop()
    await rm(dir, { recursive: true, force: true })
  })
  await scheduler.start({ autoStart: false, catchup: false })
  return { clock, store, invoke, scheduler }
}

async function tick(ctx, nowMs) {
  ctx.clock.value = nowMs
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
}

for (const schedule of [
  every,
  { kind: 'cron', expr: '* * * * *', tz: 'UTC' },
  { kind: 'at', at: new Date(120_000).toISOString() },
]) {
  test(`#638 scenario 1: repeated ${schedule.kind} enable preserves the due slot and admits it once`, async (t) => {
    const ctx = await fixture(t)
    const job = await ctx.scheduler.createJob(definition({ schedule }))
    const original = naturalCandidate({ job, occurrences: [], nowMs: 150_000 })
    assert.equal(original.due, true)
    assert.equal(original.nominal, 120_000)
    let seenNextRunAtMs = null
    for (const nowMs of [150_000, 155_000, 159_000]) {
      ctx.clock.value = nowMs
      const confirmed = await ctx.scheduler.enableJob(job.id)
      assert.equal(confirmed.enabled, true)
      assert.equal(confirmed.revisionActivatedAtMs, job.revisionActivatedAtMs)
      assert.equal(confirmed.scheduleRevision, job.scheduleRevision)
      assert.equal(confirmed.updatedAtMs, nowMs)
      assert.deepEqual(naturalCandidate({ job: confirmed, occurrences: [], nowMs }), original)
      // public shape hoists state: repeated enable must keep the projection stable
      if (seenNextRunAtMs === null) seenNextRunAtMs = confirmed.nextRunAtMs
      assert.equal(confirmed.nextRunAtMs, seenNextRunAtMs, 'repeated enable does not move the projection')
    }
    assert.equal(ctx.invoke.calls.length, 0, 'enable is control-only')
    await tick(ctx, 159_000)
    await tick(ctx, 159_000)
    const rows = ctx.scheduler.listOccurrences(job.id)
    assert.equal(ctx.invoke.calls.length, 1)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].nominalScheduledAt, original.nominal)
    assert.equal(rows[0].state, 'succeeded')
  })
}

test('#638 scenario 2: genuine resume refreshes activation and skips paused history', async (t) => {
  const ctx = await fixture(t)
  const job = await ctx.scheduler.createJob(definition())
  const stale = { kind: 'natural', job, nominalScheduledAt: 120_000 }
  ctx.clock.value = 61_000
  await ctx.scheduler.disableJob(job.id)
  ctx.clock.value = 150_000
  const resumed = await ctx.scheduler.enableJob(job.id)
  assert.equal(resumed.revisionActivatedAtMs, 150_000)
  assert.equal(resumed.updatedAtMs, 150_000)
  assert.equal(resumed.scheduleRevision, job.scheduleRevision)
  assert.deepEqual(naturalCandidate({ job: resumed, occurrences: [], nowMs: 150_000 }), {
    due: false, nominal: 120_000, reason: 'slot-before-activation',
  })
  assert.equal(await ctx.scheduler._reserve(stale), null, 'locked admission rejects the stale slot')
  await tick(ctx, 150_000)
  assert.equal(ctx.invoke.calls.length, 0)
  assert.equal(ctx.scheduler.listOccurrences(job.id).length, 0)
  ctx.clock.value = 170_000
  const confirmed = await ctx.scheduler.enableJob(job.id)
  assert.equal(confirmed.revisionActivatedAtMs, 150_000)
  await tick(ctx, 180_000)
  assert.equal(ctx.invoke.calls.length, 1)
  assert.deepEqual(ctx.scheduler.listOccurrences(job.id).map((row) => row.nominalScheduledAt), [180_000])
})

test('#638 scenario 3: confirmation, tick and restart preserve explicit pause and retirement', async (t) => {
  const ctx = await fixture(t)
  const pausedInput = definition({ logicalKey: 'owner:paused' })
  const { job: paused } = await createOrReconcileJobOp(ctx.store, pausedInput, { nowMs: 1_000 })
  await ctx.scheduler.disableJob(paused.id)
  const retired = await ctx.scheduler.createJob(definition({ name: 'retired' }))
  await ctx.scheduler.deleteJob(retired.id)
  const active = await ctx.scheduler.createJob(definition({ name: 'active confirmation' }))
  ctx.clock.value = 150_000
  await ctx.scheduler.enableJob(active.id)
  const reconciled = await createOrReconcileJobOp(ctx.store, pausedInput, { nowMs: 150_000 })
  assert.equal(reconciled.outcome, 'already_applied')
  assert.equal(reconciled.job.enabled, false, 'desired definition reconciliation does not resume a pause')
  await tick(ctx, 150_000)
  await ctx.scheduler.stop()
  ctx.clock.value = 210_000
  const restarted = new Scheduler({ store: ctx.store, invoker: ctx.invoke, nowMs: () => ctx.clock.value })
  await restarted.start({ autoStart: false, catchup: true })
  await restarted.whenIdle()
  ctx.clock.value = 210_000
  await restarted.tick()
  await restarted.whenIdle()
  const doc = await restarted.store.loadDoc({ force: true })
  assert.equal(doc.jobs.find((job) => job.id === paused.id).enabled, false)
  assert.equal(doc.jobs.some((job) => job.id === retired.id), false)
  assert.equal(doc.occurrences.some((row) => [paused.id, retired.id].includes(row.jobId)), false)
  assert.ok(doc.occurrences.every((row) => row.jobId === active.id))
})

test('#638 scenario 3: restore-gated job cannot be enabled or automatically restored', async (t) => {
  const ctx = await fixture(t)
  const job = await ctx.scheduler.createJob(definition({ enabled: false, migrationRestoreBlocked: true }))
  const before = await readFile(ctx.store.filePath, 'utf8')
  ctx.clock.value = 150_000
  await assert.rejects(() => ctx.scheduler.enableJob(job.id), { code: 'RESTORE_GATE_CLOSED' })
  assert.equal(await readFile(ctx.store.filePath, 'utf8'), before, 'rejected enable makes zero store writes')
  await tick(ctx, 150_000)
  await ctx.scheduler.stop()
  ctx.clock.value = 210_000
  const restarted = new Scheduler({ store: ctx.store, invoker: ctx.invoke, nowMs: () => ctx.clock.value })
  await restarted.start({ autoStart: false, catchup: true })
  await restarted.whenIdle()
  ctx.clock.value = 210_000
  await restarted.tick()
  await restarted.whenIdle()
  const doc = await restarted.store.loadDoc({ force: true })
  assert.equal(doc.jobs[0].enabled, false)
  assert.equal(doc.jobs[0].migrationRestoreBlocked, true)
  assert.equal(doc.occurrences.length, 0)
  assert.equal(ctx.invoke.calls.length, 0)
})

test('#638 protection: enabled confirmation preserves an unresolved unknown fence', async (t) => {
  const ctx = await fixture(t, { status: 'outcome_unknown' })
  const job = await ctx.scheduler.createJob(definition())
  await tick(ctx, 120_000)
  assert.equal(ctx.scheduler.isFenced(job.id), true)
  const before = await ctx.store.loadDoc({ force: true })
  for (const nowMs of [150_000, 155_000]) {
    ctx.clock.value = nowMs
    const confirmed = await ctx.scheduler.enableJob(job.id)
    assert.equal(confirmed.revisionActivatedAtMs, job.revisionActivatedAtMs)
    assert.equal(ctx.scheduler.isFenced(job.id), true)
  }
  await tick(ctx, 180_000)
  const after = await ctx.store.loadDoc({ force: true })
  assert.deepEqual(after.fences, before.fences)
  assert.deepEqual(after.occurrences, before.occurrences)
  assert.equal(ctx.invoke.calls.length, 1)
})

test('#638 boundary: a message revision still activates a new schedule revision', async (t) => {
  const ctx = await fixture(t)
  const job = await ctx.scheduler.createJob(definition())
  ctx.clock.value = 150_000
  const changed = await ctx.scheduler.updateJob(job.id, {
    payload: { kind: 'agentTurn', message: 'new intent' },
  })
  assert.equal(changed.scheduleRevision, job.scheduleRevision + 1)
  assert.equal(changed.revisionActivatedAtMs, 150_000)
  ctx.clock.value = 155_000
  const confirmed = await ctx.scheduler.enableJob(job.id)
  assert.equal(confirmed.scheduleRevision, changed.scheduleRevision)
  assert.equal(confirmed.revisionActivatedAtMs, 150_000)
  assert.equal(naturalCandidate({ job: confirmed, occurrences: [], nowMs: 155_000 }).due, false)
  await tick(ctx, 180_000)
  assert.equal(ctx.invoke.calls.length, 1)
  assert.equal(ctx.invoke.calls[0].message, 'new intent')
  assert.equal(ctx.scheduler.listOccurrences(job.id)[0].scheduleRevision, changed.scheduleRevision)
})
