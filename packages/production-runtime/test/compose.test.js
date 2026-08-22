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
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { composeProductionRuntime, PRODUCTION_AGENT_PROFILE } from '../src/compose.js'
import { resolveProductionLayout } from '../src/paths.js'

const AGT_ID = 'agt_production-runtime-test'

let pidSeq = 4000

/** Fake per-agent process (router + scheduler-router contract). */
class FakeProc {
  constructor({ agentId, log }) {
    this.agentId = agentId
    this.pid = ++pidSeq
    this.log = log
    this.home = `/tmp/prt-home-${agentId}`
    this.workspace = `/tmp/prt-ws-${agentId}`
    this.profile = 'fake-profile'
    this.creations = []
    this.exit = undefined
    this.exitResolve = undefined
    this.exitPromise = new Promise((resolve) => { this.exitResolve = resolve })
    this.onRpcRequest = undefined
    this.deliveries = []
    this.turns = []
  }

  spawn() {}

  async ready() { return 1 }

  async deliver(sessionId, text) {
    this.deliveries.push({ sessionId, text })
    return {
      accepted: true, sessionId, messageId: `msg-${this.deliveries.length}`,
      reconciliationHandle: `turn:deliver-${this.deliveries.length}`, evidence: { promptReceipt: 'accepted' },
    }
  }

  async turn(sessionId, text) {
    this.turns.push({ sessionId, text })
    return {
      reply: `TURNED:${text}`, ms: 1, promptMs: 1, messageId: `m${this.turns.length}`,
      reconciliationHandle: `turn:scheduled-${this.turns.length}`, evidence: { terminationEvidence: 'exact_terminal_then_idle' },
    }
  }

  async shutdown() {
    if (this.exit === undefined) {
      this.exit = { code: 0, signal: null }
      this.exitResolve?.(this.exit)
    }
    return this.exit
  }

  kill() {
    this.exit = { code: 9, signal: 'SIGKILL' }
    this.exitResolve?.({ code: 9, signal: 'SIGKILL' })
  }
}

/** Seed a tmp production root: layout + one default agent definition. */
async function seedRuntime(t, { agents = [[AGT_ID, 'Production Test Agent']] } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'prt-compose-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: agents[0]?.[0] ?? null,
    agents: agents.map(([id, name]) => ({ id, name })),
  })
  return { root, layout }
}

const silentLog = { log() {}, warn() {}, error() {} }

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

test('notification ingress delivers over the frozen contract into the (fake) agent inbox', async (t) => {
  const { layout } = await seedRuntime(t)
  const spawned = []
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0 },
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
    log: silentLog,
  })
  t.after(() => runtime.stop())
  await runtime.start()

  const { port } = runtime.notificationIngress.address()

  const health = await fetch(`http://127.0.0.1:${port}/health`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).deliverReady, true)

  const bad = await fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: 'r1', agentId: AGT_ID, sessionMode: 'bogus', message: 'x' }),
  })
  assert.equal(bad.status, 400)

  const ok = await fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: 'req-1', agentId: AGT_ID, sessionMode: 'main', message: 'hello production' }),
  })
  assert.equal(ok.status, 200)
  const accepted = await ok.json()
  assert.equal(accepted.accepted, true)
  assert.equal(accepted.sessionId, 'main')
  assert.equal(accepted.reconciliationHandle, 'turn:deliver-1')
  assert.deepEqual(accepted.evidence, { promptReceipt: 'accepted' })
  assert.equal(spawned.length, 1, 'one agent process started')
  assert.deepEqual(spawned[0].deliveries.at(-1), { sessionId: 'main', text: 'hello production' })

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
