/**
 * Processing-reaction config tests (OWNER_RULING =
 * ENABLE_FEISHU_PROCESSING_REACTION): production-runtime owns STRICT env
 * parsing for FEISHU_PROCESSING_REACTION_ENABLED — unset/empty => false (the
 * connector default is OFF); EXACTLY 'true'/'false' => that boolean; every
 * other value fails composition LOUD with
 * FEISHU_PROCESSING_REACTION_INVALID. The parsed value is forwarded into the
 * feishu mount config, and the launchd plist generator passes the variable
 * through when the installing shell carries it (pass-through only — NOT
 * deployed this round).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveProcessingReactionConfig } from '../src/compose.js'
import { renderPlist } from '../../../scripts/production-runtime-launchd.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// strict parsing matrix
// ---------------------------------------------------------------------------

test('ENV: unset and empty mean FALSE (connector default OFF)', () => {
  assert.equal(resolveProcessingReactionConfig({}), false)
  assert.equal(resolveProcessingReactionConfig({ FEISHU_PROCESSING_REACTION_ENABLED: '' }), false)
})

test('ENV: exact true/false parse to real booleans (production target = true)', () => {
  assert.equal(resolveProcessingReactionConfig({ FEISHU_PROCESSING_REACTION_ENABLED: 'true' }), true)
  assert.equal(resolveProcessingReactionConfig({ FEISHU_PROCESSING_REACTION_ENABLED: 'false' }), false)
})

test('ENV: every other value fails LOUD with FEISHU_PROCESSING_REACTION_INVALID', () => {
  for (const bad of ['True', 'FALSE', '1', '0', 'yes', 'no', 'off', 'on', ' true', 'true ', 't', 'f', 'null', 'undefined', '是的']) {
    assert.throws(
      () => resolveProcessingReactionConfig({ FEISHU_PROCESSING_REACTION_ENABLED: bad }),
      (error) => error.code === 'FEISHU_PROCESSING_REACTION_INVALID'
        && error.message.includes("'true' or 'false'")
        && error.message.includes(JSON.stringify(bad)),
      `must reject ${JSON.stringify(bad)}`,
    )
  }
})

test('ENV: the reaction switch is independent of the UX mention switches', () => {
  const env = {
    FEISHU_REQUIRE_MENTION_IN_GROUP: 'false',
    FEISHU_AUTO_MENTION_TRIGGER_SENDER: 'false',
  }
  assert.equal(resolveProcessingReactionConfig(env), false, 'unset stays false even with UX switches set')
  assert.equal(resolveProcessingReactionConfig({ ...env, FEISHU_PROCESSING_REACTION_ENABLED: 'true' }), true)
})

// ---------------------------------------------------------------------------
// compose wiring — parsed BEFORE any mount, forwarded into the feishu mount
// ---------------------------------------------------------------------------

test('COMPOSE: the reaction switch is parsed before any component mounts and forwarded into the feishu mount', () => {
  const source = readFileSync(join(HERE, '..', 'src', 'compose.js'), 'utf8')
  const parse = source.indexOf('resolveProcessingReactionConfig()')
  const firstMount = source.indexOf('applyBootstrap(')
  assert.ok(parse >= 0, 'resolveProcessingReactionConfig() is called')
  assert.ok(firstMount > parse, 'strict parse runs BEFORE the first component mount (invalid env fails composition regardless of channel)')
  assert.ok(source.indexOf('processingReactionEnabled,') > source.indexOf('applyFeishu(ctx,'), 'parsed value is spread into the applyFeishu config')
  assert.ok(source.includes('processingReactionEnabled=${processingReactionEnabled}'), 'effective value logged at mount')
})

// ---------------------------------------------------------------------------
// launchd pass-through — forwarded when present at install time only
// ---------------------------------------------------------------------------

test('LAUNCHD: FEISHU_PROCESSING_REACTION_ENABLED passes through into the rendered plist when set', () => {
  const saved = process.env.FEISHU_PROCESSING_REACTION_ENABLED
  try {
    process.env.FEISHU_PROCESSING_REACTION_ENABLED = 'true'
    const plist = renderPlist({ root: '/tmp/agent-core-test', label: 'ai.test', nodeBin: '/usr/bin/node', harness: '/tmp/harness' })
    assert.ok(plist.includes('<key>FEISHU_PROCESSING_REACTION_ENABLED</key><string>true</string>'))
  } finally {
    if (saved === undefined) delete process.env.FEISHU_PROCESSING_REACTION_ENABLED
    else process.env.FEISHU_PROCESSING_REACTION_ENABLED = saved
  }
})

test('LAUNCHD: unset var emits NO plist key (connector default OFF applies)', () => {
  const saved = process.env.FEISHU_PROCESSING_REACTION_ENABLED
  try {
    delete process.env.FEISHU_PROCESSING_REACTION_ENABLED
    const plist = renderPlist({ root: '/tmp/agent-core-test', label: 'ai.test', nodeBin: '/usr/bin/node', harness: '/tmp/harness' })
    assert.equal(plist.includes('FEISHU_PROCESSING_REACTION_ENABLED'), false)
  } finally {
    if (saved === undefined) delete process.env.FEISHU_PROCESSING_REACTION_ENABLED
    else process.env.FEISHU_PROCESSING_REACTION_ENABLED = saved
  }
})
