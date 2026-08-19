import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { composeProductionRuntime } from '../src/compose.js'
import { CHATGPT_SUBSCRIPTION_V1, loadAgentModelOverrides } from '../src/model-overrides.js'
import { resolveProductionLayout } from '../src/paths.js'

const TARGET = CHATGPT_SUBSCRIPTION_V1.targetAgentId
const OTHER = 'agt_other'
const GLOBAL = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })
const VALID = {
  version: 1,
  overrides: {
    [TARGET]: {
      provider: 'openai-codex',
      model: 'gpt-5.6-luna',
      plugin: 'dsh-codex',
      pluginVersion: '0.2.3',
    },
  },
}

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

class FakeProc {
  constructor(options) {
    Object.assign(this, options)
    this.pid = 7100 + Math.floor(Math.random() * 100)
    this.exit = undefined
    this.exitPromise = new Promise(() => {})
    this.creations = []
  }
  spawn() { return this }
  async ready() { return 1 }
  async shutdown() {}
  async turn() { return { reply: 'ok', ms: 1, promptMs: 1, messageId: 'm' } }
  async deliver() { return { accepted: true, sessionId: 'main', messageId: 'm' } }
}

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
    { provider: spawned[0].provider, model: spawned[0].model, omitEnv: spawned[0].omitEnv },
    { provider: 'openai-codex', model: 'gpt-5.6-luna', omitEnv: ['OPENAI_API_KEY'] },
  )
  assert.equal(spawned[0].subscription, undefined, 'subscription provisioning is not a child-process concern')
  assert.deepEqual(
    { provider: spawned[1].provider, model: spawned[1].model },
    GLOBAL,
  )
  assert.deepEqual(provisioned[0].options.subscription, {
    plugin: 'dsh-codex',
    pluginVersion: '0.2.3',
    dshVersion: '0.1.0-rc.5',
    dshCommit: 'a12bb03c6861969985f066bfbf0cb7e5dd5ac567',
    credentialFile: '.openai-codex-auth.json',
  })
  assert.equal(provisioned[1].options.subscription, undefined)
})

test('restart persistence and mechanical rollback resolve from the startup file only', async (t) => {
  const first = await runtimeFixture(t, true)
  assert.equal(first.spawned.length, 0, 'config load itself does not start or activate the target Agent')
  await first.runtime.stop()

  const loadedAgain = loadAgentModelOverrides(first.layout.agentModelOverrides, [TARGET, OTHER])
  assert.equal(loadedAgain.resolve(TARGET, GLOBAL).model, 'gpt-5.6-luna')
  unlinkSync(first.layout.agentModelOverrides)
  const rolledBack = loadAgentModelOverrides(first.layout.agentModelOverrides, [TARGET, OTHER])
  assert.deepEqual(rolledBack.resolve(TARGET, GLOBAL), GLOBAL)
})
