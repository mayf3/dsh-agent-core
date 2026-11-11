import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { ExecutionLedger } from '../../src/ledger.js'
import { createWorkflowExecutionEngine } from '../../src/engine.js'
import { readbackIdentity } from '../../src/recovery/readback-ledger.js'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation/store.js'
import { delivered, advance, detail, intent, VISIT, AGENT, T0 } from './fixture.js'

const bytes = file => readFileSync(file, 'utf8')
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ekr-readback-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const state = { now: T0, reads: 0, sends: 0, response: detail(8), turn: 'pending' }
  const ledger = new ExecutionLedger({ dir, clock: () => state.now })
  const deps = { ledger, clock: () => state.now,
    config: { staleNoProgressThresholdMs: 100, retryDelayMs: 50,
      readbackRetryDelayMs: 10, readbackMaxDelayMs: 40, maxReadbackChecksPerPoll: 2 },
    fetchDuePage: async () => ({ ok: true, items: [] }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    getTurnReconciliation: () => ({ state: state.turn }),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    deliverRun: async () => { state.sends += 1; return { ok: true, sessionId: 'main' } },
    readInstanceDetail: async () => { state.reads += 1; return state.response },
  }
  return { dir, ledger, state, deps, engine: createWorkflowExecutionEngine(deps) }
}
function observation(attempt, now, patch = {}) {
  return { ...readbackIdentity(attempt), category: 'version', result: 'scheduled', reason: 'version_changed',
    failures: 0, observedAtMs: now, nextCheckAtMs: now + 10, ...patch }
}
function receipt(t, name, initial, actual) {
  t.diagnostic(JSON.stringify({ sourceSha: process.env.EKR_SOURCE_SHA ?? 'UNKNOWN', testName: name,
    faultInjection: name, initialState: initial, expectedResult: 'persistent readback with original UNKNOWN and no business replay',
    actualResult: actual, rawReceipt: actual, productionWrites: 0 }))
}

test('B1 legacy terminal unavailable is rebuilt once, honors due time, caps backoff and never disappears', async t => {
  const f = setup(t)
  const attempt = await delivered(f.ledger)
  await f.ledger.recordReconciled({ ...readbackIdentity(attempt), expectedPhase: attempt.phase,
    verdict: 'NEEDS_REVIEW', judgment: 'settle_check_unavailable', reason: 'legacy HTTP503' })
  const original = bytes(f.ledger.eventsFile)
  f.state.response = { ok: false, code: 'http_503' }
  await Promise.all([f.engine.pollOnce(), createWorkflowExecutionEngine(f.deps).pollOnce()])
  const registered = bytes(f.ledger.eventsFile)
  assert.equal(registered.slice(original.length).trim().split('\n').length, 1)
  await f.engine.pollOnce()
  assert.equal(bytes(f.ledger.eventsFile), registered)
  assert.equal(f.state.reads, 0)
  const delays = []
  for (let i = 0; i < 5; i++) {
    f.state.now = f.ledger.get(VISIT).readback.nextCheckAtMs
    await f.engine.pollOnce()
    const current = f.ledger.get(VISIT)
    delays.push(current.readback.nextCheckAtMs - f.state.now)
    assert.equal(current.judgment, 'settle_check_unavailable')
    assert.equal(current.readback.status, 'pending')
  }
  assert.deepEqual(delays, [20, 40, 40, 40, 40])
  assert.equal(f.state.sends, 0)
  assert.ok(bytes(f.ledger.eventsFile).startsWith(original))
  receipt(t, 'B1-legacy-backoff-budget', attempt, { delays, reads: f.state.reads, sends: f.state.sends, attempt: f.ledger.get(VISIT) })
})

for (const version of [8, 6, 9]) {
  test(`B4 same visit version 7->${version} triggers durable recheck, never completion or admission`, async t => {
    const f = setup(t)
    const initial = await delivered(f.ledger)
    f.state.response = detail(version)
    f.state.now += 101
    await f.engine.pollOnce()
    assert.equal(f.ledger.get(VISIT).readback.category, 'version')
    f.state.now += 10
    await f.engine.pollOnce()
    const current = f.ledger.get(VISIT)
    assert.equal(current.state, 'ACTIVE')
    assert.equal(current.readback.status, 'pending')
    assert.equal(current.readback.observationBaseline.version, version)
    assert.equal(current.workflowStateVersionAtDispatch, 7)
    assert.equal(current.generation, 1)
    assert.equal(f.state.sends, 0)
    assert.ok(!bytes(f.ledger.eventsFile).includes('stale_superseded'))
    receipt(t, `B4-version-${version}`, initial, current)
  })
}

test('B4 restored original version returns responsibility to existing conservative stale gate', async t => {
  const f = setup(t)
  await delivered(f.ledger)
  f.state.now += 101
  await f.engine.pollOnce()
  f.state.response = detail(7)
  f.state.now += 10
  await f.engine.pollOnce()
  assert.equal(f.ledger.get(VISIT).readback.status, 'revalidated')
  assert.equal(f.ledger.get(VISIT).state, 'ACTIVE')
  await f.engine.pollOnce()
  assert.equal(f.ledger.get(VISIT).judgment, 'stale_no_progress')
  assert.equal(f.state.sends, 0)
})

test('B1/B4 UNKNOWN keeps actual Router persistence and isolated Scheduler fence bytes unchanged', async t => {
  const f = setup(t)
  const attempt = await delivered(f.ledger)
  const routerFile = join(f.dir, 'router.json')
  const router = new TurnReconciliationStore({ runtimeEpoch: 'readback-test', persistenceFile: routerFile })
  const handle = router.mintTurnExecution({ agentId: AGENT, processGeneration: 1, sessionId: 'main', callerCorrelation: { requestId: attempt.attemptId } })
  router.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'unknown-prompt', deadlineAtWallMs: T0 })
  router.markPromptWriteAttempted(handle)
  router.markOutcomeUnknown(handle, { source: 'test_untrusted_result', deadlineAtWallMs: T0 })
  const schedulerFile = join(f.dir, 'isolated-scheduler-state.json')
  writeFileSync(schedulerFile, JSON.stringify({ occurrence: 'outcome_unknown', fence: 'active', nextRun: T0 }))
  const before = [hash(routerFile), hash(schedulerFile)]
  await f.ledger.recordReconciled({ ...readbackIdentity(attempt), expectedPhase: attempt.phase,
    verdict: 'NEEDS_REVIEW', judgment: 'settle_check_unavailable', reason: 'unknown' })
  const original = bytes(f.ledger.eventsFile)
  const engine = createWorkflowExecutionEngine({ ...f.deps,
    getTurnReconciliation: query => router.getTurnReconciliation(query),
    resolveCallerCorrelation: query => router.resolveCallerCorrelation(query) })
  await engine.pollOnce()
  const responses = [undefined, { ok: false, code: '503' }, { ok: true, body: {} },
    { ok: true, body: { visibility: 'full', detail: { instance: { workflow_instance_id: 'wrong' } } } }, detail(8)]
  for (const response of responses) {
    f.state.response = response
    f.state.now = f.ledger.get(VISIT).readback.nextCheckAtMs
    await engine.pollOnce()
  }
  assert.deepEqual([hash(routerFile), hash(schedulerFile)], before)
  assert.equal(f.ledger.get(VISIT).judgment, 'settle_check_unavailable')
  assert.equal(f.ledger.get(VISIT).readback.businessOutcome, 'UNKNOWN')
  assert.equal(router.getTurnReconciliation(handle).snapshot.initialOutcome, 'outcome_unknown')
  assert.ok(bytes(f.ledger.eventsFile).startsWith(original))
  assert.ok(bytes(f.ledger.eventsFile).slice(original.length).trim().split('\n').map(JSON.parse)
    .every(event => event.kind === 'readback_checked' && event.result !== 'closed'))
  receipt(t, 'UNKNOWN-protected-files', attempt, { protectedHashesBefore: before,
    protectedHashesAfter: [hash(routerFile), hash(schedulerFile)], sends: f.state.sends,
    router: router.getTurnReconciliation(handle), attempt: f.ledger.get(VISIT) })
})

test('readback late observation cannot write a new generation or win a concurrent responsibility revision', async t => {
  const f = setup(t)
  const initial = await delivered(f.ledger)
  const held = observation(initial, f.state.now)
  await advance(f.ledger, initial)
  const before = bytes(f.ledger.eventsFile)
  assert.equal((await f.ledger.recordReadback(held)).action, 'stale_observation')
  assert.equal(bytes(f.ledger.eventsFile), before)
  const current = f.ledger.get(VISIT)
  const input = observation(current, f.state.now)
  const results = await Promise.all([f.ledger.recordReadback(input), f.ledger.recordReadback(input)])
  assert.equal(results.filter(result => result.committed).length, 1)
  assert.equal(results.find(result => !result.committed).cause, 'attempt_changed')
})

test('readback bounded oldest-due scan postpones failed items so healthy later work is checked', async t => {
  const f = setup(t)
  for (let i = 1; i <= 5; i++) {
    const nodeVisitId = VISIT.slice(0, -1) + i
    const workflowInstanceId = intent().workflowInstanceId.slice(0, -1) + i
    await f.ledger.beginAttemptIfAbsent({ ...intent(), nodeVisitId, workflowInstanceId }, async attempt => ({
      kind: 'run_delivered', agentId: AGENT, requestId: attempt.attemptId, sessionId: 'main' }))
  }
  const engine = createWorkflowExecutionEngine({ ...f.deps,
    readInstanceDetail: async ({ workflowInstanceId }) => {
      f.state.reads += 1
      if (Number(workflowInstanceId.slice(-1)) <= 3) return { ok: false, code: 'http_503' }
      const response = detail(8)
      response.body.detail.instance.workflow_instance_id = workflowInstanceId
      return response
    } })
  for (let pass = 0; pass < 3; pass++) {
    assert.ok((await engine.pollOnce()).reconciled.readbacks.length <= 2)
  }
  assert.equal(f.ledger.snapshot().filter(attempt => attempt.readback).length, 5)
  f.state.now += 10
  for (let pass = 0; pass < 3; pass++) {
    const before = f.state.reads
    await engine.pollOnce()
    assert.ok(f.state.reads - before <= 2)
  }
  assert.equal(f.state.reads, 5)
  assert.equal(f.ledger.snapshot().filter(attempt => attempt.readback.revision === 2).length, 5)
  assert.equal(f.ledger.snapshot().filter(attempt => attempt.readback.status === 'closed').length, 2)
  assert.equal(f.state.sends, 0)
})

test('readback configuration is finite and positive; corrupt ledger fails closed', async t => {
  const f = setup(t)
  for (const key of ['maxReadbackChecksPerPoll', 'readbackRetryDelayMs', 'readbackMaxDelayMs']) {
    for (const bad of [0, -1, NaN, Infinity, 1.5]) {
      assert.throws(() => createWorkflowExecutionEngine({ ...f.deps, config: { ...f.deps.config, [key]: bad } }), TypeError)
    }
  }
  await delivered(f.ledger)
  appendFileSync(f.ledger.eventsFile, '{broken}\n')
  await assert.rejects(f.engine.pollOnce(), /corrupt ledger/)
})
