import test from 'node:test'
import assert from 'node:assert/strict'

// Vertical evidence: the fixture registry's model-facing surface is proven
// against the REAL broker machinery (manifest validation, tool definition
// building, invocation validation) — the same code paths that gate every
// production capability. Nothing here mutates broker state or registers the
// manifest in DEFAULT_MANIFESTS.
import { validateManifest } from '../../broker/src/schema.js'
import { validateInvocation, resolveCode } from '../../broker/src/mapping.js'
import { buildToolDefinition } from '../../broker/src/registry.js'

import { createOperationRegistry } from '../src/registry.js'
import { FIXED_OPERATION_ERRORS } from '../src/errors.js'
import { fixtureEcho, fixtureSum, spyOnDefinition, FIXTURE_TRUSTED_CONTEXT } from '../src/fixtures.js'

const OPERATION_WIRE_NAMES = { 'fixture.echo': 'fixture_echo', 'fixture.sum': 'fixture_sum' }

function buildFixedOpsManifest(registry) {
  const catalog = registry.describeForModel()
  // The five fail-closed FIXED_OPERATION codes PLUS the broker selector-level
  // code: declaring `unsupported_operation` makes validateInvocation report it
  // for an unregistered operation instead of downgrading to invalid_arguments.
  const errorCodes = ['unsupported_operation', ...FIXED_OPERATION_ERRORS.map((e) => e.code)]
  const errors = [
    { code: 'unsupported_operation', description: 'the selected operation is not registered' },
    ...FIXED_OPERATION_ERRORS.map((e) => ({ code: e.code, description: e.description })),
  ]
  return {
    id: 'fixed_ops',
    toolName: 'fixed_ops',
    description: 'FIXED_OPERATION_V1 candidate fixture surface: select a registered operation, pin its version and definition hash, fill only the declared arguments.',
    selector: 'operation',
    local: true,
    errors,
    operations: catalog.operations.map((op) => ({
      name: OPERATION_WIRE_NAMES[op.key],
      description: `${op.description} Pinned: version ${op.version}, definition ${op.hash}.`,
      arguments: { ...op.arguments, structuralDiagnostics: true },
      errors: errorCodes,
    })),
  }
}

test('LLM surface: the registry-derived manifest passes real broker manifest validation', () => {
  const registry = createOperationRegistry([fixtureEcho, fixtureSum])
  const manifest = buildFixedOpsManifest(registry)
  const result = validateManifest(manifest)
  assert.equal(result.ok, true, result.errors?.join('; '))
})

test('LLM surface: tool definition offers ONLY registered operations and no code-execution parameters', () => {
  const registry = createOperationRegistry([fixtureEcho, fixtureSum])
  const manifest = buildFixedOpsManifest(registry)
  const { definition: tool } = buildToolDefinition({ manifest, handlers: {} })

  const selector = tool.parameters.operation
  assert.equal(selector.type, 'string')
  assert.equal(selector.required, true)
  assert.deepEqual(selector.enum, ['fixture_echo', 'fixture_sum'])

  for (const forbidden of ['scriptPath', 'shell', 'code', 'command', 'script', 'sudo']) {
    assert.equal(Object.hasOwn(tool.parameters, forbidden), false, `tool parameters must not expose "${forbidden}"`)
  }
  assert.match(tool.description, /FIXED_OPERATION_V1/)
})

test('LLM surface: real broker invocation validation rejects operation smuggling before any handler', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = createOperationRegistry([echo.definition])
  const manifest = buildFixedOpsManifest(registry)

  const injected = validateInvocation(manifest, { operation: 'fixture_echo', args: { message: 'hi', scriptPath: '/etc/passwd' } })
  assert.equal(injected.ok, false)
  assert.equal(injected.error.code, 'invalid_arguments')
  assert.match(injected.error.detail, /scriptPath/)

  const shell = validateInvocation(manifest, { operation: 'fixture_echo', args: { message: 'hi', shell: 'rm -rf /' } })
  assert.equal(shell.ok, false)
  assert.equal(shell.error.code, 'invalid_arguments')

  // `unsupported_operation` is declared in the manifest error table, so the
  // broker reports it directly for an unregistered operation instead of
  // downgrading to invalid_arguments. The registry layer's precise code for
  // an unknown key remains `unknown_operation` (fixed-operation.test.js).
  const unknown = validateInvocation(manifest, { operation: 'not_registered', args: {} })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'unsupported_operation')

  const valid = validateInvocation(manifest, { operation: 'fixture_echo', args: { message: 'hi' } })
  assert.equal(valid.ok, true)
  assert.equal(echo.calls.length, 0, 'validateInvocation only validates; no handler runs')
})

test('LLM surface: runtime registry enforcement agrees with the broker-declared schema', () => {
  const registry = createOperationRegistry([fixtureEcho])
  const hash = registry.get('fixture.echo').hash

  const smuggled = registry.invoke(
    { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hi', scriptPath: '/etc/passwd' } },
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(smuggled.ok, false)
  assert.equal(smuggled.error.code, 'invalid_arguments')
})

test('LLM surface: all five fail-closed codes are declared on the manifest; undeclared codes cannot reach the wire', () => {
  const registry = createOperationRegistry([fixtureEcho])
  const manifest = buildFixedOpsManifest(registry)

  for (const { code } of FIXED_OPERATION_ERRORS) {
    assert.deepEqual(resolveCode(manifest, code), { code })
  }
  // Broker resolveCode discipline: an undeclared code downgrades to the
  // declared fallback, so a handler can never invent a wire code.
  assert.deepEqual(resolveCode(manifest, 'sudo_pressed', 'invalid_arguments'), { code: 'invalid_arguments' })
})
