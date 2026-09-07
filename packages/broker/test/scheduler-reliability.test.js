import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createBrokerGateway } from '../src/gateway.js'
import { createRelayHandlers, SCHEDULER_MUTATIONS } from '../src/relay.js'
import { schedulerManifest } from '../src/capabilities/scheduler.js'
import { validateSchedulerArguments } from '../src/scheduler-validation.js'
import { createSelfServiceSchedulerAccess } from '../../scheduler/src/self-service.js'
import { JobStore } from '../../scheduler/src/store.js'
import { withSchedulerMutationMask } from '../src/readiness.js'

const schedulerCapability = (handler) => ({
  manifests: [schedulerManifest],
  // Local handler map shape: { capabilityId: { operation: fn } }.
  localHandlerResolver: () => ({
    scheduler: new Proxy({}, { get: () => handler }),
  }),
})

async function credentialStoreWith(t, entries) {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-rel-v1-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'agent-credentials.json')
  await writeFile(file, JSON.stringify({ version: 1, credentials: entries }, null, 2))
  return file
}

async function selfServiceRig(t) {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-rel-ss-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
  const trusted = (agentId = 'agt_a', overrides = {}) => ({
    agentId,
    callerAgentId: agentId,
    processGeneration: 7,
    turnExecutionId: `turn:${agentId}:7:1`,
    channelNamespace: 'feishu',
    feishuChatId: `oc_${agentId}`,
    ...overrides,
  })
  return { store, trusted }
}

const CREATE_ARGS = {
  logical_key: 'owner:test-job',
  name: 'test-job',
  schedule_kind: 'cron',
  cron_expr: '0 22 * * *',
  timezone: 'Asia/Shanghai',
  message: 'do the thing',
  delivery_mode: 'none',
}

// ── SB1: readiness gate (fail BEFORE validation / handler / store) ──────────

test('scheduler mutation without any credential provider -> capability_unavailable before the handler (TEST-1/TEST-E parent half)', async (t) => {
  let handlerCalls = 0
  const gateway = createBrokerGateway({
    ...schedulerCapability(async () => {
      handlerCalls += 1
      return { ok: true, result: {} }
    }),
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile: undefined,
  })
  const answer = await gateway.execute({ capabilityId: 'scheduler', operation: 'create', args: CREATE_ARGS }, { agentId: 'agt_a' })
  assert.equal(answer.ok, false)
  assert.equal(answer.error.code, 'capability_unavailable')
  assert.equal(handlerCalls, 0, 'gate fires before any handler/store access')
})

test('credential provider configured but caller unbound -> capability_unavailable', async (t) => {
  const store = await credentialStoreWith(t, { 'agt_other': { clientId: 'c', clientSecret: 's' } })
  const gateway = createBrokerGateway({
    ...schedulerCapability(async () => ({ ok: true, result: {} })),
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile: store,
  })
  const answer = await gateway.execute({ capabilityId: 'scheduler', operation: 'create', args: CREATE_ARGS }, { agentId: 'agt_a' })
  assert.equal(answer.ok, false)
  assert.equal(answer.error.code, 'capability_unavailable')
})

test('ready caller passes the gate and reaches the handler; reads are never gated', async (t) => {
  const store = await credentialStoreWith(t, { 'agt_a': { clientId: 'c', clientSecret: 's' } })
  let handlerCalls = 0
  const gateway = createBrokerGateway({
    ...schedulerCapability(async () => {
      handlerCalls += 1
      return { ok: true, result: { jobs: [] } }
    }),
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile: store,
  })
  const trustedContext = { agentId: 'agt_a', callerAgentId: 'agt_a', processGeneration: 7, turnExecutionId: 'turn:agt_a:7:1' }
  const create = await gateway.execute({ capabilityId: 'scheduler', operation: 'create', args: CREATE_ARGS }, trustedContext)
  assert.equal(create.ok, true, JSON.stringify(create.error ?? {}))
  const list = await gateway.execute({ capabilityId: 'scheduler', operation: 'list', args: {} }, trustedContext)
  assert.equal(list.ok, true)
  assert.equal(handlerCalls, 2)
})

test('availability discovery: booleans only, reflects per-caller readiness, zero credential requirement (§5.3.1)', async (t) => {
  const store = await credentialStoreWith(t, { 'agt_ready': { clientId: 'c', clientSecret: 's' } })
  const gateway = createBrokerGateway({
    ...schedulerCapability(async () => ({ ok: true, result: {} })),
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile: store,
  })
  const ready = await gateway.execute({ capabilityId: 'broker', operation: 'availability' }, { agentId: 'agt_ready' })
  assert.equal(ready.ok, true)
  assert.equal(ready.result.capabilities.scheduler.ready, true)
  assert.equal(ready.result.capabilities.scheduler.operations.create, true)
  assert.equal(ready.result.credentialsFileConfigured, true)
  const unbound = await gateway.execute({ capabilityId: 'broker', operation: 'availability' }, { agentId: 'agt_unknown' })
  assert.equal(unbound.result.capabilities.scheduler.ready, false)
  const raw = JSON.stringify(ready.result)
  assert.ok(!raw.toLowerCase().includes('secret'), 'availability never carries credential material')
})

// ── SB2b: relay reconcile on lost responses (TEST-A / TEST-B child half) ────

function relayRig() {
  const calls = []
  const requestFn = async (call) => {
    calls.push(call)
    return requestFn.next(call)
  }
  requestFn.next = () => { throw new Error('requestFn.next not programmed') }
  return { requestFn, calls }
}

test('lost create response + committed job visible -> APPLIED with strict committed shape (TEST-A)', async (t) => {
  const { requestFn } = relayRig()
  const committedJob = {
    id: 'job-1',
    name: 'test-job',
    logicalKey: 'owner:test-job',
    agentId: 'agt_a',
    enabled: true,
    scheduleRevision: 1,
    schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' },
    payload: { kind: 'agentTurn' },
    delivery: { mode: 'none' },
    deleteAfterRun: false,
    nextRunAtMs: Date.now() + 60_000,
  }
  requestFn.next = async (call) => {
    if (call.operation === 'list') {
      return { ok: true, result: { ok: true, result: { jobs: [committedJob] } } }
    }
    throw new Error('transport died mid-call')
  }
  const handlers = createRelayHandlers(schedulerManifest, requestFn)
  const result = await handlers.create('create', { ...CREATE_ARGS })
  assert.equal(result.jobId, 'job-1')
  assert.equal(result.auditStatus, 'reconciled')
  assert.equal(result.name, 'test-job')
  assert.equal(result.timezone, 'Asia/Shanghai')
})

test('lost create response + no job with the logical key -> NOT_APPLIED (retry-safe, TEST-B)', async (t) => {
  const { requestFn } = relayRig()
  requestFn.next = async (call) => {
    if (call.operation === 'list') return { ok: true, result: { ok: true, result: { jobs: [] } } }
    throw new Error('transport died before commit')
  }
  const handlers = createRelayHandlers(schedulerManifest, requestFn)
  const answer = await handlers.create('create', { ...CREATE_ARGS })
  assert.equal(answer.errorCode, 'mutation_not_applied')
  assert.match(answer.detail, /retry with the SAME logical identity is safe/)
})

test('unprovable outcomes keep STILL_UNKNOWN with reconciliation evidence (never silent)', async (t) => {
  // (a) read-back itself fails
  const failing = relayRig()
  failing.requestFn.next = async () => { throw new Error('channel down') }
  const handlersA = createRelayHandlers(schedulerManifest, failing.requestFn)
  const unknownA = await handlersA.create('create', { ...CREATE_ARGS })
  assert.equal(unknownA.errorCode, 'mutation_outcome_unknown')
  assert.match(unknownA.detail, /STILL_UNKNOWN/)

  // (b) logical key bound to a DIFFERENT definition
  const foreign = relayRig()
  foreign.requestFn.next = async (call) => {
    if (call.operation === 'list') {
      return { ok: true, result: { ok: true, result: { jobs: [{ id: 'job-x', name: 'SOMETHING-ELSE' }] } } }
    }
    throw new Error('lost')
  }
  const handlersB = createRelayHandlers(schedulerManifest, foreign.requestFn)
  const unknownB = await handlersB.create('create', { ...CREATE_ARGS })
  assert.equal(unknownB.errorCode, 'mutation_outcome_unknown')
  assert.match(unknownB.detail, /different definition/)
})

test('update reconcile via expected_revision: moved past -> APPLIED; unchanged -> NOT_APPLIED; remove-absent -> APPLIED', async (t) => {
  const job = {
    id: 'job-9', name: 'j', agentId: 'agt_a', enabled: true, scheduleRevision: 2,
    updatedAtMs: 999, schedule: { kind: 'every', everyMs: 60_000 }, payload: {}, delivery: { mode: 'none' },
  }
  // revision moved past the anchor -> applied
  const moved = relayRig()
  moved.requestFn.next = async (call) => {
    if (call.operation === 'list') return { ok: true, result: { ok: true, result: { jobs: [job] } } }
    throw new Error('lost')
  }
  const updateHandlers = createRelayHandlers(schedulerManifest, moved.requestFn)
  const applied = await updateHandlers.update('update', {
    job_id: 'job-9', name: 'renamed', expected_revision: { schedule_revision: 1, updated_at_ms: 5 },
  })
  assert.equal(applied.jobId, 'job-9')
  assert.equal(applied.auditStatus, 'reconciled')

  // revision unchanged -> not applied
  const unchanged = relayRig()
  unchanged.requestFn.next = async (call) => {
    if (call.operation === 'list') return { ok: true, result: { ok: true, result: { jobs: [{ ...job, scheduleRevision: 1, updatedAtMs: 5 }] } } }
    throw new Error('lost')
  }
  const updateHandlers2 = createRelayHandlers(schedulerManifest, unchanged.requestFn)
  const notApplied = await updateHandlers2.update('update', {
    job_id: 'job-9', name: 'renamed', expected_revision: { schedule_revision: 1, updated_at_ms: 5 },
  })
  assert.equal(notApplied.errorCode, 'mutation_not_applied')

  // remove: job gone -> applied (caller must have seen it to request removal)
  const gone = relayRig()
  gone.requestFn.next = async (call) => {
    if (call.operation === 'list') return { ok: true, result: { ok: true, result: { jobs: [] } } }
    throw new Error('lost')
  }
  const removeHandlers = createRelayHandlers(schedulerManifest, gone.requestFn)
  const removed = await removeHandlers.remove('remove', { job_id: 'job-9' })
  assert.equal(removed.removed, true)
  assert.equal(removed.auditStatus, 'reconciled')
})

// ── self-service contract surface ────────────────────────────────────────────

test('self-service create requires logical_key; same-key replay returns the SAME job and audits alreadyApplied', async (t) => {
  const { store, trusted } = await selfServiceRig(t)
  const { handlers } = createSelfServiceSchedulerAccess({ store })

  const missing = await handlers.scheduler.create({ ...CREATE_ARGS, logical_key: undefined }, trusted())
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'invalid_arguments')

  const first = await handlers.scheduler.create({ ...CREATE_ARGS }, trusted())
  assert.equal(first.ok, true)
  const replay = await handlers.scheduler.create({ ...CREATE_ARGS }, trusted())
  assert.equal(replay.ok, true)
  assert.equal(replay.result.jobId, first.result.jobId)

  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.length, 1)
  assert.equal(doc.jobs[0].logicalKey, 'owner:test-job')
  const events = await store.readRunEvents({ limit: 100 })
  const audits = events.filter((event) => event.action === 'self_service_mutation' && event.operation === 'create')
  assert.equal(audits.length, 2)
  assert.equal(audits[1].alreadyApplied, true)
})

test('self-service same key + different message -> logical_key_conflict (no second job)', async (t) => {
  const { store, trusted } = await selfServiceRig(t)
  const { handlers } = createSelfServiceSchedulerAccess({ store })
  await handlers.scheduler.create({ ...CREATE_ARGS }, trusted())
  const conflict = await handlers.scheduler.create(
    { ...CREATE_ARGS, message: 'DIFFERENT' },
    trusted(),
  )
  assert.equal(conflict.ok, false)
  assert.equal(conflict.error.code, 'logical_key_conflict')
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.length, 1)
})

test('self-service list filters: logical_key and job_id exact match within visibility', async (t) => {
  const { store, trusted } = await selfServiceRig(t)
  const { handlers } = createSelfServiceSchedulerAccess({ store })
  await handlers.scheduler.create({ ...CREATE_ARGS }, trusted())
  await handlers.scheduler.create({ ...CREATE_ARGS, logical_key: 'owner:second', name: 'second-job', cron_expr: '30 7 * * *' }, trusted())
  const byKey = await handlers.scheduler.list({ logical_key: 'owner:second' }, trusted())
  assert.equal(byKey.result.jobs.length, 1)
  assert.equal(byKey.result.jobs[0].name, 'second-job')
  const byAbsKey = await handlers.scheduler.list({ logical_key: 'owner:absent' }, trusted())
  assert.equal(byAbsKey.result.jobs.length, 0)
})

test('self-service update with mismatched expected_revision -> stale_target_conflict, zero write (TEST-D surface)', async (t) => {
  const { store, trusted } = await selfServiceRig(t)
  const { handlers } = createSelfServiceSchedulerAccess({ store })
  const created = await handlers.scheduler.create({ ...CREATE_ARGS }, trusted())
  const stale = await handlers.scheduler.update({
    job_id: created.result.jobId,
    expected_revision: { schedule_revision: 99, updated_at_ms: 1 },
    name: 'stale-attempt',
  }, trusted())
  assert.equal(stale.ok, false)
  assert.equal(stale.error.code, 'stale_target_conflict')
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs[0].name, 'test-job')
})

// ── validation + child mask ──────────────────────────────────────────────────

test('closed-arg validation: create demands logical_key; expected_revision shape enforced', () => {
  const absent = { ...CREATE_ARGS }
  delete absent.logical_key
  const missing = validateSchedulerArguments('create', absent)
  assert.ok(missing.violations.some((v) => v.includes('logical_key')))
  const foreignKey = validateSchedulerArguments('update', { job_id: 'j', name: 'x', logical_key: 'k' })
  assert.ok(foreignKey.violations.some((v) => v.includes('logical_key is only valid on create')))
  const badShape = validateSchedulerArguments('enable', {
    job_id: 'j',
    expected_revision: { schedule_revision: 0, updated_at_ms: -3 },
  })
  assert.ok(badShape.violations.some((v) => v.includes('expected_revision must be')))
  const goodShape = validateSchedulerArguments('enable', {
    job_id: 'j',
    expected_revision: { schedule_revision: 1, updated_at_ms: 2 },
  })
  assert.equal(goodShape.violations.length, 0)
})

test('child mask withholds scheduler mutation operations, keeps reads (TEST-1 presentation half)', () => {
  const masked = withSchedulerMutationMask(
    [{ manifest: schedulerManifest, handlers: {} }],
    { credentialProviderConfigured: false },
  )
  const ops = masked[0].manifest.operations.map((op) => op.name)
  for (const mutation of SCHEDULER_MUTATIONS) assert.ok(!ops.includes(mutation), `${mutation} must be withheld`)
  assert.ok(ops.includes('list'))
  assert.ok(ops.includes('runs'))

  const untouched = withSchedulerMutationMask(
    [{ manifest: schedulerManifest, handlers: {} }],
    { credentialProviderConfigured: true },
  )
  assert.equal(untouched[0].manifest.operations.length, schedulerManifest.operations.length)
})
