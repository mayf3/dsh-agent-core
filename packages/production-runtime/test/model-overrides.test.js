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
const VALID_ROUTE = Object.freeze({
  provider: 'openai-codex',
  model: 'gpt-5.6-luna',
  plugin: 'dsh-codex',
  pluginVersion: '0.2.3',
  providerEnv: VALID_PROVIDER_ENV,
})
const VALID = {
  version: 1,
  overrides: {
    [TARGET]: {
      ...VALID_ROUTE,
    },
  },
}

test('ChatGPT subscription tuple pins DSH rc.8 and keeps the accepted route and plugin', () => {
  assert.equal(CHATGPT_SUBSCRIPTION_V1.targetAgentId, 'agt_cto-agent')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.provider, 'openai-codex')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.model, 'gpt-5.6-luna')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.plugin, 'dsh-codex')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.pluginVersion, '0.2.3')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.dshVersion, '0.1.0-rc.8')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.dshCommit, '514ab7b0029141b88c807704764d0d3e1eea1da4')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.credentialFile, '.openai-codex-auth.json')
})

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'model-overrides-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return { root, file: join(root, 'agent-model-overrides.json') }
}

function write(file, value) {
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
}

test('missing config preserves the existing global route; valid config opts in exactly the target', (t) => {
  const { file } = fixture(t)
  const missing = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.equal(missing.filePresent, false)
  assert.deepEqual(missing.resolve(TARGET, GLOBAL), GLOBAL)
  assert.deepEqual(missing.resolve(OTHER, GLOBAL), GLOBAL)

  write(file, VALID)
  const loaded = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.equal(Object.keys(loaded.overrides).length, 1)
  assert.deepEqual(loaded.resolve(TARGET, GLOBAL), VALID.overrides[TARGET])
  assert.deepEqual(loaded.resolve(OTHER, GLOBAL), GLOBAL)
})

test('malformed, invalid top-level, duplicate and multi-Agent configs fail loud', (t) => {
  const { file } = fixture(t)
  for (const source of [
    '{not json',
    '[]',
    '{"version":1,"overrides":{},"extra":true}',
    `{"version":1,"overrides":{"${TARGET}":${JSON.stringify(VALID.overrides[TARGET])},"${TARGET}":${JSON.stringify(VALID.overrides[TARGET])}}}`,
    JSON.stringify({ version: 1, overrides: { ...VALID.overrides, [OTHER]: VALID.overrides[TARGET] } }),
  ]) {
    write(file, source)
    assert.throws(
      () => loadAgentModelOverrides(file, [TARGET, OTHER]),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID',
      source,
    )
  }
})

test('unregistered agent, missing fields and every non-frozen tuple field fail loud', (t) => {
  const { file } = fixture(t)
  write(file, { version: 1, overrides: { [TARGET]: VALID.overrides[TARGET] } })
  assert.throws(() => loadAgentModelOverrides(file, [OTHER]), /unregistered agentId/)

  const invalidRoutes = [
    { provider: 'openai-codex', model: 'gpt-5.6-luna', plugin: 'dsh-codex' },
    { ...VALID.overrides[TARGET], provider: 'oc-go' },
    { ...VALID.overrides[TARGET], model: 'gpt-5.6-sol' },
    { ...VALID.overrides[TARGET], plugin: 'other-plugin' },
    { ...VALID.overrides[TARGET], pluginVersion: '0.2.4' },
    { ...VALID.overrides[TARGET], pluginVersion: '^0.2.3' },
  ]
  for (const route of invalidRoutes) {
    write(file, { version: 1, overrides: { [TARGET]: route } })
    assert.throws(() => loadAgentModelOverrides(file, [TARGET, OTHER]), (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID')
  }
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
    write(file, {
      version: 1,
      overrides: { [TARGET]: { ...VALID_ROUTE, providerEnv: { ...VALID_PROVIDER_ENV, NO_PROXY } } },
    })
    const loaded = loadAgentModelOverrides(file, [TARGET, OTHER])
    assert.deepEqual(Object.keys(loaded.overrides[TARGET].providerEnv), PROVIDER_ENV_ALLOWLIST)
    assert.equal(loaded.overrides[TARGET].providerEnv.NO_PROXY, NO_PROXY)
    assert.equal(Object.isFrozen(loaded.overrides[TARGET].providerEnv), true)
  }

  const invalidNoProxy = [
    ' localhost', 'localhost ', 'local host', 'localhost\nexample.com',
    '"example.com"', "'example.com'", '`example.com`', '$HOST', '$(hostname)',
    'example.com,,localhost', 'bad_host', '999.1.1.1', '[not-ipv6]',
    '[::1]:0', '[::1]:65536', 'example.com:0', 'example.com:65536',
  ]
  for (const NO_PROXY of invalidNoProxy) {
    write(file, {
      version: 1,
      overrides: { [TARGET]: { ...VALID_ROUTE, providerEnv: { ...VALID_PROVIDER_ENV, NO_PROXY } } },
    })
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
    write(file, {
      version: 1,
      overrides: { [TARGET]: { ...VALID_ROUTE, providerEnv: { ...VALID_PROVIDER_ENV, [key]: value } } },
    })
    assert.throws(
      () => loadAgentModelOverrides(file, [TARGET, OTHER]),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes(`${key}: ${invalidClass}`)
        && (value === '' || !error.message.includes(value)),
    )
  }

  for (const providerEnv of [null, [], 'secret-value']) {
    write(file, { version: 1, overrides: { [TARGET]: { ...VALID_ROUTE, providerEnv } } })
    assert.throws(
      () => loadAgentModelOverrides(file, [TARGET, OTHER]),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes('providerEnv: invalid_type')
        && !error.message.includes('secret-value'),
    )
  }

  const missing = { ...VALID_PROVIDER_ENV }
  delete missing.NO_PROXY
  write(file, { version: 1, overrides: { [TARGET]: { ...VALID_ROUTE, providerEnv: missing } } })
  assert.throws(() => loadAgentModelOverrides(file, [TARGET, OTHER]), /NO_PROXY: missing_key/u)

  write(file, {
    version: 1,
    overrides: { [TARGET]: { ...VALID_ROUTE, providerEnv: { ...VALID_PROVIDER_ENV, http_proxy: 'http://secret.invalid' } } },
  })
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

test('production composition passes one immutable resolved route to target and global route to another Agent', async (t) => {
  const { runtime, spawned, provisioned } = await runtimeFixture(t, true)
  await runtime.router.ensureRunning(TARGET)
  await runtime.router.ensureRunning(OTHER)
  assert.equal(spawned.length, 2)
  assert.deepEqual(
    {
      provider: spawned[0].provider,
      model: spawned[0].model,
      providerEnv: spawned[0].providerEnv,
      omitEnv: spawned[0].omitEnv,
    },
    {
      provider: 'openai-codex',
      model: 'gpt-5.6-luna',
      providerEnv: VALID_PROVIDER_ENV,
      omitEnv: ['OPENAI_API_KEY'],
    },
  )
  assert.equal(spawned[0].subscription, undefined, 'subscription provisioning is not a child-process concern')
  assert.deepEqual(
    { provider: spawned[1].provider, model: spawned[1].model },
    GLOBAL,
  )
  assert.deepEqual(provisioned[0].options.subscription, {
    plugin: 'dsh-codex',
    pluginVersion: '0.2.3',
    dshVersion: '0.1.0-rc.8',
    dshCommit: '514ab7b0029141b88c807704764d0d3e1eea1da4',
    credentialFile: '.openai-codex-auth.json',
  })
  assert.equal(provisioned[1].options.subscription, undefined)
})

test('same runtime performs proxy-only then full rollback while preserving non-target PID and route', async (t) => {
  const { runtime, spawned, layout } = await runtimeFixture(t, true)
  const runtimeIdentity = runtime
  const targetBefore = await runtime.router.ensureRunning(TARGET)
  const otherBefore = await runtime.router.ensureRunning(OTHER)
  assert.deepEqual(
    { provider: targetBefore.provider, model: targetBefore.model, providerEnv: targetBefore.providerEnv },
    { provider: 'openai-codex', model: 'gpt-5.6-luna', providerEnv: VALID_PROVIDER_ENV },
  )
  assert.deepEqual({ provider: otherBefore.provider, model: otherBefore.model }, GLOBAL)

  // Proxy-only rollback keeps the accepted Luna route but strips its target
  // proxy injection on the next target process. The running non-target is
  // neither re-resolved nor restarted.
  write(layout.agentModelOverrides, {
    version: 1,
    overrides: {
      [TARGET]: {
        provider: VALID_ROUTE.provider,
        model: VALID_ROUTE.model,
        plugin: VALID_ROUTE.plugin,
        pluginVersion: VALID_ROUTE.pluginVersion,
      },
    },
  })
  await targetBefore.shutdown()
  const targetWithoutProxy = await runtime.router.ensureRunning(TARGET)
  assert.notEqual(targetWithoutProxy.pid, targetBefore.pid)
  assert.deepEqual(
    { provider: targetWithoutProxy.provider, model: targetWithoutProxy.model, providerEnv: targetWithoutProxy.providerEnv },
    { provider: 'openai-codex', model: 'gpt-5.6-luna', providerEnv: undefined },
  )
  assert.equal((await runtime.router.ensureRunning(OTHER)).pid, otherBefore.pid)

  // Full rollback removes the override and returns only the target to the
  // unchanged global route.
  unlinkSync(layout.agentModelOverrides)
  await targetWithoutProxy.shutdown()
  const targetAfter = await runtime.router.ensureRunning(TARGET)

  assert.equal(runtime, runtimeIdentity)
  assert.notEqual(targetAfter.pid, targetWithoutProxy.pid)
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
