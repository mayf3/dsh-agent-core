/**
 * Integration SEAM for @agent-core/notification-ingress V1.
 *
 * Always-on coverage (no env gate):
 *   - AC-BND-01 / F-19: full-chain secret non-echo — a known distinctive
 *     clientSecret is pushed through success AND failure flows, then grepped
 *     across HTTP responses, captured stderr logs, the idempotency store,
 *     the evidence JSONL and every error message. Zero hits allowed.
 *   - AC-CMP-01 / F-20: a recorder Router proves every agentRouter.deliver
 *     call happens ONLY with a verified allowlisted caller AND a key that is
 *     already durably reserved on disk; unauthenticated / conflicting /
 *     duplicate requests cause ZERO Router calls.
 *   - AC-CMP-02 (source level): the ingress never imports agent-router
 *     (the authoritative zero-diff proof runs in the acceptance driver).
 *
 * The REAL control-plane composition seam stays env-gated (the V1 behavior
 * asserted there: the composition mounts with the auth surface fail-closed —
 * deliverReady true, authConfigured false, every /v1/deliver 503):
 *
 *   NOTIFICATION_INGRESS_INTEGRATION=1 npm test -- packages/notification-ingress
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { apply as applyIngress } from '../src/index.js'
import { NOTIFICATION_RESOURCE } from '../src/auth.js'

const SEAM_ENABLED = process.env.NOTIFICATION_INGRESS_INTEGRATION === '1'
const SEAM_REASON = 'real-control-plane seam: rerun with NOTIFICATION_INGRESS_INTEGRATION=1'

const CONTROL_PROFILE = 'agent-core-integration'
const AGENT_PROFILE = 'agent-core-integration-agent'
const AGENT_ID = 'agt_demo'
const INGRESS_PORT = Number.parseInt(process.env.NOTIFICATION_INGRESS_PORT ?? '18790', 10)
const INGRESS_BASE = `http://127.0.0.1:${INGRESS_PORT}`

const FORUM = { clientId: 'client-forum-abc', clientSecret: 'forum-secret-111' }
const WORKFLOW = { clientId: 'client-workflow-xyz', clientSecret: 'workflow-secret-222' }
/** Distinctive secret for the full-chain non-echo scan. */
const SCAN_SECRET = 'chain-vwxyz-secret-9f3a'
const SCAN_CLIENT = 'client-chain-scan'

const VALID = { requestId: 'req_01', agentId: 'agt_a', sessionMode: 'main', message: 'hello' }
const basic = (clientId, clientSecret) => 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

// ── shared helpers ─────────────────────────────────────────────────────────

function fakeCtx(services) {
  const provided = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
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

function makeRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'ni-seam-'))
  t.after(() => { try { rmSync(root, { recursive: true, force: true }) } catch { /* best effort */ } })
  const dir = join(root, 'notification-ingress')
  mkdirSync(dir, { recursive: true })
  chmodSync(dir, 0o700)
  const authConfigFile = join(dir, 'auth.json')
  writeFileSync(authConfigFile, `${JSON.stringify({
    authServiceOrigin: 'https://auth.example.com',
    audience: NOTIFICATION_RESOURCE,
    allowlist: { 'svc-forum': FORUM.clientId, 'svc-workflow': WORKFLOW.clientId },
  }, null, 2)}\n`)
  chmodSync(authConfigFile, 0o600)
  return { root, dir, authConfigFile, storeFile: join(dir, 'idempotency.json') }
}

/** Capture process.stderr lines while the callback runs. */
async function captureStderr(run) {
  const original = process.stderr.write.bind(process.stderr)
  const chunks = []
  process.stderr.write = (chunk, ...rest) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
    return original(chunk, ...rest)
  }
  try {
    return { result: await run(), stderr: chunks.join('') }
  } finally {
    process.stderr.write = original
  }
}

async function mount(t, { root, router, fetchImpl }) {
  const ctx = fakeCtx(new Map([['agentRouter', router]]))
  const api = applyIngress(ctx, {
    port: 0, authConfigFile: root.authConfigFile, storeFile: root.storeFile, fetchImpl,
  })
  await new Promise((resolveReady) => {
    const wait = () => {
      const addr = api.address()
      if (addr?.port && addr.port !== 0) resolveReady()
      else setTimeout(wait, 5)
    }
    wait()
  })
  t.after(() => ctx.disposeAll())
  return { api, base: `http://127.0.0.1:${api.address().port}` }
}

// ── AC-BND-01 / F-19 — full-chain secret non-echo ──────────────────────────

test('AC-BND-01 F-19 C-AUTH-012 C-BND-005: known secret never appears anywhere across the full chain', async (t) => {
  const root = makeRoot(t)
  const router = {
    deliver: async () => ({ accepted: true, sessionId: 'main' }),
  }
  const registry = new Map([
    [FORUM.clientId, FORUM.clientSecret],
    [WORKFLOW.clientId, WORKFLOW.clientSecret],
    [SCAN_CLIENT, SCAN_SECRET],
  ])
  const fetchImpl = async (url, init) => {
    const header = /^Basic (.+)$/i.exec(init?.headers?.Authorization ?? '')?.[1] ?? ''
    const [clientId = '', clientSecret = ''] = Buffer.from(header, 'base64').toString('utf8').split(':')
    if (registry.get(clientId) === clientSecret && clientId === SCAN_CLIENT) {
      // The scan client verifies OK but is NOT allowlisted -> exercises the
      // 403 path with the distinctive secret in play.
      return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }) }
    }
    if (registry.get(clientId) === clientSecret) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }) }
    }
    return { ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }
  }
  const { base } = await mount(t, { root, router, fetchImpl })

  const responses = []
  const { stderr } = await captureStderr(async () => {
    // Push the distinctive secret through 401 (wrong secret), 403 (verified
    // but not allowlisted) and a malformed-with-material path — every flow
    // that touches the credential.
    const wrong = await fetch(`${base}/v1/deliver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: basic(SCAN_CLIENT, 'not-the-secret') },
      body: JSON.stringify(VALID),
    })
    responses.push(await wrong.text())
    const forbidden = await fetch(`${base}/v1/deliver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: basic(SCAN_CLIENT, SCAN_SECRET) },
      body: JSON.stringify(VALID),
    })
    responses.push(await forbidden.text())
    const malformed = await fetch(`${base}/v1/deliver`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${SCAN_CLIENT}:${SCAN_SECRET}`).toString('base64')}!!`,
      },
      body: JSON.stringify(VALID),
    }).catch((error) => String(error))
    responses.push(typeof malformed === 'string' ? malformed : await malformed.text())
  })

  // grep every sink for the distinctive secret AND its base64 form.
  const base64Secret = Buffer.from(SCAN_SECRET).toString('base64')
  const sinks = {
    httpResponses: responses.join('\n'),
    stderrLogs: stderr,
    idempotencyStore: existsSync(root.storeFile) ? readFileSync(root.storeFile, 'utf8') : '',
    evidence: existsSync(join(root.dir, 'evidence.jsonl')) ? readFileSync(join(root.dir, 'evidence.jsonl'), 'utf8') : '',
  }
  for (const [sinkName, text] of Object.entries(sinks)) {
    assert.ok(!text.includes(SCAN_SECRET), `${sinkName} must not contain the clientSecret`)
    assert.ok(!text.includes(base64Secret), `${sinkName} must not contain the base64 credential`)
  }
})

// The stderr sink needs its own test (captureStderr wraps the mount+call):
test('AC-BND-01 F-19: stderr log lines never contain credential material', async (t) => {
  const root = makeRoot(t)
  const router = { deliver: async () => { throw new Error('router exploded') } }
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) })
  const { base } = await mount(t, { root, router, fetchImpl })
  const header = basic(FORUM.clientId, FORUM.clientSecret)
  const { stderr } = await captureStderr(async () => {
    await fetch(`${base}/v1/deliver`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: header },
      body: JSON.stringify({ ...VALID, requestId: 'log-scan' }),
    })
    await fetch(`${base}/v1/deliver`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Basic ###' },
      body: JSON.stringify({ ...VALID, requestId: 'log-scan-2' }),
    })
  })
  assert.ok(!stderr.includes(FORUM.clientSecret))
  assert.ok(!stderr.includes(header))
  assert.ok(!stderr.includes(Buffer.from(`${FORUM.clientId}:${FORUM.clientSecret}`).toString('base64')))
})

// ── AC-CMP-01 / F-20 — the Router receives ONLY authenticated admitted deliveries ──

test('AC-CMP-01 F-20 C-AUTH-002 C-IDM-004: every Router call has a verified caller + a durably reserved key', async (t) => {
  const root = makeRoot(t)
  const routerCalls = []
  const mints = []
  const router = {
    deliver: async (payload) => {
      // Inside the Router: the (caller, requestId) key must ALREADY be
      // durably reserved on disk.
      const doc = JSON.parse(readFileSync(root.storeFile, 'utf8'))
      const record = doc.records[FORUM.clientId]?.[payload.requestId]
        ?? doc.records[WORKFLOW.clientId]?.[payload.requestId]
      assert.ok(record !== undefined, 'reserve-before-Router: the key is durable at call time')
      assert.equal(record.state, 'reserved')
      routerCalls.push(payload)
      return { accepted: true, sessionId: 'main' }
    },
  }
  const fetchImpl = async (url, init) => {
    const header = /^Basic (.+)$/i.exec(init?.headers?.Authorization ?? '')?.[1] ?? ''
    const [clientId = '', clientSecret = ''] = Buffer.from(header, 'base64').toString('utf8').split(':')
    mints.push({ clientId })
    const okClient = (clientId === FORUM.clientId && clientSecret === FORUM.clientSecret)
      || (clientId === WORKFLOW.clientId && clientSecret === WORKFLOW.clientSecret)
    if (okClient) return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }) }
    return { ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }
  }
  const { base } = await mount(t, { root, router, fetchImpl })

  // Rejected callers: ZERO Router calls.
  await fetch(`${base}/v1/deliver`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(VALID) })
  await fetch(`${base}/v1/deliver`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: basic('client-agent', 'x') }, body: JSON.stringify(VALID) })
  assert.equal(routerCalls.length, 0, 'unauthenticated callers never reach the Router')

  // Admitted caller: exactly one Router call, preceded by an online mint.
  const ok = await fetch(`${base}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify({ ...VALID, requestId: 'cmp-1' }),
  })
  assert.equal(ok.status, 200)
  assert.equal(routerCalls.length, 1)
  assert.equal(mints.at(-1).clientId, FORUM.clientId, 'the caller was verified online first')

  // Duplicate: zero further Router calls.
  await fetch(`${base}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify({ ...VALID, requestId: 'cmp-1' }),
  })
  assert.equal(routerCalls.length, 1, 'duplicates never re-deliver')

  // Conflicting payload: zero Router calls.
  await fetch(`${base}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify({ ...VALID, requestId: 'cmp-1', message: 'different' }),
  })
  assert.equal(routerCalls.length, 1, 'conflicts never deliver')
})

// ── AC-CMP-02 (source level) — Router package untouched by the ingress ─────

test('AC-CMP-02 source-level: the ingress imports NOTHING from agent-router (zero semantic change)', async () => {
  for (const file of ['../src/index.js', '../src/auth.js', '../src/idempotency.js']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(!/^import[^\n]*agent-router/m.test(source), `${file} must not import agent-router`)
  }
  // The authoritative zero-diff proof (git diff over packages/agent-router)
  // runs in scripts/notification-ingress-service-auth-v1-verify.mjs.
})

// ── REAL control-plane seam (env-gated) ────────────────────────────────────

async function realControlPlaneSeam(t) {
  const { cliBin, provisionAgentHome, REPO } = await import('../../../scripts/demo-home.mjs')
  const { AgentDefinition } = await import('../../agent-definition/src/definition.js')
  const { writeAgentDefinition } = await import('../../agent-definition/src/config.js')
  const { copyFileSync, lstatSync, readlinkSync, symlinkSync } = await import('node:fs')
  const { dirname, resolve } = await import('node:path')

  const sleep = (ms) => new Promise((resolveTimeout) => setTimeout(resolveTimeout, ms))
  const ensureSymlink = (target, link) => {
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
  const copyOnce = (source, target) => {
    if (!existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(source, target)
    }
  }
  const runtime = mkdtempSync(join(tmpdir(), 'notification-ingress-seam-'))
  t.after(() => { try { rmSync(runtime, { recursive: true, force: true }) } catch { /* best effort */ } })
  const controlHome = join(runtime, 'control', 'home')
  const definitionFile = join(runtime, 'control', 'agents.json')
  const bindingsStore = join(runtime, 'control', 'bindings.json')
  const workspaceRoot = join(runtime, 'agents')

  await writeAgentDefinition(definitionFile, {
    defaultAgentId: AGENT_ID,
    agents: [{ id: AGENT_ID, name: 'Agent Demo', description: 'notification ingress seam agent' }],
  })
  void new AgentDefinition({ configFile: definitionFile })
  provisionAgentHome(join(runtime, 'homes', AGENT_ID), join(workspaceRoot, AGENT_ID), { profile: AGENT_PROFILE })

  const profileDir = join(controlHome, 'profiles', CONTROL_PROFILE)
  mkdirSync(profileDir, { recursive: true })
  copyOnce(join(REPO, 'profile-integration', 'package.json'), join(profileDir, 'package.json'))
  copyOnce(join(REPO, 'profile-integration', 'cordis.patch.yml'), join(profileDir, 'cordis.patch.yml'))
  const farm = join(controlHome, 'profiles', 'node_modules', '@agent-core')
  for (const [pkg, rel] of Object.entries({
    'bundle-integration': 'bundle-integration',
    'feishu-connector': 'packages/feishu-connector',
    'agent-router': 'packages/agent-router',
    'product-api': 'packages/product-api',
    'notification-ingress': 'packages/notification-ingress',
    'workspace-bootstrap': 'packages/workspace-bootstrap',
    'agent-definition': 'packages/agent-definition',
    'broker': 'packages/broker',
  })) {
    ensureSymlink(join(REPO, rel), join(farm, pkg))
  }

  const env = {
    ...process.env,
    DSH_HOME: controlHome,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    FEISHU_ENABLED: '0',
    AGENT_DEFINITION_CONFIG: definitionFile,
    ROUTER_BINDINGS_STORE: bindingsStore,
    ROUTER_DEFAULT_AGENT: AGENT_ID,
    ROUTER_AGENT_PROFILE: AGENT_PROFILE,
    DSH_MEMORY_WORKSPACE_ROOT: workspaceRoot,
    NOTIFICATION_INGRESS_HOST: '127.0.0.1',
    NOTIFICATION_INGRESS_PORT: String(INGRESS_PORT),
    // V1: NO auth config in the scratch runtime -> the surface must mount
    // fail-closed (never anonymous).
  }
  const child = spawn(process.execPath, [cliBin(), '--profile', CONTROL_PROFILE], {
    cwd: REPO,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  let booted = false
  const bootPromise = new Promise((resolveBoot) => {
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (stderr.includes(`[notification-ingress] listening on http://127.0.0.1:${INGRESS_PORT}`)) {
        booted = true
        resolveBoot(true)
      }
    })
    child.once('exit', (code) => {
      resolveBoot(false)
      if (!booted) stderr += `\n[seam] control plane exited (code ${code}) before the ingress listener came up`
    })
    setTimeout(() => resolveBoot(booted), 120000)
  })
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await Promise.race([new Promise((resolveExit) => child.once('exit', resolveExit)), sleep(15000)])
      if (child.exitCode === null && child.signalCode === null) {
        try { child.kill('SIGKILL') } catch { /* already dead */ }
      }
    }
  })
  return { up: await bootPromise, stderrTail: () => stderr.slice(-800) }
}

test('REAL control plane seam (V1 fail-closed): no auth config -> deliverReady true, authConfigured false, every deliver 503', { skip: SEAM_ENABLED ? false : SEAM_REASON }, async (t) => {
  const { up, stderrTail } = await realControlPlaneSeam(t)
  assert.equal(up, true, `control plane did not come up; stderr tail:\n${stderrTail()}`)

  const health = await (await fetch(`${INGRESS_BASE}/health`)).json()
  assert.equal(health.deliverReady, true, `agentRouter.deliver missing; stderr tail:\n${stderrTail()}`)
  assert.equal(health.authConfigured, false, 'the scratch runtime has no auth config')

  const anonymous = await fetch(`${INGRESS_BASE}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: 'seam-1', agentId: AGENT_ID, sessionMode: 'main', message: 'ping' }),
  })
  assert.equal(anonymous.status, 503, 'unconfigured ingress fails CLOSED per call — never anonymous acceptance')
  assert.equal((await anonymous.json()).error.code, 'AUTH_NOT_CONFIGURED')

  const credentialed = await fetch(`${INGRESS_BASE}/v1/deliver`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: basic('client-seam', 'seam-secret'),
    },
    body: JSON.stringify({ requestId: 'seam-2', agentId: AGENT_ID, sessionMode: 'main', message: 'ping' }),
  })
  assert.equal(credentialed.status, 503)
  assert.equal((await credentialed.json()).error.code, 'AUTH_NOT_CONFIGURED')
})
