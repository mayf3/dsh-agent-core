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
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
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

function jobInput(id, verification) {
  const j = {
    id,
    name: `Job ${id}`,
    agentId: 'agt_one',
    payload: { kind: 'agentTurn', message: 'do the round' },
    schedule: { kind: 'at', at: new Date(T0 + 1_000).toISOString() },
    delivery: { mode: 'none' },
  }
  if (verification) {
    j.verification = verification
    // A contract-bearing job must SURVIVE its run (deleteAfterRun jobs lose
    // their definition — and with it the supported verifier — at terminal;
    // that class is honestly reported-only until contract threading through
    // admission lands in the scheduler schema chain).
    j.deleteAfterRun = false
  }
  return j
}

import { createHash } from 'node:crypto'
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

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
async function seedUnverifiedRun(dir, assembly, verification) {
  const { clock, scheduler, history } = assembly
  await scheduler.createJob(jobInput('rv-job', verification))
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
  // B2 contract-driven: the job's authored acceptance contract pins the
  // durable business product (path + SHA-256 content).
  const product = join(dir, 'business-product.json')
  writeFileSync(product, '{"done": true}')
  const verification = { artifacts: [{ path: product, sha256: sha256File(product) }] }
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done, no result block', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly, verification)

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
        // B2: the verdict binds through the authored contract (server-checked
        // product) + resolved identity anchor.
        result: { final_status: 'PASS', counters: { items: 3 },
          evidence: [{ kind: 'history_run', run_id: run.run_id }] } }
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
  const product = join(dir, 'g5-product.json')
  writeFileSync(product, '{"partial": 2}')
  const verification = { artifacts: [{ path: product, sha256: sha256File(product) }] }
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done, no result block', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly, verification)

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

  // A later honest PARTIAL (with a server-resolvable anchor) replaces the error face.
  rtNow.value += 2_000
  rt = mk({ status: 'ok', started: true, summary: 'ok', result: { final_status: 'PARTIAL', counters: { done: 2 }, evidence: [{ kind: 'history_run', run_id: run.run_id }] } })
  await rt.tick()
  await assembly.history.ensureLoaded()
  const after = assembly.history.queryRuns({ jobId: 'rv-job' }).runs[0]
  assert.equal(after.result_status, 'PARTIAL')
  assert.equal(rt.scanUnverifiedRuns().length, 0)
})

// ── B1/B2 hardening: the two release blockers (Owner ruling 2026-11-12) ────

test('H1 (B2/M1): a self-reported PASS without a supported verification contract or resolving anchor is never bound as business completion', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly)

  const rtNow = { value: T0 + 5_000 }
  const rt = createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    // The worker's own word: a schema-legal PASS with no evidence anchors and
    // no supported verification contract on the job.
    invoker: async () => ({ status: 'ok', started: true, sessionId: 's1', result: { final_status: 'PASS', counters: { items: 3 } } }),
    nowMs: () => rtNow.value,
    stateDir: dir,
    verifyRetryBaseMs: 1_000,
    verifyRetryCapMs: 60_000,
  })
  const ticked = await rt.tick()
  assert.equal(ticked.delivered, 1, 'the verify turn WAS dispatched and answered')

  await assembly.history.ensureLoaded()
  const { runs } = assembly.history.queryRuns({ jobId: 'rv-job' })
  assert.equal(runs[0].result_status, null, 'self-reported PASS is NOT a business verdict')
  const lines = readFileSync(join(assembly.historyDir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(lines.some((e) => e.type === 'result_recorded'), false, 'no result_recorded binding without contract+anchor')
  assert.equal(rt.scanUnverifiedRuns().length, 1, 'the run STAYS in the scan set — responsibility kept (UNKNOWN/待证)')

  // Within the backoff window the report does not trigger a duplicate turn.
  await rt.tick()
  assert.equal(rt.scanUnverifiedRuns().length, 1)
})

test('H2 (B2/M1): binding is contract-driven — no contract means reported-only even with an exact anchor; contract + exact anchor binds', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const product = join(dir, 'h2-product.json')
  writeFileSync(product, '{"ok": 1}')
  const verification = { artifacts: [{ path: product, sha256: sha256File(product) }] }
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly) // NO verification contract

  const rtNow = { value: T0 + 5_000 }
  const mk = (evidence, withContract) => createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async () => ({ status: 'ok', started: true, sessionId: 's1', result: { final_status: 'FAIL', counters: {}, evidence } }),
    nowMs: () => rtNow.value,
    stateDir: dir,
    verifyRetryBaseMs: 1_000,
    verifyRetryCapMs: 60_000,
    ...(withContract ? {} : {}),
  })

  // No supported verification contract on the job: the exact-run anchor
  // alone cannot bind — reported-only (the model cannot self-select evidence
  // to close an acceptance that has no supported verifier).
  let rt = mk([{ kind: 'history_run', run_id: run.run_id }])
  await rt.tick()
  await assembly.history.ensureLoaded()
  assert.equal(assembly.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status, null, 'no contract: reported-only, never bound')
  assert.equal(rt.scanUnverifiedRuns().length, 1, 'responsibility retained')

  // Re-seed is impossible (same job); exercise contract+anchor via a second
  // run on the SAME job with the contract added by updateJob semantics —
  // simplest: a fresh assembly with the contract, three anchor variants.
  const dir2 = newDir()
  t.after(() => rmSync(dir2, { recursive: true, force: true }))
  const assembly2 = await realAssembly(dir2, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  const run2 = await seedUnverifiedRun(dir2, assembly2, verification)

  const mk2 = (evidence) => createResultVerifyRuntime({
    layout: { historyDir: assembly2.historyDir, controlDir: dir2 },
    store: assembly2.store,
    history: assembly2.history,
    invoker: async () => ({ status: 'ok', started: true, sessionId: 's1', result: { final_status: 'FAIL', counters: {}, evidence } }),
    nowMs: () => rtNow.value,
    stateDir: dir2,
    verifyRetryBaseMs: 1_000,
    verifyRetryCapMs: 60_000,
  })

  // Contract present: an anchor for a DIFFERENT run must not resolve.
  rt = mk2([{ kind: 'history_run', run_id: 'rv-some-other-run' }])
  await rt.tick()
  await assembly2.history.ensureLoaded()
  assert.equal(assembly2.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status, null, 'mismatched identity: no binding')

  // The unknown-kind anchor family fails closed.
  rtNow.value += 2_000
  rt = mk2([{ kind: 'artifact', path: '/tmp/worker-written-thing' }])
  await rt.tick()
  await assembly2.history.ensureLoaded()
  assert.equal(assembly2.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status, null, 'worker-writable anchor kinds never resolve')

  // The EXACT run identity, re-read server-side from the real projection, binds.
  rtNow.value += 2_000
  rt = mk2([{ kind: 'history_run', run_id: run2.run_id }])
  await rt.tick()
  await assembly2.history.ensureLoaded()
  assert.equal(assembly2.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status, 'FAIL', 'contract + exact-run anchor: the FAIL verdict binds to the original run')
  assert.equal(rt.scanUnverifiedRuns().length, 0)
})

test('H3 (B1): concurrent ticks cannot produce two verify writers for the same run — the per-run OwnerLock claim skips the busy run', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const product = join(dir, 'h3-product.json')
  writeFileSync(product, '{"h3": 1}')
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  await seedUnverifiedRun(dir, assembly, { artifacts: [{ path: product, sha256: sha256File(product) }] })

  const verifyCalls = []
  let releaseInFlight
  const inFlight = new Promise((resolve) => { releaseInFlight = resolve })
  const mk = (opts = {}) => createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async (req) => {
      verifyCalls.push(req)
      await inFlight // hold the claim open while a second writer shows up
      return { status: 'ok', started: true, sessionId: req.sessionId, result: { final_status: 'PASS', counters: {}, evidence: [{ kind: 'history_run', run_id: req.runId }] } }
    },
    nowMs: () => T0 + 5_000,
    stateDir: dir,
    claimTimeoutMs: 400,
    ...opts,
  })

  const rtA = mk()
  // B disables the pacing backoff (verifyRetryBaseMs 0) so the ONLY guard
  // under test is the per-run claim itself — B's skip must be attributed to
  // the live claim holder, proving the claim (not pacing) blocked it.
  const rtB = mk({ verifyRetryBaseMs: 0 })
  const tickA = rtA.tick() // A acquires the claim and enters the in-flight turn
  await new Promise((r) => setTimeout(r, 120)) // let A hold the claim
  const tickB = await rtB.tick() // B must NOT dispatch a second writer
  assert.equal(tickB.delivered, 0, 'the busy run is skipped, not double-dispatched')
  assert.equal(tickB.skippedBusy, 1, 'the skip is attributed to the live claim holder')
  assert.equal(rtB.scanUnverifiedRuns().length, 1, 'the run stays in the scan set under B')

  releaseInFlight()
  const resA = await tickA
  assert.equal(resA.delivered, 1)
  assert.equal(verifyCalls.length, 1, 'EXACTLY ONE verify writer existed for the run')

  await assembly.history.ensureLoaded()
  assert.equal(assembly.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status, 'PASS')
})

test('H4 (B1): a crash mid-turn consumes its attempt durably — a fresh runtime resumes with a distinct identity, never a duplicate writer', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const product = join(dir, 'h4-product.json')
  writeFileSync(product, '{"h4": 1}')
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly, { artifacts: [{ path: product, sha256: sha256File(product) }] })

  const verifyCalls = []
  const rtNow = { value: T0 + 5_000 }
  const mk = (behavior) => createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async (req) => { verifyCalls.push(req); return behavior(req) },
    nowMs: () => rtNow.value,
    stateDir: dir,
    verifyRetryBaseMs: 1_000,
    verifyRetryCapMs: 60_000,
  })

  // First runtime "crashes" right after dispatching attempt 1 (the throw
  // happens inside the turn; the attempt was already persisted in_flight).
  const crashed = mk(async () => { throw new Error('SIGKILL mid-turn') })
  await crashed.tick()
  assert.equal(verifyCalls.length, 1)
  assert.equal(verifyCalls[0].requestId, `rv:${run.run_id}:1`)

  // Fresh runtime instance (real restart): resumes at attempt 2 with a
  // distinct identity after backoff — never a second attempt-1 writer.
  rtNow.value += 1_500
  const restarted = mk(() => ({ status: 'ok', started: true, sessionId: 's2', result: { final_status: 'PASS', counters: {}, evidence: [{ kind: 'history_run', run_id: run.run_id }] } }))
  const res = await restarted.tick()
  assert.equal(res.delivered, 1)
  assert.equal(verifyCalls[1].requestId, `rv:${run.run_id}:2`, 'monotonic durable attempt identity across the process death')
  await assembly.history.ensureLoaded()
  assert.equal(assembly.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status, 'PASS')
})

test('H5 (B1): a claim artifact left by a SIGKILL-dead owner is mechanically reaped — the next tick proceeds, exactly once', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const product = join(dir, 'h5-product.json')
  writeFileSync(product, '{"h5": 1}')
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly, { artifacts: [{ path: product, sha256: sha256File(product) }] })

  // Simulate the crashed writer: a full-identity claim artifact whose owner
  // (a real, now-exited child pid) is mechanically provable dead.
  const { spawnSync } = await import('node:child_process')
  const dead = spawnSync('true')
  const deadPid = dead.pid
  const rt = createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async () => ({ status: 'ok', started: true, sessionId: 's1', result: { final_status: 'PASS', counters: {}, evidence: [{ kind: 'history_run', run_id: run.run_id }] } }),
    nowMs: () => T0 + 5_000,
    stateDir: dir,
  })
  // The runtime derives its claim path from the runKey; replicate it.
  const { createHash } = await import('node:crypto')
  const runKey = run.run_id
  const safe = String(runKey).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'run'
  const key = `${safe}.${createHash('sha256').update(String(runKey)).digest('hex').slice(0, 12)}`
  mkdirSync(join(dir, 'result-verify', 'claims'), { recursive: true })
  writeFileSync(join(dir, 'result-verify', 'claims', `${key}.lock`), `${JSON.stringify({ pid: deadPid, token: 'dead-token', createdAtMs: T0 })}\n`)

  const res = await rt.tick()
  assert.equal(res.delivered, 1, 'the dead owner was reaped and the verify proceeded')
  await assembly.history.ensureLoaded()
  assert.equal(assembly.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status, 'PASS')
})

test('H6 (fail-closed): a month projection that cannot be parsed aborts the tick with zero dispatches — never verify against a half-read history', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  await seedUnverifiedRun(dir, assembly)

  const projection = join(assembly.historyDir, 'runs-202611.json')
  const original = readFileSync(projection, 'utf8')
  writeFileSync(projection, '{"records": [ TRUNCATED')

  let invokerCalls = 0
  const rtNow = { value: T0 + 5_000 }
  const rt = createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async () => { invokerCalls += 1; return { status: 'ok', started: true, sessionId: 's1', result: { final_status: 'PASS', counters: {}, evidence: [{ kind: 'history_run', run_id: 'x' }] } } },
    nowMs: () => rtNow.value,
    stateDir: dir,
  })
  const ticked = await rt.tick()
  assert.equal(ticked.failClosed, true)
  assert.equal(ticked.delivered, 0)
  assert.equal(invokerCalls, 0, 'no verify turns on an incomplete scan')
  assert.ok(Array.isArray(ticked.readErrors) && ticked.readErrors.length >= 1)

  // Restoring the projection re-opens the tick (the failure was honest, not sticky).
  writeFileSync(projection, original)
  const after = await rt.tick()
  assert.equal(after.failClosed, undefined)
  assert.equal(after.delivered, 1)
})

test('H7 (scope): pre-activation history is classified, never mass-dispatched', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly)

  let invokerCalls = 0
  const rtNow = { value: T0 + 5_000 }
  const rt = createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async () => { invokerCalls += 1; return { status: 'ok', started: true, sessionId: 's1' } },
    nowMs: () => rtNow.value,
    stateDir: dir,
    verifyNotBeforeMs: T0 + 10_000, // activation watermark AFTER the seeded run
  })
  const ticked = await rt.tick()
  assert.equal(ticked.delivered, 0, 'the historical run is not blindly re-driven')
  assert.equal(ticked.scopeExcluded, 1, 'it is counted, not silently dropped')
  assert.equal(rt.scanUnverifiedRuns().length, 1, 'it stays in the scan set for explicit classification')
  assert.equal(invokerCalls, 0)
})

// ── Owner blocker counter-examples (2026-11-13 directive) ──────────────────

test('H8 (counter-example ①, contract-driven): omitted/irrelevant/content-nonconforming products never bind — the contract is the acceptance, not model-chosen evidence', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  // The job's AUTHORED acceptance contract: one durable product pinned by
  // exact path + SHA-256 content.
  const product = join(dir, 'original-product.json')
  writeFileSync(product, '{"items": 3, "verified": true}')
  const verification = { artifacts: [{ path: product, sha256: sha256File(product) }] }
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly, verification)

  const rtNow = { value: T0 + 5_000 }
  const mk = (assemblyX, result) => createResultVerifyRuntime({
    layout: { historyDir: assemblyX.historyDir, controlDir: assemblyX.controlDir ?? dir },
    store: assemblyX.store,
    history: assemblyX.history,
    invoker: async () => ({ status: 'ok', started: true, sessionId: 's1', result }),
    nowMs: () => rtNow.value,
    stateDir: assemblyX.stateDir ?? dir,
    verifyRetryBaseMs: 1_000,
    verifyRetryCapMs: 60_000,
  })
  const statusAfter = async (assemblyX) => {
    await assemblyX.history.ensureLoaded()
    return assemblyX.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status
  }

  // (a) model OMITS artifacts entirely and claims PASS with a correct anchor:
  // binding is decided by the CONTRACT (server-checked product), not by the
  // report's own evidence choices. Contract satisfied → binds.
  await mk(assembly, { final_status: 'PASS', counters: { items: 3 }, evidence: [{ kind: 'history_run', run_id: run.run_id }] }).tick()
  assert.equal(await statusAfter(assembly), 'PASS',
    'contract product present+matching: PASS binds regardless of what the report itself references')

  // Fresh assembly for the negatives: contract pinned to a product the run
  // has NOT produced.
  const dir2 = newDir()
  t.after(() => rmSync(dir2, { recursive: true, force: true }))
  const missing = join(dir2, 'original-product.json') // never created yet
  const assembly2 = await realAssembly(dir2, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  assembly2.stateDir = dir2
  const run2 = await seedUnverifiedRun(dir2, assembly2, { artifacts: [{ path: missing, sha256: sha256File(product) }] })

  // (b) contract product MISSING: any model-claimed product (present or not)
  // proves nothing — "empty object file + items:3" is NOT a positive example.
  rtNow.value += 2_000
  await mk(assembly2, { final_status: 'PASS', counters: { items: 3 }, evidence: [{ kind: 'history_run', run_id: run2.run_id }], artifacts: [{ path: join(dir2, 'empty.json') }] }).tick()
  assert.equal(await statusAfter(assembly2), null, 'missing contract product: PASS not bound')

  // (c) an IRRELEVANT ready-made file at the contract path (content does not
  // match the pinned SHA-256) — the content requirement is unmet.
  rtNow.value += 2_000
  writeFileSync(missing, '{}')
  await mk(assembly2, { final_status: 'PASS', counters: { items: 3 }, evidence: [{ kind: 'history_run', run_id: run2.run_id }] }).tick()
  assert.equal(await statusAfter(assembly2), null, 'content-nonconforming product at the contract path: PASS not bound')

  // (d) repaired product (exact pinned content) + resolved anchor: binds.
  rtNow.value += 2_000
  writeFileSync(missing, '{"items": 3, "verified": true}')
  await mk(assembly2, { final_status: 'PASS', counters: { items: 3 }, evidence: [{ kind: 'history_run', run_id: run2.run_id }] }).tick()
  assert.equal(await statusAfter(assembly2), 'PASS', 'contract satisfied + anchor resolved: binds')
})

test('H9 (counter-example ②): persist failure blocks dispatch; corrupt state is never treated as a fresh attempt — identity is recovered from the trusted dispatch record', async (t) => {
  const dir = newDir()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const product = join(dir, 'h9-product.json')
  writeFileSync(product, '{"h9": 1}')
  const assembly = await realAssembly(dir, createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', started: true } }))
  const run = await seedUnverifiedRun(dir, assembly, { artifacts: [{ path: product, sha256: sha256File(product) }] })

  const invokerCalls = []
  const rtNow = { value: T0 + 5_000 }
  const mk = (behavior) => createResultVerifyRuntime({
    layout: { historyDir: assembly.historyDir, controlDir: dir },
    store: assembly.store,
    history: assembly.history,
    invoker: async (req) => { invokerCalls.push(req); return behavior(req) },
    nowMs: () => rtNow.value,
    stateDir: dir,
    verifyRetryBaseMs: 1_000,
    verifyRetryCapMs: 60_000,
  })
  const pass = (req) => ({ status: 'ok', started: true, sessionId: 's1', result: { final_status: 'PASS', counters: {}, evidence: [{ kind: 'history_run', run_id: req.runId }] } })

  // (a) persistence failure: make the runs dir read-only → no durable attempt
  // identity → NO dispatch (fail closed), run stays in the scan set.
  mkdirSync(join(dir, 'result-verify', 'runs'), { recursive: true })
  chmodSync(join(dir, 'result-verify', 'runs'), 0o500)
  const rtA = mk(pass)
  const tickedA = await rtA.tick()
  assert.equal(tickedA.persistBlocked, 1, 'the blocked dispatch is attributed to the persist failure')
  assert.equal(tickedA.delivered, 0, 'no verify turn without a durable attempt identity')
  assert.equal(invokerCalls.length, 0)
  assert.equal(rtA.scanUnverifiedRuns().length, 1, 'responsibility retained')
  chmodSync(join(dir, 'result-verify', 'runs'), 0o755)

  // (b) a REAL dispatch happens (attempt 1) and the turn crashes mid-flight —
  // the trusted record of that attempt is the invocation itself.
  rtNow.value += 2_000
  const crashed = mk(async () => { throw new Error('SIGKILL mid-turn') })
  await crashed.tick()
  assert.equal(invokerCalls.length, 1)
  assert.equal(invokerCalls[0].requestId, `rv:${run.run_id}:1`)

  // (c) corrupt state: a schema-broken state file is NOT reset to a fresh
  // attempt — skip loud, no dispatch, file left untouched for repair.
  const { createHash } = await import('node:crypto')
  const safe = String(run.run_id).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'run'
  const key = `${safe}.${createHash('sha256').update(String(run.run_id)).digest('hex').slice(0, 12)}`
  const stateFile = join(dir, 'result-verify', 'runs', `${key}.json`)
  writeFileSync(stateFile, '{"attempts": 3, TRUNCATED')
  const rtB = mk(pass)
  const tickedB = await rtB.tick()
  assert.equal(tickedB.stateCorrupt, 1, 'the corrupt state is attributed, not silently reset')
  assert.equal(tickedB.delivered, 0, 'no dispatch on corrupt state')
  assert.equal(invokerCalls.length, 1, 'no dispatch on corrupt state')
  assert.equal(rtB.scanUnverifiedRuns().length, 1, 'responsibility retained')
  assert.match(readFileSync(stateFile, 'utf8'), /TRUNCATED/, 'the corrupt file is left untouched for explicit repair')

  // (d) repair path recovers the ORIGINAL identity from the TRUSTED dispatch
  // record (attempt 1 was really dispatched — invokerCalls[0].requestId), so
  // the resumed dispatch is attempt 2 — never a reset to attempts:0/attempt 1.
  rtNow.value += 2_000
  const recoveredAttempts = Number(invokerCalls[invokerCalls.length - 1].requestId.split(':').pop()) // from the trusted record
  assert.equal(recoveredAttempts, 1)
  writeFileSync(stateFile, JSON.stringify({ attempts: recoveredAttempts, requestId: invokerCalls[invokerCalls.length - 1].requestId }))
  const res = await mk(pass).tick()
  assert.equal(res.delivered, 1)
  assert.equal(invokerCalls.length, 2)
  assert.equal(invokerCalls[1].requestId, `rv:${run.run_id}:2`, 'resumed dispatch continues the recovered identity (attempt 2), never a fresh attempt 1')
  await assembly.history.ensureLoaded()
  assert.equal(assembly.history.queryRuns({ jobId: 'rv-job' }).runs[0].result_status, 'PASS')
})
