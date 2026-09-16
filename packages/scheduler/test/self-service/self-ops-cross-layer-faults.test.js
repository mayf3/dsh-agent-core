import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createRecordingDelivery } from '../../src/seams.js'
import { applyTransition, buildOccurrenceRecord, rebuildFences } from '../../src/occurrence-model.js'
import { createSelfOpsAccess } from '../../src/self-ops/index.js'

// Cross-layer fault simulations around the safe self-reconcile surface.
// Each simulation classifies its outcome: REPRODUCED_DEFECT (a real bug),
// CAPABILITY_LIMIT (fail-closed by design, constraint recorded), or
// OPEN_RISK (behavior accepted today, risk recorded for a later mandate).

const AGENT = 'agt_self'

function env({ now = 1_800_000_000_000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-wgr-faults-'))
  const clock = { value: now }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  let hang = true
  const calls = []
  let resolvePending
  const invoker = async (request) => {
    request.onStart()
    calls.push(request)
    if (!hang) return { status: 'ok', summary: 'ok' }
    const pending = new Promise((resolve) => { resolvePending = resolve })
    pending.resolveForTest = (value) => resolvePending(value)
    return pending
  }
  invoker.assertRunnable = () => true
  invoker.calls = calls
  const scheduler = new Scheduler({
    store,
    invoker,
    deliver: createRecordingDelivery(),
    concurrency: 3,
    nowMs: () => clock.value,
    deadlineSetTimeout: (fn) => { queueMicrotask(fn); return 1 },
    deadlineClearTimeout: () => {},
  })
  return {
    dir, clock, store, invoker, scheduler,
    stopHanging: () => { hang = false; try { resolvePending({ status: 'outcome_unknown' }) } catch { /* settled */ } },
  }
}

async function runDue(ctx, dueAt) {
  ctx.clock.value = dueAt
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
}

async function startEngine(ctx) {
  await ctx.scheduler.start({ autoStart: false, catchup: false })
}

async function addEveryJob(ctx, name, anchorOffsetMs = -50_000) {
  return ctx.scheduler.createJob({
    name,
    agentId: AGENT,
    schedule: { kind: 'every', everyMs: 60_000, anchorMs: ctx.clock.value + anchorOffsetMs },
    payload: { kind: 'agentTurn', message: `body ${name}` },
    delivery: { mode: 'none' },
  })
}

// F2 uses a LATER anchor so its first natural slot falls after job A's
// unknown — proving per-Job fence scope, not a same-tick co-admission.

/** Drive one REAL engine occurrence of `job` into outcome_unknown (with endedAt). */
async function runToUnknown(ctx, jobId, whenMs) {
  await runDue(ctx, whenMs)
  const record = ctx.scheduler.listOccurrences().find((entry) => entry.jobId === jobId)
  assert.equal(record?.state, 'outcome_unknown', `expected real unknown for ${jobId}`)
  assert.equal(typeof record.endedAt, 'number')
  return record
}

function settledRouter(record, overrides = {}) {
  return ({ occurrenceId }) => occurrenceId !== record.occurrenceId
    ? { state: 'never_existed' }
    : {
      state: 'settled',
      handle: `turn:opaque:${record.occurrenceId}`,
      snapshot: {
        agentId: AGENT,
        callerCorrelation: { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId },
        lateOutcome: 'terminated_without_outcome',
        terminationEvidence: 'child_real_exit',
        ...overrides,
      },
    }

}

function selfOps(ctx, resolveCallerCorrelation) {
  return createSelfOpsAccess({
    store: ctx.store,
    resolveCallerCorrelation,
    runtimeStatus: () => ({ generationId: 'gen-opaque', health: 'healthy' }),
    clock: () => ctx.clock.value + 5_000,
  })
}

test('F1 CAPABILITY_LIMIT: router restart evidence/correlation loss fails closed, never blind retry', async () => {
  const ctx = env()
  await startEngine(ctx)
  const job = await addEveryJob(ctx, 'f1')
  const record = await runToUnknown(ctx, job.id, ctx.clock.value + 15_000)
  const before = JSON.stringify(await ctx.store.loadDoc({ force: true }))

  // Axis a: the Router process restarted; the exact-turn correlation is gone.
  const restarted = selfOps(ctx, () => ({ state: 'restart_lost' }))
  const statusA = await restarted.status(AGENT)
  assert.equal(statusA.scheduler.reconciliationCandidateCount, 0, 'lost correlation is not a settlement candidate')
  assert.equal(statusA.scheduler.blockers[0].blockerCode, 'restart_lost')
  const deniedA = await restarted.reconcileTurn(AGENT, {
    jobId: job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(deniedA.ok, false)
  assert.equal(deniedA.error.code, 'termination_not_proven')

  // Axis b: post-restart Router re-minted a snapshot whose correlation epoch
  // no longer matches the occurrence's requestId — mismatch, not settlement.
  const reminted = selfOps(ctx, settledRouter(record, {
    callerCorrelation: { occurrenceId: record.occurrenceId, runId: record.runId, requestId: 'req:post-restart-epoch' },
  }))
  const deniedB = await reminted.reconcileTurn(AGENT, {
    jobId: job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(deniedB.ok, false)
  assert.equal(deniedB.error.code, 'correlation_mismatch')

  assert.equal(JSON.stringify(await ctx.store.loadDoc({ force: true })), before, 'byte-for-byte zero-write across both axes')
  const doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.fences[job.id]?.occurrenceId, record.occurrenceId, 'fence persists until trusted evidence exists')
  ctx.stopHanging()
})

test('F2 CAPABILITY_LIMIT: fence is per-Job — the same Agent\'s other Job runs and the interactive status answers', async () => {
  const ctx = env()
  await startEngine(ctx)
  const jobA = await addEveryJob(ctx, 'f2-fenced')
  const jobB = await addEveryJob(ctx, 'f2-healthy', +40_000)
  const stuckA = await runToUnknown(ctx, jobA.id, ctx.clock.value + 15_000)

  // While A is fenced, B (same agent) is admitted and runs to success.
  ctx.stopHanging()
  await runDue(ctx, stuckA.endedAt + 70_000)
  const occurrences = ctx.scheduler.listOccurrences()
  const bRun = occurrences.find((entry) => entry.jobId === jobB.id)
  assert.ok(bRun, 'unrelated job of the same agent is admitted while job A is fenced')
  assert.equal(bRun.state, 'succeeded', 'job B completed normally under job A\'s fence')
  const doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.fences[jobA.id]?.occurrenceId, stuckA.occurrenceId, 'job A stays fenced')

  // The interactive entry answers without resolving the fence (no normal-turn
  // dependency: this is the broker self_ops surface any trusted caller hits).
  const access = selfOps(ctx, settledRouter(stuckA))
  const status = await access.status(AGENT)
  assert.equal(status.scheduler.ownedJobCount, 2)
  assert.equal(status.scheduler.activeFenceCount, 1, 'only the stuck job is fenced')
  assert.equal(status.scheduler.reconciliationCandidateCount, 1)
  assert.equal(status.scheduler.blockers[0].jobId, jobA.id)
  assert.equal(status.scheduler.blockers[0].blockerCode, 'safe_reconcile_available')
})

test('F3 CAPABILITY_LIMIT: scheduler abort without actual termination is never settlement evidence', async () => {
  const ctx = env()
  await startEngine(ctx)
  const job = await addEveryJob(ctx, 'f3')
  const record = await runToUnknown(ctx, job.id, ctx.clock.value + 15_000)
  const before = JSON.stringify(await ctx.store.loadDoc({ force: true }))

  // The engine fired controller.abort() on deadline — but the turn process
  // never actually exited. Snapshots that claim termination with abort-class
  // "evidence" (or no evidence at all) are unsupported dispositions.
  for (const overrides of [
    { terminationEvidence: 'abort_requested' },
    { terminationEvidence: undefined },
  ]) {
    const access = selfOps(ctx, settledRouter(record, overrides))
    const denied = await access.reconcileTurn(AGENT, {
      jobId: job.id, occurrenceId: record.occurrenceId, runId: record.runId,
    })
    assert.equal(denied.ok, false, `evidence=${overrides.terminationEvidence}`)
    assert.equal(denied.error.code, 'termination_not_proven')
    assert.equal(JSON.stringify(await ctx.store.loadDoc({ force: true })), before, 'zero-write')
  }
  const doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.fences[job.id]?.occurrenceId, record.occurrenceId, 'unproven termination keeps the fence')
  ctx.stopHanging()
})

test('F4 OPEN_RISK: 5k-terminal ledger — reconcile stays correct, cache holds one clone, ledger has no retention policy', async (t) => {
  const ctx = env()
  await startEngine(ctx)
  const job = await addEveryJob(ctx, 'f4')
  const record = await runToUnknown(ctx, job.id, ctx.clock.value + 15_000)

  // Bulk historical completed tasks (validator-approved terminal shapes).
  const TERMINALS = 5_000
  await ctx.store.mutateDoc((doc) => {
    for (let i = 0; i < TERMINALS; i += 1) {
      const admittedAt = ctx.clock.value - 10_000_000 + i * 1_000
      const terminal = buildOccurrenceRecord({
        job: { ...job, id: `job-bulk-${i}`, scheduleRevision: 1, payload: job.payload },
        kind: 'natural', nominalScheduledAt: admittedAt, admittedAt,
      })
      applyTransition(terminal, { to: 'running', at: admittedAt + 5, reason: 'bulk', startedAt: admittedAt + 5 })
      applyTransition(terminal, {
        to: 'succeeded', at: admittedAt + 10, reason: 'bulk historical completion',
        endedAt: admittedAt + 10, executionOutcome: 'succeeded',
        terminalEvidence: { kind: 'turn-terminal', detailRef: `bulk:${i}` },
      })
      doc.occurrences.push(terminal)
    }
    doc.fences = rebuildFences(doc.occurrences)
  })

  // Correctness at scale: status + exact reconcile through the real store.
  const access = selfOps(ctx, settledRouter(record))
  const statusStart = process.hrtime.bigint()
  const status = await access.status(AGENT)
  const statusMs = Number(process.hrtime.bigint() - statusStart) / 1e6
  assert.equal(status.scheduler.unresolvedUnknownCount, 1)
  assert.equal(status.scheduler.reconciliationCandidateCount, 1)
  t.diagnostic(`status over ${TERMINALS + 1} occurrences: ${statusMs.toFixed(1)}ms`)

  const reconcileStart = process.hrtime.bigint()
  const result = await access.reconcileTurn(AGENT, {
    jobId: job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  const reconcileMs = Number(process.hrtime.bigint() - reconcileStart) / 1e6
  assert.equal(result.ok, true, JSON.stringify(result.error ?? {}))
  t.diagnostic(`reconcile commit over ${TERMINALS + 1} occurrences: ${reconcileMs.toFixed(1)}ms`)

  const doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences.length, TERMINALS + 1, 'no backlog minted')
  assert.deepEqual(doc.fences, {}, 'fence released')
  const settled = doc.occurrences.find((entry) => entry.occurrenceId === record.occurrenceId)
  assert.equal(settled.endedAt, settled.terminationSettlement.settledAt)
  assert.equal(settled.state, 'outcome_unknown', 'business outcome stays unknown at scale')

  // Memory retention: the store cache is a SINGLE replaced clone (bounded),
  // not per-call accumulation. Heap growth across repeated force-read cycles
  // must stay well under the ledger size (no unbounded retention observed).
  const docBytes = JSON.stringify(doc).length
  const heapBefore = process.memoryUsage().heapUsed
  for (let i = 0; i < 25; i += 1) await ctx.store.loadDoc({ force: true })
  const heapGrowth = process.memoryUsage().heapUsed - heapBefore
  t.diagnostic(`doc bytes=${docBytes} heap growth after 25 force loads=${(heapGrowth / 1e6).toFixed(1)}MB`)
  assert.ok(heapGrowth < docBytes * 25, 'no per-load unbounded heap retention')
  assert.ok(ctx.store._cacheDoc !== null)
  assert.equal(ctx.store._cacheDoc.occurrences.length, TERMINALS + 1, 'exactly one cached generation retained')

  // OPEN_RISK record: no retention/compaction policy exists for terminal
  // occurrences — the ledger (and every full-doc clone cost) grows forever.
  // Accepted today; needs a future retention mandate, NOT a fixture change.
  const hasRetentionPolicy = Object.keys(doc).some((key) => /retention|compaction|prune/i.test(key))
  assert.equal(hasRetentionPolicy, false, 'documents the open risk: append-only ledger, no retention authority')
  ctx.stopHanging()
})
