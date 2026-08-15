/**
 * @agent-core/scheduler — schedule evaluation (next run / previous run).
 *
 * Faithful minimal port of the OpenClaw gateway cron scheduler's schedule
 * layer (verified against the live OpenClaw 2026.3.13 bundle and the real
 * 140-job inventory):
 *
 *   - `cron`: 5-field expression evaluated with `croner` in the job timezone
 *     (explicit `tz`, default = system local timezone). Optional stable
 *     per-job stagger: offset = sha256(jobId) % staggerMs added to the base
 *     occurrence (top-of-hour recurring expressions default to 300s, matching
 *     OpenClaw's DEFAULT_TOP_OF_HOUR_STAGGER_MS).
 *   - `at`: one-shot absolute instant (ISO string or epoch ms).
 *   - `every`: fixed-rate anchored at `anchorMs` (default: job createdAt);
 *     next run = smallest anchor + k*everyMs strictly after now.
 *
 * All functions are pure (nowMs passed in), which keeps restart semantics
 * deterministic and testable.
 */

import { createHash } from 'node:crypto'
import { Cron } from 'croner'

/** OpenClaw DEFAULT_TOP_OF_HOUR_STAGGER_MS — auto stagger for `0 <hours-with-*> * * *`. */
export const DEFAULT_TOP_OF_HOUR_STAGGER_MS = 300 * 1000
/** Safety net: never schedule a refire closer than this to the previous run end. */
export const MIN_REFIRE_GAP_MS = 2000

const CRON_EVAL_CACHE = new Map()
const CRON_EVAL_CACHE_MAX = 512

/** Parse an absolute instant: epoch ms, ISO date-time (Z or offset), ISO date. */
export function parseAbsoluteTimeMs(input) {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
    return null
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw) ? `${raw}Z`
      : raw
  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const DURATION_RE = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/

/** Parse a relative duration ("15m", "1h30m" unsupported; "90s", "2d"). */
export function parseDurationMs(input) {
  if (typeof input !== 'string') return null
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  const m = DURATION_RE.exec(raw)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2] ?? 'ms'
  const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit]
  return Math.floor(n * mult)
}

/** Parse "15m"/"2026-08-15T09:00:00Z" into an absolute epoch (relative resolved against nowMs). */
export function parseAtToMs(input, nowMs = Date.now()) {
  if (typeof input !== 'string') return null
  const absolute = parseAbsoluteTimeMs(input)
  if (absolute !== null) return absolute
  const dur = parseDurationMs(input)
  if (dur !== null) return nowMs + dur
  return null
}

export function resolveCronTimezone(tz) {
  const trimmed = typeof tz === 'string' ? tz.trim() : ''
  if (trimmed) return trimmed
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function resolveCron(expr, timezone) {
  const tz = resolveCronTimezone(timezone)
  const key = `${tz}\u0000${expr}`
  let cron = CRON_EVAL_CACHE.get(key)
  if (cron) return cron
  if (CRON_EVAL_CACHE.size >= CRON_EVAL_CACHE_MAX) {
    CRON_EVAL_CACHE.delete(CRON_EVAL_CACHE.keys().next().value)
  }
  cron = new Cron(expr, { timezone: tz, catch: false })
  CRON_EVAL_CACHE.set(key, cron)
  return cron
}

/** 5-field top-of-hour recurring? (minute field "0" and hour field contains "*"). */
export function isRecurringTopOfHourCronExpr(expr) {
  const fields = typeof expr === 'string' ? expr.trim().split(/\s+/).filter(Boolean) : []
  if (fields.length !== 5) return false
  const [minuteField, hourField] = fields
  return minuteField === '0' && hourField.includes('*')
}

/** Effective staggerMs for a cron job: explicit > auto top-of-hour default > 0. */
export function resolveCronStaggerMs(schedule) {
  if (typeof schedule.staggerMs === 'number' && Number.isFinite(schedule.staggerMs) && schedule.staggerMs > 0) {
    return Math.floor(schedule.staggerMs)
  }
  return isRecurringTopOfHourCronExpr(schedule.expr) ? DEFAULT_TOP_OF_HOUR_STAGGER_MS : 0
}

/** Stable per-job offset inside the stagger window (sha256 of jobId), matching OpenClaw. */
function stableStaggerOffsetMs(jobId, staggerMs) {
  if (staggerMs <= 1) return 0
  const digest = createHash('sha256').update(jobId).digest()
  return digest.readUInt32BE(0) % staggerMs
}

function computeCronBaseNext(schedule, nowMs) {
  const cron = resolveCron(schedule.expr, schedule.tz)
  const next = cron.nextRun(new Date(nowMs))
  if (!next) return undefined
  const nextMs = next.getTime()
  if (!Number.isFinite(nextMs)) return undefined
  if (nextMs <= nowMs) {
    const nextSecondMs = Math.floor(nowMs / 1000) * 1000 + 1000
    const retry = cron.nextRun(new Date(nextSecondMs))
    if (retry) {
      const retryMs = retry.getTime()
      if (Number.isFinite(retryMs) && retryMs > nowMs) return retryMs
    }
    return undefined
  }
  return nextMs
}

function computeStaggeredCronNext(schedule, jobId, nowMs) {
  const staggerMs = resolveCronStaggerMs(schedule)
  const offsetMs = stableStaggerOffsetMs(jobId, staggerMs)
  if (offsetMs <= 0) return computeCronBaseNext(schedule, nowMs)
  let cursorMs = Math.max(0, nowMs - offsetMs)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const baseNext = computeCronBaseNext(schedule, cursorMs)
    if (baseNext === undefined) return undefined
    const shifted = baseNext + offsetMs
    if (shifted > nowMs) return shifted
    cursorMs = Math.max(cursorMs + 1, baseNext + 1000)
  }
  return undefined
}

function computeEveryNext(schedule, nowMs, fallbackAnchorMs) {
  const everyMsRaw = typeof schedule.everyMs === 'number' && Number.isFinite(schedule.everyMs)
    ? schedule.everyMs
    : typeof schedule.everyMs === 'string' ? Number(schedule.everyMs) : NaN
  if (!Number.isFinite(everyMsRaw) || everyMsRaw < 1) return undefined
  const everyMs = Math.max(1, Math.floor(everyMsRaw))
  const anchorRaw = typeof schedule.anchorMs === 'number' && Number.isFinite(schedule.anchorMs)
    ? schedule.anchorMs
    : typeof schedule.anchorMs === 'string' ? Number(schedule.anchorMs) : NaN
  const anchor = Math.max(0, Math.floor(Number.isFinite(anchorRaw) ? anchorRaw : fallbackAnchorMs))
  if (nowMs < anchor) return anchor
  const elapsed = nowMs - anchor
  return anchor + Math.max(1, Math.floor((elapsed + everyMs - 1) / everyMs)) * everyMs
}

/**
 * Next run instant for a schedule.
 * @param {object} schedule - {kind:'cron'|'at'|'every', ...}
 * @param {number} nowMs
 * @param {object} [opts] - { jobId?, fallbackAnchorMs? }
 * @returns {number|undefined} epoch ms strictly after nowMs, or undefined when none.
 */
export function computeNextRunAtMs(schedule, nowMs, opts = {}) {
  if (!schedule || typeof schedule.kind !== 'string') return undefined
  if (schedule.kind === 'at') {
    const atMs = parseAbsoluteTimeMs(schedule.at)
    if (atMs === null) return undefined
    return atMs > nowMs ? atMs : undefined
  }
  if (schedule.kind === 'every') {
    return computeEveryNext(schedule, nowMs, opts.fallbackAnchorMs ?? nowMs)
  }
  if (schedule.kind === 'cron') {
    return computeStaggeredCronNext(schedule, opts.jobId ?? '', nowMs)
  }
  return undefined
}

/**
 * Most recent cron occurrence at or before nowMs (missed-run catch-up basis).
 * Only meaningful for kind 'cron' (OpenClaw applies it to cron only).
 */
export function computePreviousRunAtMs(schedule, nowMs, opts = {}) {
  if (!schedule || schedule.kind !== 'cron') return undefined
  const staggerMs = resolveCronStaggerMs(schedule)
  const offsetMs = stableStaggerOffsetMs(opts.jobId ?? '', staggerMs)
  if (offsetMs <= 0) {
    const cron = resolveCron(schedule.expr, schedule.tz)
    const previous = cron.previousRuns(1, new Date(nowMs))[0]
    if (!previous) return undefined
    const previousMs = previous.getTime()
    return Number.isFinite(previousMs) && previousMs < nowMs ? previousMs : undefined
  }
  let cursorMs = Math.max(0, nowMs - offsetMs)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const cron = resolveCron(schedule.expr, schedule.tz)
    const basePrevious = cron.previousRuns(1, new Date(cursorMs))[0]
    if (!basePrevious) return undefined
    const shifted = basePrevious.getTime() + offsetMs
    if (shifted <= nowMs) return shifted
    cursorMs = Math.max(0, basePrevious.getTime() - 1000)
  }
  return undefined
}

/** Canonicalize an arbitrary schedule object into V1 shape (best-effort import). */
export function normalizeSchedule(raw, { nowMs = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object') throw new TypeError('schedule required')
  const kind = String(raw.kind ?? '').trim().toLowerCase()
  if (kind === 'at') {
    const at = typeof raw.at === 'string' && raw.at.trim() ? raw.at : undefined
    if (!at) throw new TypeError('schedule.at (ISO string) required for at jobs')
    const atMs = parseAbsoluteTimeMs(at)
    if (atMs === null) throw new TypeError(`schedule.at invalid: ${at}`)
    return { kind: 'at', at: new Date(atMs).toISOString() }
  }
  if (kind === 'every') {
    const everyMsRaw = typeof raw.everyMs === 'number' ? raw.everyMs : Number(raw.everyMs)
    if (!Number.isFinite(everyMsRaw) || everyMsRaw < 1) throw new TypeError('schedule.everyMs required for every jobs')
    const out = { kind: 'every', everyMs: Math.max(1, Math.floor(everyMsRaw)) }
    const anchorRaw = typeof raw.anchorMs === 'number' ? raw.anchorMs : Number(raw.anchorMs)
    if (Number.isFinite(anchorRaw)) out.anchorMs = Math.max(0, Math.floor(anchorRaw))
    return out
  }
  if (kind === 'cron') {
    const expr = typeof raw.expr === 'string' ? raw.expr.trim() : ''
    if (!expr) throw new TypeError('schedule.expr required for cron jobs')
    const fields = expr.split(/\s+/).filter(Boolean)
    if (fields.length !== 5) throw new TypeError(`schedule.expr must be 5 fields: ${expr}`)
    const out = { kind: 'cron', expr }
    if (typeof raw.tz === 'string' && raw.tz.trim()) out.tz = raw.tz.trim()
    const staggerMs = typeof raw.staggerMs === 'number' ? raw.staggerMs : Number(raw.staggerMs)
    if (Number.isFinite(staggerMs) && staggerMs > 0) out.staggerMs = Math.floor(staggerMs)
    // Validate the expression eagerly (fail-loud on unsupported syntax).
    resolveCron(expr, out.tz)
    return out
  }
  throw new TypeError(`schedule.kind must be cron|at|every, got: ${String(raw.kind)}`)
}
