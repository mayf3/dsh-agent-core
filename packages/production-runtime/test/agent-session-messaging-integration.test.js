/**
 * AGENT_CORE_AGENT_SESSION_MESSAGING_V1 — LOCAL A2A integration tests over
 * the composed production runtime (composeProductionRuntime + the REAL
 * broker gateway, REAL trusted provider, REAL router admission chain and a
 * fake per-agent DSH process; a stub auth-service decides grants):
 *
 *   Case A  existing B main is reused — same process, same session, one new
 *           Run per send (two sends = two deliveries, no respawn)
 *   Case B  absent B main is established on the first send; concurrent first
 *           sends share ONE process startup generation
 *   Case C  timeoutSeconds=0 returns {status:'accepted'} on the real receipt
 *   Case F  an unauthorized sender gets access_denied with ZERO target
 *           deliveries; a grant-check transport outage surfaces as
 *           transport_failure (never mislabeled access_denied — F23)
 *   Case G  the durable provenance sidecar is runtime-owned: kind =
 *           inter_agent, sourceAgentId = actual A, correlation = the exact
 *           proof; forbidden model fields are rejected before anything
 *   R12     the L0/L1 audit surface records denial / intent / outcome rows
 *           in the production control dir
 *
 * Deterministic: no model, no sleeps, no network beyond 127.0.0.1.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { createParentRpcHandler, BROKER_RPC_METHOD } from '../../agent-router/src/parent-rpc-relay.js'
import { agentSessionMessagingManifest } from '../../broker/src/capabilities/agent-session-messaging.js'
import { invoke } from '../../broker/src/mapping.js'
import { createRelayHandlers } from '../../broker/src/relay.js'
import { createSessionSeam } from '../../demo-server/src/session-seam.js'
import { composeProductionRuntime } from '../src/compose.js'
import { resolveProductionLayout } from '../src/paths.js'

const SOURCE = 'agt_stock_agent'
const TARGET = 'agt_a2a-target-agent'
const PROOF = 'turn:9:src:g1:s7'

const silentLog = { log() {}, warn() {}, error() {} }

let pidSeq = 7000

/** Fake per-agent DSH process (compose contract + delivery capture). */
class FakeProc {
  constructor({ agentId, log }) {
    this.agentId = agentId
    this.pid = ++pidSeq
    this.log = log
    this.home = `/tmp/a2a-home-${agentId}`
    this.workspace = `/tmp/a2a-ws-${agentId}`
    this.profile = 'fake-profile'
    this.exit = undefined
    this.exitResolve = undefined
    this.exitPromise = new Promise((resolve) => { this.exitResolve = resolve })
    this.deliveries = []
    this.turns = []
    this.sessionMessages = []
    this.persistedHeaders = []
    const handlesById = new Map()
    const persistence = { list: async () => this.persistedHeaders.map((header) => ({ ...header })) }
    const agents = {
      create: async ({ sessionId, meta }) => {
        const key = String(sessionId)
        const handle = {
          agent: {
            session: { header: { id: sessionId, cwd: meta.cwd }, seq: 0 },
            followup: (message) => {
              handle.agent.session.seq += 1
              this.sessionMessages.push({ sessionId: key, message })
            },
          },
        }
        handlesById.set(key, handle)
        this.persistedHeaders.push(handle.agent.session.header)
        return handle
      },
      resume: async ({ resumeSessionId }) => handlesById.get(String(resumeSessionId)),
    }
    const services = new Map([
      ['loader', { await: async () => {} }],
      ['agentLoop', {}],
      ['sessionPersistence', persistence],
      ['agents', agents],
    ])
    this.sessionSeam = createSessionSeam({
      ctx: { get: (name) => services.get(name) },
      settings: { cwd: this.workspace, provider: 'fake', model: 'fake-model' },
    })
  }

  spawn() {}

  async ready() { return 1 }

  async deliver(sessionId, text, opts = {}) {
    this.deliveries.push({ sessionId, text, opts })
    const promptReceipt = await this.sessionSeam.prompt(
      sessionId,
      [{ type: 'text', text }],
      opts.cwd,
      opts.messageOrigin,
    )
    return {
      accepted: true,
      sessionId,
      messageId: promptReceipt.messageId,
      reconciliationHandle: `turn:fake-${this.agentId}-${this.deliveries.length}`,
      evidence: { promptReceipt: 'accepted' },
    }
  }

  async turn(sessionId, text, opts = {}) {
    this.turns.push({ sessionId, text, opts })
    return {
      reply: `TURNED:${text}`, ms: 1, promptMs: 1, messageId: `m${this.turns.length}`,
      reconciliationHandle: `turn:scheduled-${this.agentId}-${this.turns.length}`,
      evidence: { terminationEvidence: 'exact_terminal_then_idle' },
    }
  }

  async shutdown() {
    if (this.exit === undefined) {
      this.exit = { code: 0, signal: null }
      this.exitResolve?.(this.exit)
    }
    return this.exit
  }

  kill() {
    this.exit = { code: 9, signal: 'SIGKILL' }
    this.exitResolve?.({ code: 9, signal: 'SIGKILL' })
  }
}

/** Stub auth-service: grant (200) / deny (403 insufficient_scope). */
function stubAuthServer(mode) {
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json')
      if (mode === 'deny') {
        res.statusCode = 403
        res.end(JSON.stringify({ error: 'insufficient_scope' }))
        return
      }
      res.statusCode = 200
      res.end(JSON.stringify({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }))
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }))
  })
}

async function seedRuntime(t, { authMode = 'grant', targetDisabled = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'a2a-int-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: targetDisabled ? SOURCE : TARGET,
    agents: [
      { id: TARGET, name: 'A2A Target', disabled: targetDisabled },
      { id: SOURCE, name: 'A2A Source' },
    ],
  })
  const credentialsFile = join(root, 'credentials-store.json')
  writeFileSync(credentialsFile, `${JSON.stringify({
    version: 1,
    credentials: {
      [SOURCE]: { clientId: 'client-source', clientSecret: 'source-secret' },
      [TARGET]: { clientId: 'client-target', clientSecret: 'target-secret' },
    },
  }, null, 2)}\n`)
  const { server, origin } = await stubAuthServer(authMode)
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const spawned = []
  const runtime = await composeProductionRuntime({
    layout,
    log: silentLog,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false },
    broker: { credentialsFile, authServiceOrigin: origin },
    processFactory: (opts) => {
      const proc = new FakeProc(opts)
      spawned.push(proc)
      return proc
    },
  })
  t.after(() => runtime.stop())
  const auditFile = join(layout.controlDir, 'agent-session-messaging-audit.jsonl')
  return { runtime, spawned, auditFile, authOrigin: origin }
}

function gatewayCall(runtime, { agentId, sourceTurnExecutionId, args }) {
  const sourceProc = {
    agentId,
    processGeneration: 1,
    executions: new Map([[sourceTurnExecutionId, { settled: false }]]),
    activeIngressContext: undefined,
  }
  const parentHandler = createParentRpcHandler({
    agentId,
    log: silentLog,
    getProc: () => sourceProc,
    getBrokerGateway: () => runtime.ctx.get('brokerGateway'),
    switchAgent: async () => ({}),
  })
  const relayHandlers = createRelayHandlers(
    agentSessionMessagingManifest,
    (call) => parentHandler(BROKER_RPC_METHOD, call, { turnExecutionId: sourceTurnExecutionId }),
  )
  return invoke(
    agentSessionMessagingManifest,
    relayHandlers,
    { operation: 'send', args },
    { resolvePrincipal: () => undefined },
  )
}

const SEND = { targetAgentId: TARGET, message: 'coordination hello', timeoutSeconds: 0 }

test('Case C + G: receipt-only accepted; the provenance sidecar is runtime-owned and exact', async (t) => {
  const { runtime, spawned, auditFile } = await seedRuntime(t)
  const envelope = await gatewayCall(runtime, { agentId: SOURCE, sourceTurnExecutionId: PROOF, args: SEND })
  assert.deepEqual(envelope, { ok: true, result: { status: 'accepted' } })
  const target = spawned.find((p) => p.agentId === TARGET)
  assert.notEqual(target, undefined, 'the target process was established')
  assert.equal(target.deliveries.length, 1)
  const delivery = target.deliveries[0]
  assert.equal(delivery.sessionId, 'main', 'the delivery enters the canonical main')
  assert.equal(delivery.text, 'coordination hello')
  assert.deepEqual(delivery.opts.messageOrigin, {
    kind: 'inter_agent',
    sourceAgentId: SOURCE,
    correlation: PROOF,
  })
  assert.equal(target.sessionMessages.length, 1, 'the real session seam accepted exactly one prompt')
  assert.deepEqual(target.sessionMessages[0].message.source, {
    kind: 'inter_agent', sourceAgentId: SOURCE, correlation: PROOF,
  })
  const rows = readFileSync(auditFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.deepEqual(rows.map((r) => r.phase), ['intent', 'outcome'])
  assert.equal(rows[0].sourceAgentId, SOURCE)
  assert.equal(rows[0].targetAgentId, TARGET)
  assert.equal(rows[1].result, 'accepted')
  assert.ok(rows[0].correlationHash !== PROOF, 'the audit carries a bounded correlation hash, never the raw id')
})

test('Case A: the existing main is reused — same process, two sends, two Runs', async (t) => {
  const { runtime, spawned } = await seedRuntime(t)
  const first = await gatewayCall(runtime, { agentId: SOURCE, sourceTurnExecutionId: PROOF, args: SEND })
  const second = await gatewayCall(runtime, {
    agentId: SOURCE,
    sourceTurnExecutionId: 'turn:9:src:g1:s8',
    args: { ...SEND, message: 'second message' },
  })
  assert.deepEqual(first.result, { status: 'accepted' })
  assert.deepEqual(second.result, { status: 'accepted' })
  const targetProcs = spawned.filter((p) => p.agentId === TARGET)
  assert.equal(targetProcs.length, 1, 'no second process for the same target main')
  assert.equal(targetProcs[0].deliveries.length, 2, 'two sends = two ordered Runs in one main')
  const requestIds = targetProcs[0].deliveries.map((d) => d.opts?.callerCorrelation?.requestId)
  assert.notEqual(requestIds[0], requestIds[1], 'each send carries a fresh runtime requestId (no dedupe)')
})

test('Case B: concurrent first sends to an absent main share ONE startup generation', async (t) => {
  const { runtime, spawned } = await seedRuntime(t)
  const [first, second] = await Promise.all([
    gatewayCall(runtime, { agentId: SOURCE, sourceTurnExecutionId: PROOF, args: SEND }),
    gatewayCall(runtime, {
      agentId: SOURCE,
      sourceTurnExecutionId: 'turn:9:src:g1:s9',
      args: { ...SEND, message: 'parallel hello' },
    }),
  ])
  assert.deepEqual(first.result, { status: 'accepted' })
  assert.deepEqual(second.result, { status: 'accepted' })
  const targetProcs = spawned.filter((p) => p.agentId === TARGET)
  assert.equal(targetProcs.length, 1, 'exactly one B process startup generation')
  assert.equal(targetProcs[0].deliveries.length, 2, 'every accepted send is a distinct ordered Run')
})

test('Case F: an unauthorized sender is access_denied with zero target deliveries', async (t) => {
  // The credential store lacks the source agent → the gateway fails closed
  // BEFORE the local handler (credential_unavailable L0 territory); a real
  // grant denial needs a 403 insufficient_scope from the auth-service.
  const { runtime, spawned, auditFile } = await seedRuntime(t, { authMode: 'deny' })
  const envelope = await gatewayCall(runtime, { agentId: SOURCE, sourceTurnExecutionId: PROOF, args: SEND })
  assert.equal(envelope.ok, false)
  assert.equal(envelope.error.code, 'access_denied', 'a 403 insufficient_scope grant denial is access_denied')
  assert.equal(spawned.filter((p) => p.agentId === TARGET).length, 0, 'zero target deliveries for a denied sender')
  const rows = existsSync(auditFile)
    ? readFileSync(auditFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    : []
  const denial = rows.find((r) => r.phase === 'denial')
  assert.notEqual(denial, undefined, 'the L0 denial row is recorded')
  assert.equal(denial.sourceAgentId, SOURCE)
  assert.equal(denial.code, 'access_denied')
})

test('Case F (F23): a grant-check transport outage is transport_failure, never access_denied', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'a2a-tf-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: TARGET,
    agents: [{ id: TARGET, name: 'A2A Target' }, { id: SOURCE, name: 'A2A Source' }],
  })
  const credentialsFile = join(root, 'credentials-store.json')
  writeFileSync(credentialsFile, `${JSON.stringify({
    version: 1,
    credentials: { [SOURCE]: { clientId: 'c', clientSecret: 's' } },
  }, null, 2)}\n`)
  const spawned = []
  // Port 9 (discard) refuses fast → the auth transport fails BEFORE any handler.
  const runtime = await composeProductionRuntime({
    layout,
    log: silentLog,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false },
    broker: { credentialsFile, authServiceOrigin: 'http://127.0.0.1:9' },
    processFactory: (opts) => { const proc = new FakeProc(opts); spawned.push(proc); return proc },
  })
  t.after(() => runtime.stop())
  const envelope = await runtime.ctx.get('brokerGateway').execute(
    { capabilityId: 'agent_session_send', operation: 'send', args: SEND },
    { agentId: SOURCE, sourceTurnExecutionId: PROOF },
  )
  assert.equal(envelope.ok, false)
  assert.equal(envelope.error.code, 'transport_failure')
  assert.notEqual(envelope.error.code, 'access_denied')
  assert.equal(spawned.filter((p) => p.agentId === TARGET).length, 0)
})

test('disabled target is target_disabled with zero target process or prompt', async (t) => {
  const { runtime, spawned } = await seedRuntime(t, { targetDisabled: true })
  const envelope = await gatewayCall(runtime, { agentId: SOURCE, sourceTurnExecutionId: PROOF, args: SEND })
  assert.equal(envelope.ok, false)
  assert.equal(envelope.error.code, 'target_disabled')
  assert.equal(spawned.filter((p) => p.agentId === TARGET).length, 0)
})

test('Case G: model-supplied identity fields are rejected before any delivery', async (t) => {
  const { runtime, spawned } = await seedRuntime(t)
  const forged = await gatewayCall(runtime, {
    agentId: SOURCE,
    sourceTurnExecutionId: PROOF,
    args: { ...SEND, sourceAgentId: 'agt_forged-identity', sessionId: 'other-session' },
  })
  assert.equal(forged.ok, false)
  assert.equal(forged.error.code, 'invalid_arguments')
  assert.equal(spawned.filter((p) => p.agentId === TARGET).length, 0, 'zero deliveries for forged calls')
})

test('R12: L0 rows never carry business detail; the target reply never reaches the audit file', async (t) => {
  const { runtime, auditFile } = await seedRuntime(t)
  await gatewayCall(runtime, { agentId: SOURCE, sourceTurnExecutionId: PROOF, args: SEND })
  const raw = readFileSync(auditFile, 'utf8')
  assert.ok(!raw.includes('coordination hello'), 'the message text never enters the audit surface')
  assert.ok(!raw.includes(PROOF), 'the raw source correlation never enters the audit surface')
})
