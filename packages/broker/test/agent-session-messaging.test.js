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
