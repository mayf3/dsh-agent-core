/**
 * @agent-core/execution-history/src/loaders/scheduler-history.js — the
 * structured scheduler history store loader: never-truncated events.jsonl +
 * monthly runs-YYYYMM.json projections (SCHEDULER_RUN_HISTORY R6 layout).
 */

import { join } from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'
import { readJsonlFile, mergeStatus } from './lines.js'

const MONTH_RE = /^runs-(\d{6})\.json$/

function eventToRecord(row, line) {
  const refs = {}
  for (const key of ['occurrence_id', 'run_id', 'job_id', 'correlation_id', 'parent_run_id']) {
    if (typeof row[key] === 'string' && row[key] !== '') refs[key] = row[key]
  }
  if (typeof row.session_id === 'string' && row.session_id !== '') refs.sessionId = row.session_id
  return {
    source: 'scheduler_history',
    kind: `history_${row.type ?? 'unknown'}`,
    provenanceClass: 'PRIMARY_PERSISTED',
    nativeSeq: row.seq,
    atMs: Number.isFinite(row.ts) ? row.ts : null,
    nativeRefs: refs,
    dedupeKey: line.sha256,
    data: row,
  }
}

export function loadSchedulerHistory({ historyDir, maxFileBytes, monthLimit = 24 }) {
  const statuses = []
  const files = []
  const records = []
  let rowsRead = 0
  const eventsRead = readJsonlFile(join(historyDir, 'events.jsonl'), { maxFileBytes })
  if (eventsRead.absent) {
    statuses.push({ status: 'ABSENT', reason: 'history events.jsonl absent' })
  } else if (eventsRead.readFailed !== undefined) {
    statuses.push({ status: 'DEGRADED', reason: `history events.jsonl unreadable: ${eventsRead.readFailed}`, truncated: true })
  } else {
    files.push({ file: join(historyDir, 'events.jsonl'), size: eventsRead.size, mtimeMs: eventsRead.mtimeMs })
    statuses.push({ status: 'OK', badLines: eventsRead.badLines, truncated: eventsRead.truncated })
    for (let i = 0; i < eventsRead.lines.length; i += 1) {
      rowsRead += 1
      records.push(eventToRecord(eventsRead.parsed[i], eventsRead.lines[i]))
    }
  }
  // Monthly projections: newest last, bounded; tolerant of one bad file.
  let months = []
  try { months = readdirSync(historyDir).map((name) => MONTH_RE.exec(name)?.[1]).filter(Boolean).sort() } catch { /* dir absent */ }
  const runRecords = new Map()
  for (const month of months.slice(-monthLimit)) {
    const file = join(historyDir, `runs-${month}.json`)
    try {
      const raw = readFileSync(file, 'utf8')
      const parsed = JSON.parse(raw)
      files.push({ file, size: Buffer.byteLength(raw), mtimeMs: 0 })
      for (const record of Array.isArray(parsed?.records) ? parsed.records : []) {
        if (record && typeof record.run_id === 'string') runRecords.set(record.run_id, record)
      }
    } catch (error) {
      statuses.push({ status: 'DEGRADED', reason: `projection ${month} unreadable: ${error?.message ?? error}` })
    }
  }
  for (const [runId, record] of runRecords) {
    rowsRead += 1
    records.push({
      source: 'scheduler_history',
      kind: 'run_record',
      provenanceClass: 'PRIMARY_PERSISTED',
      atMs: Number.isFinite(record.started_at_ms ?? Date.parse(record.scheduled_at)) ? (record.started_at_ms ?? Date.parse(record.scheduled_at)) : null,
      nativeRefs: { run_id: runId, occurrence_id: record.occurrence_id, job_id: record.job_id, ...(record.session_id ? { sessionId: record.session_id } : {}), ...(record.correlation_id ? { correlation_id: record.correlation_id } : {}) },
      dedupeKey: `runrec:${runId}`,
      data: record,
    })
  }
  records.sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0))
  return { status: mergeStatus(statuses), records, files, rowsRead }
}
