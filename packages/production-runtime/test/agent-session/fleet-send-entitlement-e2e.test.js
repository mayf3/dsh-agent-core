/**
 * AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1 (accepted r4) — ONE
 * cross-Agent TEST_IDENTITY E2E over the composed production runtime:
 * REAL broker gateway (credential + token entitlement gate), REAL trusted
 * ASM provider, REAL router admission/delivery chain, REAL AgentProcess
 * event correlation (fake stdio child, the process-lifecycle harness
 * pattern) and a stub auth-service implementing the accepted fleet grant
 * semantics (per-client MachineAccessGrant rows; auth-service is the ONLY
 * grant authority):
 *
 *   Lifecycle  a not-yet-materialized member is access_denied; the canonical
 *              fleet materialization (exactly one ['agent.session.send'] row,
 *              the reconcile/birth-stamp ADD shape) flips it to allowed with
 *              ZERO dsh-side change (no credentials/agents.json edit);
 *              deactivating the principal invalidates the entitlement
 *              (401 invalid_client → credential_invalid) while the grant row
 *              itself remains — deny is structural, never allowlist state;
 *   Identity   the send prompt carries the runtime-frozen inter_agent origin
 *              (sourceAgentId = actual caller; correlation = the proven
 *              source-turn proof) into the receiver's own process/workspace,
 *              and model-supplied identity fields are rejected before
 *              anything (R2 closure);
 *   Grants     the receiver's independently-authorized inspection scope is
 *              never gained by the sender: every LOCAL call requests exactly
 *              its manifest scope and the stub grants per row only;
 *   Receipt    L1 intent/outcome rows persist to the control-dir audit file,
 *              and after a FULL runtime restart a fresh instance resolves
 *              the caller-bound reconcile lookup from the same file chain
 *              (invocationCorrelation anchor + retained V2 coordinate);
 *   Reply      a bounded send settles 'replied' with the EXACT final
 *              assistant output of the target Run (REPLY_ASSOCIATION).
 *
 * Deterministic: no model, no network beyond 127.0.0.1; the only wall-clock
 * waits are bounded polls for the fake child's spawn/prompt lifecycle (the
 * real runtime spawns and readies the process through its own timers).
 * Runs under the pinned target runtime node version, like the rest of this
 * package's composed suites (composeProductionRuntime asserts it).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { writeAgentDefinition } from '../../../agent-definition/src/config.js'
import { createParentRpcHandler, BROKER_RPC_METHOD } from '../../../agent-router/src/parent-rpc-relay.js'
import { AgentProcess } from '../../../agent-router/src/process.js'
import {
  agentSessionMessagingManifest,
  agentSessionTurnInspectManifest,
} from '../../../broker/src/capabilities/agent-session-messaging.js'
import { agentSessionReconcileManifest } from '../../../broker/src/capabilities/agent-session-reconcile.js'
import { invoke } from '../../../broker/src/mapping.js'
import { createRelayHandlers } from '../../../broker/src/relay.js'
import { composeProductionRuntime } from '../../src/compose.js'
import { resolveProductionLayout } from '../../src/paths.js'

const SOURCE = 'agt_b9-source-agent'
const TARGET = 'agt_b9-target-agent'
const NEWBORN = 'agt_b9-newborn-agent'
const PROOF = 'turn:9:b9src:g1:s7'
const FLEET_AUDIENCE = 'agent-session-messaging'
const SEND_SCOPE = 'agent.session.send'
const INSPECT_SCOPE = 'agent.session.inspect_own_dispatch'

const silentLog = { log() {}, warn() {}, error() {} }

/** The historical builtin env route (see messaging-integration.test.js). */
const GLOBAL_ROUTE = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const tick = () => new Promise((resolve) => setImmediate(resolve))

// ─── Fleet-semantics stub auth-service ──────────────────────────────────────
// Mirrors the accepted v1.direct issuance semantics the fleet policy builds
// on: unknown/bad-secret → 401 invalid_client; inactive principal/client →
// 401 invalid_client ('client_or_principal_inactive'); missing grant scope →
// 403 insufficient_scope (machine_grant_missing); entitled → 200 token.
// Rows are the EXACT fleet materialization shape: scopes only.

function createFleetAuthStub(t, initialRows) {
  const rows = new Map(Object.entries(initialRows))
  const requests = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      const params = new URLSearchParams(body)
      const basic = Buffer.from((req.headers.authorization ?? '').replace(/^Basic /, ''), 'base64').toString('utf8')
      const [clientId, clientSecret] = basic.split(':')
      const scope = params.get('scope') ?? ''
      const record = { clientId, resource: params.get('resource'), scope, status: null }
      requests.push(record)
      res.setHeader('Content-Type', 'application/json')
      const respond = (statusCode, payload) => {
        record.status = statusCode
        res.statusCode = statusCode
        res.end(JSON.stringify(payload))
      }
      const row = rows.get(clientId)
      if (row === undefined || row.clientSecret !== clientSecret) {
        respond(401, { error: 'invalid_client', error_description: 'unknown client' })
        return
      }
      if (row.active !== true) {
        respond(401, { error: 'invalid_client', error_description: 'client_or_principal_inactive' })
        return
      }
      const wanted = scope.split(' ').filter((entry) => entry !== '')
      if (!wanted.every((entry) => row.scopes.includes(entry))) {
        respond(403, { error: 'insufficient_scope', error_description: 'machine_grant_missing' })
        return
      }
      respond(200, { access_token: 'b9-fleet-test-token', token_type: 'Bearer', expires_in: 3600 })
    })
  })
  t.after(() => new Promise((resolve) => server.close(resolve)))
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      origin: `http://127.0.0.1:${server.address().port}`,
      requests,
      rows,
      materializeFleetRow: (clientId, scopes) => {
        rows.set(clientId, { ...rows.get(clientId), scopes })
      },
      deactivatePrincipal: (clientId) => {
        rows.set(clientId, { ...rows.get(clientId), active: false })
      },
    }))
  })
}

// ─── Real AgentProcess over an auto-responding fake stdio child ─────────────

/** Fake OS child (the process-lifecycle harness pattern, self-contained). */
function makeB9Child() {
  const child = {
    pid: 424242,
    writes: [],
    promptCount: 0,
    handlers: {},
    respond: null,
    stdin: {
      handlers: {},
      on(event, fn) { this.handlers[event] = fn },
      write(line, callback) {
        const message = JSON.parse(line)
        child.writes.push(message)
        if (child.respond !== null) child.respond(message)
        if (typeof callback === 'function') queueMicrotask(() => callback(null))
        return true
      },
    },
    stdout: { handler: null, on(event, fn) { if (event === 'data') this.handler = fn } },
    stderr: { handler: null, on(event, fn) { if (event === 'data') this.handler = fn } },
    once(event, fn) { this.handlers[event] = fn },
    kill() {
      child.handlers.exit?.(0, null)
    },
  }
  return child
}

/**
 * The REAL per-agent process client; only spawn() is bound to a controllable
 * fake child instead of an OS dsh process (attachChild is the production
 * wiring path — identical to the router's fault-injection harnesses).
 */
class FleetProc extends AgentProcess {
  spawn() {
    const child = makeB9Child()
    this.b9Child = child
    child.respond = (message) => {
      if (message.id === undefined) return
      if (message.method === 'initialize') {
        this.emitToChild({ id: message.id, result: { registeredProviders: [this.provider] } })
      }
      if (message.method === 'shutdown') {
        this.emitToChild({ id: message.id, result: { ok: true } })
        // A real DSH child exits after acknowledging the shutdown request.
        queueMicrotask(() => child.handlers.exit?.(0, null))
      }
      if (message.method === 'session/prompt') {
        child.promptCount += 1
        this.emitToChild({ id: message.id, result: { messageId: `b9-msg-${child.promptCount}` } })
      }
    }
    return this.attachChild(child)
  }

  emitToChild(message) {
    this.b9Child.stdout.handler?.(`${JSON.stringify(message)}\n`)
  }

  /** Stream the exact session-event sequence of one completed target turn. */
  completeTurn(sessionId, messageId, replyText, { turn = 1 } = {}) {
    this.emitToChild({ method: 'session.event', params: { sessionId, event: { type: 'agent/inbox/spliced', data: { inserted: [{ id: messageId }] } } } })
    this.emitToChild({ method: 'session.event', params: { sessionId, event: { type: 'turn/start', data: { turn } } } })
    this.emitToChild({ method: 'session.event', params: { sessionId, event: { type: 'user/message', data: { id: messageId } } } })
    this.emitToChild({ method: 'session.event', params: { sessionId, event: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: replyText }] } } } } })
    this.emitToChild({ method: 'session.event', params: { sessionId, event: { type: 'turn/end', data: { turn, reason: { kind: 'completed' } } } } })
    this.emitToChild({ method: 'session.status', params: { sessionId, status: 'idle' } })
  }
}

async function seedB9Runtime({ stub, agents, credentials, root, credentialsFile }) {
  const ownedRoot = root ?? mkdtempSync(join(tmpdir(), 'b9-fleet-e2e-'))
  const layout = resolveProductionLayout(ownedRoot)
  mkdirSync(join(ownedRoot, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: TARGET,
    agents: agents.map((id) => ({ id, name: `B9 ${id}`, disabled: false })),
  })
  const credentialsPath = credentialsFile ?? join(ownedRoot, 'credentials-store.json')
  if (credentialsFile === undefined) {
    writeFileSync(credentialsPath, `${JSON.stringify({ version: 1, credentials }, null, 2)}\n`)
  }
  const procs = new Map()
  const runtime = await composeProductionRuntime({
    globalRoute: GLOBAL_ROUTE,
    layout,
    log: silentLog,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false },
    broker: { credentialsFile: credentialsPath, authServiceOrigin: stub.origin },
    processFactory: (opts) => {
      const proc = new FleetProc(opts)
      procs.set(opts.agentId, proc)
      return proc
    },
  })
  return { runtime, procs, auditFile: join(layout.controlDir, 'agent-session-messaging-audit.jsonl'), root: ownedRoot, credentialsFile: credentialsPath, agentsConfigPath: layout.agentsConfig }
}

function readAuditRows(auditFile) {
  if (!existsSync(auditFile)) return []
  return readFileSync(auditFile, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
}

/** The exact trusted child→gateway path (child relay wraps the parent RPC). */
function gatewayCall(runtime, { agentId, sourceTurnExecutionId, args, manifest = agentSessionMessagingManifest, operation = 'send' }) {
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
    manifest,
    async (call) => ({
      ok: true,
      result: await parentHandler(BROKER_RPC_METHOD, call, { turnExecutionId: sourceTurnExecutionId }),
    }),
  )
  return invoke(manifest, relayHandlers, { operation, args }, { resolvePrincipal: () => undefined })
}

const send = (runtime, caller, sourceTurnExecutionId, args) => gatewayCall(runtime, {
  agentId: caller,
  sourceTurnExecutionId,
  args,
})
const targetPrompts = (procs) => (procs.get(TARGET)?.b9Child?.writes ?? []).filter((write) => write.method === 'session/prompt')
/** The receipt messageId the gateway minted for one delivered prompt text. */
const messageIdOf = (procs, text) => `b9-msg-${targetPrompts(procs).findIndex((write) => write.params.contentBlocks[0].text === text) + 1}`

const ENTITLED_FLEET = {
  [SOURCE]: { clientId: 'client-source', clientSecret: 'source-secret' },
  [TARGET]: { clientId: 'client-target', clientSecret: 'target-secret' },
  [NEWBORN]: { clientId: 'client-newborn', clientSecret: 'newborn-secret' },
}

test('B9 lifecycle: canonical materialization admits, principal deactivation invalidates, scopes never escalate', async (t) => {
  const stub = await createFleetAuthStub(t, {
    'client-source': { clientSecret: 'source-secret', active: true, scopes: [SEND_SCOPE] },
    // Lawful AMENDMENT_1 member shape: fleet baseline + enumerated independent scope.
    'client-target': { clientSecret: 'target-secret', active: true, scopes: [SEND_SCOPE, INSPECT_SCOPE] },
    // The newborn completed canonical identity provisioning (principal +
    // client exist, credentials bound) but its fleet row is NOT materialized yet.
    'client-newborn': { clientSecret: 'newborn-secret', active: true, scopes: [] },
  })
  const { runtime, procs, auditFile, root, credentialsFile, agentsConfigPath } = await seedB9Runtime({ stub, agents: [SOURCE, TARGET, NEWBORN], credentials: ENTITLED_FLEET })
  t.after(() => runtime.stop().then(() => rmSync(root, { recursive: true, force: true })))

  // 1. Unmaterialized member → DENIED at the only grant authority, zero
  //    delivery bytes, and the denial is audited (L0).
  const denied = await send(runtime, NEWBORN, PROOF, { targetAgentId: TARGET, message: 'should not land', timeoutSeconds: 0 })
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'access_denied')
  assert.equal(targetPrompts(procs).length, 0)
  const denialRows = readAuditRows(auditFile).filter((row) => row.phase === 'denial')
  assert.deepEqual(denialRows.map((row) => [row.kind, row.sourceAgentId, row.code]), [
    ['agent_session_send', NEWBORN, 'access_denied'],
  ])
  // Snapshot every dsh-side entitlement-adjacent artifact: the flip to admit
  // must come from the AUTHORITY row alone.
  const dshArtifactsBefore = [agentsConfigPath, credentialsFile].map((path) => readFileSync(path))

  // 2. The canonical fleet materialization writes EXACTLY the fleet baseline
  //    row (the auth-service reconcile/birth-stamp ADD shape) — no dsh-side
  //    artifact changes — and the SAME member can now send.
  stub.materializeFleetRow('client-newborn', [SEND_SCOPE])
  const admitted = await send(runtime, NEWBORN, PROOF, { targetAgentId: TARGET, message: 'fleet baseline admitted', timeoutSeconds: 0 })
  assert.equal(admitted.ok, true)
  assert.equal(admitted.result.status, 'accepted')
  assert.equal(admitted.result.targetAgentId, TARGET)
  assert.equal(admitted.result.sessionId, 'main')
  assert.deepEqual([agentsConfigPath, credentialsFile].map((path) => readFileSync(path)), dshArtifactsBefore, 'dsh-side entitlement-adjacent artifacts untouched by the flip')
  const newbornPrompt = targetPrompts(procs).at(-1)
  assert.equal(newbornPrompt.params.contentBlocks[0].text, 'fleet baseline admitted')
  // The target Run completes (freeing the one-Run-per-session admission slot).
  procs.get(TARGET).completeTurn('main', messageIdOf(procs, 'fleet baseline admitted'), 'B9-LIFECYCLE-ACK')
  // The gate requested exactly the fleet baseline scope on the fleet audience,
  // on BOTH attempts (the denied one and the admitted one — the row decides,
  // never the request shape).
  assert.deepEqual(
    stub.requests.filter((entry) => entry.clientId === 'client-newborn').map((entry) => [entry.resource, entry.scope]),
    [[FLEET_AUDIENCE, SEND_SCOPE], [FLEET_AUDIENCE, SEND_SCOPE]],
  )

  // 3. Deactivating the principal invalidates the entitlement even though the
  //    grant row remains — deny is issuance-time-active, never row deletion.
  stub.deactivatePrincipal('client-source')
  const deactivated = await send(runtime, SOURCE, PROOF, { targetAgentId: TARGET, message: 'must not land after disable', timeoutSeconds: 0 })
  assert.equal(deactivated.ok, false)
  assert.equal(deactivated.error.code, 'credential_invalid')
  assert.equal(targetPrompts(procs).length, 1, 'zero new target prompts after deactivation (the only delivery is the earlier admitted send)')

  // 4. SENDER_DOES_NOT_GAIN_RECEIVER_GRANTS: a send-only member (the active
  //    newborn) cannot pass the receiver's independently-authorized inspection
  //    gate, while the lawful dual-scope member passes it and reaches the
  //    caller-bound handler.
  const sourceInspect = await gatewayCall(runtime, {
    agentId: NEWBORN,
    sourceTurnExecutionId: PROOF,
    manifest: agentSessionTurnInspectManifest,
    operation: 'inspect',
    args: { targetAgentId: TARGET, sessionId: 'main', messageId: 'b9-msg-1' },
  })
  assert.equal(sourceInspect.ok, false)
  assert.equal(sourceInspect.error.code, 'access_denied')
  const targetInspect = await gatewayCall(runtime, {
    agentId: TARGET,
    sourceTurnExecutionId: 'turn:9:b9tgt:g1:s7',
    manifest: agentSessionTurnInspectManifest,
    operation: 'inspect',
    args: { targetAgentId: TARGET, sessionId: 'main', messageId: 'b9-msg-1' },
  })
  assert.notEqual(targetInspect.error?.code, 'access_denied', 'the entitled inspector passes the grant gate')
  assert.deepEqual(
    [...new Set(stub.requests.filter((entry) => entry.scope.includes(INSPECT_SCOPE) && entry.status === 200).map((entry) => entry.clientId))],
    ['client-target'],
    'the inspection scope is ISSUED only to the member whose row holds the independent grant',
  )
})

test('B9 flow: sender identity, receiver identity, durable receipt and reply association across a full restart', async (t) => {
  const stub = await createFleetAuthStub(t, {
    'client-source': { clientSecret: 'source-secret', active: true, scopes: [SEND_SCOPE] },
    'client-target': { clientSecret: 'target-secret', active: true, scopes: [SEND_SCOPE, INSPECT_SCOPE] },
  })
  const { runtime, procs, auditFile, root, credentialsFile } = await seedB9Runtime({ stub, agents: [SOURCE, TARGET], credentials: ENTITLED_FLEET })
  let runtime2 = null
  t.after(async () => {
    await runtime.stop()
    if (runtime2 !== null) await runtime2.stop()
    rmSync(root, { recursive: true, force: true })
  })

  // 1. Receipt-only send: accepted on the real receipt; L1 intent row
  //    precedes the outcome row with the same requestId.
  const receiptSend = await send(runtime, SOURCE, PROOF, { targetAgentId: TARGET, message: 'B9-DURABLE-RECEIPT-PROBE', timeoutSeconds: 0 })
  assert.equal(receiptSend.ok, true)
  assert.equal(receiptSend.result.status, 'accepted')
  let rows = readAuditRows(auditFile).filter((row) => row.kind === 'agent_session_send')
  const receiptIntent = rows.find((row) => row.phase === 'intent')
  const receiptOutcome = rows.find((row) => row.phase === 'outcome')
  assert.equal(receiptIntent.sourceAgentId, SOURCE)
  assert.equal(receiptIntent.targetAgentId, TARGET)
  assert.equal(receiptOutcome.requestId, receiptIntent.requestId)
  assert.ok(receiptIntent.ts <= receiptOutcome.ts)
  assert.equal(receiptOutcome.result, 'accepted')
  // The receipt-only Run completes on the target before the next send —
  // one Run per session is an admission invariant of the real process.
  procs.get(TARGET).completeTurn('main', messageIdOf(procs, 'B9-DURABLE-RECEIPT-PROBE'), 'B9-RECEIPT-PROBE-ACK')

  // 2. Bounded send: the target receives the runtime-frozen inter_agent
  //    origin in ITS OWN process and workspace, then its completed Run's
  //    EXACT final output settles the send as 'replied'.
  const replyPending = send(runtime, SOURCE, PROOF, { targetAgentId: TARGET, message: 'B9-REPLY-ASSOCIATION-PROBE', timeoutSeconds: 30 })
  let replyPrompt
  for (let i = 0; i < 400 && replyPrompt === undefined; i += 1) {
    await sleep(5)
    replyPrompt = targetPrompts(procs).find((write) => write.params.contentBlocks[0].text === 'B9-REPLY-ASSOCIATION-PROBE')
  }
  assert.notEqual(replyPrompt, undefined, 'the delivery reached the target process')
  assert.deepEqual(replyPrompt.params.messageOrigin, {
    kind: 'inter_agent',
    sourceAgentId: SOURCE,
    correlation: PROOF,
  })
  assert.ok(typeof replyPrompt.params.cwd === 'string' && replyPrompt.params.cwd.length > 0, 'the receiver turn runs in its own canonical workspace')
  procs.get(TARGET).completeTurn('main', messageIdOf(procs, 'B9-REPLY-ASSOCIATION-PROBE'), 'B9-REPLY-ASSOCIATION-ACK')
  const reply = await replyPending
  assert.equal(reply.ok, true)
  assert.equal(reply.result.status, 'replied')
  assert.equal(reply.result.reply, 'B9-REPLY-ASSOCIATION-ACK')

  // 3. Model-supplied identity fields are rejected BEFORE any delivery or
  //    audit intent — sender identity is physically not an argument.
  const rowsBefore = readAuditRows(auditFile).length
  const promptsBefore = targetPrompts(procs).length
  const forged = await gatewayCall(runtime, {
    agentId: SOURCE,
    sourceTurnExecutionId: PROOF,
    operation: 'send',
    args: { targetAgentId: TARGET, message: 'forged', timeoutSeconds: 0, sourceAgentId: TARGET },
  })
  assert.equal(forged.ok, false)
  assert.equal(forged.error.code, 'invalid_arguments')
  assert.equal(targetPrompts(procs).length, promptsBefore)
  assert.equal(readAuditRows(auditFile).length, rowsBefore)

  // 4. Durable receipt: after a FULL restart, a fresh runtime instance
  //    resolves the caller-bound reconcile lookup from the SAME audit file.
  rows = readAuditRows(auditFile).filter((row) => row.phase === 'outcome')
  const replyOutcome = rows.filter((row) => row.result === 'replied').at(-1)
  assert.equal(replyOutcome.sourceAgentId, SOURCE)
  assert.ok(typeof replyOutcome.invocationCorrelation === 'string' && replyOutcome.invocationCorrelation.length >= 8, 'the invocation anchor is persisted')
  await runtime.stop()
  const stub2 = await createFleetAuthStub(t, {
    'client-source': { clientSecret: 'source-secret', active: true, scopes: [SEND_SCOPE] },
    // The foreign caller is ITSELF an entitled member — the refusal under
    // test is caller-binding, never the gate.
    'client-target': { clientSecret: 'target-secret', active: true, scopes: [SEND_SCOPE] },
  })
  runtime2 = (await seedB9Runtime({ stub: stub2, agents: [SOURCE, TARGET], root, credentialsFile })).runtime
  const lookup = await gatewayCall(runtime2, {
    agentId: SOURCE,
    sourceTurnExecutionId: 'turn:9:b9src:g1:s8',
    manifest: agentSessionReconcileManifest,
    operation: 'lookup',
    args: { invocationCorrelation: replyOutcome.invocationCorrelation },
  })
  assert.equal(lookup.ok, true)
  assert.equal(lookup.result.invocationCorrelationFound, true)
  assert.equal(lookup.result.outcome.result, 'replied')
  assert.equal(lookup.result.outcome.targetAgentId, TARGET)
  assert.equal(lookup.result.outcome.messageId, replyOutcome.messageId)
  // Caller-bound: the retained row belongs to SOURCE — a foreign caller
  // resolves nothing from the same anchor.
  const foreignLookup = await gatewayCall(runtime2, {
    agentId: TARGET,
    sourceTurnExecutionId: 'turn:9:b9tgt:g1:s8',
    manifest: agentSessionReconcileManifest,
    operation: 'lookup',
    args: { invocationCorrelation: replyOutcome.invocationCorrelation },
  })
  assert.equal(foreignLookup.ok, true)
  assert.equal(foreignLookup.result.invocationCorrelationFound, false)
  assert.equal(foreignLookup.result.outcome, null)
})
