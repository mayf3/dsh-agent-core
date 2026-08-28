/**
 * Composition-level runtime tests for agent-model-overrides.json version 2
 * (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1 §2 + Amendment 1 A1.2/A1.4). Split
 * from model-overrides.test.js at the 500-line structure cap — the moved
 * tests are byte-identical, coverage and assertions unchanged.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { RECOGNIZED_PROXY_ENV_KEYS } from '../../agent-router/src/process.js'
import {
  assertTargetProxyRuntime,
  composeProductionRuntime,
  TARGET_PROXY_NODE_VERSION,
} from '../src/compose.js'
import { CHATGPT_SUBSCRIPTION_V1 } from '../src/model-overrides.js'
import { resolveProductionLayout } from '../src/paths.js'

const TARGET = CHATGPT_SUBSCRIPTION_V1.targetAgentId
const OTHER = 'agt_other'
const GLOBAL = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })
const VALID_PROVIDER_ENV = Object.freeze({
  HTTP_PROXY: 'http://127.0.0.1:7890',
  HTTPS_PROXY: 'http://127.0.0.1:7890',
  NO_PROXY: 'localhost,127.0.0.1,::1',
  NODE_USE_ENV_PROXY: '1',
})

/**
 * agent-model-overrides.json version 2 (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
 * §2 + Amendment 1 A1.2/A1.4): routeCatalog + overrides.<agentId>.model.
 * {primary, fallbacks[]}. The fixture IS the frozen initial chain tuple:
 * glm53 = builtin (plugin/pluginVersion ABSENT), luna = subscription
 * (dsh-codex@0.2.3 exact). Route CONTENT lives entirely in the config — the
 * code constant below only carries pins/scope (F-10 / ACC-014).
 */
const CATALOG = Object.freeze({
  glm53: {
    routeKind: 'builtin',
    provider: 'zai',
    model: 'glm-5.3',
    credentialReadiness: 'zai-api-key-home',
  },
  luna: {
    routeKind: 'subscription',
    provider: 'openai-codex',
    model: 'gpt-5.6-luna',
    plugin: 'dsh-codex',
    pluginVersion: '0.2.3',
    credentialReadiness: 'luna-oauth-home',
  },
})
const VALID = {
  version: 2,
  routeCatalog: CATALOG,
  overrides: {
    [TARGET]: { model: { primary: 'glm53', fallbacks: ['luna'] } },
  },
}

function write(file, value) {
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
}

test('runtime gate rejects every recognized proxy key and any non-exact Node version without values', () => {
  assert.doesNotThrow(() => assertTargetProxyRuntime({ env: {}, version: TARGET_PROXY_NODE_VERSION }))
  for (const key of RECOGNIZED_PROXY_ENV_KEYS) {
    assert.throws(
      () => assertTargetProxyRuntime({ env: { [key]: 'secret-runtime-value' }, version: TARGET_PROXY_NODE_VERSION }),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes(`${key}: runtime_proxy_env_present`)
        && !error.message.includes('secret-runtime-value'),
      key,
    )
  }
  for (const version of ['v24.99.0', 'v25.6.0', 'v25.6.2', '25.6.1']) {
    assert.throws(
      () => assertTargetProxyRuntime({ env: {}, version }),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes('NODE_RUNTIME_VERSION: runtime_version_mismatch')
        && !error.message.includes(version),
      version,
    )
  }
})

test('production composition applies the runtime proxy gate before any mount or layout read', async () => {
  const previous = process.env.http_proxy
  process.env.http_proxy = 'http://secret-runtime-proxy.invalid'
  try {
    await assert.rejects(
      composeProductionRuntime({
        layout: new Proxy({}, {
          get() { throw new Error('layout must not be read before the runtime gate') },
        }),
      }),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes('http_proxy: runtime_proxy_env_present')
        && !error.message.includes('secret-runtime-proxy.invalid'),
    )
  } finally {
    if (previous === undefined) delete process.env.http_proxy
    else process.env.http_proxy = previous
  }
})

class FakeProc {
  constructor(options) {
    Object.assign(this, options)
    this.pid = FakeProc.nextPid++
    this.exit = undefined
    this.exitPromise = new Promise(() => {})
    this.creations = []
  }
  spawn() { return this }
  async ready() { return 1 }
  async shutdown() {
    this.exit = { code: 0, signal: null }
    this.exitPromise = Promise.resolve(this.exit)
    return this.exit
  }
  async turn() { return { reply: 'ok', ms: 1, promptMs: 1, messageId: 'm' } }
  async deliver() { return { accepted: true, sessionId: 'main', messageId: 'm' } }
}
FakeProc.nextPid = 7100

async function runtimeFixture(t, withOverride) {
  const root = mkdtempSync(join(tmpdir(), 'model-runtime-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: TARGET,
    agents: [{ id: TARGET, name: 'CTO' }, { id: OTHER, name: 'Other' }],
  })
  if (withOverride) write(layout.agentModelOverrides, VALID)
  const spawned = []
  const provisioned = []
  const runtime = await composeProductionRuntime({
    layout,
    globalRoute: GLOBAL,
    productApi: { enabled: false },
    notificationIngress: { enabled: false },
    processFactory: (options) => { const proc = new FakeProc(options); spawned.push(proc); return proc },
    provisionHome: (home, workspace, options) => provisioned.push({ home, workspace, options }),
    log: { log() {}, warn() {}, error() {} },
  })
  t.after(() => runtime.stop())
  return { runtime, spawned, provisioned, layout }
}

test('composition resolves the v2 primary to target and the global route to another Agent', async (t) => {
  const { runtime, spawned, provisioned } = await runtimeFixture(t, true)
  await runtime.router.ensureRunning(TARGET)
  await runtime.router.ensureRunning(OTHER)
  assert.equal(spawned.length, 2)
  assert.deepEqual(
    { provider: spawned[0].provider, model: spawned[0].model, providerEnv: spawned[0].providerEnv, omitEnv: spawned[0].omitEnv },
    { provider: 'zai', model: 'glm-5.3', providerEnv: undefined, omitEnv: ['OPENAI_API_KEY'] },
  )
  assert.equal(spawned[0].subscription, undefined, 'subscription provisioning is not a child-process concern')
  assert.deepEqual({ provider: spawned[1].provider, model: spawned[1].model }, GLOBAL)
  // ACC-016/DEC-IMPL-011: the builtin glm53 primary carries NO subscription
  // provisioning block — a builtin spawn stays off the plugin/pin path.
  assert.equal(provisioned[0].options.subscription, undefined)
  assert.equal(provisioned[1].options.subscription, undefined)
})

test('target-only rollback rewrites the config file; non-target PID and route unchanged', async (t) => {
  const { runtime, spawned, layout } = await runtimeFixture(t, true)
  const targetBefore = await runtime.router.ensureRunning(TARGET)
  const otherBefore = await runtime.router.ensureRunning(OTHER)
  assert.deepEqual({ provider: targetBefore.provider, model: targetBefore.model }, { provider: 'zai', model: 'glm-5.3' })
  assert.deepEqual({ provider: otherBefore.provider, model: otherBefore.model }, GLOBAL)

  // Proxy-only rollback: remove providerEnv from the primary's catalog entry.
  write(layout.agentModelOverrides, {
    version: 2,
    routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: VALID_PROVIDER_ENV } },
    overrides: VALID.overrides,
  })
  await targetBefore.shutdown()
  const targetWithProxy = await runtime.router.ensureRunning(TARGET)
  assert.notEqual(targetWithProxy.pid, targetBefore.pid)
  assert.deepEqual(targetWithProxy.providerEnv, VALID_PROVIDER_ENV)

  // Full rollback: remove the whole override — target falls back to global.
  unlinkSync(layout.agentModelOverrides)
  await targetWithProxy.shutdown()
  const targetAfter = await runtime.router.ensureRunning(TARGET)
  assert.notEqual(targetAfter.pid, targetWithProxy.pid)
  assert.deepEqual({ provider: targetAfter.provider, model: targetAfter.model }, GLOBAL)
  assert.equal((await runtime.router.ensureRunning(OTHER)).pid, otherBefore.pid)
  assert.deepEqual({ provider: otherBefore.provider, model: otherBefore.model }, GLOBAL)
  assert.equal(spawned.length, 4, 'only the target process was replaced for both rollback layers')
})

test('malformed config fails target respawn loud without disturbing a running non-target', async (t) => {
  const { runtime, spawned, layout } = await runtimeFixture(t, true)
  const target = await runtime.router.ensureRunning(TARGET)
  const other = await runtime.router.ensureRunning(OTHER)
  const otherPid = other.pid

  write(layout.agentModelOverrides, '{malformed')
  await target.shutdown()
  await assert.rejects(
    runtime.router.ensureRunning(TARGET),
    (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID',
  )

  assert.equal(spawned.length, 2, 'invalid config is rejected before target spawn')
  assert.equal((await runtime.router.ensureRunning(OTHER)).pid, otherPid)
  assert.equal(other.exit, undefined)
  assert.deepEqual({ provider: other.provider, model: other.model }, GLOBAL)
})
