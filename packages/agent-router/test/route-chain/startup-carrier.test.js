/**
 * Scenario 5 successor coverage: an allowed GLM quota hop reaches the real
 * ProcessRegistry route gate, then a real AgentProcess receives a Luna
 * initialize JSON-RPC error.  The production RPC sanitizer/classifier and
 * route-chain journal must stop after attempt two without cycling.
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentProcess } from '../../src/process.js'
import {
  apply as applyRouter,
  canonicalRouteIdentity,
  ROUTE_HOP_FAILURE_CLASSES,
} from '../../src/index.js'
import { makeFakeChild } from '../helpers/fake-child.js'

const AGENT_ID = 'agt_luna-startup-carrier'
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

const GLM = route('glm53', GLM_CONFIG)
const LUNA = route('luna', LUNA_CONFIG)

function routeSnapshot() {
  return Object.freeze({
    agentId: AGENT_ID,
    override: true,
    chainId: 'scenario-5-production-carrier',
    routes: Object.freeze([GLM, LUNA]),
  })
}

function provenQuotaCarrier() {
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
    },
  })
}

class QuotaProcess {
  constructor(options, counters) {
    Object.assign(this, options)
    this.counters = counters
    this.pid = 6101
    this.exit = undefined
    this.turnInFlight = false
    this.turnQueueEntries = []
    this.ownershipToken = undefined
    this.exitPromise = new Promise((resolve) => { this.resolveExit = resolve })
  }

  spawn() { this.counters.glmSpawns += 1; return this }
  async ready() { return 0 }
  async turn() {
    this.counters.glmProviderAttempts += 1
    throw provenQuotaCarrier()
  }
  async shutdown() {
    this.registryIntegration?.casReap?.(this, 'shutdown')
    this.exit = { code: 0, signal: null }
    this.registryIntegration?.casEmpty?.(this)
    this.resolveExit(this.exit)
    return this.exit
  }
}

class RpcInitializeFailureProcess extends AgentProcess {
  constructor(options, counters) {
    super(options)
    this.testCounters = counters
  }

  spawn() {
    this.counters.spawnAttempts += 1
    this.testCounters.lunaSpawns += 1
    const child = makeFakeChild({ pid: 6102 })
    const write = child.stdin.write.bind(child.stdin)
    child.stdin.write = (line, callback) => {
      const request = JSON.parse(line)
      const accepted = write(line, callback)
      if (request.method === 'initialize') {
        this.testCounters.lunaInitializeRpcRequests += 1
        queueMicrotask(() => child.stdout.handler(`${JSON.stringify({
          id: request.id,
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: 'service unavailable; Authorization: Bearer secret-must-redact',
          },
        })}\n`))
      }
      return accepted
    }
    const kill = child.kill.bind(child)
    child.kill = (signal) => {
      kill(signal)
      queueMicrotask(() => child.handlers.exit?.(null, signal))
    }
    this.fakeChild = child
    return this.attachChild(child)
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

function bootstrap() {
  return {
    ensure: async () => ({}),
    resolveWorkspace: (agentId) => join('/tmp/ws', agentId),
    resolveDshHome: (agentId) => join('/tmp/home', agentId),
  }
}

test('scenario 5: initialize RPC carrier is sanitized, classified, route-gated, and terminal after Luna', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'acr-scenario5-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const counters = {
    glmSpawns: 0,
    glmProviderAttempts: 0,
    lunaSpawns: 0,
    lunaInitializeRpcRequests: 0,
  }
  const logs = []
  const definition = {
    listAgents: () => [{ id: AGENT_ID }],
    getAgent: () => ({ id: AGENT_ID }),
    getDefaultAgent: () => ({ id: AGENT_ID }),
    resolveAgentRef: () => ({ id: AGENT_ID }),
  }
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', bootstrap()],
    ['agentDefinition', definition],
  ]))
  t.after(() => ctx.disposeAll())
  const spawned = []
  const router = applyRouter(ctx, {
    productionRoot: join(dir, 'production-root'),
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultAgentId: AGENT_ID,
    defaultSessionId: 'main',
    agentProfile: 'agent-core-production',
    provisionHome: () => {},
    resolveRouteChain: routeSnapshot,
    processFactory: (options) => {
      const proc = options.provider === 'openai-codex'
        ? new RpcInitializeFailureProcess(options, counters)
        : new QuotaProcess(options, counters)
      spawned.push(proc)
      return proc
    },
  })

  await assert.rejects(
    router.runTurnWithRouteChain(AGENT_ID, {
      sessionId: 'main',
      message: 'local scenario 5',
      opts: {},
      deadlineMs: 5_000,
    }),
    (error) => {
      assert.equal(error.name, 'ProviderError')
      assert.equal(error.code, 'provider_unavailable')
      assert.equal(error.routeChain.totalRouteAttempts, 2)
      assert.equal(error.routeChain.failureClass, ROUTE_HOP_FAILURE_CLASSES.INITIALIZE_PROVIDER_UNAVAILABLE)
      assert.equal(error.message.includes('secret-must-redact'), false)
      logs.push(error.message)
      return true
    },
  )

  const journal = router.routeChainJournalSnapshot()
  const attempts = journal.filter((entry) => entry.kind === 'route_attempt')
  const finals = journal.filter((entry) => entry.kind === 'route_chain_final')
  assert.deepEqual(attempts.map((entry) => entry.route), ['glm53', 'luna'])
  assert.equal(attempts[0].attemptOutcome, `fallback:${ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION}`)
  assert.equal(attempts[1].failureClass, ROUTE_HOP_FAILURE_CLASSES.INITIALIZE_PROVIDER_UNAVAILABLE)
  assert.equal(finals.length, 1)
  assert.equal(finals[0].totalRouteAttempts, 2)
  assert.equal(finals[0].finalRoute, 'NONE')
  assert.equal(finals[0].finalOutcome, ROUTE_HOP_FAILURE_CLASSES.INITIALIZE_PROVIDER_UNAVAILABLE)

  assert.deepEqual(counters, {
    glmSpawns: 1,
    glmProviderAttempts: 1,
    lunaSpawns: 1,
    lunaInitializeRpcRequests: 1,
  })
  assert.equal(spawned.length, 2, 'no third acquire or back-hop generation')
  assert.equal(spawned.filter((proc) => proc.provider === 'zai').length, 1, 'glm53 never reacquired')
  assert.equal(JSON.stringify(journal).includes('secret-must-redact'), false)
  assert.equal(logs.join('\n').includes('secret-must-redact'), false)
})
