import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import * as staging from '../../src/native-arm64/stage.js'

const gated = 'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs'
const helper = 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'
const context = 'packages/production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs'
const fixedApp = '/usr/local/libexec/agent-core/app/'
const oldTarget = fixedApp + 'scripts/production-runtime.mjs'
const newTarget = fixedApp + gated
const xml = extra => `<plist><dict><key>Label</key><string>ai.agent-core.runtime</string><key>ProgramArguments</key><array><string>/fixed/node</string><string>${oldTarget}</string><string>--root</string><string>/fixed/root</string></array>${extra}</dict></plist>`
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hr-stage-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const run = (dir, ...args) => execFileSync('/usr/bin/git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()
  const put = (dir, path, bytes) => { mkdirSync(dirname(join(dir, path)), { recursive: true });writeFileSync(join(dir, path), bytes) }
  const live = join(root, 'live'), candidate = join(root, 'candidate')
  for (const dir of [live, candidate]) {
    mkdirSync(dir);run(dir, 'init', '-q');run(dir, 'config', 'user.email', 'fixture@example.invalid');run(dir, 'config', 'user.name', 'Fixture')
    put(dir, 'package.json', '{"type":"module"}')
    put(dir, 'packages/production-runtime/src/entry.js', 'throw new Error("ROUTER_IMPORTED");')
    for (const path of staging.ARM_SOURCE_DELTA) put(dir, path, path.endsWith('admission.js') ? 'export function assertProductionArchitecture() {}' : 'import "../packages/production-runtime/src/entry.js";')
    put(dir, gated, readFileSync(new URL('../../src/native-arm64/hr-s256-r2-gated-runtime.mjs', import.meta.url)))
    put(dir, helper, readFileSync(new URL('../../src/native-arm64/hr-s256-r2-child-proof.py', import.meta.url)))
    put(dir, context, readFileSync(new URL('../../src/native-arm64/hr-s256-r2-startup-context.mjs', import.meta.url)))
    put(dir, 'packages/agent-router/src/index.js', "import { provisionAgentHome } from '../../agent-provisioning/src/index.js'\nif (typeof cfg.restartQuiescenceEvidenceDir === 'string' && cfg.restartQuiescenceEvidenceDir !== '') {\n}")
    put(dir, 'packages/agent-router/src/reconciliation/startup-recovery.js', 'files = readdirSync(evidenceDir).filter\n')
    run(dir, 'add', '.');run(dir, 'commit', '-qm', 'base')
  }
  return { options: { liveRoot: live, candidateRoot: candidate, candidateSHA: run(candidate, 'rev-parse', 'HEAD'), stageRoot: join(root, 'stage'), guiPlist: xml('<key>KeepAlive</key><true/>'), systemPlist: xml('<key>UserName</key><string>authsvc</string>') } }
}
test('fixed HR stage preserves both route topology, retires ordinary entry and rejects manual entry before Router', t => {
  const f = fixture(t)
  assert.equal(typeof staging.stageHrOneShotApplication, 'function', 'fixed HR overlay missing')
  const result = staging.stageHrOneShotApplication(f.options)
  for (const route of ['gui', 'system']) {
    assert.equal(result.routes[route], f.options[route + 'Plist'].replace(oldTarget, newTarget))
  }
  assert.equal(result.entryManifest.entries.length, 1)
  for (const path of [gated, 'scripts/production-runtime.mjs']) {
    const child = spawnSync(process.execPath, [join(result.stageRoot, path)], { encoding: 'utf8', timeout: 2000 })
    assert.notEqual(child.status, 0)
    assert.doesNotMatch(child.stderr, /ROUTER_IMPORTED/)
    assert.match(child.stderr, /R2_INVOCATION_INVALID|HR_UNGATED_ENTRY_RETIRED/)
  }
})
test('unsupported or duplicate route target rejects before any stage write', t => {
  const f = fixture(t)
  assert.equal(typeof staging.stageHrOneShotApplication, 'function')
  assert.throws(() => staging.stageHrOneShotApplication({ ...f.options, systemPlist: xml('').replace(oldTarget, '/unknown/entry') }), /HR_ROUTE_TARGET_UNKNOWN/)
  assert.throws(() => staging.stageHrOneShotApplication({ ...f.options, systemPlist: xml('').replace('</array>', `<string>${oldTarget}</string></array>`) }), /HR_ROUTE_TARGET_UNKNOWN/)
  assert.equal(existsSync(f.options.stageRoot), false)
})
