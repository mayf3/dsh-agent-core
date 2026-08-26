/**
 * @agent-core/scheduler — the V2 job model (D-007 §3 true subset).
 *
 * Session selection fields are GONE from the schema (C-031 / D-007 §3.2:
 * NEW_JOB_SESSION_SELECTION_FIELDS = NONE): legacy `sessionTarget` /
 * `sessionKey` inputs are tolerated as migration input and stripped — every
 * scheduled execution gets a fresh non-main native Session per occurrence.
 *
 * `scheduleRevision` (D-007 §5.2): bumped by updateJob whenever a change
 * alters future occurrence semantics (schedule/payload/agentId/retry);
 * existing occurrences stay bound to the revision that created them.
 *
 * `retry` is the ONLY explicit auto-retry authorization (D-007 §7.5 /
 * C-009): absent or {auto:false} means AUTO_RETRY_DEFAULT = NO — ordinary
 * proven failures never replay automatically; a retry is always a NEW
 * occurrence.
 *
 * `state` is a DERIVED projection only (C-030): authority for execution
 * outcomes lives in the occurrence ledger; admission/ownership/termination
 * decisions never read these fields.
 *
 * Job shape (V2):
 *
 *   {
 *     id: string,                      // stable id (uuid)
 *     name: string,
 *     agentId: string,                 // REQUIRED
 *     enabled: boolean,
 *     scheduleRevision: number,        // definition revision (occurrences bind it)
 *     schedule: { kind:'cron', expr, tz?, staggerMs? }
 *             | { kind:'at', at }      // ISO instant
 *             | { kind:'every', everyMs, anchorMs? },
 *     retry?: { auto: boolean },       // explicit auto-retry authorization (default NO)
 *     payload: {
 *       kind: 'agentTurn',             // only kind V2 executes
 *       message: string,
 *       timeoutSeconds?: number,       // canonical run timeout
 *       lightContext?: boolean,        // opaque pass-through to the invocation
 *       model?: string,                // opaque pass-through (not proven by D-007)
 *     },
 *     delivery: {                      // opaque delivery directive — the
 *       mode: 'announce'|'none'|'silent', // scheduler never interprets channel/to
 *       channel?: string,              //   (e.g. 'feishu'|'last')
 *       to?: string,                   //   (e.g. 'chat:oc_<chatId>')
 *       bestEffort?: boolean,
 *     },
 *     deleteAfterRun?: boolean,        // default true for at jobs
 *     createdAtMs: number,
 *     updatedAtMs: number,
 *     state: { ... derived projection only (C-030) ... },
 *   }
 */

import { randomUUID } from 'node:crypto'
import { normalizeSchedule } from './schedule.js'

export const DELIVERY_MODES = new Set(['announce', 'none', 'silent'])
export const RUN_STATUSES = new Set(['ok', 'error', 'skipped'])

export function normalizeOptionalText(value, label) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`)
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Strict V2 job validation. Throws TypeError with a stable message on any violation. */
export function normalizeJob(input, { nowMs = Date.now(), id, createdAtMs = nowMs } = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('job required')

  // Explicit id option wins (updateJob pins identity); otherwise the input's
  // own id is preserved (load/import); fresh UUID only for brand-new jobs.
  const jobId = id !== undefined
    ? String(id)
    : typeof input.id === 'string' && input.id.trim()
      ? input.id.trim()
      : randomUUID()

  const name = normalizeOptionalText(input.name, 'name')
  if (!name) throw new TypeError('job.name is required')

  const agentId = normalizeOptionalText(input.agentId, 'agentId')
  if (!agentId) throw new TypeError('job.agentId is required (V1: every job targets exactly one agent)')

  const schedule = normalizeSchedule(input.schedule)

  const payload = input.payload ?? {}
  const payloadKind = String(payload.kind ?? 'agentTurn').trim().toLowerCase()
  if (payloadKind !== 'agentturn') {
    throw new TypeError(`job.payload.kind must be agentTurn (V1), got: ${payloadKind}`)
  }
  const message = normalizeOptionalText(payload.message, 'payload.message')
  if (!message) throw new TypeError('job.payload.message is required')

  const delivery = input.delivery ?? {}
  const mode = String(delivery.mode ?? 'none').trim().toLowerCase()
  if (!DELIVERY_MODES.has(mode)) throw new TypeError(`job.delivery.mode must be announce|none|silent, got: ${mode}`)

  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    throw new TypeError('job.enabled must be a boolean')
  }
  if (input.scheduleRevision !== undefined
    && (!Number.isSafeInteger(input.scheduleRevision) || input.scheduleRevision < 1)) {
    throw new TypeError('job.scheduleRevision must be a positive integer')
  }
  const job = {
    id: jobId,
    name,
    agentId,
    enabled: input.enabled ?? true,
    scheduleRevision: input.scheduleRevision ?? 1,
    schedule,
    payload: {
      kind: 'agentTurn',
      message,
    },
    delivery: { mode },
    createdAtMs: Number.isFinite(input.createdAtMs) ? Math.floor(input.createdAtMs) : createdAtMs,
    updatedAtMs: Number.isFinite(input.updatedAtMs) ? Math.floor(input.updatedAtMs) : createdAtMs,
    // Activation boundary of the current scheduleRevision's nominal-slot
    // space (D-007 §13.1: a (re)activated schedule starts from its first
    // FUTURE slot). Creation sets it to createdAtMs; updateJob bumps it on
    // semantic revision changes.
    revisionActivatedAtMs: Number.isFinite(input.revisionActivatedAtMs) ? Math.floor(input.revisionActivatedAtMs) : undefined,
    state: {},
  }
  if (job.revisionActivatedAtMs === undefined) job.revisionActivatedAtMs = job.createdAtMs

  if (typeof input.description === 'string' && input.description.trim()) job.description = input.description.trim()
  if (input.migrationRestoreBlocked !== undefined && input.migrationRestoreBlocked !== true) {
    throw new TypeError('job.migrationRestoreBlocked may only be true while the restore gate is closed')
  }
  if (input.migrationRestoreBlocked === true) job.migrationRestoreBlocked = true
  // Explicit auto-retry authorization (C-009 / D-007 §7.5 AUTO_RETRY_DEFAULT = NO).
  if (input.retry !== undefined) {
    if (!input.retry || typeof input.retry !== 'object' || typeof input.retry.auto !== 'boolean') {
      throw new TypeError('job.retry must be {auto:boolean}')
    }
    job.retry = { auto: input.retry.auto }
  }
  if (payload.timeoutSeconds !== undefined) {
    if (typeof payload.timeoutSeconds !== 'number' || !Number.isFinite(payload.timeoutSeconds)
      || payload.timeoutSeconds < 1) {
      throw new TypeError('job.payload.timeoutSeconds must be a positive number')
    }
    job.payload.timeoutSeconds = Math.floor(payload.timeoutSeconds)
  }
  if (typeof payload.lightContext === 'boolean') job.payload.lightContext = payload.lightContext
  if (typeof payload.model === 'string' && payload.model.trim()) job.payload.model = payload.model.trim()
  if (typeof delivery.channel === 'string' && delivery.channel.trim()) job.delivery.channel = delivery.channel.trim()
  if (typeof delivery.to === 'string' && delivery.to.trim()) job.delivery.to = delivery.to.trim()
  if (delivery.bestEffort === true) job.delivery.bestEffort = true

  const deleteAfterRun = typeof input.deleteAfterRun === 'boolean' ? input.deleteAfterRun : schedule.kind === 'at'
  job.deleteAfterRun = deleteAfterRun

  if (input.state && typeof input.state === 'object') {
    job.state = normalizeState(input.state)
  }
  // Legacy session selection fields (sessionTarget/sessionKey) are migration
  // INPUT only — stripped here, never persisted, never read by admission
  // (C-031 / D-007 §3.2).
  return job
}

/**
 * State field whitelist (derived projection only — C-030). Kept for stored-doc
 * compatibility; admission/ownership/termination decisions never read these.
 */
export function normalizeState(state) {
  const out = {}
  const numKeys = ['nextRunAtMs', 'lastRunAtMs', 'lastDurationMs', 'consecutiveErrors']
  for (const k of numKeys) {
    const v = state[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.floor(v)
  }
  for (const k of ['lastRunStatus', 'lastStatus', 'lastDeliveryStatus']) {
    const v = state[k]
    if (typeof v === 'string' && v) out[k] = v
  }
  for (const k of ['lastError']) {
    const v = state[k]
    if (typeof v === 'string' && v) out[k] = v
  }
  if (typeof state.lastDelivered === 'boolean') out.lastDelivered = state.lastDelivered
  return out
}

/** Public view of a job (derived state exposed as a convenience projection). */
export function toPublicJob(job) {
  const { state, ...rest } = job
  return {
    ...rest,
    nextRunAtMs: state?.nextRunAtMs,
    lastRunAtMs: state?.lastRunAtMs,
    lastStatus: state?.lastStatus,
    lastRunStatus: state?.lastRunStatus,
    lastDurationMs: state?.lastDurationMs,
    lastDeliveryStatus: state?.lastDeliveryStatus,
    lastError: state?.lastError,
    consecutiveErrors: state?.consecutiveErrors ?? 0,
  }
}

/** Deep clone helper for stored jobs. */
export function cloneJob(job) {
  return JSON.parse(JSON.stringify(job))
}
