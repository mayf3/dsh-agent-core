import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createObservedSchedulerInvoker } from '../../src/scheduler-invoker.js'
import { createRetainedPostdeployCanary, POSTDEPLOY_CANARY_AGENT_ID, POSTDEPLOY_CANARY_MARKER, postdeployCanaryMessage } from '../../src/scheduler/deployment-canary-control.js'
import { JobStore, Scheduler } from '../../../scheduler/src/index.js'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation/store.js'
import { buildOccurrenceRecord, applyTransition, rebuildFences } from '../../../scheduler/src/occurrence-model.js'
import { autoReconcileOccurrences, createRouterRecoveryEvidenceLookup } from '../../../scheduler/src/auto-reconcile.js'
import { mountSchedulerAutoReconcileRuntime } from '../../src/scheduler/auto-reconcile-runtime.js'

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

function autoUnknown(nominalScheduledAt = 2_000) {
  const record = buildOccurrenceRecord({ job: autoJob, kind: 'natural', nominalScheduledAt,
    admittedAt: 3_000, timeoutMs: 60_000 })
  applyTransition(record, { to: 'outcome_unknown', at: 4_000, reason: 'fixture deadline' })
  return record
}

function recoveryRouter(record, outcome = 'late_completed') {
  const registry = new TurnReconciliationStore({ runtimeEpoch: 'runtime-auto-epoch' })
  const handle = registry.mintTurnExecution({ agentId: record.ownerAgentId, processGeneration: 1,
    sessionId: `cron-run-${record.occurrenceId}`, callerCorrelation: {
      occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId,
    } })
  registry.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded', deadlineAtWallMs: 4_000 })
  if (outcome !== null) registry.settleLate(handle, {
    lateOutcome: outcome, terminationEvidence: 'child_real_exit', exitObserved: true,
    outcomeEvidence: outcome === 'late_completed' ? 'exact_turn_end_success'
      : outcome === 'late_failed' ? 'exact_turn_end_failure' : null,
  })
  return { registry, handle, router: {
    resolveCallerCorrelation: coordinates => registry.resolveCallerCorrelation(coordinates),
    reconciliationRuntimeStatus: () => ({ generationId: registry.runtimeEpoch }),
  } }
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function autoRuntimeRig(t, outcome = 'late_completed') {
  const root = mkdtempSync(join(tmpdir(), 'ctr-s4-runtime-'))
  const clock = () => 10_000
  const store = new JobStore(join(root, 'jobs.json'), { runLogPath: join(root, 'runs.jsonl'), clock })
  const record = autoUnknown(), recovery = recoveryRouter(record, outcome)
  await store.mutateDoc(doc => {
    doc.jobs = [structuredClone(autoJob)]
    doc.occurrences = [record]
    doc.fences = rebuildFences(doc.occurrences)
  })
  const timers = [], messages = [], errors = [], runtimes = [], unblock = []
  const mount = (extra = {}) => {
    const runtime = mountSchedulerAutoReconcileRuntime({ store, router: recovery.router, clock,
      log: { log: row => messages.push(row), error: row => errors.push(row) },
      setIntervalFn: (callback, periodMs) => {
        const timer = { callback, periodMs, cleared: false, unref() {} }
        timers.push(timer)
        return timer
      },
      clearIntervalFn: timer => { timer.cleared = true }, ...extra,
    })
    runtimes.push(runtime)
    return runtime
  }
  t.after(async () => {
    for (const release of unblock) release()
    await Promise.all(runtimes.map(runtime => runtime.stop()))
    rmSync(root, { recursive: true, force: true })
  })
  const bytes = () => ({ jobs: readFileSync(store.filePath, 'utf8'),
    runs: existsSync(store.runLogPath) ? readFileSync(store.runLogPath, 'utf8') : null })
  return { store, record, ...recovery, clock, timers, messages, errors, unblock, mount, bytes }
}

test('CTR-S4 default OFF requires exactly on and performs no store or Router IO or timer scheduling', async t => {
  const prior = process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
  t.after(() => prior === undefined ? delete process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
    : process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = prior)
  const f = await autoRuntimeRig(t), before = f.bytes()
  f.store._readDocRaw = async () => assert.fail('disabled mount must not read the store')
  f.router.resolveCallerCorrelation = () => assert.fail('disabled mount must not query Router')
  for (const value of [undefined, 'off', 'true', '1', 'ON']) {
    if (value === undefined) delete process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
    else process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = value
    const runtime = f.mount()
    assert.equal(runtime.enabled, false)
    await runtime.tick()
    await runtime.stop()
    await assert.rejects(runtime.tick(), { code: 'AUTO_RECONCILE_STOPPED' })
  }
  assert.equal(f.timers.length, 0)
  assert.deepEqual(f.bytes(), before)
})

test('CTR-S4 interval rejects subminute and invalid periods and preserves the allowed minimum', async t => {
  const f = await autoRuntimeRig(t)
  for (const [intervalMs, expected] of [[0, 900_000], [-1, 900_000], [59_999, 900_000],
    [Number.NaN, 900_000], [Number.POSITIVE_INFINITY, 900_000], [60_000, 60_000]]) {
    const runtime = f.mount({ enabled: true, intervalMs })
    assert.equal(f.timers.at(-1).periodMs, expected)
    await runtime.stop()
    assert.equal(f.timers.at(-1).cleared, true)
  }
})

test('CTR-S4 timer and manual ticks share one in-flight pass and one mutation', async t => {
  const f = await autoRuntimeRig(t), started = deferred(), resume = deferred()
  f.unblock.push(resume.resolve)
  const load = f.store._readDocRaw.bind(f.store), mutate = f.store.mutateDoc.bind(f.store)
  let reads = 0, mutations = 0
  f.store._readDocRaw = async options => { reads += 1; started.resolve(); await resume.promise; return load(options) }
  f.store.mutateDoc = (...args) => { mutations += 1; return mutate(...args) }
  const runtime = f.mount({ enabled: true }), pass = runtime.tick()
  await started.promise
  assert.equal(runtime.tick(), pass)
  f.timers[0].callback()
  assert.equal(runtime.tick(), pass)
  assert.equal(reads, 1)
  resume.resolve()
  const result = await pass
  assert.equal(result.results[0].resolvedTo, 'succeeded')
  assert.equal(mutations, 1)
})

test('CTR-S4 dynamic OFF while queued rechecks configuration under the mutation lock with zero byte changes', async t => {
  const prior = process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
  t.after(() => prior === undefined ? delete process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
    : process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = prior)
  process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = 'on'
  const f = await autoRuntimeRig(t), before = f.bytes(), queued = deferred(), resume = deferred()
  f.unblock.push(resume.resolve)
  const mutate = f.store.mutateDoc.bind(f.store)
  f.store.mutateDoc = async fn => { queued.resolve(); await resume.promise; return mutate(fn) }
  const runtime = f.mount(), pass = runtime.tick()
  await queued.promise
  process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = 'off'
  resume.resolve()
  const result = await pass
  assert.equal(result.results[0].outcome, 'skipped')
  assert.deepEqual(f.bytes(), before)
})

test('CTR-S4 stop drains queued nonwriting work and rejects future ticks and captured timer callbacks', async t => {
  const f = await autoRuntimeRig(t), before = f.bytes(), queued = deferred(), resume = deferred()
  f.unblock.push(resume.resolve)
  const mutate = f.store.mutateDoc.bind(f.store)
  f.store.mutateDoc = async fn => { queued.resolve(); await resume.promise; return mutate(fn) }
  const runtime = f.mount({ enabled: true }), pass = runtime.tick()
  await queued.promise
  let drained = false
  const stopping = runtime.stop().then(() => { drained = true })
  assert.equal(runtime.enabled, false)
  assert.equal(f.timers[0].cleared, true)
  await assert.rejects(runtime.tick(), { code: 'AUTO_RECONCILE_STOPPED' })
  f.timers[0].callback()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(drained, false)
  resume.resolve()
  const [result] = await Promise.all([pass, stopping])
  assert.equal(result.results[0].outcome, 'skipped')
  assert.equal(drained, true)
  assert.deepEqual(f.bytes(), before)
})

test('CTR-S4 stop waits for an already committed settlement receipt before returning', async t => {
  const f = await autoRuntimeRig(t), receiptStarted = deferred(), resume = deferred()
  f.unblock.push(resume.resolve)
  const append = f.store.appendRunEvent.bind(f.store)
  f.store.appendRunEvent = async event => { receiptStarted.resolve(); await resume.promise; return append(event) }
  const runtime = f.mount({ enabled: true }), pass = runtime.tick()
  await receiptStarted.promise
  assert.equal((await f.store.loadDoc({ force: true })).occurrences[0].state, 'succeeded')
  let drained = false
  const stopping = runtime.stop().then(() => { drained = true })
  await Promise.resolve()
  assert.equal(drained, false)
  resume.resolve()
  await Promise.all([pass, stopping])
  assert.equal(drained, true)
  const event = JSON.parse(f.bytes().runs.trim().split('\n').at(-1))
  assert.equal(event.action, 'late_settlement')
  assert.equal(event.operatorIdentity.actorId, 'system:fence-auto-reconcile')
})

test('CTR-S4 receipt append failure remains visible while the authoritative settlement stays committed', async t => {
  const f = await autoRuntimeRig(t)
  f.store.appendRunEvent = async () => ({ ok: false, error: 'fixture receipt disk unavailable' })
  const runtime = f.mount({ enabled: true }), result = await runtime.tick()
  assert.equal(result.results[0].receipt, 'failed')
  assert.equal((await f.store.loadDoc({ force: true })).occurrences[0].state, 'succeeded')
  assert.ok(f.messages.some(row => row.includes('receiptFailures=1')))
  assert.ok(f.errors.some(row => row.includes('receipt append failure')))
})

test('CTR-S4 current Router three-state evidence preserves termination-only UNKNOWN and never readmits', async t => {
  for (const [outcome, expected] of [['late_completed', 'succeeded'], ['late_failed', 'failed'],
    ['terminated_without_outcome', 'outcome_unknown']]) await t.test(outcome, async st => {
    const f = await autoRuntimeRig(st, outcome)
    const lookup = createRouterRecoveryEvidenceLookup(f.router, f.clock)
    assert.equal(lookup(f.record).snapshot.turnExecutionId, f.handle)
    const runtime = f.mount({ enabled: true }), result = await runtime.tick()
    assert.equal(result.results[0].resolvedTo, outcome === 'terminated_without_outcome' ? outcome : expected)
    const doc = await f.store.loadDoc({ force: true }), [record] = doc.occurrences
    assert.equal(record.state, expected)
    assert.deepEqual(record.history.slice(0, f.record.history.length), f.record.history)
    assert.equal(doc.occurrences.length, 1)
    assert.deepEqual(doc.fences, {})
    if (outcome === 'terminated_without_outcome') {
      assert.equal(record.executionOutcome, undefined)
      assert.equal(record.lateSettlement, undefined)
      assert.equal(record.terminationSettlement.kind, 'terminated_without_outcome')
      assert.equal(record.terminationSettlement.actorId, 'system:fence-auto-reconcile')
    } else assert.equal(record.executionOutcome, expected)
    const before = f.bytes()
    await runtime.tick()
    assert.deepEqual(f.bytes(), before)
    assert.equal(f.registry.records.size, 1)
  })
})

test('CTR-S4 pending and missing current Router evidence preserve UNKNOWN bytes and its fence', async t => {
  const f = await autoRuntimeRig(t, null), before = f.bytes()
  const runtime = f.mount({ enabled: true })
  await runtime.tick()
  assert.deepEqual(f.bytes(), before)
  f.router.resolveCallerCorrelation = () => ({ state: 'never_existed' })
  await runtime.tick()
  assert.deepEqual(f.bytes(), before)
})

test('CTR-S4 V2 load without trusted evidence is pure and preserves the store hash and all files', async t => {
  const f = await autoRuntimeRig(t, null)
  const legacyRecord = structuredClone(f.record)
  for (const key of ['recordSchemaVersion', 'ownerAgentId', 'requestId']) delete legacyRecord[key]
  const legacy = { version: 2, jobs: [autoJob], occurrences: [legacyRecord], fences: rebuildFences([legacyRecord]) }
  writeFileSync(f.store.filePath, `${JSON.stringify(legacy, null, 2)}\n`)
  f.router.resolveCallerCorrelation = () => ({ state: 'never_existed' })
  const files = () => Object.fromEntries(readdirSync(f.store.dir).sort().map(name =>
    [name, createHash('sha256').update(readFileSync(join(f.store.dir, name))).digest('hex')]))
  const before = files()
  let mutations = 0, upgrades = 0
  f.store.mutateDoc = async () => { mutations += 1; throw new Error('no mutation admitted') }
  f.store.ensureUpgraded = async () => { upgrades += 1; throw new Error('no upgrade admitted') }
  f.store.loadDoc = async () => assert.fail('auto reconciliation must never call the migrating loader')
  const raw = await f.store._readDocRaw()
  assert.equal(raw.status, 'v2')
  assert.deepEqual(raw.doc, legacy, 'pure classification preserves the V2 format and absent identity evidence')
  const runtime = f.mount({ enabled: true }), result = await runtime.tick()
  assert.deepEqual(result, { state: 'UNKNOWN', reason: 'store_requires_scheduler_upgrade', storeVersion: 2 })
  assert.equal(mutations, 0)
  assert.equal(upgrades, 0)
  assert.deepEqual(files(), before, 'no store, lock, backup, sidecar or audit file writes')
  assert.deepEqual(JSON.parse(readFileSync(f.store.filePath, 'utf8')), legacy)
  t.diagnostic(`V2 missing-evidence SHA256 before=${before['jobs.json']} after=${files()['jobs.json']}; mutations=${mutations}; upgrades=${upgrades}`)
})

test('CTR-S4 malformed load returns UNKNOWN without normalizing or writing its bytes', async t => {
  const f = await autoRuntimeRig(t, null)
  writeFileSync(f.store.filePath, '{"version":2,"occurrences":')
  const before = f.bytes(), names = readdirSync(f.store.dir).sort()
  const runtime = f.mount({ enabled: true }), result = await runtime.tick()
  assert.equal(result.state, 'UNKNOWN')
  assert.deepEqual(f.bytes(), before)
  assert.deepEqual(readdirSync(f.store.dir).sort(), names)
})

test('CTR-S4 OFF and stop during a pure read drain without a mutation', async t => {
  for (const mode of ['OFF', 'stop']) await t.test(mode, async st => {
    const prior = process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
    st.after(() => prior === undefined ? delete process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
      : process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = prior)
    process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = 'on'
    const f = await autoRuntimeRig(st), before = f.bytes(), started = deferred(), resume = deferred()
    f.unblock.push(resume.resolve)
    const load = f.store._readDocRaw.bind(f.store)
    f.store._readDocRaw = async () => { started.resolve(); await resume.promise; return load() }
    let mutations = 0
    f.store.mutateDoc = async () => { mutations += 1; throw new Error('no mutation admitted') }
    const runtime = f.mount(), pass = runtime.tick()
    await started.promise
    if (mode === 'OFF') process.env.AGENT_CORE_FENCE_AUTO_RECONCILE = 'off'
    const stopping = mode === 'stop' ? runtime.stop() : Promise.resolve()
    resume.resolve()
    await Promise.all([pass, stopping])
    assert.equal(mutations, 0)
    assert.deepEqual(f.bytes(), before)
  })
})

test('CTR-S4 late business evidence appends to a historical termination projection without another admission', async t => {
  for (const [outcome, expected] of [['late_completed', 'succeeded'], ['late_failed', 'failed']]) {
    const f = await autoRuntimeRig(t, outcome)
    // Independent fixture for an existing Scheduler termination projection.
    // This does not rewrite a settled Router record or claim it settles twice.
    const historical = recoveryRouter(f.record, 'terminated_without_outcome')
    await autoReconcileOccurrences(f.store, { settlements: [{ occurrenceId: f.record.occurrenceId,
      runId: f.record.runId, resolvedTo: 'terminated_without_outcome' }],
      evidenceLookup: createRouterRecoveryEvidenceLookup(historical.router, f.clock), clock: f.clock })
    const prior = (await f.store.loadDoc({ force: true })).occurrences[0]
    const runtime = f.mount({ enabled: true })
    await runtime.tick()
    const doc = await f.store.loadDoc({ force: true }), [record] = doc.occurrences
    assert.equal(record.state, expected)
    assert.equal(record.lateSettlement.resolvedTo, expected)
    assert.deepEqual(record.terminationSettlement, prior.terminationSettlement)
    assert.deepEqual(record.history.slice(0, prior.history.length), prior.history)
    assert.equal(doc.occurrences.length, 1)
  }
})

test('CTR-S4 clearing one contribution retains the aggregate fence for another unresolved UNKNOWN', async t => {
  const f = await autoRuntimeRig(t, 'terminated_without_outcome'), other = autoUnknown(2_001)
  await f.store.mutateDoc(doc => {
    doc.occurrences.push(other)
    doc.fences = rebuildFences(doc.occurrences)
  })
  const runtime = f.mount({ enabled: true })
  await runtime.tick()
  const doc = await f.store.loadDoc({ force: true })
  assert.equal(doc.occurrences[0].state, 'outcome_unknown')
  assert.equal(doc.occurrences[0].terminationSettlement.fenceAfter, true)
  assert.deepEqual(doc.occurrences[1], other)
  assert.ok(doc.fences[autoJob.id])
  assert.equal(doc.occurrences.length, 2)
})
