import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Scheduler, computeJobNextRunAtMs } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'
import { createFakeInvoker, createRecordingDelivery, defaultSessionId } from '../src/seams.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function makeEnv({ outcome = null, delayMs = 0, tickMs = 50, deliver = createRecordingDelivery() } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sched-test-'))
  const store = new JobStore(join(dir, 'jobs.json'))
  const invoker = createFakeInvoker({ outcome, delayMs })
  const scheduler = new Scheduler({ store, invoker, deliver, tickMs })
  return { dir, store, invoker, deliver, scheduler }
}

const atJob = (ms) => ({ kind: 'at', at: new Date(ms).toISOString() })
const cronEveryMinute = { kind: 'cron', expr: '* * * * *' }

test('acceptance #1: create recurring (cron) job with a computed next run', async () => {
  const { scheduler } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'daily',
    agentId: 'a1',
    schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' },
    payload: { message: 'do the daily thing' },
  })
  assert.ok(job.id)
  assert.ok(job.nextRunAtMs > Date.now())
  assert.equal(job.schedule.kind, 'cron')
  await scheduler.stop()
})

test('acceptance #2: create one-shot (at) job', async () => {
  const { scheduler } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'oneshot',
    agentId: 'a1',
    schedule: atJob(Date.now() + 60_000),
    payload: { message: 'ping' },
  })
  assert.equal(job.schedule.kind, 'at')
  assert.ok(job.nextRunAtMs > Date.now())
  await scheduler.stop()
})

test('acceptance #3: disable stops execution; enable resumes it', async () => {
  const { scheduler, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'flaky',
    agentId: 'a1',
    schedule: atJob(Date.now() + 30),
    payload: { message: 'run me' },
  })
  await scheduler.disableJob(job.id)
  await sleep(150)
  await scheduler.tick()
  assert.equal(invoker.calls.length, 0, 'disabled job must not run')
  const disabled = await scheduler.getJob(job.id)
  assert.equal(disabled.enabled, false)
  assert.equal(disabled.nextRunAtMs, undefined)

  await scheduler.enableJob(job.id)
  assert.equal((await scheduler.getJob(job.id)).enabled, true)
  // the at time already passed -> enable recomputes: at past => nextRunAtMs undefined,
  // so we switch to a fresh at job to observe the fire
  const job2 = await scheduler.createJob({
    name: 'flaky2',
    agentId: 'a1',
    schedule: atJob(Date.now() + 30),
    payload: { message: 'run me too' },
  })
  await sleep(150)
  await scheduler.tick()
  assert.equal(invoker.calls.length, 1, 'enabled job fires when due')
  assert.equal(invoker.calls[0].agentId, 'a1')
  await scheduler.stop()
})

test('acceptance #4: due job invokes the fake agent invoker with the right request', async () => {
  const { scheduler, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'invoke-me',
    agentId: 'stock-agent',
    schedule: atJob(Date.now() + 30),
    payload: { message: 'tick-tock', model: 'opencode-go/deepseek-v4-flash', lightContext: true, timeoutSeconds: 600 },
  })
  await sleep(150)
  await scheduler.tick()
  assert.equal(invoker.calls.length, 1)
  const call = invoker.calls[0]
  assert.equal(call.agentId, 'stock-agent')
  assert.equal(call.message, 'tick-tock')
  assert.equal(call.model, 'opencode-go/deepseek-v4-flash')
  assert.equal(call.lightContext, true)
  assert.equal(call.timeoutMs, 600_000)
  assert.equal(call.sessionId, defaultSessionId({ id: job.id, agentId: 'stock-agent', sessionKey: undefined }))
  await scheduler.stop()
})

test('acceptance #5: restart restores jobs and resumes scheduling', async () => {
  const { dir, scheduler, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  const cron = await scheduler.createJob({
    name: 'persist-me', agentId: 'a1', schedule: cronEveryMinute, payload: { message: 'x' },
  })
  const at = await scheduler.createJob({
    name: 'persist-at', agentId: 'a2', schedule: atJob(Date.now() + 120_000), payload: { message: 'y' },
  })
  await scheduler.stop()

  // "restart": a brand-new engine over the same store
  const store2 = new JobStore(join(dir, 'jobs.json'))
  const invoker2 = createFakeInvoker()
  const scheduler2 = new Scheduler({ store: store2, invoker: invoker2, deliver: createRecordingDelivery(), tickMs: 50 })
  await scheduler2.start({ autoStart: false })
  const jobs = await scheduler2.listJobs()
  assert.equal(jobs.length, 2)
  const restoredCron = jobs.find((j) => j.id === cron.id)
  const restoredAt = jobs.find((j) => j.id === at.id)
  assert.equal(restoredCron.enabled, true)
  assert.ok(restoredCron.nextRunAtMs > Date.now())
  assert.equal(restoredAt.schedule.at, at.schedule.at)
  assert.equal(restoredAt.nextRunAtMs, at.nextRunAtMs)
  assert.equal(invoker2.calls.length, 0, 'no immediate re-fire after restart when not due')
  await scheduler2.stop()
})

test('acceptance #6: disabled job never runs, including after restart', async () => {
  const { dir, scheduler, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'off', agentId: 'a1', schedule: atJob(Date.now() + 30), payload: { message: 'x' },
  })
  await scheduler.disableJob(job.id)
  await scheduler.stop()

  const store2 = new JobStore(join(dir, 'jobs.json'))
  const invoker2 = createFakeInvoker()
  const scheduler2 = new Scheduler({ store: store2, invoker: invoker2, deliver: createRecordingDelivery() })
  await scheduler2.start({ autoStart: false })
  await scheduler2.tick()
  assert.equal(invoker2.calls.length, 0)
  assert.equal((await scheduler2.getJob(job.id)).enabled, false)
  await scheduler2.stop()
})

test('acceptance #7: one-shot job does not repeat (success -> deleted)', async () => {
  const { dir, scheduler, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'once', agentId: 'a1', schedule: atJob(Date.now() + 30), payload: { message: 'x' },
  })
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(invoker.calls.length, 1)
  assert.equal(await scheduler.getJob(job.id), undefined, 'deleteAfterRun removes the job')

  // restart: nothing to re-run
  const store2 = new JobStore(join(dir, 'jobs.json'))
  const invoker2 = createFakeInvoker()
  const scheduler2 = new Scheduler({ store: store2, invoker: invoker2, deliver: createRecordingDelivery() })
  await scheduler2.start({ autoStart: false })
  await scheduler2.tick()
  assert.equal(invoker2.calls.length, 0, 'one-shot must not re-fire after restart')
  await scheduler2.stop()
})

test('acceptance #7b: one-shot without deleteAfterRun is disabled, not deleted, and never re-runs', async () => {
  const { scheduler, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'keep', agentId: 'a1', deleteAfterRun: false,
    schedule: atJob(Date.now() + 30), payload: { message: 'x' },
  })
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(invoker.calls.length, 1)
  const after = await scheduler.getJob(job.id)
  assert.ok(after, 'job record kept')
  assert.equal(after.enabled, false, 'disabled after one-shot success')
  assert.equal(after.nextRunAtMs, undefined)
  await sleep(120)
  await scheduler.tick()
  assert.equal(invoker.calls.length, 1, 'never re-runs')
  await scheduler.stop()
})

test('acceptance #8: recurring job computes the next run after each fire', async () => {
  const { scheduler, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'recur', agentId: 'a1', schedule: cronEveryMinute, payload: { message: 'x' },
  })
  // simulate the occurrence passing: force nextRunAtMs into the past, then tick
  const raw = scheduler.snapshotJobs()[0]
  raw.state.nextRunAtMs = Date.now() - 10
  raw.state.lastRunAtMs = Date.now() - 60_000
  await scheduler.store.persist([raw])
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(invoker.calls.length, 1)
  const after = await scheduler.getJob(job.id)
  assert.ok(after.nextRunAtMs > Date.now(), `next run in the future: ${after.nextRunAtMs}`)
  assert.equal(after.lastStatus, 'ok')
  assert.equal(after.consecutiveErrors, 0)
  await scheduler.stop()
})

test('acceptance #9: jobs for different agents are isolated (separate invocations)', async () => {
  const { scheduler, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  await scheduler.createJob({ name: 'j1', agentId: 'agent-a', schedule: atJob(Date.now() + 30), payload: { message: 'm1' } })
  await scheduler.createJob({ name: 'j2', agentId: 'agent-b', schedule: atJob(Date.now() + 30), payload: { message: 'm2' } })
  await scheduler.createJob({ name: 'j3', agentId: 'agent-c', schedule: atJob(Date.now() + 30), payload: { message: 'm3' } })
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.deepEqual(
    invoker.calls.map((c) => [c.agentId, c.message]).sort(),
    [['agent-a', 'm1'], ['agent-b', 'm2'], ['agent-c', 'm3']],
  )
  await scheduler.stop()
})

test('acceptance #10: announce target is passed verbatim to the delivery seam', async () => {
  const { scheduler, invoker, deliver } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'announcer', agentId: 'stock-agent',
    schedule: atJob(Date.now() + 30),
    payload: { message: 'produce a report' },
    delivery: { mode: 'announce', channel: 'feishu', to: 'chat:oc_0480991b97f1e27c96514ac66b4f122c' },
    deleteAfterRun: false, // keep the record so lastDeliveryStatus is observable
  })
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(invoker.calls.length, 1)
  assert.deepEqual(invoker.calls[0].deliveryTarget, { mode: 'announce', channel: 'feishu', to: 'chat:oc_0480991b97f1e27c96514ac66b4f122c' })
  assert.equal(deliver.deliveries.length, 1)
  const d = deliver.deliveries[0]
  assert.equal(d.jobId, job.id)
  assert.equal(d.mode, 'announce')
  assert.equal(d.channel, 'feishu')
  assert.equal(d.to, 'chat:oc_0480991b97f1e27c96514ac66b4f122c')
  assert.equal(d.text, 'ok')
  assert.equal((await scheduler.getJob(job.id)).lastDeliveryStatus, 'delivered')
  await scheduler.stop()
})

test('restart near due: cron job missed while down fires exactly once on restart', async () => {
  const { dir } = makeEnv()
  const store1 = new JobStore(join(dir, 'jobs.json'))
  const s1 = new Scheduler({ store: store1, invoker: createFakeInvoker(), deliver: createRecordingDelivery() })
  await s1.start({ autoStart: false })
  // daily 09:00 Asia/Shanghai job; last ran yesterday
  const now = Date.now()
  const yesterday = now - 86_400_000
  const job = await s1.createJob({
    name: 'daily', agentId: 'a1',
    schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' },
    payload: { message: 'x' },
  })
  const raw = s1.snapshotJobs()[0]
  raw.state.lastRunAtMs = yesterday
  raw.state.lastStatus = 'ok'
  raw.state.lastRunStatus = 'ok'
  raw.state.nextRunAtMs = now - 3_600_000 // today's 09:00 passed while "down"
  await s1.stop() // stop FIRST (stop() persists the in-memory view)
  await store1.persist([raw]) // then overwrite with the "downtime" state

  const store2 = new JobStore(join(dir, 'jobs.json'))
  const invoker2 = createFakeInvoker()
  const s2 = new Scheduler({ store: store2, invoker: invoker2, deliver: createRecordingDelivery() })
  await s2.start({ autoStart: false })
  await s2.whenIdle()
  assert.equal(invoker2.calls.length, 1, 'missed cron occurrence caught up exactly once')
  const after = await s2.getJob(job.id)
  assert.ok(after.nextRunAtMs > Date.now(), 'next run recomputed into the future')
  await s2.stop()
})

test('restart near due: at job due while down fires once; already-run at job never re-fires', async () => {
  const { dir } = makeEnv()
  const store1 = new JobStore(join(dir, 'jobs.json'))
  const s1 = new Scheduler({ store: store1, invoker: createFakeInvoker(), deliver: createRecordingDelivery() })
  await s1.start({ autoStart: false })
  const due = await s1.createJob({
    name: 'due-while-down', agentId: 'a1',
    schedule: atJob(Date.now() + 60_000), payload: { message: 'x' },
  })
  const done = await s1.createJob({
    name: 'already-done', agentId: 'a1',
    schedule: atJob(Date.now() + 60_000), payload: { message: 'x' },
  })
  const raw = s1.snapshotJobs()
  const doneRaw = raw.find((j) => j.id === done.id)
  doneRaw.state.lastStatus = 'ok'
  doneRaw.state.lastRunStatus = 'ok'
  doneRaw.state.lastRunAtMs = Date.now() - 60_000
  doneRaw.state.nextRunAtMs = Date.now() - 60_000
  // simulate "became due while the Control Plane was down" for the other job
  const dueRaw = raw.find((j) => j.id === due.id)
  dueRaw.state.nextRunAtMs = Date.now() - 60_000
  await s1.stop()
  await store1.persist([dueRaw, doneRaw])

  const store2 = new JobStore(join(dir, 'jobs.json'))
  const invoker2 = createFakeInvoker()
  const s2 = new Scheduler({ store: store2, invoker: invoker2, deliver: createRecordingDelivery() })
  await s2.start({ autoStart: false })
  await s2.whenIdle()
  assert.equal(invoker2.calls.length, 1, 'only the never-ran at job fires')
  assert.equal(invoker2.calls[0].message, 'x')
  assert.equal(await s2.getJob(due.id), undefined, 'due one-shot deleted after run')
  assert.ok(await s2.getJob(done.id), 'already-done one-shot record kept')
  await s2.stop()
})

test('restart near due: never-ran cron job does NOT catch up a passed first occurrence', async () => {
  // OpenClaw: the missed-run rule requires lastRunAtMs to be a number; a
  // freshly created cron job starts from its next occurrence instead.
  const { dir } = makeEnv()
  const store1 = new JobStore(join(dir, 'jobs.json'))
  const s1 = new Scheduler({ store: store1, invoker: createFakeInvoker(), deliver: createRecordingDelivery() })
  await s1.start({ autoStart: false })
  const job = await s1.createJob({
    name: 'fresh', agentId: 'a1',
    schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' },
    payload: { message: 'x' },
  })
  await s1.stop()

  const store2 = new JobStore(join(dir, 'jobs.json'))
  const invoker2 = createFakeInvoker()
  const s2 = new Scheduler({ store: store2, invoker: invoker2, deliver: createRecordingDelivery() })
  await s2.start({ autoStart: false })
  await s2.tick()
  await s2.whenIdle()
  assert.equal(invoker2.calls.length, 0, 'never-ran cron job does not catch up')
  assert.ok((await s2.getJob(job.id)).nextRunAtMs > Date.now())
  await s2.stop()
})

test('no-duplicate on crash: fresh runningAtMs marker is skipped at restart', async () => {
  const { dir } = makeEnv()
  const store1 = new JobStore(join(dir, 'jobs.json'))
  const s1 = new Scheduler({ store: store1, invoker: createFakeInvoker(), deliver: createRecordingDelivery() })
  await s1.start({ autoStart: false })
  const job = await s1.createJob({
    name: 'mid-run', agentId: 'a1', schedule: atJob(Date.now() + 10), payload: { message: 'x' },
  })
  // simulate crash right after runningAtMs was persisted, before invocation finished
  const raw = s1.snapshotJobs()[0]
  raw.state.runningAtMs = Date.now() - 5_000
  await s1.stop()
  await store1.persist([raw])

  const store2 = new JobStore(join(dir, 'jobs.json'))
  const invoker2 = createFakeInvoker()
  const s2 = new Scheduler({ store: store2, invoker: invoker2, deliver: createRecordingDelivery() })
  await s2.start({ autoStart: false })
  await s2.tick()
  await s2.whenIdle()
  assert.equal(invoker2.calls.length, 0, 'fresh runningAtMs = assumed in-flight; no duplicate fire')
  await s2.stop()
})

test('stuck runningAtMs marker older than 2h is cleared and the job runs again', async () => {
  const { dir } = makeEnv()
  const store1 = new JobStore(join(dir, 'jobs.json'))
  const s1 = new Scheduler({ store: store1, invoker: createFakeInvoker(), deliver: createRecordingDelivery() })
  await s1.start({ autoStart: false })
  const job = await s1.createJob({
    name: 'stuck', agentId: 'a1', schedule: atJob(Date.now() + 60_000), payload: { message: 'x' },
  })
  const raw = s1.snapshotJobs()[0]
  raw.state.runningAtMs = Date.now() - (2 * 3_600_000 + 60_000) // > 2h ago
  raw.state.nextRunAtMs = Date.now() - 60_000 // deterministically overdue at restart
  await s1.stop()
  await store1.persist([raw])

  const store2 = new JobStore(join(dir, 'jobs.json'))
  const invoker2 = createFakeInvoker()
  const s2 = new Scheduler({ store: store2, invoker: invoker2, deliver: createRecordingDelivery() })
  await s2.start({ autoStart: false })
  await s2.whenIdle()
  assert.equal(invoker2.calls.length, 1, 'stuck marker cleared; job fires')
  await s2.stop()
})

test('recurring error: consecutiveErrors increments and next run is backoff-pushed', async () => {
  const { scheduler, invoker } = makeEnv({ outcome: { status: 'error', error: 'boom' } })
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'err', agentId: 'a1', schedule: cronEveryMinute, payload: { message: 'x' },
  })
  const raw = scheduler.snapshotJobs()[0]
  raw.state.nextRunAtMs = Date.now() - 10
  raw.state.lastRunAtMs = Date.now() - 60_000
  await scheduler.store.persist([raw])
  await scheduler.tick()
  await scheduler.whenIdle()
  const after = await scheduler.getJob(job.id)
  assert.equal(after.lastStatus, 'error')
  assert.equal(after.consecutiveErrors, 1)
  assert.ok(after.nextRunAtMs > Date.now() + 20_000, `backoff pushed next run: ${after.nextRunAtMs}`)
  await scheduler.stop()
})

test('recurring ok resets consecutiveErrors', async () => {
  const { scheduler } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'ok', agentId: 'a1', schedule: cronEveryMinute, payload: { message: 'x' },
  })
  const raw = scheduler.snapshotJobs()[0]
  raw.state.nextRunAtMs = Date.now() - 10
  raw.state.lastRunAtMs = Date.now() - 60_000
  raw.state.consecutiveErrors = 5
  await scheduler.store.persist([raw])
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal((await scheduler.getJob(job.id)).consecutiveErrors, 0)
  await scheduler.stop()
})

test('one-shot transient error retries with backoff, then succeeds (max 3 retries)', async () => {
  let attempts = 0
  const { scheduler, invoker } = makeEnv({
    outcome: () => {
      attempts += 1
      if (attempts < 3) return { status: 'error', error: '429 rate limit exceeded' }
      return { status: 'ok', summary: 'finally' }
    },
  })
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'retry', agentId: 'a1', schedule: atJob(Date.now() + 30), payload: { message: 'x' },
  })
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(attempts, 1, 'first attempt errors')
  let after = await scheduler.getJob(job.id)
  assert.equal(after.enabled, true, 'still enabled: transient retry pending')
  assert.ok(after.nextRunAtMs > Date.now())

  // fast-forward: force nextRunAtMs into the past and retry
  for (let i = 0; i < 4; i += 1) {
    const raw = scheduler.snapshotJobs()[0]
    if (!raw) break
    raw.state.nextRunAtMs = Date.now() - 10
    await scheduler.store.persist([raw])
    await scheduler.tick()
    await scheduler.whenIdle()
    const cur = await scheduler.getJob(job.id)
    if (!cur) break // deleted after final success
  }
  assert.equal(attempts, 3)
  assert.equal(await scheduler.getJob(job.id), undefined, 'one-shot deleted after success')
  await scheduler.stop()
})

test('one-shot permanent error disables the job (no further runs)', async () => {
  const { scheduler, invoker } = makeEnv({ outcome: { status: 'error', error: 'invalid arguments' } })
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'dead', agentId: 'a1', schedule: atJob(Date.now() + 30), payload: { message: 'x' },
  })
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  const after = await scheduler.getJob(job.id)
  assert.ok(after, 'record kept (deleteAfterRun only deletes on ok)')
  assert.equal(after.enabled, false, 'permanent error disables one-shot')
  await scheduler.tick()
  assert.equal(invoker.calls.length, 1, 'never runs again')
  await scheduler.stop()
})

test('every schedule fires at its interval and computes the next anchored run', async () => {
  const { scheduler, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'every', agentId: 'a1',
    schedule: { kind: 'every', everyMs: 86_400_000, anchorMs: Date.now() },
    payload: { message: 'x' },
  })
  const raw = scheduler.snapshotJobs()[0]
  raw.state.nextRunAtMs = Date.now() - 10
  raw.state.lastRunAtMs = Date.now() - 86_400_000
  await scheduler.store.persist([raw])
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(invoker.calls.length, 1)
  const after = await scheduler.getJob(job.id)
  assert.ok(after.nextRunAtMs > Date.now())
  await scheduler.stop()
})

test('invocation timeout marks the run as errored with the OpenClaw message', async () => {
  const { scheduler } = makeEnv({
    outcome: () => new Promise(() => {}), // never resolves
  })
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'slow', agentId: 'a1', schedule: atJob(Date.now() + 30),
    payload: { message: 'x', timeoutSeconds: 1 },
  })
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  const after = await scheduler.getJob(job.id)
  assert.equal(after.enabled, false, 'timeout = permanent error for one-shot')
  assert.equal(after.lastError, 'cron: job execution timed out')
  assert.equal(after.lastStatus, 'error')
  await scheduler.stop()
})

test('run log records started + finished events with the outcome', async () => {
  const { scheduler, store } = makeEnv()
  await scheduler.start({ autoStart: false })
  await scheduler.createJob({ name: 'log', agentId: 'a1', schedule: atJob(Date.now() + 30), payload: { message: 'x' } })
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  const events = await store.readRunEvents()
  assert.equal(events.length, 2)
  assert.deepEqual(events.map((e) => e.action).sort(), ['finished', 'started'])
  const finished = events.find((e) => e.action === 'finished')
  assert.equal(finished.status, 'ok')
  assert.equal(finished.deliveryStatus, 'not-requested')
  await scheduler.stop()
})

test('silent delivery mode still reaches the delivery seam with the opaque target', async () => {
  const { scheduler, deliver } = makeEnv()
  await scheduler.start({ autoStart: false })
  await scheduler.createJob({
    name: 'silent', agentId: 'a1', schedule: atJob(Date.now() + 30),
    payload: { message: 'x' },
    delivery: { mode: 'silent', channel: 'feishu', to: 'chat:oc_abc' },
  })
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(deliver.deliveries.length, 1)
  assert.equal(deliver.deliveries[0].mode, 'silent')
  assert.equal(deliver.deliveries[0].to, 'chat:oc_abc')
  await scheduler.stop()
})

test('concurrency cap bounds parallel invocations', async () => {
  const active = []
  let peak = 0
  const dir = mkdtempSync(join(tmpdir(), 'sched-test-'))
  const store = new JobStore(join(dir, 'jobs.json'))
  const invoker = {
    async invokeAgent(request) {
      active.push(request.agentId)
      peak = Math.max(peak, active.length)
      await sleep(80)
      active.splice(active.indexOf(request.agentId), 1)
      return { status: 'ok', summary: 'ok', sessionId: request.sessionId }
    },
  }
  const s = new Scheduler({ store, invoker, deliver: createRecordingDelivery(), concurrency: 2, tickMs: 50 })
  await s.start({ autoStart: false })
  for (let i = 0; i < 5; i += 1) {
    await s.createJob({ name: `c${i}`, agentId: `a${i}`, schedule: atJob(Date.now() + 30), payload: { message: 'x' } })
  }
  await sleep(150)
  await s.tick()
  await s.whenIdle()
  assert.ok(peak <= 2, `peak concurrency ${peak} <= 2`)
  assert.equal(active.length, 0)
  await s.stop()
})

test('external jobs written by the CLI seam are picked up on the next tick', async () => {
  const { scheduler, store, invoker } = makeEnv()
  await scheduler.start({ autoStart: false })
  // simulate scripts/agentcore-cron.mjs writing a job file externally
  const external = {
    id: 'ext-1',
    name: 'external',
    agentId: 'a1',
    enabled: true,
    schedule: { kind: 'at', at: new Date(Date.now() + 40).toISOString() },
    sessionTarget: 'isolated',
    payload: { kind: 'agentTurn', message: 'from daemon' },
    delivery: { mode: 'none', channel: 'last' },
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    state: { nextRunAtMs: Date.now() + 40 },
  }
  await store.persist([external])
  await sleep(100)
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(invoker.calls.length, 1)
  assert.equal(invoker.calls[0].message, 'from daemon')
  await scheduler.stop()
})

test('submitOneShot: relative at + deliver:false maps to the daemon flag surface', async () => {
  const { scheduler, invoker, deliver } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.submitOneShot({
    agentId: 'qa-reviewer',
    name: '论坛通知触发 - qa-reviewer',
    at: '15m',
    message: '你有未读通知',
    lightContext: true,
    deliver: false,
    sessionTarget: 'isolated',
    timeoutSeconds: 600,
    deleteAfterRun: true,
    model: 'opencode-go/deepseek-v4-flash',
  })
  assert.equal(job.schedule.kind, 'at')
  assert.ok(job.nextRunAtMs > Date.now() + 14 * 60_000 && job.nextRunAtMs <= Date.now() + 15 * 60_000)
  assert.equal(job.delivery.mode, 'none')
  assert.equal(job.delivery.channel, 'last')
  assert.equal(job.payload.model, 'opencode-go/deepseek-v4-flash')
  assert.equal(job.payload.lightContext, true)
  assert.equal(job.payload.timeoutSeconds, 600)
  assert.equal(job.deleteAfterRun, true)
  await scheduler.stop()
})

test('updateJob can reschedule and toggle without losing identity', async () => {
  const { scheduler } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'u', agentId: 'a1', schedule: atJob(Date.now() + 60_000), payload: { message: 'x' },
  })
  const updated = await scheduler.updateJob(job.id, {
    name: 'u2',
    schedule: { kind: 'cron', expr: '30 2 * * *' },
    payload: { message: 'y', timeoutSeconds: 120 },
  })
  assert.equal(updated.id, job.id)
  assert.equal(updated.name, 'u2')
  assert.equal(updated.schedule.kind, 'cron')
  assert.equal(updated.payload.message, 'y')
  assert.ok(updated.nextRunAtMs > Date.now())
  await scheduler.stop()
})
