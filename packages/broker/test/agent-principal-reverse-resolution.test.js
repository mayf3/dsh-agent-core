/**
 * AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1 — broker manifest tests:
 * the model-facing surface is exactly one read-only operation with exactly
 * one agentId argument, the local resource/scope naming matches the accepted
 * auth identity-directory audience, the error table is the closed CTR-APR-004
 * taxonomy, and the registration reaches DEFAULT_MANIFESTS (ACC-APR-001).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID,
  agentPrincipalReverseResolutionManifest,
  manifests,
} from '../src/capabilities/agent-principal-reverse-resolution.js'

test('manifest: one capability, one read-only operation, tool name fixed (no canonical claim)', () => {
  assert.deepEqual(manifests, [agentPrincipalReverseResolutionManifest])
  assert.equal(agentPrincipalReverseResolutionManifest.id, 'agent_resolve_principal_by_agent')
  assert.equal(AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID, 'agent_resolve_principal_by_agent')
  assert.equal(agentPrincipalReverseResolutionManifest.toolName, 'agent_resolve_principal_by_agent')
  assert.equal(agentPrincipalReverseResolutionManifest.selector, 'operation')
  assert.equal(agentPrincipalReverseResolutionManifest.local.resource, 'identity-directory')
  assert.deepEqual(agentPrincipalReverseResolutionManifest.requiredScopes, ['auth.directory.read'])
  assert.equal(agentPrincipalReverseResolutionManifest.operations.length, 1)
  const op = agentPrincipalReverseResolutionManifest.operations[0]
  assert.equal(op.name, 'resolve')
  assert.equal(op.result.type, 'json')
  // Owner semantic correction: the strict-canonical name must never appear.
  assert.ok(!JSON.stringify(agentPrincipalReverseResolutionManifest).includes('canonical_principal'))
  assert.ok(!agentPrincipalReverseResolutionManifest.toolName.includes('canonical'))
})

test('manifest: description carries the agent_directory-first consumer guidance', () => {
  const description = agentPrincipalReverseResolutionManifest.description
  assert.ok(description.includes('agent_directory'))
  assert.ok(/FIRST .*agent_directory/s.test(description))
  assert.ok(description.toLowerCase().includes('never guess'))
})

test('manifest: model-visible arguments are exactly { agentId } in the stored-id grammar (no caller/identity inputs)', () => {
  const { arguments: args } = agentPrincipalReverseResolutionManifest.operations[0]
  assert.equal(args.additionalProperties, false)
  assert.deepEqual(args.required, ['agentId'])
  assert.deepEqual(Object.keys(args.properties), ['agentId'])
  const agentId = args.properties.agentId
  assert.equal(agentId.type, 'string')
  assert.equal(agentId.minLength, 5)
  assert.equal(agentId.maxLength, 128)
  assert.equal(agentId.pattern, '^agt_[a-z0-9-]+$')
  // The schema hint admits no URL/audience/scope/credential/external_ref input.
  assert.ok(!JSON.stringify(args).includes('principalId'))
  assert.ok(!JSON.stringify(args).includes('url'))
  assert.ok(!JSON.stringify(args).includes('scope'))
})

test('manifest: error table is the closed CTR-APR-004 taxonomy', () => {
  const expected = [
    'invalid_arguments', 'credential_unavailable', 'credential_invalid', 'access_denied',
    'agent_not_found', 'principal_not_agent', 'principal_disabled',
    'identity_resolution_ambiguous', 'identity_resolution_unavailable',
    'target_not_found', 'target_disabled', 'transport_failure', 'unsupported_operation', 'internal_error',
  ]
  assert.deepEqual(agentPrincipalReverseResolutionManifest.errors.map((e) => e.code), expected)
  assert.deepEqual(
    agentPrincipalReverseResolutionManifest.operations[0].errors,
    expected,
    'operation errors mirror the table exactly',
  )
})

test('manifest is registered in DEFAULT_MANIFESTS exactly once (ACC-APR-001 registration)', async () => {
  const broker = await import('../src/index.js')
  const registered = broker.DEFAULT_MANIFESTS.filter((m) => m.id === 'agent_resolve_principal_by_agent')
  assert.equal(registered.length, 1)
  assert.equal(registered[0], agentPrincipalReverseResolutionManifest)
})
