/**
 * Feishu UX switch env parsing tests (REQUIRE_MENTION_IN_GROUP /
 * AUTO_MENTION_TRIGGER_SENDER config split).
 *
 * production-runtime owns STRICT env parsing for the two deployment switches:
 * FEISHU_REQUIRE_MENTION_IN_GROUP / FEISHU_AUTO_MENTION_TRIGGER_SENDER accept
 * ONLY the exact strings 'true' / 'false'; every other value fails
 * composition LOUD on an ENABLED channel (a typo'd supervision-unit env must
 * never silently revert admission/mention policy). Unset/empty means "not
 * configured" — the connector defaults (true/true) apply. The parsed switches
 * are forwarded into the feishu mount config, and the launchd plist generator
 * passes both variables through when the installing shell carries them.
 *
 * Audit Product #442: the strict parse runs in the ENABLED branch of the
 * composition — a disabled channel's invalid switch value is reported as a
 * warning and must not block the unrelated base startup path.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseStrictBooleanEnv, resolveFeishuUxSwitches } from '../src/compose.js'
import { renderPlist } from '../../../scripts/production-runtime-launchd.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// parseStrictBooleanEnv — exact 'true'/'false' only, invalid fails loud
// ---------------------------------------------------------------------------

test('ENV: unset and empty mean not-configured (undefined)', () => {
  assert.equal(parseStrictBooleanEnv({}, 'FEISHU_REQUIRE_MENTION_IN_GROUP'), undefined)
  assert.equal(parseStrictBooleanEnv({ FEISHU_REQUIRE_MENTION_IN_GROUP: '' }, 'FEISHU_REQUIRE_MENTION_IN_GROUP'), undefined)
})

test('ENV: exact true/false parse to real booleans', () => {
  assert.equal(parseStrictBooleanEnv({ K: 'true' }, 'K'), true)
  assert.equal(parseStrictBooleanEnv({ K: 'false' }, 'K'), false)
})

test('ENV: every other value fails LOUD with FEISHU_UX_SWITCH_INVALID', () => {
  for (const bad of ['True', 'FALSE', '1', '0', 'yes', 'no', 'off', 'on', ' true', 'true ', 't', 'f', 'null', 'undefined', '是的']) {
    assert.throws(
      () => parseStrictBooleanEnv({ K: bad }, 'K'),
      (error) => error.code === 'FEISHU_UX_SWITCH_INVALID'
        && error.message.includes("'true' or 'false'")
        && error.message.includes(JSON.stringify(bad)),
      `must reject ${JSON.stringify(bad)}`,
    )
  }
})

// ---------------------------------------------------------------------------
// resolveFeishuUxSwitches — both vars, only configured keys returned
// ---------------------------------------------------------------------------

test('SWITCHES: nothing configured -> empty object (connector defaults apply)', () => {
  assert.deepEqual(resolveFeishuUxSwitches({}), {})
})

test('SWITCHES: false/false (the frozen production target) parses to both false', () => {
  assert.deepEqual(
    resolveFeishuUxSwitches({
      FEISHU_REQUIRE_MENTION_IN_GROUP: 'false',
      FEISHU_AUTO_MENTION_TRIGGER_SENDER: 'false',
    }),
    { requireMentionInGroup: false, autoMentionTriggerSender: false },
  )
})

test('SWITCHES: the two switches are independent (mixed values)', () => {
  assert.deepEqual(
    resolveFeishuUxSwitches({
      FEISHU_REQUIRE_MENTION_IN_GROUP: 'true',
      FEISHU_AUTO_MENTION_TRIGGER_SENDER: 'false',
    }),
    { requireMentionInGroup: true, autoMentionTriggerSender: false },
  )
  assert.deepEqual(
    resolveFeishuUxSwitches({ FEISHU_AUTO_MENTION_TRIGGER_SENDER: 'true' }),
    { autoMentionTriggerSender: true },
  )
})

test('SWITCHES: an invalid value on EITHER var fails loud (first var reported)', () => {
  assert.throws(
    () => resolveFeishuUxSwitches({ FEISHU_REQUIRE_MENTION_IN_GROUP: 'TRUE', FEISHU_AUTO_MENTION_TRIGGER_SENDER: 'false' }),
    (error) => error.code === 'FEISHU_UX_SWITCH_INVALID' && error.message.includes('FEISHU_REQUIRE_MENTION_IN_GROUP'),
  )
  assert.throws(
    () => resolveFeishuUxSwitches({ FEISHU_REQUIRE_MENTION_IN_GROUP: 'false', FEISHU_AUTO_MENTION_TRIGGER_SENDER: '0' }),
    (error) => error.code === 'FEISHU_UX_SWITCH_INVALID' && error.message.includes('FEISHU_AUTO_MENTION_TRIGGER_SENDER'),
  )
})

// ---------------------------------------------------------------------------
// compose wiring — strict parse in the ENABLED branch, spread into the mount;
// the channel-OFF path warns instead of failing (audit Product #442)
// ---------------------------------------------------------------------------

test('COMPOSE: switches are strictly parsed INSIDE the enabled branch and spread into the feishu mount', () => {
  const source = readFileSync(join(HERE, '..', 'src', 'compose.js'), 'utf8')
  const enabledBranch = source.indexOf('existsSync(feishuCredsPath)')
  const parse = source.indexOf('resolveFeishuUxSwitches()')
  const mountCfg = source.indexOf('...feishuUxSwitches')
  const offWarn = source.indexOf('warnInvalidUnconfiguredFeishuEnv(')
  assert.ok(enabledBranch >= 0 && parse > enabledBranch, 'strict parse lives in the ENABLED branch (a disabled adapter cannot fail the base path)')
  assert.ok(mountCfg > source.indexOf('applyFeishu(ctx,'), 'parsed switches are spread into the applyFeishu config')
  assert.ok(mountCfg < source.indexOf('feishu ingress gate wired'), 'switch config lands with the mount, before gate wiring')
  assert.ok(offWarn >= 0, 'the channel-OFF path reports invalid adapter env (observable, non-fatal)')
})

// ---------------------------------------------------------------------------
// launchd pass-through — both variables forwarded when present at install
// ---------------------------------------------------------------------------

test('LAUNCHD: both FEISHU switch vars pass through into the rendered plist when set', () => {
  const saved = { a: process.env.FEISHU_REQUIRE_MENTION_IN_GROUP, b: process.env.FEISHU_AUTO_MENTION_TRIGGER_SENDER }
  try {
    process.env.FEISHU_REQUIRE_MENTION_IN_GROUP = 'false'
    process.env.FEISHU_AUTO_MENTION_TRIGGER_SENDER = 'false'
    const plist = renderPlist({ root: '/tmp/agent-core-test', label: 'ai.test', nodeBin: '/usr/bin/node', harness: '/tmp/harness' })
    assert.ok(plist.includes('<key>FEISHU_REQUIRE_MENTION_IN_GROUP</key><string>false</string>'))
    assert.ok(plist.includes('<key>FEISHU_AUTO_MENTION_TRIGGER_SENDER</key><string>false</string>'))
  } finally {
    for (const [key, value] of [['FEISHU_REQUIRE_MENTION_IN_GROUP', saved.a], ['FEISHU_AUTO_MENTION_TRIGGER_SENDER', saved.b]]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('LAUNCHD: unset switch vars emit NO plist keys (defaults stay connector-owned)', () => {
  const saved = { a: process.env.FEISHU_REQUIRE_MENTION_IN_GROUP, b: process.env.FEISHU_AUTO_MENTION_TRIGGER_SENDER }
  try {
    delete process.env.FEISHU_REQUIRE_MENTION_IN_GROUP
    delete process.env.FEISHU_AUTO_MENTION_TRIGGER_SENDER
    const plist = renderPlist({ root: '/tmp/agent-core-test', label: 'ai.test', nodeBin: '/usr/bin/node', harness: '/tmp/harness' })
    assert.equal(plist.includes('FEISHU_REQUIRE_MENTION_IN_GROUP'), false)
    assert.equal(plist.includes('FEISHU_AUTO_MENTION_TRIGGER_SENDER'), false)
    assert.ok(plist.includes('<key>FEISHU_CREDS_PATH</key>') === (process.env.FEISHU_CREDS_PATH !== undefined && process.env.FEISHU_CREDS_PATH !== ''), 'existing pass-through behavior unchanged')
  } finally {
    for (const [key, value] of [['FEISHU_REQUIRE_MENTION_IN_GROUP', saved.a], ['FEISHU_AUTO_MENTION_TRIGGER_SENDER', saved.b]]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
