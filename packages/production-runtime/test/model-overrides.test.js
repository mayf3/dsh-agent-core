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
import {
  CHATGPT_SUBSCRIPTION_V1,
  loadAgentModelOverrides,
  MAX_CONFIGURED_ROUTES,
  PROVIDER_ENV_ALLOWLIST,
} from '../src/model-overrides.js'
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
 * §2): routeCatalog + overrides.<agentId>.model.{primary, fallbacks[]}.
 * Route CONTENT lives entirely in the config — the code constant below only
 * carries pins/scope (F-10 / ACC-014).
 */
const CATALOG = Object.freeze({
  glm53: {
    provider: 'zai',
    model: 'glm-5.3',
    plugin: 'dsh-zai',
    pluginVersion: '1.4.2',
    credentialReadiness: 'zai-oauth',
  },
  luna: {
    provider: 'openai-codex',
    model: 'gpt-5.6-luna',
    plugin: 'dsh-codex',
    pluginVersion: '0.2.3',
    credentialReadiness: 'luna-oauth',
  },
})
const VALID = {
  version: 2,
  routeCatalog: CATALOG,
  overrides: {
    [TARGET]: { model: { primary: 'glm53', fallbacks: ['luna'] } },
  },
}

test('the code constant carries ONLY pins and scope — no route tuple values (F-10)', () => {
  assert.equal(CHATGPT_SUBSCRIPTION_V1.targetAgentId, 'agt_cto-agent')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.plugin, 'dsh-codex')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.pluginVersion, '0.2.3')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.dshVersion, '0.1.0-rc.8')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.dshCommit, '514ab7b0029141b88c807704764d0d3e1eea1da4')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.credentialFile, '.openai-codex-auth.json')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.provider, undefined, 'provider must come from config only')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.model, undefined, 'model must come from config only')
  assert.equal(MAX_CONFIGURED_ROUTES, 4)
})

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'model-overrides-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return { root, file: join(root, 'agent-model-overrides.json') }
}

function write(file, value) {
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
}

function invalid(file, source, extra = []) {
  write(file, source)
  assert.throws(
    () => loadAgentModelOverrides(file, [TARGET, OTHER]),
    (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID',
    typeof source === 'string' ? source : JSON.stringify(source),
  )
  for (const agents of extra) {
    assert.throws(() => loadAgentModelOverrides(file, agents), (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID')
  }
}

test('missing file = global passthrough; valid v2 chain resolves primary-first with identities', (t) => {
  const { file } = fixture(t)
  const missing = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.equal(missing.filePresent, false)
  const passthrough = missing.resolveChain(TARGET, GLOBAL)
  assert.equal(passthrough.override, false)
  assert.equal(passthrough.routes.length, 1)
  assert.deepEqual(
    { provider: passthrough.routes[0].provider, model: passthrough.routes[0].model },
    GLOBAL,
  )
  assert.deepEqual(passthrough.routes[0].processConfig, GLOBAL)

  write(file, VALID)
  const loaded = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.equal(Object.keys(loaded.overrides).length, 1)
  const chain = loaded.resolveChain(TARGET, GLOBAL)
  assert.equal(chain.override, true)
  assert.deepEqual(chain.routes.map((route) => route.routeRef), ['glm53', 'luna'])
  assert.deepEqual(
    chain.routes.map((route) => [route.provider, route.model]),
    [['zai', 'glm-5.3'], ['openai-codex', 'gpt-5.6-luna']],
  )
  assert.notEqual(chain.routes[0].identity, chain.routes[1].identity)
  assert.equal(Object.isFrozen(chain.routes), true)
  assert.equal(Object.isFrozen(chain.routes[0].processConfig), true)
  // Compat single-route resolver = the chain's primary.
  assert.deepEqual(loaded.resolve(TARGET, GLOBAL), {
    provider: 'zai', model: 'glm-5.3', plugin: 'dsh-zai', pluginVersion: '1.4.2',
  })
  assert.deepEqual(loaded.resolve(OTHER, GLOBAL), GLOBAL)
  // Same config -> stable chain identity across loads (turn snapshot anchor).
  const again = loadAgentModelOverrides(file, [TARGET, OTHER]).resolveChain(TARGET, GLOBAL)
  assert.equal(again.chainId, chain.chainId)
})

test('version discipline: v1 files and version ≠ 2 fail loud (no auto conversion)', (t) => {
  const { file } = fixture(t)
  invalid(file, { version: 1, overrides: { [TARGET]: { provider: 'x', model: 'y' } } })
  invalid(file, { version: 3, routeCatalog: {}, overrides: {} })
})

test('malformed family: bad JSON, wrong shape, extra keys, deep duplicate keys fail loud', (t) => {
  const { file } = fixture(t)
  invalid(file, '{not json')
  invalid(file, '[]')
  invalid(file, { ...VALID, extra: true })
  invalid(file, { version: 2, routeCatalog: CATALOG })
  invalid(file, { version: 2, routeCatalog: CATALOG, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['luna'] }, extra: 1 } } })
  // Duplicate JSON key at the deepest level (providerEnv), before parse.
  const luna = JSON.stringify(CATALOG.luna)
  invalid(file, `{"version":2,"routeCatalog":{"luna":${luna.slice(0, -1)},"credentialReadiness":"luna-oauth"},"overrides":{}}`)
  const override = JSON.stringify(VALID.overrides[TARGET])
  invalid(file, `{"version":2,"routeCatalog":${JSON.stringify(CATALOG)},"overrides":{"${TARGET}":${override.slice(0, -1)},"fallbacks":["luna"]}}}`)
})

test('reference integrity and dedup: unknown ref, repeated ref, canonical alias duplicates fail loud', (t) => {
  const { file } = fixture(t)
  invalid(file, { ...VALID, overrides: { [TARGET]: { model: { primary: 'missing', fallbacks: [] } } } })
  invalid(file, { ...VALID, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['glm53'] } } } })
  invalid(file, { ...VALID, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['luna', 'luna'] } } } })
  // Two different routeRefs with the SAME canonical six-field identity.
  const aliased = { ...CATALOG, glm53_alias: { ...CATALOG.glm53 } }
  invalid(file, { ...VALID, routeCatalog: aliased })
  // Same provider/model but a different credentialReadiness is a distinct
  // canonical route (the reference is part of the identity).
  const distinct = { ...CATALOG, luna_canary: { ...CATALOG.luna, credentialReadiness: 'luna-oauth-canary' } }
  write(file, { ...VALID, routeCatalog: distinct, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['luna', 'luna_canary'] } } } })
  assert.doesNotThrow(() => loadAgentModelOverrides(file, [TARGET, OTHER]))
})

test('hard bound: chain length ≤ MAX_CONFIGURED_ROUTES = 4 (never 2)', (t) => {
  const { file } = fixture(t)
  const extraRoutes = {
    routeB: { ...CATALOG.glm53, model: 'glm-5.3-b', credentialReadiness: 'zai-oauth-b' },
    routeC: { ...CATALOG.glm53, model: 'glm-5.3-c', credentialReadiness: 'zai-oauth-c' },
  }
  const catalog4 = { ...CATALOG, ...extraRoutes }
  // Length 4 (primary + three fallbacks) is the frozen maximum.
  write(file, { ...VALID, routeCatalog: catalog4, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['routeB', 'routeC', 'luna'] } } } })
  const loaded4 = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.equal(loaded4.resolveChain(TARGET, GLOBAL).routes.length, 4)
  // Length 5 exceeds the bound.
  const catalog5 = { ...catalog4, routeD: { ...CATALOG.glm53, model: 'glm-5.3-d', credentialReadiness: 'zai-oauth-d' } }
  invalid(file, { ...VALID, routeCatalog: catalog5, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['routeB', 'routeC', 'luna', 'routeD'] } } } })
  // fallbacks: [] = strict chain of one.
  write(file, { ...VALID, overrides: { [TARGET]: { model: { primary: 'luna', fallbacks: [] } } } })
  const strict = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.deepEqual(strict.resolveChain(TARGET, GLOBAL).routes.map((route) => route.routeRef), ['luna'])
})

test('activation scope: unregistered or out-of-scope agentIds fail loud', (t) => {
  const { file } = fixture(t)
  invalid(file, { ...VALID, overrides: { [OTHER]: VALID.overrides[TARGET] } }, [[TARGET]])
  write(file, VALID)
  assert.throws(
    () => loadAgentModelOverrides(file, [OTHER]),
    /unregistered agentId/,
  )
})

test('CTR-011 pin: a dsh-codex route with any other pluginVersion fails loud (not a fallback class)', (t) => {
  const { file } = fixture(t)
  for (const pluginVersion of ['0.2.4', '^0.2.3', '0.2.2']) {
    invalid(file, { ...VALID, routeCatalog: { ...CATALOG, luna: { ...CATALOG.luna, pluginVersion } } })
  }
  // Non-dsh-codex plugins are not pinned by the code constant.
  write(file, { ...VALID, routeCatalog: { ...CATALOG, luna: { ...CATALOG.luna, plugin: 'other-plugin', pluginVersion: '9.9.9' } } })
  assert.doesNotThrow(() => loadAgentModelOverrides(file, [TARGET, OTHER]))
})

test('providerEnv accepts only the frozen four-key set and safe host-list grammar', (t) => {
  const { file } = fixture(t)
  const validNoProxy = [
    'localhost',
    'localhost:8080',
    'example.com,api.example.com:443',
    '127.0.0.1,192.168.1.20:8443',
    '::1,2001:db8::1',
    '[::1],[2001:db8::1]:443',
    '*',
  ]
  for (const NO_PROXY of validNoProxy) {
    write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: { ...VALID_PROVIDER_ENV, NO_PROXY } } } })
    const loaded = loadAgentModelOverrides(file, [TARGET, OTHER])
    const providerEnv = loaded.overrides[TARGET].routes.glm53.providerEnv
    assert.deepEqual(Object.keys(providerEnv), PROVIDER_ENV_ALLOWLIST)
    assert.equal(providerEnv.NO_PROXY, NO_PROXY)
    assert.equal(Object.isFrozen(providerEnv), true)
  }

  const invalidNoProxy = [
    ' localhost', 'localhost ', 'local host', 'localhost\nexample.com',
    '"example.com"', "'example.com'", '`example.com`', '$HOST', '$(hostname)',
    'example.com,,localhost', 'bad_host', '999.1.1.1', '[not-ipv6]',
    '[::1]:0', '[::1]:65536', 'example.com:0', 'example.com:65536',
  ]
  for (const NO_PROXY of invalidNoProxy) {
    write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: { ...VALID_PROVIDER_ENV, NO_PROXY } } } })
    assert.throws(
      () => loadAgentModelOverrides(file, [TARGET, OTHER]),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes('NO_PROXY: invalid_')
        && !error.message.includes(NO_PROXY),
      NO_PROXY,
    )
  }
})

test('providerEnv URL, key and value failures are fail-loud without secret echo', (t) => {
  const { file } = fixture(t)
  const cases = [
    ['HTTP_PROXY', '', 'invalid_non_empty_string'],
    ['HTTP_PROXY', 'not-a-url-secret', 'invalid_url'],
    ['HTTP_PROXY', 'socks5://proxy-secret.invalid:1080', 'invalid_scheme'],
    ['HTTP_PROXY', 'http://token-secret@proxy.invalid:7890', 'userinfo_forbidden'],
    ['HTTP_PROXY', 'http://proxy.invalid:7890/secret-token-path', 'path_forbidden'],
    ['HTTPS_PROXY', 'https://proxy.invalid:7890/?token=secret-query', 'query_forbidden'],
    ['HTTPS_PROXY', 'https://proxy.invalid:7890/#secret-fragment', 'fragment_forbidden'],
    ['NODE_USE_ENV_PROXY', '0', 'invalid_value'],
  ]
  for (const [key, value, invalidClass] of cases) {
    write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: { ...VALID_PROVIDER_ENV, [key]: value } } } })
    assert.throws(
      () => loadAgentModelOverrides(file, [TARGET, OTHER]),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes(`${key}: ${invalidClass}`)
        && (value === '' || !error.message.includes(value)),
    )
  }

  for (const providerEnv of [null, [], 'secret-value']) {
    write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv } } })
    assert.throws(
      () => loadAgentModelOverrides(file, [TARGET, OTHER]),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes('providerEnv: invalid_type')
        && !error.message.includes('secret-value'),
    )
  }

  const missing = { ...VALID_PROVIDER_ENV }
  delete missing.NO_PROXY
  write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: missing } } })
  assert.throws(() => loadAgentModelOverrides(file, [TARGET, OTHER]), /NO_PROXY: missing_key/u)

  write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: { ...VALID_PROVIDER_ENV, http_proxy: 'http://secret.invalid' } } } })
  assert.throws(
    () => loadAgentModelOverrides(file, [TARGET, OTHER]),
    (error) => error.message.includes('http_proxy: unknown_key') && !error.message.includes('secret.invalid'),
  )
})

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
  assert.deepEqual(provisioned[0].options.subscription, {
    plugin: 'dsh-zai',
    pluginVersion: '1.4.2',
    dshVersion: '0.1.0-rc.8',
    dshCommit: '514ab7b0029141b88c807704764d0d3e1eea1da4',
    credentialFile: '.openai-codex-auth.json',
  })
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
