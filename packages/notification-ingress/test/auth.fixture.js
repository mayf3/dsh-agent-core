import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply as applyIngress } from '../src/index.js'
import { NOTIFICATION_RESOURCE } from '../src/auth.js'

export const FORUM = { callerName: 'svc-forum', clientId: 'client-forum-abc', clientSecret: 'forum-secret-111' }
export const WORKFLOW = { callerName: 'svc-workflow', clientId: 'client-workflow-xyz', clientSecret: 'workflow-secret-222' }
export const AGENT_CHILD = { clientId: 'client-agt_child-77', clientSecret: 'agent-secret-333' }

/** Distinctive secret used by the non-echo scans. */
export const SCAN_SECRET = 'scan-vwxyz-secret-9f3a'

// ── helpers ────────────────────────────────────────────────────────────────

/** Fake cordis ctx: get/provide/effect only. */
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

/** Recording Router stub (frozen deliver contract). */
export function stubRouter(deliverImpl) {
  const calls = []
  return {
    calls,
    deliver: async (payload) => {
      calls.push(JSON.parse(JSON.stringify(payload)))
      if (deliverImpl !== undefined) return deliverImpl(payload)
      return { accepted: true, sessionId: payload.sessionMode === 'fresh' ? 'ses_fresh_1' : 'main' }
    },
  }
}

/**
 * Stub auth-service token endpoint (fetchImpl seam). The default registry
 * accepts every known client with its exact secret; per-test overrides swap
 * behavior. Records every request URL + parsed form + Basic credential.
 */
export function stubTokenEndpoint({ registry = new Map(), respond } = {}) {
  const requests = []
  // Mutable state so tests can flip behavior after mount (revoke/rotate).
  const state = { respond }
  const defaultRegistry = new Map([
    [FORUM.clientId, FORUM.clientSecret],
    [WORKFLOW.clientId, WORKFLOW.clientSecret],
    [AGENT_CHILD.clientId, AGENT_CHILD.clientSecret],
    ['client-scan', SCAN_SECRET],
    ...registry,
  ])
  return {
    requests,
    setRespond(fn) { state.respond = fn },
    fetchImpl: async (url, init) => {
      const basic = /^Basic (.+)$/i.exec(init?.headers?.Authorization ?? '')?.[1]
      const [clientId = '', clientSecret = ''] = basic === undefined
        ? ['', '']
        : Buffer.from(basic, 'base64').toString('utf8').split(':')
      const form = Object.fromEntries(new URLSearchParams(init.body))
      requests.push({ url, clientId, clientSecret, form })
      if (state.respond !== undefined) {
        const reply = state.respond({ clientId, clientSecret, form })
        if (reply !== undefined) return reply
      }
      if (defaultRegistry.get(clientId) === clientSecret) {
        return { ok: true, status: 200, json: async () => ({ access_token: `tok-${clientId}` }) }
      }
      return { ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }
    },
  }
}

/** Seed an operator auth config (0600 file inside a 0700 directory). */
export function writeAuthConfig(root, overrides = {}) {
  const dir = join(root, 'notification-ingress')
  mkdirSync(dir, { recursive: true })
  chmodSync(dir, 0o700)
  const file = join(dir, 'auth.json')
  const config = {
    authServiceOrigin: 'https://auth.example.com',
    audience: NOTIFICATION_RESOURCE,
    allowlist: { 'svc-forum': FORUM.clientId, 'svc-workflow': WORKFLOW.clientId },
    ...overrides,
  }
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
  chmodSync(file, 0o600)
  return file
}

/** Temp production-style root with the standard auth config. */
export function makeRoot(t, { withAuthConfig = true, overrides = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ni-auth-'))
  t.after(() => { try { rmSync(root, { recursive: true, force: true }) } catch { /* best effort */ } })
  const authConfigFile = withAuthConfig ? writeAuthConfig(root, overrides) : join(root, 'notification-ingress', 'auth.json')
  return { root, authConfigFile, storeFile: join(root, 'notification-ingress', 'idempotency.json') }
}

/** Mount the ingress on an ephemeral port; disposes with the test. */
export async function mount(t, { root, router, fetchImpl, config = {} } = {}) {
  const ctx = fakeCtx(new Map([['agentRouter', router ?? stubRouter()]]))
  const api = applyIngress(ctx, {
    port: 0,
    authConfigFile: root.authConfigFile,
    storeFile: root.storeFile,
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
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

export async function deliver(base, { authorization, body } = {}) {
  const res = await fetch(`${base}/v1/deliver`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization === undefined ? {} : { authorization }),
    },
    body: JSON.stringify(body ?? VALID_BODY),
  })
  const text = await res.text()
  return { status: res.status, body: text === '' ? null : JSON.parse(text), raw: text }
}

export const VALID_BODY = { requestId: 'req_01', agentId: 'agt_a', sessionMode: 'main', message: 'hello' }

/** Read the durable store document (test assertion surface). */
export function readStore(root) {
  const file = root.storeFile
  if (!existsSync(file)) return { version: 1, records: {} }
  return JSON.parse(readFileSync(file, 'utf8'))
}

export function writeAuthConfigAt(root, overrides) {
  const base = JSON.parse(readFileSync(root.authConfigFile, 'utf8'))
  const config = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete config[key]
    else config[key] = value
  }
  writeFileSync(root.authConfigFile, `${JSON.stringify(config, null, 2)}\n`)
  chmodSync(root.authConfigFile, 0o600)
}
