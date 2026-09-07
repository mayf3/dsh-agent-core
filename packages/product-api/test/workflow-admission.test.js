import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync, sign } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createWorkflowAdmissionHandler } from '../src/workflow-admission.js'

// AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1 fixtures: real RS256 tokens against
// the fake JWKS seam; agent AND service callers are directory-eligible, with
// no pinned principal/client constants.
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'directory-test', alg: 'RS256', use: 'sig' }
const now = 1788690000000
const agentBase = {
  iss: 'auth-service', sub: '10000000-0000-4000-8000-000000000001', aud: 'agent-directory',
  principal_type: 'agent', agent_id: 'agt_caller-agent', client_id: 'caller-agent-client',
  scope: 'agent.directory.read', token_use: 'access', type: 'access', version: 'v1',
  jti: 'directory-fixture-agent-0001', iat: now / 1000, nbf: now / 1000, exp: now / 1000 + 600,
}
const serviceBase = {
  ...agentBase, principal_type: 'service', agent_id: undefined,
  sub: '20000000-0000-4000-8000-000000000002', client_id: 'caller-service-client',
  jti: 'directory-fixture-service-01',
}
function token(base, delta = {}) {
  const input = [JSON.stringify({ alg: 'RS256', kid: jwk.kid }), JSON.stringify({ ...base, ...delta })]
    .map(v => Buffer.from(v).toString('base64url')).join('.')
  return input + '.' + sign('RSA-SHA256', Buffer.from(input), keys.privateKey).toString('base64url')
}
const agentToken = delta => token(agentBase, delta)
const serviceToken = delta => token(serviceBase, delta)
function fixture(opts = {}) {
  let reads = 0
  let snapshot = [{ id: 'agt_test-agent', disabled: false, name: 'PRIVATE_SENTINEL' }, { id: 'agt_stock_agent', disabled: false }]
  const handler = createWorkflowAdmissionHandler({
    jwksUrl: 'http://127.0.0.1/jwks', nowMs: () => now,
    fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }),
    definition: { listAgents: () => { reads++; return snapshot } }, ...opts,
  })
  return { handler, reads: () => reads, set: value => { snapshot = value } }
}
const req = (bearer, headers = {}) => ({
  method: 'GET',
  headers: { authorization: `Bearer ${bearer ?? agentToken()}`, ...headers },
})
const url = suffix => new URL('http://localhost/v1/directory/agents' + suffix)

test('agent caller observes exactly {agentId, exists, enabled}, snapshot fresh per command', async () => {
  const f = fixture()
  const result = await f.handler(req(), url('/agt_test-agent'))
  assert.deepEqual(result, { status: 200, body: { agentId: 'agt_test-agent', exists: true, enabled: true } })
  // Canonical grammar includes underscore IDs (agent-definition AGENT_ID_RE).
  assert.deepEqual(await f.handler(req(), url('/agt_stock_agent')),
    { status: 200, body: { agentId: 'agt_stock_agent', exists: true, enabled: true } })
  f.set([{ id: 'agt_test-agent', disabled: false }, { id: 'agt_stock_agent', disabled: false }])  // reset to 2-row snapshots for the freshness counts below
  assert.equal(JSON.stringify(result).includes('PRIVATE_SENTINEL'), false)
  f.set([{ id: 'agt_test-agent', disabled: true }])
  assert.deepEqual(await f.handler(req(), url('/agt_test-agent')),
    { status: 200, body: { agentId: 'agt_test-agent', exists: true, enabled: false } })
  assert.equal(f.reads(), 3)  // fresh snapshot per command: initial + underscore + disabled
})

test('service caller is equally directory-eligible; required scope is presence-checked', async () => {
  // CTR-IAD-002 pins the exact audience and the required scope; it does not
  // pin a scope count (the retired exact-single-scope check was part of the
  // dedicated-caller pinning), so extra registered scopes do not deny.
  const f = fixture()
  assert.deepEqual(await f.handler(req(serviceToken()), url('/agt_test-agent')),
    { status: 200, body: { agentId: 'agt_test-agent', exists: true, enabled: true } })
  assert.deepEqual(await f.handler(req(serviceToken({ scope: 'agent.directory.read agent.other.read' })), url('/agt_test-agent')),
    { status: 200, body: { agentId: 'agt_test-agent', exists: true, enabled: true } })
  assert.equal(f.reads(), 2)
})

test('unknown exact ID is a 200 observation {exists:false, enabled:false}', async () => {
  const f = fixture()
  assert.deepEqual(await f.handler(req(), url('/agt_absent-agent')),
    { status: 200, body: { agentId: 'agt_absent-agent', exists: false, enabled: false } })
  assert.equal(f.reads(), 1)
})

test('wrong audience/issuer/profile/expired and missing scope deny before any Definition read', async () => {
  const f = fixture()
  const cases = [
    ['bad', 401],
    [agentToken({ aud: 'svc-workflow' }), 401],
    [agentToken({ iss: 'other' }), 401],
    [agentToken({ token_use: 'workflow_obo' }), 401],
    [agentToken({ iat: agentBase.iat + 61, nbf: agentBase.iat + 61, exp: agentBase.iat + 661 }), 401],
    [agentToken({ iat: agentBase.iat - 661, nbf: agentBase.iat - 661, exp: agentBase.iat - 61 }), 401],
    [agentToken({ scope: 'agent.other.read' }), 403],
  ]
  for (const [bearer, status] of cases) {
    assert.equal((await f.handler(req(bearer), url('/agt_test-agent'))).status, status)
    assert.equal(f.reads(), 0)
  }
})

test('human principal type is denied before any Definition read', async () => {
  // CTR-IAD-002: profile errors map to 401 — the scheduler-auth machine
  // profile rejects non-agent/service tokens inside the verifier itself. The
  // handler keeps its own agent/service predicate (403) as defense in depth.
  const f = fixture()
  const result = await f.handler(req(agentToken({ principal_type: 'human' })), url('/agt_test-agent'))
  assert.equal(result.status, 401)
  assert.equal(f.reads(), 0)
})

test('the superseded 5-second issued-at pin is retired; verifier time policy governs', async () => {
  const f = fixture()
  const old = { iat: agentBase.iat - 100, nbf: agentBase.iat - 100, exp: agentBase.iat + 500 }
  assert.deepEqual(await f.handler(req(agentToken(old)), url('/agt_test-agent')),
    { status: 200, body: { agentId: 'agt_test-agent', exists: true, enabled: true } })
  assert.equal(f.reads(), 1)
})

test('query/body/list/legacy/name/prefix input is invalid after authentication', async () => {
  const f = fixture()
  for (const suffix of ['', '/', '/test-agent', '/agt_test-agent?x=1', '/AGT_test-agent', '/agt_test-agent%2Fother']) {
    assert.equal((await f.handler(req(), url(suffix))).status, 400)
  }
  assert.equal((await f.handler(req(agentToken(), { 'content-length': '2' }), url('/agt_test-agent'))).status, 400)
  assert.equal(f.reads(), 0)
})

test('duplicate, corrupt and storage errors discriminate', async () => {
  const f = fixture()
  for (const [rows, status, error] of [
    [[{ id: 'agt_test-agent' }, { id: 'agt_test-agent' }], 409, 'AGENT_DEFINITION_AMBIGUOUS'],
    [[{ id: 'agt_test-agent', disabled: 'false' }], 409, 'AGENT_DEFINITION_AMBIGUOUS'],
    [null, 409, 'AGENT_DEFINITION_AMBIGUOUS'],
  ]) {
    f.set(rows)
    assert.deepEqual(await f.handler(req(), url('/agt_test-agent')), { status, body: { error } })
  }
  const broken = fixture({ definition: { listAgents: () => { throw new Error('PRIVATE_SENTINEL') } } })
  assert.deepEqual(await broken.handler(req(), url('/agt_test-agent')), { status: 500, body: { error: 'AGENT_DEFINITION_QUERY_FAILED' } })
})

test('whole deadline includes JWKS; late verification never reads snapshot', async () => {
  const f = fixture({ timeoutMs: 20, fetchImpl: async () => {
    await delay(60)
    return { ok: true, json: async () => ({ keys: [jwk] }) }
  } })
  assert.deepEqual(await f.handler(req(), url('/agt_test-agent')), { status: 504, body: { error: 'AGENT_DEFINITION_TIMEOUT' } })
  await delay(80)
  assert.equal(f.reads(), 0)
})
