import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const resolver = join(repo, 'scripts/lib/trusted-pnpm-resolver.sh')
const installer = join(repo, 'scripts/trusted-cp-deploy-install.sh')
const realPnpm = '/opt/homebrew/bin/pnpm'

function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'trusted-pnpm-resolver-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const harness = join(root, 'harness-source')
  const stageRoot = join(root, 'stage')
  const record = join(root, 'resolution.env')
  mkdirSync(join(harness, 'apps/cli/lib'), { recursive: true })
  writeFileSync(join(harness, 'apps/cli/lib/bin.js'), 'export {}\n')
  writeFileSync(join(harness, 'package.json'), JSON.stringify({
    name: 'fixture-harness', private: true,
    packageManager: options.packageManager ?? 'pnpm@11.7.0',
  }) + '\n')
  writeFileSync(join(harness, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\nimporters:\n  .: {}\n")
  return { root, harness, stageRoot, record }
}

function fakePnpm(root, options = {}) {
  const dir = join(root, options.corepack ? 'corepack/dist' : 'direct')
  const file = join(dir, 'pnpm.cjs')
  mkdirSync(dir, { recursive: true })
  const config = JSON.stringify({ version: '11.7.0', ...options })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: options.packageName ?? (options.corepack ? 'corepack' : 'pnpm'),
    version: options.version ?? '11.7.0',
    bin: { pnpm: 'pnpm.cjs' },
  }))
  writeFileSync(file, `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const cfg = ${config}
if (cfg.networkSentinel) fs.writeFileSync(cfg.networkSentinel, 'attempted')
if (process.argv[2] === '--version') {
  if (cfg.versionCounter) fs.appendFileSync(cfg.versionCounter, '1\\n')
  if (cfg.slow) setTimeout(() => console.log(cfg.version), 3000)
  else if (cfg.versionExit) { console.error(cfg.stderr || 'version probe failed'); process.exit(cfg.versionExit) }
  else if (cfg.rawVersion) process.stdout.write(cfg.rawVersion)
  else console.log(cfg.version)
} else if (process.argv[2] === 'install') {
  if (cfg.installExit) { console.error(cfg.stderr || 'offline install failed'); process.exit(cfg.installExit) }
  if (cfg.mutateSelf) fs.appendFileSync(__filename, '\\n// drift')
  fs.mkdirSync(path.join(process.cwd(), 'node_modules'), { recursive: true })
  fs.writeFileSync(path.join(process.cwd(), '.execution.json'), JSON.stringify({
    uid: process.getuid(), execPath: process.execPath, arch: process.arch,
    argv: process.argv.slice(2), env: process.env,
  }))
  if (cfg.mutateDeclaration) {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json')))
    manifest.packageManager = 'pnpm@10.0.0'
    fs.writeFileSync(path.join(process.cwd(), 'package.json'), JSON.stringify(manifest))
  }
  if (cfg.redirectStage) {
    fs.rmSync(path.join(process.cwd(), 'node_modules'), { recursive: true, force: true })
    fs.symlinkSync(cfg.redirectStage, path.join(process.cwd(), 'node_modules'))
  }
  if (cfg.internalLink) {
    fs.writeFileSync(path.join(process.cwd(), 'node_modules/target.js'), 'export {}')
    fs.symlinkSync('target.js', path.join(process.cwd(), 'node_modules/internal-link.js'))
  }
} else { console.error('unexpected invocation'); process.exit(64) }
`)
  chmodSync(file, 0o755)
  return file
}

function run(f, candidate, extra = {}) {
  const args = [
    '--harness', f.harness,
    '--node-bin', process.execPath,
    '--expected-node-version', process.version,
    '--expected-node-arch', process.arch,
    '--stage-root', f.stageRoot,
    '--record', f.record,
    '--configured-pnpm', candidate,
    '--timeout-seconds', String(extra.timeoutSeconds ?? 2),
  ]
  return spawnSync(resolver, args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      HTTP_PROXY: 'http://must-not-leak.invalid',
      HTTPS_PROXY: 'http://must-not-leak.invalid',
      ALL_PROXY: 'socks://must-not-leak.invalid',
    },
  })
}

function runAutomatic(f, homebrewCandidate, localCandidate) {
  return spawnSync(resolver, [
    '--harness', f.harness,
    '--node-bin', process.execPath,
    '--expected-node-version', process.version,
    '--expected-node-arch', process.arch,
    '--stage-root', f.stageRoot,
    '--record', f.record,
    '--homebrew-candidate', homebrewCandidate,
    '--local-candidate', localCandidate,
    '--timeout-seconds', '2',
  ], { encoding: 'utf8' })
}

function recordOf(path) {
  return Object.fromEntries(readFileSync(path, 'utf8').trim().split('\n').map((line) => {
    const at = line.indexOf('=')
    return [line.slice(0, at), line.slice(at + 1)]
  }))
}

function detail(result) {
  return result.stderr || result.error?.message || `exit=${result.status}`
}

test('A: real executable pnpm 11.7.0 passes exact offline installation', (t) => {
  assert.equal(existsSync(realPnpm), true, 'host acceptance candidate must exist')
  const f = fixture(t)
  const result = run(f, realPnpm, { timeoutSeconds: 20 })
  assert.equal(result.status, 0, detail(result))
  const frozen = recordOf(f.record)
  assert.equal(frozen.DECLARED_PNPM_VERSION, '11.7.0')
  assert.equal(frozen.PNPM_VERSION, '11.7.0')
  assert.equal(frozen.PNPM_REALPATH, realpathSync(realPnpm))
  assert.equal(existsSync(join(f.stageRoot, 'harness/node_modules')), true)
})

test('B: Corepack candidate is rejected before network bootstrap', (t) => {
  const f = fixture(t)
  const sentinel = join(f.root, 'network-attempted')
  const candidate = fakePnpm(f.root, { corepack: true, networkSentinel: sentinel })
  const result = run(f, candidate)
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Corepack/i)
  assert.equal(existsSync(sentinel), false)
  assert.equal(existsSync(f.record), false)

  const forwarding = fixture(t)
  const forwardingSentinel = join(forwarding.root, 'forwarding-network-attempted')
  const outsideCorepack = fakePnpm(forwarding.root, {
    packageName: 'corepack', networkSentinel: forwardingSentinel,
  })
  const forwardingResult = run(forwarding, outsideCorepack)
  assert.equal(forwardingResult.status, 2)
  assert.match(forwardingResult.stderr, /direct declared pnpm distribution/i)
  assert.equal(existsSync(forwardingSentinel), false)
})

test('C: exact configured path with the wrong version fails closed', (t) => {
  const f = fixture(t)
  const result = run(f, fakePnpm(f.root, { version: '11.6.0' }))
  assert.equal(result.status, 2)
  assert.match(result.stderr, /expected 11\.7\.0.*actual 11\.6\.0/i)
  assert.equal(existsSync(f.record), false)
})

test('D: selected Node and architecture execute both probe and install', (t) => {
  const f = fixture(t)
  const result = run(f, fakePnpm(f.root))
  assert.equal(result.status, 0, detail(result))
  const execution = JSON.parse(readFileSync(join(f.stageRoot, 'harness/.execution.json')))
  const frozen = recordOf(f.record)
  assert.equal(execution.execPath, realpathSync(process.execPath))
  assert.equal(execution.arch, process.arch)
  assert.equal(frozen.NODE_REALPATH, realpathSync(process.execPath))
  assert.equal(frozen.NODE_ARCH, process.arch)
})

test('E: Node architecture mismatch rejects before pnpm execution', (t) => {
  const f = fixture(t)
  const candidate = fakePnpm(f.root)
  const result = spawnSync(resolver, [
    '--harness', f.harness, '--node-bin', process.execPath,
    '--expected-node-version', process.version,
    '--expected-node-arch', process.arch === 'arm64' ? 'x64' : 'arm64',
    '--stage-root', f.stageRoot, '--record', f.record,
    '--configured-pnpm', candidate,
  ], { encoding: 'utf8' })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Node architecture mismatch/i)
  assert.equal(existsSync(f.record), false)
})

test('F: no local canonical candidate fails without PATH fallback', (t) => {
  const f = fixture(t)
  const result = run(f, join(f.root, 'missing-pnpm'))
  assert.equal(result.status, 2)
  assert.match(result.stderr, /configured pnpm candidate unavailable/i)
  assert.equal(existsSync(f.stageRoot), false)
})

test('G: candidate stderr and timeout failures remain visible', async (t) => {
  const stderrFixture = fixture(t)
  const stderrResult = run(stderrFixture, fakePnpm(stderrFixture.root, {
    versionExit: 9, stderr: 'exact probe diagnostic',
  }))
  assert.equal(stderrResult.status, 2)
  assert.match(stderrResult.stderr, /exact probe diagnostic/)

  const timeoutFixture = fixture(t)
  const started = Date.now()
  const timeoutResult = run(timeoutFixture, fakePnpm(timeoutFixture.root, { slow: true }), { timeoutSeconds: 1 })
  assert.equal(timeoutResult.status, 2)
  assert.match(timeoutResult.stderr, /timed out/i)
  assert.ok(Date.now() - started < 2800, 'bounded probe must stop before fake output')

  const malformedFixture = fixture(t)
  const malformed = run(malformedFixture, fakePnpm(malformedFixture.root, {
    rawVersion: '11.\n7.0\n',
  }))
  assert.equal(malformed.status, 2)
  assert.match(malformed.stderr, /malformed version/i)
})

test('H: source-owner clean environment performs offline frozen install outside production', (t) => {
  const f = fixture(t)
  const result = run(f, fakePnpm(f.root, { internalLink: true }))
  assert.equal(result.status, 0, detail(result))
  const execution = JSON.parse(readFileSync(join(f.stageRoot, 'harness/.execution.json')))
  assert.equal(execution.uid, statSync(f.harness).uid)
  assert.equal(execution.env.COREPACK_ENABLE_NETWORK, '0')
  assert.equal(execution.env.HTTP_PROXY, undefined)
  assert.equal(execution.env.HTTPS_PROXY, undefined)
  assert.equal(execution.env.ALL_PROXY, undefined)
  assert.equal(execution.argv.includes('--offline'), true)
  assert.equal(execution.argv.includes('--frozen-lockfile'), true)
  assert.equal(execution.argv.includes('--ignore-scripts'), true)
  assert.equal(execution.argv.includes('--config.package-import-method=copy'), true)
  assert.equal(f.stageRoot.startsWith('/usr/local/libexec/'), false)
  assert.equal(realpathSync(join(f.stageRoot, 'harness/node_modules/internal-link.js')),
    realpathSync(join(f.stageRoot, 'harness/node_modules/target.js')))
})

test('I: resolution is deterministic and duplicate realpaths execute once', (t) => {
  const f = fixture(t)
  const candidate = fakePnpm(f.root)
  const first = run(f, candidate)
  assert.equal(first.status, 0, detail(first))
  const frozen1 = readFileSync(f.record, 'utf8')
  rmSync(f.stageRoot, { recursive: true, force: true })
  rmSync(f.record, { force: true })
  const second = run(f, candidate)
  assert.equal(second.status, 0, detail(second))
  assert.equal(readFileSync(f.record, 'utf8'), frozen1)

  const duplicate = fixture(t)
  const counter = join(duplicate.root, 'version-probes')
  const rejected = fakePnpm(duplicate.root, { version: '11.6.0', versionCounter: counter })
  const alias = join(duplicate.root, 'pnpm-alias')
  symlinkSync(rejected, alias)
  const duplicateResult = runAutomatic(duplicate, rejected, alias)
  assert.equal(duplicateResult.status, 2)
  assert.equal(readFileSync(counter, 'utf8').trim().split('\n').length, 1)
})

test('J: every preflight failure leaves production sentinels and backup absent', (t) => {
  const redirected = fixture(t)
  const outside = join(redirected.root, 'outside-node-modules')
  mkdirSync(outside)
  const cases = [
    { packageManager: 'pnpm@latest', pnpm: {} },
    { pnpm: { version: '10.0.0' } },
    { pnpm: { installExit: 7, stderr: 'offline store missing' } },
    { pnpm: { mutateSelf: true } },
    { pnpm: { mutateDeclaration: true } },
    { fixture: redirected, pnpm: { redirectStage: outside } },
  ]
  for (const [index, item] of cases.entries()) {
    const f = item.fixture ?? fixture(t, item)
    const active = join(f.root, 'production-active')
    const backup = `${active}.bak`
    writeFileSync(active, 'unchanged')
    const result = run(f, fakePnpm(f.root, item.pnpm))
    assert.equal(result.status, 2, `case ${index}: ${result.stderr}`)
    assert.equal(readFileSync(active, 'utf8'), 'unchanged')
    assert.equal(existsSync(backup), false)
    assert.equal(existsSync(f.record), false)
    assert.match(result.stderr, /PRODUCTION_MUTATION_PERFORMED=NO/)
  }
})

test('K: installer consumes a completed stage without replacing backup and rollback semantics', () => {
  const source = readFileSync(installer, 'utf8')
  assert.match(source, /trusted-pnpm-resolver\.sh/)
  assert.doesNotMatch(source, /\/usr\/local\/bin\/pnpm install/)
  assert.match(source, /trap cleanup_ephemeral_preflight EXIT/)
  assert.match(source, /\/tmp\/agent-core-pnpm-preflight\.\*/)
  assert.match(source, /trusted-pnpm-resolver\.sh$/m)
  assert.match(source, /agent-core-backup-ops\.sh/)
  assert.match(source, /--write-predecessor/)
})

test('L: resolver completes before backup and the trusted Git stamp contract is unchanged', () => {
  const source = readFileSync(installer, 'utf8')
  const gitProbe = source.indexOf('HARNESS_STAMP="$($SOURCE_GIT_STAMP "$HARNESS_SRC")"')
  const pnpmPreflight = source.indexOf('"$PNPM_RESOLVER"')
  const backup = source.indexOf('if [ -e "$TRUSTED_ROOT" ]; then')
  assert.ok(gitProbe > 0 && pnpmPreflight > gitProbe && pnpmPreflight < backup)
  assert.match(source, /printf '%s' "\$HARNESS_STAMP" > harness\/\.source-stamp/)
  assert.doesNotMatch(source, /safe\.directory/)
})
