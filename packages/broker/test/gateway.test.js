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

// ── AGENT_DEFINITION_ACCESS_V1: local (in-process) capability dispatch ─────

import { createDefinitionAccessHandlers } from '../../agent-definition/src/access.js'
import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { agentDefinitionManifests } from '../src/capabilities/agent-definition.js'
import { validateManifest } from '../src/schema.js'

/** A minimal in-process definition runtime: config + read model + handlers. */
async function definitionRuntime(t) {
  const dir = await mkdtemp(join(tmpdir(), 'acb-access-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [
      { id: 'agt_a', name: 'Agent A' },
      { id: 'agt_b', name: 'Agent B' },
    ],
  })
  const definition = new AgentDefinition({ configFile })
  return { configFile, definition, handlers: createDefinitionAccessHandlers({ configFile, definition }) }
}

test('local manifests validate and carry the local marker + write scope', () => {
  for (const m of agentDefinitionManifests) {
    const { ok, manifest, errors } = validateManifest(m)
    assert.equal(ok, true, JSON.stringify(errors))
  }
  const [read, write] = agentDefinitionManifests
  assert.equal(read.id, 'agent.definition.read')
  assert.equal(read.local, true)
  assert.deepEqual(read.requiredScopes ?? [], [], 'read is open (no scope)')
  assert.equal(write.id, 'agent.definition.write')
  assert.equal(write.local.resource, 'agent-definition')
  assert.deepEqual(write.requiredScopes, ['agent.definition.write'])
})

test('local capability: read is served for any credentialed agent (no scope check)', async (t) => {
  const rt = await definitionRuntime(t)
  const svc = await fakeServices(t)
  const store = await storeWith(t, {
    agt_a: { clientId: 'client-A', clientSecret: 'secret-A' },
    agt_b: { clientId: 'client-B', clientSecret: 'secret-B' },
  })
  // Token server denies scope-less requests? It grants any client-A/B token —
  // but read must NOT even hit the token endpoint (no requiredScopes).
  const gateway = createBrokerGateway({
    manifests: agentDefinitionManifests,
    targets: [],
    authServiceOrigin: `http://127.0.0.1:${svc.tokenPort}`,
    credentialsFile: store,
    localHandlers: rt.handlers,
  })

  const listed = await gateway.execute({ capabilityId: 'agent.definition.read', operation: 'list', args: {} }, { agentId: 'agt_a' })
  assert.equal(listed.ok, true)
  assert.equal(listed.result.agents.length, 2)
  const got = await gateway.execute({ capabilityId: 'agent.definition.read', operation: 'get', args: { agentId: 'agt_b' } }, { agentId: 'agt_b' })
  assert.equal(got.ok, true)
  assert.equal(got.result.agent.name, 'Agent B')
  assert.equal(svc.tokenRequests.length, 0, 'read must not touch the token endpoint')
})

test('local capability: no credential bound fails closed (even for read)', async (t) => {
  const rt = await definitionRuntime(t)
  const svc = await fakeServices(t)
  const store = await storeWith(t, {}) // empty store
  const gateway = createBrokerGateway({
    manifests: agentDefinitionManifests,
    targets: [],
    authServiceOrigin: `http://127.0.0.1:${svc.tokenPort}`,
    credentialsFile: store,
    localHandlers: rt.handlers,
  })
  const out = await gateway.execute({ capabilityId: 'agent.definition.read', operation: 'list', args: {} }, { agentId: 'agt_a' })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'credential_unavailable')
})

test('local capability: write DENIED without the Auth grant — handler never runs', async (t) => {
  const rt = await definitionRuntime(t)
  const svc = await fakeServices(t)
  const store = await storeWith(t, { agt_a: { clientId: 'client-A', clientSecret: 'secret-A' } })
  // This stub auth-service grants tokens only to client-HR.
  const deniedServer = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const basic = (req.headers.authorization ?? '').replace(/^Basic /, '')
      const clientId = Buffer.from(basic, 'base64').toString('utf8').split(':')[0]
      if (clientId === 'client-HR') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ access_token: 'jwt-hr', expires_in: 3600 }))
      } else {
        res.writeHead(403, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'insufficient_scope' }))
      }
    })
  })
  await new Promise((r) => deniedServer.listen(0, '127.0.0.1', r))
  const deniedPort = deniedServer.address().port
  t.after(async () => { await new Promise((r) => deniedServer.close(r)) })

  const gateway = createBrokerGateway({
    manifests: agentDefinitionManifests,
    targets: [],
    authServiceOrigin: `http://127.0.0.1:${deniedPort}`,
    credentialsFile: store,
    localHandlers: rt.handlers,
  })
  const before = rt.definition.listAgents().length
  const out = await gateway.execute({ capabilityId: 'agent.definition.write', operation: 'create', args: { name: 'Should Not Land' } }, { agentId: 'agt_a' })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'access_denied')
  assert.equal(rt.definition.listAgents().length, before, 'config untouched after denial')
})

test('local capability: write ALLOWED when the Auth grant covers the scope', async (t) => {
  const rt = await definitionRuntime(t)
  const svc = await fakeServices(t)
  const store = await storeWith(t, { agt_hr: { clientId: 'client-HR', clientSecret: 'secret-HR' } })
  const grantedServer = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: 'jwt-hr', expires_in: 3600 }))
    })
  })
  await new Promise((r) => grantedServer.listen(0, '127.0.0.1', r))
  const grantedPort = grantedServer.address().port
  t.after(async () => { await new Promise((r) => grantedServer.close(r)) })

  const gateway = createBrokerGateway({
    manifests: agentDefinitionManifests,
    targets: [],
    authServiceOrigin: `http://127.0.0.1:${grantedPort}`,
    credentialsFile: store,
    localHandlers: rt.handlers,
  })
  // create: mints a stable id into the config, read model refreshed.
  const created = await gateway.execute({ capabilityId: 'agent.definition.write', operation: 'create', args: { name: 'Agent C' } }, { agentId: 'agt_hr' })
  console.log('DBG created:', JSON.stringify(created))
  assert.equal(created.ok, true)
  const cid = created.result.agent.id
  assert.ok(cid.startsWith('agt_'))
  assert.equal(rt.definition.listAgents().length, 3, 'config updated + read model refreshed')
  // update: rename keeps the id.
  const updated = await gateway.execute({ capabilityId: 'agent.definition.write', operation: 'update', args: { agentId: cid, name: 'Agent C v2' } }, { agentId: 'agt_hr' })
  assert.equal(updated.ok, true)
  assert.equal(updated.result.agent.id, cid)
  // set_default first (disabling the current default is refused by design),
  // then disable the old default.
  const sd = await gateway.execute({ capabilityId: 'agent.definition.write', operation: 'set_default', args: { agentId: cid } }, { agentId: 'agt_hr' })
  assert.equal(sd.ok, true)
  const refused = await gateway.execute({ capabilityId: 'agent.definition.write', operation: 'disable', args: { agentId: cid } }, { agentId: 'agt_hr' })
  assert.equal(refused.ok, false, 'disabling the current default is refused')
  assert.equal(refused.error.code, 'validation_error')
  const disabled = await gateway.execute({ capabilityId: 'agent.definition.write', operation: 'disable', args: { agentId: 'agt_a' } }, { agentId: 'agt_hr' })
  assert.equal(disabled.ok, true)
  assert.equal(disabled.result.agent.disabled, true)
  // The persisted config carries the mutation (single authority on disk).
  const onDisk = new AgentDefinition({ configFile: rt.configFile })
  assert.equal(onDisk.getDefaultAgent().id, cid)
})

test('local capability: unknown capability/operation fails closed as unsupported', async (t) => {
  const rt = await definitionRuntime(t)
  const svc = await fakeServices(t)
  const store = await storeWith(t, { agt_a: { clientId: 'client-A', clientSecret: 'secret-A' } })
  const gateway = createBrokerGateway({
    manifests: agentDefinitionManifests,
    targets: [],
    authServiceOrigin: `http://127.0.0.1:${svc.tokenPort}`,
    credentialsFile: store,
    localHandlers: rt.handlers,
  })
  const unknown = await gateway.execute({ capabilityId: 'agent.definition.nope', operation: 'list', args: {} }, { agentId: 'agt_a' })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'unsupported_operation')
  const badOp = await gateway.execute({ capabilityId: 'agent.definition.write', operation: 'explode', args: {} }, { agentId: 'agt_a' })
  assert.equal(badOp.ok, false)
  assert.equal(badOp.error.code, 'unsupported_operation')
})

test('local capability: handler failure becomes a structured error, never a throw', async (t) => {
  const rt = await definitionRuntime(t)
  const svc = await fakeServices(t)
  const store = await storeWith(t, { agt_hr: { clientId: 'client-HR', clientSecret: 'secret-HR' } })
  const grantedServer = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: 'jwt-hr', expires_in: 3600 }))
    })
  })
  await new Promise((r) => grantedServer.listen(0, '127.0.0.1', r))
  const grantedPort = grantedServer.address().port
  t.after(async () => { await new Promise((r) => grantedServer.close(r)) })
  const gateway = createBrokerGateway({
    manifests: agentDefinitionManifests,
    targets: [],
    authServiceOrigin: `http://127.0.0.1:${grantedPort}`,
    credentialsFile: store,
    localHandlers: rt.handlers,
  })
  // A write to an unknown agent -> agent_not_found envelope.
  const out = await gateway.execute({ capabilityId: 'agent.definition.write', operation: 'disable', args: { agentId: 'agt_nope' } }, { agentId: 'agt_hr' })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'agent_not_found')
})

test('local capability: localHandlerResolver is consulted at EXECUTE time (loader race safety)', async (t) => {
  const rt = await definitionRuntime(t)
  const svc = await fakeServices(t)
  const store = await storeWith(t, { agt_a: { clientId: 'client-A', clientSecret: 'secret-A' } })
  // The resolver is NOT available at construction (the sibling row is still
  // applying) — it becomes available later, before any call executes.
  let handlers = {}
  const gateway = createBrokerGateway({
    manifests: agentDefinitionManifests,
    targets: [],
    authServiceOrigin: `http://127.0.0.1:${svc.tokenPort}`,
    credentialsFile: store,
    localHandlerResolver: () => handlers,
  })
  // Before the sibling lands: local ops fail closed as unsupported.
  const early = await gateway.execute({ capabilityId: 'agent.definition.read', operation: 'list', args: {} }, { agentId: 'agt_a' })
  assert.equal(early.ok, false)
  assert.equal(early.error.code, 'unsupported_operation')
  // Sibling row applies; the SAME gateway now serves the capability.
  handlers = rt.handlers
  const listed = await gateway.execute({ capabilityId: 'agent.definition.read', operation: 'list', args: {} }, { agentId: 'agt_a' })
  assert.equal(listed.ok, true)
  assert.equal(listed.result.agents.length, 2)
})
