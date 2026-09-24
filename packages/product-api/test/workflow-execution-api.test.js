/**
 * HTTP tests for the /workflow-execution/* surface (WORKFLOW_EXECUTION_
 * CONTROL_V1 CTR-WEC1-003/006). Same harness discipline as scheduler-api:
 * a REAL loopback server over a fake cordis ctx, an INJECTABLE stub token
 * verifier, and a stub workflowExecutionAccess service. Pins the fail-closed
 * gate, the trace read contract, and the kick contract (no payload echo,
 * kicked/coalesced both 200).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { apply as applyProductApi } from '../src/index.js'
import { createStubTokenVerifier } from '../src/scheduler-auth.js'

const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'

const OK_TOKEN = 'bearer-wfexec'
const NOSCOPE_TOKEN = 'bearer-no-scope'

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

function stubRouter() {
  return {
    channelConversationId: (channel, externalId) => `${channel}:${externalId}`,
    getBinding: () => undefined,
    switchAgent: async () => ({}),
    route: async () => ({}),
  }
}

const stubDefinition = { listAgents: () => [] }

function stubAccess() {
  const calls = { traces: [], kicks: [] }
  return {
    calls,
    traces: async ({ workflowInstanceId, nodeVisitId }) => {
      calls.traces.push({ workflowInstanceId, nodeVisitId })
      if (workflowInstanceId !== INSTANCE) return null
      return {
        workflowInstanceId: INSTANCE,
        nodeVisits: [{
          nodeVisitId: nodeVisitId ?? VISIT,
          attemptId: 'wfeat-abc',
          generation: 1,
          dispatchIntentId: INTENT,
          ownerPrincipalId: 'p-owner',
          agentId: 'agt_one',
          sessionId: 'main',
          executionState: 'RUNNING',
          attemptCount: 1,
          startedAtMs: 1,
          updatedAtMs: 2,
        }],
      }
    },
    kick: (payload) => {
      calls.kicks.push(payload)
      return calls.kicks.length > 1 ? { ok: true, coalesced: true } : { ok: true, kicked: true }
    },
  }
}

function principals() {
  return {
    [OK_TOKEN]: { principalId: 'p-one', agentId: 'agt_one', scopes: new Set(['workflow.execute']) },
    [NOSCOPE_TOKEN]: { principalId: 'p-two', agentId: 'agt_two', scopes: new Set(['forum.read']) },
  }
}

async function mount(t, { access = stubAccess(), verifier = createStubTokenVerifier(principals()) } = {}) {
  const services = new Map([
    ['agentRouter', stubRouter()],
    ['agentDefinition', stubDefinition],
    ['workflowExecutionAccess', access],
    ['schedulerTokenVerifier', verifier],
  ])
  const ctx = fakeCtx(services)
  const api = applyProductApi(ctx, { port: 0 })
  await new Promise((resolveReady) => {
    const wait = () => {
      const addr = api.address()
      if (addr?.port && addr.port !== 0) resolveReady()
      else setTimeout(wait, 10)
    }
    wait()
  })
  const addr = api.address()
  t.after(() => ctx.disposeAll())
  return { base: `http://127.0.0.1:${addr.port}`, access }
}

async function call(base, path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const parsed = await res.json().catch(() => null)
  return { status: res.status, body: parsed }
}

test('CTR-WEC1-003 gate: no token / bad token / wrong scope / unconfigured seam all fail closed', async (t) => {
  const { base } = await mount(t)

  let res = await call(base, `/workflow-execution/traces?workflowInstanceId=${INSTANCE}`)
  assert.equal(res.status, 401)
  assert.equal(res.body.error.code, 'unauthenticated')

  res = await call(base, `/workflow-execution/traces?workflowInstanceId=${INSTANCE}`, { token: 'nonsense' })
  assert.equal(res.status, 401)

  res = await call(base, `/workflow-execution/traces?workflowInstanceId=${INSTANCE}`, { token: NOSCOPE_TOKEN })
  assert.equal(res.status, 403)
  assert.equal(res.body.error.code, 'forbidden')

  // Unconfigured verifier seam: 401 even WITH a token (fail-closed, R-H9).
  const { base: bare } = await mount(t, { verifier: null })
  res = await call(bare, `/workflow-execution/traces?workflowInstanceId=${INSTANCE}`, { token: OK_TOKEN })
  assert.equal(res.status, 401)
})

test('CTR-WEC1-003 traces: valid query hits the seam; unknown instance 404; bad params 400', async (t) => {
  const { base, access } = await mount(t)

  const res = await call(base, `/workflow-execution/traces?workflowInstanceId=${INSTANCE}`, { token: OK_TOKEN })
  assert.equal(res.status, 200)
  assert.equal(res.body.workflowInstanceId, INSTANCE)
  assert.equal(res.body.nodeVisits[0].executionState, 'RUNNING')
  assert.equal(typeof res.body.generatedAtMs, 'number')
  assert.deepEqual(access.calls.traces, [{ workflowInstanceId: INSTANCE, nodeVisitId: undefined }])

  const withVisit = await call(base, `/workflow-execution/traces?workflowInstanceId=${INSTANCE}&nodeVisitId=${VISIT}`, { token: OK_TOKEN })
  assert.equal(withVisit.status, 200)
  assert.deepEqual(access.calls.traces.at(-1), { workflowInstanceId: INSTANCE, nodeVisitId: VISIT })

  const badUuid = await call(base, `/workflow-execution/traces?workflowInstanceId=not-a-uuid`, { token: OK_TOKEN })
  assert.equal(badUuid.status, 400)

  const missing = await call(base, `/workflow-execution/traces`, { token: OK_TOKEN })
  assert.equal(missing.status, 400)

  const unknown = await call(base, `/workflow-execution/traces?workflowInstanceId=9d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e99`, { token: OK_TOKEN })
  assert.equal(unknown.status, 404)
})

test('CTR-WEC1-006 kicks: valid kick 200 (kicked), never echoes the payload; malformed 400', async (t) => {
  const { base, access } = await mount(t)

  const res = await call(base, '/workflow-execution/kicks', {
    token: OK_TOKEN,
    method: 'POST',
    body: { workflowInstanceId: INSTANCE, nodeVisitId: VISIT, dispatchIntentId: INTENT },
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)
  assert.equal(res.body.kicked, true)
  assert.deepEqual(access.calls.kicks, [{ workflowInstanceId: INSTANCE, nodeVisitId: VISIT, dispatchIntentId: INTENT }])

  // A second kick coalesces server-side (stub returns coalesced) — still 200.
  const res2 = await call(base, '/workflow-execution/kicks', {
    token: OK_TOKEN,
    method: 'POST',
    body: { workflowInstanceId: INSTANCE, nodeVisitId: VISIT, dispatchIntentId: INTENT },
  })
  assert.equal(res2.status, 200)
  assert.equal(res2.body.coalesced, true)

  const bad = await call(base, '/workflow-execution/kicks', {
    token: OK_TOKEN,
    method: 'POST',
    body: { workflowInstanceId: INSTANCE },
  })
  assert.equal(bad.status, 400)

  const get = await call(base, '/workflow-execution/kicks', { token: OK_TOKEN })
  assert.equal(get.status, 404)
})

test('CTR-WEC1-003: access service absent → 503 not_ready (fail-closed, honest)', async (t) => {
  const { base } = await mount(t, { access: null })
  const res = await call(base, `/workflow-execution/traces?workflowInstanceId=${INSTANCE}`, { token: OK_TOKEN })
  assert.equal(res.status, 503)
})
