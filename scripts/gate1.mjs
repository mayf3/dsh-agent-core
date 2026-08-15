#!/usr/bin/env node
/**
 * Gate 1 local runtime — ONE thin command for the mobile slice:
 *
 *   Android Emulator -> adb reverse -> localhost Product API -> Router ->
 *   real Agent process -> real DSH
 *
 * Everything this script knows is thin DEV configuration; it owns no
 * production logic (Router / Binding / bookmark / Agent-process / DSH
 * semantics all stay untouched — PRODUCTION_LOGIC_CHANGED = NO). It reuses
 * the proven provisioning path (scripts/demo-home.mjs + the control-plane
 * boot pattern from scripts/product-integration-v1-verify.mjs) and adds only
 * the local orchestration the verification driver did not need.
 *
 * Subcommands:
 *   preflight   answer every Gate 1 readiness question (see below)
 *   start       provision + boot the control plane in the background
 *   health      is the control plane alive / is the Product API port up
 *   smoke       full vertical slice through a REAL per-agent DSH process
 *               and a REAL model turn (in-process Router over the same
 *               stores; requires the control plane to be stopped)
 *   stop        kill the control plane (+ optional adb reverse removal)
 *   adb         adb reverse tcp:<PRODUCT_API_PORT> tcp:<PRODUCT_API_PORT>
 *               (sub: reverse | list | remove)
 *
 * Env (thin dev config, no config system):
 *   DSH_GATE1_RUNTIME            runtime root (default .demo/mobile-gate1-local-runtime-v1/runtime)
 *   PRODUCT_API_PORT             dev placeholder for the T1 Product API port (default 8787)
 *   PRODUCT_API_START_COMMAND    optional external Product API launch command
 *                                (only needed if T1 ships a separate process;
 *                                default: the API mounts inside the control plane)
 *   ROUTER_AGENT_PROFILE         per-agent profile (default agent-core-integration-agent)
 *   GATE1_AGENT_NAME             name of the default Agent registered on first run
 *   GATE1_PREFLIGHT_FAST=1       skip the two real-spawn checks (control-plane
 *                                boot + agent ensureRunning) — static checks only
 *
 * Exit codes: 0 PASS / 1 FAIL / 2 infra error.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readlinkSync,
  rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { REPO, cliBin, dshRoot, provisionAgentHome } from './demo-home.mjs'

/**
 * Resolve DSH_HARNESS_ROOT early (before any cliBin() call): when this repo
 * is checked out as a worktree under `<repo>/.worktree/<name>`, the default
 * sibling path `../../github/deepseek-harness` (relative to the worktree)
 * points at the wrong place — the harness must be resolved from the MAIN
 * checkout instead. Setting the env var makes demo-home.mjs's dshRoot()
 * agree everywhere. The env override always wins.
 */
function resolveDshRoot() {
  if (process.env.DSH_HARNESS_ROOT !== undefined && process.env.DSH_HARNESS_ROOT !== '') return
  const inWorktree = basename(dirname(REPO)) === '.worktree'
  const repoRoot = inWorktree ? resolve(REPO, '../..') : REPO
  const candidate = resolve(repoRoot, '../../github/deepseek-harness')
  if (existsSync(join(candidate, 'apps/cli/lib/bin.js'))) {
    process.env.DSH_HARNESS_ROOT = candidate
  }
}

resolveDshRoot()

// ------------------------------------------------------------------ paths

const RUNTIME = resolve(process.env.DSH_GATE1_RUNTIME ?? join(REPO, '.demo', 'mobile-gate1-local-runtime-v1', 'runtime'))
const CONTROL_HOME = join(RUNTIME, 'control', 'home')
const CONTROL_PROFILE = 'agent-core-integration'
const AGENT_PROFILE = process.env.ROUTER_AGENT_PROFILE ?? 'agent-core-integration-agent'
const REGISTRY_STORE = join(RUNTIME, 'control', 'registry.json')
const BINDINGS_STORE = join(RUNTIME, 'control', 'bindings.json')
const WORKSPACES_ROOT = join(RUNTIME, 'agents', 'workspaces')
const HOMES_ROOT = join(RUNTIME, 'agents', 'homes')
const PID_FILE = join(RUNTIME, 'control.pid')
const LOG_FILE = join(RUNTIME, 'control.log')
const PRODUCT_API_PID_FILE = join(RUNTIME, 'product-api.pid')
const PRODUCT_API_LOG_FILE = join(RUNTIME, 'product-api.log')
const PRODUCT_API_PORT = process.env.PRODUCT_API_PORT ?? '8787'
const PRODUCT_API_START_COMMAND = process.env.PRODUCT_API_START_COMMAND ?? ''
const GATE1_AGENT_NAME = process.env.GATE1_AGENT_NAME ?? 'Gate 1 Dev'
const FAST = process.env.GATE1_PREFLIGHT_FAST === '1'

const sleep = (ms) => new Promise(resolveTimeout => setTimeout(resolveTimeout, ms))

// ------------------------------------------------------------------ utils

const log = (msg) => process.stdout.write(`${msg}\n`)

function ensureSymlink(target, link) {
  mkdirSync(dirname(link), { recursive: true })
  try {
    const stat = lstatSync(link)
    if (stat.isSymbolicLink() && resolve(readlinkSync(link)) === resolve(target)) return
    rmSync(link, { recursive: true, force: true })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  symlinkSync(target, link)
}

function copyOnce(source, target) {
  if (!existsSync(source)) return false
  if (existsSync(target)) return true
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
  return true
}

/** Copy a repo profile dir into a home (additive, never overwrite). */
function provisionProfile(home, profileName, repoProfileDir) {
  const profileDir = join(home, 'profiles', profileName)
  mkdirSync(profileDir, { recursive: true })
  copyOnce(join(repoProfileDir, 'package.json'), join(profileDir, 'package.json'))
  copyOnce(join(repoProfileDir, 'cordis.patch.yml'), join(profileDir, 'cordis.patch.yml'))
}

/** Symlink the control-plane plugin farm into a home (additive). */
function linkFarm(home, entries) {
  const farm = join(home, 'profiles', 'node_modules', '@agent-core')
  for (const [pkg, target] of Object.entries(entries)) {
    ensureSymlink(target, join(farm, pkg))
  }
}

/** The repo-local @deepseek-ai bridge needed for in-process package imports. */
function ensureBridge() {
  const scopeLink = join(REPO, 'node_modules', '@deepseek-ai')
  const dshScope = join(dshRoot(), 'node_modules', '.pnpm', 'node_modules', '@deepseek-ai')
  if (!existsSync(dshScope)) {
    throw new Error(`DSH scope not found at ${dshScope}; set DSH_HARNESS_ROOT to the deepseek-harness checkout`)
  }
  ensureSymlink(dshScope, scopeLink)
}

/**
 * The main dsh-agent-core checkout (when running from a worktree). The
 * control-plane composition includes feishu-connector, whose module imports
 * `@larksuiteoapi/node-sdk` at load time even when FEISHU_ENABLED=0 — a
 * fresh worktree lacks that dependency (node_modules is gitignored), so the
 * plugin tree fails to load. The main checkout usually has it installed.
 */
function mainCheckout() {
  return basename(dirname(REPO)) === '.worktree' ? resolve(REPO, '../..') : REPO
}

/**
 * Ensure the feishu-connector dependency the control-plane composition needs
 * is resolvable: symlink the main checkout's installed copy when present,
 * else `npm install` it in place (node_modules is gitignored — no repo
 * pollution). Fail-loud only when neither works.
 */
function ensureFeishuDeps() {
  const target = join(REPO, 'packages', 'feishu-connector', 'node_modules', '@larksuiteoapi')
  if (existsSync(join(target, 'node-sdk', 'package.json'))) return true
  const mainCopy = join(mainCheckout(), 'packages', 'feishu-connector', 'node_modules', '@larksuiteoapi')
  if (existsSync(join(mainCopy, 'node-sdk', 'package.json'))) {
    ensureSymlink(mainCopy, target)
    log('linked @larksuiteoapi from the main checkout (feishu-connector dep for the control-plane composition)')
    return true
  }
  log('installing feishu-connector dependencies (needed by the control-plane composition)…')
  const install = spawnSync('npm', ['install', '--no-save'], {
    cwd: join(REPO, 'packages', 'feishu-connector'),
    encoding: 'utf8',
  })
  if (install.status !== 0) {
    log(`FAIL: could not install feishu-connector deps: ${(install.stderr ?? '').slice(-300)}`)
    return false
  }
  return true
}

/**
 * Provision the control-plane home exactly like the Product Integration V1
 * driver: base home (settings/credentials) + the integration profile + the
 * control-plane plugin farm. Additive and idempotent.
 */
function provisionControlHome() {
  ensureFeishuDeps()
  provisionAgentHome(CONTROL_HOME, REPO)
  provisionProfile(CONTROL_HOME, CONTROL_PROFILE, join(REPO, 'profile-integration'))
  linkFarm(CONTROL_HOME, {
    'bundle-integration': join(REPO, 'bundle-integration'),
    'feishu-connector': join(REPO, 'packages', 'feishu-connector'),
    'agent-router': join(REPO, 'packages', 'agent-router'),
    'workspace-bootstrap': join(REPO, 'packages', 'workspace-bootstrap'),
    'agent-registry': join(REPO, 'packages', 'agent-registry'),
  })
}

/** Environment for the control-plane process (self-contained runtime roots). */
function controlEnv() {
  return {
    ...process.env,
    DSH_HOME: CONTROL_HOME,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    AGENT_REGISTRY_STORE: REGISTRY_STORE,
    ROUTER_BINDINGS_STORE: BINDINGS_STORE,
    ROUTER_AGENT_PROFILE: AGENT_PROFILE,
    ROUTER_DEFAULT_SESSION: 'main',
    FEISHU_ENABLED: '0',
    DSH_WORKSPACE_DIR: WORKSPACES_ROOT,
    DSH_AGENTS_HOME: HOMES_ROOT,
    DSH_MEMORY_WORKSPACE_ROOT: WORKSPACES_ROOT,
    PRODUCT_API_PORT,
  }
}

/** Is the Product API row part of the current control-plane composition? */
function t1Merged() {
  try {
    const patch = readFileSync(join(REPO, 'bundle-integration', 'cordis.patch.yml'), 'utf8')
    return patch.includes('product-api')
  } catch {
    return false
  }
}

/** Probe the Product API port (thin; the /health path is T1's own surface). */
async function productApiResponds(timeoutMs = 3000) {
  try {
    const res = await fetch(`http://127.0.0.1:${PRODUCT_API_PORT}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Read a pid file, or undefined. */
function readPidFile(file) {
  try {
    const raw = readFileSync(file, 'utf8').trim()
    const pid = Number.parseInt(raw, 10)
    return Number.isFinite(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

/** Is a pid currently alive (and owned by us)? */
function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Kill a detached process group (control plane + its per-agent children). */
function killGroup(pid, signal) {
  try {
    process.kill(-pid, signal)
    return true
  } catch {
    try {
      process.kill(pid, signal)
      return true
    } catch {
      return false
    }
  }
}

// ------------------------------------------------------------ registry

/**
 * Ensure the runtime registry has at least one Agent. Registering a dev
 * Agent is runtime provisioning (a Registry API call), not business logic.
 */
async function ensureDefaultAgent() {
  ensureBridge()
  const { AgentRegistry } = await import('../packages/agent-registry/src/registry.js')
  const registry = new AgentRegistry({ storeFile: REGISTRY_STORE })
  const existing = registry.getDefaultAgent() ?? registry.listAgents()[0]
  if (existing !== undefined) return existing
  const agent = await registry.registerAgent({
    name: GATE1_AGENT_NAME,
    description: 'Gate 1 local runtime default agent (dev)',
  })
  log(`registered default Agent ${agent.id} ("${agent.name}")`)
  return agent
}

/** Fake cordis ctx (get/provide/effect) for in-process router assembly. */
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

/** Assemble an in-process Router over the runtime stores (same as the V1 driver). */
async function inProcessRouter() {
  ensureBridge()
  const { AgentRegistry } = await import('../packages/agent-registry/src/registry.js')
  const { apply: applyBootstrap } = await import('../packages/workspace-bootstrap/src/index.js')
  const { apply: applyRouter } = await import('../packages/agent-router/src/index.js')

  const ctx = fakeCtx()
  applyBootstrap(ctx, { workspaceRoot: WORKSPACES_ROOT, agentsHome: HOMES_ROOT })
  const registry = new AgentRegistry({ storeFile: REGISTRY_STORE })
  ctx.provide('agentRegistry', {
    listAgents: () => registry.listAgents(),
    getAgent: (id) => registry.getAgent(id),
    getDefaultAgent: () => registry.getDefaultAgent(),
    registerAgent: (input) => registry.registerAgent(input),
    updateAgent: (agentId, patch) => registry.updateAgent(agentId, patch),
    setDefaultAgent: (agentId) => registry.setDefaultAgent(agentId),
  })
  const defaultAgent = registry.getDefaultAgent() ?? registry.listAgents()[0]
  if (defaultAgent === undefined) {
    throw new Error('registry has no Agent; run `node scripts/gate1.mjs start` once (or gate1 preflight) to register the default Agent')
  }
  const router = applyRouter(ctx, {
    bindingsStoreFile: BINDINGS_STORE,
    defaultSessionId: 'main',
    defaultAgentId: defaultAgent.id,
    agentProfile: AGENT_PROFILE,
  })
  return { ctx, router }
}

// ---------------------------------------------------------------- preflight

const PREFLIGHT_RESULTS = []

function check(name, ok, detail = '', verdict = ok ? 'PASS' : 'FAIL') {
  PREFLIGHT_RESULTS.push({ name, ok, detail, verdict })
  log(`${verdict}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** A real control-plane boot smoke: mounts the whole composition or fails. */
async function bootControlPlaneSmoke(timeoutMs = 120000) {
  return new Promise((resolvePromise) => {
    provisionControlHome()
    const child = spawn(process.execPath, [cliBin(), '--profile', CONTROL_PROFILE], {
      cwd: REPO,
      env: controlEnv(),
      stdio: ['ignore', 'ignore', 'pipe'],
      detached: true,
    })
    let stderr = ''
    let sawRouterIdle = false
    let exited = false
    let done = false
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (stderr.includes('binding store loaded') && stderr.includes('router idle')) {
        sawRouterIdle = true
        // The plugin tree is still loading (feishu may fail AFTER the
        // router logs idle) — only resolve PASS once the process is still
        // alive a moment later AND no fatal tree error has appeared.
        setTimeout(() => {
          if (done) return
          if (exited || /plugin tree failed to load/.test(stderr)) {
            done = true
            killGroup(child.pid, 'SIGKILL')
            resolvePromise({ ok: false, detail: `control plane failed after router idle: ${stderr.slice(-300)}` })
            return
          }
          done = true
          killGroup(child.pid, 'SIGTERM')
          resolvePromise({ ok: true, detail: `control plane mounted (pid ${child.pid})` })
        }, 1500)
      }
    })
    child.once('exit', () => {
      exited = true
      if (done) return
      done = true
      resolvePromise({ ok: false, detail: `control plane exited early: ${stderr.slice(-300)}` })
    })
    setTimeout(() => {
      if (done) return
      done = true
      killGroup(child.pid, 'SIGKILL')
      resolvePromise({ ok: false, detail: `control plane boot timeout; stderr tail: ${stderr.slice(-300)}` })
    }, timeoutMs)
  })
}

async function runPreflight() {
  log(`=== Gate 1 local runtime preflight — runtime ${RUNTIME}`)
  log(`product-api in composition: ${t1Merged() ? 'yes (T1 merged)' : 'no (WAIT_T1)'}`)
  const controlPid = readPidFile(PID_FILE)
  const controlAlive = controlPid !== undefined && pidAlive(controlPid)
  if (controlAlive) log(`note: control plane already running (pid ${controlPid}); real-spawn checks report on it`)
  log('')

  // 1. Node / runtime ready.
  const nodeOk = process.versions?.node !== undefined
  let cliOk = false
  let cliDetail = ''
  try {
    cliBin()
    cliOk = true
  } catch (error) {
    cliDetail = error.message
  }
  check('NODE_RUNTIME_READY', nodeOk, `node ${process.versions?.node ?? '?'}`)
  check('DSH_CLI_READY', cliOk, cliDetail || 'dsh CLI bin resolved')

  // 2. Registry store readable (missing store = constructible empty store).
  let registryReadable = false
  let registryDetail = ''
  try {
    ensureBridge()
    const { AgentRegistry } = await import('../packages/agent-registry/src/registry.js')
    const registry = new AgentRegistry({ storeFile: REGISTRY_STORE })
    registryReadable = true
    registryDetail = `${registry.listAgents().length} agent(s) at ${REGISTRY_STORE}`
  } catch (error) {
    registryDetail = error.message
  }
  check('REGISTRY_STORE_READABLE', registryReadable, registryDetail)

  // 3. Router runtime startable + 4. DSH profile/runtime ready.
  if (controlAlive) {
    check('ROUTER_RUNTIME_STARTABLE', true, `control plane running (pid ${controlPid})`)
    check('DSH_PROFILE_READY', true, `control profile ${CONTROL_PROFILE} + agent profile ${AGENT_PROFILE}`)
  } else if (FAST) {
    const profilesReady = existsSync(join(REPO, 'profile-integration', 'cordis.patch.yml'))
      && existsSync(join(REPO, 'profile-integration-agent', 'cordis.patch.yml'))
    check('ROUTER_RUNTIME_STARTABLE', profilesReady, 'static profile check only (GATE1_PREFLIGHT_FAST=1)')
    check('DSH_PROFILE_READY', profilesReady, `agent profile: ${AGENT_PROFILE}`)
  } else {
    const boot = await bootControlPlaneSmoke()
    check('ROUTER_RUNTIME_STARTABLE', boot.ok, boot.detail)
    check('DSH_PROFILE_READY', boot.ok, `control profile ${CONTROL_PROFILE} + agent profile ${AGENT_PROFILE}`)
  }

  // 5. At least one real Agent can ensureRunning (real DSH process spawn).
  if (controlAlive) {
    check('AGENT_ENSURERUNNING', true, 'control plane running owns agent processes (see health)')
  } else if (FAST) {
    check('AGENT_ENSURERUNNING', existsSync(join(REPO, 'profile-integration-agent', 'cordis.patch.yml')),
      'static profile check only (GATE1_PREFLIGHT_FAST=1)')
  } else {
    let agentOk = false
    let agentDetail = ''
    try {
      await ensureDefaultAgent()
      const { ctx, router } = await inProcessRouter()
      const { AgentRegistry } = await import('../packages/agent-registry/src/registry.js')
      const registered = new AgentRegistry({ storeFile: REGISTRY_STORE }).getDefaultAgent()
      const proc = await router.ensureRunning(registered.id)
      agentOk = proc.exit === undefined && proc.pid !== undefined
      agentDetail = `agent ${registered.id} spawned pid=${proc.pid} profile=${proc.profile}`
      await ctx.disposeAll()
    } catch (error) {
      agentDetail = error instanceof Error ? error.message : String(error)
    }
    check('AGENT_ENSURERUNNING', agentOk, agentDetail)
  }

  // 6. Product API port ready — T1 is the formal gate.
  if (!t1Merged()) {
    check('PRODUCT_API_PORT', false, `T1 not merged; dev placeholder PRODUCT_API_PORT=${PRODUCT_API_PORT}`
      + (PRODUCT_API_START_COMMAND ? `, PRODUCT_API_START_COMMAND="${PRODUCT_API_START_COMMAND}"` : ''), 'WAIT_T1')
  } else {
    const responding = await productApiResponds()
    check('PRODUCT_API_PORT', responding,
      responding ? `http://127.0.0.1:${PRODUCT_API_PORT}/health responds` : `no listener on :${PRODUCT_API_PORT} (is the control plane running?)`)
  }

  // 7-9. adb / emulator / adb reverse (transport helper only).
  const adbVersion = spawnSync('adb', ['version'], { encoding: 'utf8' })
  const adbOk = adbVersion.status === 0
  check('ADB_PRESENT', adbOk, adbOk ? (adbVersion.stdout?.split('\n')[0] ?? 'adb') : 'adb not on PATH')

  let emulatorSerial = ''
  if (adbOk) {
    const devices = spawnSync('adb', ['devices'], { encoding: 'utf8' })
    const serials = (devices.stdout ?? '')
      .split('\n').slice(1)
      .map(line => line.trim())
      .filter(line => line !== '' && !line.startsWith('*') && line.includes('device'))
      .map(line => line.split(/\s+/)[0])
    emulatorSerial = serials.find(s => s.startsWith('emulator-')) ?? ''
  }
  check('EMULATOR_VISIBLE', emulatorSerial !== '', emulatorSerial !== '' ? emulatorSerial : 'no emulator-* device in `adb devices`')

  if (!adbOk || emulatorSerial === '') {
    check('ADB_REVERSE', false, 'skipped: no adb / no visible emulator', 'SKIP')
  } else {
    const reverse = spawnSync('adb', ['reverse', `tcp:${PRODUCT_API_PORT}`, `tcp:${PRODUCT_API_PORT}`], { encoding: 'utf8' })
    const list = spawnSync('adb', ['reverse', '--list'], { encoding: 'utf8' })
    const mapped = (list.stdout ?? '').includes(`tcp:${PRODUCT_API_PORT}`)
    check('ADB_REVERSE', reverse.status === 0 && mapped,
      `adb reverse tcp:${PRODUCT_API_PORT} tcp:${PRODUCT_API_PORT}${mapped ? ' (mapped)' : ''}`)
  }

  log('')
  const fails = PREFLIGHT_RESULTS.filter(r => r.verdict === 'FAIL')
  const waits = PREFLIGHT_RESULTS.filter(r => r.verdict === 'WAIT_T1')
  if (fails.length > 0) {
    log(`MOBILE_GATE1_LOCAL_RUNTIME_V1 = FAIL (${fails.length} check(s) failed)`)
    return 1
  }
  if (waits.length > 0) {
    log(`MOBILE_GATE1_LOCAL_RUNTIME_V1 = WAIT_T1 (${waits.length} check(s) waiting on T1)`)
    return 0
  }
  log('MOBILE_GATE1_LOCAL_RUNTIME_V1 = PASS')
  return 0
}

// ------------------------------------------------------------------ start

async function runStart() {
  provisionControlHome()
  await ensureDefaultAgent()

  const existing = readPidFile(PID_FILE)
  if (existing !== undefined && pidAlive(existing)) {
    log(`control plane already running (pid ${existing}); use \`node scripts/gate1.mjs health\``)
    return 0
  }

  log(`booting control plane (${CONTROL_PROFILE})… log: ${LOG_FILE}`)
  const logFd = openSync(LOG_FILE, 'a')
  const child = spawn(process.execPath, [cliBin(), '--profile', CONTROL_PROFILE], {
    cwd: REPO,
    env: controlEnv(),
    stdio: ['ignore', 'ignore', logFd],
    detached: true,
  })
  child.unref()
  writeFileSync(PID_FILE, String(child.pid))

  const started = Date.now()
  let sawReadySignals = false
  for (;;) {
    if (child.exitCode !== null) {
      log(`FAIL control plane exited (code ${child.exitCode}); tail of ${LOG_FILE}:`)
      try {
        log(readFileSync(LOG_FILE, 'utf8').split('\n').slice(-15).join('\n'))
      } catch { /* no log */ }
      return 1
    }
    try {
      const text = readFileSync(LOG_FILE, 'utf8')
      if (!sawReadySignals && text.includes('binding store loaded') && text.includes('router idle')) {
        sawReadySignals = true
        // The plugin tree may still fail after the router logs idle (e.g. a
        // sibling plugin import error) — require the process to stay alive.
        await sleep(1500)
        continue
      }
      if (sawReadySignals) {
        if (/plugin tree failed to load/.test(text)) {
          log('FAIL control plane plugin tree failed after router idle; tail of log:')
          log(text.split('\n').slice(-15).join('\n'))
          killGroup(child.pid, 'SIGKILL')
          rmSync(PID_FILE, { force: true })
          return 1
        }
        log(`control plane ready (pid ${child.pid}, ${Date.now() - started}ms)`)
        log(`  log:       ${LOG_FILE}`)
        log(`  product api: http://127.0.0.1:${PRODUCT_API_PORT} (${t1Merged() ? 'T1 merged' : 'WAIT_T1 — T1 not merged'})`)
        if (PRODUCT_API_START_COMMAND !== '') {
          const apiFd = openSync(PRODUCT_API_LOG_FILE, 'a')
          const api = spawn('/bin/sh', ['-c', PRODUCT_API_START_COMMAND], {
            cwd: REPO,
            env: controlEnv(),
            stdio: ['ignore', 'ignore', apiFd],
            detached: true,
          })
          api.unref()
          writeFileSync(PRODUCT_API_PID_FILE, String(api.pid))
          log(`  PRODUCT_API_START_COMMAND launched (pid ${api.pid}; log ${PRODUCT_API_LOG_FILE})`)
        }
        log('  next:      node scripts/gate1.mjs health | smoke | adb reverse | stop')
        return 0
      }
    } catch { /* log not flushed yet */ }
    if (Date.now() - started > 120000) {
      log('FAIL control plane boot timeout (120s); tail of log:')
      try {
        log(readFileSync(LOG_FILE, 'utf8').split('\n').slice(-15).join('\n'))
      } catch { /* no log */ }
      killGroup(child.pid, 'SIGKILL')
      rmSync(PID_FILE, { force: true })
      return 1
    }
    await sleep(1000)
  }
}

// ------------------------------------------------------------------ health

async function runHealth() {
  const pid = readPidFile(PID_FILE)
  const alive = pid !== undefined && pidAlive(pid)
  log(`control plane: ${alive ? `alive (pid ${pid})` : 'NOT running'}`)
  if (alive) {
    try {
      const tail = readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).slice(-8).join('\n')
      log(`log tail:\n${tail}`)
    } catch { /* no log */ }
  }
  if (t1Merged()) {
    const up = await productApiResponds()
    log(`product api (T1 merged): ${up ? `http://127.0.0.1:${PRODUCT_API_PORT} responding` : `no listener on :${PRODUCT_API_PORT}`}`)
  } else if (PRODUCT_API_START_COMMAND !== '') {
    const apiPid = readPidFile(PRODUCT_API_PID_FILE)
    const up = await productApiResponds()
    log(`product api (PRODUCT_API_START_COMMAND): ${up ? `http://127.0.0.1:${PRODUCT_API_PORT} responding (pid ${apiPid ?? '?'})` : `no listener on :${PRODUCT_API_PORT}`}`)
  } else {
    log(`product api: WAIT_T1 — T1 not merged (dev placeholder port ${PRODUCT_API_PORT})`)
  }
  const adb = spawnSync('adb', ['reverse', '--list'], { encoding: 'utf8' })
  if (adb.status === 0) {
    const mapped = (adb.stdout ?? '').split('\n').filter(Boolean)
    log(`adb reverse: ${mapped.length > 0 ? mapped.join(' | ') : 'no mappings'}`)
  } else {
    log('adb reverse: adb not available')
  }
  return alive ? 0 : 1
}

// ------------------------------------------------------------------ smoke

async function runSmoke() {
  const pid = readPidFile(PID_FILE)
  if (pid !== undefined && pidAlive(pid)) {
    log('FAIL: control plane is running; stop it first so smoke owns the stores:')
    log('  node scripts/gate1.mjs stop')
    return 1
  }
  if (t1Merged()) {
    const up = await productApiResponds()
    if (up) {
      log('T1 merged and Product API responding — HTTP smoke via the Product API:')
      try {
        const res = await fetch(`http://127.0.0.1:${PRODUCT_API_PORT}/v1/message`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ surfaceId: 'gate1-smoke', text: 'Reply with exactly: GATE1-SMOKE-OK' }),
          signal: AbortSignal.timeout(300000),
        })
        const body = await res.json()
        const ok = (body?.reply ?? '').includes('GATE1-SMOKE-OK')
        log(`${ok ? 'PASS' : 'FAIL'}  HTTP vertical slice — reply: "${(body?.reply ?? '').slice(0, 80)}"`)
        return ok ? 0 : 1
      } catch (error) {
        log(`FAIL: HTTP smoke failed: ${error instanceof Error ? error.message : String(error)}`)
        return 1
      }
    }
  }
  log('running in-process vertical slice (Router -> real per-agent DSH -> real model)…')
  try {
    await ensureDefaultAgent()
    const { ctx, router } = await inProcessRouter()
    try {
      const result = await router.route({
        channel: 'mobile',
        chatId: 'gate1-smoke',
        conversationId: 'gate1-smoke',
        sender: { openId: 'ou_gate1_smoke' },
        text: 'Reply with exactly: GATE1-SMOKE-OK',
      })
      if (result?.error !== undefined) {
        log(`FAIL: route error: ${result.error.message ?? String(result.error)}`)
        return 1
      }
      const ok = (result?.reply ?? '').includes('GATE1-SMOKE-OK')
      log(`${ok ? 'PASS' : 'FAIL'}  vertical slice — agent ${result.agentId} (pid ${result.pid}) replied: "${(result?.reply ?? '').slice(0, 80)}"`)
      return ok ? 0 : 1
    } finally {
      await ctx.disposeAll()
    }
  } catch (error) {
    log(`FAIL: smoke failed: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

// ------------------------------------------------------------------- stop

async function runStop() {
  const pid = readPidFile(PID_FILE)
  if (pid !== undefined) {
    if (pidAlive(pid)) {
      log(`stopping control plane group (pid ${pid})…`)
      killGroup(pid, 'SIGTERM')
      await sleep(4000)
      if (pidAlive(pid)) {
        log('still alive after SIGTERM; SIGKILL…')
        killGroup(pid, 'SIGKILL')
      }
    }
    rmSync(PID_FILE, { force: true })
  } else {
    log('no control plane pid file')
  }

  const apiPid = readPidFile(PRODUCT_API_PID_FILE)
  if (apiPid !== undefined) {
    if (pidAlive(apiPid)) killGroup(apiPid, 'SIGTERM')
    rmSync(PRODUCT_API_PID_FILE, { force: true })
  }

  const remove = spawnSync('adb', ['reverse', '--remove', `tcp:${PRODUCT_API_PORT}`], { encoding: 'utf8' })
  if (remove.status === 0) log(`adb reverse tcp:${PRODUCT_API_PORT} removed`)
  log('stopped')
  return 0
}

// -------------------------------------------------------------------- adb

function runAdb(sub) {
  const version = spawnSync('adb', ['version'], { encoding: 'utf8' })
  if (version.status !== 0) {
    log('FAIL: adb not on PATH')
    return 1
  }
  if (sub === 'reverse') {
    const res = spawnSync('adb', ['reverse', `tcp:${PRODUCT_API_PORT}`, `tcp:${PRODUCT_API_PORT}`], { stdio: 'inherit' })
    if (res.status !== 0) return 1
    const list = spawnSync('adb', ['reverse', '--list'], { encoding: 'utf8' })
    log((list.stdout ?? '').trim() || '(no mappings)')
    return 0
  }
  if (sub === 'list') {
    const list = spawnSync('adb', ['reverse', '--list'], { stdio: 'inherit' })
    return list.status ?? 1
  }
  if (sub === 'remove') {
    const res = spawnSync('adb', ['reverse', '--remove', `tcp:${PRODUCT_API_PORT}`], { stdio: 'inherit' })
    return res.status ?? 1
  }
  log(`usage: node scripts/gate1.mjs adb (reverse|list|remove)`)
  return 2
}

// ------------------------------------------------------------------- main

const [, , subcommand = '', sub = ''] = process.argv

switch (subcommand) {
  case 'preflight':
    process.exitCode = await runPreflight()
    break
  case 'start':
    process.exitCode = await runStart()
    break
  case 'health':
    process.exitCode = await runHealth()
    break
  case 'smoke':
    process.exitCode = await runSmoke()
    break
  case 'stop':
    process.exitCode = await runStop()
    break
  case 'adb':
    process.exitCode = runAdb(sub)
    break
  default:
    log(`usage: node scripts/gate1.mjs <preflight|start|health|smoke|stop|adb>`)
    log('  preflight  answer every Gate 1 readiness question')
    log('  start      provision + boot the control plane (background)')
    log('  health     control plane / Product API / adb reverse status')
    log('  smoke      full vertical slice through a real Agent + real model')
    log('  stop       kill the control plane + cleanup')
    log('  adb        adb reverse tcp:PORT tcp:PORT (sub: reverse|list|remove)')
    process.exitCode = 2
}
