/**
 * Unit tests for the structured execution-history store
 * (AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 §5: ACC-001, ACC-002, ACC-003,
 * ACC-006, ACC-007, ACC-008 store-level faces).
 *
 * Engine-boundary assertions (hooks firing at the lifecycle edges) live in
 * scheduler.test.js; HTTP gate/route assertions live in product-api tests;
 * compose wiring + ingestion in production-runtime tests.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

import { HistoryStore, deriveStatusView, deriveErrorCode, applyRunFilters } from '../src/history.js'
import { JobStore } from '../src/store.js'
import { Scheduler } from '../src/scheduler.js'
import { createFakeInvoker, createRecordingDelivery } from '../src/seams.js'
import { buildOccurrenceRecord } from '../src/occurrence-model.js'

const T0 = Date.parse('2026-09-01T00:00:00Z')

function newDir(label = 'hist-') {
  return mkdtempSync(join(tmpdir(), label))
}

function makeStore(dir) {
  return new JobStore(join(dir, 'jobs.json'), { clock: () => T0 })
}

function env(dir, { now = T0, invoke, deliver } = {}) {
  const clock = { value: now }
  const store = makeStore(dir)
  const history = new HistoryStore({ dir: join(dir, 'history'), nowMs: () => clock.value })
  const scheduler = new Scheduler({
    store,
    invoker: invoke ?? createFakeInvoker(),
    deliver: deliver ?? createRecordingDelivery(),
    history,
    nowMs: () => clock.value,
  })
  return { clock, store, history, scheduler }
}

function jobInput({ id, kind = 'at', agentId = 'agt_one', deleteAfterRun } = {}) {
  const schedule = kind === 'at'
    ? { kind: 'at', at: new Date(T0 + 1_000).toISOString() }
    : { kind: 'every', everyMs: 1_000, anchorMs: T0 }
  return {
    id,
    name: `Job ${id}`,
    agentId,
    payload: { kind: 'agentTurn', message: 'do the round' },
    schedule,
    delivery: { mode: 'none' },
    ...(deleteAfterRun === undefined ? (kind === 'at' ? {} : {}) : { deleteAfterRun }),
  }
}

// ── ACC-001: one-shot + deleteAfterRun → history survives, snapshot intact ──

test('ACC-001 one-shot deleteAfterRun: definition deleted, occurrence+run+snapshot retained in history', async () => {
  const dir = newDir()
  const { history, scheduler, clock } = env(dir, {
    invoke: createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's1', durationMs: 1 } }),
  })
  await scheduler.createJob(jobInput({ id: 'one-shot-1', deleteAfterRun: true }))
  await scheduler.start({ autoStart: false })
  clock.value += 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  await history.ensureLoaded()

  const doc = await scheduler.store.loadDoc()
  assert.equal(doc.jobs.length, 0, 'definition removed from jobs[]')
  assert.equal(doc.occurrences.length, 1, 'authority ledger occurrences[] retained')
  assert.equal(doc.version, 2)

  const { runs } = history.queryRuns({ jobId: 'one-shot-1' })
  assert.equal(runs.length, 1)
  const run = runs[0]
  assert.equal(run.outcome, 'succeeded')
  assert.equal(run.status_view, 'success')
  assert.equal(run.agent_id, 'agt_one')
  assert.equal(run.session_id, `cron-run-${run.occurrence_id}`)
  assert.equal(run.correlation_id, `schcorr:${run.occurrence_id}`)
  assert.equal(run.parent_run_id, null)
  assert.equal(run.retry_count, 0)
  assert.equal(run.request_id, run.occurrence_id, 'idempotencyKey = occurrenceId (R1a execution-authority)')
  assert.equal(run.request_id_source, 'execution-authority')
  assert.equal(run.error_code, null)
  assert.equal(run.error_message, null)

  const snapshot = history.getJobSnapshot(run.run_id)
  assert.equal(snapshot.name, 'Job one-shot-1')
  assert.equal(snapshot.agent_id, 'agt_one')
  assert.equal(snapshot.schedule.kind, 'at')
  assert.equal(snapshot.delete_after_run, true)
  assert.equal(snapshot.delivery_mode, 'none')
  assert.equal(snapshot.payload_hash.startsWith('sha256:'), true)

  // events.jsonl: reserved → terminal with monotonic seq
  const lines = readFileSync(join(dir, 'history', 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const seqs = lines.map((e) => e.seq)
  for (let i = 1; i < seqs.length; i += 1) assert.ok(seqs[i] > seqs[i - 1], 'seq strictly monotonic')
  assert.equal(lines[0].type, 'occurrence_reserved')
  assert.ok(lines.some((e) => e.type === 'run_terminal'), 'terminal event present')
  // monthly projection exists and matches the run
  const months = readdirSync(join(dir, 'history')).filter((f) => /^runs-\d{6}\.json$/.test(f))
  assert.equal(months.length, 1)
  const partition = JSON.parse(readFileSync(join(dir, 'history', months[0]), 'utf8'))
  assert.equal(partition.version, 1)
  assert.equal(partition.records.length, 1)
  assert.equal(partition.records[0].run_id, run.run_id)
  await scheduler.stop()
})

// ── ACC-002: recurring job → independent occurrences; replay converges ──────

test('ACC-002 recurring job: 3 independent occurrences/runs, upsert-merge on replay', async () => {
  const dir = newDir()
  const { history, scheduler, clock } = env(dir, {
    invoke: createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's', durationMs: 1 } }),
  })
  await scheduler.createJob({ ...jobInput({ id: 'recurring-1', kind: 'every' }), deleteAfterRun: false })
  await scheduler.start({ autoStart: false, catchup: false })
  // everyMs=1000 slots; the engine's MIN_REFIRE_GAP (2s) + terminal boundary
  // means the wall clock must clear (last terminal + 2s) for the next slot.
  for (const advance of [1_000, 3_000, 3_000]) {
    clock.value += advance
    await scheduler.tick()
    await scheduler.whenIdle()
  }
  await history.ensureLoaded()
  const { runs } = history.queryRuns({ jobId: 'recurring-1' })
  assert.equal(runs.length, 3)
  const ids = new Set(runs.map((r) => r.occurrence_id))
  assert.equal(ids.size, 3, 'occurrence ids mutually distinct')
  const scheduled = runs.map((r) => r.scheduled_at)
  for (const [a, b] of scheduled.slice(1).map((x, i) => [scheduled[i], x])) {
    assert.ok(a >= b, 'scheduled_at descending order')
  }

  // simulated restart re-derivation: same identity observed again → upsert-merge
  const doc = await scheduler.store.loadDoc()
  const record = doc.occurrences[0]
  const job = doc.jobs.find((j) => j.id === 'recurring-1')
  const before = history.queryRuns({ jobId: 'recurring-1' }).runs.length
  const outcome = await history.occurrenceReserved({ record, job })
  assert.equal(outcome.deduped, true, 'same identity converges to the same occurrence')
  const after = history.queryRuns({ jobId: 'recurring-1' }).runs.length
  assert.equal(after, before, 'no second record minted')
  await scheduler.stop()
})

// ── ACC-003: failure + retry chain + timeout + delivery classification ──────

test('ACC-003a failure and auto-retry: correlation shared, parent_run_id linked, retry_count derived', async () => {
  const dir = newDir()
  let calls = 0
  const invoke = createFakeInvoker({
    outcome: () => {
      calls += 1
      return calls === 1
        ? { status: 'error', error: 'transient boom', started: true, evidence: { terminationEvidence: 'child_real_exit' } }
        : { status: 'ok', summary: 'recovered', sessionId: 's', durationMs: 1 }
    },
  })
  const { history, scheduler, clock } = env(dir, { invoke })
  await scheduler.createJob({
    ...jobInput({ id: 'retry-1', kind: 'every' }),
    deleteAfterRun: false,
    retry: { auto: true },
  })
  await scheduler.start({ autoStart: false, catchup: false })
  clock.value += 1_000
  await scheduler.tick()
  await scheduler.whenIdle()
  clock.value += 30_000 // one-shot retry backoff window
  await scheduler.tick()
  await scheduler.whenIdle()
  await history.ensureLoaded()

  const { runs } = history.queryRuns({ jobId: 'retry-1' })
  assert.equal(runs.length, 2, 'root + retry run')
  const [retry, root] = runs // scheduled_at desc → the retry (later slot) first
  assert.equal(retry.retry_of_occurrence_id, root.occurrence_id)
  assert.equal(retry.parent_run_id, root.run_id)
  assert.equal(retry.correlation_id, root.correlation_id, 'retry chain shares the chain-root correlation')
  assert.equal(root.retry_count, 0)
  assert.equal(retry.retry_count, 1)
  assert.equal(root.outcome, 'failed')
  assert.equal(root.error_code, 'FAILED')
  assert.equal(root.status_view, 'failed')
  assert.equal(retry.outcome, 'succeeded')

  const byCorrelation = history.queryRuns({ correlationId: root.correlation_id })
  assert.equal(byCorrelation.runs.length, 2, 'whole chain queryable via correlation_id')

  const occView = history.getOccurrence(retry.occurrence_id)
  assert.equal(occView.retry_chain.length, 2)
  assert.equal(occView.retry_chain[0].occurrence_id, root.occurrence_id, 'chain root first')
  await scheduler.stop()
})

test('ACC-003b timeout without termination proof → outcome_unknown + TIMEOUT classification', async () => {
  const dir = newDir()
  const { history, scheduler, clock } = env(dir)
  // Drive the store directly: an admitted occurrence whose deadline expired
  // without termination proof is classified by the engine as outcome_unknown.
  await scheduler.createJob({ ...jobInput({ id: 'timeout-1', kind: 'every' }), deleteAfterRun: false })
  await scheduler.start({ autoStart: false, catchup: false })
  clock.value += 1_000
  const reserved = await scheduler._reserve({ kind: 'natural', job: scheduler.doc.jobs[0], nominalScheduledAt: clock.value })
  assert.ok(reserved?.record)
  await history.ensureLoaded()
  await history.runState({
    record: { occurrenceId: reserved.record.occurrenceId, runId: reserved.record.runId, jobId: 'timeout-1' },
    state: 'outcome_unknown',
    reason: 'execution deadline exceeded without termination proof',
  })
  const { runs } = history.queryRuns({ status: 'timeout' })
  assert.equal(runs.length, 1)
  assert.equal(runs[0].outcome, 'outcome_unknown')
  assert.equal(runs[0].error_code, 'TIMEOUT')
  assert.equal(runs[0].status_view, 'timeout')
  assert.equal(runs[0].ended_at, null, 'no proven termination')
  const view = history.getOccurrence(reserved.record.occurrenceId)
  assert.equal(view.occurrence.fenced, true, 'fence fact recorded on the occurrence')
  await scheduler.stop()
})

test('ACC-003c delivery failure never rewrites execution success (DELIVERY_FAILED classification)', async () => {
  const dir = newDir()
  const { history, scheduler, clock } = env(dir, {
    invoke: createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's', durationMs: 1 } }),
    deliver: async () => { throw new Error('channel down') },
  })
  await scheduler.createJob({
    ...jobInput({ id: 'delivery-1', kind: 'every' }),
    deleteAfterRun: false,
    delivery: { mode: 'announce' },
  })
  await scheduler.start({ autoStart: false, catchup: false })
  clock.value += 1_000
  await scheduler.tick()
  await scheduler.whenIdle()
  await history.ensureLoaded()
  const { runs } = history.queryRuns({ jobId: 'delivery-1' })
  assert.equal(runs.length, 1)
  assert.equal(runs[0].outcome, 'succeeded', 'execution outcome unchanged')
  assert.equal(runs[0].status_view, 'success')
  assert.equal(runs[0].delivery_status, 'not-delivered')
  assert.equal(runs[0].error_code, 'DELIVERY_FAILED')
  await scheduler.stop()
})

// ── ACC-006: replay heal + corrupt-line fail-visible + no truncation ────────

test('ACC-006 crash between event append and projection commit heals on load', async () => {
  const dir = newDir()
  const history = new HistoryStore({ dir, nowMs: () => T0 })
  await history.occurrenceReserved({
    record: buildOccurrenceRecord({
      job: { id: 'j1', scheduleRevision: 1, agentId: 'agt_x', payload: { message: 'm' } },
      kind: 'natural', nominalScheduledAt: T0, admittedAt: T0, timeoutMs: 60_000,
    }),
    job: { id: 'j1', name: 'J1', agentId: 'agt_x', schedule: { kind: 'every', everyMs: 1000 }, delivery: { mode: 'none' }, deleteAfterRun: false, payload: { message: 'm' } },
  })
  await history.runTerminal({
    record: { occurrenceId: history._occurrences.keys().next().value, runId: `run:${history._occurrences.keys().next().value}`, jobId: 'j1' },
    classification: { state: 'succeeded', reason: 'done', endedAt: T0 + 5 },
    deliveryStatus: 'not-requested',
    outcome: {},
  })
  // Simulate the crash window: delete the projection (events survived).
  const eventsBefore = readFileSync(join(dir, 'events.jsonl'), 'utf8')
  assert.ok(eventsBefore.includes('run_terminal'))
  const { readdirSync } = await import('node:fs')
  for (const f of readdirSync(dir)) if (/^runs-\d{6}\.json$/.test(f)) writeFileSync(join(dir, f), '{}')

  const healed = new HistoryStore({ dir, nowMs: () => T0 })
  await healed.load()
  const { runs } = healed.queryRuns({})
  assert.equal(runs.length, 1, 'projection rebuilt from events')
  assert.equal(runs[0].outcome, 'succeeded')
  const partition = JSON.parse(readFileSync(join(dir, 'runs-202609.json'), 'utf8'))
  assert.equal(partition.records.length, 1, 'partition rewritten to match events')

  // events.jsonl is append-only across reloads: load never truncates.
  assert.equal(readFileSync(join(dir, 'events.jsonl'), 'utf8'), eventsBefore)
})

test('ACC-006 corrupt event lines are skipped fail-visible, evidence stream survives', async () => {
  const dir = newDir()
  const history = new HistoryStore({ dir, nowMs: () => T0 })
  await history.occurrenceReserved({
    record: buildOccurrenceRecord({
      job: { id: 'j1', scheduleRevision: 1, agentId: 'agt_x', payload: { message: 'm' } },
      kind: 'natural', nominalScheduledAt: T0, admittedAt: T0, timeoutMs: 60_000,
    }),
    job: { id: 'j1', name: 'J1', agentId: 'agt_x', schedule: { kind: 'every', everyMs: 1000 }, delivery: { mode: 'none' }, deleteAfterRun: false, payload: { message: 'm' } },
  })
  appendFileSync(join(dir, 'events.jsonl'), '{not json at all\n')
  const warned = []
  const reloaded = new HistoryStore({ dir, nowMs: () => T0, log: { warn: (m) => warned.push(m) } })
  await reloaded.load()
  // The admitted occurrence materializes a RunRecord at outcome=admitted
  // (R2: outcome may be admitted — queryable before any terminal outcome).
  const admitted = reloaded.queryRuns({ status: 'admitted' }).runs
  assert.equal(admitted.length, 1, 'occurrence reserved → admitted run record')
  assert.equal(admitted[0].outcome, 'admitted')
  assert.equal(reloaded.queryRuns({ status: 'success' }).runs.length, 0, 'no terminal outcome recorded')
  assert.ok(warned.some((m) => m.includes('1 unparseable')), 'skipped lines reported fail-visible')
  assert.ok(reloaded.getOccurrence(reloaded._occurrences.keys().next().value), 'prior valid events still applied')
})

// ── ACC-007: job deletion never touches history bytes ───────────────────────

test('ACC-007 job deletion (operator path) leaves the history directory byte-identical', async () => {
  const dir = newDir()
  const { history, scheduler, clock } = env(dir, {
    invoke: createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's', durationMs: 1 } }),
  })
  await scheduler.createJob({ ...jobInput({ id: 'deleted-1' }), deleteAfterRun: false })
  await scheduler.start({ autoStart: false })
  clock.value += 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  await history.ensureLoaded()
  const snap = () => JSON.stringify(readdirSync(join(dir, 'history')).sort().map((n) => createHash('sha256').update(readFileSync(join(dir, 'history', n))).digest('hex')))
  // let the fire-and-forget history writes (delivery/runStarted) settle
  await new Promise((resolve) => setTimeout(resolve, 50))
  const before = snap()
  // operator deletion path (definition-only — D-007 §7.3)
  await scheduler.deleteJob('deleted-1')
  assert.equal(snap(), before, 'history bytes untouched by job deletion')
  // and the history still serves the full run with its snapshot
  const { runs } = history.queryRuns({ jobId: 'deleted-1' })
  assert.equal(runs.length, 1)
  assert.equal(history.getJobSnapshot(runs[0].run_id).name, 'Job deleted-1')
  await scheduler.stop()
})

// ── ACC-008 (store face): result envelope persisted verbatim or rejected ────

test('ACC-008 store face: result / result_error_code persisted without interpretation', async () => {
  const dir = newDir()
  const history = new HistoryStore({ dir, nowMs: () => T0 })
  const record = buildOccurrenceRecord({
    job: { id: 'j1', scheduleRevision: 1, agentId: 'agt_x', payload: { message: 'm' } },
    kind: 'natural', nominalScheduledAt: T0, admittedAt: T0, timeoutMs: 60_000,
  })
  await history.occurrenceReserved({
    record,
    job: { id: 'j1', name: 'J1', agentId: 'agt_x', schedule: { kind: 'every', everyMs: 1000 }, delivery: { mode: 'none' }, deleteAfterRun: false, payload: { message: 'm' } },
  })
  const opaque = { final_status: 'PARTIAL', counters: { pages_scanned: 5, skipped: 2 }, notes: 'partial round', wake_sent: [{ target_agent_id: 'agt_b', workflow_instance_id: 'wi1', request_id: 'wdhr1:wi1:agt_b', session_id: 'sess1' }] }
  const runRecord = await history.runTerminal({
    record: { occurrenceId: record.occurrenceId, runId: record.runId, jobId: 'j1' },
    classification: { state: 'succeeded', reason: 'invoker returned terminal success', endedAt: T0 + 5 },
    deliveryStatus: 'not-requested',
    outcome: { result: opaque },
  })
  assert.equal(runRecord.result_recorded, true)
  assert.deepEqual(runRecord.result, opaque, 'opaque JSON persisted verbatim')
  assert.equal(runRecord.result_status, 'PARTIAL')

  // ingestion rejection face: scheduler records only the code
  const record2 = buildOccurrenceRecord({
    job: { id: 'j2', scheduleRevision: 1, agentId: 'agt_x', payload: { message: 'm' } },
    kind: 'natural', nominalScheduledAt: T0 + 1, admittedAt: T0 + 1, timeoutMs: 60_000,
  })
  await history.occurrenceReserved({ record: record2, job: null })
  const rejected = await history.runTerminal({
    record: { occurrenceId: record2.occurrenceId, runId: record2.runId, jobId: 'j2' },
    classification: { state: 'succeeded', reason: 'invoker returned terminal success', endedAt: T0 + 6 },
    deliveryStatus: 'not-requested',
    outcome: { result_error_code: 'INVALID_SCHEMA' },
  })
  assert.equal(rejected.result_recorded, false)
  assert.equal(rejected.result_error_code, 'INVALID_SCHEMA')
  assert.equal(rejected.result, null)
  assert.equal(rejected.outcome, 'succeeded', 'execution outcome unaffected (fail-soft)')
})

// ── derived vocabulary units (R3/R10) ────────────────────────────────────────

test('status_view / error_code derivation follows the frozen R3/R10 tables', () => {
  assert.equal(deriveStatusView('succeeded', null), 'success')
  assert.equal(deriveStatusView('failed', 'FAILED'), 'failed')
  assert.equal(deriveStatusView('outcome_unknown', 'TIMEOUT'), 'timeout')
  assert.equal(deriveStatusView('outcome_unknown', null), 'outcome_unknown')
  assert.equal(deriveStatusView('failed', 'CANCELLED'), 'cancelled')
  assert.equal(deriveStatusView('running', null), 'running')
  assert.equal(deriveStatusView('admitted', null), 'admitted')
  assert.equal(deriveErrorCode({ state: 'failed', terminalEvidence: { kind: 'pre-start-rejection' }, reason: 'scheduler-router: agent agt_x is disabled (not runnable)' }), 'AGENT_DISABLED')
  assert.equal(deriveErrorCode({ state: 'failed', terminalEvidence: { kind: 'pre-start-rejection' }, reason: 'unknown agent agt_x (AGENT_NOT_FOUND)' }), 'AGENT_NOT_FOUND')
  assert.equal(deriveErrorCode({ state: 'failed', terminalEvidence: { kind: 'pre-start-rejection' }, reason: 'mystery' }), 'FAILED')
  assert.equal(deriveErrorCode({ state: 'outcome_unknown', reason: 'execution deadline exceeded without termination proof: cron: job execution timed out' }), 'TIMEOUT')
  assert.equal(deriveErrorCode({ state: 'outcome_unknown', reason: 'engine crash guard: kaboom' }), null)
  assert.equal(deriveErrorCode({ state: 'succeeded' }), null)
})

// ── query surface: filters + cursor pagination ───────────────────────────────

test('queryRuns filters compose and cursor pagination walks in scheduled_at desc order', async () => {
  const dir = newDir()
  const history = new HistoryStore({ dir, nowMs: () => T0 })
  for (let i = 0; i < 5; i += 1) {
    const agentId = i < 3 ? 'agt_a' : 'agt_b'
    const record = buildOccurrenceRecord({
      job: { id: `j${i % 2}`, scheduleRevision: 1, agentId, payload: { message: 'm' } },
      kind: 'natural', nominalScheduledAt: T0 + i * 1_000, admittedAt: T0 + i * 1_000, timeoutMs: 60_000,
    })
    await history.occurrenceReserved({
      record,
      job: { id: `j${i % 2}`, name: `J${i}`, agentId, schedule: { kind: 'every', everyMs: 1000 }, delivery: { mode: 'none' }, deleteAfterRun: false, payload: { message: 'm' } },
    })
    await history.runTerminal({
      record: { occurrenceId: record.occurrenceId, runId: record.runId, jobId: record.jobId },
      classification: { state: i % 2 === 0 ? 'succeeded' : 'failed', reason: i % 2 === 0 ? 'ok terminal' : 'invoke failed', endedAt: T0 + i * 1_000 + 5 },
      deliveryStatus: 'not-requested',
      outcome: {},
    })
  }
  const all = history.queryRuns({})
  assert.equal(all.runs.length, 5)
  assert.equal(all.next_cursor, null)

  const filtered = history.queryRuns({ agentId: 'agt_a', status: 'failed' })
  assert.equal(filtered.runs.length, 1)
  assert.equal(filtered.runs[0].agent_id, 'agt_a')
  assert.equal(filtered.runs[0].status_view, 'failed')

  const unknown = history.queryRuns({ status: 'scheduled' })
  assert.equal(unknown.runs.length, 0)
  assert.match(unknown.notice ?? '', /not a durable history state/)

  // pagination
  const page1 = history.queryRuns({ limit: 2 })
  assert.equal(page1.runs.length, 2)
  assert.notEqual(page1.next_cursor, null)
  const page2 = history.queryRuns({ limit: 2, cursor: page1.next_cursor })
  assert.equal(page2.runs.length, 2)
  const page3 = history.queryRuns({ limit: 2, cursor: page2.next_cursor })
  assert.equal(page3.runs.length, 1)
  assert.equal(page3.next_cursor, null)
  const seen = [...page1.runs, ...page2.runs, ...page3.runs].map((r) => r.run_id)
  assert.equal(new Set(seen).size, 5, 'cursor walk covers all runs exactly once')
})

test('applyRunFilters limit is capped at 200 store-side (the API layer rejects >200 as invalid_query)', () => {
  const runs = new Map()
  for (let i = 0; i < 3; i += 1) runs.set(`run:${i}`, { run_id: `run:${i}`, scheduled_at: new Date(T0 + i).toISOString() })
  const { runs: page } = applyRunFilters(runs, { limit: 1000 })
  assert.equal(page.length, 3, 'store clamp keeps the query usable')
})

// ── coexistence: history does not touch jobs.json / runs.jsonl (R-H2/R-H3) ──

test('history store coexistence: jobs.json document shape and runs.jsonl untouched by history writes', async () => {
  const dir = newDir()
  const { history, scheduler, clock } = env(dir, {
    invoke: createFakeInvoker({ outcome: { status: 'ok', summary: 'done', sessionId: 's', durationMs: 1 } }),
  })
  await scheduler.createJob({ ...jobInput({ id: 'coexist-1', kind: 'every' }), deleteAfterRun: false })
  await scheduler.start({ autoStart: false, catchup: false })
  clock.value += 1_000
  await scheduler.tick()
  await scheduler.whenIdle()
  await history.ensureLoaded()

  const doc = JSON.parse(readFileSync(join(dir, 'jobs.json'), 'utf8'))
  assert.deepEqual(Object.keys(doc).sort(), ['fences', 'jobs', 'occurrences', 'version'], 'v2 doc shape EXACT (R-H2)')
  assert.ok(!('history' in doc), 'no history fields inside jobs.json')
  assert.ok(existsSync(join(dir, 'runs.jsonl')), 'runs.jsonl evidence log still present (R-H3)')
  const runsLog = readFileSync(join(dir, 'runs.jsonl'), 'utf8')
  assert.ok(runsLog.includes('occurrence_reserved'), 'engine still double-writes runs.jsonl evidence')
  await scheduler.stop()
})
