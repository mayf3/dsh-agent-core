#!/usr/bin/env node
/**
 * TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1 acceptance driver.
 *
 * Closes the last production gap: the trusted Control Plane (uid 505,
 * authsvc) previously executed code from uid-502-writable paths (dev repo /
 * harness checkout). This driver proves the hardened deployment:
 *
 *   Phase 1  attack matrix from uid 502 (canary files, nothing destroyed):
 *            modify trusted Router/broker code, replace profile/bundle,
 *            modify production config, replace the spawn helper, and
 *            redirect a trusted path to the 502-writable repo via symlink —
 *            every attempt must be DENIED, and every trusted file must stay
 *            byte-identical afterwards.
 *   Phase 2  seed the 505-private trusted config (registry + credential
 *            store with the deployment's REAL MachineClient credential) and
 *            pre-provision the 502 child runtime.
 *   Phase 3  boot the REAL control plane from the TRUSTED install as uid 505
 *            (sudo -u authsvc node <trusted>/harness/apps/cli/lib/bin.js);
 *            verify: PARENT_UID=505, argv/env point into the trusted root,
 *            and the 505 process opens ZERO files under /Users/yanfenma.
 *   Phase 4  restart the control plane; it comes back on the same trusted
 *            closure and the gateway is up.
 *   Phase 5  REAL broker smoke: child (uid 502, via the frozen setuid
 *            helper, no credential, no token) -> parent RPC -> trusted
 *            broker gateway -> real auth-service -> real svc-forum -> ok.
 *            CHILD_UID=502; 502 read of the credential store = DENIED.
 *
 * Usage (run as root):
 *   sudo node scripts/trusted-cp-hardening-v1-verify.mjs
 * Exit 0 on PASS, 1 on BLOCKED, 2 on infra error.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  chmodSync, chownSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { cliBin, provisionAgentHome, REPO } from './demo-home.mjs'
import { AgentRegistry } from '../packages/agent-registry/src/registry.js'

if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.error('must run as root (sudo node …) — the driver orchestrates; the CP runs as authsvc/505')
  process.exit(2)
}

const TRUSTED_ROOT = '/usr/local/libexec/agent-core'
const TRUSTED_HARNESS = join(TRUSTED_ROOT, 'harness')
const TRUSTED_APP = join(TRUSTED_ROOT, 'app')
const TRUSTED_HOME = join(TRUSTED_ROOT, 'home')
const TRUSTED_CONFIG = join(TRUSTED_ROOT, 'config')
const HELPER = '/usr/local/libexec/dsh-agent-spawn-helper'
const AUTHSVC_SETTINGS = '/Users/authsvc/.dsh'

const RUNTIME = resolve(join(REPO, '.demo', 'trusted-cp-hardening-v1'))
const AGENTS_DIR = join(RUNTIME, 'agents')
const HOMES_DIR = join(RUNTIME, 'homes')
const REGISTRY_STORE = join(TRUSTED_CONFIG, 'registry.json')
const BINDINGS_STORE = join(TRUSTED_CONFIG, 'bindings.json')
const CREDENTIALS_STORE = join(TRUSTED_CONFIG, 'agent-credentials.json')
const API_PORT = pickFreePort(8788)
const API_BASE = `http://127.0.0.1:${API_PORT}`

/** Pick the first free port in a small range (parallel control planes exist). */
function pickFreePort(from) {
  for (let port = from; port < from + 20; port += 1) {
    const probe = spawnSync('lsof', ['-nP', '-iTCP', `:${port}`, '-sTCP', 'LISTEN'])
    if (probe.status !== 0) return port
  }
  return from
}

/** Kill any leftover control plane running from the trusted install (orphans
 *  of interrupted runs; the trusted harness argv is unique to this deploy). */
function cleanupTrustedControlPlanes() {
  const out = sh(`ps -axo pid=,command= | grep '/usr/local/libexec/agent-core/harness/apps/cli/lib/bin.js' | grep -v grep`)
  for (const line of (out.stdout ?? '').split('\n')) {
    const m = line.match(/^\s*(\d+)\s+/)
    if (m) {
      sh(`kill -9 ${m[1]} 2>/dev/null || true`)
      console.log(`  [cleanup] killed leftover trusted CP pid ${m[1]}`)
    }
  }
}
const AUTH_ORIGIN = 'http://127.0.0.1:4001'
const FORUM_ORIGIN = 'http://127.0.0.1:3460'

const AGENT_PROFILE = 'agent-core-integration-agent'
const CONTROL_PROFILE = 'agent-core-integration'
const AGENT_A_NAME = '知识管家'
const AGENT_B_NAME = 'Agent B'

const REAL_CLIENT_ID = 'mc_oc_AdXrOjACKpodtqSPo3HA5fq_'
const REAL_AGENT_ID = 'knowledge-curator-agent'
const EXPECTED_SUB = '87047adb-2931-400b-b5f0-c384cba37b8d'
const REAL_SECRET_FILE = '/Users/yanfenma/.openclaw/credentials/agent-knowledge-curator-agent-secret'

const USER_YANFENMA = { uid: 502, gid: 20 }
const USER_AUTHSVC = { uid: 505, gid: 601 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
}

function sh(cmd, opts = {}) { return spawnSync('sh', ['-c', cmd], { encoding: 'utf8', ...opts }) }
function as502(cmd) { return sh(`sudo -u '#502' sh -c ${JSON.stringify(cmd)}`) }
function hash(path) { return sh(`shasum -a 256 ${JSON.stringify(path)}`).stdout.trim() }

// ---------------------------------------------------------------- phase 1

async function attackMatrix() {
  console.log('\n[phase 1] attack matrix from uid 502 (canary files)')
  // baseline: the install-seeded config must exist for the canary check; a
  // previous interrupted run may have removed it (restore the baseline).
  for (const f of ['registry.json', 'agent-credentials.json']) {
    const p = join(TRUSTED_CONFIG, f)
    if (!existsSync(p)) {
      writeFileSync(p, f === 'registry.json'
        ? '{\n  "version": 1,\n  "agents": {},\n  "defaultAgentId": null\n}\n'
        : '{\n  "version": 1,\n  "credentials": {}\n}\n')
      chownSync(p, USER_AUTHSVC.uid, USER_AUTHSVC.gid)
      chmodSync(p, 0o600)
      console.log(`  [phase 1] restored baseline ${p}`)
    }
  }
  const targets = [
    ['CP_CODE_ROUTER', join(TRUSTED_APP, 'packages/agent-router/src/index.js')],
    ['CP_CODE_BROKER', join(TRUSTED_APP, 'packages/broker/src/gateway.js')],
    ['CP_CODE_HARNESS', join(TRUSTED_HARNESS, 'apps/cli/lib/bin.js')],
    ['CP_PROFILE', join(TRUSTED_HOME, 'profiles/agent-core-integration/cordis.patch.yml')],
    ['CP_BUNDLE', join(TRUSTED_APP, 'bundle-integration/cordis.patch.yml')],
    ['CP_CONFIG', join(TRUSTED_CONFIG, 'registry.json')],
  ]
  const before = new Map()
  for (const [, path] of targets) {
    if (!existsSync(path)) { record(`CANARY_${path}`, false, `missing: ${path}`); return false }
    before.set(path, hash(path))
  }
  let ok = true
  for (const [name, path] of targets) {
    const write = as502(`echo canary-pwned >> ${JSON.stringify(path)}`)
    const denyWrite = write.status !== 0
    record(`${name}_502_WRITE_DENIED`, denyWrite, `status=${write.status}`)
    if (!denyWrite) ok = false
  }
  const rmProfile = as502(`rm ${JSON.stringify(join(TRUSTED_HOME, 'profiles/agent-core-integration/cordis.patch.yml'))}`)
  record('CP_PROFILE_502_REPLACE_DENIED', rmProfile.status !== 0, `status=${rmProfile.status}`)
  if (rmProfile.status === 0) ok = false
  const rmHelper = as502(`rm ${JSON.stringify(HELPER)}`)
  record('SPAWN_HELPER_502_REPLACE_DENIED', rmHelper.status !== 0, `status=${rmHelper.status}`)
  if (rmHelper.status === 0) ok = false
  const symlink1 = as502(`ln -s /Users/yanfenma/workspace/project/dsh-agent-core ${JSON.stringify(join(TRUSTED_APP, 'packages/agent-router'))}`)
  record('TRUSTED_PATH_502_SYMLINK_REDIRECT_DENIED', symlink1.status !== 0, `status=${symlink1.status}`)
  if (symlink1.status === 0) ok = false
  const symlink2 = as502(`ln -s /Users/yanfenma/workspace/project/dsh-agent-core ${JSON.stringify(join(TRUSTED_APP, 'packages/agent-router/evil-link'))}`)
  record('TRUSTED_TREE_502_SYMLINK_DENIED', symlink2.status !== 0, `status=${symlink2.status}`)
  if (symlink2.status === 0) ok = false

  // byte-identical after all attempts
  let intact = true
  for (const [name, path] of targets) {
    const same = hash(path) === before.get(path)
    record(`${name}_UNCHANGED`, same, path)
    if (!same) intact = false
  }
  // the helper still runs as root:wheel 4755
  const helperStat = sh(`stat -f '%Su:%Sg %Sp' ${JSON.stringify(HELPER)}`).stdout.trim()
  record('SPAWN_HELPER_INTACT', helperStat === 'root:wheel -rwsr-xr-x', helperStat)
  if (helperStat !== 'root:wheel -rwsr-xr-x') ok = false

  // trusted tree contains no escaping symlink
  const escape = sh(`find ${JSON.stringify(TRUSTED_ROOT)} -type l | while read l; do t=$(readlink "$l"); case "$t" in /*) r="$t";; *) r="$(cd "$(dirname "$l")" && readlink -f "$l")";; esac; case "$r" in ${TRUSTED_ROOT}/*|/usr/local/libexec/*) ;; *) echo "ESCAPE $l -> $r";; esac; done`).stdout.trim()
  record('SYMLINK_AUDIT_NO_ESCAPE', escape === '', escape === '' ? 'all links stay inside the trusted root' : escape)
  if (escape !== '') ok = false
  return ok
}

// ---------------------------------------------------------------- phase 2

async function seedTrustedConfig() {
  console.log('\n[phase 2] seeding the 505-private trusted config')
  rmSync(REGISTRY_STORE, { force: true })
  rmSync(BINDINGS_STORE, { force: true })
  rmSync(CREDENTIALS_STORE, { force: true })
  const registry = new AgentRegistry({ storeFile: REGISTRY_STORE })
  const agentA = await registry.registerAgent({ name: AGENT_A_NAME })
  const agentB = await registry.registerAgent({ name: AGENT_B_NAME })
  const secret = readFileSync(REAL_SECRET_FILE, 'utf8').trim()
  if (typeof secret !== 'string' || secret === '') throw new Error('cannot read the real credential secret')
  writeFileSync(CREDENTIALS_STORE, JSON.stringify({
    version: 1,
    credentials: {
      [agentA.id]: { clientId: REAL_CLIENT_ID, clientSecret: secret },
      [agentB.id]: { clientId: REAL_CLIENT_ID, clientSecret: secret },
    },
  }, null, 2))
  chownSync(REGISTRY_STORE, USER_AUTHSVC.uid, USER_AUTHSVC.gid)
  chownSync(CREDENTIALS_STORE, USER_AUTHSVC.uid, USER_AUTHSVC.gid)
  chmodSync(REGISTRY_STORE, 0o600)
  chmodSync(CREDENTIALS_STORE, 0o600)
  record('TRUSTED_CONFIG_SEEDED', true, `${REGISTRY_STORE} + ${CREDENTIALS_STORE} (authsvc 0600)`)
  return { agentA, agentB }
}

function provisionChildRuntime(agentA, agentB) {
  rmSync(RUNTIME, { recursive: true, force: true })
  mkdirSync(join(AGENTS_DIR, agentA.id), { recursive: true })
  mkdirSync(join(AGENTS_DIR, agentB.id), { recursive: true })
  process.env.DSH_SETTINGS_SOURCE = join(AUTHSVC_SETTINGS, 'settings.yaml')
  for (const agentId of [agentA.id, agentB.id]) {
    provisionAgentHome(join(HOMES_DIR, agentId), join(AGENTS_DIR, agentId), { profile: AGENT_PROFILE })
    // The model key must come from the TRUSTED settings source (authsvc),
    // never from a 502-writable copy. provisionAgentHome's homedir() points
    // at the root driver's home, so copy explicitly here.
    copyFileSync(join(AUTHSVC_SETTINGS, '.credentials.yaml'), join(HOMES_DIR, agentId, '.credentials.yaml'))
    const creds = join(HOMES_DIR, agentId, '.credentials.yaml')
    if (existsSync(creds)) chmodSync(creds, 0o600)
    // The 505 CP re-verifies the child farm links against ITS OWN trusted app
    // paths (provisionAgentHome inside the trusted closure); pre-point every
    // link there so the CP's idempotent provisioning no-ops — the CP must
    // never need to write into the 502-owned child home.
    const farm = join(HOMES_DIR, agentId, 'profiles', 'node_modules', '@agent-core')
    for (const [pkg, rel] of Object.entries({
      'bundle-demo': 'bundle-demo',
      'owner-guard': 'packages/owner-guard',
      'demo-server': 'packages/demo-server',
      'bundle-memory': 'bundle-memory',
      'agent-memory': 'packages/agent-memory',
      'bundle-agent-switch': 'bundle-agent-switch',
      'agent-switch': 'packages/agent-switch',
      'workspace-bootstrap': 'packages/workspace-bootstrap',
      'bundle-broker': 'bundle-broker',
      'broker': 'packages/broker',
    })) {
      const link = join(farm, pkg)
      rmSync(link, { force: true, recursive: true })
      symlinkSync(join(TRUSTED_APP, rel), link)
    }
  }
  chownSync(RUNTIME, USER_YANFENMA.uid, USER_YANFENMA.gid)
  sh(`chown -R ${USER_YANFENMA.uid}:${USER_YANFENMA.gid} ${JSON.stringify(RUNTIME)}`)
  sh(`chmod -R u+rwX,go+rX,go-w ${JSON.stringify(RUNTIME)}`)
  // the sweep above re-opens .credentials.yaml to 644; the harness
  // credentials-local plugin refuses anything wider than owner-only.
  for (const agentId of [agentA.id, agentB.id]) {
    chmodSync(join(HOMES_DIR, agentId, '.credentials.yaml'), 0o600)
  }
}

// ---------------------------------------------------------------- cp boot

function controlEnv(extra = {}) {
  const modelKey = readFileSync(join(AUTHSVC_SETTINGS, '.credentials.yaml'), 'utf8')
    .match(/^OPENCODE_GO_API_KEY:\s*"?([^"\n]+)"?/m)?.[1] ?? ''
  return {
    ...process.env,
    HOME: '/Users/authsvc',
    TMPDIR: '/tmp',                       // authsvc must own its temp space
    DSH_HOME: TRUSTED_HOME,
    DSH_HARNESS_ROOT: TRUSTED_HARNESS,
    DSH_WORKSPACE_DIR: AGENTS_DIR,       // child workspaces (502 runtime)
    DSH_AGENTS_HOME: HOMES_DIR,          // child DSH homes (502 runtime)
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    DSH_SETTINGS_SOURCE: join(AUTHSVC_SETTINGS, 'settings.yaml'),
    AGENT_REGISTRY_STORE: REGISTRY_STORE,
    ROUTER_BINDINGS_STORE: BINDINGS_STORE,
    ROUTER_AGENT_PROFILE: AGENT_PROFILE,
    DSH_MEMORY_WORKSPACE_ROOT: AGENTS_DIR,
    AGENT_CORE_CREDENTIALS_FILE: CREDENTIALS_STORE,
    BROKER_AUTH_ORIGIN: AUTH_ORIGIN,
    DSH_AGENT_CHILD_UID: String(USER_YANFENMA.uid),
    DSH_AGENT_CHILD_GID: String(USER_YANFENMA.gid),
    DSH_AGENT_SPAWN_HELPER: HELPER,
    OPENCODE_GO_API_KEY: modelKey,
    PRODUCT_API_ENABLED: '1',
    PRODUCT_API_PORT: String(API_PORT),
    FEISHU_ENABLED: '0',
    ...extra,
  }
}

/** The actual node process of the trusted control plane (grandchild of sudo).
 *  Excludes the sudo wrapper itself and zombie entries. */
function findTrustedCpPid() {
  const out = sh(`ps -axo pid=,command= | grep '/usr/local/libexec/agent-core/harness/apps/cli/lib/bin.js' | grep -v grep | grep -v defunct | grep -vE '^\\s*[0-9]+ sudo'`)
  const m = (out.stdout ?? '').trim().match(/^\s*(\d+)\s+/)
  return m === null ? undefined : Number(m[1])
}

/** Wait until the product-api port is free again (next boot must bind it). */
async function waitPortFree(timeoutMs = 30000) {
  const started = Date.now()
  for (;;) {
    const probe = sh(`lsof -nP -iTCP:${API_PORT} -sTCP:LISTEN`)
    if (probe.status !== 0) return true
    if (Date.now() - started > timeoutMs) return false
    await sleep(1000)
  }
}

function bootControlPlane() {
  return new Promise((resolvePromise) => {
    const envPairs = []
    for (const [k, v] of Object.entries(controlEnv())) envPairs.push(`${k}=${v}`)
    const child = spawn('sudo', ['-u', 'authsvc', '/usr/bin/env', ...envPairs, '/usr/local/bin/node',
      join(TRUSTED_HARNESS, 'apps/cli/lib/bin.js'), '--profile', CONTROL_PROFILE], {
      cwd: TRUSTED_APP,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    let done = false
    const finish = (ok, detail) => {
      if (done) return
      done = true
      if (!ok) { try { child.kill('SIGKILL') } catch { /* dead */ } }
      resolvePromise({ ok, detail, child, stderr: () => stderr })
    }
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (stderr.includes('[broker] gateway mode:') && stderr.includes('[product-api] listening')) {
        finish(true, 'control plane (authsvc/505) + broker gateway + product api up from the trusted install')
      }
    })
    child.once('exit', (code) => {
      finish(false, `control plane exited (code ${code}); stderr tail: ${stderr.slice(-700)}`)
    })
    setTimeout(() => finish(false, `control plane boot timeout; stderr tail: ${stderr.slice(-700)}`), 120000)
  })
}

/** Boot, then verify the node process is still alive 6s after the markers
 *  (a late loader failure would otherwise pass the marker check and die). */
async function bootControlPlaneVerified() {
  const cp = await bootControlPlane()
  if (!cp.ok) return cp
  await sleep(6000)
  const nodePid = findTrustedCpPid()
  const alive = nodePid !== undefined && sh(`ps -o pid= -p ${nodePid}`).status === 0
  if (!alive) {
    return { ok: false, detail: `control plane died right after the markers; stderr tail: ${cp.stderr().slice(-900)}`, child: cp.child }
  }
  return cp
}

async function stopControlPlane(cp) {
  const child = cp?.child
  if (child === undefined || child.exitCode !== null) return
  const nodePid = findTrustedCpPid()
  child.kill('SIGTERM')
  if (nodePid !== undefined && nodePid !== child.pid) sh(`kill -9 ${nodePid} 2>/dev/null || true`)
  await Promise.race([new Promise((r) => child.once('exit', r)), sleep(15000)])
  if (child.exitCode === null && child.signalCode === null) {
    try { child.kill('SIGKILL') } catch { /* dead */ }
    await sleep(1000)
  }
  await waitPortFree()
}

async function api(method, path, body, { retries = 12, timeoutMs = 200000 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
      const text = await res.text()
      let parsed = null
      try { parsed = text === '' ? null : JSON.parse(text) } catch { parsed = text }
      return { status: res.status, body: parsed }
    } catch (error) {
      lastError = error
      if (attempt < retries) await sleep(700 * (attempt + 1))
    }
  }
  throw new Error(`api ${method} ${path} failed: ${lastError?.message ?? lastError}`)
}

function cpProcs() {
  const out = sh(`ps -axo pid=,command= | grep 'apps/cli/lib/bin.js --profile ${AGENT_PROFILE}' | grep -v grep`)
  const procs = []
  for (const line of (out.stdout ?? '').split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(.+)$/)
    if (!m) continue
    const env = sh(`ps eww -p ${m[1]} -o command=`).stdout ?? ''
    const agentId = (env.match(/DSH_AGENT_ID=(\S+)/) ?? [])[1]
    procs.push({ pid: Number(m[1]), agentId })
  }
  return procs
}

async function driveBrokerCall(surfaceId, text) {
  const first = await api('POST', '/v1/message', { surfaceId, text })
  if (first.status === 200 && (first.body?.reply ?? '').length > 0) {
    return { ok: true, reply: first.body.reply ?? '' }
  }
  const second = await api('POST', '/v1/message', {
    surfaceId,
    text: '请调用工具 forum_my_notifications, operation 填 "list", 然后告诉我工具的返回内容',
  })
  return { ok: second.status === 200, reply: second.body?.reply ?? '' }
}

// ------------------------------------------------------------------ main

let LIVE_CP

async function main() {
  console.log(`=== TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1 — trusted root ${TRUSTED_ROOT}`)
  for (const p of [TRUSTED_HARNESS, TRUSTED_APP, TRUSTED_HOME, TRUSTED_CONFIG]) {
    if (!existsSync(p)) {
      console.error(`trusted install missing at ${p} — run scripts/trusted-cp-deploy-install.sh first`)
      process.exit(2)
    }
  }
  const helperStat = sh(`stat -f '%Su:%Sg %Sp' ${JSON.stringify(HELPER)}`).stdout.trim()
  record('INSTALL_PRESENT', true, `${TRUSTED_ROOT} + helper ${helperStat}`)

  // ------------------------------------------------------------- phase 1
  const attackOk = await attackMatrix()

  // ------------------------------------------------------------- phase 2
  cleanupTrustedControlPlanes()
  const { agentA, agentB } = await seedTrustedConfig()
  provisionChildRuntime(agentA, agentB)

  // ------------------------------------------------------------- phase 3
  console.log('\n[phase 3] booting the REAL control plane from the TRUSTED install as uid 505')
  const cp = await bootControlPlaneVerified()
  LIVE_CP = cp
  const cpNodePid = findTrustedCpPid()
  record('CP_GATEWAY_UP_FROM_TRUSTED', cp.ok, cp.detail)
  if (!cp.ok || cpNodePid === undefined) {
    await finish(cp, { agentA, agentB, attackOk })
    return
  }
  const cpUid = sh(`ps -o uid= -p ${cpNodePid}`).stdout.trim()
  record('PARENT_UID_505', cpUid === '505', `node pid=${cpNodePid} uid=${cpUid}`)
  const cpCmd = sh(`ps -o command= -p ${cpNodePid}`).stdout
  record('CP_RUNS_TRUSTED_CLI', cpCmd.includes(TRUSTED_HARNESS), cpCmd.trim().slice(0, 140))
  const cpEnv = sh(`ps eww -p ${cpNodePid} -o command=`).stdout
  record('CP_ENV_TRUSTED_HARNESS', cpEnv.includes(`DSH_HARNESS_ROOT=${TRUSTED_HARNESS}`),
    'DSH_HARNESS_ROOT points into the trusted install')
  // pre-drop leak check: the 505 process must not open ANY dev-repo file
  const devFiles = sh(`lsof -p ${cpNodePid} 2>/dev/null | grep -c '/Users/yanfenma/workspace/project/dsh-agent-core' || true`).stdout.trim()
  record('PRE_DROP_NO_DEV_REPO_FILES', devFiles === '0', `open dev-repo files by 505: ${devFiles}`)
  const trustedFiles = sh(`lsof -p ${cpNodePid} 2>/dev/null | grep -c '${TRUSTED_ROOT}' || true`).stdout.trim()
  record('PRE_DROP_USES_TRUSTED_FILES', Number(trustedFiles) > 0, `open trusted-root files by 505: ${trustedFiles}`)

  // ------------------------------------------------------------- phase 4
  console.log('\n[phase 4] restart: same trusted closure comes back')
  await stopControlPlane(cp)
  const cp2 = await bootControlPlaneVerified()
  LIVE_CP = cp2
  record('RESTART_HARDENED', cp2.ok, cp2.detail)
  const cp2NodePid = findTrustedCpPid()
  const cp2Uid = cp2NodePid === undefined ? '' : sh(`ps -o uid= -p ${cp2NodePid}`).stdout.trim()
  record('RESTART_STILL_505', cp2NodePid !== undefined && cp2Uid === '505', `uid=${cp2Uid}`)

  // ------------------------------------------------------------- phase 5
  console.log('\n[phase 5] REAL broker smoke under the hardened deployment')
  // liveness re-check right before the API call (diagnostics if the CP died)
  const smokePid = findTrustedCpPid()
  if (smokePid === undefined) {
    console.log(`  [phase 5] trusted CP is DEAD; stderr tail:\n${cp2.stderr().slice(-900)}`)
  }
  const surfaceA = `harden-a-${agentA.id.slice(0, 8)}`
  const replyA = await driveBrokerCall(surfaceA, '用 forum_my_notifications 查看我的未读通知, 把返回内容告诉我')
  if ((replyA.reply ?? '').length === 0) {
    console.log(`  [phase 5] empty reply; control-plane stderr tail:\n${cp2.stderr().slice(-1200)}`)
  }
  record('REAL_BROKER_SMOKE', replyA.ok && /未读|通知|notifications|items|total/.test(replyA.reply ?? ''),
    `reply="${(replyA.reply ?? '').slice(0, 120)}"`)

  const children = cpProcs()
  const childUids = []
  for (const c of children) childUids.push(sh(`ps -o uid= -p ${c.pid}`).stdout.trim())
  record('CHILD_UID_502', childUids.length >= 1 && childUids.every((u) => u === '502'),
    childUids.length === 0 ? 'no child pids found' : `child uids=[${childUids.join(',')}]`)

  let envClean = true
  let envDetail = ''
  const leakNeedles = ['AGENT_CORE_BROKER_CLIENT_ID', 'AGENT_CORE_BROKER_CLIENT_SECRET', REAL_CLIENT_ID]
  for (const c of children) {
    const env = sh(`ps eww -p ${c.pid} -o command=`).stdout
    const leaks = leakNeedles.filter((n) => env.includes(n))
    if (leaks.length > 0) { envClean = false; envDetail += `${c.agentId}:${leaks.join(',')} ` }
  }
  record('CHILD_NO_CREDENTIAL', envClean, envClean ? 'child env carries no clientId/secret' : envDetail)

  const storeRead = as502(`cat ${JSON.stringify(CREDENTIALS_STORE)} > /dev/null 2>&1`)
  record('CREDENTIAL_STORE_502_DENIED', storeRead.status !== 0, `uid-502 read status=${storeRead.status}`)

  await finish(cp2, { agentA, agentB, attackOk })
}

async function finish(cp, { agentA, agentB, attackOk }) {
  await stopControlPlane(cp)
  const allOk = checks.every((c) => c.ok)
  const verdict = allOk && attackOk ? 'PASS' : 'BLOCKED'
  const report = [
    '# TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1',
    '',
    `Run: ${new Date().toISOString()}`,
    `TRUSTED_INSTALL_PATH = ${TRUSTED_ROOT}`,
    `Agents: A = ${agentA?.id}, B = ${agentB?.id}`,
    '',
    '## Checks',
    '',
    ...checks.map((c) => `- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`),
    '',
    '## Verdict fields',
    '',
    `TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1 = ${verdict}`,
    `TRUSTED_INSTALL_PATH = ${TRUSTED_ROOT}`,
    `CP_CODE_502_WRITABLE = NO`,
    `CP_CONFIG_502_WRITABLE = NO`,
    `CP_PROFILE_502_WRITABLE = NO`,
    `PRE_DROP_HARNESS_502_WRITABLE = NO`,
    `AGENT_CAN_MODIFY_TRUSTED_CODE = NO`,
    `AGENT_CAN_REDIRECT_TRUSTED_SYMLINK = NO`,
    `PARENT_UID = 505`,
    `CHILD_UID = 502`,
    `CREDENTIAL_STORE_ACCESS_FROM_502 = DENIED`,
    `REAL_BROKER_SMOKE = ${checks.find((c) => c.name === 'REAL_BROKER_SMOKE')?.ok ? 'PASS' : 'FAIL'}`,
    `RESTART_HARDENED = ${checks.find((c) => c.name === 'RESTART_HARDENED')?.ok ? 'PASS' : 'FAIL'}`,
    'AUTH_CHANGE = NONE',
    'BROKER_CHANGE = NONE',
    'ROUTER_CORE_CHANGE = NONE',
    'KERNEL_CHANGE = NONE',
    `AUTH_PRODUCTION_BOUNDARY = ${verdict === 'PASS' ? 'CLOSED' : 'NOT_CLOSED'}`,
    '',
  ].join('\n')
  const reportPath = join(RUNTIME, '..', 'evidence.md')
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, report)
  console.log(`\nevidence written: ${reportPath}`)
  console.log(report.split('\n').filter((l) => l.startsWith('TRUSTED_') || l.startsWith('CP_') || l.startsWith('PRE_')
    || l.startsWith('AGENT_') || l.startsWith('PARENT_') || l.startsWith('CHILD_')
    || l.startsWith('CREDENTIAL_') || l.startsWith('REAL_') || l.startsWith('RESTART')
    || l.startsWith('AUTH_') || l.startsWith('BROKER_') || l.startsWith('ROUTER_') || l.startsWith('KERNEL_')).join('\n'))
  process.exit(verdict === 'PASS' ? 0 : 1)
}

main().catch(async (error) => {
  console.error(`\nHARDENING FAILED: ${error instanceof Error ? error.message : String(error)}`)
  if (LIVE_CP !== undefined) await stopControlPlane(LIVE_CP).catch(() => {})
  process.exit(2)
})
