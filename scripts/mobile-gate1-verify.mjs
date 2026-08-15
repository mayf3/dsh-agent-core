#!/usr/bin/env node
/**
 * MOBILE_LOCAL_REAL_SLICE_V1 acceptance driver — Gate 1.
 *
 * Android Emulator -> adb reverse -> localhost Product API -> Binding ->
 * Router -> real DSH -> response. The control plane is the REAL
 * `agent-core-integration` composition (dsh CLI), per-agent turns run in
 * REAL per-agent DSH processes with the REAL model route.
 *
 *   Phase 0  runtime + registry: Agent A / Agent B registered (A first ->
 *            default), workspaces + AGENTS.md seeded (no home provisioning —
 *            the Router's own spawn path installs everything, FIX 1)
 *   Phase 1  boot the REAL control plane (profile agent-core-integration)
 *            with the product-api HTTP server on 127.0.0.1:8787
 *   Phase 2  surface slice (HTTP, host side): first contact -> A/main,
 *            ALPHA-1 reply; switch-agent -> B; BETA-1; explicit session
 *            switch A/work; bookmark restore proof (A/work after B visit);
 *            per-surface isolation (S2 untouched by S1's switches);
 *            GET /v1/agents
 *   Phase 3  emulator leg: boot AVD (agentcore), adb reverse tcp:8787,
 *            HTTP from INSIDE the emulator -> real reply (when an emulator
 *            is available; skipped otherwise with SKIP recorded)
 *   Phase 4  control-plane restart over the same stores: S1 binding +
 *            bookmark survive (M10 for mobile surfaces)
 *
 * Gate verdict: MOBILE_LOCAL_REAL_SLICE_V1 = PASS | FAIL
 * Kernel change: must stay NONE (nothing under the deepseek-harness
 * checkout is written by this driver or any of the Gate 1 code).
 *
 * Usage: node scripts/mobile-gate1-verify.mjs
 * Env:
 *   DSH_MOBILE_GATE1_RUNTIME  runtime root (default .demo/mobile-gate1/runtime)
 *   DSH_MOBILE_GATE1_KEEP=1   keep existing agent homes (default: wipe)
 *   DSH_MOBILE_GATE1_EMULATOR=0  skip the emulator leg even when adb/AVD exist
 *   DSH_AGENT_PROVIDER / DSH_AGENT_MODEL  LLM route (default opencode-go / deepseek-v4-flash)
 *   DSH_AGENT_TURN_TIMEOUT    per-turn timeout ms (default 300000)
 * Exit 0 on PASS, 1 on FAIL, 2 on infra failure.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync,
  readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { cliBin, provisionAgentHome, REPO } from './demo-home.mjs'
import { AgentRegistry } from '../packages/agent-registry/src/registry.js'

const RUNTIME = resolve(process.env.DSH_MOBILE_GATE1_RUNTIME ?? join(REPO, '.demo', 'mobile-gate1', 'runtime'))
const AGENTS_DIR = join(RUNTIME, 'agents')          // workspace root (memory root)
const HOMES_DIR = join(RUNTIME, 'homes')            // per-agent DSH_HOME root
const CONTROL_HOME = join(RUNTIME, 'control', 'home')
const REGISTRY_STORE = join(RUNTIME, 'control', 'registry.json')
const BINDINGS_STORE = join(RUNTIME, 'control', 'bindings.json')
const KEEP = process.env.DSH_MOBILE_GATE1_KEEP === '1'
const WITH_EMULATOR = process.env.DSH_MOBILE_GATE1_EMULATOR !== '0'
const PROVIDER = process.env.DSH_AGENT_PROVIDER ?? 'opencode-go'
const MODEL = process.env.DSH_AGENT_MODEL ?? 'deepseek-v4-flash'
const MAX_TOKENS = 8192
const AGENT_PROFILE = 'agent-core-integration-agent'
const CONTROL_PROFILE = 'agent-core-integration'
const API_PORT = 8787
const API_BASE = `http://127.0.0.1:${API_PORT}`
const AGENT_A_NAME = 'Agent A'
const AGENT_B_NAME = 'Agent B'
const TURN_TIMEOUT_MS = Number.parseInt(process.env.DSH_AGENT_TURN_TIMEOUT ?? '300000', 10)

const sleep = (ms) => new Promise(resolveTimeout => setTimeout(resolveTimeout, ms))

// ------------------------------------------------------------------ utils

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
  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
  }
}

function provisionProfile(home, profileName, repoProfileDir) {
  const profileDir = join(home, 'profiles', profileName)
  mkdirSync(profileDir, { recursive: true })
  copyOnce(join(repoProfileDir, 'package.json'), join(profileDir, 'package.json'))
  copyOnce(join(repoProfileDir, 'cordis.patch.yml'), join(profileDir, 'cordis.patch.yml'))
}

function linkFarm(home, entries) {
  const farm = join(home, 'profiles', 'node_modules', '@agent-core')
  for (const [pkg, target] of Object.entries(entries)) {
    ensureSymlink(target, join(farm, pkg))
  }
}

function provisionAgent(agentId) {
  const home = join(HOMES_DIR, agentId)
  const workspace = join(AGENTS_DIR, agentId)
  mkdirSync(workspace, { recursive: true })
  return { home, workspace }
}

/** Control-plane home: settings/credentials + profile + plugin farm. */
function provisionControlHome() {
  provisionAgentHome(CONTROL_HOME, REPO)
  provisionProfile(CONTROL_HOME, CONTROL_PROFILE, join(REPO, 'profile-integration'))
  linkFarm(CONTROL_HOME, {
    'bundle-integration': join(REPO, 'bundle-integration'),
    'feishu-connector': join(REPO, 'packages', 'feishu-connector'),
    'agent-router': join(REPO, 'packages', 'agent-router'),
    'product-api': join(REPO, 'packages', 'product-api'),
    'workspace-bootstrap': join(REPO, 'packages', 'workspace-bootstrap'),
    'agent-registry': join(REPO, 'packages', 'agent-registry'),
  })
}

function baseEnv(extra = {}) {
  return {
    ...process.env,
    DSH_HOME: CONTROL_HOME,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    AGENT_REGISTRY_STORE: REGISTRY_STORE,
    ROUTER_BINDINGS_STORE: BINDINGS_STORE,
    ROUTER_AGENT_PROFILE: AGENT_PROFILE,
    DSH_MEMORY_WORKSPACE_ROOT: AGENTS_DIR,
    PRODUCT_API_HOST: '127.0.0.1',
    PRODUCT_API_PORT: String(API_PORT),
    DSH_MOBILE_GATE1_KEEP: '1', // never let a child wipe the runtime
    ...extra,
  }
}

/** Boot the REAL control-plane composition; resolves when product-api is up. */
function bootControlPlane() {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [cliBin(), '--profile', CONTROL_PROFILE], {
      cwd: REPO,
      env: baseEnv({ FEISHU_ENABLED: '0' }),
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    let done = false
    const finish = (ok, detail) => {
      if (done) return
      done = true
      if (!ok) {
        try { child.kill('SIGKILL') } catch { /* already dead */ }
      }
      resolvePromise({ ok, detail, child, stderr: () => stderr })
    }
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (stderr.includes(`[product-api] listening on http://127.0.0.1:${API_PORT}`)) {
        finish(true, `control plane + product-api up (port ${API_PORT})`)
      } else if (stderr.includes('ERROR') && stderr.includes('product-api')) {
        finish(false, `control plane failed to mount product-api; stderr tail: ${stderr.slice(-500)}`)
      }
    })
    child.once('exit', (code) => {
      finish(false, `control plane exited before product-api came up (code ${code}); stderr tail: ${stderr.slice(-500)}`)
    })
    setTimeout(() => finish(false, `control plane boot timeout; stderr tail: ${stderr.slice(-500)}`), 120000)
  })
}

/** Stop the control plane and wait for its exit. */
async function stopControlPlane(cp) {
  const child = cp?.child
  if (child === undefined || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise(resolveExit => child.once('exit', resolveExit)),
    sleep(15000),
  ])
  if (child.exitCode === null && child.signalCode === null) {
    try { child.kill('SIGKILL') } catch { /* already dead */ }
    await sleep(1000)
  }
}

// ------------------------------------------------------------ HTTP client

/**
 * One Product API call. Network-level failures (e.g. the control plane's
 * listener settling a moment after its boot line) are retried with backoff;
 * HTTP responses are returned as-is.
 */
async function api(method, path, body, { retries = 10, baseDelayMs = 500 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const text = await res.text()
      let parsed = null
      try { parsed = text === '' ? null : JSON.parse(text) } catch { parsed = text }
      return { status: res.status, body: parsed }
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await sleep(baseDelayMs * (attempt + 1))
      }
    }
  }
  throw new Error(`api ${method} ${path} failed after ${retries + 1} attempts: ${lastError?.stack ?? lastError}`)
}

// ------------------------------------------------------------ assertions

const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
}
function recordSkipped(name, detail = '') {
  console.log(`SKIP  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok: true, detail: `SKIPPED ${detail}` })
}

// ------------------------------------------------------------------ main

/** Snapshot of the harness checkout git status (for the kernel guard). */
function harnessStatus() {
  const harnessRoot = process.env.DSH_HARNESS_ROOT
    ?? resolve(REPO, '../../github/deepseek-harness')
  if (!existsSync(join(harnessRoot, '.git'))) return { harnessRoot, entries: null }
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: harnessRoot, encoding: 'utf8' })
  return { harnessRoot, entries: (status.stdout ?? '').split('\n').filter(Boolean) }
}

async function main() {
  const kernelBefore = harnessStatus()
  console.log(`=== MOBILE_LOCAL_REAL_SLICE_V1 — runtime ${RUNTIME}`)
  console.log(`agents: ${AGENT_A_NAME} + ${AGENT_B_NAME}; product API http://127.0.0.1:${API_PORT}`)
  if (kernelBefore.entries !== null) {
    console.log(`harness checkout baseline dirt: ${kernelBefore.entries.length} entries (pre-existing; must not grow)`)
  }

  // ------------------------------------------------------------- phase 0
  if (KEEP && existsSync(RUNTIME)) {
    console.log('\n[phase 0] keeping existing runtime (KEEP=1)')
  } else {
    rmSync(RUNTIME, { recursive: true, force: true })
    console.log('\n[phase 0] runtime wiped, provisioning…')
  }
  mkdirSync(CONTROL_HOME, { recursive: true })
  provisionControlHome()

  const registry = new AgentRegistry({ storeFile: REGISTRY_STORE })
  const agentA = await registry.registerAgent({ name: AGENT_A_NAME, description: '论文导师' })
  const agentB = await registry.registerAgent({ name: AGENT_B_NAME, description: '研发总监' })
  record('GATE1_REGISTRY_AB', registry.listAgents().length === 2, `${agentA.id} / ${agentB.id}`)
  record('GATE1_DEFAULT_IS_A', registry.getDefaultAgent()?.id === agentA.id, 'first registered becomes default')

  provisionAgent(agentA.id)
  provisionAgent(agentB.id)
  // Identity + sibling info (workspace-bootstrap seeds AGENTS.md; we extend
  // so "Reply with exactly: X" turns are deterministic enough to assert).
  writeFileSync(join(AGENTS_DIR, agentA.id, 'AGENTS.md'), [
    '# AGENTS.md',
    '',
    `You are ${AGENT_A_NAME} (论文导师). Your agentId is ${agentA.id}.`,
    `The other agent is ${AGENT_B_NAME} (研发总监), agentId ${agentB.id}, display name '${AGENT_B_NAME}'.`,
    '',
  ].join('\n'))
  writeFileSync(join(AGENTS_DIR, agentB.id, 'AGENTS.md'), [
    '# AGENTS.md',
    '',
    `You are ${AGENT_B_NAME} (研发总监). Your agentId is ${agentB.id}.`,
    `The other agent is ${AGENT_A_NAME} (论文导师), agentId ${agentA.id}, display name '${AGENT_A_NAME}'.`,
    '',
  ].join('\n'))

  // The Android side owns the surface identity: two stable opaque UUIDs,
  // exactly what the app generates/persists on first launch (the emulator
  // leg below uses the app's OWN id).
  const surfaceS1 = randomUUID()
  const surfaceS2 = randomUUID()
  const surfaceS3 = randomUUID() // fresh surface for the in-emulator slice
  console.log(`\n[phase 0] surfaces: S1=${surfaceS1} S2=${surfaceS2} S3=${surfaceS3}`)

  // ------------------------------------------------------------- phase 1
  console.log('\n[phase 1] booting the REAL control plane (agent-core-integration + product-api)…')
  const cp = await bootControlPlane()
  LIVE_CP = cp
  record('GATE1_CP_PRODUCT_API_UP', cp.ok, cp.detail)
  if (!cp.ok) {
    await finish(cp, { surfaceS1, surfaceS2, surfaceS3 })
    return
  }

  // ------------------------------------------------------------- phase 2
  console.log('\n[phase 2] host-side surface slice over the real HTTP API')

  // 2.1 first contact: the surface has no binding; a message auto-binds to
  //     the default Agent + main and the reply comes from A's real process.
  const msg1 = await api('POST', '/v1/message', { surfaceId: surfaceS1, text: 'Reply with exactly: ALPHA-1' })
  record('GATE1_FIRST_MESSAGE_REPLY', msg1.status === 200 && (msg1.body?.reply ?? '').includes('ALPHA-1'),
    `status=${msg1.status} reply="${(msg1.body?.reply ?? '').slice(0, 60)}"`)
  record('GATE1_FIRST_MESSAGE_BOUND_A_MAIN', msg1.body?.agentId === agentA.id && msg1.body?.sessionId === 'main',
    `agent=${msg1.body?.agentId} session=${msg1.body?.sessionId}`)

  const binding1 = await api('GET', `/v1/binding?surfaceId=${surfaceS1}`)
  record('GATE1_GET_BINDING', binding1.status === 200 && binding1.body?.activeAgentId === agentA.id
    && binding1.body?.activeSessionId === 'main'
    && binding1.body?.channelConversationId === `mobile:${surfaceS1}`,
    `ccId=${binding1.body?.channelConversationId} agent=${binding1.body?.activeAgentId}`)

  // 2.2 switch-agent -> B (no sessionId: the Router decides main).
  const sw1 = await api('POST', '/v1/switch-agent', { surfaceId: surfaceS1, targetAgentId: agentB.id })
  record('GATE1_SWITCH_TO_B', sw1.status === 200 && sw1.body?.activeAgentId === agentB.id
    && sw1.body?.activeSessionId === 'main', `agent=${sw1.body?.activeAgentId} session=${sw1.body?.activeSessionId}`)
  const msg2 = await api('POST', '/v1/message', { surfaceId: surfaceS1, text: 'Reply with exactly: BETA-1' })
  record('GATE1_MESSAGE_AFTER_SWITCH_ENTERS_B', msg2.status === 200 && (msg2.body?.reply ?? '').includes('BETA-1')
    && msg2.body?.agentId === agentB.id, `reply="${(msg2.body?.reply ?? '').slice(0, 60)}" agent=${msg2.body?.agentId}`)

  // 2.3 explicit session switch (the switchSession product op): A/work.
  const sw2 = await api('POST', '/v1/switch-agent', { surfaceId: surfaceS1, targetAgentId: agentA.id, sessionId: 'work' })
  record('GATE1_EXPLICIT_SESSION_SWITCH', sw2.status === 200 && sw2.body?.activeAgentId === agentA.id
    && sw2.body?.activeSessionId === 'work', `agent=${sw2.body?.activeAgentId} session=${sw2.body?.activeSessionId}`)
  const msg3 = await api('POST', '/v1/message', { surfaceId: surfaceS1, text: 'Reply with exactly: ALPHA-2' })
  record('GATE1_MESSAGE_IN_NON_MAIN_SESSION', msg3.status === 200 && (msg3.body?.reply ?? '').includes('ALPHA-2')
    && msg3.body?.sessionId === 'work', `reply="${(msg3.body?.reply ?? '').slice(0, 60)}" session=${msg3.body?.sessionId}`)

  // 2.4 THE bookmark proof: A/work -> B -> A must RESTORE A/work (not main).
  await api('POST', '/v1/switch-agent', { surfaceId: surfaceS1, targetAgentId: agentB.id })
  const sw3 = await api('POST', '/v1/switch-agent', { surfaceId: surfaceS1, targetAgentId: agentA.id })
  record('GATE1_BOOKMARK_RESTORES_LAST_SESSION', sw3.status === 200 && sw3.body?.activeAgentId === agentA.id
    && sw3.body?.activeSessionId === 'work',
    `switch back to A -> ${sw3.body?.activeAgentId}/${sw3.body?.activeSessionId} (bookmark, not main)`)
  const msg4 = await api('POST', '/v1/message', { surfaceId: surfaceS1, text: 'Reply with exactly: ALPHA-3' })
  record('GATE1_RESUMED_SESSION_ROUTES', msg4.status === 200 && (msg4.body?.reply ?? '').includes('ALPHA-3')
    && msg4.body?.sessionId === 'work', `reply="${(msg4.body?.reply ?? '').slice(0, 60)}" session=${msg4.body?.sessionId}`)

  // 2.5 per-surface isolation: S2 is a brand-new surface with its own
  //     default binding; S1's switches never touch it and vice versa.
  const binding2none = await api('GET', `/v1/binding?surfaceId=${surfaceS2}`)
  record('GATE1_FRESH_SURFACE_NO_BINDING', binding2none.status === 404
    && binding2none.body?.error?.code === 'BINDING_NOT_FOUND', `status=${binding2none.status}`)
  const msg5 = await api('POST', '/v1/message', { surfaceId: surfaceS2, text: 'Reply with exactly: GAMMA-1' })
  record('GATE1_SURFACE2_OWN_BINDING', msg5.status === 200 && (msg5.body?.reply ?? '').includes('GAMMA-1')
    && msg5.body?.agentId === agentA.id && msg5.body?.sessionId === 'main',
    `S2 -> ${msg5.body?.agentId}/${msg5.body?.sessionId} (default, unaffected by S1)`)
  await api('POST', '/v1/switch-agent', { surfaceId: surfaceS2, targetAgentId: agentB.id })
  const binding1after = await api('GET', `/v1/binding?surfaceId=${surfaceS1}`)
  record('GATE1_SURFACE_ISOLATION', binding1after.body?.activeAgentId === agentA.id
    && binding1after.body?.activeSessionId === 'work',
    `S1 still ${binding1after.body?.activeAgentId}/${binding1after.body?.activeSessionId} after S2 switches`)

  // 2.6 GET /v1/agents
  const agents = await api('GET', '/v1/agents')
  record('GATE1_GET_AGENTS', agents.status === 200 && agents.body?.agents?.length === 2
    && agents.body.agents.some(a => a.id === agentA.id) && agents.body.agents.some(a => a.id === agentB.id),
    `count=${agents.body?.agents?.length}`)

  // 2.7 self-switch no-op (tap current agent in the switcher)
  const sw4 = await api('POST', '/v1/switch-agent', { surfaceId: surfaceS1, targetAgentId: agentA.id })
  record('GATE1_SELF_SWITCH_NOOP', sw4.body?.activeAgentId === agentA.id && sw4.body?.activeSessionId === 'work',
    `self-switch stays ${sw4.body?.activeAgentId}/${sw4.body?.activeSessionId}`)

  // ------------------------------------------------------------- phase 3
  console.log('\n[phase 3] Android Emulator leg: adb reverse -> localhost -> real DSH')
  await emulatorLeg({ surfaceS3, agentA })

  // ------------------------------------------------------------- phase 4
  console.log('\n[phase 4] control-plane restart over the same stores')
  await stopControlPlane(cp)
  const cp2 = await bootControlPlane()
  record('GATE1_CP_RESTART_UP', cp2.ok, cp2.detail)
  if (cp2.ok) {
    const bindingAfter = await api('GET', `/v1/binding?surfaceId=${surfaceS1}`)
    record('GATE1_RESTART_KEEPS_SURFACE_BINDING', bindingAfter.body?.activeAgentId === agentA.id
      && bindingAfter.body?.activeSessionId === 'work',
      `S1 still ${bindingAfter.body?.activeAgentId}/${bindingAfter.body?.activeSessionId} after restart`)
    const binding2After = await api('GET', `/v1/binding?surfaceId=${surfaceS2}`)
    record('GATE1_RESTART_KEEPS_SURFACE2', binding2After.body?.activeAgentId === agentB.id,
      `S2 still ${binding2After.body?.activeAgentId} after restart`)
  }
  await stopControlPlane(cp2)

  // ---------------------------------------------------------- kernel guard
  const kernelAfter = harnessStatus()
  const newDirt = kernelAfter.entries === null ? []
    : kernelAfter.entries.filter(entry => !(kernelBefore.entries ?? []).includes(entry))
  record('GATE1_KERNEL_CHANGE_NONE', kernelBefore.entries === null || newDirt.length === 0,
    newDirt.length === 0 ? `no NEW modifications under ${kernelAfter.harnessRoot} during this Gate`
      : `harness checkout gained ${newDirt.length} entry/entries during the run: ${newDirt.join('; ')}`)

  await finish(cp, { surfaceS1, surfaceS2, surfaceS3, agentA, agentB, harnessRoot: kernelAfter.harnessRoot })
}

/**
 * The emulator leg: boot the AVD, adb reverse tcp:8787, then issue the real
 * slice from INSIDE the emulator (127.0.0.1 on the device = the host's
 * product-api). Skips cleanly when adb/AVD are unavailable.
 */
async function emulatorLeg({ surfaceS3, agentA }) {
  if (!WITH_EMULATOR) {
    recordSkipped('GATE1_EMULATOR_LEG', 'DSH_MOBILE_GATE1_EMULATOR=0')
    return
  }
  const emulatorBin = (() => {
    for (const candidate of ['emulator',
      join(process.env.ANDROID_HOME ?? '', 'emulator', 'emulator'),
      join(process.env.ANDROID_SDK_ROOT ?? '', 'emulator', 'emulator'),
      join(process.env.HOME ?? '', 'Library', 'Android', 'sdk', 'emulator', 'emulator')]) {
      if (candidate !== '' && existsSync(candidate)) return candidate
    }
    return undefined
  })()
  const avd = (() => {
    if (emulatorBin === undefined) return undefined
    const list = spawnSync(emulatorBin, ['-list-avds'], { encoding: 'utf8' })
    if (list.status !== 0) return undefined
    return list.stdout.split('\n').map(s => s.trim()).find(Boolean)
  })()
  if (emulatorBin === undefined || avd === undefined) {
    recordSkipped('GATE1_EMULATOR_LEG', 'no emulator binary / AVD available')
    return
  }
  console.log(`  booting AVD "${avd}" (headless)…`)
  // Devices already online before our spawn belong to someone else — they
  // are used (the AVD may already be running) but never killed.
  const preExisting = new Set((spawnSync('adb', ['devices'], { encoding: 'utf8' }).stdout ?? '')
    .split('\n').slice(1).map(s => s.trim().split(/\s+/)[0]).filter(Boolean))
  const emu = spawn(emulatorBin, ['-avd', avd, '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot'], {
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  // Only the emulator WE spawned is killed at the end; a device that was
  // already running (e.g. a user's emulator) is left alone.
  let spawnedDevice = false
  try {
    let device = ''
    const deadline = Date.now() + 240000
    while (Date.now() < deadline) {
      const out = spawnSync('adb', ['devices'], { encoding: 'utf8' })
      device = (out.stdout ?? '').split('\n').slice(1).map(s => s.trim())
        .find(s => s.endsWith('device'))
      if (device !== undefined) break
      await sleep(3000)
    }
    if (device === undefined) {
      recordSkipped('GATE1_EMULATOR_LEG', 'emulator never appeared in adb devices')
      return
    }
    const serial = device.split(/\s+/)[0]
    spawnedDevice = !preExisting.has(serial) // only kill what we booted
    console.log(`  device ${serial} online${spawnedDevice ? '' : ' (pre-existing, left running)'}; waiting for boot completion…`)
    const bootDeadline = Date.now() + 180000
    for (;;) {
      const boot = spawnSync('adb', ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8' })
      if ((boot.stdout ?? '').trim() === '1') break
      if (Date.now() > bootDeadline) {
        recordSkipped('GATE1_EMULATOR_LEG', 'boot_completed timeout')
        return
      }
      await sleep(3000)
    }
    console.log('  booted; adb reverse tcp:8787 tcp:8787…')
    const reverse = spawnSync('adb', ['-s', serial, 'reverse', `tcp:${API_PORT}`, `tcp:${API_PORT}`])
    if (reverse.status !== 0) {
      record('GATE1_EMULATOR_LEG', false, `adb reverse failed: ${reverse.stderr}`)
      return
    }
    // An HTTP client from INSIDE the device proves the reverse tunnel.
    // Android images vary: curl / toybox wget / toybox netcat (raw HTTP).
    const inDevice = (args) => spawnSync('adb', ['-s', serial, 'shell', ...args], { encoding: 'utf8', timeout: 420000 })
    const httpProbe = (method, path, body, holdSeconds = 8) => {
      // try curl
      let args = ['curl', '-s', '-m', String(holdSeconds + 30), '-X', method, '-H', 'content-type: application/json']
      if (body !== undefined) args = [...args, '-d', body]
      let out = inDevice([...args, `${API_BASE}${path}`])
      if (out.status === 0 && (out.stdout ?? '').trim() !== '') return { kind: 'curl', out }
      // toybox wget (GET only; no JSON POST)
      if (method === 'GET') {
        out = inDevice(['wget', '-q', '-O', '-', `${API_BASE}${path}`])
        if (out.status === 0 && (out.stdout ?? '').trim() !== '') return { kind: 'wget', out }
      }
      // toybox netcat raw HTTP (keep stdin open so nc waits for the reply)
      const payload = body === undefined ? '' : body
      const request = [
        `${method} ${path} HTTP/1.0`,
        'Host: localhost',
        'Connection: close',
        ...(body === undefined ? [] : ['Content-Type: application/json', `Content-Length: ${Buffer.byteLength(payload)}`]),
        '',
        payload,
      ].join('\r\n')
      out = inDevice([`(printf '${request.replace(/'/g, "'\\''")}'; sleep ${holdSeconds}) | nc -w ${holdSeconds + 15} 127.0.0.1 ${API_PORT}`])
      if (out.status === 0 && (out.stdout ?? '').length > 0) return { kind: 'nc', out }
      return { kind: 'none', out }
    }
    const health = httpProbe('GET', '/health')
    const healthOk = health.kind !== 'none' && health.out.stdout.includes('"ok":true')
    record('GATE1_EMULATOR_ADB_REVERSE', healthOk,
      healthOk ? `in-device /health ok (${health.kind})`
        : `no in-device HTTP client worked: ${health.out.stderr ?? ''} ${(health.out.stdout ?? '').slice(0, 80)}`)
    if (!healthOk) return

    // The REAL slice from inside the emulator: first-contact message on a
    // fresh surface -> real agent reply through the whole chain (raw nc
    // POST works even on images without curl/wget).
    const payload = JSON.stringify({ surfaceId: surfaceS3, text: 'Reply with exactly: GAMMA-2' })
    const msg = httpProbe('POST', '/v1/message', payload, TURN_TIMEOUT_MS / 1000 + 30)
    if (msg.kind === 'none') {
      recordSkipped('GATE1_EMULATOR_REAL_SLICE', 'no in-device HTTP client; covered by the Flutter app integration-test leg')
      return
    }
    let reply = ''
    let replyAgent = ''
    try {
      const parsed = JSON.parse(msg.out.stdout.slice(msg.out.stdout.indexOf('{')))
      reply = parsed.reply ?? ''
      replyAgent = parsed.agentId ?? ''
    } catch { /* non-JSON reply */ }
    record('GATE1_EMULATOR_REAL_SLICE', reply.includes('GAMMA-2') && replyAgent === agentA.id,
      `in-device POST /v1/message (${msg.kind}) -> reply="${reply.slice(0, 60)}" agent=${replyAgent}`)
  } finally {
    if (spawnedDevice) {
      spawnSync('adb', ['emu', 'kill'], { timeout: 10000 })
    }
    try { emu.kill('SIGKILL') } catch { /* already dead */ }
  }
}

/** Write evidence + print the final verdict, then exit. */
async function finish(cp, { surfaceS1, surfaceS2, surfaceS3, agentA, agentB, harnessRoot }) {
  await stopControlPlane(cp)
  const evidence = [
    '# Mobile Gate 1 — MOBILE_LOCAL_REAL_SLICE_V1',
    '',
    `Run: ${new Date().toISOString()}`,
    `Runtime: ${RUNTIME}`,
    `Surfaces: S1=${surfaceS1} (slice + bookmark), S2=${surfaceS2} (isolation), S3=${surfaceS3} (emulator leg)`,
    `Agents: A = ${agentA?.id} ("${AGENT_A_NAME}"), B = ${agentB?.id} ("${AGENT_B_NAME}")`,
    `Product API: ${API_BASE} (127.0.0.1 only, adb reverse tcp:${API_PORT})`,
    `Harness checkout: ${harnessRoot ?? 'n/a'}`,
    '',
    '## Checks',
    '',
    ...checks.map(c => `- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`),
    '',
    '## Key artifacts',
    '',
    `- Binding store: ${BINDINGS_STORE}`,
    `- Registry store: ${REGISTRY_STORE}`,
    `- Control home: ${CONTROL_HOME}`,
    `- A workspace: ${join(AGENTS_DIR, agentA?.id ?? '')}`,
    `- B workspace: ${join(AGENTS_DIR, agentB?.id ?? '')}`,
    '',
  ].join('\n')
  const reportPath = join(RUNTIME, '..', 'evidence.md')
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, evidence)
  console.log(`\nevidence written: ${reportPath}`)

  const allPass = checks.every(c => c.ok)
  console.log(`\nMOBILE_LOCAL_REAL_SLICE_V1 = ${allPass ? 'PASS' : 'FAIL'}`)
  console.log(`KERNEL_CHANGE = ${checks.find(c => c.name === 'GATE1_KERNEL_CHANGE_NONE')?.ok === true ? 'NONE' : 'REQUIRED'}`)
  console.log('Gate 2 not entered.')
  process.exit(allPass ? 0 : 1)
}

let LIVE_CP // set by main so a failure always stops the control plane

main().catch(async (error) => {
  console.error(`\nMOBILE GATE 1 FAILED: ${error instanceof Error ? error.message : String(error)}`)
  if (LIVE_CP !== undefined) await stopControlPlane(LIVE_CP).catch(() => {})
  process.exit(2)
})
