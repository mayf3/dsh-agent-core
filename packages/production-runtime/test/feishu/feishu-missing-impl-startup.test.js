/**
 * Feishu MISSING-IMPLEMENTATION startup radius (audit Product #442,
 * short-term C — "缺实现" half of the disabled-adapter counterexample).
 *
 * With the channel DISABLED, the base production composition must not
 * statically depend on the optional adapter's module graph at all: a broken
 * or absent @larksuite/channel must leave the unrelated base path fully
 * composable (hooks simulate the missing SDK; node --test isolates this
 * file in its own process, so the hook cannot leak into other suites).
 *
 * With the channel ENABLED (real credentials path present), the same absent
 * implementation must fail the composition LOUD with a machine-readable
 * feishu-scoped code — never a half-composed runtime, never a silent skip.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import { AGT_ID, FakeProc, seedRuntime, silentLog } from '../compose-fixture.js'

const HERE = dirname(fileURLToPath(import.meta.url))
register('./fixtures/blocks-lark-channel.mjs', pathToFileURL(HERE + '/').href)

const GLOBAL_ROUTE = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })

async function compose(t, { credsPath }) {
  const { root, layout } = await seedRuntime(t)
  const spawned = []
  const { composeProductionRuntime } = await import('../../src/compose.js')
  const runtime = await composeProductionRuntime({
    globalRoute: GLOBAL_ROUTE,
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0 },
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
    log: silentLog,
    ...(credsPath === undefined ? {} : { feishuCredsPath: credsPath }),
  })
  t.after(() => runtime.stop())
  return { root, layout, runtime }
}

test('RED base: missing adapter implementation does not block the channel-OFF base path', async (t) => {
  const savedCreds = process.env.FEISHU_CREDS_PATH
  delete process.env.FEISHU_CREDS_PATH
  try {
    const { runtime } = await compose(t, {})
    assert.equal(runtime.feishu, undefined, 'channel stays honestly OFF')
    assert.equal(runtime.definition.getAgent(AGT_ID).id, AGT_ID, 'unrelated base path mounted')
    assert.notEqual(runtime.ctx.get('brokerGateway'), undefined, 'broker gateway still composed')
  } finally {
    if (savedCreds !== undefined) process.env.FEISHU_CREDS_PATH = savedCreds
  }
})

test('enabled channel + missing adapter implementation fails composition LOUD (fail closed)', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'prt-feishu-missing-impl-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const credsPath = join(root, 'feishu-creds.json')
  await writeFile(credsPath, JSON.stringify({ appId: 'cli_test_app', appSecret: 'sh-ecret' }))
  await assert.rejects(
    () => compose(t, { credsPath }),
    (error) => error.code === 'FEISHU_CONNECTOR_UNAVAILABLE' && /feishu channel is configured/.test(error.message),
  )
})
