/**
 * AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1 — broker manifest tests:
 * the model-facing surface is exactly one read-only operation with exactly
 * one principalId argument, the local resource/scope naming matches the
 * accepted auth audience, and the error table is the closed CTR-EPAR-004
 * taxonomy (ASM naming alignment included).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID,
  agentPrincipalResolutionManifest,
  manifests,
} from '../src/capabilities/agent-principal-resolution.js'

test('manifest: one capability, one read-only operation, tool name fixed', () => {
  assert.deepEqual(manifests, [agentPrincipalResolutionManifest])
  assert.equal(agentPrincipalResolutionManifest.id, 'agent_resolve_principal')
  assert.equal(AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID, 'agent_resolve_principal')
  assert.equal(agentPrincipalResolutionManifest.toolName, 'agent_resolve_principal')
  assert.equal(agentPrincipalResolutionManifest.selector, 'operation')
  assert.equal(agentPrincipalResolutionManifest.local.resource, 'agent-principal-resolution')
  assert.deepEqual(agentPrincipalResolutionManifest.requiredScopes, ['auth.agent.resolve'])
  assert.equal(agentPrincipalResolutionManifest.operations.length, 1)
  const op = agentPrincipalResolutionManifest.operations[0]
  assert.equal(op.name, 'resolve')
  assert.equal(op.result.type, 'json')
})

test('manifest: model-visible arguments are exactly { principalId } (no caller/identity inputs)', () => {
  const { arguments: args } = agentPrincipalResolutionManifest.operations[0]
  assert.equal(args.additionalProperties, false)
  assert.deepEqual(args.required, ['principalId'])
  assert.deepEqual(Object.keys(args.properties), ['principalId'])
  const principalId = args.properties.principalId
  assert.equal(principalId.type, 'string')
  assert.equal(principalId.minLength, 36)
  assert.equal(principalId.maxLength, 36)
})

test('manifest: error table is the closed CTR-EPAR-004 taxonomy', () => {
  const codes = agentPrincipalResolutionManifest.errors.map((e) => e.code)
  assert.deepEqual([...new Set(codes)].sort(), [
    'access_denied',
    'agent_mapping_missing',
    'credential_invalid',
    'credential_unavailable',
    'identity_resolution_ambiguous',
    'identity_resolution_unavailable',
    'internal_error',
    'invalid_arguments',
    'principal_disabled',
    'principal_not_agent',
    'principal_not_found',
    'target_disabled',
    'target_not_found',
    'transport_failure',
    'unsupported_operation',
  ])
  // ASM naming alignment: the broker-layer credential-absence code is
  // credential_unavailable (never credential_missing).
  assert.equal(codes.includes('credential_missing'), false)
  // Each operation row re-declares exactly the table's codes.
  const op = agentPrincipalResolutionManifest.operations[0]
  assert.deepEqual(op.errors, codes)
})
