#!/usr/bin/env node
// release-startup-closure — T1 acceptance driver (availability rollout).
//
// Proves, against an ASSEMBLED release package (app/ with node_modules
// installed from the pinned lockfile), the things the first T1 round honestly
// left undone:
//   1. a REAL startup: the production composition reaches `ready` with the
//      scheduler startup-readiness gate ON (the exact bar scripts/
//      production-runtime.mjs enforces) — not just the fail-closed exit-2
//      negative example;
//   2. a REAL request closure: notification-ingress HTTP (service-auth Basic
//      -> token verifier -> allowlist) -> Router deliver -> a REAL OS worker
//      child (scripts/availability-recovery/worker.mjs tool-free fixture)
//      completes for BOTH the default (HR) agent and a normal Agent;
//   3. a REAL controlled restart: a second fresh process recomposes on the
//      same persistent root, serves NEW requests, and replays a phase-1
//      request with its recorded durable outcome (duplicate: true).
//
// Identity honesty (recorded in the evidence, never hidden): runs as the
// invoking user (uid/gid equivalent to the gui-domain gui-user services);
// the model/tool provider is the tool-free fixture worker; the Feishu channel
// is OFF (no credentials, honest offline); the notification auth token
// endpoint is a local fetchImpl fixture — the verifier's full chain still
// runs. Nothing here touches production state: isolated root, ephemeral
// 127.0.0.1 ports, synthetic test identities/credentials.
//
// Usage:
//   node release-startup-closure.mjs --full          # orchestrates both phases
//   node release-startup-closure.mjs --phase 1 --root <dir>   # one lifecycle
//   node release-startup-closure.mjs --phase 2 --root <dir>   # restart leg
//   node release-startup-closure.mjs --selftest      # seed/contract checks only
import { spawn } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AgentProcess } from '../../packages/agent-router/src/process.js'
import { writeAgentDefinition } from '../../packages/agent-definition/src/config.js'
import { resolveProductionLayout } from '../../packages/production-runtime/src/paths.js'
import { composeProductionRuntime } from '../../packages/production-runtime/src/compose.js'
import { assertProductionArchitecture } from '../../packages/production-runtime/src/native-arm64/admission.js'
import { NOTIFICATION_RESOURCE } from '../../packages/notification-ingress/src/auth.js'
import { validateCanonicalHealthAuthority } from '../../packages/scheduler/src/watchdog/health.js'

const FIXTURE_WORKER = fileURLToPath(new URL('./worker.mjs', import.meta.url))
export const HR = 'agt_hr-agent'
export const CONTROL = 'agt_availability-control'
const FORUM_CLIENT = { id: 'closure-fixture-forum', secret: 'closure-fixture-forum-secret' }
const WORKFLOW_CLIENT = { id: 'closure-fixture-workflow', secret: 'closure-fixture-workflow-secret' }
const BASIC = (client) => `Basic ${Buffer.from(`${client.id}:${client.secret}`).toString('base64')}`
const WORKSPACE_ROOT = process.env.CLOSURE_WORKSPACE_ROOT ?? join(homedir(), '.agent-core-closure')
const resultLine = (label, value) => process.stdout.write(`CLOSURE_RESULT ${label} ${JSON.stringify(value)}\n`)

// ── isolated persistent root seeding (the "provision the runtime first" step,
//    done with synthetic test identities exactly as an operator would) ──────
export async function seedRoot(root) {
  const layout = resolveProductionLayout(root)
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: HR,
    agents: [
      { id: HR, name: 'Closure Fixture HR' },
      { id: CONTROL, name: 'Closure Fixture Control' },
    ],
  })
  mkdirSync(layout.schedulerDir ?? join(root, 'scheduler'), { recursive: true })
  // Canonical health census sources (scheduler readiness gate, entry-level bar):
  writeFileSync(layout.jobsStore, `${JSON.stringify({ version: 3, jobs: [], occurrences: [], fences: {} })}\n`)
  writeFileSync(layout.runsLog, '')
  const routing = join(root, 'scheduler', 'routing.json')
  writeFileSync(routing, `${JSON.stringify({
    version: 1,
    canonicalOpsTarget: { channel: 'feishu', to: 'closure-fixture-ops-target' },
    ownerTargets: {},
    jobFailureTargets: {},
  })}\n`)
  chmodSync(routing, 0o640)
  const incidentState = layout.schedulerIncidentState
  mkdirSync(incidentState.slice(0, incidentState.lastIndexOf('/')), { recursive: true })
  writeFileSync(incidentState, `${JSON.stringify({ version: 1, incidents: {}, outbox: {} })}\n`)
  chmodSync(incidentState, 0o600)
  // Test credential store (synthetic values; NOT secrets).
  mkdirSync(layout.controlDir, { recursive: true })
  const credentialsFile = join(layout.controlDir, 'credentials-test.json')
  writeFileSync(credentialsFile, `${JSON.stringify({ version: 1, credentials: {
    [HR]: { clientId: 'closure-fixture-hr', clientSecret: 'closure-fixture-hr-secret' },
    [CONTROL]: { clientId: 'closure-fixture-control', clientSecret: 'closure-fixture-control-secret' },
  } })}\n`)
  chmodSync(credentialsFile, 0o600)
  // Notification ingress auth config: operator-owned 0600 inside 0700, test
  // caller allowlist; the token endpoint never leaves this process (fetchImpl).
  mkdirSync(layout.notificationDir, { recursive: true })
  chmodSync(layout.notificationDir, 0o700)
  writeFileSync(layout.notificationAuthConfig, `${JSON.stringify({
    authServiceOrigin: 'https://notification-auth.fixture.invalid',
    audience: NOTIFICATION_RESOURCE,
    allowlist: { 'svc-forum': FORUM_CLIENT.id, 'svc-workflow': WORKFLOW_CLIENT.id },
    routerDeadlineMs: 15000,
  }, null, 2)}\n`)
  chmodSync(layout.notificationAuthConfig, 0o600)
  return { layout, credentialsFile }
}

// ── real OS worker child (same pattern as scripts/availability-recovery/harness.mjs) ──
class FixtureWorkerProcess extends AgentProcess {
  spawn() {
    this.counters.spawnAttempts += 1
    const root = this.workspaceRoot ?? process.env.CLOSURE_ROOT
    return this.attachChild(spawn(process.execPath, [FIXTURE_WORKER], {
      cwd: root,
      env: { PATH: '/usr/bin:/bin', HOME: root, FIXTURE_PROMPT_LOG: join(root, 'fixture-prompts.jsonl') },
      stdio: ['pipe', 'pipe', 'pipe'],
    }))
  }
}

// Local token-endpoint fixture: transport-only stub; the verifier's full
// Basic→mint→allowlist chain still executes against it.
const fixtureTokenFetch = async (url, init) => {
  const header = init?.headers?.Authorization ?? init?.headers?.authorization ?? ''
  const decoded = Buffer.from(String(header).replace(/^Basic\s+/i, ''), 'base64').toString('utf8')
  const [clientId, secret] = decoded.split(':')
  const known = [FORUM_CLIENT, WORKFLOW_CLIENT].find((c) => c.id === clientId && c.secret === secret)
  if (!known) return new Response(JSON.stringify({ error: 'invalid_client' }), { status: 400 })
  return new Response(JSON.stringify({ access_token: `fixture-token-for-${clientId}`, token_type: 'Bearer', expires_in: 300 }), { status: 200 })
}

async function deliver(port, client, payload) {
  const res = await fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: BASIC(client) },
    body: JSON.stringify(payload),
  })
  return { status: res.status, body: await res.json() }
}

async function runPhase(root, run) {
  process.env.CLOSURE_ROOT = root
  process.env.AGENT_CORE_CREDENTIALS_FILE = join(root, 'control', 'credentials-test.json')
  process.env.SCHEDULER_ROUTING_OWNER_UID = String(process.getuid())
  process.env.SCHEDULER_ROUTING_READER_GID = String(process.getgid())
  const { layout } = await seedRoot(root)
  assertProductionArchitecture()
  const spawned = []
  let runtime
  let stopping = false
  const stop = async (exitCode) => {
    if (stopping) return
    stopping = true
    try { await runtime?.stop() } catch (error) { process.stderr.write(`stop failed: ${error?.message ?? error}\n`) }
    process.exit(exitCode)
  }
  process.on('SIGTERM', () => { void stop(0) })
  process.on('SIGINT', () => { void stop(0) })

  runtime = await composeProductionRuntime({
    layout,
    tickMs: 250,
    concurrency: 2,
    catchup: true,
    schedulerReadinessRequired: true, // the entry.js startup bar
    globalRoute: { provider: 'closure-fixture', model: 'tool-free' },
    processFactory: (opts) => { const p = new FixtureWorkerProcess(opts); spawned.push(p); return p },
    productApi: { enabled: true, host: '127.0.0.1', port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0, fetchImpl: fixtureTokenFetch },
    log: { log: (...a) => process.stdout.write(`[rt] ${a.join(' ')}\n`), warn: (...a) => process.stdout.write(`[rt:warn] ${a.join(' ')}\n`), error: (...a) => process.stderr.write(`[rt:error] ${a.join(' ')}\n`) },
  })
  await runtime.start()
  const ingressPort = runtime.notificationIngress.address().port
  const productPort = runtime.productApi?.address?.().port ?? null

  const health = await fetch(`http://127.0.0.1:${ingressPort}/health`)
  const healthBody = await health.json()
  if (health.status !== 200 || healthBody.deliverReady !== true || healthBody.authConfigured !== true) {
    resultLine('phase', { run, verdict: 'FAIL', reason: `ingress health ${health.status} ${JSON.stringify(healthBody)}` })
    return stop(1)
  }

  const workerPids = () => {
    try {
      return [...new Set(readFileSync(join(root, 'fixture-prompts.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).pid))]
    } catch { return [] }
  }
  const driverPid = process.pid
  const requests = {}
  const expectDelivered = async (key, agentId, message) => {
    const out = await deliver(ingressPort, FORUM_CLIENT, { requestId: `closure-${key}`, agentId, sessionMode: 'main', message })
    requests[key] = { ...out, payload: { requestId: `closure-${key}`, agentId, sessionMode: 'main', message } }
    return out
  }
  const runSuffix = `run${run}`
  const normal = await expectDelivered(`normal-${runSuffix}`, CONTROL, `closure request ${runSuffix} for the normal Agent`)
  const hr = await expectDelivered(`hr-${runSuffix}`, HR, `closure request ${runSuffix} for the HR agent`)
  const replays = run === 2
    ? [await deliver(ingressPort, FORUM_CLIENT, { requestId: 'closure-hr-run1', agentId: HR, sessionMode: 'main', message: 'closure request run1 for the HR agent' })]
    : []
  const negative = await deliver(ingressPort, { id: FORUM_CLIENT.id, secret: 'wrong-secret' }, { requestId: `closure-negative-${runSuffix}`, agentId: CONTROL, sessionMode: 'main', message: 'must not be admitted' })
  const childPids = spawned.map((p) => p.pid).filter((pid) => Number.isInteger(pid) && pid !== driverPid)

  const verdict = {
    run,
    root,
    driverPid,
    workerChildPids: childPids,
    distinctWorkerPids: workerPids(),
    ingressPort,
    productPort,
    ingressHealth: { status: health.status, ...healthBody },
    normalAgent: { status: normal.status, outcome: normal.body?.outcome, accepted: normal.body?.accepted },
    hrAgent: { status: hr.status, outcome: hr.body?.outcome, accepted: hr.body?.accepted },
    replayRun1: replays.map((r) => ({ status: r.status, outcome: r.body?.outcome, duplicate: r.body?.duplicate === true })),
    negativeAuth: { status: negative.status, code: negative.body?.error?.code ?? null },
    verdict: (normal.status === 200 && normal.body?.outcome === 'delivered'
      && hr.status === 200 && hr.body?.outcome === 'delivered'
      && childPids.length > 0
      && (run === 1 || replays.every((r) => r.status === 200 && r.body?.duplicate === true))
      && negative.status === 401) ? 'PASS' : 'FAIL',
  }
  resultLine('phase', verdict)
  await stop(verdict.verdict === 'PASS' ? 0 : 1)
}

// ── orchestrator: two fresh OS processes on one persistent root ──────────────
function runChild(phase, root) {
  return new Promise((resolveChild) => {
    const env = {
      PATH: '/usr/bin:/bin',
      HOME: root,
      TMPDIR: join(root, 'tmp'),
      CLOSURE_WORKSPACE_ROOT: WORKSPACE_ROOT,
      DSH_HARNESS_ROOT: process.env.DSH_HARNESS_ROOT ?? '',
    }
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--phase', String(phase), '--root', root], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    child.on('exit', (code) => {
      const lines = out.split('\n').filter((l) => l.startsWith('CLOSURE_RESULT phase '))
      const parsed = lines.length > 0 ? JSON.parse(lines[lines.length - 1].slice('CLOSURE_RESULT phase '.length)) : null
      resolveChild({ code, parsed, tail: (err || out).split('\n').slice(-6).join('\n') })
    })
  })
}

export async function runFull() {
  mkdirSync(WORKSPACE_ROOT, { recursive: true })
  const root = mkdtempSync(join(WORKSPACE_ROOT, 'closure-'))
  mkdirSync(join(root, 'tmp'), { recursive: true })
  const phase1 = await runChild(1, root)
  if (phase1.parsed?.verdict !== 'PASS' || phase1.code !== 0) {
    resultLine('full', { verdict: 'FAIL', stage: 'phase1', phase1: phase1.parsed, tail: phase1.tail })
    process.exitCode = 1
    return
  }
  const phase2 = await runChild(2, root)
  const pass = phase2.parsed?.verdict === 'PASS' && phase2.code === 0
  resultLine('full', {
    verdict: pass ? 'PASS' : 'FAIL',
    stage: pass ? 'complete' : 'phase2',
    root,
    phase1: phase1.parsed,
    phase2: phase2.parsed,
    ...(pass ? {} : { tail: phase2.tail }),
  })
  if (!pass) process.exitCode = 1
}

// ── selftest: seeding/contract checks only (no compose, no ports) ────────────
export async function selftest() {
  mkdirSync(WORKSPACE_ROOT, { recursive: true })
  const root = mkdtempSync(join(WORKSPACE_ROOT, 'selftest-'))
  try {
    const { layout } = await seedRoot(root)
    const jobs = JSON.parse(readFileSync(layout.jobsStore, 'utf8'))
    validateCanonicalHealthAuthority(jobs)
    const { loadAuthConfig } = await import('../../packages/notification-ingress/src/auth.js')
    const auth = loadAuthConfig(layout.notificationAuthConfig)
    if (!auth.ok) throw new Error(`seeded auth config rejected: ${auth.reason}`)
    const routing = JSON.parse(readFileSync(join(root, 'scheduler', 'routing.json'), 'utf8'))
    const { validateRoutingManifest } = await import('../../packages/scheduler/src/watchdog/routing.js')
    validateRoutingManifest(routing)
    resultLine('selftest', { verdict: 'PASS', checks: ['jobs.json canonical shape', 'auth config 0600/0700 + allowlist', 'routing manifest shape'] })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const args = process.argv.slice(2)
const rootArg = args.includes('--root') ? args[args.indexOf('--root') + 1] : undefined
if (args.includes('--selftest')) await selftest()
else if (args.includes('--full')) await runFull()
else if (args.includes('--phase')) {
  if (!rootArg) { process.stderr.write('--phase requires --root <dir>\n'); process.exit(2) }
  await runPhase(rootArg, Number(args[args.indexOf('--phase') + 1]))
} else {
  process.stderr.write('usage: release-startup-closure.mjs --full | --phase 1|2 --root <dir> | --selftest\n')
  process.exit(2)
}
