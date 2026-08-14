import test from 'node:test'
import assert from 'node:assert/strict'

import { validateManifest } from '../src/schema.js'
import {
  assertValidManifest,
  invoke,
  resolveCode,
  validateArguments,
} from '../src/mapping.js'
import { createIdentityResolver } from '../src/identity.js'
import { manifest as calculatorManifest, handlers as calculatorHandlers } from '../src/calculator.manifest.js'
import { buildToolDefinition, registerCapability } from '../src/registry.js'

// ---- minimal echo capability used to prove manifest-driven genericity ----
const echoManifest = {
  id: 'demo.echo',
  toolName: 'demo_echo',
  name: 'Echo',
  description: 'Echo a message back to the caller.',
  errors: [
    { code: 'invalid_arguments', description: 'Arguments invalid.' },
    { code: 'unsupported_operation', description: 'Unsupported.' },
  ],
  operations: [
    {
      name: 'echo',
      description: 'Return { message } unchanged.',
      arguments: {
        properties: { message: { type: 'string', required: true, description: 'Text to echo.' } },
        required: ['message'],
      },
      result: { type: 'object' },
      errors: ['invalid_arguments'],
    },
  ],
}
const echoHandlers = {
  echo: (_op, args) => ({ message: args.message }),
}
// ----/echo ----

test('schema: valid calculator manifest passes and is canonicalized', () => {
  const res = validateManifest(calculatorManifest)
  assert.equal(res.ok, true)
  const m = res.manifest
  assert.equal(m.id, 'external.calculator')
  assert.equal(m.toolName, 'external_calculator')
  assert.equal(m.operations.length, 4)
  assert.deepEqual(m.operations.map(o => o.name), ['add', 'subtract', 'multiply', 'divide'])
  assert.deepEqual(m.errors.map(e => e.code), [
    'invalid_arguments', 'unsupported_operation', 'divide_by_zero',
  ])
  // toolName derived from id when absent
  const derived = validateManifest({ ...calculatorManifest, toolName: undefined })
  assert.equal(derived.ok, true)
  assert.equal(derived.manifest.toolName, 'external_calculator')
})

test('schema: rejects non-object input', () => {
  assert.equal(validateManifest(null).ok, false)
  assert.equal(validateManifest(42).ok, false)
  assert.equal(validateManifest('x').ok, false)
  assert.equal(validateManifest([1]).ok, false)
})

test('schema: rejects missing operations', () => {
  const res = validateManifest({ id: 'a.b', description: 'x', operations: [] })
  assert.equal(res.ok, false)
  assert.ok(res.errors.some(e => e.includes('operations')))
})

test('schema: rejects invalid error-code table', () => {
  // code not a lowercase identifier
  const bad1 = validateManifest({
    id: 'a.b', description: 'x', errors: [{ code: 'Bad Code' }],
    operations: [{ name: 'op', arguments: { properties: {} } }],
  })
  assert.equal(bad1.ok, false)
  assert.ok(bad1.errors.some(e => e.includes('code')))
  // duplicate code
  const bad2 = validateManifest({
    id: 'a.b', description: 'x',
    errors: [{ code: 'e1' }, { code: 'e1' }],
    operations: [{ name: 'op', arguments: { properties: {} } }],
  })
  assert.equal(bad2.ok, false)
  assert.ok(bad2.errors.some(e => e.includes('duplicate')))
  // operation references undeclared code
  const bad3 = validateManifest({
    id: 'a.b', description: 'x',
    errors: [{ code: 'e1' }],
    operations: [{ name: 'op', errors: ['nope'], arguments: { properties: {} } }],
  })
  assert.equal(bad3.ok, false)
  assert.ok(bad3.errors.some(e => e.includes('undeclared code')))
})

test('schema: rejects invalid parameter schema', () => {
  // bad property type
  const bad = validateManifest({
    id: 'a.b', description: 'x',
    operations: [{ name: 'op', arguments: { properties: { a: { type: 'nope' } } } }],
  })
  assert.equal(bad.ok, false)
  assert.ok(bad.errors.some(e => e.includes('type')))
  // required entry not a string
  const bad2 = validateManifest({
    id: 'a.b', description: 'x',
    operations: [{ name: 'op', arguments: { properties: { a: { type: 'number' } }, required: [1] } }],
  })
  assert.equal(bad2.ok, false)
  assert.ok(bad2.errors.some(e => e.includes('required')))
})

test('V0 regression: multiply(6,7) = 42 through the mapping layer', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const res = await invoke(manifest, calculatorHandlers, { operation: 'multiply', args: { a: 6, b: 7 } }, { resolvePrincipal: () => undefined })
  assert.deepEqual(res, { ok: true, result: 42 })
})

test('mapping: invalid_arguments for non-numeric operands', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const res = await invoke(manifest, calculatorHandlers, { operation: 'add', args: { a: 'x', b: 1 } }, {})
  assert.deepEqual(res, { ok: false, error: { code: 'invalid_arguments' } })
  const res2 = await invoke(manifest, calculatorHandlers, { operation: 'add', args: { a: 1 } }, {})
  assert.deepEqual(res2, { ok: false, error: { code: 'invalid_arguments' } })
})

test('mapping: divide_by_zero maps correctly', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const res = await invoke(manifest, calculatorHandlers, { operation: 'divide', args: { a: 10, b: 0 } }, {})
  assert.deepEqual(res, { ok: false, error: { code: 'divide_by_zero' } })
})

test('mapping: unsupported_operation for unknown operation', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const res = await invoke(manifest, calculatorHandlers, { operation: 'modulo', args: { a: 1, b: 2 } }, {})
  assert.deepEqual(res, { ok: false, error: { code: 'unsupported_operation' } })
})

test('mapping: declared arithmetic results for all four operations', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const cases = [
    ['add', [1, 2], { ok: true, result: 3 }],
    ['subtract', [10, 4], { ok: true, result: 6 }],
    ['multiply', [6, 7], { ok: true, result: 42 }],
    ['divide', [9, 3], { ok: true, result: 3 }],
  ]
  for (const [op, [a, b], expected] of cases) {
    const res = await invoke(manifest, calculatorHandlers, { operation: op, args: { a, b } }, {})
    assert.deepEqual(res, expected)
  }
})

test('mapping: unknown error code fails closed to a declared code', async () => {
  const manifest = assertValidManifest({
    id: 'a.b', description: 'x',
    errors: [{ code: 'invalid_arguments' }],
    operations: [{ name: 'op', arguments: { properties: {} } }],
  })
  const res = await invoke(manifest, { op: () => ({ errorCode: 'completely_unknown' }) }, { operation: 'op', args: {} }, {})
  assert.deepEqual(res, { ok: false, error: { code: 'invalid_arguments' } })
})

test('resolveCode: unknown code downgraded to fallback', () => {
  const manifest = assertValidManifest(calculatorManifest)
  assert.deepEqual(resolveCode(manifest, 'unsupported_operation', 'unsupported_operation'), { code: 'unsupported_operation' })
  assert.deepEqual(resolveCode(manifest, 'nope', 'unsupported_operation'), { code: 'unsupported_operation' })
})

test('validateArguments: property/required enforcement', () => {
  const schema = { properties: { a: { type: 'number' }, b: { type: 'string', enum: ['x', 'y'] } }, required: ['a', 'b'] }
  assert.deepEqual(validateArguments(schema, { a: 1, b: 'x' }), [])
  assert.ok(validateArguments(schema, { a: 1 }).length > 0)
  assert.ok(validateArguments(schema, { a: 'no', b: 'x' }).length > 0)
  assert.ok(validateArguments(schema, { a: 1, b: 'z' }).length > 0)
  assert.ok(validateArguments(schema, 'not-an-object').length > 0)
})

test('registration: tool name / description / parameter schema conform for calculator', () => {
  const spy = []
  const tool = registerCapability(
    { manifest: calculatorManifest, handlers: calculatorHandlers },
    { register: d => spy.push(d) },
    d => d, // passthrough define
  )
  assert.equal(spy.length, 1)
  assert.equal(spy[0].name, 'external_calculator')
  assert.ok(spy[0].description.includes('external.calculator'))
  assert.ok(spy[0].description.includes('multiply'))
  // operation enum
  assert.deepEqual(spy[0].parameters.operation.enum, ['add', 'subtract', 'multiply', 'divide'])
  assert.equal(spy[0].parameters.operation.required, true)
  // shared operands required (every operation requires them)
  assert.equal(spy[0].parameters.a.required, true)
  assert.equal(spy[0].parameters.b.required, true)
})

test('identity: tool parameter schema has NO principal field', () => {
  const { definition } = buildToolDefinition({ manifest: calculatorManifest, handlers: calculatorHandlers })
  const names = Object.keys(definition.parameters)
  assert.ok(!names.some(n => /principal|agentid|credential|identity/i.test(n)))
  // nested property schemas too
  const flat = JSON.stringify(definition.parameters).toLowerCase()
  assert.ok(!flat.includes('principalid'))
})

test('identity: model-supplied principalId in args is ignored', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  // args carry a smuggled principalId; mapping must ignore it and still compute
  const res = await invoke(manifest, calculatorHandlers, {
    operation: 'multiply',
    args: { a: 6, b: 7, principalId: 'AGENT_B' },
  }, { resolvePrincipal: () => undefined })
  assert.deepEqual(res, { ok: true, result: 42 })
})

test('identity: identity is only obtained via resolvePrincipal (injected and called)', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  let calls = 0
  let observedPrincipal
  // a handler that records the principal it received
  const observingHandlers = {
    multiply: (_op, _args, principal) => {
      observedPrincipal = principal
      return 42
    },
    add: calculatorHandlers.add,
    subtract: calculatorHandlers.subtract,
    divide: calculatorHandlers.divide,
  }
  const resolver = () => { calls += 1; return 'principal-A' }
  const res = await invoke(manifest, observingHandlers, { operation: 'multiply', args: { a: 6, b: 7 } }, { resolvePrincipal: resolver })
  assert.deepEqual(res, { ok: true, result: 42 })
  assert.equal(calls, 1)
  assert.equal(observedPrincipal, 'principal-A')
})

test('identity: resolvePrincipal placeholder reads env, falls back to injected', () => {
  const viaEnv = createIdentityResolver({ source: { AGENT_CORE_PRINCIPAL: 'principal-env' } })
  assert.equal(viaEnv(), 'principal-env')
  const viaInjected = createIdentityResolver({ source: {}, injected: 'principal-injected' })
  assert.equal(viaInjected(), 'principal-injected')
  const neither = createIdentityResolver({ source: {} })
  assert.equal(neither(), undefined)
})

test('manifest-driven genericity: a different manifest registers a different tool', () => {
  const spy = []
  const tool = registerCapability(
    { manifest: echoManifest, handlers: echoHandlers },
    { register: d => spy.push(d) },
    d => d,
  )
  assert.equal(spy.length, 1)
  assert.equal(spy[0].name, 'demo_echo')
  assert.ok(spy[0].description.includes('demo.echo'))
  assert.deepEqual(spy[0].parameters.operation.enum, ['echo'])
  assert.equal(spy[0].parameters.message.required, true)
  assert.ok(!spy[0].parameters.a) // calculator operands must NOT leak in
})

test('manifest-driven genericity: echo executes through the same pipeline', async () => {
  const manifest = assertValidManifest(echoManifest)
  const res = await invoke(manifest, echoHandlers, { operation: 'echo', args: { message: 'hi' } }, {})
  assert.deepEqual(res, { ok: true, result: { message: 'hi' } })
})

test('buildToolDefinition exposes capabilityId constant', () => {
  const { capabilityId, definition } = buildToolDefinition({ manifest: calculatorManifest })
  assert.equal(capabilityId, 'external.calculator')
  assert.equal(definition.name, 'external_calculator')
})
