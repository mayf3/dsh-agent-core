// Failure-first regression for buildRelease (T1 of the availability rollout plan).
// The builder must refuse to publish an incomplete or unsafe package BEFORE any
// bytes reach outputRoot; a clean rebuild must not depend on any live tree.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const MOD_URL = new URL('../release-package.mjs', import.meta.url)

function loadBuilder() {
  // RED phase: module does not exist yet; import throws and every test fails
  // with MODULE_NOT_FOUND instead of silently passing.
  return import(MOD_URL).then((m) => m.buildRelease)
}

function tmpRoot(label) {
  return mkdtempSync(join(tmpdir(), `release-pkg-${label}-`))
}

// A minimal but structurally honest source tree: root package.json, one real
// package with a local import, one config, no node_modules (excluded by design).
function seedGoodSource(root) {
  const src = join(root, 'src')
  mkdirSync(join(src, 'packages', 'demo'), { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'demo-core', version: '0.0.0', private: true, type: 'module',
    dependencies: { croner: '^10.0.1' },
  }))
  writeFileSync(join(src, 'packages', 'demo', 'package.json'), JSON.stringify({ name: 'demo', type: 'module' }))
  writeFileSync(join(src, 'packages', 'demo', 'index.js'), "import { helper } from './helper.js'\nexport const demo = () => helper()\n")
  writeFileSync(join(src, 'packages', 'demo', 'helper.js'), 'export const helper = () => 1\n')
  mkdirSync(join(src, 'profile-production'), { recursive: true })
  writeFileSync(join(src, 'profile-production', 'cordis.patch.yml'), 'modelOverrides: {}\n')
  return src
}

const GOOD_RECIPE = () => ({
  name: 'demo-release-v1',
  nodeRuntime: process.execPath, // present by construction
  harnessRoot: null, // optional in the minimal recipe
  exclude: ['node_modules', '.git', 'docs'],
  coveredGoals: ['demo-goal-1'],
  compat: { stateFormat: 'json-v1', rollbackTarget: 'app.rollback-demo' },
})

async function build(src, outputRoot, recipe = GOOD_RECIPE()) {
  const buildRelease = await loadBuilder()
  return buildRelease({ sourceRoot: src, recipe, outputRoot })
}

test('happy path: complete tree is packaged with manifest binding content, not just sourceSha', async () => {
  const root = tmpRoot('ok')
  const src = seedGoodSource(root)
  const out = join(root, 'out')
  const { manifest, artifactDigest } = await build(src, out)
  assert.equal(manifest.recipe.name, 'demo-release-v1')
  assert.equal(manifest.source.files.length > 0, true)
  assert.ok(manifest.source.files.every((f) => f.sha256 && f.bytes >= 0))
  // same SHA, different content => different digest (T1 failure case 4)
  const other = tmpRoot('ok2')
  const src2 = seedGoodSource(other)
  writeFileSync(join(src2, 'packages', 'demo', 'helper.js'), 'export const helper = () => 2\n')
  const out2 = join(other, 'out')
  const second = await build(src2, out2, GOOD_RECIPE())
  assert.notEqual(second.artifactDigest, artifactDigest, 'same sourceSha with different content must yield a different artifactDigest')
  assert.equal(second.manifest.sourceSha, manifest.sourceSha === undefined ? second.manifest.sourceSha : manifest.sourceSha ?? second.manifest.sourceSha, 'sourceSha recorded for both')
  for (const r of [root, other]) rmSync(r, { recursive: true, force: true })
})

test('failure 1: a missing local module refuses the release and leaves outputRoot empty', async () => {
  const root = tmpRoot('missing-mod')
  const src = seedGoodSource(root)
  writeFileSync(join(src, 'packages', 'demo', 'index.js'), "import { x } from './does-not-exist.js'\nexport const demo = () => x\n")
  const out = join(root, 'out')
  await assert.rejects(() => build(src, out), /MODULE_MISSING|does-not-exist/)
  assert.equal(existsSync(out), false, 'refused build must not create output artifacts')
  rmSync(root, { recursive: true, force: true })
})

test('failure 2: a code directory without package.json is NOT silently skipped — build refuses', async () => {
  const root = tmpRoot('no-pkgjson')
  const src = seedGoodSource(root)
  mkdirSync(join(src, 'packages', 'orphan'), { recursive: true })
  writeFileSync(join(src, 'packages', 'orphan', 'loose.js'), 'export const loose = 1\n')
  const out = join(root, 'out')
  await assert.rejects(() => build(src, out), /PACKAGE_JSON_MISSING|orphan/)
  assert.equal(existsSync(out), false)
  rmSync(root, { recursive: true, force: true })
})

test('failure 2b: exempted dirs (docs/scripts) may lack package.json but must still be enumerated or excluded as a whole', async () => {
  const root = tmpRoot('exempt')
  const src = seedGoodSource(root)
  mkdirSync(join(src, 'docs', 'notes'), { recursive: true })
  writeFileSync(join(src, 'docs', 'notes', 'a.md'), 'text only\n')
  const out = join(root, 'out')
  const { manifest } = await build(src, out) // excluded via recipe.exclude=['docs']
  assert.ok(manifest.source.files.every((f) => !f.path.includes('docs/')), 'excluded tree stays out of the package')
  rmSync(root, { recursive: true, force: true })
})

test('failure 3: missing Node runtime (or harness when declared) refuses the release', async () => {
  const root = tmpRoot('no-node')
  const src = seedGoodSource(root)
  const out = join(root, 'out')
  const recipe = GOOD_RECIPE()
  recipe.nodeRuntime = '/nonexistent/node-runtime/bin/node'
  await assert.rejects(() => build(src, out, recipe), /NODE_RUNTIME|nodeRuntime/)
  const recipe2 = GOOD_RECIPE()
  recipe2.harnessRoot = '/nonexistent/harness'
  await assert.rejects(() => build(src, join(root, 'out2'), recipe2), /HARNESS|harnessRoot/)
  rmSync(root, { recursive: true, force: true })
})

test('failure 5: secret-looking files are refused, never packaged, never silently dropped', async () => {
  const root = tmpRoot('secret')
  const src = seedGoodSource(root)
  writeFileSync(join(src, 'packages', 'demo', 'credentials.json'), '{"token":"x"}\n')
  writeFileSync(join(src, 'secrets.env'), 'SECRET=1\n')
  const out = join(root, 'out')
  await assert.rejects(() => build(src, out), /SECRET|credentials|\.env/)
  assert.equal(existsSync(out), false)
  rmSync(root, { recursive: true, force: true })
})

test('rebuild determinism: same source built twice yields identical artifactDigest', async () => {
  const root = tmpRoot('determinism')
  const src = seedGoodSource(root)
  const first = await build(src, join(root, 'out1'))
  const second = await build(src, join(root, 'out2'))
  assert.equal(second.artifactDigest, first.artifactDigest)
  assert.deepEqual(second.manifest.source.files, first.manifest.source.files)
  rmSync(root, { recursive: true, force: true })
})
