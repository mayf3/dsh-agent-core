/**
 * Shared fixtures for the self-service test directory (AMENDMENT_3 C2).
 * The two rig variants coexist by design (different signatures): the
 * self-service access rig and the critical-guard rig. The trusted-context
 * helper is the unified superset (the guard tests' smaller subset was
 * absorbed — the extra Feishu context fields are unread by every guard-path
 * handler). Bodies are moved verbatim from the pre-split test files; only
 * import specifiers and export keywords changed.
 */

import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JobStore } from '../../src/store.js'
import { createSelfServiceSchedulerAccess } from '../../src/self-service.js'
import { canonicalJSON } from '../../src/occurrence-model.js'

export const CRITICAL_KEY = 'agt_hr-agent:hr-workflow-auto-dispatch'

export function trusted(agentId = 'agt_a', overrides = {}) {
  return {
    agentId,
    callerAgentId: agentId,
    processGeneration: 7,
    turnExecutionId: `turn:${agentId}:7:1`,
    channelNamespace: 'feishu',
    channelConversationId: 'thread:must-not-be-parsed',
    feishuChatId: `oc_${agentId}`,
    feishuConversationId: 'thread:also-must-not-be-parsed',
    feishuMessageId: 'om_1',
    ...overrides,
  }
}

export async function createSelfServiceRig(t, { adminAgents = new Set(), auditAgents = new Set(), auditFailure = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-self-service-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
  // AMENDMENT_1 guard provisioning: these tests own NO critical jobs, so they
  // pin an EMPTY critical inventory — hermetic on any host (without this, the
  // fixed production default path decides, which is host-dependent).
  const criticalInventoryPath = join(dir, 'desired-state.json')
  await writeFile(criticalInventoryPath, JSON.stringify({ version: 1, jobs: [] }))
  const grantCalls = []
  const auditErrors = []
  if (auditFailure) store.appendRunEvent = async () => ({ ok: false, error: 'injected' })
  const access = createSelfServiceSchedulerAccess({
    store,
    criticalInventoryPath,
    assertGrant: async (agentId, scope, resource) => {
      grantCalls.push({ agentId, scope, resource })
      // Independent exact proofs: an admin grant never satisfies the audit
      // scope and vice versa (CTR-AUTH-002 mutual non-implication).
      return (scope === 'scheduler.admin' && adminAgents.has(agentId))
        || (scope === 'scheduler.audit' && auditAgents.has(agentId))
    },
    onAuditFailure: (event) => auditErrors.push(event),
  })
  const call = (action, args, context = trusted()) => access.handlers.scheduler[action](args, context)
  let storeReads = 0
  const originalLoad = store.loadDoc.bind(store)
  store.loadDoc = async (...args) => { storeReads += 1; return originalLoad(...args) }
  return { store, call, dir, grantCalls, auditErrors, storeReads: () => storeReads }
}

// Deterministic fixture manifest writer (hermetic — never the host file).
export function inventoryFile(t, content) {
  return mkdtemp(join(tmpdir(), 'critical-guard-')).then(async (resolvedDir) => {
    const path = join(resolvedDir, 'scheduler-desired-state.json')
    await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content))
    t.after(() => rm(resolvedDir, { recursive: true, force: true }))
    return path
  })
}

export async function createCriticalGuardRig(t, { inventoryPath, adminAgents = new Set() } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'critical-guard-store-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const storePath = join(dir, 'jobs.json')
  const store = new JobStore(storePath, { runLogPath: join(dir, 'runs.jsonl') })
  const denialEvents = []
  const originalAppend = store.appendRunEvent.bind(store)
  store.appendRunEvent = async (event) => {
    if (event.action === 'self_service_denied') denialEvents.push(event)
    return originalAppend(event)
  }
  const access = createSelfServiceSchedulerAccess({
    store,
    assertGrant: async (agentId, scope) => scope === 'scheduler.admin' && adminAgents.has(agentId),
    criticalInventoryPath: inventoryPath,
  })
  const call = (action, args, context = trusted()) => access.handlers.scheduler[action](args, context)
  // seed: one SELF-owned job whose logicalKey IS in the inventory (when the
  // manifest says so), one SELF-owned NON-critical job.
  await call('create', { logical_key: CRITICAL_KEY, name: 'hr dispatch', schedule_kind: 'every', every_ms: 1800000, message: 'must-not-leak' }, trusted('agt_hr'))
  await call('create', { logical_key: 'agt_a:ordinary', name: 'ordinary', schedule_kind: 'every', every_ms: 60000, message: 'ordinary' }, trusted('agt_a'))
  const jobs = (await store.loadDoc({ force: true })).jobs
  const criticalSelfJob = jobs.find((j) => j.logicalKey === CRITICAL_KEY && j.agentId === 'agt_hr')
  const ordinaryJob = jobs.find((j) => j.logicalKey === 'agt_a:ordinary')
  const snapshot = async () => JSON.stringify((await store.loadDoc({ force: true })).jobs)
  const rawStoreBytes = async () => readFile(storePath, 'utf8')
  return { store, call, denialEvents, criticalSelfJob, ordinaryJob, snapshot, rawStoreBytes, storePath, jobsDir: dir }
}

export const criticalManifest = () => ({ version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })

export function createAtArgs(overrides = {}) {
  return {
    name: '提醒',
    logical_key: 'self-test:提醒',
    schedule_kind: 'at',
    at: '15m',
    message: 'SECRET-MESSAGE',
    delivery_mode: 'announce',
    delivery_target: 'current_conversation',
    ...overrides,
  }
}

export function storedDefinitionDigest(job) {
  const { state: _state, ...definition } = structuredClone(job)
  return `sha256:${createHash('sha256').update(canonicalJSON(definition)).digest('hex')}`
}

export function assertExactCommittedResult(result) {
  assert.deepEqual(Object.keys(result).sort(), [
    'auditStatus',
    'autoRetry',
    'deleteAfterRun',
    'enabled',
    'exactPersistedDeliveryDestination',
    'jobId',
    'name',
    'nextRunAt',
    'normalizedSchedule',
    'targetAgentId',
    'timezone',
  ].sort())
}

// ---------------------------------------------------------------------------
// Cross-agent composition rig (shared with ../cross-agent.test.js): real
// AgentDefinition roster + self-service access + engine + router-bridge seam,
// moved here so the cross-agent suite stays under the file-line ceiling.
// ---------------------------------------------------------------------------

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { createRouterInvoker } from '../../../scheduler-router/src/index.js'
import { AgentDefinition } from '../../../agent-definition/src/definition.js'
import { Scheduler } from '../../src/scheduler.js'
import { createRecordingDelivery } from '../../src/seams.js'

export const SOURCE = 'agt_admin'
export const PLAIN = 'agt_plain'
export const TARGET = 'agt_target'
export const DISABLED = 'agt_disabled'
export const GHOST = 'agt_ghost'


export function writeRosterFile(t) {
  const dir = mkdtempSync(join(tmpdir(), 'cross-agent-scheduler-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  writeFileSync(configFile, JSON.stringify({
    version: 1,
    defaultAgentId: TARGET,
    agents: [
      { id: SOURCE, name: 'admin source' },
      { id: PLAIN, name: 'plain agent without manage:any' },
      { id: TARGET, name: 'cross-agent target' },
      { id: DISABLED, name: 'retired-from-routing agent', disabled: true },
    ],
  }))
  return dir
}

/**
 * Full real-path rig. The fake clock is aligned to the real wall clock so
 * the self-service layer's Date.now()-based `at` normalization and the
 * engine's clock stay on one timeline; due-ness is produced by advancing
 * the clock minutes past the mutation instant (well inside the at
 * catch-up grace and far beyond any realistic test runtime).
 */
export async function rig(t, { adminAgents = new Set([SOURCE]), auditAgents = new Set([SOURCE]), routerBehavior, immediateDeadline = false } = {}) {
  const dir = writeRosterFile(t)
  const definition = new AgentDefinition({ configFile: join(dir, 'agents.json') })
  const clock = { value: Date.now() }
  const store = new JobStore(join(dir, 'jobs.json'), {
    runLogPath: join(dir, 'runs.jsonl'),
    clock: () => clock.value,
  })
  const chainCalls = []
  const router = {
    runTurnWithRouteChain: async (agentId, args) => {
      chainCalls.push({ agentId, sessionId: args.sessionId, callerCorrelation: args.opts?.callerCorrelation })
      if (routerBehavior) return routerBehavior(agentId, args, chainCalls)
      return { reply: `done:${agentId}` }
    },
  }
  const bridge = createRouterInvoker(router, { definition, admissions: new Map() })
  const seamRequests = []
  const invoker = (request) => {
    seamRequests.push(request)
    return bridge(request)
  }
  invoker.assertRunnable = bridge.assertRunnable
  invoker.calls = bridge.calls
  const scheduler = new Scheduler({
    store,
    invoker,
    deliver: createRecordingDelivery(),
    concurrency: 2,
    nowMs: () => clock.value,
    ...(immediateDeadline
      ? { deadlineSetTimeout: (fn) => { queueMicrotask(fn); return 1 }, deadlineClearTimeout: () => {} }
      : {}),
  })
  const grantCalls = []
  const access = createSelfServiceSchedulerAccess({
    store,
    assertGrant: async (agentId, scope, resource) => {
      grantCalls.push({ agentId, scope, resource })
      // Independent exact wire proofs (CTR-AUTH-002): admin never satisfies
      // the audit row and audit never satisfies the admin row.
      return (scope === 'scheduler.admin' && adminAgents.has(agentId))
        || (scope === 'scheduler.audit' && auditAgents.has(agentId))
    },
  })
  const call = (action, args, context = trusted(SOURCE)) => access.handlers.scheduler[action](args, context)
  const runsLog = () => existsSync(join(dir, 'runs.jsonl'))
    ? readFileSync(join(dir, 'runs.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    : []
  // The engine lease is a precondition for ANY admission (scheduler.js
  // _tickOnce refuses to run without it) — start exactly like the other
  // engine suites, with the timer and catch-up disabled.
  await scheduler.start({ autoStart: false, catchup: false })
  return { dir, clock, store, definition, invoker, seamRequests, scheduler, call, chainCalls, grantCalls, runsLog }
}


export async function runDue(ctx, advanceMs, { concurrent = false } = {}) {
  ctx.clock.value += advanceMs
  if (concurrent) await Promise.all([ctx.scheduler.tick(), ctx.scheduler.tick()])
  else await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
}

export const createArgs = (overrides = {}) => ({
  name: 'cross-agent job',
  // SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.1: create REQUIRES a stable
  // logical key; deriving it from the override set keeps distinct desired
  // jobs distinct and makes exact replays idempotent.
  logical_key: `cross-agent:${JSON.stringify(overrides ?? {})}`,
  schedule_kind: 'at',
  at: '1m',
  message: 'cross-agent scheduled hello',
  delivery_mode: 'none',
  ...overrides,
})

export async function occurrences(ctx) {
  return (await ctx.store.loadDoc({ force: true })).occurrences
}

export async function jobs(ctx) {
  return (await ctx.store.loadDoc({ force: true })).jobs
}
