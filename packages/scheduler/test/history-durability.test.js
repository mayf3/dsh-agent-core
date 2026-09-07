import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HistoryStore } from '../src/history.js'
import { buildOccurrenceRecord } from '../src/occurrence-model.js'

const SEP = Date.parse('2026-09-01T00:00:00Z')
const OCT = Date.parse('2026-10-01T00:00:00Z')

function historyDir() {
  return mkdtempSync(join(tmpdir(), 'scheduler-history-durability-'))
}

function fixture(nominal, id) {
  const job = {
    id,
    name: `Job ${id}`,
    agentId: 'agt_history',
    scheduleRevision: 1,
    schedule: { kind: 'every', everyMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'work' },
    delivery: { mode: 'none' },
    deleteAfterRun: false,
  }
  const record = buildOccurrenceRecord({
    job,
    kind: 'natural',
    nominalScheduledAt: nominal,
    admittedAt: nominal,
    timeoutMs: 60_000,
  })
  return { job, record }
}

test('ACC-006 two preloaded writers re-read under lock and preserve monotonic seq + projection union', async () => {
  const dir = historyDir()
  const first = new HistoryStore({ dir, nowMs: () => SEP })
  const second = new HistoryStore({ dir, nowMs: () => SEP + 1_000 })
  await Promise.all([first.load(), second.load()])

  await first.occurrenceReserved(fixture(SEP, 'writer-a'))
  await second.occurrenceReserved(fixture(SEP + 1_000, 'writer-b'))

  const events = readFileSync(join(dir, 'events.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.deepEqual(events.map((event) => event.seq), [1, 2], 'lock owner allocates from the latest durable seq')
  const partition = JSON.parse(readFileSync(join(dir, 'runs-202609.json'), 'utf8'))
  assert.equal(partition.last_event_seq, 2)
  assert.deepEqual(new Set(partition.records.map((run) => run.job_id)), new Set(['writer-a', 'writer-b']))

  const fresh = new HistoryStore({ dir, nowMs: () => SEP })
  await fresh.load()
  assert.deepEqual(new Set(fresh.queryRuns({}).runs.map((run) => run.job_id)), new Set(['writer-a', 'writer-b']))
})

test('ACC-006 load read-heal-install runs after an already-started writer under the same lock', async () => {
  const dir = historyDir()
  const seed = new HistoryStore({ dir, nowMs: () => SEP })
  await seed.occurrenceReserved(fixture(SEP, 'loader-a'))
  const writer = new HistoryStore({ dir, nowMs: () => SEP + 1_000 })
  await writer.load()

  const loader = new HistoryStore({ dir, nowMs: () => SEP })
  const runExclusive = loader._lock.runExclusive.bind(loader._lock)
  loader._lock.runExclusive = async (loadTransaction) => {
    await writer.occurrenceReserved(fixture(SEP + 1_000, 'loader-b'))
    return runExclusive(loadTransaction)
  }
  await loader.load()

  const partition = JSON.parse(readFileSync(join(dir, 'runs-202609.json'), 'utf8'))
  assert.equal(partition.last_event_seq, 2)
  assert.deepEqual(new Set(partition.records.map((run) => run.job_id)), new Set(['loader-a', 'loader-b']))
  assert.deepEqual(new Set(loader.queryRuns({}).runs.map((run) => run.job_id)), new Set(['loader-a', 'loader-b']))
})

test('ACC-006 replay heal detects a complete-seq projection with a missing record', async () => {
  const dir = historyDir()
  const history = new HistoryStore({ dir, nowMs: () => SEP })
  await history.occurrenceReserved(fixture(SEP, 'complete-a'))
  await history.occurrenceReserved(fixture(SEP + 1_000, 'complete-b'))
  const partitionPath = join(dir, 'runs-202609.json')
  const damaged = JSON.parse(readFileSync(partitionPath, 'utf8'))
  damaged.records.splice(0, 1)
  writeFileSync(partitionPath, `${JSON.stringify(damaged, null, 2)}\n`)

  const healed = new HistoryStore({ dir, nowMs: () => SEP })
  await healed.load()
  const partition = JSON.parse(readFileSync(partitionPath, 'utf8'))
  assert.equal(partition.last_event_seq, 2, 'max seq was already current')
  assert.equal(partition.records.length, 2, 'record-set validation forces a full projection heal')
})

test('R7 query reads monthly projections directly and prunes unrelated months', async () => {
  const dir = historyDir()
  const history = new HistoryStore({ dir, nowMs: () => SEP })
  await history.occurrenceReserved(fixture(SEP, 'september'))
  await history.occurrenceReserved(fixture(OCT, 'october'))

  history._runs.clear()
  assert.equal(history.queryRuns({}).runs.length, 2, 'query source is projection files, not the event replay map')

  writeFileSync(join(dir, 'runs-202609.json'), '{corrupt projection\n')
  const october = history.queryRuns({ from: OCT, to: OCT + 86_400_000 })
  assert.deepEqual(october.runs.map((run) => run.job_id), ['october'], 'from/to month bounds avoid the corrupt unrelated partition')
})
