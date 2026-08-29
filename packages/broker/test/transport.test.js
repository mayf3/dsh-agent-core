/**
 * @agent-core/broker — Generic authorized HTTP transport tests (P1).
 *
 * Proves the shared transport pipeline (credential seam → client_credentials
 * token → pinned origin/method/path → Bearer fetch → structured result/error)
 * against mock HTTP servers, plus the required mapping matrix:
 * path params / query / JSON body / GET+POST authorization / credential-only
 * identity / Idempotency-Key / 4xx / 5xx / malformed response / timeout &
 * network failure.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

import {
  buildPath,
  buildQuery,
  buildRequestHeaders,
  createIdempotencyKey,
  createHttpTransport,
  createHttpHandlers,
  withTransportErrors,
  parseServiceErrorBody,
  sanitizeErrorDetail,
  extractRequestId,
  buildDownstreamError,
} from '../src/transport.js'
import { assertValidManifest, invoke } from '../src/mapping.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Start a mock HTTP server; records every request; returns { origin, requests, close }. */
function startMockServer(handler) {
  const requests = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const entry = {
        method: req.method,
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: req.headers,
        rawBody: raw,
        body: raw === '' ? undefined : safeJson(raw) ?? Object.fromEntries(new URLSearchParams(raw)),
      }
      requests.push(entry)
      handler(req, res, entry)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        origin: `http://127.0.0.1:${port}`,
        requests,
        close: () =>
          new Promise((r) => {
            // undici keeps keep-alive connections open; force-close them or
            // server.close() never settles.
            server.closeAllConnections?.()
            server.close(r)
          }),
      })
    })
  })
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * A token endpoint (auth-service contract): Basic auth + form body
 * grant_type=client_credentials&resource=<aud>&scope=<scope>.
 * `tokens` may be an array (issued in order) or a function `(entry) => token`
 * (e.g. per-client tokens keyed by the Basic auth header).
 */
async function startTokenServer({ tokens = ['tok-1'], onRequest } = {}) {
  let issued = 0
  const server = await startMockServer((req, res, entry) => {
    if (onRequest) onRequest(entry)
    if (entry.method !== 'POST' || entry.pathname !== '/oauth/token') {
      return json(res, 404, { error: 'not_found' })
    }
    const token = typeof tokens === 'function' ? tokens(entry) : tokens[Math.min(issued, tokens.length - 1)]
    issued += 1
    json(res, 200, { access_token: token, token_type: 'Bearer', expires_in: 300 })
  })
  return server
}

/** A capability manifest fixture with a generic http binding (canonicalized). */
function makeManifest(overrides = {}) {
  return assertValidManifest(
    withTransportErrors({
      id: overrides.id ?? 'demo.items',
      description: 'Demo HTTP capability for transport tests.',
      requiredScopes: overrides.requiredScopes ?? ['demo.read'],
      errors:
        overrides.errors ??
        [
          { code: 'invalid_arguments', description: 'Invalid.' },
          { code: 'unsupported_operation', description: 'Unsupported.' },
        ],
      operations: [
        {
          name: overrides.operation ?? 'read',
          description: 'Read items.',
          arguments:
            overrides.arguments ??
            ({ properties: { id: { type: 'string' }, tag: { type: 'string' } }, required: ['id'] }),
          errors: ['invalid_arguments'],
          http:
            overrides.http ??
            ({ target: 'demo-target', method: 'GET', path: '/v1/items/{id}', pathParams: ['id'], query: ['tag'] }),
        },
      ],
    }),
  )
}

const DEMO_TARGET = { targetId: 'demo-target', allowedOrigin: 'http://127.0.0.1:1', audience: 'demo-aud' }
const DEMO_CREDENTIAL = { clientId: 'client-a', clientSecret: 'secret-a' }

async function makeTransport(opts = {}) {
  // NOTE: `'credential' in opts` (not a default parameter) so callers can
  // deliberately pass credential: undefined to exercise the fail-closed path.
  const credential = 'credential' in opts ? opts.credential : DEMO_CREDENTIAL
  const credentialProvider = { getCredential: async () => credential }
  const transport = createHttpTransport({
    credentialProvider,
    targets: [opts.target ?? DEMO_TARGET],
    authServiceOrigin: opts.tokenOrigin,
    fetchImpl: opts.fetchImpl,
    timeoutMs: opts.timeoutMs,
  })
  return transport
}

/** Run one operation end-to-end through the mapping pipeline (wire envelope). */
async function run(manifest, transport, args) {
  const handlers = createHttpHandlers(manifest, transport)
  return invoke(manifest, handlers, { operation: manifest.operations[0].name, args }, { resolvePrincipal: () => undefined })
}

// ─── Pure binding units ─────────────────────────────────────────────────────

test('binding: path placeholders interpolate with exact match + encoding', () => {
  assert.equal(buildPath('/api/threads/{threadId}', { threadId: 't-1' }), '/api/threads/t-1')
  assert.equal(buildPath('/a/{x}/b/{y}', { x: '1', y: '2' }), '/a/1/b/2')
  // encodeURIComponent prevents path injection
  assert.equal(buildPath('/a/{x}', { x: 'a/b?c=d' }), '/a/a%2Fb%3Fc%3Dd')
  // no placeholders, no params
  assert.equal(buildPath('/plain', {}), '/plain')
  // dot segments are rejected: URL normalization would rewrite the pinned path
  assert.throws(() => buildPath('/a/{x}', { x: '.' }), /dot segment/)
  assert.throws(() => buildPath('/a/{x}', { x: '..' }), /dot segment/)
  // dotted-but-not-dot-segment values are fine (no normalization effect)
  assert.equal(buildPath('/a/{x}', { x: 'a.b' }), '/a/a.b')
  assert.equal(buildPath('/a/{x}', { x: 'a/..' }), '/a/a%2F..')
  // errors
  assert.throws(() => buildPath('/a/{x}', {}), /missing path parameter "x"/)
  assert.throws(() => buildPath('/a/{x}', { x: 'v', y: 'extra' }), /undeclared path parameter "y"/)
  assert.throws(() => buildPath('/a/{x}', { x: '' }), /empty value/)
  assert.throws(() => buildPath('/a/{x}', { y: 'v' }), /missing path parameter "x"/)
  assert.throws(() => buildPath('/a', { x: 'v' }), /no placeholders/)
})

test('binding: query omits undefined/null/empty and serializes scalars', () => {
  assert.equal(buildQuery({ a: 1, b: 'x y', c: true }), 'a=1&b=x+y&c=true')
  assert.equal(buildQuery({ a: undefined, b: null, c: '', d: 'keep' }), 'd=keep')
  assert.equal(buildQuery({}), '')
})

test('binding: only Idempotency-Key header may be forwarded', () => {
  assert.deepEqual(buildRequestHeaders({ 'Idempotency-Key': 'ik-1' }), { 'Idempotency-Key': 'ik-1' })
  assert.throws(() => buildRequestHeaders({ 'X-Evil': '1' }), /not allowed/)
  assert.throws(() => buildRequestHeaders({ 'Idempotency-Key': '' }), /1-128/)
  assert.throws(() => buildRequestHeaders({ 'Idempotency-Key': 'x'.repeat(129) }), /1-128/)
  assert.throws(() => buildRequestHeaders({ 'Idempotency-Key': 'has space' }), /visible ASCII/)
})

test('binding: idempotency key format satisfies the svc-workflow contract', () => {
  const key = createIdempotencyKey('workflow_transition', () => 1000, () => 'abc123')
  assert.equal(key, 'ik-workflow-transition-1000-abc123')
  assert.ok(key.length <= 128)
  assert.ok(/^[\x21-\x7e]+$/.test(key))
})

// ─── Authorized GET / POST against mock servers ────────────────────────────

test('GET authorized request: credential → token → Bearer fetch → parsed result', async () => {
  const tokenServer = await startTokenServer({ tokens: ['tok-1'] })
  const tokenRequests = tokenServer.requests

  const bizServer = await startMockServer((req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/v1/items/')) {
      return json(res, 200, { items: [{ id: 'i-1' }] })
    }
    json(res, 404, { error: 'nope' })
  })

  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  const res = await run(manifest, transport, { id: 'i-1', tag: 'hot' })

  assert.deepEqual(res, { ok: true, result: { items: [{ id: 'i-1' }] } })

  // token endpoint: client_credentials with the seam credential + audience + scope
  assert.equal(tokenRequests.length, 1)
  const tokenReq = tokenRequests[0]
  assert.equal(tokenReq.method, 'POST')
  assert.equal(tokenReq.headers.authorization, `Basic ${Buffer.from('client-a:secret-a').toString('base64')}`)
  assert.equal(tokenReq.body.grant_type, 'client_credentials')
  assert.equal(tokenReq.body.resource, 'demo-aud')
  assert.equal(tokenReq.body.scope, 'demo.read')

  // business request: pinned origin + path binding + query mapping + Bearer
  assert.equal(bizServer.requests.length, 1)
  const bizReq = bizServer.requests[0]
  assert.equal(bizReq.method, 'GET')
  assert.equal(bizReq.pathname, '/v1/items/i-1')
  assert.deepEqual(bizReq.query, { tag: 'hot' })
  assert.equal(bizReq.headers.authorization, 'Bearer tok-1')

  await tokenServer.close()
  await bizServer.close()
})

test('POST authorized request: JSON body mapped from declared args', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname.startsWith('/v1/items')) {
      return json(res, 201, { created: entry.body })
    }
    json(res, 404, { error: 'nope' })
  })

  const manifest = makeManifest({
    operation: 'create',
    requiredScopes: ['demo.write'],
    arguments: { properties: { name: { type: 'string' }, meta: { type: 'json' } }, required: ['name'] },
    http: { target: 'demo-target', method: 'POST', path: '/v1/items', body: ['name', 'meta'] },
  })
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })

  const res = await run(manifest, transport, { name: 'widget', meta: { a: 1 } })

  assert.equal(res.ok, true)
  assert.deepEqual(res.result, { created: { name: 'widget', meta: { a: 1 } } })
  const bizReq = bizServer.requests[0]
  assert.equal(bizReq.method, 'POST')
  assert.equal(bizReq.headers['content-type'], 'application/json')
  assert.deepEqual(bizReq.body, { name: 'widget', meta: { a: 1 } })
  // undefined body args are dropped, not serialized
  const res2 = await run(manifest, transport, { name: 'only' })
  assert.deepEqual(bizServer.requests[1].body, { name: 'only' })
  assert.equal(res2.ok, true)

  await tokenServer.close()
  await bizServer.close()
})

// ─── Credential / identity seam ─────────────────────────────────────────────

test('credential: transport uses the seam credential (spy invoked, Basic auth on wire)', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => json(res, 200, { ok: true }))
  let calls = 0

  const credentialProvider = {
    getCredential: async () => {
      calls += 1
      return DEMO_CREDENTIAL
    },
  }
  const transport = createHttpTransport({
    credentialProvider,
    targets: [{ ...DEMO_TARGET, allowedOrigin: bizServer.origin }],
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = makeManifest({ http: { target: 'demo-target', method: 'GET', path: '/v1/items/{id}', pathParams: ['id'] } })

  const res = await run(manifest, transport, { id: 'i-1' })
  assert.equal(res.ok, true)
  assert.equal(calls, 1)
  assert.equal(tokenServer.requests[0].headers.authorization, `Basic ${Buffer.from('client-a:secret-a').toString('base64')}`)
  assert.equal(bizServer.requests[0].headers.authorization, 'Bearer tok-1')

  await tokenServer.close()
  await bizServer.close()
})

test('credential: caller self-reported agentId / principalId / credential / wire controls can NEVER override the seam', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => json(res, 200, { ok: true, path: req.url }))

  const manifest = makeManifest({
    arguments: { properties: { id: { type: 'string' } }, required: ['id'] },
    http: { target: 'demo-target', method: 'GET', path: '/v1/items/{id}', pathParams: ['id'] },
  })
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })

  // The model smuggles identity AND wire-control fields in args. They are NOT
  // in any binding list, so they must not reach the wire nor influence the
  // credential / token / target / scope.
  const res = await run(manifest, transport, {
    id: 'i-1',
    agentId: 'AGENT_MALLORY',
    principalId: 'AGENT_MALLORY',
    sessionKey: 'sess-mallory',
    clientId: 'client-mallory',
    clientSecret: 'secret-mallory',
    credential: { clientId: 'client-mallory', clientSecret: 'secret-mallory' },
    idempotencyKey: 'ik-mallory',
    authorization: 'Bearer tok-mallory',
    target: 'http://evil.example',
    scope: 'admin everything',
  })

  assert.equal(res.ok, true)
  // Token was issued for the SEAM credential, with the PINNED audience/scope.
  assert.equal(tokenServer.requests[0].headers.authorization, `Basic ${Buffer.from('client-a:secret-a').toString('base64')}`)
  assert.equal(tokenServer.requests[0].body.resource, 'demo-aud')
  assert.equal(tokenServer.requests[0].body.scope, 'demo.read')
  // The business request carries the seam token, the pinned path, and no
  // smuggled header/query.
  const bizReq = bizServer.requests[0]
  assert.equal(bizReq.headers.authorization, 'Bearer tok-1')
  assert.equal(bizReq.pathname, '/v1/items/i-1')
  assert.equal(bizReq.headers['idempotency-key'], undefined)
  assert.equal(bizReq.query.agentId, undefined)

  await tokenServer.close()
  await bizServer.close()
})

test('credential: no credential from the seam → fail closed (credential_unavailable)', async () => {
  const transport = await makeTransport({ credential: undefined })
  const manifest = makeManifest()
  const res = await run(manifest, transport, { id: 'i-1' })
  assert.deepEqual(res, { ok: false, error: { code: 'credential_unavailable' } })
})

test('credential: token caching — one token per (client, audience, scope), refreshed on expiry', async () => {
  const tokenServer = await startTokenServer({ tokens: ['tok-A', 'tok-B'] })
  const bizServer = await startMockServer((req, res) => json(res, 200, { ok: true }))

  const manifest = makeManifest()
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })

  await run(manifest, transport, { id: 'a' })
  await run(manifest, transport, { id: 'b' })
  assert.equal(tokenServer.requests.length, 1) // cached
  assert.equal(bizServer.requests[1].headers.authorization, 'Bearer tok-A')

  // Expire the cache → re-issue.
  const fresh = createHttpTransport({
    credentialProvider: { getCredential: async () => DEMO_CREDENTIAL },
    targets: [{ ...DEMO_TARGET, allowedOrigin: bizServer.origin }],
    authServiceOrigin: tokenServer.origin,
    clock: () => 100_000_000_000,
  })
  await fresh.execute({ manifest, operation: 'read', args: { id: 'c' } })
  assert.equal(tokenServer.requests.length, 2)
  assert.equal(bizServer.requests[2].headers.authorization, 'Bearer tok-B')

  await tokenServer.close()
  await bizServer.close()
})

test('credential: token cache is isolated per (client, audience, scope)', async () => {
  const basic = (id, secret) => `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
  const tokenServer = await startTokenServer({
    tokens: (entry) => {
      if (entry.headers.authorization === basic('client-a', 'secret-a')) return 'tok-A'
      if (entry.headers.authorization === basic('client-b', 'secret-b')) return 'tok-B'
      return 'tok-unknown'
    },
  })
  const bizServer = await startMockServer((req, res) => json(res, 200, { ok: true }))
  const targetsList = [
    { targetId: 'demo-target', allowedOrigin: bizServer.origin, audience: 'demo-aud' },
    { targetId: 'demo-target2', allowedOrigin: bizServer.origin, audience: 'other-aud' },
  ]
  let current = { clientId: 'client-a', clientSecret: 'secret-a' }
  const provider = { getCredential: async () => current }
  const transport = createHttpTransport({ credentialProvider: provider, targets: targetsList, authServiceOrigin: tokenServer.origin })

  const manifestRead = makeManifest({ requiredScopes: ['demo.read'] })
  const manifestOtherAudience = makeManifest({
    http: { target: 'demo-target2', method: 'GET', path: '/v2/items' },
  })
  const manifestWrite = makeManifest({
    operation: 'write',
    requiredScopes: ['demo.write'],
    arguments: { properties: { id: { type: 'string' } }, required: ['id'] },
    http: { target: 'demo-target', method: 'POST', path: '/v1/items', body: ['id'] },
  })

  // credential A → tok-A cached under (client-a | demo-aud | demo.read)
  await run(manifestRead, transport, { id: '1' })
  assert.equal(tokenServer.requests.length, 1)
  assert.equal(bizServer.requests[0].headers.authorization, 'Bearer tok-A')

  // credential B → DIFFERENT cache key ⇒ fresh token (tok-B), never tok-A
  current = { clientId: 'client-b', clientSecret: 'secret-b' }
  await run(manifestRead, transport, { id: '2' })
  assert.equal(tokenServer.requests.length, 2)
  assert.equal(bizServer.requests[1].headers.authorization, 'Bearer tok-B')

  // credential A again → cache hit, still tok-A, NO new token request
  current = { clientId: 'client-a', clientSecret: 'secret-a' }
  await run(manifestRead, transport, { id: '3' })
  assert.equal(tokenServer.requests.length, 2)
  assert.equal(bizServer.requests[2].headers.authorization, 'Bearer tok-A')

  // same client, DIFFERENT audience ⇒ fresh token request (no cross-audience reuse)
  await run(manifestOtherAudience, transport, { id: 'x' })
  assert.equal(tokenServer.requests.length, 3)
  assert.equal(bizServer.requests[3].headers.authorization, 'Bearer tok-A')

  // same client, DIFFERENT scope ⇒ fresh token request (no cross-scope reuse)
  await run(manifestWrite, transport, { id: '4' })
  assert.equal(tokenServer.requests.length, 4)
  assert.equal(bizServer.requests[4].headers.authorization, 'Bearer tok-A')

  await tokenServer.close()
  await bizServer.close()
})

// ─── Idempotency-Key ────────────────────────────────────────────────────────

test('idempotency: transport generates Idempotency-Key for flagged ops and reuses it on 401 retry', async () => {
  const tokenServer = await startTokenServer({ tokens: ['tok-1', 'tok-2'] })
  let bizCalls = 0
  const seenKeys = []
  const bizServer = await startMockServer((req, res) => {
    bizCalls += 1
    seenKeys.push(req.headers['idempotency-key'])
    if (bizCalls === 1) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'unauthorized' }))
      return
    }
    json(res, 200, { transitioned: true })
  })

  const manifest = makeManifest({
    operation: 'transition',
    requiredScopes: ['demo.execute'],
    arguments: { properties: { id: { type: 'string' }, note: { type: 'string' } }, required: ['id'] },
    http: { target: 'demo-target', method: 'POST', path: '/v1/items/{id}/transitions', pathParams: ['id'], body: ['note'], idempotencyKey: true },
  })
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })

  const res = await run(manifest, transport, { id: 'i-1', note: 'go' })

  assert.equal(res.ok, true)
  assert.equal(bizCalls, 2)
  // Same IK on the original request and the 401 retry (server-side dedup).
  assert.equal(seenKeys[0], seenKeys[1])
  assert.ok(/^ik-demo-items-\d+-[a-z0-9]+$/.test(seenKeys[0]))
  assert.ok(seenKeys[0].length <= 128)
  // Fresh token used on retry.
  assert.equal(bizServer.requests[0].headers.authorization, 'Bearer tok-1')
  assert.equal(bizServer.requests[1].headers.authorization, 'Bearer tok-2')
  assert.equal(tokenServer.requests.length, 2)

  await tokenServer.close()
  await bizServer.close()
})

test('idempotency: ops without the flag never carry an Idempotency-Key', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => json(res, 200, { ok: true }))
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  await run(manifest, transport, { id: 'i-1' })
  assert.equal(bizServer.requests[0].headers['idempotency-key'], undefined)

  await tokenServer.close()
  await bizServer.close()
})

// ─── Error mapping ──────────────────────────────────────────────────────────

test('error mapping: 4xx → http_4xx with status + upstream detail', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => json(res, 404, { error: 'not_found', message: 'no such thread' }))
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  const res = await run(manifest, transport, { id: 'missing' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'http_4xx')
  assert.equal(res.error.status, 404)
  assert.ok(res.error.detail.includes('no such thread'))

  await tokenServer.close()
  await bizServer.close()
})

test('error mapping: 5xx → http_5xx with status + upstream detail', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => json(res, 500, { error: 'internal' }))
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  const res = await run(manifest, transport, { id: 'boom' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'http_5xx')
  assert.equal(res.error.status, 500)

  await tokenServer.close()
  await bizServer.close()
})

test('error mapping: repeated 401 → http_4xx (retry exhausted)', async () => {
  const tokenServer = await startTokenServer({ tokens: ['tok-1', 'tok-2'] })
  const bizServer = await startMockServer((req, res) => json(res, 401, { error: 'unauthorized' }))
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  const res = await run(manifest, transport, { id: 'x' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'http_4xx')
  assert.equal(res.error.status, 401)
  assert.equal(bizServer.requests.length, 2) // original + one retry, then fail closed

  await tokenServer.close()
  await bizServer.close()
})

test('401 policy: GET is retried once with a fresh token', async () => {
  const tokenServer = await startTokenServer({ tokens: ['tok-1', 'tok-2'] })
  let bizCalls = 0
  const bizServer = await startMockServer((req, res) => {
    bizCalls += 1
    if (bizCalls === 1) return json(res, 401, { error: 'unauthorized' })
    json(res, 200, { ok: true })
  })
  const manifest = makeManifest() // GET
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })

  const res = await run(manifest, transport, { id: 'x' })
  assert.equal(res.ok, true)
  assert.equal(bizCalls, 2)
  assert.equal(bizServer.requests[0].headers.authorization, 'Bearer tok-1')
  assert.equal(bizServer.requests[1].headers.authorization, 'Bearer tok-2')
  assert.equal(tokenServer.requests.length, 2)

  await tokenServer.close()
  await bizServer.close()
})

test('401 policy: non-idempotent write fails closed WITHOUT retry (no double-apply)', async () => {
  const tokenServer = await startTokenServer({ tokens: ['tok-1'] })
  let bizCalls = 0
  const bizServer = await startMockServer((req, res) => {
    bizCalls += 1
    json(res, 401, { error: 'unauthorized' })
  })
  const manifest = makeManifest({
    operation: 'create',
    requiredScopes: ['demo.write'],
    arguments: { properties: { id: { type: 'string' } }, required: ['id'] },
    http: { target: 'demo-target', method: 'POST', path: '/v1/items', body: ['id'] },
  })
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })

  const res = await run(manifest, transport, { id: 'x' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'http_4xx')
  assert.equal(res.error.status, 401)
  assert.equal(bizCalls, 1) // the write was attempted exactly once
  assert.equal(tokenServer.requests.length, 1) // token issued once, never refreshed

  await tokenServer.close()
  await bizServer.close()
})

test('error mapping: malformed JSON response → malformed_response', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('this is { not json')
  })
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  const res = await run(manifest, transport, { id: 'x' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'malformed_response')
  assert.equal(res.error.status, 200)

  await tokenServer.close()
  await bizServer.close()
})

test('error mapping: timeout → transport_failure', async () => {
  const tokenServer = await startTokenServer()
  // fetch that aborts with a TimeoutError (as AbortSignal.timeout does)
  const fetchImpl = async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
  }
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: 'http://127.0.0.1:1' }, fetchImpl })
  const manifest = makeManifest()

  const res = await run(manifest, transport, { id: 'x' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'transport_failure')

  await tokenServer.close()
})

test('error mapping: network failure → transport_failure', async () => {
  const tokenServer = await startTokenServer()
  // real fetch against a port nobody listens on (token endpoint still served)
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: 'http://127.0.0.1:1' } })
  const manifest = makeManifest()

  const res = await run(manifest, transport, { id: 'x' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'transport_failure')
  assert.ok(res.error.detail.length > 0)

  await tokenServer.close()
})

test('token endpoint failures retain distinct credential, authorization, and downstream families', async () => {
  const cases = [
    { status: 401, wire: 'invalid_client', expected: 'credential_invalid' },
    { status: 400, wire: 'invalid_scope', expected: 'authorization_denied' },
    { status: 400, wire: 'invalid_grant', expected: 'authorization_denied' },
    { status: 400, wire: 'invalid_resource', expected: 'authorization_denied' },
    { status: 403, wire: 'insufficient_scope', expected: 'authorization_denied' },
    { status: 503, wire: 'temporarily_unavailable', expected: 'transport_failure' },
  ]
  for (const item of cases) {
    const tokenServer = await startMockServer((_req, res) => json(res, item.status, { error: item.wire }))
    const transport = await makeTransport({ tokenOrigin: tokenServer.origin })
    const result = await run(makeManifest(), transport, { id: 'classified' })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, item.expected)
    assert.equal(result.error.status, item.status)
    await tokenServer.close()
  }
})

test('token endpoint rejection detail is redacted and cannot echo arbitrary response fields', async () => {
  const marker = 'do-not-echo-sensitive-auth-body'
  const tokenServer = await startMockServer((_req, res) => json(res, 401, {
    error: 'invalid_client',
    diagnostic: marker,
  }))
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin })
  const result = await run(makeManifest(), transport, { id: 'redacted' })
  assert.equal(result.error.code, 'credential_invalid')
  assert.equal(result.error.detail.includes(marker), false)
  await tokenServer.close()
})

test('binding: dot-segment path params fail closed and never reach the wire', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => json(res, 200, { ok: true }))
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  for (const bad of ['.', '..']) {
    const res = await run(manifest, transport, { id: bad })
    assert.equal(res.ok, false)
    assert.equal(res.error.code, 'binding_error')
    assert.ok(res.error.detail.includes('dot segment'), `detail: ${res.error.detail}`)
  }
  // Fail-closed BEFORE any fetch: no token request, no business request.
  assert.equal(tokenServer.requests.length, 0)
  assert.equal(bizServer.requests.length, 0)

  await tokenServer.close()
  await bizServer.close()
})

test('error mapping: binding failure → binding_error (missing/extra path args, unknown target)', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => json(res, 200, { ok: true }))
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  // missing path arg: schema requires id, so this is caught by arg validation
  // instead; simulate an EMPTY value which passes schema but fails binding.
  const res = await run(manifest, transport, { id: '' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'binding_error')

  // unknown target
  const bad = makeManifest({ http: { target: 'no-such-target', method: 'GET', path: '/v1/x' } })
  const res2 = await run(bad, transport, { id: 'x' })
  assert.equal(res2.ok, false)
  assert.equal(res2.error.code, 'binding_error')

  await tokenServer.close()
  await bizServer.close()
})

// ─── Non-HTTP operations never reach the transport ─────────────────────────

test('transport: operation without an http binding is unsupported', async () => {
  const transport = await makeTransport({ credential: undefined })
  const manifest = assertValidManifest({
    id: 'demo.local',
    description: 'Local op.',
    errors: [{ code: 'invalid_arguments' }, { code: 'unsupported_operation' }],
    operations: [{ name: 'local', arguments: { properties: {} } }],
  })
  const res = await transport.execute({ manifest, operation: 'local', args: {} })
  assert.deepEqual(res, { errorCode: 'unsupported_operation' })
})

test('handlers: createHttpHandlers maps only http-bound operations', () => {
  const manifest = makeManifest({ operation: 'read' })
  const handlers = createHttpHandlers(manifest, { execute: async () => 'via-transport' })
  assert.equal(typeof handlers.read, 'function')
  assert.equal(handlers.other, undefined)
})

// ─── Downstream error preservation (helpers + end-to-end) ───────────────────

test('parseServiceErrorBody: recognized envelope shapes', () => {
  // svc-workflow: {"error":{"code","message"}}
  assert.deepEqual(parseServiceErrorBody('{"error":{"code":"principal_not_found","message":"principal not found"}}'), {
    code: 'principal_not_found',
    message: 'principal not found',
  })
  // generic: {"code","message"}
  assert.deepEqual(parseServiceErrorBody('{"code":"teapot","message":"short and stout"}'), {
    code: 'teapot',
    message: 'short and stout',
  })
  // forum/legacy: {"error":"slug","message":...}
  assert.deepEqual(parseServiceErrorBody('{"error":"not_found","message":"no such thread"}'), {
    code: 'not_found',
    message: 'no such thread',
  })
  // {"error":"human prose"} → prose is a message, NOT a code
  assert.deepEqual(parseServiceErrorBody('{"error":"no such thread"}'), { message: 'no such thread' })
  // unsafe / non-matching codes are never surfaced
  assert.deepEqual(parseServiceErrorBody('{"error":{"code":"NOT A CODE!"}}'), {})
  assert.deepEqual(parseServiceErrorBody(`{"error":{"code":"${'x'.repeat(65)}"}}`), {})
  // unparsable / non-object bodies
  assert.deepEqual(parseServiceErrorBody('<html>boom</html>'), {})
  assert.deepEqual(parseServiceErrorBody('[1,2]'), {})
})

test('sanitizeErrorDetail: redacts credential-shaped content, truncates', () => {
  const out = sanitizeErrorDetail('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.token=abc')
  assert.ok(!out.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'))
  assert.ok(!out.includes('token=abc'))
  assert.match(out, /authorization: \[REDACTED\]/i)
  const secret = sanitizeErrorDetail('rejected because api_key="sk-live-999999999999" password=hunter2')
  assert.ok(!secret.includes('sk-live-999999999999'))
  assert.ok(!secret.includes('hunter2'))
  const long = sanitizeErrorDetail(`detail: ${'no such item; '.repeat(40)}`)
  assert.ok(long.length < 600)
  assert.equal([...long].length, 500)
  // innocent messages pass through untouched
  assert.equal(sanitizeErrorDetail('principal not found'), 'principal not found')
})

test('sanitizeErrorDetail: redacts scheme-prefixed Authorization values (Basic/NTLM/Digest)', () => {
  // "authorization=Basic <b64>" previously lost only the scheme word to the
  // generic authorization rule and the credentials survived — the exact trap
  // the bearer rule documents, for the non-Bearer schemes.
  const basic = sanitizeErrorDetail('authorization=Basic dXNlcjpwYXNz api-key=sk-live-9f8e7d6c5b4a3210')
  assert.ok(!basic.includes('dXNlcjpwYXNz'), 'basic credentials must be redacted')
  assert.ok(!basic.includes('sk-live-9f8e7d6c5b4a3210'))
  assert.match(basic, /authorization=\[REDACTED\]/)
  const ntlm = sanitizeErrorDetail('Authorization: NTLM TlRMTVNTUAABAAAAAAAABgAAAAAAAQ==')
  assert.ok(!ntlm.includes('TlRMTVNTUAABAAAAAAAABgAAAAAAAQ'))
  assert.match(ntlm, /authorization: \[REDACTED\]/i)
  const digest = sanitizeErrorDetail('authorization: Digest response=6629fae49393a053974509785505ff5f')
  assert.ok(!digest.includes('6629fae49393a053974509785505ff5f'), 'digest response hash must be redacted')
})

test('extractRequestId: pass-through verbatim, null when absent/invalid, never fabricated', () => {
  const make = (id) => new Headers(id === undefined ? {} : { 'x-request-id': id })
  assert.equal(extractRequestId(make('0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0')), '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0')
  assert.equal(extractRequestId(make('abc-123')), 'abc-123')
  assert.equal(extractRequestId(make(undefined)), null)
  assert.equal(extractRequestId(make('')), null)
  assert.equal(extractRequestId(make('not visible char')), null)
  assert.equal(extractRequestId(make('x'.repeat(129))), null)
})

test('buildDownstreamError: non-JSON body never surfaced raw; empty body placeholder', () => {
  const err = buildDownstreamError(502, '<html><body>gateway explode</body></html>', new Headers())
  assert.equal(err.errorCode, 'http_5xx')
  assert.equal(err.status, 502)
  assert.equal(err.detail, '(downstream returned a non-JSON error body)')
  assert.equal(err.requestId, null)
  const empty = buildDownstreamError(404, '', new Headers())
  assert.equal(empty.detail, '(downstream returned an empty error body)')
})

test('error preservation: declared service code surfaces with status + request-id (end-to-end)', async () => {
  const requestId = '11111111-2222-3333-4444-555555555555'
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => {
    res.writeHead(404, { 'Content-Type': 'application/json', 'x-request-id': requestId })
    res.end(JSON.stringify({ error: { code: 'item_not_found', message: 'no such item' } }))
  })
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest({
    errors: [
      { code: 'invalid_arguments', description: 'Invalid.' },
      { code: 'unsupported_operation', description: 'Unsupported.' },
      { code: 'item_not_found', description: 'Declared downstream code.' },
    ],
  })

  const res = await run(manifest, transport, { id: 'missing' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'item_not_found')
  assert.equal(res.error.status, 404)
  assert.equal(res.error.detail, 'no such item')
  assert.equal(res.error.requestId, requestId)

  await tokenServer.close()
  await bizServer.close()
})

test('error preservation: undeclared service code degrades to declared http_4xx (fail-closed)', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) =>
    json(res, 409, { error: { code: 'brand_new_downstream_code', message: 'server grew a new error' } }),
  )
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  const res = await run(manifest, transport, { id: 'x' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'http_4xx') // never an undeclared wire code
  assert.equal(res.error.status, 409)
  assert.equal(res.error.detail, 'server grew a new error')

  await tokenServer.close()
  await bizServer.close()
})

test('error preservation: 5xx with undeclared code degrades to http_5xx, not invalid_arguments', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) =>
    json(res, 503, { error: { code: 'storage_melted', message: 'storage is melting' } }),
  )
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest()

  const res = await run(manifest, transport, { id: 'x' })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'http_5xx')
  assert.equal(res.error.status, 503)
  assert.equal(res.error.detail, 'storage is melting')

  await tokenServer.close()
  await bizServer.close()
})

test('bounds validation: minimum/maximum + validationError fails fast before any HTTP', async () => {
  const tokenServer = await startTokenServer()
  const bizServer = await startMockServer((req, res) => json(res, 200, { ok: true }))
  const transport = await makeTransport({ tokenOrigin: tokenServer.origin, target: { ...DEMO_TARGET, allowedOrigin: bizServer.origin } })
  const manifest = makeManifest({
    arguments: { properties: { id: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 20, validationError: 'invalid_pagination' } }, required: ['id'] },
    http: { target: 'demo-target', method: 'GET', path: '/v1/items/{id}', pathParams: ['id'], query: ['limit'] },
    errors: [
      { code: 'invalid_arguments', description: 'Invalid.' },
      { code: 'unsupported_operation', description: 'Unsupported.' },
      { code: 'invalid_pagination', description: 'Pagination.' },
    ],
  })

  for (const limit of [0, -1, 21]) {
    const res = await run(manifest, transport, { id: 'x', limit })
    assert.equal(res.ok, false, `limit=${limit}`)
    assert.equal(res.error.code, 'invalid_pagination', `limit=${limit}`)
    assert.match(res.error.detail, /limit/)
  }
  // local fail-fast: NOTHING hit the wire — no token request, no business call
  assert.equal(tokenServer.requests.length, 0)
  assert.equal(bizServer.requests.length, 0)
  // type violations still report invalid_arguments
  const res = await run(manifest, transport, { id: 'x', limit: 'many' })
  assert.equal(res.error.code, 'invalid_arguments')
  assert.equal(bizServer.requests.length, 0)

  await tokenServer.close()
  await bizServer.close()
})
