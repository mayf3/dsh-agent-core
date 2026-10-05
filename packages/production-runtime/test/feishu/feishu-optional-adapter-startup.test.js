/**
 * Feishu OPTIONAL-adapter startup radius (audit Product #442, short-term C).
 *
 * The Feishu channel is an OPTIONAL adapter: it mounts ONLY with real
 * credentials (compose.js honest-offline contract). Its channel-specific
 * supervision env (FEISHU_REQUIRE_MENTION_IN_GROUP /
 * FEISHU_AUTO_MENTION_TRIGGER_SENDER / FEISHU_PROCESSING_REACTION_ENABLED /
 * FEISHU_REPLY_RENDER_MODE) configures ONLY the mounted channel.
 *
 * Contract under test (fail radius by actual obligation):
 *   1. Adapter DISABLED + bad adapter-specific env  -> the unrelated base
 *      path composes and starts (warn, never silently hidden).
 *   2. Adapter DISABLED + missing adapter implementation -> the unrelated
 *      base path still composes (see feishu-missing-impl-startup.test.js).
 *   3. Adapter ENABLED + invalid identity/config/env -> the composition
 *      fails LOUD (fail closed); delivery never fakes a send.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { composeProductionRuntime } from '../../src/compose.js'
import { AGT_ID, FakeProc, seedRuntime, silentLog } from '../compose-fixture.js'

const GLOBAL_ROUTE = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })

const FEISHU_ENV_KEYS = [
  'FEISHU_CREDS_PATH',
  'FEISHU_REQUIRE_MENTION_IN_GROUP',
  'FEISHU_AUTO_MENTION_TRIGGER_SENDER',
  'FEISHU_PROCESSING_REACTION_ENABLED',
  'FEISHU_REPLY_RENDER_MODE',
]

/** Neutralize the supervision env the compose path reads, restore on exit. */
async function withFeishuEnv(env, run) {
  const saved = Object.fromEntries(FEISHU_ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of FEISHU_ENV_KEYS) delete process.env[key]
  Object.assign(process.env, env)
  try {
    return await run()
  } finally {
    for (const key of FEISHU_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

function warnRecorder() {
  const warnings = []
  return {
    warnings,
    log: { ...silentLog, warn: (...args) => warnings.push(args.join(' ')) },
  }
}

async function composeBase(t, { log }) {
  const { root, layout } = await seedRuntime(t)
  const spawned = []
  const runtime = await composeProductionRuntime({
    globalRoute: GLOBAL_ROUTE,
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0 },
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
    log,
  })
  t.after(() => runtime.stop())
  return { root, layout, runtime }
}

// ---------------------------------------------------------------------------
// 1. adapter DISABLED: bad adapter-specific env must not block the base path
// ---------------------------------------------------------------------------

test('RED base: channel OFF + invalid mention switch composes the base runtime (warn, not fatal)', async (t) => {
  const { log, warnings } = warnRecorder()
  await withFeishuEnv({ FEISHU_REQUIRE_MENTION_IN_GROUP: '1' }, async () => {
    const { runtime } = await composeBase(t, { log })
    assert.equal(runtime.feishu, undefined, 'channel stays honestly OFF')
    assert.equal(runtime.definition.getAgent(AGT_ID).id, AGT_ID, 'unrelated base path mounted')
    assert.ok(
      warnings.some((line) => line.includes('FEISHU_REQUIRE_MENTION_IN_GROUP') && line.includes("'true' or 'false'")),
      `invalid adapter env stays observable: ${JSON.stringify(warnings)}`,
    )
  })
})

test('RED base: channel OFF + invalid reply render mode composes the base runtime (warn, not fatal)', async (t) => {
  const { log, warnings } = warnRecorder()
  await withFeishuEnv({ FEISHU_REPLY_RENDER_MODE: 'card-ish' }, async () => {
    const { runtime } = await composeBase(t, { log })
    assert.equal(runtime.feishu, undefined, 'channel stays honestly OFF')
    assert.ok(
      warnings.some((line) => line.includes('FEISHU_REPLY_RENDER_MODE') && line.includes("'markdown' or 'card'")),
      `invalid adapter env stays observable: ${JSON.stringify(warnings)}`,
    )
  })
})

test('RED base: channel OFF + invalid processing-reaction switch composes the base runtime (warn, not fatal)', async (t) => {
  const { log, warnings } = warnRecorder()
  await withFeishuEnv({ FEISHU_PROCESSING_REACTION_ENABLED: 'maybe' }, async () => {
    const { runtime } = await composeBase(t, { log })
    assert.equal(runtime.feishu, undefined, 'channel stays honestly OFF')
    assert.ok(
      warnings.some((line) => line.includes('FEISHU_PROCESSING_REACTION_ENABLED') && line.includes('FEISHU_PROCESSING_REACTION_INVALID')),
      `invalid adapter env stays observable: ${JSON.stringify(warnings)}`,
    )
  })
})

// ---------------------------------------------------------------------------
// 3. adapter ENABLED: invalid adapter env / identity must fail loud (closed)
// ---------------------------------------------------------------------------

async function writeValidCreds(t) {
  const root = await mkdtemp(join(tmpdir(), 'prt-feishu-creds-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const credsPath = join(root, 'feishu-creds.json')
  await writeFile(credsPath, JSON.stringify({ appId: 'cli_test_app', appSecret: 'sh-ecret' }))
  return credsPath
}

test('enabled channel + invalid mention switch fails composition LOUD (fail closed)', async (t) => {
  const credsPath = await writeValidCreds(t)
  const { log } = warnRecorder()
  await withFeishuEnv({ FEISHU_CREDS_PATH: credsPath, FEISHU_REQUIRE_MENTION_IN_GROUP: '1' }, async () => {
    await assert.rejects(
      () => composeBase(t, { log }),
      (error) => error.code === 'FEISHU_UX_SWITCH_INVALID' && error.message.includes('FEISHU_REQUIRE_MENTION_IN_GROUP'),
    )
  })
})

test('enabled channel + invalid reply render mode fails composition LOUD (fail closed)', async (t) => {
  const credsPath = await writeValidCreds(t)
  const { log } = warnRecorder()
  await withFeishuEnv({ FEISHU_CREDS_PATH: credsPath, FEISHU_REPLY_RENDER_MODE: 'bogus' }, async () => {
    await assert.rejects(
      () => composeBase(t, { log }),
      (error) => error.code === 'FEISHU_REPLY_RENDER_MODE_INVALID',
    )
  })
})

test('enabled channel + invalid identity credentials fail composition LOUD (fail closed)', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'prt-feishu-creds-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const credsPath = join(root, 'feishu-creds.json')
  await writeFile(credsPath, ';;; not credentials at all')
  const { log } = warnRecorder()
  await withFeishuEnv({ FEISHU_CREDS_PATH: credsPath }, async () => {
    await assert.rejects(
      () => composeBase(t, { log }),
      (error) => /appId\/appSecret/.test(error.message),
    )
  })
})
