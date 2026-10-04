import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import cp from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { provisionExactProfilePlugin } from '../../../packages/agent-provisioning/src/index.js'
import { createModelArtifactContext, canonicalDefaultGlobalRoute } from '../../../packages/production-runtime/src/model-overrides.js'
import { GPT6_LUNA_ROUTE_V1 } from '../../../packages/agent-provisioning/src/shared-codex.js'
import { inspectArtifactComposition, resolvePluginPeerLinks } from '../../../packages/agent-provisioning/src/plugin-artifact.js'
import { cohortFixture, observation, hash } from './cohort-test-fixture.mjs'
import { runtimePhase } from './cohort-runtime-fixture.mjs'
import { readBoundRuntime } from './cohort-runtime.mjs'
import { verifyConsumerArtifacts } from './cohort-artifacts.mjs'
const withFixture = fn => {
  const root = fs.mkdtempSync(join(tmpdir(), 'b7-source-fixture-'))
  try { return fn(cohortFixture(root)) } finally { fs.rmSync(root, { recursive: true, force: true }) }
}
function changeSource(f, fn) { const x = JSON.parse(fs.readFileSync(f.runtimeContext)); fn(x); fs.writeFileSync(f.runtimeContext, JSON.stringify(x)) }
for (const [name, mutate] of [
  ['loaded job route changed', x => { x.runtime.inputs.environment.DSH_AGENT_MODEL = 'changed' }],
  ['next bootstrap plist differs', x => { x.plistInputs = structuredClone(x.runtime.inputs); x.plistInputs.environment.DSH_AGENT_MODEL = 'changed' }],
  ['explicit route input absent/unknown', x => { x.runtime.inputs.environment.DSH_AGENT_PROVIDER = null }],
  ['pre instance replaced', x => { x.runtime.preInstance.pid++ }],
]) test(`runtime source refuses ${name}`, () => withFixture(f => {
  changeSource(f, mutate)
  assert.throws(() => readBoundRuntime(f.cohort))
}))
test('runtime source refuses instance changes between its first and second read', () => withFixture(f => {
  let prints = 0
  assert.throws(() => readBoundRuntime(f.cohort, { run(file, args) {
    if (file === '/bin/launchctl' && ++prints === 2) changeSource(f, x => { x.runtime.preInstance.pid++ })
    return cp.execFileSync(file, args, { encoding: 'utf8' })
  } }), /instance changed/)
}))
test('runtime source does not substitute another read when process metadata is denied', () => withFixture(f => {
  const calls = []
  assert.throws(() => readBoundRuntime(f.cohort, { run(file, args) {
    calls.push(file)
    if (file === '/bin/ps') throw Object.assign(new Error('synthetic EACCES'), { code: 'EACCES' })
    return cp.execFileSync(file, args, { encoding: 'utf8' })
  } }), /EACCES/)
  assert.deepEqual(calls, ['/bin/launchctl', '/bin/ps'])
}))
test('quiesced uses fixed bootstrap inputs only after both old job and instance are gone', () => withFixture(f => {
  assert.throws(() => readBoundRuntime(f.cohort, { phase: 'quiesced', codePhase: 'pre' }))
  runtimePhase(f, 'quiesced')
  const result = readBoundRuntime(f.cohort, { phase: 'quiesced', codePhase: 'pre' })
  assert.equal(result.instance, null)
  assert.deepEqual(result.globalRoute, f.cohort.routing.globalRoute)
}))
test('post phase binds a new instance and rechecks candidate entry bytes', () => withFixture(f => {
  assert.throws(() => readBoundRuntime(f.cohort, { phase: 'post' }), /not restarted/)
  runtimePhase(f, 'post')
  assert.notEqual(readBoundRuntime(f.cohort, { phase: 'post' }).instance.pid, f.cohort.routing.runtime.preInstance.pid)
  fs.appendFileSync(join(f.cohort.trustedRoot, 'app/scripts/production-runtime.mjs'), '\n// drift')
  assert.throws(() => readBoundRuntime(f.cohort, { phase: 'post' }), /generation drift/)
}))
function fixtureDefaultRoute(f) {
  const artifactContext = createModelArtifactContext(f.root, {
    packageArtifact: f.cohort.artifacts.plugin.path, sourceStamp: f.cohort.artifacts.sourceStamp.path,
  })
  return canonicalDefaultGlobalRoute({ deploymentRoot: f.root, artifactContext })
}
function proof(f, phase = 'pre', inheritedCodex = false) {
  const runtime = readBoundRuntime(f.cohort)
  // Consumer-only fixture: exercise inherited subscription payload checks;
  // this value is never claimed to be the fixed launchd entry's global route.
  if (inheritedCodex) runtime.globalRoute = fixtureDefaultRoute(f)
  return verifyConsumerArtifacts(f.cohort, { configSource: f.before.toString(), runtime, phase })
}
test('complete dual archive payload passes inherited consumer proof; old bytes fail before mutation', () => withFixture(f => {
  assert.equal(proof(f, 'pre', true).payload[f.ids[2]], true)
  fs.appendFileSync(join(f.root, 'homes', f.ids[2], 'profiles/node_modules/dsh-codex/lib/index.js'), '\nexports.changed=true')
  assert.throws(() => proof(f, 'pre', true), /actual loader\/provisioning\/payload/)
}))
test('legacy F payload may be old before wiring but must match accepted archives afterward', () => withFixture(f => {
  const plugin = join(f.root, 'homes', f.ids[0], 'profiles/node_modules/dsh-codex/lib/index.js')
  fs.appendFileSync(plugin, '\nexports.old=true')
  assert.ok(proof(f, 'pre'))
  assert.throws(() => proof(f, 'post'), /actual loader\/provisioning\/payload/)
}))
test('scope corruption is rejected even when plugin version and main export file match', () => withFixture(f => {
  fs.appendFileSync(join(f.root, 'homes', f.ids[0], 'profiles/node_modules/dsh-codex/node_modules/@deepseek-ai/fixture/index.js'), '\nexports.changed=true')
  assert.throws(() => proof(f, 'post'), /actual loader\/provisioning\/payload/)
}))
for (const [name, mutate] of [
  ['source stamp conflicts with actual loader pin', f => { const o=f.cohort.artifacts.sourceStamp; fs.writeFileSync(o.path,JSON.stringify({version:1,sourceCommit:'c'.repeat(40),artifactSha256:f.cohort.artifacts.plugin.sha256}));o.sha256=hash(fs.readFileSync(o.path)) }],
  ['accepted archive conflicts with normal provisioning pin', f => { f.cohort.artifacts.plugin.sha256='f'.repeat(64) }],
  ['candidate Harness identity conflicts', f => { fs.writeFileSync(join(f.cohort.trustedRoot,'harness/.source-stamp'),JSON.stringify({commit:'c'.repeat(40),dirtyCount:0})) }],
  ['actual home farm points outside candidate', f => { const link=join(f.root,'homes',f.ids[0],'profiles/node_modules/@agent-core/broker');fs.unlinkSync(link);fs.symlinkSync(f.root,link) }],
]) test(`provisioning rejects ${name}`, () => withFixture(f => { mutate(f); assert.throws(() => proof(f)) }))

test('normal provisioning reuses the complete accepted payload without deleting its scopes', () => withFixture(f => {
  let installs = 0
  const home = join(f.root, 'homes', f.ids[0])
  const subscription = fixtureDefaultRoute(f).subscription
  provisionExactProfilePlugin(home, 'agent-core-production', { ...subscription, version: subscription.pluginVersion }, {
    packageArtifact: f.cohort.artifacts.plugin.path, sourceStamp: f.cohort.artifacts.sourceStamp.path,
    harnessRoot: join(f.cohort.trustedRoot, 'harness'), pluginInstaller() { installs++; throw Error('unexpected replacement') },
  })
  assert.equal(installs, 0)
  assert.equal(fs.existsSync(join(home, 'profiles/node_modules/dsh-codex/node_modules/@deepseek-ai/fixture/index.js')), true)
}))
test('correct harness identity cannot hide a missing normal provisioning peer', () => withFixture(f => {
  fs.rmSync(join(f.cohort.trustedRoot, 'harness/node_modules/.pnpm/node_modules/@deepseek-ai/fixture'), { recursive: true })
  assert.throws(() => proof(f), /actual loader\/provisioning\/payload/)
}))
test('split package that normal provisioning cannot reproduce is rejected before apply', () => withFixture(f => {
  fs.rmSync(join(f.packageRoot, 'node_modules'), { recursive: true })
  const split = join(f.root, 'synthetic-artifacts/split.tgz')
  cp.execFileSync('/usr/bin/tar', ['-czf', split, '-C', join(f.packageRoot, '..'), 'package'])
  assert.throws(() => inspectArtifactComposition(split, f.cohort.artifacts.scopes.path), /normal provisioning artifact differs/)
}))

test('entry modified within the process start second remains UNKNOWN', () => withFixture(f => {
  const path = join(f.cohort.trustedRoot, 'app/scripts/production-runtime.mjs')
  const when = new Date(Date.parse(f.cohort.routing.runtime.preInstance.started) + 500)
  fs.utimesSync(path, when, when)
  assert.throws(() => readBoundRuntime(f.cohort), /entry newer than running instance/)
}))
test('inherited-only provisioning environment is unknown, not explicit absence', () => withFixture(f => {
  assert.throws(() => readBoundRuntime(f.cohort, { run(file, args) {
    const result = cp.execFileSync(file, args, { encoding: 'utf8' })
    return file === '/bin/launchctl' ? result.replace(' environment = {', ' inherited environment = {\nDSH_SETTINGS_SOURCE => /unproven/settings\n }\n environment = {') : result
  } }), /inherited runtime input/)
}))
test('quiescence distinguishes a reused PID from the recorded old process instance', () => withFixture(f => {
  runtimePhase(f, 'quiesced')
  const result = readBoundRuntime(f.cohort, { phase: 'quiesced', codePhase: 'pre', run(file, args) {
    if (file === '/bin/ps') { const p=f.cohort.routing.runtime.preInstance; return `${p.pid} ${p.uid} ${p.gid} Sun Oct  4 14:00:00 2037 ${p.program}\n` }
    return cp.execFileSync(file, args, { encoding: 'utf8' })
  } })
  assert.equal(result.instance, null)
}))

test('read-only peer planning validates a future pi-ai link through its actual harness source', () => withFixture(f => {
  const profiles = join(f.root, 'homes', f.ids[0], 'profiles')
  const harness = join(f.cohort.trustedRoot, 'harness')
  const peer = join(harness, 'node_modules/.pnpm/node_modules/@earendil-works/pi-ai')
  fs.mkdirSync(join(peer, 'dist/providers/data'), { recursive: true })
  fs.writeFileSync(join(peer, 'package.json'), JSON.stringify({ version: GPT6_LUNA_ROUTE_V1.piAiVersion }))
  fs.copyFileSync(new URL('../../../packages/agent-provisioning/test/fixtures/pi-ai-0.87.1-openai-codex-catalog.json', import.meta.url), join(peer, 'dist/providers/data/openai-codex.json'))
  const plan = resolvePluginPeerLinks({ peerDependencies: { '@earendil-works/pi-ai': '*' } }, profiles, harness,
    { plugin: GPT6_LUNA_ROUTE_V1.plugin, version: GPT6_LUNA_ROUTE_V1.pluginVersion, dshVersion: GPT6_LUNA_ROUTE_V1.dshVersion })
  assert.equal(plan[0].source, peer)
  assert.equal(fs.existsSync(plan[0].destination), false, 'planning must not create the link')
  fs.writeFileSync(join(peer, 'dist/providers/data/openai-codex.json'), '{}')
  assert.throws(() => resolvePluginPeerLinks({ peerDependencies: { '@earendil-works/pi-ai': '*' } }, profiles, harness,
    { plugin: GPT6_LUNA_ROUTE_V1.plugin, version: GPT6_LUNA_ROUTE_V1.pluginVersion, dshVersion: GPT6_LUNA_ROUTE_V1.dshVersion }), error => error.code === 'pi_ai_identity_mismatch')
}))
