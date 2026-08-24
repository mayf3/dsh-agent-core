import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const REPO = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))
export const INGRESS_URL = pathToFileURL(join(REPO, 'packages/notification-ingress/src/index.js')).href
export const STORE_URL = pathToFileURL(join(REPO, 'packages/notification-ingress/src/idempotency.js')).href

// Frozen literals (clarification spec).
export const RESOURCE = 'agent-core-notification-ingress-v1'
export const SCOPE = 'notification.deliver'

export const FORUM = { callerName: 'svc-forum', clientId: 'client-forum-abc', clientSecret: 'forum-secret-111' }
export const WORKFLOW = { callerName: 'svc-workflow', clientId: 'client-workflow-xyz', clientSecret: 'workflow-secret-222' }
export const AGENT_CHILD = { clientId: 'client-agt_child-77', clientSecret: 'agent-secret-333' }
export const SCAN_SECRET = 'driver-vwxyz-secret-77f3'

export const results = []
function record(id, ok, detail = '') {
  results.push({ id, ok, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail === '' ? '' : ` — ${detail}`}\n`)
}
export async function check(id, fn) {
  try {
    const detail = await fn()
    record(id, true, typeof detail === 'string' ? detail : '')
  } catch (error) {
    record(id, false, error?.message ?? String(error))
  }
}
export function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// ── stub auth-service token endpoint ───────────────────────────────────────

export function makeEndpoint() {
  const registry = new Map([
    [FORUM.clientId, FORUM.clientSecret],
    [WORKFLOW.clientId, WORKFLOW.clientSecret],
    [AGENT_CHILD.clientId, AGENT_CHILD.clientSecret],
    ['client-driver-scan', SCAN_SECRET],
  ])
  const state = { respond: undefined }
  const requests = []
  return {
    requests,
    setRespond: (fn) => { state.respond = fn },
    fetchImpl: async (url, init) => {
      const header = /^Basic (.+)$/i.exec(init?.headers?.Authorization ?? '')?.[1] ?? ''
      const [clientId = '', clientSecret = ''] = Buffer.from(header, 'base64').toString('utf8').split(':')
      const form = Object.fromEntries(new URLSearchParams(init.body))
      requests.push({ url, clientId, clientSecret, form })
      if (state.respond !== undefined) {
        const reply = state.respond({ clientId, clientSecret, form })
        if (reply !== undefined) return reply
      }
      if (registry.get(clientId) === clientSecret) {
        return { ok: true, status: 200, json: async () => ({ access_token: `tok-${clientId}` }) }
      }
      return { ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }
    },
  }
}

// ── harness: temp root + mounted ingress ───────────────────────────────────

export const artifacts = []

export function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'ni-driver-'))
  const dir = join(root, 'notification-ingress')
  mkdirSync(dir, { recursive: true })
  chmodSync(dir, 0o700)
  return { root, dir, authConfigFile: join(dir, 'auth.json'), storeFile: join(dir, 'idempotency.json') }
}

export function writeAuthConfig(env, overrides = {}) {
  writeFileSync(env.authConfigFile, `${JSON.stringify({
    authServiceOrigin: 'https://auth.example.com',
    audience: RESOURCE,
    allowlist: { 'svc-forum': FORUM.clientId, 'svc-workflow': WORKFLOW.clientId },
    ...overrides,
  }, null, 2)}\n`)
  chmodSync(env.authConfigFile, 0o600)
}

export function recorderRouter(deliverImpl) {
  const calls = []
  return {
    calls,
    deliver: async (payload) => {
      calls.push(JSON.parse(JSON.stringify(payload)))
      if (deliverImpl !== undefined) return deliverImpl(payload, calls)
      return { accepted: true, sessionId: payload.sessionMode === 'fresh' ? 'ses_fresh_1' : 'main' }
    },
  }
}

export async function mount(env, router, endpoint) {
  const { apply } = await import(INGRESS_URL)
  const ctx = {
    get: (name) => (name === 'agentRouter' ? router : undefined),
    provide() {},
    effect(fn) {
      const dispose = fn()
      this._disposers ??= []
      if (typeof dispose === 'function') this._disposers.push(dispose)
    },
    async disposeAll() {
      for (const dispose of this._disposers ?? []) await dispose()
    },
  }
  const api = apply(ctx, {
    port: 0,
    authConfigFile: env.authConfigFile,
    storeFile: env.storeFile,
    fetchImpl: endpoint.fetchImpl,
  })
  await new Promise((resolveReady) => {
    const wait = () => {
      const addr = api.address()
      if (addr?.port && addr.port !== 0) resolveReady()
      else setTimeout(wait, 5)
    }
    wait()
  })
  return { api, ctx, base: `http://127.0.0.1:${api.address().port}` }
}

export const basic = (clientId, clientSecret) => 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

export async function post(base, { authorization = basic(FORUM.clientId, FORUM.clientSecret), body } = {}) {
  const res = await fetch(`${base}/v1/deliver`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization === null ? {} : { authorization }),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  artifacts.push(text)
  return { status: res.status, body: text === '' ? null : JSON.parse(text), raw: text }
}

export const BODY = (requestId) => ({ requestId, agentId: 'agt_a', sessionMode: 'main', message: 'hello' })

// ── child crash rig ────────────────────────────────────────────────────────

export async function crashChild(mode, env, { requestId } = {}) {
  const childCode = `
    const { writeFileSync, readFileSync } = await import('node:fs')
    const marker = (n, d) => writeFileSync(process.env.NI_ROOT + '/marker-' + n + '.json', JSON.stringify(d ?? {}))
    const hang = () => setInterval(() => {}, 60000)
    if (process.env.NI_MODE === 'w2' || process.env.NI_MODE === 'w4') {
      const { NotificationIdempotencyStore } = await import(process.env.NI_STORE_URL)
      const store = new NotificationIdempotencyStore({ storeFile: process.env.NI_ROOT + '/notification-ingress/idempotency.json' })
      await store.reserve({ callerPrincipalId: 'client-forum-abc', requestId: process.env.NI_REQUEST, payloadHash: process.env.NI_HASH })
      if (process.env.NI_MODE === 'w4') marker('router-accepted')
      marker('ready')
      hang()
    }
    if (process.env.NI_MODE === 'service-hang') {
      const { apply } = await import(process.env.NI_INDEX_URL)
      const router = { deliver: () => new Promise(() => {}) }
      const ctx = { get: () => router, provide() {}, effect() {} }
      const api = apply(ctx, {
        port: 0,
        authConfigFile: process.env.NI_ROOT + '/notification-ingress/auth.json',
        storeFile: process.env.NI_ROOT + '/notification-ingress/idempotency.json',
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) }),
      })
      await new Promise((r) => { const w = () => { api.address()?.port ? r() : setTimeout(w, 5) } ; w() })
      marker('ready', { port: api.address().port })
      hang()
    }
  `
  const { canonicalPayloadHash } = await import(STORE_URL)
  const child = spawn(process.execPath, ['--input-type=module', '-e', childCode], {
    env: {
      ...process.env,
      NI_MODE: mode,
      NI_ROOT: env.root,
      NI_STORE_URL: STORE_URL,
      NI_INDEX_URL: INGRESS_URL,
      NI_REQUEST: requestId,
      NI_HASH: canonicalPayloadHash({ ...BODY(requestId) }),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const readyPath = join(env.root, 'marker-ready.json')
  const deadline = Date.now() + 15000
  while (Date.now() < deadline && !existsSync(readyPath)) {
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
  if (!existsSync(readyPath)) throw new Error(`crash child ${mode} never ready`)
  const kill = async () => {
    child.kill('SIGKILL')
    await new Promise((resolveExit) => (child.exitCode !== null ? resolveExit() : child.once('exit', resolveExit)))
  }
  const marker = (name) => JSON.parse(readFileSync(join(env.root, `marker-${name}.json`), 'utf8'))
  return { kill, marker }
}
