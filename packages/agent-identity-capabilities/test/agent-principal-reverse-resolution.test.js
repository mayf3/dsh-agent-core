/**
 * AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1 — trusted provider tests
 * (table-driven, isolated): the composed Auth-read + local-Definition
 * validation must be exact, fail-closed on every documented family, and
 * strictly read-only with no retry and no secret-bearing surface. Synthetic
 * fixtures only — production canary Principal UUID constants are FORBIDDEN
 * (ACC-APR-003: TARGET_UUID_PRESEEDED = NO).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createAgentPrincipalReverseResolutionAccess,
  mapAuthResponse,
  validateResolveByAgentArgs,
} from '../src/agent-principal-reverse-resolution.js'
import { AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID } from '../src/agent-principal-reverse-resolution.js'

const UUID = '0f1e2d3c-4b5a-4968-8776-65a4b3c2d1e0'
const AGENT_ID = 'agt_blog-agent'
const ORIGIN = 'https://auth.example.test'
const CALLER = 'agt_hr-agent'

function definition({ missing = false, disabled = false } = {}) {
  return {
    getAgent: (id) => {
      if (missing || id !== AGENT_ID) {
        throw Object.assign(new Error('agent-definition: agent not found'), { code: 'AGENT_NOT_FOUND' })
      }
      return { id, name: 'Blog Agent', description: null, disabled }
    },
  }
}

function makeProvider({
  status = 200,
  body = { principalId: UUID, agentId: AGENT_ID, principalStatus: 'active' },
  rawBody,
  definition: def = definition(),
  token = { accessToken: 'tok' },
  tokenError,
  origin = ORIGIN,
} = {}) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    if (rawBody !== undefined) {
      return { status, json: async () => { throw new Error('not json') } }
    }
    return { status, json: async () => body }
  }
  const provider = createAgentPrincipalReverseResolutionAccess({
    definition: def,
    authServiceOrigin: origin,
    acquireCallerToken: async () => {
      if (tokenError !== undefined) throw tokenError
      return token
    },
    fetchImpl,
  })
  return { provider, calls }
}

function resolve(provider, args = { agentId: AGENT_ID }) {
  return provider.handlers[AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID]
    .resolve(args, { callerAgentId: CALLER })
}

function resolveRaw(provider, args) {
  return provider.handlers[AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID]
    .resolve(args, { callerAgentId: CALLER })
}

// ---------------------------------------------------------------- validation

test('args: exactly one grammar-valid agentId; everything else is invalid_arguments before any transport', async () => {
  const invalid = [
    [undefined, 'missing args'], [null, 'null args'], ['x', 'string args'], [{}, 'empty args'],
    [{ agentId: AGENT_ID, extra: 1 }, 'extra field'],
    [{ agentId: '  ' + AGENT_ID + '  ' }, 'padded id must not be trimmed'],
    [{ agentId: 'AGT_blog-agent' }, 'uppercase prefix'],
    [{ agentId: 'blog-agent' }, 'missing agt_ prefix'],
    [{ agentId: 'agt_' }, 'prefix only'],
    [{ agentId: 'agt_blog agent' }, 'space'],
    [{ agentId: `agt_${'a'.repeat(129)}` }, 'too long'],
    [{ agentId: 'agt_blog-agent!!' }, 'invalid chars'],
    [{ agentId: 42 }, 'non-string'],
    [{ agentId: UUID }, 'wrong field name (principal uuid)'],
    [{ principalId: UUID }, 'forward-tool field name'],
  ]
  for (const [args, label] of invalid) {
    const { provider, calls } = makeProvider()
    const out = args === undefined
      ? await resolveRaw(provider, args)
      : await resolve(provider, args)
    assert.deepEqual(out, { ok: false, error: { code: 'invalid_arguments', detail: out?.error?.detail ?? '' } }, label)
    assert.equal(calls.length, 0, `no transport for ${label}`)
    assert.ok(!JSON.stringify(out).includes('tok'), `no token leak for ${label}`)
  }
  const ok = validateResolveByAgentArgs({ agentId: AGENT_ID })
  assert.deepEqual(ok, { ok: true, agentId: AGENT_ID })
})

test('composition guards: caller identity, origin, and token seam fail closed before any target read', async () => {
  // Missing caller identity = internal_error (a wiring fault, not a transport one).
  {
    const { provider } = makeProvider()
    const out = await provider.handlers[AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID]
      .resolve({ agentId: AGENT_ID }, {})
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'internal_error')
  }
  // Unconfigured fixed origin = transport_failure per call.
  {
    const provider = createAgentPrincipalReverseResolutionAccess({
      definition: definition(),
      acquireCallerToken: async () => ({ accessToken: 'tok' }),
      fetchImpl: async () => { throw new Error('should not fetch') },
    })
    const out = await resolve(provider)
    assert.equal(out.error.code, 'transport_failure')
  }
  // Token seam error codes pass through closed; unknown codes become transport_failure.
  for (const [tokenError, expected] of [
    [Object.assign(new Error('none'), { code: 'credential_unavailable' }), 'credential_unavailable'],
    [Object.assign(new Error('bad'), { code: 'credential_invalid' }), 'credential_invalid'],
    [Object.assign(new Error('deny'), { code: 'access_denied' }), 'access_denied'],
    [Object.assign(new Error('tp'), { code: 'transport_failure' }), 'transport_failure'],
    [new Error('mystery'), 'transport_failure'],
  ]) {
    const { provider, calls } = makeProvider({ tokenError })
    const out = await resolve(provider)
    assert.equal(out.error.code, expected)
    assert.equal(calls.length, 0, 'no Auth read when token acquisition fails')
  }
  // Token seam returning nothing usable = transport_failure.
  {
    const { provider, calls } = makeProvider({ token: {} })
    const out = await resolve(provider)
    assert.equal(out.error.code, 'transport_failure')
    assert.equal(calls.length, 0)
  }
})

// ------------------------------------------------------------- auth response

test('success: exact two-field envelope, fixed path, one attempt, no token in the result', async () => {
  const { provider, calls } = makeProvider()
  const out = await resolve(provider)
  assert.deepEqual(out, { ok: true, result: { agentId: AGENT_ID, principalId: UUID } })
  assert.equal(calls.length, 1, 'exactly one attempt — no retry')
  assert.equal(calls[0].url, `${ORIGIN}/api/v1/directory/agents/${AGENT_ID}/principal`)
  assert.equal(calls[0].init.method, 'GET')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok')
  assert.equal(calls[0].init.redirect, 'error')
  assert.ok(!JSON.stringify(out).includes('tok'), 'the token never reaches the model surface')
  assert.deepEqual(Object.keys(out.result), ['agentId', 'principalId'])
  assert.ok(!JSON.stringify(out).includes('principalStatus'), 'disabled/status data never appears on success')
})

test('disabled target: auth 200 principalStatus=disabled classifies as principal_disabled (never success)', async () => {
  const { provider, calls } = makeProvider({ body: { principalId: UUID, agentId: AGENT_ID, principalStatus: 'disabled' } })
  const out = await resolve(provider)
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'principal_disabled')
  assert.equal(calls.length, 1)
})

test('auth error families map to the closed taxonomy', async () => {
  for (const [status, body, expected] of [
    [404, { error: 'AGENT_NOT_FOUND' }, 'agent_not_found'],
    [422, { error: 'PRINCIPAL_NOT_AGENT' }, 'principal_not_agent'],
    [409, { error: 'IDENTITY_RESOLUTION_AMBIGUOUS' }, 'identity_resolution_ambiguous'],
    [401, { error: 'UNAUTHORIZED' }, 'credential_invalid'],
    [403, { error: 'ACCESS_DENIED' }, 'access_denied'],
    [500, { error: 'IDENTITY_RESOLUTION_QUERY_FAILED' }, 'identity_resolution_unavailable'],
    [504, undefined, 'identity_resolution_unavailable'],
    [418, { error: 'TEAPOT' }, 'identity_resolution_unavailable'],
  ]) {
    const { provider } = makeProvider({ status, body })
    const out = await resolve(provider)
    assert.equal(out.ok, false, `status ${status}`)
    assert.equal(out.error.code, expected, `status ${status}`)
  }
})

test('malformed or mismatched 200 bodies never succeed (client-side equality re-verification)', async () => {
  const malformed = [
    [{ principalId: UUID, agentId: AGENT_ID }, 'missing principalStatus'],
    [{ agentId: AGENT_ID, principalStatus: 'active' }, 'missing principalId'],
    [{ principalId: UUID, principalStatus: 'active' }, 'missing agentId'],
    [{ principalId: UUID, agentId: AGENT_ID, principalStatus: 'active', extra: 1 }, 'extra key'],
    [{ principalId: 'not-a-uuid', agentId: AGENT_ID, principalStatus: 'active' }, 'bad uuid'],
    [{ principalId: UUID, agentId: 'agt_other-agent', principalStatus: 'active' }, 'agentId drift'],
    [{ principalId: UUID, agentId: AGENT_ID, principalStatus: 'pending' }, 'status outside the value domain'],
    [{ principalId: UUID, agentId: 'AGT_UPPER', principalStatus: 'active' }, 'agentId grammar drift'],
  ]
  for (const [body, label] of malformed) {
    const { provider } = makeProvider({ body })
    const out = await resolve(provider)
    assert.equal(out.ok, false, label)
    assert.equal(out.error.code, 'identity_resolution_unavailable', label)
  }
  // Non-JSON body = unavailable, never fabricated success.
  const { provider } = makeProvider({ rawBody: 'nope' })
  const out = await resolve(provider)
  assert.equal(out.error.code, 'identity_resolution_unavailable')
})

// -------------------------------------------------- definition composition

test('local Definition composition: auth success alone never succeeds (CTR-APR-003 item 6)', async () => {
  {
    const { provider, calls } = makeProvider({ definition: definition({ missing: true }) })
    const out = await resolve(provider)
    assert.equal(out.error.code, 'target_not_found')
    assert.equal(calls.length, 1)
  }
  {
    const { provider } = makeProvider({ definition: definition({ disabled: true }) })
    const out = await resolve(provider)
    assert.equal(out.error.code, 'target_disabled')
  }
  {
    const drift = { getAgent: () => ({ id: 'agt_other-agent', disabled: false }) }
    const { provider } = makeProvider({ definition: drift })
    const out = await resolve(provider)
    assert.equal(out.error.code, 'identity_resolution_unavailable')
  }
})

// ------------------------------------------------------------ construction

test('provider construction is fail-fast on misconfiguration', () => {
  assert.throws(() => createAgentPrincipalReverseResolutionAccess({ acquireCallerToken: async () => ({}) }), /definition/)
  assert.throws(() => createAgentPrincipalReverseResolutionAccess({ definition: definition() }), /acquireCallerToken/)
  const base = { definition: definition(), acquireCallerToken: async () => ({ accessToken: 't' }) }
  assert.throws(() => createAgentPrincipalReverseResolutionAccess({ ...base, authServiceOrigin: '' }), /authServiceOrigin/)
  for (const bad of [0, -1, 5001, 1.5]) {
    assert.throws(() => createAgentPrincipalReverseResolutionAccess({ ...base, timeoutMs: bad }), /timeoutMs/)
  }
  const ok = createAgentPrincipalReverseResolutionAccess({ ...base, timeoutMs: 5000 })
  assert.ok(ok.handlers.agent_resolve_principal_by_agent.resolve)
})

// ------------------------------------------------------- mapAuthResponse

test('mapAuthResponse unit table', () => {
  assert.deepEqual(
    mapAuthResponse({ status: 200, body: { principalId: UUID, agentId: AGENT_ID, principalStatus: 'active' } }),
    { kind: 'ok', principalId: UUID, agentId: AGENT_ID },
  )
  assert.equal(mapAuthResponse({ status: 200, body: { principalId: UUID, agentId: AGENT_ID, principalStatus: 'disabled' } }).kind, 'disabled')
  assert.equal(mapAuthResponse({ status: 200, body: null }).kind, 'error')
  assert.equal(mapAuthResponse({ status: 200, body: [1] }).kind, 'error')
  assert.equal(mapAuthResponse({ status: 404, body: { error: 'AGENT_NOT_FOUND' } }).code, 'agent_not_found')
})
