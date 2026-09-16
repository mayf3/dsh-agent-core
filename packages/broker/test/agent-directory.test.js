/**
 * AGENT_CORE_AGENT_DIRECTORY_TOOL_V1 — broker-layer tests for the
 * `agent_directory` LOCAL capability:
 *
 *   manifest  one capability, exactly two read-only operations, `local:
 *             true`, NO requiredScopes (= the accepted agent.definition.read
 *             baseline), closed error table (incl. internal_error declared
 *             so the child relay cannot mislabel a wiring fault as
 *             invalid_arguments), per-op schemas pinned (additionalProperties
 *             : false, nonBlank query)
 *   registry  DEFAULT_MANIFESTS carries the capability exactly once; the
 *             manifest builds into ONE model-facing tool with the operation
 *             enum { resolve, list }
 *   relay     child mode gets relay handlers automatically for a `local`
 *             manifest (no per-capability child code exists)
 *   gateway   the REAL gateway executes the capability through the injected
 *             local-handler provider for a CREDENTIALED caller; args and
 *             results are exactly the trusted provider's; unknown operation
 *             is unsupported_operation; an uncredentialed caller is
 *             credential_unavailable BEFORE any handler runs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  AGENT_DIRECTORY_CAPABILITY_ID,
  agentDirectoryManifest,
  manifests,
} from '../src/capabilities/agent-directory.js'
import { DEFAULT_MANIFESTS } from '../src/index.js'
import { createRelayHandlers } from '../src/relay.js'
import { createBrokerGateway } from '../src/gateway.js'
import { buildToolDefinition } from '../src/registry.js'
import { createAgentDirectoryAccess } from '../../production-runtime/src/agent-directory.js'

const CALLER = 'agt_dir-caller-agent'

const SNAPSHOT = [
  { id: 'agt_alpha', name: 'Alpha Agent', description: null, disabled: false },
  { id: 'agt_beta', name: 'Beta Ops', description: 'ops', disabled: false },
  { id: 'agt_dup1', name: 'Dup Name', description: null, disabled: false },
  { id: 'agt_dup2', name: 'Dup Name', description: null, disabled: true },
]

/** A minimal in-memory definition double (listAgents is the only seam). */
const definition = { listAgents: () => SNAPSHOT.map((a) => ({ ...a })) }
const provider = createAgentDirectoryAccess({ definition })

function tempCredentialsFile(t, entries) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-dir-broker-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'credentials.json')
  writeFileSync(file, `${JSON.stringify({ version: 1, credentials: entries }, null, 2)}\n`)
  return file
}

function gatewayFor(t, { credentials }) {
  return createBrokerGateway({
    manifests: [agentDirectoryManifest],
    targets: [],
    credentialsFile: tempCredentialsFile(t, credentials),
    localHandlerResolver: () => provider.handlers,
    log: () => {},
  })
}

test('manifest: one capability, exactly two read-only operations, local + no scope', () => {
  assert.deepEqual(manifests, [agentDirectoryManifest])
  assert.equal(AGENT_DIRECTORY_CAPABILITY_ID, 'agent.directory')
  assert.equal(agentDirectoryManifest.id, 'agent.directory')
  assert.equal(agentDirectoryManifest.toolName, 'agent_directory')
  assert.equal(agentDirectoryManifest.selector, 'operation')
  assert.equal(agentDirectoryManifest.local, true, 'local manifests get child relay + gateway dispatch automatically')
  assert.equal(agentDirectoryManifest.requiredScopes, undefined, 'read is open to every credentialed agent (definition-read baseline)')
  assert.deepEqual(agentDirectoryManifest.operations.map((o) => o.name), ['resolve', 'list'])
  for (const op of agentDirectoryManifest.operations) {
    assert.equal(op.result.type, 'json')
    assert.equal(op.http, undefined, 'LOCAL capability: no http binding')
  }
})

test('manifest: resolve takes exactly one non-blank query; list takes nothing', () => {
  const resolve = agentDirectoryManifest.operations[0]
  assert.equal(resolve.arguments.additionalProperties, false)
  assert.deepEqual(resolve.arguments.required, ['query'])
  assert.deepEqual(Object.keys(resolve.arguments.properties), ['query'])
  assert.equal(resolve.arguments.properties.query.type, 'string')
  assert.equal(resolve.arguments.properties.query.nonBlank, true, 'whitespace-only queries must fail the schema hint too')

  const list = agentDirectoryManifest.operations[1]
  assert.equal(list.arguments.additionalProperties, false)
  assert.deepEqual(list.arguments.required, [])
  assert.deepEqual(Object.keys(list.arguments.properties), [])
})

test('manifest: closed error table declares internal_error and the generic transport codes', () => {
  const codes = agentDirectoryManifest.errors.map((e) => e.code)
  assert.deepEqual([...new Set(codes)], [
    'invalid_arguments',
    'unsupported_operation',
    'internal_error',
    'credential_unavailable',
    'credential_invalid',
    'authorization_denied',
    'binding_error',
    'http_4xx',
    'http_5xx',
    'malformed_response',
    'transport_failure',
  ])
  // Undeclared handler-thrown codes are fail-closed downgraded to
  // invalid_arguments on the child relay — internal_error MUST be declared.
  assert.ok(codes.includes('internal_error'))
  // The status outcomes are RESULT payloads, never error codes.
  assert.equal(codes.includes('not_found'), false)
  assert.equal(codes.includes('ambiguous'), false)
})

test('registry: DEFAULT_MANIFESTS registers the directory exactly once', () => {
  const ids = DEFAULT_MANIFESTS.map((m) => m.id)
  assert.equal(ids.filter((id) => id === AGENT_DIRECTORY_CAPABILITY_ID).length, 1)
})

test('registry: the manifest builds ONE tool with the operation enum', () => {
  const { definition: tool } = buildToolDefinition({
    manifest: agentDirectoryManifest,
    handlers: provider.handlers[AGENT_DIRECTORY_CAPABILITY_ID],
  })
  assert.equal(tool.name, 'agent_directory')
  // defineTool per-property map: the operation selector is required with the
  // closed enum { resolve, list }.
  const operation = tool.parameters?.operation
  assert.notEqual(operation, undefined, 'the multi-operation dispatch parameter exists')
  assert.equal(operation.required, true)
  assert.deepEqual([...operation.enum].sort(), ['list', 'resolve'])
  assert.equal(typeof tool.execute, 'function')
})

test('relay: child mode derives relay handlers for the local manifest', () => {
  const handlers = createRelayHandlers(agentDirectoryManifest, async () => ({ ok: true, result: {} }))
  assert.equal(typeof handlers.resolve, 'function')
  assert.equal(typeof handlers.list, 'function')
})

test('gateway: resolve returns the trusted provider envelope for a credentialed caller', async (t) => {
  const gateway = gatewayFor(t, { credentials: { [CALLER]: { clientId: 'c', clientSecret: 's' } } })
  const envelope = await gateway.execute(
    { capabilityId: AGENT_DIRECTORY_CAPABILITY_ID, operation: 'resolve', args: { query: 'Beta Ops' } },
    { agentId: CALLER },
  )
  assert.deepEqual(envelope, {
    ok: true,
    result: { status: 'resolved', agent: { agentId: 'agt_beta', name: 'Beta Ops', description: 'ops', enabled: true } },
  })
})

test('gateway: list returns every agent including disabled, in snapshot order', async (t) => {
  const gateway = gatewayFor(t, { credentials: { [CALLER]: { clientId: 'c', clientSecret: 's' } } })
  const envelope = await gateway.execute(
    { capabilityId: AGENT_DIRECTORY_CAPABILITY_ID, operation: 'list', args: {} },
    { agentId: CALLER },
  )
  assert.equal(envelope.ok, true)
  assert.deepEqual(envelope.result.agents.map((a) => a.agentId), ['agt_alpha', 'agt_beta', 'agt_dup1', 'agt_dup2'])
  assert.deepEqual(envelope.result.agents.map((a) => a.enabled), [true, true, true, false])
})

test('gateway: handler authority — whitespace/extra-arg queries are invalid_arguments, never a status', async (t) => {
  const gateway = gatewayFor(t, { credentials: { [CALLER]: { clientId: 'c', clientSecret: 's' } } })
  for (const args of [{ query: '   ' }, { query: 'x', extra: 1 }, {}, { query: 7 }]) {
    const envelope = await gateway.execute(
      { capabilityId: AGENT_DIRECTORY_CAPABILITY_ID, operation: 'resolve', args },
      { agentId: CALLER },
    )
    assert.deepEqual([envelope.ok, envelope.error?.code], [false, 'invalid_arguments'], `args ${JSON.stringify(args)}`)
  }
  const listEnvelope = await gateway.execute(
    { capabilityId: AGENT_DIRECTORY_CAPABILITY_ID, operation: 'list', args: { junk: 1 } },
    { agentId: CALLER },
  )
  assert.deepEqual([listEnvelope.ok, listEnvelope.error?.code], [false, 'invalid_arguments'])
})

test('gateway: unknown operation is unsupported_operation (declared, not mislabeled)', async (t) => {
  const gateway = gatewayFor(t, { credentials: { [CALLER]: { clientId: 'c', clientSecret: 's' } } })
  const envelope = await gateway.execute(
    { capabilityId: AGENT_DIRECTORY_CAPABILITY_ID, operation: 'delete', args: {} },
    { agentId: CALLER },
  )
  assert.deepEqual([envelope.ok, envelope.error?.code], [false, 'unsupported_operation'])
})

test('gateway: uncredentialed caller is credential_unavailable BEFORE the handler runs', async (t) => {
  const gateway = gatewayFor(t, { credentials: { [CALLER]: { clientId: 'c', clientSecret: 's' } } })
  const envelope = await gateway.execute(
    { capabilityId: AGENT_DIRECTORY_CAPABILITY_ID, operation: 'resolve', args: { query: 'Alpha Agent' } },
    { agentId: 'agt_no-credential-agent' },
  )
  assert.deepEqual([envelope.ok, envelope.error?.code], [false, 'credential_unavailable'])
})

test('provider: construction fails loud without a listAgents-capable definition', () => {
  assert.throws(() => createAgentDirectoryAccess({}), /listAgents is required/)
  assert.throws(() => createAgentDirectoryAccess({ definition: { listAgents: 'nope' } }), /listAgents is required/)
})
