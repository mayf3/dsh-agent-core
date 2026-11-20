import test from 'node:test'
import assert from 'node:assert/strict'

import { canonicalJSON, sha256Hex } from '../src/canonical.js'
import { createOperationRegistry, defineOperation } from '../src/registry.js'
import { FixedOperationError } from '../src/errors.js'
import { fixtureEcho, fixtureSum, spyOnDefinition, FIXTURE_TRUSTED_CONTEXT } from '../src/fixtures.js'

/**
 * FIXED_OPERATION async-completion regression (candidate, SOURCE_ONLY).
 * The async surface is exercised ONLY through the registry object returned
 * by createOperationRegistry; handlers are synthetic pure promises, all
 * coordinates are the fixture ones, and nothing here starts timers, retries
 * or background work.
 */

/** Async spy fixture: records every handler call, delegates to handlerImpl. */
function spyAsync(handlerImpl) {
  const calls = []
  const definition = defineOperation({
    ...fixtureEcho,
    handler: async (args, context) => {
      calls.push({ args, context })
      return handlerImpl(args, context)
    },
  })
  return { definition, calls }
}

function echoCall(registry, hash, args = { message: 'hello' }) {
  return { operation: 'fixture.echo', version: '1.0.0', hash, args }
}

/** Drain the event loop past all pending microtasks (no sleep-timing bets). */
async function drainMacrotasks(rounds = 10) {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

test('async_precondition_failure_calls_no_handler', async () => {
  const echo = spyAsync(({ message }) => ({ echo: message }))
  const registry = createOperationRegistry([echo.definition])
  assert.equal(typeof registry.executeAsync, 'function')
  assert.equal(typeof registry.invokeAsync, 'function')
  const hash = echo.definition.hash

  // Each of the five fail-closed gates, in the same order as sync execute.
  const gateFailures = [
    { call: echoCall(registry, hash), trustedContext: undefined, code: 'missing_trusted_context' },
    { call: echoCall(registry, hash), trustedContext: {}, code: 'missing_trusted_context' },
    { call: { ...echoCall(registry, hash), operation: 'fixture.nuke' }, trustedContext: FIXTURE_TRUSTED_CONTEXT, code: 'unknown_operation' },
    { call: { ...echoCall(registry, hash), version: '9.9.9' }, trustedContext: FIXTURE_TRUSTED_CONTEXT, code: 'operation_version_mismatch' },
    { call: { ...echoCall(registry, hash), hash: `sha256:${'f'.repeat(64)}` }, trustedContext: FIXTURE_TRUSTED_CONTEXT, code: 'operation_hash_mismatch' },
    { call: { ...echoCall(registry, hash), args: { message: 'x', scriptPath: '/etc/passwd' } }, trustedContext: FIXTURE_TRUSTED_CONTEXT, code: 'invalid_arguments' },
  ]
  for (const { call, trustedContext, code } of gateFailures) {
    const outcome = await registry.invokeAsync(call, trustedContext)
    assert.equal(outcome.ok, false, `gate ${code} must fail closed`)
    assert.equal(outcome.error.code, code)
    await assert.rejects(registry.executeAsync(call, trustedContext), (error) => {
      assert.equal(error instanceof FixedOperationError, true)
      assert.equal(error.code, code)
      return true
    })
  }
  assert.equal(echo.calls.length, 0)
})

test('async_receipt_waits_for_resolution', async () => {
  let resolveHandler
  const deferred = new Promise((resolve) => { resolveHandler = resolve })
  const echo = spyAsync(() => deferred)
  const registry = createOperationRegistry([echo.definition])
  const hash = echo.definition.hash

  const started = registry.invokeAsync(echoCall(registry, hash), FIXTURE_TRUSTED_CONTEXT)
  const executeStarted = registry.executeAsync(echoCall(registry, hash), FIXTURE_TRUSTED_CONTEXT)
  let invokeSettled = false
  let executeSettled = false
  started.then(() => { invokeSettled = true }, () => { invokeSettled = true })
  executeStarted.then(() => { executeSettled = true }, () => { executeSettled = true })

  // setImmediate runs strictly after every pending microtask: an early
  // (pre-resolution) settle would be visible here without any sleep.
  await drainMacrotasks(1)
  assert.equal(invokeSettled, false, 'invokeAsync must not succeed before the handler promise resolves')
  assert.equal(executeSettled, false, 'executeAsync must not succeed before the handler promise resolves')
  assert.equal(echo.calls.length, 2)

  const beforeResolveIso = new Date().toISOString()
  resolveHandler({ echo: 'done' })
  const outcome = await started
  const envelope = await executeStarted

  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.result, { echo: 'done' })
  assert.equal(outcome.receipt.status, 'succeeded')
  assert.equal(outcome.receipt.startedAt <= beforeResolveIso, true)
  assert.equal(outcome.receipt.finishedAt >= beforeResolveIso, true, 'finishedAt must be taken after the promise resolved')
  assert.equal(envelope.ok, true)
  assert.deepEqual(envelope.result, { echo: 'done' })
  assert.equal(envelope.receipt.finishedAt >= beforeResolveIso, true)
})

test('async_declared_rejection_keeps_code', async () => {
  const echo = spyAsync(() => { throw new FixedOperationError('invalid_arguments', 'handler-level declared failure') })
  const registry = createOperationRegistry([echo.definition])
  const hash = echo.definition.hash
  const call = echoCall(registry, hash)

  const outcome = await registry.invokeAsync(call, FIXTURE_TRUSTED_CONTEXT)
  assert.equal(outcome.ok, false)
  assert.deepEqual(outcome.error, { code: 'invalid_arguments', detail: 'handler-level declared failure' })

  await assert.rejects(registry.executeAsync(call, FIXTURE_TRUSTED_CONTEXT), (error) => {
    assert.equal(error instanceof FixedOperationError, true)
    assert.equal(error.code, 'invalid_arguments')
    return true
  })
  assert.equal(echo.calls.length, 2)
})

test('async_unexpected_rejection_is_not_success', async () => {
  const echo = spyAsync(() => { throw new TypeError('boom') })
  const registry = createOperationRegistry([echo.definition])
  const hash = echo.definition.hash
  const call = echoCall(registry, hash)

  await assert.rejects(registry.executeAsync(call, FIXTURE_TRUSTED_CONTEXT), (error) => {
    assert.equal(error instanceof TypeError, true)
    assert.equal(error.message, 'boom')
    return true
    })
  // invokeAsync maps ONLY declared FixedOperationError; the unexpected
  // rejection propagates and can never surface as ok:true or a declared
  // failure envelope.
  await assert.rejects(registry.invokeAsync(call, FIXTURE_TRUSTED_CONTEXT), (error) => {
    assert.equal(error instanceof TypeError, true)
    assert.equal(error instanceof FixedOperationError, false)
    return true
  })
  assert.equal(echo.calls.length, 2)
})

test('sync_fixture_surface_unchanged', async () => {
  const syncEcho = spyOnDefinition(fixtureEcho)
  const registry = createOperationRegistry([syncEcho.definition, fixtureSum])
  assert.equal(typeof registry.execute, 'function')
  assert.equal(typeof registry.invoke, 'function')

  // Sync invoke: exact pre-async envelope and receipt semantics.
  const outcome = registry.invoke(
    { operation: 'fixture.echo', version: '1.0.0', hash: syncEcho.definition.hash, args: { message: 'hello' } },
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.result, { echo: 'hello' })
  assert.match(outcome.receipt.invocationId, /^opinv-[0-9a-f]{24}$/)
  assert.equal(outcome.receipt.status, 'succeeded')
  assert.equal(syncEcho.calls.length, 1)

  // Sync gate failure still throws/maps exactly as before.
  assert.throws(() => registry.execute(
    { operation: 'fixture.nuke', version: '1.0.0', hash: 'sha256:x', args: {} },
    FIXTURE_TRUSTED_CONTEXT,
  ), (error) => error instanceof FixedOperationError && error.code === 'unknown_operation')
  const bad = registry.invoke(
    { operation: 'fixture.echo', version: '1.0.0', hash: syncEcho.definition.hash, args: { message: 'x', shell: 'rm -rf /' } },
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(bad.ok, false)
  assert.equal(bad.error.code, 'invalid_arguments')

  // The same registry object exposes the async twins alongside sync —
  // additive, no caller was switched over.
  assert.equal(typeof registry.executeAsync, 'function')
  assert.equal(typeof registry.invokeAsync, 'function')
  const asyncOutcome = await registry.invokeAsync(
    { operation: 'fixture.sum', version: '1.0.0', hash: registry.get('fixture.sum').hash, args: { a: 2, b: 40 } },
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(asyncOutcome.ok, true)
  assert.deepEqual(asyncOutcome.result, { sum: 42 })
  assert.equal(syncEcho.calls.length, 1)
})

test('stable_invocation_id_is_not_idempotent_execution', async () => {
  const echo = spyAsync(({ message }) => ({ echo: message }))
  const registry = createOperationRegistry([echo.definition])
  const hash = echo.definition.hash
  const call = echoCall(registry, hash)

  const first = await registry.invokeAsync(call, FIXTURE_TRUSTED_CONTEXT)
  const second = await registry.invokeAsync(call, FIXTURE_TRUSTED_CONTEXT)

  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.equal(first.receipt.invocationId, second.receipt.invocationId, 'same input + same trusted coordinates -> same stable invocationId')
  const expectedId = `opinv-${sha256Hex(canonicalJSON({
    operation: 'fixture.echo',
    version: '1.0.0',
    hash,
    inputDigest: first.receipt.inputDigest,
    workflow: FIXTURE_TRUSTED_CONTEXT,
  })).slice(0, 24)}`
  assert.equal(first.receipt.invocationId, expectedId)
  // Explicit non-guarantee: the handler really ran twice. Stable ids link
  // attempts; they do NOT dedupe side effects.
  assert.equal(echo.calls.length, 2)
})

test('async_never_retries_or_starts_background_work', async () => {
  const echo = spyAsync(() => { throw new TypeError('boom') })
  const registry = createOperationRegistry([echo.definition])
  const hash = echo.definition.hash
  const call = echoCall(registry, hash)

  await assert.rejects(registry.invokeAsync(call, FIXTURE_TRUSTED_CONTEXT), /boom/)
  assert.equal(echo.calls.length, 1)
  // No timer/retry/background continuation may exist: after the rejection
  // has fully drained through the event loop the handler count is still 1
  // (and the test process itself would hang on a live handle otherwise).
  await drainMacrotasks()
  assert.equal(echo.calls.length, 1)
})

test('definition_hash_contract_unchanged', async () => {
  // Golden digests pinned at base a96900bd: the hash binds ONLY the
  // normalized contract surface {key, version, inputSchema} — adding the
  // async surface must not re-hash, and implementation bytes are never
  // folded in.
  const registry = createOperationRegistry([fixtureEcho, fixtureSum])
  const echoSpy = spyAsync(({ message }) => ({ echo: message }))
  const asyncRegistry = createOperationRegistry([echoSpy.definition, fixtureSum])
  assert.equal(registry.get('fixture.echo').hash, 'sha256:c7544285c5412b8d17851b74a59300f2d55b480a4b8fd54512ee3bdda5134969')
  assert.equal(registry.get('fixture.sum').hash, 'sha256:321f9985fea66e980f76dc751ee36eecd863b93136fd7ea95ee31ac13fb90237')
  // An async spy definition with the same contract hashes identically to the
  // sync one — handler identity is not part of the hash.
  assert.equal(echoSpy.definition.hash, registry.get('fixture.echo').hash)

  const outcome = await asyncRegistry.invokeAsync(
    echoCall(asyncRegistry, asyncRegistry.get('fixture.echo').hash),
    FIXTURE_TRUSTED_CONTEXT,
  )
  assert.equal(outcome.ok, true)
  assert.equal(outcome.receipt.operation.hash, 'sha256:c7544285c5412b8d17851b74a59300f2d55b480a4b8fd54512ee3bdda5134969')

  // Contract drift is still detected exactly as before.
  const widened = createOperationRegistry([{
    ...fixtureEcho,
    inputSchema: { ...fixtureEcho.inputSchema, properties: { ...fixtureEcho.inputSchema.properties, extra: { type: 'string' } } },
  }])
  assert.notEqual(widened.get('fixture.echo').hash, registry.get('fixture.echo').hash)
})
