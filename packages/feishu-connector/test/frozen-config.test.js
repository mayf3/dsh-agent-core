/**
 * AC12/AC14 evidence — frozen SDK semantics enforced + exact package pin.
 *
 * 1. The installed package resolves to the reviewed immutable runtime SHA.
 * 2. feishu-connector/package.json declares the exact Git coordinate.
 * 3. A REAL (unconnected) LarkChannel constructed with the frozen
 *    Foundation options enforces requireMention=false (+ the @all parity
 *    pin) on its PolicyGate — the constructor builds the gate immediately,
 *    so this is the genuine SDK surface, not a re-implementation.
 * 4. The connector's production admission path carries NO second
 *    dedup/queue/classify implementation (structural: the V0 symbols are
 *    gone from the production modules; only the test-only oracle keeps
 *    them).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createLarkChannel } from '@larksuite/channel'
import { FOUNDATION_LARK_CHANNEL_OPTIONS } from '../src/core.js'

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeCoordinate = 'https://github.com/mayf3/channel-sdk-node.git#ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f'
const runtimeSha = 'ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f'

test('AC14: the installed @larksuite/channel is EXACTLY 0.5.0', () => {
  const installed = JSON.parse(readFileSync(join(pkgRoot, 'node_modules', '@larksuite', 'channel', 'package.json'), 'utf8'))
  assert.equal(installed.version, '0.5.0')
})

test('AC-SDK-RUNTIME-REVISION-PIN: package.json declares the exact immutable Git coordinate', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies['@larksuite/channel'], runtimeCoordinate)
  assert.equal(pkg.dependencies['@larksuiteoapi/node-sdk'], undefined, 'node-sdk is transitive-only in the connector')
})

test('AC-SDK-RUNTIME-REVISION-PIN: lockfile traces the installed package to the full runtime SHA with integrity', () => {
  const lock = JSON.parse(readFileSync(join(pkgRoot, 'package-lock.json'), 'utf8'))
  assert.equal(lock.packages[''].dependencies['@larksuite/channel'], runtimeCoordinate)
  const installed = lock.packages['node_modules/@larksuite/channel']
  assert.ok(installed.resolved.endsWith(`#${runtimeSha}`), 'resolved carries the complete 40-character runtime SHA')
  assert.match(installed.integrity, /^sha512-/)
})

test('AC-SCRIPT-DISABLED-INSTALL: reviewed committed dist supports both import and require', async () => {
  const imported = await import('@larksuite/channel')
  const required = createRequire(import.meta.url)('@larksuite/channel')
  assert.equal(typeof imported.createLarkChannel, 'function')
  assert.equal(typeof required.createLarkChannel, 'function')
})

test('AC12: a real LarkChannel uses V2 mention and renewable-lock options', () => {
  const channel = createLarkChannel({
    appId: 'cli_test_frozen',
    appSecret: 'test',
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
  })
  const policy = channel.getPolicy()
  assert.equal(policy.requireMention, false, 'SDK_REQUIRE_MENTION=false lives on the real PolicyGate')
  assert.equal(policy.respondToMentionAll, true, 'V0 @all parity pin lives on the real PolicyGate')
  assert.deepEqual(policy.groupAllowlist ?? [], [], 'groupAllowlist stays at default posture')
  assert.equal(policy.dmMode ?? 'open', 'open', 'dmMode stays at default posture')
  assert.deepEqual(FOUNDATION_LARK_CHANNEL_OPTIONS.safety.processingLock, { ttlMs: 300000, renewIntervalMs: 60000 })
})

test('AC12: no second dedup/queue/classify on the production admission path', async () => {
  const core = await import('../src/core.js')
  const bridge = await import('../src/bridge.js')
  const index = await import('../src/index.js')
  for (const mod of [core, bridge, index]) {
    assert.equal(mod.LruDedup, undefined, 'V0 LruDedup removed from production')
    assert.equal(mod.dedupEvent, undefined, 'V0 dedupEvent removed from production')
    assert.equal(mod.classifyIngress, undefined, 'V0 classifyIngress removed from production')
    assert.equal(mod.createIngressPipeline, undefined, 'V0 pipeline removed from production')
  }
})

test('AC12: no direct @larksuiteoapi/node-sdk import remains in production code', () => {
  for (const file of ['src/core.js', 'src/bridge.js', 'src/index.js', 'standalone.mjs']) {
    const source = readFileSync(join(pkgRoot, file), 'utf8')
    assert.ok(!source.includes('@larksuiteoapi/node-sdk'), `${file} must not import node-sdk directly`)
  }
})

test('AC9: no legacy transport module remains on the production path', () => {
  const exportsMap = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).exports
  assert.equal(exportsMap['./transport'], undefined)
  assert.equal(exportsMap['./api'], undefined)
  assert.equal(exportsMap['./bridge'], './src/bridge.js')
})
