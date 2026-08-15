/**
 * @agent-core/scheduler — the minimum job model.
 *
 * V1 schema is deliberately a 1:1 subset of the real OpenClaw job shape (see
 * docs/investigations/scheduler-replacement-audit.md field mapping). Only
 * fields with real usage in the live 140-job inventory are modeled; dormant
 * OpenClaw fields (wakeMode, top-level timeoutSec/timeoutMs/runTimeoutMs,
 * payload.kind systemEvent) are normalized on import, not carried forward.
 *
 * Job shape (V1):
 *
 *   {
 *     id: string,                      // stable id (uuid)
 *     name: string,
 *     agentId: string,                 // REQUIRED (3 legacy jobs lack it and are
 *                                      //   broken in OpenClaw today — see audit)
 *     enabled: boolean,
 *     schedule: { kind:'cron', expr, tz?, staggerMs? }
 *             | { kind:'at', at }      // ISO instant
 *             | { kind:'every', everyMs, anchorMs? },
 *     sessionTarget: 'isolated'|'main',// default 'isolated' (135/140 real)
 *     sessionKey?: string,             // opaque; overrides sessionTarget when set
 *     payload: {
 *       kind: 'agentTurn',             // only kind V1 executes
 *       message: string,
 *       timeoutSeconds?: number,       // canonical run timeout
 *       lightContext?: boolean,        // opaque pass-through to the invocation
 *       model?: string,                // opaque pass-through (model override)
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
 *     state: {                         // execution state (persisted)
 *       nextRunAtMs?, lastRunAtMs?, lastRunStatus?, lastStatus?,
 *       lastDurationMs?, lastDeliveryStatus?, consecutiveErrors?,
 *       lastError?, runningAtMs?, lastDelivered?,
 *     },
 *   }
 */

import { randomUUID } from 'node:crypto'
import { normalizeSchedule } from './schedule.js'

export const DELIVERY_MODES = new Set(['announce', 'none', 'silent'])
export const SESSION_TARGETS = new Set(['isolated', 'main'])
export const RUN_STATUSES = new Set(['ok', 'error', 'skipped'])

export function normalizeOptionalText(value, label) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`)
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Strict V1 job validation. Throws TypeError with a stable message on any violation. */
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

  const sessionTarget = String(input.sessionTarget ?? 'isolated').trim().toLowerCase()
  if (!SESSION_TARGETS.has(sessionTarget)) {
    throw new TypeError(`job.sessionTarget must be isolated|main, got: ${sessionTarget}`)
  }

  const job = {
    id: jobId,
    name,
    agentId,
    enabled: input.enabled !== false,
    schedule,
    sessionTarget,
    payload: {
      kind: 'agentTurn',
      message,
    },
    delivery: { mode },
    createdAtMs: Number.isFinite(input.createdAtMs) ? Math.floor(input.createdAtMs) : createdAtMs,
    updatedAtMs: Number.isFinite(input.updatedAtMs) ? Math.floor(input.updatedAtMs) : createdAtMs,
    state: {},
  }

  if (typeof input.description === 'string' && input.description.trim()) job.description = input.description.trim()
  if (typeof input.sessionKey === 'string' && input.sessionKey.trim()) job.sessionKey = input.sessionKey.trim()
  if (typeof payload.timeoutSeconds === 'number' && Number.isFinite(payload.timeoutSeconds) && payload.timeoutSeconds > 0) {
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
  return job
}

/** State field whitelist + numeric validation (drops unknown/dormant state keys). */
export function normalizeState(state) {
  const out = {}
  const numKeys = ['nextRunAtMs', 'lastRunAtMs', 'lastDurationMs', 'consecutiveErrors', 'runningAtMs']
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

/** Public view of a job (runtime state excluded from the wire view). */
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
