/**
 * Unit tests for @agent-core/notification-ingress service authentication
 * (NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 §4 + the accepted
 * resource/scope clarification).
 *
 * Coverage: C-AUTH-001..C-AUTH-014, AC-AUTH-01..AC-AUTH-12, C-BND-002 /
 * AC-BND-02, fault-matrix F-01..F-10, F-17, F-18, F-21, F-25.
 *
 * The auth-service token endpoint is stubbed through the injectable
 * `fetchImpl` seam (same discipline as the repo's existing auth primitive);
 * the Router is a recording stub carrying the frozen deliver() contract.
 */

import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply as applyIngress } from '../src/index.js'
import {
  ALLOWED_CALLERS, DEFAULT_ROUTER_DEADLINE_MS, NOTIFICATION_RESOURCE, NOTIFICATION_SCOPE,
  loadAuthConfig, parseBasicCredential, redactForLog,
} from '../src/auth.js'

import {
  AGENT_CHILD, FORUM, SCAN_SECRET, VALID_BODY, WORKFLOW, basic, deliver, makeRoot,
  mount, readStore, stubRouter, stubTokenEndpoint, writeAuthConfig,
} from './auth.fixture.js'

// ── C-AUTH-007 / AC-AUTH-01 / F-01 — anonymous reject ─────────────────────

test('C-AUTH-007 AC-AUTH-01 F-01: anonymous request -> 401 INVALID_CREDENTIAL, no state written', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const { base, api } = await mount(t, { root, router })
  const { status, body } = await deliver(base, {})
  assert.equal(status, 401)
  assert.equal(body.error.code, 'INVALID_CREDENTIAL')
  assert.equal(router.calls.length, 0)
  assert.deepEqual(readStore(root).records, {}, 'no idempotency record may exist')
  assert.ok(api.store.evidenceLines().some((e) => e.kind === 'auth_reject' && e.code === 'INVALID_CREDENTIAL'))
})

// ── C-AUTH-001 / AC-AUTH-02 / F-02 — malformed credential ─────────────────

test('C-AUTH-001 AC-AUTH-02 F-02: malformed credentials (non-Basic / bad base64 / bad UTF-8 / no colon) -> 401 without echo', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const { base } = await mount(t, { root, router })
  const badUtf8 = 'Basic ' + Buffer.from([0xff, 0xfe, 0x00]).toString('base64')
  for (const authorization of [
    'Bearer some-token',
    'Basic',
    'Basic !!!!not-base64!!!!',
    'Basic ' + Buffer.from('no-colon-here').toString('base64'),
    'Basic ' + Buffer.from(':missing-client').toString('base64'),
    badUtf8,
  ]) {
    const { status, body, raw } = await deliver(base, { authorization })
    assert.equal(status, 401, `expected 401 for ${JSON.stringify(authorization)}`)
    assert.equal(body.error.code, 'INVALID_CREDENTIAL')
    // The credential MATERIAL (everything past the scheme word) must never
    // appear in the response; the scheme word itself is not a secret.
    const material = authorization.split(/[ \t]/).slice(1).join(' ')
    if (material !== '') assert.ok(!raw.includes(material), 'response must never echo the header material')
    if (authorization.includes('=')) assert.ok(!raw.includes(authorization))
  }
  assert.equal(router.calls.length, 0)
  assert.deepEqual(readStore(root).records, {})
})

// ── C-AUTH-002 / AC-AUTH-06 / F-06 — verification protocol + forum success

test('C-AUTH-002 AC-AUTH-06 F-06: svc-forum success via exact token-endpoint protocol -> 200 delivered', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const endpoint = stubTokenEndpoint()
  const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })

  const { status, body } = await deliver(base, { authorization: basic(FORUM.clientId, FORUM.clientSecret) })
  assert.equal(status, 200)
  assert.equal(body.accepted, true)
  assert.equal(body.outcome, 'delivered')
  assert.equal(body.sessionId, 'main')
  assert.equal(router.calls.length, 1)

  assert.equal(endpoint.requests.length, 1)
  const request = endpoint.requests[0]
  assert.equal(request.url, 'https://auth.example.com/oauth/token', 'only the token endpoint may be called')
  assert.equal(request.clientId, FORUM.clientId)
  assert.equal(request.clientSecret, FORUM.clientSecret)
  assert.equal(request.form.grant_type, 'client_credentials')
  assert.equal(request.form.resource, NOTIFICATION_RESOURCE)
  assert.equal(request.form.scope, NOTIFICATION_SCOPE)
  assert.equal(NOTIFICATION_RESOURCE, 'agent-core-notification-ingress-v1')
  assert.equal(NOTIFICATION_SCOPE, 'notification.deliver')
})

// ── C-AUTH-007 + AC-AUTH-07 / F-07 — svc-workflow success ─────────────────

test('AC-AUTH-07 F-07 C-AUTH-006: svc-workflow success with its DISTINCT credential -> 200 delivered', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const endpoint = stubTokenEndpoint()
  const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })
  const { status, body } = await deliver(base, {
    authorization: basic(WORKFLOW.clientId, WORKFLOW.clientSecret),
    body: { ...VALID_BODY, requestId: 'req_wf_1' },
  })
  assert.equal(status, 200)
  assert.equal(body.outcome, 'delivered')
  assert.equal(endpoint.requests[0].clientId, WORKFLOW.clientId)
  assert.notEqual(FORUM.clientId, WORKFLOW.clientId, 'allowlist must map distinct clientIds')
})

// ── C-AUTH-003 / AC-AUTH-09 / F-09 — body caller spoof ignored ────────────

test('C-AUTH-003 AC-AUTH-09 F-09: body-carried caller identity is UNTRUSTED and wholly ignored', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const endpoint = stubTokenEndpoint()
  const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })

  const { status } = await deliver(base, {
    authorization: basic(FORUM.clientId, FORUM.clientSecret),
    body: {
      ...VALID_BODY,
      callerId: 'svc-workflow',
      service: 'svc-workflow',
      callerPrincipalId: WORKFLOW.clientId,
      identity: { caller: 'svc-workflow' },
    },
  })
  assert.equal(status, 200)
  // The Router receives EXACTLY the four wire fields — spoof fields dropped.
  assert.deepEqual(router.calls[0], VALID_BODY)
  // The idempotency record is keyed by the VERIFIED clientId, not the body claim.
  const store = readStore(root)
  assert.ok(store.records[FORUM.clientId] !== undefined, 'record keyed under verified forum clientId')
  assert.ok(store.records[WORKFLOW.clientId] === undefined, 'body-spoofed workflow identity must not create a record')
  // The spoofed values never reach the evidence either.
  const evidenceText = readFileSync(join(root.root, 'notification-ingress', 'evidence.jsonl'), 'utf8')
  assert.ok(!evidenceText.includes('svc-workflow'), 'body-claimed caller name must not enter evidence')
})

// ── C-AUTH-004 / AC-AUTH-05 / F-05 — allowlist enforcement ────────────────

test('C-AUTH-004 AC-AUTH-05 F-05: authenticated non-allowlisted caller -> 403 CALLER_NOT_ALLOWED, no state', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const endpoint = stubTokenEndpoint()
  const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })
  const { status, body } = await deliver(base, { authorization: basic('client-unknown-999', 'whatever') })
  // unknown client -> invalid_client -> 401 (not allowlisted-yet-valid case below)
  assert.equal(status, 401)

  const { status: s2, body: b2 } = await deliver(base, { authorization: basic(AGENT_CHILD.clientId, AGENT_CHILD.clientSecret) })
  assert.equal(s2, 403, 'a VERIFIED but non-allowlisted client must get 403')
  assert.equal(b2.error.code, 'CALLER_NOT_ALLOWED')
  assert.equal(router.calls.length, 0)
  assert.deepEqual(readStore(root).records, {})
})

// ── C-AUTH-004 + AC-AUTH-10 / F-10 — Agent child direct call rejected ─────

test('AC-AUTH-10 F-10 C-BND-004: Agent child direct /v1/deliver rejected (anonymous 401 / per-agent client 403)', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const endpoint = stubTokenEndpoint()
  const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })
  const anon = await deliver(base, {})
  assert.equal(anon.status, 401)
  const perAgent = await deliver(base, { authorization: basic(AGENT_CHILD.clientId, AGENT_CHILD.clientSecret) })
  assert.equal(perAgent.status, 403)
  assert.equal(router.calls.length, 0)
})

// ── C-AUTH-005 / AC-AUTH-04 / F-04 — wrong audience ───────────────────────

test('C-AUTH-005 AC-AUTH-04 F-04: invalid_target / invalid_resource (wrong audience) -> 401 INVALID_CREDENTIAL', async (t) => {
  for (const oauthError of ['invalid_target', 'invalid_resource']) {
    const root = makeRoot(t)
    const router = stubRouter()
    const endpoint = stubTokenEndpoint({
      respond: () => ({ ok: false, status: 400, json: async () => ({ error: oauthError }) }),
    })
    const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })
    const { status, body } = await deliver(base, { authorization: basic(FORUM.clientId, FORUM.clientSecret) })
    assert.equal(status, 401, `${oauthError} means the credential is invalid FOR THIS SURFACE`)
    assert.equal(body.error.code, 'INVALID_CREDENTIAL')
    assert.equal(router.calls.length, 0)
  }
})

// ── C-AUTH-006 / AC-AUTH-08 / F-08 — distinct credentials enforced ────────

test('C-AUTH-006 AC-AUTH-08 F-08: duplicate clientId in the allowlist is invalid configuration', async (t) => {
  const root = makeRoot(t, {
    overrides: { allowlist: { 'svc-forum': 'client-same', 'svc-workflow': 'client-same' } },
  })
  const endpoint = stubTokenEndpoint({ registry: new Map([['client-same', 'secret-1']]) })
  const router = stubRouter()
  const { base, api } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })
  assert.equal(api.authConfigured(), false, 'duplicate clientIds make the config illegal')
  const { status, body } = await deliver(base, { authorization: basic('client-same', 'secret-1') })
  assert.equal(status, 503)
  assert.equal(body.error.code, 'AUTH_NOT_CONFIGURED')
  assert.equal(router.calls.length, 0)
})

test('C-AUTH-006 AC-AUTH-08: both allowlist entries are REQUIRED (missing svc-workflow -> invalid)', async (t) => {
  const root = makeRoot(t, { overrides: { allowlist: { 'svc-forum': FORUM.clientId } } })
  const { base } = await mount(t, { root, router: stubRouter(), fetchImpl: stubTokenEndpoint().fetchImpl })
  const { status, body } = await deliver(base, { authorization: basic(FORUM.clientId, FORUM.clientSecret) })
  assert.equal(status, 503)
  assert.equal(body.error.code, 'AUTH_NOT_CONFIGURED')
})

// ── C-AUTH-011 / AC-AUTH-03 / F-03 + F-18 — revocation ────────────────────

test('C-AUTH-011 AC-AUTH-03 F-03 F-18: revoked credential -> 401 and existing durable outcomes untouched', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const endpoint = stubTokenEndpoint()
  const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })

  // Deliver once while the credential is valid.
  const first = await deliver(base, { authorization: basic(FORUM.clientId, FORUM.clientSecret) })
  assert.equal(first.status, 200)
  const storeBefore = readFileSync(root.storeFile, 'utf8')

  // Revoke: the token endpoint now rejects the client.
  endpoint.setRespond(() => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }))
  const second = await deliver(base, {
    authorization: basic(FORUM.clientId, FORUM.clientSecret),
    body: { ...VALID_BODY, requestId: 'req_after_revoke' },
  })
  assert.equal(second.status, 401)
  assert.equal(second.body.error.code, 'INVALID_CREDENTIAL')
  assert.equal(router.calls.length, 1, 'no second delivery')
  assert.equal(readFileSync(root.storeFile, 'utf8'), storeBefore, 'durable records are untouched by revocation')
})

// ── C-AUTH-009 / AC-AUTH-12 / F-21 — inconclusive ─────────────────────────

test('C-AUTH-009 AC-AUTH-12 F-21: inconclusive verification -> 503 AUTH_INCONCLUSIVE, never 401, never admitted', async (t) => {
  const inconclusiveReplies = [
    { ok: false, status: 500, json: async () => ({}) },
    { ok: false, status: 503, json: async () => ({}) },
    { ok: false, status: 400, json: async () => ({ error: 'temporarily_unavailable' }) },
    { ok: false, status: 400, json: async () => ({ error: 'something_unseen' }) },
    { ok: true, status: 200, json: async () => { throw new Error('malformed JSON') } },
    { ok: true, status: 200, json: async () => ({ no_token: true }) },
  ]
  for (const reply of inconclusiveReplies) {
    const root = makeRoot(t)
    const router = stubRouter()
    const endpoint = stubTokenEndpoint({ respond: () => reply })
    const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })
    const { status, body } = await deliver(base, { authorization: basic(FORUM.clientId, FORUM.clientSecret) })
    assert.equal(status, 503, `expected 503 for stubbed reply ${JSON.stringify(reply.status)}`)
    assert.equal(body.error.code, 'AUTH_INCONCLUSIVE')
    assert.equal(router.calls.length, 0)
    assert.deepEqual(readStore(root).records, {})
  }
  // Transport failure (network throw) is also inconclusive.
  {
    const root = makeRoot(t)
    const router = stubRouter()
    const { base } = await mount(t, {
      root, router,
      fetchImpl: async () => { throw new Error('ECONNREFUSED') },
    })
    const { status, body } = await deliver(base, { authorization: basic(FORUM.clientId, FORUM.clientSecret) })
    assert.equal(status, 503)
    assert.equal(body.error.code, 'AUTH_INCONCLUSIVE')
  }
})

// ── C-AUTH-010 / AC-AUTH-11 / F-17 — rotation ─────────────────────────────

test('C-AUTH-010 AC-AUTH-11 F-17: secret rotation keeps clientId -> idempotency key continuity', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  let currentSecret = 'old-secret'
  const endpoint = stubTokenEndpoint({
    registry: new Map([[FORUM.clientId, 'old-secret']]),
    respond: ({ clientSecret }) => (clientSecret === currentSecret
      ? { ok: true, status: 200, json: async () => ({ access_token: 'tok' }) }
      : { ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }),
  })
  const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })

  const first = await deliver(base, { authorization: basic(FORUM.clientId, 'old-secret') })
  assert.equal(first.status, 200)
  assert.equal(first.body.outcome, 'delivered')
  assert.equal(first.body.duplicate, undefined)

  // Rotate the secret auth-service-side; clientId and audience unchanged.
  currentSecret = 'new-secret-2'
  const retrySameKey = await deliver(base, { authorization: basic(FORUM.clientId, 'new-secret-2') })
  assert.equal(retrySameKey.status, 200)
  assert.equal(retrySameKey.body.duplicate, true, 'same business retry hits the SAME record (key continuity)')
  assert.equal(retrySameKey.body.sessionId, first.body.sessionId)
  assert.equal(router.calls.length, 1)
})

// ── C-AUTH-012 — secret non-echo (unit level) ──────────────────────────────

test('C-AUTH-012 C-BND-005: raw credential never echoed in responses, evidence or the store', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const endpoint = stubTokenEndpoint({ registry: new Map([['client-scan', 'wrong-secret']]) })
  const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })

  const header = basic('client-scan', SCAN_SECRET)
  const { raw } = await deliver(base, { authorization: header })
  assert.ok(!raw.includes(SCAN_SECRET))
  assert.ok(!raw.includes(header))
  const evidence = readFileSync(join(root.root, 'notification-ingress', 'evidence.jsonl'), 'utf8')
  assert.ok(!evidence.includes(SCAN_SECRET))
  if (existsSync(root.storeFile)) {
    assert.ok(!readFileSync(root.storeFile, 'utf8').includes(SCAN_SECRET))
  }
  assert.ok(!redactForLog(`Authorization: ${header}`).includes(header))
})

// ── C-AUTH-013 — per-request verification, no caching ──────────────────────

test('C-AUTH-013: every request verifies online — no credential or verdict caching', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const endpoint = stubTokenEndpoint()
  const { base } = await mount(t, { root, router, fetchImpl: endpoint.fetchImpl })
  const header = basic(FORUM.clientId, FORUM.clientSecret)
  for (let i = 0; i < 3; i += 1) {
    const { status } = await deliver(base, { authorization: header, body: { ...VALID_BODY, requestId: `req_cache_${i}` } })
    assert.equal(status, 200)
  }
  assert.equal(endpoint.requests.length, 3, 'one online mint per request — no cache')
})

// ── C-AUTH-008 — loopback / fixed paths are not authentication ─────────────

test('C-AUTH-008: loopback origin is NOT authentication — every request still needs a valid credential', async (t) => {
  const root = makeRoot(t)
  const endpoint = stubTokenEndpoint()
  const { base } = await mount(t, { root, router: stubRouter(), fetchImpl: endpoint.fetchImpl })
  // Every request in this suite arrives over 127.0.0.1; none may pass anonymously.
  const anon = await deliver(base, {})
  assert.equal(anon.status, 401)
  const wrongSecret = await deliver(base, { authorization: basic(FORUM.clientId, 'loopback-is-not-auth') })
  assert.equal(wrongSecret.status, 401)
})

// ── C-AUTH-014 — management API forbidden ──────────────────────────────────

test('C-AUTH-014: the verifier NEVER calls principal/client management APIs', async (t) => {
  const root = makeRoot(t)
  const endpoint = stubTokenEndpoint()
  const { base } = await mount(t, { root, router: stubRouter(), fetchImpl: endpoint.fetchImpl })
  await deliver(base, { authorization: basic(FORUM.clientId, FORUM.clientSecret) })
  await deliver(base, { authorization: basic(WORKFLOW.clientId, WORKFLOW.clientSecret), body: { ...VALID_BODY, requestId: 'r_mgmt_2' } })
  for (const request of endpoint.requests) {
    assert.equal(new URL(request.url).pathname, '/oauth/token')
  }
  // Source-level guard: the auth module cannot construct management paths.
  const source = readFileSync(new URL('../src/auth.js', import.meta.url), 'utf8')
  assert.ok(!source.includes('/api/v1/'), 'auth.js must not reference management API paths')
})
