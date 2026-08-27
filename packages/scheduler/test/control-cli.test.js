import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { JobStore } from '../src/store.js'
import { updateJobOp } from '../src/control.js'
import { applyTransition, buildOccurrenceRecord, rebuildFences } from '../src/occurrence-model.js'

const root = join(import.meta.dirname, '..', '..', '..')
const cli = join(root, 'scripts', 'agentcore-cron.mjs')
const job = {
  id: 'cli-job', name: 'CLI job', agentId: 'agent-a', enabled: true,
  scheduleRevision: 1, revisionActivatedAtMs: 1_000, createdAtMs: 1_000, updatedAtMs: 1_000,
  schedule: { kind: 'at', at: '2030-01-01T00:00:00.000Z' },
  payload: { kind: 'agentTurn', message: 'work' }, delivery: { mode: 'none' },
  deleteAfterRun: false, state: {},
}

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
}

function runAsync(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-cli-v2-'))
  const file = join(dir, 'jobs.json')
  const store = new JobStore(file)
  const occurrence = buildOccurrenceRecord({
    job, kind: 'natural', nominalScheduledAt: 2_000, admittedAt: 3_000, timeoutMs: 60_000,
  })
  applyTransition(occurrence, { to: 'outcome_unknown', at: 4_000, reason: 'unproven process exit' })
  await store.mutateDoc((doc) => {
    doc.jobs = [structuredClone(job)]
    doc.occurrences = [occurrence]
    doc.fences = rebuildFences(doc.occurrences)
  })
  await store.appendRunEvent({
    ts: 4_000, action: 'outcome', jobId: job.id,
    occurrenceId: occurrence.occurrenceId, runId: occurrence.runId, state: 'outcome_unknown',
  })
  return { file, store, occurrence }
}

test('ACC-032 list/runs are control-only occurrence and fence projections', async () => {
  const { file, occurrence } = await fixture()
  const listed = run(['list', '--json', '--store', file])
  assert.equal(listed.status, 0, listed.stderr)
  const listJson = JSON.parse(listed.stdout)
  assert.equal(listJson.jobs[0].fenced, true)
  assert.equal(listJson.jobs[0].fence.occurrenceId, occurrence.occurrenceId)

  const runs = run(['runs', '--id', job.id, '--json', '--store', file])
  assert.equal(runs.status, 0, runs.stderr)
  const runsJson = JSON.parse(runs.stdout)
  assert.equal(runsJson.occurrences.length, 1)
  assert.equal(runsJson.events.length, 1)
  assert.equal(runsJson.occurrences[0].runId, occurrence.runId)
})

test('ACC-029/032 CLI reconcile uses exact run identity and durable operator evidence', async () => {
  const { file, store, occurrence } = await fixture()
  const result = run([
    'reconcile', occurrence.occurrenceId, '--run-id', occurrence.runId,
    '--to', 'failed', '--note', 'verified exact process exit', '--store', file,
  ])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /basis operator-reconcile/)
  assert.match(result.stdout, /evidence append: durable/)
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.occurrences[0].state, 'failed')
  assert.equal(doc.occurrences[0].lateSettlement.basis, 'operator-reconcile')
  assert.deepEqual(doc.fences, {})
})

test('CLI update merges omitted payload fields from locked-current definition', async () => {
  const { file, store } = await fixture()
  await updateJobOp(store, job.id, {
    payload: { kind: 'agentTurn', message: 'old', timeoutSeconds: 10, model: 'old-model' },
  })

  let releaseCommit
  let enteredCommit
  const entered = new Promise((resolve) => { enteredCommit = resolve })
  const release = new Promise((resolve) => { releaseCommit = resolve })
  store.beforeCommit = async () => { enteredCommit(); await release }
  const concurrent = updateJobOp(store, job.id, {
    payload: { kind: 'agentTurn', message: 'old', timeoutSeconds: 99, model: 'concurrent-model' },
  })
  await entered

  const cliRun = runAsync(['update', job.id, '--message', 'cli-message', '--json', '--store', file])
  await new Promise((resolve) => setTimeout(resolve, 300))
  releaseCommit()
  await concurrent
  const result = await cliRun
  assert.equal(result.status, 0, result.stderr)
  const final = (await store.loadDoc({ force: true })).jobs.find((candidate) => candidate.id === job.id)
  assert.equal(final.payload.message, 'cli-message')
  assert.equal(final.payload.timeoutSeconds, 99)
  assert.equal(final.payload.model, 'concurrent-model')
})
