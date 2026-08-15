/**
 * Unit tests for @agent-core/broker/src/relay.js — the child-side broker
 * RELAY (trusted credential broker model).
 *
 * Pins: the relay forwards exactly { capabilityId, operation, args } over
 * the parent-RPC channel, never reads identity from the model/args, and
 * unwraps the parent's wire shape into the local invoke conventions so the
 * model-visible envelope is byte-identical to direct execution.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createRelayHandlers } from '../src/relay.js'
import { invoke } from '../src/mapping.js'
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

function run(handlers, operation, args) {
  return invoke(manifest, handlers, { operation, args }, { resolvePrincipal: () => undefined })
}

test('relay forwards exactly {capabilityId, operation, args} and unwraps both envelopes', async () => {
  const calls = []
  const handlers = createRelayHandlers(manifest, async (call) => {
    calls.push(call)
    // transport envelope: { ok: true, result: <invoke shape> }
    return { ok: true, result: { ok: true, result: { items: ['x'] } } }
  })
  const result = await run(handlers, 'op', { q: 'hello' })
  assert.deepEqual(calls, [{ capabilityId: 'test.capability', operation: 'op', args: { q: 'hello' } }])
  assert.deepEqual(result, { ok: true, result: { items: ['x'] } })
})

test('relay reshapes parent failure into {errorCode, status, detail}', async () => {
  const handlers = createRelayHandlers(manifest, async () => ({
    ok: true,
    result: {
      ok: false,
      error: { code: 'credential_unavailable', status: 401, detail: 'no MachineClient credential bound' },
    },
  }))
  const result = await run(handlers, 'op', {})
  assert.deepEqual(result, {
    ok: false,
    error: { code: 'credential_unavailable', status: 401, detail: 'no MachineClient credential bound' },
  })
})

test('relay fails closed when the parent returned nothing', async () => {
  const handlers = createRelayHandlers(manifest, async () => undefined)
  const result = await run(handlers, 'op', {})
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'invalid_arguments')
})

test('relay fails closed with detail when the RPC channel rejects', async () => {
  const handlers = createRelayHandlers(manifest, async () => { throw new Error('channel died') })
  const result = await run(handlers, 'op', {})
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'invalid_arguments')
  assert.match(result.error.detail, /broker relay failed: channel died/)
})

test('relay never forwards identity fields (model args carry none; call is fixed)', async () => {
  const calls = []
  const handlers = createRelayHandlers(manifest, async (call) => {
    calls.push(call)
    return { ok: true, result: 'ok' }
  })
  await run(handlers, 'op', {
    q: 'x',
    agentId: 'B', principalId: 'B', clientId: 'forged', scope: ['*'], audience: 'svc-forum', authorization: 'Bearer forged',
  })
  // The relay call body is exactly the fixed triple; identity-ish model args
  // stay inside `args` (the parent re-validates against the manifest schema
  // and ignores undeclared fields — the transport never reads them).
  assert.deepEqual(Object.keys(calls[0]).sort(), ['args', 'capabilityId', 'operation'])
  assert.deepEqual(calls[0].args.q, 'x')
})

test('relay with no parent-RPC channel fails closed', async () => {
  const handlers = createRelayHandlers(manifest, () => Promise.resolve({
    ok: true,
    result: { ok: false, error: { code: 'invalid_arguments', detail: 'broker relay unavailable: no parent-RPC channel' } },
  }))
  const result = await run(handlers, 'op', {})
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'invalid_arguments')
  assert.match(result.error.detail, /broker relay unavailable/)
})
