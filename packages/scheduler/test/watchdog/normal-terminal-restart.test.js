/** #637: real disposable Router/Scheduler persistence at the writeback crash boundary. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createFakeInvoker, createRecordingDelivery } from '../../src/seams.js'
import { createSelfOpsAccess } from '../../src/self-ops/index.js'
import { classifyRouter } from '../../src/self-ops/diagnosis.js'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation-store.js'

const OWNER = 'agt_637_test'
const EVERY_MS = 60_000
const START = 1_800_000_000_000
const coords = (record) => ({
  occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId,
})
const moduleUrl = (path) => JSON.stringify(new URL(path, import.meta.url).href)

// A real child exits inside the invocation seam, immediately after Router's
// synchronous durable terminal commit. Scheduler never receives the result;
// its canonical reservation remains admitted on disk. No raw store edits,
// fake lease PID, production paths, credentials or external delivery.
const crashProgram = `
import { Scheduler } from ${moduleUrl('../../src/scheduler.js')}
import { JobStore } from ${moduleUrl('../../src/store.js')}
import { TurnReconciliationStore } from ${moduleUrl('../../../agent-router/src/reconciliation-store.js')}
const [dir, outcome] = process.argv.slice(1)
const store = new JobStore(dir + '/jobs.json')
const router = new TurnReconciliationStore({ persistenceFile: dir + '/router.json', runtimeEpoch: 'before' })
let now = ${START}
const invoker = {
  assertRunnable: () => true,
  invokeAgent: async (request) => {
    const callerCorrelation = { occurrenceId: request.occurrenceId, runId: request.runId, requestId: request.requestId }
    const handle = router.mintTurnExecution({ agentId: request.agentId, processGeneration: 1,
      sessionId: request.sessionId, callerCorrelation })
    router.settleDirect(handle, {
      outcome,
      outcomeEvidence: outcome === 'completed' ? 'exact_turn_end_success'
        : outcome === 'failed' ? 'exact_turn_end_failure' : 'proven_zero_byte_rejection',
      terminationEvidence: outcome === 'not_admitted' ? null : 'exact_terminal_then_idle',
    })
    process.exit(0)
  },
}
const scheduler = new Scheduler({ store, invoker, nowMs: () => now })
await scheduler.start({ autoStart: false, catchup: false })
await scheduler.createJob({ name: '637 isolated restart', agentId: '${OWNER}', enabled: true,
  schedule: { kind: 'every', everyMs: ${EVERY_MS}, anchorMs: now },
  payload: { kind: 'agentTurn', message: 'isolated test only' },
  delivery: { mode: 'announce', channel: 'test', to: 'test-only' } })
now += ${EVERY_MS + 1000}
await scheduler.tick()
await scheduler.whenIdle()
throw new Error('crash boundary was not reached')
`

async function fixture(t, outcome = 'completed') {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-637-'))
  const engines = []
  t.after(async () => {
    for (const engine of engines) await engine.stop()
    await rm(dir, { recursive: true, force: true })
  })
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', crashProgram, dir, outcome], {
    encoding: 'utf8', timeout: 20_000,
  })
  assert.equal(child.error, undefined, `isolated child: ${child.error}`)
  assert.equal(child.status, 0, `isolated child stderr: ${child.stderr}`)
  const store = new JobStore(join(dir, 'jobs.json'))
  const beforeRestart = await store.loadDoc({ force: true })
  assert.equal(beforeRestart.occurrences.length, 1, 'exactly one canonical reservation survived')
  const record = beforeRestart.occurrences[0]
  assert.equal(record.state, 'admitted', 'crash precedes Scheduler terminal writeback')
  const clock = { value: START + EVERY_MS + 1000 }
  const router = new TurnReconciliationStore({ persistenceFile: join(dir, 'router.json'), runtimeEpoch: 'after' })
  const wire = router.resolveCallerCorrelation(coords(record))
  assert.equal(wire.state, 'settled', 'Router terminal survives actual process exit and store reopen')
  assert.equal(wire.snapshot.outcome, outcome)
  assert.equal(wire.snapshot.runtimeEpoch, 'before')
  assert.equal(wire.snapshot.lateOutcome, null)
  const invoker = createFakeInvoker()
  const deliver = createRecordingDelivery()
  async function adopt(resolveCallerCorrelation = (triple) => router.resolveCallerCorrelation(triple)) {
    const scheduler = new Scheduler({
      store: new JobStore(store.filePath), invoker, deliver, nowMs: () => clock.value,
      reconciliation: { resolveCallerCorrelation, consultIntervalMs: 0 },
    })
    await scheduler.start({ autoStart: false, catchup: false })
    engines.push(scheduler)
    return scheduler
  }
  const bytes = () => readFile(store.filePath, 'utf8')
  const events = async () => (await readFile(store.runLogPath, 'utf8'))
    .trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  return { dir, store, record, clock, router, wire, invoker, deliver, adopt, bytes, events }
}

for (const [outcome, expected, disposition] of [
  ['completed', 'succeeded', 'late_completed'],
  ['failed', 'failed', 'late_failed'],
  ['not_admitted', 'failed', 'late_failed'],
]) {
  test(`#637 ${outcome}: persisted Router terminal + crash before Scheduler writeback settles once and resumes future slots`, async (t) => {
    const fx = await fixture(t, outcome)
    const engine = await fx.adopt()
    const recovered = await fx.store.loadDoc({ force: true })
    assert.equal(recovered.occurrences[0].state, 'outcome_unknown', 'real restart sweep fences the orphan')
    assert.ok(recovered.fences[fx.record.jobId])
    const selfOps = createSelfOpsAccess({
      store: fx.store, clock: () => fx.clock.value,
      resolveCallerCorrelation: (triple) => fx.router.resolveCallerCorrelation(triple),
    })
    const beforeSelf = await fx.bytes()
    const selfResult = await selfOps.handlers.self_ops.reconcile_turn({
      job_id: fx.record.jobId, occurrence_id: fx.record.occurrenceId, run_id: fx.record.runId,
    }, { callerAgentId: OWNER })
    assert.equal(await fx.bytes(), beforeSelf, 'caller-self cannot write business settlement')
    const status = await selfOps.handlers.self_ops.status({}, { callerAgentId: OWNER })

    await engine.tick()
    await engine.whenIdle()
    let doc = await fx.store.loadDoc({ force: true })
    const settled = doc.occurrences.find((row) => row.occurrenceId === fx.record.occurrenceId)
    assert.equal(settled.state, expected, 'ordinary Router terminal must settle the restart orphan')
    assert.equal(settled.lateSettlement.basis, 'trusted-late-evidence')
    assert.equal(settled.executionOutcome, expected)
    assert.equal(doc.fences[fx.record.jobId], undefined)
    assert.equal(classifyRouter(fx.wire, fx.record, OWNER).disposition, disposition)
    assert.equal(selfResult.ok, false)
    assert.equal(selfResult.error.code, 'business_outcome_available', 'self path remains termination-only')
    assert.equal(status.result.scheduler.blockers[0].reconciliationState,
      expected === 'succeeded' ? 'RECONCILED_SUCCESS' : 'RECONCILED_FAILURE')
    assert.equal(doc.occurrences.length, 1, 'reconciliation does not admit or replay')
    assert.equal(fx.invoker.calls.length, 0)
    assert.equal(fx.deliver.deliveries.length, 0, 'old result is never delivered again')
    const next = doc.jobs[0].state.nextRunAtMs
    assert.ok(next > fx.clock.value, 'resume only a strictly future natural slot')

    const stable = await fx.bytes()
    await Promise.all([engine.tick(), engine.tick(), engine.tick()])
    await engine._reconcileTrustedOutcomes()
    assert.equal(await fx.bytes(), stable, 'duplicate ticks/reconciliation are authoritative zero-write')
    await engine.stop()
    const restarted = await fx.adopt()
    await restarted.tick()
    const settlements = (await fx.events()).filter((event) => event.action === 'late_settlement')
    assert.equal(settlements.length, 1, 'settlement is once across restart and repeated reconciliation')
    fx.clock.value = next
    await Promise.all([restarted.tick(), restarted.tick()])
    await restarted.whenIdle()
    doc = await fx.store.loadDoc({ force: true })
    assert.equal(doc.occurrences.length, 2)
    const fresh = doc.occurrences.find((row) => row.occurrenceId !== fx.record.occurrenceId)
    assert.equal(fresh.kind, 'natural')
    // nominalScheduledAt is the anchor-aligned natural grid slot (previous
    // natural slot at-or-before the tick time), NOT the terminal-hold
    // projection nextRunAtMs (operationalEndedAt + everyMs). The two
    // coordinates differ by up to one everyMs in this fixture.
    assert.ok(Number.isFinite(fresh.nominalScheduledAt), 'natural nominal slot is finite')
    assert.ok(fresh.nominalScheduledAt <= next, 'natural slot is at-or-before the tick time')
    assert.notEqual(fresh.runId, fx.record.runId)
    assert.equal(fx.invoker.calls.length, 1, 'one fresh admission, no replay of old run')
    assert.equal(fx.invoker.calls[0].occurrenceId, fresh.occurrenceId)
    assert.equal(fx.deliver.deliveries.length, 1, 'one delivery for the fresh occurrence only')
    await restarted.tick()
    await restarted._reconcileTrustedOutcomes()
    assert.equal(fx.invoker.calls.length, 1)
    assert.equal(fx.deliver.deliveries.length, 1)
    assert.equal((await fx.events()).filter((event) => event.action === 'late_settlement').length, 1)
  })
}

test('#637 UNKNOWN, identity mismatch, explicit conflict and incomplete termination remain fenced with zero writes', async (t) => {
  const fx = await fixture(t)
  let wire = fx.wire
  const engine = await fx.adopt(() => wire)
  const before = await fx.bytes()
  const negative = [
    ['true UNKNOWN', { ...fx.wire, state: 'pending', snapshot: { ...fx.wire.snapshot, outcome: 'outcome_unknown' } }],
    ['settled unsupported UNKNOWN', { ...fx.wire, snapshot: { ...fx.wire.snapshot, outcome: 'outcome_unknown' } }],
    ['foreign owner', { ...fx.wire, snapshot: { ...fx.wire.snapshot, agentId: 'agt_foreign' } }],
    ['explicit evidence conflict', { state: 'conflict' }],
    ['restart lost', { state: 'restart_lost' }],
    ['evicted', { state: 'evicted' }],
    ['never existed', { state: 'never_existed' }],
    ['absent proof', null],
    ['termination without evidence', { ...fx.wire, snapshot: { ...fx.wire.snapshot, outcome: 'terminated_without_outcome', terminationEvidence: null } }],
    ['termination without handle', { ...fx.wire, handle: '', snapshot: { ...fx.wire.snapshot, outcome: 'terminated_without_outcome' } }],
  ]
  for (const key of ['occurrenceId', 'runId', 'requestId']) {
    negative.push([`wrong ${key}`, { ...fx.wire, snapshot: { ...fx.wire.snapshot,
      callerCorrelation: { ...fx.wire.snapshot.callerCorrelation, [key]: 'wrong' } } }])
  }
  for (const [name, value] of negative) {
    await t.test(name, async () => {
      wire = value
      await Promise.all([engine.tick(), engine.tick()])
      await engine._reconcileTrustedOutcomes()
      assert.equal(await fx.bytes(), before, 'rejection leaves actual authoritative bytes unchanged')
      const doc = await fx.store.loadDoc({ force: true })
      assert.equal(doc.occurrences[0].state, 'outcome_unknown')
      assert.equal(doc.occurrences[0].lateSettlement, undefined)
      assert.equal(doc.occurrences[0].terminationSettlement, undefined)
      assert.ok(doc.fences[fx.record.jobId])
      assert.equal(fx.invoker.calls.length, 0)
      assert.equal(fx.deliver.deliveries.length, 0)
    })
  }
})

test('#637 existing lateOutcome takes precedence over the retained original UNKNOWN', () => {
  const record = { occurrenceId: 'occ', runId: 'run', requestId: 'request' }
  for (const lateOutcome of ['late_completed', 'late_failed']) {
    const result = classifyRouter({ state: 'settled', handle: 'test-handle', snapshot: {
      agentId: OWNER, callerCorrelation: coords(record), outcome: 'outcome_unknown', lateOutcome,
    } }, record, OWNER)
    assert.equal(result.disposition, lateOutcome)
  }
})
