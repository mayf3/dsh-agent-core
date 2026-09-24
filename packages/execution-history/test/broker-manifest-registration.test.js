/**
 * SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 CTR-SCT-002 — registration and
 * manifest shape of the `agent_session_list` (MY_SESSIONS) capability:
 * zero-Auth self surface (no requiredScopes — the scheduler self-service /
 * agent-directory precedent), no identity argument (ownership comes from the
 * trusted gateway context), and a coordinate-only result contract.
 *
 * broker/src/index.js (the registration entry) pulls the harness-only
 * `@deepseek-ai/dsh-tools` + `@deepseek-ai/schemastery` packages through its
 * import chain — the same constraint broker.test.js documents ("no historical
 * test imports index.js" outside its stubbed dynamic import). The manifest
 * FAMILY module (capabilities/execution-history.js) is dependency-free plain
 * data, so shape assertions import it directly and the registration wiring is
 * asserted at the source level: the family must flow through the
 * capabilities/manifests.js barrel into DEFAULT_MANIFESTS exactly once.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { manifests } from '../../broker/src/capabilities/execution-history.js'

const brokerSrc = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'broker', 'src')

test('registry: agent_session_list is registered in DEFAULT_MANIFESTS exactly once', () => {
  const entry = readFileSync(join(brokerSrc, 'index.js'), 'utf8')
  const spreads = entry.match(/\.\.\.executionHistoryManifests/g) ?? []
  assert.equal(spreads.length, 1, 'execution-history manifest family spread into DEFAULT_MANIFESTS exactly once')
  const barrel = readFileSync(join(brokerSrc, 'capabilities', 'manifests.js'), 'utf8')
  assert.ok(/executionHistoryManifests\s*\}\s*from\s*'\.\/execution-history\.js'/.test(barrel), 'barrel re-exports the execution-history family')
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
  for (const expected of ['invalid_arguments', 'forbidden_not_owner', 'history_unavailable', 'credential_unavailable', 'unsupported_operation', 'internal_error']) {
    assert.ok(codes.includes(expected), `${expected} declared`)
  }
})
