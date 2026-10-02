/**
 * C11-R3 (Product #426) — restart convergence matrix, Scheduler side
 * (DONE_WHEN B5 route-1/2, Owner usability invariant, C9/C10; matrix rows
 * 3, 7, 9, 10).
 *
 *   row 3 — exact trusted late_completed/late_failed routes through the
 *           #417 semantics (V3 trusted-late-evidence late settlement).
 *   row 7 — two unresolved handles: only the eligible one converges; the
 *           other keeps its own fence and HUMAN_REQUIRED disposition.
 *   row 9 — a legal Router settlement AUTOMATICALLY leads to the Scheduler
 *           exact-occurrence settlement: fence contribution cleared, job
 *           projection + nextRunAtMs recomputed for future-natural-only,
 *           and an auditable receipt proving replayOccurrence=false +
 *           scheduleDisposition — with NO model prompt, no Owner chat, no
 *           run-now, no manual enable/disable.
 *   row 10 — Router availability and Scheduler recurring-job availability
 *           are reported separately; neither is inferred from the other.
 *
 * RED on current main: the row-9 auditable receipt fields
 * (replayOccurrence/scheduleDisposition/nextRunAtMsAfter) do not exist on
 * the settlement evidence lines yet; everything else pins existing
 * accepted-contract behavior. Test identity: agt_admin on isolated stores.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { Scheduler } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createRecordingDelivery } from '../../src/seams.js'
import { createSelfOpsAccess } from '../../src/self-ops/index.js'
import { buildOccurrenceRecord, applyTransition } from '../../src/occurrence-model.js'
import { rig, createArgs, occurrences } from '../self-service/harness.js'

const OWNER = 'agt_admin'
const EVERY_MS = 60_000

const readback = (snapshot, handle = 'router:readback:matrix') => (coords) => ({
  state: 'settled',
  handle,
  snapshot: { agentId: OWNER, callerCorrelation: coords, ...snapshot },
})

const CHILD_REAL_EXIT = { outcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit' }
const LATE_COMPLETED = { outcome: 'late_completed' }
const LATE_FAILED = { outcome: 'late_failed' }

/** Drive one real hung turn into a fenced outcome_unknown; declare the
 *  engine dead so a fresh engine can adopt the store (restart identity). */
async function seedFencedUnknown(t, { name = 'c11r3-matrix' } = {}) {
  let invocations = 0
  const ctx = await rig(t, {
    routerBehavior: () => {
      invocations += 1
      if (invocations === 1) return new Promise(() => {})
      return { reply: 'fresh-ok' }
    },
    immediateDeadline: true,
  })
  await ctx.scheduler.stop()
  const unrefDeadline = (fn) => { const id = setTimeout(fn, 0); id.unref?.(); return id }
  const s1 = new Scheduler({
    store: ctx.store,
    invoker: ctx.invoker,
    deliver: createRecordingDelivery(),
    concurrency: 2,
    nowMs: () => ctx.clock.value,
    deadlineSetTimeout: unrefDeadline,
    deadlineClearTimeout: clearTimeout,
  })
  await s1.start({ autoStart: false, catchup: false })
  const created = await ctx.call('create', createArgs({ name, schedule_kind: 'every', every_ms: EVERY_MS }))
  assert.equal(created.ok, true)
  const jobId = created.result.jobId
  ctx.clock.value += EVERY_MS + 1_000
  await s1.tick()
  await s1.whenIdle()
  const [stuck] = await occurrences(ctx)
  assert.equal(stuck.state, 'outcome_unknown', 'seed: honest unknown written')
  const deadChild = spawn('/usr/bin/true')
  await new Promise((resolve) => deadChild.on('exit', resolve))
  const lockOwner = JSON.parse(await readFile(ctx.store.engineLockPath, 'utf8'))
  await writeFile(ctx.store.engineLockPath, `${JSON.stringify({ ...lockOwner, pid: deadChild.pid })}\n`)
  return { ctx, jobId, stuck }
}

async function adoptEngine(ctx, resolveCallerCorrelation, { consultIntervalMs = 0 } = {}) {
  const store = new JobStore(join(ctx.dir, 'jobs.json'), { runLogPath: join(ctx.dir, 'runs.jsonl') })
  const scheduler = new Scheduler({
    store,
    invoker: ctx.invoker,
    deliver: createRecordingDelivery(),
    concurrency: 2,
    nowMs: () => ctx.clock.value,
    reconciliation: { resolveCallerCorrelation, consultIntervalMs },
  })
  await scheduler.start({ autoStart: false, catchup: false })
  return scheduler
}

const advance = async (engine, ms, clock) => {
  clock.value += ms
  await engine.tick()
  await engine.whenIdle()
}

test('row 9: Router legal termination settlement auto-leads the Scheduler exact-occurrence settlement with an auditable no-replay receipt', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t)
  const invocationsBefore = ctx.chainCalls.length

  const s2 = await adoptEngine(ctx, readback(CHILD_REAL_EXIT))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)

  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId)
  assert.equal(settled.state, 'outcome_unknown', 'the old business result stays UNKNOWN (C-039)')
  assert.equal(settled.terminationSettlement.scheduleDisposition, 'recurring_future_natural_only')
  assert.ok(doc.fences[jobId] === undefined, 'only that occurrence\'s fence contribution cleared')
  const job = doc.jobs.find((j) => j.id === jobId)
  assert.equal(job.enabled, true, 'NO manual enable/disable happened — the job simply resumes')
  assert.ok(job.state?.nextRunAtMs > ctx.clock.value, 'nextRunAtMs restored for the next NATURAL slot')

  // The auditable receipt: the settlement evidence line itself proves
  // replayOccurrence=false, the schedule disposition and the recomputed
  // future-natural next run. (RED on current main: the fields are absent.)
  const receipt = ctx.runsLog().find((e) => e.action === 'termination_settlement' && e.occurrenceId === stuck.occurrenceId)
  assert.ok(receipt, 'exactly the engine settlement emitted an evidence receipt')
  assert.equal(receipt.replayOccurrence, false)
  assert.equal(receipt.scheduleDisposition, 'recurring_future_natural_only')
  assert.equal(receipt.evidenceKind, 'child_real_exit')
  assert.equal(receipt.nextRunAtMsAfter, job.state.nextRunAtMs)

  // No model prompt / Owner chat / run-now: the settling engine never
  // invoked the agent for the stuck occurrence — the only agent traffic
  // belongs to fresh future slots admitted after the fence cleared.
  const stuckTraffic = ctx.chainCalls.slice(invocationsBefore)
    .filter((call) => String(call.sessionId).includes(stuck.occurrenceId))
  assert.equal(stuckTraffic.length, 0, 'the recovery was pure control-plane: no turn was sent to the model')
})

test('row 9: the exact business late settlement carries the same auditable no-replay receipt', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t, { name: 'c11r3-matrix-late' })
  const s2 = await adoptEngine(ctx, readback(LATE_COMPLETED))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)

  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId)
  assert.equal(settled.state, 'succeeded')
  assert.ok(doc.fences[jobId] === undefined)
  const job = doc.jobs.find((j) => j.id === jobId)
  assert.ok(job.state?.nextRunAtMs > ctx.clock.value)
  const receipt = ctx.runsLog().find((e) => e.action === 'late_settlement' && e.occurrenceId === stuck.occurrenceId)
  assert.ok(receipt)
  assert.equal(receipt.replayOccurrence, false)
  assert.equal(receipt.scheduleDisposition, 'recurring_future_natural_only')
  assert.equal(receipt.nextRunAtMsAfter, job.state.nextRunAtMs)
  assert.equal(ctx.runsLog().filter((e) => e.action === 'late_settlement' && e.occurrenceId === stuck.occurrenceId).length, 1,
    'settle-once: the receipt is emitted exactly once')
})

test('row 3: exact trusted late_failed routes through the #417 V3 trusted-late-evidence path', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t, { name: 'c11r3-matrix-latefailed' })
  const s2 = await adoptEngine(ctx, readback(LATE_FAILED))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)
  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId)
  assert.equal(settled.state, 'failed')
  assert.equal(settled.lateSettlement.basis, 'trusted-late-evidence')
  assert.ok(doc.fences[jobId] === undefined)
})

test('row 7: two unresolved handles — only the eligible one converges; the other stays fenced and HUMAN_REQUIRED', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t, { name: 'c11r3-matrix-two' })
  // Second Job on the SAME agent with its own fenced unknown: the engine's
  // mandatory restart sweep path (admitted+running with no proof → unknown).
  const created = await ctx.call('create', createArgs({ name: 'c11r3-matrix-two-b', schedule_kind: 'every', every_ms: EVERY_MS }))
  const jobIdB = created.result.jobId
  let twinId
  await ctx.store.mutateDoc((latest) => {
    const twin = buildOccurrenceRecord({
      job: latest.jobs.find((entry) => entry.id === jobIdB),
      kind: 'natural',
      nominalScheduledAt: stuck.nominalScheduledAt - 1,
      admittedAt: stuck.nominalScheduledAt - 1,
      timeoutMs: 3_600_000,
    })
    applyTransition(twin, { to: 'running', at: stuck.nominalScheduledAt, reason: 'twin start', startedAt: stuck.nominalScheduledAt })
    latest.occurrences.push(twin)
    twinId = twin.occurrenceId
    return {}
  })

  // Only job A's handle proves termination; job B's readback stays pending.
  const snapshots = new Map([[twinId, { state: 'pending' }]])
  const s2 = await adoptEngine(ctx, (coords) => readback(snapshots.get(coords.occurrenceId) ?? CHILD_REAL_EXIT)(coords))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)

  const doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId).terminationSettlement?.scheduleDisposition,
    'recurring_future_natural_only', 'the eligible handle converged')
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === twinId).state, 'outcome_unknown',
    'the ineligible handle did NOT converge (zero-write)')
  assert.ok(doc.fences[jobId] === undefined, 'job A fence released by its own settlement only')
  assert.ok(doc.fences[jobIdB] !== undefined, 'job B fence retained while its contribution is unresolved')
  const selfOps = createSelfOpsAccess({ store: ctx.store, resolveCallerCorrelation: () => ({ state: 'pending' }), clock: () => ctx.clock.value })
  const diag = await selfOps.handlers.self_ops.job_disposition({ job_id: jobIdB }, { callerAgentId: OWNER })
  assert.equal(diag.result.recoveryEligibility, 'HUMAN_REQUIRED', 'job B stays fail-closed human-required')
})

test('row 10: Router availability and Scheduler recurring-job availability are reported separately', async (t) => {
  const { ctx, jobId } = await seedFencedUnknown(t, { name: 'c11r3-matrix-avail' })
  // The Router reports its OWN health (stubbed 'healthy', admission open);
  // the Scheduler reports its OWN recurring-job availability (fenced ->
  // HUMAN_REQUIRED, no nextRunAtMs). Neither surface derives from the other.
  const selfOps = createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: () => ({ state: 'pending' }),
    clock: () => ctx.clock.value,
    runtimeStatus: () => ({ generationId: 'router-epoch-1', health: 'healthy', businessAdmission: 'open', blockedReason: null, unresolvedRecoveries: 0 }),
  })
  const status = await selfOps.handlers.self_ops.status({}, { callerAgentId: OWNER })
  assert.equal(status.result.runtime.health, 'healthy', 'Router availability: healthy (reported verbatim from the Router runtime status)')
  assert.equal(status.result.runtime.generationId, 'router-epoch-1', 'the Router epoch is its own reported fact')
  const blocker = status.result.scheduler.blockers.find((b) => b.jobId === jobId)
  assert.ok(blocker, 'Scheduler availability: the fenced unknown is reported as its own blocker')
  assert.equal(blocker.fenceActive, true)
  const diag = await selfOps.handlers.self_ops.job_disposition({ job_id: jobId }, { callerAgentId: OWNER })
  assert.equal(diag.result.recoveryEligibility, 'HUMAN_REQUIRED')
  const doc = await ctx.store.loadDoc({ force: true })
  const job = doc.jobs.find((j) => j.id === jobId)
  assert.equal(job.state?.nextRunAtMs ?? undefined, undefined,
    'the recurring job is NOT available: no next natural slot is promised while fenced')
})

test('row 9 edge: a settled ONE-SHOT late outcome receipts one_shot_disabled, never a recurring disposition', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t, { name: 'c11r3-matrix-oneshot' })
  // Convert the job to the one-shot shape the engine treats as at-schedule
  // with deleteAfterRun (the default) — the exact completed-job route where a
  // naive receipt would state a recurring disposition for a deleted job.
  await ctx.store.mutateDoc((latest) => {
    const job = latest.jobs.find((entry) => entry.id === jobId)
    job.schedule = { kind: 'at', at: new Date(stuck.nominalScheduledAt).toISOString() }
    return {}
  })
  const s2 = await adoptEngine(ctx, readback(LATE_COMPLETED))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)

  const doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId).state, 'succeeded')
  const receipt = ctx.runsLog().find((e) => e.action === 'late_settlement' && e.occurrenceId === stuck.occurrenceId)
  assert.ok(receipt, 'the settlement receipt exists')
  assert.equal(receipt.scheduleDisposition, 'one_shot_disabled',
    'the receipt states the TRUE disposition of the completed one-shot')
  assert.equal(receipt.replayOccurrence, false)
  assert.equal(receipt.nextRunAtMsAfter ?? null, null, 'a completed one-shot promises no next run')
})
