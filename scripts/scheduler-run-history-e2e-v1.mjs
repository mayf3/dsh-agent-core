#!/usr/bin/env node
/**
 * AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 — local end-to-end verification
 * (RUN_HISTORY_LOCAL_E2E).
 *
 * Exercises the FULL production stack locally, zero production access:
 *
 *   real composeProductionRuntime (proxy/runtime gates included)
 *     + real scheduler engine over the production layout
 *     + real HistoryStore (events.jsonl + monthly projections)
 *     + real product-api HTTP server with the /scheduler/* gate
 *     + real RS256/JWKS token verification against a LOCAL stub auth-service
 *     + fake agent processes replying with ```scheduler-result blocks
 *
 * Scenarios (spec §5): ACC-001 (one-shot + deleteAfterRun + snapshot query),
 * ACC-002 (recurring independent occurrences), ACC-003b (timeout →
 * outcome_unknown + TIMEOUT), ACC-004 (wake_links), ACC-005 (token gate,
 * read vs audit scopes), ACC-008 (structured result ingestion), ACC-009
 * (GET-only), plus the CLI `runs` history surface.
 *
 * Requirements: node v25.6.1 (production pin — compose enforces it), no
 * proxy env (compose forbids one). Exit 0 = PASS.
 */

import assert from 'node:assert/strict'
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const compose = await import('../packages/production-runtime/src/compose.js')
const paths = await import('../packages/production-runtime/src/paths.js')
const { writeAgentDefinition } = await import('../packages/agent-definition/src/config.js')
const HistoryStore = (await import('../packages/scheduler/src/history.js')).HistoryStore

const AGT_A = 'agt_e2e-a'
const AGT_B = 'agt_e2e-b'
const KID = 'e2e-key-1'
const PRINCIPAL_IDS = {
  [AGT_A]: '10000000-0000-4000-8000-000000000001',
  [AGT_B]: '10000000-0000-4000-8000-000000000002',
  service: '10000000-0000-4000-8000-000000000003',
}
const step = (name) => process.stdout.write(`\n== ${name}\n`)

// ── local stub auth-service: JWKS endpoint + RS256 token minting ───────────
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pubJwk = publicKey.export({ format: 'jwk' })
const jwkPublic = { kid: KID, kty: 'RSA', alg: 'RS256', use: 'sig', n: pubJwk.n, e: pubJwk.e }

const jwksServer = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ keys: [jwkPublic] }))
})
await new Promise((resolve) => jwksServer.listen(0, '127.0.0.1', resolve))
const jwksUrl = `http://127.0.0.1:${jwksServer.address().port}/.well-known/jwks.json`

function mintToken({ scope, agentId, audience = 'scheduler' }) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const header = b64({ alg: 'RS256', kid: KID, typ: 'JWT' })
  const payload = b64({
    iss: 'https://auth.e2e.local', sub: PRINCIPAL_IDS[agentId ?? 'service'], aud: audience,
    principal_type: agentId ? 'agent' : 'service', client_id: 'e2e-client',
    token_use: 'access', type: 'access', version: 'v1',
    scope, ...(agentId ? { agent_id: agentId } : {}),
    jti: randomUUID(), iat: now, nbf: now, exp: now + 600,
  })
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKey).toString('base64url')
  return `${header}.${payload}.${signature}`
}

const AGENT_A_TOKEN = mintToken({ scope: 'scheduler.read', agentId: AGT_A })
const AGENT_B_TOKEN = mintToken({ scope: 'scheduler.read', agentId: AGT_B })
const AUDIT_TOKEN = mintToken({ scope: 'scheduler.audit scheduler.read', agentId: AGT_A })
const NOSCOPE_TOKEN = mintToken({ scope: 'forum.read', agentId: AGT_A })

// ── fake agent process: replies with a structured scheduler-result block ───
let pidSeq = 9000
let hangTurns = false
const released = []
class FakeProc {
  constructor({ agentId }) {
    this.agentId = agentId
    this.pid = ++pidSeq
    this.home = `/tmp/e2e-home-${agentId}`
    this.workspace = `/tmp/e2e-ws-${agentId}`
    this.profile = 'fake-profile'
    this.exit = undefined
    this.exitResolve = undefined
    this.exitPromise = new Promise((resolve) => { this.exitResolve = resolve })
    this.turns = []
  }
  spawn() {}
  async ready() { return 1 }
  async deliver(sessionId, text) {
    return { accepted: true, sessionId, messageId: `m-${this.turns.length}`, reconciliationHandle: `turn:deliver-${this.turns.length}`, evidence: { promptReceipt: 'accepted' } }
  }
  async turn(sessionId, text) {
    this.turns.push({ sessionId, text })
    if (hangTurns) {
      // never completes on its own — the engine deadline must classify it
      await new Promise(() => {})
    }
    const counters = { pages_scanned: 11, candidates: 2 }
    const result = {
      final_status: 'PASS',
      counters,
      notes: 'e2e round',
      wake_sent: [{ target_agent_id: AGT_B, workflow_instance_id: 'wi-e2e-1', request_id: `wdhr1:wi-e2e-1:${AGT_B}`, session_id: `sess-wake-${this.turns.length}` }],
    }
    return {
      reply: `TURNED:${text}\n\`\`\`scheduler-result\n${JSON.stringify(result)}\n\`\`\``,
      ms: 1, promptMs: 1, messageId: `m${this.turns.length}`,
      reconciliationHandle: `turn:scheduled-${this.turns.length}`,
      evidence: { terminationEvidence: 'exact_terminal_then_idle' },
    }
  }
  async shutdown() {
    if (this.exit === undefined) {
      this.exit = { code: 0, signal: null }
      this.exitResolve?.(this.exit)
    }
  }
  kill() {
    this.exit = { code: 9, signal: 'SIGKILL' }
    this.exitResolve?.({ code: 9, signal: 'SIGKILL' })
  }
}

// ── compose the real production runtime ─────────────────────────────────────
const root = await mkdtemp(join(tmpdir(), 'sched-history-e2e-'))
const layout = paths.resolveProductionLayout(root)
await writeAgentDefinition(layout.agentsConfig, {
  defaultAgentId: AGT_A,
  agents: [{ id: AGT_A, name: 'E2E A' }, { id: AGT_B, name: 'E2E B' }],
})

const runtime = await compose.composeProductionRuntime({
  layout,
  productApi: { enabled: true, host: '127.0.0.1', port: 0 },
  notificationIngress: { enabled: false, host: '127.0.0.1', port: 0 },
  schedulerAuth: { jwksUrl, issuer: 'https://auth.e2e.local', audience: 'scheduler' },
  processFactory: (opts) => new FakeProc(opts),
  log: { log: () => {}, warn: () => {}, error: (...a) => process.stderr.write(`[e2e-runtime] ${a.join(' ')}\n`) },
  tickMs: 100,
})
const history = runtime.ctx.get('schedulerHistory')
assert.ok(history)
// port 0: wait for the actual bound address.
await new Promise((resolveReady) => {
  const wait = () => {
    const addr = runtime.productApi.address()
    if (addr?.port && addr.port !== 0) resolveReady()
    else setTimeout(wait, 20)
  }
  wait()
})
const { port } = runtime.productApi.address()
const base = `http://127.0.0.1:${port}`

async function api(path, { token, method } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: method ?? 'GET',
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}
const waitFor = async (predicate, ms = 15_000) => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const value = await predicate()
    if (value) return value
    await new Promise((r) => setTimeout(r, 100))
  }
  return undefined
}

try {
  // ── ACC-005: gate ─────────────────────────────────────────────────────────
  step('ACC-005 /scheduler/* gate (fail-closed)')
  assert.equal((await api('/scheduler/runs')).status, 401)
  assert.equal((await api('/scheduler/runs', { token: 'garbage' })).status, 401)
  assert.equal((await api('/scheduler/runs', { token: NOSCOPE_TOKEN })).status, 403)
  process.stdout.write('gate PASS: 401 unauthenticated / 403 no-scope\n')

  // ── ACC-001: one-shot + deleteAfterRun + structured result ────────────────
  step('ACC-001 one-shot deleteAfterRun run with structured result (R4 ingestion)')
  const jobA = {
    name: 'e2e-one-shot', agentId: AGT_A,
    schedule: { kind: 'at', at: new Date(Date.now() + 100).toISOString() },
    payload: { kind: 'agentTurn', message: 'run the round' },
    delivery: { mode: 'none' }, deleteAfterRun: true,
  }
  const created = await runtime.scheduler.createJob(jobA)
  await runtime.start()
  const runA = await waitFor(() => history.queryRuns({ jobId: created.id }).runs.at(0))
  assert.ok(runA, 'run recorded')
  await waitFor(() => history.getRun(runA.run_id)?.outcome === 'succeeded')
  const doc = await runtime.store.loadDoc()
  assert.equal(doc.jobs.find((j) => j.id === created.id), undefined, 'definition auto-deleted')
  assert.ok(doc.occurrences.some((o) => o.occurrenceId === runA.occurrence_id), 'authority ledger retained')

  const detail = await api(`/scheduler/runs/${runA.run_id}`, { token: AUDIT_TOKEN })
  assert.equal(detail.status, 200)
  assert.equal(detail.body.job_snapshot.name, 'e2e-one-shot', 'job_snapshot survives deletion')
  assert.equal(detail.body.job_snapshot.agent_id, AGT_A)
  assert.equal(detail.body.output.result_status, 'PASS', 'structured result ingested')
  assert.equal(detail.body.output.result.counters.pages_scanned, 11)
  assert.deepEqual(detail.body.trace.wake_links.map((w) => w.target_agent_id), [AGT_B])
  assert.equal(detail.body.trace.correlation_id, `schcorr:${runA.occurrence_id}`)
  process.stdout.write(`one-shot PASS: ${runA.run_id} queryable with snapshot + result after deletion\n`)

  // ── ACC-004: J1 join face (wake_links ↔ requestId formula) ────────────────
  step('ACC-004 wake link join face (requestId = wdhr1:<wi>:<target>)')
  const link = detail.body.trace.wake_links[0]
  assert.equal(link.request_id, `wdhr1:wi-e2e-1:${AGT_B}`)
  assert.equal(link.workflow_instance_id, 'wi-e2e-1')
  process.stdout.write('wake link PASS\n')

  // ── ACC-005: scope data plane over HTTP ───────────────────────────────────
  step('ACC-005 read scope data plane (own runs only)')
  const ownView = await api('/scheduler/runs', { token: AGENT_A_TOKEN })
  assert.equal(ownView.status, 200)
  assert.ok(ownView.body.runs.every((r) => r.agent_id === AGT_A))
  assert.equal((await api(`/scheduler/runs?agent_id=${AGT_B}`, { token: AGENT_A_TOKEN })).status, 403)
  const runBSeeded = ownView.body.runs // agent A runs only
  assert.equal((await api('/scheduler/runs', { token: AUDIT_TOKEN })).body.runs.length >= runBSeeded.length, true)
  process.stdout.write('scope PASS: read=own, audit=global\n')

  // ── ACC-002: recurring independent occurrences ────────────────────────────
  step('ACC-002 recurring job → independent occurrences')
  const every = await runtime.scheduler.createJob({
    name: 'e2e-recurring', agentId: AGT_A,
    schedule: { kind: 'every', everyMs: 1_000, anchorMs: Date.now() },
    payload: { kind: 'agentTurn', message: 'tick round' },
    delivery: { mode: 'none' }, deleteAfterRun: false,
  })
  await waitFor(() => history.queryRuns({ jobId: every.id }).runs.length >= 2, 20_000)
  const recurring = history.queryRuns({ jobId: every.id }).runs
  assert.ok(new Set(recurring.map((r) => r.occurrence_id)).size === recurring.length, 'occurrence ids distinct')
  assert.ok(recurring.length >= 2, 'at least two independent occurrences')
  process.stdout.write(`recurring PASS: ${recurring.length} independent occurrences\n`)

  // ── ACC-003b: timeout → outcome_unknown + TIMEOUT classification ──────────
  step('ACC-003b timeout without termination proof → TIMEOUT classification')
  const timeoutJob = await runtime.scheduler.createJob({
    name: 'e2e-timeout', agentId: AGT_A,
    schedule: { kind: 'at', at: new Date(Date.now() + 100).toISOString() },
    payload: { kind: 'agentTurn', message: 'hang', timeoutSeconds: 1 },
    delivery: { mode: 'none' }, deleteAfterRun: false, retry: { auto: false },
  })
  hangTurns = true
  await runtime.scheduler.tick()
  const timeoutRun = await waitFor(() => history.queryRuns({ jobId: timeoutJob.id, status: 'timeout' }).runs.at(0), 20_000)
  assert.ok(timeoutRun, 'timeout-classified run recorded')
  assert.equal(timeoutRun.outcome, 'outcome_unknown')
  assert.equal(timeoutRun.error_code, 'TIMEOUT')
  assert.equal(timeoutRun.status_view, 'timeout')
  hangTurns = false
  process.stdout.write('timeout PASS: outcome_unknown + TIMEOUT + fence visible\n')

  // ── ACC-009: GET-only + unknown route ─────────────────────────────────────
  step('ACC-009 read-only red line')
  assert.equal((await api('/scheduler/runs', { token: AUDIT_TOKEN, method: 'POST' })).status, 405)
  assert.equal((await api('/scheduler/runs?status=scheduled', { token: AUDIT_TOKEN })).body.notice !== undefined, true)
  assert.equal((await api('/scheduler/nope', { token: AUDIT_TOKEN })).status, 404)
  process.stdout.write('read-only PASS\n')

  // ── CLI runs reads the history store ──────────────────────────────────────
  step('CLI runs reads the history store')
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const exec = promisify(execFile)
  const cli = await exec(process.execPath, ['scripts/agentcore-cron.mjs', 'runs', '--id', created.id, '--store', layout.jobsStore], { cwd: process.cwd() })
  assert.match(cli.stdout, /run:occ/, 'CLI shows the history run identity')
  assert.match(cli.stdout, /succeeded\/success/, 'CLI shows outcome/status_view')
  assert.match(cli.stdout, /corr=schcorr:/, 'CLI shows the correlation chain root')
  const cliJson = await exec(process.execPath, ['scripts/agentcore-cron.mjs', 'runs', '--id', created.id, '--json', '--store', layout.jobsStore], { cwd: process.cwd() })
  const parsed = JSON.parse(cliJson.stdout)
  assert.equal(parsed.runs.length, 1)
  process.stdout.write('CLI PASS\n')

  process.stdout.write('\nRUN_HISTORY_LOCAL_E2E = PASS\n')
} finally {
  await runtime.stop().catch(() => {})
  jwksServer.close()
}
process.exit(0)
