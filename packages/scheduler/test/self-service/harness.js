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
