// GREEN regression suite for the Owner-audited #1379 blockers (follow-up to
// 67e77fa9; supersedes the two RED tests this file carried at 43ae58e9 —
// those asserted the deliver({job,text}) Feishu contract, which the owner
// ruling replaced: the verify instruction must start a REAL agent turn
// through the scheduler invoker seam, and the verdict must bind to the
// ORIGINAL run via the real HistoryStore, never a marker-only permanent
// skip and never a Feishu group announcement).
//
// Everything below runs the REAL assembly — JobStore + Scheduler engine +
// HistoryStore (real fsynced events.jsonl + monthly projections
// runs-YYYYMM.json) — in an isolated temp dir. No mock store, no forged
// projection filenames. Module-level imports double as the loadability
// regression for the audited store.js syntax defect: a syntax error in any
// modified module fails this whole suite before any test runs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JobStore } from '../../../scheduler/src/store.js'
import { HistoryStore } from '../../../scheduler/src/history.js'
import { Scheduler } from '../../../scheduler/src/scheduler.js'
import { createFakeInvoker, createRecordingDelivery } from '../../../scheduler/src/seams.js'
import { createResultVerifyRuntime } from '../../src/scheduler/result-verify-runtime.js'

const T0 = Date.parse('2026-11-01T00:00:00Z') // November → projection runs-202611.json

function newDir(label = 'rv-green-') {
  return mkdtempSync(join(tmpdir(), label))
}

function jobInput(id) {
  return {
    id,
    name: `Job ${id}`,
    agentId: 'agt_one',
    payload: { kind: 'agentTurn', message: 'do the round' },
    schedule: { kind: 'at', at: new Date(T0 + 1_000).toISOString() },
    delivery: { mode: 'none' },
  }
}

/** REAL assembly: real JobStore + real Scheduler engine + real HistoryStore. */
async function realAssembly(dir, invoke) {
  const clock = { value: T0 }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  const historyDir = join(dir, 'history')
  const history = new HistoryStore({ dir: historyDir, nowMs: () => clock.value })
  const scheduler = new Scheduler({
    store,
    invoker: invoke,
    deliver: createRecordingDelivery(),
    history,
    nowMs: () => clock.value,
  })
  return { clock, store, history, historyDir, scheduler }
}

/** Drive one real succeeded run whose business result was never verified. */
async function seedUnverifiedRun(dir, assembly) {
  const { clock, scheduler, history } = assembly
  await scheduler.createJob(jobInput('rv-job'))
  await scheduler.start({ autoStart: false })
  clock.value += 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  await history.ensureLoaded()
  const { runs } = history.queryRuns({ jobId: 'rv-job' })
  assert.equal(runs.length, 1)
  assert.equal(runs[0].outcome, 'succeeded')
  assert.equal(runs[0].result_status, null, 'seeded run has no business result yet')
  return runs[0]
}

// ── defect 2 regression: the consumer scans the REAL projection files ──────

test('G1 (audited defect 2): scanUnverifiedRuns reads the authoritative runs-YYYYMM.json projection written by the real HistoryStore', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done, no result block', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly)

  // The projection file the REAL writer produced is runs-YYYYMM.json
  // (6-digit historyMonth); the audited defect read runs-YYYY-MM.json and
  // silently scanned nothing, in production forever.
  const months = readdirSync(assembly.historyDir).filter((f) => /^runs-\d{6}\.json$/.test(f))
  assert.equal(months.length, 1, `real writer produced ${months.join(',')}`)
  assert.equal(months[0], 'runs-202611.json')

  const rtNow = { value: T0 + 5_000 }
  const rt = createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async () => { throw new Error('scan-only test') },
    nowMs: () => rtNow.value,
    stateDir: dir,
  })
  const scanned = rt.scanUnverifiedRuns()
  assert.equal(scanned.length, 1, 'the unverified run IS found through the real projection file')
  assert.equal(scanned[0].run_id, run.run_id)
})

// ── defect 1 regression: real modules load; readJobs on the REAL JobStore ──

test('G2 (audited defect 1): JobStore is loadable and readJobs works against a real jobs.json in an isolated temp dir', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  assert.equal(typeof JobStore.prototype.readJobs, 'function')
  const clock = { value: T0 }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  assert.deepEqual(await store.readJobs(), [], 'fresh store: empty job snapshot')
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  await assembly.scheduler.createJob(jobInput('rv-job'))
  const jobs = await store.readJobs()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].id, 'rv-job', 'readJobs returns the real jobs array from the real document')
})

// ── E5 hard acceptance: real verify turn + verdict bound to the ORIGINAL run ──

test('G3 (#1379 三): verify instruction starts a REAL agent turn via the invoker seam and the PASS verdict binds to the original run through the real history', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done, no result block', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly)

  const verifyCalls = []
  const rtNow = { value: T0 + 5_000 }
  const rt = createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async (req) => {
      verifyCalls.push(req)
      return { status: 'ok', started: true, sessionId: req.sessionId,
        // In production the observed invoker's attachSchedulerResult ingests
        // this block off the turn reply; mirrored here on the seam contract.
        result: { final_status: 'PASS', counters: { items: 3 } } }
    },
    nowMs: () => rtNow.value,
    stateDir: dir,
  })

  const ticked = await rt.tick()
  assert.equal(ticked.delivered, 1)
  assert.equal(verifyCalls.length, 1, 'exactly one verify turn')
  const call = verifyCalls[0]
  assert.equal(call.agentId, 'agt_one', 'same responsible agent')
  assert.equal(call.runId, run.run_id, 'correlated to the exact original run')
  assert.equal(call.occurrenceId, run.occurrence_id, 'correlated to the exact original occurrence')
  assert.equal(call.jobId, 'rv-job')
  assert.equal(call.requestId, `rv:${run.run_id}:1`)
  assert.ok(typeof call.message === 'string' && call.message.includes('scheduler-result'), 'the turn carries the verify instruction')

  // The verdict bound to the ORIGINAL run — through the real result_recorded
  // event + real projection merge, not a marker-only fact.
  await assembly.history.ensureLoaded()
  const { runs } = assembly.history.queryRuns({ jobId: 'rv-job' })
  assert.equal(runs[0].result_status, 'PASS')
  assert.equal(runs[0].result_recorded, true)
  assert.deepEqual(runs[0].result.counters, { items: 3 })
  assert.equal(assembly.history.getRun(run.run_id).run_id, run.run_id)
  assert.equal(rt.scanUnverifiedRuns().length, 0, 'verified run left the scan set via real history')

  const lines = readFileSync(join(assembly.historyDir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const resultEvent = lines.find((e) => e.type === 'result_recorded' && e.run_id === run.run_id)
  assert.ok(resultEvent, 'result_recorded event persisted')
  assert.equal(resultEvent.verify.source, 'result-verify-runtime')
  assert.equal(resultEvent.verify.request_id, call.requestId)
})

// ── responsibility-not-dropped: no verdict ⇒ scan set persists, backoff paces, restart-safe ──

test('G4 (#1379 三): settled turn without a result block never skips the run — paced retries, attempts persist across a real runtime restart', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done, no result block', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly)

  const verifyCalls = []
  const rtNow = { value: T0 + 5_000 }
  const mk = () => createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async (req) => { verifyCalls.push(req); return { status: 'ok', started: true, summary: 'replied WITHOUT any scheduler-result block' } },
    nowMs: () => rtNow.value,
    stateDir: dir,
    verifyRetryBaseMs: 1_000,
    verifyRetryCapMs: 60_000,
  })
  const rt = mk()

  await rt.tick()
  assert.equal(verifyCalls.length, 1)
  assert.equal(verifyCalls[0].requestId, `rv:${run.run_id}:1`)
  // No verdict: the run stays in the scan set and the history stays null.
  assert.equal(rt.scanUnverifiedRuns().length, 1)
  await assembly.history.ensureLoaded()
  assert.equal(assembly.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status, null)
  const lines = readFileSync(join(assembly.historyDir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(lines.some((e) => e.type === 'result_recorded'), false, 'no invented verdict')

  // Within the backoff window: no duplicate verify turn.
  await rt.tick()
  assert.equal(verifyCalls.length, 1)

  // Past the backoff window: attempt 2, distinct requestId, same exact run.
  rtNow.value += 1_500
  await rt.tick()
  assert.equal(verifyCalls.length, 2)
  assert.equal(verifyCalls[1].requestId, `rv:${run.run_id}:2`)
  assert.equal(verifyCalls[1].runId, run.run_id)

  // REAL restart: a fresh runtime instance reloads attempts from the marker
  // file and re-derives the scan set from history — the responsibility and
  // the pacing survive the process.
  rtNow.value += 100
  const restarted = mk()
  const res = await restarted.tick()
  assert.equal(res.delivered, 0, 'attempt 2 is still within backoff after restart')
  assert.equal(verifyCalls.length, 2)
})

// ── rejected block: recorded as an error, retried — never a fake PASS ──────

test('G5 (#1379): a rejected scheduler-result block is bound as result_error_code and the run keeps being re-verified', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done, no result block', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly)

  const rtNow = { value: T0 + 5_000 }
  const mk = (outcome) => createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async () => outcome,
    nowMs: () => rtNow.value,
    stateDir: dir,
    verifyRetryBaseMs: 1_000,
    verifyRetryCapMs: 60_000,
  })
  let rt = mk({ status: 'ok', started: true, summary: 'bad block', result_error_code: 'INVALID_SCHEMA' })
  await rt.tick()
  await assembly.history.ensureLoaded()
  const { runs } = assembly.history.queryRuns({ jobId: 'rv-job' })
  assert.equal(runs[0].result_status, null, 'rejected block is not a PASS')
  assert.equal(runs[0].result_error_code, 'INVALID_SCHEMA', 'rejection durably bound to the original run')
  assert.equal(rt.scanUnverifiedRuns().length, 1, 'run stays in the scan set')

  // A later honest PASS replaces the error face.
  rtNow.value += 2_000
  rt = mk({ status: 'ok', started: true, summary: 'ok', result: { final_status: 'PARTIAL', counters: { done: 2 } } })
  await rt.tick()
  await assembly.history.ensureLoaded()
  const after = assembly.history.queryRuns({ jobId: 'rv-job' }).runs[0]
  assert.equal(after.result_status, 'PARTIAL')
  assert.equal(rt.scanUnverifiedRuns().length, 0)
})
