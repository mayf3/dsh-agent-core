/**
 * Slot accounting — SILENT_DUE_SLOT_LOSS_OR_UNACCOUNTED_MISSED_SLOT closure.
 *
 * Invariant: every ELAPSED scheduled slot of an enabled job ends in at least
 * one durable accounting record. The occurrence ledger remains the class-1
 * authority (admitted slot == its occurrence); this module records the other
 * classes on the established runs.jsonl evidence channel:
 *
 *   OCCURRENCE_CREATED    (implicit — the occurrence itself; never emitted here)
 *   ADMISSION_REJECTED    exact reserve refusal reason
 *   ADMISSION_INTERRUPTED reserve threw before the occurrence was written
 *   SKIPPED_POLICY        engine chose not to run the slot (hold/fence/stale)
 *   MISSED_BEFORE_OCCURRENCE  slot elapsed with no engine observation
 *   ENGINE_HALTED         engine alive but not holding the admission lease
 *   DETECTION_INTERRUPTED slot-detection itself threw
 *
 * Records are append-only evidence; nothing here changes admission policy,
 * replays slots, or mutates the occurrence schema. Enumeration is bounded
 * (MAX_BACKFILL_SLOTS) — a longer outage collapses into one truncated record
 * rather than an unbounded write burst.
 */

import { computePreviousRunAtMs, parseAbsoluteTimeMs, MIN_REFIRE_GAP_MS } from '../schedule.js'
import { isTerminalRecord, latestTerminalOccurrence, previousNaturalSlotMs } from '../eligibility.js'

export const MAX_BACKFILL_SLOTS = 64

export const SLOT_ACCOUNTING_CLASSIFICATIONS = Object.freeze([
  'ADMISSION_REJECTED', 'ADMISSION_INTERRUPTED', 'SKIPPED_POLICY',
  'MISSED_BEFORE_OCCURRENCE', 'ENGINE_HALTED', 'DETECTION_INTERRUPTED',
])

export const SLOT_RECOVERY_CLASSIFICATIONS = Object.freeze([
  'SAFE_CATCHUP_SUPPORTED', 'SKIP_AND_CONTINUE', 'OWNER_POLICY_REQUIRED',
])

function gridSlots(schedule, fromMs, toMs) {
  const everyMs = Math.max(1, Math.floor(schedule.everyMs))
  const anchorRaw = typeof schedule.anchorMs === 'number' ? schedule.anchorMs : Number(schedule.anchorMs)
  const anchor = Number.isFinite(anchorRaw) ? Math.max(0, Math.floor(anchorRaw)) : null
  if (anchor === null || toMs < anchor) return []
  const latest = anchor + Math.floor((toMs - anchor) / everyMs) * everyMs
  const slots = []
  for (let slot = latest; slot > fromMs && slots.length <= MAX_BACKFILL_SLOTS; slot -= everyMs) {
    if (slot > fromMs) slots.push(slot)
  }
  return slots
}

function cronSlots(schedule, jobId, fromMs, toMs) {
  const slots = []
  let cursor = toMs
  for (let i = 0; i <= MAX_BACKFILL_SLOTS; i += 1) {
    let slot
    try {
      slot = computePreviousRunAtMs(schedule, cursor, { jobId })
    } catch {
      break
    }
    if (typeof slot !== 'number' || slot <= fromMs) break
    slots.push(slot)
    if (slots.length > MAX_BACKFILL_SLOTS) break
    cursor = slot
  }
  return slots
}

/** Elapsed schedule slots in the half-open window (fromMs, toMs], newest first. */
export function enumerateElapsedSlots({ schedule, jobId, fromMs, toMs }) {
  if (!schedule || typeof schedule.kind !== 'string' || !(toMs > fromMs)) return []
  if (schedule.kind === 'every') return gridSlots(schedule, fromMs, toMs)
  if (schedule.kind === 'cron') return cronSlots(schedule, jobId, fromMs, toMs)
  if (schedule.kind === 'at') {
    const slot = parseAbsoluteTimeMs(schedule.at)
    return slot !== null && slot > fromMs && slot <= toMs ? [slot] : []
  }
  return []
}

/** Latest nominal slot at-or-before nowMs (delegates to the eligibility seam). */
export function latestPastSlot({ schedule, jobId, nowMs }) {
  try {
    return previousNaturalSlotMs(schedule, jobId, nowMs)
  } catch {
    return null
  }
}

/** Per-engine-session dedupe: record each (job, slot) at most once. */
export function createSlotAccountingCursor() {
  const last = new Map()
  return {
    shouldRecord(jobId, slot) {
      if (typeof slot !== 'number') return false
      const seen = last.get(jobId)
      if (seen !== undefined && slot <= seen) return false
      return true
    },
    mark(jobId, slot) {
      if (typeof slot === 'number' && (!last.has(jobId) || slot > last.get(jobId))) last.set(jobId, slot)
    },
  }
}

export async function recordSlotAccounting(store, {
  ts, jobId, agentId, slot, classification, reason, recoveryClassification, occurrenceId, truncated,
}) {
  if (!SLOT_ACCOUNTING_CLASSIFICATIONS.includes(classification)) {
    throw new TypeError(`slot accounting: unknown classification ${classification}`)
  }
  if (recoveryClassification !== undefined && !SLOT_RECOVERY_CLASSIFICATIONS.includes(recoveryClassification)) {
    throw new TypeError(`slot accounting: unknown recoveryClassification ${recoveryClassification}`)
  }
  const event = {
    ts, action: 'slot_accounting', jobId, ...(agentId ? { agentId } : {}), slot,
    classification, reason: String(reason ?? '').slice(0, 300),
    ...(recoveryClassification ? { recoveryClassification } : {}),
    ...(occurrenceId ? { occurrenceId } : {}),
    ...(truncated === true ? { truncated: true } : {}),
  }
  const result = await store.appendRunEvent(event)
  return result?.ok === true
}

function operationalEndedAt(record) {
  return record.terminationSettlement?.committedAt ?? record.endedAt ?? record.admittedAt
}

/** The newest slot this job already has durable activity for (activity floor). */
export function lastAccountedFloorMs(job, occurrences) {
  const mine = occurrences.filter((record) => record.jobId === job.id)
  let floor = Number.isFinite(job.revisionActivatedAtMs) ? job.revisionActivatedAtMs : job.createdAtMs
  for (const record of mine) {
    const end = isTerminalRecord(record) ? operationalEndedAt(record) : record.admittedAt
    if (Number.isFinite(end) && end > floor) floor = end
  }
  return floor
}

/**
 * Startup downtime accounting: for each enabled job, every elapsed slot
 * beyond the engine's at-most-one native catch-up is a durable
 * MISSED_BEFORE_OCCURRENCE fact. Never re-admits; never touches occurrences.
 */
export async function accountDowntimeSlots({ store, jobs, occurrences, nowMs, cursor, engineSessionId }) {
  let recorded = 0
  for (const job of jobs) {
    if (!job.enabled) continue
    // Fence/non-terminal jobs are admission-blocked: their elapsed slots get
    // SKIPPED accounting from the live tick, not downtime backfill.
    const fencedOrBusy = occurrences.some((record) => record.jobId === job.id && !isTerminalRecord(record))
    if (fencedOrBusy) continue
    const toMs = latestPastSlot({ schedule: job.schedule, jobId: job.id, nowMs })
    if (toMs === null) continue
    const floorMs = lastAccountedFloorMs(job, occurrences)
    const terminal = latestTerminalOccurrence(occurrences, job.id)
    const gapFloor = terminal ? operationalEndedAt(terminal) + MIN_REFIRE_GAP_MS : 0
    const lowerBound = Math.max(floorMs, gapFloor)
    // slots are newest-first: slots[0] is the native catch-up candidate — its
    // receipt will be the catch-up occurrence (or the tick's admission
    // accounting); everything OLDER is durably accounted as missed.
    const slots = enumerateElapsedSlots({
      schedule: job.schedule, jobId: job.id, fromMs: lowerBound, toMs,
    })
    const missed = slots.slice(1)
    if (missed.length === 0) continue
    const truncated = slots.length > MAX_BACKFILL_SLOTS
    for (const slot of missed) {
      if (!cursor.shouldRecord(job.id, slot)) continue
      const ok = await recordSlotAccounting(store, {
        ts: nowMs, jobId: job.id, agentId: job.agentId, slot,
        classification: 'MISSED_BEFORE_OCCURRENCE',
        reason: `slot elapsed without engine observation (downtime/restart; engineSession ${engineSessionId})`,
        recoveryClassification: 'OWNER_POLICY_REQUIRED',
        truncated: truncated && slot === missed[missed.length - 1],
      })
      if (ok) { cursor.mark(job.id, slot); recorded += 1 }
    }
  }
  return recorded
}
