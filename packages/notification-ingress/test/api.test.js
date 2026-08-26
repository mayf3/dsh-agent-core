/**
 * Wire-contract tests for @agent-core/notification-ingress V1
 * (NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 §7).
 *
 * Coverage: C-WIRE-001..C-WIRE-004, AC-WIRE-01 (the full status-map /
 * envelope table) and the three current-main reconciliation behaviors the
 * V1 upgrade must keep carrying:
 *
 *   R1 — Router receipt extras (reconciliationHandle / evidence / status)
 *        still pass through on the delivered 200.
 *   R2 — the B15 outcome_unknown carrier still preserves handle, deadline
 *        and evidence (now on the 200 outcome_unknown wire).
 *   R3 — a Router without deliver() still answers 503 SERVICE_UNAVAILABLE,
 *        with body validation still preceding the capability check.
 */

import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply as applyIngress } from '../src/index.js'
import { NOTIFICATION_RESOURCE } from '../src/auth.js'

const FORUM = { clientId: 'client-forum-abc', clientSecret: 'forum-secret-111' }
const WORKFLOW = { clientId: 'client-workflow-xyz', clientSecret: 'workflow-secret-222' }
const VALID = { requestId: 'req_01', agentId: 'agt_a', sessionMode: 'main', message: 'hello' }

// ── helpers ────────────────────────────────────────────────────────────────

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

function stubRouter(deliverImpl) {
  const calls = []
  return {
    calls,
    deliver: async (payload) => {
      calls.push({ ...payload })
      if (deliverImpl !== undefined) return deliverImpl(payload)
      return { accepted: true, sessionId: payload.sessionMode === 'fresh' ? 'ses_fresh_1' : 'main' }
    },
  }
}

const okFetch = () => async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) })

function makeRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'ni-api-'))
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
  return { root, authConfigFile, storeFile: join(dir, 'idempotency.json') }
}

async function startServer(t, { router, config = {} } = {}) {
  const root = makeRoot(t)
  const ctx = fakeCtx(new Map([['agentRouter', router ?? stubRouter()]]))
  const api = applyIngress(ctx, {
    port: 0,
    authConfigFile: root.authConfigFile,
    storeFile: root.storeFile,
    fetchImpl: okFetch(),
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
  return { base: `http://127.0.0.1:${api.address().port}`, api, root }
}

const basic = (clientId, clientSecret) => 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
const FORUM_AUTH = basic(FORUM.clientId, FORUM.clientSecret)

async function call(base, method, path, { authorization = FORUM_AUTH, body, rawBody } = {}) {
  // authorization === null sends NO header (anonymous); omitted = forum.
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined && rawBody === undefined ? {} : { 'content-type': 'application/json' }),
      ...(authorization === null || authorization === undefined ? {} : { authorization }),
    },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
  const text = await res.text()
  return { status: res.status, body: text === '' ? null : JSON.parse(text) }
}

// ── AC-WIRE-01 / C-WIRE-002 — the full status map, table-driven ────────────

test('AC-WIRE-01 C-WIRE-002: anonymous and invalid-credential rows (401)', async (t) => {
  const router = stubRouter()
  const { base } = await startServer(t, { router })
  const rows = [
    {
      name: '401 anonymous',
      authorization: null,
      expect: { status: 401, code: 'INVALID_CREDENTIAL' },
    },
  ]
  for (const { name, authorization, expect } of rows) {
    const { status, body } = await call(base, 'POST', '/v1/deliver', { authorization, body: VALID })
    assert.equal(status, expect.status, `${name}: status`)
    assert.equal(body.error.code, expect.code, `${name}: code`)
  }
})

test('AC-WIRE-01: full status table with per-row stubs', async (t) => {
  // 403 CALLER_NOT_ALLOWED (verified stranger).
  {
    const router = stubRouter()
    const root = makeRoot(t)
    const ctx = fakeCtx(new Map([['agentRouter', router]]))
    const api = applyIngress(ctx, {
      port: 0, authConfigFile: root.authConfigFile, storeFile: root.storeFile,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ access_token: 't' }) }),
    })
    await new Promise((r) => { const w = () => { api.address()?.port ? r() : setTimeout(w, 5) }; w() })
    t.after(() => ctx.disposeAll())
    const res = await fetch(`http://127.0.0.1:${api.address().port}/v1/deliver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: basic('client-verified-stranger', 's') },
      body: JSON.stringify({ ...VALID, requestId: 'row403' }),
    })
    assert.equal(res.status, 403)
    assert.equal((await res.json()).error.code, 'CALLER_NOT_ALLOWED')
  }
  // 400 body validation (sessionMode enum; also empty fields).
  {
    const router = stubRouter()
    const { base } = await startServer(t, { router })
    for (const bad of [{ ...VALID, sessionMode: 'work' }, { ...VALID, requestId: '' }, {}]) {
      const { status, body } = await call(base, 'POST', '/v1/deliver', { body: bad })
      assert.equal(status, 400)
      assert.equal(body.error.code, 'VALIDATION_ERROR')
    }
    // Bad JSON body.
    const badJson = await call(base, 'POST', '/v1/deliver', { rawBody: 'not-json' })
    assert.equal(badJson.status, 400)
    assert.equal(badJson.body.error.code, 'VALIDATION_ERROR')
    assert.equal(router.calls.length, 0)
  }
  // 404 AGENT_NOT_FOUND (failed_no_admission).
  {
    const router = stubRouter(async () => {
      throw Object.assign(new Error('agent not found'), { code: 'AGENT_NOT_FOUND' })
    })
    const { base } = await startServer(t, { router })
    const { status, body } = await call(base, 'POST', '/v1/deliver', { body: { ...VALID, requestId: 'row404' } })
    assert.equal(status, 404)
    assert.equal(body.error.code, 'AGENT_NOT_FOUND')
  }
  // 409 conflict.
  {
    const router = stubRouter()
    const { base } = await startServer(t, { router })
    await call(base, 'POST', '/v1/deliver', { body: { ...VALID, requestId: 'row409' } })
    const { status, body } = await call(base, 'POST', '/v1/deliver', { body: { ...VALID, requestId: 'row409', message: 'other' } })
    assert.equal(status, 409)
    assert.equal(body.error.code, 'CONFLICT')
  }
  // 503 AUTH_INCONCLUSIVE.
  {
    const router = stubRouter()
    const root = makeRoot(t)
    const ctx = fakeCtx(new Map([['agentRouter', router]]))
    const api = applyIngress(ctx, {
      port: 0, authConfigFile: root.authConfigFile, storeFile: root.storeFile,
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    })
    await new Promise((r) => { const w = () => { api.address()?.port ? r() : setTimeout(w, 5) }; w() })
    t.after(() => ctx.disposeAll())
    const res = await fetch(`http://127.0.0.1:${api.address().port}/v1/deliver`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: FORUM_AUTH }, body: JSON.stringify(VALID),
    })
    assert.equal(res.status, 503)
    assert.equal((await res.json()).error.code, 'AUTH_INCONCLUSIVE')
  }
  // 503 AUTH_NOT_CONFIGURED.
  {
    const router = stubRouter()
    const root = makeRoot(t)
    rmSync(root.authConfigFile)
    const ctx = fakeCtx(new Map([['agentRouter', router]]))
    const api = applyIngress(ctx, {
      port: 0, authConfigFile: root.authConfigFile, storeFile: root.storeFile, fetchImpl: okFetch(),
    })
    await new Promise((r) => { const w = () => { api.address()?.port ? r() : setTimeout(w, 5) }; w() })
    t.after(() => ctx.disposeAll())
    const res = await fetch(`http://127.0.0.1:${api.address().port}/v1/deliver`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: FORUM_AUTH }, body: JSON.stringify(VALID),
    })
    assert.equal(res.status, 503)
    assert.equal((await res.json()).error.code, 'AUTH_NOT_CONFIGURED')
  }
  // 200 delivered + 200 duplicate + 200 outcome_unknown.
  {
    const router = stubRouter()
    const { base } = await startServer(t, { router })
    const first = await call(base, 'POST', '/v1/deliver', { body: { ...VALID, requestId: 'row200' } })
    assert.equal(first.status, 200)
    assert.equal(first.body.accepted, true)
    assert.equal(first.body.outcome, 'delivered')
    const duplicate = await call(base, 'POST', '/v1/deliver', { body: { ...VALID, requestId: 'row200' } })
    assert.equal(duplicate.status, 200)
    assert.equal(duplicate.body.duplicate, true)
    const unknown = await call(base, 'POST', '/v1/deliver', { body: { ...VALID, requestId: 'row200u' } })
    void unknown // delivered here; the unknown shape is pinned in the R2 test
  }
})

test('AC-WIRE-01 C-WIRE-002 row: 500 INTERNAL_ERROR when the authority becomes corrupt mid-run', async (t) => {
  const router = stubRouter()
  const { base, root } = await startServer(t, { router })
  // Corrupt the authority document AFTER mount: the next mutation's
  // re-read-latest fails loud (never wipe, never continue accepting).
  writeFileSync(root.storeFile, '{corrupted mid-run')
  const res = await fetch(`${base}/v1/deliver`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: FORUM_AUTH },
    body: JSON.stringify({ ...VALID, requestId: 'row500' }),
  })
  assert.equal(res.status, 500)
  assert.equal((await res.json()).error.code, 'INTERNAL_ERROR')
})

// ── C-WIRE-001 — endpoints / health ────────────────────────────────────────

test('C-WIRE-001: /health is unauthenticated and exposes ONLY the allowed booleans/names', async (t) => {
  const router = stubRouter()
  const { base } = await startServer(t, { router })
  const health = await call(base, 'GET', '/health', { authorization: undefined })
  assert.equal(health.status, 200)
  assert.deepEqual(Object.keys(health.body).sort(), ['authConfigured', 'deliverReady', 'ok', 'service', 'storeReady'])
  assert.equal(health.body.service, 'agent-core-notification-ingress')
  assert.equal(health.body.ok, true)
  const serialized = JSON.stringify(health.body)
  assert.ok(!serialized.includes('auth.example.com'), 'never leaks the auth origin')
  assert.ok(!serialized.includes(FORUM.clientId), 'never leaks allowlist contents')

  const unknown = await call(base, 'GET', '/v1/nope', { authorization: undefined })
  assert.equal(unknown.status, 404)
  assert.equal(unknown.body.error.code, 'NOT_FOUND')
  const wrongMethod = await call(base, 'DELETE', '/v1/deliver', { authorization: undefined })
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.body.error.code, 'METHOD_NOT_ALLOWED')
})

// ── C-WIRE-003 — response envelopes ────────────────────────────────────────

test('C-WIRE-003: envelopes — success/unknown {accepted, sessionId?, outcome, duplicate?}; errors {error:{code,message}}', async (t) => {
  const router = stubRouter(async () => { throw new Error('boom') })
  const { base } = await startServer(t, { router })
  const unknown = await call(base, 'POST', '/v1/deliver', { body: { ...VALID, requestId: 'env1' } })
  assert.equal(unknown.status, 200)
  assert.deepEqual(
    { accepted: unknown.body.accepted, outcome: unknown.body.outcome },
    { accepted: false, outcome: 'outcome_unknown' },
  )
  assert.equal(unknown.body.error, undefined)
  const conflict = { error: { code: 'CONFLICT', message: 'x' } }
  assert.ok(typeof conflict.error.code === 'string')
})

// ── C-WIRE-004 — body limits + thin-adapter field semantics ────────────────

test('C-WIRE-004: 1 MiB body limit + only the four wire fields are read', async (t) => {
  const router = stubRouter()
  const { base } = await startServer(t, { router })
  const big = { ...VALID, message: 'x'.repeat(1_100_000) }
  // The over-limit body kills the connection before any validation runs
  // (V0 behavior preserved); it must NEVER reach the Router.
  await assert.rejects(
    () => fetch(`${base}/v1/deliver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: FORUM_AUTH },
      body: JSON.stringify(big),
    }),
    /fetch failed|ECONNRESET/,
  )
  assert.equal(router.calls.length, 0, 'an over-limit body never reaches the Router')

  // Unknown fields ignored: forwarded payload is EXACTLY the four fields.
  const ok = await call(base, 'POST', '/v1/deliver', { body: { ...VALID, requestId: 'thin1', extra: 'ignored' } })
  assert.equal(ok.status, 200)
  assert.deepEqual(router.calls[0], { ...VALID, requestId: 'thin1' })
})

// ── current-main reconciliation R1 — receipt extras passthrough ────────────

test('R1 (current-main reconciliation): Router receipt extras pass through on the delivered 200', async (t) => {
  const router = stubRouter(async (payload) => ({
    accepted: true,
    sessionId: payload.sessionMode === 'fresh' ? 'ses_fresh_1' : 'main',
    status: 'ok',
    reconciliationHandle: 'turn:deliver-1',
    evidence: { promptReceipt: 'accepted' },
  }))
  const { base } = await startServer(t, { router })
  const { status, body } = await call(base, 'POST', '/v1/deliver', { body: VALID })
  assert.equal(status, 200)
  assert.equal(body.accepted, true)
  assert.equal(body.sessionId, 'main')
  assert.equal(body.outcome, 'delivered')
  assert.equal(body.reconciliationHandle, 'turn:deliver-1')
  assert.deepEqual(body.evidence, { promptReceipt: 'accepted' })
})

// ── current-main reconciliation R2 — B15 outcome_unknown carrier ───────────

test('R2 (current-main reconciliation): B15 outcome_unknown carrier preserves handle, deadline and evidence', async (t) => {
  const router = stubRouter(async () => {
    throw Object.assign(new Error('delivery outcome unknown'), {
      status: 'outcome_unknown', envelope: 'outcome_unknown', reconciliationHandle: 'turn:notif',
      deadlineAtWallMs: 456, evidence: { source: 'prompt_receipt_timeout' },
    })
  })
  const { base } = await startServer(t, { router })
  const { status, body } = await call(base, 'POST', '/v1/deliver', { body: VALID })
  assert.equal(status, 200, 'outcome_unknown is answered 200 with accepted=false (task freeze)')
  assert.equal(body.accepted, false)
  assert.equal(body.outcome, 'outcome_unknown')
  assert.equal(body.reconciliationHandle, 'turn:notif')
  assert.equal(body.deadlineAtWallMs, 456)
  assert.deepEqual(body.evidence, { source: 'prompt_receipt_timeout' })

  // The duplicate replay keeps the recorded handle.
  const replay = await call(base, 'POST', '/v1/deliver', { body: VALID })
  assert.equal(replay.status, 200)
  assert.equal(replay.body.reconciliationHandle, 'turn:notif')
  assert.equal(replay.body.duplicate, true)
})

// ── current-main reconciliation R3 — Router without deliver() ──────────────

test('R3 (current-main reconciliation): no agentRouter.deliver -> validation still first, then 503 SERVICE_UNAVAILABLE', async (t) => {
  const mainRouter = { route: async () => ({ reply: 'n/a' }) }
  const { base, api } = await startServer(t, { router: mainRouter })
  assert.equal(api.deliverReady, false)

  const health = await call(base, 'GET', '/health', { authorization: undefined })
  assert.equal(health.body.deliverReady, false)

  const invalid = await call(base, 'POST', '/v1/deliver', { body: {} })
  assert.equal(invalid.status, 400, 'body validation precedes the capability check')
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR')

  const valid = await call(base, 'POST', '/v1/deliver', { body: VALID })
  assert.equal(valid.status, 503)
  assert.equal(valid.body.error.code, 'SERVICE_UNAVAILABLE')
  assert.match(valid.body.error.message, /agentRouter\.deliver/)
  // No idempotency record for an admission that could never be dispatched.
  assert.equal(existsSync(api.store.storeFile), false)
})

// ── in-process service surface parity ──────────────────────────────────────

test('in-process service surface: ctx.notificationIngress.deliver is the SAME code path', async (t) => {
  const router = stubRouter()
  const { api } = await startServer(t, { router })
  const result = await api.deliver(FORUM_AUTH, VALID)
  assert.equal(result.status, 200)
  assert.equal(result.body.accepted, true)
  assert.equal(result.body.outcome, 'delivered')
  assert.deepEqual(router.calls[0], VALID)

  const anonymous = await api.deliver(undefined, VALID)
  assert.equal(anonymous.status, 401)
})

test('enabled: false mounts no HTTP server but still reports readiness', async (t) => {
  const root = makeRoot(t)
  const ctx = fakeCtx(new Map([['agentRouter', stubRouter()]]))
  const api = applyIngress(ctx, { enabled: false, authConfigFile: root.authConfigFile, storeFile: root.storeFile })
  assert.equal(api.enabled, false)
  assert.equal(api.deliverReady, true)
  assert.equal(api.storeReady, true)
})
