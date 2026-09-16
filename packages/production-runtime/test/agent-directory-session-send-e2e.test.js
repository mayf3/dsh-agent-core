/**
 * AGENT_CORE_AGENT_DIRECTORY_TOOL_V1 — ACC-ADT-005 composed-runtime E2E:
 *
 *   caller knows ONLY the target's human-readable display name
 *     → agent_directory.resolve (REAL broker gateway + REAL trusted
 *       agentDirectoryAccess provider through the REAL parent-RPC relay)
 *     → canonical agentId from the tool result
 *     → agent_session_send(targetAgentId = that id) (REAL trusted ASM
 *       provider + REAL router admission chain)
 *     → the target process receives exactly one prompt in its main
 *
 * The caller-side fixture contains NO agt_* literal anywhere — the id
 * enters the send args ONLY as `resolved.result.agent.agentId`. A
 * not_found query and a whitespace query produce ZERO deliveries, and a
 * disabled target resolves enabled:false and the send is refused
 * (target_disabled). Deterministic: no model, no sleeps, no network
 * beyond a 127.0.0.1 stub auth-service.
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
import { agentDirectoryManifest } from '../../broker/src/capabilities/agent-directory.js'
import { invoke } from '../../broker/src/mapping.js'
import { createRelayHandlers } from '../../broker/src/relay.js'
import { createSessionSeam } from '../../demo-server/src/session-seam.js'
import { composeProductionRuntime } from '../src/compose.js'
import { resolveProductionLayout } from '../src/paths.js'

const SOURCE = 'agt_dir-e2e-source-agent'
const TARGET = 'agt_dir-e2e-target-agent'
const TARGET_NAME = '文章发布管家'
const PROOF = 'turn:9:src:g1:s7'

/** The ONLY fact the caller starts with — no UUID, ever. */
const CALLER_KNOWLEDGE = { targetDisplayName: TARGET_NAME }

const silentLog = { log() {}, warn() {}, error() {} }

let pidSeq = 9000

/** Fake per-agent DSH process (compose contract + delivery capture). */
class FakeProc {
  constructor({ agentId, log }) {
    this.agentId = agentId
    this.pid = ++pidSeq
    this.log = log
    this.home = `/tmp/dir-e2e-home-${agentId}`
    this.workspace = `/tmp/dir-e2e-ws-${agentId}`
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

async function seedRuntime(t, { targetDisabled = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'dir-e2e-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: targetDisabled ? SOURCE : TARGET,
    agents: [
      { id: TARGET, name: TARGET_NAME, disabled: targetDisabled },
      { id: SOURCE, name: 'Directory E2E Source' },
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
  const { server, origin } = await stubAuthServer('grant')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const spawned = []
  const runtime = await composeProductionRuntime({
    layout,
    log: silentLog,
    // Test seam (same as main's ASM integration suite): an explicit global
    // route keeps the composed default-route resolution (Luna chain, pinned
    // artifact validation) out of this directory-focused E2E.
    globalRoute: Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' }),
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
  return { runtime, spawned }
}

/** Call any capability as the SOURCE child through the REAL parent-RPC →
 *  REAL gateway → REAL local provider chain (the child-relay wire shape). */
async function childCall(runtime, { capabilityId, manifest, operation, args }) {
  const sourceProc = {
    agentId: SOURCE,
    processGeneration: 1,
    executions: new Map([[PROOF, { settled: false }]]),
    activeIngressContext: undefined,
  }
  const parentHandler = createParentRpcHandler({
    agentId: SOURCE,
    log: silentLog,
    getProc: () => sourceProc,
    getBrokerGateway: () => runtime.ctx.get('brokerGateway'),
    switchAgent: async () => ({}),
  })
  const relayHandlers = createRelayHandlers(
    manifest,
    async (call) => ({
      ok: true,
      result: await parentHandler(BROKER_RPC_METHOD, call, { turnExecutionId: PROOF }),
    }),
  )
  return invoke(manifest, relayHandlers, { operation, args }, { resolvePrincipal: () => undefined })
}

test('ACC-ADT-005: name-only caller discovers the canonical id and the send lands in the target main', async (t) => {
  assert.equal(JSON.stringify(CALLER_KNOWLEDGE).includes('agt_'), false, 'the caller fixture carries NO UUID')
  const { runtime, spawned } = await seedRuntime(t)

  // 1. Discovery: the caller knows ONLY the display name.
  const lookup = await childCall(runtime, {
    capabilityId: 'agent.directory',
    manifest: agentDirectoryManifest,
    operation: 'resolve',
    args: { query: CALLER_KNOWLEDGE.targetDisplayName },
  })
  assert.deepEqual([lookup.ok, lookup.result.status], [true, 'resolved'])
  const canonicalId = lookup.result.agent.agentId
  assert.equal(canonicalId, TARGET, 'the directory returned the canonical agent_id')
  assert.equal(lookup.result.agent.enabled, true)
  assert.equal(JSON.stringify(CALLER_KNOWLEDGE).includes(canonicalId), false, 'the id came from the tool, not the fixture')

  // 2. Downstream: pass the returned id VERBATIM as targetAgentId.
  const send = await childCall(runtime, {
    capabilityId: 'agent_session_send',
    manifest: agentSessionMessagingManifest,
    operation: 'send',
    args: { targetAgentId: canonicalId, message: '请开始今天的文章发布流程', timeoutSeconds: 0 },
  })
  assert.equal(send.ok, true)
  assert.equal(send.result.status, 'accepted')
  assert.equal(send.result.targetAgentId, canonicalId, 'the receipt echoes the exact directory-resolved id')
  assert.equal(send.result.sessionId, 'main')

  // 3. The target REALLY received it: one delivery in the canonical main,
  //    admitted as a genuine inter_agent turn.
  const target = spawned.find((p) => p.agentId === TARGET)
  assert.notEqual(target, undefined, 'the target process was established')
  assert.equal(target.deliveries.length, 1)
  assert.equal(target.deliveries[0].sessionId, 'main')
  assert.equal(target.deliveries[0].text, '请开始今天的文章发布流程')
  assert.deepEqual(target.deliveries[0].opts.messageOrigin, {
    kind: 'inter_agent',
    sourceAgentId: SOURCE,
    correlation: PROOF,
  })
  assert.equal(target.sessionMessages.length, 1, 'the real session seam accepted exactly one prompt')
})

test('E2E negative: unknown name → not_found and ZERO deliveries anywhere', async (t) => {
  const { runtime, spawned } = await seedRuntime(t)
  const lookup = await childCall(runtime, {
    capabilityId: 'agent.directory',
    manifest: agentDirectoryManifest,
    operation: 'resolve',
    args: { query: '不存在的管家' },
  })
  assert.deepEqual(lookup, { ok: true, result: { status: 'not_found', query: '不存在的管家' } })
  assert.equal(spawned.filter((p) => p.agentId === TARGET).length, 0, 'no target process was ever established')
  for (const proc of spawned) assert.equal(proc.deliveries.length, 0)
})

test('E2E negative: whitespace-only query → invalid_arguments envelope, ZERO deliveries', async (t) => {
  const { runtime, spawned } = await seedRuntime(t)
  const lookup = await childCall(runtime, {
    capabilityId: 'agent.directory',
    manifest: agentDirectoryManifest,
    operation: 'resolve',
    args: { query: '   ' },
  })
  assert.deepEqual([lookup.ok, lookup.error?.code], [false, 'invalid_arguments'])
  for (const proc of spawned) assert.equal(proc.deliveries.length, 0)
})

test('E2E disabled target: resolves enabled:false (existence truth) and the send is refused', async (t) => {
  const { runtime, spawned } = await seedRuntime(t, { targetDisabled: true })
  const lookup = await childCall(runtime, {
    capabilityId: 'agent.directory',
    manifest: agentDirectoryManifest,
    operation: 'resolve',
    args: { query: CALLER_KNOWLEDGE.targetDisplayName },
  })
  assert.deepEqual([lookup.ok, lookup.result.status], [true, 'resolved'])
  assert.equal(lookup.result.agent.agentId, TARGET)
  assert.equal(lookup.result.agent.enabled, false, 'the directory reports disabled EXPLICITLY, never as not_found')

  const send = await childCall(runtime, {
    capabilityId: 'agent_session_send',
    manifest: agentSessionMessagingManifest,
    operation: 'send',
    args: { targetAgentId: lookup.result.agent.agentId, message: 'should not land', timeoutSeconds: 0 },
  })
  assert.equal(send.ok, false)
  assert.equal(send.error.code, 'target_disabled', 'the downstream surface refuses a disabled target')
  assert.equal(spawned.filter((p) => p.agentId === TARGET).length, 0, 'zero target processes for a disabled target')
})

test('E2E list: the full composed stack lists both agents in directory shape', async (t) => {
  const { runtime } = await seedRuntime(t)
  const listing = await childCall(runtime, {
    capabilityId: 'agent.directory',
    manifest: agentDirectoryManifest,
    operation: 'list',
    args: {},
  })
  assert.equal(listing.ok, true)
  assert.deepEqual(listing.result.agents.map((a) => [a.agentId, a.enabled]), [
    [TARGET, true],
    [SOURCE, true],
  ])
})
