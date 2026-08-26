/**
 * Reply render-mode config tests (OWNER_RULING =
 * ENABLE_STATIC_FEISHU_REPLY_CARD, STATIC_FINAL_CARD_V1): production-runtime
 * owns STRICT env parsing for FEISHU_REPLY_RENDER_MODE — unset/empty =>
 * 'markdown' (the connector default, byte-identical current production
 * rendering); EXACTLY 'markdown'/'card' => that mode; every other value
 * fails composition LOUD with FEISHU_REPLY_RENDER_MODE_INVALID. The parsed
 * value is forwarded into the feishu mount config, and the launchd plist
 * generator passes the variable through when the installing shell carries
 * it (pass-through only — the production target value 'card' is NOT applied
 * this round).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveReplyRenderMode } from '../src/compose.js'
import { renderPlist } from '../../../scripts/production-runtime-launchd.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// strict parsing matrix
// ---------------------------------------------------------------------------

test('ENV: unset and empty mean MARKDOWN (byte-identical default)', () => {
  assert.equal(resolveReplyRenderMode({}), 'markdown')
  assert.equal(resolveReplyRenderMode({ FEISHU_REPLY_RENDER_MODE: '' }), 'markdown')
})

test('ENV: exact markdown/card parse to the real modes (production target = card, NOT applied this round)', () => {
  assert.equal(resolveReplyRenderMode({ FEISHU_REPLY_RENDER_MODE: 'markdown' }), 'markdown')
  assert.equal(resolveReplyRenderMode({ FEISHU_REPLY_RENDER_MODE: 'card' }), 'card')
})

test('ENV: every other value fails LOUD with FEISHU_REPLY_RENDER_MODE_INVALID', () => {
  for (const bad of ['Markdown', 'CARD', 'interactive', 'static', '1', 'yes', ' card', 'card ', 'null', 'undefined', '卡片']) {
    assert.throws(
      () => resolveReplyRenderMode({ FEISHU_REPLY_RENDER_MODE: bad }),
      (error) => error.code === 'FEISHU_REPLY_RENDER_MODE_INVALID'
        && error.message.includes("'markdown' or 'card'")
        && error.message.includes(JSON.stringify(bad)),
      `must reject ${JSON.stringify(bad)}`,
    )
  }
})

test('ENV: the render mode is independent of the UX mention switches', () => {
  const env = {
    FEISHU_REQUIRE_MENTION_IN_GROUP: 'false',
    FEISHU_AUTO_MENTION_TRIGGER_SENDER: 'false',
  }
  assert.equal(resolveReplyRenderMode(env), 'markdown', 'unset stays markdown even with UX switches set')
  assert.equal(resolveReplyRenderMode({ ...env, FEISHU_REPLY_RENDER_MODE: 'card' }), 'card')
})

// ---------------------------------------------------------------------------
// compose wiring — parsed BEFORE any mount, forwarded into the feishu mount
// ---------------------------------------------------------------------------

test('COMPOSE: the render mode is parsed before any component mounts and forwarded into the feishu mount', () => {
  const source = readFileSync(join(HERE, '..', 'src', 'compose.js'), 'utf8')
  const parse = source.indexOf('resolveReplyRenderMode()')
  const firstMount = source.indexOf('applyBootstrap(')
  assert.ok(parse >= 0, 'resolveReplyRenderMode() is called')
  assert.ok(firstMount > parse, 'strict parse runs BEFORE the first component mount (invalid env fails composition regardless of channel)')
  assert.ok(source.indexOf('replyRenderMode,') > source.indexOf('applyFeishu(ctx,'), 'parsed value is spread into the applyFeishu config')
  assert.ok(source.includes('replyRenderMode=${replyRenderMode}'), 'effective value logged at mount')
})

// ---------------------------------------------------------------------------
// launchd pass-through — forwarded when present at install time only
// ---------------------------------------------------------------------------

test('LAUNCHD: FEISHU_REPLY_RENDER_MODE passes through into the rendered plist when set', () => {
  const saved = process.env.FEISHU_REPLY_RENDER_MODE
  try {
    process.env.FEISHU_REPLY_RENDER_MODE = 'card'
    const plist = renderPlist({ root: '/tmp/agent-core-test', label: 'ai.test', nodeBin: '/usr/bin/node', harness: '/tmp/harness' })
    assert.ok(plist.includes('<key>FEISHU_REPLY_RENDER_MODE</key><string>card</string>'))
  } finally {
    if (saved === undefined) delete process.env.FEISHU_REPLY_RENDER_MODE
    else process.env.FEISHU_REPLY_RENDER_MODE = saved
  }
})

test('LAUNCHD: unset var emits NO plist key (connector default markdown applies)', () => {
  const saved = process.env.FEISHU_REPLY_RENDER_MODE
  try {
    delete process.env.FEISHU_REPLY_RENDER_MODE
    const plist = renderPlist({ root: '/tmp/agent-core-test', label: 'ai.test', nodeBin: '/usr/bin/node', harness: '/tmp/harness' })
    assert.equal(plist.includes('FEISHU_REPLY_RENDER_MODE'), false)
  } finally {
    if (saved === undefined) delete process.env.FEISHU_REPLY_RENDER_MODE
    else process.env.FEISHU_REPLY_RENDER_MODE = saved
  }
})
