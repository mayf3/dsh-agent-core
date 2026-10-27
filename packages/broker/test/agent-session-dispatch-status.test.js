import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_MANIFESTS } from '../src/index.js'
import { validateManifest } from '../src/schema.js'
import { createRelayHandlers } from '../src/relay.js'
import { invoke } from '../src/mapping.js'
import * as manifests from '../src/capabilities/agent-session-messaging.js'

const TRACE = { targetAgentId: 'agt_target-agent', sessionId: 'main', messageId: 'owned' }
const DTO = { status: 'found', ...TRACE, resolvedTurnId: 7, turnState: 'completed', startedAt: 10, endedAt: 20,
  stopReason: { kind: 'completed', abortCause: null }, reply: { state: 'available', reference: { assistantMessageSeq: 4 } } }
function manifest() {
  assert.ok(manifests.agentSessionDispatchStatusManifest, 'new status manifest must exist')
  return manifests.agentSessionDispatchStatusManifest
}
async function call(requestFn, args = TRACE) {
  const spec = manifest()
  return invoke(spec, createRelayHandlers(spec, requestFn), { operation: 'status', args }, { resolvePrincipal: () => undefined })
}

test('ACC-008/012: status registers once with exact arguments and independent existing read scope', async () => {
  const spec = manifest()
  assert.equal(validateManifest(spec).ok, true)
  assert.equal(DEFAULT_MANIFESTS.filter(m => m.id === spec.id).length, 1)
  assert.deepEqual(spec.requiredScopes, ['agent.session.inspect_own_dispatch'])
  assert.equal(spec.local.resource, 'agent-session-messaging')
  let calls = 0
  const out = await call(async () => { calls += 1 }, { ...TRACE, callerAgentId: 'agt_spoof' })
  assert.equal(out.error.code, 'invalid_arguments')
  assert.equal(calls, 0)
})

test('ACC-012: status crosses the child relay exactly, with no caller identity or replay key', async () => {
  const requests = []
  const out = await call(async request => { requests.push(request); return { ok: true, result: { ok: true, result: DTO } } })
  assert.deepEqual(requests, [{ capabilityId: 'agent_session_dispatch_status', operation: 'status', args: TRACE }])
  assert.deepEqual(out, { ok: true, result: DTO })
})

test('ACC-012: lost read transport has one request, bounded sanitized error and no full-inspect fallback', async () => {
  const requests = []
  const out = await call(async request => { requests.push(request); throw new Error('/private/token=' + 'SECRET'.repeat(2000)) })
  assert.equal(out.error.code, 'transport_failure')
  assert.equal(requests.length, 1)
  assert.ok(Buffer.byteLength(JSON.stringify(out.error)) <= 4096)
  assert.equal(JSON.stringify(out).includes('SECRET'), false)
})

test('ACC-012: malformed/foreign/oversized parent success fails closed without changing old inspector', async () => {
  const variants = [null, { ...DTO, messageId: 'foreign' }, { ...DTO, body: 'secret' },
    { ...DTO, turnState: 'completed', stopReason: { kind: 'aborted', abortCause: 'disposed' } },
    { ...DTO, reply: { state: 'available', reference: { assistantMessageSeq: -1 } } },
    { ...DTO, startedAt: null }, { ...DTO, sessionId: 'x'.repeat(5000) }]
  for (const result of variants) {
    const out = await call(async () => ({ ok: true, result: { ok: true, result } }))
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'inspection_unavailable')
  }
})

test('ACC-012: declared error codes survive relay but raw error metadata never does', async () => {
  for (const code of ['invalid_arguments', 'credential_unavailable', 'credential_invalid', 'access_denied',
    'not_found_or_not_owned', 'trace_unresolvable', 'inspection_unavailable', 'internal_error', 'transport_failure', 'unsupported_operation']) {
    const out = await call(async () => ({ ok: true, result: { ok: false, error: { code, detail: '/private/' + 'SECRET'.repeat(2000), requestId: 'untrusted' } } }))
    assert.equal(out.error.code, code)
    assert.ok(Buffer.byteLength(JSON.stringify(out.error)) <= 4096)
    assert.equal(JSON.stringify(out).includes('SECRET'), false)
    assert.equal(JSON.stringify(out).includes('untrusted'), false)
  }
})
