import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { createInquiryAuthenticator } from '../src/website-inquiry/auth.js'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' }
const now = 1800000000000
const human = { iss: 'auth-service', sub: '00000000-0000-4000-8000-000000000001', aud: 'agent-core-website-human-v1',
  principal_type: 'user', client_id: 'project-progress-desk-web-v1', token_use: 'access', type: 'access', version: 'v1',
  jti: 'synthetic-token-000000001', iat: now / 1000, nbf: now / 1000, exp: now / 1000 + 900 }
function token(claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${body}.${sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url')}`
}
test('original signed Human profile rejects invented claims and separates valid wrong client', async () => {
  const auth = createInquiryAuthenticator({ jwksUrl: 'https://keys.example/.well-known/jwks.json', now: () => now,
    fetchImpl: async () => new Response(JSON.stringify({ keys: [jwk] })) })
  assert.equal((await auth.human(`Bearer ${token(human)}`)).principalId, human.sub)
  for (const patch of [{ scope: '' }, { principal_type: 'service' }, { exp: human.iat + 901 }, { version: 1 }, { nbf: human.iat + 1 }]) {
    await assert.rejects(auth.human(`Bearer ${token({ ...human, ...patch })}`), { code: 'UNAUTHENTICATED' })
  }
  await assert.rejects(auth.human(`Bearer ${token({ ...human, client_id: 'android' })}`), { code: 'FORBIDDEN' })
})
test('controller performs new fixed no-redirect issuance per call and exact operation scope', async () => {
  let issued = 0
  const service = { ...human, aud: 'agent-core-website-transport-v1', principal_type: 'service', client_id: 'agent-control-website-inquiry-v1', exp: human.iat + 600, scope: 'conversation.own_result.read' }
  const auth = createInquiryAuthenticator({ jwksUrl: 'https://keys.example/.well-known/jwks.json', now: () => now,
    fetchImpl: async (url, options) => {
      if (url.includes('jwks')) return new Response(JSON.stringify({ keys: [jwk] }))
      issued++
      assert.equal(url, 'https://auth.mayf3.com/oauth/token')
      assert.equal(options.redirect, 'error')
      assert.equal(options.body.get('scope'), 'conversation.own_result.read')
      return new Response(JSON.stringify({ access_token: token(service), token_type: 'Bearer', expires_in: 600 }))
    } })
  const basic = `Basic ${Buffer.from('synthetic:credential').toString('base64')}`
  await auth.controller(basic, 'read')
  await auth.controller(basic, 'read')
  assert.equal(issued, 2)
})
