/**
 * AGENT_CORE_AGENT_SESSION_MESSAGING_V1 — broker-side contract tests for the
 * agent_session_send LOCAL capability:
 *
 *   - manifest grammar + the CLOSED §5 error table (R1/F23)
 *   - DEFAULT_MANIFESTS registration (exactly one tool)
 *   - the model-facing schema excludes every R2-forbidden field
 *   - child relay path for LOCAL manifests (G8: the BASE relay tests are
 *     http-only — the local-manifest relay path is covered HERE)
 *   - the gateway execute-time resolver closure admits the third provider
 *     (F9) and its L0 pre-handler denial hook fires (R12) without ever
 *     altering the denial
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { validateManifest } from '../src/schema.js'
import { createRelayHandlers, BROKER_RPC_METHOD } from '../src/relay.js'
import { createBrokerGateway } from '../src/gateway.js'
import { apply as applyBroker, DEFAULT_MANIFESTS } from '../src/index.js'
import { agentSessionMessagingManifest } from '../src/capabilities/agent-session-messaging.js'
import { agentSessionReconcileManifest } from '../src/capabilities/agent-session-reconcile.js'
import { buildToolDefinition } from '../src/registry.js'

const SECTION_5_CODES = [
  'invalid_arguments', 'credential_unavailable', 'credential_invalid', 'access_denied',
  'target_not_found', 'target_disabled', 'self_send_not_supported', 'not_admitted',
  'queue_capacity_exceeded', 'outcome_unknown', 'target_run_failed', 'reply_unavailable',
  'transport_failure', 'unsupported_operation', 'internal_error',
]

const FORBIDDEN_MODEL_FIELDS = [
  'sessionKey', 'sessionId', 'label', 'sessionMode',
  'sourceAgentId', 'sourceSessionRef', 'principalId',
  'requestId', 'correlation', 'provenance', 'binding',
  'channel', 'replyRoute', 'workflowInstanceId', 'reason',
]

test('manifest grammar: valid LOCAL capability with the R1 identity block', () => {
  const validated = validateManifest(agentSessionMessagingManifest)
  assert.equal(validated.ok, true, `manifest must validate: ${validated.errors?.join('; ')}`)
  const manifest = validated.manifest
  assert.equal(manifest.id, 'agent_session_send')
  assert.equal(manifest.toolName, 'agent_session_send')
  assert.equal(manifest.selector, 'operation')
  assert.deepEqual(manifest.local, { resource: 'agent-session-messaging' })
  assert.deepEqual(manifest.requiredScopes, ['agent.session.send'])
  assert.equal(manifest.operations.length, 1)
  assert.equal(manifest.operations[0].name, 'send')
})

test('manifest declares exactly the closed §5 taxonomy, per operation too', () => {
  const table = agentSessionMessagingManifest.errors.map((e) => e.code).sort()
  assert.deepEqual(table, [...SECTION_5_CODES].sort())
  assert.deepEqual([...agentSessionMessagingManifest.operations[0].errors].sort(), [...SECTION_5_CODES].sort())
})

test('model-visible arguments are exactly the three R2 fields', () => {
  const args = agentSessionMessagingManifest.operations[0].arguments
  assert.equal(args.additionalProperties, false)
  assert.deepEqual([...args.required].sort(), ['message', 'targetAgentId', 'timeoutSeconds'].sort())
  assert.deepEqual(Object.keys(args.properties).sort(), ['message', 'targetAgentId', 'timeoutSeconds'].sort())
  assert.equal(args.properties.timeoutSeconds.type, 'integer')
  assert.equal(args.properties.timeoutSeconds.minimum, 0)
  assert.equal(args.properties.timeoutSeconds.maximum, 300)
})

test('the model-facing schema physically excludes every R2-forbidden field', () => {
  const parameters = JSON.stringify(agentSessionMessagingManifest)
  for (const forbidden of FORBIDDEN_MODEL_FIELDS) {
    assert.ok(!parameters.includes(`"${forbidden}"`), `${forbidden} must not be a model-visible field`)
  }
})

test('DEFAULT_MANIFESTS registers agent_session_send exactly once', () => {
  const ids = DEFAULT_MANIFESTS.map((m) => m.id)
  assert.equal(ids.filter((id) => id === 'agent_session_send').length, 1)
})

// ------------------------------------------------------- relay local path

test('LOCAL manifest operations get child relay handlers that unwrap the parent envelope (G8)', async () => {
  const calls = []
  const requestFn = async (rpcCall) => {
    calls.push(rpcCall)
    return { ok: true, result: { ok: true, result: { status: 'accepted' } } }
  }
  const handlers = createRelayHandlers(agentSessionMessagingManifest, requestFn)
  assert.equal(typeof handlers.send, 'function', 'the LOCAL operation must relay')
  const wire = await handlers.send({}, { targetAgentId: 'agt_b-target', message: 'hi', timeoutSeconds: 0 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].capabilityId, 'agent_session_send')
  assert.equal(calls[0].operation, 'send')
  assert.deepEqual(wire, { status: 'accepted' })
})

test('LOCAL relay preserves structured parent failures through the child invoke mapping', async () => {
  const requestFn = async () => ({ ok: true, result: { ok: false, error: { code: 'self_send_not_supported', detail: 'nope' } } })
  const handlers = createRelayHandlers(agentSessionMessagingManifest, requestFn)
  const failure = await handlers.send({}, { targetAgentId: 'agt_self', message: 'x', timeoutSeconds: 0 })
  assert.equal(failure.errorCode, 'self_send_not_supported')
})

test('LOCAL relay maps a rejected or malformed parent response to parent_rpc_ambiguous without retry', async () => {
  for (const response of ['throw', 'missing-envelope', 'malformed-success', 'undeclared-failure']) {
    const legs = []
    const handlers = createRelayHandlers(agentSessionMessagingManifest, async (rpcCall) => {
      legs.push(rpcCall)
      // AMENDMENT_1 §5.3: at the two unknown capture points the relay issues
      // EXACTLY ONE reconcile lookup; when the lookup is ITSELF unusable the
      // honest ambiguous envelope is the terminal (never a replay).
      if (rpcCall.capabilityId === 'agent_session_send_reconcile') {
        throw new Error('lookup transport failed')
      }
      if (response === 'throw') throw new Error('response lost after possible delivery')
      if (response === 'malformed-success') return { ok: true, result: { ok: true, result: undefined } }
      if (response === 'undeclared-failure') return { ok: true, result: { ok: false, error: { code: 'mystery' } } }
      return undefined
    })
    const failure = await handlers.send({}, { targetAgentId: 'agt_target', message: 'x', timeoutSeconds: 0 })
    assert.equal(failure.errorCode, 'outcome_unknown', response)
    assert.match(failure.detail, /parent_rpc_ambiguous/, response)
    const sendLegs = legs.filter((c) => c.capabilityId === 'agent_session_send')
    const lookupLegs = legs.filter((c) => c.capabilityId === 'agent_session_send_reconcile')
    assert.equal(sendLegs.length, 1, `${response}: relay never replays an ambiguous send`)
    assert.equal(lookupLegs.length, 1, `${response}: exactly one reconcile lookup per capture point`)
  }
})

test('AMENDMENT_1 §5.3: the send RPC carries the child-minted invocationCorrelation anchor', async () => {
  let seen
  const handlers = createRelayHandlers(agentSessionMessagingManifest, async (rpcCall) => {
    seen = rpcCall
    return { ok: true, result: { ok: true, result: { status: 'accepted' } } }
  })
  await handlers.send({}, { targetAgentId: 'agt_b-target', message: 'hi', timeoutSeconds: 0 })
  assert.equal(typeof seen.invocationCorrelation, 'string')
  assert.ok(seen.invocationCorrelation.length >= 8 && seen.invocationCorrelation.length <= 128)
})

/** Build relay handlers whose send leg is lost and whose lookup leg answers `lookupResult`. */
function lostSendRelay(lookupImpl) {
  const legs = []
  const handlers = createRelayHandlers(agentSessionMessagingManifest, async (rpcCall) => {
    legs.push(rpcCall)
    if (rpcCall.capabilityId === 'agent_session_send_reconcile') return lookupImpl(rpcCall)
    throw new Error('response lost after the parent committed')
  })
  return { handlers, legs }
}

async function runLostSend(lookupResult) {
  const { handlers, legs } = lostSendRelay(() => ({
    ok: true,
    result: { ok: true, result: lookupResult },
  }))
  const wire = await handlers.send({}, { targetAgentId: 'agt_b-target', message: 'x', timeoutSeconds: 30 })
  return { wire, legs }
}

test('AMENDMENT_1 §5.3 CASE A: receipt committed + response lost -> reconcile DELIVERED, zero redelivery', async () => {
  const { wire, legs } = await runLostSend({
    invocationCorrelationFound: true,
    outcome: { result: 'accepted' },
    oldestRetainedIntentTs: 1,
  })
  assert.deepEqual(wire, { status: 'reconciled', delivery: 'DELIVERED', replyStatus: 'NOT_WAITED' })
  const sendLegs = legs.filter((c) => c.capabilityId === 'agent_session_send')
  const lookupLegs = legs.filter((c) => c.capabilityId === 'agent_session_send_reconcile')
  assert.equal(sendLegs.length, 1, 'the send executed exactly once')
  assert.equal(lookupLegs.length, 1, 'exactly one read-only lookup')
  assert.equal(typeof lookupLegs[0].invocationIssuedAtWallMs, 'number', 'lookup carries the issue time')
  assert.equal(lookupLegs[0].args.invocationCorrelation, sendLegs[0].invocationCorrelation, 'same anchor')
})

test('AMENDMENT_1 §5.3: reconciled conversions for every outcome row class', async () => {
  const cases = [
    [{ invocationCorrelationFound: true, outcome: { result: 'replied' }, oldestRetainedIntentTs: 1 },
      { status: 'reconciled', delivery: 'DELIVERED', replyStatus: 'REPLIED', replyTextAvailable: false }],
    [{ invocationCorrelationFound: true, outcome: { result: 'timeout' }, oldestRetainedIntentTs: 1 },
      { status: 'reconciled', delivery: 'DELIVERED', replyStatus: 'TIMEOUT' }],
    [{ invocationCorrelationFound: true, outcome: { result: 'failed', failureCode: 'reply_unavailable', failureReason: 'truncated' }, oldestRetainedIntentTs: 1 },
      { status: 'reconciled', delivery: 'DELIVERED', replyStatus: 'TRUNCATED' }],
    [{ invocationCorrelationFound: true, outcome: { result: 'failed', failureCode: 'reply_unavailable', failureReason: 'no_output' }, oldestRetainedIntentTs: 1 },
      { status: 'reconciled', delivery: 'DELIVERED', replyStatus: 'NO_OUTPUT' }],
    [{ invocationCorrelationFound: true, outcome: { result: 'failed', failureCode: 'reply_unavailable', failureReason: 'restart_lost' }, oldestRetainedIntentTs: 1 },
      { status: 'reconciled', delivery: 'DELIVERED', replyStatus: 'UNKNOWN' }],
    [{ invocationCorrelationFound: true, outcome: { result: 'failed', failureCode: 'target_run_failed' }, oldestRetainedIntentTs: 1 },
      { status: 'reconciled', delivery: 'DELIVERED', replyStatus: 'TARGET_FAILED' }],
    [{ invocationCorrelationFound: true, outcome: { result: 'failed', failureCode: 'not_admitted' }, oldestRetainedIntentTs: 1 },
      { status: 'reconciled', delivery: 'NOT_DELIVERED', replyStatus: 'NOT_WAITED' }],
    [{ invocationCorrelationFound: true, outcome: { result: 'failed', failureCode: 'internal_error' }, oldestRetainedIntentTs: 1 },
      { status: 'reconciled', delivery: 'UNKNOWN', replyStatus: 'UNKNOWN' }],
    [{ invocationCorrelationFound: true, outcome: null, oldestRetainedIntentTs: 1 },
      { status: 'reconciled', delivery: 'UNKNOWN', replyStatus: 'UNKNOWN' }],
  ]
  for (const [lookupResult, expected] of cases) {
    const { wire } = await runLostSend(lookupResult)
    assert.deepEqual(wire, expected, JSON.stringify(lookupResult))
  }
})

test('AMENDMENT_1 §5.3 CASE B + rotation honesty: absence is NOT_DELIVERED only under proven coverage', async () => {
  // Retention window covers the invocation -> provable non-entry.
  const covered = await runLostSend({ invocationCorrelationFound: false, outcome: null, oldestRetainedIntentTs: 1000 })
  assert.deepEqual(covered.wire, { status: 'reconciled', delivery: 'NOT_DELIVERED', replyStatus: 'NOT_WAITED' })
  // Anchor expired by rotation (oldest retained row AFTER the issue time)
  // -> UNKNOWN; the duplicate-licensing NOT_DELIVERED is never produced.
  const expired = await runLostSend({ invocationCorrelationFound: false, outcome: null, oldestRetainedIntentTs: Date.now() + 1000 })
  assert.deepEqual(expired.wire, { status: 'reconciled', delivery: 'UNKNOWN', replyStatus: 'UNKNOWN' })
  // No coverage anchor at all -> UNKNOWN.
  const unbounded = await runLostSend({ invocationCorrelationFound: false, outcome: null, oldestRetainedIntentTs: null })
  assert.deepEqual(unbounded.wire, { status: 'reconciled', delivery: 'UNKNOWN', replyStatus: 'UNKNOWN' })
})

test('AMENDMENT_1 §5.3: a parent-answered reconciled result is not a valid send success (child-synthesized only)', async () => {
  const legs = []
  const handlers = createRelayHandlers(agentSessionMessagingManifest, async (rpcCall) => {
    legs.push(rpcCall)
    if (rpcCall.capabilityId === 'agent_session_send_reconcile') {
      return { ok: true, result: { ok: true, result: { invocationCorrelationFound: true, outcome: { result: 'accepted' }, oldestRetainedIntentTs: 1 } } }
    }
    // A parent must never answer `reconciled` — validSessionSendResult rejects it.
    return { ok: true, result: { ok: true, result: { status: 'reconciled', delivery: 'DELIVERED', replyStatus: 'NOT_WAITED' } } }
  })
  const wire = await handlers.send({}, { targetAgentId: 'agt_b-target', message: 'x', timeoutSeconds: 0 })
  assert.deepEqual(wire, { status: 'reconciled', delivery: 'DELIVERED', replyStatus: 'NOT_WAITED' })
  assert.equal(legs.filter((c) => c.capabilityId === 'agent_session_send_reconcile').length, 1,
    'the parent-answered reconciled degraded to the ambiguous leg and was reconciled read-only')
})

test('AMENDMENT_1 §5.2: renderErrorDetail renders the sanitized structured failure reason', () => {
  const { definition } = buildToolDefinition({
    manifest: agentSessionMessagingManifest,
    handlers: { send: async () => ({ ok: false, error: { code: 'reply_unavailable', detail: 'reply unavailable (no_output)' } }) },
    deps: { resolvePrincipal: () => ({}) },
  })
  const rendered = definition.output.render(
    { operation: 'send', targetAgentId: 'agt_b-target', message: 'x', timeoutSeconds: 30 },
    { ok: false, error: { code: 'reply_unavailable', detail: 'reply unavailable (no_output)' } },
  )
  assert.match(rendered[0].text, /failed: reply_unavailable: reply unavailable \(no_output\)/,
    'the model-visible text carries the structured reason (§5.1 decidability)')
  // Without the marker, the render stays code-only (the historical shape).
  const bare = { ...agentSessionMessagingManifest, renderErrorDetail: undefined }
  const { definition: bareDefinition } = buildToolDefinition({
    manifest: bare,
    handlers: { send: async () => ({ ok: false, error: { code: 'reply_unavailable', detail: 'reply unavailable (no_output)' } }) },
    deps: { resolvePrincipal: () => ({}) },
  })
  const bareRendered = bareDefinition.output.render(
    { operation: 'send', targetAgentId: 'agt_b-target', message: 'x', timeoutSeconds: 30 },
    { ok: false, error: { code: 'reply_unavailable', detail: 'reply unavailable (no_output)' } },
  )
  assert.doesNotMatch(bareRendered[0].text, /no_output/, 'opt-in only: no marker, no detail')
})

test('AMENDMENT_1 §5.3: the reconcile manifest validates and carries infrastructure:true', () => {
  const validated = validateManifest(agentSessionReconcileManifest)
  assert.equal(validated.ok, true, validated.errors?.join('; '))
  assert.equal(validated.manifest.infrastructure, true, 'the marker survives the allowlist rebuild')
  assert.equal(validated.manifest.local.resource, 'agent-session-messaging-reconcile')
})

test('AMENDMENT_1 §5.3: infrastructure manifests are excluded from the child model tool inventory', () => {
  const registered = []
  const ctx = fakeCtx(new Map())
  ctx.tools = { register: (definition) => registered.push(definition) }
  const config = {
    mode: 'child',
    targets: undefined,
  }
  applyBroker(ctx, config)
  const names = registered.map((d) => d?.definition?.name ?? d?.name)
  assert.ok(names.includes('agent_session_send'), 'the send tool is still presented to the model')
  assert.ok(!names.includes('agent_session_send_reconcile'), 'the infrastructure lookup is NEVER a model tool')
  assert.ok(!names.includes(undefined), 'every registered capability builds a named definition')
})

test('BROKER_RPC_METHOD stays in lockstep between relay and router', () => {
  assert.equal(BROKER_RPC_METHOD, 'agent-core/broker')
})

// ------------------------------------------- gateway resolver + L0 hook

/** Minimal cordis-shaped ctx stub for the broker gateway-mode apply(). */
function fakeCtx(services) {
  const provided = {}
  return {
    get: (name) => services.get?.(name),
    provide: (name, service) => { provided[name] = service },
    provided,
  }
}

/** Temp 505-style credential store covering the caller (trusted seam shape). */
function tempCredentialStore({ agentIds, t }) {
  const file = join(tmpdir(), `asm-cred-${Date.now()}-${Math.random().toString(16).slice(2)}.json`)
  const credentials = {}
  for (const id of agentIds) credentials[id] = { clientId: `client-${id}`, clientSecret: `secret-${id}` }
  writeFileSync(file, `${JSON.stringify({ version: 1, credentials }, null, 2)}\n`)
  t.after(() => rmSync(file, { force: true }))
  return file
}

/** Stub auth-service token endpoint (grant or deny). */
function stubAuthServer(t, mode = 'grant') {
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (mode === 'deny') {
      res.statusCode = 403
      res.end(JSON.stringify({ error: 'insufficient_scope' }))
      return
    }
    res.statusCode = 200
    res.end(JSON.stringify({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }))
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      t.after(() => new Promise((done) => server.close(done)))
      resolve(`http://127.0.0.1:${server.address().port}`)
    })
  })
}

function gatewayModeConfig(overrides = {}) {
  return {
    mode: 'gateway',
    // Unit scope: the messaging manifest rides the DEFAULT pack (the
    // gateway-mode moderator append needs the pinned targets either way).
    targets: undefined,
    ...overrides,
  }
}

test('gateway: the resolver closure admits agentSessionMessagingAccess (F9) and freezes the trusted caller', async (t) => {
  const seen = []
  const services = new Map([
    ['agentSessionMessagingAccess', {
      handlers: {
        agent_session_send: {
          send: async (args, context) => {
            seen.push({ args, context })
            return { ok: true, result: { status: 'accepted' } }
          },
        },
      },
    }],
  ])
  const ctx = fakeCtx(services)
  const credentialsFile = tempCredentialStore({ agentIds: ['agt_a-caller'], t })
  const authServiceOrigin = await stubAuthServer(t, 'grant')
  const { gateway } = applyBroker(ctx, gatewayModeConfig({ credentialsFile, authServiceOrigin }))
  assert.notEqual(ctx.provided.brokerGateway, undefined)

  const envelope = await gateway.execute(
    { capabilityId: 'agent_session_send', operation: 'send', args: { targetAgentId: 'agt_b', message: 'hi', timeoutSeconds: 0 } },
    { agentId: 'agt_a-caller' },
  )
  assert.deepEqual(envelope, { ok: true, result: { status: 'accepted' } })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].context.agentId, 'agt_a-caller', 'trusted caller is the gateway caller')
  assert.equal(seen[0].context.callerAgentId, 'agt_a-caller')
})

test('gateway: a missing provider fails closed unsupported_operation and fires the L0 hook (R12)', async () => {
  const denials = []
  const ctx = fakeCtx(new Map())
  const { gateway } = applyBroker(ctx, gatewayModeConfig({
    auditDenial: (info) => denials.push(info),
  }))
  const envelope = await gateway.execute(
    { capabilityId: 'agent_session_send', operation: 'send', args: {} },
    { agentId: 'agt_a-caller' },
  )
  assert.equal(envelope.ok, false)
  assert.equal(envelope.error.code, 'unsupported_operation')
  assert.deepEqual(denials, [{
    capabilityId: 'agent_session_send', operation: 'send', agentId: 'agt_a-caller', code: 'unsupported_operation',
  }])
})

test('gateway: a credential denial fires the L0 hook without changing the denial', async (t) => {
  const denials = []
  const services = new Map([
    ['agentSessionMessagingAccess', { handlers: { agent_session_send: { send: async () => ({ ok: true, result: {} }) } } }],
  ])
  const ctx = fakeCtx(services)
  const credentialsFile = tempCredentialStore({ agentIds: ['agt_other-agent'], t })
  const authServiceOrigin = await stubAuthServer(t, 'grant')
  const { gateway } = applyBroker(ctx, gatewayModeConfig({
    auditDenial: (info) => denials.push(info),
    credentialsFile,
    authServiceOrigin,
  }))
  const envelope = await gateway.execute(
    { capabilityId: 'agent_session_send', operation: 'send', args: { targetAgentId: 'agt_b', message: 'hi', timeoutSeconds: 0 } },
    { agentId: 'agt_a-caller' },
  )
  assert.equal(envelope.error.code, 'credential_unavailable')
  assert.equal(denials.length, 1)
  assert.equal(denials[0].code, 'credential_unavailable')
})

test('gateway: a broken audit sink never changes the denial outcome', async () => {
  const ctx = fakeCtx(new Map())
  const { gateway } = applyBroker(ctx, gatewayModeConfig({
    auditDenial: () => { throw new Error('audit sink down') },
  }))
  const envelope = await gateway.execute(
    { capabilityId: 'agent_session_send', operation: 'send', args: {} },
    { agentId: 'agt_a-caller' },
  )
  assert.equal(envelope.error.code, 'unsupported_operation', 'the denial stands')
})

test('gateway: the L0 hook is not invoked for non-local capabilities', async () => {
  const denials = []
  const ctx = fakeCtx(new Map())
  const { gateway } = applyBroker(ctx, gatewayModeConfig({
    auditDenial: (info) => denials.push(info),
  }))
  const envelope = await gateway.execute(
    { capabilityId: 'unknown_capability', operation: 'send', args: {} },
    { agentId: 'agt_a-caller' },
  )
  assert.equal(envelope.error.code, 'unsupported_operation')
  assert.equal(denials.length, 0, 'capability not served by the gateway never reaches the local-denial hook')
})
