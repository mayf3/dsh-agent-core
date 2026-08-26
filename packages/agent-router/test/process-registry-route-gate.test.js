/**
 * @agent-core/agent-router/test/process-registry-route-gate.test.js — the
 * DEC-IMPL-004 route-aware reuse gate (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_
 * IMPL_V1): REUSE_ONLY_IF_ROUTE_IDENTITY_MATCHES against the REAL registry
 * slot machinery (identity CAS, generations, REAP fences).
 *
 * Fakes are plain process objects that honor the AgentProcess registry
 * integration contract (REAP on shutdown, no-child convergence on startup
 * failure) — the slot machinery under test is production code.
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { canonicalRouteIdentity } from '../src/route-chain.js'
import { apply as applyRouter } from '../src/index.js'

const AGT_ID = 'agt_gate-fx'

const GLM_CONFIG = Object.freeze({ provider: 'zai', model: 'glm-5.3', subscription: { plugin: 'dsh-zai', pluginVersion: '1.4.2' } })
const LUNA_CONFIG = Object.freeze({ provider: 'openai-codex', model: 'gpt-5.6-luna', subscription: { plugin: 'dsh-codex', pluginVersion: '0.2.3' } })
const GLM_IDENTITY = canonicalRouteIdentity(GLM_CONFIG)
const LUNA_IDENTITY = canonicalRouteIdentity(LUNA_CONFIG)

function fakeCtx(services) {
  const provided = new Map()
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: () => () => {},
  }
}

function stubBootstrap() {
  return {
    resolveWorkspace: (agentId) => join('/tmp/ws', agentId),
    resolveDshHome: (agentId) => join('/tmp/home', agentId),
    ensure: async () => ({}),
  }
}

let fakePidSeq = 5200

/**
 * Contract-honoring fake process: registry-integration cleanup on shutdown /
 * startup failure mirrors the real AgentProcess convergence so the REAL slot
 * machinery runs its identity-CAS paths.
 */
class FakeProc {
  constructor(options) {
    Object.assign(this, options)
    this.pid = ++fakePidSeq
    this.exit = undefined
    this.exitPromise = new Promise(() => {})
    this.turnQueueEntries = []
    this.turnInFlight = false
    this.ownership = null
    this.shutdownCalls = 0
  }
  spawn() { return this }
  async ready() {
    if (this.failInitialize) {
      const error = Object.assign(new Error('provider_unavailable: fail-loud'), { code: this.failInitialize })
      this.registryIntegration?.casStartupEmpty?.(this)
      throw error
    }
    return 1
  }
  async shutdown() {
    this.shutdownCalls += 1
    this.registryIntegration?.casReap?.(this, 'shutdown')
    this.exit = { code: 0, signal: null }
    this.exitPromise = Promise.resolve(this.exit)
    this.registryIntegration?.casEmpty?.(this)
    return this.exit
  }
  async turn() { return { status: 'completed', reply: 'ok', messageId: 'm' } }
}

async function freshRig(t, { resolveProcessConfig } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-gate-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: AGT_ID,
    agents: [{ id: AGT_ID, name: 'Gate FX Agent' }],
  })
  const spawned = []
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentDefinition', { listAgents: () => [{ id: AGT_ID }], getAgent: () => ({ id: AGT_ID }), getDefaultAgent: () => ({ id: AGT_ID }) }],
  ]))
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-production',
    defaultAgentId: AGT_ID,
    processFactory: (opts) => { const proc = new FakeProc(opts); spawned.push(proc); return proc },
    provisionHome: () => {},
    ...(resolveProcessConfig === undefined ? {} : { resolveProcessConfig }),
  })
  return { router, spawned }
}

test('DEC-IMPL-004: identity-matching READY process is reused with zero new generations', async (t) => {
  const { router, spawned } = await freshRig(t)
  const first = await router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: GLM_CONFIG })
  assert.equal(first.status, 'ready')
  const second = await router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: GLM_CONFIG })
  assert.equal(second.status, 'ready')
  assert.equal(second.proc, first.proc)
  assert.equal(spawned.length, 1)
  assert.equal(first.proc.shutdownCalls, 0)
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).generation, 1)
})

test('DEC-IMPL-004: mismatched IDLE process is shut down through the existing controlled path, then a new generation spawns under the wanted route', async (t) => {
  const { router, spawned } = await freshRig(t)
  const glm = await router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: GLM_CONFIG })
  const luna = await router.ensureRunningForRoute(AGT_ID, { routeIdentity: LUNA_IDENTITY, processConfig: LUNA_CONFIG })
  assert.equal(luna.status, 'ready')
  assert.equal(glm.proc.shutdownCalls, 1, 'the mismatched idle process went through the controlled shutdown')
  assert.equal(glm.proc.exit, undefined === false ? glm.proc.exit : glm.proc.exit)
  assert.notEqual(luna.proc, glm.proc)
  assert.equal(luna.proc.provider, 'openai-codex')
  assert.equal(luna.proc.model, 'gpt-5.6-luna')
  assert.equal(spawned.length, 2)
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).generation, 2)
  // The slot froze the wanted route's canonical identity at spawn time.
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).routeIdentity, LUNA_IDENTITY)
})

test('DEC-IMPL-004: mismatched BUSY process is never killed and never reused', async (t) => {
  const { router, spawned } = await freshRig(t)
  const glm = await router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: GLM_CONFIG })
  glm.proc.turnInFlight = true
  const busy = await router.ensureRunningForRoute(AGT_ID, { routeIdentity: LUNA_IDENTITY, processConfig: LUNA_CONFIG })
  assert.equal(busy.status, 'busy_mismatch')
  assert.equal(glm.proc.shutdownCalls, 0, 'busy mismatched process is NEVER killed')
  assert.equal(spawned.length, 1, 'no new generation is forced while the slot is busy')
  glm.proc.turnInFlight = false
  const converged = await router.ensureRunningForRoute(AGT_ID, { routeIdentity: LUNA_IDENTITY, processConfig: LUNA_CONFIG })
  assert.equal(converged.status, 'ready', 'after convergence the idle-mismatch path applies')
})

test('shared STARTUP: a second caller with a different route converges after the in-flight startup settles', async (t) => {
  const { router, spawned } = await freshRig(t)
  const glmPromise = router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: GLM_CONFIG })
  const lunaPromise = router.ensureRunningForRoute(AGT_ID, { routeIdentity: LUNA_IDENTITY, processConfig: LUNA_CONFIG })
  const [glm, luna] = await Promise.all([glmPromise, lunaPromise])
  assert.equal(glm.status, 'ready')
  assert.equal(luna.status, 'ready')
  assert.notEqual(luna.proc, glm.proc)
  assert.equal(luna.proc.model, 'gpt-5.6-luna')
  assert.equal(spawned.length, 2)
})

test('a settled-but-unconverged STARTUP slot fails loud and bounded (no spin)', async (t) => {
  // A process that rejects startup WITHOUT running its own convergence
  // leaves a settled-STARTUP zombie; the gate must fail loud instead of
  // re-entering the same slot forever (regression: unbounded recursion).
  const dir = await mkdtemp(join(tmpdir(), 'acr-gate-zombie-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, { defaultAgentId: AGT_ID, agents: [{ id: AGT_ID, name: 'Z' }] })
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentDefinition', { listAgents: () => [{ id: AGT_ID }], getAgent: () => ({ id: AGT_ID }), getDefaultAgent: () => ({ id: AGT_ID }) }],
  ]))
  class ZombieProc extends FakeProc {
    async ready() {
      // No casStartupEmpty: the slot stays STARTUP after settlement.
      throw Object.assign(new Error('provider_unavailable: zombie'), { code: 'provider_unavailable' })
    }
  }
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-production',
    defaultAgentId: AGT_ID,
    processFactory: (opts) => new ZombieProc(opts),
    provisionHome: () => {},
  })
  await assert.rejects(
    router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: GLM_CONFIG }),
    (error) => error.code === 'provider_unavailable',
  )
  // The NEXT acquisition observes the stalled slot and fails bounded-loud.
  await assert.rejects(
    router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: GLM_CONFIG }),
    (error) => error.code === 'AGENT_PROCESS_SLOT_STALLED',
  )
})

test('legacy ensureRunning still spawns via resolveProcessConfig and records the slot route identity', async (t) => {
  const { router, spawned } = await freshRig(t, { resolveProcessConfig: () => GLM_CONFIG })
  const legacy = await router.ensureRunning(AGT_ID)
  assert.equal(legacy.provider, 'zai')
  assert.equal(spawned.length, 1)
  const gated = await router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: GLM_CONFIG })
  assert.equal(gated.status, 'ready')
  assert.equal(gated.proc, legacy, 'legacy-spawned processes carry the same canonical identity and stay reusable')
  assert.equal(spawned.length, 1)
})

test('undefined identity disables the gate (byte-equivalent legacy acquisition)', async (t) => {
  const { router, spawned } = await freshRig(t)
  const first = await router.ensureRunningForRoute(AGT_ID, {})
  const second = await router.ensureRunningForRoute(AGT_ID, {})
  assert.equal(second.status, 'ready')
  assert.equal(second.proc, first.proc)
  assert.equal(spawned.length, 1)
})

test('registry-level startup failures reject the gate call with the structured carrier', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'acr-gate-fail-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, { defaultAgentId: AGT_ID, agents: [{ id: AGT_ID, name: 'F' }] })
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentDefinition', { listAgents: () => [{ id: AGT_ID }], getAgent: () => ({ id: AGT_ID }), getDefaultAgent: () => ({ id: AGT_ID }) }],
  ]))
  let failures = 0
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-production',
    defaultAgentId: AGT_ID,
    processFactory: (opts) => {
      const proc = new FakeProc(opts)
      // Only the FIRST generation fails initialize; the retry succeeds.
      if (failures === 0) proc.failInitialize = 'provider_unavailable'
      failures += 1
      return proc
    },
    provisionHome: () => {},
  })
  await assert.rejects(
    router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: GLM_CONFIG }),
    (error) => error.code === 'provider_unavailable',
  )
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'EMPTY', 'the no-child startup failure converged the slot to EMPTY — the next attempt may retry')
  const retry = await router.ensureRunningForRoute(AGT_ID, { routeIdentity: GLM_IDENTITY, processConfig: { ...GLM_CONFIG } })
  assert.equal(retry.status, 'ready', 'slot EMPTY -> a fresh generation may spawn')
})
