import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeAgentDefinition } from '../../../agent-definition/src/config.js'
import { createParentRpcHandler, BROKER_RPC_METHOD } from '../../../agent-router/src/parent-rpc-relay.js'
import { agentSessionDispatchStatusManifest } from '../../../broker/src/capabilities/agent-session-messaging.js'
import { createRelayHandlers } from '../../../broker/src/relay.js'
import { invoke } from '../../../broker/src/mapping.js'
import { composeProductionRuntime } from '../../src/compose.js'
import { resolveProductionLayout } from '../../src/paths.js'
import { locateSessionArtifact } from '../../src/agent-session/turn-inspection.js'
import { auditRow, records, writeJsonl } from './fixtures/status-rig.js'

const SOURCE = 'agt_status-source'
const FOREIGN = 'agt_status-foreign'
const TARGET = 'agt_status-target'
const TRACE = { targetAgentId: TARGET, sessionId: 'main', messageId: 'm-status-owned' }
const PROOF = 'turn:status:source:g1:s1'
const log = { log() {}, warn() {}, error() {} }

async function rig(t, { deny = false, authFailure = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'status-integration-'))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, { defaultAgentId: SOURCE,
    agents: [SOURCE, TARGET, FOREIGN].map(id => ({ id, name: id })) })
  const credentialsFile = join(root, 'synthetic-credentials.json')
  writeFileSync(credentialsFile, JSON.stringify({ version: 1, credentials: Object.fromEntries(
    [SOURCE, TARGET, FOREIGN].map(id => [id, { clientId: 'fixture-' + id, clientSecret: 'synthetic-not-a-real-secret' }])) }))
  const authCalls = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const form = new URLSearchParams(body)
      authCalls.push({ resource: form.get('resource'), scope: form.get('scope') })
      if (authFailure) { req.socket.destroy(); return }
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = deny ? 403 : 200
      res.end(JSON.stringify(deny ? { error: 'insufficient_scope' } : { access_token: 'synthetic-token', token_type: 'Bearer', expires_in: 3600 }))
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let spawned = 0
  const runtime = await composeProductionRuntime({
    globalRoute: { provider: 'oc-go', model: 'deepseek-v4-flash' }, layout, log,
    productApi: { enabled: false, port: 0 }, notificationIngress: { enabled: false },
    broker: { credentialsFile, authServiceOrigin: `http://127.0.0.1:${server.address().port}` },
    processFactory() { spawned += 1; throw new Error('status must not start a target') },
  })
  t.after(async () => { await runtime.stop(); await new Promise(resolve => server.close(resolve)); rmSync(root, { recursive: true, force: true }) })
  const bootstrap = runtime.ctx.get('workspaceBootstrap')
  const cwd = bootstrap.resolveWorkspace(TARGET)
  const artifact = locateSessionArtifact({ dshHome: bootstrap.resolveDshHome(TARGET), canonicalWorkspace: cwd, sessionId: 'main' })
  const auditFile = join(layout.controlDir, 'agent-session-messaging-audit.jsonl')
  writeJsonl(auditFile, [auditRow({ sourceAgentId: SOURCE, ...TRACE })])
  function seed(options) {
    const native = records(options)
    native[0].cwd = cwd
    native[1].data.inserted[0].source.sourceAgentId = SOURCE
    if (native[3]) native[3].data.source.sourceAgentId = SOURCE
    writeJsonl(artifact, native)
  }
  seed()
  const handler = runtime.ctx.get('agentSessionMessagingAccess').handlers.agent_session_dispatch_status
  assert.equal(typeof handler?.status, 'function', 'real production composition must mount the capability')
  const original = handler.status
  let handlerCalls = 0
  handler.status = (...args) => { handlerCalls += 1; return original(...args) }
  const publicWire = []
  async function call(agentId = SOURCE, args = TRACE) {
    const proc = { agentId, processGeneration: 1, executions: new Map([[PROOF, { settled: false }]]) }
    const parent = createParentRpcHandler({ agentId, log, getProc: () => proc,
      getBrokerGateway: () => runtime.ctx.get('brokerGateway'), switchAgent: async () => ({}) })
    const manifest = agentSessionDispatchStatusManifest
    const relay = createRelayHandlers(manifest, async request => {
      const result = await parent(BROKER_RPC_METHOD, request, { turnExecutionId: PROOF })
      publicWire.push({ request, result })
      return { ok: true, result }
    })
    return invoke(manifest, relay, { operation: 'status', args }, { resolvePrincipal: () => undefined })
  }
  return { seed, call, auditFile, artifact, handler, authCalls, publicWire,
    counts: () => ({ spawned, handlerCalls }) }
}

test('ACC-013: real relay/parent/gateway/runtime reads pending and terminal with no target admission', async t => {
  const fx = await rig(t)
  const outcomes = []
  for (const [options, state, reply] of [[{ started: false }, 'accepted_not_started', 'pending'],
    [{ end: false }, 'running', 'pending'], [{}, 'completed', 'available'],
    [{ reason: { kind: 'aborted', reason: { kind: 'disposed' } } }, 'failed', 'not_successful']]) {
    fx.seed(options)
    const before = [readFileSync(fx.auditFile), readFileSync(fx.artifact)]
    const out = await fx.call()
    assert.equal(out.ok, true)
    assert.equal(out.result.turnState, state)
    assert.equal(out.result.reply.state, reply)
    assert.ok(Buffer.byteLength(JSON.stringify(out.result)) <= 4096)
    assert.deepEqual([readFileSync(fx.auditFile), readFileSync(fx.artifact)], before)
    outcomes.push(out)
  }
  assert.deepEqual(fx.counts(), { spawned: 0, handlerCalls: 4 })
  assert.ok(fx.authCalls.every(c => c.resource === 'agent-session-messaging' && c.scope === 'agent.session.inspect_own_dispatch'))
  assert.deepEqual(fx.publicWire.map(row => row.result), outcomes)
  assert.ok(fx.publicWire.every(row => Object.keys(row.request).join(',') === 'capabilityId,operation,args'))
  t.diagnostic(JSON.stringify({ fixture: 'synthetic-owned-native-trace', publicWire: fx.publicWire, counts: fx.counts() }))
})

test('ACC-009/013: a foreign actual caller cannot reuse another callers exact coordinate', async t => {
  const fx = await rig(t)
  const foreign = await fx.call(FOREIGN)
  const missing = await fx.call(SOURCE, { ...TRACE, messageId: 'missing' })
  assert.equal(foreign.error.code, 'not_found_or_not_owned')
  assert.deepEqual(foreign, missing)
  assert.equal(fx.counts().spawned, 0)
})

for (const [mode, code] of [[{ deny: true }, 'access_denied'], [{ authFailure: true }, 'transport_failure']]) {
  test(`ACC-008/013: ${code} never enters the actual reader`, async t => {
    const fx = await rig(t, mode)
    writeFileSync(fx.auditFile, 'not-valid-json\n')
    const out = await fx.call()
    assert.equal(out.error.code, code)
    assert.deepEqual(fx.counts(), { spawned: 0, handlerCalls: 0 })
  })
}

test('ACC-012/013: missing composed provider is unsupported and never falls back', async t => {
  const fx = await rig(t)
  delete fx.handler.status
  const out = await fx.call()
  assert.equal(out.error.code, 'unsupported_operation')
  assert.deepEqual(fx.counts(), { spawned: 0, handlerCalls: 0 })
})
