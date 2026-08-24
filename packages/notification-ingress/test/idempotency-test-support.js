import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { apply as applyIngress } from '../src/index.js'
import { STORE_VERSION, canonicalPayloadHash } from '../src/idempotency.js'
import { NOTIFICATION_RESOURCE } from '../src/auth.js'

export const SRC = fileURLToPath(new URL('../src', import.meta.url))
export const STORE_URL = pathToFileURL(join(SRC, 'idempotency.js')).href
export const INDEX_URL = pathToFileURL(join(SRC, 'index.js')).href

export const FORUM = { clientId: 'client-forum-abc', clientSecret: 'forum-secret-111' }
export const WORKFLOW = { clientId: 'client-workflow-xyz', clientSecret: 'workflow-secret-222' }
export const VALID_BODY = { requestId: 'req_01', agentId: 'agt_a', sessionMode: 'main', message: 'hello' }

// ── helpers ────────────────────────────────────────────────────────────────

export function fakeCtx(services) {
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

export function stubRouter(deliverImpl) {
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

export function okFetch() {
  return async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) })
}

export function writeAuthConfig(root) {
  const dir = join(root, 'notification-ingress')
  mkdirSync(dir, { recursive: true })
  chmodSync(dir, 0o700)
  const file = join(dir, 'auth.json')
  writeFileSync(file, `${JSON.stringify({
    authServiceOrigin: 'https://auth.example.com',
    audience: NOTIFICATION_RESOURCE,
    allowlist: { 'svc-forum': FORUM.clientId, 'svc-workflow': WORKFLOW.clientId },
  }, null, 2)}\n`)
  chmodSync(file, 0o600)
  return file
}

export function makeRoot(t, { authConfig = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ni-idm-'))
  t.after(() => { try { rmSync(root, { recursive: true, force: true }) } catch { /* best effort */ } })
  const authConfigFile = authConfig ? writeAuthConfig(root) : undefined
  return { root, authConfigFile, storeFile: join(root, 'notification-ingress', 'idempotency.json') }
}

export async function mount(t, { root, router, fetchImpl, config = {} } = {}) {
  const ctx = fakeCtx(new Map([['agentRouter', router ?? stubRouter()]]))
  const api = applyIngress(ctx, {
    port: 0,
    authConfigFile: root.authConfigFile,
    storeFile: root.storeFile,
    fetchImpl: fetchImpl ?? okFetch(),
    ...config,
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

export const basic = (clientId, clientSecret) => 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

export async function deliver(base, { authorization = basic(FORUM.clientId, FORUM.clientSecret), body } = {}) {
  const res = await fetch(`${base}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization },
    body: JSON.stringify(body ?? VALID_BODY),
  })
  const text = await res.text()
  return { status: res.status, body: text === '' ? null : JSON.parse(text) }
}

export function readStoreDoc(root) {
  if (!existsSync(root.storeFile)) return { version: STORE_VERSION, records: {} }
  return JSON.parse(readFileSync(root.storeFile, 'utf8'))
}

export function recordOf(root, clientId = FORUM.clientId, requestId = VALID_BODY.requestId) {
  return readStoreDoc(root).records[clientId]?.[requestId]
}

// ── child-process crash rig (real SIGKILL) ─────────────────────────────────

export const CHILD_CODE = `
const { writeFileSync, readFileSync, mkdirSync } = await import('node:fs')
const { pathToFileURL } = await import('node:url')
const mode = process.env.NI_MODE
const root = process.env.NI_ROOT
const marker = (name, data) => writeFileSync(root + '/marker-' + name + '.json', JSON.stringify(data))
const { NotificationIdempotencyStore } = await import(process.env.NI_STORE_URL)
const hang = () => setInterval(() => {}, 60000)

if (mode === 'w1') {
  // Crash BEFORE the reserve commit: store mounted, nothing reserved.
  const store = new NotificationIdempotencyStore({ storeFile: root + '/notification-ingress/idempotency.json' })
  marker('ready', { phase: 'pre-reserve' })
  hang()
}
if (mode === 'w2') {
  // Crash AFTER the reserve commit, BEFORE the Router call.
  const store = new NotificationIdempotencyStore({ storeFile: root + '/notification-ingress/idempotency.json' })
  await store.reserve({ callerPrincipalId: process.env.NI_CLIENT, requestId: process.env.NI_REQUEST, payloadHash: process.env.NI_HASH })
  marker('ready', { phase: 'reserved' })
  hang()
}
if (mode === 'w4') {
  // Router ACCEPTED, crash BEFORE the terminal write: reserve, let the
  // "Router" accept (marker), then hang without ever settling.
  const store = new NotificationIdempotencyStore({ storeFile: root + '/notification-ingress/idempotency.json' })
  await store.reserve({ callerPrincipalId: process.env.NI_CLIENT, requestId: process.env.NI_REQUEST, payloadHash: process.env.NI_HASH })
  marker('router-accepted', { phase: 'router-returned-accepted' }) // the Router call itself
  marker('ready', { phase: 'accepted-not-settled' })
  hang()
}
if (mode === 'service' || mode === 'service-hang') {
  // Full ingress service in this child; the parent drives it over HTTP.
  const { apply } = await import(process.env.NI_INDEX_URL)
  const routerCalls = []
  const router = {
    deliver: (payload) => new Promise((resolve, reject) => {
      routerCalls.push(payload)
      if (process.env.NI_MODE === 'service-hang') return // never settles: W3
      resolve({ accepted: true, sessionId: payload.sessionMode === 'fresh' ? 'ses_fresh_1' : 'main' })
    }),
  }
  const ctx = { get: () => router, provide() {}, effect() {} }
  const api = apply(ctx, {
    port: 0,
    authConfigFile: root + '/notification-ingress/auth.json',
    storeFile: root + '/notification-ingress/idempotency.json',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) }),
  })
  await new Promise((r) => { const w = () => { api.address()?.port ? r() : setTimeout(w, 5) } ; w() })
  marker('ready', { phase: 'listening', port: api.address().port, routerCalls })
  hang()
}
`

export async function runCrashChild(t, mode, root, { client = FORUM.clientId, requestId = VALID_BODY.requestId, hash } = {}) {
  const payloadHash = hash ?? canonicalPayloadHash({ ...VALID_BODY, requestId })
  const child = spawn(process.execPath, ['--input-type=module', '-e', CHILD_CODE], {
    env: {
      ...process.env,
      NI_MODE: mode,
      NI_ROOT: root,
      NI_STORE_URL: STORE_URL,
      NI_INDEX_URL: INDEX_URL,
      NI_CLIENT: client,
      NI_REQUEST: requestId,
      NI_HASH: payloadHash,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk })
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGKILL') } catch { /* already dead */ }
    }
  })
  const readyPath = join(root, 'marker-ready.json')
  const ready = await waitForFile(readyPath, 15000)
  assert.equal(ready, true, `crash child (${mode}) never became ready; stderr: ${stderr.slice(-500)}`)
  return {
    child,
    async sigkill() {
      child.kill('SIGKILL')
      await new Promise((resolveExit) => {
        if (child.exitCode !== null) resolveExit()
        else child.once('exit', resolveExit)
      })
    },
    readMarker: (name) => JSON.parse(readFileSync(join(root, `marker-${name}.json`), 'utf8')),
  }
}

export async function waitForFile(path, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(path)) return true
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
  return existsSync(path)
}
