import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createObservedSchedulerInvoker } from '../../src/scheduler-invoker.js'
import { createRetainedPostdeployCanary, POSTDEPLOY_CANARY_AGENT_ID, POSTDEPLOY_CANARY_MARKER, postdeployCanaryMessage } from '../../src/scheduler/deployment-canary-control.js'
import { JobStore, Scheduler } from '../../../scheduler/src/index.js'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation/store.js'
import { buildOccurrenceRecord, applyTransition, rebuildFences } from '../../../scheduler/src/occurrence-model.js'
import * as autoReconcileRuntime from '../../src/scheduler/auto-reconcile-runtime.js'

test('reserved generation-bound canary is a mechanical no-op and never reaches Router', async () => {
  const sourceSha = 'a'.repeat(40)
  const router = {
    runTurnWithRouteChain: () => assert.fail('Router must not be called'),
    registrySnapshot: () => assert.fail('registry must not be queried'),
  }
  const evidence = []
  const invoke = createObservedSchedulerInvoker({ router, definition: { getAgent: () => assert.fail('definition must not be queried') },
    writeEvidence: (row) => evidence.push(row), runtimeGeneration: sourceSha })
  const result = await invoke({ agentId: POSTDEPLOY_CANARY_AGENT_ID, sessionId: 'session', message: postdeployCanaryMessage(sourceSha) })
  assert.equal(result.status, 'ok')
  assert.equal(result.summary, POSTDEPLOY_CANARY_MARKER)
  assert.deepEqual(result.result, { final_status: 'PASS', counters: { tool_calls: 0, external_effects: 0 }, notes: `SCHEDULER_NATIVE_NOOP:${sourceSha}` })
  assert.deepEqual(result.evidence, { executionClass: 'SCHEDULER_NATIVE_NOOP', sourceSha,
    marker: POSTDEPLOY_CANARY_MARKER, toolCalls: 0, externalEffects: 0 })
  assert.equal(evidence[0].routerProcessPid, null)
})

test('reserved identity with a non-matching generation fails closed through ordinary validation', async () => {
  const router = { runTurnWithRouteChain: () => assert.fail('Router must not be called'), registrySnapshot: () => [] }
  const error = Object.assign(new Error('unknown reserved agent'), { code: 'AGENT_NOT_FOUND' })
  const invoke = createObservedSchedulerInvoker({ router, definition: { getAgent: () => { throw error } }, writeEvidence: () => {}, runtimeGeneration: 'a'.repeat(40) })
  const result = await invoke({ agentId: POSTDEPLOY_CANARY_AGENT_ID, sessionId: 'session', message: postdeployCanaryMessage('b'.repeat(40)) })
  assert.equal(result.status, 'error')
  assert.equal(result.started, false)
})

test('reserved canary passes the real Scheduler admission and completes with zero downstream calls', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'scheduler-native-canary-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const sourceSha = 'c'.repeat(40), clock = { now: 1_000 }, calls = []
  const router = { runTurnWithRouteChain: () => { calls.push('router'); assert.fail() }, registrySnapshot: () => { calls.push('registry'); return [] } }
  const invoke = createObservedSchedulerInvoker({ router, definition: { getAgent: () => { calls.push('definition'); throw new Error('absent') } },
    writeEvidence: () => {}, runtimeGeneration: sourceSha })
  const store = new JobStore(join(root, 'jobs.json'), { clock: () => clock.now })
  await createRetainedPostdeployCanary(store, { sourceSha, at: new Date(1_001).toISOString(), nowMs: 1_000 })
  const scheduler = new Scheduler({ store, invoker: invoke, deliver: () => { calls.push('delivery'); assert.fail() }, nowMs: () => clock.now })
  await scheduler.start({ autoStart: false, catchup: false })
  clock.now = 1_001
  await scheduler.tick(); await scheduler.whenIdle(); await scheduler.load()
  await scheduler.stop()
  const [run] = scheduler.listOccurrences()
  assert.equal(run.state, 'succeeded')
  assert.deepEqual(calls, [])
})

const autoJob = {
  id: 'runtime-auto-job', name: 'isolated auto reconciliation', agentId: 'agt_fixture', enabled: true,
  scheduleRevision: 1, revisionActivatedAtMs: 1_000, createdAtMs: 1_000, updatedAtMs: 1_000,
  schedule: { kind: 'every', everyMs: 60_000 }, payload: { kind: 'agentTurn', message: 'fixture' },
  delivery: { mode: 'none' }, deleteAfterRun: false, state: {},
}

function autoUnknown() {
  const record = buildOccurrenceRecord({ job: autoJob, kind: 'natural', nominalScheduledAt: 2_000, admittedAt: 3_000 })
  applyTransition(record, { to: 'outcome_unknown', at: 4_000, reason: 'fixture deadline' })
  return record
}

function recoveryRouter(record = autoUnknown(), lateOutcome = 'late_completed', terminationKind) {
  const registry = new TurnReconciliationStore({ runtimeEpoch: 'runtime-auto-epoch' })
  const triple = { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId }
  const handle = registry.mintTurnExecution({ agentId: record.ownerAgentId, processGeneration: 1,
    sessionId: `cron-run-${record.occurrenceId}`, callerCorrelation: triple })
  const terminationEvidence = terminationKind ?? (lateOutcome === 'terminated_without_outcome' ? 'child_real_exit' : 'exact_terminal_then_idle')
  const outcomeEvidence = ['completed', 'late_completed'].includes(lateOutcome) ? 'exact_turn_end_success'
    : ['failed', 'late_failed'].includes(lateOutcome) ? 'exact_turn_end_failure' : null
  if (['completed', 'failed'].includes(lateOutcome)) registry.settleDirect(handle, { outcome: lateOutcome, outcomeEvidence, terminationEvidence })
  else {
    registry.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
    registry.settleLate(handle, { lateOutcome,
      outcomeEvidence, terminationEvidence })
  }
  return { registry, handle, router: {
    resolveCallerCorrelation: (coordinates) => registry.resolveCallerCorrelation(coordinates),
    reconciliationRuntimeStatus: () => ({ generationId: registry.runtimeEpoch }),
  } }
}

function runtimeLookup(router, log) {
  const lookup = autoReconcileRuntime.createTurnRecoveryEvidenceLookup(router, log)
  assert.equal(typeof lookup, 'function', 'the Router evidence seam must be callable')
  return lookup
}

test('CTR-S4 evidence lookup consumes the exact live Router index and retains bounded identity', () => {
  const record = autoUnknown()
  const { router, handle } = recoveryRouter(record)
  const lookup = runtimeLookup(router)
  assert.equal(typeof lookup, 'function')
  assert.deepEqual(lookup(record), {
    occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId,
    agentId: 'agt_fixture', runtimeEpoch: 'runtime-auto-epoch', reconciliationHandle: handle,
    outcome: null,
    outcomeEvidence: 'exact_turn_end_success', terminationEvidence: 'exact_terminal_then_idle', lateOutcome: 'late_completed',
  })
  assert.equal(lookup({ ...record, runId: `${record.runId}-other` }), null)
  assert.equal(lookup({ ...record, requestId: `${record.requestId}-other` }), null)
})

test('CTR-S4 evidence lookup rejects negative, foreign, stale and incoherent exact readbacks', () => {
  const record = autoUnknown(), { router } = recoveryRouter(record)
  const original = router.resolveCallerCorrelation({ occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId })
  const mutations = [
    ...['pending', 'recovering', 'restart_lost', 'evicted', 'never_existed', 'conflict', 'mismatch'].map(state => ({ state })),
    { ...original, snapshot: { ...original.snapshot, agentId: 'agt_foreign' } },
    { ...original, snapshot: { ...original.snapshot, runtimeEpoch: 'old-epoch' } },
    { ...original, snapshot: { ...original.snapshot, callerCorrelation: String(record.occurrenceId) } },
    { ...original, snapshot: { ...original.snapshot, callerCorrelation: { ...original.snapshot.callerCorrelation, runId: 'foreign-run' } } },
    { ...original, snapshot: { ...original.snapshot, handle: 'another-handle' } },
    { ...original, snapshot: { ...original.snapshot, turnExecutionId: 'another-handle' } },
    { ...original, snapshot: { ...original.snapshot, state: 'pending' } },
    { ...original, snapshot: { ...original.snapshot, lateOutcome: 'late_failed' } },
    { ...original, snapshot: { ...original.snapshot, outcome: 'failed' } },
    { ...original, snapshot: { ...original.snapshot, terminationEvidence: 'untrusted' } },
  ]
  for (const response of mutations) {
    const lookup = runtimeLookup({ ...router, resolveCallerCorrelation: () => response })
    assert.equal(lookup(record), null, JSON.stringify(response))
  }
  const lookup = runtimeLookup(router)
  for (const input of [{ ...record, recordSchemaVersion: 2 }, { ...record, ownerAgentId: '' }, { ...record, requestId: '' }]) {
    assert.equal(lookup(input), null)
  }
})

test('CTR-S4 exact termination-only evidence carries UNKNOWN provenance without inferred outcome', () => {
  const record = autoUnknown(), { router, handle } = recoveryRouter(record, 'terminated_without_outcome')
  const evidence = runtimeLookup(router)(record)
  assert.equal(evidence.reconciliationHandle, handle)
  assert.equal(evidence.outcomeEvidence, null)
  assert.equal(evidence.terminationEvidence, 'child_real_exit')
  assert.equal(evidence.lateOutcome, 'terminated_without_outcome')
})

test('CTR-S4 unreadable or changing runtime evidence fails closed and logs query errors', () => {
  const record = autoUnknown(), { router } = recoveryRouter(record), errors = []
  const broken = { ...router, resolveCallerCorrelation: () => { throw new Error('registry unavailable') } }
  assert.equal(runtimeLookup(broken, { error: row => errors.push(row) })(record), null)
  assert.match(errors[0], /registry unavailable/)
  let generationReads = 0
  const changing = { ...router, reconciliationRuntimeStatus: () => ({ generationId: ++generationReads === 1 ? 'runtime-auto-epoch' : 'next-epoch' }) }
  assert.equal(runtimeLookup(changing)(record), null)
})

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function assertRuntimeStopped(runtime) {
  const result = await Promise.race([
    runtime.tick().then(() => 'allowed', error => error.code),
    new Promise(resolve => setImmediate(() => resolve('still-pending'))),
  ])
  assert.equal(result, 'AUTO_RECONCILE_STOPPED')
}

async function autoRuntimeRig(t, lateOutcome = 'late_completed', terminationKind) {
  const root = mkdtempSync(join(tmpdir(), 'ctr-s4-runtime-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const store = new JobStore(join(root, 'jobs.json'), { runLogPath: join(root, 'runs.jsonl') })
  const record = autoUnknown(), { router } = recoveryRouter(record, lateOutcome, terminationKind)
  await store.mutateDoc(doc => {
    doc.jobs = [structuredClone(autoJob)]
    doc.occurrences = [record]
    doc.fences = rebuildFences([record])
  })
  const timers = [], logs = { messages: [], errors: [], warnings: [] }
  const mount = (extra = {}) => {
    const runtime = autoReconcileRuntime.mountSchedulerAutoReconcileRuntime({
      router, store, nowMs: () => 5_000,
      log: { log: row => logs.messages.push(row), error: row => logs.errors.push(row), warn: row => logs.warnings.push(row) },
      setIntervalFn: (callback, periodMs) => {
        const timer = { callback, periodMs, cleared: false, unref() {} }
        timers.push(timer)
        return timer
      },
      clearIntervalFn: timer => { timer.cleared = true }, ...extra,
    })
    t.after(() => runtime.stop())
    return runtime
  }
  return { store, record, router, root, timers, logs, mount, bytes: () => readFileSync(store.filePath, 'utf8') }
}

test('CTR-S4 default OFF requires exactly on and performs no reads, writes or timer scheduling', async t => {
  const prior = process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
  t.after(() => prior === undefined ? delete process.env.AGENT_CORE_FENCE_AUTO_RECONCILE : process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = prior)
  const f = await autoRuntimeRig(t), before = f.bytes()
  f.store.loadDoc = async () => assert.fail('disabled mount must not read the store')
  for (const value of [undefined, 'off', 'true', '1', 'ON']) {
    if (value === undefined) delete process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
    else process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = value
    const runtime = f.mount()
    assert.equal(runtime.enabled, false)
    await runtime.tick()
    await runtime.stop()
    await assertRuntimeStopped(runtime)
  }
  assert.equal(f.timers.length, 0)
  assert.equal(f.bytes(), before)
})

test('CTR-S4 mounted timer settles exact recurring outcomes and stops future callbacks', async t => {
  for (const [lateOutcome, expected] of [['late_completed', 'succeeded'], ['late_failed', 'failed'], ['terminated_without_outcome', 'failed']]) {
    const f = await autoRuntimeRig(t, lateOutcome), runtime = f.mount({ enabled: true, intervalMs: 60_000 })
    f.timers[0].callback()
    await runtime.tick()
    const doc = await f.store.loadDoc({ force: true }), [record] = doc.occurrences
    assert.equal(record.state, expected)
    assert.equal(record.history.filter(row => row.to === 'outcome_unknown').length, 1)
    assert.equal(record.lateSettlement.actorId, 'system:fence-auto-reconcile')
    assert.equal(record.lateSettlement.businessStateAtCommit, lateOutcome === 'terminated_without_outcome' ? 'outcome_unknown' : expected)
    assert.equal(record.executionOutcome, lateOutcome === 'terminated_without_outcome' ? undefined : expected)
    assert.equal(doc.occurrences.length, 1)
    assert.deepEqual(doc.fences, {})
    await runtime.stop()
    assert.equal(f.timers[0].cleared, true)
    const before = f.bytes()
    f.timers[0].callback()
    await assertRuntimeStopped(runtime)
    assert.equal(f.bytes(), before)
  }
})

test('CTR-S4 configuration off while a pass is queued rejects locked admission', async t => {
  const prior = process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
  t.after(() => prior === undefined ? delete process.env.AGENT_CORE_FENCE_AUTO_RECONCILE : process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = prior)
  process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = 'on'
  const f = await autoRuntimeRig(t), before = f.bytes(), queued = deferred(), resume = deferred()
  const original = f.store.mutateDoc.bind(f.store)
  f.store.mutateDoc = async fn => { queued.resolve(); await resume.promise; return original(fn) }
  const runtime = f.mount(), pass = runtime.tick()
  t.after(() => resume.resolve())
  await queued.promise
  process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = 'off'
  resume.resolve()
  const result = await pass
  assert.equal(result.results[0].outcome, 'skipped')
  assert.equal(f.bytes(), before)
  await runtime.stop()
})

test('CTR-S4 stop clears timer, rejects manual ticks and drains queued nonwriting passes', async t => {
  const f = await autoRuntimeRig(t), before = f.bytes(), queued = deferred(), resume = deferred()
  const original = f.store.mutateDoc.bind(f.store)
  f.store.mutateDoc = async fn => { queued.resolve(); await resume.promise; return original(fn) }
  const runtime = f.mount({ enabled: true }), pass = runtime.tick()
  t.after(() => resume.resolve())
  await queued.promise
  let drained = false
  const stopping = runtime.stop().then(() => { drained = true })
  assert.equal(f.timers[0].cleared, true)
  await assertRuntimeStopped(runtime)
  assert.equal(drained, false)
  resume.resolve()
  await Promise.all([pass, stopping])
  assert.equal(drained, true)
  assert.equal(f.bytes(), before)
})

test('CTR-S4 stop awaits an already-admitted commit receipt before returning', async t => {
  const f = await autoRuntimeRig(t), receiptStarted = deferred(), releaseReceipt = deferred()
  const originalAppend = f.store.appendRunEvent.bind(f.store)
  f.store.appendRunEvent = async event => { receiptStarted.resolve(); await releaseReceipt.promise; return originalAppend(event) }
  const runtime = f.mount({ enabled: true }), pass = runtime.tick()
  t.after(() => releaseReceipt.resolve())
  await receiptStarted.promise
  assert.equal((await f.store.loadDoc({ force: true })).occurrences[0].state, 'succeeded')
  let drained = false
  const stopping = runtime.stop().then(() => { drained = true })
  await Promise.resolve()
  assert.equal(drained, false)
  releaseReceipt.resolve()
  await Promise.all([pass, stopping])
  assert.equal(drained, true)
  assert.equal(JSON.parse(readFileSync(join(f.root, 'runs.jsonl'), 'utf8')).action, 'late_settlement')
})

test('CTR-S4 committed ack loss and receipt append failure are surfaced truthfully', async t => {
  const f = await autoRuntimeRig(t), originalWrite = f.store._writeAtomicDoc.bind(f.store)
  f.store._writeAtomicDoc = async doc => { await originalWrite(doc); throw Object.assign(new Error('lost acknowledgement'), { mutationOutcome: 'committed' }) }
  f.store.appendRunEvent = async () => ({ ok: false, error: 'receipt disk unavailable' })
  const runtime = f.mount({ enabled: true }), result = await runtime.tick()
  assert.equal(result.committedAckLost, true)
  assert.equal(result.results[0].evidenceStatus.ok, false)
  assert.equal((await f.store.loadDoc({ force: true })).occurrences[0].state, 'succeeded')
  assert.ok(f.logs.warnings.some(row => row.includes('committed acknowledgement lost')))
  assert.ok(f.logs.errors.some(row => row.includes('receipt disk unavailable')))
  await runtime.stop()
})

test('CTR-S4 preserves direct and child-exit business outcomes and current started-idle termination', async t => {
  for (const [outcome, terminationKind, expected] of [
    ['completed', 'exact_terminal_then_idle', 'succeeded'],
    ['failed', 'exact_terminal_then_idle', 'failed'],
    ['late_completed', 'child_real_exit', 'succeeded'],
    ['late_failed', 'child_real_exit', 'failed'],
    ['terminated_without_outcome', 'exact_started_then_idle', 'failed'],
  ]) await t.test(`${outcome} with ${terminationKind}`, async st => {
    const f = await autoRuntimeRig(st, outcome, terminationKind)
    const evidence = runtimeLookup(f.router)(f.record)
    assert.equal(evidence.outcome, ['completed', 'failed'].includes(outcome) ? outcome : null)
    const runtime = f.mount({ enabled: true }), result = await runtime.tick()
    assert.equal(result?.results?.[0]?.outcome, 'settled')
    const [record] = (await f.store.loadDoc({ force: true })).occurrences
    assert.equal(record.state, expected)
    assert.equal(record.lateSettlement.businessStateAtCommit, outcome === 'terminated_without_outcome' ? 'outcome_unknown' : expected)
  })
})
