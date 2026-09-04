import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { JobStore } from '../src/store.js'
import { createSelfServiceSchedulerAccess } from '../src/self-service.js'
import { buildOccurrenceRecord, applyTransition, rebuildFences, canonicalJSON } from '../src/occurrence-model.js'

function trusted(agentId = 'agt_a', overrides = {}) {
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

async function rig(t, { adminAgents = new Set(), auditAgents = new Set(), auditFailure = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-self-service-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
  const grantCalls = []
  const auditErrors = []
  if (auditFailure) store.appendRunEvent = async () => ({ ok: false, error: 'injected' })
  const access = createSelfServiceSchedulerAccess({
    store,
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

function createAtArgs(overrides = {}) {
  return {
    name: '提醒',
    schedule_kind: 'at',
    at: '15m',
    message: 'SECRET-MESSAGE',
    delivery_mode: 'announce',
    delivery_target: 'current_conversation',
    ...overrides,
  }
}

function storedDefinitionDigest(job) {
  const { state: _state, ...definition } = structuredClone(job)
  return `sha256:${createHash('sha256').update(canonicalJSON(definition)).digest('hex')}`
}

function assertExactCommittedResult(result) {
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

test('create returns the exact 11-field committed projection and resolves only trusted feishuChatId', async (t) => {
  const { call, store, grantCalls } = await rig(t)
  const context = trusted('agt_a', {
    feishuChatId: 'oc_exact_chat',
    channelConversationId: 'oc_wrong_from_conversation:thread:42',
    feishuConversationId: 'oc_also_wrong:topic:7',
  })
  const out = await call('create', createAtArgs(), context)
  assert.equal(out.ok, true)
  assertExactCommittedResult(out.result)
  assert.deepEqual(out.result.normalizedSchedule, { kind: 'at', at: out.result.nextRunAt })
  assert.equal(out.result.timezone, null)
  assert.deepEqual(out.result.exactPersistedDeliveryDestination, { channel: 'feishu', to: 'chat:oc_exact_chat' })
  assert.equal(out.result.targetAgentId, 'agt_a')
  assert.equal(out.result.autoRetry, false)
  assert.equal(out.result.deleteAfterRun, true)
  assert.equal(out.result.auditStatus, 'appended')
  assert.deepEqual(grantCalls, [], 'ordinary self create performs zero Auth token/grant requests')

  const doc = await store.loadDoc({ force: true })
  const job = doc.jobs[0]
  assert.equal(job.createdAtMs, job.updatedAtMs)
  assert.equal(Date.parse(out.result.nextRunAt) > job.createdAtMs, true, 'at validation and control op share logical nowMs')
  assert.equal(job.delivery.to, 'chat:oc_exact_chat')
})

test('all seven actions use capability id scheduler and ordinary self actions make zero grant requests', async (t) => {
  const { call, store, grantCalls } = await rig(t)
  const created = await call('create', {
    name: 'self', schedule_kind: 'every', every_ms: 60_000, message: 'm',
  })
  const jobId = created.result.jobId
  const everyJob = (await store.loadDoc({ force: true })).jobs.find((job) => job.id === jobId)
  assert.equal(everyJob.schedule.anchorMs, everyJob.createdAtMs, 'self-service every jobs are runnable from their mutation anchor')
  assert.equal((await call('list', {})).ok, true)
  assert.equal((await call('runs', { job_id: jobId })).ok, true)
  const updated = await call('update', { job_id: jobId, name: 'self updated' })
  assert.equal(updated.ok, true)
  assertExactCommittedResult(updated.result)
  assert.equal((await call('disable', { job_id: jobId })).ok, true)
  assert.equal((await call('enable', { job_id: jobId })).ok, true)
  assert.equal((await call('remove', { job_id: jobId })).ok, true)
  assert.deepEqual(grantCalls, [])
})

test('trusted caller/process/turn context is mandatory and forged caller mismatch fails before store access', async (t) => {
  const { call, store, grantCalls } = await rig(t)
  let reads = 0
  const originalLoad = store.loadDoc.bind(store)
  store.loadDoc = async (...args) => { reads += 1; return originalLoad(...args) }

  for (const context of [
    {},
    trusted('agt_a', { callerAgentId: '' }),
    trusted('agt_a', { processGeneration: 0 }),
    trusted('agt_a', { turnExecutionId: '' }),
    trusted('agt_a', { callerAgentId: 'agt_b' }),
  ]) {
    const out = await call('list', {}, context)
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'access_denied')
  }
  assert.equal(reads, 0)
  assert.deepEqual(grantCalls, [])
})

test('current_conversation fails closed for missing/non-Feishu/invalid active chat context', async (t) => {
  const { call, store } = await rig(t)
  for (const context of [
    trusted('agt_a', { channelNamespace: 'web' }),
    trusted('agt_a', { feishuChatId: '' }),
    trusted('agt_a', { feishuChatId: 'bad chat id' }),
  ]) {
    const out = await call('create', createAtArgs(), context)
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'access_denied')
  }
  assert.equal((await store.loadDoc({ force: true })).jobs.length, 0)
})

test('explicit target/destination are admin-only even when values equal self/current destination', async (t) => {
  const { call, store, grantCalls } = await rig(t, { adminAgents: new Set(['agt_admin']) })
  const explicitSelf = await call('create', {
    ...createAtArgs({ delivery_mode: 'none', delivery_target: undefined }),
    target_agent_id: 'agt_a',
  })
  assert.equal(explicitSelf.ok, false)
  assert.equal(explicitSelf.error.code, 'access_denied')

  const explicitDestination = await call('create', createAtArgs({
    delivery_target: undefined,
    destination: { channel: 'feishu', to: 'chat:oc_agt_a' },
  }))
  assert.equal(explicitDestination.ok, false)

  const admin = await call('create', {
    ...createAtArgs({
      delivery_target: undefined,
      destination: { channel: 'feishu', to: 'chat:oc_other' },
    }),
    target_agent_id: 'agt_b',
  }, trusted('agt_admin'))
  assert.equal(admin.ok, true)
  assert.equal(admin.result.targetAgentId, 'agt_b')
  assert.deepEqual(admin.result.exactPersistedDeliveryDestination, { channel: 'feishu', to: 'chat:oc_other' })
  assert.equal((await store.loadDoc({ force: true })).jobs.at(-1).agentId, 'agt_b')
  assert.deepEqual(grantCalls.map((call) => call.scope), [
    'scheduler.admin', 'scheduler.admin', 'scheduler.admin',
  ], 'every cross-agent create/destination proof requests exactly the R8 admin wire scope')
  assert.deepEqual(grantCalls.map((call) => call.resource), ['scheduler', 'scheduler', 'scheduler'])
})

test('V2 proof matrix: foreign control is admin-gated, foreign history is audit-gated, self stays zero-Auth', async (t) => {
  const { call, grantCalls, dir } = await rig(t, { adminAgents: new Set(['agt_admin']), auditAgents: new Set(['agt_admin']) })
  const a = await call('create', { name: 'a', schedule_kind: 'every', every_ms: 1000, message: 'a' }, trusted('agt_a'))
  const b = await call('create', { name: 'b', schedule_kind: 'every', every_ms: 1000, message: 'b' }, trusted('agt_b'))
  assert.deepEqual(grantCalls, [], 'self create performs zero Auth token requests')
  const listA = await call('list', {}, trusted('agt_a'))
  assert.deepEqual(listA.result.jobs.map((job) => job.id), [a.result.jobId])
  assert.equal(JSON.stringify(listA).includes('"message"'), false)
  const selfRuns = await call('runs', { job_id: a.result.jobId }, trusted('agt_a'))
  assert.equal(selfRuns.ok, true)
  assert.deepEqual(grantCalls, [], 'self list/runs perform zero Auth token requests')

  const foreignRuns = await call('runs', { job_id: b.result.jobId }, trusted('agt_a'))
  assert.equal(foreignRuns.ok, false)
  assert.equal(foreignRuns.error.code, 'job_not_found')
  assert.deepEqual(grantCalls, [{ agentId: 'agt_a', scope: 'scheduler.audit', resource: 'scheduler' }],
    'foreign runs consults exactly (scheduler, scheduler.audit) once and nothing else')
  const foreignDisable = await call('disable', { job_id: a.result.jobId }, trusted('agt_b'))
  assert.equal(foreignDisable.ok, false)
  assert.equal(foreignDisable.error.code, 'access_denied')
  assert.deepEqual(grantCalls.at(-1), { agentId: 'agt_b', scope: 'scheduler.admin', resource: 'scheduler' },
    'foreign control consults exactly (scheduler, scheduler.admin)')
  assert.equal(JSON.stringify(foreignDisable).includes('"message"'), false)
  assert.equal(JSON.stringify(foreignDisable).includes('agt_a'), false, 'denial discloses no owner identity')
  const events = (await readFile(join(dir, 'runs.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  assert.deepEqual(events.map((event) => event.operation), ['create', 'create'],
    'denied foreign mutation appends no success audit record')

  const adminDisable = await call('disable', { job_id: a.result.jobId }, trusted('agt_admin'))
  assert.equal(adminDisable.ok, true)
  assert.deepEqual(grantCalls.at(-1), { agentId: 'agt_admin', scope: 'scheduler.admin', resource: 'scheduler' })
  assert.equal(grantCalls.every((c) => c.scope === 'scheduler.admin' || c.scope === 'scheduler.audit'), true)
  assert.equal(grantCalls.some((c) => c.scope === 'scheduler.manage:any' || c.scope === 'scheduler.manage-any'), false,
    'no colon-form local label or hyphen alias is ever requested on the wire')
})

test('foreign update/enable/disable/remove each request exactly (scheduler, scheduler.admin) once; self update stays zero-Auth', async (t) => {
  const { call, grantCalls } = await rig(t, { adminAgents: new Set(['agt_admin']) })
  const owned = await call('create', { name: 'owned', schedule_kind: 'every', every_ms: 1000, message: 'SECRET-MESSAGE' }, trusted('agt_plain'))
  const jobId = owned.result.jobId
  const foreignUpdate = await call('update', { job_id: jobId, name: 'renamed by admin' }, trusted('agt_admin'))
  assert.equal(foreignUpdate.ok, true)
  assert.equal(foreignUpdate.result.targetAgentId, 'agt_plain')
  assert.deepEqual(grantCalls, [{ agentId: 'agt_admin', scope: 'scheduler.admin', resource: 'scheduler' }],
    'one foreign update = exactly one admin wire proof')

  for (const action of ['enable', 'disable', 'remove']) {
    grantCalls.length = 0
    const out = await call(action, { job_id: jobId }, trusted('agt_admin'))
    assert.equal(out.ok, true)
    assert.deepEqual(grantCalls, [{ agentId: 'agt_admin', scope: 'scheduler.admin', resource: 'scheduler' }],
      `foreign ${action} = exactly one (scheduler, scheduler.admin) request`)
  }

  const own = await call('create', { name: 'own', schedule_kind: 'every', every_ms: 1000, message: 'm' }, trusted('agt_admin'))
  grantCalls.length = 0
  const selfUpdate = await call('update', { job_id: own.result.jobId, name: 'self rename' }, trusted('agt_admin'))
  assert.equal(selfUpdate.ok, true)
  assert.deepEqual(grantCalls, [], 'self update never requests a token')
})

test('runs(all_agents=true) needs exactly (scheduler, scheduler.audit); admin alone reveals no history; audit alone mutates nothing', async (t) => {
  const { call, grantCalls } = await rig(t, { adminAgents: new Set(['agt_admin']) })
  await call('create', { name: 'a', schedule_kind: 'every', every_ms: 1000, message: 'a' }, trusted('agt_a'))
  const b = await call('create', { name: 'b', schedule_kind: 'every', every_ms: 1000, message: 'b' }, trusted('agt_b'))

  const adminGlobalRuns = await call('runs', { all_agents: true }, trusted('agt_admin'))
  assert.equal(adminGlobalRuns.ok, false)
  assert.equal(adminGlobalRuns.error.code, 'access_denied')
  assert.deepEqual(grantCalls, [{ agentId: 'agt_admin', scope: 'scheduler.audit', resource: 'scheduler' }],
    'exactly the audit wire proof is requested for the global-history row; admin possession is never consulted, substituted, or dual-requested')
  grantCalls.length = 0
  const adminForeignRuns = await call('runs', { job_id: b.result.jobId }, trusted('agt_admin'))
  assert.equal(adminForeignRuns.ok, false)
  assert.equal(adminForeignRuns.error.code, 'job_not_found')
  assert.deepEqual(grantCalls, [{ agentId: 'agt_admin', scope: 'scheduler.audit', resource: 'scheduler' }])
  assert.equal(JSON.stringify(adminForeignRuns).includes('occurrences'), false, 'no history disclosure on admin-only denial')

  const auditRig = await rig(t, { auditAgents: new Set(['agt_audit']) })
  const createdA = await auditRig.call('create', { name: 'a', schedule_kind: 'every', every_ms: 1000, message: 'a' }, trusted('agt_a'))
  const createdB = await auditRig.call('create', { name: 'b', schedule_kind: 'every', every_ms: 1000, message: 'b' }, trusted('agt_b'))
  assert.deepEqual(auditRig.grantCalls, [])
  const globalRuns = await auditRig.call('runs', { all_agents: true }, trusted('agt_audit'))
  assert.equal(globalRuns.ok, true)
  assert.deepEqual(auditRig.grantCalls, [{ agentId: 'agt_audit', scope: 'scheduler.audit', resource: 'scheduler' }])
  auditRig.grantCalls.length = 0
  const foreignRuns = await auditRig.call('runs', { job_id: createdB.result.jobId }, trusted('agt_audit'))
  assert.equal(foreignRuns.ok, true)
  assert.deepEqual(auditRig.grantCalls, [{ agentId: 'agt_audit', scope: 'scheduler.audit', resource: 'scheduler' }])
  auditRig.grantCalls.length = 0
  const auditMutate = await auditRig.call('disable', { job_id: createdA.result.jobId }, trusted('agt_audit'))
  assert.equal(auditMutate.ok, false)
  assert.deepEqual(auditRig.grantCalls, [{ agentId: 'agt_audit', scope: 'scheduler.admin', resource: 'scheduler' }],
    'the audit proof alone never authorizes foreign control; the separate admin proof is requested and denied')
})

test('list(all_agents=true) is denied before any store read with zero Auth requests regardless of held scopes', async (t) => {
  const { call, grantCalls, store, storeReads, dir } = await rig(t, {
    adminAgents: new Set(['agt_admin', 'agt_both']),
    auditAgents: new Set(['agt_audit', 'agt_both']),
  })
  const a = await call('create', { name: 'a', schedule_kind: 'every', every_ms: 1000, message: 'SECRET-MESSAGE' }, trusted('agt_a'))
  const b = await call('create', { name: 'b', schedule_kind: 'every', every_ms: 1000, message: 'b' }, trusted('agt_b'))
  assert.deepEqual(grantCalls, [])
  const readsBefore = storeReads()

  let baseline
  for (const agentId of ['agt_both', 'agt_admin', 'agt_audit', 'agt_none']) {
    const denial = await call('list', { all_agents: true }, trusted(agentId))
    assert.equal(denial.ok, false)
    assert.equal(denial.error.code, 'access_denied')
    baseline ??= JSON.stringify(denial)
    assert.equal(JSON.stringify(denial), baseline, `stable identical denial for ${agentId}`)
    assert.equal(JSON.stringify(denial).includes('SECRET-MESSAGE'), false)
    assert.equal(JSON.stringify(denial).includes(a.result.jobId), false)
    assert.equal(JSON.stringify(denial).includes(b.result.jobId), false)
    assert.equal(JSON.stringify(denial).includes('agt_a'), false, 'no owner identity disclosure')
  }
  assert.deepEqual(grantCalls, [], 'list(all_agents=true) makes zero Auth requests even with admin, audit, both, or neither')
  assert.equal(storeReads(), readsBefore, 'list(all_agents=true) performs zero store reads')
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.length, 2, 'no mutation on the denied path')
  const events = (await readFile(join(dir, 'runs.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  assert.deepEqual(events.map((event) => event.operation), ['create', 'create'],
    'the denied global list appends no success audit record')
})

test('auth denial/error/uncertainty fails closed with exactly one proof attempt and no fallback spelling', async (t) => {
  for (const mode of ['deny', 'throw']) {
    const dir = await mkdtemp(join(tmpdir(), 'scheduler-self-service-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const store = new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
    const attempts = []
    const access = createSelfServiceSchedulerAccess({
      store,
      assertGrant: async (agentId, scope, resource) => {
        attempts.push({ agentId, scope, resource })
        if (mode === 'throw') throw new Error('auth unavailable')
        return false
      },
    })
    const call = (action, args, context = trusted()) => access.handlers.scheduler[action](args, context)

    const selfCreate = await call('create', { name: 'owned', schedule_kind: 'every', every_ms: 1000, message: 'SECRET-MESSAGE' })
    assert.equal(selfCreate.ok, true)
    assert.deepEqual(attempts, [], `self create performs zero Auth requests even when the seam would ${mode}`)

    attempts.length = 0
    const denied = await call('create', createAtArgs({
      delivery_mode: 'none', delivery_target: undefined, target_agent_id: 'agt_other',
    }))
    assert.equal(denied.ok, false)
    assert.equal(denied.error.code, 'access_denied')
    assert.deepEqual(attempts, [{ agentId: 'agt_a', scope: 'scheduler.admin', resource: 'scheduler' }],
      `exactly one admin proof attempt under ${mode}; no alias, second spelling, or fallback request`)
    assert.equal(JSON.stringify(denied).includes('SECRET-MESSAGE'), false)
    assert.equal((await store.loadDoc({ force: true })).jobs.some((job) => job.agentId === 'agt_other'), false,
      'no mutation after proof denial')

    attempts.length = 0
    const globalList = await call('list', { all_agents: true })
    assert.equal(globalList.ok, false)
    assert.equal(globalList.error.code, 'access_denied')
    assert.deepEqual(attempts, [], `global list denial makes zero Auth requests even when the seam would ${mode}`)
  }
})

test('update uses updateJobOp semantics, preserves omitted fields, and returns committed normalized evidence', async (t) => {
  const { call, store } = await rig(t)
  const created = await call('create', {
    name: 'daily', schedule_kind: 'cron', cron_expr: '5 9 * * 1-5', timezone: 'Asia/Shanghai',
    message: 'old', timeout: 30, light_context: true, model: 'm1', auto_retry: true,
  })
  const before = (await store.loadDoc({ force: true })).jobs[0]
  const updated = await call('update', {
    job_id: created.result.jobId,
    name: 'daily changed',
    schedule_kind: 'at', at: '30m',
    message: 'new', auto_retry: false, delete_after_run: false,
  })
  assert.equal(updated.ok, true)
  assertExactCommittedResult(updated.result)
  assert.equal(updated.result.jobId, created.result.jobId)
  assert.equal(updated.result.name, 'daily changed')
  assert.equal(updated.result.normalizedSchedule.kind, 'at')
  assert.equal(updated.result.timezone, null)
  assert.equal(updated.result.nextRunAt !== null, true)
  assert.equal(updated.result.autoRetry, false)
  assert.equal(updated.result.deleteAfterRun, false)

  const after = (await store.loadDoc({ force: true })).jobs[0]
  assert.equal(after.id, before.id)
  assert.equal(after.scheduleRevision, before.scheduleRevision + 1)
  assert.equal(after.payload.timeoutSeconds, 30, 'omitted payload fields are preserved')
  assert.equal(after.payload.lightContext, true)
  assert.equal(after.payload.model, 'm1')
  assert.equal(after.updatedAtMs, after.revisionActivatedAtMs, 'update control op receives the same logical nowMs')
})

test('fenced enabled update commits with nextRunAt null and does not clear or replay the fence', async (t) => {
  const { call, store } = await rig(t)
  const created = await call('create', {
    name: 'fenced', schedule_kind: 'every', every_ms: 60_000, message: 'm',
  })
  const jobId = created.result.jobId
  await store.mutateDoc((doc) => {
    const job = doc.jobs.find((candidate) => candidate.id === jobId)
    const occurrence = buildOccurrenceRecord({
      job, kind: 'natural', nominalScheduledAt: job.createdAtMs + 60_000, admittedAt: job.createdAtMs + 60_000,
    })
    applyTransition(occurrence, { to: 'outcome_unknown', at: job.createdAtMs + 60_001, reason: 'injected unknown' })
    doc.occurrences.push(occurrence)
    doc.fences = rebuildFences(doc.occurrences)
  })
  const before = await store.loadDoc({ force: true })
  const fence = structuredClone(before.fences[jobId])
  const occurrenceCount = before.occurrences.length

  const updated = await call('update', { job_id: jobId, name: 'still fenced' })
  assert.equal(updated.ok, true)
  assert.equal(updated.result.enabled, true)
  assert.equal(updated.result.nextRunAt, null)
  const after = await store.loadDoc({ force: true })
  assert.deepEqual(after.fences[jobId], fence)
  assert.equal(after.occurrences.length, occurrenceCount)
})

test('ownership is rechecked inside the locked control mutation (TOCTOU fails closed)', async (t) => {
  const { call, store, grantCalls } = await rig(t)
  const created = await call('create', { name: 'owned', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  const jobId = created.result.jobId
  const originalLoad = store.loadDoc.bind(store)
  let swapped = false
  store.loadDoc = async (...args) => {
    const snapshot = await originalLoad(...args)
    if (!swapped) {
      swapped = true
      await store.mutateDoc((doc) => { doc.jobs.find((job) => job.id === jobId).agentId = 'agt_b' })
    }
    return snapshot
  }
  const out = await call('update', { job_id: jobId, name: 'must-not-commit' })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'access_denied')
  const doc = await originalLoad({ force: true })
  assert.equal(doc.jobs[0].agentId, 'agt_b')
  assert.equal(doc.jobs[0].name, 'owned')
  assert.deepEqual(grantCalls, [])
})

test('locked update preserves concurrently changed omitted fields and audits the exact preimage', async (t) => {
  const { call, store, dir } = await rig(t)
  const created = await call('create', {
    name: 'merge', schedule_kind: 'every', every_ms: 60_000, message: 'old', timeout: 30,
  })
  const jobId = created.result.jobId
  const originalLoad = store.loadDoc.bind(store)
  let concurrentDefinition
  let injected = false
  store.loadDoc = async (...args) => {
    const snapshot = await originalLoad(...args)
    if (!injected) {
      injected = true
      await store.mutateDoc((doc) => {
        const job = doc.jobs.find((candidate) => candidate.id === jobId)
        job.payload.timeoutSeconds = 99
      })
      concurrentDefinition = (await originalLoad({ force: true })).jobs.find((job) => job.id === jobId)
    }
    return snapshot
  }
  const out = await call('update', { job_id: jobId, message: 'new' })
  assert.equal(out.ok, true)
  const finalJob = (await originalLoad({ force: true })).jobs.find((job) => job.id === jobId)
  assert.equal(finalJob.payload.message, 'new')
  assert.equal(finalJob.payload.timeoutSeconds, 99)
  const events = (await readFile(join(dir, 'runs.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  const updateAudit = events.findLast((event) => event.operation === 'update')
  assert.equal(updateAudit.beforeDigest, storedDefinitionDigest(concurrentDefinition))
})

test('live post-rename fault returns known committed projection and attempts one audit append', async (t) => {
  const { call, store } = await rig(t)
  let syncCalls = 0
  let auditAttempts = 0
  store._syncDir = async () => { syncCalls += 1; throw new Error('injected directory sync failure after rename') }
  store.appendRunEvent = async () => { auditAttempts += 1; return { ok: true } }
  const out = await call('create', { name: 'durable', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(out.ok, true)
  assertExactCommittedResult(out.result)
  assert.equal(out.result.auditStatus, 'appended')
  assert.equal(syncCalls, 1)
  assert.equal(auditAttempts, 1)
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.some((job) => job.id === out.result.jobId), true)
})

test('pre-commit failure is known clean; uncertain commit failure is outcome-unknown with zero retry', async (t) => {
  const first = await rig(t)
  first.store.beforeCommit = async () => { throw new Error('before commit') }
  const clean = await first.call('create', { name: 'clean-fail', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(clean.ok, false)
  assert.equal(clean.error.code, 'internal_error')
  assert.equal((await first.store.loadDoc({ force: true })).jobs.length, 0)

  const scopedReadFailure = await rig(t)
  const scopedJob = await scopedReadFailure.call('create', {
    name: 'scoped-read', schedule_kind: 'every', every_ms: 60_000, message: 'm',
  })
  scopedReadFailure.store.loadDoc = async () => { throw new Error('injected authorization snapshot failure') }
  const scopedKnown = await scopedReadFailure.call('update', { job_id: scopedJob.result.jobId, name: 'never' })
  assert.equal(scopedKnown.ok, false)
  assert.equal(scopedKnown.error.code, 'internal_error')

  const readFailure = await rig(t)
  readFailure.store._loadDocForMutation = async () => { throw new Error('injected pre-write load failure') }
  const known = await readFailure.call('create', { name: 'read-fail', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(known.ok, false)
  assert.equal(known.error.code, 'internal_error')

  const lockFailure = await rig(t)
  lockFailure.store._withLock = async () => { throw new Error('injected lock acquisition failure') }
  const noLock = await lockFailure.call('create', { name: 'lock-fail', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(noLock.ok, false)
  assert.equal(noLock.error.code, 'internal_error')

  const renameFailure = await rig(t)
  renameFailure.store.beforeCommit = async () => { await mkdir(renameFailure.store.filePath) }
  const noRename = await renameFailure.call('create', {
    name: 'rename-fail', schedule_kind: 'every', every_ms: 60_000, message: 'm',
  })
  assert.equal(noRename.ok, false)
  assert.equal(noRename.error.code, 'internal_error', 'a rejected commit-point rename proves no mutation')

  const second = await rig(t)
  let attempts = 0
  second.store._writeAtomicDoc = async () => {
    attempts += 1
    throw Object.assign(new Error('rename outcome unavailable'), { mutationOutcome: 'unknown' })
  }
  const unknown = await second.call('create', { name: 'unknown', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'mutation_outcome_unknown')
  assert.equal(attempts, 1)
})

test('audit append failure returns known committed result, logs sanitized coordinates, and does not retry', async (t) => {
  const { call, store, auditErrors } = await rig(t, { auditFailure: true })
  let appendAttempts = 0
  store.appendRunEvent = async () => { appendAttempts += 1; return { ok: false, error: 'SECRET-MESSAGE' } }
  const created = await call('create', createAtArgs({ delivery_mode: 'none', delivery_target: undefined }))
  assert.equal(created.ok, true)
  assert.equal(created.result.auditStatus, 'append_failed')
  assertExactCommittedResult(created.result)
  assert.equal(appendAttempts, 1)
  assert.equal((await store.loadDoc({ force: true })).jobs.length, 1, 'known definition commit is not rolled back')
  assert.deepEqual(auditErrors, [{ operation: 'create', jobId: created.result.jobId }])
  assert.equal(JSON.stringify(auditErrors).includes('SECRET-MESSAGE'), false)
})

test('mutation audit is one sanitized append per committed mutation', async (t) => {
  const { call, dir } = await rig(t)
  const created = await call('create', { name: 'x', schedule_kind: 'every', every_ms: 1000, message: 'TOP-SECRET' })
  await call('update', { job_id: created.result.jobId, name: 'y' })
  await call('disable', { job_id: created.result.jobId })
  await call('enable', { job_id: created.result.jobId })
  await call('remove', { job_id: created.result.jobId })
  const events = (await readFile(join(dir, 'runs.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  assert.deepEqual(events.map((event) => event.operation), ['create', 'update', 'disable', 'enable', 'remove'])
  assert.equal(events.every((event) => event.action === 'self_service_mutation'), true)
  assert.equal(events.every((event) => event.operatorAgentId === 'agt_a' && event.targetAgentId === 'agt_a'), true)
  assert.equal(JSON.stringify(events).includes('TOP-SECRET'), false)
})

test('remove retains occurrence authority but ordinary self runs becomes not-found post-delete', async (t) => {
  const { call, store } = await rig(t)
  const created = await call('create', { name: 'x', schedule_kind: 'every', every_ms: 1000, message: 'm' })
  const jobId = created.result.jobId
  await store.mutateDoc((doc) => {
    const job = doc.jobs.find((candidate) => candidate.id === jobId)
    const occurrence = buildOccurrenceRecord({
      job, kind: 'natural', nominalScheduledAt: job.createdAtMs + 1000, admittedAt: job.createdAtMs + 1000,
    })
    applyTransition(occurrence, {
      to: 'running', at: job.createdAtMs + 1001, reason: 'start', startedAt: job.createdAtMs + 1001,
    })
    applyTransition(occurrence, {
      to: 'succeeded', at: job.createdAtMs + 1002, reason: 'done', endedAt: job.createdAtMs + 1002,
      executionOutcome: 'succeeded', deliveryStatus: 'delivered',
    })
    doc.occurrences.push(occurrence)
  })
  assert.equal((await call('runs', { job_id: jobId })).result.occurrences.length, 1)
  assert.equal((await call('remove', { job_id: jobId })).ok, true)
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.some((job) => job.id === jobId), false)
  assert.equal(doc.occurrences.some((occurrence) => occurrence.jobId === jobId), true)
  const hidden = await call('runs', { job_id: jobId })
  assert.equal(hidden.ok, false)
  assert.equal(hidden.error.code, 'job_not_found')
})

test('past one-shot create/update fail before control mutation', async (t) => {
  const { call, store } = await rig(t)
  const badCreate = await call('create', createAtArgs({ at: '2020-01-01T00:00:00Z', delivery_mode: 'none', delivery_target: undefined }))
  assert.equal(badCreate.ok, false)
  assert.equal((await store.loadDoc({ force: true })).jobs.length, 0)

  const created = await call('create', { name: 'x', schedule_kind: 'every', every_ms: 1000, message: 'm' })
  const before = (await store.loadDoc({ force: true })).jobs[0]
  const badUpdate = await call('update', {
    job_id: created.result.jobId, schedule_kind: 'at', at: '2020-01-01T00:00:00Z',
  })
  assert.equal(badUpdate.ok, false)
  const after = (await store.loadDoc({ force: true })).jobs[0]
  assert.equal(after.scheduleRevision, before.scheduleRevision)
})
