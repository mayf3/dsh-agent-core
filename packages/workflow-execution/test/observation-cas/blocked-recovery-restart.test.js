import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation/store.js'
import { detail, VISIT, AGENT, INSTANCE, OWNER } from './fixture.js'

const RULE = 'accepted:AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1#CTR-EKRWAE-005'
const bytes = file => readFileSync(file, 'utf8')
const events = dir => bytes(join(dir, 'attempts.jsonl')).trim().split('\n').map(JSON.parse)
const count = (dir, kind) => events(dir).filter(event => event.kind === kind).length

async function bounded(promise, label) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), 8_000)
    })])
  } finally { clearTimeout(timer) }
}

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ekr-b2-process-'))
  const router = new TurnReconciliationStore({ runtimeEpoch: 'b2-loopback-router',
    persistenceFile: join(dir, 'router-reconciliation.json') })
  const state = { recovered: false, loseAck: false, worldDrift: false, detailUnavailable: false, requests: [], deliveries: [] }
  let accepted
  const acceptance = new Promise(resolve => { accepted = resolve })
  const server = createServer(async (req, res) => {
    try {
      const status = req.url === '/resolve' && !state.recovered
        || req.url === '/detail' && state.detailUnavailable ? 503 : 200
      state.requests.push({ path: req.url, status, principalId: req.headers['x-principal-id'],
        agentId: req.headers['x-agent-id'], workflowInstanceId: req.headers['x-workflow-id'] })
      if (req.url === '/deliver') {
        let body = ''
        for await (const chunk of req) body += chunk
        const request = JSON.parse(body)
        state.deliveries.push(request)
        const handle = router.mintTurnExecution({ agentId: request.agentId, processGeneration: 1,
          sessionId: 'main', callerCorrelation: { requestId: request.requestId } })
        router.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'b2-original-prompt',
          deadlineAtWallMs: Date.now() + 60_000 })
        router.markPromptWriteAttempted(handle)
        router.markPromptReceipt(handle, { messageId: 'b2-original-message' })
        accepted({ request, receipt: router.resolveCallerCorrelation({ requestId: request.requestId }) })
        if (state.loseAck) return // Accepted receipt is durable; HTTP ACK is deliberately withheld.
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true, sessionId: 'main', reconciliationHandle: handle, messageId: 'b2-original-message' }))
      } else {
        res.writeHead(status, { 'content-type': 'application/json' })
        const world = detail(7).body
        if (state.worldDrift) world.detail.current_node_visit_id = 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
        res.end(JSON.stringify(req.url === '/resolve'
          ? status === 200 ? { ok: true, agentId: AGENT } : { error: 'injected_resolution_503' }
          : status === 200 ? world : { error: 'injected_detail_503' }))
      }
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: String(error.stack ?? error) }))
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const children = []
  function start(mode) {
    const child = fork(new URL('./blocked-recovery-process.js', import.meta.url),
      [dir, `http://127.0.0.1:${server.address().port}`, mode], {
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: { ...process.env, EKR_BLOCKED_RECOVERY_CHILD: '1' },
      })
    let stderr = '', exited = false
    const queued = [], waiting = []
    child.stderr.on('data', chunk => { stderr += chunk })
    const exit = once(child, 'exit').then(result => {
      exited = true
      for (const waiter of waiting.splice(0)) waiter.reject(new Error(`child ${mode} exited ${JSON.stringify(result)}: ${stderr}`))
      return result
    })
    child.on('message', message => {
      if (message.stage === 'error') {
        for (const waiter of waiting.splice(0)) waiter.reject(new Error(JSON.stringify(message)))
        queued.push(message)
        return
      }
      const index = waiting.findIndex(waiter => waiter.stage === message.stage)
      if (index < 0) queued.push(message)
      else waiting.splice(index, 1)[0].resolve(message)
    })
    function waitFor(stage) {
      const failed = queued.find(message => message.stage === 'error')
      if (failed) return Promise.reject(new Error(JSON.stringify(failed)))
      const index = queued.findIndex(message => message.stage === stage)
      if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0])
      if (exited) return Promise.reject(new Error(`child ${mode} already exited: ${stderr}`))
      return new Promise((resolve, reject) => {
        const waiter = { stage, resolve: value => { clearTimeout(timer); resolve(value) },
          reject: error => { clearTimeout(timer); reject(error) } }
        const timer = setTimeout(() => {
          const found = waiting.indexOf(waiter)
          if (found >= 0) waiting.splice(found, 1)
          reject(new Error(`child ${mode} timed out waiting for ${stage}: ${stderr}`))
        }, 8_000)
        waiting.push(waiter)
      })
    }
    const run = { child, exit, waitFor }
    children.push(run)
    return run
  }
  async function cleanup() {
    for (const run of children) if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill('SIGKILL')
    await Promise.all(children.map(run => run.exit.catch(() => {})))
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  }
  return { dir, state, start, acceptance, cleanup }
}

async function seed(fx) {
  const run = fx.start('seed')
  const result = await run.waitFor('seeded')
  assert.deepEqual(await run.exit, [0, null])
  assert.deepEqual(result.errors, [])
  assert.equal(result.attempt.phase, 'resolution_blocked')
  assert.ok(Number.isSafeInteger(result.attempt.recoveryCheck.nextCheckAtMs))
  assert.equal(result.attempt.recoveryCheck.businessOutcome, 'UNKNOWN')
  assert.ok(fx.state.requests.some(request => request.path === '/resolve' && request.status === 503))
  assert.equal(fx.state.deliveries.length, 0)
  return result
}

function sameIdentity(actual, initial) {
  for (const key of ['attemptId', 'nodeVisitId', 'workflowInstanceId', 'dispatchIntentId', 'ownerPrincipalId']) {
    assert.equal(actual[key], initial[key], key)
  }
  assert.equal(actual.generation ?? 1, initial.generation ?? 1)
  assert.equal(actual.recoveryCheck.businessOutcome, 'UNKNOWN')
}

function unchangedTerminal(fx, actual) {
  assert.equal(count(fx.dir, 'reconciled'), 1, 'only the first terminal verdict is appended')
  assert.equal(actual.terminalSnapshot.attempt.phase, 'reconciled')
  assert.ok(actual.polls > actual.terminalSnapshot.polls, 'later polls observe the terminal attempt')
  assert.deepEqual(actual.attempt, actual.terminalSnapshot.attempt, 'later polls cannot mutate the terminal projection')
  assert.equal(bytes(join(fx.dir, 'attempts.jsonl')), actual.terminalSnapshot.ledgerBytes,
    'later polls cannot append reconciled or obligation-release events')
}

function assertAutomaticAudit(dir, initial) {
  const authorized = events(dir).filter(event => event.kind === 'recovery_authorized')
  assert.ok(authorized.length >= 1)
  for (const event of authorized) {
    assert.equal(event.authorityRef, RULE)
    assert.equal(event.authorization.kind, 'automatic')
    assert.equal(event.authorization.ruleRef, RULE)
    assert.ok(event.authorization.triggerId)
    assert.ok(event.authorization.gateEvidence)
  }
  assert.equal(count(dir, 'attempt_planned'), 1)
  assert.ok(events(dir).filter(event => event.kind === 'delivery_started')
    .every(event => event.nodeVisitId === initial.nodeVisitId))
}

function receipt(t, scenario, fx, initial, actual, extra = {}) {
  t.diagnostic(JSON.stringify({ sourceSha: process.env.EKR_SOURCE_SHA ?? 'UNKNOWN',
    testName: scenario, faultInjection: scenario, initialState: initial,
    expectedResult: 'same identity; durable automatic responsibility; at most one first admission; UNKNOWN never replayed',
    actualResult: actual, rawReceipt: { requests: fx.state.requests, deliveries: fx.state.deliveries,
      events: events(fx.dir), ...extra }, productionWrites: 0,
    limitations: 'isolated real file ledger, Router receipt, child processes and loopback HTTP; no Svc DB, install or production claim' }))
}

test('B2 real process: resolution HTTP503 then dependency recovery and restart automatically admit the same request', { timeout: 15_000 }, async t => {
  const fx = await fixture()
  try {
    const initial = await seed(fx)
    const prefix = bytes(join(fx.dir, 'attempts.jsonl'))
    fx.state.recovered = true
    const run = fx.start('auto')
    const actual = await run.waitFor('admitted')
    assert.deepEqual(await run.exit, [0, null])
    assert.deepEqual(actual.errors, [])
    sameIdentity(actual.attempt, initial.attempt)
    assert.equal(fx.state.deliveries.length, 1)
    assert.equal(fx.state.deliveries[0].requestId, initial.attempt.attemptId)
    assert.equal(fx.state.deliveries[0].agentId, AGENT)
    assert.ok(bytes(join(fx.dir, 'attempts.jsonl')).startsWith(prefix))
    assertAutomaticAudit(fx.dir, initial.attempt)
    assert.equal(count(fx.dir, 'delivery_started'), 1)
    assert.equal(count(fx.dir, 'run_delivered'), 1)
    assert.ok(fx.state.requests.filter(request => request.path === '/resolve').every(request => request.principalId === OWNER))
    assert.ok(fx.state.requests.filter(request => request.path === '/detail')
      .every(request => request.agentId === AGENT && request.workflowInstanceId === INSTANCE))
    receipt(t, 'B2-503-restart-automatic-first-admission', fx, initial, actual, { childExit: [0, null] })
  } finally { await fx.cleanup() }
})

for (const point of ['before-wal', 'after-wal']) {
  test(`B2 real SIGKILL ${point}: restart ${point === 'before-wal' ? 'continues the original blocked attempt' : 'never sends the delivery-domain request'}`, { timeout: 15_000 }, async t => {
    const fx = await fixture()
    try {
      const initial = await seed(fx)
      fx.state.recovered = true
      const crashed = fx.start(`crash-${point}`)
      const boundary = await crashed.waitFor('crash-ready')
      assert.equal(boundary.point, point === 'before-wal' ? 'recoveryAuthorized' : 'deliveryStarted')
      sameIdentity(boundary.attempt, initial.attempt)
      assert.equal(count(fx.dir, 'delivery_started'), point === 'before-wal' ? 0 : 1)
      assert.equal(fx.state.deliveries.length, 0)
      const prefix = bytes(join(fx.dir, 'attempts.jsonl'))
      crashed.child.kill('SIGKILL')
      assert.deepEqual(await crashed.exit, [null, 'SIGKILL'])
      const restarted = fx.start(point === 'before-wal' ? 'auto' : 'observe')
      const actual = await restarted.waitFor(point === 'before-wal' ? 'admitted' : 'observed')
      assert.deepEqual(await restarted.exit, [0, null])
      assert.deepEqual(actual.errors, [])
      sameIdentity(actual.attempt, initial.attempt)
      assert.ok(bytes(join(fx.dir, 'attempts.jsonl')).startsWith(prefix))
      assertAutomaticAudit(fx.dir, initial.attempt)
      assert.equal(count(fx.dir, 'delivery_started'), 1)
      assert.equal(fx.state.deliveries.length, point === 'before-wal' ? 1 : 0)
      if (point === 'after-wal') {
        unchangedTerminal(fx, actual)
        assert.ok(actual.polls >= 4)
        assert.equal(count(fx.dir, 'run_delivered'), 0)
        assert.equal(actual.correlation.state, 'never_existed', 'false negative cannot override durable WAL')
      }
      receipt(t, `B2-SIGKILL-${point}`, fx, initial, actual, { boundary, crashedExit: [null, 'SIGKILL'], restartedExit: [0, null] })
    } finally { await fx.cleanup() }
  })
}

test('B2 real SIGKILL after Router acceptance with HTTP ACK lost: restart preserves UNKNOWN and sends no second request', { timeout: 15_000 }, async t => {
  const fx = await fixture()
  try {
    const initial = await seed(fx)
    fx.state.recovered = true
    fx.state.loseAck = true
    const crashed = fx.start('auto')
    const accepted = await bounded(fx.acceptance, 'durable Router acceptance')
    assert.equal(accepted.request.requestId, initial.attempt.attemptId)
    assert.equal(accepted.receipt.snapshot.messageId, 'b2-original-message')
    assert.equal(count(fx.dir, 'delivery_started'), 1)
    assert.equal(count(fx.dir, 'run_delivered'), 0)
    const prefix = bytes(join(fx.dir, 'attempts.jsonl'))
    crashed.child.kill('SIGKILL')
    assert.deepEqual(await crashed.exit, [null, 'SIGKILL'])
    fx.state.loseAck = false
    const restarted = fx.start('observe')
    const loaded = await restarted.waitFor('ready')
    const actual = await restarted.waitFor('observed')
    assert.deepEqual(await restarted.exit, [0, null])
    assert.deepEqual(actual.errors, [])
    sameIdentity(actual.attempt, initial.attempt)
    assert.equal(fx.state.deliveries.length, 1)
    assert.equal(count(fx.dir, 'run_delivered'), 0)
    assert.equal(count(fx.dir, 'delivery_started'), 1)
    assert.equal(actual.correlation.snapshot.initialOutcome, 'outcome_unknown')
    assert.equal(actual.correlation.snapshot.fenceState, 'active')
    assert.equal(actual.correlation.snapshot.outcome, null)
    assert.equal(actual.correlation.snapshot.terminationEvidence, null)
    unchangedTerminal(fx, actual)
    assert.equal(actual.routerBytes, loaded.routerBytes, 'poll/correlation reads cannot write Router outcome or fence')
    assert.ok(bytes(join(fx.dir, 'attempts.jsonl')).startsWith(prefix))
    assertAutomaticAudit(fx.dir, initial.attempt)
    receipt(t, 'B2-accepted-ACK-lost-SIGKILL', fx, initial, actual,
      { accepted, loaded, crashedExit: [null, 'SIGKILL'], restartedExit: [0, null] })
  } finally { await fx.cleanup() }
})

test('B2 real processes: automatic consumer racing explicit manual recovery admits at most once', { timeout: 15_000 }, async t => {
  const fx = await fixture()
  try {
    const initial = await seed(fx)
    fx.state.recovered = true
    const automatic = fx.start('race-auto')
    const manual = fx.start('race-manual')
    await Promise.all([automatic.waitFor('ready'), manual.waitFor('ready')])
    automatic.child.send({ stage: 'go' })
    manual.child.send({ stage: 'go' })
    const [autoResult, manualResult] = await Promise.all([
      automatic.waitFor('admitted'), manual.waitFor('manual-complete'),
    ])
    assert.deepEqual(await automatic.exit, [0, null])
    assert.deepEqual(await manual.exit, [0, null])
    assert.deepEqual(autoResult.errors, [])
    assert.deepEqual(manualResult.errors, [])
    sameIdentity(autoResult.attempt, initial.attempt)
    sameIdentity(manualResult.attempt, initial.attempt)
    assert.equal(fx.state.deliveries.length, 1)
    assert.equal(count(fx.dir, 'attempt_planned'), 1)
    assert.equal(count(fx.dir, 'recovery_authorized'), 1)
    const [authorization] = events(fx.dir).filter(event => event.kind === 'recovery_authorized')
    assert.ok([RULE, 'B2_PROCESS_TEST_OWNER'].includes(authorization.authorityRef))
    if (authorization.authorityRef === RULE) assert.equal(authorization.authorization.kind, 'automatic')
    assert.equal(count(fx.dir, 'delivery_started'), 1)
    assert.equal(count(fx.dir, 'run_delivered'), 1)
    receipt(t, 'B2-automatic-manual-real-process-race', fx, initial,
      { autoResult, manualResult }, { childExits: [[0, null], [0, null]] })
  } finally { await fx.cleanup() }
})

test('B2 real SIGKILL after world-drift refusal: two restarts consume the durable read-only duty without terminal appends', { timeout: 15_000 }, async t => {
  const fx = await fixture()
  try {
    const initial = await seed(fx)
    fx.state.recovered = true
    fx.state.worldDrift = true
    const crashed = fx.start('crash-after-refusal')
    const boundary = await crashed.waitFor('crash-ready')
    assert.equal(boundary.point, 'recoveryRefused')
    sameIdentity(boundary.attempt, initial.attempt)
    assert.equal(boundary.attempt.state, 'NEEDS_REVIEW')
    assert.equal(boundary.attempt.phase, 'recovery_refused')
    const duty = boundary.attempt.recoveryCheck.refusalSchedule
    assert.equal(duty.consumer, 'workflow_execution_due_poller')
    assert.equal(duty.ruleRef, 'accepted:AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1#CTR-EKRWAE-007')
    assert.equal(duty.intervalMs, 160)
    assert.ok(Number.isSafeInteger(duty.firstCheckAtMs))
    const terminalBytes = bytes(join(fx.dir, 'attempts.jsonl'))
    const routerBytes = bytes(join(fx.dir, 'router-reconciliation.json'))
    crashed.child.kill('SIGKILL')
    assert.deepEqual(await crashed.exit, [null, 'SIGKILL'])

    const observations = []
    for (const unavailable of [true, false]) {
      fx.state.detailUnavailable = unavailable
      // The second restart sees the original world again. A fresh readable
      // world is an observation, never permission to reopen the old refusal.
      fx.state.worldDrift = false
      const priorRequests = fx.state.requests.length
      const restarted = fx.start('observe-refusal')
      const loaded = await restarted.waitFor('ready')
      const actual = await restarted.waitFor('refusal-observed')
      assert.deepEqual(await restarted.exit, [0, null])
      assert.deepEqual(actual.errors, [])
      sameIdentity(actual.attempt, initial.attempt)
      assert.deepEqual(actual.attempt, boundary.attempt)
      assert.equal(actual.terminalRecovery.outcome, 'NO_OP_TERMINAL')
      assert.ok(actual.recoveryResults.length >= 2, 'the existing poller consumes later cadence slots, not just startup')
      for (const check of actual.recoveryResults) {
        assert.equal(check.outcome, 'REFUSAL_RESPONSIBILITY_PENDING')
        assert.equal(check.attemptId, initial.attempt.attemptId)
        assert.equal(check.observation.source, 'target_agent_instance_detail')
        assert.equal(check.observation.result, unavailable ? 'unavailable' : 'world_observed')
        assert.ok(Number.isSafeInteger(check.nextCheckAtMs))
        assert.ok(check.nextCheckAtMs > duty.firstCheckAtMs)
        assert.equal((check.nextCheckAtMs - duty.firstCheckAtMs) % duty.intervalMs, 0)
      }
      assert.ok(fx.state.requests.slice(priorRequests).filter(request => request.path === '/detail').length >= 2)
      assert.ok(fx.state.requests.slice(priorRequests).filter(request => request.path === '/detail')
        .every(request => request.status === (unavailable ? 503 : 200)
          && request.agentId === AGENT && request.workflowInstanceId === INSTANCE))
      assert.equal(bytes(join(fx.dir, 'attempts.jsonl')), terminalBytes, 'every terminal event byte remains immutable')
      assert.equal(actual.routerBytes, loaded.routerBytes)
      assert.equal(actual.routerBytes, routerBytes, 'read-only obligations cannot change Router outcome/fence')
      assert.equal(fx.state.deliveries.length, 0)
      assert.equal(count(fx.dir, 'attempt_planned'), 1)
      assert.equal(count(fx.dir, 'recovery_refused'), 1)
      assert.equal(count(fx.dir, 'recovery_authorized'), 0)
      assert.equal(count(fx.dir, 'delivery_started'), 0)
      assert.equal(count(fx.dir, 'run_delivered'), 0)
      observations.push({ unavailable, loaded, actual, childExit: [0, null] })
    }
    receipt(t, 'B2-world-drift-refusal-SIGKILL-read-only-duty-restarts', fx, initial,
      observations, { boundary, crashedExit: [null, 'SIGKILL'], terminalBytes, routerBytes,
        responsibilityDisposition: 'retained by original automatic consumer; no handoff, closure or business success claimed' })
  } finally { await fx.cleanup() }
})
