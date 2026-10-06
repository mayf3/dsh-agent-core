/**
 * PRODUCT #456 (A7) — transactional reconciliation-state store semantics.
 *
 * Focused closure for the committed-ack ambiguity of the operator reconcile
 * path (control.js reconcileOccurrence): the single mutation authority
 * (store.mutateDoc) already tags an ambiguous commit failure with
 * mutationOutcome:'committed' + committedValue, and the trusted self-ops
 * reconcile (self-ops/index.js reconcileTurn) already replays that committed
 * receipt — the control path must converge the same way instead of
 * surfacing a raw error whose only safe retry is RECONCILE_NOT_UNKNOWN.
 *
 * The remaining tests pin the frozen UNKNOWN/no-replay and crash/restart
 * invariants that the closure must not disturb:
 *   - a committed-ack-lost reconcile appends its audit line EXACTLY once;
 *   - a genuine replay of a settled reconcile fails closed (no second write);
 *   - a dead engine's persisted running record is swept to outcome_unknown
 *     at adoption, fences the job, and never replays the slot;
 *   - a settled occurrence survives restart immutable; only a future natural
 *     slot resumes (no backlog replay at reconciliation time).
 *
 * Test identity: isolated tmpdir stores, injected clock, no production
 * surfaces (PRODUCTION_MUTATION=NO).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createRecordingDelivery } from '../../src/seams.js'
import { applyTransition, buildOccurrenceRecord, rebuildFences } from '../../src/occurrence-model.js'

const sleep = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms))
const deferred = () => {
  let resolve
  const promise = new Promise((yes) => { resolve = yes })
  return { promise, resolve }
}

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

/** Store whose commit IS durable but whose acknowledgement can be lost:
 *  the atomic rename has happened before the injected throw, which is the
 *  exact ambiguity mutateDoc's mutationOutcome:'committed' tagging exists
 *  for (store.js attaches committedDoc/committedValue to this error). The
 *  injection is armed per-test so seeding writes commit normally. */
class AckLostStore extends JobStore {
  constructor(...args) {
    super(...args)
    this.ackLossArmed = false
  }

  async _writeAtomicDoc(doc) {
    await super._writeAtomicDoc(doc)
    if (!this.ackLossArmed) return
    throw Object.assign(new Error('injected: commit ack lost after rename'), {
      mutationOutcome: 'committed',
    })
  }
}

function env({
  now = 1_000, invoke, storeClass = JobStore, immediateDeadline = false,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-reconcile-tx-'))
  const clock = { value: now }
  const store = new storeClass(join(dir, 'jobs.json'), { clock: () => clock.value })
  const actualInvoker = invoke ?? invoker(() => ({ status: 'ok', summary: 'ok' }))
  // Shared engine seams: every engine adopting this store must run under the
  // SAME deadline rig — a real 1h default deadline would outlive the test.
  const deadlineRig = immediateDeadline
    ? {
        deadlineSetTimeout: (fn) => { queueMicrotask(fn); return 1 },
        deadlineClearTimeout: () => {},
      }
    : {}
  const scheduler = new Scheduler({
    store,
    invoker: actualInvoker,
    deliver: createRecordingDelivery(),
    concurrency: 5,
    nowMs: () => clock.value,
    ...deadlineRig,
  })
  return { dir, clock, store, invoker: actualInvoker, scheduler, deadlineRig }
}

/** A fresh engine identity adopting the same store (crash/restart rig). */
function adoptEngine(ctx, { catchup = false } = {}) {
  const adopted = new Scheduler({
    store: ctx.store,
    invoker: ctx.invoker,
    deliver: createRecordingDelivery(),
    concurrency: 5,
    nowMs: () => ctx.clock.value,
    ...ctx.deadlineRig,
  })
  return adopted.start({ autoStart: false, catchup })
}

async function addEvery(scheduler, extra = {}) {
  return scheduler.createJob({
    name: extra.name ?? 'reconcile-tx',
    agentId: 'agent-a',
    enabled: true,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'x' },
    delivery: { mode: 'none' },
  })
}

async function runDue(ctx, dueAt) {
  ctx.clock.value = dueAt
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
}

test('A7/G-1: reconcileOccurrence converges to the committed receipt when the commit ack is lost', async () => {
  const late = deferred()
  const invoke = invoker((request) => {
    request.onStart()
    return late.promise
  })
  const ctx = env({ invoke, immediateDeadline: true, storeClass: AckLostStore })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEvery(ctx.scheduler)
  await runDue(ctx, 1_100)
  const unknown = ctx.scheduler.listOccurrences(job.id)[0]
  assert.equal(unknown.state, 'outcome_unknown')
  assert.equal(ctx.scheduler.isFenced(job.id), true)

  // The commit IS durable (the atomic rename happened); the caller must get
  // the committed receipt back, not a raw error.
  ctx.store.ackLossArmed = true
  const result = await ctx.scheduler.reconcileOccurrence(unknown.occurrenceId, unknown.runId, {
    resolvedTo: 'failed',
    evidenceNote: 'operator verified exact turn termination',
  })
  assert.equal(result.record.state, 'failed')
  assert.equal(result.record.lateSettlement.basis, 'operator-reconcile')
  assert.equal(result.fenceRemaining, false)

  // The durable doc carries the settlement exactly once, and the audit line
  // was appended exactly once despite the ack loss (never zero, never two).
  const doc = await ctx.store.loadDoc({ force: true })
  const settled = doc.occurrences.find((record) => record.occurrenceId === unknown.occurrenceId)
  assert.equal(settled.state, 'failed')
  assert.equal(settled.lateSettlement.resolvedTo, 'failed')
  assert.equal(ctx.scheduler.isFenced(job.id), false)
  const auditLines = (await ctx.store.readRunEvents({ limit: null }))
    .filter((event) => event.action === 'late_settlement' && event.occurrenceId === unknown.occurrenceId)
  assert.equal(auditLines.length, 1, `exactly one late_settlement audit line, got ${auditLines.length}`)
})

test('A7/G-1: a genuine replay of a settled reconcile fails closed with no second write', async () => {
  const late = deferred()
  const invoke = invoker((request) => {
    request.onStart()
    return late.promise
  })
  const ctx = env({ invoke, immediateDeadline: true })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEvery(ctx.scheduler)
  await runDue(ctx, 1_100)
  const unknown = ctx.scheduler.listOccurrences(job.id)[0]
  await ctx.scheduler.reconcileOccurrence(unknown.occurrenceId, unknown.runId, {
    resolvedTo: 'failed',
    evidenceNote: 'operator verified exact turn termination',
  })
  const before = await ctx.store.loadDoc({ force: true })
  const historyLength = before.occurrences[0].history.length

  await assert.rejects(
    () => ctx.scheduler.reconcileOccurrence(unknown.occurrenceId, unknown.runId, {
      resolvedTo: 'failed',
      evidenceNote: 'operator verified exact turn termination',
    }),
    (error) => error.code === 'RECONCILE_NOT_UNKNOWN',
  )
  const after = await ctx.store.loadDoc({ force: true })
  assert.equal(after.occurrences[0].history.length, historyLength, 'replay must not append history')
  const auditLines = (await ctx.store.readRunEvents({ limit: null }))
    .filter((event) => event.action === 'late_settlement' && event.occurrenceId === unknown.occurrenceId)
  assert.equal(auditLines.length, 1, 'replay must not append a second audit line')
})

test('A7/crash-restart: a dead engine running record is swept to outcome_unknown, fenced, and never replayed', async () => {
  const invoke = invoker(() => new Promise(() => {}))
  const ctx = env({ invoke, immediateDeadline: true })
  const job = await addEvery(ctx.scheduler)
  // Crash identity: a dead engine left the occurrence persisted as running
  // (start evidence committed, no outcome writeback ever happened).
  await ctx.store.mutateDoc((doc) => {
    const stored = doc.jobs.find((entry) => entry.id === job.id)
    const record = buildOccurrenceRecord({
      job: stored,
      kind: 'natural',
      nominalScheduledAt: 1_500,
      admittedAt: 1_500,
      timeoutMs: 60_000,
    })
    applyTransition(record, {
      to: 'running',
      at: 1_600,
      reason: 'turn start evidence from invoker seam',
      startedAt: 1_600,
    })
    doc.occurrences.push(record)
    doc.fences = rebuildFences(doc.occurrences)
  })

  // A fresh engine adopts the store: recovery must settle the unresolved
  // record to outcome_unknown BEFORE any admission.
  ctx.clock.value = 5_000
  const adopted = await adoptEngine(ctx)
  const swept = adopted.listOccurrences(job.id)[0]
  assert.equal(swept.state, 'outcome_unknown')
  assert.equal(swept.lateSettlement, undefined, 'restart sweep never fabricates a business outcome')
  assert.equal(adopted.isFenced(job.id), true)

  // No replay of the dead run's slot while the fence is unresolved.
  ctx.clock.value = 6_000
  await adopted.tick()
  await adopted.whenIdle()
  assert.equal(invoke.calls.length, 0, 'fenced unresolved unknown replays nothing')

  // Exact-occurrence operator reconcile releases the fence; only a future
  // natural slot resumes (never the dead slot).
  await adopted.reconcileOccurrence(swept.occurrenceId, swept.runId, {
    resolvedTo: 'failed',
    evidenceNote: 'restart adoption: exact run terminated without outcome',
  })
  // Past the refire floor of the reconciled dead run (end + MIN_REFIRE_GAP_MS).
  ctx.clock.value = 30_000
  await adopted.tick()
  await adopted.whenIdle()
  await adopted.load()
  assert.equal(invoke.calls.length, 1, 'exactly the new future slot runs after reconciliation')
  const rows = adopted.listOccurrences(job.id)
  const dead = rows.find((record) => record.occurrenceId === swept.occurrenceId)
  assert.equal(dead.state, 'failed')
  const fresh = rows.find((record) => record.occurrenceId !== swept.occurrenceId)
  assert.ok(fresh, 'the resumed slot is a new occurrence, not a replay of the dead one')
  assert.notEqual(fresh.nominalScheduledAt, swept.nominalScheduledAt)
})

test('A7/crash-restart: a settled occurrence survives restart immutable with no backlog replay', async () => {
  const late = deferred()
  const invoke = invoker((request) => {
    request.onStart()
    return late.promise
  })
  const ctx = env({ invoke, immediateDeadline: true })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addEvery(ctx.scheduler)
  await runDue(ctx, 1_100)
  const unknown = ctx.scheduler.listOccurrences(job.id)[0]
  await ctx.scheduler.reconcileOccurrence(unknown.occurrenceId, unknown.runId, {
    resolvedTo: 'succeeded',
    evidenceNote: 'operator confirmed the external effect',
  })
  await ctx.scheduler.stop()

  const adopted = await adoptEngine(ctx)
  await adopted.load()
  const settled = adopted.listOccurrences(job.id)[0]
  assert.equal(settled.state, 'succeeded')
  assert.equal(settled.lateSettlement.basis, 'operator-reconcile')
  assert.equal(adopted.isFenced(job.id), false)

  // The settled slot is never re-executed; the next invocation is a future
  // natural slot with its own occurrence identity (past the refire floor).
  ctx.clock.value = 30_000
  await adopted.tick()
  await adopted.whenIdle()
  await adopted.load()
  assert.equal(invoke.calls.length, 2, 'exactly the pre-restart dead slot and the new future slot ran — the settled slot never replays')
  const rows = adopted.listOccurrences(job.id)
  assert.equal(rows.find((record) => record.occurrenceId === settled.occurrenceId).state, 'succeeded')
  const resumed = rows.find((record) => record.occurrenceId !== settled.occurrenceId)
  assert.ok(resumed, 'a future natural slot resumes as a new occurrence')
  await sleep()
  late.resolve({ status: 'outcome_unknown' })
})
