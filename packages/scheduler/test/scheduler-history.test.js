import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HistoryStore } from '../src/history.js'
import { Scheduler } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'
import { createFakeInvoker, createRecordingDelivery } from '../src/seams.js'

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

  const events = readFileSync(join(dir, 'history', 'events.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  const types = events.map((event) => event.type)
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
  const events = readFileSync(join(dir, 'history', 'events.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.ok(events.some((event) => event.type === 'fence_event' && event.fence === 'active'), 'fence activated in history')

  const occurrenceId = runs[0].occurrence_id
  const runId = runs[0].run_id
  await scheduler2.reconcileOccurrence(occurrenceId, runId, { resolvedTo: 'succeeded', evidenceNote: 'operator confirmed the external effect' })
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(history.getRun(runId).outcome, 'succeeded', 'late settlement advances the mirrored state')
  const events2 = readFileSync(join(dir, 'history', 'events.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  const settlement = events2.find((event) => event.type === 'late_settlement')
  assert.ok(settlement, 'late_settlement event recorded')
  assert.equal(settlement.basis, 'operator-reconcile')
  assert.ok(events2.some((event) => event.type === 'fence_event' && event.fence === 'cleared'), 'fence cleared in history')
  await scheduler2.stop()
})
