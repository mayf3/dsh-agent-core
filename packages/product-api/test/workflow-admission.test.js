import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync, sign, createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createWorkflowAdmissionHandler } from '../src/workflow-admission.js'

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'admission-test', alg: 'RS256', use: 'sig' }
const now = 1788690000000
const base = {
  iss: 'auth-service', sub: 'cedb954a-3d99-4e5a-b568-d312441bcc56', aud: 'workflow-agent-admission',
  principal_type: 'service', client_id: 'svc-workflow-canonical-admission-v1', scope: 'agent.definition.admission.read',
  token_use: 'access', type: 'access', version: 'v1', jti: 'admission-fixture-000001',
  iat: now / 1000, nbf: now / 1000, exp: now / 1000 + 600,
}
function token(delta = {}) {
  const input = [JSON.stringify({ alg: 'RS256', kid: jwk.kid }), JSON.stringify({ ...base, ...delta })]
    .map(v => Buffer.from(v).toString('base64url')).join('.')
  return input + '.' + sign('RSA-SHA256', Buffer.from(input), keys.privateKey).toString('base64url')
}
function fixture(opts = {}) {
  let reads = 0
  let snapshot = [{ id: 'agt_test-agent', disabled: false, name: 'PRIVATE_SENTINEL' }]
  const handler = createWorkflowAdmissionHandler({
    jwksUrl: 'http://127.0.0.1/jwks', nowMs: () => now,
    fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }),
    definition: { listAgents: () => { reads++; return snapshot } }, ...opts,
  })
  return { handler, reads: () => reads, set: value => { snapshot = value } }
}
const req = (bearer = token(), headers = {}) => ({ method: 'GET', headers: { authorization: `Bearer ${bearer}`, ...headers } })
const url = suffix => new URL('http://localhost/v1/workflow-admission/agents' + suffix)

test('real RS256 token yields only exact observation, refreshes snapshot every command', async () => {
  const f = fixture()
  const observed = { agentId: 'agt_test-agent', enabled: true }
  const result = await f.handler(req(), url('/agt_test-agent'))
  assert.deepEqual(result, { status: 200, body: { ...observed,
    observationDigest: createHash('sha256').update(JSON.stringify(observed)).digest('hex') } })
  assert.equal(JSON.stringify(result).includes('PRIVATE_SENTINEL'), false)
  f.set([{ id: 'agt_test-agent', disabled: true }])
  assert.deepEqual(await f.handler(req(), url('/agt_test-agent')), { status: 409, body: { error: 'AGENT_DISABLED' } })
  assert.equal(f.reads(), 2)
})

test('signature/profile/caller/age failures deny before any Definition read', async () => {
  const f = fixture()
  const cases = [
    ['bad', 401], [token({ aud: 'svc-workflow' }), 401], [token({ iss: 'other' }), 401],
    [token({ principal_type: 'agent', agent_id: 'agt_hr-agent' }), 401],
    [token({ sub: '10000000-0000-4000-8000-000000000001' }), 403],
    [token({ client_id: 'other-client' }), 403], [token({ scope: 'agent.other.read' }), 403],
    [token({ token_use: 'workflow_obo' }), 401], [token({ agent_id: 'agt_hr-agent' }), 401],
    [token({ iat: base.iat - 6, nbf: base.iat - 6, exp: base.iat + 594 }), 401],
    [token({ iat: base.iat + 61, nbf: base.iat + 61, exp: base.iat + 661 }), 401],
  ]
  for (const [bearer, status] of cases) {
    assert.equal((await f.handler(req(bearer), url('/agt_test-agent'))).status, status)
    assert.equal(f.reads(), 0)
  }
})

test('query/body/list/legacy/name/prefix input is invalid after authentication', async () => {
  const f = fixture()
  for (const suffix of ['', '/', '/test-agent', '/agt_test-agent?x=1', '/AGT_test-agent', '/agt_test-agent%2Fother']) {
    assert.equal((await f.handler(req(), url(suffix))).status, 400)
  }
  assert.equal((await f.handler(req(token(), { 'content-length': '2' }), url('/agt_test-agent'))).status, 400)
  assert.equal(f.reads(), 0)
})

test('missing, duplicate, corrupt, disabled and storage errors discriminate', async () => {
  const f = fixture()
  for (const [rows, status, error] of [
    [[], 404, 'AGENT_NOT_FOUND'],
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
