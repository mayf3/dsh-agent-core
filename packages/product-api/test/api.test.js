/**
 * Unit tests for @agent-core/product-api — the Gate 1 thin HTTP adapter.
 *
 * The server is mounted on a fake cordis ctx with STUB router/definition
 * services (the real chain — Router + BindingStore + real DSH processes —
 * is covered by scripts/mobile-gate1-verify.mjs). These tests pin the
 * adapter contract: the four endpoints, the error envelope, and the
 * surface -> `mobile:<surfaceId>` Binding scope.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { apply as applyProductApi } from '../src/index.js'

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

/** In-memory stub Router (mirrors the agentRouter service surface). */
function stubRouter() {
  const bindings = new Map()
  const bookmarks = new Map()
  return {
    channelConversationId: (channel, externalId) => `${channel}:${externalId}`,
    getBinding: (ccId) => {
      const row = bindings.get(ccId)
      return row === undefined ? undefined : { ...row }
    },
    switchAgent: async (ccId, targetAgentId, opts = {}) => {
      const current = bindings.get(ccId)
      if (current !== undefined && current.activeAgentId !== targetAgentId) {
        bookmarks.set(`${ccId}:${current.activeAgentId}`, current.activeSessionId)
      }
      const row = {
        channelConversationId: ccId,
        activeAgentId: targetAgentId,
        activeSessionId: opts?.targetSessionId
          ?? bookmarks.get(`${ccId}:${targetAgentId}`)
          ?? 'main',
        updatedAt: new Date().toISOString(),
      }
      bindings.set(ccId, row)
      return { ...row }
    },
    route: async (ingress) => {
      const ccId = `${ingress.channel}:${ingress.conversationId}`
      const binding = bindings.get(ccId)
      return {
        reply: `echo:${ingress.text}`,
        agentId: binding?.activeAgentId ?? 'agt_stub',
        sessionId: binding?.activeSessionId ?? 'main',
        pid: 42,
        status: 'completed',
        reconciliationHandle: 'turn:product-complete',
        evidence: { terminationEvidence: 'exact_terminal_then_idle' },
      }
    },
  }
}

function stubDefinition(agents) {
  return {
    listAgents: () => agents.map(a => ({ ...a })),
  }
}

/** Start the product-api server on an ephemeral port; returns {base, dispose}. */
async function startServer(t, { router, definition, config = {} } = {}) {
  const ctx = fakeCtx(new Map([
    ['agentRouter', router ?? stubRouter()],
    ['agentDefinition', definition ?? stubDefinition([{ id: 'agt_a', name: 'Agent A', description: null }])],
  ]))
  const api = applyProductApi(ctx, { port: 0, ...config })
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

test('GET /v1/agents lists defined agents in the contract shape', async (t) => {
  const { base } = await startServer(t, {
    definition: stubDefinition([
      { id: 'agt_a', name: 'Agent A', avatar: null, description: '论文导师' },
      { id: 'agt_b', name: 'Agent B', avatar: null, description: null },
    ]),
  })
  const { status, body } = await call(base, 'GET', '/v1/agents')
  assert.equal(status, 200)
  assert.equal(body.agents.length, 2)
  assert.deepEqual(body.agents[0], { id: 'agt_a', name: 'Agent A', avatar: null, description: '论文导师' })
})

test('GET /v1/binding: 200 with the surface binding; 404 BINDING_NOT_FOUND when none', async (t) => {
  const router = stubRouter()
  const { base } = await startServer(t, { router })
  await router.switchAgent('mobile:surface-1', 'agt_a')

  const ok = await call(base, 'GET', '/v1/binding?surfaceId=surface-1')
  assert.equal(ok.status, 200)
  assert.equal(ok.body.channelConversationId, 'mobile:surface-1')
  assert.equal(ok.body.activeAgentId, 'agt_a')

  const missing = await call(base, 'GET', '/v1/binding?surfaceId=never-seen')
  assert.equal(missing.status, 404)
  assert.equal(missing.body.error.code, 'BINDING_NOT_FOUND')
})

test('POST /v1/switch-agent: surface scope, targetAgentId-ONLY (sessionId rejected)', async (t) => {
  const router = stubRouter()
  const { base } = await startServer(t, { router })
  await router.switchAgent('mobile:surface-1', 'agt_a')

  // Without sessionId: the ROUTER decides (stub: bookmark ?? main).
  const switched = await call(base, 'POST', '/v1/switch-agent', { surfaceId: 'surface-1', targetAgentId: 'agt_b' })
  assert.equal(switched.status, 200)
  assert.equal(switched.body.activeAgentId, 'agt_b')
  assert.equal(switched.body.activeSessionId, 'main')

  // Gate 1 contract is targetAgentId-only (audit FIX 2): sessionId on the
  // wire is rejected, never forwarded to the Router.
  const withSession = await call(base, 'POST', '/v1/switch-agent', { surfaceId: 'surface-1', targetAgentId: 'agt_a', sessionId: 'work' })
  assert.equal(withSession.status, 400)
  assert.equal(withSession.body.error.code, 'VALIDATION_ERROR')
  assert.equal(router.getBinding('mobile:surface-1').activeAgentId, 'agt_b', 'rejected request must not mutate the binding')

  // Other surfaces are untouched (per-surface scope).
  const other = await call(base, 'GET', '/v1/binding?surfaceId=surface-2')
  assert.equal(other.status, 404)
})

test('POST /v1/message: routes through the Router, returns the reply + binding facts', async (t) => {
  const router = stubRouter()
  const { base } = await startServer(t, { router })
  await router.switchAgent('mobile:surface-1', 'agt_b')

  const { status, body } = await call(base, 'POST', '/v1/message', { surfaceId: 'surface-1', text: 'hello' })
  assert.equal(status, 200)
  assert.equal(body.reply, 'echo:hello')
  assert.equal(body.agentId, 'agt_b')
  assert.equal(body.sessionId, 'main')
  assert.equal(body.status, 'completed')
  assert.equal(body.reconciliationHandle, 'turn:product-complete')
  assert.deepEqual(body.evidence, { terminationEvidence: 'exact_terminal_then_idle' })
})

test('B15 product API preserves typed outcome_unknown reconciliation data', async (t) => {
  const router = stubRouter()
  router.route = async () => ({
    error: Object.assign(new Error('mobile turn unknown'), {
      status: 'outcome_unknown', envelope: 'outcome_unknown', reconciliationHandle: 'turn:product-unknown',
      deadlineAtWallMs: 789, evidence: { source: 'turn_deadline_exceeded' },
    }),
  })
  const { base } = await startServer(t, { router })
  const result = await call(base, 'POST', '/v1/message', { surfaceId: 'surface-1', text: 'hello' })
  assert.equal(result.status, 500)
  assert.equal(result.body.status, 'outcome_unknown')
  assert.equal(result.body.error.code, 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN')
  assert.equal(result.body.reconciliationHandle, 'turn:product-unknown')
  assert.equal(result.body.deadlineAtWallMs, 789)
  assert.deepEqual(result.body.evidence, { source: 'turn_deadline_exceeded' })
})

test('validation and error envelope (400/404/500 shapes)', async (t) => {
  const { base } = await startServer(t, {})

  const noSurface = await call(base, 'POST', '/v1/message', { text: 'x' })
  assert.equal(noSurface.status, 400)
  assert.equal(noSurface.body.error.code, 'VALIDATION_ERROR')

  const badJson = await call(base, 'POST', '/v1/message', 'not-json')
  assert.equal(badJson.status, 400)
  assert.equal(badJson.body.error.code, 'VALIDATION_ERROR')

  const unknown = await call(base, 'GET', '/v1/nope')
  assert.equal(unknown.status, 404)
  assert.equal(unknown.body.error.code, 'NOT_FOUND')

  const wrongMethod = await call(base, 'DELETE', '/v1/binding?surfaceId=x')
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.body.error.code, 'METHOD_NOT_ALLOWED')
})

test('AGENT_NOT_FOUND from the Router maps to 404', async (t) => {
  const router = stubRouter()
  const original = router.switchAgent
  router.switchAgent = async (ccId, target) => {
    throw Object.assign(new Error(`agent not found: ${target}`), { code: 'AGENT_NOT_FOUND' })
  }
  const { base } = await startServer(t, { router })
  const { status, body } = await call(base, 'POST', '/v1/switch-agent', { surfaceId: 's', targetAgentId: 'agt_x' })
  assert.equal(status, 404)
  assert.equal(body.error.code, 'AGENT_NOT_FOUND')
  router.switchAgent = original
})
