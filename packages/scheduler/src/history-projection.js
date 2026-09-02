/** Event replay and materialized projection helpers for HistoryStore. */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { deriveNativeSessionId } from './occurrence-model.js'
import {
  HISTORY_OUTCOMES,
  HISTORY_STORE_VERSION,
  buildRunRecord,
  cloneHistoryValue,
  historyIso,
  historyMonth,
} from './history-model.js'

const EVENT_TYPES = new Set([
  'occurrence_reserved', 'run_state', 'run_terminal', 'delivery_outcome',
  'late_settlement', 'result_recorded', 'fence_event',
])

const STATE_RANK = { admitted: 0, running: 1, outcome_unknown: 2, failed: 3, succeeded: 3 }

/** Replay one immutable event into the in-memory occurrence/run projections. */
export function applyHistoryEvent(store, event) {
  if (event === null || typeof event !== 'object') throw new Error('malformed event')
  if (!EVENT_TYPES.has(event.type)) throw new Error(`unknown event type: ${event.type}`)
  store._seq = Math.max(store._seq, event.seq ?? 0)
  const ts = event.ts
  if (event.type === 'occurrence_reserved') {
    const existing = store._occurrences.get(event.occurrence_id)
    if (existing !== undefined) {
      existing.maxSeq = Math.max(existing.maxSeq ?? 0, event.seq ?? 0)
      return
    }
    store._occurrences.set(event.occurrence_id, {
      occurrenceId: event.occurrence_id,
      runId: event.run_id,
      jobId: event.job_id,
      scheduleRevision: event.schedule_revision,
      origin: event.origin,
      scheduledAtMs: event.scheduled_at_ms,
      admittedAt: event.admitted_at_ms,
      payloadHash: event.payload_hash,
      idempotencyKey: event.idempotency_key,
      agentId: event.job_snapshot?.agent_id ?? null,
      model: event.model ?? null,
      retryOfOccurrenceId: event.retry_of_occurrence_id ?? null,
      correlationId: event.correlation_id,
      parentRunId: event.parent_run_id ?? null,
      jobSnapshot: event.job_snapshot,
      state: 'admitted',
      fenced: false,
      startedAt: null,
      startEvidence: null,
      endedAt: null,
      lastReason: null,
      deadlineAtMs: event.deadline_at_ms ?? null,
      timeoutSeconds: event.timeout_seconds ?? null,
      months: new Set([historyMonth(event.scheduled_at_ms ?? ts)]),
      maxSeq: event.seq ?? 0,
    })
    materializeHistoryRun(store, store._occurrences.get(event.occurrence_id))
    return
  }
  const view = store._occurrences.get(event.occurrence_id)
  if (view === undefined) {
    throw new Error(`event ${event.type} for unknown occurrence ${event.occurrence_id}`)
  }
  view.maxSeq = Math.max(view.maxSeq ?? 0, event.seq ?? 0)
  if (Number.isFinite(event.started_at_ms)) {
    view.startedAt = event.started_at_ms
    view.startEvidence = event.start_evidence ?? view.startEvidence
  }
  if (event.type === 'run_state' || event.type === 'run_terminal') {
    if (typeof event.reason === 'string') view.lastReason = event.reason
  }
  if (event.type === 'run_state' || event.type === 'run_terminal' || event.type === 'late_settlement') {
    const next = event.type === 'late_settlement' ? event.resolved_to : event.state
    if (HISTORY_OUTCOMES.has(next) && (STATE_RANK[next] ?? 0) > (STATE_RANK[view.state] ?? 0)) {
      view.state = next
    }
    if (next === 'outcome_unknown') view.fenced = true
  }
  if (event.type === 'late_settlement') {
    view.fenced = false
    if (Number.isFinite(event.ended_at_ms)) view.endedAt = event.ended_at_ms
  }
  if (event.type === 'run_terminal') {
    if (event.state === 'succeeded' || event.state === 'failed') view.fenced = false
    if (Number.isFinite(event.ended_at_ms)) view.endedAt = event.ended_at_ms
    if (event.terminal_evidence !== undefined) view.terminalEvidence = event.terminal_evidence
    if (event.run_record !== undefined) {
      const record = event.run_record
      view.months.add(historyMonth(Date.parse(record.scheduled_at)))
      store._runs.set(record.run_id, record)
      return
    }
  }
  materializeHistoryRun(store, view)
}

/** Rebuild one query-surface record while carrying earlier richer faces. */
export function materializeHistoryRun(store, view) {
  const previous = store._runs.get(view.runId)
  const built = buildRunRecord({
    occurrence: {
      occurrenceId: view.occurrenceId,
      runId: view.runId,
      jobId: view.jobId,
      scheduleRevision: view.scheduleRevision,
      nativeSessionId: deriveNativeSessionId(view.occurrenceId),
      agentId: view.agentId,
      model: view.model,
      idempotencyKey: view.idempotencyKey,
      retryOfOccurrenceId: view.retryOfOccurrenceId,
      correlationId: view.correlationId,
      parentRunId: view.parentRunId,
      retryCount: historyRetryCount(store, view.occurrenceId),
    },
    classification: {
      state: view.state,
      reason: view.lastReason,
      endedAt: view.endedAt,
      terminalEvidence: view.terminalEvidence,
    },
    deliveryStatus: previous?.delivery_status ?? 'unknown',
    outcome: { result: previous?.result, result_error_code: previous?.result_error_code },
    startedAt: view.startedAt,
    startEvidence: view.startEvidence,
    admittedAt: view.admittedAt,
    scheduledAtMs: view.scheduledAtMs,
  })
  store._runs.set(view.runId, built)
}

export function deriveHistoryChain(store, record) {
  const retryOf = record.retryOfOccurrenceId ?? null
  if (retryOf === null) {
    return { correlationId: `schcorr:${record.occurrenceId}`, parentRunId: null }
  }
  const parent = store._occurrences.get(retryOf)
  if (parent === undefined) {
    return { correlationId: `schcorr:${record.occurrenceId}`, parentRunId: `run:${retryOf}` }
  }
  return { correlationId: parent.correlationId, parentRunId: parent.runId }
}

export function historyRetryCount(store, occurrenceId) {
  let count = 0
  let cursor = store._occurrences.get(occurrenceId)
  const seen = new Set()
  while (cursor?.retryOfOccurrenceId && !seen.has(cursor.retryOfOccurrenceId)) {
    count += 1
    seen.add(cursor.retryOfOccurrenceId)
    cursor = store._occurrences.get(cursor.retryOfOccurrenceId)
  }
  return count
}

export function historyChainRootFirst(store, occurrenceId) {
  const chain = [occurrenceId]
  const seen = new Set(chain)
  let cursor = store._occurrences.get(occurrenceId)
  while (cursor?.retryOfOccurrenceId && !seen.has(cursor.retryOfOccurrenceId)) {
    chain.unshift(cursor.retryOfOccurrenceId)
    seen.add(cursor.retryOfOccurrenceId)
    cursor = store._occurrences.get(cursor.retryOfOccurrenceId)
  }
  return chain
}

export function publicHistoryOccurrence(view) {
  return {
    occurrence_id: view.occurrenceId,
    job_id: view.jobId,
    job_snapshot: cloneHistoryValue(view.jobSnapshot),
    schedule_revision: view.scheduleRevision,
    scheduled_at: historyIso(view.scheduledAtMs),
    origin: view.origin,
    retry_of_occurrence_id: view.retryOfOccurrenceId,
    catchup_of_nominal_at: view.origin === 'catchup' ? historyIso(view.scheduledAtMs) : null,
    state: view.state,
    fenced: view.fenced,
    payload_hash: view.payloadHash,
    admitted_at: historyIso(view.admittedAt),
    updated_at: historyIso(view.endedAt ?? view.admittedAt),
  }
}

/** Write one monthly projection with tmp + fsync + atomic rename. */
export async function writeHistoryPartition(store, month) {
  const records = [...store._runs.values()]
    .filter((record) => record.scheduled_at && historyMonth(Date.parse(record.scheduled_at)) === month)
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)) || a.run_id.localeCompare(b.run_id))
  let lastEventSeq = 0
  for (const view of store._occurrences.values()) {
    if ((view.months ?? new Set()).has(month)) lastEventSeq = Math.max(lastEventSeq, view.maxSeq ?? 0)
  }
  const partition = { version: HISTORY_STORE_VERSION, month, last_event_seq: lastEventSeq, records }
  const tmp = path.join(store.dir, `.runs-${month}.json.tmp-${process.pid}-${Date.now()}`)
  const handle = await fs.open(tmp, 'w')
  try {
    await handle.writeFile(Buffer.from(`${JSON.stringify(partition, null, 2)}\n`, 'utf8'))
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(tmp, path.join(store.dir, `runs-${month}.json`))
}
