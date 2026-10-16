#!/usr/bin/env node
/**
 * agent-core-resident — the thin Agent Core production resident entrypoint
 * (AGENT_CORE_PRODUCTION_RESIDENT_V1).
 *
 * One process, one job: keep the EXISTING Agent Core composition online so
 * the Scheduler engine consumes jobs written by EXTERNAL callers
 * (`agentcore-cron add` / any JobStore.mutate writer) and executes them
 * through the existing chain:
 *
 *   Scheduler tick → createRouterInvoker → Router.ensureRunning(agentId)
 *   → per-agent DSH process (`dsh --profile agent-core-demo`)
 *   → native session turn (real model) → outcome persisted (jobs.json +
 *   runs.jsonl), delivery via the existing Feishu outbound seam.
 *
 * Composition is EXACTLY the bundle-integration row order (workspace-bootstrap
 * → agentDefinition → feishu connector → agent-router), then the two
 * scheduler-router seams + the Scheduler engine. ZERO new components, ZERO
 * changes to Scheduler core / Router core / Auth / Broker / Kernel.
 *
 * The resident LOADS the Agent Definition config (never writes it) and starts
 * the scheduler loop. External `agentcore-cron add` writes land in the same
 * store under the cross-process lock; the engine's mtime-checked tick picks
 * them up. Startup catch-up replays at-jobs that came due while the process
 * was down (at most once, OpenClaw-equivalent semantics).
 *
 * Usage:
 *   node scripts/agent-core-resident.mjs [--runtime <root>] [--tick-ms N]
 *       [--concurrency N] [--catchup 0|1]
 *
 * Env:
 *   DSH_HARNESS_ROOT       harness checkout (auto-resolved, sibling of repo)
 *   DSH_AGENT_PROVIDER     model provider for spawned agents (default opencode-go)
 *   DSH_AGENT_MODEL        model for spawned agents (default deepseek-v4-flash)
 *   FEISHU_CREDS_PATH      feishu credentials (recording seam when absent)
 *
 * Signals: SIGTERM / SIGINT → graceful stop (scheduler.stop() → dispose
 * control plane) → exit 0. Evidence: one JSON line per lifecycle/invocation
 * event appended to <runtime>/control/resident-evidence.jsonl.
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REPO } from './demo-home.mjs'
import { AgentDefinition } from '../packages/agent-definition/src/definition.js'
import { apply as applyBootstrap } from '../packages/workspace-bootstrap/src/index.js'
import { apply as applyRouter } from '../packages/agent-router/src/index.js'
import { apply as applyFeishu } from '../packages/feishu-connector/src/index.js'
import { Scheduler, JobStore } from '../packages/scheduler/src/index.js'
import { createRouterInvoker, createFeishuDeliver } from '../packages/scheduler-router/src/index.js'

const here = dirname(fileURLToPath(import.meta.url))

// The repo root of a worktree is the worktree itself; the harness checkout
// is a sibling of the MAIN repo. Resolve it robustly for both layouts.
function resolveHarnessRoot() {
  if (process.env.DSH_HARNESS_ROOT) return process.env.DSH_HARNESS_ROOT
  const mainRepo = REPO.split('/.worktree/')[0] ?? REPO
  const candidates = [
    resolve(mainRepo, '../../github/deepseek-harness'),        // main-tree layout
    resolve(REPO, '../../github/deepseek-harness'),            // worktree layout (same repo, one level deeper)
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'apps', 'cli', 'lib', 'bin.js'))) return candidate
  }
  return candidates[0]
}
process.env.DSH_HARNESS_ROOT = resolveHarnessRoot()

// ── CLI surface (thin: runtime root + engine knobs only) ────────────────────
function argValue(args, name, fallback) {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}
const argv = process.argv.slice(2)
const RUNTIME = resolve(argValue(argv, '--runtime',
  join(REPO, '.demo', 'agent-core-production-resident-v1', 'runtime')))
const TICK_MS = Number(argValue(argv, '--tick-ms', '500'))
const CONCURRENCY = Number(argValue(argv, '--concurrency', '2'))
const CATCHUP = argValue(argv, '--catchup', '1') !== '0'

const AGENTS_DIR = join(RUNTIME, 'agents')           // workspace root
const HOMES_DIR = join(RUNTIME, 'homes')             // per-agent DSH_HOME root
const CONTROL_DIR = join(RUNTIME, 'control')
const AGENTS_CONFIG = join(CONTROL_DIR, 'agents.json')
const BINDINGS_STORE = join(CONTROL_DIR, 'bindings.json')
const JOBS_STORE = join(CONTROL_DIR, 'jobs.json')
const RUNS_LOG = join(CONTROL_DIR, 'runs.jsonl')
const EVIDENCE_LOG = join(CONTROL_DIR, 'resident-evidence.jsonl')
const FEISHU_CREDS = process.env.FEISHU_CREDS_PATH ?? join(homedir(), '.dsh', 'feishu-creds.json')
const AGENT_PROFILE = 'agent-core-demo'

const log = {
  info: (...a) => process.stdout.write(`[resident] ${a.join(' ')}\n`),
  warn: (...a) => process.stdout.write(`[resident] WARN ${a.join(' ')}\n`),
  error: (...a) => process.stderr.write(`[resident] ERROR ${a.join(' ')}\n`),
}

function writeEvidence(entry) {
  try {
    mkdirSync(CONTROL_DIR, { recursive: true })
    appendFileSync(EVIDENCE_LOG, `${JSON.stringify({ ...entry, ts: Date.now() })}\n`)
  } catch (error) {
    log.error(`evidence write failed: ${error?.message ?? error}`)
  }
}

/** Fake cordis ctx: get/provide/effect only (what the mounted plugins use). */
function fakeCtx() {
  const services = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name),
    provide: (name, value) => { services.set(name, value) },
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

/** Feishu channel: live connector when credentials exist, recording seam otherwise. */
function mountFeishu(ctx) {
  if (existsSync(FEISHU_CREDS)) {
    const svc = applyFeishu(ctx, { enabled: true, credentialsPath: FEISHU_CREDS })
    log.info(`feishu connector mounted with live credentials (${FEISHU_CREDS})`)
    return svc
  }
  const replies = []
  const svc = {
    replies,
    reply: async (target, text) => {
      const result = { messageId: `om_mock_${replies.length + 1}`, chatId: target.receiveId, method: 'create', code: 0 }
      replies.push({ target, text, result })
      return result
    },
  }
  ctx.provide('feishu', svc)
  log.info(`feishu credentials missing at ${FEISHU_CREDS}; recording seam (announce jobs are recorded, not sent)`)
  return svc
}

async function main() {
  log.info(`runtime=${RUNTIME} tickMs=${TICK_MS} concurrency=${CONCURRENCY} catchup=${CATCHUP}`)
  log.info(`harness=${process.env.DSH_HARNESS_ROOT} profile=${AGENT_PROFILE}`)

  // ── load Agent Definition config (REQUIRED; the resident never writes it) ─
  if (!existsSync(AGENTS_CONFIG)) {
    log.error(`agent definition config missing: ${AGENTS_CONFIG} (provision the runtime first)`)
    process.exit(2)
  }
  mkdirSync(CONTROL_DIR, { recursive: true })
  const ctx = fakeCtx()
  applyBootstrap(ctx, { workspaceRoot: AGENTS_DIR, agentsHome: HOMES_DIR })

  const definitionCore = new AgentDefinition({ configFile: AGENTS_CONFIG })
  const definitionSvc = {
    listAgents: () => definitionCore.listAgents(),
    getAgent: (id) => definitionCore.getAgent(id),
    getDefaultAgent: () => definitionCore.getDefaultAgent(),
    resolveAgentRef: (ref) => definitionCore.resolveAgentRef(ref),
  }
  ctx.provide('agentDefinition', definitionSvc)
  const defaultAgent = definitionSvc.getDefaultAgent()
  if (defaultAgent === undefined) {
    log.error(`agent definition ${AGENTS_CONFIG} has no default agent (nothing to route to)`)
    process.exit(2)
  }
  log.info(`agent definition loaded: ${definitionSvc.listAgents().length} agent(s), default=${defaultAgent.id} (${defaultAgent.name})`)

  // ── control plane (bundle-integration order) ─────────────────────────────
  const feishuService = mountFeishu(ctx)
  const router = applyRouter(ctx, {
    bindingsStoreFile: BINDINGS_STORE,
    defaultAgentId: defaultAgent.id,
    defaultSessionId: 'main',
    agentProfile: AGENT_PROFILE,
  })

  // ── the REAL wiring promised by Scheduler V1 §5/§6 — one line each ───────
  const rawInvoker = createRouterInvoker(router, { definition: definitionSvc })
  const deliver = createFeishuDeliver(feishuService)

  // Observe invocations for the external acceptance driver (thin evidence,
  // not a framework): one line per invocation with the router process state.
  const invoker = async (request) => {
    const started = Date.now()
    const outcome = await rawInvoker(request)
    const proc = router.registrySnapshot().find((p) => p.agentId === request.agentId)
    writeEvidence({
      kind: 'invocation',
      pid: process.pid,
      agentId: request.agentId,
      sessionId: request.sessionId,
      status: outcome.status,
      summary: outcome.status === 'ok' ? (outcome.summary ?? null) : null,
      error: outcome.status === 'error' ? (outcome.error ?? null) : null,
      durationMs: Date.now() - started,
      routerProcessPid: proc?.pid ?? null,
      routerProcessAlive: proc?.alive ?? null,
    })
    return outcome
  }
  invoker.assertRunnable = rawInvoker.assertRunnable

  const store = new JobStore(JOBS_STORE, { runLogPath: RUNS_LOG })
  const scheduler = new Scheduler({
    store,
    invoker,
    deliver,
    tickMs: TICK_MS,
    concurrency: CONCURRENCY,
    log: {
      info: (...a) => log.info(...a),
      warn: (...a) => log.warn(...a),
      error: (...a) => log.error(...a),
    },
  })

  // ── start resident scheduler loop (external writes are picked up by the
  //    mtime-checked tick; startup catch-up replays due-at jobs) ────────────
  await scheduler.start({ autoStart: true, catchup: CATCHUP })
  writeEvidence({ kind: 'ready', pid: process.pid, runtime: RUNTIME, tickMs: TICK_MS, defaultAgentId: defaultAgent.id })
  log.info(`resident ready (pid ${process.pid}); scheduler loop online`)

  // Keep the event loop alive (the scheduler timer is unref'd by design).
  const keepalive = setInterval(() => { /* process must stay online */ }, 60_000)

  // ── graceful shutdown / restart ──────────────────────────────────────────
  let stopping = false
  const shutdown = async (signal) => {
    if (stopping) return
    stopping = true
    log.info(`${signal} received — graceful stop`)
    clearInterval(keepalive)
    try {
      await scheduler.stop()
    } catch (error) {
      log.error(`scheduler.stop failed: ${error?.message ?? error}`)
    }
    try {
      await ctx.disposeAll()
    } catch (error) {
      log.error(`control plane dispose failed: ${error?.message ?? error}`)
    }
    writeEvidence({ kind: 'stopped', pid: process.pid, signal })
    log.info('stopped cleanly')
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((error) => {
  process.stderr.write(`[resident] FATAL ${error?.stack ?? error}\n`)
  process.exit(2)
})
