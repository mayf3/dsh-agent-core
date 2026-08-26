/**
 * @agent-core/scheduler — V2 due eligibility & next-occurrence computation
 * (D-007 §7 / SCHEDULER_TIMEOUT_OUTCOME_V2 C-026 pre-scan helper).
 *
 * Every decision here derives from the Job DEFINITION plus the OCCURRENCE
 * LEDGER — never from legacy Job.state fields (C-030). The result of this
 * pre-scan is only a CANDIDATE: the authoritative eligibility check
 * (enabled + fence + in-flight hold + uniqueness) re-runs inside the
 * mutation lock at reserve time (C-026).
 *
 * Slot semantics:
 *   - cron : staggered nominal slots; the candidate is the MOST RECENT slot
 *     at-or-before now. Older missed slots are never back-filled (no
 *     backlog) and the first occurrence of a (re)activated schedule starts
 *     from the first slot after the activation boundary.
 *   - every: anchor-aligned grid slots; additionally a terminal run holds
 *     admission until `endedAt + everyMs` (D-005 compat rule, D-007 §7.4).
 *   - at   : the single slot; a missed past slot is only admitted within a
 *     bounded grace window (native catch-up policy; stale one-shots stay
 *     unexecuted — mirroring the migration DO_NOT_IMPORT ruling).
 *
 * A terminal run additionally requires the next slot to be at least
 * MIN_REFIRE_GAP_MS after the run end (D-007 §7.2).
 */

import { computeNextRunAtMs, computePreviousRunAtMs, parseAbsoluteTimeMs, MIN_REFIRE_GAP_MS } from './schedule.js'

/** One-shot retry backoff (default policy, D-007 §7.5 — explicit opt-in only). */
export const ONE_SHOT_RETRY_BACKOFF_MS = [30 * 1000, 60 * 1000, 300 * 1000]
/** Recurring retry backoff (default policy, D-007 §7.5 — explicit opt-in only). */
export const RECURRING_RETRY_BACKOFF_MS = [30 * 1000, 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000]
/** Native at-one-shot catch-up grace: a missed `at` slot older than this is stale. */
export const DEFAULT_AT_CATCHUP_GRACE_MS = 15 * 60 * 1000

/** All occurrences of one job (any revision). */
export function jobOccurrences(occurrences, jobId) {
  return occurrences.filter((r) => r.jobId === jobId)
}

export function isTerminalRecord(record) {
  return record.state === 'succeeded' || record.state === 'failed'
}

/** Latest terminal occurrence (by endedAt, falling back to admittedAt). */
export function latestTerminalOccurrence(occurrences, jobId) {
  const terminal = jobOccurrences(occurrences, jobId).filter(isTerminalRecord)
  if (terminal.length === 0) return null
  return terminal.reduce((a, b) => ((b.endedAt ?? b.admittedAt) >= (a.endedAt ?? a.admittedAt) ? b : a))
}

/** True while the job has an admitted/running occurrence (in-flight hold). */
export function hasNonTerminalOccurrence(occurrences, jobId) {
  return jobOccurrences(occurrences, jobId).some((r) => !isTerminalRecord(r))
}

/**
 * Retry chain length behind a failed record: how many retry-kind hops lead
 * to it (A fails -> chain 0; retry(A) fails -> chain 1; ...).
 */
export function retryChainLength(occurrences, failedRecord) {
  let chain = 0
  let cursor = failedRecord
  while (cursor && cursor.retryOfOccurrenceId) {
    const predecessor = occurrences.find((r) => r.occurrenceId === cursor.retryOfOccurrenceId)
    if (!predecessor) break
    chain += 1
    cursor = predecessor
  }
  return chain
}

export function backoffForRetry(scheduleKind, chainLength) {
  const table = scheduleKind === 'at' ? ONE_SHOT_RETRY_BACKOFF_MS : RECURRING_RETRY_BACKOFF_MS
  const idx = Math.min(Math.max(0, chainLength), table.length - 1)
  return table[idx]
}

/** Most recent nominal slot at-or-before nowMs (staggered cron / every grid / at). */
export function previousNaturalSlotMs(schedule, jobId, nowMs) {
  if (schedule.kind === 'at') {
    const atMs = parseAbsoluteTimeMs(schedule.at)
    return atMs !== null && atMs <= nowMs ? atMs : null
  }
  if (schedule.kind === 'cron') {
    try {
      const previous = computePreviousRunAtMs(schedule, nowMs, { jobId })
      return typeof previous === 'number' ? previous : null
    } catch {
      return null
    }
  }
  if (schedule.kind === 'every') {
    const everyMs = Math.max(1, Math.floor(schedule.everyMs))
    const anchorRaw = typeof schedule.anchorMs === 'number' ? schedule.anchorMs : Number(schedule.anchorMs)
    const anchor = Number.isFinite(anchorRaw) ? Math.max(0, Math.floor(anchorRaw)) : null
    if (anchor === null || nowMs < anchor) return null
    const k = Math.floor((nowMs - anchor) / everyMs)
    return anchor + k * everyMs
  }
  return null
}

/**
 * Activation/lower boundary for nominal slots: slots must be strictly after
 * the latest terminal run end (plus refire gap) AND after the schedule
 * activation boundary (creation / semantic revision bump) — never-ran
 * schedules start from their first FUTURE slot (D-007 §13.1).
 */
function naturalLowerBoundMs(job, occurrences) {
  const terminal = latestTerminalOccurrence(occurrences, job.id)
  const activationBoundary = Number.isFinite(job.revisionActivatedAtMs) ? job.revisionActivatedAtMs : job.createdAtMs
  if (!terminal) return { boundary: activationBoundary, terminal: null }
  return { boundary: Math.max((terminal.endedAt ?? terminal.admittedAt) + MIN_REFIRE_GAP_MS, activationBoundary), terminal }
}

/**
 * Natural-candidate pre-scan. Returns { due, nominal, reason } — nominal is
 * the most recent eligible unrecorded slot ≤ now. `unrecorded` must be
 * checked against the LATEST ledger again inside the reserve lock.
 */
export function naturalCandidate({ job, occurrences, nowMs, atCatchupGraceMs = DEFAULT_AT_CATCHUP_GRACE_MS }) {
  if (!job.enabled) return { due: false, reason: 'disabled' }
  const slot = previousNaturalSlotMs(job.schedule, job.id, nowMs)
  if (slot === null) return { due: false, reason: 'no-past-slot' }
  const { boundary, terminal } = naturalLowerBoundMs(job, occurrences)
  if (slot <= boundary) {
    return { due: false, reason: terminal ? 'slot-not-after-last-terminal-run' : 'slot-before-activation', nominal: slot }
  }
  if (job.schedule.kind === 'every' && terminal) {
    const everyMs = Math.max(1, Math.floor(job.schedule.everyMs))
    if (nowMs < (terminal.endedAt ?? terminal.admittedAt) + everyMs) {
      return { due: false, reason: 'every-terminal-hold (lastRun + everyMs)', nominal: slot }
    }
  }
  if (job.schedule.kind === 'at' && nowMs - slot > atCatchupGraceMs) {
    return { due: false, reason: `stale at slot (older than grace ${atCatchupGraceMs}ms) — native catch-up policy`, nominal: slot }
  }
  return { due: true, nominal: slot, reason: 'natural slot due' }
}

/**
 * Retry-candidate pre-scan (D-007 §7.5 / C-009). Only for the EXPLICIT
 * per-job policy (job.retry.auto === true); a retry is always a NEW
 * occurrence referencing its direct failed predecessor.
 */
export function retryCandidate({ job, occurrences, nowMs }) {
  if (!job.enabled || job.retry?.auto !== true) return null
  const terminal = latestTerminalOccurrence(occurrences, job.id)
  if (!terminal || terminal.state !== 'failed') return null
  const chain = retryChainLength(occurrences, terminal)
  if (job.schedule.kind === 'at' && chain >= ONE_SHOT_RETRY_BACKOFF_MS.length) {
    return { exhausted: true, chain, terminal }
  }
  const endedAt = terminal.endedAt ?? terminal.admittedAt
  const backoffMs = backoffForRetry(job.schedule.kind, chain)
  return {
    exhausted: false,
    chain,
    terminal,
    retryOfOccurrenceId: terminal.occurrenceId,
    eligibleAtMs: endedAt + backoffMs,
    due: nowMs >= endedAt + backoffMs,
  }
}

/**
 * nextRunAtMs projection (cache only — C-030): the earliest time the job may
 * mint its next occurrence, derived from definition + ledger + policy.
 */
export function computeNextRunAtMsV2({ job, occurrences, nowMs }) {
  if (!job.enabled) return undefined
  const terminal = latestTerminalOccurrence(occurrences, job.id)
  const activationBoundary = Number.isFinite(job.revisionActivatedAtMs) ? job.revisionActivatedAtMs : job.createdAtMs
  const ref = Math.max(nowMs, terminal ? (terminal.endedAt ?? terminal.admittedAt) : 0, activationBoundary)
  let naturalNext
  if (job.schedule.kind === 'every') {
    const anchorNext = computeNextRunAtMs(job.schedule, nowMs, { fallbackAnchorMs: job.createdAtMs })
    const fromRef = computeNextRunAtMs(job.schedule, ref, { fallbackAnchorMs: job.createdAtMs })
    naturalNext = Math.max(anchorNext ?? 0, fromRef ?? 0) || undefined
    // D-005 compat rule (§7.4): lastRunAt + everyMs may serve as next.
    if (terminal) {
      const everyMs = Math.max(1, Math.floor(job.schedule.everyMs))
      const compat = (terminal.endedAt ?? terminal.admittedAt) + everyMs
      if (compat > nowMs) naturalNext = naturalNext !== undefined ? Math.max(naturalNext, compat) : compat
    }
  } else {
    naturalNext = computeNextRunAtMs(job.schedule, ref, { jobId: job.id })
  }
  const retry = retryCandidate({ job, occurrences, nowMs })
  if (retry && !retry.exhausted) {
    if (job.schedule.kind === 'at') return retry.eligibleAtMs
    if (naturalNext === undefined) return retry.eligibleAtMs
    return Math.max(naturalNext, retry.eligibleAtMs)
  }
  return naturalNext
}

/**
 * Derive a job's LEGACY state summary (C-030: derived projection only,
 * rebuildable from the ledger; admission decisions never read it) plus the
 * fence flag. `nowMs` anchors the nextRunAtMs projection.
 */
export function deriveJobStateSummary(job, occurrences, nowMs) {
  const mine = jobOccurrences(occurrences, job.id)
  const settled = mine
    .filter((record) => isTerminalRecord(record) || record.state === 'outcome_unknown')
    .sort((a, b) => ((b.endedAt ?? b.admittedAt) - (a.endedAt ?? a.admittedAt)))
  const summary = {}
  if (settled.length > 0) {
    const last = settled[0]
    summary.lastRunAtMs = last.endedAt ?? last.admittedAt
    summary.lastRunStatus = last.state === 'outcome_unknown' ? 'outcome_unknown' : last.executionOutcome ?? last.state
    summary.lastStatus = summary.lastRunStatus
    if (last.startedAt !== undefined && last.endedAt !== undefined) summary.lastDurationMs = Math.max(0, last.endedAt - last.startedAt)
    if (last.state === 'failed' && last.terminalEvidence?.detailRef) summary.lastError = String(last.terminalEvidence.detailRef).slice(0, 300)
    if (last.state === 'outcome_unknown') summary.lastError = String(last.history.at(-1)?.reason ?? 'outcome unknown').slice(0, 300)
    if (last.deliveryStatus !== undefined) summary.lastDeliveryStatus = last.deliveryStatus
    if (last.deliveryStatus === 'delivered') summary.lastDelivered = true
    let consecutive = 0
    for (const record of settled) {
      if (record.state === 'failed') consecutive += 1
      else break
    }
    summary.consecutiveErrors = consecutive
  }
  const unresolvedUnknown = mine.some((r) => r.state === 'outcome_unknown' && r.lateSettlement === undefined)
  summary.nextRunAtMs = unresolvedUnknown || !job.enabled ? undefined : computeNextRunAtMsV2({ job, occurrences: mine, nowMs })
  return summary
}
