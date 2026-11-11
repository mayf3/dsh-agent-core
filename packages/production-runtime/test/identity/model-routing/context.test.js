import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalOpenAICodexCredentialFileFor, GPT6_LUNA_ROUTE_V1 } from '../../../../agent-provisioning/src/shared-codex.js'
import { A, entry, config, setup, badB } from './support.js'

for (const [name, mutate] of [
  ['global route value', f => { f.context.globalRoute.model = 'new-global-model' }],
  ['explicit default absence versus presence', f => { delete f.context.layers.explicitGlobal }],
  ['default source', f => { f.context.layers.globalSource = 'runtime_env' }],
  ['request/session explicit state', f => { f.context.layers.requestSession = { present: true, model: 'explicit-request' } }],
  ['agent/profile explicit state', f => { f.context.layers.agentProfile = { present: true, model: 'explicit-profile' } }],
  ['Harness source binding', f => { f.context.layers.harness = { root: '/fixture/harness', sourceCommit: 'a'.repeat(40) } }],
  ['artifact path binding', f => {
    f.context.options.artifactContext = { deploymentRoot: f.root, packageArtifact: '/fixture/new-artifact.tgz' }
  }],
  ['source stamp path binding', f => {
    f.context.options.artifactContext = { deploymentRoot: f.root, sourceStamp: '/fixture/new-source-stamp.json' }
  }],
]) {
  test(`ACC-RCG-004: rejected candidate cannot continue after ${name} changes`, t => {
    const f = setup(t)
    const runtime = f.create()
    f.write(badB())
    assert.equal(runtime.resolveChain(A).configGeneration.decision, 'continue')
    mutate(f)
    assert.throws(() => runtime.resolveChain(A), error => error.configGeneration?.decision === 'refuse')
  })
}

test('ACC-RCG-004: same ref with changed effective reasoning effort is a changed closure', t => {
  const f = setup(t)
  const initial = config()
  initial.routeCatalog.r0 = {
    routeKind: 'subscription', provider: 'openai-codex', model: GPT6_LUNA_ROUTE_V1.model,
    plugin: GPT6_LUNA_ROUTE_V1.plugin, pluginVersion: GPT6_LUNA_ROUTE_V1.pluginVersion,
    credentialReadiness: 'fixture-credential-path-identity',
    credentialFile: canonicalOpenAICodexCredentialFileFor(f.root), reasoningEffort: 'medium',
  }
  f.write(initial)
  const runtime = f.create()
  const before = runtime.resolveChain(A)
  const next = badB(structuredClone(initial))
  next.routeCatalog.r0.reasoningEffort = 'high'
  f.write(next)
  assert.throws(() => runtime.resolveChain(A), error => error.configGeneration?.decision === 'refuse')
  assert.equal(before.routes[0].processConfig.subscription.reasoningEffort, 'medium')
})

test('ACC-RCG-004: raw explicit effort presence is compared even with identical effective medium', t => {
  const f = setup(t)
  const initial = config()
  initial.routeCatalog.r0 = {
    routeKind: 'subscription', provider: 'openai-codex', model: GPT6_LUNA_ROUTE_V1.model,
    plugin: GPT6_LUNA_ROUTE_V1.plugin, pluginVersion: GPT6_LUNA_ROUTE_V1.pluginVersion,
    credentialReadiness: 'fixture-credential-path-identity',
    credentialFile: canonicalOpenAICodexCredentialFileFor(f.root),
  }
  f.write(initial)
  const runtime = f.create()
  const next = badB(structuredClone(initial))
  next.routeCatalog.r0.reasoningEffort = 'medium'
  f.write(next)
  assert.throws(() => runtime.resolveChain(A), error => error.configGeneration?.decision === 'refuse')
})

test('ACC-RCG-001: a valid context change activates a new complete generation', t => {
  const initial = config()
  delete initial.overrides[A]
  const f = setup(t, initial)
  const runtime = f.create()
  const before = runtime.resolveChain(A)
  f.context.globalRoute.model = 'new-global-model'
  f.context.layers.explicitGlobal.model = 'new-global-model'
  const after = runtime.resolveChain(A)
  assert.notEqual(after.generationId, before.generationId)
  assert.equal(after.routes[0].processConfig.model, 'new-global-model')
  assert.equal(before.routes[0].processConfig.model, 'global-model')
  assert.equal(after.configGeneration.decision, 'active')
})

test('ACC-RCG-004/006: foreign credential identity and invalid effort remain whole-candidate rejection', t => {
  const f = setup(t)
  const runtime = f.create()
  for (const mutate of [
    value => { value.routeCatalog.r0.credentialFile = '/foreign/credential.json' },
    value => { value.routeCatalog.r0.reasoningEffort = 'unsupported-effort' },
  ]) {
    const value = badB()
    mutate(value)
    f.write(value)
    assert.throws(() => runtime.resolveChain(A), error => error.configGeneration?.decision === 'refuse')
  }
  assert.equal(runtime.activeGeneration.overrides[A].primary, entry().model.primary)
})
