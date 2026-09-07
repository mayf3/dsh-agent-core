/** Pure records, classification, and query helpers for Scheduler history. */

export const HISTORY_STORE_VERSION = 1

/** Durable occurrence states — EXACT D-007 §6 set (never extended here). */
export const HISTORY_OUTCOMES = new Set(['admitted', 'running', 'succeeded', 'failed', 'outcome_unknown'])

/** status_view vocabulary (R3): derived, never durable. */
export const STATUS_VIEW_VOCABULARY = new Set([
  'success', 'failed', 'timeout', 'cancelled', 'running', 'admitted', 'scheduled',
])

/** error_code classification vocabulary (R10). */
export const ERROR_CODES = new Set([
  'FAILED', 'TIMEOUT', 'CANCELLED', 'DELIVERY_FAILED',
  'AGENT_NOT_FOUND', 'AGENT_DISABLED', 'AGENT_START_FAILED',
])

/** Structured-result ingestion error codes (R4). */
export const RESULT_ERROR_CODES = new Set(['UNPARSEABLE', 'OVERSIZE', 'INVALID_SCHEMA'])
export const RESULT_STATUSES = new Set(['PASS', 'PARTIAL', 'FAIL'])

const MAX_ERROR_MESSAGE_CHARS = 2000

export const cloneHistoryValue = (value) => (value === undefined ? undefined : structuredClone(value))

export function historyMonth(tsMs) {
  const d = new Date(tsMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}${m}`
}

export function historyIso(tsMs) {
  return Number.isFinite(tsMs) ? new Date(tsMs).toISOString() : null
}

export function truncateHistoryError(message) {
  if (message === undefined || message === null || message === '') return null
  const text = String(message)
  return text.length > MAX_ERROR_MESSAGE_CHARS ? `${text.slice(0, MAX_ERROR_MESSAGE_CHARS)}…` : text
}

/** status_view derivation (R3, frozen): pure projection of outcome + error_code. */
export function deriveStatusView(outcome, errorCode) {
  if (errorCode === 'TIMEOUT') return 'timeout'
  if (errorCode === 'CANCELLED') return 'cancelled'
  if (outcome === 'succeeded') return 'success'
  if (outcome === 'failed') return 'failed'
  if (outcome === 'running') return 'running'
  if (outcome === 'admitted') return 'admitted'
  return 'outcome_unknown'
}

/** Classify engine states/reasons/evidence into the frozen R10 error codes. */
export function deriveErrorCode(classification) {
  if (classification === undefined || classification === null) return null
  const evidenceKind = classification?.terminalEvidence?.kind
  if (evidenceKind === 'pre-start-rejection') {
    const code = classification?.rejectionCode
    if (code === 'AGENT_NOT_FOUND' || code === 'AGENT_DISABLED') return code
    const reason = classification?.reason ?? ''
    if (/AGENT_NOT_FOUND/i.test(reason) || /\bnot found\b/i.test(reason)) return 'AGENT_NOT_FOUND'
    if (/AGENT_DISABLED/i.test(reason) || /\bdisabled\b/i.test(reason)) return 'AGENT_DISABLED'
    return 'FAILED'
  }
  if (evidenceKind === 'cancellation_ack') return 'CANCELLED'
  const state = classification?.state ?? classification?.outcome
  if (state === 'outcome_unknown') {
    if (/deadline exceeded/i.test(classification?.reason ?? '')) return 'TIMEOUT'
    return null
  }
  if (state === 'failed') return 'FAILED'
  return null
}

/** Build one deterministic query-surface RunRecord from execution facts. */
export function buildRunRecord({ occurrence, classification, deliveryStatus, outcome, startedAt, startEvidence, admittedAt, scheduledAtMs }) {
  const state = classification?.state ?? 'admitted'
  let errorCode = deriveErrorCode(classification)
  if (errorCode === null && deliveryStatus === 'not-delivered') errorCode = 'DELIVERY_FAILED'
  const result = outcome?.result && typeof outcome.result === 'object' ? outcome.result : null
  const resultErrorCode = typeof outcome?.result_error_code === 'string' ? outcome.result_error_code : null
  const recorded = result !== null
  return {
    run_id: occurrence.runId,
    occurrence_id: occurrence.occurrenceId,
    job_id: occurrence.jobId,
    session_id: occurrence.nativeSessionId ?? null,
    agent_id: occurrence.agentId,
    schedule_revision: occurrence.scheduleRevision,
    model: occurrence.model ?? null,
    resolved_model: null,
    scheduled_at: historyIso(scheduledAtMs),
    admitted_at: historyIso(admittedAt),
    started_at: historyIso(startedAt),
    start_evidence: startEvidence ?? null,
    ended_at: historyIso(classification?.endedAt),
    duration_ms: Number.isFinite(admittedAt) && Number.isFinite(classification?.endedAt)
      ? classification.endedAt - admittedAt
      : null,
    outcome: state,
    status_view: deriveStatusView(state, errorCode),
    delivery_status: deliveryStatus ?? 'unknown',
    retry_count: occurrence.retryCount ?? 0,
    retry_of_occurrence_id: occurrence.retryOfOccurrenceId ?? null,
    error_code: errorCode,
    error_message: state === 'succeeded' ? null : truncateHistoryError(classification?.reason),
    correlation_id: occurrence.correlationId,
    parent_run_id: occurrence.parentRunId ?? null,
    request_id: occurrence.idempotencyKey ?? occurrence.occurrenceId,
    request_id_source: 'execution-authority',
    result: cloneHistoryValue(result),
    result_status: recorded && RESULT_STATUSES.has(result?.final_status) ? result.final_status : null,
    result_recorded: recorded,
    result_error_code: RESULT_ERROR_CODES.has(resultErrorCode) ? resultErrorCode : null,
  }
}

/** Admission-time definition projection retained after deleteAfterRun. */
export function buildJobSnapshot(job, record) {
  if (job === undefined || job === null) {
    return {
      name: null, agent_id: record?.agentId ?? null, schedule: null,
      delete_after_run: null, payload_hash: record?.payloadHash ?? null, delivery_mode: null,
    }
  }
  const schedule = { kind: job.schedule?.kind }
  if (typeof job.schedule?.expr === 'string') schedule.expr = job.schedule.expr
  if (Number.isFinite(job.schedule?.everyMs)) schedule.everyMs = job.schedule.everyMs
  if (Number.isFinite(job.schedule?.at)) schedule.at = job.schedule.at
  return {
    name: job.name ?? null,
    agent_id: job.agentId ?? null,
    schedule,
    delete_after_run: job.deleteAfterRun ?? null,
    payload_hash: record?.payloadHash ?? null,
    delivery_mode: job.delivery?.mode ?? null,
  }
}

/** Pure filter + sort + cursor pagination over run records (R7, frozen). */
export function applyRunFilters(runsMap, filters) {
  const {
    jobId, agentId, status, from, to, sessionId, correlationId, occurrenceId,
    limit = 50, cursor,
  } = filters
  const cappedLimit = Math.max(1, Math.min(200, Math.floor(limit) || 50))
  let notice
  let statusFilter = status
  if (status === 'scheduled') {
    statusFilter = '__none__'
    notice = 'scheduled is not a durable history state (records start at admitted); no runs match'
  }
  let all = [...runsMap.values()]
  if (jobId !== undefined) all = all.filter((record) => record.job_id === jobId)
  if (agentId !== undefined) all = all.filter((record) => record.agent_id === agentId)
  if (sessionId !== undefined) all = all.filter((record) => record.session_id === sessionId)
  if (correlationId !== undefined) all = all.filter((record) => record.correlation_id === correlationId)
  if (occurrenceId !== undefined) all = all.filter((record) => record.occurrence_id === occurrenceId)
  if (from !== undefined) all = all.filter((record) => record.scheduled_at !== null && Date.parse(record.scheduled_at) >= from)
  if (to !== undefined) all = all.filter((record) => record.scheduled_at !== null && Date.parse(record.scheduled_at) <= to)
  if (statusFilter === '__none__') {
    all = []
  } else if (statusFilter === 'outcome_unknown') {
    all = all.filter((record) => record.outcome === 'outcome_unknown')
  } else if (statusFilter !== undefined) {
    all = all.filter((record) => record.status_view === statusFilter)
  }
  all.sort((a, b) => {
    const at = String(a.scheduled_at ?? '')
    const bt = String(b.scheduled_at ?? '')
    if (at !== bt) return at > bt ? -1 : 1
    return a.run_id.localeCompare(b.run_id)
  })
  let start = 0
  if (cursor !== undefined) {
    const decoded = decodeCursor(cursor)
    const idx = all.findIndex((record) =>
      String(record.scheduled_at ?? '') === decoded.scheduled_at && record.run_id === decoded.run_id)
    start = idx === -1 ? 0 : idx + 1
  }
  const page = all.slice(start, start + cappedLimit)
  const nextCursor = start + cappedLimit < all.length && page.length > 0
    ? encodeCursor({ scheduled_at: page[page.length - 1].scheduled_at, run_id: page[page.length - 1].run_id })
    : null
  return { runs: page, nextCursor, notice }
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function decodeCursor(cursor) {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (typeof value?.run_id !== 'string') throw new Error('bad cursor')
    return { scheduled_at: value.scheduled_at ?? '', run_id: value.run_id }
  } catch {
    throw Object.assign(new Error('invalid cursor'), { code: 'invalid_query' })
  }
}
