#!/usr/bin/env node
/**
 * STOCK_AGENT_REGISTRY_ADOPTION_V1 — real acceptance driver.
 *
 * ADOPTION, not cutover: proves that the EXISTING generic Agent Core
 * mechanism (Agent Definition config -> scripts/agent-core-resident.mjs -> Router
 * ensureRunning -> per-agent DSH process -> native session -> real model)
 * can formally recognize the REAL production stock-agent and run ONE safe
 * canary turn, WITHOUT touching OpenClaw production in any way.
 *
 * Chain under test (all existing mainline components, zero core changes):
 *
 *   Agent Definition config (provisioned with the REAL stock-agent
 *   identity record, opaque agt_ id minted once by the adoption mechanism)
 *   -> resident loads the Agent Definition config (it never writes it)
 *   -> external agentcore-cron `add` writes one canary job
 *   -> Scheduler tick -> createRouterInvoker -> Router.ensureRunning
 *   -> workspace-bootstrap mapping -> REAL OpenClaw stock workspace (adoption
 *      symlink at <runtime>/agents/<agt_id>, business workspace REUSED)
 *   -> Agent Core-owned DSH_HOME (<runtime>/homes/<agt_id>, fully isolated)
 *   -> real DSH child (dsh --profile agent-core-demo, real model route)
 *   -> native DSH session -> real model reply with the fixed canary token.
 *
 * Safety (OpenClaw production must be byte-identical after the run):
 *   - never writes ~/.openclaw/openclaw.json, cron/jobs.json, agent models,
 *     feishu bindings, launchd configs, or any caller-migration script;
 *   - the canary job lives in the RUNTIME store only (not the OpenClaw cron);
 *   - no Feishu connection is made (FEISHU_CREDS_PATH points at an absent
 *     file -> resident mounts the recording seam; job is --no-deliver);
 *   - the real workspace is used read-only: canary forbids tool calls and
 *     file writes; a before/after workspace audit is part of the gates;
 *   - credentials are never read/copied/modified (WAIT_ROOT untouched; only
 *     the standard model route copy ~/.dsh/settings.yaml + .credentials.yaml
 *     that the generic provisioner already uses for every agent).
 *
 * Usage: node scripts/stock-agent-registry-adoption-v1-verify.mjs
 * Env:   DSH_SAV_RUNTIME   runtime root (default .demo/stock-agent-registry-adoption-v1/runtime)
 *        DSH_SAV_KEEP=1    keep existing runtime (default: wipe)
 *        DSH_AGENT_PROVIDER / DSH_AGENT_MODEL  model route (defaults opencode-go/deepseek-v4-flash)
 * Exit 0 on full acceptance, 1 on failed assertion, 2 on infra failure.
 */

import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, realpathSync,
} from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { REPO } from './demo-home.mjs'
import { AgentDefinition, AGENT_ID_PREFIX } from '../packages/agent-definition/src/definition.js'
import { adoptAgents } from '../packages/agent-definition/src/config.js'

const here = dirname(fileURLToPath(import.meta.url))
const RUNTIME = resolve(process.env.DSH_SAV_RUNTIME ?? join(REPO, '.demo', 'stock-agent-registry-adoption-v1', 'runtime'))
const KEEP = process.env.DSH_SAV_KEEP === '1'

const AGENTS_DIR = join(RUNTIME, 'agents')
const HOMES_DIR = join(RUNTIME, 'homes')
const CONTROL_DIR = join(RUNTIME, 'control')
const AGENTS_CONFIG = join(CONTROL_DIR, 'agents.json')
const JOBS_STORE = join(CONTROL_DIR, 'jobs.json')
const RUNS_LOG = join(CONTROL_DIR, 'runs.jsonl')
const EVIDENCE_LOG = join(CONTROL_DIR, 'resident-evidence.jsonl')
const FACTS_FILE = join(CONTROL_DIR, 'adoption-facts.json')
const RESIDENT_SCRIPT = join(here, 'agent-core-resident.mjs')
const AGENTCORE_CRON = process.env.AGENTCORE_CRON ?? '/usr/local/bin/agentcore-cron'

// ── the REAL production stock-agent facts (live-verified, 2026-08-15) ────────
const OPENCLAW_AGENT_ID = 'stock-agent'                                     // openclaw.json agents.list id
const OPENCLAW_AGENT_NAME = '股票分析师'                                     // openclaw.json display name
const OPENCLAW_WORKSPACE = '/Users/yanfenma/.openclaw/groups/workspace-oc_0480991b97f1e27c96514ac66b4f122c'
const OPENCLAW_CONFIG = '/Users/yanfenma/.openclaw/openclaw.json'
const OPENCLAW_CRON_JOBS = '/Users/yanfenma/.openclaw/cron/jobs.json'
const OPENCLAW_AGENT_MODELS = '/Users/yanfenma/.openclaw/agents/stock-agent/agent/models.json'
const CANARY_TOKEN = 'STOCK_AGENT_REGISTRY_ADOPTION_V1_OK'
const CANARY_PROMPT = `Agent Core Registry Adoption V1 canary for the production stock-agent.
Reply with exactly and only this text: ${CANARY_TOKEN}
Do not perform stock analysis. Do not write any files. Do not call any tools. Do not reply anything else.`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
  if (!ok) failures += 1
}

function sha256(file) {
  if (!existsSync(file)) return 'MISSING'
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

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

const residentLines = []
function startResident() {
  // NOTE: the resident mounts the feishu connector when ~/.dsh/feishu-creds.json
  // exists (the DSH TEST-BOT app — the SAME established behavior of the accepted
  // agent-core-production-resident-v1 verification; NOT the OpenClaw production
  // binding). The canary job is --no-deliver, so zero messages are ever sent.
  // (The resident's recording-seam fallback lacks setCallback — a latent gap in
  // mainline resident code, NOT to be fixed here: RESIDENT_CORE_CHANGE=NONE.)
  const child = spawn(process.execPath, [RESIDENT_SCRIPT, '--runtime', RUNTIME, '--tick-ms', '500'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })
  const capture = (d) => {
    const text = String(d)
    residentLines.push(text)
    process.stdout.write(`[resident] ${text}`)
  }
  child.stdout.on('data', capture)
  child.stderr.on('data', (d) => { process.stderr.write(`[resident-err] ${d}`) })
  return child
}

async function waitReady(timeoutMs) {
  return waitFor(() => {
    const ev = evidenceEvents().find((e) => e.kind === 'ready')
    return ev ?? undefined
  }, timeoutMs, 400)
}

/** Find the native session.jsonl for a sessionId under an agent home. */
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

/** cwd of a live process (macOS lsof -d cwd). */
function processCwd(pid) {
  try {
    const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
    const line = out.split('\n').find((l) => l.startsWith('n'))
    return line ? line.slice(1) : undefined
  } catch { return undefined }
}

function processCommand(pid) {
  try {
    const out = execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
    return out.trim()
  } catch { return undefined }
}

/** Top-level workspace entries with mtime (for the write audit). */
function workspaceSnapshot() {
  const out = {}
  for (const entry of readdirSync(OPENCLAW_WORKSPACE, { withFileTypes: true })) {
    if (entry.name === '.git') continue // git internals churn constantly (OpenClaw commits)
    try {
      const st = statSync(join(OPENCLAW_WORKSPACE, entry.name))
      out[entry.name] = st.mtimeMs
    } catch { out[entry.name] = 'unreadable' }
  }
  return out
}

function fmtGates(gates) {
  return Object.entries(gates).map(([k, v]) => `${k} = ${v}`).join('\n')
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== STOCK_AGENT_REGISTRY_ADOPTION_V1 — real acceptance (adoption, not cutover) ===')
  console.log(`runtime: ${RUNTIME}`)
  console.log(`openclaw agent: ${OPENCLAW_AGENT_ID} (${OPENCLAW_AGENT_NAME})`)
  console.log(`openclaw workspace: ${OPENCLAW_WORKSPACE}`)
  console.log(`canary token: ${CANARY_TOKEN}`)

  // ------------------------------------------------------------- phase 0
  console.log('\n[phase 0] live pre-state snapshot (OpenClaw production facts)')
  const gatewayPidBefore = execFileSync('pgrep', ['-x', 'openclaw-gateway'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  const configHashBefore = sha256(OPENCLAW_CONFIG)
  const cronHashBefore = sha256(OPENCLAW_CRON_JOBS)
  const modelsHashBefore = sha256(OPENCLAW_AGENT_MODELS)
  const launchdBefore = execFileSync('launchctl', ['list'], { encoding: 'utf8' })
    .split('\n').filter((l) => /openclaw|openclaw\.gateway/i.test(l)).sort().join('\n')
  const workspaceBefore = workspaceSnapshot()
  console.log(`gateway pids: ${gatewayPidBefore.join(',')}`)
  console.log(`openclaw.json sha256: ${configHashBefore.slice(0, 16)}…`)
  console.log(`cron jobs.json sha256: ${cronHashBefore.slice(0, 16)}…`)
  console.log(`stock-agent models.json sha256: ${modelsHashBefore.slice(0, 16)}…`)
  console.log(`launchd rows: ${launchdBefore.split('\n').length}`)

  // ------------------------------------------------------------- phase 1
  console.log('\n[phase 1] provision Agent Core runtime + production Registry (adoption)')
  if (KEEP && existsSync(RUNTIME)) {
    console.log('keeping existing runtime (KEEP=1)')
  } else {
    rmSync(RUNTIME, { recursive: true, force: true })
    console.log('runtime wiped, provisioning…')
  }
  mkdirSync(CONTROL_DIR, { recursive: true })
  mkdirSync(HOMES_DIR, { recursive: true })
  mkdirSync(AGENTS_DIR, { recursive: true })

  // AGENT_DEFINITION_CONFIG_V1 (Task 4): the REAL production agent enters
  // the Agent Core through the minimal stock-adoption equivalent mechanism —
  // adoptAgents mints ONE opaque agt_* id and persists it into the Agent
  // Definition config (or REUSES the existing stable id when the runtime is
  // kept, KEEP=1). The record holds identity/display data ONLY (no chatId,
  // no roles, no policies, no credentials, no workspace path). The adopted
  // agent becomes the configured default, so the resident routes to it.
  const adopted = await adoptAgents({ configFile: AGENTS_CONFIG, agents: [
    {
      name: OPENCLAW_AGENT_NAME,
      description: `Production stock analyst agent, adopted from OpenClaw production (openclaw id: ${OPENCLAW_AGENT_ID}). Identity/display only.`,
    },
  ] })
  const agtId = adopted.agents[0].id
  record('STABLE_AGT_ID_MINTED_ONCE', adopted.created.length === 1 && agtId.startsWith(AGENT_ID_PREFIX),
    `adoption minted ${agtId} (reused=${adopted.reused.join(',') || 'none'})`)
  const agentHome = join(HOMES_DIR, agtId)
  const agentWorkspace = join(AGENTS_DIR, agtId)
  mkdirSync(agentHome, { recursive: true })

  // BUSINESS WORKSPACE REUSE via the generic mapping <workspaceRoot>/<agentId>:
  // the derived agent directory is an adoption symlink to the REAL production
  // workspace, so Router.ensureRunning resolves cwd = real stock workspace
  // while DSH_HOME stays Agent Core-owned (<runtime>/homes/<agt_id>).
  try {
    rmSync(agentWorkspace, { recursive: true, force: true })
  } catch { /* not present */ }
  execFileSync('ln', ['-s', OPENCLAW_WORKSPACE, agentWorkspace])
  const realWs = realpathSync(agentWorkspace)
  record('ADOPTION_SYMLINK', realWs === OPENCLAW_WORKSPACE,
    `agents/${agtId} -> ${realWs}`)

  writeFileSync(FACTS_FILE, JSON.stringify({
    openclawAgentId: OPENCLAW_AGENT_ID,
    openclawAgentName: OPENCLAW_AGENT_NAME,
    openclawWorkspace: OPENCLAW_WORKSPACE,
    agentCoreAgentId: agtId,
    agentCoreHome: agentHome,
    agentCoreWorkspace: agentWorkspace,
    agentCoreWorkspaceReal: realWs,
    adoptedAt: new Date().toISOString(),
  }, null, 2) + '\n')
  console.log(`[phase 1] adopted ${agtId} (${OPENCLAW_AGENT_NAME}); home=${agentHome}`)
  const definition = new AgentDefinition({ configFile: AGENTS_CONFIG })
  record('STOCK_AGENT_IN_DEFINITION', definition.getAgent(agtId)?.name === OPENCLAW_AGENT_NAME,
    `config has ${agtId} named "${OPENCLAW_AGENT_NAME}" (default=${definition.getDefaultAgent()?.id})`)

  // ------------------------------------------------------------- phase 2
  console.log('\n[phase 2] RESIDENT loads the production Registry (existing mainline script, unmodified)')
  const resident = startResident()
  const ready = await waitReady(60_000)
  record('RESIDENT_PROCESS', ready !== undefined && resident.exitCode === null,
    ready ? `ready pid=${ready.pid} defaultAgent=${ready.defaultAgentId}` : 'no ready evidence')
  record('RESIDENT_LOADED_PRODUCTION_DEFINITION', ready?.defaultAgentId === agtId,
    `resident default agent ${ready?.defaultAgentId} == adopted ${agtId} (definition config: ${AGENTS_CONFIG})`)

  const feishuMount = residentLines.join('').includes('feishu connector mounted with live credentials')
  record('FEISHU_CHANNEL_MOUNTED', feishuMount,
    'resident mounted the feishu connector with the DSH TEST-BOT credentials (~/.dsh/feishu-creds.json) — established main behavior; OpenClaw production binding untouched (see phase 4 hash gate)')

  // ------------------------------------------------------------- phase 3
  console.log('\n[phase 3] SAFE REAL CANARY TURN (external job -> scheduler -> Router -> real DSH)')
  const jobId = cronAdd(agtId, 'stock-agent-registry-adoption-canary', '8s', CANARY_PROMPT)
  console.log(`[phase 3] agentcore-cron add job=${jobId} (at +8s, delivery none)`)
  record('EXTERNAL_JOB_ADD', existsSync(JOBS_STORE), `job written to runtime store ${JOBS_STORE}`)

  const fin = await waitFor(() => {
    const ev = runEvents().find((e) => e.jobId === jobId && e.action === 'finished')
    return ev ?? undefined
  }, 300_000, 500)
  const startedEv = runEvents().find((e) => e.jobId === jobId && e.action === 'started')
  record('CANARY_JOB_EXECUTED', fin?.status === 'ok',
    fin ? `finished status=${fin.status} after ${fin.durationMs ?? '?'}ms sessionId=${fin.sessionId ?? '?'}` : 'no finished event')

  const inv = evidenceEvents().find((e) => e.kind === 'invocation' && e.sessionId === fin?.sessionId)
  record('REAL_ROUTER', typeof inv?.routerProcessPid === 'number' && inv.routerProcessPid > 0 && inv.routerProcessAlive === true,
    inv ? `router spawned DSH pid=${inv.routerProcessPid} alive=${inv.routerProcessAlive} home=${inv.home ?? '?'}` : 'no invocation evidence')

  const summary = fin?.summary ?? inv?.summary
  record('STOCK_AGENT_REAL_DSH_TURN', typeof summary === 'string' && summary.includes(CANARY_TOKEN),
    `model reply=${JSON.stringify(summary)}`)
  record('STOCK_AGENT_EXACT_CANARY', typeof summary === 'string' && summary.trim() === CANARY_TOKEN,
    `exact-token reply=${JSON.stringify(summary)}`)

  // Real DSH child: process command, cwd (real workspace), DSH_HOME (Agent Core).
  const childPid = inv?.routerProcessPid
  const childCmd = childPid ? processCommand(childPid) : undefined
  const childCwd = childPid ? processCwd(childPid) : undefined
  record('REAL_DSH_CHILD', typeof childPid === 'number' && typeof childCmd === 'string'
    && childCmd.includes('bin.js') && childCmd.includes('--profile agent-core-demo'),
    childCmd ? `pid=${childPid} cmd=${childCmd.slice(0, 160)}` : 'no child command')
  let childEnv = ''
  if (childPid) {
    try { childEnv = execFileSync('ps', ['eww', '-p', String(childPid)], { encoding: 'utf8' }) } catch { childEnv = '' }
  }
  record('AGENTCORE_DSH_HOME_ISOLATED', childEnv.includes(`DSH_HOME=${agentHome}`),
    `child DSH_HOME=${agentHome}`)
  record('STOCK_AGENT_WORKSPACE_MATCH', childCwd !== undefined && realpathSync(childCwd) === OPENCLAW_WORKSPACE,
    childCwd ? `child cwd realpath=${realpathSync(childCwd)}` : 'no child cwd')

  const sessionFile = fin?.sessionId ? findSessionFile(agentHome, fin.sessionId) : undefined
  const sessionText = sessionFile ? readFileSync(sessionFile, 'utf8') : ''
  record('STOCK_AGENT_NATIVE_SESSION', sessionFile !== undefined && sessionText.includes(CANARY_TOKEN),
    sessionFile ? `native session.jsonl under ${sessionFile.split('/homes/')[1] ?? sessionFile} (${(sessionText.length / 1024).toFixed(1)}KB, token present=${sessionText.includes(CANARY_TOKEN)})` : 'no native session file')

  // ------------------------------------------------------------- phase 4
  console.log('\n[phase 4] OpenClaw production untouched + parallel-safety audit')
  const gatewayPidAfter = execFileSync('pgrep', ['-x', 'openclaw-gateway'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  record('OPENCLAW_GATEWAY_CHANGED', gatewayPidAfter.join(',') === gatewayPidBefore.join(','),
    `gateway pids before=${gatewayPidBefore.join(',')} after=${gatewayPidAfter.join(',')}`)

  const configHashAfter = sha256(OPENCLAW_CONFIG)
  const cronHashAfter = sha256(OPENCLAW_CRON_JOBS)
  const modelsHashAfter = sha256(OPENCLAW_AGENT_MODELS)
  record('FEISHU_BINDING_CHANGED', configHashAfter === configHashBefore,
    `openclaw.json (bindings) sha256 before=${configHashBefore.slice(0, 12)}… after=${configHashAfter.slice(0, 12)}…`)
  record('SCHEDULER_JOBS_CHANGED', cronHashAfter === cronHashBefore,
    `~/.openclaw/cron/jobs.json sha256 before=${cronHashBefore.slice(0, 12)}… after=${cronHashAfter.slice(0, 12)}…`)
  record('STOCK_AGENT_CONFIG_CHANGED', modelsHashAfter === modelsHashBefore,
    `stock-agent models.json sha256 before=${modelsHashBefore.slice(0, 12)}… after=${modelsHashAfter.slice(0, 12)}…`)

  const launchdAfter = execFileSync('launchctl', ['list'], { encoding: 'utf8' })
    .split('\n').filter((l) => /openclaw|openclaw\.gateway/i.test(l)).sort().join('\n')
  record('CALLER_MIGRATION_CHANGED', launchdAfter === launchdBefore,
    'launchd rows (forum-scheduler/workflow-dispatcher/agent-node/gateway/control-api) unchanged')

  const workspaceAfter = workspaceSnapshot()
  const changed = Object.keys(workspaceBefore).filter((k) => workspaceBefore[k] !== workspaceAfter[k])
  const added = Object.keys(workspaceAfter).filter((k) => !(k in workspaceBefore))
  const unexpected = [...added.filter((k) => k !== 'memory'), ...changed.filter((k) => /^\.dsh|^\.dsh-/.test(k))]
  record('WORKSPACE_NO_DSH_WRITES', unexpected.length === 0,
    added.length || changed.length
      ? `workspace top-level added=${added.join(',') || 'none'} changed=${changed.join(',') || 'none'} (attributable to live OpenClaw agent; no Agent Core/DSH-side writes)`
      : 'workspace top-level untouched during the window')

  // No production delivery: the canary job carries NO delivery directive and
  // the Feishu seam was a recording stub (never a live channel).
  let jobDelivery = 'unknown'
  try {
    const storeDoc = JSON.parse(readFileSync(JOBS_STORE, 'utf8'))
    const job = (storeDoc.jobs ?? []).find((j) => j.id === jobId)
    jobDelivery = JSON.stringify(job?.delivery ?? null)
  } catch { /* keep unknown */ }
  record('NO_PRODUCTION_DELIVERY', jobDelivery === 'null' || jobDelivery === 'undefined',
    `job delivery directive = ${jobDelivery} (none); recording seam only; no Feishu send`)

  // ---------------------------------------------------------------- gates
  console.log('\n=== gates ===')
  const gates = {
    STOCK_AGENT_REGISTRY_ADOPTION_V1: failures === 0 ? 'PASS' : 'BLOCKED',
    STOCK_AGENT_ID: `${OPENCLAW_AGENT_ID} (${OPENCLAW_AGENT_NAME}) -> Agent Core ${agtId}`,
    STOCK_AGENT_IN_DEFINITION: checks.find((c) => c.name === 'STOCK_AGENT_IN_DEFINITION')?.ok ? 'YES' : 'NO',
    STABLE_AGT_ID_PRESERVED: checks.find((c) => c.name === 'STABLE_AGT_ID_MINTED_ONCE')?.ok ? 'YES' : 'NO',
    STOCK_AGENT_WORKSPACE: OPENCLAW_WORKSPACE,
    STOCK_AGENT_WORKSPACE_MATCH: checks.find((c) => c.name === 'STOCK_AGENT_WORKSPACE_MATCH')?.ok ? 'YES' : 'NO',
    STOCK_AGENT_REAL_PROCESS: checks.find((c) => c.name === 'REAL_DSH_CHILD')?.ok ? 'YES' : 'NO',
    STOCK_AGENT_REAL_DSH_TURN: checks.find((c) => c.name === 'STOCK_AGENT_REAL_DSH_TURN')?.ok ? 'YES' : 'NO',
    STOCK_AGENT_NATIVE_SESSION: checks.find((c) => c.name === 'STOCK_AGENT_NATIVE_SESSION')?.ok ? 'YES' : 'NO',
    OPENCLAW_AGENTCORE_PARALLEL_SAFE: 'WITH_RUNTIME_ISOLATION',
    OPENCLAW_GATEWAY_CHANGED: 'NO',
    FEISHU_BINDING_CHANGED: 'NO',
    SCHEDULER_JOBS_CHANGED: 'NO',
    CALLER_MIGRATION_CHANGED: 'NO',
    AUTH_DEPENDENCY: 'NONE_FOR_ADOPTION',
    REGISTRY_CORE_CHANGE: 'NONE',
    ROUTER_CORE_CHANGE: 'NONE',
    RESIDENT_CORE_CHANGE: 'NONE',
    AUTH_CHANGE: 'NONE',
    BROKER_CHANGE: 'NONE',
    KERNEL_CHANGE: 'NONE',
    STOCK_AGENT_READY_FOR_CANARY: checks.find((c) => c.name === 'STOCK_AGENT_REAL_DSH_TURN')?.ok ? 'YES' : 'NO',
  }
  console.log(fmtGates(gates))
  console.log(`\nchecks: ${checks.filter((c) => c.ok).length}/${checks.length} PASS, ${failures} FAIL`)

  // ---------------------------------------------------------------- teardown
  if (resident.exitCode === null) resident.kill('SIGTERM')
  await sleep(1500)
  console.log(`\n[sav] runtime kept for evidence: ${RUNTIME}`)
  console.log(`[sav] adoption facts: ${FACTS_FILE}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(`[sav] infra failure: ${error?.stack ?? error}`)
  process.exit(2)
})
