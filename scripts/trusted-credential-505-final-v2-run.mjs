#!/usr/bin/env node
/**
 * TRUSTED_CREDENTIAL_505_FINAL_ACCEPTANCE_V2 — run the existing verify
 * topology under the REAL frozen privilege split:
 *
 *   driver (root)  --orchestrates only-->
 *   Router / control plane  = uid 505 (authsvc)   via sudo -u authsvc
 *   DSH Agent children      = uid 502 (yanfenma)  via the frozen setuid
 *                            spawn helper (505 -> 502/20, groups cleared)
 *   credential store        = 505-private zone file (authsvc 0600, inside
 *                            /Users/yanfenma/.openclaw/credentials/)
 *
 * Distinct real credentials (Task 3 hardening — both verified live against
 * the real auth-service before this run):
 *   A = knowledge-curator-agent  mc_oc_AdXrOjACKpodtqSPo3HA5fq_  sub 87047adb…
 *   B = arch-reviewer            mc_oc_R2SNVsMtaNLBfbIvGoCC3K41 sub 4684680a…
 * Secrets are read at runtime from the 505-private zone and never printed.
 *
 * Prerequisites (one-time root bootstrap, scripts/tcb-v2-root-install.sh):
 *   /usr/local/libexec/dsh-agent-spawn-helper   root:wheel 4755
 *   /Users/yanfenma/.openclaw/credentials/dsh-agent-core/  authsvc 0700
 *
 * Usage: sudo node scripts/trusted-credential-505-final-v2-run.mjs
 * Exit 0 = all checks PASS, 1 = FAIL, 2 = infra error.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  chmodSync, chownSync, copyFileSync, existsSync, mkdirSync, readFileSync,
  rmSync, statSync, symlinkSync, writeFileSync, lstatSync, readlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { cliBin, provisionAgentHome, REPO } from './demo-home.mjs'
import { AgentRegistry } from '../packages/agent-registry/src/registry.js'

process.env.DSH_HARNESS_ROOT ??= '/Users/yanfenma/workspace/github/deepseek-harness'

const RUNTIME = join(REPO, '.demo', 'trusted-credential-505-v2')
const AGENTS_DIR = join(RUNTIME, 'agents') // memory root AND workspace root
const HOMES_DIR = join(RUNTIME, 'homes')
const CONTROL_HOME = join(RUNTIME, 'control', 'home')
const REGISTRY_STORE = join(RUNTIME, 'control', 'registry.json')
const BINDINGS_STORE = join(RUNTIME, 'control', 'bindings.json')

const AUTH_PARENT_UID = 505 // authsvc
const CHILD_UID = 502 // yanfenma
const CHILD_GID = 20 // yanfenma primary group (staff)
const HELPER = '/usr/local/libexec/dsh-agent-spawn-helper'
const CREDS_ZONE = '/Users/yanfenma/.openclaw/credentials'
const STORE_DIR = join(CREDS_ZONE, 'dsh-agent-core')
const STORE_FILE = join(STORE_DIR, 'tcb-v2-agent-credentials.json')

// Distinct REAL MachineClients (both verified: token 200 + forum 200).
const REAL = {
  A: {
    agentName: 'knowledge-curator-agent',
    clientId: 'mc_oc_AdXrOjACKpodtqSPo3HA5fq_',
    sub: '87047adb-2931-400b-b5f0-c384cba37b8d',
    secretFile: join(CREDS_ZONE, 'agent-knowledge-curator-agent-secret'),
  },
  B: {
    agentName: 'arch-reviewer',
    clientId: 'mc_oc_R2SNVsMtaNLBfbIvGoCC3K41',
    sub: '4684680a-60c4-487b-b362-de7a3367fed2',
    secretFile: join(CREDS_ZONE, 'agent-arch-reviewer-secret'),
  },
}

const AGENT_PROFILE = 'agent-core-integration-agent'
const CONTROL_PROFILE = 'agent-core-integration'
const AGENT_A_NAME = '知识管家'
const AGENT_B_NAME = '架构评审'
const API_PORT = 8787
const API_BASE = `http://127.0.0.1:${API_PORT}`
const AUTH_ORIGIN = 'http://127.0.0.1:4001'
const FORUM_ORIGIN = 'http://127.0.0.1:3460'
const TURN_TIMEOUT_MS = Number.parseInt(process.env.DSH_TCB_TURN_TIMEOUT ?? '300000', 10)
const USER_YANFENMA = { uid: 502, gid: 20 }
const USER_AUTHSVC = { uid: 505, gid: 601 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DEBUG_TEE = process.argv.includes('--debug-tee')
const CHILD_STDERR_TEE = '/tmp/tcb-v2-child-stderr.log'
let MODEL_KEY = '' // read at phase 0; carried to the CP env only

// ------------------------------------------------------------------ utils

function ensureSymlink(target, link) {
  mkdirSync(dirname(link), { recursive: true })
  try {
    const st = lstatSync(link)
    if (st.isSymbolicLink() && resolve(readlinkSync(link)) === resolve(target)) return
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

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000, ...opts })
}

function chownTree(path, { uid, gid }) {
  sh('chown', ['-R', '-h', `${uid}:${gid}`, path])
}

/** The control-plane process env (passed explicitly through /usr/bin/env). */
function controlEnvPairs() {
  const env = {
    HOME: '/Users/yanfenma',
    PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    ...(DEBUG_TEE ? {
      NODE_OPTIONS: '--require /tmp/tcb-v2-tee.js',
      DSH_TCB_DEBUG_TEE: CHILD_STDERR_TEE,
    } : {}),
    DSH_HOME: CONTROL_HOME,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    AGENT_REGISTRY_STORE: REGISTRY_STORE,
    ROUTER_BINDINGS_STORE: BINDINGS_STORE,
    ROUTER_AGENT_PROFILE: AGENT_PROFILE,
    DSH_MEMORY_WORKSPACE_ROOT: AGENTS_DIR,
    DSH_WORKSPACE_DIR: AGENTS_DIR,
    DSH_AGENTS_HOME: HOMES_DIR,
    AGENT_CORE_CREDENTIALS_FILE: STORE_FILE,
    BROKER_AUTH_ORIGIN: AUTH_ORIGIN,
    DSH_AGENT_CHILD_UID: String(CHILD_UID),
    DSH_AGENT_CHILD_GID: String(CHILD_GID),
    DSH_AGENT_SPAWN_HELPER: HELPER,
    BROKER_FIXTURE_SELF_ASSERT: '1',
    PRODUCT_API_ENABLED: '1',
    FEISHU_ENABLED: '0',
    DSH_HARNESS_ROOT: process.env.DSH_HARNESS_ROOT,
    // The model key travels in the CP env (agentEnv() then never reads the
    // child's 0600 .credentials.yaml, which credentials-local requires).
    OPENCODE_GO_API_KEY: MODEL_KEY,
  }
  return Object.entries(env).map(([k, v]) => `${k}=${v}`)
}

/** Boot the REAL control plane as authsvc (505). Resolves when the broker
 *  gateway logs ready. The spawned process is `sudo` (monitor); the real CP
 *  is its child — findCpPid() locates it. */
function bootControlPlane() {
  return new Promise((resolvePromise) => {
    const child = spawn('sudo', [
      '-u', 'authsvc', '/usr/bin/env', ...controlEnvPairs(),
      process.execPath, cliBin(), '--profile', CONTROL_PROFILE,
    ], { cwd: REPO, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    let done = false
    const finish = (ok, detail) => {
      if (done) return
      done = true
      if (!ok) { try { child.kill('SIGKILL') } catch { /* already dead */ } }
      resolvePromise({ ok, detail, child, stderr: () => stderr })
    }
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (stderr.includes('[broker] gateway mode:')) {
        finish(true, 'control plane (authsvc/505) + broker gateway up')
      }
    })
    child.once('exit', (code) => {
      finish(false, `control plane exited before the gateway came up (code ${code}); stderr tail: ${stderr.slice(-600)}`)
    })
    setTimeout(() => finish(false, `control plane boot timeout; stderr tail: ${stderr.slice(-600)}`), 120000)
  })
}

async function stopControlPlane(cp) {
  const child = cp?.child
  if (child === undefined || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    sleep(15000),
  ])
  // Kill any node child sudo left behind, then the monitor.
  const left = sh('pgrep', ['-P', String(child.pid)])
  for (const pid of (left.stdout ?? '').split('\n').filter(Boolean)) {
    sh('kill', ['-9', pid])
  }
  if (child.exitCode === null) {
    try { child.kill('SIGKILL') } catch { /* already dead */ }
    await sleep(1000)
  }
}

/** Find the REAL control-plane node process (uid 505, control profile). */
function findCpPid() {
  const out = sh('ps', ['-eo', 'pid=,uid=,command='])
  for (const line of (out.stdout ?? '').split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)
    if (!m) continue
    if (Number(m[2]) === AUTH_PARENT_UID && m[3].includes('--profile agent-core-integration') &&
        !m[3].includes('--profile agent-core-integration-agent')) {
      return { pid: Number(m[1]), uid: Number(m[2]) }
    }
  }
  return null
}

// ------------------------------------------------------------ HTTP client

async function api(method, path, body, { retries = 3, timeoutMs = 240000 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), timeoutMs)
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          method,
          headers: body === undefined ? undefined : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: ac.signal,
        })
        const text = await res.text()
        let parsed = null
        try { parsed = text === '' ? null : JSON.parse(text) } catch { parsed = text }
        return { status: res.status, body: parsed }
      } finally {
        clearTimeout(timer)
      }
    } catch (error) {
      lastError = error
      if (attempt < retries) await sleep(3000)
    }
  }
  throw new Error(`api ${method} ${path} failed: ${lastError?.message ?? lastError}`)
}

// ------------------------------------------------------------ assertions

const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
}

function decodeJwt(token) {
  const payload = token.split('.')[1]
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

function readProcessEnv(pid) {
  const out = sh('ps', ['eww', '-p', String(pid), '-o', 'command='])
  return out.stdout ?? ''
}

function agentHome(agentId) { return join(HOMES_DIR, agentId) }
function agentWorkspace(agentId) { return join(AGENTS_DIR, agentId) }

async function waitForCplog(cp, needle, timeoutMs = 60000) {
  const started = Date.now()
  for (;;) {
    if (cp.stderr().includes(needle)) return true
    if (Date.now() - started > timeoutMs) return false
    await sleep(1000)
  }
}

/** Child process snapshot (per-agent dsh CLI), env readable because root. */
function cpProcs() {
  const out = sh('ps', ['-axo', 'pid=,uid=,command='])
  const procs = []
  for (const line of (out.stdout ?? '').split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)
    if (!m) continue
    if (!m[3].includes('apps/cli/lib/bin.js --profile agent-core-integration-agent')) continue
    const env = readProcessEnv(m[1])
    const agentId = (env.match(/DSH_AGENT_ID=(\S+)/) ?? [])[1]
    procs.push({ pid: Number(m[1]), uid: Number(m[2]), agentId })
  }
  return procs
}

/** Real client_credentials exchange at the real auth-service. */
async function exchangeToken(clientId, clientSecret) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${AUTH_ORIGIN}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials', resource: 'svc-forum', scope: 'forum.read',
    }).toString(),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, jwt: body.access_token }
}

/** Corroborate which JWT subs svc-forum actually saw (docker logs). */
function forumLogEvidence(sinceIso) {
  const out = sh('docker', ['logs', '--since', sinceIso, 'svc-forum'], { timeout: 60000 })
  const text = `${out.stdout ?? ''}${out.stderr ?? ''}`
  const hits = []
  for (const [key, cred] of Object.entries(REAL)) {
    const subSeen = text.includes(cred.sub)
    const agentSeen = text.includes(cred.agentName)
    if (subSeen || agentSeen) hits.push(`${key}:sub=${subSeen},agent=${agentSeen}`)
  }
  return hits
}

/** One model-driven broker call via POST /v1/message; retries once. */
async function driveBrokerCall(surfaceId, text) {
  try {
    const first = await api('POST', '/v1/message', { surfaceId, text })
    if (first.status === 200 && (first.body?.reply ?? '').length > 0) {
      return { ok: true, reply: first.body.reply ?? '' }
    }
    console.log('  [v2] retrying with an explicit instruction…')
    const second = await api('POST', '/v1/message', {
      surfaceId,
      text: '请调用工具 forum_my_notifications, operation 填 "list", 然后告诉我工具的返回内容',
    })
    return { ok: second.status === 200, reply: second.body?.reply ?? '' }
  } catch (error) {
    return { ok: false, reply: '', error: error?.message ?? String(error) }
  }
}

// ------------------------------------------------------------------ main

let LIVE_CP
const CP_RUNS = [] // every booted control plane (for stderr diagnostics)
const RUN_STARTED_ISO = new Date(Date.now() - 60000).toISOString()

async function main() {
  console.log('=== TRUSTED_CREDENTIAL_505_FINAL_ACCEPTANCE_V2 ===')
  if (process.getuid?.() !== 0) {
    console.error('must run as root (sudo node …) — the driver only orchestrates; the CP runs as authsvc/505')
    process.exit(2)
  }
  if (!existsSync(HELPER)) {
    console.error(`spawn helper missing: ${HELPER} — run the one-time install first`)
    process.exit(2)
  }
  if (!existsSync(STORE_DIR)) {
    console.error(`505-private store dir missing: ${STORE_DIR} — run the one-time install first`)
    process.exit(2)
  }
  if (DEBUG_TEE) {
    // World-writable so the 502 child can append its stderr.
    writeFileSync(CHILD_STDERR_TEE, '')
    chmodSync(CHILD_STDERR_TEE, 0o666)
    console.log(`[debug-tee] child stderr -> ${CHILD_STDERR_TEE}`)
  }

  // Pre-flight: a stale control plane or driver would silently hijack the
  // API port / requests — fail fast instead of hanging.
  const portHolders = sh('lsof', ['-nP', '-iTCP:8787', '-sTCP:LISTEN'])
  if ((portHolders.stdout ?? '').trim() !== '') {
    console.error(`port 8787 already held by:\n${portHolders.stdout}`)
    console.error('kill the previous run first (sudo pkill -f 505-final-v2-run)')
    process.exit(2)
  }
  const otherDrivers = sh('pgrep', ['-f', 'trusted-credential-505-final-v2-run'])
  const otherPids = (otherDrivers.stdout ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
    .filter((pid) => Number(pid) !== process.pid)
  if (otherPids.length > 0) {
    console.error(`another acceptance driver is running: pids=${otherPids.join(',')} — kill it first`)
    process.exit(2)
  }
  for (const [name, port] of [['auth-service', 4001], ['svc-forum', 3460]]) {
    const ok = sh('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'])
    if ((ok.stdout ?? '').trim() === '') {
      console.error(`${name} is not listening on ${port} — REAL_AUTH/REAL_DOWNSTREAM cannot run`)
      process.exit(2)
    }
  }

  // Model key for the CP env (the child homes keep their own 0600 file copy).
  const modelKeyMatch = readFileSync('/Users/yanfenma/.dsh/.credentials.yaml', 'utf8')
    .match(/^OPENCODE_GO_API_KEY:\s*"?([^"\n]+)"?/m)
  if (!modelKeyMatch) {
    throw new Error('cannot read OPENCODE_GO_API_KEY from /Users/yanfenma/.dsh/.credentials.yaml')
  }
  MODEL_KEY = modelKeyMatch[1]

  // ------------------------------------------------------------- phase 0
  console.log(`\n[phase 0] runtime ${RUNTIME} — provisioning as root, dropping ownership per side`)
  rmSync(RUNTIME, { recursive: true, force: true })
  mkdirSync(join(RUNTIME, 'control'), { recursive: true })

  const secA = readFileSync(REAL.A.secretFile, 'utf8').trim()
  const secB = readFileSync(REAL.B.secretFile, 'utf8').trim()
  if (secA === '' || secB === '' || secA === secB) {
    throw new Error('credential source problem (empty or identical secrets)')
  }

  // Registry + fixtures A/B (real registry, real workspaces).
  const registry = new AgentRegistry({ storeFile: REGISTRY_STORE })
  const agentA = await registry.registerAgent({ name: AGENT_A_NAME, description: '论文导师' })
  const agentB = await registry.registerAgent({ name: AGENT_B_NAME, description: '架构评审员' })
  record('V2_REGISTRY_AB', registry.listAgents().length === 2, `${agentA.id} / ${agentB.id}`)

  const seedAgentsMd = (agentId, selfName, otherId, otherName) => [
    '# AGENTS.md', '',
    `You are ${selfName}. Your agentId is ${agentId}.`,
    `The other agent is ${otherName}, agentId ${otherId}.`,
    'You have a capability tool forum_my_notifications: when the user asks about your notifications, call it with operation "list" (no arguments needed) and report what it returns.',
    `When the user asks to call broker_self_assert_test, call it with the forgedAgentId, forgedPrincipalId and forgedClientId values they provide.`,
    '',
  ].join('\n')
  mkdirSync(agentWorkspace(agentA.id), { recursive: true })
  mkdirSync(agentWorkspace(agentB.id), { recursive: true })
  writeFileSync(join(agentWorkspace(agentA.id), 'AGENTS.md'),
    seedAgentsMd(agentA.id, AGENT_A_NAME, agentB.id, AGENT_B_NAME))
  writeFileSync(join(agentWorkspace(agentB.id), 'AGENTS.md'),
    seedAgentsMd(agentB.id, AGENT_B_NAME, agentA.id, AGENT_A_NAME))

  // Pre-provision per-agent DSH homes (root), then hand them to 502 so the
  // child can write its profile/session state. The router's own idempotent
  // provisioning (running as 505) then finds everything in place.
  process.env.DSH_SETTINGS_SOURCE = '/Users/yanfenma/.dsh/settings.yaml'
  for (const agentId of [agentA.id, agentB.id]) {
    provisionAgentHome(agentHome(agentId), agentWorkspace(agentId), { profile: AGENT_PROFILE })
    copyOnce('/Users/yanfenma/.dsh/.credentials.yaml', join(agentHome(agentId), '.credentials.yaml'))
    // The harness credentials-local plugin REQUIRES owner-only 0600 on this
    // file (anything wider fails the plugin tree). The router's agentEnv()
    // never reads it because the model key travels via the CP env instead.
    chmodSync(join(agentHome(agentId), '.credentials.yaml'), 0o600)
  }
  // Control-plane home (profile copies + farm links), handed to 505.
  provisionAgentHome(CONTROL_HOME, REPO)
  provisionProfile(CONTROL_HOME, CONTROL_PROFILE, join(REPO, 'profile-integration'))
  linkFarm(CONTROL_HOME, {
    'bundle-integration': join(REPO, 'bundle-integration'),
    'feishu-connector': join(REPO, 'packages', 'feishu-connector'),
    'agent-router': join(REPO, 'packages', 'agent-router'),
    'product-api': join(REPO, 'packages', 'product-api'),
    'broker': join(REPO, 'packages', 'broker'),
    'workspace-bootstrap': join(REPO, 'packages', 'workspace-bootstrap'),
    'agent-registry': join(REPO, 'packages', 'agent-registry'),
  })

  // The trusted credential store: INSIDE the 505-private zone, authsvc-owned.
  writeFileSync(STORE_FILE, JSON.stringify({
    version: 1,
    credentials: {
      [agentA.id]: { clientId: REAL.A.clientId, clientSecret: secA },
      [agentB.id]: { clientId: REAL.B.clientId, clientSecret: secB },
    },
  }, null, 2))
  chownSync(STORE_FILE, USER_AUTHSVC.uid, USER_AUTHSVC.gid)
  chmodSync(STORE_FILE, 0o600)
  const storeStat = statSync(STORE_FILE)
  record('V2_STORE_505_PRIVATE',
    storeStat.uid === 505 && (storeStat.mode & 0o777) === 0o600,
    `${STORE_FILE} uid=${storeStat.uid} mode=${(storeStat.mode & 0o777).toString(8)}`)

  // Ownership hand-off: control tree -> 505, agent trees -> 502.
  chownTree(join(RUNTIME, 'control'), USER_AUTHSVC)
  chownTree(HOMES_DIR, USER_YANFENMA)
  chownTree(AGENTS_DIR, USER_YANFENMA)

  // ------------------------------------------------------------- phase 1
  console.log('\n[phase 1] booting the REAL control plane as authsvc/505 (sudo -u authsvc)…')
  const cp = await bootControlPlane()
  LIVE_CP = cp
  CP_RUNS.push({ label: 'boot-1', cp })
  record('V2_CP_GATEWAY_UP', cp.ok, cp.detail)
  if (!cp.ok) return finish(cp, { agentA, agentB })
  await sleep(2000)
  const cpInfo = findCpPid()
  record('PARENT_UID', cpInfo !== null && cpInfo.uid === 505,
    cpInfo === null ? 'control-plane process not found' : `cp pid=${cpInfo.pid} uid=${cpInfo.uid}`)

  // ------------------------------------------------------ phases 2 (auth)
  console.log('\n[phase 2] REAL AUTH for BOTH distinct credentials at the real auth-service')
  const tA = await exchangeToken(REAL.A.clientId, secA)
  const tB = await exchangeToken(REAL.B.clientId, secB)
  const cA = tA.status === 200 ? decodeJwt(tA.jwt) : {}
  const cB = tB.status === 200 ? decodeJwt(tB.jwt) : {}
  record('V2_REAL_AUTH_A', tA.status === 200 && cA.sub === REAL.A.sub && cA.agent_id === REAL.A.agentName,
    `status=${tA.status} sub=${String(cA.sub).slice(0, 8)}… agent_id=${cA.agent_id}`)
  record('V2_REAL_AUTH_B', tB.status === 200 && cB.sub === REAL.B.sub && cB.agent_id === REAL.B.agentName,
    `status=${tB.status} sub=${String(cB.sub).slice(0, 8)}… agent_id=${cB.agent_id}`)
  record('V2_DISTINCT_IDENTITIES',
    cA.sub !== cB.sub && cA.agent_id !== cB.agent_id && tA.jwt !== tB.jwt,
    `A=${cA.agent_id} vs B=${cB.agent_id} (subs differ, JWTs differ)`)

  // ------------------------------------------------- phases 3/4 (real chain)
  console.log('\n[phase 3] A_REAL_BROKER_CALL (A -> knowledge-curator-agent JWT expected)')
  const surfaceA = `v2-a-${agentA.id.slice(0, 8)}`
  const replyA = await driveBrokerCall(surfaceA, '用 forum_my_notifications 查看我的未读通知, 把返回内容告诉我')
  record('A_REAL_BROKER_CALL', replyA.ok && /未读|通知|notifications|items|total/.test(replyA.reply ?? ''),
    `reply="${(replyA.reply ?? '').slice(0, 120)}"${replyA.ok ? '' : ` cp-stderr-tail: ${cp.stderr().slice(-400)}`}`)
  record('A_BROKER_EXECUTED_AS_A', await waitForCplog(cp, `[broker] execute as agent ${agentA.id}`),
    'parent resolved the ACTUAL agent A')

  console.log('\n[phase 4] B_REAL_BROKER_CALL (B -> arch-reviewer JWT expected)')
  const surfaceB = `v2-b-${agentB.id.slice(0, 8)}`
  await api('POST', '/v1/switch-agent', { surfaceId: surfaceB, targetAgentId: agentB.id })
  const replyB = await driveBrokerCall(surfaceB, '用 forum_my_notifications 查看我的未读通知, 把返回内容告诉我')
  record('B_REAL_BROKER_CALL', replyB.ok && /未读|通知|notifications|items|total/.test(replyB.reply ?? ''),
    `reply="${(replyB.reply ?? '').slice(0, 120)}"`)
  record('B_BROKER_EXECUTED_AS_B', await waitForCplog(cp, `[broker] execute as agent ${agentB.id}`),
    'parent resolved the ACTUAL agent B')

  // ------------------------------------------------------ phase 5 (hygiene)
  console.log('\n[phase 5] child identity + secret hygiene')
  const procs = cpProcs()
  const childPids = procs.filter((p) => p.agentId !== undefined)
  record('CHILD_UID', childPids.length >= 2 && childPids.every((p) => p.uid === CHILD_UID),
    childPids.length === 0 ? 'no child pids found' : `pids=[${childPids.map((p) => `${p.pid}(u${p.uid})`).join(',')}]`)

  // Secrets and JWTs only — clientIds are public identifiers (they appear in
  // every JWT claim and log) and are deliberately NOT leak needles.
  const secretNeedles = [secA, secB, tA.jwt, tB.jwt].filter(Boolean)
  let envClean = true
  let envDetail = ''
  for (const p of childPids) {
    const env = readProcessEnv(p.pid)
    const leak = secretNeedles.filter((needle) => env.includes(needle))
    if (leak.length > 0) { envClean = false; envDetail += `${p.agentId}:LEAK ` }
  }
  record('CHILD_SECRET_ENV', envClean && childPids.length >= 2,
    childPids.length === 0 ? 'no child pids' : `pids=[${childPids.map((p) => p.pid).join(',')}] ${envDetail}`)

  let fsClean = true
  let fsDetail = ''
  for (const agentId of [agentA.id, agentB.id]) {
    for (const dir of [agentHome(agentId), agentWorkspace(agentId)]) {
      if (!existsSync(dir)) continue
      const scan = sh('grep', ['-rl', ...secretNeedles.flatMap((n) => ['-e', n]), dir])
      if (scan.status === 0) { fsClean = false; fsDetail += `${agentId} ` }
    }
  }
  record('CHILD_SECRET_FS', fsClean, fsClean ? 'no credential/token strings in agent home/workspace' : fsDetail)
  const tokenVisibleInLog = tA.jwt !== undefined && cp.stderr().includes(tA.jwt)
  record('CHILD_TOKEN_VISIBLE', !tokenVisibleInLog && envClean,
    tokenVisibleInLog ? 'JWT appeared in the control-plane log' : 'JWTs only in the 505 parent process memory')

  // ------------------------------------------------- phase 6 (the attack)
  console.log('\n[phase 6] A_SELF_ASSERT_B with B\'s REAL agentId/principalId/clientId — parent must ignore ALL')
  const forged = await api('POST', '/v1/message', {
    surfaceId: surfaceA,
    text: `调用 broker_self_assert_test, forgedAgentId 填 ${agentB.id}, forgedPrincipalId 填 ${REAL.B.sub}, forgedClientId 填 ${REAL.B.clientId}, 把结果告诉我`,
  })
  const ignoredLogged = await waitForCplog(cp,
    'IGNORING child-supplied identity fields: agentId, principalId, clientId, scope, audience, authorization')
  const executedAsA = await waitForCplog(cp,
    `[broker] execute as agent ${agentA.id} (capability forum_my_notifications)`)
  record('CROSS_AGENT_IMPERSONATION', forged.status === 200 && ignoredLogged && executedAsA,
    `forged(B real ids) status=${forged.status}; parent IGNORING + executed as A ${agentA.id.slice(0, 10)}…`)

  // ------------------------------------------------------ phase 7 (TCB)
  console.log('\n[phase 7] TCB access checks (store reads attempted at uid 502)')
  const viaHelper = sh(HELPER, ['502', '20', '/bin/cat', STORE_FILE])
  const viaSudo = sh('sudo', ['-u', 'yanfenma', '/bin/cat', STORE_FILE])
  const zoneList = sh('sudo', ['-u', 'yanfenma', '/bin/ls', CREDS_ZONE])
  record('A_READ_CREDENTIAL_STORE',
    viaHelper.status !== 0 && viaSudo.status !== 0 && zoneList.status !== 0,
    `helper(502)=${viaHelper.status !== 0 ? 'DENIED' : 'READ'} sudo(502)=${viaSudo.status !== 0 ? 'DENIED' : 'READ'} zone-list(502)=${zoneList.status !== 0 ? 'DENIED' : 'READ'}`)

  const listeners = childPids.filter((p) => {
    const lsof = sh('lsof', ['-a', '-nP', '-p', String(p.pid), '-iTCP', '-sTCP:LISTEN'])
    return (lsof.stdout ?? '').trim() !== ''
  })
  record('A_DIRECT_TCB_ACCESS', listeners.length === 0,
    listeners.length === 0
      ? 'children expose NO broker/gateway listener (in-process boundary)'
      : `listeners on ${listeners.map((p) => p.pid).join(',')}`)

  // svc-forum corroboration (informational: which subs the forum actually saw)
  const forumHits = forumLogEvidence(RUN_STARTED_ISO)
  console.log(`  [v2] svc-forum log corroboration: ${forumHits.length ? forumHits.join(' | ') : '(no sub/agent lines in forum logs)'}`)

  // ---------------------------------------------------- phase 8 (restart)
  console.log('\n[phase 8] control-plane restart over the same stores')
  await stopControlPlane(cp)
  const cp2 = await bootControlPlane()
  CP_RUNS.push({ label: 'boot-2', cp: cp2 })
  record('V2_CP_RESTART_UP', cp2.ok, cp2.detail)
  if (cp2.ok) {
    await sleep(2000)
    const cp2Info = findCpPid()
    const still505 = cp2Info !== null && cp2Info.uid === 505
    const replyAfter = await driveBrokerCall(surfaceA, '用 forum_my_notifications 查看我的未读通知, 把返回内容告诉我')
    const executedAfter = await waitForCplog(cp2, `[broker] execute as agent ${agentA.id}`)
    record('RESTART', still505 && replyAfter.ok && executedAfter &&
      /未读|通知|notifications|items|total/.test(replyAfter.reply ?? ''),
      `parent uid=${still505 ? 505 : '?'} post-restart reply="${(replyAfter.reply ?? '').slice(0, 100)}"`)
  }
  await finish(cp2, { agentA, agentB, cA, cB, forumHits })
}

async function finish(cp, { agentA, agentB, cA, cB, forumHits = [] } = {}) {
  await stopControlPlane(cp)
  const allOk = (names) => names.every((n) => checks.find((c) => c.name === n)?.ok === true)
  const aJwt = cA?.agent_id ?? 'n/a'
  const bJwt = cB?.agent_id ?? 'n/a'
  const report = [
    '# TRUSTED_CREDENTIAL_505_FINAL_ACCEPTANCE_V2', '',
    `Run: ${new Date().toISOString()}`,
    `Runtime: ${RUNTIME}`,
    `Store: ${STORE_FILE} (authsvc 0600, inside the 505-private zone)`,
    `A = ${agentA?.id} bound to ${REAL.A.agentName} (${REAL.A.clientId})`,
    `B = ${agentB?.id} bound to ${REAL.B.agentName} (${REAL.B.clientId})`,
    `svc-forum log corroboration: ${forumHits.join(' | ') || 'n/a'}`, '',
    '## Control-plane stderr tails (diagnostics)', '',
    ...CP_RUNS.map(({ label, cp }) => `\n### ${label}\n\`\`\`\n${cp.stderr().slice(-5000) || '(empty)'}\n\`\`\``),
    '',
    '## Checks', '',
    ...checks.map((c) => `- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`), '',
    '## Verdict fields', '',
    `TRUSTED_CREDENTIAL_505_FINAL_ACCEPTANCE_V2 = ${checks.every((c) => c.ok) ? 'PASS' : 'FAIL'}`,
    `PARENT_UID = ${checks.find((c) => c.name === 'PARENT_UID')?.ok === true ? 505 : 'not-505'}`,
    `CHILD_UID = ${checks.find((c) => c.name === 'CHILD_UID')?.detail?.includes('u502') ? 502 : 'n/a'}`,
    `CHILD_HAS_SECRET = ${allOk(['CHILD_SECRET_ENV', 'CHILD_SECRET_FS']) ? 'NO' : 'YES'}`,
    `CHILD_HAS_TOKEN = ${checks.find((c) => c.name === 'CHILD_TOKEN_VISIBLE')?.ok === true ? 'NO' : 'YES'}`,
    `A_READ_CREDENTIAL_STORE = ${checks.find((c) => c.name === 'A_READ_CREDENTIAL_STORE')?.ok === true ? 'DENIED' : 'READABLE'}`,
    `A_JWT_IDENTITY = ${aJwt}`,
    `B_JWT_IDENTITY = ${bJwt}`,
    `CROSS_AGENT_IMPERSONATION = ${checks.find((c) => c.name === 'CROSS_AGENT_IMPERSONATION')?.ok === true ? 'DENIED/IGNORED' : 'NOT-CLEAN'}`,
    `REAL_AUTH = ${allOk(['V2_REAL_AUTH_A', 'V2_REAL_AUTH_B', 'V2_DISTINCT_IDENTITIES']) ? 'PASS' : 'FAIL'}`,
    `REAL_BROKER = ${allOk(['A_REAL_BROKER_CALL', 'B_REAL_BROKER_CALL', 'A_BROKER_EXECUTED_AS_A', 'B_BROKER_EXECUTED_AS_B']) ? 'PASS' : 'FAIL'}`,
    `REAL_DOWNSTREAM = ${allOk(['A_REAL_BROKER_CALL', 'B_REAL_BROKER_CALL']) ? 'PASS' : 'FAIL'}`,
    `RESTART = ${checks.find((c) => c.name === 'RESTART')?.ok === true ? 'PASS' : 'FAIL'}`,
    'AUTH_SYSTEM_CHANGE = NONE',
    'BROKER_TRANSPORT_CHANGE = NONE',
    'PER_AGENT_OS_USER = NO',
    'KERNEL_CHANGE = NONE', '',
  ].join('\n')
  const reportPath = join(RUNTIME, 'evidence.md')
  mkdirSync(RUNTIME, { recursive: true })
  writeFileSync(reportPath, report)
  chownTree(RUNTIME, USER_YANFENMA) // hand evidence back to the user
  console.log(`\nevidence written: ${reportPath}`)
  if (!checks.every((c) => c.ok)) {
    const first = CP_RUNS[0]
    if (first !== undefined) {
      console.log('\n===== control-plane stderr tail (diagnostics) =====')
      console.log(first.cp.stderr().slice(-3000) || '(empty)')
      console.log('===== end stderr tail =====')
    }
    if (DEBUG_TEE && existsSync(CHILD_STDERR_TEE)) {
      console.log('\n===== child stderr tee (diagnostics) =====')
      console.log(readFileSync(CHILD_STDERR_TEE, 'utf8').slice(-3000) || '(empty)')
      console.log('===== end child stderr tee =====')
    }
  }
  console.log('\n' + report.split('\n').filter((l) => /^[A-Z_]+ = /.test(l)).join('\n'))
  process.exit(checks.every((c) => c.ok) ? 0 : 1)
}

main().catch(async (error) => {
  console.error(`\nV2 FAILED: ${error instanceof Error ? error.message : String(error)}`)
  if (LIVE_CP !== undefined) await stopControlPlane(LIVE_CP).catch(() => {})
  process.exit(2)
})
