import test from 'node:test'
import assert from 'node:assert/strict'

import { createOperationRegistry, defineOperation } from '../src/registry.js'
import { FixedOperationError, FIXED_OPERATION_ERRORS } from '../src/errors.js'
import { requireWorkflowTrustedContext } from '../src/trusted-context.js'
import { fixtureEcho, fixtureSum, spyOnDefinition, FIXTURE_TRUSTED_CONTEXT } from '../src/fixtures.js'

test('FIXED_OPERATION error table is exactly the five fail-closed classes', () => {
  assert.deepEqual(
    FIXED_OPERATION_ERRORS.map((e) => e.code),
    [
      'unknown_operation',
      'operation_version_mismatch',
      'operation_hash_mismatch',
      'invalid_arguments',
      'missing_trusted_context',
    ],
  )
  assert.throws(() => new FixedOperationError('sudo_pressed', 'not declared'), TypeError)
})

test('success: registered operation with valid args and trusted context returns a structured receipt', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = createOperationRegistry([echo.definition, fixtureSum])

  const outcome = registry.invoke(
    { operation: 'fixture.echo', version: '1.0.0', hash: echo.definition.hash, args: { message: 'hello' } },
    FIXTURE_TRUSTED_CONTEXT,
  )

  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.result, { echo: 'hello' })
  const receipt = outcome.receipt
  assert.deepEqual(receipt.operation, { key: 'fixture.echo', version: '1.0.0', hash: echo.definition.hash })
  assert.match(receipt.invocationId, /^opinv-[0-9a-f]{24}$/)
  assert.match(receipt.inputDigest, /^sha256:[0-9a-f]{64}$/)
  assert.deepEqual(receipt.workflow, FIXTURE_TRUSTED_CONTEXT)
  assert.equal(receipt.status, 'succeeded')
  assert.equal(typeof receipt.startedAt, 'string')
  assert.equal(typeof receipt.finishedAt, 'string')
  assert.equal(echo.calls.length, 1)
  assert.deepEqual(echo.calls[0].args, { message: 'hello' })
})

test('success: second fixture operation executes through the same gates', () => {
  const registry = createOperationRegistry([fixtureEcho, fixtureSum])
  const outcome = registry.invoke(
    { operation: 'fixture.sum', version: '1.0.0', hash: registry.get('fixture.sum').hash, args: { a: 2, b: 40 } },
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.result, { sum: 42 })
})

test('unknown operationKey fails closed without reaching any handler', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = createOperationRegistry([echo.definition])

  for (const operation of ['fixture.nuke', 'fixture.ech', 'FIXTURE.ECHO', '', 42, undefined, null]) {
    const outcome = registry.invoke(
      { operation, version: '1.0.0', hash: echo.definition.hash, args: { message: 'x' } },
      FIXTURE_TRUSTED_CONTEXT,
    )
    assert.equal(outcome.ok, false, `operation ${JSON.stringify(operation)} must fail`)
    assert.equal(outcome.error.code, 'unknown_operation')
  }
  assert.equal(echo.calls.length, 0)
})

test('version pin: missing or mismatched declared version fails closed before the handler', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = createOperationRegistry([echo.definition])

  for (const version of ['0.9.0', '1.0.1', undefined, null, '1.0.0-beta']) {
    const outcome = registry.invoke(
      { operation: 'fixture.echo', version, hash: echo.definition.hash, args: { message: 'x' } },
      FIXTURE_TRUSTED_CONTEXT,
    )
    assert.equal(outcome.ok, false, `version ${JSON.stringify(version)} must fail`)
    assert.equal(outcome.error.code, 'operation_version_mismatch')
  }
  assert.equal(echo.calls.length, 0)
})

test('hash pin: missing or tampered definition hash fails closed before the handler', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = createOperationRegistry([echo.definition])

  for (const hash of [`sha256:${'f'.repeat(64)}`, 'sha256:deadbeef', 'not-a-digest', undefined, null]) {
    const outcome = registry.invoke(
      { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'x' } },
      FIXTURE_TRUSTED_CONTEXT,
    )
    assert.equal(outcome.ok, false, `hash ${JSON.stringify(hash)} must fail`)
    assert.equal(outcome.error.code, 'operation_hash_mismatch')
  }
  assert.equal(echo.calls.length, 0)
})

test('definition hash is immutable over the contract surface: a schema change changes the hash', () => {
  const baseHash = createOperationRegistry([fixtureEcho]).get('fixture.echo').hash
  const widened = defineOperation({
    ...fixtureEcho,
    inputSchema: {
      ...fixtureEcho.inputSchema,
      properties: { ...fixtureEcho.inputSchema.properties, extra: { type: 'string' } },
    },
  })
  assert.notEqual(widened.hash, baseHash)
  // Same surface re-defined hashes identically: the hash pins the contract,
  // not the definition object identity.
  assert.equal(defineOperation({ ...fixtureEcho }).hash, baseHash)
})

test('invalid params: unknown, injected, missing and mistyped arguments all fail closed before the handler', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = createOperationRegistry([echo.definition, fixtureSum])
  const hash = registry.get('fixture.echo').hash
  const call = (args) => registry.invoke(
    { operation: 'fixture.echo', version: '1.0.0', hash, args },
    FIXTURE_TRUSTED_CONTEXT,
  )

  const scriptPath = call({ message: 'hi', scriptPath: '/etc/passwd' })
  assert.equal(scriptPath.ok, false)
  assert.equal(scriptPath.error.code, 'invalid_arguments')
  assert.match(scriptPath.error.detail, /scriptPath/)

  const shell = call({ message: 'hi', shell: 'rm -rf /' })
  assert.equal(shell.ok, false)
  assert.equal(shell.error.code, 'invalid_arguments')
  assert.match(shell.error.detail, /shell/)

  const arbitrary = call({ message: 'hi', code: 'process.exit(1)' })
  assert.equal(arbitrary.ok, false)
  assert.equal(arbitrary.error.code, 'invalid_arguments')

  const missing = call({})
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'invalid_arguments')
  assert.match(missing.error.detail, /missing required property "message"/)

  const wrongType = call({ message: 42 })
  assert.equal(wrongType.ok, false)
  assert.equal(wrongType.error.code, 'invalid_arguments')

  const blank = call({ message: '   ' })
  assert.equal(blank.ok, false)
  assert.equal(blank.error.code, 'invalid_arguments')

  const notAnObject = registry.invoke(
    { operation: 'fixture.echo', version: '1.0.0', hash, args: 'echo everything' },
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(notAnObject.ok, false)
  assert.equal(notAnObject.error.code, 'invalid_arguments')

  const sumHash = registry.get('fixture.sum').hash
  const integerViolation = registry.invoke(
    { operation: 'fixture.sum', version: '1.0.0', hash: sumHash, args: { a: 1.5, b: 2 } },
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(integerViolation.ok, false)
  assert.equal(integerViolation.error.code, 'invalid_arguments')

  assert.equal(echo.calls.length, 0)
})

test('missing trusted context: absent or malformed provenance fails closed before any registry fact is disclosed', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = createOperationRegistry([echo.definition])
  const hash = registry.get('fixture.echo').hash
  const call = (trustedContext) => registry.invoke(
    { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'x' } },
    trustedContext,
  )

  const bad = [
    undefined,
    null,
    {},
    { kind: 'workflow_execution' },
    { kind: 'inter_agent', sourceAgentId: 'agt_x', correlation: 'c' },
    { kind: 'workflow_execution', workflowInstanceId: 'not-a-uuid', nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId, attemptId: FIXTURE_TRUSTED_CONTEXT.attemptId },
    { kind: 'workflow_execution', workflowInstanceId: FIXTURE_TRUSTED_CONTEXT.workflowInstanceId, nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId },
    { kind: 'workflow_execution', workflowInstanceId: FIXTURE_TRUSTED_CONTEXT.workflowInstanceId, nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId, attemptId: 'deadbeef' },
    { kind: 'workflow_execution', workflowInstanceId: FIXTURE_TRUSTED_CONTEXT.workflowInstanceId, nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId, attemptId: FIXTURE_TRUSTED_CONTEXT.attemptId, extra: 'field' },
    'workflow_execution',
  ]
  for (const trustedContext of bad) {
    const outcome = call(trustedContext)
    assert.equal(outcome.ok, false, `context ${JSON.stringify(trustedContext)} must fail`)
    assert.equal(outcome.error.code, 'missing_trusted_context')
  }
  assert.equal(echo.calls.length, 0)
})

test('fail-closed ordering: trusted context is required even before unknown_operation is reported', () => {
  const registry = createOperationRegistry([fixtureEcho])
  const noContext = registry.invoke({ operation: 'fixture.nuke', version: '1.0.0', hash: 'sha256:x', args: {} }, undefined)
  assert.equal(noContext.ok, false)
  assert.equal(noContext.error.code, 'missing_trusted_context')

  const withContext = registry.invoke({ operation: 'fixture.nuke', version: '1.0.0', hash: 'sha256:x', args: {} }, FIXTURE_TRUSTED_CONTEXT)
  assert.equal(withContext.ok, false)
  assert.equal(withContext.error.code, 'unknown_operation')
})

test('registry authoring guards: duplicate keys, open schemas and bad definitions fail loud at construction', () => {
  assert.throws(() => createOperationRegistry([fixtureEcho, fixtureEcho]), /duplicate operation key/)
  assert.throws(() => createOperationRegistry([]), TypeError)
  assert.throws(() => defineOperation({ ...fixtureEcho, key: 'Fixture.Echo' }), /dotted lowercase key/)
  assert.throws(() => defineOperation({ ...fixtureEcho, version: '1.0' }), /semver/)
  assert.throws(() => defineOperation({ ...fixtureEcho, inputSchema: { ...fixtureEcho.inputSchema, additionalProperties: true } }), /additionalProperties must be false/)
  assert.throws(() => defineOperation({ ...fixtureEcho, handler: 'not a function' }), /handler must be a function/)
  assert.throws(() => defineOperation({ ...fixtureEcho, inputSchema: { ...fixtureEcho.inputSchema, required: ['ghost'] } }), /declared property names/)
})

test('registry and descriptors are frozen: no post-construction mutation path', () => {
  const registry = createOperationRegistry([fixtureEcho])
  assert.equal(Object.isFrozen(registry), true)
  const descriptor = registry.get('fixture.echo')
  assert.equal(Object.isFrozen(descriptor), true)
  assert.equal(Object.isFrozen(descriptor.inputSchema), true)
  assert.throws(() => { descriptor.version = '9.9.9' }, TypeError)
  assert.throws(() => { registry.extra = 'x' }, TypeError)
})

test('trusted context validator returns a frozen exact-shape copy', () => {
  const copy = requireWorkflowTrustedContext({ ...FIXTURE_TRUSTED_CONTEXT })
  assert.deepEqual(copy, FIXTURE_TRUSTED_CONTEXT)
  assert.equal(Object.isFrozen(copy), true)
  assert.notEqual(copy, FIXTURE_TRUSTED_CONTEXT)
})
