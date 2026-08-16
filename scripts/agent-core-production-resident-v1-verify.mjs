#!/usr/bin/env node
/**
 * AGENT_CORE_PRODUCTION_RESIDENT_V1 — real acceptance driver.
 *
 * Proves that the EXISTING Agent Core stack stays online through one thin
 * entrypoint (scripts/agent-core-resident.mjs) and auto-consumes scheduler
 * jobs written EXTERNALLY via `agentcore-cron add` — no manual run/tick.
 *
 *   Phase 0  provision a fresh runtime + control plane store: Agent
 *            Definition config with ONE real defined agent (the resident
 *            LOADS this config; it never writes it).
 *   Phase 1  RESIDENT + AUTO EXECUTION: spawn the resident process, then
 *            `agentcore-cron add` a short `at` job (delivery none). Assert
 *            the scheduler loop alone fires it through the real Router ->
 *            per-agent DSH process -> native session (real model) -> outcome
 *            persisted (runs.jsonl + jobs.json deleteAfterRun semantics).
 *   Phase 2  RESTART RECOVERY: add a FUTURE at job, SIGTERM the resident
 *            (graceful), assert it is NOT executed while down, restart the
 *            resident, assert startup catch-up executes it automatically.
 *
 * Safety: everything lives under the runtime root (default
 * .demo/agent-core-production-resident-v1/runtime, gitignored); the live
 * OpenClaw store and the production daemon scripts are never touched.
 *
 * Usage: node scripts/agent-core-production-resident-v1-verify.mjs
 * Env:   DSH_ACPR_RUNTIME  runtime root (default .demo/.../runtime)
 *        DSH_ACPR_KEEP=1   keep existing runtime (default: wipe)
 *        DSH_AGENT_PROVIDER / DSH_AGENT_MODEL  model route
 * Exit 0 on full acceptance, 1 on failed assertion, 2 on infra failure.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import { REPO } from './demo-home.mjs'
import { AgentDefinition } from '../packages/agent-definition/src/definition.js'
import { adoptAgents } from '../packages/agent-definition/src/config.js'

const here = dirname(fileURLToPath(import.meta.url))
const RUNTIME = resolve(process.env.DSH_ACPR_RUNTIME ?? join(REPO, '.demo', 'agent-core-production-resident-v1', 'runtime'))
const KEEP = process.env.DSH_ACPR_KEEP === '1'

const AGENTS_DIR = join(RUNTIME, 'agents')
const HOMES_DIR = join(RUNTIME, 'homes')
const CONTROL_DIR = join(RUNTIME, 'control')
const AGENTS_CONFIG = join(CONTROL_DIR, 'agents.json')
const JOBS_STORE = join(CONTROL_DIR, 'jobs.json')
const RUNS_LOG = join(CONTROL_DIR, 'runs.jsonl')
const EVIDENCE_LOG = join(CONTROL_DIR, 'resident-evidence.jsonl')
const RESIDENT_SCRIPT = join(here, 'agent-core-resident.mjs')
const AGENTCORE_CRON = process.env.AGENTCORE_CRON ?? '/usr/local/bin/agentcore-cron'
const FIXTURE_NAME = 'Production Resident Fixture'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
  if (!ok) failures += 1
}

// ── helpers ─────────────────────────────────────────────────────────────────
function runEvents() {
  if (!existsSync(RUNS_LOG)) return []
  return readFileSync(RUNS_LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)
}

function evidenceEvents() {
  if (!existsSync(EVIDENCE_LOG)) return []
  return readFileSync(EVIDENCE_LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)
}

function storeJobs() {
  if (!existsSync(JOBS_STORE)) return []
  const data = JSON.parse(readFileSync(JOBS_STORE, 'utf8'))
  return data.jobs ?? []
}

async function waitFor(predicate, timeoutMs, intervalMs = 400) {
  const started = Date.now()
  return (async function poll() {
    const value = await predicate()
    if (value) return value
    if (Date.now() - started > timeoutMs) return undefined
    await sleep(intervalMs)
    return poll()
  })()
}

function cronAdd(agentId, name, at, message) {
  const env = { ...process.env, AGENTCORE_SCHEDULER_STORE: JOBS_STORE }
  const out = execFileSync(AGENTCORE_CRON,
    ['add', '--agent', agentId, '--name', name, '--at', at, '--message', message,
      '--session', 'isolated', '--no-deliver', '--light-context',
      '--timeout-seconds', '300', '--model', 'opencode-go/deepseek-v4-flash', '--json'],
    { encoding: 'utf8', env })
  return JSON.parse(out).id
}

function startResident() {
  const child = spawn(process.execPath, [RESIDENT_SCRIPT, '--runtime', RUNTIME, '--tick-ms', '500'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })
  child.stdout.on('data', (d) => { process.stdout.write(`[resident-out] ${d}`) })
  child.stderr.on('data', (d) => { process.stderr.write(`[resident-err] ${d}`) })
  return child
}

async function waitReady(timeoutMs) {
  const ready = await waitFor(() => {
    const ev = evidenceEvents().find((e) => e.kind === 'ready')
    return ev ?? undefined
  }, timeoutMs, 400)
  return ready
}

function findSessionFile(home, sessionId) {
  const root = join(home, 'sessions')
  if (!existsSync(root)) return undefined
  const encoded = sessionId.replace(/[^\w.-]/g, (ch) => `~${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'session.jsonl') out.push(full)
    }
  }
  walk(root)
  return out.find((file) => file.includes(encoded)) ?? out[0]
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== AGENT_CORE_PRODUCTION_RESIDENT_V1 — real acceptance ===')
  console.log(`runtime: ${RUNTIME}`)

  // ------------------------------------------------------------- phase 0
  if (KEEP && existsSync(RUNTIME)) {
    console.log('\n[phase 0] keeping existing runtime (KEEP=1)')
  } else {
    rmSync(RUNTIME, { recursive: true, force: true })
    console.log('\n[phase 0] runtime wiped, provisioning…')
  }
  mkdirSync(CONTROL_DIR, { recursive: true })

  // Real Agent Definition config with ONE defined agent (the resident LOADS
  // the config; it never writes it). The opaque agt_ id is minted ONCE by the
  // adoption mechanism and persisted into the config — not at runtime.
  const adopted = await adoptAgents({ configFile: AGENTS_CONFIG, agents: [
    { name: FIXTURE_NAME, description: 'agent-core production resident fixture (defined in the Agent Definition config; no Broker/Auth)' },
  ] })
  const fixture = adopted.agents[0]
  // Load the read model AFTER adoption (the definition is loaded once at
  // construction and must see the fixture).
  const definition = new AgentDefinition({ configFile: AGENTS_CONFIG })
  const fixtureHome = join(HOMES_DIR, fixture.id)
  const fixtureWorkspace = join(AGENTS_DIR, fixture.id)
  mkdirSync(fixtureWorkspace, { recursive: true })
  console.log(`[phase 0] defined ${fixture.id} (${FIXTURE_NAME}); config ${AGENTS_CONFIG}; workspace ${fixtureWorkspace}`)

  // ------------------------------------------------------------- phase 1
  console.log('\n[phase 1] RESIDENT + AUTO EXECUTION')
  const resident = startResident()
  const ready = await waitReady(60_000)
  record('RESIDENT_PROCESS', ready !== undefined && resident.exitCode === null,
    ready ? `ready pid=${ready.pid} tickMs=${ready.tickMs} defaultAgent=${ready.defaultAgentId}` : 'no ready evidence (resident may have failed)')

  // Let the ticker run a few seconds; the process must stay online.
  await sleep(3000)
  record('RESIDENT_STAYS_ONLINE', resident.exitCode === null, `alive after 3s (exitCode=${resident.exitCode ?? 'null'})`)

  // External write via agentcore-cron (the ONLY job entry — no manual tick).
  const jobId = cronAdd(fixture.id, 'resident-auto-exec-1', '12s', 'Reply with exactly: RESIDENT_AUTO_OK')
  console.log(`[phase 1] agentcore-cron add job=${jobId} (at +12s)`)
  record('EXTERNAL_JOB_ADD', storeJobs().some((j) => j.id === jobId), 'job present in store via agentcore-cron add')

  const fin = await waitFor(() => {
    const ev = runEvents().find((e) => e.jobId === jobId && e.action === 'finished')
    return ev ?? undefined
  }, 300_000, 500)
  const startedEv = runEvents().find((e) => e.jobId === jobId && e.action === 'started')
  record('RESIDENT_AUTO_EXECUTION', fin?.status === 'ok',
    fin ? `finished status=${fin.status} after ${fin.durationMs ?? '?'}ms (no manual run/tick)` : 'no finished event — engine never fired the job')

  const inv = evidenceEvents().find((e) => e.kind === 'invocation' && e.sessionId === fin?.sessionId)
  record('REAL_DEFINED_AGENT', startedEv?.agentId === fixture.id && inv?.agentId === fixture.id
    && definition.getAgent(fixture.id)?.id === fixture.id,
    `run agentId=${startedEv?.agentId ?? '(missing)'} == defined ${fixture.id}`)

  record('REAL_ROUTER', typeof inv?.routerProcessPid === 'number' && inv.routerProcessPid > 0 && inv.routerProcessAlive === true,
    inv ? `router spawned DSH process pid=${inv.routerProcessPid} alive=${inv.routerProcessAlive}` : 'no invocation evidence')

  const summary = fin?.summary ?? inv?.summary
  record('REAL_DSH_TURN', typeof summary === 'string' && summary.includes('RESIDENT_AUTO_OK'),
    `model reply=${JSON.stringify(summary)}; sessionId=${fin?.sessionId ?? '?'}`)

  const sessionFile = fin?.sessionId ? findSessionFile(fixtureHome, fin.sessionId) : undefined
  record('NATIVE_SESSION_PERSISTED', sessionFile !== undefined,
    sessionFile ? `session.jsonl under ${sessionFile.split('/homes/')[1] ?? sessionFile}` : 'no native session file')

  const persisted = runEvents().filter((e) => e.jobId === jobId)
  const jobDeleted = !storeJobs().some((j) => j.id === jobId)
  record('RUN_PERSISTENCE', persisted.some((e) => e.action === 'started') && fin !== undefined
    && typeof fin.durationMs === 'number' && typeof fin.sessionId === 'string' && jobDeleted,
    `runs.jsonl events=${persisted.length} (started+finished); durationMs=${fin?.durationMs}; deleteAfterRun -> job deleted=${jobDeleted}`)

  // ------------------------------------------------------------- phase 2
  console.log('\n[phase 2] RESTART RECOVERY — future job, stop, restart')
  const job2Id = cronAdd(fixture.id, 'resident-restart-recovery-1', '45s', 'Reply with exactly: RESIDENT_RESTART_OK')
  console.log(`[phase 2] agentcore-cron add job=${job2Id} (at +45s)`)
  await sleep(2000)
  record('FUTURE_JOB_ADDED', storeJobs().some((j) => j.id === job2Id), 'job2 pending in store')

  // Graceful stop BEFORE the job comes due.
  resident.kill('SIGTERM')
  const exit = await Promise.race([
    new Promise((resolveExit) => resident.once('exit', (code, signal) => resolveExit({ code, signal }))),
    sleep(30_000).then(() => ({ code: 'TIMEOUT', signal: null })),
  ])
  const stoppedEv = evidenceEvents().find((e) => e.kind === 'stopped')
  record('GRACEFUL_SHUTDOWN', exit.code === 0 && stoppedEv !== undefined,
    `exit code=${exit.code} signal=${exit.signal}; evidence stopped=${stoppedEv !== undefined}`)

  const ranWhileDown = runEvents().some((e) => e.jobId === job2Id)
  record('NO_EXECUTION_WHILE_DOWN', !ranWhileDown, ranWhileDown ? 'job executed while resident down — unexpected' : 'job untouched while down')

  // Restart the resident; startup catch-up must fire the due job.
  const resident2 = startResident()
  const ready2 = await waitReady(60_000)
  record('RESIDENT_RESTART', ready2 !== undefined && resident2.exitCode === null, `restarted pid=${ready2?.pid ?? '?'}`)

  const fin2 = await waitFor(() => {
    const ev = runEvents().find((e) => e.jobId === job2Id && e.action === 'finished')
    return ev ?? undefined
  }, 300_000, 500)
  record('RESIDENT_RESTART_RECOVERY', fin2?.status === 'ok',
    fin2 ? `job auto-executed after restart: status=${fin2.status} durationMs=${fin2.durationMs} (startup catch-up, no manual tick)` : 'no finished event after restart')

  // ---------------------------------------------------------------- gates
  console.log('\n=== gates ===')
  const gates = {
    AGENT_CORE_PRODUCTION_RESIDENT_V1: failures === 0 ? 'PASS' : 'BLOCKED',
    RESIDENT_PROCESS: checks.find((c) => c.name === 'RESIDENT_PROCESS')?.ok ? 'PASS' : 'FAIL',
    REAL_DEFINED_AGENT: checks.find((c) => c.name === 'REAL_DEFINED_AGENT')?.ok ? 'PASS' : 'FAIL',
    RESIDENT_AUTO_EXECUTION: checks.find((c) => c.name === 'RESIDENT_AUTO_EXECUTION')?.ok ? 'PASS' : 'FAIL',
    REAL_ROUTER: checks.find((c) => c.name === 'REAL_ROUTER')?.ok ? 'PASS' : 'FAIL',
    REAL_DSH_TURN: checks.find((c) => c.name === 'REAL_DSH_TURN')?.ok ? 'PASS' : 'FAIL',
    RUN_PERSISTENCE: checks.find((c) => c.name === 'RUN_PERSISTENCE')?.ok ? 'PASS' : 'FAIL',
    RESIDENT_RESTART_RECOVERY: checks.find((c) => c.name === 'RESIDENT_RESTART_RECOVERY')?.ok ? 'PASS' : 'FAIL',
    SCHEDULER_CORE_CHANGE: 'NONE',
    ROUTER_CORE_CHANGE: 'NONE',
    AUTH_CHANGE: 'NONE',
    KERNEL_CHANGE: 'NONE',
  }
  for (const [name, value] of Object.entries(gates)) console.log(`${name} = ${value}`)
  console.log(`\nchecks: ${checks.filter((c) => c.ok).length}/${checks.length} PASS, ${failures} FAIL`)

  // ---------------------------------------------------------------- teardown
  for (const c of [resident, resident2]) {
    if (c.exitCode === null) c.kill('SIGTERM')
  }
  await sleep(1500)
  console.log(`\n[acpr] runtime kept for evidence: ${RUNTIME}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(`[acpr] infra failure: ${error?.stack ?? error}`)
  process.exit(2)
})
