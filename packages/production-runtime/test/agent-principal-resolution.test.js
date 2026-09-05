/**
 * AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1 — trusted provider tests
 * (table-driven, isolated): the composed Auth-read + local-Definition
 * validation must be exact, fail-closed on every documented family, and
 * strictly read-only with no retry and no secret-bearing surface.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createAgentPrincipalResolutionAccess,
  mapAuthResponse,
  validateResolveArgs,
} from '../src/agent-principal-resolution.js'
import { AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID } from '../../broker/src/capabilities/agent-principal-resolution.js'

const UUID = '0f1e2d3c-4b5a-4968-8776-65a4b3c2d1e0'
const AGENT_ID = 'agt_blog-agent'
const ORIGIN = 'https://auth.example.test'

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
  body = { principalId: UUID, agentId: AGENT_ID },
  rawBody,
  definition: def = definition(),
  token = { accessToken: 'tok' },
  tokenError,
} = {}) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    if (rawBody !== undefined) {
      return { status, json: async () => { throw new Error('not json') } }
    }
    return { status, json: async () => body }
  }
  const provider = createAgentPrincipalResolutionAccess({
    definition: def,
    authServiceOrigin: ORIGIN,
    acquireCallerToken: async () => {
      if (tokenError !== undefined) throw tokenError
      return token
    },
    fetchImpl,
  })
  return { provider, calls }
}

function resolve(provider, args = { principalId: UUID }) {
  return provider.handlers[AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID]
    .resolve(args, { callerAgentId: 'agt_hr-agent', sourceTurnExecutionId: 't1' })
}

// ---------------------------------------------------------------- validation

test('args: exactly one UUID principalId; everything else is invalid_arguments before any transport', async () => {
  for (const [args, label] of [
    [undefined, 'missing args'],
    [null, 'null args'],
    ['x', 'string args'],
    [{}, 'empty args'],
    [{ principalId: UUID, extra: 1 }, 'extra field'],
    [{ principalId: '  ' + UUID + '  ' }, 'padded uuid must not be trimmed'],
    [{ principalId: UUID.slice(0, 35) }, 'short uuid'],
    [{ principalId: UUID.replace('-', '') }, 'unformatted uuid'],
    [{ agentId: AGENT_ID }, 'wrong field name'],
    [{ principalId: 42 }, 'non-string'],
  ]) {
    assert.equal(validateResolveArgs(args).ok, false, label)
  }
  assert.equal(validateResolveArgs({ principalId: UUID.toUpperCase() }).ok, true, 'hex case is equivalent')
})

test('trusted caller identity comes only from the gateway context', async () => {
  const { provider, calls } = makeProvider()
  const denied = await provider.handlers[AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID]
    .resolve({ principalId: UUID }, {})
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'internal_error')
  assert.equal(calls.length, 0)
})

// ------------------------------------------------------------------- success

test('success: exact enabled target returns exactly {principalId, agentId}; token never surfaces', async () => {
  const { provider, calls } = makeProvider()
  const res = await resolve(provider)
  assert.equal(res.ok, true)
  assert.deepEqual(Object.keys(res.result), ['principalId', 'agentId'])
  assert.equal(res.result.principalId, UUID)
  assert.equal(res.result.agentId, AGENT_ID)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `${ORIGIN}/api/v1/agent-principals/${UUID}/agent`)
  assert.equal(calls[0].init.method, 'GET')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok')
  assert.equal(calls[0].init.redirect, 'error', 'redirects are rejected at the transport')
})

test('success: uppercase request UUID matches the canonical lowercase auth answer', async () => {
  const { provider } = makeProvider()
  const res = await resolve(provider, { principalId: UUID.toUpperCase() })
  assert.equal(res.ok, true)
  assert.equal(res.result.principalId, UUID)
})

// ------------------------------------------------------- auth error taxonomy

test('auth target errors map to the closed lowercase codes', async () => {
  const cases = [
    [404, { error: 'PRINCIPAL_NOT_FOUND' }, 'principal_not_found'],
    [422, { error: 'PRINCIPAL_NOT_AGENT' }, 'principal_not_agent'],
    [409, { error: 'PRINCIPAL_DISABLED' }, 'principal_disabled'],
    [409, { error: 'AGENT_MAPPING_MISSING' }, 'agent_mapping_missing'],
    [409, { error: 'IDENTITY_RESOLUTION_AMBIGUOUS' }, 'identity_resolution_ambiguous'],
    [401, { error: 'UNAUTHORIZED' }, 'credential_invalid'],
    [403, { error: 'ACCESS_DENIED' }, 'access_denied'],
    [500, { error: 'IDENTITY_RESOLUTION_QUERY_FAILED' }, 'identity_resolution_unavailable'],
    [504, { error: 'IDENTITY_RESOLUTION_TIMEOUT' }, 'identity_resolution_unavailable'],
    [502, {}, 'identity_resolution_unavailable'],
  ]
  for (const [status, body, expected] of cases) {
    const { provider } = makeProvider({ status, body })
    const res = await resolve(provider)
    assert.equal(res.ok, false, `status ${status}`)
    assert.equal(res.error.code, expected, `status ${status}`)
  }
})

test('malformed auth answers never become success or fabricated absence', async () => {
  const cases = [
    [{ principalId: UUID }, 'missing agentId field'],
    [{ agentId: AGENT_ID }, 'missing principalId field'],
    [{ principalId: UUID, agentId: AGENT_ID, extra: 1 }, 'extra response field'],
    [{ principalId: 'not-a-uuid', agentId: AGENT_ID }, 'non-UUID echo'],
    [{ principalId: UUID, agentId: 'Blog Agent' }, 'display-name agentId violates grammar'],
    [{ principalId: UUID, agentId: 'AGT_BLOG-AGENT' }, 'uppercase agentId (stored ids are lowercase)'],
    [{ principalId: UUID, agentId: `agt_${'a'.repeat(129)}` }, 'over-long agentId (129 > 128)'],
    ['string body', 'non-object body'],
  ]
  for (const [body, label] of cases) {
    const { provider } = makeProvider({ status: 200, body })
    const res = await resolve(provider)
    assert.equal(res.ok, false, label)
    assert.equal(res.error.code, 'identity_resolution_unavailable', label)
  }
  const { provider } = makeProvider({ status: 200, rawBody: 'not-json' })
  const res = await resolve(provider)
  assert.equal(res.error.code, 'identity_resolution_unavailable', 'non-JSON 200 body')
})

// ------------------------------------------------- local definition validation

test('a public auth answer alone never succeeds: local exact-ID + enabled check', async () => {
  const missing = makeProvider({ definition: definition({ missing: true }) })
  const res = await resolve(missing.provider)
  assert.equal(res.error.code, 'target_not_found')

  const disabled = makeProvider({ definition: definition({ disabled: true }) })
  const res2 = await resolve(disabled.provider)
  assert.equal(res2.error.code, 'target_disabled')

  const mismatch = makeProvider({ body: { principalId: UUID, agentId: 'agt_other-agent' } })
  const res3 = await resolve(mismatch.provider)
  assert.equal(res3.error.code, 'target_not_found', 'auth agentId must be looked up exactly, not matched by name')
})

// ------------------------------------------------------------ token failures

test('token acquisition failures preserve the broker responsibility codes', async () => {
  for (const code of ['credential_unavailable', 'credential_invalid', 'access_denied', 'transport_failure']) {
    const { provider, calls } = makeProvider({ tokenError: Object.assign(new Error('x'), { code }) })
    const res = await resolve(provider)
    assert.equal(res.error.code, code, code)
    assert.equal(calls.length, 0, 'no auth read without a token')
  }
  const weird = makeProvider({ tokenError: new Error('mystery') })
  const res = await resolve(weird.provider)
  assert.equal(res.error.code, 'transport_failure', 'unknown token errors fail closed to transport_failure')
  const noToken = makeProvider({ token: { accessToken: '' } })
  const res2 = await resolve(noToken.provider)
  assert.equal(res2.error.code, 'transport_failure')
})

// --------------------------------------------------------- no retry, bounded

test('no automatic retry: a 500 is surfaced as-is with exactly one auth read', async () => {
  const { provider, calls } = makeProvider({ status: 500, body: {} })
  await resolve(provider)
  await resolve(provider)
  assert.equal(calls.length, 2, 'two independent calls, each one read — never an internal retry')
})

test('constructor: provider seams and bounded deadline are enforced', () => {
  const base = { definition: definition(), authServiceOrigin: ORIGIN, acquireCallerToken: async () => ({ accessToken: 't' }) }
  assert.throws(() => createAgentPrincipalResolutionAccess({ ...base, definition: undefined }), /definition with getAgent/)
  assert.throws(() => createAgentPrincipalResolutionAccess({ ...base, authServiceOrigin: '' }), /authServiceOrigin/)
  assert.throws(() => createAgentPrincipalResolutionAccess({ ...base, acquireCallerToken: undefined }), /acquireCallerToken/)
  assert.throws(() => createAgentPrincipalResolutionAccess({ ...base, timeoutMs: 5001 }), /timeoutMs/)
  assert.throws(() => createAgentPrincipalResolutionAccess({ ...base, timeoutMs: 0 }), /timeoutMs/)
})

test('mapAuthResponse: unit coverage of the closed mapping table', () => {
  assert.equal(mapAuthResponse({ status: 200, body: { principalId: UUID, agentId: AGENT_ID } }).kind, 'ok')
  const unavailable = mapAuthResponse({ status: 503, body: undefined })
  assert.equal(unavailable.code, 'identity_resolution_unavailable')
})

test('read-only: the handler performs no definition mutations and exposes no credentials', async () => {
  const seen = []
  const def = definition()
  const provider = createAgentPrincipalResolutionAccess({
    definition: { ...def, getAgent: (id) => { seen.push(id); return def.getAgent(id) } },
    authServiceOrigin: ORIGIN,
    acquireCallerToken: async () => ({ accessToken: 'sekret' }),
    fetchImpl: async () => ({ status: 200, json: async () => ({ principalId: UUID, agentId: AGENT_ID }) }),
  })
  const res = await resolve(provider)
  assert.equal(res.ok, true)
  assert.equal(JSON.stringify(res).includes('sekret'), false, 'no token in any surface')
  assert.deepEqual(seen, [AGENT_ID], 'exactly one exact definition read')
})
