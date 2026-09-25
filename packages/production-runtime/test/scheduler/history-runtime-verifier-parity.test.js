import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveProductionLayout } from '../../src/paths.js'
import { createPluginContext } from '../../src/context.js'
import { mountSchedulerHistoryRuntime } from '../../src/scheduler/history-runtime.js'

// Live WEC parity for the R8 gate seam (AGENT_CORE_SCHEDULER_RUN_HISTORY_V1):
// the schedulerTokenVerifier is constructed only when JWKS URL + issuer +
// audience are ALL configured; any partial config stays unconfigured (null =
// the product-api gate 401s every scheduler request, fail-closed) and must
// never throw at mount. Regression for the coherent-release source blocker:
// URL-only used to throw "issuer is required", URL+issuer "audience is
// required" at startup instead of failing closed.
const JWKS_URL = 'http://127.0.0.1:1/.well-known/jwks.json'
const ISSUER = 'auth-service'
const AUDIENCE = 'scheduler'
const silentLog = { warn: () => {} }

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-verifier-parity-'))
  const layout = resolveProductionLayout(root)
  await mkdir(layout.historyDir, { recursive: true })
  return layout
}

test('verifier parity: no auth config -> null verifier (fail-closed)', async () => {
  const ctx = createPluginContext()
  await mountSchedulerHistoryRuntime({ ctx, layout: await fixture(), schedulerAuth: undefined, env: {}, log: silentLog })
  assert.ok(ctx.get('schedulerHistory'), 'history store provided regardless of auth config')
  assert.equal(ctx.get('schedulerTokenVerifier'), null)
})

test('verifier parity: JWKS URL only -> null verifier, no mount throw', async () => {
  const ctx = createPluginContext()
  await mountSchedulerHistoryRuntime({ ctx, layout: await fixture(), schedulerAuth: { jwksUrl: JWKS_URL }, env: {}, log: silentLog })
  assert.equal(ctx.get('schedulerTokenVerifier'), null)
})

test('verifier parity: JWKS URL + issuer -> null verifier, no mount throw', async () => {
  const ctx = createPluginContext()
  await mountSchedulerHistoryRuntime({ ctx, layout: await fixture(), schedulerAuth: { jwksUrl: JWKS_URL, issuer: ISSUER }, env: {}, log: silentLog })
  assert.equal(ctx.get('schedulerTokenVerifier'), null)
})

test('verifier parity: URL + issuer + audience -> verifier constructed', async () => {
  const ctx = createPluginContext()
  await mountSchedulerHistoryRuntime({ ctx, layout: await fixture(), schedulerAuth: { jwksUrl: JWKS_URL, issuer: ISSUER, audience: AUDIENCE }, env: {}, log: silentLog })
  const verifier = ctx.get('schedulerTokenVerifier')
  assert.ok(verifier, 'complete auth triple constructs the verifier')
  assert.equal(typeof verifier.verify, 'function')
})

test('verifier parity: env-sourced partial config -> null verifier', async () => {
  const ctx = createPluginContext()
  await mountSchedulerHistoryRuntime({
    ctx, layout: await fixture(), schedulerAuth: undefined,
    env: { SCHEDULER_AUTH_JWKS_URL: JWKS_URL },
    log: silentLog,
  })
  assert.equal(ctx.get('schedulerTokenVerifier'), null)
})

test('verifier parity: env-sourced complete config -> verifier constructed', async () => {
  const ctx = createPluginContext()
  await mountSchedulerHistoryRuntime({
    ctx, layout: await fixture(), schedulerAuth: undefined,
    env: { SCHEDULER_AUTH_JWKS_URL: JWKS_URL, SCHEDULER_AUTH_ISSUER: ISSUER, SCHEDULER_AUTH_AUDIENCE: AUDIENCE },
    log: silentLog,
  })
  assert.ok(ctx.get('schedulerTokenVerifier'), 'env-sourced triple constructs the verifier')
})

test('verifier parity: schedulerAuth opts fall through to env per field', async () => {
  const ctx = createPluginContext()
  await mountSchedulerHistoryRuntime({
    ctx, layout: await fixture(),
    schedulerAuth: { jwksUrl: JWKS_URL, issuer: ISSUER },
    env: { SCHEDULER_AUTH_AUDIENCE: AUDIENCE },
    log: silentLog,
  })
  assert.ok(ctx.get('schedulerTokenVerifier'), 'opts + env combined triple constructs the verifier')
})
