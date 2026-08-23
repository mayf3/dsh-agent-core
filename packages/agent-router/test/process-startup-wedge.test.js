/**
 * Review F-1 + F-2 regression suite for PR #42
 * (AGENT_PROCESS_LIFECYCLE_HARDENING_V2 implementation).
 *
 * F-1 — pre-spawn STARTUP wedge: every synchronous preparation step between
 * CAS(EMPTY -> STARTUP) and the child existing (resolveWorkspace /
 * resolveDshHome / resolveProcessConfig / provisionHome / processFactory /
 * spawn-throw) must converge through the C-008 no-child failure discipline:
 * bounded redacted evidence, exactly-once shared-startup rejection, full
 * identity-CAS cleanup to EMPTY (never REAP for a child that never existed,
 * never a shutdown write, never a kill), retryability, and stale
 * first-generation isolation.
 *
 * Note on the zero-width window: from installStartupSlot through the
 * synchronous preparation steps there is NO await — JS single-threading makes
 * it impossible for another caller to observe the failing STARTUP entry and
 * park on its resultPromise. The "shared waiter" guarantee is therefore
 * asserted behaviorally: every concurrent caller settles in bounded time
 * (none hangs on a wedged slot), the discipline is idempotent (re-invocation
 * cannot double-settle or touch a newer generation), and the slot never
 * remains STARTUP after the failure — which is exactly the wedged state the
 * audit found (a stuck STARTUP parks every future caller forever).
 *
 * F-2 — unknown Agent override: agent-process-overrides.json keys must be a
 * subset of the registered AgentDefinition ids, validated fail-loud at the
 * router apply boundary (before any spawn), structured and secret-free;
 * known-agent overrides and empty overrides keep working.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { AgentProcess } from '../src/process.js'
import { makeFakeChild } from './helpers/fake-child.js'
import { apply as applyRouter } from '../src/index.js'

const AGT_ID = 'agt_startup-fx'

/** Global fake-pid sequence — every generation gets a distinct pid. */
let fakePidSeq = 5200

/** REAL AgentProcess with a fake OS child attached through spawn(). */
class FakeChildAgentProcess extends AgentProcess {
  spawn() {
    this.counters.spawnAttempts += 1
    fakePidSeq += 1
    this.fakeChild = makeFakeChild({ pid: fakePidSeq })
    return this.attachChild(this.fakeChild)
  }
}

function fakeCtx(services) {
  const provided = new Map()
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => { const dispose = fn(); return () => dispose?.() },
  }
}

function stubBootstrap(overrides = {}) {
  return {
    resolveWorkspace: (agentId) => join('/tmp/ws', agentId),
    resolveDshHome: (agentId) => join('/tmp/home', agentId),
    ensure: async () => ({ workspace: '/tmp/ws', dshHome: '/tmp/home' }),
    ...overrides,
  }
}

/**
 * Rig with injectable failure surfaces. `inject(rig)` arms a ONE-SHOT
 * synchronous throw at one pre-spawn preparation step of the FIRST
 * generation; every later generation runs the healthy path.
 */
async function freshRig(t, { overridesFileContent } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-wedge-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: AGT_ID,
    agents: [{ id: AGT_ID, name: 'Startup FX Agent' }],
  })
  const definition = new AgentDefinition({ configFile })
  const spawned = []
  const bootstrap = stubBootstrap()
  const routerConfig = {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-production',
    defaultAgentId: AGT_ID,
    provisionHome: () => {},
    processFactory: (opts) => {
      const proc = new FakeChildAgentProcess(opts)
      spawned.push(proc)
      return proc
    },
  }
  const rig = {
    dir,
    spawned,
    bootstrap,
    routerConfig,
    overridesFile: join(dir, 'agent-process-overrides.json'),
    build() {
      // resolveDeadlineConfig reads process.env at apply time; set the
      // rig's override file only for the synchronous apply call, then
      // restore — no cross-test pollution.
      const previousFile = process.env.DSH_AGENT_PROCESS_OVERRIDES_FILE
      if (overridesFileContent !== undefined) process.env.DSH_AGENT_PROCESS_OVERRIDES_FILE = this.overridesFile
      try {
        return applyRouter(fakeCtx(new Map([
          ['workspaceBootstrap', bootstrap],
          ['agentDefinition', {
            listAgents: () => definition.listAgents(),
            getAgent: (id) => definition.getAgent(id),
            getDefaultAgent: () => definition.getDefaultAgent(),
            resolveAgentRef: (ref) => definition.resolveAgentRef(ref),
          }],
        ])), routerConfig)
      } finally {
        if (previousFile === undefined) delete process.env.DSH_AGENT_PROCESS_OVERRIDES_FILE
        else process.env.DSH_AGENT_PROCESS_OVERRIDES_FILE = previousFile
      }
    },
  }
  if (overridesFileContent !== undefined) {
    await writeFile(rig.overridesFile, overridesFileContent)
  }
  return rig
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

/** Bounded-settlement guard: rejects if any (never-rejecting) wrapped
 *  caller promise stays pending past ms; resolves with their values. */
async function boundedAll(promises, ms = 5000) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`wedged: callers still pending after ${ms}ms`)), ms)
    timer.unref?.()
    Promise.all(promises).then((values) => {
      clearTimeout(timer)
      resolve(values)
    })
  })
}

/** The wedged state the audit found: a STARTUP slot whose shared promise
 *  already settled (failed) — parking every future caller forever. */
function assertNotWedgedStartup(router, agentId) {
  const snapshot = router.lifecycleSlotSnapshot(agentId)
  assert.ok(!(snapshot.state === 'STARTUP' && snapshot.startupSettled === true),
    `wedged STARTUP survived: ${JSON.stringify(snapshot)}`)
}

async function answerInitialize(proc) {
  const child = proc.fakeChild
  const write = [...child.writes].reverse().find(candidate => candidate.method === 'initialize')
  assert.ok(write !== undefined, 'initialize request written')
  child.stdout.handler(`${JSON.stringify({ id: write.id, result: { registeredProviders: [proc.provider] } })}\n`)
}

/**
 * The five audit-listed synchronous surfaces + the spawn-throw backstop.
 * Every injection is armed BEFORE rig.build() (the router captures
 * provisionHome / processFactory / resolveProcessConfig at apply time) and
 * stays armed until disarm() — so a whole concurrent wave fails bounded;
 * disarming lets the retry wave reach READY.
 */
const F1_SURFACES = [
  ['resolveWorkspace', (rig) => {
    const state = { armed: true }
    const original = rig.bootstrap.resolveWorkspace
    rig.bootstrap.resolveWorkspace = (agentId) => {
      if (state.armed) throw new Error('EACCES: workspace root not accessible')
      return original(agentId)
    }
    return () => { state.armed = false }
  }],
  ['resolveDshHome', (rig) => {
    const state = { armed: true }
    const original = rig.bootstrap.resolveDshHome
    rig.bootstrap.resolveDshHome = (agentId) => {
      if (state.armed) throw new Error('EACCES: dsh home not accessible')
      return original(agentId)
    }
    return () => { state.armed = false }
  }],
  ['resolveProcessConfig', (rig) => {
    const state = { armed: true }
    const original = rig.routerConfig.resolveProcessConfig
    rig.routerConfig.resolveProcessConfig = (agentId) => {
      if (state.armed) throw new Error('model override config invalid')
      return original?.(agentId)
    }
    return () => { state.armed = false }
  }],
  ['provisionHome', (rig) => {
    const state = { armed: true }
    const original = rig.routerConfig.provisionHome
    rig.routerConfig.provisionHome = (home, workspace, opts) => {
      if (state.armed) throw new Error('EACCES: provisioning write failed')
      return original?.(home, workspace, opts)
    }
    return () => { state.armed = false }
  }],
  ['processFactory', (rig) => {
    const state = { armed: true }
    const original = rig.routerConfig.processFactory
    rig.routerConfig.processFactory = (opts) => {
      if (state.armed) throw new Error('process factory exploded')
      return original(opts)
    }
    return () => { state.armed = false }
  }],
  ['spawn (sync throw after processRef exists)', (rig) => {
    const state = { armed: true }
    const original = rig.routerConfig.processFactory
    rig.routerConfig.processFactory = (opts) => {
      const proc = new FakeChildAgentProcess(opts)
      if (state.armed) {
        if (rig.firstGenerationIntegration === undefined) rig.firstGenerationIntegration = opts.registryIntegration
        const originalSpawn = proc.spawn.bind(proc)
        proc.spawn = () => {
          if (!state.armed) return originalSpawn()
          proc.counters.spawnAttempts += 1
          proc.handleSpawnFailureWithoutChild(new Error('spawn: ENOENT no child'))
          throw new Error('spawn: ENOENT no child')
        }
      }
      rig.spawned.push(proc)
      return proc
    }
    return () => { state.armed = false }
  }],
]

for (const [surface, arm] of F1_SURFACES) {
  test(`F1 ${surface}: bounded reject + identity-CAS EMPTY + retry reaches READY + stale isolation`, async (t) => {
    const rig = await freshRig(t)
    const disarm = arm(rig)
    const router = rig.build()

    // 6 concurrent callers — with the surface armed, EVERY attempt fails
    // through the no-child discipline; all of them must settle bounded.
    const callers = []
    for (let index = 0; index < 6; index += 1) {
      callers.push(router.ensureRunning(AGT_ID).then(proc => ({ ok: proc }), error => ({ error })))
    }
    const settled = await boundedAll(callers)
    assert.equal(settled.length, 6, 'SHARED_WAITERS_REJECTED = YES (every caller settles bounded)')
    const failed = settled.filter(entry => entry.error !== undefined)
    assert.equal(failed.length, 6, 'FIRST_CALLER_REJECTED = YES (all armed attempts rejected)')
    for (const { error } of failed) {
      assert.match(error.message, /EACCES|invalid|exploded|ENOENT/)
      assert.ok(Number.isInteger(error.processGeneration) && error.processGeneration >= 1, 'structured generation provenance')
      assert.equal(typeof error.startupFailureStage, 'string')
    }

    // SLOT_AFTER_FAILURE = EMPTY (identity CAS, not unconditional delete).
    assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'EMPTY', 'SLOT_AFTER_FAILURE = EMPTY')
    assertNotWedgedStartup(router, AGT_ID)

    // STARTUP_PROMISE_SETTLED = YES: the discipline ran for every failed
    // generation and left bounded, redacted evidence.
    const audit = router.staleSlotAuditsSnapshot()
    assert.ok(audit.some(entry => entry.detail.includes('pre-spawn startup failure (no child)') && entry.detail.includes('generation 1')),
      'bounded redacted evidence recorded')
    assert.ok(audit.every(entry => !/sk-[A-Za-z0-9_-]{8,}/.test(entry.detail)), 'evidence carries no secret shapes')

    // PROCESS_REF_CREATED = NO for the failed generations; KILL_SENT = 0;
    // SHUTDOWN_WRITE = 0 (no graceful write was ever attempted).
    for (const proc of rig.spawned) {
      if (proc.spawnedHealthy === true) continue
      assert.ok(proc.ownership === null || proc.ownership === undefined, 'no child was created for the failed generations')
      assert.equal(proc.counters?.killSignals ?? 0, 0)
      assert.equal(proc.counters?.gracefulShutdownWriteAttempts ?? 0, 0)
    }

    // NEXT_ENSURE_RUNNING_CAN_RETRY = YES: after disarming, a fresh
    // ensureRunning does not hang and the NEXT generation reaches READY.
    disarm()
    const retry = router.ensureRunning(AGT_ID)
    await tick()
    assertNotWedgedStartup(router, AGT_ID)
    const nextProc = rig.spawned.at(-1)
    assert.ok(nextProc !== undefined, 'NEXT_GENERATION_SPAWNED = YES')
    await answerInitialize(nextProc)
    const proc2 = await retry
    assert.ok(proc2.processGeneration >= 2, 'SECOND_GENERATION_REACHES_READY = YES')
    assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
    assert.equal(router.lifecycleSlotSnapshot(AGT_ID).generation, proc2.processGeneration)
    assert.equal(router.registrySnapshot().length, 1)

    // STALE_FIRST_GENERATION_CALLBACK_CANNOT_REAP_SECOND = YES: replay the
    // first generation's cleanup callbacks against the now-READY slot.
    if (rig.firstGenerationIntegration !== undefined) {
      const before = router.lifecycleSlotSnapshot(AGT_ID)
      const stale = rig.spawned.find(proc => proc.processGeneration === 1)
      rig.firstGenerationIntegration.casStartupEmpty(stale)
      rig.firstGenerationIntegration.casEmpty(stale)
      await tick()
      assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), before, 'stale gen-1 callbacks leave the READY generation untouched')
      assert.equal(router.registrySnapshot()[0].pid, proc2.pid)
    }
  })
}

test('F1 audit-probe regression: pre-spawn provisioning throw -> bounded reject -> EMPTY -> second ensureRunning does not hang', async (t) => {
  const rig = await freshRig(t)
  const state = { armed: true }
  const original = rig.routerConfig.provisionHome
  // Arm BEFORE build: the router captures provisionHome at apply time.
  rig.routerConfig.provisionHome = (home, workspace, opts) => {
    if (state.armed) throw new Error('EACCES: provisioning write failed')
    return original?.(home, workspace, opts)
  }
  const router = rig.build()

  // The audit probe: a single caller sees the failure bounded...
  const started = Date.now()
  await assert.rejects(() => router.ensureRunning(AGT_ID), /EACCES: provisioning write failed/)
  assert.ok(Date.now() - started < 5000, 'bounded rejection, no hang')

  // ...the slot is EMPTY (the exact wedged state the audit found is gone)...
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' })

  // ...and the second ensureRunning (surface disarmed) completes to READY.
  state.armed = false
  const second = router.ensureRunning(AGT_ID)
  await tick()
  assertNotWedgedStartup(router, AGT_ID)
  await answerInitialize(rig.spawned.at(-1))
  const proc2 = await second
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
  assert.equal(proc2.processGeneration, 2)
})

test('F1 discipline is idempotent: repeated re-invocation cannot double-settle or empty a newer generation', async (t) => {
  const rig = await freshRig(t)
  const state = { armed: true }
  const original = rig.routerConfig.processFactory
  let integration = null
  // Arm BEFORE build (the router captures processFactory at apply time).
  rig.routerConfig.processFactory = (opts) => {
    if (state.armed) {
      integration = opts.registryIntegration
      throw new Error('process factory exploded')
    }
    const proc = new FakeChildAgentProcess(opts)
    rig.spawned.push(proc)
    return proc
  }
  const router = rig.build()

  await assert.rejects(() => router.ensureRunning(AGT_ID), /process factory exploded/)
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' })
  // A duplicate late arrival of the same failed generation's cleanup is a
  // no-op against EMPTY (audit-only, exactly-once semantics hold).
  integration?.casStartupEmpty({ processGeneration: 1, ownership: null })
  assert.deepEqual(router.lifecycleSlotSnapshot(AGT_ID), { state: 'EMPTY' })

  state.armed = false
  const second = router.ensureRunning(AGT_ID)
  await tick()
  await answerInitialize(rig.spawned.at(-1))
  const proc2 = await second
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
  // Late stale cleanup while the new generation is READY: audit-only.
  integration?.casStartupEmpty({ processGeneration: 1, ownership: null })
  integration?.casEmpty({ processGeneration: 1, ownershipToken: null })
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
  assert.equal(router.registrySnapshot()[0].pid, proc2.pid)
})

// ---------------------------------------------------------------------------
// F-2 — unknown Agent override fail-loud at the apply boundary
// ---------------------------------------------------------------------------

test('F2 UNKNOWN_AGENT_OVERRIDE = FAIL_LOUD before any process spawn, structured and secret-free', async (t) => {
  const rig = await freshRig(t, {
    overridesFileContent: JSON.stringify({
      version: 1,
      overrides: {
        [AGT_ID]: { turnTimeoutMs: 123000 },
        agt_ghost_agent: { turnTimeoutMs: 99000 },
      },
    }),
  })
  let thrown = null
  try {
    rig.build()
  } catch (error) {
    thrown = error
  }
  assert.ok(thrown !== null, 'apply fails loud on an unknown override agent id')
  assert.equal(thrown.code, 'AGENT_PROCESS_OVERRIDE_AGENT_UNKNOWN')
  assert.match(thrown.message, /agt_ghost_agent/)
  assert.ok(thrown.message.includes('registered:'), 'the message names the registered set for diagnosis')
  assert.ok(!/sk-[A-Za-z0-9_-]{8,}/.test(thrown.message), 'no secret shapes in the config error')
  assert.equal(thrown.unknownAgentIds.join(), 'agt_ghost_agent')
  // NO_PROCESS_SPAWN = YES: apply itself threw — nothing was ever spawned.
  assert.equal(rig.spawned.length, 0)
})

test('F2 KNOWN_AGENT_OVERRIDE = PASS: a registered agent override applies end-to-end', async (t) => {
  const rig = await freshRig(t, {
    overridesFileContent: JSON.stringify({
      version: 1,
      overrides: { [AGT_ID]: { turnTimeoutMs: 777000, shutdownGraceMs: 4500 } },
    }),
  })
  const router = rig.build()
  const ready = router.ensureRunning(AGT_ID)
  await tick()
  await answerInitialize(rig.spawned.at(-1))
  const proc = await ready
  assert.equal(proc.deadlines.turnTimeoutMs, 777000, 'the per-Agent override reached the process')
  assert.equal(proc.deadlines.shutdownGraceMs, 4500)
  assert.equal(proc.deadlines.initializeTimeoutMs, 90000, 'unset fields keep the global default')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
})

test('F2 EMPTY_OVERRIDES = PASS: no override file behaves exactly as before', async (t) => {
  const rig = await freshRig(t)
  const router = rig.build()
  const ready = router.ensureRunning(AGT_ID)
  await tick()
  await answerInitialize(rig.spawned.at(-1))
  const proc = await ready
  assert.equal(proc.deadlines.turnTimeoutMs, 300000, 'code defaults with no overrides')
  assert.equal(router.lifecycleSlotSnapshot(AGT_ID).state, 'READY')
})
