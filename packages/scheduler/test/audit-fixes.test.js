/**
 * Round-2 audit regression tests (MERGE AFTER SMALL FIX verdict):
 *
 *   LONG_INVOKE_OVERLAPPING_TICK  — FIX 1 tick single-flight
 *   LATEST_STATE_OUTCOME_WRITE    — FIX 1 outcome applied to latest job
 *   CLI_LIST_DOES_NOT_EXECUTE     — FIX 2 CLI control-only
 *   CLI_RESIDENT_MULTIWRITER      — FIX 3 locked read-modify-write authority
 *   PERSIST_FAILURE_ROLLBACK      — FIX 4 RAM/disk rollback on failed persist
 *   IMPORT_EXISTING_STORE_GUARD   — FIX 5 import refuses to overwrite a live store
 *   START_CATCHUP_OPTION          — start({catchup:false}) never executes
 *   TIMEOUT_ABORT_SIGNAL          — AbortSignal reserved in the invocation seam
 *   ASIA_SHANGHAI_CRON_TZ         — tz regression (identical to OpenClaw port)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { Scheduler } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'
import { createFakeInvoker, createRecordingDelivery } from '../src/seams.js'
import { computeNextRunAtMs, computePreviousRunAtMs } from '../src/schedule.js'

const here = dirname(fileURLToPath(import.meta.url))
const CLI = join(here, '..', '..', '..', 'scripts', 'agentcore-cron.mjs')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function makeEnv({ outcome = null, delayMs = 0, tickMs = 50, storeOpts = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sched-audit-'))
  const store = new JobStore(join(dir, 'jobs.json'), storeOpts)
  const invoker = createFakeInvoker({ outcome, delayMs })
  const scheduler = new Scheduler({ store, invoker, deliver: createRecordingDelivery(), tickMs })
  return { dir, store, invoker, scheduler }
}

const cronEveryMinute = { kind: 'cron', expr: '* * * * *' }

// ── FIX 1: tick single-flight + latest-state outcome write ───────────────

test('LONG_INVOKE_OVERLAPPING_TICK: overlapping ticks never duplicate an occurrence', async () => {
  const { store, invoker, scheduler } = makeEnv({ delayMs: 400, tickMs: 10 })
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'slow', agentId: 'a1', schedule: cronEveryMinute, payload: { message: 'x' },
  })
  // force the occurrence into the past so the first pass fires it
  const raw = scheduler.snapshotJobs()[0]
  raw.state.nextRunAtMs = Date.now() - 1000
  raw.state.lastRunAtMs = Date.now() - 60_000
  raw.state.lastStatus = 'ok'
  await store.persist([raw])

  const p1 = scheduler.tick() // enters the pass; marks runningAtMs; invokes (400ms)
  await sleep(40)
  const p2 = scheduler.tick() // must be skipped (single-flight), coalesced
  await Promise.all([p1, p2])
  await scheduler.whenIdle()

  assert.equal(invoker.calls.length, 1, 'occurrence executed exactly once')
  const after = await scheduler.getJob(job.id)
  assert.equal(after.lastStatus, 'ok', 'completion landed on the latest state')
  assert.equal(after.runningAtMs, undefined, 'runningAtMs cleared after completion')
  assert.ok(after.nextRunAtMs > Date.now(), 'nextRunAtMs advanced into the future')
  // disk agrees (a stale write would leave runningAtMs set + no lastRunAtMs)
  const disk = JSON.parse(readFileSync(join(scheduler.store.filePath), 'utf8')).jobs[0]
  assert.equal(disk.state.runningAtMs, undefined, 'disk has no stale running marker')
  assert.equal(disk.state.lastRunStatus, 'ok', 'disk has the completion')
  await scheduler.stop()
})

test('LATEST_STATE_OUTCOME_WRITE: completion lands on the latest job object (updateJob mid-run)', async () => {
  let s
  const { store } = makeEnv()
  const invoker = createFakeInvoker({
    onCall: async () => {
      await s.updateJob('target', { name: 'renamed-mid-run' })
    },
  })
  s = new Scheduler({ store, invoker, deliver: createRecordingDelivery(), tickMs: 50 })
  await s.start({ autoStart: false })
  const job = await s.createJob({
    id: 'target', name: 'original', agentId: 'a1',
    schedule: cronEveryMinute, payload: { message: 'x' },
  })
  const raw = s.snapshotJobs()[0]
  raw.state.nextRunAtMs = Date.now() - 1000
  raw.state.lastRunAtMs = Date.now() - 60_000
  raw.state.lastStatus = 'ok'
  await store.persist([raw])

  await s.tick()
  await s.whenIdle()

  const after = await s.getJob(job.id)
  assert.equal(after.name, 'renamed-mid-run', 'update survived the completion commit')
  assert.equal(after.lastStatus, 'ok', 'completion applied to the LATEST object')
  assert.equal(after.runningAtMs, undefined, 'running marker cleared on the latest object')
  const disk = JSON.parse(readFileSync(store.filePath, 'utf8')).jobs[0]
  assert.equal(disk.name, 'renamed-mid-run')
  assert.equal(disk.state.lastRunStatus, 'ok', 'disk holds both the update and the completion')
  await s.stop()
})

test('START_CATCHUP_OPTION: start({catchup:false}) loads but never executes', async () => {
  const { store, invoker, scheduler } = makeEnv()
  const job = await scheduler.createJob({
    name: 'overdue', agentId: 'a1',
    schedule: { kind: 'at', at: new Date(Date.now() - 60_000).toISOString() },
    payload: { message: 'x' },
  })
  // force nextRunAtMs into the past (at-in-past at creation has no next run)
  const raw = scheduler.snapshotJobs()[0]
  raw.state.nextRunAtMs = Date.now() - 30_000
  await store.persist([raw])
  await scheduler.stop()

  const store2 = new JobStore(store.filePath)
  const invoker2 = createFakeInvoker()
  const s2 = new Scheduler({ store: store2, invoker: invoker2, deliver: createRecordingDelivery() })
  await s2.start({ autoStart: false, catchup: false })
  await s2.whenIdle()
  assert.equal(invoker2.calls.length, 0, 'catchup:false never invokes')
  assert.equal((await s2.getJob(job.id))?.nextRunAtMs, raw.state.nextRunAtMs, 'state untouched')
  await s2.stop()
})

// ── FIX 2: CLI never executes / catches up ───────────────────────────────

test('CLI_LIST_DOES_NOT_EXECUTE: list over an overdue store executes nothing', async () => {
  const { dir, store } = makeEnv()
  const before = {
    id: 'cli-overdue', name: 'overdue-oneshot', agentId: 'a1', enabled: true,
    schedule: { kind: 'at', at: new Date(Date.now() - 60_000).toISOString() },
    sessionTarget: 'isolated',
    payload: { kind: 'agentTurn', message: 'x' },
    delivery: { mode: 'none', channel: 'last' },
    deleteAfterRun: true,
    createdAtMs: Date.now(), updatedAtMs: Date.now(),
    state: { nextRunAtMs: Date.now() - 30_000 },
  }
  await store.persist([before])

  const beforeDisk = readFileSync(store.filePath, 'utf8')
  const res = spawnSync(process.execPath, [CLI, 'list', '--json', '--store', store.filePath], { encoding: 'utf8' })
  assert.equal(res.status, 0, res.stderr)
  const listed = JSON.parse(res.stdout)
  assert.equal(listed.jobs.length, 1, 'overdue job still exists after list')
  assert.equal(listed.jobs[0].id, 'cli-overdue')
  assert.equal(listed.jobs[0].enabled, true, 'state not advanced by list')
  assert.equal(listed.jobs[0].nextRunAtMs, before.state.nextRunAtMs, 'nextRunAtMs untouched')
  assert.equal(listed.jobs[0].lastStatus, undefined, 'no fake execution happened')

  const afterDisk = readFileSync(store.filePath, 'utf8')
  assert.equal(afterDisk, beforeDisk, 'store byte-identical after list')
  // no run events recorded
  assert.equal((await store.readRunEvents()).length, 0)
  // runs.jsonl does not even exist
  assert.equal(existsSync(store.runLogPath), false)
})

test('CLI_RESIDENT_MULTIWRITER: CLI add survives the resident engine completion commit', async () => {
  const { store, invoker, scheduler } = makeEnv({ delayMs: 300 })
  await scheduler.start({ autoStart: false })
  const a = await scheduler.createJob({
    name: 'A', agentId: 'a1', schedule: { kind: 'at', at: new Date(Date.now() + 60_000).toISOString() }, payload: { message: 'x' },
  })
  // make A deterministically due, then start a real pass: A invokes (300ms)
  const raw = scheduler.snapshotJobs()[0]
  raw.state.nextRunAtMs = Date.now() - 1000
  await store.persist([raw])
  const pass = scheduler.tick()
  await sleep(80) // A is now mid-invocation
  // CLI-add B from another process WHILE the engine is executing A
  const res = spawnSync(process.execPath, [
    CLI, 'add', '--agent', 'b1', '--name', 'B', '--at', '60m', '--message', 'y',
    '--no-deliver', '--session', 'isolated', '--timeout-seconds', '600',
    '--delete-after-run', '--store', store.filePath, '--json',
  ], { encoding: 'utf8' })
  assert.equal(res.status, 0, res.stderr)
  const b = JSON.parse(res.stdout)

  await pass
  await scheduler.whenIdle()
  const jobs = await scheduler.listJobs()
  const names = jobs.map((j) => j.name)
  assert.ok(names.includes('B'), 'CLI-added B survived the engine completion commit')
  assert.ok(!names.includes('A'), 'A completed and was deleted (one-shot)')

  const disk = JSON.parse(readFileSync(store.filePath, 'utf8')).jobs
  assert.ok(disk.some((j) => j.id === b.id), 'B is on disk after all engine commits')
  assert.ok(!disk.some((j) => j.id === a.id), 'A is not resurrected on disk')
  await scheduler.stop()
})

test('CLI_RESIDENT_MULTIWRITER: CLI disable is not clobbered by the resident engine', async () => {
  const { store, invoker, scheduler } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'toggle', agentId: 'a1', schedule: { kind: 'at', at: new Date(Date.now() + 120_000).toISOString() }, payload: { message: 'x' },
  })
  // CLI disables the job from another process while the engine is idle
  const res = spawnSync(process.execPath, [CLI, 'disable', job.id, '--store', store.filePath], { encoding: 'utf8' })
  assert.equal(res.status, 0, res.stderr)
  // engine tick must not re-enable / resurrect
  await scheduler.tick()
  await scheduler.whenIdle()
  const after = await scheduler.getJob(job.id)
  assert.equal(after.enabled, false, 'CLI disable survived the engine tick')
  assert.equal(after.nextRunAtMs, undefined)
  assert.equal(invoker.calls.length, 0, 'disabled job never ran')
  await scheduler.stop()
})

// ── FIX 4: persist failure rolls back RAM and leaves disk untouched ──────

test('PERSIST_FAILURE_ROLLBACK: create failure → API rejects, RAM and disk unchanged', async () => {
  const { store, scheduler } = makeEnv()
  await scheduler.start({ autoStart: false })
  store.beforeCommit = () => { throw new Error('injected commit failure') }
  await assert.rejects(
    scheduler.createJob({ name: 'x', agentId: 'a1', schedule: { kind: 'at', at: '2026-09-01T00:00:00Z' }, payload: { message: 'x' } }),
    /injected commit failure/,
  )
  store.beforeCommit = null
  assert.equal((await scheduler.listJobs()).length, 0, 'RAM unchanged after failed create')
  assert.deepEqual(await store.load(), [], 'disk unchanged after failed create')
  await scheduler.stop()
})

test('PERSIST_FAILURE_ROLLBACK: update failure → API rejects, RAM and disk unchanged', async () => {
  const { store, scheduler } = makeEnv()
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'keep', agentId: 'a1', schedule: { kind: 'at', at: '2026-09-01T00:00:00Z' }, payload: { message: 'x' },
  })
  store.beforeCommit = () => { throw new Error('injected commit failure') }
  await assert.rejects(scheduler.updateJob(job.id, { name: 'changed' }), /injected commit failure/)
  await assert.rejects(scheduler.disableJob(job.id), /injected commit failure/)
  await assert.rejects(scheduler.deleteJob(job.id), /injected commit failure/)
  store.beforeCommit = null
  const after = await scheduler.getJob(job.id)
  assert.equal(after.name, 'keep', 'RAM unchanged after failed update')
  assert.equal(after.enabled, true, 'RAM unchanged after failed disable')
  const disk = JSON.parse(readFileSync(store.filePath, 'utf8')).jobs
  assert.equal(disk.length, 1, 'disk unchanged after failed delete')
  assert.equal(disk[0].name, 'keep')
  await scheduler.stop()
})

// ── FIX 5: import guard ──────────────────────────────────────────────────

test('IMPORT_EXISTING_STORE_GUARD: import --write refuses an existing store without --force', async () => {
  const { dir, store } = makeEnv()
  await store.persist([{
    id: 'existing', name: 'existing', agentId: 'a1', enabled: true,
    schedule: { kind: 'at', at: '2026-09-01T00:00:00Z' },
    payload: { kind: 'agentTurn', message: 'x' },
    delivery: { mode: 'none' }, state: {},
    createdAtMs: Date.now(), updatedAtMs: Date.now(),
  }])
  const before = readFileSync(store.filePath, 'utf8')

  const importScript = join(here, '..', '..', '..', 'scripts', 'openclaw-job-import.mjs')
  const refused = spawnSync(process.execPath, [
    importScript, '--write', '--fixture', '--store', store.filePath,
  ], { encoding: 'utf8' })
  assert.equal(refused.status, 3, `expected refusal, got: ${refused.status} — ${refused.stderr}`)
  assert.match(refused.stderr, /REFUSED/)
  assert.equal(readFileSync(store.filePath, 'utf8'), before, 'existing store untouched')

  const forced = spawnSync(process.execPath, [
    importScript, '--write', '--force', '--fixture', '--store', store.filePath,
  ], { encoding: 'utf8' })
  assert.equal(forced.status, 0, forced.stderr)
  const disk = JSON.parse(readFileSync(store.filePath, 'utf8'))
  assert.equal(disk.jobs.length, 137, '--force imported the fixture')
})

test('IMPORT_GUARD_TOCTOU + EXISTING_JOB_PRESERVED: state created during the import race is seen inside the lock and refused', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sched-toctou-'))
  const store = new JobStore(join(dir, 'jobs.json'))
  const importScript = join(here, '..', '..', '..', 'scripts', 'openclaw-job-import.mjs')

  // The "concurrent writer" (resident engine / CLI equivalent) enqueues its
  // mutation FIRST and lands job B only after a delay. The import process
  // therefore starts while the store file does NOT exist yet (the TOCTOU
  // window) and reaches the mutation lock only after B is on disk — its
  // existence check must run INSIDE the lock against the latest store.
  const writer = store.mutate(async (jobs) => {
    await sleep(2000)
    jobs.push({
      id: 'B', name: 'B', agentId: 'b1', enabled: true,
      schedule: { kind: 'at', at: '2026-09-01T00:00:00Z' },
      payload: { kind: 'agentTurn', message: 'y' },
      delivery: { mode: 'none' }, state: {},
      createdAtMs: Date.now(), updatedAtMs: Date.now(),
    })
  })

  const child = spawn(process.execPath, [importScript, '--write', '--fixture', '--store', store.filePath])
  let stderr = ''
  child.stderr.on('data', (d) => { stderr += d })
  const exitCode = await new Promise((resolve) => child.on('exit', resolve))
  await writer

  assert.equal(exitCode, 3, `IMPORT_GUARD_TOCTOU: non-force import must refuse, got exit ${exitCode}: ${stderr}`)
  assert.match(stderr, /REFUSED/)
  const disk = JSON.parse(readFileSync(store.filePath, 'utf8')).jobs
  assert.deepEqual(disk.map((j) => j.name), ['B'],
    'EXISTING_JOB_PRESERVED: the concurrently created job survives; import never replaced the store')
})

test('IMPORT reports in-flight jobs (runningAtMs in source) instead of treating them as safe', async () => {
  const { importOpenClawJobs } = await import('../src/import-openclaw.js')
  const { report } = importOpenClawJobs([
    { id: 'r1', name: 'running-job', agentId: 'a1', enabled: true,
      schedule: { kind: 'at', at: '2026-09-01T00:00:00Z' },
      payload: { kind: 'agentTurn', message: 'x' }, delivery: { mode: 'none' },
      state: { runningAtMs: Date.now(), nextRunAtMs: Date.now() + 60_000 } },
    { id: 'i1', name: 'idle-job', agentId: 'a2', enabled: true,
      schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' },
      payload: { kind: 'agentTurn', message: 'y' }, delivery: { mode: 'none' },
      state: {} },
  ])
  assert.equal(report.inFlight.count, 1)
  assert.equal(report.inFlight.jobs[0].id, 'r1')
  assert.equal(report.imported, 2, 'in-flight jobs are still imported but reported')
})

// ── TIMEOUT_ABORT: signal reserved in the seam ───────────────────────────

test('TIMEOUT_ABORT_SIGNAL: timeout aborts the request signal (end-to-end deferred)', async () => {
  const { scheduler, store } = makeEnv({ outcome: () => new Promise(() => {}) })
  await scheduler.start({ autoStart: false })
  const job = await scheduler.createJob({
    name: 'slow', agentId: 'a1',
    schedule: { kind: 'at', at: new Date(Date.now() + 40).toISOString() },
    payload: { message: 'x', timeoutSeconds: 1 },
  })
  // capture the signal the invoker would receive
  let capturedSignal
  const spyInvoker = {
    async invokeAgent(request) {
      capturedSignal = request.signal
      return new Promise(() => {}) // never resolves; timeout must fire
    },
  }
  scheduler.invoker = spyInvoker
  await sleep(150)
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.ok(capturedSignal, 'invoker received an AbortSignal')
  assert.equal(capturedSignal.aborted, true, 'signal aborted on timeout')
  const after = await scheduler.getJob(job.id)
  assert.equal(after.lastStatus, 'error')
  assert.equal(after.lastError, 'cron: job execution timed out')
  await scheduler.stop()
})

// ── Asia/Shanghai croner regression (OpenClaw port is identical) ─────────

test('ASIA_SHANGHAI_CRON_TZ: 5-field cron across days and DST-adjacent dates', () => {
  const sched = { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' }
  const base = Date.parse('2026-08-15T00:00:00Z')
  assert.equal(computeNextRunAtMs(sched, base), Date.parse('2026-08-15T01:00:00Z'))
  assert.equal(computeNextRunAtMs(sched, Date.parse('2026-08-15T01:00:00Z')), Date.parse('2026-08-16T01:00:00Z'))
  assert.equal(computePreviousRunAtMs(sched, Date.parse('2026-08-15T03:00:00Z')), Date.parse('2026-08-15T01:00:00Z'))
  // same instant expressed in the job tz
  assert.equal(computeNextRunAtMs(sched, Date.parse('2026-08-15T09:00:00+08:00')), Date.parse('2026-08-16T01:00:00Z'))
  // odd-minute exprs (real inventory: '30 1 */3 * *', '23 0,8 * * *')
  const odd = { kind: 'cron', expr: '30 1 */3 * *', tz: 'Asia/Shanghai' }
  assert.equal(computeNextRunAtMs(odd, base), Date.parse('2026-08-15T17:30:00Z')) // 01:30+08 on the 15th
})
