/**
 * AC12/AC14 evidence — frozen SDK semantics enforced + exact package pin.
 *
 * 1. The pinned @larksuite/channel package itself is EXACTLY 0.5.0 (runtime
 *    assertion against the installed package.json — the spec's
 *    REVIEWED_SDK_BASELINE).
 * 2. feishu-connector/package.json declares an EXACT pin (no ^/~).
 * 3. A REAL (unconnected) LarkChannel constructed with the frozen
 *    Foundation options enforces requireMention=true (+ the @all parity
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
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createLarkChannel } from '@larksuite/channel'
import { FOUNDATION_LARK_CHANNEL_OPTIONS } from '../src/core.js'

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

test('AC14: the installed @larksuite/channel is EXACTLY 0.5.0', () => {
  const installed = JSON.parse(readFileSync(join(pkgRoot, 'node_modules', '@larksuite', 'channel', 'package.json'), 'utf8'))
  assert.equal(installed.version, '0.5.0')
})

test('AC14: package.json declares an exact pin (no ^/~ range)', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies['@larksuite/channel'], '0.5.0')
  assert.equal(pkg.dependencies['@larksuiteoapi/node-sdk'], undefined, 'node-sdk is transitive-only in the connector')
})

test('AC12: a real LarkChannel under the frozen options enforces requireMention=true', () => {
  const channel = createLarkChannel({
    appId: 'cli_test_frozen',
    appSecret: 'test',
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
  })
  const policy = channel.getPolicy()
  assert.equal(policy.requireMention, true, 'SDK_REQUIRE_MENTION=true lives on the real PolicyGate')
  assert.equal(policy.respondToMentionAll, true, 'V0 @all parity pin lives on the real PolicyGate')
  assert.deepEqual(policy.groupAllowlist ?? [], [], 'groupAllowlist stays at default posture')
  assert.equal(policy.dmMode ?? 'open', 'open', 'dmMode stays at default posture')
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
