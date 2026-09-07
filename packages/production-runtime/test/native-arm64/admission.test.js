import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertProductionArchitecture } from '../../src/native-arm64/admission.js'
import { childSpawnConfig, agentEnv } from '../../../agent-router/src/process/env.js'

const native = { platform: 'darwin', arch: 'arm64', version: 'v25.6.1', execPath: '/stage/node', pid: 7 }
const env = { DSH_RUNTIME_ARCH: 'arm64' }

test('normal native generation requires exact Node, architecture and explicit expectation', () => {
  assert.deepEqual(assertProductionArchitecture({ required: true, env, runtime: native }), {
    platform: 'darwin', arch: 'arm64', nodeVersion: 'v25.6.1', execPath: '/stage/node', pid: 7, rosettaTranslated: false,
  })
  assert.equal(env.NARB_DISABLE_NATIVE_CACHE, '1')
  for (const value of [undefined, '', 'x64', 'ARM64', 'arm64 ']) {
    assert.throws(() => assertProductionArchitecture({ required: true, env: { DSH_RUNTIME_ARCH: value }, runtime: native }), /expected_arch_missing_or_invalid/)
  }
  for (const [change, reason] of [
    [{ arch: 'x64' }, 'process_not_native_arm64'],
    [{ arch: undefined }, 'process_not_native_arm64'],
    [{ platform: 'linux' }, 'platform_not_darwin'],
    [{ version: 'v26.7.0' }, 'node_version_not_v25.6.1'],
    [{ version: 'v25.6.2' }, 'node_version_not_v25.6.1'],
  ]) assert.throws(() => assertProductionArchitecture({ env, runtime: { ...native, ...change } }), new RegExp(reason))
})

test('unscoped development retains prior platform support; an explicit expectation cannot be ignored', () => {
  assert.equal(assertProductionArchitecture({ required: false, env: {}, runtime: { platform: 'linux' } }), null)
  assert.throws(() => assertProductionArchitecture({ required: false, env: { DSH_RUNTIME_ARCH: '' }, runtime: native }), /expected_arch/)
})

test('real production launcher rejects missing expectation before imports or persistent state', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arm-admission-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const state = join(root, 'state')
  const script = fileURLToPath(new URL('../../../../scripts/production-runtime.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [script, '--native-arm64', '--root', state], {
    env: { PATH: '/usr/bin:/bin', HOME: root, TMPDIR: tmpdir() }, encoding: 'utf8', timeout: 5000,
  })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /NATIVE_RUNTIME_REJECTED: expected_arch_missing_or_invalid/)
  assert.equal(existsSync(state), false)
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/)
})

test('real x64 Node cannot start the ARM generation', { skip: !process.env.ARM_TEST_X64_NODE }, (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arm-x64-negative-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const script = fileURLToPath(new URL('../../../../scripts/production-runtime.mjs', import.meta.url))
  const result = spawnSync(process.env.ARM_TEST_X64_NODE, [script, '--native-arm64', '--root', join(root, 'state')], {
    env: { ...env, PATH: '/usr/bin:/bin', HOME: root }, encoding: 'utf8', timeout: 5000,
  })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /process_not_native_arm64/)
  assert.equal(existsSync(join(root, 'state')), false)
})

test('existing child spawn selects exact parent Node and per-agent overrides cannot drop architecture', (t) => {
  const saved = { ...process.env }
  t.after(() => { process.env = saved })
  delete process.env.DSH_AGENT_CHILD_UID
  delete process.env.DSH_AGENT_SPAWN_HELPER
  process.env.DSH_RUNTIME_ARCH = 'arm64'
  process.env.OPENCODE_GO_API_KEY = 'synthetic-test-key'
  const childEnv = agentEnv('/nonexistent-arm-test-home', { DSH_RUNTIME_ARCH: 'x64' }, ['DSH_RUNTIME_ARCH'])
  assert.equal(childEnv.DSH_RUNTIME_ARCH, 'arm64')
  const config = childSpawnConfig()
  assert.deepEqual(config.argv, [process.execPath])
  const child = spawnSync(config.argv[0], ['-p', 'JSON.stringify({arch:process.arch,node:process.execPath,version:process.version})'], { env: childEnv, encoding: 'utf8' })
  assert.equal(child.status, 0)
  assert.deepEqual(JSON.parse(child.stdout), { arch: process.arch, node: process.execPath, version: process.version })
})
