/**
 * Unit tests for the Production Runtime composition (PRODUCTION_RUNTIME_V1
 * Task 2): composeProductionRuntime mounts the EXISTING components over one
 * tmp production layout with a FAKE per-agent process (processFactory seam —
 * no real DSH child, no model), proving:
 *
 *   - the full service graph is provided (bootstrap/definition/router/
 *     brokerGateway/productApi/notificationIngress) in one composition;
 *   - the production persistent paths are the ones actually used (bindings
 *     store, scheduler store, run log all under the root; the definition
 *     config is LOADED and never rewritten);
 *   - the Notification Ingress answers over the frozen deliver contract and
 *     a delivery lands in the fake process inbox;
 *   - the Scheduler engine consumes a job from the production store through
 *     the router invoker seam;
 *   - graceful stop closes the HTTP surfaces;
 *   - the production profile is the default composition choice and no demo
 *     path appears anywhere in the runtime state.
 *
 * The REAL end-to-end proof (real DSH process, real model turn, crash
 * recovery) lives in scripts/production-runtime-v1-verify.mjs.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { test } from 'node:test'

import { composeProductionRuntime, PRODUCTION_AGENT_PROFILE } from '../src/compose.js'
import {
  AGT_ID,
  FORUM,
  WORKFLOW,
  FakeProc,
  basic,
  okTokenFetch,
  seedRuntime,
  silentLog,
  writeNotificationAuthConfig,
} from './compose-fixture.js'

test('composition provides the full existing service graph over the production layout', async (t) => {
  const { root, layout } = await seedRuntime(t)
  const spawned = []
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0 },
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
    log: silentLog,
  })
  t.after(() => runtime.stop())

  for (const svc of ['workspaceBootstrap', 'agentDefinition', 'agentRouter', 'brokerGateway', 'notificationIngress']) {
    assert.notEqual(runtime.ctx.get(svc), undefined, `${svc} provided`)
  }
  assert.equal(runtime.definition.getAgent(AGT_ID).id, AGT_ID, 'definition loaded from the production agents.json')
  assert.equal(runtime.agentProfile, PRODUCTION_AGENT_PROFILE)
  assert.equal(PRODUCTION_AGENT_PROFILE, 'agent-core-production', 'default composition is the PRODUCTION profile, not a demo one')

  // The definition config is authority: compose must not rewrite it.
  const doc = JSON.parse(readFileSync(layout.agentsConfig, 'utf8'))
  assert.equal(doc.agents[0].id, AGT_ID)
})

test('notification ingress delivers over the authenticated frozen contract into the (fake) agent inbox', async (t) => {
  const { layout } = await seedRuntime(t)
  writeNotificationAuthConfig(layout)
  const spawned = []
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0, fetchImpl: okTokenFetch() },
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
    log: silentLog,
  })
  t.after(() => runtime.stop())
  await runtime.start()

  const { port } = runtime.notificationIngress.address()

  const health = await fetch(`http://127.0.0.1:${port}/health`)
  assert.equal(health.status, 200)
  const healthBody = await health.json()
  assert.equal(healthBody.deliverReady, true)
  assert.equal(healthBody.authConfigured, true, 'the layout auth config is wired through compose')
  assert.equal(healthBody.storeReady, true)

  // Anonymous delivery is rejected before any state.
  const anon = await fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: 'anon-1', agentId: AGT_ID, sessionMode: 'main', message: 'x' }),
  })
  assert.equal(anon.status, 401)

  const bad = await fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify({ requestId: 'r1', agentId: AGT_ID, sessionMode: 'bogus', message: 'x' }),
  })
  assert.equal(bad.status, 400)

  const ok = await fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify({ requestId: 'req-1', agentId: AGT_ID, sessionMode: 'main', message: 'hello production' }),
  })
  assert.equal(ok.status, 200)
  const accepted = await ok.json()
  assert.equal(accepted.accepted, true)
  assert.equal(accepted.sessionId, 'main')
  assert.equal(accepted.outcome, 'delivered')
  assert.equal(accepted.reconciliationHandle, 'turn:deliver-1')
  assert.deepEqual(accepted.evidence, { promptReceipt: 'accepted' })
  assert.equal(spawned.length, 1, 'one agent process started')
  assert.deepEqual(spawned[0].deliveries.at(-1), { sessionId: 'main', text: 'hello production' })

  // The durable idempotency authority lands under the production layout.
  assert.ok(existsSync(layout.notificationIdempotencyStore), 'idempotency store under <root>/notification-ingress/')
  const store = JSON.parse(readFileSync(layout.notificationIdempotencyStore, 'utf8'))
  assert.equal(store.records[FORUM.clientId]['req-1'].state, 'delivered')

  // Admission evidence line for the accepted deliver.
  const evidence = readFileSync(layout.evidenceLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.ok(evidence.some((e) => e.kind === 'deliver' && e.requestId === 'req-1' && e.sessionId === 'main'
    && e.reconciliationHandle === 'turn:deliver-1' && e.evidence?.promptReceipt === 'accepted'))
})

test('scheduler engine consumes a job from the production store through the router seam', async (t) => {
  const { layout } = await seedRuntime(t)
  const spawned = []
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
    log: silentLog,
    tickMs: 50,
  })
  t.after(() => runtime.stop())

  const { normalizeJob, computeNextRunAtMs } = await import('../../scheduler/src/job-model.js')
  const { computeNextRunAtMs: next } = await import('../../scheduler/src/schedule.js')
  const job = normalizeJob({
    name: 'compose-test-job',
    agentId: AGT_ID,
    schedule: { kind: 'at', at: new Date(Date.now() + 100).toISOString() },
    payload: { message: 'scheduled hello' },
    sessionTarget: 'main',
    delivery: { mode: 'none' },
  })
  job.state.nextRunAtMs = Date.now() + 100
  await runtime.store.mutate((jobs) => {
    jobs.push(job)
    return { value: job }
  })

  await runtime.start()

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (spawned.length > 0 && spawned[0].turns.length > 0) break
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.ok(spawned[0]?.turns.some((turn) => turn.text === 'scheduled hello'), 'job executed through the router invoker into a turn')
  assert.ok(existsSync(layout.runsLog), 'run log persisted under the production root')
  const evidence = readFileSync(layout.evidenceLog, 'utf8').trim().split('\n').map(line => JSON.parse(line))
  assert.ok(evidence.some(row => row.kind === 'invocation' && row.reconciliationHandle === 'turn:scheduled-1'
    && row.evidence?.terminationEvidence === 'exact_terminal_then_idle'))
})

test('B15 production evidence preserves scheduled outcome_unknown reconciliation data', async (t) => {
  const { layout } = await seedRuntime(t)
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => {
      const proc = new FakeProc(opts)
      proc.turn = async () => {
        throw Object.assign(new Error('scheduled outcome unknown'), {
          status: 'outcome_unknown', envelope: 'outcome_unknown', reconciliationHandle: 'turn:runtime-unknown',
          deadlineAtWallMs: 4242, evidence: { source: 'turn_deadline_exceeded' },
        })
      }
      return proc
    },
    log: silentLog,
    tickMs: 25,
  })
  t.after(() => runtime.stop())
  const { normalizeJob } = await import('../../scheduler/src/job-model.js')
  const job = normalizeJob({
    name: 'unknown-evidence-job', agentId: AGT_ID,
    schedule: { kind: 'at', at: new Date(Date.now() + 50).toISOString() },
    payload: { message: 'unknown' }, sessionTarget: 'main', delivery: { mode: 'none' },
  })
  job.state.nextRunAtMs = Date.now() + 50
  await runtime.store.mutate((jobs) => { jobs.push(job); return { value: job } })
  await runtime.start()
  const deadline = Date.now() + 5000
  let row
  while (Date.now() < deadline) {
    const evidence = readFileSync(layout.evidenceLog, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    row = evidence.find(item => item.kind === 'invocation' && item.reconciliationHandle === 'turn:runtime-unknown')
    if (row !== undefined) break
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert.equal(row?.status, 'outcome_unknown')
  assert.equal(row?.deadlineAtWallMs, 4242)
  assert.deepEqual(row?.evidence, { source: 'turn_deadline_exceeded' })
})

test('graceful stop closes the HTTP surfaces and writes stopped-able state', async (t) => {
  const { layout } = await seedRuntime(t)
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0 },
    processFactory: (opts) => new FakeProc(opts),
    log: silentLog,
  })
  await runtime.start()
  const { port } = runtime.notificationIngress.address()
  await fetch(`http://127.0.0.1:${port}/health`) // warm: server is listening
  await runtime.stop()

  await assert.rejects(() => fetch(`http://127.0.0.1:${port}/health`), /fetch failed|ECONNREFUSED/, 'ingress closed after stop')
})

test('runtime state carries no demo artifacts anywhere', async (t) => {
  const { layout } = await seedRuntime(t)
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => new FakeProc(opts),
    log: silentLog,
  })
  t.after(() => runtime.stop())
  assert.ok(!layout.root.includes('.demo'))
  assert.notEqual(runtime.agentProfile, 'agent-core-demo')
  // Deliveries/bindings land under the production root only.
  await runtime.router.deliver({ requestId: 'req-clean', agentId: AGT_ID, sessionMode: 'fresh', message: 'x' })
  assert.ok(existsSync(layout.bindingsStore), 'binding store under the production root')
  const store = JSON.parse(readFileSync(layout.bindingsStore, 'utf8'))
  const serialized = JSON.stringify(store)
  assert.ok(!serialized.includes('.demo'), 'no .demo reference in persisted state')
})

// ── notification-ingress V1 wiring (C-BND-003 / AC-BND-03) ─────────────────

test('C-WIRE paths: the production layout owns the notification-ingress persistent surface', async (t) => {
  const { layout } = await seedRuntime(t)
  assert.equal(layout.notificationDir, join(layout.root, 'notification-ingress'))
  assert.equal(layout.notificationAuthConfig, join(layout.root, 'notification-ingress', 'auth.json'))
  assert.equal(layout.notificationIdempotencyStore, join(layout.root, 'notification-ingress', 'idempotency.json'))
  assert.equal(layout.notificationEvidence, join(layout.root, 'notification-ingress', 'evidence.jsonl'))
})

test('C-BND-003 AC-BND-03: compose hands the ingress ONLY config/store paths — no credentials, no secret env', async (t) => {
  const envBefore = { ...process.env }
  const { layout } = await seedRuntime(t)
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0 },
    processFactory: (opts) => new FakeProc(opts),
    log: silentLog,
  })
  t.after(() => runtime.stop())
  await runtime.start()

  // The store/evidence paths handed to the ingress are the layout's.
  assert.equal(runtime.notificationIngress.store.storeFile, layout.notificationIdempotencyStore)

  // No new NOTIFICATION_INGRESS_* env appeared; the allowed pointer/switch
  // keys carry PATHS only — no credential material anywhere (C-BND-001).
  const envAfter = { ...process.env }
  for (const key of Object.keys(envAfter)) {
    if (!key.startsWith('NOTIFICATION_INGRESS_')) continue
    assert.ok(['NOTIFICATION_INGRESS_ENABLED', 'NOTIFICATION_INGRESS_HOST', 'NOTIFICATION_INGRESS_PORT', 'NOTIFICATION_INGRESS_AUTH_CONFIG'].includes(key), `unexpected ingress env ${key}`)
    assert.ok(envAfter[key].length < 4096 && !envAfter[key].includes('secret'), `ingress env ${key} must be a path/switch, not credential material`)
  }
  for (const key of Object.keys(envBefore)) delete envAfter[key]
  assert.equal(Object.keys(envAfter).filter((k) => k.startsWith('NOTIFICATION_INGRESS_')).length, 0, 'compose sets no ingress env at all')

  // Source-level: the focused runtime helper forwards only documented wiring
  // keys, while compose retains a high-level mount call.
  const composeSource = readFileSync(new URL('../src/compose.js', import.meta.url), 'utf8')
  assert.ok(composeSource.includes('mountNotificationIngressRuntime({'))
  const helperSource = readFileSync(new URL('../src/notification-ingress-runtime.js', import.meta.url), 'utf8')
  const ingressBlock = helperSource.slice(helperSource.indexOf('applyNotificationIngress(ctx'))
  const forwarded = ingressBlock.slice(0, ingressBlock.indexOf('})'))
  for (const key of ['enabled', 'host', 'port', 'authConfigFile', 'storeFile', 'evidenceFile', 'fetchImpl']) {
    assert.ok(forwarded.includes(key), `runtime helper forwards ${key}`)
  }
  assert.ok(!forwarded.includes('clientSecret'), 'runtime helper never forwards credential material')

  // Without an auth config the composition still mounts, fail-closed per call.
  const { port } = runtime.notificationIngress.address()
  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json()
  assert.equal(health.authConfigured, false)
  const closed = await fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify({ requestId: 'closed-1', agentId: AGT_ID, sessionMode: 'main', message: 'x' }),
  })
  assert.equal(closed.status, 503)
  assert.equal((await closed.json()).error.code, 'AUTH_NOT_CONFIGURED')
})

// ── AGENT_CORE_SCHEDULER_RUN_HISTORY_V1: history wiring + result ingestion ──

test('C-HIST compose wires the HistoryStore over layout.historyDir into the scheduler and provides the /scheduler/* services', async (t) => {
  const { root, layout } = await seedRuntime(t)
  assert.equal(layout.historyDir, join(root, 'scheduler', 'history'), 'layout exposes scheduler/history')
  const spawned = []
  // A fake agent whose turn reply carries a ```scheduler-result block — the
  // full R4 path: compose wrapper ingestion -> outcome.result -> scheduler ->
  // history RunRecord.
  class ResultProc extends FakeProc {
    async turn(sessionId, text) {
      const base = await super.turn(sessionId, text)
      const block = JSON.stringify({ final_status: 'PASS', counters: { pages_scanned: 4 } })
      return { ...base, reply: `${base.reply}\n\`\`\`scheduler-result\n${block}\n\`\`\`` }
    }
  }
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, host: '127.0.0.1', port: 0 },
    processFactory: (opts) => { const p = new ResultProc(opts); spawned.push(p); return p },
    log: silentLog,
    tickMs: 50,
  })
  t.after(() => runtime.stop())
  const history = runtime.ctx.get('schedulerHistory')
  assert.ok(history, 'schedulerHistory service provided')
  assert.equal(history.dir, layout.historyDir)
  assert.equal(runtime.scheduler.history, history, 'scheduler constructed with deps.history')
  // Without SCHEDULER_AUTH_JWKS_URL the token verifier is null -> the API gate 401s (fail-closed).
  assert.equal(runtime.ctx.get('schedulerTokenVerifier'), null)

  const { normalizeJob } = await import('../../scheduler/src/job-model.js')
  const job = normalizeJob({
    name: 'Hist',
    agentId: AGT_ID,
    schedule: { kind: 'at', at: new Date(Date.now() + 100).toISOString() },
    payload: { message: 'hello' },
    delivery: { mode: 'none' },
  })
  await runtime.store.mutate((jobs) => {
    jobs.push(job)
    return { value: job }
  })
  await runtime.start()
  const deadline = Date.now() + 10_000
  let runs = []
  while (Date.now() < deadline) {
    runs = history.queryRuns({ jobId: job.id }).runs
    if (runs.length > 0 && runs[0].outcome === 'succeeded') break
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.equal(runs.length, 1)
  assert.equal(runs[0].status_view, 'success')
  assert.equal(runs[0].result_recorded, true, 'structured result ingested through the trusted wrapper')
  assert.equal(runs[0].result_status, 'PASS')
  assert.equal(runs[0].result.counters.pages_scanned, 4)
  assert.equal(runs[0].error_message, null)
  assert.equal(history.getJobSnapshot(runs[0].run_id).name, 'Hist')
})

test('C-HIST cross-agent scheduler authorization flows one target-owned fresh Run into HistoryStore without source authority propagation or replay', async (t) => {
  const sourceAgentId = 'agt_history-source'
  const targetAgentId = 'agt_history-target'
  const sourceSecret = 'source-authority-must-stop-at-control-plane'
  const { root, layout } = await seedRuntime(t, {
    agents: [[sourceAgentId, 'History Source'], [targetAgentId, 'History Target']],
  })
  const credentialsFile = join(root, 'credentials.json')
  writeFileSync(credentialsFile, `${JSON.stringify({
    version: 1,
    credentials: {
      [sourceAgentId]: { clientId: 'history-source-client', clientSecret: sourceSecret },
    },
  })}\n`)

  const grantRequests = []
  const authServer = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      grantRequests.push({ authorization: req.headers.authorization, body })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ access_token: 'scheduler-manage-any-token', expires_in: 300 }))
    })
  })
  await new Promise((resolve) => authServer.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => authServer.close(resolve)))
  const authServiceOrigin = `http://127.0.0.1:${authServer.address().port}`

  const spawned = []
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, host: '127.0.0.1', port: 0 },
    broker: { credentialsFile, authServiceOrigin },
    processFactory: (opts) => {
      const proc = new FakeProc(opts)
      spawned.push({ opts, proc })
      return proc
    },
    log: silentLog,
  })
  t.after(() => runtime.stop())

  const access = runtime.ctx.get('selfServiceSchedulerAccess')
  const dueAt = new Date(Date.now() + 250).toISOString()
  const created = await access.handlers.scheduler.create({
    name: 'composed cross-agent history',
    schedule_kind: 'at',
    at: dueAt,
    message: 'run once as the target',
    target_agent_id: targetAgentId,
    delivery_mode: 'none',
  }, {
    agentId: sourceAgentId,
    callerAgentId: sourceAgentId,
    processGeneration: 7,
    turnExecutionId: 'turn:history-source:7:1',
  })
  assert.equal(created.ok, true, JSON.stringify(created))
  assert.equal(created.result.targetAgentId, targetAgentId)
  assert.equal(grantRequests.length, 1, 'the source credential is consulted exactly once for scheduler.manage:any')
  assert.equal(grantRequests[0].authorization, `Basic ${Buffer.from(`history-source-client:${sourceSecret}`).toString('base64')}`)
  const grantBody = new URLSearchParams(grantRequests[0].body)
  assert.equal(grantBody.get('resource'), 'scheduler')
  assert.equal(grantBody.get('scope'), 'scheduler.manage:any')

  await runtime.scheduler.start({ autoStart: false, catchup: false })
  const waitMs = Math.max(0, Date.parse(dueAt) - Date.now() + 25)
  await new Promise((resolve) => setTimeout(resolve, waitMs))
  await Promise.all([runtime.scheduler.tick(), runtime.scheduler.tick()])
  await runtime.scheduler.whenIdle()
  await runtime.scheduler.tick()
  await runtime.scheduler.whenIdle()

  assert.equal(spawned.length, 1, 'concurrent and repeated ticks spawn only the target Agent once')
  assert.equal(spawned[0].proc.agentId, targetAgentId)
  assert.equal(spawned[0].proc.turns.length, 1, 'one occurrence produces exactly one target Run with no replay')
  const targetTurn = spawned[0].proc.turns[0]
  assert.match(targetTurn.sessionId, /^cron-run-/, 'the target Run uses a fresh scheduler-native Session')
  assert.notEqual(targetTurn.sessionId, 'main')

  const forbiddenAuthorityKey = /principal|credential|clientsecret|authorization|bearer|grant|calleragent|sourceagent|impersonat/i
  const forbiddenKeys = []
  const seen = new WeakSet()
  const inspectTargetOptions = (value, key) => {
    if (key !== undefined && forbiddenAuthorityKey.test(key)) forbiddenKeys.push(key)
    if (value === null || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    for (const [childKey, childValue] of Object.entries(value)) inspectTargetOptions(childValue, childKey)
  }
  inspectTargetOptions(spawned[0].opts)
  assert.deepEqual(forbiddenKeys, [], 'the target process receives no source Principal/Grant/credential fields')
  assert.equal(JSON.stringify(spawned[0].opts).includes(sourceSecret), false, 'the source credential bytes never enter target process options')

  const history = runtime.ctx.get('schedulerHistory')
  const runs = history.queryRuns({ jobId: created.result.jobId }).runs
  assert.equal(runs.length, 1, 'HistoryStore contains one Run for the authorized cross-agent occurrence')
  const run = runs[0]
  assert.equal(run.job_id, created.result.jobId)
  assert.equal(run.agent_id, targetAgentId)
  assert.equal(run.session_id, targetTurn.sessionId)
  assert.equal(run.occurrence_id.startsWith('occ:'), true)
  assert.equal(run.run_id, `run:${run.occurrence_id}`)
  assert.equal(run.request_id, run.occurrence_id)
  assert.equal(run.correlation_id, `schcorr:${run.occurrence_id}`)
  assert.equal(run.parent_run_id, null, 'a natural occurrence is the correlation-chain root')
  assert.equal(run.outcome, 'succeeded')
  assert.equal(run.status_view, 'success')
  assert.equal(run.delivery_status, 'not-requested')

  const occurrence = history.getOccurrence(run.occurrence_id)
  assert.equal(occurrence.runs.length, 1)
  assert.equal(occurrence.runs[0].run_id, run.run_id)
  assert.equal(occurrence.occurrence.occurrence_id, run.occurrence_id)
  assert.equal(history.getJobSnapshot(run.run_id).agent_id, targetAgentId)
})

test('C-HIST schedulerAuth opts provide a JWKS verifier; unconfigured stays null', async (t) => {
  const { layout } = await seedRuntime(t)
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, host: '127.0.0.1', port: 0 },
    schedulerAuth: { jwksUrl: 'http://127.0.0.1:1/.well-known/jwks.json', issuer: 'iss', audience: 'scheduler' },
    processFactory: (opts) => new FakeProc(opts),
    log: silentLog,
  })
  t.after(() => runtime.stop())
  const verifier = runtime.ctx.get('schedulerTokenVerifier')
  assert.ok(verifier, 'verifier constructed when jwksUrl configured')
  assert.equal(typeof verifier.verify, 'function')
})

test('C-HIST R4 ingestion: valid / UNPARSEABLE / OVERSIZE / INVALID_SCHEMA / absent blocks', async (t) => {
  const { ingestSchedulerResult } = await import('../src/scheduler-result.js')
  const block = (obj) => 'text before\n```scheduler-result\n' + JSON.stringify(obj) + '\n```\ntrailer'

  // no block → nothing
  assert.deepEqual(ingestSchedulerResult('plain reply, no block'), {})
  assert.deepEqual(ingestSchedulerResult(undefined), {})

  // valid block (LAST one wins) → result
  const valid = ingestSchedulerResult(block({ final_status: 'PASS', counters: { pages_scanned: 3 } })
    + '\n' + block({ final_status: 'FAIL', counters: { pages_scanned: 9 }, notes: 'final word' }))
  assert.equal(valid.result.final_status, 'FAIL', 'the last scheduler-result block is authoritative')
  assert.equal(valid.result.counters.pages_scanned, 9)
  assert.equal(valid.result_error_code, undefined)

  // wake_sent entries carried for the R9 J1 join face
  const wake = ingestSchedulerResult(block({
    final_status: 'PARTIAL',
    counters: { skipped: 1 },
    wake_sent: [{ target_agent_id: 'agt_b', workflow_instance_id: 'wi', request_id: 'wdhr1:wi:agt_b', session_id: 's' }],
  }))
  assert.equal(wake.result.wake_sent.length, 1)

  // UNPARSEABLE
  const bad = ingestSchedulerResult('```scheduler-result\n{not json\n```')
  assert.equal(bad.result, undefined)
  assert.equal(bad.result_error_code, 'UNPARSEABLE')

  // OVERSIZE (>16KB)
  const big = ingestSchedulerResult('```scheduler-result\n' + JSON.stringify({ final_status: 'PASS', counters: { blob: 'x'.repeat(17 * 1024) } }) + '\n```')
  assert.equal(big.result_error_code, 'OVERSIZE')

  // INVALID_SCHEMA: bad final_status / non-integer counter / nested counter / secret-shaped key / bad notes
  assert.equal(ingestSchedulerResult(block({ counters: {} })).result_error_code, 'INVALID_SCHEMA')
  assert.equal(ingestSchedulerResult(block({ final_status: 'Meh', counters: {} })).result_error_code, 'INVALID_SCHEMA')
  assert.equal(ingestSchedulerResult(block({ final_status: 'PASS', counters: { a: 1.5 } })).result_error_code, 'INVALID_SCHEMA')
  assert.equal(ingestSchedulerResult(block({ final_status: 'PASS', counters: { a: { nested: 1 } } })).result_error_code, 'INVALID_SCHEMA')
  assert.equal(ingestSchedulerResult(block({ final_status: 'PASS', counters: {}, api_key: 'nope' })).result_error_code, 'INVALID_SCHEMA')
  assert.equal(ingestSchedulerResult(block({ final_status: 'PASS', counters: {}, notes: 'x'.repeat(501) })).result_error_code, 'INVALID_SCHEMA')
  const malformedWake = ingestSchedulerResult(block({ final_status: 'PASS', counters: {}, wake_sent: [{ target_agent_id: 'agt_b' }] }))
  assert.equal(malformedWake.result_error_code, 'INVALID_SCHEMA')
})
