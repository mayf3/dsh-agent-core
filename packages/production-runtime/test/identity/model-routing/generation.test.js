import assert from 'node:assert/strict'
import { mkdirSync, unlinkSync } from 'node:fs'
import { test } from 'node:test'
import { A, B, C, GLOBAL, PROXY, entry, config, setup, badB } from './support.js'

function refused(runtime, agentId = A) {
  let observed
  assert.throws(() => runtime.resolveChain(agentId), error => {
    observed = error
    return error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
      && error.configGeneration?.decision === 'refuse'
  })
  return observed
}

test('ACC-RCG-001/002: whole valid publication changes later snapshots and preserves a turn snapshot', t => {
  const f = setup(t)
  const runtime = f.create()
  const before = runtime.resolveChain(A)
  assert.ok(before.generationId)
  assert.ok(Object.isFrozen(before))
  assert.ok(Object.isFrozen(before.routes))
  assert.ok(Object.isFrozen(before.routes[0].processConfig))
  const next = config()
  next.overrides[A] = entry('r1', ['r2'])
  next.overrides[B] = entry('r3')
  f.write(next)
  runtime.publish()
  const after = runtime.resolveChain(A)
  assert.notEqual(after.generationId, before.generationId)
  assert.deepEqual(after.routes.map(route => route.routeRef), ['r1', 'r2'])
  assert.equal(runtime.resolveChain(B).generationId, after.generationId)
  assert.equal(runtime.resolveChain(B).routes[0].routeRef, 'r3')
  assert.deepEqual(before.routes.map(route => route.routeRef), ['r0'])
  assert.equal(after.configGeneration.decision, 'active')
})

test('ACC-RCG-001: generation identity binds the complete file independently of target chainId', t => {
  const f = setup(t)
  const runtime = f.create()
  const before = runtime.resolveChain(A)
  const next = config()
  next.overrides[B] = entry('r3')
  f.write(next)
  const after = runtime.resolveChain(A)
  assert.equal(after.chainId, before.chainId)
  assert.notEqual(after.generationId, before.generationId)
  assert.equal(runtime.resolveChain(A).generationId, after.generationId)
})

test('ACC-RCG-003: rejected candidate permits only unchanged A to consume the activated G0', t => {
  const f = setup(t)
  const runtime = f.create()
  const before = runtime.resolveChain(A)
  f.write(badB())
  const after = runtime.resolveChain(A)
  assert.equal(after.generationId, before.generationId)
  assert.deepEqual(after.routes, before.routes)
  assert.equal(after.configGeneration.decision, 'continue')
  assert.equal(after.configGeneration.activeGenerationId, before.generationId)
  assert.notEqual(after.configGeneration.candidateId, before.generationId)
  assert.equal(after.configGeneration.closureUnchanged, true)
  const error = refused(runtime, B)
  assert.equal(error.configGeneration.candidateId, after.configGeneration.candidateId)
  assert.ok(f.messages.length > 0, 'candidate rejection and continuation must be loud')
})

test('ACC-RCG-003: all unknown references are diagnosed, with each affected target refused', t => {
  const f = setup(t)
  const runtime = f.create()
  const next = badB()
  next.overrides[C] = entry('also-missing', ['third-missing'])
  f.write(next)
  const after = runtime.resolveChain(A)
  assert.equal(after.configGeneration.decision, 'continue')
  assert.deepEqual([...after.configGeneration.errorAgents].sort(), [B, C])
  refused(runtime, B)
  refused(runtime, C)
})

for (const [name, mutate] of [
  ['unknown ref and repeated ref', value => { value.overrides[B] = entry('missing', ['missing']) }],
  ['unknown ref and oversized chain', value => { value.overrides[B] = entry('missing', ['r0', 'r1', 'r2', 'r3']) }],
  ['unknown ref and nonstring ref', value => { value.overrides[B] = entry('missing', [42]) }],
  ['unknown ref followed by unknown override key', value => { value.overrides[C].extra = true }],
  ['unknown ref followed by unknown Agent', value => { value.overrides.agt_unregistered = entry() }],
  ['unknown ref and invalid catalog descriptor', value => { value.routeCatalog.r3.extra = true }],
  ['unknown ref and canonical catalog alias', value => { value.routeCatalog.r3 = { ...value.routeCatalog.r0 } }],
  ['unknown ref and unknown envelope', value => { value.extra = true }],
]) {
  test(`ACC-RCG-003/006: full rejection set cannot be classified as only unrelated unknown refs: ${name}`, t => {
    const f = setup(t)
    const runtime = f.create()
    const next = badB()
    mutate(next)
    f.write(next)
    refused(runtime)
  })
}

for (const [name, mutate] of [
  ['A explicitly selects r1 marker', value => { value.overrides[A] = entry('r1') }],
  ['A override deleted', value => { delete value.overrides[A] }],
  ['A itself references missing route', value => { value.overrides[A] = entry('missing-a') }],
  ['A itself has invalid model shape', value => { value.overrides[A] = { model: {} } }],
  ['same routeRef changes descriptor model', value => { value.routeCatalog.r0.model = 'untrusted-marker-model' }],
  ['same routeRef changes credential readiness identity', value => { value.routeCatalog.r0.credentialReadiness = 'new-credential-path' }],
  ['same routeRef changes providerEnv', value => { value.routeCatalog.r0.providerEnv = PROXY }],
]) {
  test(`ACC-RCG-004 counterexample: rejected G1 never provides changed A or revives prior intent: ${name}`, t => {
    const f = setup(t)
    const runtime = f.create()
    const before = runtime.resolveChain(A)
    const next = badB()
    mutate(next)
    f.write(next)
    refused(runtime)
    assert.equal(before.routes[0].processConfig.model, 'model-r0')
    assert.equal(before.routes[0].routeRef, 'r0')
  })
}

test('ACC-RCG-004: fallback ordering is part of the complete input closure', t => {
  const initial = config()
  initial.overrides[A] = entry('r0', ['r1', 'r2'])
  const f = setup(t, initial)
  const runtime = f.create()
  const next = badB(config())
  next.overrides[A] = entry('r0', ['r2', 'r1'])
  f.write(next)
  refused(runtime)
})

test('ACC-RCG-004: A absent in both generations can continue only with identical default layers', t => {
  const initial = config()
  delete initial.overrides[A]
  const f = setup(t, initial)
  const runtime = f.create()
  const before = runtime.resolveChain(A)
  const next = badB(structuredClone(initial))
  f.write(next)
  const after = runtime.resolveChain(A)
  assert.equal(after.generationId, before.generationId)
  assert.equal(after.override, false)
  assert.equal(after.routes[0].processConfig.model, GLOBAL.model)
  f.context.layers.explicitGlobal.model = 'changed-explicit-default'
  refused(runtime)
})

test('ACC-RCG-004: a valid deletion and a provable missing file each activate a complete new absence', t => {
  const f = setup(t)
  const runtime = f.create()
  const before = runtime.resolveChain(A)
  const next = config()
  delete next.overrides[A]
  f.write(next)
  const deleted = runtime.resolveChain(A)
  assert.notEqual(deleted.generationId, before.generationId)
  assert.equal(deleted.override, false)
  assert.equal(deleted.routes[0].processConfig.model, GLOBAL.model)
  unlinkSync(f.file)
  const absent = runtime.resolveChain(A)
  assert.notEqual(absent.generationId, deleted.generationId)
  assert.equal(absent.override, false)
  assert.equal(runtime.resolveChain(B).generationId, absent.generationId)
})

for (const [name, contents] of [
  ['malformed JSON', '{not-json'],
  ['duplicate envelope key', '{"version":3,"version":3,"routeCatalog":{},"overrides":{}}'],
  ['duplicate nested key', '{"version":3,"routeCatalog":{},"overrides":{"agt_b":{"model":{"primary":"missing","primary":"missing","fallbacks":[]}}}}'],
  ['unknown envelope key', '{"version":3,"routeCatalog":{},"overrides":{},"secretMarker":"not-for-logs"}'],
]) {
  test(`ACC-RCG-003/004: ${name} refuses all targets and never grants absence`, t => {
    const f = setup(t)
    const runtime = f.create()
    f.write(contents)
    refused(runtime)
    refused(runtime, B)
  })
}

test('ACC-RCG-004: an unreadable file is refused rather than interpreted as absent', t => {
  const f = setup(t)
  const runtime = f.create()
  unlinkSync(f.file)
  mkdirSync(f.file)
  refused(runtime)
})

test('ACC-RCG-005: cold invalid candidate and restart after G0 continuation cannot restore trust', t => {
  const f = setup(t)
  const runtime = f.create()
  f.write(badB())
  assert.equal(runtime.resolveChain(A).configGeneration.decision, 'continue')
  assert.throws(() => f.create(), error => error.code === 'AGENT_MODEL_OVERRIDE_INVALID')
  runtime.close()
  refused(runtime)
})

test('ACC-RCG-005: cold legal absence is a validated generation; close ends its qualification', t => {
  const f = setup(t, null)
  const runtime = f.create()
  const snapshot = runtime.resolveChain(A)
  assert.ok(snapshot.generationId)
  assert.equal(snapshot.override, false)
  runtime.close()
  refused(runtime)
})

test('ACC-RCG-003: every next candidate recomputes qualification instead of inheriting the last permit', t => {
  const f = setup(t)
  const runtime = f.create()
  f.write(badB())
  const continuing = runtime.resolveChain(A)
  f.write('{broken')
  refused(runtime)
  const changed = badB()
  changed.overrides[A] = entry('r1')
  f.write(changed)
  refused(runtime)
  f.write(config())
  assert.equal(runtime.resolveChain(A).configGeneration.decision, 'active')
  assert.equal(runtime.resolveChain(A).generationId, continuing.generationId)
})

test('ACC-RCG-006: diagnostic output includes identities and decisions without raw candidate values', t => {
  const f = setup(t)
  const runtime = f.create()
  const next = badB()
  next.routeCatalog.r0.model = 'untrusted-marker-do-not-log'
  f.write(next)
  const error = refused(runtime)
  const output = JSON.stringify({ diagnostics: error.configGeneration, messages: f.messages })
  assert.ok(output.includes('candidateId'))
  assert.ok(output.includes('activeGenerationId'))
  assert.ok(output.includes('refuse'))
  assert.equal(output.includes('untrusted-marker-do-not-log'), false)
  assert.equal(output.includes('fixture-credential-path-identity'), false)
  assert.equal(output.includes('routeCatalog'), false)
})
