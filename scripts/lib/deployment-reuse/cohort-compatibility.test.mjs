import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMigration } from '../trusted-cp-fleet-config-v2v3-migration.mjs'
import { runGate } from '../trusted-cp-model-overrides-config-gate.mjs'
import { runtimePhase } from './cohort-runtime-fixture.mjs'
import { dependencyDigest } from './cohort-binding.mjs'
import { cohortFixture, observation } from './cohort-test-fixture.mjs'
const loader = fileURLToPath(new URL('../../../packages/production-runtime/src/model-overrides.js', import.meta.url))
const definition = fileURLToPath(new URL('../../../packages/agent-definition/src/definition.js', import.meta.url))
function fixture(nF, nR) { const root = fs.mkdtempSync(join(tmpdir(), 'b7-cohort-fixture-')); return cohortFixture(root, nF, nR) }
const args = f => ({ config: f.config, registry: f.registry, deploymentRoot: f.root, modelOverridesModule: loader, definitionModule: definition, cohort: f.cohort, runtimePhase: 'pre', execute: true })
test('bound active registry and legacy subset migrate while every identity and inherited route stays usable', async () => {
  const f = fixture(92, 98)
  try {
    const result = await runMigration(args(f))
    assert.equal(result.ok, true, result.error)
    assert.equal(result.cohort.migrationCount, 92)
    assert.equal(result.cohort.compatibilityCount, 98)
    assert.deepEqual(JSON.parse(fs.readFileSync(f.config)).overrides, JSON.parse(f.before).overrides)
    assert.deepEqual(fs.readFileSync(f.registry), f.registryBefore)
    const verified = await runGate(args(f))
    assert.equal(verified.ok, true, verified.error)
    assert.equal(verified.cohort.compatibilityCount, 98)
    assert.equal(Object.keys(verified.cohort.routes).length, 98)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})
for (const [name, mutate] of [
  ['same-count identity substitution', f => { f.cohort.registryIds[2] = 'agt_replaced-fixture' }],
  ['missing consumer evidence', f => { delete f.cohort.consumers[f.ids[2]] }],
  ['blocked consumer', f => { f.cohort.consumers[f.ids[2]].readiness = 'BLOCKED' }],
  ['changed inherited origin', f => { f.cohort.routing.source = 'composition_config' }],
  ['foreign canonical on inherited route', f => { f.cohort.routing.globalRoute.subscription = { credentialFile: '/foreign/canonical' } }],
  ['runtime input drift', f => { fs.writeFileSync(f.runtimeContext, '{}') }],
  ['missing inherited plugin', f => { fs.rmSync(join(f.root, 'homes', f.ids[2], 'profiles/node_modules/dsh-codex/lib/index.js')) }],
]) test(`bound cohort refuses ${name} before mutation`, async () => {
  const f = fixture()
  try {
    mutate(f)
    const result = await runMigration(args(f))
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'FLEET_CONFIG_COHORT_BINDING_INVALID', result.error)
    assert.equal(result.configReplaced, false)
    assert.deepEqual(fs.readFileSync(f.config), f.before)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})
test('bound registry-only active identities require a packet; ordinary mismatch still refuses', async () => {
  const f = fixture()
  try { const result = await runMigration({ ...args(f), cohort: undefined }); assert.equal(result.errorCode, 'FLEET_CONFIG_COHORT_DRIFT') }
  finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

for (const source of ['composition_config', 'builtin_default']) test(`captured ${source} cannot invent a subscription shape the real composition would not produce`, async () => {
  const f = fixture()
  try {
    f.cohort.routing.source = source
    for (const id of f.ids.filter(id => !f.migrationIds.includes(id))) f.cohort.consumers[id].route.source = source
    fs.writeFileSync(f.runtimeContext, JSON.stringify({ source, globalRoute: f.cohort.routing.globalRoute }))
    f.cohort.routing.inputs = [observation('routing', f.runtimeContext)]
    const result = await runMigration(args(f))
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'FLEET_CONFIG_COHORT_BINDING_INVALID')
    assert.deepEqual(fs.readFileSync(f.config), f.before)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

test('post-code/pre-plugin gate accepts state-appropriate provisioning and dependency postimages', async () => {
  const f = fixture()
  try {
    const code = join(f.root, 'trusted/app/packages/agent-provisioning/src/index.js')
    const deps = join(f.root, 'trusted/app/node_modules/dependency-fixture/index.js')
    const originals = new Map([[code, fs.readFileSync(code, 'utf8')], [deps, 'export const fixture=true']])
    for (const path of [code, deps]) {
      fs.mkdirSync(join(path, '..'), { recursive: true })
      fs.writeFileSync(path, originals.get(path) + '\n// old generation')
    }
    for (const [role, path] of [['provisioning', code], ['dependencies', deps]]) {
      const before = observation(role, path)
      fs.writeFileSync(path, originals.get(path) + '\n// new generation')
      const after = observation(role, path)
      fs.writeFileSync(path, originals.get(path) + '\n// old generation')
      for (const item of Object.values(f.cohort.consumers)) {
        item.pre = item.pre.map(o => o.role === role ? before : o)
        item.post = item.post.map(o => o.role === role ? after : o)
      }
    }
    assert.equal((await runMigration(args(f))).ok, true)
    for (const path of [code, deps]) fs.writeFileSync(path, originals.get(path) + '\n// new generation')
    assert.equal((await runGate({ ...args(f), consumerPhase: 'pre' })).ok, false)
    const result = await runGate({ ...args(f), consumerPhase: 'code-installed' })
    assert.equal(result.ok, true, result.error)
    assert.equal(result.cohort.compatibilityCount, f.ids.length)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

for (const [name, mutate] of [
  ['inherited profile names a foreign canonical', f => {
    const item = f.cohort.consumers[f.ids[0]]
    const path = item.pre.find(o => o.role === 'profile').path
    fs.writeFileSync(path, '# BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n- id: llm-openai-codex\n  config:\n    credentialFile: "/foreign/store"\n# END AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n')
    for (const side of ['pre', 'post']) item[side] = item[side].map(o => o.role === 'profile' ? observation('profile', path) : o)
  }],
  ['dependency directory loses a required module', f => {
    const directory = join(f.root, 'dependency-closure')
    fs.mkdirSync(directory)
    const module = join(directory, 'required.mjs')
    fs.writeFileSync(module, 'export const required = true')
    const row = { ...observation('dependencies', directory), treeSha256: dependencyDigest(directory) }
    for (const side of ['pre', 'post']) f.cohort.consumers[f.ids[2]][side] = f.cohort.consumers[f.ids[2]][side].map(o => o.role === 'dependencies' ? row : o)
    fs.unlinkSync(module)
  }],
]) test(`consumer semantics rejects ${name} despite matching metadata`, async () => {
  const f = fixture()
  try {
    mutate(f)
    const result = await runMigration(args(f))
    assert.equal(result.ok, false)
    assert.equal(result.configReplaced, false)
    assert.deepEqual(fs.readFileSync(f.config), f.before)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

test('code-installed phase retains preimage for dependency trees owned by not-yet-wired homes', async () => {
  const f = fixture()
  try {
    for (const id of f.ids) {
      const directory = join(f.root, 'homes', id, 'profiles/node_modules')
      const module = join(directory, 'dependency-fixture.mjs')
      fs.writeFileSync(module, 'export const version = "old"')
      const before = { ...observation('dependencies', directory), treeSha256: dependencyDigest(directory) }
      fs.writeFileSync(module, 'export const version = "new"')
      const after = { ...observation('dependencies', directory), treeSha256: dependencyDigest(directory) }
      fs.writeFileSync(module, 'export const version = "old"')
      const item = f.cohort.consumers[id]
      item.pre = item.pre.map(o => o.role === 'dependencies' ? before : o)
      item.post = item.post.map(o => o.role === 'dependencies' ? after : o)
    }
    assert.equal((await runMigration(args(f))).ok, true)
    const result = await runGate({ ...args(f), consumerPhase: 'code-installed' })
    assert.equal(result.ok, true, result.error)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

// Actual-source and artifact negatives: updating the packet's own hashes must
// not make a different live route or an unaccepted payload authoritative.
test('self-described route cannot replace a disagreeing actual job read', async () => {
  const f = fixture()
  try {
    const result = await runMigration({ ...args(f), runtimeRead: () => ({ source: 'runtime_env', globalRoute: { provider: 'wrong', model: 'wrong' } }) })
    assert.equal(result.ok, false)
    assert.equal(result.configReplaced, false)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})
test('updated consumer observation cannot bless payload bytes absent from accepted artifacts', async () => {
  const f = fixture()
  try {
    assert.equal((await runMigration(args(f))).ok, true)
    const item = f.cohort.consumers[f.ids[0]], plugin = item.pre.find(o => o.role === 'plugin').path
    fs.appendFileSync(plugin, ';exports.extraUnacceptedBehavior=true')
    for (const side of ['pre', 'post']) item[side] = item[side].map(o => o.role === 'plugin' ? observation('plugin', plugin) : o)
    const result = await runGate(args(f))
    assert.equal(result.ok, false)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})
