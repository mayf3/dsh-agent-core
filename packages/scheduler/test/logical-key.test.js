import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { JobStore } from '../src/store.js'
import {
  createOrReconcileJobOp,
  createJobOp,
  updateJobOp,
  enableJobOp,
  disableJobOp,
  deleteJobOp,
  findJobByLogicalKey,
} from '../src/control.js'
import { normalizeJob } from '../src/job-model.js'

const BASE_INPUT = {
  name: 'daily-summary-check',
  agentId: 'agt_daily-thought-agent',
  logicalKey: 'owner:daily-summary-check',
  schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' },
  payload: { kind: 'agentTurn', message: 'check raw/distilled backfill' },
  delivery: { mode: 'announce', channel: 'feishu', to: 'chat:oc_test' },
}

async function rig(t) {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-logical-key-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
}

test('create contract: new logical key -> created; same key + same definition -> already_applied with identical jobId (TEST-4 singleton)', async (t) => {
  const store = await rig(t)
  const first = await createOrReconcileJobOp(store, BASE_INPUT)
  assert.equal(first.outcome, 'created')
  const second = await createOrReconcileJobOp(store, BASE_INPUT)
  assert.equal(second.outcome, 'already_applied')
  assert.equal(second.job.id, first.job.id)
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.filter((job) => job.logicalKey === BASE_INPUT.logicalKey).length, 1)
  assert.equal(doc.jobs.length, 1)
})

test('create contract: same key + differing payload -> LOGICAL_KEY_CONFLICT (fail closed, zero write, TEST-C)', async (t) => {
  const store = await rig(t)
  const first = await createOrReconcileJobOp(store, BASE_INPUT)
  await assert.rejects(
    () => createOrReconcileJobOp(store, { ...BASE_INPUT, payload: { kind: 'agentTurn', message: 'DIFFERENT message' } }),
    (error) => {
      assert.equal(error.code, 'LOGICAL_KEY_CONFLICT')
      assert.equal(error.existingJobId, first.job.id)
      assert.deepEqual(error.differingFields, ['payload'])
      return true
    },
  )
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.length, 1)
  assert.equal(doc.jobs[0].payload.message, 'check raw/distilled backfill')
})

test('create contract: display fields are OUTSIDE the projection (same key + renamed -> already_applied, no write)', async (t) => {
  const store = await rig(t)
  const first = await createOrReconcileJobOp(store, BASE_INPUT)
  const renamed = await createOrReconcileJobOp(store, { ...BASE_INPUT, name: 'renamed-display-only' })
  assert.equal(renamed.outcome, 'already_applied')
  assert.equal(renamed.job.name, 'daily-summary-check')
  assert.equal(renamed.job.id, first.job.id)
})

test('logicalKey is persisted and canonical read-back is EXACT (no name/fuzzy inference, §5.1.5)', async (t) => {
  const store = await rig(t)
  const { job } = await createOrReconcileJobOp(store, BASE_INPUT)
  const found = await findJobByLogicalKey(store, 'owner:daily-summary-check')
  assert.equal(found.id, job.id)
  assert.equal(found.logicalKey, 'owner:daily-summary-check')
  assert.equal(await findJobByLogicalKey(store, 'owner:daily-summary-check '.trim() + '-x'), undefined)
  assert.equal(await findJobByLogicalKey(store, 'daily-summary-check'), undefined)
  assert.equal(await findJobByLogicalKey(store, ''), undefined)
})

test('keyless create keeps legacy behavior (engine-internal path unchanged)', async (t) => {
  const store = await rig(t)
  const keyless = { ...BASE_INPUT }
  delete keyless.logicalKey
  const { outcome, job } = await createOrReconcileJobOp(store, keyless)
  assert.equal(outcome, 'created')
  assert.equal(job.logicalKey, undefined)
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.length, 1)
})

test('normalizeJob validates logicalKey (non-empty string, trimmed)', () => {
  assert.throws(() => normalizeJob({ ...BASE_INPUT, logicalKey: '   ' }), /logicalKey/)
  assert.throws(() => normalizeJob({ ...BASE_INPUT, logicalKey: 42 }), /logicalKey/)
  const job = normalizeJob({ ...BASE_INPUT, logicalKey: '  owner:padded  ' })
  assert.equal(job.logicalKey, 'owner:padded')
})

test('expectedRevision compare-before-write: stale update rejected, newer state preserved (TEST-D)', async (t) => {
  const store = await rig(t)
  const { job } = await createOrReconcileJobOp(store, BASE_INPUT)
  const before = await store.loadDoc({ force: true })

  // A concurrent writer moves the job forward.
  const concurrent = await updateJobOp(store, job.id, { name: 'concurrent-newer-write' })

  // The stale reader still holds the ORIGINAL revision and must be refused.
  await assert.rejects(
    () => updateJobOp(store, job.id, { name: 'stale-overwrite' }, {
      expectedRevision: { scheduleRevision: 1, updatedAtMs: job.updatedAtMs },
    }),
    (error) => {
      assert.equal(error.code, 'STALE_TARGET_CONFLICT')
      return true
    },
  )
  const after = await store.loadDoc({ force: true })
  const persisted = after.jobs.find((candidate) => candidate.id === job.id)
  assert.equal(persisted.name, 'concurrent-newer-write')
  assert.equal(after.jobs.length, before.jobs.length)
  assert.equal(persisted.scheduleRevision, concurrent.scheduleRevision)
})

test('expectedRevision guards enable/disable/remove too (zero write on stale)', async (t) => {
  const store = await rig(t)
  const { job } = await createOrReconcileJobOp(store, BASE_INPUT)
  const stale = { scheduleRevision: 1, updatedAtMs: job.updatedAtMs }
  await updateJobOp(store, job.id, { name: 'bump' })

  for (const [op, run] of [
    ['enable', () => enableJobOp(store, job.id, { expectedRevision: stale })],
    ['disable', () => disableJobOp(store, job.id, { expectedRevision: stale })],
    ['remove', () => deleteJobOp(store, job.id, { expectedRevision: stale })],
  ]) {
    await assert.rejects(run, (error) => {
      assert.equal(error.code, 'STALE_TARGET_CONFLICT', op)
      return true
    })
  }
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.length, 1)
  assert.equal(doc.jobs[0].enabled, true)
})

test('matching expectedRevision mutates (compare-before-write is not a veto)', async (t) => {
  const store = await rig(t)
  const { job } = await createOrReconcileJobOp(store, BASE_INPUT)
  const disabled = await disableJobOp(store, job.id, {
    expectedRevision: { scheduleRevision: job.scheduleRevision, updatedAtMs: job.updatedAtMs },
  })
  assert.equal(disabled.enabled, false)
})

test('createJobOp legacy signature keeps returning the public job', async (t) => {
  const store = await rig(t)
  const job = await createJobOp(store, BASE_INPUT)
  assert.ok(job.id)
  assert.equal(job.logicalKey, BASE_INPUT.logicalKey)
})

test('response-loss replay on a real store: atomic commit then duplicate attempt converges (TEST-A store half)', async (t) => {
  const store = await rig(t)
  const first = await createOrReconcileJobOp(store, BASE_INPUT)
  // The response was lost after commit; the caller replays the SAME command.
  const replay = await createOrReconcileJobOp(store, BASE_INPUT)
  assert.equal(replay.outcome, 'already_applied')
  assert.equal(replay.job.id, first.job.id)
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.length, 1)
  const raw = await readFile(join(store.dir, 'jobs.json'), 'utf8')
  assert.match(raw, /"logicalKey": "owner:daily-summary-check"/)
})
