import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JobStore } from '../../src/store.js'
import { Scheduler } from '../../src/scheduler.js'
import { createRecordingDelivery } from '../../src/seams.js'
import {
  applyTransition,
  buildOccurrenceRecord,
  rebuildFences,
} from '../../src/occurrence-model.js'
import { createSelfServiceSchedulerAccess } from '../../src/self-service.js'

// clone_disabled (AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4_AMENDMENT1_CLONE_DISABLED,
// DRAFT / PENDING_ACCEPTANCE): same-Owner server-side atomic clone of one job
// definition into a permanently-disabled target. The hidden agent-turn message
// is copied SERVER-SIDE from the stored source bytes — the caller never
// supplies or receives message text, and no return/audit/log surface carries it.
//
// Judgment order frozen by these tests:
//   trusted caller -> argument shape -> source visible+owned (opaque) ->
//   expected-revision CAS (zero-write stale rejection) -> schedule copy rule
//   (elapsed `at` precisely rejected) -> LOCKED re-verify (ownership, CAS) ->
//   logical-key dedup (already_applied / conflict) -> atomic insert -> audit.
// Source bytes (including its UNKNOWN occurrences and fence) are never touched;
// the target is born enabled=false with no occurrence, no due slot, no history.

const AGENT = 'agt_owner'
const FOREIGN = 'agt_other'
const SENTINEL = 'SENTINEL_SECRET_PROMPT_TEXT'
const SOURCE_KEY = 'agt_owner:hr-v5'
const CLONE_KEY = 'agt_owner:hr-v6'

const COMMITTED_FIELDS = [
  'auditStatus', 'autoRetry', 'deleteAfterRun', 'enabled', 'exactPersistedDeliveryDestination',
  'jobId', 'name', 'nextRunAt', 'normalizedSchedule', 'targetAgentId', 'timezone',
]

function trusted(agentId = AGENT, overrides = {}) {
  return {
    agentId,
    callerAgentId: agentId,
    processGeneration: 7,
    turnExecutionId: `turn:${agentId}:7:1`,
    channelNamespace: 'feishu',
    channelConversationId: 'thread:1',
    feishuChatId: `oc_${agentId}`,
    feishuConversationId: 'thread:1',
    feishuMessageId: 'om_1',
    ...overrides,
  }
}

async function fixture(t, { adminAgents = new Set() } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-clone-disabled-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
  // Hermetic critical inventory: these tests own no critical jobs.
  await writeFile(join(dir, 'desired-state.json'), JSON.stringify({ version: 1, jobs: [] }))
  const access = createSelfServiceSchedulerAccess({
    store,
    assertGrant: async (agentId, scope) => scope === 'scheduler.admin' && adminAgents.has(agentId),
    criticalInventoryPath: join(dir, 'desired-state.json'),
  })
  const call = (action, args, context = trusted()) => access.handlers.scheduler[action](args, context)
  const counters = { mutations: 0 }
  const originalMutate = store.mutateDoc.bind(store)
  store.mutateDoc = async (...args) => {
    counters.mutations += 1
    return originalMutate(...args)
  }
  return {
    store, call, dir, counters,
    jobsFile: join(dir, 'jobs.json'),
    runsFile: join(dir, 'runs.jsonl'),
  }
}

const SOURCE_ARGS = {
  logical_key: SOURCE_KEY,
  name: 'hr v5',
  schedule_kind: 'every',
  every_ms: 1_800_000,
  message: SENTINEL,
  timeout: 900,
  light_context: true,
  model: 'model-opaque',
  auto_retry: true,
  delete_after_run: false,
}

async function createSource(fx, overrides = {}, context = trusted()) {
  const result = await fx.call('create', { ...SOURCE_ARGS, ...overrides }, context)
  assert.equal(result.ok, true, JSON.stringify(result.error ?? {}))
  return result.result
}

async function docOf(fx) {
  return fx.store.loadDoc({ force: true })
}

function cloneArgs(job, overrides = {}) {
  return {
    job_id: job.id,
    expected_revision: {
      schedule_revision: job.scheduleRevision,
      updated_at_ms: job.updatedAtMs,
    },
    new_logical_key: CLONE_KEY,
    ...overrides,
  }
}

test('the gap: create is always born enabled — clone_disabled is the only disabled-creation surface', async (t) => {
  const fx = await fixture(t)
  const created = await createSource(fx)
  assert.equal(created.enabled, true)
  const doc = await docOf(fx)
  assert.equal(doc.jobs.every((job) => job.enabled === true), true)
  // After GREEN the handler exists and answers disabled; before it, the call
  // below fails loud (RED).
  const clone = await fx.call('clone_disabled', cloneArgs(doc.jobs[0]))
  assert.equal(clone.ok, true, JSON.stringify(clone.error ?? {}))
  assert.equal(clone.result.enabled, false)
})

test('happy path: byte-preserving disabled clone, exact committed shape, zero message exposure', async (t) => {
  const fx = await fixture(t)
  await createSource(fx)
  const before = await docOf(fx)
  const source = before.jobs.find((job) => job.logicalKey === SOURCE_KEY)

  const result = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(result.ok, true, JSON.stringify(result.error ?? {}))
  const committed = result.result
  assert.deepEqual(Object.keys(committed).sort(), COMMITTED_FIELDS)
  assert.equal(committed.enabled, false)
  assert.equal(committed.nextRunAt, null)
  assert.notEqual(committed.jobId, source.id)
  assert.equal(committed.name, 'hr v5')
  assert.equal(committed.targetAgentId, AGENT)
  assert.deepEqual(committed.normalizedSchedule, { kind: 'every', everyMs: 1_800_000 })
  assert.equal(committed.timezone, null)
  assert.equal(committed.autoRetry, true)
  assert.equal(committed.deleteAfterRun, false)
  assert.equal(committed.exactPersistedDeliveryDestination, null)

  const after = await docOf(fx)
  const target = after.jobs.find((job) => job.logicalKey === CLONE_KEY)
  assert.ok(target, 'clone persisted')
  const sourceAfter = after.jobs.find((job) => job.id === source.id)
  // Allowed-definition whitelist is copied byte-for-byte; identity/state is not.
  assert.deepEqual(target.schedule, source.schedule)
  assert.deepEqual(target.payload, source.payload)
  assert.deepEqual(target.delivery, source.delivery)
  assert.deepEqual(target.retry, source.retry)
  assert.equal(target.deleteAfterRun, source.deleteAfterRun)
  assert.equal(target.enabled, false)
  assert.equal(target.scheduleRevision, 1)
  assert.deepEqual(target.state, {})
  assert.deepEqual(sourceAfter, source, 'source bytes untouched')
  assert.equal(after.occurrences.filter((record) => record.jobId === target.id).length, 0)
  assert.equal(after.fences[target.id] !== undefined, false)

  // The sentinel prompt text exists ONLY inside the stored payload bytes —
  // never in the wire result, never in the audit log.
  assert.ok(JSON.stringify(result).includes(SENTINEL) === false)
  const auditLog = await readFile(fx.runsFile, 'utf8')
  assert.ok(auditLog.includes(SENTINEL) === false)
  const auditEvents = auditLog.trim().split('\n').map((line) => JSON.parse(line))
    .filter((event) => event.action === 'self_service_mutation' && event.operation === 'clone_disabled')
  assert.equal(auditEvents.length, 1)
  assert.equal(auditEvents[0].alreadyApplied, undefined)

  // AMENDMENT1 revision 2 (SUP-20261011-0310-HR-SUCCESSOR): the clone's
  // source-intent provenance is persisted as a minimal NON-SECRET internal
  // field (own-source job id + the observed two-field CAS), visible to the
  // same Owner through the EXISTING bounded list surface only — it is not a
  // new reader, not in the committed result, and carries no payload content.
  assert.deepEqual(Object.keys(committed).sort(), COMMITTED_FIELDS, 'committed shape unchanged by provenance')
  const listed = await fx.call('list', { logical_key: CLONE_KEY })
  assert.deepEqual(listed.result.jobs[0].cloneProvenance, {
    sourceJobId: source.id,
    sourceScheduleRevision: source.scheduleRevision,
    sourceUpdatedAtMs: source.updatedAtMs,
  })
})

test('new_name is optional: explicit name wins, default inherits the source display name', async (t) => {
  const fx = await fixture(t)
  await createSource(fx)
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)

  const renamed = await fx.call('clone_disabled', cloneArgs(source, { new_logical_key: 'agt_owner:v6-named', new_name: 'hr v6 renamed' }))
  assert.equal(renamed.ok, true, JSON.stringify(renamed.error ?? {}))
  assert.equal(renamed.result.name, 'hr v6 renamed')

  const inherited = await fx.call('clone_disabled', cloneArgs(source, { new_logical_key: 'agt_owner:v6-quiet' }))
  assert.equal(inherited.ok, true, JSON.stringify(inherited.error ?? {}))
  assert.equal(inherited.result.name, 'hr v5')
})

test('foreign source is opaque even with a held admin proof; missing source is job_not_found', async (t) => {
  const fx = await fixture(t, { adminAgents: new Set([AGENT]) })
  await createSource(fx, { logical_key: 'agt_other:foreign', name: 'foreign' }, trusted(FOREIGN))
  const foreign = (await docOf(fx)).jobs.find((job) => job.logicalKey === 'agt_other:foreign')
  const mutationsBefore = fx.counters.mutations

  const denied = await fx.call('clone_disabled', cloneArgs(foreign, { new_logical_key: 'agt_owner:steal' }))
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'access_denied')
  assert.match(denied.error.detail, /no visible job with id/)
  assert.equal(fx.counters.mutations, mutationsBefore, 'zero write on foreign denial')

  const missing = await fx.call('clone_disabled', cloneArgs({ id: 'job-absent', scheduleRevision: 1, updatedAtMs: 1 }))
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'job_not_found')
})

test('argument shape: new_logical_key and the exact two-field CAS are required', async (t) => {
  const fx = await fixture(t)
  await createSource(fx)
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)
  const mutationsBefore = fx.counters.mutations

  const noKey = await fx.call('clone_disabled', { job_id: source.id, expected_revision: cloneArgs(source).expected_revision })
  assert.equal(noKey.ok, false)
  assert.equal(noKey.error.code, 'invalid_arguments')

  const noCas = await fx.call('clone_disabled', { job_id: source.id, new_logical_key: CLONE_KEY })
  assert.equal(noCas.ok, false)
  assert.equal(noCas.error.code, 'invalid_arguments')

  const stale = await fx.call('clone_disabled', cloneArgs(source, {
    expected_revision: { schedule_revision: source.scheduleRevision, updated_at_ms: source.updatedAtMs + 1 },
  }))
  assert.equal(stale.ok, false)
  assert.equal(stale.error.code, 'stale_target_conflict')
  assert.equal(fx.counters.mutations, mutationsBefore, 'stale CAS rejects before any write')

  const revived = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(revived.ok, true, 'a correct CAS after a stale one proceeds normally')
})

test('elapsed one-shot is precisely rejected; future one-shot copies verbatim and stays disabled', async (t) => {
  const fx = await fixture(t)
  await createSource(fx, { logical_key: 'agt_owner:past-at', schedule_kind: 'at', at: '2030-01-01T00:00:00Z', delete_after_run: true, auto_retry: false })
  const past = (await docOf(fx)).jobs.find((job) => job.logicalKey === 'agt_owner:past-at')
  await fx.store.mutateDoc((doc) => {
    const stored = doc.jobs.find((job) => job.id === past.id)
    stored.schedule = { kind: 'at', at: new Date(Date.now() - 60_000).toISOString() }
  })
  const mutationsBefore = fx.counters.mutations

  const rejected = await fx.call('clone_disabled', cloneArgs(past, {
    expected_revision: {
      schedule_revision: past.scheduleRevision + 1,
      updated_at_ms: past.updatedAtMs + 1,
    },
    new_logical_key: 'agt_owner:past-clone',
  }))
  assert.equal(rejected.ok, false, JSON.stringify(rejected))
  assert.equal(rejected.error.code, 'stale_target_conflict')

  const fresh = (await docOf(fx)).jobs.find((job) => job.id === past.id)
  const rejectedFresh = await fx.call('clone_disabled', cloneArgs(fresh, { new_logical_key: 'agt_owner:past-clone' }))
  assert.equal(rejectedFresh.ok, false)
  assert.equal(rejectedFresh.error.code, 'validation_error')
  assert.match(rejectedFresh.error.detail, /at/)
  assert.equal(fx.counters.mutations, mutationsBefore, 'both rejections write nothing')

  await createSource(fx, { logical_key: 'agt_owner:future-at', schedule_kind: 'at', at: '2030-01-01T00:00:00Z', delete_after_run: true, auto_retry: false })
  const future = (await docOf(fx)).jobs.find((job) => job.logicalKey === 'agt_owner:future-at')
  const copied = await fx.call('clone_disabled', cloneArgs(future, { new_logical_key: 'agt_owner:future-clone' }))
  assert.equal(copied.ok, true, JSON.stringify(copied.error ?? {}))
  assert.equal(copied.result.enabled, false)
  assert.deepEqual(copied.result.normalizedSchedule, { kind: 'at', at: future.schedule.at })
  const target = (await docOf(fx)).jobs.find((job) => job.logicalKey === 'agt_owner:future-clone')
  assert.deepEqual(target.schedule, future.schedule)
})

test('same-key retry converges to the original target with one job and an alreadyApplied audit mark', async (t) => {
  const fx = await fixture(t)
  await createSource(fx)
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)

  const first = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(first.ok, true, JSON.stringify(first.error ?? {}))
  const second = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(second.ok, true, JSON.stringify(second.error ?? {}))
  assert.equal(second.result.jobId, first.result.jobId, 'same target answered again')

  const doc = await docOf(fx)
  assert.equal(doc.jobs.filter((job) => job.logicalKey === CLONE_KEY).length, 1)
  const auditEvents = (await readFile(fx.runsFile, 'utf8')).trim().split('\n')
    .map((line) => JSON.parse(line))
    .filter((event) => event.action === 'self_service_mutation' && event.operation === 'clone_disabled')
  assert.equal(auditEvents.length, 2, 'one audit event per call (retry marked, never a second mutation)')
  assert.equal(auditEvents[1].alreadyApplied, true)
  assert.equal(auditEvents[0].alreadyApplied, undefined)
})

test('source moved: stale CAS outranks dedup; fresh CAS against a changed source conflicts', async (t) => {  const fx = await fixture(t)
  await createSource(fx)
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)
  const first = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(first.ok, true)

  // Change the source definition (payload projection) via the real update path.
  const updated = await fx.call('update', {
    job_id: source.id,
    expected_revision: cloneArgs(source).expected_revision,
    timeout: 1200,
  })
  assert.equal(updated.ok, true, JSON.stringify(updated.error ?? {}))
  const moved = (await docOf(fx)).jobs.find((job) => job.id === source.id)
  const mutationsBefore = fx.counters.mutations

  // A blind retry with the OLD observation must lose to the CAS check — never
  // silently answering the stale target clone.
  const blind = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(blind.ok, false)
  assert.equal(blind.error.code, 'stale_target_conflict')
  assert.equal(fx.counters.mutations, mutationsBefore)

  // A fresh observation sees a changed definition behind the same key -> conflict.
  const conflict = await fx.call('clone_disabled', cloneArgs(moved))
  assert.equal(conflict.ok, false)
  assert.equal(conflict.error.code, 'logical_key_conflict')
  assert.equal((await docOf(fx)).jobs.filter((job) => job.logicalKey === CLONE_KEY).length, 1)
})

test('same key pre-bound to a different definition conflicts without touching that job', async (t) => {
  const fx = await fixture(t)
  await createSource(fx)
  const other = await createSource(fx, { logical_key: CLONE_KEY, name: 'other', every_ms: 60_000, timeout: 1, light_context: undefined, model: undefined, auto_retry: undefined })
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)

  const conflict = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(conflict.ok, false)
  assert.equal(conflict.error.code, 'logical_key_conflict')
  const doc = await docOf(fx)
  assert.equal(doc.jobs.find((job) => job.id === other.jobId).name, 'other')
  assert.equal(doc.jobs.filter((job) => job.logicalKey === CLONE_KEY).length, 1)
})

test('concurrent same-key clones serialize to exactly one committed job', async (t) => {
  const fx = await fixture(t)
  await createSource(fx)
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)
  const args = cloneArgs(source)

  const [a, b] = await Promise.all([
    fx.call('clone_disabled', args),
    fx.call('clone_disabled', args),
  ])
  assert.equal(a.ok, true, JSON.stringify(a.error ?? {}))
  assert.equal(b.ok, true, JSON.stringify(b.error ?? {}))
  assert.equal(a.result.jobId, b.result.jobId)
  const doc = await docOf(fx)
  assert.equal(doc.jobs.filter((job) => job.logicalKey === CLONE_KEY).length, 1)
})

test('source UNKNOWN occurrence and fence survive the clone untouched; the target inherits none of it', async (t) => {
  const fx = await fixture(t)
  await createSource(fx)
  let doc = await docOf(fx)
  const source = doc.jobs.find((job) => job.logicalKey === SOURCE_KEY)
  const admittedAt = source.createdAtMs + 1000
  const record = buildOccurrenceRecord({ job: source, kind: 'natural', nominalScheduledAt: admittedAt, admittedAt })
  applyTransition(record, { to: 'outcome_unknown', at: admittedAt + 10, reason: 'timeout' })
  await fx.store.mutateDoc((latest) => {
    latest.occurrences.push(record)
    latest.fences = rebuildFences(latest.occurrences)
  })
  doc = await docOf(fx)
  const beforeOcc = structuredClone(doc.occurrences)
  const beforeFences = structuredClone(doc.fences)
  const sourceFenced = (await docOf(fx)).fences[source.id] !== undefined
  assert.equal(sourceFenced, true, 'fixture precondition: source fenced by its unknown')

  const result = await fx.call('clone_disabled', cloneArgs(doc.jobs.find((job) => job.id === source.id)))
  assert.equal(result.ok, true, JSON.stringify(result.error ?? {}))

  const after = await docOf(fx)
  assert.deepEqual(after.occurrences, beforeOcc, 'occurrence ledger byte-identical')
  assert.deepEqual(after.fences, beforeFences, 'fence map byte-identical')
  const target = after.jobs.find((job) => job.logicalKey === CLONE_KEY)
  assert.equal(after.occurrences.some((entry) => entry.jobId === target.id), false)
  assert.equal(after.fences[target.id] !== undefined, false)
  assert.equal(result.result.nextRunAt, null, 'disabled target carries no due slot')
})

test('cron definition clones verbatim (expr/tz preserved, target disabled with no next run)', async (t) => {
  const fx = await fixture(t)
  await createSource(fx, {
    logical_key: 'agt_owner:cron-src', name: 'cron src',
    schedule_kind: 'cron', cron_expr: '30 9 * * *', timezone: 'Asia/Shanghai',
    timeout: undefined, light_context: undefined, model: undefined,
    auto_retry: undefined, delete_after_run: undefined,
  })
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === 'agt_owner:cron-src')
  const result = await fx.call('clone_disabled', cloneArgs(source, { new_logical_key: 'agt_owner:cron-clone' }))
  assert.equal(result.ok, true, JSON.stringify(result.error ?? {}))
  assert.deepEqual(result.result.normalizedSchedule, { kind: 'cron', expr: '30 9 * * *', timezone: 'Asia/Shanghai' })
  assert.equal(result.result.timezone, 'Asia/Shanghai')
  assert.equal(result.result.nextRunAt, null)
})

test('real engine tick: the disabled clone mints zero occurrences while the enabled source admits', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-clone-engine-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const clock = { value: 1_900_000_000_000 }
  const store = new JobStore(join(dir, 'jobs.json'), { clock: () => clock.value })
  await writeFile(join(dir, 'desired-state.json'), JSON.stringify({ version: 1, jobs: [] }))
  const access = createSelfServiceSchedulerAccess({
    store,
    assertGrant: async () => false,
    criticalInventoryPath: join(dir, 'desired-state.json'),
  })
  const call = (action, args, context = trusted()) => access.handlers.scheduler[action](args, context)
  const invocations = []
  const invoker = async (request) => {
    invocations.push(request)
    request.onStart()
    return { status: 'ok', summary: 'ok' }
  }
  invoker.assertRunnable = () => true
  const scheduler = new Scheduler({
    store,
    invoker,
    deliver: createRecordingDelivery(),
    concurrency: 3,
    nowMs: () => clock.value,
    deadlineSetTimeout: (fn) => { queueMicrotask(fn); return 1 },
    deadlineClearTimeout: () => {},
  })
  await scheduler.start({ autoStart: false, catchup: false })

  // Source anchored 15s in the future, enabled; clone inherits the same
  // schedule bytes but is born disabled.
  const created = await call('create', {
    logical_key: SOURCE_KEY, name: 'engine src', schedule_kind: 'every',
    every_ms: 60_000, message: SENTINEL,
  })
  assert.equal(created.ok, true, JSON.stringify(created.error ?? {}))
  let doc = await store.loadDoc({ force: true })
  const source = doc.jobs.find((job) => job.logicalKey === SOURCE_KEY)
  const clone = await call('clone_disabled', cloneArgs(source))
  assert.equal(clone.ok, true, JSON.stringify(clone.error ?? {}))
  const cloneId = clone.result.jobId

  clock.value += 20_000
  await scheduler.tick()
  await scheduler.whenIdle()
  await scheduler.load()

  doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.find((job) => job.id === cloneId).enabled, false, 'tick never enables the clone')
  assert.equal(doc.occurrences.some((record) => record.jobId === cloneId), false, 'zero admission for the clone')
  assert.ok(invocations.length >= 1, 'engine ran')
  for (const request of invocations) {
    assert.notEqual(request.jobId, cloneId)
  }
  assert.equal(doc.occurrences.some((record) => record.jobId === source.id), true, 'enabled source admitted normally')
})

test('RED gap A: identical projection from a DIFFERENT source never adopts the existing key binding', async (t) => {
  const fx = await fixture(t)
  await createSource(fx, { logical_key: 'agt_owner:twin-a', name: 'twin a' })
  await createSource(fx, { logical_key: 'agt_owner:twin-b', name: 'twin b' })
  const a = (await docOf(fx)).jobs.find((job) => job.logicalKey === 'agt_owner:twin-a')
  const b = (await docOf(fx)).jobs.find((job) => job.logicalKey === 'agt_owner:twin-b')

  const first = await fx.call('clone_disabled', cloneArgs(a, { new_logical_key: CLONE_KEY }))
  assert.equal(first.ok, true, JSON.stringify(first.error ?? {}))
  // Same-Owner, same projection bytes — but the intent is to clone B, while
  // the key is already bound to A's clone. AMENDMENT1 revision 2: the source
  // identity (not the projection alone) is the intent anchor -> conflict.
  const second = await fx.call('clone_disabled', cloneArgs(b, { new_logical_key: CLONE_KEY }))
  assert.equal(second.ok, false, JSON.stringify(second))
  assert.equal(second.error.code, 'logical_key_conflict')
  const target = (await docOf(fx)).jobs.find((job) => job.logicalKey === CLONE_KEY)
  assert.equal(target.cloneProvenance?.sourceJobId, a.id, 'key still bound to the first intent')
  assert.equal((await docOf(fx)).jobs.filter((job) => job.logicalKey === CLONE_KEY).length, 1, 'conflict committed nothing')
})

test('RED gap B: same source, different revision history under the same key conflicts', async (t) => {
  const fx = await fixture(t)
  await createSource(fx)
  let source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)
  const first = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(first.ok, true, JSON.stringify(first.error ?? {}))

  // r1 -> r2 -> r3: the definition lands back on identical bytes, but the
  // source revision moved past the cloned intent.
  await fx.call('update', { job_id: source.id, expected_revision: cloneArgs(source).expected_revision, timeout: 1200 })
  source = (await docOf(fx)).jobs.find((job) => job.id === source.id)
  await fx.call('update', { job_id: source.id, expected_revision: cloneArgs(source).expected_revision, timeout: 900 })
  const drifted = (await docOf(fx)).jobs.find((job) => job.id === source.id)
  assert.equal(drifted.scheduleRevision, 3)
  assert.equal(drifted.payload.timeoutSeconds, 900, 'projection bytes returned to the cloned shape')

  const retry = await fx.call('clone_disabled', cloneArgs(drifted))
  assert.equal(retry.ok, false, JSON.stringify(retry))
  assert.equal(retry.error.code, 'logical_key_conflict')
  assert.equal((await docOf(fx)).jobs.filter((job) => job.logicalKey === CLONE_KEY).length, 1)
})

test('locked re-verify: a source change between the pre-read and the lock fails stale and never clones stale bytes', async (t) => {
  const fx = await fixture(t)
  await createSource(fx)
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)

  // Inject a REAL committed source mutation between the handler's pre-lock
  // read and the clone's locked transaction (mutateDoc wrapper runs just
  // before the clone's own transaction).
  const inner = fx.store.mutateDoc.bind(fx.store)
  let injected = false
  fx.store.mutateDoc = async (fn) => {
    if (!injected) {
      injected = true
      await inner((doc) => {
        const live = doc.jobs.find((job) => job.id === source.id)
        live.payload.timeoutSeconds = 4242
        live.scheduleRevision += 1
        live.updatedAtMs += 1
      })
    }
    return inner(fn)
  }

  const result = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(result.ok, false, JSON.stringify(result))
  assert.equal(result.error.code, 'stale_target_conflict')
  const doc = await docOf(fx)
  assert.equal(doc.jobs.some((job) => job.logicalKey === CLONE_KEY), false, 'no clone of stale bytes')
  assert.equal(doc.jobs.find((job) => job.id === source.id).payload.timeoutSeconds, 4242, 'injected change stands; clone wrote nothing')
})
