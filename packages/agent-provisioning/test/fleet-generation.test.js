import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFleetGenerationFixture, FIXTURE_GENERATION, FIXTURE_HARNESS, RELEASE_FIXTURE_AVAILABLE, sha256, writeJson } from './fleet-generation-fixture.js'

// A missing module is an absent feature, surfaced as an assertion during RED.
let api = {}
try { api = await import('../src/fleet-generation.js') } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error }
let fixture
before(() => { if (RELEASE_FIXTURE_AVAILABLE) fixture = createFleetGenerationFixture() })
after(() => fixture?.cleanup())
const releasedTest = (name, fn) => test(name, { skip: RELEASE_FIXTURE_AVAILABLE ? false
  : 'NOT_EXECUTED: exact D14 released archive/dependency fixture unavailable; set D14_RELEASE_FIXTURE_ROOT' }, fn)
const read = () => {
  assert.equal(typeof api.readFleetGeneration, 'function', 'generation selection reader must exist')
  return api.readFleetGeneration(fixture.deploymentRoot)
}
const refuses = fn => assert.throws(fn, error => error.code === 'FLEET_GENERATION_INVALID')

test('absence of fleet control alone preserves distinct bounded legacy consumers', () => {
  assert.equal(typeof api.readFleetGeneration, 'function')
  const root = mkdtempSync(join(tmpdir(), 'no-fleet-generation-'))
  try {
    assert.equal(api.readFleetGeneration(root), undefined)
    mkdirSync(join(root, 'control', 'codex-plugin-runtime'), { recursive: true })
    refuses(() => api.readFleetGeneration(root))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('unknown current generation always refuses without needing released fixture bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'unknown-fleet-generation-'))
  const control = join(root, 'control', 'codex-plugin-runtime')
  try {
    mkdirSync(join(control, 'unaccepted-generation', 'node_modules'), { recursive: true })
    symlinkSync('unaccepted-generation/node_modules', join(control, 'current'))
    refuses(() => api.readFleetGeneration(root))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

releasedTest('released bytes and separately reviewed synthetic fixture yield one frozen serializable snapshot', () => {
  const snapshot = read()
  assert.equal(snapshot.generationId, 'gen-032-20261031-123906')
  assert.equal(snapshot.pluginVersion, '0.3.2')
  assert.equal(snapshot.pluginRoot, fixture.pluginRoot)
  assert.equal(snapshot.dshVersion, 'synthetic-harness-fixture')
  assert.equal(snapshot.dshCommit, '1'.repeat(40))
  assert.equal(snapshot.descriptorSha256, sha256(readFileSync(fixture.descriptorPath)))
  assert.ok(Object.isFrozen(snapshot))
  assert.equal(api.verifyFleetGeneration(JSON.parse(JSON.stringify(snapshot)), { home: fixture.home,
    harnessIdentity: { version: FIXTURE_HARNESS.version, commit: FIXTURE_HARNESS.commit } }).descriptorSha256, snapshot.descriptorSha256)
})

releasedTest('self-PASS descriptor cannot replace missing reviewed release evidence', () => {
  const original = readFileSync(fixture.receiptPath)
  rmSync(fixture.receiptPath)
  try { refuses(read) } finally { writeFileSync(fixture.receiptPath, original, { mode: 0o600 }) }
})

releasedTest('unaccepted plugin identities and guessed Harness closure refuse even with a rebound receipt', () => {
  for (const delta of [{ pluginVersion: '0.2.3' }, { sourceCommit: '4'.repeat(40) }, { harness: {} }, { harness: { ...FIXTURE_HARNESS, closureSha256: 'UNKNOWN' } }]) {
    fixture.qualify({ ...fixture.descriptor, ...delta })
    refuses(read)
  }
  fixture.qualify()
})

releasedTest('missing, non-independent and descriptor-mismatched reviews refuse', () => {
  for (const delta of [{ proofs: {} }, { reviewer: { id: 'synthetic-fixture-author', independent: true } },
    { reviewer: { id: 'someone', independent: false } }, { descriptorSha256: '0'.repeat(64) }]) {
    fixture.qualify(fixture.descriptor, delta)
    refuses(read)
  }
  fixture.qualify()
})

releasedTest('drifted or unprotected evidence logs refuse', () => {
  const log = join(fixture.logsRoot, 'R1.log')
  const original = readFileSync(log)
  writeFileSync(log, 'changed after review')
  refuses(read)
  writeFileSync(log, original)
  chmodSync(log, 0o666)
  try { refuses(read) } finally { chmodSync(log, 0o600) }
})

releasedTest('selected plugin payload drift and undeclared executable files refuse without repair', () => {
  const file = join(fixture.pluginRoot, 'package.json')
  const original = readFileSync(file)
  writeFileSync(file, '{"name":"dsh-codex","version":"0.3.2"}\n')
  refuses(read)
  assert.equal(readFileSync(file, 'utf8'), '{"name":"dsh-codex","version":"0.3.2"}\n')
  writeFileSync(file, original)
  const extra = join(fixture.pluginRoot, 'undeclared.js')
  writeFileSync(extra, 'export default "not in reviewed artifact"')
  try { refuses(read) } finally { rmSync(extra) }
})

releasedTest('archive and embedded dependency closure drift refuse', () => {
  const archive = join(fixture.generationRoot, 'release.tgz')
  const saved = `${archive}.saved`
  renameSync(archive, saved)
  writeFileSync(archive, 'not accepted bytes')
  try { refuses(read) } finally { rmSync(archive); renameSync(saved, archive) }
  const closure = join(fixture.pluginRoot, 'build-provenance', 'runtime-closure-manifest.json')
  const original = readFileSync(closure)
  writeJson(closure, { treeDigest: fixture.descriptor.dependencyTreeDigest, fileCount: 0 })
  try { refuses(read) } finally { writeFileSync(closure, original) }
})

releasedTest('dispatch rejects a changed selector, wrong home and wrong actual Harness against frozen snapshot', () => {
  const snapshot = read()
  const current = join(fixture.control, 'current')
  const wrong = join(fixture.control, 'wrong-node-modules')
  mkdirSync(wrong)
  rmSync(current)
  symlinkSync(wrong, current)
  try { refuses(() => api.verifyFleetGenerationDispatch(snapshot, { home: fixture.home })) }
  finally { rmSync(current); symlinkSync(join(FIXTURE_GENERATION, 'node_modules'), current); rmSync(wrong, { recursive: true }) }
  refuses(() => api.verifyFleetGeneration(snapshot, { home: fixture.control }))
  refuses(() => api.verifyFleetGeneration(snapshot, { harnessIdentity: { version: '0.1.0-rc.8', commit: '5'.repeat(40) } }))
})

releasedTest('dispatch detects newly reviewed descriptor changes and forged serialized snapshot fields', () => {
  const snapshot = read()
  fixture.qualify({ ...fixture.descriptor, coreSourceCommit: '6'.repeat(40) })
  refuses(() => api.verifyFleetGeneration(snapshot))
  fixture.qualify()
  refuses(() => api.verifyFleetGeneration({ ...snapshot, pluginRoot: '/untrusted/plugin' }))
})

releasedTest('removing the entire fleet selection never falls back for an existing snapshot', () => {
  const snapshot = read()
  const saved = `${fixture.control}.saved`
  renameSync(fixture.control, saved)
  try {
    assert.equal(api.readFleetGeneration(fixture.deploymentRoot), undefined)
    refuses(() => api.verifyFleetGeneration(snapshot))
  } finally { renameSync(saved, fixture.control) }
})

releasedTest('generation verification leaves shared payload and reviewed files unchanged', () => {
  const paths = [fixture.descriptorPath, fixture.receiptPath, join(fixture.pluginRoot, 'package.json')]
  const before = paths.map(path => sha256(readFileSync(path)))
  api.verifyFleetGenerationDispatch(read(), { home: fixture.home })
  assert.deepEqual(paths.map(path => sha256(readFileSync(path))), before)
})
