/**
 * C-SH-002 admission-failure isolation (SCHEDULER_SELF_HEALING_FROM_FEISHU_V1
 * §2) — cohesive submodule extracted from scheduler.js to keep the engine file
 * within the code-structure ceiling; behavior is unchanged from the
 * dual-reviewed candidate bytes.
 *
 * ONE_BAD_JOB != GLOBAL_TICK_FAILURE: `job_local` = the failure is attributable
 * to THIS candidate's own coordinates or agent (structured collision, payload
 * conflict, or the cross-revision retry-predecessor rejection naming exactly
 * this candidate's derived identity); everything else — unclassifiable, store
 * I/O, lock/authority integrity — is `global` and keeps the fail-closed tick
 * propagation with a durable blockade receipt.
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
 * Per-engine-session admission-failure handler. Receipts the affected
 * candidate as ADMISSION_INTERRUPTED, then classifies: `job_local` failures
 * are isolated (the caller continues with the remaining candidates);
 * GLOBAL_FATAL failures additionally leave the deduped `global_tick_blocked`
 * blockade receipt and are reported to the caller for fail-closed propagation.
 */
export function createAdmissionIsolation({ store, engineSessionId, nowMs, recordSlot }) {
  const blockade = { recorded: false }
  const staleRetryNoted = new Set()
  return {
    staleRetryNoted,
    recordStaleSupersession: (job, retry, now) => recordStaleSupersession(store, staleRetryNoted, job, retry, now),
    async handleFailure(error, candidate, slot, pendingCandidates) {
      await recordSlot(candidate.job, slot, 'ADMISSION_INTERRUPTED', String(error?.message ?? error).slice(0, 300))
      if (classifyAdmissionFailure(error, candidate) !== 'job_local') {
        if (!blockade.recorded) {
          blockade.recorded = true
          try {
            await store.appendRunEvent({
              ts: nowMs(),
              action: 'global_tick_blocked',
              reason: String(error?.message ?? error).slice(0, 300),
              engineSessionId,
            })
          } catch { /* evidence is best-effort; the fail-closed decision stands */ }
        }
        for (const pending of pendingCandidates) {
          await recordSlot(
            pending.job, pending.nominalScheduledAt ?? pending.catchUpOfNominalAt,
            'SKIPPED_POLICY', 'tick aborted by an admission failure (fail-closed propagation)',
          )
        }
        return 'global_fatal'
      }
      return 'job_local'
    },
  }
}
