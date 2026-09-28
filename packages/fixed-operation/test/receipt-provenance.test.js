import test from 'node:test'
import assert from 'node:assert/strict'

import { canonicalDigest, canonicalJSON, sha256Hex } from '../src/canonical.js'
import { createOperationRegistry, defineOperation } from '../src/registry.js'
import { fixtureEcho, fixtureSum, spyOnDefinition, FIXTURE_TRUSTED_CONTEXT } from '../src/fixtures.js'

function makeRegistry(echoSpy) {
  return createOperationRegistry([echoSpy.definition, fixtureSum])
}

function invokeEcho(registry, echoHash, args, trustedContext = FIXTURE_TRUSTED_CONTEXT) {
  return registry.invoke(
    { operation: 'fixture.echo', version: '1.0.0', hash: echoHash, args },
    trustedContext,
  )
}

test('receipt provenance: operation block carries the registry-computed immutable digest of {key, version, inputSchema}', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = makeRegistry(echo)
  const descriptor = registry.get('fixture.echo')
  const expectedHash = canonicalDigest({ key: 'fixture.echo', version: '1.0.0', inputSchema: descriptor.inputSchema })

  assert.equal(descriptor.hash, expectedHash)
  const outcome = invokeEcho(registry, descriptor.hash, { message: 'hello' })
  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.receipt.operation, { key: 'fixture.echo', version: '1.0.0', hash: expectedHash })
})

test('receipt provenance: inputDigest is the canonical digest of the exact args and is order-insensitive', () => {
  const registry = createOperationRegistry([fixtureSum])
  const sum = registry.get('fixture.sum')
  const first = registry.invoke({ operation: 'fixture.sum', version: '1.0.0', hash: sum.hash, args: { a: 2, b: 3 } }, FIXTURE_TRUSTED_CONTEXT)
  const reordered = registry.invoke({ operation: 'fixture.sum', version: '1.0.0', hash: sum.hash, args: { b: 3, a: 2 } }, FIXTURE_TRUSTED_CONTEXT)

  assert.equal(first.ok, true)
  assert.equal(reordered.ok, true)
  assert.equal(first.receipt.inputDigest, canonicalDigest({ a: 2, b: 3 }))
  assert.equal(first.receipt.inputDigest, reordered.receipt.inputDigest)
  assert.notEqual(first.receipt.inputDigest, canonicalDigest({ a: 2, b: 4 }))
})

test('receipt provenance: invocationId is a stable pure digest of pinned definition + input digest + workflow coordinates', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = makeRegistry(echo)
  const hash = registry.get('fixture.echo').hash

  const one = invokeEcho(registry, hash, { message: 'hello' })
  const two = invokeEcho(registry, hash, { message: 'hello' })
  assert.equal(one.receipt.invocationId, two.receipt.invocationId)
  const expectedId = `opinv-${sha256Hex(canonicalJSON({
    operation: 'fixture.echo',
    version: '1.0.0',
    hash,
    inputDigest: one.receipt.inputDigest,
    workflow: FIXTURE_TRUSTED_CONTEXT,
  })).slice(0, 24)}`
  assert.equal(one.receipt.invocationId, expectedId)

  // Different args -> different invocation id.
  const otherArgs = invokeEcho(registry, hash, { message: 'goodbye' })
  assert.notEqual(otherArgs.receipt.invocationId, one.receipt.invocationId)

  // Different trusted workflow coordinates -> different invocation id.
  const otherWorkflow = {
    kind: 'workflow_execution',
    workflowInstanceId: 'c9d8e7f6-0000-4000-8000-000000000003',
    nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId,
    attemptId: `wfeat-${'b'.repeat(24)}`,
  }
  const otherCoords = invokeEcho(registry, hash, { message: 'hello' }, otherWorkflow)
  assert.equal(otherCoords.ok, true)
  assert.notEqual(otherCoords.receipt.invocationId, one.receipt.invocationId)

  // Different pinned definition (version bump, same schema) -> different invocation id.
  const bumped = createOperationRegistry([{ ...fixtureEcho, version: '1.0.1' }])
  const bumpedOutcome = bumped.invoke(
    { operation: 'fixture.echo', version: '1.0.1', hash: bumped.get('fixture.echo').hash, args: { message: 'hello' } },
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(bumpedOutcome.ok, true)
  assert.notEqual(bumpedOutcome.receipt.invocationId, one.receipt.invocationId)
  assert.notEqual(bumpedOutcome.receipt.operation.hash, hash)
})

test('receipt provenance: workflow coordinates come from the trusted context only, never from model args', () => {
  const echo = spyOnDefinition(fixtureEcho)
  const registry = makeRegistry(echo)
  const hash = registry.get('fixture.echo').hash

  const outcome = invokeEcho(registry, hash, {
    message: 'hello',
    workflowInstanceId: 'ffffffff-0000-4000-8000-000000000004',
    attemptId: `wfeat-${'c'.repeat(24)}`,
  })
  // scriptPath-style coordinate smuggling is rejected as invalid_arguments
  // before the handler; the receipt keeps the trusted-context coordinates.
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'invalid_arguments')

  const clean = invokeEcho(registry, hash, { message: 'hello' })
  assert.deepEqual(clean.receipt.workflow, FIXTURE_TRUSTED_CONTEXT)
})

test('receipt provenance: handler output cannot forge or override receipt fields', () => {
  const forger = defineOperation({
    ...fixtureEcho,
    handler: () => ({ receipt: { status: 'succeeded', operation: { key: 'fixture.echo', version: '9.9.9', hash: 'sha256:fake' } }, invocationId: 'opinv-forged' }),
  })
  const registry = createOperationRegistry([forger])
  const outcome = registry.invoke(
    { operation: 'fixture.echo', version: '1.0.0', hash: registry.get('fixture.echo').hash, args: { message: 'hi' } },
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(outcome.ok, true)
  assert.equal(outcome.receipt.invocationId.startsWith('opinv-'), true)
  assert.notEqual(outcome.receipt.invocationId, 'opinv-forged')
  assert.equal(outcome.receipt.operation.version, '1.0.0')
  assert.equal(outcome.receipt.status, 'succeeded')
  assert.match(outcome.receipt.operation.hash, /^sha256:[0-9a-f]{64}$/)
})

test('receipt is deeply frozen; timestamps are ordered ISO instants', () => {
  const registry = createOperationRegistry([fixtureEcho])
  const outcome = invokeEcho(registry, registry.get('fixture.echo').hash, { message: 'hello' })
  const { receipt } = outcome
  assert.equal(Object.isFrozen(receipt), true)
  assert.equal(Object.isFrozen(receipt.operation), true)
  assert.equal(Object.isFrozen(receipt.workflow), true)

  const started = new Date(receipt.startedAt)
  const finished = new Date(receipt.finishedAt)
  assert.equal(Number.isNaN(started.getTime()), false)
  assert.equal(Number.isNaN(finished.getTime()), false)
  assert.equal(started.getTime() <= finished.getTime(), true)
  assert.equal(receipt.finishedAt >= receipt.startedAt, true)
})

test('receipt provenance: descriptors and the model catalog expose pins without handler code', () => {
  const registry = createOperationRegistry([fixtureEcho, fixtureSum])
  const catalog = registry.describeForModel()
  assert.deepEqual(
    catalog.operations.map((o) => o.key),
    ['fixture.echo', 'fixture.sum'],
  )
  for (const op of catalog.operations) {
    assert.match(op.hash, /^sha256:[0-9a-f]{64}$/)
    assert.equal(op.arguments.additionalProperties, false)
    assert.equal(Object.values(op.arguments).includes(op.handler), false)
    assert.equal('handler' in op, false)
  }
})
