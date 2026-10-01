// CLOSURE_RESOLUTION_GATE_V1 — hermetic unit + fixture-integration tests.
//
// RED/GREEN contract (2026-10-02 availability rollback, Product #414):
//  - GREEN: a closure whose native binding serves the runtime arch and whose
//    @deepseek-ai surfaces are fully linked passes all checks.
//  - RED:   the exact production failure — binding reports a foreign-arch
//    suffix (darwin-x64 binding, arm64-style mismatch) or is unacquirable —
//    fails NATIVE_BINDING with the rollback-class diagnosis; dead/missing/
//    mismatched links fail the census so one repair cannot mask the next.
//
// Live-closure integration (the REAL addon + REAL plugin tree, x64 runtime):
// set DSH_B7_GATE_CLOSURE_UNDER_TEST to a candidate TRUSTED_ROOT and
// DSH_B7_GATE_EXPECT={pass|fail}; the test then runs the real gate binary
// under that closure's own node-runtime and asserts the verdict. Skipped
// when unset (CI/hermetic default). The 2026-10-02 lane used this seam with
// the /tmp RED clone (arm64-only closure) and the rebuilt GREEN candidate.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, realpathSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platformPackageSuffix, suffixServesRuntime, resolvePackageFromDir, censusSurface, runGate } from './trusted-cp-closure-resolution-gate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = join(HERE, 'trusted-cp-closure-resolution-gate.mjs')

function scratch() {
  return mkdtempSync(join(tmpdir(), 'dsh-closure-gate-test-'))
}

/** Write a minimal stub package (real dir, no symlink) at dir with `name`. */
function stubPackage(dir, name, extra = {}) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '0.0.0', ...extra }))
}

/** Stub the loader's optional peer with a configurable getBindingInfo(). */
function stubAddon(root, bindingInfo) {
  const pkgDir = join(root, 'harness/vendor/loader/node_modules/node-addon-require-builtin')
  stubPackage(pkgDir, 'node-addon-require-builtin')
  writeFileSync(
    join(pkgDir, 'index.js'),
    `export function getBindingInfo() { return ${JSON.stringify(bindingInfo)} }\n` +
    `export function requireBuiltin() { throw new Error('stub') }\n`,
  )
  // loader lib consumes it via createRequire (CJS): provide a CJS entry too.
  writeFileSync(
    join(pkgDir, 'index.cjs'),
    `module.exports = { getBindingInfo: () => (${JSON.stringify(bindingInfo)}), requireBuiltin: () => { throw new Error('stub') } }\n`,
  )
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  pkg.main = 'index.cjs'
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkg))
}

function makeClosureSkeleton(root) {
  mkdirSync(join(root, 'harness/vendor/loader/lib'), { recursive: true })
  writeFileSync(join(root, 'harness/vendor/loader/lib/index.js'), 'export {}\n')
}

describe('platformPackageSuffix / suffixServesRuntime', () => {
  test('darwin and win32 suffixes follow the addon convention', () => {
    assert.equal(platformPackageSuffix('darwin', 'x64'), 'darwin-x64')
    assert.equal(platformPackageSuffix('darwin', 'arm64'), 'darwin-arm64')
    assert.equal(platformPackageSuffix('win32', 'arm64'), 'win32-arm64-msvc')
  })

  test('darwin exact match only; linux accepts libc variants of the same arch', () => {
    assert.equal(suffixServesRuntime('darwin-x64', 'darwin', 'x64'), true)
    assert.equal(suffixServesRuntime('darwin-arm64', 'darwin', 'x64'), false)
    assert.equal(suffixServesRuntime('linux-x64-gnu', 'linux', 'x64'), true)
    assert.equal(suffixServesRuntime('linux-x64-musl', 'linux', 'x64'), true)
    assert.equal(suffixServesRuntime('linux-arm64-gnu', 'linux', 'x64'), false)
    assert.equal(suffixServesRuntime(undefined, 'darwin', 'x64'), false)
  })
})

describe('resolvePackageFromDir', () => {
  test('walks node_modules upward and realpaths symlinks', () => {
    const root = scratch()
    try {
      const target = join(root, 'vendor/timer')
      stubPackage(target, '@deepseek-ai/cordis-plugin-timer')
      mkdirSync(join(root, 'harness/apps/cli/node_modules/@deepseek-ai'), { recursive: true })
      symlinkSync(target, join(root, 'harness/apps/cli/node_modules/@deepseek-ai/cordis-plugin-timer'))
      const found = resolvePackageFromDir(join(root, 'harness/apps/cli'), '@deepseek-ai/cordis-plugin-timer')
      assert.ok(found)
      assert.equal(found.realpath, realpathSync(target))
      assert.equal(resolvePackageFromDir(join(root, 'harness/apps/cli'), '@deepseek-ai/absent'), null)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})

describe('censusSurface', () => {
  test('alive name-consistent entries pass; dead link and name mismatch fail', () => {
    const root = scratch()
    try {
      const surface = join(root, 'harness/apps/cli')
      const good = join(root, 'vendor/timer')
      stubPackage(good, '@deepseek-ai/cordis-plugin-timer')
      const wrong = join(root, 'vendor/other')
      stubPackage(wrong, '@deepseek-ai/some-other-name')
      mkdirSync(join(surface, 'node_modules/@deepseek-ai'), { recursive: true })
      symlinkSync(good, join(surface, 'node_modules/@deepseek-ai/cordis-plugin-timer'))
      symlinkSync(wrong, join(surface, 'node_modules/@deepseek-ai/mismatched'))
      symlinkSync(join(root, 'vendor/vanished'), join(surface, 'node_modules/@deepseek-ai/dead'))
      const result = censusSurface(root, 'harness/apps/cli')
      assert.equal(result.ok, false)
      const byName = Object.fromEntries(result.entries.map((e) => [e.name, e]))
      assert.equal(byName['@deepseek-ai/cordis-plugin-timer'].ok, true)
      assert.match(byName['@deepseek-ai/mismatched'].detail, /name mismatch/)
      assert.match(byName['@deepseek-ai/dead'].detail, /not resolvable/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})

describe('runGate fixtures', () => {
  test('GREEN: matching-arch stub binding + fully linked surfaces pass', () => {
    const root = scratch()
    try {
      makeClosureSkeleton(root)
      const arch = process.arch
      stubAddon(root, {
        platformPackageSuffix: `darwin-${arch}`,
        bindingSource: 'optional-package',
        optionalPackageName: `node-addon-require-builtin-darwin-${arch}`,
        backend: 'napi',
        abi: 'napi-v9',
      })
      const vendor = join(root, 'vendor')
      stubPackage(join(vendor, 'cordis'), '@deepseek-ai/cordis')
      stubPackage(join(vendor, 'cosmokit'), '@deepseek-ai/cosmokit')
      stubPackage(join(vendor, 'timer'), '@deepseek-ai/cordis-plugin-timer')
      const loaderNm = join(root, 'harness/vendor/loader/node_modules/@deepseek-ai')
      mkdirSync(loaderNm, { recursive: true })
      symlinkSync(join(vendor, 'cordis'), join(loaderNm, 'cordis'))
      symlinkSync(join(vendor, 'cosmokit'), join(loaderNm, 'cosmokit'))
      const cliNm = join(root, 'harness/apps/cli/node_modules/@deepseek-ai')
      mkdirSync(cliNm, { recursive: true })
      symlinkSync(join(vendor, 'cordis'), join(cliNm, 'cordis'))
      symlinkSync(join(vendor, 'timer'), join(cliNm, 'cordis-plugin-timer'))
      const result = runGate({ trustedRoot: root, platform: 'darwin', arch })
      assert.equal(result.ok, true, JSON.stringify(result.checks, null, 2))
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED (2026-10-02 class): foreign-arch binding fails NATIVE_BINDING with rollback diagnosis', () => {
    const root = scratch()
    try {
      makeClosureSkeleton(root)
      const arch = process.arch
      const foreign = arch === 'arm64' ? 'x64' : 'arm64'
      stubAddon(root, {
        platformPackageSuffix: `darwin-${foreign}`,
        bindingSource: 'optional-package',
        optionalPackageName: `node-addon-require-builtin-darwin-${foreign}`,
        backend: 'napi',
        abi: 'napi-v9',
      })
      const result = runGate({ trustedRoot: root, platform: 'darwin', arch })
      assert.equal(result.ok, false)
      const binding = result.checks.find((c) => c.check === 'NATIVE_BINDING')
      assert.equal(binding.ok, false)
      assert.match(binding.detail, /does not serve runtime/)
      assert.match(binding.detail, /2026-10-02 rollback class/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: unacquirable binding (missing optional package) fails with raw-import diagnosis', () => {
    const root = scratch()
    try {
      makeClosureSkeleton(root)
      const result = runGate({ trustedRoot: root, platform: 'darwin', arch: process.arch })
      assert.equal(result.ok, false)
      const binding = result.checks.find((c) => c.check === 'NATIVE_BINDING')
      assert.equal(binding.ok, false)
      assert.match(binding.detail, /cannot acquire node-addon-require-builtin/)
      assert.match(binding.detail, /ERR_MODULE_NOT_FOUND/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: missing closure shape fails fast', () => {
    const root = scratch()
    try {
      const result = runGate({ trustedRoot: root })
      assert.equal(result.ok, false)
      assert.equal(result.checks[0].check, 'CLOSURE_SHAPE')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})

describe('live-closure integration (DSH_B7_GATE_CLOSURE_UNDER_TEST)', () => {
  const closure = process.env.DSH_B7_GATE_CLOSURE_UNDER_TEST
  const expect = process.env.DSH_B7_GATE_EXPECT
  test('real gate binary under the closure node-runtime asserts the expected verdict', { skip: !closure || !expect }, () => {
    const nodeBin = join(closure, 'node-runtime/bin/node')
    assert.ok(existsSync(nodeBin), `node-runtime missing under ${closure}`)
    const proc = spawnSync(nodeBin, [GATE, '--trusted-root', closure, '--json'], { encoding: 'utf8', timeout: 120000 })
    let receipt
    try { receipt = JSON.parse(proc.stdout) } catch { assert.fail(`gate produced no JSON receipt: ${proc.stderr}`) }
    if (expect === 'pass') {
      assert.equal(receipt.ok, true, JSON.stringify(receipt.checks, null, 2))
    } else if (expect === 'fail') {
      assert.equal(receipt.ok, false)
      assert.ok(receipt.checks.some((c) => c.check === 'NATIVE_BINDING' && !c.ok),
        'expected NATIVE_BINDING failure for the RED fixture')
    } else {
      assert.fail(`DSH_B7_GATE_EXPECT must be pass|fail, got ${expect}`)
    }
  })
})
