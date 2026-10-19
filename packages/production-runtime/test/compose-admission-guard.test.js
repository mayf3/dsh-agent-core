/**
 * PRODUCT #525 P1: composition-time admission guard tests, split from
 * compose.test.js (that file is pinned ≤500 lines by CODE_STRUCTURE_GUARDRAILS_V1).
 * The directory admission route must never mount without its JWKS verifier
 * (the 10-17 restart silently served permanent 401s), and the product-api
 * /health surface must expose the additive admission readiness state.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { composeProductionRuntime } from '../src/compose.js'
import {
  FakeProc,
  seedRuntime,
  silentLog,
} from './compose-fixture.js'

const GLOBAL_ROUTE = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })

function withAdmissionEnv(t, value) {
  const saved = process.env.AGENT_DIRECTORY_AUTH_JWKS_URL
  if (value === undefined) delete process.env.AGENT_DIRECTORY_AUTH_JWKS_URL
  else process.env.AGENT_DIRECTORY_AUTH_JWKS_URL = value
  t.after(() => {
    if (saved === undefined) delete process.env.AGENT_DIRECTORY_AUTH_JWKS_URL
    else process.env.AGENT_DIRECTORY_AUTH_JWKS_URL = saved
  })
}

test('PRODUCT #525 P1: product API enabled without AGENT_DIRECTORY_AUTH_JWKS_URL refuses composition (fail loud, never perma-401)', async (t) => {
  const { layout } = await seedRuntime(t)
  withAdmissionEnv(t, undefined)
  await assert.rejects(() => composeProductionRuntime({
    globalRoute: GLOBAL_ROUTE,
    layout,
    productApi: { enabled: true, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => new FakeProc(opts),
    log: silentLog,
  }), /jwksUrl/)
})

test('PRODUCT #525 P1: product API enabled with the JWKS seam composes; /health carries additive admission readiness', async (t) => {
  const { layout } = await seedRuntime(t)
  withAdmissionEnv(t, 'http://127.0.0.1:1/.well-known/jwks.json')
  const runtime = await composeProductionRuntime({
    globalRoute: GLOBAL_ROUTE,
    layout,
    productApi: { enabled: true, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => new FakeProc(opts),
    log: silentLog,
  })
  t.after(() => runtime.stop())
  const { port } = runtime.productApi.address()
  const res = await fetch(`http://127.0.0.1:${port}/health`)
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.deepEqual(body.admission, { configured: true, state: 'unproven' })
})

test('PRODUCT #525 P1: the JWKS-seam gate precedes all downstream composition wiring (log-order pin)', async (t) => {
  // Composition has no failure cleanup: once the Feishu channel has connected
  // (mount-time connect + awaited ready()) a later admission-mount throw would
  // strand those live resources — the rejection carries no runtime handle to
  // stop(). The gate must therefore fire as early as its dependencies allow:
  // right after the agent definition loads, BEFORE the model-route section and
  // every channel/resource mount.
  const { layout } = await seedRuntime(t)
  withAdmissionEnv(t, undefined)
  const lines = []
  await assert.rejects(() => composeProductionRuntime({
    globalRoute: GLOBAL_ROUTE,
    layout,
    productApi: { enabled: true, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => new FakeProc(opts),
    log: { log: line => lines.push(String(line)), warn: () => {}, error: () => {} },
  }), /jwksUrl/)
  assert.equal(lines.some(line => line.includes('agent definition loaded')), true)
  assert.equal(lines.some(line => line.includes('global model route')), false)
})
