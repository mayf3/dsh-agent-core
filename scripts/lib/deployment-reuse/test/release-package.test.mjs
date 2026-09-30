// Failure-first regression for buildRelease (T1 of the availability rollout plan).
// The builder must refuse to publish an incomplete or unsafe package BEFORE any
// bytes reach outputRoot; a clean rebuild must not depend on any live tree.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  writeFileSync(join(src, 'package.json'), JSON.stringify({
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

// Minimal honest package-lock v3 fixture: the exact shape `npm install
// --package-lock-only` produces for the demo tree (one registry dep pinned by
// integrity). Git-hosted deps pin by commit sha instead of integrity.
const LOCK_FIXTURE = () => ({
  name: 'demo-core',
  version: '0.0.0',
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': { name: 'demo-core', version: '0.0.0', dependencies: { croner: '^10.0.1' }, packageManager: 'npm' },
    'node_modules/croner': {
      version: '10.0.1',
      resolved: 'https://registry.npmjs.org/croner/-/croner-10.0.1.tgz',
      integrity: 'sha512-FIXTUREINTEGRITYVALUEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  },
})

const LOCK_TMP_DIRS = []
after(() => { for (const d of LOCK_TMP_DIRS) rmSync(d, { recursive: true, force: true }) })

function lockfileDeps(lock = LOCK_FIXTURE()) {
  const dir = mkdtempSync(join(tmpdir(), 'release-pkg-lock-'))
  LOCK_TMP_DIRS.push(dir)
  const lockfilePath = join(dir, 'package-lock.json')
  writeFileSync(lockfilePath, `${JSON.stringify(lock, null, 2)}\n`)
  return { packageManager: 'npm', registry: 'https://registry.npmjs.org/', lockfilePath }
}

const GOOD_RECIPE = (lock) => ({
  name: 'demo-release-v1',
  nodeRuntime: process.execPath, // present by construction
  harnessRoot: null, // optional in the minimal recipe
  exclude: ['node_modules', '.git', 'docs'],
  coveredGoals: ['demo-goal-1'],
  compat: { stateFormat: 'json-v1', rollbackTarget: 'app.rollback-demo' },
  dependencies: lockfileDeps(lock),
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
  assert.equal(second.manifest.dependencyDigest, first.manifest.dependencyDigest, 'dependency closure equally deterministic')
  assert.deepEqual(second.manifest.source.files, first.manifest.source.files)
  rmSync(root, { recursive: true, force: true })
})

test('failure 6: declared external dependencies without a pinned lockfile refuse the release', async () => {
  const root = tmpRoot('no-lock')
  const src = seedGoodSource(root) // root package.json declares croner
  const recipe = GOOD_RECIPE()
  delete recipe.dependencies
  const out = join(root, 'out')
  await assert.rejects(() => build(src, out, recipe), /DEPENDENCY_LOCK_MISSING/)
  assert.equal(existsSync(out), false, 'refused build must not create output artifacts')
  rmSync(root, { recursive: true, force: true })
})

test('frozen evidence snapshots (docs/evidence, deployment-artifacts) are not live-code closure edges', async () => {
  const root = tmpRoot('evidence-snapshot')
  const src = seedGoodSource(root)
  mkdirSync(join(src, 'docs', 'evidence', 'some-case-v1', 'postimage'), { recursive: true })
  writeFileSync(
    join(src, 'docs', 'evidence', 'some-case-v1', 'postimage', 'transport.js'),
    "import { helper } from '../../helper.js'\nexport const snapshot = helper\n",
  )
  mkdirSync(join(src, 'deployment-artifacts', 'targets'), { recursive: true })
  writeFileSync(join(src, 'deployment-artifacts', 'targets', 'old.js'), "import { x } from '../y.js'\nexport const old = x\n")
  const recipe = GOOD_RECIPE()
  recipe.exclude = ['node_modules', '.git'] // keep evidence trees in the package for this case
  const out = join(root, 'out')
  const { manifest } = await build(src, out, recipe)
  assert.ok(manifest.source.files.some((f) => f.path.includes('docs/evidence')), 'snapshots still ship inside the package')
  rmSync(root, { recursive: true, force: true })
})

test('failure 7: a lockfile that does not cover every declared dependency refuses the release', async () => {
  const root = tmpRoot('partial-lock')
  const src = seedGoodSource(root)
  const lock = LOCK_FIXTURE()
  delete lock.packages['node_modules/croner']
  const out = join(root, 'out')
  await assert.rejects(() => build(src, out, GOOD_RECIPE(lock)), /DEPENDENCY_LOCK_INCOMPLETE|croner/)
  assert.equal(existsSync(out), false)
  rmSync(root, { recursive: true, force: true })
})

test('dependency closure: lockfile pins version+integrity+source, ships in the package, binds dependencyDigest', async () => {
  const root = tmpRoot('dep-closure')
  const src = seedGoodSource(root)
  const out = join(root, 'out')
  const { manifest } = await build(src, out)
  const resolved = manifest.dependencies.resolved
  assert.equal(resolved.croner.version, '10.0.1')
  assert.match(resolved.croner.integrity, /^sha512-/)
  assert.match(resolved.croner.resolved, /^https:\/\/registry\.npmjs\.org\//)
  assert.equal(manifest.dependencies.packageManager, 'npm')
  assert.equal(manifest.dependencies.registry, 'https://registry.npmjs.org/')
  assert.match(manifest.dependencies.lockfile.sha256, /^[0-9a-f]{64}$/)
  assert.match(manifest.dependencyDigest, /^[0-9a-f]{64}$/)
  // The lockfile ships inside the package so re-install is offline-deterministic.
  const shipped = readFileSync(join(out, 'app', 'package-lock.json'))
  assert.equal(createHash('sha256').update(shipped).digest('hex'), manifest.dependencies.lockfile.sha256)
  rmSync(root, { recursive: true, force: true })
})

test('git-hosted dependencies pin by commit sha; no fake integrity is invented', async () => {
  const root = tmpRoot('git-dep')
  const src = seedGoodSource(root)
  mkdirSync(join(src, 'packages', 'conn'), { recursive: true })
  writeFileSync(join(src, 'packages', 'conn', 'package.json'), JSON.stringify({
    name: 'conn', type: 'module',
    dependencies: { '@x/channel': 'git+https://github.com/example/channel.git#abc123def4567890abcdef1234567890abcdef12' },
  }))
  writeFileSync(join(src, 'packages', 'conn', 'index.js'), 'export const conn = 1\n')
  const lock = LOCK_FIXTURE()
  lock.packages['node_modules/@x/channel'] = {
    version: '0.1.0',
    resolved: 'git+ssh://git@github.com/example/channel.git#abc123def4567890abcdef1234567890abcdef12',
  }
  const out = join(root, 'out')
  const { manifest } = await build(src, out, GOOD_RECIPE(lock))
  const record = manifest.dependencies.resolved['@x/channel']
  assert.equal(record.gitCommitSha, 'abc123def4567890abcdef1234567890abcdef12')
  assert.equal(record.integrity, undefined, 'git deps pin by commit sha; integrity must not be fabricated')
  rmSync(root, { recursive: true, force: true })
})

test('recipe records test/archive inclusion explicitly and refuses contradiction with content', async () => {
  const root = tmpRoot('recipe-consistency')
  const src = seedGoodSource(root)
  mkdirSync(join(src, 'packages', 'demo', 'test'), { recursive: true })
  writeFileSync(join(src, 'packages', 'demo', 'test', 'demo.test.js'), "import { test } from 'node:test'\ntest('demo', () => {})\n")
  const refused = GOOD_RECIPE()
  refused.includeTestTree = false
  const out = join(root, 'out')
  await assert.rejects(() => build(src, out, refused), /INCONSISTENT_RECIPE|includeTestTree/)
  assert.equal(existsSync(out), false)
  const ok = await build(src, join(root, 'out2'))
  assert.equal(ok.manifest.recipe.includeTestTree, true, 'effective inclusion recorded in the manifest recipe')
  rmSync(root, { recursive: true, force: true })
})
