import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importOpenClawJobs, mapOpenClawJob, writeImportToStore } from '../src/import-openclaw.js'
import { JobStore } from '../src/store.js'
import { applyTransition, buildOccurrenceRecord, rebuildFences } from '../src/occurrence-model.js'
import { enableJobOp, updateJobOp } from '../src/control.js'

const fixture = JSON.parse(readFileSync(new URL('../fixtures/openclaw-jobs-enabled.json', import.meta.url), 'utf8')).jobs
const nowMs = Date.parse('2026-08-25T00:00:00.000Z')
const tempStore = () => new JobStore(join(mkdtempSync(join(tmpdir(), 'scheduler-import-v2-')), 'jobs.json'))

function raw(over = {}) {
  return {
    id: 'job-a', name: 'job a', agentId: 'agent-a', enabled: true,
    schedule: { kind: 'cron', expr: '0 9 * * *' },
    payload: { kind: 'agentTurn', message: 'work' }, delivery: { mode: 'none' },
    state: { nextRunAtMs: 1, lastStatus: 'error' }, ...over,
  }
}

test('ACC-014 MIGRATION_NO_CATCH_UP strips execution state and disables definitions', () => {
  const { jobs, report } = importOpenClawJobs([raw({ state: { nextRunAtMs: 1, lastRunAtMs: 2, runningAtMs: 3 } })], { nowMs })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].enabled, false)
  assert.deepEqual(jobs[0].state, {})
  assert.equal(jobs[0].revisionActivatedAtMs, nowMs)
  assert.deepEqual(report.inFlight.jobs.map((job) => job.id), ['job-a'])
  assert.equal(report.dispositions[0].restoreEligible, false)
})

test('ACC-015 exactly three missing-agent definitions are blocked without guessing', () => {
  const result = importOpenClawJobs(['a', 'b', 'c'].map((id) => raw({ id, agentId: undefined })), { nowMs })
  assert.equal(result.jobs.length, 0)
  assert.equal(result.report.gaps.length, 3)
  assert.ok(result.report.gaps.every((gap) => /no agentId/.test(gap.reason)))
})

test('ACC-015 fixture evidence contains exactly three missing-agent definitions', () => {
  const result = importOpenClawJobs(fixture, { nowMs })
  assert.equal(result.report.gaps.filter((gap) => /no agentId/.test(gap.reason)).length, 3)
  assert.ok(result.jobs.every((job) => job.enabled === false))
})

test('ACC-016 stale one-shot is DO_NOT_IMPORT and never converted to now', () => {
  const result = importOpenClawJobs([raw({ schedule: { kind: 'at', at: '2020-01-01T00:00:00.000Z' } })], { nowMs })
  assert.equal(result.jobs.length, 0)
  assert.match(result.report.gaps[0].reason, /DO_NOT_IMPORT/)
})

test('ACC-017 disabled jobs stay disabled and enabled source is restore-gated disabled', () => {
  const result = importOpenClawJobs([raw({ id: 'disabled', enabled: false }), raw({ id: 'enabled', enabled: true })], { nowMs })
  assert.deepEqual(result.jobs.map((job) => job.enabled), [false, false])
})

test('ACC-018 three daemon/long-running definitions remain out of Scheduler', () => {
  const result = importOpenClawJobs(['d1', 'd2', 'd3'].map((id) => raw({
    id, payload: { kind: 'systemEvent', message: 'daemon loop' },
  })), { nowMs })
  assert.equal(result.jobs.length, 0)
  assert.equal(result.report.gaps.length, 3)
  assert.ok(result.report.gaps.every((gap) => /not executable by V2/.test(gap.reason)))
})

test('ACC-019/037 restore count is zero: write rejects enabled imported definitions', async () => {
  const store = tempStore()
  const enabled = mapOpenClawJob(raw(), { nowMs }).job
  enabled.enabled = true
  await assert.rejects(() => writeImportToStore(store, [enabled]), (error) => error.code === 'IMPORT_RESTORE_GATE_CLOSED')
  assert.equal(await store.exists(), false)
})

test('ACC-019/037 durable restore marker blocks enable and update bypasses', async () => {
  const store = tempStore()
  const job = mapOpenClawJob(raw(), { nowMs }).job
  await writeImportToStore(store, [job])
  assert.equal((await store.loadDoc({ force: true })).jobs[0].migrationRestoreBlocked, true)
  await assert.rejects(() => enableJobOp(store, job.id, { nowMs: nowMs + 1 }), (error) => error.code === 'RESTORE_GATE_CLOSED')
  await assert.rejects(
    () => updateJobOp(store, job.id, { enabled: true, migrationRestoreBlocked: undefined }, { nowMs: nowMs + 1 }),
    (error) => error.code === 'RESTORE_GATE_CLOSED',
  )
})

test('ACC-031 legacy sessionTarget/sessionKey are stripped', () => {
  const mapped = mapOpenClawJob(raw({ sessionTarget: 'main', sessionKey: 'agent:a:cron:job-a' }), { nowMs })
  assert.equal(mapped.job.sessionTarget, undefined)
  assert.equal(mapped.job.sessionKey, undefined)
  assert.equal(mapped.job.enabled, false)
  assert.match(mapped.warnings.join('\n'), /fresh non-main session/)
})

test('ACC-034 existing empty target refuses no-force inside lock', async () => {
  const store = tempStore()
  await store.persist([])
  const job = mapOpenClawJob(raw(), { nowMs }).job
  await assert.rejects(() => writeImportToStore(store, [job]), (error) => error.code === 'IMPORT_REFUSED')
})

test('ACC-034 force import preserves occurrence/fence/history authority verbatim', async () => {
  const store = tempStore()
  const job = mapOpenClawJob(raw(), { nowMs }).job
  const record = buildOccurrenceRecord({ job, kind: 'natural', nominalScheduledAt: nowMs + 1_000, admittedAt: nowMs + 1_000, timeoutMs: 60_000 })
  applyTransition(record, { to: 'outcome_unknown', at: nowMs + 2_000, reason: 'unproven' })
  await store.mutateDoc((doc) => {
    doc.jobs = [structuredClone(job)]
    doc.occurrences = [record]
    doc.fences = rebuildFences(doc.occurrences)
  })
  const before = await store.loadDoc({ force: true })
  await writeImportToStore(store, [job], { force: true, nowMs })
  const after = await store.loadDoc({ force: true })
  assert.deepEqual(after.occurrences, before.occurrences)
  assert.deepEqual(after.fences, before.fences)
})

test('ACC-034 PAYLOAD_HASH_CONFLICT force import fails unsafe merge', async () => {
  const store = tempStore()
  const job = mapOpenClawJob(raw(), { nowMs }).job
  const record = buildOccurrenceRecord({ job, kind: 'natural', nominalScheduledAt: nowMs + 1_000, admittedAt: nowMs + 1_000, timeoutMs: 60_000 })
  await store.mutateDoc((doc) => { doc.jobs = [job]; doc.occurrences = [record] })
  const changed = structuredClone(job)
  changed.payload.message = 'changed payload with same revision'
  await assert.rejects(() => writeImportToStore(store, [changed], { force: true, nowMs }), (error) => error.code === 'IMPORT_UNSAFE_MERGE')
})

test('ACC-034 force import rejects schedule/retry rebinding at the same revision', async () => {
  const store = tempStore()
  const job = mapOpenClawJob(raw(), { nowMs }).job
  const record = buildOccurrenceRecord({ job, kind: 'natural', nominalScheduledAt: nowMs + 1_000, admittedAt: nowMs + 1_000, timeoutMs: 60_000 })
  await store.mutateDoc((doc) => { doc.jobs = [job]; doc.occurrences = [record] })
  const changed = structuredClone(job)
  changed.schedule = { kind: 'cron', expr: '30 10 * * *' }
  await assert.rejects(() => writeImportToStore(store, [changed], { force: true, nowMs }), (error) => error.code === 'IMPORT_UNSAFE_MERGE')
})

test('ACC-034 in-lock TOCTOU guard sees a competing writer', async () => {
  const store = tempStore()
  const job = mapOpenClawJob(raw(), { nowMs }).job
  const first = store.mutateDoc(async (doc) => {
    await new Promise((resolve) => setTimeout(resolve, 20))
    doc.jobs.push({ ...job, id: 'competing' })
  })
  const second = writeImportToStore(store, [job])
  await first
  await assert.rejects(() => second, (error) => error.code === 'IMPORT_REFUSED')
  assert.equal((await store.loadDoc({ force: true })).jobs[0].id, 'competing')
})
