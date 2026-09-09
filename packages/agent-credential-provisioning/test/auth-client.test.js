import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'

import { createAuthProvisioningClient } from '../src/auth-client.js'

test('Auth client requires HTTPS and redacts rejected response bodies', async () => {
  assert.throws(
    () => createAuthProvisioningClient({ authServiceOrigin: 'http://auth.example', getManagementAccessToken: async () => 'token' }),
    { code: 'AUTH_CONFIGURATION_ERROR' },
  )
  const sensitive = randomBytes(32).toString('base64url')
  const client = createAuthProvisioningClient({
    authServiceOrigin: 'https://auth.example',
    getManagementAccessToken: async () => 'management-token',
    fetchImpl: async () => new Response(JSON.stringify({ error: 'rejected', diagnostic: sensitive }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }),
  })
  const management = await client.beginManagementOperation()
  await assert.rejects(
    management.ensurePrincipal({}),
    (error) => error.code === 'AUTH_REQUEST_REJECTED' && !error.message.includes(sensitive),
  )
})

test('management token acquisition fails before S1 and produces no Auth POST', async () => {
  let providerCalls = 0
  let authPosts = 0
  const client = createAuthProvisioningClient({
    authServiceOrigin: 'https://auth.example',
    getManagementAccessToken: async () => {
      providerCalls += 1
      throw new Error('not ready')
    },
    fetchImpl: async () => {
      authPosts += 1
      throw new Error('must not post')
    },
  })
  await assert.rejects(client.beginManagementOperation(), {
    code: 'EXTERNAL_PREREQUISITE_MISSING', prerequisite: 'c',
  })
  assert.equal(providerCalls, 1)
  assert.equal(authPosts, 0)
})

test('one operation-scoped token is reused for S1 and S2 without a second provider call', async () => {
  let providerCalls = 0
  const authorizations = []
  const client = createAuthProvisioningClient({
    authServiceOrigin: 'https://auth.example',
    getManagementAccessToken: async () => {
      providerCalls += 1
      if (providerCalls > 1) throw new Error('second provider call forbidden')
      return 'one-operation-token'
    },
    fetchImpl: async (url, init) => {
      authorizations.push({ url, authorization: init.headers.Authorization })
      return new Response(JSON.stringify({ id: url.endsWith('/principals') ? 'p1' : 'c1', created: true, status: 'active' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const management = await client.beginManagementOperation()
  await management.ensurePrincipal({})
  await management.ensureClient({})
  assert.equal(providerCalls, 1)
  assert.deepEqual(authorizations.map(({ authorization }) => authorization), [
    'Bearer one-operation-token',
    'Bearer one-operation-token',
  ])
})

test('Auth 401/403/5xx remain Auth request errors, never prerequisite-(c) errors', async () => {
  for (const status of [401, 403, 500, 503]) {
    const client = createAuthProvisioningClient({
      authServiceOrigin: 'https://auth.example',
      getManagementAccessToken: async () => 'valid-management-token',
      fetchImpl: async () => new Response('{}', {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    })
    const management = await client.beginManagementOperation()
    await assert.rejects(
      management.ensurePrincipal({}),
      (error) => error.code === 'AUTH_REQUEST_REJECTED'
        && error.code !== 'EXTERNAL_PREREQUISITE_MISSING'
        && error.status === status,
    )
  }
})

test('verification mint returns only status/error classification, never token material', async () => {
  const accessToken = randomBytes(32).toString('base64url')
  const client = createAuthProvisioningClient({
    authServiceOrigin: 'https://auth.example',
    getManagementAccessToken: async () => 'management-token',
    fetchImpl: async () => new Response(JSON.stringify({ access_token: accessToken, expires_in: 300 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  })
  const result = await client.verifyCredential({
    credential: { clientId: 'mc_test', clientSecret: randomBytes(32).toString('base64url') },
    resource: 'svc-forum',
    scope: 'forum.read',
  })
  assert.deepEqual(result, { status: 200, oauthError: undefined })
  assert.equal(JSON.stringify(result).includes(accessToken), false)
})

// ── Amendment 8 (CONTROLLED_LOOPBACK_HTTP_PROVISIONING_EXCEPTION) ──────────

test('Amendment 8: the exact pinned loopback http origin is accepted', () => {
  const client = createAuthProvisioningClient({
    authServiceOrigin: 'http://127.0.0.1:4001',
    getManagementAccessToken: async () => 'management-token',
    fetchImpl: async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
  })
  assert.equal(typeof client.beginManagementOperation, 'function')
})

test('Amendment 8: hostname substitution, other ports and other http origins are still rejected', () => {
  for (const origin of [
    'http://localhost:4001',
    'http://127.0.0.2:4001',
    'http://127.0.0.1:4002',
    'http://example.com:4001',
    'http://auth.example',
  ]) {
    assert.throws(
      () => createAuthProvisioningClient({ authServiceOrigin: origin, getManagementAccessToken: async () => 't' }),
      { code: 'AUTH_CONFIGURATION_ERROR' },
      `origin ${origin} must be rejected`,
    )
  }
})

test('Amendment 8: management POST and verification mint fetches send redirect:error (C4)', async () => {
  const inits = []
  const bodies = [
    { id: 'principal-fixed', status: 'active', created: true },
    { id: 'client-fixed', client_id: 'mc_fixed', status: 'active', created: true, secret: 'one-time' },
    { access_token: 'minted' },
  ]
  const client = createAuthProvisioningClient({
    authServiceOrigin: 'http://127.0.0.1:4001',
    getManagementAccessToken: async () => 'management-token',
    fetchImpl: async (_url, init) => {
      inits.push(init)
      return new Response(JSON.stringify(bodies[inits.length - 1] ?? {}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const management = await client.beginManagementOperation()
  await management.ensurePrincipal({ external_ref: 'agentcore:v1:principal:agt_x', principal_type: 'agent', agent_id: 'agt_x' })
  await management.ensureClient({ external_ref: 'agentcore:v1:client:agt_x', principal_id: 'principal-fixed' })
  const verification = await client.verifyCredential({ credential: { clientId: 'mc_fixed', clientSecret: 's' }, resource: 'svc-forum', scope: 'forum.read' })
  assert.equal(verification.status, 200)
  assert.equal(inits.length, 3)
  for (const init of inits) assert.equal(init.redirect, 'error')
})
