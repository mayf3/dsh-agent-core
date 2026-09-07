import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { stageApplication, ARM_SOURCE_DELTA } from '../../src/native-arm64/stage.js'
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'arm-stage-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const run = (dir, ...args) => execFileSync('/usr/bin/git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()
  const put = (dir, path, data) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), data) }
  const live = join(root, 'live'), candidate = join(root, 'candidate')
  for (const dir of [live, candidate]) {
    mkdirSync(dir);run(dir, 'init', '-q');run(dir, 'config', 'user.email', 'fixture@example.invalid');run(dir, 'config', 'user.name', 'Fixture')
    put(dir, 'package.json', '{}');put(dir, 'packages/app/src/main.js', 'original');put(dir, ARM_SOURCE_DELTA[0], 'old-launcher')
    run(dir, 'add', '.');run(dir, 'commit', '-qm', 'base')
  }
  put(live, 'packages/app/src/main.js', 'legitimate-live-wip')
  put(candidate, 'packages/app/src/main.js', 'unrelated-new-business-behavior')
  for (const path of ARM_SOURCE_DELTA) put(candidate, path, 'frozen-arm-delta-'+path)
  run(candidate, 'add', '.');run(candidate, 'commit', '-qm', 'candidate')
  const sha = run(candidate, 'rev-parse', 'HEAD')
  // Unreviewed post-freeze editing must never leak into the stage.
  put(candidate, ARM_SOURCE_DELTA[0], 'uncommitted-new-code')
  return { root, live, candidate, sha, put, run, options: { liveRoot: live, candidateRoot: candidate, candidateSHA: sha, stageRoot: join(root, 'stage') } }
}
test('stage preserves live WIP, excludes unrelated main, and overlays frozen commit bytes only', t => {
  const f = fixture(t)
  const before = f.run(f.live, 'status', '--porcelain')
  const result = stageApplication(f.options)
  assert.equal(readFileSync(join(result.stageRoot, 'packages/app/src/main.js'), 'utf8'), 'legitimate-live-wip')
  assert.equal(readFileSync(join(result.stageRoot, ARM_SOURCE_DELTA[0]), 'utf8'), 'frozen-arm-delta-'+ARM_SOURCE_DELTA[0])
  assert.equal(f.run(f.live, 'status', '--porcelain'), before)
  assert.equal(result.files.filter(x => x.source === 'ARM_MIGRATION_DELTA').length, 2)
  assert.equal(result.productionApply, 'HOLD')
})
test('stage refuses a production destination and source symlinks before writing', t => {
  const f = fixture(t)
  assert.throws(() => stageApplication({ ...f.options, stageRoot: join(f.live, 'stage') }), /ISOLATED_NEW_STAGE_REQUIRED|STAGE_PARENT_ESCAPES_ISOLATION/)
  symlinkSync('/etc/hosts', join(f.live, 'packages/leaked.js'))
  assert.throws(() => stageApplication(f.options), /SOURCE_LINK_OR_SPECIAL_FILE/)
  assert.equal(existsSync(f.options.stageRoot), false)
})
