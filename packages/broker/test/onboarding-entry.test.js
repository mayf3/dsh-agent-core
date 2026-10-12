/**
 * Isolation tests for the HR new-hire onboarding ENTRY wiring (bounded
 * SOURCE segment of agent-control defect #953).
 *
 * THE ONE REAL ENTRY under test — the exact production dispatch chain:
 *
 *   model tool `agent_definition_write` { operation: 'create', args }
 *     -> child relay `agent-core/broker` (identity stripped; Router decides
 *        the ACTUAL caller)                    [relay.js / agent-router]
 *     -> createBrokerGateway.execute(call, { agentId })   [gateway.js]
 *          1. MachineClient credential from the 505-private store
 *             (missing -> credential_unavailable FAIL-CLOSED)
 *          2. local grant check: requestAccessToken(scope
 *             'agent.definition.write') — auth-service is the ONLY grant
 *             authority; ANY failure -> access_denied FAIL-CLOSED
 *          3. agentDefinitionAccess handler -> createAgentInConfig
 *             (mints ONE stable agt_* id, atomic tmp+rename persist)
 *
 * Fixtures are fully isolated — the same patterns as gateway.test.js and
 * delivery.test.js, no new framework: a temp credential store carrying
 * SENTINEL secrets, a REAL Agent Definition config + read model +
 * access handlers wired through localHandlerResolver exactly like the
 * production composition (broker/src/index.js), and a FAKE in-process
 * auth-service token endpoint. No live service, no real principal, group,
 * credential, or member is ever created; no live endpoint is contacted.
 *
 * What is pinned (defect #953 bounded slice):
 *   - success: create lands + read model refreshes + the NEXT stage sees a
 *     defined, enabled, name/id-resolvable agent — while the new hire's OWN
 *     broker surface still fails CLOSED with credential_unavailable and
 *     ZERO token-endpoint calls (created != able-to-work is machine-readable).
 *   - duplicate: a same-name create is NOT deduped at this entry (a second
 *     stable id mints; name resolution stays with the FIRST config-order
 *     match; dedupe lives in deployment-side adoptAgents, config.js).
 *     The local grant check is uncached: one token POST per call.
 *   - rejection: a caller without the grant is denied BEFORE the handler
 *     runs; the config file is byte-identical afterwards.
 *   - UNKNOWN: auth-service unreachable / 5xx also fails CLOSED as
 *     access_denied with the FIXED detail (never a success envelope, never
 *     an upstream-body echo); config untouched.
 *   - secrets: the credential sentinel never appears in any returned
 *     envelope or parent log line.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createServer } from 'node:http'

import { createBrokerGateway } from '../src/gateway.js'
import { agentDefinitionManifests } from '../src/capabilities/agent-definition.js'
import { createDefinitionAccessHandlers } from '../../agent-definition/src/access.js'
import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { TOKEN_ENDPOINT_PATH } from '../src/transport.js'

/** Sentinel values planted in the fixture credential store. */
const SENTINEL_CLIENT_ID = 'sentinel-hr-clientId'
const SENTINEL_CLIENT_SECRET = 'sentinel-hr-clientSecret-MUST-NOT-LEAK'

/**
 * Fake auth-service token endpoint. Grants a token only to the configured
 * clientIds; every request is recorded. `respond` may be replaced per test
 * (e.g. to answer 503) and the server may be closed to simulate an
 * unreachable authority (UNKNOWN at the grant check).
 */
async function fakeAuthService(t, { grantedClientIds }) {
  const requests = []
  let respond = (clientId, req, res) => {
    if (grantedClientIds.includes(clientId)) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: `jwt-${clientId}`, expires_in: 3600 }))
    } else {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'insufficient_scope' }))
    }
  }
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const basic = (req.headers.authorization ?? '').replace(/^Basic /, '')
      const [clientId, clientSecret] = Buffer.from(basic, 'base64').toString('utf8').split(':')
      requests.push({ clientId, clientSecret, body })
      respond(clientId, req, res)
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  t.after(async () => {
    await new Promise((r) => { server.close(r); server.closeAllConnections?.() })
  })
  return {
    port: server.address().port,
    requests,
    /** Swap the response behavior (UNKNOWN simulations). */
    setRespond: (fn) => { respond = fn },
    /** Simulate an unreachable authority (server gone, port still "known"). */
    async goUnreachable() {
      await new Promise((r) => { server.close(r); server.closeAllConnections?.() })
    },
  }
}

/** Temp 505-private style credential store carrying the sentinel secret. */
async function sentinelCredentialStore(t, extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acb-onboard-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'agent-credentials.json')
  await writeFile(file, JSON.stringify({
    version: 1,
    credentials: {
      agt_hr: { clientId: SENTINEL_CLIENT_ID, clientSecret: SENTINEL_CLIENT_SECRET },
      ...extra,
    },
  }, null, 2))
  return file
}

/**
 * The onboarding rig: REAL Agent Definition config (agt_a default + agt_b) +
 * read model + access handlers wired through localHandlerResolver — the same
 * production wiring as broker/src/index.js gateway mode — plus the parent log
 * sink captured for the sentinel scan.
 */
async function onboardingRig(t, { credentialsFile, authServiceOrigin }) {
  const dir = await mkdtemp(join(tmpdir(), 'acb-onboard-def-'))
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
  const parentLog = []
  const gateway = createBrokerGateway({
    manifests: agentDefinitionManifests,
    targets: [],
    authServiceOrigin,
    credentialsFile,
    localHandlerResolver: () => createDefinitionAccessHandlers({ configFile, definition }),
    log: (msg) => parentLog.push(String(msg)),
  })
  return {
    gateway,
    definition,
    configFile,
    parentLog,
    /** Byte snapshot of the persisted config (untouched assertions). */
    configBytes: () => readFile(configFile, 'utf8'),
  }
}

const create = (args) => ({ capabilityId: 'agent.definition.write', operation: 'create', args })
const listAll = () => ({ capabilityId: 'agent.definition.read', operation: 'list', args: {} })

test('onboarding entry success: create lands, read model refreshes, and the next stage sees a defined+enabled agent whose own broker surface still fails closed', async (t) => {
  const auth = await fakeAuthService(t, { grantedClientIds: [SENTINEL_CLIENT_ID] })
  const store = await sentinelCredentialStore(t)
  const rig = await onboardingRig(t, { credentialsFile: store, authServiceOrigin: `http://127.0.0.1:${auth.port}` })

  // THE entry call, exactly as the HR session's relay delivers it.
  const created = await rig.gateway.execute(create({ name: 'New Hire 2026', description: 'hired by HR' }), { agentId: 'agt_hr' })
  assert.equal(created.ok, true, JSON.stringify(created))
  const cid = created.result.agent.id
  assert.ok(cid.startsWith('agt_'), `stable opaque id minted, got ${cid}`)
  assert.equal(created.result.agent.disabled, false)
  assert.equal(created.result.agent.name, 'New Hire 2026')

  // Persisted under the single authority (a FRESH read model over the file).
  const onDisk = new AgentDefinition({ configFile: rig.configFile })
  assert.equal(onDisk.getAgent(cid).name, 'New Hire 2026')

  // In-process read model refreshed without a restart; id AND name resolve.
  assert.equal(rig.definition.resolveAgentRef(cid).id, cid)
  assert.equal(rig.definition.resolveAgentRef('New Hire 2026').id, cid)

  // Next stage (router admission semantics): defined AND enabled -> the new
  // hire is spawn-eligible (assertRunnable would pass; first group contact
  // still binds the DEFAULT agent — pinned by agent-router router.test.js).
  assert.equal(rig.definition.getAgent(cid).disabled, false)

  // But the new hire's OWN first broker call fails CLOSED: no credential is
  // bound yet -> credential_unavailable, and the token endpoint is NEVER
  // contacted for the new hire (zero external calls added by the next stage).
  const asNewHire = await rig.gateway.execute(listAll(), { agentId: cid })
  assert.equal(asNewHire.ok, false)
  assert.equal(asNewHire.error.code, 'credential_unavailable')
  assert.equal(auth.requests.length, 1, 'only the HR grant check hit the token endpoint; the new hire added zero external calls')
})

test('onboarding entry duplicate: same-name create is NOT deduped at this entry — a second stable id mints, name resolution keeps the first, and the grant is re-checked per call', async (t) => {
  const auth = await fakeAuthService(t, { grantedClientIds: [SENTINEL_CLIENT_ID] })
  const store = await sentinelCredentialStore(t)
  const rig = await onboardingRig(t, { credentialsFile: store, authServiceOrigin: `http://127.0.0.1:${auth.port}` })

  const first = await rig.gateway.execute(create({ name: 'Dup Hire' }), { agentId: 'agt_hr' })
  assert.equal(first.ok, true, JSON.stringify(first))
  const second = await rig.gateway.execute(create({ name: 'Dup Hire' }), { agentId: 'agt_hr' })
  assert.equal(second.ok, true, JSON.stringify(second))

  assert.notEqual(second.result.agent.id, first.result.agent.id, 'each create mints its own stable id (no dedupe at this entry)')
  const names = rig.definition.listAgents().filter((a) => a.name === 'Dup Hire')
  assert.equal(names.length, 2, 'both rows persisted')

  // Name resolution is config-order FIRST match — the FIRST hire keeps the
  // name; a retry can never silently hijack an existing identity.
  assert.equal(rig.definition.resolveAgentRef('Dup Hire').id, first.result.agent.id)

  // The local grant check is UNCACHED: one token POST per call (HTTP
  // capabilities cache per agent; the local path re-proves the grant).
  assert.equal(auth.requests.length, 2)
})

test('onboarding entry rejection: caller without the grant is denied BEFORE the handler — config byte-identical, no state change', async (t) => {
  const auth = await fakeAuthService(t, { grantedClientIds: [SENTINEL_CLIENT_ID] }) // agt_a's client is not granted
  const store = await sentinelCredentialStore(t, { agt_a: { clientId: 'sentinel-a-clientId', clientSecret: 'sentinel-a-clientSecret' } })
  const rig = await onboardingRig(t, { credentialsFile: store, authServiceOrigin: `http://127.0.0.1:${auth.port}` })
  const before = await rig.configBytes()
  const countBefore = rig.definition.listAgents().length

  const out = await rig.gateway.execute(create({ name: 'Should Not Land' }), { agentId: 'agt_a' })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'access_denied')
  assert.equal(rig.definition.listAgents().length, countBefore, 'handler never ran')
  assert.equal(await rig.configBytes(), before, 'config byte-identical after denial')
  assert.equal(auth.requests.length, 1, 'the denied grant check happened exactly once; nothing else was externalized')
})

test('onboarding entry UNKNOWN: auth-service unreachable or 5xx fails CLOSED access_denied with the fixed detail — never a success envelope, config untouched', async (t) => {
  // (a) authority unreachable (server gone) — the UNKNOWN case at the grant check.
  const authDown = await fakeAuthService(t, { grantedClientIds: [SENTINEL_CLIENT_ID] })
  const storeDown = await sentinelCredentialStore(t)
  const rigDown = await onboardingRig(t, { credentialsFile: storeDown, authServiceOrigin: `http://127.0.0.1:${authDown.port}` })
  await authDown.goUnreachable()
  const bytesDownBefore = await rigDown.configBytes()
  const outDown = await rigDown.gateway.execute(create({ name: 'Unknown Authority Hire' }), { agentId: 'agt_hr' })
  assert.equal(outDown.ok, false)
  assert.equal(outDown.error.code, 'access_denied', 'UNKNOWN at the grant check fails closed (never wrapped as working)')
  assert.equal(outDown.error.detail, 'grant for agent.definition.write not available to this agent', 'FIXED detail: no upstream-body echo')
  assert.equal(await rigDown.configBytes(), bytesDownBefore)

  // (b) authority answering 5xx — same UNKNOWN family, same fail-closed shape.
  const auth5xx = await fakeAuthService(t, { grantedClientIds: [] })
  auth5xx.setRespond((_clientId, _req, res) => {
    res.writeHead(503, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'temporarily_unavailable' }))
  })
  const store5xx = await sentinelCredentialStore(t)
  const rig5xx = await onboardingRig(t, { credentialsFile: store5xx, authServiceOrigin: `http://127.0.0.1:${auth5xx.port}` })
  const bytes5xxBefore = await rig5xx.configBytes()
  const out5xx = await rig5xx.gateway.execute(create({ name: 'Unknown 5xx Hire' }), { agentId: 'agt_hr' })
  assert.equal(out5xx.ok, false)
  assert.equal(out5xx.error.code, 'access_denied')
  assert.equal(out5xx.error.detail, 'grant for agent.definition.write not available to this agent')
  assert.equal(await rig5xx.configBytes(), bytes5xxBefore)
})

test('onboarding entry secrets: the credential sentinel never appears in any returned envelope or parent log line', async (t) => {
  const auth = await fakeAuthService(t, { grantedClientIds: [SENTINEL_CLIENT_ID] })
  const store = await sentinelCredentialStore(t, { agt_a: { clientId: 'sentinel-a-clientId', clientSecret: 'sentinel-a-clientSecret' } })
  const rig = await onboardingRig(t, { credentialsFile: store, authServiceOrigin: `http://127.0.0.1:${auth.port}` })

  const envelopes = []
  envelopes.push(await rig.gateway.execute(create({ name: 'Secret Scan Hire' }), { agentId: 'agt_hr' }))
  envelopes.push(await rig.gateway.execute(create({ name: 'Secret Scan Hire' }), { agentId: 'agt_a' })) // denied
  envelopes.push(await rig.gateway.execute(listAll(), { agentId: 'agt_hr' }))
  envelopes.push(await rig.gateway.execute(
    { capabilityId: 'agent.definition.nope', operation: 'list', args: {} }, { agentId: 'agt_hr' },
  ))

  for (const [i, envelope] of envelopes.entries()) {
    const wire = JSON.stringify(envelope)
    assert.ok(!wire.includes(SENTINEL_CLIENT_SECRET), `envelope ${i} leaks the client secret`)
    assert.ok(!wire.includes('sentinel-a-clientSecret'), `envelope ${i} leaks a store secret`)
    assert.ok(!wire.includes(TOKEN_ENDPOINT_PATH), `envelope ${i} echoes the authority endpoint`)
  }
  for (const [i, line] of rig.parentLog.entries()) {
    assert.ok(!line.includes(SENTINEL_CLIENT_SECRET), `parent log ${i} leaks the client secret`)
  }
  // The fake authority saw the secret exactly where the protocol puts it
  // (Basic auth of the GRANT CHECK), never in a business envelope.
  assert.ok(auth.requests.every((r) => r.clientSecret === SENTINEL_CLIENT_SECRET || r.clientSecret === 'sentinel-a-clientSecret'))
})
