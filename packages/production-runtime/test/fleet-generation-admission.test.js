import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createModelArtifactContext } from '../src/model-overrides.js'

test('D14 unknown selected fleet generation refuses before route composition', t => {
  const root = mkdtempSync(join(tmpdir(), 'd14-admission-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const control = join(root, 'control/codex-plugin-runtime')
  mkdirSync(join(control, 'unknown/node_modules'), { recursive: true })
  symlinkSync(join(control, 'unknown/node_modules'), join(control, 'current'))
  assert.throws(() => createModelArtifactContext(root, {}), { code: 'FLEET_GENERATION_INVALID' })
})

test('D14 missing current in a configured fleet cannot fall back to an old expected pin', t => {
  const root = mkdtempSync(join(tmpdir(), 'd14-admission-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'control/codex-plugin-runtime'), { recursive: true })
  assert.throws(() => createModelArtifactContext(root, {}), { code: 'FLEET_GENERATION_INVALID' })
})

// These tests use exact released bytes and synthetic qualification records.
// They prove the admission mechanism, never the empirical compatibility gate.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createFleetGenerationFixture, FIXTURE_HARNESS, RELEASE_FIXTURE_AVAILABLE } from '../../agent-provisioning/test/fleet-generation-fixture.js'
import { canonicalDefaultGlobalRoute, loadAgentModelOverrides } from '../src/model-overrides.js'
import { provisionExactProfilePlugin } from '../../agent-provisioning/src/index.js'
import { canonicalRouteIdentity } from '../../agent-router/src/route-chain.js'

const exactReleaseAvailable = RELEASE_FIXTURE_AVAILABLE
test('D14 explicit generation migration admits the exact home and still runs all input guards', { skip: !exactReleaseAvailable }, t => {
  const fx = createFleetGenerationFixture()
  t.after(fx.cleanup)
  const context = createModelArtifactContext(fx.deploymentRoot, {})
  const opts = { deploymentRoot: fx.deploymentRoot, artifactContext: context }
  const subscription = canonicalDefaultGlobalRoute(opts).subscription
  assert.equal(subscription.pluginVersion, '0.3.2')
  assert.equal(subscription.sourceCommit, '7cfa139e111956a7193622afc734126b52d7bf07')
  assert.equal(subscription.dshVersion, FIXTURE_HARNESS.version)
  const profile = join(fx.home, 'profiles/agent-core-production')
  mkdirSync(profile, { recursive: true })
  writeFileSync(join(profile, 'package.json'), JSON.stringify({ dsh: { profile: { bundles: [] } } }))
  // Before: existing actual home is 0.3.2, independently pinned expected0.2.3
  // refuses. After: the default requirement is derived from selected gen032.
  const req = { ...subscription, version: subscription.pluginVersion }
  assert.throws(() => provisionExactProfilePlugin(fx.home, 'agent-core-production', { ...req, version: '0.2.3' }, { harnessIdentity: FIXTURE_HARNESS }), { code: 'plugin_version_mismatch' })
  const payloadBefore = readFileSync(join(fx.pluginRoot, 'package.json'))
  assert.equal(provisionExactProfilePlugin(fx.home, 'agent-core-production', req, { harnessIdentity: FIXTURE_HARNESS }).version, '0.3.2')
  assert.deepEqual(readFileSync(join(fx.pluginRoot, 'package.json')), payloadBefore)
  assert.equal(existsSync(join(fx.pluginRoot, '.agent-core-artifact-identity.json')), false)
  assert.deepEqual(canonicalDefaultGlobalRoute(opts), canonicalDefaultGlobalRoute(opts))
  assert.notEqual(canonicalRouteIdentity({ subscription }), canonicalRouteIdentity({ subscription: { ...subscription, fleetGeneration: { ...subscription.fleetGeneration, descriptorSha256: '0'.repeat(64) } } }))
  assert.throws(() => provisionExactProfilePlugin(fx.home, 'agent-core-production', req, { harnessIdentity: { ...FIXTURE_HARNESS, commit: '9'.repeat(40) } }), { code: 'FLEET_GENERATION_INVALID' })
  const catalogFile = join(fx.deploymentRoot, 'catalog.json')
  const config = version => ({ version: 3, routeCatalog: { luna: { routeKind: 'subscription', provider: 'openai-codex', model: 'gpt-5.6-luna', plugin: 'dsh-codex', pluginVersion: version, credentialReadiness: 'shared-canonical-oauth', credentialFile: subscription.credentialFile } }, overrides: { fixture: { model: { primary: 'luna', fallbacks: [] } } } })
  writeFileSync(catalogFile, JSON.stringify(config('0.2.3')))
  assert.throws(() => loadAgentModelOverrides(catalogFile, ['fixture'], opts), { code: 'AGENT_MODEL_OVERRIDE_INVALID' })
  writeFileSync(catalogFile, JSON.stringify(config('0.3.2')))
  const chain = loadAgentModelOverrides(catalogFile, ['fixture'], opts).resolveChain('fixture', {})
  assert.deepEqual(chain.routes[0].processConfig.subscription, subscription)
  const loader = loadAgentModelOverrides(catalogFile, ['fixture'], opts)
  assert.deepEqual(loader.resolveChain('other', { provider: 'openai-codex', model: 'gpt-5.6-luna' }).routes[0].processConfig.subscription, subscription)
  assert.throws(() => loader.resolveChain('other', { provider: 'openai-codex', model: 'gpt-5.6-luna', subscription: { ...subscription, pluginVersion: '0.2.3' } }), { code: 'AGENT_MODEL_OVERRIDE_INVALID' })
  // A reviewed log changing invalidates default/catalog/provisioning together.
  writeFileSync(join(fx.logsRoot, 'R1.log'), 'changed protection proof')
  assert.throws(() => canonicalDefaultGlobalRoute(opts), { code: 'FLEET_GENERATION_INVALID' })
  assert.throws(() => provisionExactProfilePlugin(fx.home, 'agent-core-production', req, { harnessIdentity: FIXTURE_HARNESS }), { code: 'FLEET_GENERATION_INVALID' })
})

test('D14 ordinary production context rejects missing fleet; explicit builtin remains usable', t => {
  const root = mkdtempSync(join(tmpdir(), 'd14-no-fleet-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const opts = { deploymentRoot: root, artifactContext: createModelArtifactContext(root, {}, { fleetRequired: true }) }
  assert.throws(() => canonicalDefaultGlobalRoute(opts), { code: 'FLEET_GENERATION_INVALID' })
  const file = join(root, 'catalog.json')
  writeFileSync(file, JSON.stringify({ version: 3, routeCatalog: {}, overrides: {} }))
  assert.equal(loadAgentModelOverrides(file, [], opts).resolveChain('fixture', { provider: 'fixture-builtin', model: 'fixture-model' }).routes[0].processConfig.provider, 'fixture-builtin')
  assert.throws(() => loadAgentModelOverrides(file, [], opts).resolveChain('fixture', { provider: 'openai-codex', model: 'gpt-5.6-luna' }), { code: 'FLEET_GENERATION_INVALID' })
})
