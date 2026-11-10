import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply as applyRouter } from '../../src/index.js'
import { createCallerWaitResolver, CALLER_WAIT_ENV } from '../../src/process/caller-wait-config.js'
import { DEADLINE_FIELDS, resolveDeadlineConfig } from '../../src/deadline-config.js'
import { monotonicNowMs } from '../../src/process/state-machine.js'

function resolver(config = {}, env = {}, deadlines = resolveDeadlineConfig({}, { overrides: {} })) {
  return createCallerWaitResolver({ config, env, agentIds: ['agt_slow', 'agt_plain'],
    resolveDefaultMs: agentId => deadlines.perAgent(agentId).turnTimeoutMs })
}

test('caller surface/class selection and precedence: env > class > surface > existing default', () => {
  const config = { bySurface: { feishu: 100000, mobile: 120000 },
    byClass: { slow: 600000 }, agentClasses: { agt_slow: 'slow' } }
  const resolve = resolver(config)
  assert.equal(resolve('agt_plain', 'feishu'), 100000)
  assert.equal(resolve('agt_plain', 'mobile'), 120000)
  assert.equal(resolve('agt_plain'), 300000)
  assert.equal(resolve('agt_slow', 'feishu'), 600000)
  assert.equal(resolve('agt_slow', 'mobile'), 600000)
  assert.equal(resolve('agt_slow'), 600000)
  assert.equal(resolver(config, { [CALLER_WAIT_ENV]: '700000' })('agt_slow', 'mobile'), 700000)
  assert.equal(resolver(config, { [CALLER_WAIT_ENV]: '' })('agt_slow'), 600000)
})

test('unconfigured caller retains per-Agent, new env and legacy turn deadline fallback', () => {
  for (const env of [{}, { DSH_AGENT_TURN_TIMEOUT: '900000' },
    { DSH_AGENT_TURN_TIMEOUT: '900000', DSH_AGENT_TURN_TIMEOUT_MS: '500000' }]) {
    const deadlines = resolveDeadlineConfig(env, { overrides: { agt_slow: { turnTimeoutMs: 1200000 } } })
    const resolve = resolver({}, env, deadlines)
    assert.equal(resolve('agt_plain', 'feishu'), Number(env.DSH_AGENT_TURN_TIMEOUT_MS ?? env.DSH_AGENT_TURN_TIMEOUT ?? 300000))
    assert.equal(resolve('agt_slow', 'mobile'), 1200000)
    assert.deepEqual(Object.keys(deadlines.perAgent('agt_slow')), [...DEADLINE_FIELDS])
  }
})

test('caller config is snapshotted; prototype names cannot select inherited budgets', () => {
  const config = { bySurface: { feishu: 100000 }, byClass: { slow: 600000 }, agentClasses: { agt_slow: 'slow' } }
  const env = { [CALLER_WAIT_ENV]: '700000' }
  const resolve = resolver(config)
  const envResolve = resolver(config, env)
  config.bySurface.feishu = 1
  config.byClass.slow = 2
  config.agentClasses.agt_plain = 'slow'
  env[CALLER_WAIT_ENV] = '3'
  assert.equal(resolve('agt_plain', 'feishu'), 100000)
  assert.equal(resolve('agt_slow'), 600000)
  assert.equal(resolve('constructor', 'toString'), 300000)
  assert.equal(envResolve('agt_slow'), 700000)
})

test('caller config validates all selectors and env fail-loud before dispatch', () => {
  for (const config of [null, [], { typo: {} }, { byClass: null }, { bySurface: [] },
    { bySurface: { p2p: 1 } }, { bySurface: { feishu: 0 } }, { byClass: { slow: '1' } },
    { byClass: { slow: -1 } }, { byClass: { slow: 1.5 } }, { byClass: { slow: Number.MAX_SAFE_INTEGER + 1 } },
    { byClass: { '': 1 } }, { agentClasses: { agt_missing: 'slow' } },
    { byClass: { slow: 1 }, agentClasses: { agt_slow: 'missing' } },
    { byClass: { slow: 1 }, agentClasses: { agt_slow: 1 } }]) {
    assert.throws(() => resolver(config), /agent-router:/)
  }
  for (const value of ['0', '-1', '1.5', 'soon', '1ms', 'Infinity', '9007199254740992', ' ', '01']) {
    assert.throws(() => resolver({}, { [CALLER_WAIT_ENV]: value }), /positive safe integer/)
  }
})

const DEADLINE_ENV_KEYS = ['DSH_AGENT_PROCESS_OVERRIDES_FILE', 'DSH_AGENT_INITIALIZE_TIMEOUT_MS',
  'DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS', 'DSH_AGENT_TURN_TIMEOUT_MS', 'DSH_AGENT_SHUTDOWN_GRACE_MS',
  'DSH_AGENT_TURN_TIMEOUT', 'DSH_AGENT_DELIVER_TIMEOUT', CALLER_WAIT_ENV]

async function rig(t, callerWait, env = {}, turnTimeoutMs) {
  const dir = await mkdtemp(join(tmpdir(), 'caller-wait-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const saved = new Map(DEADLINE_ENV_KEYS.map(key => [key, process.env[key]]))
  for (const key of DEADLINE_ENV_KEYS) delete process.env[key]
  Object.assign(process.env, env)
  t.after(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  if (turnTimeoutMs) await writeFile(join(dir, 'agent-process-overrides.json'), JSON.stringify({
    version: 1, overrides: { agt_slow: { turnTimeoutMs } },
  }))
  const disposers = [], calls = [], processes = []
  const definition = {
    listAgents: () => [{ id: 'agt_slow' }, { id: 'agt_plain' }],
    getAgent: id => ({ id }), getDefaultAgent: () => ({ id: 'agt_slow' }),
    resolveAgentRef: id => ({ id }),
  }
  const feishu = { setCallback(fn) { this.callback = fn },
    replyTargetFor: () => ({ replyTo: () => ({}) }), reply: async () => {} }
  const services = new Map([['agentDefinition', definition], ['feishu', feishu], ['workspaceBootstrap', {
    ensure: async () => ({}), resolveWorkspace: id => join(dir, 'ws', id),
    resolveDshHome: id => join(dir, 'home', id),
  }]])
  const ctx = { get: key => services.get(key), provide: (key, value) => services.set(key, value),
    effect: fn => disposers.push(fn()) }
  t.after(async () => { for (const dispose of disposers.reverse()) await dispose?.() })
  const router = applyRouter(ctx, { productionRoot: dir, bindingsStoreFile: join(dir, 'bindings.json'),
    defaultAgentId: 'agt_slow', defaultSessionId: 'main', agentProfile: 'agent-core-production', callerWait, provisionHome() {},
    processFactory(options) {
      const proc = { ...options, pid: 100 + processes.length, turnInFlight: false, turnQueueEntries: [],
        exitPromise: new Promise(resolve => { options.resolveExit = resolve }),
        spawn() { return this }, async ready() {},
        async prepareDelivery(_sessionId, _opts, { deadlineMono }) { this.preparedBudget = deadlineMono - monotonicNowMs() },
        async turn(sessionId, message, opts, callerMs) {
          calls.push({ agentId: options.agentId, sessionId, message, opts, callerMs, preparedBudget: this.preparedBudget })
          return { status: 'completed', reply: 'ok' }
        },
        async shutdown() {
          this.registryIntegration.casReap(this, 'shutdown')
          this.exit = { code: 0, signal: null }
          this.registryIntegration.casEmpty(this)
          options.resolveExit(this.exit)
        },
      }
      processes.push(proc)
      return proc
    },
  })
  return { router, feishu, calls, processes }
}

function ingress(channel = 'p2p', extra = {}) {
  return { channel, chatId: 'oc_test', conversationId: `oc_${channel}`, messageId: 'om_test',
    sender: { openId: 'ou_test' }, raw: { sender: { sender_id: { open_id: 'ou_test' } } },
    text: 'test', ...extra }
}

function budgetIs(call, expected) {
  assert.ok(call.callerMs > expected - 5000 && call.callerMs <= expected, `${call.callerMs} expected <= ${expected}`)
  assert.ok(call.preparedBudget > 0 && call.preparedBudget <= expected)
  assert.ok(call.callerMs <= call.preparedBudget, 'preparation consumes the same budget')
}

test('composed Router selects static class, ignores ingress claims and preserves lifecycle fields', async t => {
  const r = await rig(t, { bySurface: { feishu: 100000 }, byClass: { slow: 600000 }, agentClasses: { agt_slow: 'slow' } })
  const result = await r.feishu.callback(ingress('thread', {
    agentClass: 'plain', surface: 'mobile', callerWait: 1, deadlineMs: 1,
    opts: { agentClass: 'plain', deadlineMs: 1 },
  }))
  assert.equal(result.reply, 'ok')
  budgetIs(r.calls[0], 600000)
  assert.equal(r.processes[0].deadlines.turnTimeoutMs, 300000)
  assert.deepEqual(Object.keys(r.processes[0].deadlines), [...DEADLINE_FIELDS])
})

test('composed Router wires Feishu/mobile surfaces and direct class/env budgets, preserving explicit deadline', async t => {
  const r = await rig(t, { bySurface: { feishu: 100000, mobile: 180000 } })
  assert.equal((await r.feishu.callback(ingress())).reply, 'ok')
  assert.equal((await r.router.route(ingress('mobile'))).reply, 'ok')
  budgetIs(r.calls[0], 100000)
  budgetIs(r.calls[1], 180000)
  await r.router.runTurnWithRouteChain('agt_slow', { sessionId: 'main', message: 'direct' })
  budgetIs(r.calls[2], 300000)
  await r.router.runTurnWithRouteChain('agt_slow', { sessionId: 'main', message: 'scheduler', deadlineMs: 450000 })
  budgetIs(r.calls[3], 450000)
})

test('composed Router new caller env wins over class and surface without changing legacy lifecycle env', async t => {
  const r = await rig(t, { bySurface: { feishu: 100000 }, byClass: { slow: 600000 }, agentClasses: { agt_slow: 'slow' } },
    { [CALLER_WAIT_ENV]: '700000', DSH_AGENT_TURN_TIMEOUT: '900000' })
  await r.feishu.callback(ingress())
  await r.router.runTurnWithRouteChain('agt_slow', { sessionId: 'main', message: 'direct' })
  budgetIs(r.calls[0], 700000)
  budgetIs(r.calls[1], 700000)
  assert.equal(r.processes[0].deadlines.turnTimeoutMs, 900000)
})

test('composed Router unconfigured caller retains per-Agent override over both turn env spellings', async t => {
  const r = await rig(t, undefined, { DSH_AGENT_TURN_TIMEOUT: '900000', DSH_AGENT_TURN_TIMEOUT_MS: '500000' }, 1200000)
  await r.feishu.callback(ingress())
  budgetIs(r.calls[0], 1200000)
  assert.equal(r.processes[0].deadlines.turnTimeoutMs, 1200000)
})
