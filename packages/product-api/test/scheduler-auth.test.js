import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto'

import { createJwksTokenVerifier } from '../src/scheduler-auth.js'

const ISSUER = 'auth-service'
const AUDIENCE = 'scheduler'
const KID = 'scheduler-auth-test-key'
const AGENT_ID = 'agt_scheduler-test'
const AGENT_SUB = '10000000-0000-4000-8000-000000000001'
const SERVICE_SUB = '10000000-0000-4000-8000-000000000002'
const NOW = Math.floor(Date.now() / 1000)

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicJwk = publicKey.export({ format: 'jwk' })
const jwk = { ...publicJwk, kid: KID, kty: 'RSA', alg: 'RS256', use: 'sig' }

function baseClaims(overrides = {}) {
  return {
    iss: ISSUER,
    sub: AGENT_SUB,
    aud: AUDIENCE,
    principal_type: 'agent',
    client_id: 'mc_scheduler_test',
    token_use: 'access',
    type: 'access',
    version: 'v1',
    scope: 'scheduler.audit scheduler.read',
    agent_id: AGENT_ID,
    jti: randomUUID(),
    iat: NOW,
    nbf: NOW,
    exp: NOW + 600,
    ...overrides,
  }
}

function signToken(claims, header = { alg: 'RS256', kid: KID, typ: 'JWT' }) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const signingInput = `${encode(header)}.${encode(claims)}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  return `${signingInput}.${signer.sign(privateKey).toString('base64url')}`
}

function verifier(overrides = {}) {
  return createJwksTokenVerifier({
    jwksUrl: 'https://auth.test/.well-known/jwks.json',
    issuer: ISSUER,
    audience: AUDIENCE,
    nowMs: () => NOW * 1000,
    fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }),
    ...overrides,
  })
}

async function rejectsContract(claims) {
  await assert.rejects(
    () => verifier().verify(signToken(claims)),
    (error) => error?.kind === 'TOKEN_CONTRACT_INVALID',
  )
}

test('Auth V1 direct-machine agent and service profiles verify exactly', async () => {
  const auth = verifier()
  const agent = await auth.verify(signToken(baseClaims()))
  assert.equal(agent.principalId, AGENT_SUB)
  assert.equal(agent.agentId, AGENT_ID)
  assert.deepEqual([...agent.scopes], ['scheduler.audit', 'scheduler.read'])

  const serviceClaims = baseClaims({
    sub: SERVICE_SUB,
    principal_type: 'service',
    scope: 'scheduler.audit',
  })
  delete serviceClaims.agent_id
  const service = await auth.verify(signToken(serviceClaims))
  assert.equal(service.principalType, 'service')
  assert.equal(service.agentId, null)
})

test('Auth V1 verifier requires issuer and audience configuration', () => {
  assert.throws(
    () => createJwksTokenVerifier({ jwksUrl: 'https://auth.test/jwks', audience: AUDIENCE }),
    /issuer is required/,
  )
  assert.throws(
    () => createJwksTokenVerifier({ jwksUrl: 'https://auth.test/jwks', issuer: ISSUER }),
    /audience is required/,
  )
})

test('Auth V1 direct-machine claim/profile violations fail closed', async (t) => {
  const cases = [
    ['audience array', { aud: [AUDIENCE] }],
    ['wrong token version', { version: 'v2' }],
    ['wrong token_use', { token_use: 'workflow_obo' }],
    ['wrong type', { type: 'machine_access' }],
    ['non-UUID subject', { sub: 'principal-agent' }],
    ['missing client', { client_id: '' }],
    ['short jti', { jti: 'short' }],
    ['nbf after iat', { nbf: NOW + 1 }],
    ['non-positive lifetime', { exp: NOW }],
    ['TTL over 600 seconds', { exp: NOW + 601 }],
    ['leading scope space', { scope: ' scheduler.read' }],
    ['duplicate scope', { scope: 'scheduler.read scheduler.read' }],
    ['unsorted scopes', { scope: 'scheduler.read scheduler.audit' }],
    ['bad scope grammar', { scope: 'Scheduler.Read' }],
    ['direct token act claim', { act: { sub: SERVICE_SUB } }],
    ['direct token azp claim', { azp: 'proxy-client' }],
  ]
  for (const [name, override] of cases) {
    await t.test(name, () => rejectsContract(baseClaims(override)))
  }

  const missingAgent = baseClaims()
  delete missingAgent.agent_id
  await t.test('agent profile missing agent_id', () => rejectsContract(missingAgent))

  const serviceWithAgent = baseClaims({ principal_type: 'service', sub: SERVICE_SUB })
  await t.test('service profile carrying agent_id', () => rejectsContract(serviceWithAgent))

  await t.test('future iat/nbf is not yet valid', async () => {
    const claims = baseClaims({ iat: NOW + 61, nbf: NOW + 61, exp: NOW + 661 })
    await assert.rejects(
      () => verifier().verify(signToken(claims)),
      (error) => error?.kind === 'TOKEN_INVALID_OR_EXPIRED',
    )
  })
})

test('Auth V1 verifier rejects non-RS256 and unknown kid tokens', async () => {
  const auth = verifier()
  await assert.rejects(
    () => auth.verify(signToken(baseClaims(), { alg: 'HS256', kid: KID })),
    (error) => error?.kind === 'TOKEN_CONTRACT_INVALID',
  )
  await assert.rejects(
    () => auth.verify(signToken(baseClaims(), { alg: 'RS256', kid: 'unknown' })),
    (error) => error?.kind === 'TOKEN_INVALID_OR_EXPIRED',
  )
})

test('Auth V1 trusted JWKS cache is usable only inside max-stale', async () => {
  let available = true
  const auth = verifier({
    cacheTtlMs: 0,
    maxStaleMs: 600_000,
    log: { warn: () => {} },
    fetchImpl: async () => {
      if (!available) throw new Error('offline')
      return { ok: true, json: async () => ({ keys: [jwk] }) }
    },
  })
  const token = signToken(baseClaims())
  await auth.verify(token)
  available = false
  const principal = await auth.verify(token)
  assert.equal(principal.principalId, AGENT_SUB)
})
