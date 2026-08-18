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
  await assert.rejects(
    client.ensurePrincipal({}),
    (error) => error.code === 'AUTH_REQUEST_REJECTED' && !error.message.includes(sensitive),
  )
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
