/**
 * Unit tests for @agent-core/notification-ingress — the thin /v1/deliver
 * HTTP adapter.
 *
 * The server is mounted on a fake cordis ctx with a STUB router carrying the
 * FROZEN dependency contract `agentRouter.deliver({ requestId, agentId,
 * sessionMode, message }) -> { accepted, sessionId }`. The real chain
 * (Router + BindingStore + real DSH processes) is deliberately NOT exercised
 * here — these unit tests only pin what the thin adapter forwards, and the
 * ingress must never re-implement Router logic. The real-composition path is
 * pinned as an explicit seam in test/integration.seam.test.js.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { apply as applyIngress } from '../src/index.js'

/** Fake cordis ctx: get/provide/effect only. */
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

/**
 * Stub Router carrying the frozen deliver() contract. Records every call so
 * tests can pin EXACTLY what the ingress forwards (no extra fields, no
 * mutation).
 */
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

/** Start the ingress server on an ephemeral port; returns {base, api, ctx}. */
async function startServer(t, { router, config = {} } = {}) {
  const ctx = fakeCtx(new Map([
    ['agentRouter', router ?? stubRouter()],
  ]))
  const api = applyIngress(ctx, { port: 0, ...config })
  // port 0: wait for the actual address.
  await new Promise(resolveReady => {
    const wait = () => {
      const addr = api.address()
      if (addr?.port && addr.port !== 0) resolveReady()
      else setTimeout(wait, 10)
    }
    wait()
  })
  const addr = api.address()
  const base = `http://127.0.0.1:${addr.port}`
  t.after(() => ctx.disposeAll())
  return { base, api, ctx }
}

async function call(base, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: text === '' ? null : JSON.parse(text) }
}

const VALID = { requestId: 'req_01', agentId: 'agt_a', sessionMode: 'main', message: 'hello' }

test('POST /v1/deliver: forwards the EXACT frozen payload and returns {accepted, sessionId}', async (t) => {
  const router = stubRouter()
  const { base } = await startServer(t, { router })

  const { status, body } = await call(base, 'POST', '/v1/deliver', VALID)
  assert.equal(status, 200)
  assert.deepEqual(body, { accepted: true, sessionId: 'main' })
  assert.equal(router.calls.length, 1)
  assert.deepEqual(router.calls[0], VALID, 'ingress must forward exactly requestId/agentId/sessionMode/message')
})

test('POST /v1/deliver: sessionMode "fresh" passes through verbatim', async (t) => {
  const router = stubRouter()
  const { base } = await startServer(t, { router })

  const { status, body } = await call(base, 'POST', '/v1/deliver', { ...VALID, sessionMode: 'fresh' })
  assert.equal(status, 200)
  assert.equal(body.sessionId, 'ses_fresh_1')
  assert.equal(router.calls[0].sessionMode, 'fresh')
})

test('POST /v1/deliver: the Router result envelope passes through untouched (accepted:false is the Router\'s decision)', async (t) => {
  const router = stubRouter(async () => ({ accepted: false, sessionId: 'main' }))
  const { base } = await startServer(t, { router })

  const { status, body } = await call(base, 'POST', '/v1/deliver', VALID)
  assert.equal(status, 200)
  assert.deepEqual(body, { accepted: false, sessionId: 'main' })
})

test('validation: every field is required and shape-checked (400 VALIDATION_ERROR, no Router call)', async (t) => {
  const router = stubRouter()
  const { base } = await startServer(t, { router })

  const cases = [
    { ...VALID, requestId: undefined },
    { ...VALID, requestId: '' },
    { ...VALID, requestId: '   ' },
    { ...VALID, agentId: undefined },
    { ...VALID, agentId: '' },
    { ...VALID, sessionMode: undefined },
    { ...VALID, sessionMode: 'work' },   // not main | fresh
    { ...VALID, sessionMode: 'MAIN' },   // case-sensitive
    { ...VALID, sessionMode: 42 },
    { ...VALID, message: undefined },
    { ...VALID, message: '' },
    { ...VALID, message: 42 },
    {},                                  // empty object
  ]
  for (const body of cases) {
    const { status, body: reply } = await call(base, 'POST', '/v1/deliver', body)
    assert.equal(status, 400, `expected 400 for ${JSON.stringify(body)}`)
    assert.equal(reply.error.code, 'VALIDATION_ERROR', `expected VALIDATION_ERROR for ${JSON.stringify(body)}`)
  }
  assert.equal(router.calls.length, 0, 'invalid requests must never reach the Router')
})

test('bad JSON body -> 400 VALIDATION_ERROR', async (t) => {
  const { base } = await startServer(t, {})
  const { status, body } = await call(base, 'POST', '/v1/deliver', 'not-json')
  assert.equal(status, 400)
  assert.equal(body.error.code, 'VALIDATION_ERROR')
})

test('routing: /health ok, unknown path 404 NOT_FOUND, wrong method 405', async (t) => {
  const { base } = await startServer(t, {})

  const health = await call(base, 'GET', '/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.ok, true)
  assert.equal(health.body.deliverReady, true)

  const unknown = await call(base, 'GET', '/v1/nope')
  assert.equal(unknown.status, 404)
  assert.equal(unknown.body.error.code, 'NOT_FOUND')

  const wrongMethod = await call(base, 'DELETE', '/v1/deliver')
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.body.error.code, 'METHOD_NOT_ALLOWED')
})

test('Router errors map to the contract envelope: AGENT_NOT_FOUND -> 404, unknown -> 500', async (t) => {
  const notFound = stubRouter(async () => {
    throw Object.assign(new Error('agent not found: agt_x'), { code: 'AGENT_NOT_FOUND' })
  })
  const { base } = await startServer(t, { router: notFound })
  const nf = await call(base, 'POST', '/v1/deliver', { ...VALID, agentId: 'agt_x' })
  assert.equal(nf.status, 404)
  assert.equal(nf.body.error.code, 'AGENT_NOT_FOUND')

  const exploding = stubRouter(async () => { throw new Error('boom') })
  const { base: base2 } = await startServer(t, { router: exploding })
  const boom = await call(base2, 'POST', '/v1/deliver', VALID)
  assert.equal(boom.status, 500)
  assert.equal(boom.body.error.code, 'INTERNAL_ERROR')
})

test('B15 outcome_unknown HTTP envelope preserves handle, deadline and evidence', async (t) => {
  const router = stubRouter(async () => {
    throw Object.assign(new Error('delivery outcome unknown'), {
      status: 'outcome_unknown', envelope: 'outcome_unknown', reconciliationHandle: 'turn:notif',
      deadlineAtWallMs: 456, evidence: { source: 'prompt_receipt_timeout' },
    })
  })
  const { base } = await startServer(t, { router })
  const result = await call(base, 'POST', '/v1/deliver', VALID)
  assert.equal(result.status, 500)
  assert.equal(result.body.status, 'outcome_unknown')
  assert.equal(result.body.error.code, 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN')
  assert.equal(result.body.reconciliationHandle, 'turn:notif')
  assert.equal(result.body.deadlineAtWallMs, 456)
  assert.deepEqual(result.body.evidence, { source: 'prompt_receipt_timeout' })
})

test('main TODAY (no agentRouter.deliver): mounted but /v1/deliver answers 503 SERVICE_UNAVAILABLE', async (t) => {
  // The router on main has route/switchAgent etc. but NO deliver() — this is
  // the exact state the branch is born into.
  const mainRouter = { route: async () => ({ reply: 'n/a' }) }
  const { base, api } = await startServer(t, { router: mainRouter })

  assert.equal(api.deliverReady, false)

  const health = await call(base, 'GET', '/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.deliverReady, false)

  // Validation still runs before the capability check.
  const invalid = await call(base, 'POST', '/v1/deliver', {})
  assert.equal(invalid.status, 400)
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR')

  const deliver = await call(base, 'POST', '/v1/deliver', VALID)
  assert.equal(deliver.status, 503)
  assert.equal(deliver.body.error.code, 'SERVICE_UNAVAILABLE')
  assert.match(deliver.body.error.message, /agentRouter\.deliver/)
})

test('in-process service surface: ctx.notificationIngress.deliver is the SAME code path', async (t) => {
  const router = stubRouter()
  const { api } = await startServer(t, { router })

  const result = await api.deliver(VALID)
  assert.deepEqual(result, { accepted: true, sessionId: 'main' })
  assert.equal(router.calls.length, 1)
  assert.deepEqual(router.calls[0], VALID)

  await assert.rejects(() => api.deliver({ requestId: 'x' }), (error) => error.code === 'VALIDATION_ERROR')
})

test('enabled: false mounts no HTTP server but still reports deliverReady', async (t) => {
  const ctx = fakeCtx(new Map([['agentRouter', stubRouter()]]))
  const api = applyIngress(ctx, { enabled: false })
  assert.equal(api.enabled, false)
  assert.equal(api.deliverReady, true)
})
