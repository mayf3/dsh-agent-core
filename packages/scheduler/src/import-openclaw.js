/**
 * @agent-core/scheduler — OpenClaw → V1 job import.
 *
 * Maps the REAL OpenClaw job shape (verified against the live
 * `~/.openclaw/cron/jobs.json` inventory) onto the V1 model, field by field.
 * The mapping is intentionally lossless for every field with real usage;
 * dormant fields are either normalized (top-level timeoutSec/timeoutMs/
 * runTimeoutMs → payload.timeoutSeconds) or reported as gaps.
 *
 * Returns { jobs, report } where report enumerates, per job:
 *   - gap:       semantic field that V1 cannot express (job NOT imported)
 *   - warnings:  dormant fields dropped without behavioral change
 *
 * See docs/investigations/scheduler-replacement-audit.md (field mapping table).
 */

import { normalizeJob } from './job-model.js'
import { DEFAULT_TOP_OF_HOUR_STAGGER_MS, isRecurringTopOfHourCronExpr, parseAbsoluteTimeMs } from './schedule.js'

/** Fields with zero real usage in the live inventory — dropped without warning noise. */
const DORMANT_SILENT_FIELDS = new Set(['wakeMode', 'state.status'])

function mapPayload(rawPayload, job) {
  const kind = String(rawPayload?.kind ?? 'agentTurn').trim().toLowerCase()
  if (kind !== 'agentturn') {
    return { error: `payload.kind '${kind}' not executable by V1` }
  }
  const message = typeof rawPayload?.message === 'string' ? rawPayload.message : ''
  if (!message.trim()) return { error: 'payload.message empty' }

  const payload = { kind: 'agentTurn', message }

  // Canonical timeout is payload.timeoutSeconds; legacy top-level fields are
  // equivalent runtime behavior (OpenClaw resolveCronJobTimeoutMs only reads
  // payload.timeoutSeconds, so importing them here is behavior-preserving).
  let timeoutSeconds = rawPayload.timeoutSeconds
  if (typeof timeoutSeconds !== 'number' || !Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    // Legacy top-level timeout fields map into the canonical payload field —
    // behavior-preserving (OpenClaw resolveCronJobTimeoutMs only reads
    // payload.timeoutSeconds), so this is NOT a gap or a warning.
    for (const legacy of ['timeoutSec', 'timeoutMs', 'runTimeoutMs']) {
      if (typeof job[legacy] === 'number' && Number.isFinite(job[legacy]) && job[legacy] > 0) {
        timeoutSeconds = legacy === 'timeoutMs' || legacy === 'runTimeoutMs'
          ? job[legacy] / 1000
          : job[legacy]
        break
      }
    }
  }
  if (typeof timeoutSeconds === 'number' && Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
    payload.timeoutSeconds = Math.floor(timeoutSeconds)
  }
  if (rawPayload?.lightContext === true) payload.lightContext = true
  if (typeof rawPayload?.model === 'string' && rawPayload.model.trim()) payload.model = rawPayload.model.trim()
  return { payload }
}

function mapSchedule(rawSchedule, jobId, warnings) {
  const kind = String(rawSchedule?.kind ?? '').trim().toLowerCase()
  if (kind === 'at') {
    const atMs = parseAbsoluteTimeMs(rawSchedule.at)
    if (atMs === null) return { error: `schedule.at invalid: ${rawSchedule?.at}` }
    return { schedule: { kind: 'at', at: new Date(atMs).toISOString() } }
  }
  if (kind === 'every') {
    const everyMs = typeof rawSchedule.everyMs === 'number' ? rawSchedule.everyMs : Number(rawSchedule.everyMs)
    if (!Number.isFinite(everyMs) || everyMs < 1) return { error: `schedule.everyMs invalid: ${rawSchedule?.everyMs}` }
    const out = { kind: 'every', everyMs: Math.max(1, Math.floor(everyMs)) }
    const anchorMs = typeof rawSchedule.anchorMs === 'number' ? rawSchedule.anchorMs : Number(rawSchedule.anchorMs)
    if (Number.isFinite(anchorMs)) out.anchorMs = Math.max(0, Math.floor(anchorMs))
    return { schedule: out }
  }
  if (kind === 'cron') {
    const expr = typeof rawSchedule.expr === 'string' ? rawSchedule.expr.trim() : ''
    if (!expr || expr.split(/\s+/).filter(Boolean).length !== 5) {
      return { error: `schedule.expr invalid (need 5 fields): ${expr}` }
    }
    const out = { kind: 'cron', expr }
    if (typeof rawSchedule.tz === 'string' && rawSchedule.tz.trim()) out.tz = rawSchedule.tz.trim()
    // Effective stagger: explicit > auto top-of-hour default (OpenClaw normalize
    // stores the same value into jobs.json at creation time).
    if (typeof rawSchedule.staggerMs === 'number' && Number.isFinite(rawSchedule.staggerMs) && rawSchedule.staggerMs > 0) {
      out.staggerMs = Math.floor(rawSchedule.staggerMs)
    } else if (isRecurringTopOfHourCronExpr(expr)) {
      out.staggerMs = DEFAULT_TOP_OF_HOUR_STAGGER_MS
    }
    return { schedule: out }
  }
  return { error: `schedule.kind '${String(rawSchedule?.kind)}' unsupported` }
}

function mapDelivery(rawDelivery, jobId, warnings) {
  const mode = String(rawDelivery?.mode ?? 'none').trim().toLowerCase()
  if (!['announce', 'none', 'silent'].includes(mode)) {
    return { error: `delivery.mode '${mode}' unsupported` }
  }
  const delivery = { mode }
  if (typeof rawDelivery?.channel === 'string' && rawDelivery.channel.trim()) delivery.channel = rawDelivery.channel.trim()
  if (typeof rawDelivery?.to === 'string' && rawDelivery.to.trim()) delivery.to = rawDelivery.to.trim()
  if (rawDelivery?.bestEffort === true) delivery.bestEffort = true
  return { delivery }
}

/** Map one raw OpenClaw job onto V1. Returns { job?, gap?, warnings }. */
export function mapOpenClawJob(raw, { nowMs = Date.now() } = {}) {
  const warnings = []
  const id = String(raw?.id ?? '')
  const name = String(raw?.name ?? '')
  if (!id || !name.trim()) return { gap: 'job missing id or name', warnings }

  const agentId = typeof raw.agentId === 'string' && raw.agentId.trim() ? raw.agentId.trim() : undefined
  if (!agentId) {
    return {
      gap: 'no agentId — V1 requires exactly one target agent (legacy job; broken in OpenClaw today, see audit §3.2)',
      warnings,
    }
  }

  const payloadResult = mapPayload(raw.payload, raw, warnings)
  if (payloadResult.error) return { gap: payloadResult.error, warnings }

  const scheduleResult = mapSchedule(raw.schedule, id, warnings)
  if (scheduleResult.error) return { gap: scheduleResult.error, warnings }

  const deliveryResult = mapDelivery(raw.delivery, id, warnings)
  if (deliveryResult.error) return { gap: deliveryResult.error, warnings }

  const sessionTarget = String(raw.sessionTarget ?? 'isolated').trim().toLowerCase()
  if (!['isolated', 'main'].includes(sessionTarget)) {
    return { gap: `sessionTarget '${sessionTarget}' unsupported`, warnings }
  }

  for (const key of Object.keys(raw)) {
    if (DORMANT_SILENT_FIELDS.has(key)) continue
    if (['id', 'name', 'agentId', 'enabled', 'schedule', 'sessionTarget', 'payload', 'delivery',
      'description', 'sessionKey', 'deleteAfterRun', 'createdAtMs', 'updatedAtMs', 'state',
      'timeoutSec', 'timeoutMs', 'runTimeoutMs', 'everyMs'].includes(key)) continue
    warnings.push(`dormant field '${key}' dropped`)
  }

  const jobInput = {
    id,
    name: name.trim(),
    agentId,
    enabled: raw.enabled !== false,
    schedule: scheduleResult.schedule,
    sessionTarget,
    payload: payloadResult.payload,
    delivery: deliveryResult.delivery,
    createdAtMs: raw.createdAtMs,
    updatedAtMs: raw.updatedAtMs,
    state: raw.state,
  }
  if (typeof raw.description === 'string' && raw.description.trim()) jobInput.description = raw.description.trim()
  if (typeof raw.sessionKey === 'string' && raw.sessionKey.trim()) jobInput.sessionKey = raw.sessionKey.trim()
  if (typeof raw.deleteAfterRun === 'boolean') jobInput.deleteAfterRun = raw.deleteAfterRun

  try {
    return { job: normalizeJob(jobInput, { nowMs }), warnings }
  } catch (error) {
    return { gap: `validation: ${error.message}`, warnings }
  }
}

/**
 * Import an OpenClaw jobs array (e.g. `{version, jobs}` from
 * ~/.openclaw/cron/jobs.json) into V1.
 * @returns {{ jobs: object[], report: { total, imported, gaps: [{id,name,reason}], warnings: [{id,name,detail}] } }}
 */
export function importOpenClawJobs(rawJobs, { nowMs = Date.now(), enabledOnly = true } = {}) {
  const jobs = []
  const gaps = []
  const warnings = []
  let total = 0
  for (const raw of rawJobs) {
    if (enabledOnly && raw.enabled !== true) continue
    total += 1
    const { job, gap, warnings: jobWarnings } = mapOpenClawJob(raw, { nowMs })
    for (const w of jobWarnings) warnings.push({ id: raw.id, name: raw.name, detail: w })
    if (gap) {
      gaps.push({ id: raw.id, name: raw.name, reason: gap })
    } else {
      jobs.push(job)
    }
  }
  return {
    jobs,
    report: { total, imported: jobs.length, gaps, warnings },
  }
}
