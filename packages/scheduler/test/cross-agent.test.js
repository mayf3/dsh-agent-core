/**
 * Cross-Agent Scheduler integration-readiness suite.
 *
 * Governing authority: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2 (accepted
 * 2026-09-03; supersedes V1) DEC-008/CTR-AUTH-002 exact external proof
 * mapping — cross-Agent definition mutation/control/destination proves local
 * scheduler.manage:any ONLY through (scheduler, scheduler.admin); global or
 * foreign execution history requires (scheduler, scheduler.audit);
 * list(all_agents=true) is normatively unavailable (stable fail-closed, zero
 * Auth, zero store reads) — plus D-007 SCHEDULER_OCCURRENCE_OUTCOME_V2
 * execution semantics. No product code is exercised here beyond the shipped
 * origin/main implementation; these tests pin the CROSS-AGENT behavior on the
 * REAL composition:
 *
 *   self-service access layer (authorization/ownership/audit)
 *     -> JobStore (durable v2 document + runs.jsonl evidence)
 *     -> Scheduler engine (occurrence exactly-once, fence)
 *     -> scheduler-router bridge (assertRunnable + route-chain seam)
 *     -> real AgentDefinition roster (unknown/disabled fail closed)
 *
 * The Router process boundary is stubbed at `runTurnWithRouteChain` — the
 * same published seam the production bridge is allowed to call — and the
 * target Agent's execution identity is observed through the seam request.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'
import { createSelfServiceSchedulerAccess } from '../src/self-service.js'
import { createRecordingDelivery } from '../src/seams.js'
import { createRouterInvoker } from '../../scheduler-router/src/index.js'
import { AgentDefinition } from '../../agent-definition/src/definition.js'

const SOURCE = 'agt_admin'
const PLAIN = 'agt_plain'
const TARGET = 'agt_target'
const DISABLED = 'agt_disabled'
const GHOST = 'agt_ghost'

/** The frozen scheduler -> Router seam request contract (occurrence.js invokeWithDeadline). */
const SEAM_REQUEST_KEYS = [
  'agentId', 'deliveryTarget', 'lightContext', 'message', 'model', 'occurrenceId',
  'onStart', 'payloadHash', 'requestId', 'runId', 'sessionId', 'signal', 'timeoutMs',
].sort()

function trusted(agentId) {
  return {
    agentId,
    callerAgentId: agentId,
    processGeneration: 7,
    turnExecutionId: `turn:${agentId}:7:1`,
    channelNamespace: 'feishu',
    channelConversationId: 'thread:must-not-be-parsed',
    feishuChatId: `oc_${agentId}`,
    feishuMessageId: 'om_1',
  }
}

function writeRosterFile(t) {
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
async function rig(t, { adminAgents = new Set([SOURCE]), auditAgents = new Set([SOURCE]), routerBehavior, immediateDeadline = false } = {}) {
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

async function runDue(ctx, advanceMs, { concurrent = false } = {}) {
  ctx.clock.value += advanceMs
  if (concurrent) await Promise.all([ctx.scheduler.tick(), ctx.scheduler.tick()])
  else await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()
}

const createArgs = (overrides = {}) => ({
  name: 'cross-agent job',
  schedule_kind: 'at',
  at: '1m',
  message: 'cross-agent scheduled hello',
  delivery_mode: 'none',
  ...overrides,
})

async function occurrences(ctx) {
  return (await ctx.store.loadDoc({ force: true })).occurrences
}

async function jobs(ctx) {
  return (await ctx.store.loadDoc({ force: true })).jobs
}

test('CROSS-AGENT-1 admin-authorized source -> enabled target: exactly one Run executes as the target Agent', async (t) => {
  const ctx = await rig(t)
  const created = await ctx.call('create', createArgs({ target_agent_id: TARGET }))
  assert.equal(created.ok, true, JSON.stringify(created))
  assert.equal(created.result.targetAgentId, TARGET)
  assert.equal((await jobs(ctx))[0].agentId, TARGET)

  await runDue(ctx, 5 * 60_000)

  assert.equal(ctx.invoker.calls.length, 1)
  assert.equal(ctx.chainCalls[0].agentId, TARGET, 'the route chain is entered AS the target agent')
  assert.equal(ctx.seamRequests[0].agentId, TARGET)
  assert.match(ctx.seamRequests[0].sessionId, /^cron-run-/, 'fresh non-main native Session per occurrence (D-007 §14)')
  const correlation = ctx.chainCalls[0].callerCorrelation
  assert.equal(correlation.requestId, correlation.occurrenceId, 'idempotencyKey is occurrence-bound')
  assert.equal(typeof correlation.runId, 'string')
  const record = (await occurrences(ctx))[0]
  assert.equal(record.state, 'succeeded')
  assert.equal(record.jobId, created.result.jobId)
  assert.equal(ctx.invoker.calls.every((entry) => entry.agentId === TARGET), true, 'the source agent is never invoked')
})

test('CROSS-AGENT-2 cron job targets another Agent: every occurrence runs as the target with fresh sessions', async (t) => {
  const ctx = await rig(t)
  const created = await ctx.call('create', createArgs({
    schedule_kind: 'cron', cron_expr: '* * * * *', timezone: 'UTC', target_agent_id: TARGET, at: undefined,
  }))
  assert.equal(created.ok, true, JSON.stringify(created))

  await runDue(ctx, 5 * 60_000)
  await runDue(ctx, 5 * 60_000)

  assert.equal(ctx.invoker.calls.length, 2)
  assert.equal(ctx.chainCalls.every((entry) => entry.agentId === TARGET), true)
  const records = await occurrences(ctx)
  assert.equal(records.length, 2)
  assert.equal(new Set(records.map((record) => record.occurrenceId)).size, 2, 'distinct occurrence identities')
  assert.equal(new Set(records.map((record) => record.nativeSessionId)).size, 2, 'fresh non-main session per occurrence')
  assert.equal(new Set(ctx.seamRequests.map((request) => request.sessionId)).size, 2)
  assert.equal(records.every((record) => record.state === 'succeeded'), true)
})

test('CROSS-AGENT-3 every job targets another Agent: fixed-rate occurrences run as the target Agent', async (t) => {
  const ctx = await rig(t)
  const created = await ctx.call('create', createArgs({
    schedule_kind: 'every', every_ms: 60_000, target_agent_id: TARGET, at: undefined,
  }))
  assert.equal(created.ok, true, JSON.stringify(created))

  await runDue(ctx, 5 * 60_000)
  await runDue(ctx, 5 * 60_000)

  assert.equal(ctx.invoker.calls.length, 2)
  assert.equal(ctx.chainCalls.every((entry) => entry.agentId === TARGET), true)
  const records = await occurrences(ctx)
  assert.equal(records.length, 2)
  assert.equal(records.every((record) => record.state === 'succeeded'), true)
})

test('CROSS-AGENT-4 at + deleteAfterRun: the cross-agent definition is removed after success and the occurrence evidence is retained', async (t) => {
  const ctx = await rig(t)
  const created = await ctx.call('create', createArgs({ target_agent_id: TARGET, delete_after_run: true }))
  const jobId = created.result.jobId
  assert.equal(created.ok, true, JSON.stringify(created))

  await runDue(ctx, 5 * 60_000)

  assert.equal((await jobs(ctx)).length, 0, 'one-shot definition deleted after terminal success')
  const records = await occurrences(ctx)
  assert.equal(records.length, 1, 'occurrence evidence survives the definition deletion (D-007 §9.1)')
  assert.equal(records[0].jobId, jobId)
  assert.equal(records[0].state, 'succeeded')
  const evidence = ctx.runsLog().filter((event) => event.action === 'occurrence_reserved')
  assert.equal(evidence.length, 1, 'the job -> occurrence -> Run linkage stays in the evidence log after deletion')

  const adminRuns = await ctx.call('runs', { all_agents: true })
  assert.equal(adminRuns.ok, true)
  assert.deepEqual(ctx.grantCalls.at(-1), { agentId: SOURCE, scope: 'scheduler.audit', resource: 'scheduler' },
    'runs(all_agents=true) proves exactly (scheduler, scheduler.audit) once')
  assert.equal(adminRuns.result.occurrences.length, 0,
    'tool-surface run visibility is derived from LIVE jobs; post-delete evidence stays in the occurrence authority store (queryable post-delete surface = RUN_HISTORY follow-up debt)')
})

test('CROSS-AGENT-5 unknown target fails closed at admission: no Router entry, no occurrence record, job stays enabled', async (t) => {
  const ctx = await rig(t)
  const created = await ctx.call('create', createArgs({ target_agent_id: GHOST }))
  assert.equal(created.ok, true, 'definition-time validation is schema-only; roster authority applies at admission')
  const jobId = created.result.jobId

  await assert.rejects(() => runDue(ctx, 5 * 60_000), (error) => error.code === 'AGENT_NOT_FOUND')
  assert.equal(ctx.chainCalls.length, 0, 'the route chain is never reached for an unknown target')
  assert.equal((await occurrences(ctx)).length, 0, 'no admission is persisted for an unknown target')

  await assert.rejects(() => runDue(ctx, 0), (error) => error.code === 'AGENT_NOT_FOUND',
    'the job is not silently skipped or executed: every admission attempt fails closed')
  assert.equal((await jobs(ctx))[0].id, jobId)
  assert.equal((await jobs(ctx))[0].enabled, true)
})

test('CROSS-AGENT-6 disabled target fails closed at admission (AGENT_DISABLED, pre-start)', async (t) => {
  const ctx = await rig(t)
  await ctx.call('create', createArgs({ target_agent_id: DISABLED }))

  await assert.rejects(() => runDue(ctx, 5 * 60_000), (error) => error.code === 'AGENT_DISABLED')
  assert.equal(ctx.chainCalls.length, 0)
  assert.equal((await occurrences(ctx)).length, 0)
  assert.notEqual(ctx.definition.getAgent(DISABLED), undefined, 'the disabled agent stays readable in the roster — it is just not runnable')
})

test('CROSS-AGENT-7 source with self-service scheduler access but no scheduler.manage:any cannot target another Agent', async (t) => {
  const ctx = await rig(t, { adminAgents: new Set() })
  const denied = await ctx.call('create', createArgs({ target_agent_id: TARGET }), trusted(PLAIN))
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'access_denied')
  assert.deepEqual(denied.error.detail, 'scheduler.manage:any grant required for explicit target or destination')
  assert.equal((await jobs(ctx)).length, 0, 'no store mutation without authorization')
  assert.deepEqual(ctx.grantCalls, [{ agentId: PLAIN, scope: 'scheduler.admin', resource: 'scheduler' }],
    'the exact R8 admin wire scope is consulted at the trusted Auth seam and nothing else')
  assert.equal(ctx.grantCalls.some((call) => call.scope === 'scheduler.manage:any' || call.scope === 'scheduler.manage-any'), false,
    'the colon-form local label and hyphen alias never reach the wire')
})

test('CROSS-AGENT-8 explicit targeting requires the admin scope even when the target equals the caller (least privilege)', async (t) => {
  const ctx = await rig(t, { adminAgents: new Set() })
  const denied = await ctx.call('create', createArgs({ target_agent_id: PLAIN }), trusted(PLAIN))
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'access_denied')
  assert.equal((await jobs(ctx)).length, 0)
})

test('CROSS-AGENT-9 the target Run request carries ONLY the target identity — no source Principal/Grant/credential propagation', async (t) => {
  const ctx = await rig(t)
  await ctx.call('create', createArgs({ target_agent_id: TARGET }))
  await runDue(ctx, 5 * 60_000)
  assert.equal(ctx.seamRequests.length, 1)

  const request = ctx.seamRequests[0]
  assert.deepEqual(Object.keys(request).sort(), SEAM_REQUEST_KEYS, 'the seam request is exactly the frozen contract surface')
  assert.equal(request.agentId, TARGET)

  const forbidden = /principal|credential|clientsecret|authorization|bearer|grant|calleragent|sourceagent|impersonat/i
  const seen = []
  const walk = (value, key) => {
    if (key !== undefined && forbidden.test(key)) seen.push(key)
    if (value === null || typeof value !== 'object') return
    for (const [childKey, childValue] of Object.entries(value)) walk(childValue, childKey)
  }
  walk(request, undefined)
  assert.deepEqual(seen, [], 'no source identity/credential/grant material anywhere in the target Run request')
})

test('CROSS-AGENT-10 concurrent due ticks admit exactly ONE cross-agent occurrence (duplicate admission produces no second Run)', async (t) => {
  const ctx = await rig(t)
  await ctx.call('create', createArgs({
    schedule_kind: 'every', every_ms: 60_000, target_agent_id: TARGET, at: undefined,
  }))
  await runDue(ctx, 5 * 60_000, { concurrent: true })
  await ctx.scheduler.tick()
  await ctx.scheduler.whenIdle()

  assert.equal(ctx.invoker.calls.length, 1, 'one occurrence -> at most one admitted Run')
  assert.equal((await occurrences(ctx)).length, 1)
})

test('CROSS-AGENT-11 timeout without termination proof: outcome_unknown fences the cross-agent job and is never replayed', async (t) => {
  const ctx = await rig(t, {
    immediateDeadline: true,
    routerBehavior: (agentId, args) => {
      args.opts.onDispatch()
      return new Promise(() => {})
    },
  })
  await ctx.call('create', createArgs({
    schedule_kind: 'every', every_ms: 60_000, target_agent_id: TARGET, at: undefined,
  }))

  await runDue(ctx, 5 * 60_000)
  assert.equal(ctx.chainCalls.length, 1, 'the unproven Run entered the route chain exactly once')
  const doc = await ctx.store.loadDoc({ force: true })
  const record = doc.occurrences[0]
  assert.equal(record.state, 'outcome_unknown')
  assert.notEqual(doc.fences[record.jobId], undefined, 'execution fence commits atomically with the unknown outcome')

  await runDue(ctx, 10 * 60_000)
  assert.equal(ctx.chainCalls.length, 1, 'no automatic replay of an unproven remote start')
  assert.equal(ctx.invoker.calls.length, 0, 'the hung seam call never settled, so it never re-enters the chain')
  const after = await ctx.store.loadDoc({ force: true })
  assert.equal(after.occurrences.length, 1)
  assert.notEqual(after.fences[record.jobId], undefined)
})

test('CROSS-AGENT-12 proven pre-start target runtime failure is recorded as failed without fencing the job', async (t) => {
  const ctx = await rig(t, {
    routerBehavior: () => {
      throw new Error('route chain unavailable for target runtime')
    },
  })
  const created = await ctx.call('create', createArgs({ target_agent_id: TARGET }))
  await runDue(ctx, 5 * 60_000)

  assert.equal(ctx.invoker.calls.length, 1)
  const record = (await occurrences(ctx))[0]
  assert.equal(record.state, 'failed', 'proven pre-start rejection (the turn never began)')
  const doc = await ctx.store.loadDoc({ force: true })
  assert.equal(doc.fences[created.result.jobId], undefined, 'an ordinary proven failure does not fence the job')
})

test('CROSS-AGENT-13 missing target credential fails closed at the Router boundary: failed Run, no source fallback, no automatic replay', async (t) => {
  const ctx = await rig(t, {
    routerBehavior: () => {
      throw new Error('scheduler-router: no DSH credential for target agent')
    },
  })
  await ctx.call('create', createArgs({ target_agent_id: TARGET, delete_after_run: false }))

  await runDue(ctx, 5 * 60_000)
  assert.equal(ctx.invoker.calls.length, 1)
  assert.equal(ctx.seamRequests[0].agentId, TARGET, 'the failure path never re-enters with a different identity')
  const records = await occurrences(ctx)
  assert.equal(records.length, 1)
  assert.equal(records[0].state, 'failed')

  await runDue(ctx, 0)
  assert.equal(ctx.invoker.calls.length, 1, 'AUTO_RETRY_DEFAULT=NO: a failed target Run is not silently re-executed')
  assert.equal((await occurrences(ctx)).length, 1)
})

test('CROSS-AGENT-14 run history links job -> occurrence -> target Agent -> Run and respects ownership boundaries', async (t) => {
  const ctx = await rig(t)
  const created = await ctx.call('create', createArgs({
    schedule_kind: 'every', every_ms: 60_000, target_agent_id: TARGET, at: undefined,
  }))
  const jobId = created.result.jobId
  await runDue(ctx, 5 * 60_000)
  await runDue(ctx, 5 * 60_000)

  const globalListDenial = await ctx.call('list', { all_agents: true }, trusted(SOURCE))
  assert.equal(globalListDenial.ok, false)
  assert.equal(globalListDenial.error.code, 'access_denied',
    'list(all_agents=true) is normatively unavailable even for an admin+audit holder (CTR-AUTH-002)')
  assert.equal(JSON.stringify(globalListDenial).includes(TARGET), false, 'the denial discloses no foreign definition or owner')
  const retargetedDefinition = (await jobs(ctx)).find((job) => job.id === jobId)
  assert.equal(retargetedDefinition.agentId, TARGET, 'the persisted definition keeps the target Agent identity')

  const adminRuns = await ctx.call('runs', { all_agents: true })
  assert.equal(adminRuns.result.occurrences.length, 2)
  assert.equal(adminRuns.result.occurrences.every((entry) => entry.jobId === jobId), true)
  assert.equal(adminRuns.result.occurrences.every((entry) => entry.occurrenceId !== undefined && entry.runId !== undefined), true)
  assert.equal(adminRuns.result.occurrences[0].state, 'succeeded')

  const targetRuns = await ctx.call('runs', {}, trusted(TARGET))
  assert.equal(targetRuns.ok, true)
  assert.equal(targetRuns.result.occurrences.length, 2, 'the target Agent owns the job (job.agentId === caller) and sees its Runs')

  const plainRuns = await ctx.call('runs', {}, trusted(PLAIN))
  assert.equal(plainRuns.ok, true)
  assert.equal(plainRuns.result.occurrences.length, 0, 'unrelated Agents see no cross-agent job or evidence')

  const plainList = await ctx.call('list', {}, trusted(PLAIN))
  assert.equal(plainList.result.jobs.length, 0)
})

test('CROSS-AGENT-15 cross-agent mutations leave durable provenance: source operator, target Agent, jobId', async (t) => {
  const ctx = await rig(t)
  const created = await ctx.call('create', createArgs({ target_agent_id: TARGET }))
  const retargeted = await ctx.call('update', { job_id: created.result.jobId, target_agent_id: DISABLED })
  assert.equal(retargeted.ok, true, JSON.stringify(retargeted))

  const auditEvents = ctx.runsLog().filter((event) => event.action === 'self_service_mutation')
  assert.equal(auditEvents.length, 2)
  assert.equal(auditEvents.every((event) => event.operatorAgentId === SOURCE), true)
  assert.equal(auditEvents[0].targetAgentId, TARGET)
  assert.equal(auditEvents[1].targetAgentId, DISABLED)
  assert.equal(auditEvents.every((event) => event.jobId === created.result.jobId), true)
})

test('CROSS-AGENT-16 re-targeting via update is admin-gated and bumps the schedule revision (never mutates recorded occurrences)', async (t) => {
  const ctx = await rig(t)
  const own = await ctx.call('create', createArgs({ schedule_kind: 'every', every_ms: 60_000, at: undefined }), trusted(PLAIN))
  assert.equal(own.ok, true, JSON.stringify(own))
  const beforeRevision = (await jobs(ctx)).find((job) => job.id === own.result.jobId).scheduleRevision

  const denied = await ctx.call('update', { job_id: own.result.jobId, target_agent_id: TARGET }, trusted(PLAIN))
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'access_denied')
  assert.equal((await jobs(ctx)).find((job) => job.id === own.result.jobId).agentId, PLAIN)

  const adminRetarget = await ctx.call('update', { job_id: own.result.jobId, target_agent_id: TARGET })
  assert.equal(adminRetarget.ok, true, JSON.stringify(adminRetarget))
  const retargeted = (await jobs(ctx)).find((job) => job.id === own.result.jobId)
  assert.equal(retargeted.agentId, TARGET)
  assert.equal(retargeted.scheduleRevision, beforeRevision + 1,
    'changing the target Agent is a semantic revision (D-007 §5.2)')
})

test('CROSS-AGENT-17 foreign update/enable/disable/remove each prove exactly (scheduler, scheduler.admin) once; denial mutates and audits nothing', async (t) => {
  const ctx = await rig(t, { adminAgents: new Set([SOURCE]), auditAgents: new Set() })
  const own = await ctx.call('create', createArgs({ schedule_kind: 'every', every_ms: 60_000, at: undefined }), trusted(PLAIN))
  assert.equal(own.ok, true, JSON.stringify(own))
  const jobId = own.result.jobId
  const auditLogBefore = ctx.runsLog().filter((event) => event.action === 'self_service_mutation').length

  const denied = await ctx.call('disable', { job_id: jobId }, trusted(TARGET))
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'access_denied')
  assert.deepEqual(ctx.grantCalls, [{ agentId: TARGET, scope: 'scheduler.admin', resource: 'scheduler' }],
    'the grant-less foreign caller requests exactly the admin wire proof once and is denied')
  assert.equal(JSON.stringify(denied).includes('cross-agent scheduled hello'), false, 'denial discloses no foreign definition content')
  assert.equal((await jobs(ctx)).find((job) => job.id === jobId).enabled, true, 'denied foreign control mutates nothing')
  assert.equal(ctx.runsLog().filter((event) => event.action === 'self_service_mutation').length, auditLogBefore,
    'denied foreign control appends no success audit')

  for (const action of ['update', 'enable', 'disable', 'remove']) {
    ctx.grantCalls.length = 0
    const args = action === 'update'
      ? { job_id: jobId, name: 'renamed by admin source' }
      : { job_id: jobId }
    const out = await ctx.call(action, args, trusted(SOURCE))
    assert.equal(out.ok, true, JSON.stringify(out))
    assert.deepEqual(ctx.grantCalls, [{ agentId: SOURCE, scope: 'scheduler.admin', resource: 'scheduler' }],
      `foreign ${action} proves exactly (scheduler, scheduler.admin) once`)
  }
  assert.equal((await jobs(ctx)).length, 0, 'the admin remove completed the foreign lifecycle')
})

test('CROSS-AGENT-18 list(all_agents=true) is fail-closed with zero Auth and zero store reads for every scope combination', async (t) => {
  const ctx = await rig(t, {
    adminAgents: new Set([SOURCE]),
    auditAgents: new Set([SOURCE, PLAIN]),
  })
  const created = await ctx.call('create', createArgs({ target_agent_id: TARGET }))
  assert.equal(created.ok, true, JSON.stringify(created))

  let reads = 0
  const originalLoad = ctx.store.loadDoc.bind(ctx.store)
  ctx.store.loadDoc = async (...args) => { reads += 1; return originalLoad(...args) }
  reads = 0
  const grantCallsBefore = ctx.grantCalls.length

  let baseline
  for (const [agentId, label] of [[SOURCE, 'admin+audit'], [PLAIN, 'audit-only'], [TARGET, 'neither']]) {
    const denial = await ctx.call('list', { all_agents: true }, trusted(agentId))
    assert.equal(denial.ok, false)
    assert.equal(denial.error.code, 'access_denied')
    baseline ??= JSON.stringify(denial)
    assert.equal(JSON.stringify(denial), baseline, `stable identical denial for the ${label} holder`)
    assert.equal(JSON.stringify(denial).includes(TARGET), false)
  }
  assert.equal(ctx.grantCalls.length, grantCallsBefore,
    'zero Auth requests on the list(all_agents=true) path for admin, audit, and grant-less callers alike')
  assert.equal(reads, 0, 'zero store reads before the stable denial')
})
