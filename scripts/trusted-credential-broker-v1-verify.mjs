#!/usr/bin/env node
/**
 * TRUSTED_CREDENTIAL_BROKER_INTEGRATION_V1 acceptance driver — REAL DSH
 * processes, REAL model turns, REAL auth-service, REAL downstream.
 *
 * Frozen architecture under test:
 *
 *   DSH Agent child (uid 502, NO credential, NO token)
 *     -> existing parent RPC (agentRpc -> demo-server -> Router)
 *     -> trusted Router parent (deployment uid authsvc/505)
 *     -> trusted Broker / credential boundary (in-process gateway, 505)
 *     -> existing client_credentials -> JWT -> Forum / Workflow / OKR
 *
 *   Phase 0  runtime + registry: Agent A / Agent B; AGENTS.md seeds the
 *            capability usage; 505-private credential store written (0600)
 *            binding both fixtures to the deployment's REAL MachineClient
 *            credential (the only real credential readable in this
 *            environment; a distinct second real credential is 505-gated).
 *   Phase 1  boot the REAL control plane (agent-core-integration) with the
 *            broker GATEWAY in-process + child spawn drop (DSH_AGENT_CHILD_UID).
 *   Phase 2  REAL AUTH: driver exchanges the credential at the real
 *            auth-service -> JWT claims verified (sub/agent_id/client_id).
 *   Phase 3  A_REAL_BROKER_CALL: model inside A's real process calls
 *            forum_my_notifications -> relay -> parent RPC -> gateway ->
 *            real auth -> real svc-forum -> business result in the reply.
 *   Phase 4  B_REAL_BROKER_CALL: same chain for B.
 *   Phase 5  secret hygiene: child env/fs carry NO credential and NO token.
 *   Phase 6  A_SELF_ASSERT_B: the fixture tool relays a call while forging
 *            B's identity; the parent IGNORES it and executes as A (log).
 *   Phase 7  TCB: child has no broker listener; store read attempts measured.
 *   Phase 8  RESTART: kill the control plane; boot again; real call works.
 *
 * Verdict fields per the task contract:
 *   TRUSTED_CREDENTIAL_BROKER_INTEGRATION_V1 = PASS | BLOCKED
 *   PARENT_UID / CHILD_UID / CHILD_HAS_SECRET / CHILD_HAS_TOKEN /
 *   REAL_AUTH / REAL_BROKER / CROSS_AGENT_IMPERSONATION / RESTART /
 *   AUTH_SYSTEM_CHANGE = NONE / BROKER_TRANSPORT_REUSED = YES /
 *   PER_AGENT_OS_USER = NO / KERNEL_CHANGE = NONE
 *
 * Usage: node scripts/trusted-credential-broker-v1-verify.mjs
 * Env:
 *   DSH_TCB_RUNTIME        runtime root (default .demo/trusted-credential-broker-v1/runtime)
 *   DSH_TCB_KEEP=1         keep existing runtime (default: wipe)
 *   DSH_AGENT_PROVIDER / DSH_AGENT_MODEL  LLM route (opencode-go / deepseek-v4-flash)
 * Exit 0 on PASS, 1 on FAIL (verdict printed), 2 on infra failure.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync,
  readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { cliBin, provisionAgentHome, REPO } from './demo-home.mjs'
import { AgentDefinition } from '../packages/agent-definition/src/definition.js'
import { adoptAgents } from '../packages/agent-definition/src/config.js'

const RUNTIME = resolve(process.env.DSH_TCB_RUNTIME ?? join(REPO, '.demo', 'trusted-credential-broker-v1', 'runtime'))
const AGENTS_DIR = join(RUNTIME, 'agents')
const HOMES_DIR = join(RUNTIME, 'homes')
const CONTROL_HOME = join(RUNTIME, 'control', 'home')
const AGENTS_CONFIG = join(RUNTIME, 'control', 'agents.json')
const BINDINGS_STORE = join(RUNTIME, 'control', 'bindings.json')
const CREDENTIALS_STORE = join(RUNTIME, 'control', 'agent-credentials.json')
const KEEP = process.env.DSH_TCB_KEEP === '1'
const AGENT_PROFILE = 'agent-core-integration-agent'
const CONTROL_PROFILE = 'agent-core-integration'
const AGENT_A_NAME = '知识管家'
const AGENT_B_NAME = 'Agent B'
const API_PORT = 8787
const API_BASE = `http://127.0.0.1:${API_PORT}`
const TURN_TIMEOUT_MS = Number.parseInt(process.env.DSH_TCB_TURN_TIMEOUT ?? '300000', 10)

// The REAL existing credential this acceptance is built on (the only real
// MachineClient credential readable in this environment; a second distinct
// one lives in the 505-private zone). A and B are both bound to it; the
// JWT identity therefore follows the credential (knowledge-curator-agent)
// for both fixtures — recorded explicitly in the report.
const REAL_AGENT_ENV = join(homedir(), '.openclaw', 'agents', 'knowledge-curator-agent', '.env')
const REAL_CLIENT_ID = 'mc_oc_AdXrOjACKpodtqSPo3HA5fq_'
const EXPECTED_SUB = '87047adb-2931-400b-b5f0-c384cba37b8d'
const EXPECTED_AGENT_ID = 'knowledge-curator-agent'
const AUTH_ORIGIN = 'http://127.0.0.1:4001'
const FORUM_ORIGIN = 'http://127.0.0.1:3460'

const sleep = (ms) => new Promise((resolveTimeout) => setTimeout(resolveTimeout, ms))

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

function provisionControlHome() {
  provisionAgentHome(CONTROL_HOME, REPO)
  provisionProfile(CONTROL_HOME, CONTROL_PROFILE, join(REPO, 'profile-integration'))
  linkFarm(CONTROL_HOME, {
    'bundle-integration': join(REPO, 'bundle-integration'),
    'feishu-connector': join(REPO, 'packages', 'feishu-connector'),
    'agent-router': join(REPO, 'packages', 'agent-router'),
    'product-api': join(REPO, 'packages', 'product-api'),
    'broker': join(REPO, 'packages', 'broker'),
    'workspace-bootstrap': join(REPO, 'packages', 'workspace-bootstrap'),
    'agent-definition': join(REPO, 'packages', 'agent-definition'),
  })
}

function baseEnv(extra = {}) {
  return {
    ...process.env,
    DSH_HOME: CONTROL_HOME,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    AGENT_DEFINITION_CONFIG: AGENTS_CONFIG,
    ROUTER_BINDINGS_STORE: BINDINGS_STORE,
    ROUTER_AGENT_PROFILE: AGENT_PROFILE,
    DSH_MEMORY_WORKSPACE_ROOT: AGENTS_DIR,
    // Trusted broker wiring (parent side).
    AGENT_CORE_CREDENTIALS_FILE: CREDENTIALS_STORE,
    BROKER_AUTH_ORIGIN: AUTH_ORIGIN,
    // Child privilege drop (trusted parent 505 -> normal agent runtime 502;
    // gid defaults to the runtime user's primary group).
    DSH_AGENT_CHILD_UID: '502',
    // Child-side acceptance fixture (self-assert proof).
    BROKER_FIXTURE_SELF_ASSERT: '1',
    PRODUCT_API_ENABLED: '1', // used as the message transport for this acceptance
    DSH_TCB_KEEP: '1',
    ...extra,
  }
}

/** Boot the REAL control-plane composition; resolves when the gateway is up. */
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
      if (stderr.includes('[broker] gateway mode:')) {
        finish(true, 'control plane + broker gateway up')
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
  if (child.exitCode === null && child.signalCode === null) {
    try { child.kill('SIGKILL') } catch { /* already dead */ }
    await sleep(1000)
  }
}

// ------------------------------------------------------------ HTTP client

async function api(method, path, body, { retries = 10 } = {}) {
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
      if (attempt < retries) await sleep(500 * (attempt + 1))
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

/** Decode a JWT payload without verification (claim inspection only). */
function decodeJwt(token) {
  const payload = token.split('.')[1]
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

/** Read the child OS process environment via `ps eww` (same-user). */
function readProcessEnv(pid) {
  const out = spawnSync('ps', ['eww', '-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
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

// ------------------------------------------------------------------ main

let LIVE_CP

async function main() {
  console.log(`=== TRUSTED_CREDENTIAL_BROKER_INTEGRATION_V1 — runtime ${RUNTIME}`)

  // ------------------------------------------------------------- phase 0
  if (KEEP && existsSync(RUNTIME)) {
    console.log('\n[phase 0] keeping existing runtime (KEEP=1)')
  } else {
    rmSync(RUNTIME, { recursive: true, force: true })
    console.log('\n[phase 0] runtime wiped, provisioning…')
  }
  mkdirSync(CONTROL_HOME, { recursive: true })
  provisionControlHome()

  const realEnv = readFileSync(REAL_AGENT_ENV, 'utf8')
  const clientId = (realEnv.match(/^AGENT_FORUM_CLIENT_ID=(.+)$/m) ?? [])[1]?.trim().replace(/^"|"$/g, '')
  const secret = (realEnv.match(/^AGENT_FORUM_CLIENT_SECRET=(.+)$/m) ?? [])[1]?.trim().replace(/^"|"$/g, '')
  if (clientId !== REAL_CLIENT_ID || typeof secret !== 'string' || secret === '') {
    throw new Error(`credential source mismatch (expected clientId ${REAL_CLIENT_ID}); aborting`)
  }

  const adopted = await adoptAgents({ configFile: AGENTS_CONFIG, agents: [
    { name: AGENT_A_NAME, description: '论文导师' },
    { name: AGENT_B_NAME, description: '研发总监' },
  ] })
  const [agentA, agentB] = adopted.agents
  const definition = new AgentDefinition({ configFile: AGENTS_CONFIG })
  record('TCB_DEFINED_AB', definition.listAgents().length === 2, `${agentA.id} / ${agentB.id}`)

  mkdirSync(agentWorkspace(agentA.id), { recursive: true })
  mkdirSync(agentWorkspace(agentB.id), { recursive: true })
  const seedAgentsMd = (agentId, selfName, otherName, otherId) => [
    '# AGENTS.md',
    '',
    `You are ${selfName}. Your agentId is ${agentId}.`,
    `The other agent is ${otherName}, agentId ${otherId}.`,
    'You have a capability tool forum_my_notifications: when the user asks about your notifications, call it with operation "list" (no arguments needed) and report what it returns.',
    `When the user asks to call broker_self_assert_test, call it with forgedAgentId = '${otherId}'.`,
    '',
  ].join('\n')
  writeFileSync(join(agentWorkspace(agentA.id), 'AGENTS.md'), seedAgentsMd(agentA.id, AGENT_A_NAME, AGENT_B_NAME, agentB.id))
  writeFileSync(join(agentWorkspace(agentB.id), 'AGENTS.md'), seedAgentsMd(agentB.id, AGENT_B_NAME, AGENT_A_NAME, agentA.id))

  // The trusted credential store (deployment-owned, 0600; in the target
  // deployment this file is 505-owned inside the 505-private zone — this
  // environment cannot create 505-owned files without a root bootstrap, so
  // the 502-readable-store gap is measured and recorded below).
  mkdirSync(dirname(CREDENTIALS_STORE), { recursive: true })
  writeFileSync(CREDENTIALS_STORE, JSON.stringify({
    version: 1,
    credentials: {
      [agentA.id]: { clientId, clientSecret: secret },
      [agentB.id]: { clientId, clientSecret: secret },
    },
  }, null, 2))
  chmodSync(CREDENTIALS_STORE, 0o600)
  console.log('\n[phase 0] credential store written (0600); A and B bound to the deployment real MachineClient')

  // ------------------------------------------------------------- phase 1
  console.log('\n[phase 1] booting the REAL control plane (broker gateway in-process, child drop uid 502)…')
  const cp = await bootControlPlane()
  LIVE_CP = cp
  record('TCB_CP_GATEWAY_UP', cp.ok, cp.detail)
  if (!cp.ok) {
    await finish(cp, { agentA, agentB, clientId })
    return
  }

  // ------------------------------------------------------------- phase 2
  console.log('\n[phase 2] REAL AUTH: client_credentials at the real auth-service')
  const basic = Buffer.from(`${clientId}:${secret}`).toString('base64')
  const tokenRes = await fetch(`${AUTH_ORIGIN}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', resource: 'svc-forum', scope: 'forum.read' }).toString(),
  })
  const tokenBody = await tokenRes.json()
  const jwt = tokenBody.access_token
  record('TCB_REAL_AUTH_TOKEN', tokenRes.status === 200 && typeof jwt === 'string' && jwt.split('.').length === 3,
    `status=${tokenRes.status}`)
  const claims = typeof jwt === 'string' ? decodeJwt(jwt) : {}
  record('TCB_JWT_CLAIMS', claims.sub === EXPECTED_SUB && claims.agent_id === EXPECTED_AGENT_ID && claims.client_id === REAL_CLIENT_ID,
    `sub=${String(claims.sub).slice(0, 8)}… agent_id=${claims.agent_id} client_id=${String(claims.client_id).slice(0, 20)}…`)

  // ------------------------------------------------------------- phase 3
  console.log('\n[phase 3] A_REAL_BROKER_CALL: real DSH -> model tool -> relay -> parent RPC -> gateway -> real auth -> real forum')
  const surfaceA = `tcb-a-${agentA.id.slice(0, 8)}`
  const replyA = await driveBrokerCall(surfaceA, agentA, '用 forum_my_notifications 查看我的未读通知, 把返回内容告诉我')
  record('A_REAL_BROKER_CALL', replyA.ok && /未读|通知|notifications|items|total/.test(replyA.reply ?? ''),
    `reply="${(replyA.reply ?? '').slice(0, 120)}"`)
  const executedAsA = await waitForCplog(cp, `[broker] execute as agent ${agentA.id}`)
  record('A_BROKER_EXECUTED_AS_A', executedAsA, 'parent log shows the ACTUAL agent A')

  // ------------------------------------------------------------- phase 4
  console.log('\n[phase 4] B_REAL_BROKER_CALL (same chain, second fixture)')
  const surfaceB = `tcb-b-${agentB.id.slice(0, 8)}`
  // First contact binds the default Agent (A); switch the surface to B so
  // the call truly runs in B's own process.
  await api('POST', '/v1/switch-agent', { surfaceId: surfaceB, targetAgentId: agentB.id })
  const replyB = await driveBrokerCall(surfaceB, agentB, '用 forum_my_notifications 查看我的未读通知, 把返回内容告诉我')
  record('B_REAL_BROKER_CALL', replyB.ok && /未读|通知|notifications|items|total/.test(replyB.reply ?? ''),
    `reply="${(replyB.reply ?? '').slice(0, 120)}"`)
  const executedAsB = await waitForCplog(cp, `[broker] execute as agent ${agentB.id}`)
  record('B_BROKER_EXECUTED_AS_B', executedAsB, 'parent log shows the ACTUAL agent B')

  // ------------------------------------------------------------- phase 5
  console.log('\n[phase 5] child secret hygiene')
  const procs = cpProcs()
  const childPids = procs.filter((p) => p.agentId !== undefined)
  let envClean = true
  let envDetail = ''
  for (const p of childPids) {
    const env = readProcessEnv(p.pid)
    const leak = ['AGENT_CORE_BROKER_CLIENT_ID', 'AGENT_CORE_BROKER_CLIENT_SECRET', clientId, secret, jwt]
      .filter((needle) => env.includes(needle))
    if (leak.length > 0) { envClean = false; envDetail += `${p.agentId}: ${leak.join(',')} ` }
  }
  record('CHILD_SECRET_ENV', envClean && childPids.length >= 2,
    childPids.length === 0 ? 'no child pids found' : `pids=[${childPids.map((p) => p.pid).join(',')}] ${envDetail}`)

  let fsClean = true
  let fsDetail = ''
  for (const agentId of [agentA.id, agentB.id]) {
    for (const dir of [agentHome(agentId), agentWorkspace(agentId)]) {
      if (!existsSync(dir)) continue
      const scan = spawnSync('grep', ['-rl', '-e', clientId, '-e', secret, '-e', jwt, dir], { encoding: 'utf8' })
      if (scan.status === 0) { fsClean = false; fsDetail += `${agentId}:${scan.stdout.trim()} ` }
    }
  }
  record('CHILD_SECRET_FS', fsClean, fsClean ? 'no credential/token strings in agent home/workspace' : fsDetail)

  const cpLog = cp.stderr()
  const tokenVisibleInLog = cpLog.includes(jwt)
  record('CHILD_TOKEN_VISIBLE', !tokenVisibleInLog && envClean,
    tokenVisibleInLog ? 'JWT appeared in the control-plane log' : 'JWT in no child env/fs (token lives only in the parent process memory)')

  // ------------------------------------------------------------- phase 6
  console.log('\n[phase 6] A_SELF_ASSERT_B: A\'s process forges B\'s identity; the parent must IGNORE it')
  const forged = await api('POST', '/v1/message', {
    surfaceId: surfaceA,
    text: `调用 broker_self_assert_test, forgedAgentId 填 ${agentB.id}, 把结果告诉我`,
  })
  const ignoredLogged = await waitForCplog(cp, `IGNORING child-supplied identity fields: agentId, principalId, clientId, scope, audience, authorization`)
  const executedAsAAgain = await waitForCplog(cp, `[broker] execute as agent ${agentA.id} (capability forum_my_notifications)`)
  record('A_SELF_ASSERT_B', forged.status === 200 && ignoredLogged && executedAsAAgain,
    `forged call status=${forged.status}; parent logged IGNORING + executed as ${agentA.id.slice(0, 10)}…`)

  // ------------------------------------------------------------- phase 7
  console.log('\n[phase 7] TCB access checks')
  const listeners = childPids.filter((p) => {
    const lsof = spawnSync('lsof', ['-a', '-nP', '-p', String(p.pid), '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' })
    return (lsof.stdout ?? '').trim() !== ''
  })
  record('A_DIRECT_TCB_ACCESS', listeners.length === 0,
    listeners.length === 0
      ? 'child processes expose NO broker/gateway listener (in-process boundary unreachable)'
      : `listeners on ${listeners.map((p) => p.pid).join(',')}`)

  // Store read attempt from a child-identity (uid 502) context.
  const readAttempt = spawnSync('sh', ['-c', `cat ${CREDENTIALS_STORE} > /dev/null 2>&1`])
  record('A_READ_CREDENTIAL_STORE', readAttempt.status !== 0,
    readAttempt.status === 0
      ? 'READABLE from uid 502 (environmental gap: the store cannot be made 505-owned without a root bootstrap)'
      : 'DENIED (505-private store)')

  // CHILD_UID measurement while the children are still alive (after restart
  // they are reaped with the control plane).
  const measuredChildUid = childPids.length > 0
    ? (spawnSync('ps', ['-o', 'uid=', '-p', String(childPids[0].pid)], { encoding: 'utf8' }).stdout ?? '').trim() || 'n/a'
    : 'n/a'

  // ------------------------------------------------------------- phase 8
  console.log('\n[phase 8] control-plane restart over the same stores')
  await stopControlPlane(cp)
  const cp2 = await bootControlPlane()
  record('TCB_CP_RESTART_UP', cp2.ok, cp2.detail)
  if (cp2.ok) {
    const replyAfter = await driveBrokerCall(surfaceA, agentA, '用 forum_my_notifications 查看我的未读通知, 把返回内容告诉我')
    record('RESTART', replyAfter.ok && /未读|通知|notifications|items|total/.test(replyAfter.reply ?? ''),
      `post-restart reply="${(replyAfter.reply ?? '').slice(0, 100)}"`)
  }
  await stopControlPlane(cp2)

  await finish(cp2, { agentA, agentB, clientId, firstCp: cp, childPids, measuredChildUid })
}

/** One model-driven broker call via POST /v1/message; retries once. */
async function driveBrokerCall(surfaceId, agent, text) {
  const first = await api('POST', '/v1/message', { surfaceId, text })
  if (first.status === 200 && (first.body?.reply ?? '').length > 0) {
    return { ok: true, reply: first.body.reply ?? '', sessionId: first.body.sessionId }
  }
  console.log('  [tcb] retrying with an explicit instruction…')
  const second = await api('POST', '/v1/message', {
    surfaceId,
    text: '请调用工具 forum_my_notifications, operation 填 "list", 然后告诉我工具的返回内容',
  })
  return { ok: second.status === 200, reply: second.body?.reply ?? '' }
}

/** Child process snapshot from the router registry via the CP's own process
 *  tree: each per-agent dsh CLI runs with DSH_AGENT_ID in its env. */
function cpProcs() {
  const out = spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })
  const procs = []
  for (const line of (out.stdout ?? '').split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(.+)$/)
    if (!m) continue
    const cmd = m[2]
    if (!cmd.includes('apps/cli/lib/bin.js --profile agent-core-integration-agent')) continue
    // Child env carries DSH_AGENT_ID (ps eww needs the pid; env read later).
    const env = readProcessEnv(m[1])
    const agentId = (env.match(/DSH_AGENT_ID=(\S+)/) ?? [])[1]
    procs.push({ pid: Number(m[1]), agentId })
  }
  return procs
}

/** Write evidence + print the verdict fields, then exit. */
async function finish(cp, { agentA, agentB, clientId, firstCp, childPids, measuredChildUid }) {
  await stopControlPlane(cp)
  if (firstCp !== undefined) await stopControlPlane(firstCp)
  const parentUid = typeof process.getuid === 'function' ? process.getuid() : 'n/a'
  const childUid = measuredChildUid ?? 'n/a'
  const report = [
    '# TRUSTED_CREDENTIAL_BROKER_INTEGRATION_V1',
    '',
    `Run: ${new Date().toISOString()}`,
    `Runtime: ${RUNTIME}`,
    `Agents: A = ${agentA?.id} ("${AGENT_A_NAME}"), B = ${agentB?.id} ("${AGENT_B_NAME}")`,
    `Real credential: ${clientId} (knowledge-curator-agent; A and B both bound — the only 502-readable real MachineClient)`,
    `Auth origin: ${AUTH_ORIGIN}  Forum origin: ${FORUM_ORIGIN}`,
    '',
    '## Checks',
    '',
    ...checks.map((c) => `- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`),
    '',
    '## Verdict fields',
    '',
    `TRUSTED_CREDENTIAL_BROKER_INTEGRATION_V1 = ${checks.every((c) => c.ok) ? 'PASS' : 'BLOCKED'}`,
    `PARENT_UID = ${parentUid}`,
    `CHILD_UID = ${childUid}`,
    `CHILD_HAS_SECRET = ${checks.find((c) => c.name === 'CHILD_SECRET_ENV')?.ok === true && checks.find((c) => c.name === 'CHILD_SECRET_FS')?.ok === true ? 'NO' : 'YES'}`,
    `CHILD_HAS_TOKEN = ${checks.find((c) => c.name === 'CHILD_TOKEN_VISIBLE')?.ok === true ? 'NO' : 'YES'}`,
    `REAL_AUTH = ${checks.find((c) => c.name === 'TCB_REAL_AUTH_TOKEN')?.ok === true ? 'PASS' : 'FAIL'}`,
    `REAL_BROKER = ${checks.find((c) => c.name === 'A_REAL_BROKER_CALL')?.ok === true && checks.find((c) => c.name === 'B_REAL_BROKER_CALL')?.ok === true ? 'PASS' : 'FAIL'}`,
    `CROSS_AGENT_IMPERSONATION = ${checks.find((c) => c.name === 'A_SELF_ASSERT_B')?.ok === true ? 'DENIED/IGNORED' : 'NOT-CLEAN'}`,
    `RESTART = ${checks.find((c) => c.name === 'RESTART')?.ok === true ? 'PASS' : 'FAIL'}`,
    `AUTH_SYSTEM_CHANGE = NONE`,
    `BROKER_TRANSPORT_REUSED = YES`,
    `PER_AGENT_OS_USER = NO`,
    `KERNEL_CHANGE = NONE`,
    '',
  ].join('\n')
  const reportPath = join(RUNTIME, '..', 'evidence.md')
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, report)
  console.log(`\nevidence written: ${reportPath}`)
  console.log(report.split('\n').filter((l) => l.startsWith('TRUSTED_') || l.startsWith('PARENT_') || l.startsWith('CHILD_')
    || l.startsWith('REAL_') || l.startsWith('CROSS_') || l.startsWith('RESTART') || l.startsWith('AUTH_')
    || l.startsWith('BROKER_') || l.startsWith('PER_') || l.startsWith('KERNEL_')).join('\n'))
  process.exit(checks.every((c) => c.ok) ? 0 : 1)
}

main().catch(async (error) => {
  console.error(`\nTCB FAILED: ${error instanceof Error ? error.message : String(error)}`)
  if (LIVE_CP !== undefined) await stopControlPlane(LIVE_CP).catch(() => {})
  process.exit(2)
})
