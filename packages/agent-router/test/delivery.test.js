/**
 * Unit tests for Agent Router Delivery V0 — the frozen admission interface:
 *
 *   deliver({ requestId, agentId, sessionMode: 'main'|'fresh', message })
 *     -> { accepted: true, sessionId }
 *
 * These tests drive the REAL router (BindingStore over tmp files, real
 * Registry, real ensureRunning admission path incl. provisionAgentHome) with
 * a FAKE per-agent process injected through the `processFactory` seam — no
 * real DSH child, no model. The fake's `deliver` resolves on "receipt" only,
 * so the router-level "accepted does not wait for a turn" property is
 * structurally proven here; the deterministic AgentProcess-level proof lives
 * in process-delivery.test.js, and the real-process end-to-end proof in
 * scripts/agent-router-delivery-v0-verify.mjs.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentRegistry } from '../../agent-registry/src/registry.js'
import { apply as applyRouter } from '../src/index.js'

/** Fake cordis ctx: get/provide/effect only (what the router uses). */
function fakeCtx(services) {
  const provided = new Map()
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => { const dispose = fn(); return () => dispose?.() },
  }
}

/** Stub workspaceBootstrap (path mapping only; no real provisioning). */
function stubBootstrap() {
  return {
    resolveWorkspace: (agentId) => join('/tmp/ws', agentId),
    resolveDshHome: (agentId) => join('/tmp/home', agentId),
    ensure: async () => ({ workspace: '/tmp/ws', dshHome: '/tmp/home' }),
  }
}

let pidSeq = 1000

/**
 * Fake per-agent process: records every deliver() (sessionId, text), accepts
 * immediately ("receipt"), and only ever goes "idle" when the test says so.
 * `kill()` marks it exited; the next ensureRunning respawns via the factory.
 */
class FakeProc {
  constructor({ agentId, log }) {
    this.agentId = agentId
    this.pid = ++pidSeq
    this.log = log
    this.exit = undefined
    this.exitResolve = undefined
    this.exitPromise = new Promise((resolve) => { this.exitResolve = resolve })
    this.onRpcRequest = undefined
    this.deliveries = [] // { sessionId, text }
    this.spawned = true
    this.readyMs = 0
  }

  spawn() { this.spawned = true }

  async ready() { return this.readyMs }

  /** The inbox-accept seam: resolves on receipt, never waits for a turn. */
  async deliver(sessionId, text) {
    this.deliveries.push({ sessionId, text })
    return { accepted: true, sessionId, messageId: `msg-${this.deliveries.length}` }
  }

  async shutdown() {}

  kill() {
    this.exit = { code: 9, signal: 'SIGKILL' }
    this.exitResolve?.({ code: 9, signal: 'SIGKILL' })
  }
}

/** Build a registry + router over tmp stores; returns the whole rig. */
async function freshRig(t, { config = {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-delivery-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const registry = new AgentRegistry({ storeFile: join(dir, 'registry.json') })
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentRegistry', {
      listAgents: () => registry.listAgents(),
      getAgent: (id) => registry.getAgent(id),
      getDefaultAgent: () => registry.getDefaultAgent(),
      registerAgent: (input) => registry.registerAgent(input),
      updateAgent: (agentId, patch) => registry.updateAgent(agentId, patch),
      setDefaultAgent: (agentId) => registry.setDefaultAgent(agentId),
    }],
  ]))
  const spawned = [] // every process the factory created
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    processFactory: (opts) => {
      const proc = new FakeProc(opts)
      spawned.push(proc)
      return proc
    },
    ...config,
  })
  return { router, registry, spawned, dir }
}

/** Register one agent; returns its registry record. */
async function registerOne(registry, name = 'Delivery Agent') {
  return registry.registerAgent({ name })
}

test('D1 main first deliver: accepted, sessionId fixed main, one process, one prompt', async (t) => {
  const { router, registry, spawned } = await freshRig(t)
  const agent = await registerOne(registry)

  const result = await router.deliver({ requestId: 'job-1', agentId: agent.id, sessionMode: 'main', message: 'hello main' })
  assert.deepEqual(result, { accepted: true, sessionId: 'main' })
  assert.equal(spawned.length, 1, 'one agent process spawned by admission')
  assert.deepEqual(spawned[0].deliveries, [{ sessionId: 'main', text: 'hello main' }])
  const log = router.deliveriesSnapshot()
  assert.equal(log.length, 1)
  assert.equal(log[0].sessionId, 'main')
  assert.equal(log[0].sessionMode, 'main')
  // 'main' never enters the fresh mapping table.
  assert.deepEqual(router.freshSessionsSnapshot(), [])
})

test('D2 main again: same fixed session, process reused, no second mapping', async (t) => {
  const { router, registry, spawned } = await freshRig(t)
  const agent = await registerOne(registry)

  const first = await router.deliver({ requestId: 'job-1', agentId: agent.id, sessionMode: 'main', message: 'a' })
  const second = await router.deliver({ requestId: 'job-2', agentId: agent.id, sessionMode: 'main', message: 'b' })
  assert.deepEqual(first, { accepted: true, sessionId: 'main' })
  assert.deepEqual(second, { accepted: true, sessionId: 'main' })
  assert.equal(spawned.length, 1, 'same live process reused for the second deliver')
  assert.deepEqual(spawned[0].deliveries.map(d => d.sessionId), ['main', 'main'])
})

test('D3 fresh: different requestIds -> different new sessions', async (t) => {
  const { router, registry } = await freshRig(t)
  const agent = await registerOne(registry)

  const r1 = await router.deliver({ requestId: 'req-A', agentId: agent.id, sessionMode: 'fresh', message: 'm1' })
  const r2 = await router.deliver({ requestId: 'req-B', agentId: agent.id, sessionMode: 'fresh', message: 'm2' })
  assert.equal(r1.accepted, true)
  assert.equal(r2.accepted, true)
  assert.match(r1.sessionId, /^fresh-[0-9a-f]{32}$/, 'fresh session id shape')
  assert.match(r2.sessionId, /^fresh-[0-9a-f]{32}$/)
  assert.notEqual(r1.sessionId, r2.sessionId, 'different requestId must yield a different session')
  const rows = router.freshSessionsSnapshot()
  assert.equal(rows.length, 2)
  assert.ok(rows.some(r => r.requestId === 'req-A' && r.sessionId === r1.sessionId))
  assert.ok(rows.some(r => r.requestId === 'req-B' && r.sessionId === r2.sessionId))
})

test('D4 fresh: same requestId retry -> same session, never a second one', async (t) => {
  const { router, registry } = await freshRig(t)
  const agent = await registerOne(registry)

  const first = await router.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'first' })
  const retry = await router.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'retry' })
  assert.equal(retry.sessionId, first.sessionId, 'retry must point to the SAME session')
  const rows = router.freshSessionsSnapshot()
  assert.equal(rows.length, 1, 'exactly one mapping row for one requestId')
  assert.equal(rows[0].sessionId, first.sessionId)
  assert.equal(rows[0].createdAt, rows[0].createdAt)
})

test('D4b fresh: concurrent first deliveries of the same requestId converge on ONE session', async (t) => {
  const { router, registry } = await freshRig(t)
  const agent = await registerOne(registry)

  const [a, b] = await Promise.all([
    router.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'a' }),
    router.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'b' }),
  ])
  assert.equal(a.sessionId, b.sessionId, 'atomic read-or-mint: both callers get the one minted session')
  assert.equal(router.freshSessionsSnapshot().length, 1)
})

test('D5 caller cannot specify or resume an arbitrary non-main session', async (t) => {
  const { router, registry } = await freshRig(t)
  const agent = await registerOne(registry)

  // 1. The frozen interface has no sessionId field: a stray one is rejected.
  await assert.rejects(
    () => router.deliver({ requestId: 'req-A', agentId: agent.id, sessionMode: 'main', message: 'x', sessionId: 'main' }),
    TypeError,
  )
  await assert.rejects(
    () => router.deliver({ requestId: 'req-A', agentId: agent.id, sessionMode: 'fresh', message: 'x', sessionId: 'some-history-session' }),
    TypeError,
  )
  // 2. A fresh session minted for requestId X is NOT reachable via requestId Y.
  const viaX = await router.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'x' })
  const viaY = await router.deliver({ requestId: 'req-Y', agentId: agent.id, sessionMode: 'fresh', message: 'y' })
  assert.notEqual(viaX.sessionId, viaY.sessionId)
  // 3. No call anywhere takes a sessionId: the only session ids that ever
  //    exist are 'main' and the router-minted fresh ids, and rejected calls
  //    never reach a delivery.
  const ids = router.freshSessionsSnapshot().map(r => r.sessionId)
  assert.ok(ids.every(id => id.startsWith('fresh-')), 'router-minted ids only')
  assert.deepEqual(router.deliveriesSnapshot().map(d => d.sessionId), [viaX.sessionId, viaY.sessionId])
})

test('D6 restart: fresh mapping survives a fresh router over the same store; main stays main', async (t) => {
  const { router, registry, dir } = await freshRig(t)
  const agent = await registerOne(registry)

  const viaX = await router.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'x' })
  await router.deliver({ requestId: 'req-M', agentId: agent.id, sessionMode: 'main', message: 'm' })

  // Control-plane restart: fresh registry + fresh router over the SAME files.
  const registry2 = new AgentRegistry({ storeFile: join(dir, 'registry.json') })
  const ctx2 = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentRegistry', {
      listAgents: () => registry2.listAgents(),
      getAgent: (id) => registry2.getAgent(id),
      getDefaultAgent: () => registry2.getDefaultAgent(),
    }],
  ]))
  const spawned2 = []
  const router2 = applyRouter(ctx2, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    processFactory: (opts) => { const p = new FakeProc(opts); spawned2.push(p); return p },
  })
  const retry = await router2.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'x again' })
  assert.equal(retry.sessionId, viaX.sessionId, 'same requestId -> same session even after control-plane restart')
  assert.equal(router2.freshSessionsSnapshot().length, 1, 'mapping table restored from disk, not re-minted')
  const mainAgain = await router2.deliver({ requestId: 'req-M2', agentId: agent.id, sessionMode: 'main', message: 'm2' })
  assert.equal(mainAgain.sessionId, 'main')
})

test('D6b agent process restart: dead process respawns, session target unchanged', async (t) => {
  const { router, registry, spawned } = await freshRig(t)
  const agent = await registerOne(registry)

  await router.deliver({ requestId: 'j1', agentId: agent.id, sessionMode: 'main', message: 'a' })
  const fresh = await router.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'x' })
  assert.equal(spawned.length, 1)

  // Kill the agent process; the next deliver must respawn (never reuse a
  // dead proc) and still target exactly the same sessions.
  spawned[0].kill()
  const main2 = await router.deliver({ requestId: 'j2', agentId: agent.id, sessionMode: 'main', message: 'b' })
  const fresh2 = await router.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'x2' })
  assert.equal(spawned.length, 2, 'respawned on the dead process')
  assert.equal(main2.sessionId, 'main')
  assert.equal(fresh2.sessionId, fresh.sessionId, 'fresh mapping survives the agent process restart')
  assert.deepEqual(spawned[1].deliveries.map(d => d.sessionId), ['main', fresh.sessionId])
})

test('D7 accepted resolves immediately: no turn completion required at the router level', async (t) => {
  const { router, registry, spawned } = await freshRig(t)
  const agent = await registerOne(registry)

  // The fake process NEVER goes idle and NEVER emits assistant events — if
  // deliver waited for a turn it could never resolve. It must resolve on the
  // receipt alone, and fast.
  const started = Date.now()
  const result = await router.deliver({ requestId: 'j1', agentId: agent.id, sessionMode: 'main', message: 'no turn ever finishes' })
  const ms = Date.now() - started
  assert.deepEqual(result, { accepted: true, sessionId: 'main' })
  assert.ok(ms < 5000, `deliver must not wait for a turn (took ${ms}ms)`)
  assert.equal(spawned[0].exit, undefined, 'process still alive — the turn simply keeps running')
})

test('D8 validation: sessionMode / agentId / requestId / message contracts', async (t) => {
  const { router, registry } = await freshRig(t)
  const agent = await registerOne(registry)
  const base = { requestId: 'req-X', agentId: agent.id, sessionMode: 'main', message: 'x' }

  await assert.rejects(() => router.deliver({ ...base, sessionMode: 'workflow' }), TypeError)
  await assert.rejects(() => router.deliver({ ...base, sessionMode: undefined }), TypeError)
  await assert.rejects(() => router.deliver({ ...base, agentId: 'agt_does-not-exist' }), (e) => e.code === 'AGENT_NOT_FOUND')
  await assert.rejects(() => router.deliver({ ...base, agentId: '' }), TypeError)
  await assert.rejects(() => router.deliver({ ...base, agentId: undefined }), TypeError)
  await assert.rejects(() => router.deliver({ ...base, requestId: '' }), TypeError)
  await assert.rejects(() => router.deliver({ ...base, requestId: 42 }), TypeError)
  await assert.rejects(() => router.deliver({ ...base, message: 42 }), TypeError)
  await assert.rejects(() => router.deliver({ ...base, message: undefined }), TypeError)
  // Nothing was delivered by any rejected call.
  assert.deepEqual(router.deliveriesSnapshot(), [])
  assert.deepEqual(router.freshSessionsSnapshot(), [])
})

test('D9 fresh mappings are namespaced per agent', async (t) => {
  const { router, registry } = await freshRig(t)
  const agentA = await registerOne(registry, 'Agent A')
  const agentB = await registry.registerAgent({ name: 'Agent B' })

  const a = await router.deliver({ requestId: 'same-req', agentId: agentA.id, sessionMode: 'fresh', message: 'a' })
  const b = await router.deliver({ requestId: 'same-req', agentId: agentB.id, sessionMode: 'fresh', message: 'b' })
  assert.notEqual(a.sessionId, b.sessionId, 'same requestId on different agents = different sessions')
  assert.equal(router.freshSessionsSnapshot().length, 2)
})
