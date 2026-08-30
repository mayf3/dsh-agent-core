/**
 * Scenario 7 successor coverage: drive the production onIngress path through
 * binding resolution, ProcessRegistry, the unified route chain, and the real
 * ingress-delivery external reply point. Providers and the delivery sink are
 * deterministic local fakes; no network, OAuth, model, or business system is
 * contacted.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  apply as applyRouter,
  canonicalRouteIdentity,
  ROUTE_STOP_REASONS,
} from '../../src/index.js'

const ISOLATION_MARKER = 'ingress-fallback'
const ISOLATED_CHILD = process.env.DSH_LUNA_ROUTER_TEST_CHILD === ISOLATION_MARKER
const isolatedTest = ISOLATED_CHILD ? test : () => {}
const DEADLINE_ENV_KEYS = [
  'DSH_AGENT_PROCESS_OVERRIDES_FILE', 'PRODUCTION_RUNTIME_ROOT',
  'DSH_AGENT_INITIALIZE_TIMEOUT_MS', 'DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS',
  'DSH_AGENT_TURN_TIMEOUT_MS', 'DSH_AGENT_SHUTDOWN_GRACE_MS',
  'DSH_AGENT_TURN_TIMEOUT', 'DSH_AGENT_DELIVER_TIMEOUT',
]

if (!ISOLATED_CHILD) {
  test('scenario 7 runs in a clean child-process environment', () => {
    const env = { ...process.env, DSH_LUNA_ROUTER_TEST_CHILD: ISOLATION_MARKER }
    for (const key of DEADLINE_ENV_KEYS) delete env[key]
    const child = spawnSync(process.execPath, ['--test', fileURLToPath(import.meta.url)], {
      env,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    })
    assert.equal(child.error, undefined)
    assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`)
  })
}

const AGENT_ID = 'agt_luna-ingress-carrier'
const GLM_CONFIG = Object.freeze({ provider: 'zai', model: 'glm-5.3' })
const LUNA_CONFIG = Object.freeze({
  provider: 'openai-codex',
  model: 'gpt-5.6-luna',
  subscription: Object.freeze({ plugin: 'dsh-codex', pluginVersion: '0.2.3' }),
})

function route(routeRef, processConfig) {
  return Object.freeze({
    routeRef,
    provider: processConfig.provider,
    model: processConfig.model,
    identity: canonicalRouteIdentity(processConfig),
    processConfig,
  })
}

const ROUTES = Object.freeze([route('glm53', GLM_CONFIG), route('luna', LUNA_CONFIG)])

function snapshot() {
  return Object.freeze({
    agentId: AGENT_ID,
    override: true,
    chainId: 'scenario-7-real-ingress',
    routes: ROUTES,
  })
}

function quotaCarrier(evidence = {}) {
  return Object.assign(new Error('controlled terminal quota rejection'), {
    envelope: 'failed',
    status: 'failed',
    code: 'account_quota_exhausted',
    evidence: {
      promptReceipt: 'accepted',
      terminationProven: true,
      outputTokens: 0,
      partialOutput: false,
      assistantContent: false,
      toolCall: false,
      toolStarted: false,
      externalSideEffect: false,
      outcomeUnknown: false,
      transportTimeout: false,
      ...evidence,
    },
  })
}

function localLifecycleRecorder() {
  const counters = {
    glmProviderAttempts: 0,
    lunaProviderAttempts: 0,
    failedGlmToolStarts: 0,
    failedGlmToolResults: 0,
    failedGlmExternalDeliveries: 0,
    lunaToolStarts: 0,
    lunaToolResults: 0,
    finalLogicalResults: 0,
    externalBusinessDeliveries: 0,
    ingressFinalizations: 0,
  }
  return {
    counters,
    providerAttempt(routeRef) { counters[routeRef === 'glm53' ? 'glmProviderAttempts' : 'lunaProviderAttempts'] += 1 },
    toolStart(routeRef) { counters[routeRef === 'glm53' ? 'failedGlmToolStarts' : 'lunaToolStarts'] += 1 },
    toolResult(routeRef) { counters[routeRef === 'glm53' ? 'failedGlmToolResults' : 'lunaToolResults'] += 1 },
    logicalResult() { counters.finalLogicalResults += 1 },
    ingressFinalized() { counters.ingressFinalizations += 1 },
    externalDelivery(text) {
      counters.externalBusinessDeliveries += 1
      if (text === 'glm-result-must-not-deliver') counters.failedGlmExternalDeliveries += 1
    },
  }
}

class LocalProviderProcess {
  constructor(options, lifecycle, glmFailure) {
    Object.assign(this, options)
    this.lifecycle = lifecycle
    this.glmFailure = glmFailure
    this.pid = options.provider === 'zai' ? 7101 : 7102
    this.exit = undefined
    this.turnInFlight = false
    this.turnQueueEntries = []
    this.ownershipToken = undefined
    this.exitPromise = new Promise((resolve) => { this.resolveExit = resolve })
  }

  spawn() { return this }
  async ready() { return 0 }
  async turn() {
    const routeRef = this.provider === 'zai' ? 'glm53' : 'luna'
    this.lifecycle.providerAttempt(routeRef)
    if (routeRef === 'glm53') throw this.glmFailure()
    this.lifecycle.toolStart(routeRef)
    this.lifecycle.toolResult(routeRef)
    this.lifecycle.logicalResult()
    return { status: 'completed', reply: 'luna-only-result', messageId: 'luna-message-1' }
  }
  async shutdown() {
    this.registryIntegration?.casReap?.(this, 'shutdown')
    this.exit = { code: 0, signal: null }
    this.registryIntegration?.casEmpty?.(this)
    this.resolveExit(this.exit)
    return this.exit
  }
}

function fakeCtx(services) {
  const provided = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (register) => {
      const dispose = register()
      disposers.push(dispose)
      return dispose
    },
    async disposeAll() {
      for (const dispose of disposers.reverse()) await dispose?.()
    },
  }
}

function fakeFeishu(lifecycle) {
  const replies = []
  return {
    replies,
    setCallback(callback) {
      this.callback = async (...args) => {
        try { return await callback(...args) } finally { lifecycle.ingressFinalized() }
      }
    },
    replyTargetFor: (ingress) => ({
      replyTo: (messageId) => ({ conversationId: ingress.conversationId, messageId }),
    }),
    async reply(target, text) {
      lifecycle.externalDelivery(text)
      replies.push({ target, text })
    },
  }
}

function ingress(caseId = 'safe') {
  return {
    channel: 'p2p',
    chatId: `oc_${caseId}`,
    conversationId: `oc_${caseId}`,
    messageId: `om_${caseId}`,
    sender: { openId: 'ou_local-fixture' },
    text: `local ingress ${caseId}`,
  }
}

async function freshRig(t, glmFailure) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-scenario7-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const lifecycle = localLifecycleRecorder()
  const feishu = fakeFeishu(lifecycle)
  const workspaceBootstrap = {
    ensure: async () => ({}),
    resolveWorkspace: (agentId) => join('/tmp/ws', agentId),
    resolveDshHome: (agentId) => join('/tmp/home', agentId),
  }
  const definition = {
    listAgents: () => [{ id: AGENT_ID }],
    getAgent: () => ({ id: AGENT_ID }),
    getDefaultAgent: () => ({ id: AGENT_ID }),
    resolveAgentRef: () => ({ id: AGENT_ID }),
  }
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', workspaceBootstrap],
    ['agentDefinition', definition],
    ['feishu', feishu],
  ]))
  t.after(() => ctx.disposeAll())
  const processes = []
  const router = applyRouter(ctx, {
    productionRoot: join(dir, 'production-root'),
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultAgentId: AGENT_ID,
    defaultSessionId: 'main',
    agentProfile: 'agent-core-production',
    provisionHome: () => {},
    resolveRouteChain: snapshot,
    processFactory: (options) => {
      const proc = new LocalProviderProcess(options, lifecycle, glmFailure)
      processes.push(proc)
      return proc
    },
  })
  return { router, feishu, counters: lifecycle.counters, processes }
}

isolatedTest('scenario 7: real onIngress path emits one Luna result and one external business delivery', async (t) => {
  const rig = await freshRig(t, () => quotaCarrier())
  const result = await rig.feishu.callback(ingress())

  const journal = rig.router.routeChainJournalSnapshot()
  const attempts = journal.filter((entry) => entry.kind === 'route_attempt')
  const finals = journal.filter((entry) => entry.kind === 'route_chain_final')

  assert.equal(result.error, undefined)
  assert.equal(result.reply, 'luna-only-result')
  assert.deepEqual(attempts.map((entry) => entry.route), ['glm53', 'luna'])
  assert.equal(finals.length, 1)
  assert.equal(finals[0].finalRoute, 'luna')
  assert.equal(finals[0].finalOutcome, 'SUCCESS')
  assert.equal(finals[0].totalRouteAttempts, 2)
  assert.equal(finals[0].fallbackActivated, true)

  assert.deepEqual(rig.counters, {
    glmProviderAttempts: 1,
    lunaProviderAttempts: 1,
    failedGlmToolStarts: 0,
    failedGlmToolResults: 0,
    failedGlmExternalDeliveries: 0,
    lunaToolStarts: 1,
    lunaToolResults: 1,
    finalLogicalResults: 1,
    externalBusinessDeliveries: 1,
    ingressFinalizations: 1,
  })
  assert.equal(rig.processes.length, 2, 'one process generation per route; no retry')
  assert.equal(rig.feishu.replies.length, 1, 'no bypass or double delivery')
  assert.equal(rig.feishu.replies[0].text, 'luna-only-result')
  assert.equal(rig.router.bindingsSnapshot().length, 1, 'one ingress binding finalization path')
})

isolatedTest('scenario 7 negative carriers: unsafe, partial, incomplete, and outcome-unknown all STOP before Luna', async (t) => {
  const cases = [
    ['unsafe-tool-started', () => quotaCarrier({ toolStarted: true }), `stop:${ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE}`],
    ['partial-output', () => quotaCarrier({ partialOutput: true }), `stop:${ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE}`],
    ['incomplete-evidence', () => quotaCarrier({ terminationProven: false }), `stop:${ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS}`],
    ['outcome-unknown', () => Object.assign(new Error('unknown'), {
      envelope: 'outcome_unknown',
      status: 'outcome_unknown',
      code: 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN',
      evidence: { promptReceipt: 'accepted' },
    }), `stop:${ROUTE_STOP_REASONS.OUTCOME_UNKNOWN}`],
  ]

  for (const [name, carrier, expectedFinal] of cases) {
    await t.test(name, async (st) => {
      const rig = await freshRig(st, carrier)
      const result = await rig.feishu.callback(ingress(name))
      const journal = rig.router.routeChainJournalSnapshot()
      const attempts = journal.filter((entry) => entry.kind === 'route_attempt')
      const finals = journal.filter((entry) => entry.kind === 'route_chain_final')

      assert.ok(result.error instanceof Error)
      assert.equal(attempts.length, 1)
      assert.equal(attempts[0].route, 'glm53')
      assert.equal(finals.length, 1)
      assert.equal(finals[0].finalRoute, 'NONE')
      assert.equal(finals[0].finalOutcome, expectedFinal)
      assert.equal(finals[0].totalRouteAttempts, 1)
      assert.equal(rig.counters.glmProviderAttempts, 1)
      assert.equal(rig.counters.lunaProviderAttempts, 0)
      assert.equal(rig.counters.lunaToolStarts, 0)
      assert.equal(rig.counters.lunaToolResults, 0)
      assert.equal(rig.processes.length, 1, 'STOP does not acquire Luna')
      assert.equal(rig.feishu.replies.length, 1, 'one failure receipt, never success plus failure')
      assert.equal(rig.counters.externalBusinessDeliveries, 1)
      assert.equal(rig.counters.ingressFinalizations, 1)
    })
  }
})
