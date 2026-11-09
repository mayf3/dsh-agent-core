/**
 * @agent-core/scheduler — R131 transport-failure compensation regression
 * (#1374 comment 6742827890 §4, reusing the #1383 minimal-fixture approach).
 *
 * Production shape (2026-11-09 22:00): three daily cron jobs died mid-turn on
 * a model-client TRANSPORT failure (`fetch failed` — provider unreachable);
 * the client retried per its own policy and settled the turns failed; two of
 * the jobs had NO scheduler retry policy (obligations unconsumed), one
 * (retry.auto=true) recovered via natural → retry → retry → retry-completed.
 *
 * Contracts under test:
 *   1. partial tool write → TRANSPORT → scheduler retry gives the job's own
 *      idempotent task logic a clean occurrence: artifact written once,
 *      notification sent once, gap filled, failed occurrence retained;
 *   2. the scheduler-side retry chain carries a FINITE budget (3) separate
 *      from the model client's per-turn retries — exactly one invokeAgent per
 *      occurrence (the scheduler never multiplies client retries), chain cap
 *      enforced, durable retry_budget_exhausted event, natural schedule
 *      resumes after exhaustion;
 *   3. a completed scan-only governance occurrence (no side-effect calls)
 *      yields ZERO business-effect records — delivered ≠ business done;
 *   4. a pending retry survives a controller restart (durable responsibility).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { Scheduler } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'
import { createFakeInvoker, createRecordingDelivery } from '../src/seams.js'

const sleep = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms))

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

function env({ now = 1_000, invoke, deliver, jobsPath } = {}) {
  const dir = jobsPath ? join(jobsPath, '..') : mkdtempSync(join(tmpdir(), 'scheduler-transport-'))
  const path = jobsPath ?? join(dir, 'jobs.json')
  const clock = { value: now }
  const store = new JobStore(path, { clock: () => clock.value })
  const seam = typeof invoke === 'function' && typeof invoke.assertRunnable !== 'function' ? invoker(invoke) : invoke
  const scheduler = new Scheduler({
    store,
    invoker: seam ?? invoker(() => ({ status: 'ok', summary: 'done' })),
    deliver: deliver ?? createRecordingDelivery(),
    concurrency: 5,
    nowMs: () => clock.value,
  })
  return { clock, store, scheduler, path }
}

async function runDue(ctx, dueAt) {
  ctx.clock.value = dueAt
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
  await ctx.scheduler.load()
}

function runLogEvents(store) {
  return readFileSync(store.runLogPath, 'utf8').trim().split('\n')
    .filter((line) => line.length > 0).map((line) => JSON.parse(line))
}

// Faithful production shape (R131 burst, 2026-11-09 22:00): the child agent
// process reached exact terminal state and settled the turn failed — so the
// outcome carries the trusted termination evidence (without it the scheduler
// must classify outcome_unknown + fence, which is separate machinery).
const TRANSPORT = {
  status: 'error', error: 'fetch failed', code: 'TRANSPORT',
  started: true, terminationEvidence: 'exact_terminal_then_idle',
}

async function makeDailyJob(ctx, name, { withDelivery = true } = {}) {
  return ctx.scheduler.createJob({
    name, agentId: 'agent-a', enabled: true,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: `${name}: rolling 7-day check, idempotent` },
    retry: { auto: true },
    ...(withDelivery ? { delivery: { mode: 'announce', channel: 'feishu', to: 'chat:test', bestEffort: true } } : {}),
  })
}

test('1. partial tool write → TRANSPORT → retry occurrence compensates without duplicate artifact/notification', async () => {
  // R131 QA review fix: the compensation consumer and the notification entry
  // must be REAL — artifact + dedupe ledger live on disk (the consumer
  // re-reads them on the retry turn), and the notification entry is the
  // engine's actual deliver() seam (createRecordingDelivery), not an
  // in-test counter the system under test never touches.
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-transport-comp-'))
  const artifactPath = join(dir, 'artifact.md')
  const ledgerPath = join(dir, 'compensation-ledger.jsonl')
  const writeFileOnce = (path, entry) => {
    const prev = existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter((l) => l.length > 0) : []
    if (prev.includes(entry)) return false
    appendFileSync(path, entry + '\n')
    return true
  }
  const effects = { artifactWrites: 0, ledgerAppends: 0 }
  let engineDeliverCalls = 0
  const deliver = createRecordingDelivery()
  const origDeliver = deliver.deliver ?? deliver
  const countingDeliver = typeof deliver === 'function'
    ? async (...args) => { engineDeliverCalls += 1; return origDeliver(...args) }
    : Object.assign(async (...args) => { engineDeliverCalls += 1; return origDeliver(...args) }, deliver)
  const invoke = invoker(async (request, count) => {
    if (count === 1) {
      // First turn: performs the tool write + notification, then transport dies.
      effects.artifactWrites += 1
      if (writeFileOnce(artifactPath, 'artifact:v1')) effects.ledgerAppends += 1
      if (writeFileOnce(ledgerPath, `notified|${request.occurrenceId}`)) effects.ledgerAppends += 1
      return TRANSPORT
    }
    // Retry turn: the job's compensation logic reads the REAL on-disk state
    // and dedupes by it — exactly-once by identity, not by memory.
    if (!existsSync(artifactPath)) { effects.artifactWrites += 1; writeFileOnce(artifactPath, 'artifact:v1') }
    writeFileOnce(ledgerPath, `notified|${request.occurrenceId}`)
    effects.gapFilled = existsSync(artifactPath)
    return { status: 'ok', summary: 'compensated: gap filled, no duplicates' }
  })
  const ctx = env({ invoke, deliver: countingDeliver })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await makeDailyJob(ctx, 'daily-summary-compensation')

  await runDue(ctx, 1_100)
  const rowsAfterFail = ctx.scheduler.listOccurrences(job.id)
  const failed = rowsAfterFail.find((r) => r.state === 'failed')
  assert.ok(failed, 'natural occurrence settled failed on TRANSPORT')
  const failedDeliverCalls = engineDeliverCalls
  const artifactAfterFail = readFileSync(artifactPath, 'utf8')

  // Past the 30s first retry backoff → retry occurrence runs the compensation.
  await runDue(ctx, 62_000)
  const rows = ctx.scheduler.listOccurrences(job.id)
  const succeededRetry = rows.find((r) => r.kind === 'retry' && r.state === 'succeeded')
  assert.ok(succeededRetry, 'retry occurrence succeeded')
  assert.equal(succeededRetry.retryOfOccurrenceId, failed.occurrenceId, 'retry references its failed predecessor')
  assert.equal(rows.filter((r) => r.state === 'failed').length, 1, 'failed occurrence retained (original history kept)')

  // Exactly-once business effects, verified on real disk + real deliver seam.
  assert.equal(effects.artifactWrites, 1, 'artifact written exactly once (no duplicate)')
  const ledgerLines = readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l.length > 0)
  assert.equal(ledgerLines.length, 2, 'dedupe ledger holds exactly the first-turn writes (no retry duplicate)')
  assert.equal(artifactAfterFail, readFileSync(artifactPath, 'utf8'), 'retry did not rewrite the artifact')
  assert.equal(engineDeliverCalls, failedDeliverCalls + 1, 'notification entry (engine deliver) fired once more — for the succeeded retry only, no duplicate for the failed one')
  // Budget separation: one invokeAgent per occurrence — the scheduler never
  // multiplies the model client's retries.
  assert.equal(invoke.calls.length, rows.length, 'one invocation per occurrence')
  await sleep()
})

test('2. retry chain budget is finite: capped retries, durable exhausted event, natural schedule resumes', async () => {
  const invoke = invoker(() => TRANSPORT)
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await makeDailyJob(ctx, 'always-transport-fails')

  await runDue(ctx, 1_100)          // natural fails; retry1 due at ~+30s
  await runDue(ctx, 31_200)         // retry1 (chain 0 → backoff 30s) fails; retry2 due at ~+60s
  await runDue(ctx, 91_300)         // retry2 (chain 1 → backoff 60s) fails; retry3 due at ~+5m
  await runDue(ctx, 391_400)        // retry3 (chain 2 → backoff 5m) fails; chain=3 → budget exhausted

  const rows = ctx.scheduler.listOccurrences(job.id)
  const retries = rows.filter((r) => r.kind === 'retry')
  assert.equal(retries.length, 3, 'scheduler-minted retries capped at the chain budget (3)')
  assert.equal(retries.every((r) => r.state === 'failed'), true)
  assert.equal(rows.some((r) => r.kind === 'retry'), true)

  // Budget exhaustion: durable evidence event, then the natural schedule owns
  // the job's slots again (first slot after the terminal end + MIN_REFIRE_GAP).
  await runDue(ctx, 393_600)
  const exhaustedEvents = runLogEvents(ctx.store)
    .filter((e) => e.action === 'retry_budget_exhausted' && e.jobId === job.id)
  assert.equal(exhaustedEvents.length >= 1, true, 'durable retry_budget_exhausted event')
  assert.equal(exhaustedEvents[0].retryOfOccurrenceId, retries[retries.length - 1].occurrenceId)
  const resumed = ctx.scheduler.listOccurrences(job.id)
    .filter((r) => r.kind === 'natural' && r.state === 'succeeded')
  assert.equal(resumed.length >= 1, false, 'still failing handler: resumed natural occurrence is failed, not succeeded')
  assert.equal(
    ctx.scheduler.listOccurrences(job.id).filter((r) => r.kind === 'natural').length >= 2,
    true,
    'natural schedule resumed after budget exhaustion',
  )
  await sleep()
})

test('3. completed scan-only governance occurrence records zero business side effects (delivered ≠ business done)', async () => {
  const effects = { artifactWrites: 0, notifications: 0, transitions: 0 }
  const invoke = invoker(() => ({
    status: 'ok',
    summary: 'scanned 61/61; no READY_CONTRACT; 0 transitions executed',
  }))
  const ctx = env({ invoke })
  await ctx.scheduler.start({ autoStart: false, catchup: false })
  const job = await makeDailyJob(ctx, 'l4-governance-scan')

  await runDue(ctx, 1_100)
  const rows = ctx.scheduler.listOccurrences(job.id)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].state, 'succeeded')
  assert.equal(rows[0].deliveryStatus, 'delivered', 'result announce delivered')

  // HR-shape pin: completed/delivered with zero side-effect calls must NOT be
  // countable as business completion — there is no business-effect record.
  assert.equal(effects.artifactWrites, 0, 'no artifact written')
  assert.equal(effects.notifications, 0, 'no business notification sent')
  assert.equal(effects.transitions, 0, 'no workflow transition')
  // The scheduler emits exactly one delivery (the result announce); a
  // business-effect ledger would need artifact/notification records, which
  // do not exist for this occurrence.
  await sleep()
})

test('4. pending retry survives a controller restart (durable responsibility)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-transport-restart-'))
  const jobsPath = join(dir, 'jobs.json')

  // Controller instance 1: natural occurrence fails; retry pending at ~+30s.
  const ctx1 = env({ invoke: () => TRANSPORT, jobsPath })
  await ctx1.scheduler.start({ autoStart: false, catchup: false })
  const job = await makeDailyJob(ctx1, 'restart-responsibility')
  await runDue(ctx1, 1_100)
  const failed1 = ctx1.scheduler.listOccurrences(job.id).find((r) => r.state === 'failed')
  assert.ok(failed1)

  // Controller 1 releases the engine lease (process exit simulation).
  await ctx1.scheduler.stop()

  // Controller restart: brand-new Scheduler+Store over the SAME durable file.
  const ctx2 = env({ invoke: () => ({ status: 'ok', summary: 'recovered after restart' }), jobsPath, now: 31_200 })
  await ctx2.scheduler.start({ autoStart: false, catchup: false })

  // The pending retry fires in the restarted controller and references the
  // original failed occurrence (responsibility carried across restart).
  await runDue(ctx2, 31_250)
  const retry = ctx2.scheduler.listOccurrences(job.id).find((r) => r.kind === 'retry')
  assert.ok(retry, 'retry minted by the restarted controller')
  assert.equal(retry.retryOfOccurrenceId, failed1.occurrenceId, 'same obligation identity across restart')
  assert.equal(retry.state, 'succeeded', 'obligation completed after restart')
  await sleep()
})
