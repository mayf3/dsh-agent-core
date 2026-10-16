/**
 * Trusted caller-scoped job-disposition diagnosis (self_ops.job_disposition).
 *
 * Split out of self-ops/index.js (C-SH-003, SCHEDULER_SELF_HEALING_FROM_FEISHU_V1):
 * SILENT_DUE_SLOT_LOSS closure — the owning Agent asks "why did this Job not
 * run?" and the answer is always the durable accounting (occurrence, slot
 * accounting event, or an honest NOT_PROVEN with the proven/missing stage
 * bounds), never a bare runs count. The C-SH-003 additions bring the
 * revision/retry axis, the global/local health split and the
 * recovery-eligibility verdict on top of the established slot fields — all
 * additive, all derived from the ledger plus the durable evidence channel,
 * never from live inference.
 */

import { isUnresolvedUnknown } from '../occurrence-model.js'
import {
  computeNextRunAtMsV2,
  isTerminalRecord,
  latestTerminalOccurrence,
  previousNaturalSlotMs,
} from '../eligibility.js'

const ROUTER_DISPOSITIONS = new Set([
  'terminated_without_outcome', 'pending', 'restart_lost', 'evicted', 'never_existed',
  'late_completed', 'late_failed', 'mismatch', 'conflict', 'unsupported',
])
const ROUTER_TERMINATION_EVIDENCE = new Set([
  'exact_terminal_then_idle', 'exact_queued_removal', 'child_real_exit', 'cancellation_ack',
])

export function opaqueDenied() {
  return { ok: false, error: { code: 'not_found_or_not_owned', detail: 'owned exact run not found' } }
}

export function requestIdFor(record) {
  return record.requestId ?? record.idempotencyKey
}

export function classifyRouter(result, record, callerAgentId) {
  if (!result || typeof result !== 'object') return { disposition: 'unsupported' }
  if (['restart_lost', 'evicted', 'never_existed'].includes(result.state)) return { disposition: result.state }
  if (result.state === 'pending') return { disposition: 'pending' }
  if (['mismatch', 'conflict'].includes(result.state)) return { disposition: result.state }
  if (result.state !== 'settled' || !result.snapshot) return { disposition: 'unsupported' }
  const snapshot = result.snapshot
  const expected = { occurrenceId: record.occurrenceId, runId: record.runId, requestId: requestIdFor(record) }
  if (snapshot.agentId !== callerAgentId) return { disposition: 'mismatch' }
  if (!snapshot.callerCorrelation
    || Object.keys(expected).some((key) => snapshot.callerCorrelation[key] !== expected[key])) {
    return { disposition: 'mismatch' }
  }
  const disposition = snapshot.lateOutcome ?? snapshot.outcome ?? 'unsupported'
  if (disposition === 'terminated_without_outcome'
    && (typeof result.handle !== 'string' || result.handle === ''
      || !ROUTER_TERMINATION_EVIDENCE.has(snapshot.terminationEvidence))) {
    return { disposition: 'unsupported' }
  }
  return {
    disposition: ROUTER_DISPOSITIONS.has(disposition) ? disposition : 'unsupported',
    snapshot,
    handle: result.handle,
  }
}

export function createJobDisposition({ store, resolveCallerCorrelation, clock }) {
  return async function jobDisposition(callerAgentId, { jobId, slot: requestedSlot }) {
    const doc = await store.loadDoc({ force: true })
    const job = doc.jobs.find((candidate) => candidate.id === jobId)
    if (!job || job.agentId !== callerAgentId) return opaqueDenied()
    const now = clock()
    // C-SH-003: full retained-window scan (limit: null) — a bounded-by-
    // rotation, filtered scan so >500 later unrelated events can never bury
    // retry_superseded_by_revision / global_tick_blocked evidence (no count-
    // based false negatives for classification or health).
    const events = await store.readRunEvents({ limit: null })
    const latestSlot = previousNaturalSlotMs(job.schedule, job.id, now)
    // An explicit slot queries a PREVIOUS elapsed slot (e.g. after nextRun
    // advanced past it); the default is the latest elapsed slot.
    const expectedSlot = Number.isFinite(requestedSlot) && (latestSlot === null || requestedSlot <= latestSlot)
      ? requestedSlot
      : latestSlot
    const mine = doc.occurrences.filter((record) => record.jobId === jobId)
    const slotOccurrence = expectedSlot === null ? null : mine.find((record) => {
      const kind = record.kind === 'retry' ? 'retry' : record.kind
      return (kind === 'natural' && record.nominalScheduledAt === expectedSlot)
        || (kind === 'catchup' && record.catchUpOfNominalAt === expectedSlot)
    })
    const fenceStatus = doc.fences[jobId] !== undefined
    const nextRun = job.enabled
      ? (Number.isFinite(job.state?.nextRunAtMs) ? job.state.nextRunAtMs : computeNextRunAtMsV2({ job, occurrences: mine, nowMs: now }))
      : undefined

    // C-SH-001 stale-retry verdict: live from the ledger, else the durable
    // retry_superseded_by_revision evidence for the historical window.
    const latestTerminal = latestTerminalOccurrence(doc.occurrences, jobId)
    const staleLive = latestTerminal?.state === 'failed'
      && latestTerminal.scheduleRevision !== job.scheduleRevision
      ? { occurrenceId: latestTerminal.occurrenceId, runId: latestTerminal.runId, scheduleRevision: latestTerminal.scheduleRevision, live: true }
      : null
    const staleEvent = events.filter((event) => event.action === 'retry_superseded_by_revision' && event.jobId === jobId).at(-1)
    const staleEvidence = staleEvent
      ? { occurrenceId: staleEvent.retryOfOccurrenceId, scheduleRevision: staleEvent.predecessorScheduleRevision, live: false }
      : null
    const staleSource = staleLive ?? staleEvidence
    const staleSafeAction = staleSource
      ? `none — the failed predecessor ${staleSource.occurrenceId} belongs to schedule revision `
        + `${staleSource.scheduleRevision}; its auto-retry expired with the revision change `
        + '(STALE_RETRY_AFTER_SCHEDULE_REVISION); no mutation is required and the current revision\'s natural schedule continues'
      : null

    let disposition
    if (expectedSlot === null) {
      disposition = {
        slotClassification: 'NO_PAST_SLOT_YET',
        admissionStatus: 'not_attempted',
        occurrenceId: 'NONE',
        invocationStatus: 'none',
        durableReason: 'the schedule has no elapsed slot yet',
        recommendedSafeAction: 'none — the first eligible slot is still in the future',
        lastProvenStage: 'SCHEDULE_CALCULATION',
        firstMissingStage: 'NONE',
      }
    } else if (slotOccurrence != null) {
      disposition = {
        slotClassification: 'OCCURRENCE_CREATED',
        admissionStatus: slotOccurrence.state,
        occurrenceId: slotOccurrence.occurrenceId,
        invocationStatus: slotOccurrence.state,
        durableReason: `accounted by occurrence ${slotOccurrence.occurrenceId} (${slotOccurrence.state})`,
        ...(isUnresolvedUnknown(slotOccurrence)
          ? { recommendedSafeAction: 'run is an unresolved unknown — use self_ops.status and reconcile_turn for the exact run' }
          : { recommendedSafeAction: staleSafeAction ?? 'none — the slot is accounted by its occurrence' }),
        lastProvenStage: isTerminalRecord(slotOccurrence) ? 'EXECUTION_OUTCOME_RECORDED' : 'ADMISSION_RESERVATION',
        firstMissingStage: isTerminalRecord(slotOccurrence) ? 'NONE' : 'EXECUTION_OUTCOME',
      }
    } else {
      const record = events.filter((event) => event.action === 'slot_accounting'
        && event.jobId === jobId && event.slot === expectedSlot).at(-1)
      if (record !== undefined) {
        // ADMISSION_INTERRUPTED receipts naming the cross-revision retry
        // predecessor ARE the historical poison window (C-SH-001): surface
        // the named family instead of the generic interruption.
        const poisonReceipt = record.classification === 'ADMISSION_INTERRUPTED'
          && /invalid retry predecessor/.test(record.reason ?? '')
        const familyClassification = poisonReceipt ? 'STALE_RETRY_AFTER_SCHEDULE_REVISION' : null
        disposition = {
          slotClassification: record.classification,
          admissionStatus: record.classification === 'ADMISSION_REJECTED' || record.classification === 'ADMISSION_INTERRUPTED'
            ? 'rejected'
            : 'not_attempted',
          occurrenceId: record.occurrenceId ?? 'NONE',
          invocationStatus: record.occurrenceId ? 'see occurrence' : 'not_invoked',
          durableReason: record.reason,
          ...(record.recoveryClassification ? { recoveryClassification: record.recoveryClassification } : {}),
          recommendedSafeAction: poisonReceipt
            ? (staleSafeAction ?? 'the stale cross-revision retry has expired; the next tick proceeds naturally')
            : record.classification === 'SKIPPED_POLICY'
              ? 'policy skip — no action; the next eligible slot proceeds normally'
              : record.classification === 'MISSED_BEFORE_OCCURRENCE'
                ? 'no replay without an explicit Owner catch-up policy (NO_FORCED_CATCHUP); verify engine liveness via the W1 watchdog'
                : 'resolve the recorded reason; the next tick re-evaluates the slot naturally',
          lastProvenStage: 'DUE_SLOT_DETECTION',
          firstMissingStage: record.classification === 'SKIPPED_POLICY' ? 'NONE' : 'ADMISSION',
        }
        if (familyClassification) {
          disposition = { ...disposition, classification: familyClassification }
        }
      } else {
        // Evidence gap (pre-accounting legacy or rotated evidence): honest
        // NOT_PROVEN with mechanical stage bounds — never a bare runs count.
        const engineAliveInWindow = events.some((event) => Number.isFinite(event.ts)
          && event.ts >= expectedSlot && event.ts <= now
          && ['occurrence_reserved', 'outcome', 'slot_accounting', 'engine_lease_lost', 'router_admission'].includes(event.action))
        disposition = {
          slotClassification: 'MISSED_BEFORE_OCCURRENCE',
          admissionStatus: 'unknown',
          occurrenceId: 'NONE',
          invocationStatus: 'unknown',
          durableReason: staleLive
            ? `no durable accounting record for this slot; the job's latest terminal run ${staleLive.occurrenceId} `
              + `failed under schedule revision ${staleLive.scheduleRevision} and its auto-retry candidate was `
              + 'rejected by the store revision invariant, aborting ticks in this window'
            : 'no durable accounting record for this slot in the retained evidence window',
          rootCause: staleLive ? 'STALE_RETRY_AFTER_SCHEDULE_REVISION' : 'NOT_PROVEN',
          lastProvenStage: staleLive ? 'PREDECESSOR_TERMINAL_OUTCOME' : 'SCHEDULE_CALCULATION',
          firstMissingStage: engineAliveInWindow ? 'DUE_SLOT_DETECTION' : 'TICK_OBSERVED',
          recommendedSafeAction: staleSafeAction
            ?? 'check the W1 watchdog alert history for this window; if a fence exists use the trusted reconcile path',
        }
      }
    }

    // C-SH-003 recovery eligibility (R1–R5): fenced unknowns route to the
    // trusted reconcile path; the stale family is self-healed (no mutation
    // exists to perform); anything else needs no action or a human.
    let recoveryEligibility = 'NONE_REQUIRED'
    let jobLocalHealth = 'healthy'
    if (fenceStatus) {
      jobLocalHealth = 'quarantined_unknown'
      const unknowns = mine.filter(isUnresolvedUnknown).sort((a, b) => a.admittedAt - b.admittedAt)
      const reconcilable = unknowns.some((record) => classifyRouter(
        resolveCallerCorrelation({
          occurrenceId: record.occurrenceId,
          runId: record.runId,
          requestId: requestIdFor(record),
        }),
        record,
        callerAgentId,
      ).disposition === 'terminated_without_outcome')
      recoveryEligibility = reconcilable ? 'SELF_RECONCILE_AVAILABLE' : 'HUMAN_REQUIRED'
    } else if (staleLive) {
      // Only a LIVE stale verdict (the stale predecessor is still the latest
      // terminal) describes the present; evidence-only stale is history and
      // keeps the classification without claiming an action.
      jobLocalHealth = 'stale_retry_isolated'
      recoveryEligibility = 'SELF_HEALED_NO_MUTATION_REQUIRED'
    }
    const blockadeWindowStart = now - 10 * 60_000
    const leaseLost = events.some((event) => event.action === 'engine_lease_lost'
      && Number.isFinite(event.ts) && event.ts >= blockadeWindowStart && event.ts <= now)
    const tickBlocked = events.some((event) => event.action === 'global_tick_blocked'
      && Number.isFinite(event.ts) && event.ts >= blockadeWindowStart && event.ts <= now)
    const globalSchedulerHealth = leaseLost ? 'unavailable' : tickBlocked ? 'degraded' : 'healthy'

    return {
      jobId,
      expectedSlot,
      ...(expectedSlot !== null ? { expectedSlotIso: new Date(expectedSlot).toISOString() } : {}),
      ...disposition,
      fenceStatus,
      nextRun: nextRun === undefined ? null : nextRun,
      // C-SH-003 additive diagnosis fields.
      scheduleRevision: job.scheduleRevision,
      retryState: {
        autoRetry: job.retry?.auto === true,
        retryPredecessor: staleSource?.occurrenceId ?? null,
        retryPredecessorRevision: staleSource?.scheduleRevision ?? null,
        currentScheduleRevision: job.scheduleRevision,
        staleRetryExpired: staleSource !== null,
      },
      ...(staleSource ? { classification: 'STALE_RETRY_AFTER_SCHEDULE_REVISION' } : {}),
      globalSchedulerHealth,
      jobLocalHealth,
      recoveryEligibility,
    }
  }
}
