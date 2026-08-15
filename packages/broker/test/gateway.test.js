/**
 * Unit tests for @agent-core/broker/src/gateway.js — the parent-side trusted
 * Broker gateway (trusted credential broker model).
 *
 * Pins: the caller identity is the ACTUAL agentId passed by the Router
 * (never read from the call payload); the MachineClient credential comes
 * from the store per agentId; the EXISTING authorized HTTP transport is
 * reused end-to-end (client_credentials -> token cache -> pinned downstream)
 * against fake token/downstream servers.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createServer } from 'node:http'

import { createBrokerGateway } from '../src/gateway.js'
import { withTransportErrors } from '../src/transport.js'

const manifest = withTransportErrors({
  id: 'test.capability',
  toolName: 'test_capability',
  name: 'Test Capability',
  description: 'test',
  requiredScopes: ['test.read'],
  errors: [
    { code: 'invalid_arguments', description: 'bad args' },
    { code: 'unsupported_operation', description: 'unsupported' },
    { code: 'credential_unavailable', description: 'no credential' },
  ],
  operations: [{
    name: 'op',
    description: 'op',
    arguments: { properties: { q: { type: 'string' } }, required: [] },
    result: { type: 'json' },
    errors: ['invalid_arguments'],
    http: { target: 'test-target', method: 'GET', path: '/things', query: ['q'] },
  }],
})

/** Fake auth-service token endpoint + fake downstream, both in-process. */
async function fakeServices(t) {
  const tokenRequests = []
  const downstreamHits = []
  const tokenServer = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const basic = (req.headers.authorization ?? '').replace(/^Basic /, '')
      const decoded = Buffer.from(basic, 'base64').toString('utf8')
      const [clientId, clientSecret] = decoded.split(':')
      tokenRequests.push({ clientId, clientSecret, body })
      if (clientId === 'client-A' || clientId === 'client-B') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ access_token: `jwt-${clientId}`, expires_in: 3600 }))
      } else {
        res.writeHead(401, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid_client' }))
      }
    })
  })
  const downstreamServer = createServer((req, res) => {
    downstreamHits.push({ authorization: req.headers.authorization ?? '', url: req.url })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ items: ['ok'] }))
  })
  await new Promise((r) => tokenServer.listen(0, '127.0.0.1', r))
  await new Promise((r) => downstreamServer.listen(0, '127.0.0.1', r))
  const tokenPort = tokenServer.address().port
  const downstreamPort = downstreamServer.address().port
  t.after(async () => {
    await new Promise((r) => tokenServer.close(r))
    await new Promise((r) => downstreamServer.close(r))
  })
  return { tokenPort, downstreamPort, tokenRequests, downstreamHits }
}

async function storeWith(t, entries) {
  const dir = await mkdtemp(join(tmpdir(), 'acb-gateway-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'agent-credentials.json')
  await writeFile(file, JSON.stringify({ version: 1, credentials: entries }, null, 2))
  return file
}

test('gateway executes as the ACTUAL agentId with ITS credential (A and B distinct)', async (t) => {
  const svc = await fakeServices(t)
  const store = await storeWith(t, {
    'agt-A': { clientId: 'client-A', clientSecret: 'secret-A' },
    'agt-B': { clientId: 'client-B', clientSecret: 'secret-B' },
  })
  const gateway = createBrokerGateway({
    manifests: [manifest],
    targets: [{ targetId: 'test-target', allowedOrigin: `http://127.0.0.1:${svc.downstreamPort}`, audience: 'test-aud' }],
    authServiceOrigin: `http://127.0.0.1:${svc.tokenPort}`,
    credentialsFile: store,
  })

  const asA = await gateway.execute({ capabilityId: 'test.capability', operation: 'op', args: { q: 'a' } }, { agentId: 'agt-A' })
  assert.equal(asA.ok, true)
  const asB = await gateway.execute({ capabilityId: 'test.capability', operation: 'op', args: { q: 'b' } }, { agentId: 'agt-B' })
  assert.equal(asB.ok, true)

  assert.equal(svc.tokenRequests.length, 2, 'one token issuance per agent')
  assert.deepEqual(svc.tokenRequests.map((r) => r.clientId).sort(), ['client-A', 'client-B'])
  assert.deepEqual(svc.downstreamHits.map((h) => h.authorization).sort(), ['Bearer jwt-client-A', 'Bearer jwt-client-B'])
  assert.equal(svc.downstreamHits[0].url, '/things?q=a')
})

test('gateway token cache: second call as the same agent reuses the token', async (t) => {
  const svc = await fakeServices(t)
  const store = await storeWith(t, { 'agt-A': { clientId: 'client-A', clientSecret: 'secret-A' } })
  const gateway = createBrokerGateway({
    manifests: [manifest],
    targets: [{ targetId: 'test-target', allowedOrigin: `http://127.0.0.1:${svc.downstreamPort}`, audience: 'test-aud' }],
    authServiceOrigin: `http://127.0.0.1:${svc.tokenPort}`,
    credentialsFile: store,
  })
  await gateway.execute({ capabilityId: 'test.capability', operation: 'op', args: {} }, { agentId: 'agt-A' })
  await gateway.execute({ capabilityId: 'test.capability', operation: 'op', args: {} }, { agentId: 'agt-A' })
  assert.equal(svc.tokenRequests.length, 1, 'token cache reused across calls for the same agent')
  assert.equal(svc.downstreamHits.length, 2)
})

test('gateway: no credential bound -> fails closed credential_unavailable', async (t) => {
  const svc = await fakeServices(t)
  const store = await storeWith(t, {})
  const gateway = createBrokerGateway({
    manifests: [manifest],
    targets: [{ targetId: 'test-target', allowedOrigin: `http://127.0.0.1:${svc.downstreamPort}`, audience: 'test-aud' }],
    authServiceOrigin: `http://127.0.0.1:${svc.tokenPort}`,
    credentialsFile: store,
  })
  const result = await gateway.execute({ capabilityId: 'test.capability', operation: 'op', args: {} }, { agentId: 'agt-unknown' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'credential_unavailable')
  assert.equal(svc.tokenRequests.length, 0, 'no token request without a credential')
})

test('gateway NEVER reads caller identity from the call payload (forged fields ignored)', async (t) => {
  const svc = await fakeServices(t)
  const store = await storeWith(t, { 'agt-A': { clientId: 'client-A', clientSecret: 'secret-A' } })
  const gateway = createBrokerGateway({
    manifests: [manifest],
    targets: [{ targetId: 'test-target', allowedOrigin: `http://127.0.0.1:${svc.downstreamPort}`, audience: 'test-aud' }],
    authServiceOrigin: `http://127.0.0.1:${svc.tokenPort}`,
    credentialsFile: store,
  })
  // A malicious child asserts B's identity in the payload; the Router would
  // call execute with the ACTUAL agentId (agt-A). The gateway must ignore
  // every identity-ish payload field.
  const result = await gateway.execute({
    capabilityId: 'test.capability',
    operation: 'op',
    args: { q: 'x' },
    agentId: 'agt-B',
    principalId: 'B-principal',
    clientId: 'client-B',
    scope: ['*'],
    audience: 'svc-forum',
    authorization: 'Bearer forged',
  }, { agentId: 'agt-A' })
  assert.equal(result.ok, true)
  assert.equal(svc.tokenRequests.length, 1)
  assert.equal(svc.tokenRequests[0].clientId, 'client-A', 'credential comes from the ACTUAL agent, never the payload')
  assert.equal(svc.downstreamHits[0].authorization, 'Bearer jwt-client-A')
})

test('gateway: unknown capability fails closed as unsupported', async (t) => {
  const svc = await fakeServices(t)
  const store = await storeWith(t, { 'agt-A': { clientId: 'client-A', clientSecret: 'secret-A' } })
  const gateway = createBrokerGateway({
    manifests: [manifest],
    targets: [{ targetId: 'test-target', allowedOrigin: `http://127.0.0.1:${svc.downstreamPort}`, audience: 'test-aud' }],
    authServiceOrigin: `http://127.0.0.1:${svc.tokenPort}`,
    credentialsFile: store,
  })
  const result = await gateway.execute({ capabilityId: 'nope', operation: 'op', args: {} }, { agentId: 'agt-A' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'unsupported_operation')
  assert.equal(svc.tokenRequests.length, 0)
})
