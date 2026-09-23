/**
 * SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 CTR-SCT-002 — registration and
 * manifest shape of the `agent_session_list` (MY_SESSIONS) capability:
 * zero-Auth self surface (no requiredScopes — the scheduler self-service /
 * agent-directory precedent), no identity argument (ownership comes from the
 * trusted gateway context), and a coordinate-only result contract.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_MANIFESTS } from '../../src/index.js'
import { manifests } from '../../src/capabilities/execution-history.js'

test('registry: agent_session_list is registered in DEFAULT_MANIFESTS exactly once', () => {
  const registered = DEFAULT_MANIFESTS.filter((m) => m.id === 'agent_session_list')
  assert.equal(registered.length, 1)
  const manifest = registered[0]
  assert.equal(manifest.toolName, 'agent_session_list')
  assert.equal(manifest.selector, 'operation')
})

test('CTR-SCT-002/D-SCT-2: the listing is a zero-Auth self surface with NO identity argument', () => {
  const manifest = manifests.find((m) => m.id === 'agent_session_list')
  assert.ok(manifest, 'manifest exported from the execution-history family')
  // Omitted requiredScopes (agent-directory precedent): the schema default is
  // [] and the gateway performs zero token requests for the self surface.
  assert.ok(!Array.isArray(manifest.requiredScopes) || manifest.requiredScopes.length === 0, 'zero token requests (self-only surface)')
  assert.equal(manifest.local, true)
  const list = manifest.operations.find((op) => op.name === 'list')
  assert.ok(list, 'list operation present')
  assert.deepEqual(list.arguments.required, [], 'no required arguments')
  assert.ok(!('agentId' in list.arguments.properties), 'no agentId argument — trusted identity only')
  assert.ok(!('sessionId' in list.arguments.properties), 'no enumeration-by-coordinate face')
  assert.equal(list.arguments.additionalProperties, false)
})

test('CTR-SCT-002: the error table is closed and fail-closed codes are declared', () => {
  const manifest = manifests.find((m) => m.id === 'agent_session_list')
  const codes = manifest.errors.map((e) => e.code)
  for (const expected of ['invalid_arguments', 'forbidden_not_owner', 'history_unavailable', 'unsupported_operation', 'internal_error']) {
    assert.ok(codes.includes(expected), `${expected} declared`)
  }
})
