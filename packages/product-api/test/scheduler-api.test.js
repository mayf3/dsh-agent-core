/**
 * HTTP tests for the /scheduler/* read surface (AGENT_CORE_SCHEDULER_RUN_
 * HISTORY_V1 §5: ACC-001 c/d/e, ACC-004, ACC-005, ACC-009).
 *
 * The server is mounted on a fake cordis ctx (same harness as api.test.js)
 * with a REAL HistoryStore fixture and an INJECTABLE stub token verifier
 * (the SELF_SERVICE CTR-AUTH-002 pattern: the Auth seam is always injectable
 * in tests, never bypassed in production). RS256/JWKS verification itself is
 * covered by the auth-service contract consumers; the gate here pins the
 * fail-closed posture and the scope data plane.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply as applyProductApi } from '../src/index.js'
import { createStubTokenVerifier } from '../src/scheduler-auth.js'
import { HistoryStore, buildRunRecord } from '../../scheduler/src/history.js'

const T0 = Date.parse('2026-09-01T00:00:00Z')

function fakeCtx(services) {
  const provided = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    async disposeAll() {
      for (const dispose of disposers.splice(0)) {
        try { await dispose() } catch { /* best effort */ }
      }
    },
  }
}

function stubRouter() {
  return {
    channelConversationId: (channel, externalId) => `${channel}:${externalId}`,
    getBinding: () => undefined,
    switchAgent: async () => ({}),
    route: async () => ({}),
  }
}

const stubDefinition = { listAgents: () => [] }

const AGENT_TOKEN = 'bearer-agent-read'
const OTHER_TOKEN = 'bearer-agent-read-other'
const AUDIT_TOKEN = 'bearer-audit'
const NOSCOPE_TOKEN = 'bearer-no-scope'
const LOCALLABEL_TOKEN = 'bearer-local-label'
const SERVICE_TOKEN = 'bearer-service-audit'

/** Principals for the stub verifier. */
function principals() {
  return {
    [AGENT_TOKEN]: { principalId: 'p-agent', agentId: 'agt_one', scopes: new Set(['scheduler.read']) },
    [OTHER_TOKEN]: { principalId: 'p-other', agentId: 'agt_two', scopes: new Set(['scheduler.read']) },
    [AUDIT_TOKEN]: { principalId: 'p-audit', agentId: null, scopes: new Set(['scheduler.audit']) },
    [NOSCOPE_TOKEN]: { principalId: 'p-none', agentId: 'agt_one', scopes: new Set(['forum.read']) },
    // R8 reconciliation duty 1: local entitlement labels are NOT token scopes.
    [LOCALLABEL_TOKEN]: { principalId: 'p-local', agentId: 'agt_one', scopes: new Set(['scheduler.read:self']) },
    [SERVICE_TOKEN]: { principalId: 'p-service', agentId: null, scopes: new Set(['scheduler.audit']) },
  }
}

/** Seed a real HistoryStore with two jobs' runs + a wake-result chain. */
async function seedHistory() {
  const dir = mkdtempSync(join(tmpdir(), 'sched-api-'))
  const history = new HistoryStore({ dir, nowMs: () => T0 })
  const job = (id, agentId) => ({
    id, name: `Job ${id}`, agentId,
    schedule: { kind: 'every', everyMs: 1000 }, delivery: { mode: 'none' },
    deleteAfterRun: false, payload: { message: 'm' },
  })
  const mk = (id, agentId, slot) => ({
    record: {
      occurrenceId: `occ_${slot}_${id}`, runId: `run:occ_${slot}_${id}`, jobId: id,
      scheduleRevision: 1, kind: 'natural', nominalScheduledAt: slot,
      idempotencyKey: `occ_${slot}_${id}`,
      payloadHash: `sha256:${slot}`, state: 'admitted', admittedAt: slot,
      executionDeadlineAtMs: slot + 60_000, history: [],
    },
    job: job(id, agentId),
  })
  // run A (agt_one, success with structured result incl. wake_sent)
  const a = mk('job-a', 'agt_one', T0)
  await history.occurrenceReserved(a)
  await history.runStarted({ record: { occurrenceId: a.record.occurrenceId, runId: a.record.runId, jobId: 'job-a' } })
  await history.runTerminal({
    record: { occurrenceId: a.record.occurrenceId, runId: a.record.runId, jobId: 'job-a', nativeSessionId: `cron-run-${a.record.occurrenceId}` },
    classification: { state: 'succeeded', reason: 'invoker returned terminal success', endedAt: T0 + 5 },
    deliveryStatus: 'delivered',
    outcome: {
      result: {
        final_status: 'PASS',
        counters: { pages_scanned: 7 },
        notes: 'all good',
        wake_sent: [{ target_agent_id: 'agt_two', workflow_instance_id: 'wi-42', request_id: 'wdhr1:wi-42:agt_two', session_id: 'sess-wake' }],
      },
    },
  })
  // run B (agt_two, failed)
  const b = mk('job-b', 'agt_two', T0 + 1_000)
  await history.occurrenceReserved(b)
  await history.runTerminal({
    record: { occurrenceId: b.record.occurrenceId, runId: b.record.runId, jobId: 'job-b', nativeSessionId: `cron-run-${b.record.occurrenceId}` },
    classification: { state: 'failed', reason: 'invoke failed: boom', endedAt: T0 + 1_005, terminalEvidence: { kind: 'turn-terminal', detailRef: 'boom' } },
    deliveryStatus: 'not-requested',
    outcome: {},
  })
  return { history, runA: history.getRun(a.record.runId), runB: history.getRun(b.record.runId), dir }
}

async function mount(t, { history, verifier }) {
  const services = new Map([
    ['agentRouter', stubRouter()],
    ['agentDefinition', stubDefinition],
    ['schedulerHistory', history],
    ['schedulerTokenVerifier', verifier],
  ])
  const ctx = fakeCtx(services)
  const api = applyProductApi(ctx, { port: 0 })
  // port 0: wait for the actual address.
  await new Promise((resolveReady) => {
    const wait = () => {
      const addr = api.address()
      if (addr?.port && addr.port !== 0) resolveReady()
      else setTimeout(wait, 10)
    }
    wait()
  })
  const addr = api.address()
  t.after(() => ctx.disposeAll())
  const base = `http://127.0.0.1:${addr.port}`
  return { base }
}

async function get(base, path, { token, method } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: method ?? 'GET',
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

test('ACC-005 gate: no token / unconfigured seam / bad token / no scope / local label all fail closed', async (t) => {
  const { history } = await seedHistory()
  const { base } = await mount(t, { history, verifier: createStubTokenVerifier(principals()) })

  let res = await get(base, '/scheduler/runs')
  assert.equal(res.status, 401)
  assert.equal(res.body.error.code, 'unauthenticated')

  res = await get(base, '/scheduler/runs', { token: 'nonsense' })
  assert.equal(res.status, 401)
  res = await get(base, '/scheduler/runs', { token: AUDIT_TOKEN.slice(0, 4) })
  assert.equal(res.status, 401)

  res = await get(base, '/scheduler/runs', { token: NOSCOPE_TOKEN })
  assert.equal(res.status, 403)
  assert.equal(res.body.error.code, 'forbidden')

  // scheduler.read:self is a LOCAL entitlement label, never a token scope (R8 duty 1)
  res = await get(base, '/scheduler/runs', { token: LOCALLABEL_TOKEN })
  assert.equal(res.status, 403)

  // unauthenticated requests are 401 on EVERY /scheduler/* path (no route probing)
  res = await get(base, '/scheduler/runs/whatever', {})
  assert.equal(res.status, 401)
  res = await get(base, '/scheduler/occurrences/whatever', {})
  assert.equal(res.status, 401)
})

test('ACC-005 gate: unconfigured verification seam = 401 even for any bearer string', async (t) => {
  const { history } = await seedHistory()
  const { base } = await mount(t, { history, verifier: null })
  const res = await get(base, '/scheduler/runs', { token: AUDIT_TOKEN })
  assert.equal(res.status, 401)
  assert.match(res.body.error.message, /unconfigured verification seam/)
})

test('ACC-001c/d/e + ACC-004 audit view: run detail with job_snapshot / output / trace.wake_links', async (t) => {
  const { history, runA } = await seedHistory()
  const { base } = await mount(t, { history, verifier: createStubTokenVerifier(principals()) })

  const detail = await get(base, `/scheduler/runs/${runA.run_id}`, { token: AUDIT_TOKEN })
  assert.equal(detail.status, 200)
  assert.equal(detail.body.run.run_id, runA.run_id)
  assert.equal(detail.body.run.session_id, `cron-run-${runA.occurrence_id}`)
  const snap = detail.body.job_snapshot
  assert.equal(snap.name, 'Job job-a')
  assert.equal(snap.agent_id, 'agt_one')
  assert.equal(snap.schedule.kind, 'every')
  assert.equal(snap.delete_after_run, false)
  assert.equal(snap.delivery_mode, 'none')
  assert.deepEqual(detail.body.session, { session_id: runA.session_id, agent_id: 'agt_one', native: true })
  assert.equal(detail.body.output.result_status, 'PASS')
  assert.equal(detail.body.output.result_recorded, true)
  assert.equal(detail.body.output.result.counters.pages_scanned, 7)
  assert.equal(detail.body.error, null)
  assert.equal(detail.body.trace.correlation_id, runA.correlation_id)
  assert.equal(detail.body.trace.parent_run_id, null)
  assert.equal(detail.body.trace.request_id, runA.occurrence_id)
  assert.deepEqual(detail.body.trace.wake_links, [{
    target_agent_id: 'agt_two', workflow_instance_id: 'wi-42',
    request_id: 'wdhr1:wi-42:agt_two', session_id: 'sess-wake',
  }])

  // correlation filter returns the chain (here: the single root)
  const byCorr = await get(base, `/scheduler/runs?correlation_id=${runA.correlation_id}`, { token: AUDIT_TOKEN })
  assert.equal(byCorr.status, 200)
  assert.equal(byCorr.body.runs.length, 1)
  assert.equal(byCorr.body.runs[0].run_id, runA.run_id)

  // occurrence view
  const occ = await get(base, `/scheduler/occurrences/${runA.occurrence_id}`, { token: AUDIT_TOKEN })
  assert.equal(occ.status, 200)
  assert.equal(occ.body.occurrence.occurrence_id, runA.occurrence_id)
  assert.equal(occ.body.occurrence.job_snapshot.agent_id, 'agt_one')
  assert.equal(occ.body.runs.length, 1)
  assert.deepEqual(occ.body.retry_chain.map((e) => e.occurrence_id), [runA.occurrence_id])
  assert.equal(occ.body.output.result_status, 'PASS')

  const missing = await get(base, '/scheduler/runs/run:unknown', { token: AUDIT_TOKEN })
  assert.equal(missing.status, 404)
  assert.equal(missing.body.error.code, 'not_found')
})

test('ACC-005 read scope: only own runs; other agent_id query / other run / other occurrence = 403', async (t) => {
  const { history, runA, runB } = await seedHistory()
  const { base } = await mount(t, { history, verifier: createStubTokenVerifier(principals()) })

  // list is forced to the caller's own agent_id
  const own = await get(base, '/scheduler/runs', { token: AGENT_TOKEN })
  assert.equal(own.status, 200)
  assert.ok(own.body.runs.length >= 1)
  assert.ok(own.body.runs.every((r) => r.agent_id === 'agt_one'), 'read scope sees only its own runs')

  const explicitOther = await get(base, '/scheduler/runs?agent_id=agt_two', { token: AGENT_TOKEN })
  assert.equal(explicitOther.status, 403)

  const otherRun = await get(base, `/scheduler/runs/${runB.run_id}`, { token: AGENT_TOKEN })
  assert.equal(otherRun.status, 403)

  const otherOcc = await get(base, `/scheduler/occurrences/${runB.occurrence_id}`, { token: AGENT_TOKEN })
  assert.equal(otherOcc.status, 403)

  const ownRun = await get(base, `/scheduler/runs/${runA.run_id}`, { token: AGENT_TOKEN })
  assert.equal(ownRun.status, 200)

  // audit scope: global view
  const global = await get(base, '/scheduler/runs', { token: AUDIT_TOKEN })
  assert.equal(global.status, 200)
  const agents = new Set(global.body.runs.map((r) => r.agent_id))
  assert.ok(agents.has('agt_one') && agents.has('agt_two'))

  // service principal with audit: global too (no agent binding needed)
  const service = await get(base, '/scheduler/runs', { token: SERVICE_TOKEN })
  assert.equal(service.status, 200)
})

test('ACC-005 read scope without agent binding = 403 (owns no runs)', async (t) => {
  const { history } = await seedHistory()
  const verifier = createStubTokenVerifier({
    'x': { principalId: 'p-x', agentId: null, scopes: new Set(['scheduler.read']) },
  })
  const { base } = await mount(t, { history, verifier })
  const res = await get(base, '/scheduler/runs', { token: 'x' })
  assert.equal(res.status, 403)
})

test('R7 query contract: filters, pagination cursor, limit bounds, invalid_query, scheduled notice', async (t) => {
  const { history } = await seedHistory()
  const { base } = await mount(t, { history, verifier: createStubTokenVerifier(principals()) })

  const byStatus = await get(base, '/scheduler/runs?status=failed', { token: AUDIT_TOKEN })
  assert.equal(byStatus.body.runs.length, 1)
  assert.equal(byStatus.body.runs[0].status_view, 'failed')
  assert.equal(byStatus.body.runs[0].error_code, 'FAILED')

  const byTime = await get(base, `/scheduler/runs?from=${new Date(T0 + 999).toISOString()}`, { token: AUDIT_TOKEN })
  assert.equal(byTime.body.runs.length, 1)
  assert.equal(byTime.body.runs[0].run_id, history.queryRuns({}).runs[0].run_id)

  const badTime = await get(base, '/scheduler/runs?from=not-a-date', { token: AUDIT_TOKEN })
  assert.equal(badTime.status, 400)
  assert.equal(badTime.body.error.code, 'invalid_query')

  const badLimit = await get(base, '/scheduler/runs?limit=201', { token: AUDIT_TOKEN })
  assert.equal(badLimit.status, 400)
  const badLimit2 = await get(base, '/scheduler/runs?limit=abc', { token: AUDIT_TOKEN })
  assert.equal(badLimit2.status, 400)

  const badStatus = await get(base, '/scheduler/runs?status=everything', { token: AUDIT_TOKEN })
  assert.equal(badStatus.status, 400)

  const scheduled = await get(base, '/scheduler/runs?status=scheduled', { token: AUDIT_TOKEN })
  assert.equal(scheduled.status, 200)
  assert.deepEqual(scheduled.body.runs, [])
  assert.match(scheduled.body.notice, /not a durable history state/)

  // cursor pagination works over HTTP
  const page1 = await get(base, '/scheduler/runs?limit=1', { token: AUDIT_TOKEN })
  assert.equal(page1.body.runs.length, 1)
  assert.notEqual(page1.body.next_cursor, null)
  const page2 = await get(base, `/scheduler/runs?limit=1&cursor=${encodeURIComponent(page1.body.next_cursor)}`, { token: AUDIT_TOKEN })
  assert.equal(page2.body.runs.length, 1)
  assert.notEqual(page2.body.runs[0].run_id, page1.body.runs[0].run_id)
})

test('ACC-009 read-only red line: no mutating routes; unauthenticated POST = 401 gate first', async (t) => {
  const { history } = await seedHistory()
  const { base } = await mount(t, { history, verifier: createStubTokenVerifier(principals()) })

  const postNoAuth = await get(base, '/scheduler/runs', { token: undefined, method: 'POST' })
  assert.equal(postNoAuth.status, 401, 'gate runs before method dispatch')

  const post = await fetch(`${base}/scheduler/runs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${AUDIT_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ evil: true }),
  })
  assert.equal(post.status, 405)
  const del = await fetch(`${base}/scheduler/runs/${runAId()}`, { method: 'DELETE', headers: { authorization: `Bearer ${AUDIT_TOKEN}` } })
  assert.equal(del.status, 405)

  // routes outside /scheduler/* are NOT affected
  const health = await get(base, '/health')
  assert.equal(health.status, 200)
  const notFound = await get(base, '/scheduler/', { token: AUDIT_TOKEN })
  assert.equal(notFound.status, 404)

  function runAId() {
    return history.queryRuns({}).runs[0].run_id
  }
})

test('history store not wired = 500 internal (fail loud, not silent empty)', async (t) => {
  const { base } = await mount(t, { history: null, verifier: createStubTokenVerifier(principals()) })
  const res = await get(base, '/scheduler/runs', { token: AUDIT_TOKEN })
  assert.equal(res.status, 500)
  assert.equal(res.body.error.code, 'internal')
})

test('buildRunRecord stays a pure rebuildable projection (same facts → same record)', async () => {
  const occurrence = {
    occurrenceId: 'occ_x', runId: 'run:occ_x', jobId: 'j', scheduleRevision: 3,
    nativeSessionId: 'cron-run-occ_x', agentId: 'agt', model: 'gpt-x', idempotencyKey: 'occ_x',
    retryOfOccurrenceId: 'occ_root', correlationId: 'schcorr:occ_root', parentRunId: 'run:occ_root',
    retryCount: 2,
  }
  const classification = { state: 'failed', reason: 'boom', endedAt: T0 + 10, terminalEvidence: { kind: 'turn-terminal' } }
  const a = buildRunRecord({ occurrence, classification, deliveryStatus: 'not-requested', outcome: {}, admittedAt: T0, scheduledAtMs: T0 })
  const b = buildRunRecord({ occurrence, classification, deliveryStatus: 'not-requested', outcome: {}, admittedAt: T0, scheduledAtMs: T0 })
  assert.deepEqual(a, b)
  assert.equal(a.resolved_model, null, 'V1: resolved_model honestly null')
})
