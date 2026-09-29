/**
 * Shared scaffolding for the /agent-process/turn-abandonment admin-surface
 * tests (HR_RESET_AND_RESUME_V1) — extracted verbatim from
 * admin-turn-abandonment-api.test.js in the independent review round to keep
 * every handwritten file under the frozen 500-line guardrail
 * (CODE_STRUCTURE_GUARDRAILS_V1); no behavioral change.
 *
 * Same harness discipline as workflow-execution-api: a REAL loopback server
 * over a fake cordis ctx, an INJECTABLE stub token verifier, and a REAL
 * agent-router facade (durable TurnReconciliationStore + createProcessRegistry
 * + createIngressDelivery over the tool-free fixture worker).
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
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
const LEGACY_CTO_TOKEN = 'bearer-legacy-fixture-cto'

// The canonical current CTO machine identity per the accepted bootstrap
// authority (OBS-WA-008 + workflow-recovery identity receipts). The legacy
// OpenClaw-era pair (cto-agent / 3e2439d2-…) comes from a historical
// scheduler fixture and is NOT the agent-core canonical identity — exactly
// one pair is authorized, never both.
const CANONICAL_CTO_PRINCIPAL_ID = '4e5a4578-0645-4133-bd35-b80e453dfee9'
const CANONICAL_CTO_AGENT_ID = 'agt_cto-agent'

function principals() {
  return {
    // The Owner-designated sole privileged authority: the canonical CTO
    // principal, bound EXACTLY as authsvc asserts it (principal UUID + agentId).
    [CTO_TOKEN]: { principalId: CANONICAL_CTO_PRINCIPAL_ID, agentId: CANONICAL_CTO_AGENT_ID, scopes: new Set(['workflow.admin']), principalType: 'agent' },
    // workflow.admin alone is NOT the authority (Owner decision): a different
    // principal holding the same scope stays denied.
    [OTHER_WORKFLOW_ADMIN_TOKEN]: { principalId: 'p-other-admin', agentId: 'agt_other-admin', scopes: new Set(['workflow.admin']), principalType: 'agent' },
    // Exact-binding fail-closed probes: canonical UUID with a different
    // agentId, and the canonical agentId with a different principal UUID.
    [CTO_UUID_MISMATCH_TOKEN]: { principalId: CANONICAL_CTO_PRINCIPAL_ID, agentId: 'agt_impersonator', scopes: new Set(['workflow.admin']), principalType: 'agent' },
    [CTO_AGENT_MISMATCH_TOKEN]: { principalId: '4e5a4578-0000-4133-bd35-b80e453dfe99', agentId: CANONICAL_CTO_AGENT_ID, scopes: new Set(['workflow.admin']), principalType: 'agent' },
    // The legacy OpenClaw-era scheduler-fixture pair (spec D3): the historical
    // `cto-agent` / `3e2439d2-…` principal is NOT authorized alongside the
    // canonical pair — exactly one pair is bound, never both.
    [LEGACY_CTO_TOKEN]: { principalId: '3e2439d2-fb54-44f5-afee-77aa17c40d22', agentId: 'cto-agent', scopes: new Set(['workflow.admin']), principalType: 'agent' },
    [USER_TOKEN]: { principalId: 'p-plain', agentId: 'agt_plain', scopes: new Set(['scheduler.read']), principalType: 'agent' },
  }
}

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
    stuckFenceWithoutDurableExitEvidenceForAgent: (agentId) => store.stuckFenceWithoutDurableExitEvidenceForAgent(agentId),
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

/** A stuck turn that carries durable child_real_exit evidence (C-015 kind 4). */
function evidencedStuckTurn(store, agentId, opts = {}) {
  const handle = stuckTurn(store, agentId, opts)
  store.markExitObserved(handle)
  return handle
}

/**
 * The evidence-bearing restart class: the old execution's real exit was
 * observed and durably recorded (child_real_exit) before the controller
 * crash, while the registry-cleanup fence stayed active — the restart class
 * a reset entry may serve, because accepted durable termination evidence
 * exists even though the local registry is empty after the restart.
 */
function evidencedRestartRig(t, root) {
  const persistenceFile = join(root, 'turn-recovery.json')
  const crashed = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'admin-entry-epoch-crashed' })
  const oldHandle = stuckTurn(crashed, HR)
  crashed.claimRecovery(oldHandle, { operationId: 'reap-fixture', claimantRuntimeEpoch: 'admin-entry-epoch-crashed' })
  crashed.markExitObserved(oldHandle)
  const rig = hrRig(root, 'admin-entry-epoch-restarted')
  const old = rig.store.records.get(oldHandle)
  assert.equal(old?.state, 'settled', 'the observed exit settled the record as terminated_without_outcome')
  assert.equal(old?.terminationEvidence, 'child_real_exit', 'durable exit evidence is present')
  assert.equal(old?.fenceState, 'active', 'registry-cleanup-pending fence stays active')
  assert.ok(rig.store.admissionBlockerForAgent(HR), 'the evidence-bearing fence still blocks admission before the reset')
  return { rig, oldHandle }
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

export {
  call,
  CTO_AGENT_MISMATCH_TOKEN,
  CTO_TOKEN,
  CTO_UUID_MISMATCH_TOKEN,
  evidencedRestartRig,
  evidencedStuckTurn,
  hrRig,
  HR,
  LEGACY_CTO_TOKEN,
  mount,
  mutationProbe,
  OTHER,
  OTHER_WORKFLOW_ADMIN_TOKEN,
  restartLostRig,
  stuckTurn,
  TurnReconciliationStore,
  USER_TOKEN,
}
