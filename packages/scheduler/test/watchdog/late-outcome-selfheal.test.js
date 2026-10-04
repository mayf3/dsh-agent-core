/**
 * @agent-core/scheduler — C11-R1 trusted late-outcome self-heal (Product #417).
 *
 * The defect on current main: a restart-orphaned `outcome_unknown` occurrence
 * whose exact trusted Router readback says `late_completed`/`late_failed` is
 * classified RECONCILED_SUCCESS/FAILURE by the read-only self_ops.status
 * surface, yet the scheduler ledger keeps the unknown and the same-Job fence —
 * `dispatchReconciliation()` (SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_
 * RECOVERY_V1 CTR-RECON-001 ordered settlement dispatch) has NO production
 * call site, and job_disposition stays HUMAN_REQUIRED forever.
 *
 * The wiring under test: the engine's existing periodic tick consults the SAME
 * published `resolveCallerCorrelation` surface the self-ops consume, builds
 * the exact trusted evidence, and dispatches through the accepted settlement
 * paths only — the V3 trusted-late-evidence late settlement for business
 * outcomes, the C-039 engine-trusted-readback termination settlement for
 * termination-only. Stale/mismatch/conflict/incomplete evidence stays
 * zero-write; age alone never releases a fence; one-shot semantics and the
 * future-natural-only resume are preserved; settling one unknown contribution
 * keeps the aggregate Job fence until the last contribution settles.
 *
 * Test identity: agt_admin (owner) / agt_plain (foreign) on isolated mkdtemp
 * stores — zero production identity, zero credentials, zero Feishu.
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

/** The production post-restart readback shape over resolveCallerCorrelation. */
const readback = (snapshot, handle = 'router:readback:1') => (coords) => ({
  state: 'settled',
  handle,
  snapshot: { agentId: OWNER, callerCorrelation: coords, ...snapshot },
})

const LATE_COMPLETED = { outcome: 'late_completed' }
const LATE_FAILED = { outcome: 'late_failed' }
const TERMINATED = { outcome: 'terminated_without_outcome', terminationEvidence: 'restart_quiescence_proven' }

/**
 * Drive one real hung turn into a fenced outcome_unknown on the store: the
 * first slot admits, the engine deadline fires without any termination proof,
 * the honest unknown + fence commit. The scenario engine is then declared
 * dead by the same mechanical proof a production restart relies on (a
 * genuinely-exited pid in the engine lock), so the next engine reaps the
 * lease on start. Returns the rig plus the stuck coordinates.
 */
async function seedFencedUnknown(t) {
  let invocations = 0
  const ctx = await rig(t, {
    // synthetic hung turn: exactly the FIRST invocation hangs (the stuck
    // run); every later invocation is a healthy fresh-slot turn.
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
  const created = await ctx.call('create', createArgs({
    name: 'c11r1-late-outcome-selfheal',
    schedule_kind: 'every',
    every_ms: EVERY_MS,
  }))
  assert.equal(created.ok, true, `create accepted: ${JSON.stringify(created).slice(0, 200)}`)
  const jobId = created.result.jobId
  ctx.clock.value += EVERY_MS + 1_000
  await s1.tick() // the hung run: admitted → deadline → outcome_unknown + fence
  await s1.whenIdle() // the writeback is async; the inflight set empties at the deadline
  const [stuck] = await occurrences(ctx)
  assert.equal(stuck.state, 'outcome_unknown', 'seed: honest unknown written')
  assert.ok((await ctx.store.loadDoc({ force: true })).fences[jobId] !== undefined, 'seed: job fenced')

  const deadChild = spawn('/usr/bin/true')
  const deadPid = deadChild.pid
  await new Promise((resolve) => deadChild.on('exit', resolve))
  const lockPath = ctx.store.engineLockPath
  const lockOwner = JSON.parse(await readFile(lockPath, 'utf8'))
  await writeFile(lockPath, `${JSON.stringify({ ...lockOwner, pid: deadPid })}\n`)
  return { ctx, jobId, stuck }
}

/**
 * A fresh engine adopting the same store through the production reap path,
 * wired with the C11-R1 reconciliation readback dep (consultIntervalMs 0 =
 * consult on every tick for determinism, unless overridden).
 */
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

test('C11-R1 core: exact trusted late_completed readback self-heals the fenced occurrence without a prompt', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t)

  // ---- The #417 defect shape, observed live BEFORE the engine consults ----
  const selfOps = createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: readback(LATE_COMPLETED),
    clock: () => ctx.clock.value,
    runtimeStatus: () => ({ generationId: 'c11r1', health: 'healthy' }),
  })
  const status = await selfOps.handlers.self_ops.status({}, { callerAgentId: OWNER })
  const row = status.result.scheduler.blockers.find((b) => b.occurrenceId === stuck.occurrenceId)
  assert.ok(row, 'the blocked run is Owner-visible')
  assert.equal(row.fenceActive, true)
  assert.equal(row.routerDisposition, 'late_completed')
  assert.equal(row.reconciliationState, 'RECONCILED_SUCCESS', 'read-only classification already sees the trusted business outcome')
  const diag = await selfOps.handlers.self_ops.job_disposition({ job_id: jobId }, { callerAgentId: OWNER })
  assert.equal(diag.result.recoveryEligibility, 'HUMAN_REQUIRED', 'the missing-wiring steady state')

  // ---- The wired engine: the periodic tick consults the SAME trusted readback ----
  let readbackCalls = 0
  const s2 = await adoptEngine(ctx, (coords) => { readbackCalls += 1; return readback(LATE_COMPLETED)(coords) })
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)

  let doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId)
  assert.equal(settled.state, 'succeeded', 'the exact occurrence settled by the trusted business outcome')
  assert.equal(settled.executionOutcome, 'succeeded')
  assert.equal(settled.lateSettlement.basis, 'trusted-late-evidence', 'the accepted V3 late-settlement path carried it')
  assert.match(settled.lateSettlement.evidenceRef, /router-current-readback/, 'readback provenance rides the durable evidence')
  assert.ok(doc.fences[jobId] === undefined, 'fence projection rebuilt — the exact contribution released')
  const job = doc.jobs.find((j) => j.id === jobId)
  assert.equal(job.enabled, true)
  assert.ok(job.state?.nextRunAtMs > ctx.clock.value, 'the recurring job resumes at a FUTURE natural slot')

  // Settle-once, no duplicate writer: the settlement evidence exists exactly
  // once and further ticks never re-settle.
  const settlementEvidence = () => ctx.runsLog().filter((e) => e.action === 'late_settlement' && e.occurrenceId === stuck.occurrenceId)
  assert.equal(settlementEvidence().length, 1, 'exactly one durable settlement evidence line')
  await advance(s2, EVERY_MS + 1_000, ctx.clock)
  assert.equal(settlementEvidence().length, 1, 'repeated ticks never re-settle')

  // No UNKNOWN replay: the old run is never re-invoked; the only new
  // occurrence belongs to a future natural slot.
  const fresh = (await occurrences(ctx)).find((r) => r.occurrenceId !== stuck.occurrenceId)
  assert.ok(fresh, 'the next natural slot minted a NEW occurrence')
  assert.ok(fresh.nominalScheduledAt > stuck.nominalScheduledAt, 'future-natural-only')
  const stuckSessions = ctx.chainCalls.filter((c) => String(c.sessionId).includes(stuck.occurrenceId))
  assert.equal(stuckSessions.length, 1, 'the settled occurrence was invoked exactly once, never replayed')
  assert.ok(readbackCalls >= 1, 'the trusted readback was consulted')
  const statusAfter = await selfOps.handlers.self_ops.status({}, { callerAgentId: OWNER })
  assert.equal(statusAfter.result.scheduler.blockers.length, 0, 'no unresolved unknown remains Owner-visible')
})

test('C11-R1 late_failed variant: the exact trusted failure settles the occurrence as failed', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t)
  const s2 = await adoptEngine(ctx, readback(LATE_FAILED))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)
  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId)
  assert.equal(settled.state, 'failed', 'the exact trusted business failure settles failed')
  assert.equal(settled.executionOutcome, 'failed')
  assert.equal(settled.lateSettlement.resolvedTo, 'failed')
  assert.ok(doc.fences[jobId] === undefined, 'fence released by the exact settlement')
  assert.equal(ctx.runsLog().filter((e) => e.action === 'late_settlement' && e.occurrenceId === stuck.occurrenceId).length, 1)
})

test('C11-R1 mismatch/conflict/pending/incomplete evidence is zero-write and stays fenced + HUMAN_REQUIRED', async (t) => {
  for (const [name, wire] of [
    ['mismatch', (coords) => ({ state: 'settled', handle: 'router:x', snapshot: { agentId: 'agt_plain', callerCorrelation: coords, outcome: 'late_completed' } })],
    ['conflict', () => { throw new Error('router conflict') }],
    ['pending', (coords) => ({ state: 'pending', handle: 'router:x', snapshot: { agentId: OWNER, callerCorrelation: coords } })],
    ['incomplete', (coords) => ({ state: 'settled', handle: 'router:x', snapshot: { agentId: OWNER, callerCorrelation: { ...coords, runId: 'other' }, outcome: 'late_completed' } })],
  ]) {
    const { ctx, jobId, stuck } = await seedFencedUnknown(t)
    const s2 = await adoptEngine(ctx, wire)
    t.after(() => s2.stop().catch(() => {}))
    const before = JSON.stringify(await ctx.store.loadDoc({ force: true }))
    await advance(s2, 5_000, ctx.clock)
    const doc = await ctx.store.loadDoc({ force: true })
    const record = doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId)
    assert.equal(record.state, 'outcome_unknown', `${name}: zero-write — the occurrence is untouched`)
    assert.equal(record.lateSettlement, undefined, `${name}: no settlement written`)
    assert.equal(record.terminationSettlement, undefined, `${name}: no termination settlement written`)
    assert.ok(doc.fences[jobId] !== undefined, `${name}: the fence is retained`)
    assert.equal(JSON.stringify(doc), before, `${name}: the store document is byte-identical`)
    assert.equal(ctx.runsLog().some((e) => ['late_settlement', 'termination_settlement'].includes(e.action)), false,
      `${name}: no settlement evidence lines`)
    // Age/timeout alone never released anything: the engine clock advanced,
    // only the exact trusted evidence could have settled — it did not.
    const selfOps = createSelfOpsAccess({ store: ctx.store, resolveCallerCorrelation: () => ({ state: 'pending' }), clock: () => ctx.clock.value })
    const diag = await selfOps.handlers.self_ops.job_disposition({ job_id: jobId }, { callerAgentId: OWNER })
    assert.equal(diag.result.recoveryEligibility, 'HUMAN_REQUIRED', `${name}: fail-closed human required`)
    await s2.stop().catch(() => {})
  }
})

test('C11-R1 two unknowns on one Job: settling one contribution keeps the aggregate fence until the last settles', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t)
  // Mint a second contribution through the ledger's own writer in the exact
  // state the restart sweep leaves behind (admitted+running with no proof) —
  // the adopting engine's mandatory recovery sweep then produces the second
  // unresolved unknown by the real production path.
  let twinOccurrenceId
  await ctx.store.mutateDoc((latest) => {
    const twin = buildOccurrenceRecord({
      job: latest.jobs.find((entry) => entry.id === jobId),
      kind: 'natural',
      nominalScheduledAt: stuck.nominalScheduledAt - EVERY_MS,
      admittedAt: stuck.nominalScheduledAt - EVERY_MS,
      timeoutMs: 3_600_000,
    })
    applyTransition(twin, { to: 'running', at: stuck.nominalScheduledAt - EVERY_MS + 10, reason: 'twin start', startedAt: stuck.nominalScheduledAt - EVERY_MS + 10 })
    latest.occurrences.push(twin)
    twinOccurrenceId = twin.occurrenceId
    return {}
  })

  // Only the twin's readback proves the late business outcome; the seeded
  // one stays live-pending (zero-write) so its contribution stays unresolved.
  // First pass: the twin settles, the aggregate fence MUST persist. Second
  // pass: the last contribution settles, the aggregate fence clears.
  const snapshots = new Map([[stuck.occurrenceId, { state: 'pending' }]])
  const s2 = await adoptEngine(ctx, (coords) => readback(snapshots.get(coords.occurrenceId) ?? LATE_COMPLETED)(coords))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)
  let doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === twinOccurrenceId).state, 'succeeded', 'first contribution settled')
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId).state, 'outcome_unknown', 'the pending contribution is NOT settled (zero-write)')
  assert.ok(doc.fences[jobId] !== undefined, 'the aggregate fence is retained while a contribution remains unresolved')

  snapshots.set(stuck.occurrenceId, LATE_COMPLETED)
  await advance(s2, 5_000, ctx.clock)
  doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId).state, 'succeeded', 'the second contribution settled on its own evidence')
  assert.ok(doc.fences[jobId] === undefined, 'the aggregate fence clears only when the last unresolved contribution settles')
})

test('C11-R1 restart/re-adoption: settlement is settle-once, no second writer, no duplicate occurrence', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t)
  const s2 = await adoptEngine(ctx, readback(LATE_COMPLETED))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)
  let doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId).state, 'succeeded', 'the first engine settles')
  const evidenceCount = () => ctx.runsLog().filter((e) => e.action === 'late_settlement' && e.occurrenceId === stuck.occurrenceId).length
  assert.equal(evidenceCount(), 1)

  // A fully NEW engine instance adopts the same store (restart identity) and
  // keeps ticking: no second settlement, no duplicate occurrence, no replay.
  await s2.stop().catch(() => {})
  const s3 = await adoptEngine(ctx, readback(LATE_COMPLETED))
  t.after(() => s3.stop().catch(() => {}))
  for (let i = 0; i < 3; i += 1) await advance(s3, EVERY_MS + 1_000, ctx.clock)
  doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId).state, 'succeeded', 'the settlement survives restart unchanged')
  assert.equal(evidenceCount(), 1, 'no duplicate settlement evidence across the restart')
  assert.equal(doc.occurrences.filter((r) => r.runId === stuck.runId).length, 1, 'exactly one ledger row for the settled run')
  const stuckSessions = ctx.chainCalls.filter((c) => String(c.sessionId).includes(stuck.occurrenceId))
  assert.equal(stuckSessions.length, 1, 'no re-invocation of the settled run after re-adoption')
  const later = doc.occurrences.filter((r) => r.occurrenceId !== stuck.occurrenceId)
  assert.ok(later.length >= 1 && later.every((r) => r.nominalScheduledAt > stuck.nominalScheduledAt),
    'only future natural slots were admitted')
  assert.ok(doc.jobs.find((j) => j.id === jobId), 'the job continues normally')
})

test('C11-R1 termination-only readback uses the accepted C-039 settlement path and the self_ops replay is identical', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t)
  const s2 = await adoptEngine(ctx, readback(TERMINATED))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)
  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId)
  assert.equal(settled.state, 'outcome_unknown', 'the business state NEVER upgrades from termination evidence')
  assert.equal(settled.terminationSettlement.actorProvenance, 'engine-trusted-readback', 'the accepted engine termination path')
  assert.equal(settled.terminationSettlement.scheduleDisposition, 'recurring_future_natural_only')
  assert.ok(doc.fences[jobId] === undefined, 'fence released')
  const selfOps = createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation: readback(TERMINATED),
    clock: () => ctx.clock.value,
  })
  const replay = await selfOps.handlers.self_ops.reconcile_turn(
    { job_id: jobId, occurrence_id: stuck.occurrenceId, run_id: stuck.runId },
    { callerAgentId: OWNER })
  assert.equal(replay.ok, true, 'self_ops reconcile replays the same settlement')
  assert.equal(replay.result.businessState, 'outcome_unknown')
  assert.equal(replay.result.occurrenceId, stuck.occurrenceId)
  assert.equal(ctx.runsLog().filter((e) => e.action === 'self_reconcile_termination').length, 0,
    'the replay is zero-write: no second settlement audit')
})

test('C11-R1 one-shot semantics preserved: a settled late outcome disables the one-shot job, never replays it', async (t) => {
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
  const created = await ctx.call('create', createArgs({ name: 'c11r1-one-shot-late', schedule_kind: 'at', at: '1m' }))
  assert.equal(created.ok, true)
  const jobId = created.result.jobId
  ctx.clock.value += 61_000
  await s1.tick()
  await s1.whenIdle()
  const [stuck] = await occurrences(ctx)
  assert.equal(stuck.state, 'outcome_unknown')
  const deadChild = spawn('/usr/bin/true')
  await new Promise((resolve) => deadChild.on('exit', resolve))
  const lockOwner = JSON.parse(await readFile(ctx.store.engineLockPath, 'utf8'))
  await writeFile(ctx.store.engineLockPath, `${JSON.stringify({ ...lockOwner, pid: deadChild.pid })}\n`)

  const s2 = await adoptEngine(ctx, readback(LATE_COMPLETED))
  t.after(() => s2.stop().catch(() => {}))
  await advance(s2, 5_000, ctx.clock)
  let doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId).state, 'succeeded')
  assert.ok(doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId).lateSettlement, 'settled through the late-settlement path')
  // deleteAfterRun defaults true for one-shots: the existing §9.1 semantics
  // remove the job at late resolution — the reused completion helper did it.
  assert.ok(doc.jobs.find((j) => j.id === jobId) === undefined, 'the one-shot job is completed per existing §9.1 semantics (deleteAfterRun default)')
  await advance(s2, 120_000, ctx.clock)
  doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.filter((r) => r.jobId === jobId).length, 1, 'a one-shot is never replayed')
})

test('C11-R1 the readback consult is rate-limited per occurrence and STILL_IN_FLIGHT is zero-write', async (t) => {
  const { ctx, jobId, stuck } = await seedFencedUnknown(t)
  let readbackCalls = 0
  const s2 = await adoptEngine(
    ctx,
    (coords) => { readbackCalls += 1; return readback({ state: 'pending' })(coords) },
    { consultIntervalMs: 60_000 },
  )
  t.after(() => s2.stop().catch(() => {}))
  for (let i = 0; i < 5; i += 1) await advance(s2, 1_000, ctx.clock)
  assert.equal(readbackCalls, 1, 'a live unknown consults at most once per interval across rapid ticks')
  let doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.find((r) => r.occurrenceId === stuck.occurrenceId).state, 'outcome_unknown', 'STILL_IN_FLIGHT is zero-write')
  assert.ok(doc.fences[jobId] !== undefined, 'fresh live evidence retains the fence')
  await advance(s2, 61_000, ctx.clock)
  assert.equal(readbackCalls, 2, 'the consult resumes after the interval — the engine keeps watching')
  doc = await ctx.store.loadDoc({ force: true })
  assert.ok(doc.fences[jobId] !== undefined, 'the fence persists while the turn stays live')
})
