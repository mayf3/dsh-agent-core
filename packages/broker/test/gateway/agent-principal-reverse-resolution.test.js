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
} from '../../src/capabilities/agent-principal-reverse-resolution.js'

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
  const broker = await import('../../src/index.js')
  const registered = broker.DEFAULT_MANIFESTS.filter((m) => m.id === 'agent_resolve_principal_by_agent')
  assert.equal(registered.length, 1)
  assert.equal(registered[0], agentPrincipalReverseResolutionManifest)
})

// CTR-APR-004 unsupported_operation wiring regression: the manifest, the
// provider service and the gateway must agree on ONE execute-time resolver
// closure. A provider that exists and is provided but is missing from the
// gateway's local-handler resolution must surface as exactly the closed
// `unsupported_operation` emission through the REAL applyBroker gateway path
// (applyBroker -> ctx.provide('brokerGateway') -> gateway.execute) — never a
// fabricated success, never a crash of the parent RPC.
test('gateway wiring: applyBroker gateway mode admits the provided agentPrincipalReverseResolutionAccess handlers', async (t) => {
  const { createServer } = await import('node:http')
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const broker = await import('../../src/index.js')

  // In-process auth-service token endpoint: the gateway's requiredScopes
  // grant check must succeed so the call reaches the local handler.
  const tokenServer = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: 'jwt-wired-caller', expires_in: 3600 }))
    })
  })
  await new Promise((r) => tokenServer.listen(0, '127.0.0.1', r))
  t.after(() => new Promise((r) => tokenServer.close(r)))

  const dir = await mkdtemp(join(tmpdir(), 'acb-reverse-wiring-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = join(dir, 'agent-credentials.json')
  await writeFile(store, JSON.stringify({
    version: 1,
    credentials: { agt_wired_caller: { clientId: 'client-wired', clientSecret: 'secret-wired' } },
  }, null, 2))

  const seen = []
  const provider = {
    handlers: {
      [AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID]: {
        resolve: async (args, context) => {
          seen.push({ args, caller: context?.callerAgentId })
          return { ok: true, result: { agentId: args.agentId, principalId: '00000000-0000-4000-8000-000000000001' } }
        },
      },
    },
  }
  const provided = {}
  const ctx = {
    get: (name) => (name === 'agentPrincipalReverseResolutionAccess' ? provider : undefined),
    provide: (name, value) => { provided[name] = value },
  }

  broker.apply(ctx, {
    mode: 'gateway',
    credentialsFile: store,
    authServiceOrigin: `http://127.0.0.1:${tokenServer.address().port}`,
    // DSH_AGENT_CORE_MODULARITY_PHASE_A_V1: the composition owns the LOCAL
    // provider enumeration and injects it through resolveLocalHandlers —
    // the exact shape production compose.js uses (execute-time resolution).
    resolveLocalHandlers: () => ({
      ...(ctx.get('agentPrincipalReverseResolutionAccess')?.handlers ?? {}),
    }),
  })
  const gateway = provided.brokerGateway
  assert.notEqual(gateway, undefined, 'gateway mode provides brokerGateway')

  const result = await gateway.execute({
    capabilityId: AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID,
    operation: 'resolve',
    args: { agentId: 'agt_wired-target' },
  }, { agentId: 'agt_wired_caller' })
  assert.deepEqual(result, {
    ok: true,
    result: { agentId: 'agt_wired-target', principalId: '00000000-0000-4000-8000-000000000001' },
  })
  assert.deepEqual(seen, [{ args: { agentId: 'agt_wired-target' }, caller: 'agt_wired_caller' }],
    'the handler ran once, with the gateway-frozen ACTUAL caller (never model args)')
})
