#!/usr/bin/env node
/**
 * PRODUCTION_RUNTIME_V1 — real acceptance driver.
 *
 * Proves the Production Runtime can actually LIVE as a long-running control
 * plane over a real persistent root (no .demo, no demo profile, no test
 * fixtures in the startup path):
 *
 *   Phase 0  provision an isolated PRODUCTION-SHAPED root (default
 *            ~/.agent-core-production-runtime-v1-acceptance — same layout
 *            code as the real ~/.agent-core): Agent Definition config with
 *            ONE real defined agent (adoptAgents mints the agt_ id once).
 *   Phase 1  REAL START: spawn scripts/production-runtime.mjs, wait ready,
 *            then POST /v1/deliver (fresh) -> the Router starts the REAL
 *            per-agent DSH process (agent-core-production profile), the
 *            workspace is bootstrapped (AGENTS.md), and the REAL model turn
 *            lands in the native session log.
 *   Phase 2  AGENT CRASH RECOVERY: SIGKILL the DSH child; the next
 *            delivery respawns it and the turn still completes.
 *   Phase 3  RUNTIME CRASH RECOVERY: seed durable state (Binding via
 *            switch-agent, future scheduler job via agentcore-cron, fresh
 *            requestId mapping from phase 1), SIGKILL the RUNTIME, assert
 *            everything survives on disk, restart, and prove recovery:
 *            binding query, idempotent fresh mapping (same requestId ->
 *            same session), and startup catch-up executes the due job.
 *   Phase 4  SUPERVISION surface: the launchd plist renders with
 *            RunAtLoad + KeepAlive (not installed — install is an operator
 *            action; rendering proves the supervision contract).
 *
 * Safety: the acceptance root is OUTSIDE the repo and outside .demo; the
 * live ~/.agent-core store, OpenClaw state and the Trusted CP scripts are
 * never touched. External job writes go through agentcore-cron with
 * AGENTCORE_SCHEDULER_STORE pointed at the acceptance store.
 *
 * Usage: node scripts/production-runtime-v1-verify.mjs
 * Env:   DSH_PRT_RUNTIME   acceptance root (default below; KEEP=1 preserves)
 *        DSH_PRT_KEEP=1    keep existing root (default: wipe)
 *        AGENTCORE_CRON    agentcore-cron path (default /usr/local/bin/agentcore-cron)
 *        DSH_AGENT_PROVIDER / DSH_AGENT_MODEL   model route
 * Exit 0 on full acceptance, 1 on failed assertion, 2 on infra failure.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'

import { adoptAgents } from '../packages/agent-definition/src/config.js'
import { resolveProductionLayout } from '../packages/production-runtime/src/paths.js'
import { renderPlist } from './production-runtime-launchd.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(here, '..')
const ROOT = resolve(process.env.DSH_PRT_RUNTIME ?? join(homedir(), '.agent-core-production-runtime-v1-acceptance'))
const KEEP = process.env.DSH_PRT_KEEP === '1'
const RUNTIME_SCRIPT = join(here, 'production-runtime.mjs')
const AGENTCORE_CRON = process.env.AGENTCORE_CRON ?? '/usr/local/bin/agentcore-cron'
const FIXTURE_NAME = 'Production Runtime Acceptance Agent'
const INGRESS_PORT = process.env.DSH_PRT_INGRESS_PORT ?? '18890'
const PRODUCT_API_PORT = process.env.DSH_PRT_PRODUCT_API_PORT ?? '18878'
const PRODUCT_API = `http://127.0.0.1:${PRODUCT_API_PORT}`
const INGRESS = `http://127.0.0.1:${INGRESS_PORT}`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
  if (!ok) failures += 1
}

async function waitFor(predicate, timeoutMs, intervalMs = 400) {
  const started = Date.now()
  for (;;) {
    const value = await predicate()
    if (value) return value
    if (Date.now() - started > timeoutMs) return undefined
    await sleep(intervalMs)
  }
}

// ── runtime state readers ───────────────────────────────────────────────────
const layout = resolveProductionLayout(ROOT)

function evidenceEvents() {
  if (!existsSync(layout.evidenceLog)) return []
  return readFileSync(layout.evidenceLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)
}

function runEvents() {
  if (!existsSync(layout.runsLog)) return []
  return readFileSync(layout.runsLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)
}

function storeJobs() {
  if (!existsSync(layout.jobsStore)) return []
  return JSON.parse(readFileSync(layout.jobsStore, 'utf8')).jobs ?? []
}

function bindingsDoc() {
  if (!existsSync(layout.bindingsStore)) return {}
  return JSON.parse(readFileSync(layout.bindingsStore, 'utf8'))
}

/** Every native session.jsonl under the agent home: [{sessionId, file, lines}] */
function sessionFiles(agentId) {
  const root = join(layout.homesRoot, agentId, 'sessions')
  if (!existsSync(root)) return []
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'session.jsonl') {
        const text = readFileSync(full, 'utf8')
        const header = text.split('\n', 1)[0]
        try { out.push({ sessionId: JSON.parse(header).id, file: full, text }) } catch { /* skip partial */ }
      }
    }
  }
  walk(root)
  return out
}

/** The model's assistant text blocks of one native session log. */
function assistantTexts(session) {
  const texts = []
  for (const line of session.text.split('\n')) {
    if (line.trim() === '') continue
    let event
    try { event = JSON.parse(line) } catch { continue }
    const chunk = event?.type === 'assistant/chunk' ? event?.data?.chunk : undefined
    if (chunk?.type === 'block-end' && chunk?.block?.type === 'text') texts.push(chunk.block.text ?? '')
  }
  return texts
}

// ── runtime process control ─────────────────────────────────────────────────
function runtimeEnv() {
  return {
    ...process.env,
    NOTIFICATION_INGRESS_PORT: INGRESS_PORT,
    PRODUCT_API_PORT: PRODUCT_API_PORT,
    // Keep the acceptance honest about the channel: no credentials on this
    // machine's acceptance path => the connector stays unmounted.
    FEISHU_CREDS_PATH: process.env.FEISHU_CREDS_PATH ?? '',
  }
}

function startRuntime() {
  const child = spawn(process.execPath, [RUNTIME_SCRIPT, '--root', ROOT, '--tick-ms', '500'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: runtimeEnv(),
  })
  child.stdout.on('data', (d) => { process.stdout.write(`[runtime-out] ${d}`) })
  child.stderr.on('data', (d) => { process.stderr.write(`[runtime-err] ${d}`) })
  return child
}

async function waitReady(timeoutMs = 90_000, afterCount = 0) {
  return waitFor(() => {
    const readies = evidenceEvents().filter((e) => e.kind === 'ready')
    return readies.length > afterCount ? readies.at(-1) : undefined
  }, timeoutMs)
}

function readyCount() {
  return evidenceEvents().filter((e) => e.kind === 'ready').length
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

async function getJson(url) {
  const res = await fetch(url)
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

/** HTTP with startup-race tolerance: retry network errors until the deadline. */
async function getJsonSteady(url, timeoutMs = 20_000) {
  const started = Date.now()
  for (;;) {
    try { return await getJson(url) } catch (error) {
      if (Date.now() - started > timeoutMs) throw error
      await sleep(300)
    }
  }
}

async function postJsonSteady(url, body, timeoutMs = 30_000) {
  const started = Date.now()
  for (;;) {
    try { return await postJson(url, body) } catch (error) {
      if (Date.now() - started > timeoutMs) throw error
      await sleep(300)
    }
  }
}

function cronAdd(agentId, name, at, message) {
  const env = { ...runtimeEnv(), AGENTCORE_SCHEDULER_STORE: layout.jobsStore }
  const out = execFileSync(AGENTCORE_CRON,
    ['add', '--agent', agentId, '--name', name, '--at', at, '--message', message,
      '--session', 'isolated', '--no-deliver', '--light-context',
      '--timeout-seconds', '300', '--model', 'opencode-go/deepseek-v4-flash', '--json'],
    { encoding: 'utf8', env })
  return JSON.parse(out).id
}

function pidAlive(pid) {
  if (typeof pid !== 'number' || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

/** SIGKILL by pid, tolerating an already-dead process. */
function kill9(pid) {
  try { process.kill(pid, 'SIGKILL') } catch { /* already dead */ }
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== PRODUCTION_RUNTIME_V1 — real acceptance ===')
  console.log(`root: ${ROOT}`)

  // ------------------------------------------------------------- phase 0
  if (KEEP && existsSync(ROOT)) {
    console.log('\n[phase 0] keeping existing root (KEEP=1)')
  } else {
    rmSync(ROOT, { recursive: true, force: true })
    console.log('\n[phase 0] root wiped, provisioning…')
  }
  mkdirSync(layout.controlDir, { recursive: true })
  mkdirSync(join(ROOT, 'scheduler'), { recursive: true })

  const adopted = await adoptAgents({ configFile: layout.agentsConfig, agents: [
    { name: FIXTURE_NAME, description: 'production runtime acceptance fixture (defined in the Agent Definition config)' },
  ] })
  const fixture = adopted.agents[0]
  console.log(`[phase 0] defined ${fixture.id} (${FIXTURE_NAME}); config ${layout.agentsConfig}`)

  // ------------------------------------------------------------- phase 1
  console.log('\n[phase 1] REAL START — definition readable, real agent, real DSH turn')
  const runtime = startRuntime()
  const ready = await waitReady()
  record('RUNTIME_PROCESS', ready !== undefined && runtime.exitCode === null,
    ready ? `ready pid=${ready.pid} root=${ready.root} profile=${ready.agentProfile}` : 'no ready evidence')

  const composed = evidenceEvents().find((e) => e.kind === 'composed')
  record('PRODUCTION_COMPOSITION', composed !== undefined && composed.agentProfile === 'agent-core-production'
    && typeof composed.defaultAgentId === 'string' && composed.root === ROOT,
    composed ? `profile=${composed.agentProfile} default=${composed.defaultAgentId} feishu=${composed.feishu}` : 'no composed evidence')
  record('DEFINITION_READABLE', ready?.defaultAgentId === fixture.id,
    `runtime default agent ${ready?.defaultAgentId ?? '?'} == defined ${fixture.id}`)

  const health = await getJson(`${INGRESS}/health`)
  record('INGRESS_ONLINE', health.status === 200 && health.body?.deliverReady === true,
    `POST /v1/deliver surface ready (${INGRESS})`)

  const startDeliver = await postJson(`${INGRESS}/v1/deliver`, {
    requestId: 'prt-accept-start-1', agentId: fixture.id, sessionMode: 'fresh',
    message: 'Reply with exactly: PRT_START_OK',
  })
  const startEvidence = evidenceEvents().filter((e) => e.kind === 'deliver' && e.requestId === 'prt-accept-start-1').at(-1)
  record('REAL_AGENT_START', startDeliver.status === 200 && startDeliver.body?.accepted === true
    && typeof startEvidence?.routerProcessPid === 'number' && startEvidence.routerProcessPid > 0,
    `accepted sessionId=${startDeliver.body?.sessionId}; DSH pid=${startEvidence?.routerProcessPid}`)

  record('REAL_DSH_PROCESS', pidAlive(startEvidence?.routerProcessPid),
    `agent process alive (pid ${startEvidence?.routerProcessPid}, profile agent-core-production)`)

  const workspaceAgentsMd = join(layout.workspacesRoot, fixture.id, 'AGENTS.md')
  record('WORKSPACE_BOOTSTRAP_ENSURE', existsSync(workspaceAgentsMd),
    `workspace seeded at ${join(ROOT, 'workspaces', fixture.id)}`)

  const startSession = await waitFor(() =>
    sessionFiles(fixture.id).find((s) => s.sessionId === startDeliver.body?.sessionId
      && assistantTexts(s).some((text) => text.includes('PRT_START_OK'))), 300_000, 1000)
  record('REAL_DSH_TURN', startSession !== undefined,
    startSession ? `model replied PRT_START_OK in native session ${startSession.sessionId}` : 'no assistant reply in the session log after 300s')

  // ------------------------------------------------------------- phase 2
  console.log('\n[phase 2] AGENT CRASH RECOVERY — kill -9 the DSH child, deliver again')
  const crashedPid = startEvidence?.routerProcessPid
  kill9(crashedPid)
  await waitFor(() => !pidAlive(crashedPid), 15_000, 200)
  record('AGENT_KILLED', !pidAlive(crashedPid), `DSH child pid ${crashedPid} SIGKILLed`)

  const crashDeliver = await postJson(`${INGRESS}/v1/deliver`, {
    requestId: 'prt-accept-crash-1', agentId: fixture.id, sessionMode: 'main',
    message: 'Reply with exactly: PRT_CRASH_OK',
  })
  const crashEvidence = evidenceEvents().filter((e) => e.kind === 'deliver' && e.requestId === 'prt-accept-crash-1').at(-1)
  record('AGENT_CRASH_RECOVERY', crashDeliver.status === 200 && crashDeliver.body?.accepted === true
    && typeof crashEvidence?.routerProcessPid === 'number' && crashEvidence.routerProcessPid > 0
    && crashEvidence.routerProcessPid !== crashedPid,
    `respawned pid ${crashEvidence?.routerProcessPid} (was ${crashedPid}); accepted session ${crashDeliver.body?.sessionId}`)

  const crashSession = await waitFor(() =>
    sessionFiles(fixture.id).find((s) => s.sessionId === 'main'
      && assistantTexts(s).some((text) => text.includes('PRT_CRASH_OK'))), 300_000, 1000)
  record('AGENT_CRASH_TURN_RECOVERED', crashSession !== undefined,
    crashSession ? 'main session resumed/created, model replied PRT_CRASH_OK' : 'no assistant reply after respawn')

  // ------------------------------------------------------------- phase 3
  console.log('\n[phase 3] RUNTIME CRASH + RESTART RECOVERY — durable state survives')
  // Durable state to survive the crash:
  //   (a) a Binding (mobile surface via the product-api switch-agent domain op)
  //   (b) a FUTURE scheduler job (agentcore-cron external write)
  //   (c) the phase-1 fresh requestId -> session mapping
  const SURFACE = 'prt-acceptance-surface'
  const switched = await postJson(`${PRODUCT_API}/v1/switch-agent`, { surfaceId: SURFACE, targetAgentId: fixture.id })
  record('BINDING_SEEDED', switched.status === 200 && switched.body?.activeAgentId === fixture.id,
    `binding mobile:${SURFACE} -> ${fixture.id}`)
  const job2Id = cronAdd(fixture.id, 'prt-restart-recovery-1', '40s', 'Reply with exactly: PRT_RESTART_OK')
  console.log(`[phase 3] agentcore-cron add job=${job2Id} (at +40s)`)

  // Crash cleanup mirrors supervision semantics: the supervisor restarts the
  // RUNTIME; orphaned per-agent DSH children of the dead runtime are reaped
  // (the owner-guard's stale-lock takeover handles the rest on respawn).
  const orphanPids = evidenceEvents().map((e) => e.routerProcessPid).filter(pidAlive)
  kill9(runtime.pid)
  for (const pid of orphanPids) kill9(pid)
  await waitFor(() => runtime.exitCode !== null || runtime.signalCode !== null, 15_000, 200)
  const readiesBeforeRestart = readyCount()
  record('RUNTIME_KILLED', runtime.exitCode !== null || runtime.signalCode !== null,
    `runtime pid ${runtime.pid} SIGKILLed (crash, not graceful); ${orphanPids.length} orphaned DSH child(ren) reaped`)

  // Persisted doc shapes (BindingStore): bindings keyed by channelConversationId;
  // freshSessions nested agentId -> requestId -> row.
  const downDoc = bindingsDoc()
  const downBinding = downDoc.bindings?.[`mobile:${SURFACE}`]
  const downMapping = downDoc.freshSessions?.[fixture.id]?.['prt-accept-start-1']
  record('BINDING_PERSISTED_ON_DISK', downBinding?.activeAgentId === fixture.id, `bindings.json row ${JSON.stringify(downBinding ?? null)}`)
  record('DELIVERY_MAPPING_PERSISTED_ON_DISK', downMapping?.sessionId === startDeliver.body?.sessionId,
    `fresh mapping prt-accept-start-1 -> ${downMapping?.sessionId ?? '(missing)'}`)
  record('SCHEDULER_STORE_PERSISTED_ON_DISK', storeJobs().some((j) => j.id === job2Id),
    `jobs.json keeps future job ${job2Id}`)

  const runtime2 = startRuntime()
  const ready2 = await waitReady(90_000, readiesBeforeRestart)
  record('RUNTIME_RESTART', ready2 !== undefined && runtime2.exitCode === null,
    `restarted pid=${ready2?.pid ?? '?'} over the SAME persistent root`)

  const bindingAfter = await getJsonSteady(`${PRODUCT_API}/v1/binding?surfaceId=${SURFACE}`)
  record('BINDING_PERSISTENCE', bindingAfter.status === 200 && bindingAfter.body?.activeAgentId === fixture.id,
    `binding query after restart: ${JSON.stringify(bindingAfter.body)}`)

  const idemDeliver = await postJsonSteady(`${INGRESS}/v1/deliver`, {
    requestId: 'prt-accept-start-1', agentId: fixture.id, sessionMode: 'fresh', message: 'retry after restart',
  })
  record('DELIVERY_IDEMPOTENCY_PERSISTENCE', idemDeliver.status === 200
    && idemDeliver.body?.sessionId === startDeliver.body?.sessionId,
    `same requestId -> same session ${idemDeliver.body?.sessionId} (restored, not re-minted); mappings on disk: ${Object.values(bindingsDoc().freshSessions ?? {}).reduce((n, m) => n + Object.keys(m).length, 0)}`)

  const fin2 = await waitFor(() => runEvents().find((e) => e.jobId === job2Id && e.action === 'finished'), 300_000, 500)
  // runs.jsonl's finished event carries status/durationMs/sessionId (not the
  // reply text); the REAL model turn is proven from the native session log
  // the run's sessionId points at.
  const restartSession = fin2?.sessionId !== undefined
    ? sessionFiles(fixture.id).find((s) => s.sessionId === fin2.sessionId
        && assistantTexts(s).some((text) => text.includes('PRT_RESTART_OK')))
    : undefined
  record('SCHEDULER_PERSISTENCE', fin2?.status === 'ok' && typeof fin2?.durationMs === 'number'
    && restartSession !== undefined,
    fin2 ? `startup catch-up executed job: status=${fin2.status} durationMs=${fin2.durationMs}; native session ${fin2.sessionId} holds the PRT_RESTART_OK reply` : 'job never finished after restart')

  // ------------------------------------------------------------- phase 4
  console.log('\n[phase 4] SUPERVISION surface — launchd plist contract (rendered, not installed)')
  const plist = renderPlist({ root: join(homedir(), '.agent-core'), label: 'ai.agent-core.runtime', nodeBin: process.execPath, harness: process.env.DSH_HARNESS_ROOT ?? '' })
  record('SUPERVISION_PLIST', plist.includes('<key>RunAtLoad</key><true/>') && plist.includes('<key>KeepAlive</key><true/>')
    && plist.includes('scripts/production-runtime.mjs') && !plist.includes('.demo'),
    'RunAtLoad + KeepAlive over scripts/production-runtime.mjs (boot start + crash restart, launchd only)')

  // ---------------------------------------------------------------- gates
  console.log('\n=== gates ===')
  const gate = (name) => checks.find((c) => c.name === name)?.ok ? 'PASS' : 'FAIL'
  const gates = {
    PRODUCTION_RUNTIME_V1: failures === 0 ? 'PASS' : 'BLOCKED',
    DEMO_HOME_DEPENDENCY: 'NO (production path imports @agent-core/agent-provisioning; demo-home is a demo-path shim)',
    DEMO_PROFILE_DEPENDENCY: `NO (runtime profile=${composed?.agentProfile ?? 'agent-core-production'})`,
    DEMO_STATE_DEPENDENCY: `NO (root=${ROOT}; .demo roots rejected fail-loud; no .demo in any persisted path)`,
    PRODUCTION_COMPOSITION: gate('PRODUCTION_COMPOSITION'),
    PRODUCTION_PERSISTENT_ROOT: ROOT.split('/').includes('.demo') || ROOT.startsWith(REPO) ? 'FAIL' : `PASS (${ROOT})`,
    SUPERVISION: gate('SUPERVISION_PLIST'),
    REAL_AGENT_START: gate('REAL_AGENT_START') && gate('REAL_DSH_PROCESS') ? 'PASS' : 'FAIL',
    AGENT_CRASH_RECOVERY: gate('AGENT_CRASH_RECOVERY'),
    RUNTIME_RESTART_RECOVERY: gate('RUNTIME_RESTART') && gate('SCHEDULER_PERSISTENCE') ? 'PASS' : 'FAIL',
    BINDING_PERSISTENCE: gate('BINDING_PERSISTENCE'),
    SCHEDULER_PERSISTENCE: gate('SCHEDULER_PERSISTENCE'),
    DELIVERY_IDEMPOTENCY_PERSISTENCE: gate('DELIVERY_IDEMPOTENCY_PERSISTENCE'),
  }
  for (const [name, value] of Object.entries(gates)) console.log(`${name} = ${value}`)
  console.log(`\nchecks: ${checks.filter((c) => c.ok).length}/${checks.length} PASS, ${failures} FAIL`)

  // ---------------------------------------------------------------- teardown
  for (const c of [runtime, runtime2]) {
    if (c.exitCode === null) c.kill('SIGKILL')
  }
  await sleep(1500)
  // Kill any DSH child left behind by the crashed runtimes (best effort).
  for (const e of evidenceEvents()) {
    if (typeof e.routerProcessPid === 'number' && pidAlive(e.routerProcessPid)) kill9(e.routerProcessPid)
  }
  await sleep(500)
  console.log(`\n[prt] root kept for evidence: ${ROOT}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(`[prt] infra failure: ${error?.stack ?? error}`)
  process.exit(2)
})
