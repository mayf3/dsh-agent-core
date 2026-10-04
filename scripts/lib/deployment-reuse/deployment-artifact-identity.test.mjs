import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import cp from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as model from '../../../packages/production-runtime/src/model-overrides.js'
import { GPT6_LUNA_ROUTE_V1 as GPT6 } from '../../../packages/agent-provisioning/src/shared-codex.js'
import { provisionAgentHome, provisionExactProfilePlugin, verifyPluginProvisioningInputs } from '../../../packages/agent-provisioning/src/index.js'
import { cohortFixture, hash } from './cohort-test-fixture.mjs'

function fixture(t) {
  const root = fs.mkdtempSync(join(tmpdir(), 'domain-artifact-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const f = cohortFixture(root), a = f.cohort.artifacts
  const stamp = { version: 2, deploymentRoot: root, sourceCommit: a.sourceCommit, artifactSha256: a.plugin.sha256 }
  fs.writeFileSync(a.sourceStamp.path, JSON.stringify(stamp))
  const v3 = JSON.parse(f.before); v3.version = 3; v3.routeCatalog.luna.credentialFile = f.canonical
  fs.writeFileSync(f.config, JSON.stringify(v3))
  const paths = { packageArtifact: a.plugin.path, sourceStamp: a.sourceStamp.path }
  return { ...f, stamp, paths, v3, context: () => model.createModelArtifactContext(root, paths) }
}
function loaded(f, context = f.context(), root = f.root) {
  return model.loadAgentModelOverrides(f.config, f.ids, { deploymentRoot: root, artifactContext: context })
}
function subscription(f, context = f.context()) { return loaded(f, context).resolveChain(f.ids[0], { provider: 'oc-go', model: 'deepseek-v4-flash' }).routes[0].processConfig.subscription }
function verify(f, s) {
  return verifyPluginProvisioningInputs({ ...s, version: s.pluginVersion }, { ...f.paths, deploymentRoot: f.root, harnessRoot: join(f.cohort.trustedRoot, 'harness') })
}
test('unmodified loader uses the own-domain rebuilt artifact for configured and built-in routes', t => {
  const f = fixture(t), context = f.context(), s = subscription(f, context)
  assert.equal(s.artifactSha256, f.cohort.artifacts.plugin.sha256)
  assert.notEqual(s.artifactSha256, model.CHATGPT_SUBSCRIPTION_V1.artifactSha256)
  assert.equal(s.sourceCommit, model.CHATGPT_SUBSCRIPTION_V1.sourceCommit)
  assert.equal(s.credentialFile, f.canonical)
  assert.doesNotThrow(() => verify(f, s))
  const builtin = model.canonicalDefaultGlobalRoute({ deploymentRoot: f.root, artifactContext: context })
  assert.equal(builtin.subscription.artifactSha256, s.artifactSha256)
  assert.equal(builtin.subscription.credentialFile, f.canonical)
  assert.deepEqual(loaded(f, context).resolveChain(f.ids[2], builtin).routes[0].processConfig.subscription, builtin.subscription)
})
test('domain A context cannot be used by domain B; unbound legacy remains unchanged in the same process', t => {
  const f = fixture(t), context = f.context(), other = join(f.root, 'other-domain')
  fs.mkdirSync(other)
  assert.throws(() => model.canonicalDefaultGlobalRoute({ deploymentRoot: other, artifactContext: context }), /deployment artifact/)
  assert.throws(() => model.createModelArtifactContext(other, f.paths), /deployment artifact/)
  const legacy = model.canonicalDefaultGlobalRoute({ deploymentRoot: other })
  assert.equal(legacy.subscription.artifactSha256, model.CHATGPT_SUBSCRIPTION_V1.artifactSha256)
  assert.equal(legacy.subscription.artifactBinding, undefined)
})
test('version-one stamp and GPT-6 preserve their exact old identities', t => {
  const f = fixture(t), context = f.context()
  const g = { ...f.v3.routeCatalog.luna, model: 'gpt-6-luna', pluginVersion: GPT6.pluginVersion, reasoningEffort: 'high' }
  f.v3.routeCatalog.gpt6 = g; f.v3.overrides[f.ids[0]].model.fallbacks = ['gpt6']
  fs.writeFileSync(f.config, JSON.stringify(f.v3))
  const routes = loaded(f, context).resolveChain(f.ids[0], {}).routes
  assert.equal(routes[0].processConfig.subscription.artifactSha256, f.cohort.artifacts.plugin.sha256)
  const s = routes[1].processConfig.subscription
  for (const key of ['sourceCommit', 'artifactSha256', 'dshVersion', 'dshCommit']) assert.equal(s[key], GPT6[key])
  assert.equal(s.reasoningEffort, 'high'); assert.equal(s.artifactBinding, undefined)
  fs.writeFileSync(f.paths.sourceStamp, JSON.stringify({ version: 1, sourceCommit: f.stamp.sourceCommit, artifactSha256: model.CHATGPT_SUBSCRIPTION_V1.artifactSha256 }))
  const legacy = model.canonicalDefaultGlobalRoute({ deploymentRoot: f.root, artifactContext: f.context() }).subscription
  assert.equal(legacy.artifactSha256, model.CHATGPT_SUBSCRIPTION_V1.artifactSha256)
})
for (const [name, mutate] of [
  ['foreign root', f => { f.stamp.deploymentRoot = join(f.root, 'foreign') }],
  ['non-normalized root', f => { f.stamp.deploymentRoot += '/..' }],
  ['wrong source pin', f => { f.stamp.sourceCommit = 'f'.repeat(40) }],
  ['wrong archive digest', f => { f.stamp.artifactSha256 = 'f'.repeat(64) }],
  ['unexpected metadata', f => { f.stamp.accepted = true }],
]) test(`declared own-domain binding refuses ${name} without fallback`, t => {
  const f = fixture(t); mutate(f); fs.writeFileSync(f.paths.sourceStamp, JSON.stringify(f.stamp))
  assert.throws(() => f.context(), /deployment artifact/)
})
test('missing or replaced stamp/archive rejects a frozen runtime context', t => {
  const f = fixture(t), context = f.context(), s = subscription(f, context)
  fs.appendFileSync(f.paths.sourceStamp, '\n')
  assert.throws(() => loaded(f, context), /deployment artifact/)
  assert.throws(() => verify(f, s), /deployment artifact/)
  fs.writeFileSync(f.paths.sourceStamp, JSON.stringify(f.stamp))
  fs.appendFileSync(f.paths.packageArtifact, 'drift')
  assert.throws(() => loaded(f, context), /deployment artifact/)
  fs.unlinkSync(f.paths.sourceStamp)
  assert.throws(() => f.context(), /deployment artifact/)
})
test('normal provisioning independently refuses a valid A subscription for a B home', t => {
  const f = fixture(t), s = subscription(f), bHome = join(f.root, 'foreign', 'homes', 'agt_test')
  assert.throws(() => provisionExactProfilePlugin(bHome, 'agent-core-production', { ...s, version: s.pluginVersion }, { ...f.paths, harnessRoot: join(f.cohort.trustedRoot, 'harness') }), /deployment artifact/)
  assert.equal(fs.existsSync(bHome), false)
})
test('the real normal installer retains the complete accepted dependency payload on fresh install and reuse', t => {
  const f = fixture(t), s = subscription(f), home = join(f.root, 'homes', f.ids[0])
  fs.rmSync(join(home, 'profiles/node_modules/dsh-codex'), { recursive: true })
  fs.writeFileSync(join(home, 'profiles/package.json'), '{}')
  const env = { HOME: f.root, npm_config_cache: join(f.root, 'npm-cache'), npm_config_userconfig: join(f.root, 'npm-user-empty'), npm_config_globalconfig: join(f.root, 'npm-global-empty') }
  for (const key of ['npm_config_userconfig', 'npm_config_globalconfig']) fs.writeFileSync(env[key], '')
  const previous = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]])); Object.assign(process.env, env)
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
  const requirement = { ...s, version: s.pluginVersion }, options = { ...f.paths, harnessRoot: join(f.cohort.trustedRoot, 'harness') }
  provisionExactProfilePlugin(home, 'agent-core-production', requirement, options)
  const dependency = join(home, 'profiles/node_modules/dsh-codex/node_modules/@deepseek-ai/fixture/index.js')
  assert.equal(fs.readFileSync(dependency, 'utf8'), 'exports.synthetic=true')
  provisionExactProfilePlugin(home, 'agent-core-production', requirement, { ...options, pluginInstaller() { assert.fail('exact payload must be reused') } })
  fs.appendFileSync(dependency, 'wrong')
  assert.throws(() => provisionExactProfilePlugin(home, 'agent-core-production', requirement, { ...options, pluginInstaller() { throw Error('corrupt payload not reused') } }), /corrupt payload not reused/)
})


test('a writable lexical parent cannot redirect otherwise trusted physical artifacts', t => {
  const f = fixture(t), redirect = join(f.root, 'redirect')
  fs.mkdirSync(redirect); fs.chmodSync(redirect, 0o777)
  fs.symlinkSync(join(f.root, 'synthetic-artifacts'), join(redirect, 'link'))
  const paths = Object.fromEntries(Object.entries(f.paths).map(([key, value]) => [key, join(redirect, 'link', value.split('/').at(-1))]))
  assert.throws(() => model.createModelArtifactContext(f.root, paths), /ancestor custody/)
})
test('normal outer home entry refuses cross-domain binding before any seed or home write', t => {
  const f = fixture(t), s = subscription(f), home = join(f.root, 'other', 'homes', 'agt_test'), workspace = join(f.root, 'work')
  assert.throws(() => provisionAgentHome(home, workspace, { profile: 'agent-core-production', subscription: s }), /deployment artifact/)
  assert.equal(fs.existsSync(home), false)
  assert.equal(fs.existsSync(workspace), false)
})
test('other subscription tuples cannot acquire or inject the own-domain legacy artifact binding', t => {
  const f = fixture(t), context = f.context()
  f.v3.routeCatalog.external = { routeKind: 'subscription', provider: 'other', model: 'other', plugin: 'other-plugin', pluginVersion: '1.0.0', credentialReadiness: 'external' }
  f.v3.overrides[f.ids[0]].model.fallbacks = ['external']
  fs.writeFileSync(f.config, JSON.stringify(f.v3))
  const routes = loaded(f, context).resolveChain(f.ids[0], {}).routes
  assert.equal(routes[1].processConfig.subscription.artifactBinding, undefined)
  const s = subscription(f, context)
  assert.throws(() => verify(f, { ...s, pluginVersion: GPT6.pluginVersion }), /exact legacy Codex tuple/)
})

test('symlink target parent traversal cannot hide a writable redirect prefix', t => {
  const f = fixture(t), unsafe = join(f.root, 'unsafe'), target = join(f.root, 'trusted-target')
  fs.mkdirSync(unsafe); fs.chmodSync(unsafe, 0o777)
  fs.mkdirSync(join(target, 'deep/child'), { recursive: true })
  fs.cpSync(join(f.root, 'synthetic-artifacts'), join(target, 'synthetic-artifacts'), { recursive: true })
  fs.symlinkSync(join(target, 'deep/child'), join(unsafe, 'jump'))
  fs.symlinkSync('unsafe/jump/../../synthetic-artifacts', join(f.root, 'bridge'))
  const paths = Object.fromEntries(Object.entries(f.paths).map(([key, value]) => [key, join(f.root, 'bridge', value.split('/').at(-1))]))
  assert.throws(() => model.createModelArtifactContext(f.root, paths), /custody|parent traversal/)
})

test('carrier consumes the same accepted artifact paths as normal provisioning', t => {
  const f = fixture(t), file = new URL('../../../docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', import.meta.url)
  const source = fs.readFileSync(file, 'utf8')
  const start = source.indexOf('bind_accepted_artifact_paths() {')
  assert.notEqual(start, -1, 'carrier must consume marker paths, not the foreign user staging constant')
  const body = source.slice(start, source.indexOf('\n}\n', start) + 3)
  const marker = join(f.root, 'accepted-marker.json')
  fs.writeFileSync(marker, JSON.stringify({ activation: { cohort: { artifacts: f.cohort.artifacts } } }))
  const run = () => cp.spawnSync('/bin/bash', ['-c', `${body}\nAMENDMENT_ACCEPTED_MARKER=$1\nNODE=$2\nbind_accepted_artifact_paths || exit 2\nprintf '%s\\n' "$FROZEN_TGZ" "$FROZEN_TGZ_SHA_FILE" "$FROZEN_SCOPES_TGZ" "$FROZEN_SCOPES_TGZ_SHA_FILE"`, 'fixture', marker, process.execPath], { encoding: 'utf8' })
  let result = run(); assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stdout.trim().split('\n'), [f.paths.packageArtifact, `${f.paths.packageArtifact}.sha256`, f.cohort.artifacts.scopes.path, `${f.cohort.artifacts.scopes.path}.sha256`])
  const m = JSON.parse(fs.readFileSync(marker)); m.activation.cohort.artifacts.plugin.path = 'relative.tgz'
  fs.writeFileSync(marker, JSON.stringify(m)); result = run(); assert.equal(result.status, 2)
})


test('carrier serializes accepted artifact path strings without JSON field injection', t => {
  const f = fixture(t)
  const source = fs.readFileSync(new URL('../../../docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', import.meta.url), 'utf8')
  const body = source.slice(source.indexOf('tx_save() {'), source.indexOf('\nprepare_recovery_root()'))
  const archive = join(f.root, 'plugin"x\\name.tgz'), scope = join(f.root, 'scopes"x.tgz'), txFile = join(f.root, 'quote-tx.json')
  fs.writeFileSync(`${archive}.sha256`, 'a'.repeat(64)); fs.writeFileSync(`${scope}.sha256`, 'b'.repeat(64))
  const env = { ...process.env, NODE: process.execPath, TX_FILE: txFile, TX_ID: 'tx-quote', TX_SCHEMA_VERSION: '1', SELF_SHA: 'f'.repeat(64), STAMP: 'fixture', ROOT: f.root, CONFIG: f.config,
    GEN_PARENT: f.root, GEN_DIR: f.root, CURRENT_LINK: join(f.root, 'current'), PREIMAGE_DIR: f.root, MANIFEST: join(f.root, 'missing-manifest'), FENCE: join(f.root, 'fence'), CANONICAL: f.canonical,
    FROZEN_TGZ: archive, FROZEN_SCOPES_TGZ: scope, FROZEN_TGZ_SHA_FILE: `${archive}.sha256`, FROZEN_SCOPES_TGZ_SHA_FILE: `${scope}.sha256`, RECOVERY_ROOT: f.root }
  delete env.B7_OUTER_ACTIVE
  const result = cp.spawnSync('/bin/bash', ['-c', `${body}\nid(){ echo 1000; }\ntx_save PREPARED`], { env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const tx = JSON.parse(fs.readFileSync(txFile))
  assert.equal(tx.state, 'PREPARED'); assert.equal(tx.pluginTgz, archive); assert.equal(tx.scopesTgz, scope)
})
