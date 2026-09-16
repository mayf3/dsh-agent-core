/**
 * DEFAULT_MODEL_ROUTING_CONFIG_V1 acceptance: the built-in default model
 * route is the canonical GPT Luna subscription route, layered strictly under
 * explicit configuration —
 *
 *   request override > agent/profile override > runtime/global config
 *     > built-in default (openai-codex/gpt-5.6-luna)
 *
 * A-D1 zero config · A-D2 runtime/env + composition override · A-D3 agent
 * override (OpenCode Go stays an explicit route) · unit-level passthrough
 * subscription carry + legacy two-field shape preservation.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import {
  composeProductionRuntime,
} from '../src/compose.js'
import {
  CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
  CHATGPT_SUBSCRIPTION_V1,
  canonicalDefaultGlobalRoute,
  loadAgentModelOverrides,
} from '../src/model-overrides.js'
import { resolveProductionLayout } from '../src/paths.js'

const TARGET = CHATGPT_SUBSCRIPTION_V1.targetAgentId
const OTHER = 'agt_other'
const CANONICAL = Object.freeze({ provider: 'openai-codex', model: 'gpt-5.6-luna' })
const ENV_ROUTE = Object.freeze({ provider: 'zai-explicit', model: 'glm-5.3' })

/** A routeCatalog override that pins TARGET to explicit OpenCode Go. */
const OC_GO_OVERRIDE = {
  version: 3,
  routeCatalog: {
    'oc-go-explicit': {
      routeKind: 'builtin',
      provider: 'opencode-go',
      model: 'deepseek-v4-flash',
      credentialReadiness: 'oc-go-key-home',
    },
  },
  overrides: {
    [TARGET]: { model: { primary: 'oc-go-explicit', fallbacks: [] } },
  },
}

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
FakeProc.nextPid = 8100

function withRouteEnv(t, value) {
  const previousProvider = process.env.DSH_AGENT_PROVIDER
  const previousModel = process.env.DSH_AGENT_MODEL
  if (value === undefined) {
    delete process.env.DSH_AGENT_PROVIDER
    delete process.env.DSH_AGENT_MODEL
  } else {
    process.env.DSH_AGENT_PROVIDER = value.provider
    process.env.DSH_AGENT_MODEL = value.model
  }
  t.after(() => {
    if (previousProvider === undefined) delete process.env.DSH_AGENT_PROVIDER
    else process.env.DSH_AGENT_PROVIDER = previousProvider
    if (previousModel === undefined) delete process.env.DSH_AGENT_MODEL
    else process.env.DSH_AGENT_MODEL = previousModel
  })
}

async function runtimeFixture(t, { globalRoute, overrides } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'default-route-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: TARGET,
    agents: [{ id: TARGET, name: 'CTO' }, { id: OTHER, name: 'Other' }],
  })
  if (overrides !== undefined) writeFileSync(layout.agentModelOverrides, JSON.stringify(overrides), 'utf8')
  const spawned = []
  const provisioned = []
  const lines = []
  const runtime = await composeProductionRuntime({
    layout,
    ...(globalRoute === undefined ? {} : { globalRoute }),
    productApi: { enabled: false },
    notificationIngress: { enabled: false },
    processFactory: (options) => { const proc = new FakeProc(options); spawned.push(proc); return proc },
    provisionHome: (home, workspace, options) => provisioned.push({ home, workspace, options }),
    log: { log: (line) => lines.push(line), warn() {}, error() {} },
  })
  t.after(() => runtime.stop())
  return { runtime, spawned, provisioned, lines }
}

function globalRouteSourceLine(lines) {
  return lines.find((line) => line.startsWith('global model route: '))
}

test('canonicalDefaultGlobalRoute is the complete Luna subscription route', () => {
  const route = canonicalDefaultGlobalRoute()
  assert.deepEqual({ provider: route.provider, model: route.model }, CANONICAL)
  assert.equal(route.subscription.plugin, CHATGPT_SUBSCRIPTION_V1.plugin)
  assert.equal(route.subscription.pluginVersion, CHATGPT_SUBSCRIPTION_V1.pluginVersion)
  assert.equal(route.subscription.credentialFile, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  assert.equal(route.subscription.sourceCommit, CHATGPT_SUBSCRIPTION_V1.sourceCommit)
  assert.equal(route.subscription.artifactSha256, CHATGPT_SUBSCRIPTION_V1.artifactSha256)
  assert.equal(route.subscription.dshVersion, CHATGPT_SUBSCRIPTION_V1.dshVersion)
  assert.equal(route.subscription.dshCommit, CHATGPT_SUBSCRIPTION_V1.dshCommit)
})

test('passthrough carries the built-in subscription; a plain globalRoute keeps the legacy shape', () => {
  const missing = mkdtempSync(join(tmpdir(), 'default-route-unit-'))
  try {
    const overridesFile = join(missing, 'agent-model-overrides.json')
    const loaded = loadAgentModelOverrides(overridesFile, [TARGET, OTHER])

    // Built-in default: the subscription rides identity + processConfig so a
    // zero-config spawn provisions exactly like an explicit Luna route.
    const snapshot = loaded.resolveChain(OTHER, canonicalDefaultGlobalRoute())
    assert.equal(snapshot.override, false)
    assert.equal(snapshot.routes[0].processConfig.subscription.plugin, CHATGPT_SUBSCRIPTION_V1.plugin)
    assert.ok(snapshot.routes[0].identity.includes(JSON.stringify(CHATGPT_SUBSCRIPTION_V1.plugin)))
    assert.equal(loaded.resolve(OTHER, canonicalDefaultGlobalRoute()).subscription.credentialFile, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)

    // Legacy env/opts passthrough (no subscription): byte-equivalent old shape.
    const legacy = loaded.resolveChain(OTHER, { provider: 'oc-go', model: 'deepseek-v4-flash' })
    assert.deepEqual(legacy.routes[0].processConfig, { provider: 'oc-go', model: 'deepseek-v4-flash' })
    assert.deepEqual(loaded.resolve(OTHER, { provider: 'oc-go', model: 'deepseek-v4-flash' }), { provider: 'oc-go', model: 'deepseek-v4-flash' })
  } finally {
    rmSync(missing, { recursive: true, force: true })
  }
})

test('A-D1 zero config: every un-overridden Agent resolves to the Luna default with its subscription mount', async (t) => {
  withRouteEnv(t, undefined)
  const { runtime, spawned, provisioned, lines } = await runtimeFixture(t)
  await runtime.router.ensureRunning(OTHER)
  assert.equal(spawned.length, 1)
  assert.deepEqual({ provider: spawned[0].provider, model: spawned[0].model }, CANONICAL)
  assert.equal(provisioned[0].options.subscription?.plugin, CHATGPT_SUBSCRIPTION_V1.plugin, 'zero-config Luna default provisions the dsh-codex mount')
  assert.match(globalRouteSourceLine(lines) ?? '', /source=builtin_default/)
})

test('A-D2 runtime env override wins over the default; composition config wins over env', async (t) => {
  withRouteEnv(t, ENV_ROUTE)
  const envRun = await runtimeFixture(t)
  await envRun.runtime.router.ensureRunning(OTHER)
  assert.deepEqual({ provider: envRun.spawned[0].provider, model: envRun.spawned[0].model }, ENV_ROUTE)
  assert.equal(envRun.provisioned[0].options.subscription, undefined, 'env route stays a plain builtin passthrough')
  assert.match(globalRouteSourceLine(envRun.lines) ?? '', /source=runtime_env/)
  await envRun.runtime.stop()

  const optsRun = await runtimeFixture(t, { globalRoute: { provider: 'zai', model: 'glm-5.3' } })
  await optsRun.runtime.router.ensureRunning(OTHER)
  assert.deepEqual({ provider: optsRun.spawned[0].provider, model: optsRun.spawned[0].model }, { provider: 'zai', model: 'glm-5.3' })
  assert.match(globalRouteSourceLine(optsRun.lines) ?? '', /source=composition_config/)
})

test('A-D3 explicit OpenCode Go agent override wins; un-overridden Agents keep the Luna default', async (t) => {
  withRouteEnv(t, undefined)
  const { runtime, spawned, provisioned } = await runtimeFixture(t, { overrides: OC_GO_OVERRIDE })
  await runtime.router.ensureRunning(TARGET)
  await runtime.router.ensureRunning(OTHER)
  assert.equal(spawned.length, 2)
  assert.deepEqual(
    { provider: spawned[0].provider, model: spawned[0].model },
    { provider: 'opencode-go', model: 'deepseek-v4-flash' },
    'explicit oc-go agent config stays selectable',
  )
  assert.equal(provisioned[0].options.subscription, undefined, 'oc-go builtin route stays off the plugin path')
  assert.deepEqual({ provider: spawned[1].provider, model: spawned[1].model }, CANONICAL)
  assert.equal(provisioned[1].options.subscription?.plugin, CHATGPT_SUBSCRIPTION_V1.plugin)
})
