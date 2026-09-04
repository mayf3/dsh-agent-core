/** Persistence helpers for the append-only history authority and monthly query projections. */

import { promises as fs } from 'node:fs'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { HISTORY_STORE_VERSION, historyMonth } from './history-model.js'
import { applyHistoryEvent, writeHistoryPartition } from './history-projection.js'

export function cloneHistoryState(store, { empty = false } = {}) {
  return {
    dir: store.dir,
    _seq: empty ? 0 : store._seq,
    _occurrences: empty ? new Map() : structuredClone(store._occurrences),
    _runs: empty ? new Map() : structuredClone(store._runs),
  }
}

/** Re-read the immutable stream into a draft state; never expose partial RAM state. */
export function readHistoryState(store, { empty = false } = {}) {
  mkdirSync(store.dir, { recursive: true })
  const state = cloneHistoryState(store, { empty })
  let corruptLines = 0
  let lastSeenSeq = 0
  if (existsSync(store.eventsPath)) {
    for (const line of readFileSync(store.eventsPath, 'utf8').split('\n')) {
      if (line.trim() === '') continue
      let event
      try {
        event = JSON.parse(line)
        if (!Number.isSafeInteger(event?.seq) || event.seq <= lastSeenSeq) throw new Error('non-monotonic event seq')
        lastSeenSeq = event.seq
        if (event.seq > state._seq) applyHistoryEvent(state, event)
      } catch {
        corruptLines += 1
      }
    }
  }
  if (!empty && lastSeenSeq < store._seq) {
    throw new Error('history store: events.jsonl was truncated or rewound')
  }
  return { state, corruptLines }
}

function selectedMonth(month, filters) {
  const fromMonth = Number.isFinite(filters?.from) ? historyMonth(filters.from) : null
  const toMonth = Number.isFinite(filters?.to) ? historyMonth(filters.to) : null
  return (fromMonth === null || month >= fromMonth) && (toMonth === null || month <= toMonth)
}

function parsePartition(dir, entry) {
  const match = /^runs-(\d{6})\.json$/.exec(entry)
  if (!match) return null
  const month = match[1]
  try {
    const partition = JSON.parse(readFileSync(path.join(dir, entry), 'utf8'))
    if (partition?.version !== HISTORY_STORE_VERSION || partition.month !== month
      || !Number.isSafeInteger(partition.last_event_seq) || partition.last_event_seq < 0
      || !Array.isArray(partition.records)) return { month, partition: null }
    const ids = new Set()
    for (const record of partition.records) {
      if (typeof record?.run_id !== 'string' || ids.has(record.run_id)
        || !record.scheduled_at || historyMonth(Date.parse(record.scheduled_at)) !== month) {
        return { month, partition: null }
      }
      ids.add(record.run_id)
    }
    return { month, partition }
  } catch {
    return { month, partition: null }
  }
}

export function readHistoryPartitions(dir, filters = {}) {
  const partitions = new Map()
  if (!existsSync(dir)) return partitions
  for (const entry of readdirSync(dir)) {
    const parsed = parsePartition(dir, entry)
    if (parsed !== null && selectedMonth(parsed.month, filters)) {
      partitions.set(parsed.month, parsed.partition)
    }
  }
  return partitions
}

function expectedPartition(state, month) {
  const records = [...state._runs.values()]
    .filter((record) => record.scheduled_at && historyMonth(Date.parse(record.scheduled_at)) === month)
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)) || a.run_id.localeCompare(b.run_id))
  let lastEventSeq = 0
  for (const view of state._occurrences.values()) {
    if ((view.months ?? new Set()).has(month)) lastEventSeq = Math.max(lastEventSeq, view.maxSeq ?? 0)
  }
  return { version: HISTORY_STORE_VERSION, month, last_event_seq: lastEventSeq, records }
}

/** Heal missing, corrupt, stale, or structurally incomplete monthly projections from events. */
export async function healHistoryPartitions(state) {
  const onDisk = readHistoryPartitions(state.dir)
  const months = new Set(onDisk.keys())
  for (const view of state._occurrences.values()) {
    for (const month of view.months ?? []) months.add(month)
  }
  for (const month of months) {
    const actual = onDisk.get(month)
    const expected = expectedPartition(state, month)
    if (actual === null || JSON.stringify(actual) !== JSON.stringify(expected)) {
      await writeHistoryPartition(state, month)
    }
  }
}

/** Direct monthly-projection query source, optionally pruning by from/to month. */
export function readProjectionRuns(dir, filters = {}) {
  const runs = new Map()
  for (const [month, partition] of readHistoryPartitions(dir, filters)) {
    if (partition === null) {
      throw Object.assign(new Error(`history projection ${month} is corrupt; reload required`), { code: 'HISTORY_PROJECTION_INVALID' })
    }
    for (const record of partition.records) {
      if (runs.has(record.run_id)) {
        throw Object.assign(new Error(`history projection duplicates run ${record.run_id}`), { code: 'HISTORY_PROJECTION_INVALID' })
      }
      runs.set(record.run_id, record)
    }
  }
  return runs
}

/** Event first, projection second; install the returned draft only after both commits. */
export async function appendHistoryEvent(store, event, monthsTouched) {
  const state = cloneHistoryState(store)
  const committed = { seq: state._seq + 1, ...event }
  await fs.appendFile(store.eventsPath, `${JSON.stringify(committed)}\n`, { encoding: 'utf8' })
  const handle = await fs.open(store.eventsPath, 'r+')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
  applyHistoryEvent(state, committed)
  for (const month of monthsTouched(event, state)) await writeHistoryPartition(state, month)
  return state
}
