import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JobStore } from '../../src/store.js'
import { createSelfServiceSchedulerAccess } from '../../src/self-service.js'

// AMENDMENT1_CLONE_DISABLED candidate revision 2 (SUP-20261011-0310-HR-SUCCESSOR):
// source-intent binding for the clone_disabled dedup and its reconcile proof.
//
// The dedup anchor is the SOURCE INTENT, not the projection alone: every
// committed clone persists a minimal non-secret `cloneProvenance`
// {sourceJobId, sourceScheduleRevision, sourceUpdatedAtMs} and a same-key
// retry converges ONLY on identical provenance + matching projection. A key
// bound to a create-made job, a different source, or an earlier revision
// (even one whose bytes drifted back) conflicts — it is never adopted. The
// locked ownership/CAS re-verify rejects a source change injected between
// the handler's pre-read and the clone's transaction. Mechanically split from
// clone-disabled.test.js (file-line ceiling); same rig, same semantics.

const AGENT = 'agt_owner'
const SENTINEL = 'SENTINEL_SECRET_PROMPT_TEXT'
const SOURCE_KEY = 'agt_owner:hr-v5'
const CLONE_KEY = 'agt_owner:hr-v6'

function trusted(agentId = AGENT) {
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
  }
}

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-clone-intent-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
  await writeFile(join(dir, 'desired-state.json'), JSON.stringify({ version: 1, jobs: [] }))
  const access = createSelfServiceSchedulerAccess({
    store,
    assertGrant: async () => false,
    criticalInventoryPath: join(dir, 'desired-state.json'),
  })
  const call = (action, args, context = trusted()) => access.handlers.scheduler[action](args, context)
  const counters = { mutations: 0 }
  const originalMutate = store.mutateDoc.bind(store)
  store.mutateDoc = async (...args) => {
    counters.mutations += 1
    return originalMutate(...args)
  }
  return { store, call, counters, runsFile: join(dir, 'runs.jsonl') }
}

const SOURCE_ARGS = {
  logical_key: SOURCE_KEY,
  name: 'hr v5',
  schedule_kind: 'every',
  every_ms: 1_800_000,
  message: SENTINEL,
  timeout: 900,
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

test('provenance: minimal non-secret source-intent field, same-Owner list visibility only', async (t) => {
  const fx = await fixture(t)
  const created = await fx.call('create', { ...SOURCE_ARGS })
  assert.equal(created.ok, true, JSON.stringify(created.error ?? {}))
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)
  const result = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(result.ok, true, JSON.stringify(result.error ?? {}))

  // The committed result keeps its exact 11-field shape — provenance is NOT
  // part of the mutation answer, and the audit log carries no payload text.
  const auditLog = await readFile(fx.runsFile, 'utf8')
  assert.ok(auditLog.includes(SENTINEL) === false)
  assert.ok(!auditLog.includes('sourceJobId'), 'audit carries digests, not provenance field dumps')

  // Same-Owner visibility through the EXISTING bounded list surface (additive
  // field; no new reader; no payload content).
  const listed = await fx.call('list', { logical_key: CLONE_KEY })
  assert.deepEqual(listed.result.jobs[0].cloneProvenance, {
    sourceJobId: source.id,
    sourceScheduleRevision: source.scheduleRevision,
    sourceUpdatedAtMs: source.updatedAtMs,
  })
})

test('gap A: identical projection from a DIFFERENT source never adopts the existing key binding', async (t) => {
  const fx = await fixture(t)
  await fx.call('create', { ...SOURCE_ARGS, logical_key: 'agt_owner:twin-a', name: 'twin a' })
  await fx.call('create', { ...SOURCE_ARGS, logical_key: 'agt_owner:twin-b', name: 'twin b' })
  const a = (await docOf(fx)).jobs.find((job) => job.logicalKey === 'agt_owner:twin-a')
  const b = (await docOf(fx)).jobs.find((job) => job.logicalKey === 'agt_owner:twin-b')

  const first = await fx.call('clone_disabled', cloneArgs(a))
  assert.equal(first.ok, true, JSON.stringify(first.error ?? {}))
  // Same-Owner, same projection bytes — but the intent is to clone B, while
  // the key is already bound to A's clone. Revision 2: the source identity
  // (not the projection alone) is the intent anchor -> conflict.
  const second = await fx.call('clone_disabled', cloneArgs(b))
  assert.equal(second.ok, false, JSON.stringify(second))
  assert.equal(second.error.code, 'logical_key_conflict')
  const target = (await docOf(fx)).jobs.find((job) => job.logicalKey === CLONE_KEY)
  assert.equal(target.cloneProvenance?.sourceJobId, a.id, 'key still bound to the first intent')
  assert.equal((await docOf(fx)).jobs.filter((job) => job.logicalKey === CLONE_KEY).length, 1, 'conflict committed nothing')
})

test('gap B: same source, different revision history under the same key conflicts', async (t) => {
  const fx = await fixture(t)
  await fx.call('create', { ...SOURCE_ARGS })
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

test('same source identity + same revision CAS + matching projection still converges (already_applied)', async (t) => {
  const fx = await fixture(t)
  await fx.call('create', { ...SOURCE_ARGS })
  const source = (await docOf(fx)).jobs.find((job) => job.logicalKey === SOURCE_KEY)
  const first = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(first.ok, true, JSON.stringify(first.error ?? {}))
  const second = await fx.call('clone_disabled', cloneArgs(source))
  assert.equal(second.ok, true, JSON.stringify(second.error ?? {}))
  assert.equal(second.result.jobId, first.result.jobId)
  const doc = await docOf(fx)
  assert.equal(doc.jobs.filter((job) => job.logicalKey === CLONE_KEY).length, 1)
  const auditEvents = (await readFile(fx.runsFile, 'utf8')).trim().split('\n')
    .map((line) => JSON.parse(line))
    .filter((event) => event.action === 'self_service_mutation' && event.operation === 'clone_disabled')
  // Audit convention: ONE event per call, the retry marked alreadyApplied —
  // an observability record, not a duplicate job or a second committed
  // mutation, and NOT an exactly-once audit promise.
  assert.equal(auditEvents.length, 2)
  assert.equal(auditEvents[1].alreadyApplied, true)
})

test('locked re-verify: a source change between the pre-read and the lock fails stale and never clones stale bytes', async (t) => {
  const fx = await fixture(t)
  await fx.call('create', { ...SOURCE_ARGS })
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
