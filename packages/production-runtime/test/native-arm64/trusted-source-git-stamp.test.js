import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const helper = join(repo, 'scripts/lib/trusted-source-git-stamp.sh')
const installer = join(repo, 'scripts/trusted-cp-deploy-install.sh')

function git(cwd, ...args) {
  return execFileSync('/usr/bin/git', args, { cwd, encoding: 'utf8' }).trim()
}

test('source stamp preserves <40-hex HEAD><dirtyCount> without Git trust mutation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trusted-source-stamp-'))
  try {
    git(dir, 'init', '-q')
    git(dir, 'config', 'user.name', 'test')
    git(dir, 'config', 'user.email', 'test@example.invalid')
    writeFileSync(join(dir, 'tracked.txt'), 'v1\n')
    git(dir, 'add', 'tracked.txt')
    git(dir, 'commit', '-qm', 'fixture')
    const head = git(dir, 'rev-parse', 'HEAD')

    assert.equal(execFileSync(helper, [dir], { encoding: 'utf8' }), `${head}0`)
    writeFileSync(join(dir, 'tracked.txt'), 'v2\n')
    assert.equal(execFileSync(helper, [dir], { encoding: 'utf8' }), `${head}1`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('source probe errors are visible and fail closed', () => {
  const result = spawnSync(helper, ['/definitely/missing/source'], { encoding: 'utf8' })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /source directory unavailable/)
  assert.equal(result.stdout, '')
})

test('the original ownership mismatch reproduces Git exit 128 with visible stderr', () => {
  const result = spawnSync('/usr/bin/git', ['-C', repo, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    env: { ...process.env, GIT_TEST_ASSUME_DIFFERENT_OWNER: '1' },
  })
  assert.equal(result.status, 128)
  assert.match(result.stderr, /fatal: detected dubious ownership in repository/)
})

test('installer probes before backup and never grants root Git trust', () => {
  const source = readFileSync(installer, 'utf8')
  const probe = source.indexOf('HARNESS_STAMP="$($SOURCE_GIT_STAMP "$HARNESS_SRC")"')
  const preserve = source.indexOf('PRESERVED_SOURCE_GIT_STAMP="$(/usr/bin/mktemp')
  const backup = source.indexOf('if [ -e "$TRUSTED_ROOT" ]; then')
  assert.ok(probe > 0 && probe < preserve && preserve < backup,
    'Git probe and stable helper copy must finish before predeploy backup')
  assert.doesNotMatch(source, /git\s+config[^\n]*safe\.directory/)
  assert.doesNotMatch(source, /git -C "\$HARNESS_SRC"/)
  assert.match(source, /printf '%s' "\$HARNESS_STAMP" > harness\/\.source-stamp/)
  const afterBackup = source.slice(backup)
  assert.doesNotMatch(afterBackup, /cp "\$SOURCE_GIT_STAMP"/)
  assert.match(afterBackup, /cp "\$PRESERVED_SOURCE_GIT_STAMP" app\/scripts\/lib\/trusted-source-git-stamp\.sh/)
  assert.match(source, /trap '\/bin\/rm -f "\$PRESERVED_SOURCE_GIT_STAMP"' EXIT/)
})

test('root path delegates Git to the source owner with a clean environment', () => {
  const source = readFileSync(helper, 'utf8')
  assert.match(source, /\/usr\/bin\/sudo -u "#\$SOURCE_UID"/)
  assert.match(source, /HOME=\/var\/empty PATH=\/usr\/bin:\/bin GIT_CONFIG_NOSYSTEM=1/)
  assert.match(source, /\/usr\/bin\/git -c core\.fsmonitor=false/)
  assert.doesNotMatch(source, /git\s+config[^\n]*safe\.directory/)
})
