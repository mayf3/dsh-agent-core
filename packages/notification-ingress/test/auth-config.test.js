import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  ALLOWED_CALLERS, DEFAULT_ROUTER_DEADLINE_MS, loadAuthConfig, parseBasicCredential,
} from '../src/auth.js'
import {
  FORUM, WORKFLOW, basic, deliver, makeRoot, mount, readStore, stubRouter, stubTokenEndpoint,
  writeAuthConfig, writeAuthConfigAt,
} from './auth.fixture.js'

// ── C-BND-002 / AC-BND-02 / F-25 — config seam ─────────────────────────────

test('C-BND-002 AC-BND-02 F-25: missing auth config = legal not-ready: mounted, per-call 503, never anonymous', async (t) => {
  const root = makeRoot(t, { withAuthConfig: false })
  const router = stubRouter()
  const { base, api } = await mount(t, { root, router, fetchImpl: stubTokenEndpoint().fetchImpl })

  assert.equal(api.authConfigured(), false)
  const health = await (await fetch(`${base}/health`)).json()
  assert.equal(health.authConfigured, false)
  assert.equal(health.ok, true, 'the service is up — just not configured')

  // EVERY /v1/deliver answers 503 AUTH_NOT_CONFIGURED (fail closed per call).
  for (const authorization of [undefined, basic(FORUM.clientId, FORUM.clientSecret)]) {
    const { status, body } = await deliver(base, { authorization })
    assert.equal(status, 503)
    assert.equal(body.error.code, 'AUTH_NOT_CONFIGURED')
  }
  assert.equal(router.calls.length, 0)
  assert.deepEqual(readStore(root).records, {})
})

test('C-BND-002 AC-BND-02: invalid auth config (mode / JSON / origin / audience) -> per-call 503', async (t) => {
  const cases = [
    { name: 'file mode 0644', prepare: (root) => { chmodSync(root.authConfigFile, 0o644) } },
    { name: 'directory 0755', prepare: (root) => { chmodSync(join(root.root, 'notification-ingress'), 0o755) } },
    { name: 'malformed JSON', prepare: (root) => { writeFileSync(root.authConfigFile, '{oops'); chmodSync(root.authConfigFile, 0o600) } },
    { name: 'non-HTTPS origin', prepare: (root) => writeAuthConfigAt(root, { authServiceOrigin: 'http://auth.example.com' }) },
    { name: 'wrong audience literal', prepare: (root) => writeAuthConfigAt(root, { audience: 'urn:agent-core:notification-ingress:v1' }) },
    { name: 'audience missing', prepare: (root) => writeAuthConfigAt(root, { audience: undefined }) },
  ]
  for (const { name, prepare } of cases) {
    const root = makeRoot(t)
    if (name === 'directory 0755') chmodSync(join(root.root, 'notification-ingress'), 0o700) // base for prepare
    prepare(root)
    if (name === 'directory 0755') chmodSync(join(root.root, 'notification-ingress'), 0o755)
    const { base } = await mount(t, { root, router: stubRouter(), fetchImpl: stubTokenEndpoint().fetchImpl })
    const { status, body } = await deliver(base, { authorization: basic(FORUM.clientId, FORUM.clientSecret) })
    assert.equal(status, 503, `${name}: expected 503 AUTH_NOT_CONFIGURED`)
    assert.equal(body.error.code, 'AUTH_NOT_CONFIGURED')
  }
})

// ── config validation surface (unit level) ─────────────────────────────────

test('C-AUTH-002 C-IDM-011 config defaults: routerDeadlineMs/retention/maxRecords defaults from loadAuthConfig', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ni-cfg-'))
  try {
    const file = writeAuthConfig(root)
    const result = loadAuthConfig(file)
    assert.equal(result.ok, true)
    assert.equal(result.config.routerDeadlineMs, DEFAULT_ROUTER_DEADLINE_MS)
    assert.equal(DEFAULT_ROUTER_DEADLINE_MS, 300000)
    assert.equal(result.config.retentionMs, 604800000)
    assert.equal(result.config.maxRecords, 100000)
    assert.deepEqual(result.config.allowlist, { 'svc-forum': FORUM.clientId, 'svc-workflow': WORKFLOW.clientId })
    // Overrides pass through as positive integers.
    writeAuthConfig(root, { routerDeadlineMs: 5000, retentionMs: 1000, maxRecords: 5 })
    const overridden = loadAuthConfig(file)
    assert.equal(overridden.config.routerDeadlineMs, 5000)
    assert.equal(overridden.config.retentionMs, 1000)
    assert.equal(overridden.config.maxRecords, 5)
    // Non-positive overrides are invalid.
    writeAuthConfig(root, { routerDeadlineMs: 0 })
    assert.equal(loadAuthConfig(file).ok, false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('C-AUTH-001 unit: parseBasicCredential accepts exactly well-formed Basic credentials', () => {
  const good = parseBasicCredential(basic('cid', 'cs'))
  assert.deepEqual(good, { clientId: 'cid', clientSecret: 'cs' })
  assert.equal(parseBasicCredential(undefined), null)
  assert.equal(parseBasicCredential(''), null)
  assert.equal(parseBasicCredential('Basic'), null)
  assert.equal(parseBasicCredential('Basic '), null)
  assert.equal(parseBasicCredential(basic('cid', '')), null, 'empty secret is malformed')
})

test('C-AUTH-004 config: frozen allowlist caller names', () => {
  assert.deepEqual([...ALLOWED_CALLERS], ['svc-forum', 'svc-workflow'])
})
