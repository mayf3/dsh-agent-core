/**
 * HTTP tests for the /agent-process/turn-abandonment admin surface
 * (HR_RESET_AND_RESUME_V1). Same harness discipline as workflow-execution-api:
 * a REAL loopback server over a fake cordis ctx, an INJECTABLE stub token
 * verifier, and a REAL agent-router facade (durable TurnReconciliationStore +
 * createProcessRegistry + createIngressDelivery over the tool-free fixture
 * worker). Pins:
 *
 *   - the authorization gate reuses the EXISTING authsvc verifier seam and
 *     the EXISTING fleet admin scope `workflow.admin` (401/403 fail-closed,
 *     permission+scope checks BEFORE any store mutation, zero mutation on
 *     every denial);
 *   - the operation target is PINNED to agt_hr-agent (any other target is
 *     refused before any mutation);
 *   - a live identifiable HR execution refuses the reset with a structured
 *     limitation (review r4130766489) instead of stamping over a possibly
 *     running task;
 *   - a legitimate admin reset unblocks the SAME HR through the SAME normal
 *     ingress path (the reset never sends anything itself);
 *   - retrying a completed declaration never adopts a later unknown;
 *   - declarations stay readable after a controller restart;
 *   - the 32-distinct-declaration budget is a real, tested boundary whose
 *     exhaustion keeps retries of existing ids working (no recycling).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { apply as applyProductApi } from '../src/index.js'
import { createStubTokenVerifier } from '../src/scheduler-auth.js'
import { AgentProcess } from '../../agent-router/src/process.js'
import { createProcessRegistry } from '../../agent-router/src/process-registry.js'
import { createIngressDelivery } from '../../agent-router/src/ingress-delivery.js'
import { TurnReconciliationStore } from '../../agent-router/src/reconciliation-store.js'

const HR = 'agt_hr-agent'
const OTHER = 'agt_other-agent'
const CTO_TOKEN = 'bearer-cto-agent'
const OTHER_WORKFLOW_ADMIN_TOKEN = 'bearer-other-workflow-admin'
const CTO_UUID_MISMATCH_TOKEN = 'bearer-cto-uuid-wrong-agent'
const CTO_AGENT_MISMATCH_TOKEN = 'bearer-cto-agent-wrong-uuid'
const USER_TOKEN = 'bearer-plain-user'

const FIXTURE_WORKER = fileURLToPath(new URL('../../../scripts/availability-recovery/worker.mjs', import.meta.url))

function fakeCtx(services) {
  const provided = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    async disposeAll() {
      for (const dispose of disposers.splice(0)) {
        try { await dispose() } catch { /* best effort */ }
      }
    },
  }
}

const CTO_PRINCIPAL_ID = '3e2439d2-fb54-44f5-afee-77aa17c40d22'

function principals() {
  return {
    // The Owner-designated sole privileged authority: the canonical CTO
    // principal, bound EXACTLY as authsvc asserts it (principal UUID + agentId).
    [CTO_TOKEN]: { principalId: CTO_PRINCIPAL_ID, agentId: 'cto-agent', scopes: new Set(['workflow.admin']), principalType: 'agent' },
    // workflow.admin alone is NOT the authority (Owner decision): a different
    // principal holding the same scope stays denied.
    [OTHER_WORKFLOW_ADMIN_TOKEN]: { principalId: 'p-other-admin', agentId: 'agt_other-admin', scopes: new Set(['workflow.admin']), principalType: 'agent' },
    // Exact-binding fail-closed probes: canonical UUID with a different
    // agentId, and the cto-agent id with a different principal UUID.
    [CTO_UUID_MISMATCH_TOKEN]: { principalId: CTO_PRINCIPAL_ID, agentId: 'agt_impersonator', scopes: new Set(['workflow.admin']), principalType: 'agent' },
    [CTO_AGENT_MISMATCH_TOKEN]: { principalId: '8e2439d2-0000-44f5-afee-77aa17c40d99', agentId: 'cto-agent', scopes: new Set(['workflow.admin']), principalType: 'agent' },
    [USER_TOKEN]: { principalId: 'p-plain', agentId: 'agt_plain', scopes: new Set(['scheduler.read']), principalType: 'agent' },
  }
}

/** Real agent-router facade over one durable store (restart-lost class). */
function hrRig(root, epoch) {
  const persistenceFile = join(root, 'turn-recovery.json')
  const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: epoch })
  const processes = []
  const log = { log() {}, error() {} }
  const workspaceBootstrap = {
    async ensure(id) { mkdirSync(join(root, id), { recursive: true }) },
    async ensureWorkspace() {},
    resolveWorkspace(id) { return join(root, id) },
    resolveDshHome(id) { return join(root, id) },
  }
  class LocalWorker extends AgentProcess {
    spawn() {
      this.counters.spawnAttempts += 1
      return this.attachChild(spawn(process.execPath, [FIXTURE_WORKER], {
        cwd: root, env: { PATH: '/usr/bin:/bin', HOME: root, FIXTURE_PROMPT_LOG: join(root, 'fixture-prompts.jsonl') }, stdio: ['pipe', 'pipe', 'pipe'],
      }))
    }
  }
  const registry = createProcessRegistry({
    log, cfg: { agentProfile: 'admin-entry-fixture', productionRoot: root },
    workspaceBootstrap, reconciliationStore: store,
    agentDefinition: { getAgent(id) {
      if (![HR, OTHER].includes(id)) throw new Error('unregistered fixture Agent')
      return { id, disabled: false }
    } },
    deadlineConfig: { perAgent: () => ({ initializeTimeoutMs: 1500, promptReceiptTimeoutMs: 1000, turnTimeoutMs: 350, shutdownGraceMs: 500 }) },
    processFactory(opts) { const p = new LocalWorker(opts); processes.push(p); return p },
    resolveProcessConfig: () => ({ provider: 'availability-fixture', model: 'tool-free' }),
    provisionHome() {}, switchAgent() { throw new Error('not used') },
    getBrokerGateway() { throw new Error('tools forbidden in this fixture') },
  })
  let requests = 0
  const delivery = createIngressDelivery({
    log, feishu: undefined, workspaceBootstrap, store: {}, reconciliationStore: store,
    routeChain: { async runTurnWithRouteChain(id, args) {
      const p = await registry.ensureRunning(id)
      return p.turn(args.sessionId, args.message, args.opts)
    } },
    resolveAgentRef() { throw new Error('not used') },
    resolveAgentById() { throw new Error('not used') },
    async resolveChannelConversation({ externalId }) {
      return { channelConversation: { id: `local:${externalId}` }, binding: { activeAgentId: externalId, activeSessionId: 'main' } }
    },
    resolveEffectiveWorkspace: () => ({ workspaceId: null, workspacePath: root }),
  })
  const facade = {
    abandonPendingTurns: delivery.abandonPendingTurns,
    abandonmentDeclarationsSnapshot: (agentId) => store.adminAbandonmentsForAgent(agentId),
    registrySnapshot: () => registry.registrySnapshot(),
    lifecycleSlotSnapshot: (agentId) => registry.lifecycleSlotSnapshot(agentId),
    store,
    delivery,
    registry,
    async request(text, id = HR) {
      return delivery.onIngress({ channel: 'local', conversationId: id, chatId: id, messageId: `admin-entry-${++requests}`, sender: { openId: 'fixture-owner' }, text })
    },
    async close() { await registry.dispose() },
  }
  return facade
}

async function mount(t, { routerFacade, verifier = createStubTokenVerifier(principals()) } = {}) {
  const services = new Map([
    ['agentRouter', routerFacade],
    ['agentDefinition', { listAgents: () => [] }],
    ['schedulerTokenVerifier', verifier],
  ])
  const ctx = fakeCtx(services)
  const api = applyProductApi(ctx, { port: 0 })
  await new Promise((resolveReady) => {
    const wait = () => {
      const addr = api.address()
      if (addr?.port && addr.port !== 0) resolveReady()
      else setTimeout(wait, 10)
    }
    wait()
  })
  const addr = api.address()
  t.after(async () => { await routerFacade.close(); ctx.disposeAll() })
  return { base: `http://127.0.0.1:${addr.port}`, router: routerFacade }
}

async function call(base, path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const parsed = await res.json().catch(() => null)
  return { status: res.status, body: parsed }
}

function stuckTurn(store, agentId, { generation = 1 } = {}) {
  const handle = store.mintTurnExecution({ agentId, processGeneration: generation, sessionId: 'main' })
  store.markPromptWriteAttempted(handle)
  store.markOutcomeUnknown(handle, { source: 'admin-entry-fixture' })
  return handle
}

/** The restart-lost class: a stuck unknown fence from a retired epoch. */
async function restartLostRig(t, root) {
  const persistenceFile = join(root, 'turn-recovery.json')
  const crashed = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'admin-entry-epoch-crashed' })
  const oldHandle = stuckTurn(crashed, HR)
  const rig = hrRig(root, 'admin-entry-epoch-restarted')
  assert.ok(rig.store.activeFenceForAgent(HR), 'restart-lost fence must be active before the reset')
  assert.equal(rig.store.records.get(oldHandle)?.runtimeEpoch, 'admin-entry-epoch-crashed')
  return { rig, oldHandle }
}

function mutationProbe(rig) {
  return JSON.stringify([...rig.store.records.values()])
    + JSON.stringify(rig.store.adminAbandonmentDeclarations)
}

test('admin gate: no token / wrong scope / foreign target all fail closed with ZERO store mutation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-gate-'))
  const { rig, oldHandle } = await restartLostRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })
  const post = { agentId: HR, declarationId: 'reset-gate-1' }
  const before = mutationProbe(rig)

  let res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post })
  assert.equal(res.status, 401)
  assert.equal(res.body.error.code, 'unauthenticated')

  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: USER_TOKEN })
  assert.equal(res.status, 403)
  assert.equal(res.body.error.code, 'forbidden', 'ordinary scheduler.read user is not an administrator')


  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: { agentId: OTHER, declarationId: 'reset-gate-1' }, token: CTO_TOKEN })
  assert.equal(res.status, 403, 'target outside the pinned agt_hr-agent scope is refused')

  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: { agentId: HR, declarationId: 'x', extra: 1 }, token: CTO_TOKEN })
  assert.equal(res.status, 400, 'closed body: unknown fields refused')

  assert.equal(mutationProbe(rig), before, 'denied calls mutate nothing')
  assert.ok(rig.store.activeFenceForAgent(HR)?.handle === oldHandle, 'fence untouched')
})

test('legitimate admin reset through the real HTTP entry unblocks the same HR via the normal ingress', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-ok-'))
  const { rig, oldHandle } = await restartLostRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })

  // The next ordinary message is STILL fenced before the reset.
  const fenced = await rig.request('NEW independent HR request before reset')
  assert.notEqual(fenced?.reply, 'fixture-ok', 'pre-reset ordinary message stays fenced')

  const reset = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-entry-1' }, token: CTO_TOKEN,
  })
  assert.equal(reset.status, 200)
  assert.deepEqual(reset.body.abandonedHandles, [oldHandle])
  const oldRecord = rig.store.records.get(oldHandle)
  assert.equal(oldRecord.initialOutcome, 'outcome_unknown', 'old business result stays UNKNOWN')
  assert.equal(oldRecord.fenceState, 'active', 'old record keeps its honest fenced state')
  assert.equal(oldRecord.adminAbandonment?.declarationId, 'reset-entry-1', 'minimal audit / no-replay marker kept')

  // Declarations are readable (read-only projection).
  const read = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: CTO_TOKEN })
  assert.equal(read.status, 200)
  assert.deepEqual(read.body.declarations.map(d => d.declarationId), ['reset-entry-1'])
  assert.deepEqual(read.body.declarations[0].handles, [oldHandle])

  // The reset itself never sends anything; the NEXT ordinary message is the
  // normal ingress path and now completes on the same HR / same entry.
  const next = await rig.request('NEW independent HR request after admin reset')
  assert.equal(next?.reply, 'fixture-ok', JSON.stringify(next))
  assert.equal(next.agentId, HR)
  assert.equal(next.sessionId, 'main')
  const prompts = readFileSync(join(root, 'fixture-prompts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(prompts.length, 1, 'exactly the one new prompt; the reset sent nothing and replayed nothing')
})

test('retrying a completed declaration over HTTP never adopts a later unknown turn', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-retry-'))
  const { rig } = await restartLostRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })

  const first = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-entry-1' }, token: CTO_TOKEN,
  })
  assert.equal(first.status, 200)

  // A LATER turn becomes unknown after the declaration completed.
  const laterHandle = stuckTurn(rig.store, HR, { generation: 1 })
  const retry = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-entry-1' }, token: CTO_TOKEN,
  })
  assert.equal(retry.status, 200)
  assert.deepEqual(retry.body.abandonedHandles, [], 'retry abandons nothing new')
  assert.equal(rig.store.records.get(laterHandle).adminAbandonment ?? null, null, 'later task never marked by the old id')
  assert.equal(rig.store.admissionBlockerForAgent(HR)?.handle, laterHandle, 'later task keeps fencing admission')

  // Only an explicit NEW declaration resets the later task.
  const second = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-entry-2' }, token: CTO_TOKEN,
  })
  assert.equal(second.status, 200)
  assert.deepEqual(second.body.abandonedHandles, [laterHandle])
  assert.equal(rig.store.admissionBlockerForAgent(HR), null)
})

test('declarations survive a controller restart and stay readable at the entry', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-restart-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  const crashed = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-crashed' })
  const oldHandle = stuckTurn(crashed, HR)
  const first = hrRig(root, 'epoch-restarted-a')
  const { base } = await mount(t, { routerFacade: first })
  const reset = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-restart-1' }, token: CTO_TOKEN,
  })
  assert.equal(reset.status, 200)
  await first.close()

  // Controller restart: fresh epoch, same durable file, fresh registry.
  const second = hrRig(root, 'epoch-restarted-b')
  t.after(async () => { await second.close(); rmSync(root, { recursive: true, force: true }) })
  const read = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: CTO_TOKEN })
  assert.equal(read.status, 200)
  assert.deepEqual(read.body.declarations.map(d => d.declarationId), ['reset-restart-1'])
  assert.deepEqual(read.body.declarations[0].handles, [oldHandle], 'declaration scope readable after restart')
  assert.equal(second.store.admissionBlockerForAgent(HR), null, 'unblock survives the restart')
})

test('an identifiable live HR execution refuses the reset with a structured limitation (r4130766489)', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-live-'))
  const rig = hrRig(root, 'epoch-live')
  const { base } = await mount(t, { routerFacade: rig })
  // Produce a REAL live worker: a completed turn leaves the READY process up.
  const done = await rig.request('hello')
  assert.equal(done?.reply, 'fixture-ok')
  const snapshot = rig.registrySnapshot()
  assert.ok(snapshot.some(p => p.agentId === HR && p.alive), 'live HR process is identifiable')

  const stuck = stuckTurn(rig.store, HR, { generation: 2 })
  const before = mutationProbe(rig)
  const refusal = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-live-1' }, token: CTO_TOKEN,
  })
  assert.equal(refusal.status, 409)
  assert.equal(refusal.body.error.code, 'live_execution_present')
  assert.match(refusal.body.error.message, /cancel|shutdown/, 'limitation names the existing controlled path')
  assert.equal(mutationProbe(rig), before, 'refusal mutates nothing')
  assert.equal(rig.store.records.get(stuck).adminAbandonment ?? null, null, 'no marker written over a live execution')
})

test('the 32-distinct-declaration budget is a real boundary; retries of existing ids still work', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-budget-'))
  const rig = hrRig(root, 'epoch-budget')
  const { base } = await mount(t, { routerFacade: rig })
  for (let i = 1; i <= 32; i += 1) {
    const res = await call(base, '/agent-process/turn-abandonment', {
      method: 'POST', body: { agentId: HR, declarationId: `budget-${i}` }, token: CTO_TOKEN,
    })
    assert.equal(res.status, 200, `declaration ${i} of 32 accepted`)
  }
  const exhausted = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'budget-33' }, token: CTO_TOKEN,
  })
  assert.equal(exhausted.status, 409)
  assert.equal(exhausted.body.error.code, 'abandonment_capacity_exhausted')
  assert.match(exhausted.body.error.message, /32/, 'exhaustion message states the exact bound')
  // No recycling: an existing id still replays idempotently.
  const retry = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'budget-1' }, token: CTO_TOKEN,
  })
  assert.equal(retry.status, 200)
  assert.deepEqual(retry.body.abandonedHandles, [])
})

test('GET requires the same admin authority; the loopback /v1/message path cannot reach the admin operation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-readgate-'))
  const { rig } = await restartLostRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })

  let res = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`)
  assert.equal(res.status, 401)
  res = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: USER_TOKEN })
  assert.equal(res.status, 403)

  // The ordinary message path carries no admin surface: a message is just a
  // normal HR turn (fenced here, because the stuck turn is still fenced).
  const normal = await rig.request('ordinary user message')
  assert.notEqual(normal?.reply, 'fixture-ok', 'ordinary message stays a normal fenced turn, not an admin reset')
  assert.equal(rig.store.adminAbandonmentDeclarations.length, 0, 'ordinary ingress performs no abandonment')
  rmSync(root, { recursive: true, force: true })
})

test('Owner-designated sole authority: workflow.admin alone and CTO identity mismatches are all denied with ZERO mutation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-cto-'))
  const { rig, oldHandle } = await restartLostRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })
  const post = { agentId: HR, declarationId: 'reset-cto-1' }
  const before = mutationProbe(rig)

  // A different principal holding workflow.admin is NOT the authority.
  let res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: OTHER_WORKFLOW_ADMIN_TOKEN })
  assert.equal(res.status, 403)
  // Canonical CTO principal UUID bound to the WRONG agentId: fail closed.
  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: CTO_UUID_MISMATCH_TOKEN })
  assert.equal(res.status, 403)
  // The cto-agent id carrying a DIFFERENT principal UUID: fail closed.
  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: CTO_AGENT_MISMATCH_TOKEN })
  assert.equal(res.status, 403)
  // GET is gated by the same exact binding.
  res = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: OTHER_WORKFLOW_ADMIN_TOKEN })
  assert.equal(res.status, 403)

  assert.equal(mutationProbe(rig), before, 'every denial mutates nothing')
  assert.ok(rig.store.activeFenceForAgent(HR)?.handle === oldHandle, 'fence untouched')

  // Only the exact canonical binding is authorized.
  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: CTO_TOKEN })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.deepEqual(res.body.abandonedHandles, [oldHandle])
})

test('non-drained lifecycle slots refuse the reset: STARTUP and REAP are explicit local limitations, zero mutation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-slots-'))
  const rig = hrRig(root, 'epoch-slots')
  const { base } = await mount(t, { routerFacade: rig })
  const stuck = stuckTurn(rig.store, HR, { generation: 1 })

  // STARTUP: an in-flight generation the registry has not drained.
  rig.lifecycleSlotSnapshot = () => ({ state: 'STARTUP', generation: 7 })
  const beforeStartup = mutationProbe(rig)
  let res = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-slot-1' }, token: CTO_TOKEN,
  })
  assert.equal(res.status, 409)
  assert.equal(res.body.error.code, 'startup_in_progress')
  assert.equal(mutationProbe(rig), beforeStartup, 'STARTUP refusal mutates nothing')

  // REAP: a generation still reaping (real exit not yet settled).
  rig.lifecycleSlotSnapshot = () => ({ state: 'REAP', generation: 7 })
  const beforeReap = mutationProbe(rig)
  res = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-slot-2' }, token: CTO_TOKEN,
  })
  assert.equal(res.status, 409)
  assert.equal(res.body.error.code, 'reaping_in_progress')
  assert.equal(mutationProbe(rig), beforeReap, 'REAP refusal mutates nothing')
  assert.equal(rig.store.records.get(stuck).adminAbandonment ?? null, null, 'no marker over a non-drained slot')

  // EMPTY slot: the operation may proceed (nothing identifiable is running).
  rig.lifecycleSlotSnapshot = () => ({ state: 'EMPTY' })
  const ok = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-slot-3' }, token: CTO_TOKEN,
  })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.deepEqual(ok.body.abandonedHandles, [stuck])
})

test('missing lifecycle verification capability fails closed instead of defaulting to resettable', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-nocap-'))
  const rig = hrRig(root, 'epoch-nocap')
  stuckTurn(rig.store, HR, { generation: 1 })
  const reduced = { ...rig }
  delete reduced.lifecycleSlotSnapshot
  const { base } = await mount(t, { routerFacade: reduced })
  const before = mutationProbe(rig)
  const res = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-nocap-1' }, token: CTO_TOKEN,
  })
  assert.equal(res.status, 503)
  assert.equal(res.body.error.code, 'liveness_verification_unavailable')
  assert.equal(mutationProbe(rig), before, 'unverifiable liveness never defaults to a reset')
})
