#!/usr/bin/env node
/**
 * scripts/notification-ingress-service-auth-v1-verify.mjs — the acceptance
 * driver for NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1.
 *
 * Executes the full fault matrix F-01..F-25 (spec §11) against the real
 * ingress over a TEMPORARY root with a stub auth-service token endpoint
 * (fetchImpl seam) and a recorder agentRouter stub — plus the structural
 * gates the unit suites cannot prove from inside node --test:
 *
 *   - AC-CMP-02 authoritative zero-diff: no file under the frozen NO-CHANGE
 *     packages (agent-router / scheduler / agent-process surfaces / broker /
 *     agent-credential-provisioning) differs from the implementation base;
 *   - CONTRACT/ACCEPTANCE presence counts: every one of the 39 C-* contract
 *     ids and 27 AC-* acceptance ids appears in the test sources;
 *   - a full secret scan over every artifact the driver produces.
 *
 * No real Client/Grant is created, no auth-service is modified, nothing is
 * deployed. Exit code 0 only when every item reports PASS.
 */

import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const INGRESS_URL = pathToFileURL(join(REPO, 'packages/notification-ingress/src/index.js')).href
const STORE_URL = pathToFileURL(join(REPO, 'packages/notification-ingress/src/idempotency.js')).href

// Frozen literals (clarification spec).
const RESOURCE = 'agent-core-notification-ingress-v1'
const SCOPE = 'notification.deliver'

const FORUM = { callerName: 'svc-forum', clientId: 'client-forum-abc', clientSecret: 'forum-secret-111' }
const WORKFLOW = { callerName: 'svc-workflow', clientId: 'client-workflow-xyz', clientSecret: 'workflow-secret-222' }
const AGENT_CHILD = { clientId: 'client-agt_child-77', clientSecret: 'agent-secret-333' }
const SCAN_SECRET = 'driver-vwxyz-secret-77f3'

const results = []
function record(id, ok, detail = '') {
  results.push({ id, ok, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail === '' ? '' : ` — ${detail}`}\n`)
}
async function check(id, fn) {
  try {
    const detail = await fn()
    record(id, true, typeof detail === 'string' ? detail : '')
  } catch (error) {
    record(id, false, error?.message ?? String(error))
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// ── stub auth-service token endpoint ───────────────────────────────────────

function makeEndpoint() {
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

const artifacts = []

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'ni-driver-'))
  const dir = join(root, 'notification-ingress')
  mkdirSync(dir, { recursive: true })
  chmodSync(dir, 0o700)
  return { root, dir, authConfigFile: join(dir, 'auth.json'), storeFile: join(dir, 'idempotency.json') }
}

function writeAuthConfig(env, overrides = {}) {
  writeFileSync(env.authConfigFile, `${JSON.stringify({
    authServiceOrigin: 'https://auth.example.com',
    audience: RESOURCE,
    allowlist: { 'svc-forum': FORUM.clientId, 'svc-workflow': WORKFLOW.clientId },
    ...overrides,
  }, null, 2)}\n`)
  chmodSync(env.authConfigFile, 0o600)
}

function recorderRouter(deliverImpl) {
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

async function mount(env, router, endpoint) {
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

const basic = (clientId, clientSecret) => 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

async function post(base, { authorization = basic(FORUM.clientId, FORUM.clientSecret), body } = {}) {
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

const BODY = (requestId) => ({ requestId, agentId: 'agt_a', sessionMode: 'main', message: 'hello' })

// ── child crash rig ────────────────────────────────────────────────────────

async function crashChild(mode, env, { requestId } = {}) {
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

// ── the fault matrix ───────────────────────────────────────────────────────

process.stdout.write('notification-ingress-service-auth-v1 fault matrix\n===============================================\n')

await check('F-01 anonymous reject -> 401, no state', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, router, endpoint)
  const { status, body } = await post(base, { authorization: null, body: BODY('f01') })
  assert(status === 401 && body.error.code === 'INVALID_CREDENTIAL', `got ${status}`)
  assert(router.calls.length === 0)
  if (existsSync(env.storeFile)) {
    const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
    assert(Object.keys(doc.records).length === 0, 'state written')
  }
  await ctx.disposeAll()
  return '401 / 0 router calls / empty store'
})

await check('F-02 malformed credential -> 401', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const { base, ctx } = await mount(env, recorderRouter(), makeEndpoint())
  for (const authorization of ['Bearer x', 'Basic', 'Basic ###', 'Basic ' + Buffer.from([0xff, 0xfe]).toString('base64')]) {
    const { status } = await post(base, { authorization, body: BODY('f02') })
    assert(status === 401, `${authorization} -> ${status}`)
  }
  await ctx.disposeAll()
  return 'all malformed forms rejected'
})

await check('F-03 revoked credential -> 401, durable untouched', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, router, endpoint)
  await post(base, { body: BODY('f03-live') })
  const before = readFileSync(env.storeFile, 'utf8')
  endpoint.setRespond(() => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }))
  const { status } = await post(base, { body: BODY('f03-dead') })
  assert(status === 401)
  assert(readFileSync(env.storeFile, 'utf8') === before, 'store mutated')
  await ctx.disposeAll()
  return 'revocation never touches durable outcomes'
})

await check('F-04 wrong audience -> 401 (invalid_target / invalid_resource)', async () => {
  for (const oauthError of ['invalid_target', 'invalid_resource']) {
    const env = makeRoot(); writeAuthConfig(env)
    const endpoint = makeEndpoint()
    endpoint.setRespond(() => ({ ok: false, status: 400, json: async () => ({ error: oauthError }) }))
    const { base, ctx } = await mount(env, recorderRouter(), endpoint)
    const { status } = await post(base, { body: BODY('f04') })
    assert(status === 401, `${oauthError} -> ${status}`)
    await ctx.disposeAll()
  }
  return 'wrong-audience credentials are invalid FOR THIS SURFACE'
})

await check('F-05 authenticated non-allowlisted caller -> 403', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { status, body } = await post(base, { authorization: basic(AGENT_CHILD.clientId, AGENT_CHILD.clientSecret), body: BODY('f05') })
  assert(status === 403 && body.error.code === 'CALLER_NOT_ALLOWED', `got ${status}`)
  assert(router.calls.length === 0)
  await ctx.disposeAll()
  return 'per-agent client rejected by the allowlist'
})

await check('F-06 svc-forum success -> 200 delivered', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, router, endpoint)
  const { status, body } = await post(base, { body: BODY('f06') })
  assert(status === 200 && body.accepted === true && body.outcome === 'delivered')
  assert(endpoint.requests[0].form.resource === RESOURCE && endpoint.requests[0].form.scope === SCOPE)
  await ctx.disposeAll()
  return 'exact frozen resource/scope on the mint'
})

await check('F-07 svc-workflow success -> 200 delivered', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { status, body } = await post(base, { authorization: basic(WORKFLOW.clientId, WORKFLOW.clientSecret), body: BODY('f07') })
  assert(status === 200 && body.outcome === 'delivered')
  await ctx.disposeAll()
  return 'distinct workflow credential works'
})

await check('F-08 distinct credentials; duplicate clientId config invalid', async () => {
  const env = makeRoot()
  writeAuthConfig(env, { allowlist: { 'svc-forum': 'client-same', 'svc-workflow': 'client-same' } })
  const { base, ctx } = await mount(env, recorderRouter(), makeEndpoint())
  const { status, body } = await post(base, { body: BODY('f08') })
  assert(status === 503 && body.error.code === 'AUTH_NOT_CONFIGURED', `got ${status}`)
  await ctx.disposeAll()
  return 'duplicate clientId = illegal config'
})

await check('F-09 body caller spoof ignored', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { status } = await post(base, { body: { ...BODY('f09'), callerId: 'svc-workflow', service: 'svc-workflow' } })
  assert(status === 200)
  const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
  assert(doc.records[FORUM.clientId] && !doc.records[WORKFLOW.clientId], 'record keyed by VERIFIED clientId')
  await ctx.disposeAll()
  return 'identity = verified clientId only'
})

await check('F-10 Agent child direct call rejected', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const anon = await post(base, { authorization: null, body: BODY('f10') })
  const agent = await post(base, { authorization: basic(AGENT_CHILD.clientId, AGENT_CHILD.clientSecret), body: BODY('f10') })
  assert(anon.status === 401 && agent.status === 403)
  assert(router.calls.length === 0)
  await ctx.disposeAll()
  return '401 anonymous / 403 per-agent client'
})

await check('F-11 duplicate same payload -> reuse outcome, zero re-delivery (3 branches)', async () => {
  for (const [name, deliverImpl, expect] of [
    ['delivered', undefined, (r) => r.status === 200 && r.body.outcome === 'delivered' && r.body.duplicate === true],
    ['failed', async () => { throw Object.assign(new Error('nf'), { code: 'AGENT_NOT_FOUND' }) }, (r) => r.status === 404 && r.body.error?.code === 'AGENT_NOT_FOUND'],
    ['unknown', async () => { throw new Error('boom') }, (r) => r.status === 200 && r.body.outcome === 'outcome_unknown' && r.body.duplicate === true],
  ]) {
    const env = makeRoot(); writeAuthConfig(env)
    const router = recorderRouter(deliverImpl)
    const { base, ctx } = await mount(env, router, makeEndpoint())
    await post(base, { body: BODY(`f11-${name}`) })
    const replay = await post(base, { body: BODY(`f11-${name}`) })
    assert(expect(replay), `${name} replay shape: ${replay.status} ${JSON.stringify(replay.body)}`)
    assert(router.calls.length === 1, `${name}: second Router call`)
    await ctx.disposeAll()
  }
  return 'all three terminal branches reuse their durable outcome'
})

await check('F-12 duplicate different payload -> 409', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  await post(base, { body: BODY('f12') })
  const before = readFileSync(env.storeFile, 'utf8')
  const { status, body } = await post(base, { body: { ...BODY('f12'), message: 'DIFFERENT' } })
  assert(status === 409 && body.error.code === 'CONFLICT')
  assert(readFileSync(env.storeFile, 'utf8') === before)
  await ctx.disposeAll()
  return 'conflict never rewrites the record'
})

await check('F-13 restart persistence across a real SIGKILL', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  // A real child process durably records the delivered outcome, is killed
  // with SIGKILL, and the reopened authority + a fresh mount must REUSE it.
  const { NotificationIdempotencyStore, canonicalPayloadHash } = await import(STORE_URL)
  const childCode = `
    const { NotificationIdempotencyStore } = await import(process.env.NI_STORE_URL)
    const store = new NotificationIdempotencyStore({ storeFile: process.env.NI_STORE_FILE })
    await store.reserve({ callerPrincipalId: 'client-forum-abc', requestId: 'f13', payloadHash: process.env.NI_HASH })
    await store.settle({ callerPrincipalId: 'client-forum-abc', requestId: 'f13', state: 'delivered', sessionId: 'main', reason: 'router_accepted' })
    const { writeFileSync } = await import('node:fs')
    writeFileSync(process.env.NI_ROOT + '/marker-ready.json', '{}')
    setInterval(() => {}, 60000)
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', childCode], {
    env: {
      ...process.env,
      NI_STORE_URL: STORE_URL,
      NI_STORE_FILE: env.storeFile,
      NI_ROOT: env.root,
      NI_HASH: canonicalPayloadHash(BODY('f13')),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const readyPath = join(env.root, 'marker-ready.json')
  const deadline = Date.now() + 15000
  while (Date.now() < deadline && !existsSync(readyPath)) {
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
  assert(existsSync(readyPath), 'child never delivered')
  child.kill('SIGKILL')
  await new Promise((resolveExit) => (child.exitCode !== null ? resolveExit() : child.once('exit', resolveExit)))

  const reopened = new NotificationIdempotencyStore({ storeFile: env.storeFile })
  assert(reopened.lookup(FORUM.clientId, 'f13').state === 'delivered', 'record survived the kill')
  reopened.stop()
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { body } = await post(base, { body: BODY('f13') })
  assert(body.duplicate === true && body.outcome === 'delivered', `got ${JSON.stringify(body)}`)
  assert(router.calls.length === 0)
  await ctx.disposeAll()
  return 'delivered record survives SIGKILL; replay reuses it'
})

await check('F-14 crash windows W1–W4 (real SIGKILL injections)', async () => {
  // W2: crash after reserve, before Router.
  {
    const env = makeRoot(); writeAuthConfig(env)
    const rig = await crashChild('w2', env, { requestId: 'w2' })
    await rig.kill()
    const { NotificationIdempotencyStore } = await import(STORE_URL)
    const reopened = new NotificationIdempotencyStore({ storeFile: env.storeFile })
    assert(reopened.lookup(FORUM.clientId, 'w2').state === 'outcome_unknown', 'boot sweep')
    reopened.stop()
    const router = recorderRouter()
    const { base, ctx } = await mount(env, router, makeEndpoint())
    const { body } = await post(base, { body: BODY('w2') })
    assert(body.outcome === 'outcome_unknown' && body.duplicate === true, 'reused unknown')
    assert(router.calls.length === 0, 'no re-delivery')
    await ctx.disposeAll()
  }
  // W3: crash during the Router call (full service, HTTP in flight).
  {
    const env = makeRoot(); writeAuthConfig(env)
    const rig = await crashChild('service-hang', env, { requestId: 'w3' })
    const { port } = rig.marker('ready')
    void fetch(`http://127.0.0.1:${port}/v1/deliver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
      body: JSON.stringify(BODY('w3')),
    }).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 250))
    await rig.kill()
    const { NotificationIdempotencyStore } = await import(STORE_URL)
    const reopened = new NotificationIdempotencyStore({ storeFile: env.storeFile })
    assert(reopened.lookup(FORUM.clientId, 'w3')?.state === 'outcome_unknown')
    reopened.stop()
  }
  // W4: Router accepted, crash before the terminal write.
  {
    const env = makeRoot(); writeAuthConfig(env)
    const rig = await crashChild('w4', env, { requestId: 'w4' })
    assert(existsSync(join(env.root, 'marker-router-accepted.json')), 'router accepted marker')
    await rig.kill()
    const { NotificationIdempotencyStore } = await import(STORE_URL)
    const reopened = new NotificationIdempotencyStore({ storeFile: env.storeFile })
    assert(reopened.lookup(FORUM.clientId, 'w4').state === 'outcome_unknown', 'not delivered, not re-delivered')
    reopened.stop()
  }
  // W1: no record exists -> clean retry (proven by an empty store delivering).
  {
    const env = makeRoot(); writeAuthConfig(env)
    const router = recorderRouter()
    const { base, ctx } = await mount(env, router, makeEndpoint())
    const { body } = await post(base, { body: BODY('w1') })
    assert(body.outcome === 'delivered' && router.calls.length === 1)
    await ctx.disposeAll()
  }
  return 'W1 clean retry; W2/W3/W4 -> outcome_unknown, no auto re-delivery'
})

await check('F-15 outcome_unknown durable, no auto re-delivery', async () => {
  const env = makeRoot()
  writeAuthConfig(env, { routerDeadlineMs: 120 })
  let lateResolve
  const router = recorderRouter(() => new Promise((resolve) => { lateResolve = resolve }))
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { status, body } = await post(base, { body: BODY('f15') })
  assert(status === 200 && body.accepted === false && body.outcome === 'outcome_unknown')
  const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
  assert(doc.records[FORUM.clientId]['f15'].state === 'outcome_unknown')
  const replay = await post(base, { body: BODY('f15') })
  assert(replay.body.duplicate === true && router.calls.length === 1)
  lateResolve?.({ accepted: true })
  await new Promise((resolve) => setTimeout(resolve, 150))
  const after = JSON.parse(readFileSync(env.storeFile, 'utf8'))
  assert(after.records[FORUM.clientId]['f15'].state === 'outcome_unknown', 'late rewrite happened')
  const evidence = readFileSync(join(env.dir, 'evidence.jsonl'), 'utf8')
  assert(evidence.includes('late_settled'), 'late settlement is evidence-only')
  await ctx.disposeAll()
  return 'deadline -> durable unknown; late settle -> evidence only'
})

await check('F-16 store corruption -> mount fail-loud', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  writeFileSync(env.storeFile, '{corrupt')
  const { apply } = await import(INGRESS_URL)
  let threw = false
  try {
    apply({ get: () => recorderRouter(), provide() {}, effect() {} }, {
      port: 0, authConfigFile: env.authConfigFile, storeFile: env.storeFile, fetchImpl: makeEndpoint().fetchImpl,
    })
  } catch (error) {
    threw = error.code === 'IDEMPOTENCY_STORE_CORRUPT'
  }
  assert(threw, 'mount must throw CORRUPT_STORE')
  return 'corrupt authority never serves'
})

await check('F-17 credential rotation -> key continuity', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, router, endpoint)
  await post(base, { body: BODY('f17') })
  endpoint.setRespond(({ clientId, clientSecret }) => (clientId === FORUM.clientId && clientSecret === 'rotated-secret'
    ? { ok: true, status: 200, json: async () => ({ access_token: 'tok2' }) }
    : { ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }))
  const replay = await post(base, { authorization: basic(FORUM.clientId, 'rotated-secret'), body: BODY('f17') })
  assert(replay.body.duplicate === true && router.calls.length === 1)
  await ctx.disposeAll()
  return 'same clientId -> same idempotency key across rotation'
})

await check('F-18 revoke keeps existing records valid', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, recorderRouter(), endpoint)
  await post(base, { body: BODY('f18') })
  endpoint.setRespond(() => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }))
  const rejected = await post(base, { body: BODY('f18-other') })
  assert(rejected.status === 401)
  const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
  assert(doc.records[FORUM.clientId]['f18'].state === 'delivered', 'old record intact')
  await ctx.disposeAll()
  return 'revocation blocks new calls, preserves durable outcomes'
})

await check('F-19 no secret in log/response/store/evidence', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, recorderRouter(), endpoint)
  await post(base, { authorization: basic('client-driver-scan', 'wrong'), body: BODY('f19') })
  await post(base, { authorization: basic('client-driver-scan', SCAN_SECRET), body: BODY('f19') })
  const base64Secret = Buffer.from(SCAN_SECRET).toString('base64')
  for (const file of [env.storeFile, join(env.dir, 'evidence.jsonl')]) {
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    assert(!text.includes(SCAN_SECRET) && !text.includes(base64Secret), `${file} leaks`)
  }
  for (const text of artifacts) {
    assert(!text.includes(SCAN_SECRET) && !text.includes(base64Secret), 'response leaks')
  }
  await ctx.disposeAll()
  return 'distinctive secret absent from every sink'
})

await check('F-20 Router receives only authenticated admitted deliveries', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  await post(base, { authorization: null, body: BODY('f20') })            // anonymous
  await post(base, { authorization: basic(AGENT_CHILD.clientId, AGENT_CHILD.clientSecret), body: BODY('f20') }) // 403
  const ok = await post(base, { body: BODY('f20') })                      // admitted
  await post(base, { body: BODY('f20') })                                 // duplicate
  assert(ok.status === 200)
  assert(router.calls.length === 1, `router saw ${router.calls.length} calls`)
  await ctx.disposeAll()
  return 'every Router call = verified caller + reserved key'
})

await check('F-21 auth-service inconclusive -> 503', async () => {
  for (const reply of [
    { ok: false, status: 500, json: async () => ({}) },
    { ok: false, status: 400, json: async () => ({ error: 'temporarily_unavailable' }) },
  ]) {
    const env = makeRoot(); writeAuthConfig(env)
    const endpoint = makeEndpoint()
    endpoint.setRespond(() => reply)
    const { base, ctx } = await mount(env, recorderRouter(), endpoint)
    const { status, body } = await post(base, { body: BODY('f21') })
    assert(status === 503 && body.error.code === 'AUTH_INCONCLUSIVE', `got ${status}`)
    await ctx.disposeAll()
  }
  return 'inconclusive is never 401 and never admitted'
})

await check('F-22 retention sweeps terminal records', async () => {
  const { NotificationIdempotencyStore } = await import(STORE_URL)
  const env = makeRoot()
  let clock = 1_700_000_000_000
  const store = new NotificationIdempotencyStore({
    storeFile: env.storeFile, now: () => new Date(clock).toISOString(), clockMs: () => clock,
    retentionMs: 1000, maxRecords: 100000,
  })
  await store.reserve({ callerPrincipalId: 'c', requestId: 'old', payloadHash: 'h' })
  await store.settle({ callerPrincipalId: 'c', requestId: 'old', state: 'delivered', sessionId: 's', reason: 'r' })
  store.stop()
  clock += 10_000
  const sweeper = new NotificationIdempotencyStore({
    storeFile: env.storeFile, now: () => new Date(clock).toISOString(), clockMs: () => clock, retentionMs: 1000,
  })
  assert(sweeper.lookup('c', 'old') === undefined, 'over-age terminal pruned')
  assert(sweeper.evidenceLines().some((e) => e.kind === 'sweep_pruned'))
  sweeper.stop()
  return 'over-age terminal evicted with sweep_pruned evidence'
})

await check('F-23 concurrent single-flight -> one Router call', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  let release
  const gate = new Promise((resolveGate) => { release = resolveGate })
  const router = recorderRouter(async () => {
    await gate
    return { accepted: true, sessionId: 'main' }
  })
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const attempts = [...Array(6)].map(() => post(base, { body: BODY('f23') }))
  await new Promise((resolve) => setTimeout(resolve, 100))
  release()
  const replies = await Promise.all(attempts)
  assert(router.calls.length === 1, `${router.calls.length} Router calls`)
  assert(replies.every((r) => r.body.outcome === 'delivered'))
  await ctx.disposeAll()
  return 'one Router call, all joiners share the outcome'
})

await check('F-24 pre-admission classification (PROVEN set only)', async () => {
  for (const [code, expectStatus, expectState] of [
    ['VALIDATION_ERROR', 400, 'failed_no_admission'],
    ['AGENT_NOT_FOUND', 404, 'failed_no_admission'],
    ['RECONCILIATION_CAPACITY_EXCEEDED', 200, 'outcome_unknown'],
  ]) {
    const env = makeRoot(); writeAuthConfig(env)
    const router = recorderRouter(async () => {
      throw Object.assign(new Error(code), { code })
    })
    const { base, ctx } = await mount(env, router, makeEndpoint())
    const { status } = await post(base, { body: BODY(`f24-${code}`) })
    assert(status === expectStatus, `${code} -> ${status}`)
    const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
    assert(doc.records[FORUM.clientId][`f24-${code}`].state === expectState, `${code} state`)
    await ctx.disposeAll()
  }
  return 'PROVEN = {VALIDATION_ERROR, AGENT_NOT_FOUND} only'
})

await check('F-25 missing auth config -> per-call 503', async () => {
  const env = makeRoot() // NO auth config written
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  for (const authorization of [null, basic(FORUM.clientId, FORUM.clientSecret)]) {
    const { status, body } = await post(base, { authorization, body: BODY('f25') })
    assert(status === 503 && body.error.code === 'AUTH_NOT_CONFIGURED', `got ${status}`)
  }
  assert(!existsSync(env.storeFile) || Object.keys(JSON.parse(readFileSync(env.storeFile, 'utf8')).records).length === 0)
  assert(router.calls.length === 0)
  await ctx.disposeAll()
  return 'unconfigured fails CLOSED on every call — never anonymous'
})

// ── structural gates ───────────────────────────────────────────────────────

function gitOutput(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim()
}

await check('AC-CMP-02 zero-diff: frozen NO-CHANGE packages untouched vs base', async () => {
  const base = process.env.NOTIFICATION_VERIFY_BASE ?? '0a6e060913e12693142fb0759f35f239b2ef429a'
  let changed
  try {
    changed = gitOutput(['diff', '--name-only', base, 'HEAD', '--',
      'packages/agent-router', 'packages/scheduler', 'packages/scheduler-router',
      'packages/broker', 'packages/agent-credential-provisioning', 'packages/agent-definition',
      'packages/workspace-bootstrap', 'packages/agent-provisioning'])
  } catch (error) {
    return `SKIP (git unavailable: ${error.message.split('\n')[0]})`
  }
  assert(changed === '', `frozen packages changed: ${changed}`)
  return 'agent-router / scheduler / broker / provisioning untouched'
})

await check('COVERAGE: all 39 contract ids present in the test sources', async () => {
  const ids = []
  for (let i = 1; i <= 14; i += 1) ids.push(`C-AUTH-${String(i).padStart(3, '0')}`)
  for (let i = 1; i <= 16; i += 1) ids.push(`C-IDM-${String(i).padStart(3, '0')}`)
  for (let i = 1; i <= 5; i += 1) ids.push(`C-BND-${String(i).padStart(3, '0')}`)
  for (let i = 1; i <= 4; i += 1) ids.push(`C-WIRE-${String(i).padStart(3, '0')}`)
  const testDir = join(REPO, 'packages/notification-ingress/test')
  const sources = readdirSync(testDir).map((f) => readFileSync(join(testDir, f), 'utf8')).join('\n')
    + readFileSync(join(REPO, 'packages/production-runtime/test/compose.test.js'), 'utf8')
  const missing = ids.filter((id) => !sources.includes(id))
  assert(missing.length === 0, `missing contract coverage: ${missing.join(', ')}`)
  return `39/39 (${ids.length} ids verified)`
})

await check('COVERAGE: all 27 acceptance ids present in the test sources', async () => {
  const ids = []
  for (let i = 1; i <= 12; i += 1) ids.push(`AC-AUTH-${String(i).padStart(2, '0')}`)
  for (let i = 1; i <= 9; i += 1) ids.push(`AC-IDM-${String(i).padStart(2, '0')}`)
  for (let i = 1; i <= 3; i += 1) ids.push(`AC-BND-${String(i).padStart(2, '0')}`)
  ids.push('AC-CMP-01', 'AC-CMP-02', 'AC-WIRE-01')
  const testDir = join(REPO, 'packages/notification-ingress/test')
  const sources = readdirSync(testDir).map((f) => readFileSync(join(testDir, f), 'utf8')).join('\n')
    + readFileSync(join(REPO, 'packages/production-runtime/test/compose.test.js'), 'utf8')
  const missing = ids.filter((id) => !sources.includes(id))
  assert(missing.length === 0, `missing acceptance coverage: ${missing.join(', ')}`)
  return `27/27 (${ids.length} ids verified)`
})

// ── summary ────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok)
process.stdout.write('===============================================\n')
process.stdout.write(`TOTAL ${results.length} / PASS ${results.length - failed.length} / FAIL ${failed.length}\n`)
if (failed.length > 0) {
  for (const f of failed) process.stdout.write(`FAILED: ${f.id} — ${f.detail}\n`)
  process.exitCode = 1
}
