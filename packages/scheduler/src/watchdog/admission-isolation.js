/**
 * C-SH-002 admission-failure isolation (SCHEDULER_SELF_HEALING_FROM_FEISHU_V1
 * §2) — cohesive submodule extracted from scheduler.js to keep the engine file
 * within the code-structure ceiling.
 *
 * ONE_BAD_JOB != GLOBAL_TICK_FAILURE: `job_local` = the failure is attributable
 * to THIS candidate's own coordinates or agent (structured collision, payload
 * conflict, or the cross-revision retry-predecessor rejection naming exactly
 * this candidate's derived identity); everything else — unclassifiable, store
 * I/O, lock/authority integrity — is `global` and keeps the fail-closed tick
 * propagation with a durable blockade receipt.
 *
 * Every isolated admission failure is durably explainable: natural/catchup
 * candidates receipt through the slot-accounting channel (their nominal slot),
 * retry candidates — which have NO slot coordinate — receipt through the
 * dedicated `retry_admission_failure` evidence event carrying their canonical
 * identity (derived occurrence id + retryOfOccurrenceId + retryEligibleAtMs)
 * and the same classification vocabulary. Retry receipts are deduped per
 * engine session and marked only on a successful append.
 */

import { deriveOccurrenceId } from '../occurrence-model.js'

export function classifyAdmissionFailure(error, candidate) {
  if (error?.code === 'OCCURRENCE_STRUCTURED_COLLISION' || error?.code === 'OCCURRENCE_PAYLOAD_CONFLICT') {
    const attemptedJobId = error?.attempted?.jobId ?? error?.existing?.jobId
    if (attemptedJobId === undefined || attemptedJobId === candidate.job.id) return 'job_local'
    return 'global'
  }
  const causeMessage = error?.cause?.message ?? error?.message ?? ''
  const match = /invalid retry predecessor for (occ:[0-9a-f]+)/.exec(causeMessage)
  if (match && candidate.kind === 'retry') {
    const derived = deriveOccurrenceId({
      jobId: candidate.job.id,
      scheduleRevision: candidate.job.scheduleRevision,
      kind: 'retry',
      retryOfOccurrenceId: candidate.retryOfOccurrenceId,
    })
    if (match[1] === derived || match[1] === candidate.retryOfOccurrenceId) return 'job_local'
  }
  return 'global'
}

/**
 * Durable policy receipt for the C-SH-001 stale cross-revision retry: the
 * pending retry belongs to a superseded schedule revision (minting it would
 * failLoud the store); the natural schedule below still owns this job's slots.
 * Deduped per engine session per (jobId, predecessor->current revision) and
 * marked only on a successful append so a transient run-log IO failure is
 * retried on the next tick (same as slot accounting).
 */
export async function recordStaleSupersession(store, notedSet, job, retry, now) {
  const notedKey = `${job.id}:${retry.predecessorScheduleRevision}->${job.scheduleRevision}`
  if (notedSet.has(notedKey)) return
  const receipt = await store.appendRunEvent({
    ts: now, action: 'retry_superseded_by_revision', jobId: job.id,
    retryOfOccurrenceId: retry.retryOfOccurrenceId,
    predecessorScheduleRevision: retry.predecessorScheduleRevision,
    jobScheduleRevision: job.scheduleRevision,
  })
  if (receipt?.ok) notedSet.add(notedKey)
}

/**
 * C-SH-002 durable receipt for a RETRY candidate's admission failure (the
 * candidate has no nominal slot, so the slot-accounting channel cannot carry
 * it): a retry-specific evidence event with the canonical retry identity and
 * the same classification vocabulary (ADMISSION_INTERRUPTED / ADMISSION_REJECTED /
 * SKIPPED_POLICY). Deduped per engine session per (job, retry predecessor,
 * classification); marked only on a successful append.
 */
export async function recordRetryAdmissionFailure(store, notedSet, candidate, classification, reason, now) {
  const notedKey = `${candidate.job.id}:${candidate.retryOfOccurrenceId}:${classification}`
  if (notedSet.has(notedKey)) return
  const derivedId = deriveOccurrenceId({
    jobId: candidate.job.id,
    scheduleRevision: candidate.job.scheduleRevision,
    kind: 'retry',
    retryOfOccurrenceId: candidate.retryOfOccurrenceId,
  })
  const receipt = await store.appendRunEvent({
    ts: now,
    action: 'retry_admission_failure',
    jobId: candidate.job.id,
    ...(candidate.job.agentId ? { agentId: candidate.job.agentId } : {}),
    occurrenceId: derivedId,
    retryOfOccurrenceId: candidate.retryOfOccurrenceId,
    ...(Number.isFinite(candidate.retryEligibleAtMs) ? { retryEligibleAtMs: candidate.retryEligibleAtMs } : {}),
    classification,
    reason: String(reason ?? '').slice(0, 300),
  })
  if (receipt?.ok === true) notedSet.add(notedKey)
}

/**
 * Per-engine-session admission-failure handler. Receipts the affected
 * candidate (slot accounting for natural/catchup, the retry-specific event for
 * retries), then classifies: `job_local` failures are isolated (the caller
 * continues with the remaining candidates); GLOBAL_FATAL failures additionally
 * leave the deduped `global_tick_blocked` blockade receipt — marked only on a
 * successful append so a transient run-log IO failure retries on the next tick
 * — and are reported to the caller for fail-closed propagation. Pending
 * candidates skipped by an aborting tick are receipted through the same
 * channels (fail-closed dispositions are explainable for retries too).
 */
export function createAdmissionIsolation({ store, engineSessionId, nowMs, recordSlot }) {
  const blockade = { recorded: false }
  const staleRetryNoted = new Set()
  const retryFailures = new Set()
  const now = () => nowMs()

  async function receiptCandidate(candidate, slot, classification, reason) {
    if (candidate.kind === 'retry') {
      await recordRetryAdmissionFailure(store, retryFailures, candidate, classification, reason, now())
      return
    }
    await recordSlot(candidate.job, slot, classification, reason)
  }

  return {
    staleRetryNoted,
    recordStaleSupersession: (job, retry, at) => recordStaleSupersession(store, staleRetryNoted, job, retry, at),
    recordRefusal: (candidate, slot, reason) => receiptCandidate(candidate, slot, 'ADMISSION_REJECTED', reason),
    async handleFailure(error, candidate, slot, pendingCandidates) {
      const reason = String(error?.message ?? error).slice(0, 300)
      await receiptCandidate(candidate, slot, 'ADMISSION_INTERRUPTED', reason)
      if (classifyAdmissionFailure(error, candidate) !== 'job_local') {
        if (!blockade.recorded) {
          try {
            const receipt = await store.appendRunEvent({
              ts: now(),
              action: 'global_tick_blocked',
              reason,
              engineSessionId,
            })
            if (receipt?.ok === true) blockade.recorded = true
          } catch { /* evidence is best-effort; the fail-closed decision stands */ }
        }
        for (const pending of pendingCandidates) {
          await receiptCandidate(
            pending, pending.nominalScheduledAt ?? pending.catchUpOfNominalAt,
            'SKIPPED_POLICY', 'tick aborted by an admission failure (fail-closed propagation)',
          )
        }
        return 'global_fatal'
      }
      return 'job_local'
    },
  }
}
