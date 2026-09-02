import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { HistoryStore } from '../src/history.js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Scheduler } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'
import { createFakeInvoker, createRecordingDelivery } from '../src/seams.js'
import { applyTransition } from '../src/occurrence-model.js'

const sleep = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms))
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function invoker(handler, assertRunnable = () => true) {
  const calls = []
  const invokeAgent = async (request) => {
    calls.push(request)
    return handler(request, calls.length)
  }
  invokeAgent.calls = calls
  invokeAgent.assertRunnable = assertRunnable
  return invokeAgent
}

function env({ now = 1_000, invoke, deliver, concurrency = 5, immediateDeadline = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-v2-'))
  const clock = { value: now }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const actualInvoker = invoke ?? createFakeInvoker()
  const scheduler = new Scheduler({
    store,
    invoker: actualInvoker,
    deliver: deliver ?? createRecordingDelivery(),
    concurrency,
    nowMs: () => clock.value,
    ...(immediateDeadline
      ? {
          deadlineSetTimeout: (fn) => { queueMicrotask(fn); return 1 },
          deadlineClearTimeout: () => {},
        }
      : {}),
  })
  return { dir, clock, store, invoker: actualInvoker, scheduler }
}

async function addAt(scheduler, atMs, extra = {}) {
  return scheduler.createJob({
    name: extra.name ?? 'one-shot',
    agentId: 'agent-a',
    schedule: { kind: 'at', at: new Date(atMs).toISOString() },
    payload: { kind: 'agentTurn', message: 'work', ...(extra.payload ?? {}) },
    delivery: extra.delivery ?? { mode: 'none' },
    deleteAfterRun: extra.deleteAfterRun ?? false,
    ...(extra.retry ? { retry: extra.retry } : {}),
  })
}

async function runDue(ctx, dueAt) {
  ctx.clock.value = dueAt
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
}

for (const [fault, started] of [
  ['TIMEOUT_BEFORE_TURN_START', false],
  ['TIMEOUT_DURING_ACTIVE_TURN', true],
]) {
  test(`ACC-001 ACC-010 ACC-012 ${fault}: timeout without termination proof is outcome_unknown`, async () => {
    const late = deferred()
    let aborted = false
    const invoke = invoker((request) => {
      request.signal.addEventListener('abort', () => { aborted = true }, { once: true })
      if (started) request.onStart()
      return late.promise
    })
    const ctx = env({ invoke, immediateDeadline: true })
    await ctx.scheduler.start({ autoStart: false, catchup: false })
    const job = await addAt(ctx.scheduler, 2_000)
    await runDue(ctx, 2_000)
    const [record] = ctx.scheduler.listOccurrences(job.id)
    assert.equal(record.state, 'outcome_unknown')
    assert.equal(record.executionOutcome, undefined)
    assert.equal(ctx.scheduler.isFenced(job.id), true)
    assert.equal(aborted, true, 'ABORT_SENT_WITHOUT_TERMINATION')
    assert.equal(invoke.calls.length, 1)
    late.resolve({ status: 'outcome_unknown' })
    await sleep()
    await ctx.scheduler.load()
    assert.equal(ctx.scheduler.listOccurrences(job.id)[0].state, 'outcome_unknown')
  })
}

test('ACC-002/003 OUTCOME_UNKNOWN_NO_RETRY + UNKNOWN_FENCES_LATER_SAME_JOB_OCCURRENCE', async () => {
  const invoke = invoker(async (request) => {
    request.onStart()
    return new Promise(() => {})
  })
  const ctx = env({ invoke, immediateDeadline: true })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await ctx.scheduler.createJob({
    name: 'recurring', agentId: 'agent-a', enabled: true,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'x' }, retry: { auto: true },
  })
  await runDue(ctx, 1_100)
  ctx.clock.value = 2_000
  await ctx.scheduler.tick()
  await ctx.scheduler.load()
  assert.equal(invoke.calls.length, 1)
  assert.equal(ctx.scheduler.listOccurrences(job.id).length, 1)
  assert.equal(ctx.scheduler.isFenced(job.id), true)
})

test('ACC-003/029 OPERATOR_RECONCILE_RESOLVES_FENCE + FENCE_RELEASE_NO_BACKLOG_REPLAY', async () => {
  const late = deferred()
  const invoke = invoker((request, count) => {
    request.onStart()
    return count === 1 ? late.promise : Promise.resolve({ status: 'ok', summary: 'next' })
  })
  const ctx = env({ invoke, immediateDeadline: true })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await ctx.scheduler.createJob({
    name: 'fenced', agentId: 'agent-a', schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'x' },
  })
  await runDue(ctx, 1_100)
  const unknown = ctx.scheduler.listOccurrences(job.id)[0]
  ctx.clock.value = 2_000
  await ctx.scheduler.reconcileOccurrence(unknown.occurrenceId, unknown.runId, {
    resolvedTo: 'failed', evidenceNote: 'operator verified exact turn termination',
  })
  await ctx.scheduler.tick()
  assert.equal(invoke.calls.length, 1, 'no backlog replay at reconciliation time')
  ctx.clock.value = 4_100
  await runDue(ctx, 4_100)
  assert.equal(invoke.calls.length, 2, 'only a future natural slot resumes')
  const rows = ctx.scheduler.listOccurrences(job.id)
  assert.equal(rows[0].history.some((entry) => entry.to === 'outcome_unknown'), true)
  assert.equal(rows[0].lateSettlement.basis, 'operator-reconcile')
  late.resolve({ status: 'outcome_unknown' })
})

test('ACC-004 delivery failure never rewrites proven execution success', async () => {
  const deliver = async () => { throw new Error('channel unavailable') }
  const ctx = env({ deliver })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addAt(ctx.scheduler, 2_000, { delivery: { mode: 'announce', channel: 'feishu', to: 'chat:x' } })
  await runDue(ctx, 2_000)
  const [record] = ctx.scheduler.listOccurrences(job.id)
  assert.equal(record.state, 'succeeded')
  assert.equal(record.deliveryStatus, 'not-delivered')
})

test('ACC-004 pre-start rejection is failed; post-start unproven carrier is unknown', async () => {
  const pre = env({ invoke: invoker(async () => ({ status: 'error', error: 'AGENT_DISABLED', started: false })) })
  await pre.scheduler.start({ autoStart: false, catchup: false })
  const first = await addAt(pre.scheduler, 2_000)
  await runDue(pre, 2_000)
  assert.equal(pre.scheduler.listOccurrences(first.id)[0].state, 'failed')

  const post = env({ invoke: invoker(async (request) => {
    request.onStart()
    return { status: 'error', error: 'pipe failed without proof', started: true }
  }) })
  await post.scheduler.start({ autoStart: false, catchup: false })
  const second = await addAt(post.scheduler, 2_000)
  await runDue(post, 2_000)
  assert.equal(post.scheduler.listOccurrences(second.id)[0].state, 'outcome_unknown')
})

test('ACC-011 immediate unknown reconciliation evidence is observable and keyed', async () => {
  const invoke = invoker(async (request) => {
    request.onStart()
    return {
      status: 'outcome_unknown', error: 'AgentProcess deadline', started: true,
      reconciliationHandle: 'turn:exact-1', deadlineAtWallMs: 9_999,
      evidence: { source: 'turn_deadline_exceeded', promptReceipt: 'accepted' },
    }
  })
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addAt(ctx.scheduler, 2_000)
  await runDue(ctx, 2_000)
  const [record] = ctx.scheduler.listOccurrences(job.id)
  const events = await ctx.store.readRunEvents()
  const evidence = events.find((event) => event.action === 'router_admission' && event.phase === 'outcome_unknown')
  assert.equal(record.state, 'outcome_unknown')
  assert.equal(evidence.occurrenceId, record.occurrenceId)
  assert.equal(evidence.runId, record.runId)
  assert.equal(evidence.reconciliationHandle, 'turn:exact-1')
  assert.equal(evidence.evidence.source, 'turn_deadline_exceeded')
})

test('ACC-005/008/026 CONCURRENT_DUE_TICKS_SAME_OCCURRENCE admits once', async () => {
  const gate = deferred()
  const invoke = invoker(async (request) => { request.onStart(); return gate.promise })
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addAt(ctx.scheduler, 2_000)
  ctx.clock.value = 2_000
  await Promise.all([ctx.scheduler.tick(), ctx.scheduler.tick(), ctx.scheduler.tick()])
  for (let attempt = 0; invoke.calls.length === 0 && attempt < 100; attempt += 1) await sleep(10)
  assert.equal(invoke.calls.length, 1)
  gate.resolve({ status: 'ok', summary: 'done' })
  await ctx.scheduler.whenIdle()
  ctx.clock.value = 3_000
  await ctx.scheduler.tick()
  assert.equal(ctx.scheduler.listOccurrences(job.id).length, 1)
  assert.equal(invoke.calls.length, 1)
})

for (const [fault, persistedState] of [
  ['RESTART_AFTER_ADMITTED_BEFORE_ROUTER', 'admitted'],
  ['RESTART_AFTER_ROUTER_BEFORE_RECEIPT / PROCESS_EXIT_WITHOUT_TURN_ATTRIBUTION', 'running'],
]) {
  test(`ACC-007 ${fault}`, async () => {
    const ctx = env()
    await ctx.scheduler.start({ autoStart: false, catchup: false })
    const job = await addAt(ctx.scheduler, 2_000)
    ctx.clock.value = 2_000
    await ctx.scheduler.load()
    const candidate = { kind: 'natural', job: ctx.scheduler.snapshotJobs()[0], nominalScheduledAt: 2_000 }
    const reserved = await ctx.scheduler._reserve(candidate)
    if (persistedState === 'running') {
      await ctx.store.mutateDoc((doc) => {
        applyTransition(doc.occurrences[0], {
          to: 'running', at: 2_000, reason: 'Router dispatched before process exit',
          startedAt: 2_000, nativeSessionId: reserved.record.nativeSessionId,
        })
      })
    }
    await ctx.scheduler.stop() // simulate the prior engine process exiting and releasing its lease
    const restartInvoker = createFakeInvoker()
    const restarted = new Scheduler({ store: ctx.store, invoker: restartInvoker, nowMs: () => ctx.clock.value })
    await restarted.start({ autoStart: false, catchup: persistedState !== 'running' })
    const [record] = restarted.listOccurrences(job.id)
    assert.equal(record.state, 'outcome_unknown')
    assert.equal(restarted.isFenced(job.id), true)
    await restarted.tick()
    assert.equal(restartInvoker.calls.length, 0)
  })
}

test('ACC-007 live engine lease prevents recovery from sweeping a peer turn', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const peerStore = new JobStore(ctx.store.filePath, { clock: () => ctx.clock.value, lockTimeoutMs: 100 })
  const peer = new Scheduler({ store: peerStore, invoker: createFakeInvoker(), nowMs: () => ctx.clock.value })
  await assert.rejects(() => peer.start({ autoStart: false, catchup: false }), /engine\.lock.*live or unverifiable owner/)
  await ctx.scheduler.stop()
  await peer.start({ autoStart: false, catchup: false })
  await peer.stop()
})

test('ACC-008/024 IDEMPOTENT_KEY_SAME_PAYLOAD_NO_SECOND_ENQUEUE and PAYLOAD_HASH_CONFLICT', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  await addAt(ctx.scheduler, 2_000)
  ctx.clock.value = 2_000
  await ctx.scheduler.load()
  const candidate = { kind: 'natural', job: ctx.scheduler.snapshotJobs()[0], nominalScheduledAt: 2_000 }
  const first = await ctx.scheduler._reserve(candidate)
  const same = await ctx.scheduler._reserve(candidate)
  assert.equal(first.record.occurrenceId, same.record.occurrenceId)
  assert.equal(same.deduped, true)
  await ctx.store.mutateDoc((doc) => { doc.jobs[0].payload.message = 'different' })
  await ctx.scheduler.load()
  candidate.job = ctx.scheduler.snapshotJobs()[0]
  await assert.rejects(() => ctx.scheduler._reserve(candidate), (error) => error.code === 'OCCURRENCE_PAYLOAD_CONFLICT')
})

test('ACC-026 stale pre-scan candidate cannot cross disable-to-enable activation boundary', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  await ctx.scheduler.createJob({
    name: 'reactivate', agentId: 'agent-a', schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'x' },
  })
  const stale = { kind: 'natural', job: ctx.scheduler.snapshotJobs()[0], nominalScheduledAt: 1_100 }
  await ctx.scheduler.disableJob(stale.job.id)
  ctx.clock.value = 2_000
  await ctx.scheduler.enableJob(stale.job.id)
  const reserved = await ctx.scheduler._reserve(stale)
  assert.equal(reserved, null)
  assert.equal(ctx.scheduler.listOccurrences(stale.job.id).length, 0)
})

test('ACC-009 ORDINARY_FAILED_RETRY_NEW_OCCURRENCE', async () => {
  const invoke = invoker(async (request, count) => {
    if (count === 1) return { status: 'error', error: 'pre-start rejection', started: false }
    request.onStart()
    return { status: 'ok', summary: 'retried' }
  })
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addAt(ctx.scheduler, 2_000, { retry: { auto: true } })
  await runDue(ctx, 2_000)
  ctx.clock.value = 32_000
  await runDue(ctx, 32_000)
  const rows = ctx.scheduler.listOccurrences(job.id)
  assert.equal(rows.length, 2)
  assert.equal(rows[1].kind, 'retry')
  assert.equal(rows[1].retryOfOccurrenceId, rows[0].occurrenceId)
  assert.notEqual(rows[1].occurrenceId, rows[0].occurrenceId)
  assert.notEqual(rows[1].runId, rows[0].runId)
})

for (const [fault, lateOutcome, expected] of [
  ['LATE_SUCCESS_AFTER_TIMEOUT', { status: 'ok', summary: 'late' }, 'succeeded'],
  ['LATE_FAILURE_AFTER_TIMEOUT', { status: 'error', error: 'terminal', started: true, evidence: { terminationEvidence: 'exact_terminal_then_idle' } }, 'failed'],
  ['LATE_EXTERNAL_SIDE_EFFECT_AFTER_TIMEOUT', { status: 'ok', summary: 'late', evidence: { externalEffectReceipt: 'ext-42' } }, 'succeeded'],
]) {
  test(`ACC-011 ${fault}: trusted exact-turn settlement resolves without re-admission`, async () => {
    const late = deferred()
    const invoke = invoker((request) => { request.onStart(); return late.promise })
    const ctx = env({ invoke, immediateDeadline: true })
    await ctx.scheduler.start({ autoStart: false, catchup: false })
    const job = await addAt(ctx.scheduler, 2_000)
    await runDue(ctx, 2_000)
    assert.equal(ctx.scheduler.listOccurrences(job.id)[0].state, 'outcome_unknown')
    late.resolve(lateOutcome)
    let record
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await sleep(10)
      await ctx.scheduler.load()
      record = ctx.scheduler.listOccurrences(job.id)[0]
      if (record.state === expected) break
    }
    assert.equal(record.state, expected)
    assert.equal(record.lateSettlement.basis, 'trusted-late-evidence')
    if (fault === 'LATE_EXTERNAL_SIDE_EFFECT_AFTER_TIMEOUT') {
      assert.match(record.lateSettlement.evidenceRef, /ext-42/)
      let persisted = false
      for (let attempt = 0; !persisted && attempt < 100; attempt += 1) {
        await sleep(10)
        persisted = (await ctx.store.readRunEvents())
          .some((event) => event.evidence?.externalEffectReceipt === 'ext-42')
      }
      assert.equal(persisted, true)
    }
    assert.equal(invoke.calls.length, 1)
  })
}

test('ACC-012 pre-admission queue time is excluded from persisted deadline', async () => {
  const first = deferred()
  const invoke = invoker(async (request, count) => {
    request.onStart()
    return count === 1 ? first.promise : { status: 'ok', summary: 'second' }
  })
  const ctx = env({ invoke, concurrency: 1 })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const a = await addAt(ctx.scheduler, 2_000, { name: 'a' })
  const b = await addAt(ctx.scheduler, 2_000, { name: 'b' })
  ctx.clock.value = 2_000
  await ctx.scheduler.tick()
  assert.equal(ctx.scheduler.listOccurrences(b.id).length, 0)
  ctx.clock.value = 50_000
  first.resolve({ status: 'ok', summary: 'first' })
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  const second = ctx.scheduler.listOccurrences(b.id)[0]
  assert.equal(second.admittedAt, 50_000)
  assert.ok(second.executionDeadlineAtMs > 50_000)
  assert.equal(ctx.scheduler.listOccurrences(a.id)[0].state, 'succeeded')
})

test('ACC-012/025 mutation-lock wait is excluded from admittedAt/deadline', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  await addAt(ctx.scheduler, 2_000, { payload: { timeoutSeconds: 12 } })
  ctx.clock.value = 2_000
  await ctx.scheduler.load()
  const candidate = { kind: 'natural', job: ctx.scheduler.snapshotJobs()[0], nominalScheduledAt: 2_000 }
  const hold = deferred()
  const entered = deferred()
  const blocker = ctx.store.mutateDoc(async () => { entered.resolve(); await hold.promise })
  await entered.promise
  const pendingReserve = ctx.scheduler._reserve(candidate)
  ctx.clock.value = 5_000
  hold.resolve()
  await blocker
  const reserved = await pendingReserve
  assert.equal(reserved.record.admittedAt, 5_000)
  assert.equal(reserved.record.executionDeadlineAtMs, 17_000)
})

test('ACC-013/031 FRESH_SESSION_PER_OCCURRENCE uses distinct non-main sessions', async () => {
  const invoke = createFakeInvoker()
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await ctx.scheduler.createJob({
    name: 'sessions', agentId: 'agent-a', schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'x' },
  })
  await runDue(ctx, 1_100)
  ctx.clock.value = 3_200
  await runDue(ctx, 3_200)
  assert.equal(invoke.calls.length, 2)
  assert.notEqual(invoke.calls[0].sessionId, invoke.calls[1].sessionId)
  assert.notEqual(invoke.calls[0].sessionId, 'main')
  assert.equal(invoke.calls[0].agentId, invoke.calls[1].agentId)
  assert.equal(ctx.scheduler.listOccurrences(job.id).length, 2)
})

test('ACC-025 execution deadline is durable from admittedAt', async () => {
  const ctx = env()
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  await addAt(ctx.scheduler, 2_000, { payload: { timeoutSeconds: 12 } })
  await runDue(ctx, 2_000)
  const record = (await ctx.store.loadDoc({ force: true })).occurrences[0]
  assert.equal(record.executionDeadlineAtMs, record.admittedAt + 12_000)
})

test('ACC-026/027 CONCURRENT_CLI_DISABLE_DURING_ADMITTED_OCCURRENCE preserves disable and outcome', async () => {
  const gate = deferred()
  const invoke = invoker(async (request) => { request.onStart(); return gate.promise })
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addAt(ctx.scheduler, 2_000)
  ctx.clock.value = 2_000
  await ctx.scheduler.tick()
  await ctx.scheduler.disableJob(job.id)
  gate.resolve({ status: 'ok', summary: 'done' })
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
  assert.equal((await ctx.scheduler.getJob(job.id)).enabled, false)
  assert.equal(ctx.scheduler.listOccurrences(job.id)[0].state, 'succeeded')
})

test('ACC-027 deleted Job is not resurrected by occurrence writeback', async () => {
  const gate = deferred()
  const invoke = invoker(async (request) => { request.onStart(); return gate.promise })
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addAt(ctx.scheduler, 2_000)
  ctx.clock.value = 2_000
  await ctx.scheduler.tick()
  await ctx.scheduler.deleteJob(job.id)
  gate.resolve({ status: 'ok', summary: 'done' })
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
  assert.equal(await ctx.scheduler.getJob(job.id), undefined)
  assert.equal(ctx.scheduler.listOccurrences(job.id)[0].state, 'succeeded')
})

test('ACC-030 stale legacy summaries do not affect admission', async () => {
  const ctx = env()
  await ctx.store.mutateDoc((doc) => {
    doc.jobs.push({
      id: 'legacy', name: 'legacy', agentId: 'agent-a', enabled: true,
      scheduleRevision: 1, revisionActivatedAtMs: 1_000, createdAtMs: 1_000, updatedAtMs: 1_000,
      schedule: { kind: 'at', at: new Date(2_000).toISOString() },
      payload: { kind: 'agentTurn', message: 'x' }, delivery: { mode: 'none' },
      deleteAfterRun: false, state: { runningAtMs: 1, nextRunAtMs: 999_999 },
    })
  })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  await runDue(ctx, 2_000)
  assert.equal(ctx.invoker.calls.length, 1)
})

test('ACC-032 runnable eligibility is checked before reserve and Router', async () => {
  const invoke = invoker(async () => ({ status: 'ok' }), () => {
    throw Object.assign(new Error('disabled'), { code: 'AGENT_DISABLED' })
  })
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await addAt(ctx.scheduler, 2_000)
  ctx.clock.value = 2_000
  await assert.rejects(() => ctx.scheduler.tick(), (error) => error.code === 'AGENT_DISABLED')
  assert.equal(invoke.calls.length, 0)
  assert.equal((await ctx.store.loadDoc({ force: true })).occurrences.length, 0)
  assert.equal((await ctx.scheduler.getJob(job.id)).enabled, true)
})

// ── AGENT_CORE_SCHEDULER_RUN_HISTORY_V1: engine-boundary history hooks ──────

test('HIST history hooks fire at the engine lifecycle boundaries (reserve/start/terminal/delivery)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-hist-'))
  const clock = { value: Date.parse('2026-09-01T00:00:00Z') }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const history = new HistoryStore({ dir: join(dir, 'history'), nowMs: () => clock.value })
  const scheduler = new Scheduler({
    store,
    invoker: createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's', durationMs: 1 } }),
    deliver: createRecordingDelivery(),
    history,
    nowMs: () => clock.value,
  })
  await scheduler.createJob({
    id: 'hooked', name: 'Hooked', agentId: 'agt_h',
    payload: { kind: 'agentTurn', message: 'm' },
    schedule: { kind: 'every', everyMs: 1_000, anchorMs: clock.value },
    delivery: { mode: 'announce' },
  })
  await scheduler.start({ autoStart: false, catchup: false })
  clock.value += 1_000
  await scheduler.tick()
  await scheduler.whenIdle()
  await new Promise((resolve) => setTimeout(resolve, 30))

  const { runs } = history.queryRuns({ jobId: 'hooked' })
  assert.equal(runs.length, 1)
  assert.equal(runs[0].outcome, 'succeeded')
  assert.equal(runs[0].start_evidence, 'invoker-dispatch', 'start evidence from the onDispatch hook')
  assert.ok(runs[0].started_at !== null)
  assert.equal(runs[0].delivery_status, 'delivered')

  const events = readFileSync(join(dir, 'history', 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const types = events.map((e) => e.type)
  for (const expected of ['occurrence_reserved', 'run_state', 'run_terminal', 'delivery_outcome', 'fence_event']) {
    assert.ok(types.includes(expected), `event stream carries ${expected}`)
  }
  await scheduler.stop()
})

test('HIST pre-start rejection records AGENT_DISABLED error_code (R10)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-hist2-'))
  const clock = { value: Date.parse('2026-09-01T00:00:00Z') }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const history = new HistoryStore({ dir: join(dir, 'history'), nowMs: () => clock.value })
  const rejectingInvoker = async () => ({ status: 'error', error: 'scheduler-router: agent agt_h is disabled (not runnable)', started: false })
  rejectingInvoker.assertRunnable = () => true
  const scheduler = new Scheduler({
    store,
    invoker: rejectingInvoker,
    deliver: createRecordingDelivery(),
    history,
    nowMs: () => clock.value,
  })
  await scheduler.createJob({
    id: 'rejected', name: 'Rejected', agentId: 'agt_h',
    payload: { kind: 'agentTurn', message: 'm' },
    schedule: { kind: 'every', everyMs: 1_000, anchorMs: clock.value },
    delivery: { mode: 'none' },
  })
  await scheduler.start({ autoStart: false, catchup: false })
  clock.value += 1_000
  await scheduler.tick()
  await scheduler.whenIdle()
  await new Promise((resolve) => setTimeout(resolve, 30))

  const { runs } = history.queryRuns({ jobId: 'rejected', status: 'failed' })
  assert.equal(runs.length, 1)
  assert.equal(runs[0].error_code, 'AGENT_DISABLED')
  assert.equal(runs[0].outcome, 'failed')
  await scheduler.stop()
})

test('HIST restart sweep records outcome_unknown + fence event; late settlement records resolution', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-hist3-'))
  const clock = { value: Date.parse('2026-09-01T00:00:00Z') }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const history = new HistoryStore({ dir: join(dir, 'history'), nowMs: () => clock.value })
  const scheduler = new Scheduler({
    store,
    invoker: createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's', durationMs: 1 } }),
    deliver: createRecordingDelivery(),
    history,
    nowMs: () => clock.value,
  })
  await scheduler.createJob({
    id: 'swept', name: 'Swept', agentId: 'agt_h',
    payload: { kind: 'agentTurn', message: 'm', timeoutSeconds: 1 },
    schedule: { kind: 'every', everyMs: 60_000, anchorMs: clock.value },
    delivery: { mode: 'none' },
  })
  await scheduler.start({ autoStart: false, catchup: false })
  clock.value += 60_000
  const job = scheduler.doc.jobs[0]
  const reserved = await scheduler._reserve({ kind: 'natural', job, nominalScheduledAt: clock.value })
  assert.ok(reserved?.record, 'occurrence admitted')
  // engine "crashes" (no terminal writeback); a NEW engine's mandatory
  // recovery sweep must classify the orphaned admission outcome_unknown.
  await scheduler.stop()

  const scheduler2 = new Scheduler({
    store,
    invoker: createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's', durationMs: 1 } }),
    deliver: createRecordingDelivery(),
    history,
    nowMs: () => clock.value,
  })
  await scheduler2.start({ autoStart: false, catchup: false })
  await history.ensureLoaded()
  const { runs } = history.queryRuns({ jobId: 'swept', status: 'outcome_unknown' })
  assert.equal(runs.length, 1, 'swept run recorded as outcome_unknown')
  assert.equal(runs[0].error_code, null, 'sweep reason is not a timeout classification')
  const events = readFileSync(join(dir, 'history', 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.ok(events.some((e) => e.type === 'fence_event' && e.fence === 'active'), 'fence activated in history')

  // operator reconcile resolves and records late_settlement
  const occurrenceId = runs[0].occurrence_id
  const runId = runs[0].run_id
  await scheduler2.reconcileOccurrence(occurrenceId, runId, { resolvedTo: 'succeeded', evidenceNote: 'operator confirmed the external effect' })
  await new Promise((resolve) => setTimeout(resolve, 30))
  const settled = history.getRun(runId)
  assert.equal(settled.outcome, 'succeeded', 'late settlement advances the mirrored state')
  const events2 = readFileSync(join(dir, 'history', 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const settlement = events2.find((e) => e.type === 'late_settlement')
  assert.ok(settlement, 'late_settlement event recorded')
  assert.equal(settlement.basis, 'operator-reconcile')
  assert.ok(events2.some((e) => e.type === 'fence_event' && e.fence === 'cleared'), 'fence cleared in history')
  await scheduler2.stop()
})
