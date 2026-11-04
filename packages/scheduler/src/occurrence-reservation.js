import {
  buildOccurrenceRecord,
  findOccurrenceByCoords,
  findOccurrenceById,
  logicalCoordinates,
  structuredCollisionError,
} from './occurrence-model.js'
import { hasNonTerminalOccurrence, naturalCandidate, retryCandidate } from './eligibility.js'

export const AGENT_TURN_SAFETY_TIMEOUT_MS = 3600 * 1000

/** C-026: reserve eligibility and the admitted record in one locked mutation. */
export async function reserveOccurrence(candidate, onRejection = () => {}) {
  let admittedAt
  const { doc, value } = await this.store.mutateDoc((latest) => {
    // The deadline clock starts only after the cross-process mutation lock is
    // held; pre-admission queue/lock wait is never execution time.
    admittedAt = this.nowMs()
    const attempted = buildOccurrenceRecord({
      job: candidate.job,
      kind: candidate.kind,
      nominalScheduledAt: candidate.nominalScheduledAt,
      retryOfOccurrenceId: candidate.retryOfOccurrenceId,
      catchUpOfNominalAt: candidate.catchUpOfNominalAt,
      admittedAt,
      timeoutMs: candidate.job.payload.timeoutSeconds
        ? Math.floor(candidate.job.payload.timeoutSeconds * 1000)
        : AGENT_TURN_SAFETY_TIMEOUT_MS,
    })
    const byCoords = findOccurrenceByCoords(latest.occurrences, logicalCoordinates(attempted))
    if (byCoords) {
      if (byCoords.occurrenceId !== attempted.occurrenceId) throw structuredCollisionError(byCoords, attempted)
      if (byCoords.payloadHash !== attempted.payloadHash) {
        throw Object.assign(
          new Error(`idempotency key ${attempted.idempotencyKey} is already bound to a different payloadHash`),
          { code: 'OCCURRENCE_PAYLOAD_CONFLICT', occurrenceId: attempted.occurrenceId },
        )
      }
      return { value: { record: byCoords, deduped: true } }
    }
    const byId = findOccurrenceById(latest.occurrences, attempted.occurrenceId)
    if (byId) throw structuredCollisionError(byId, attempted)

    const job = latest.jobs.find((entry) => entry.id === candidate.job.id)
    const refuse = (reason) => { onRejection(reason); return { value: null } }
    if (!job || !job.enabled) return refuse('job_missing_or_disabled')
    if (job.scheduleRevision !== candidate.job.scheduleRevision) return refuse('schedule_revision_changed')
    if (latest.fences[job.id] !== undefined) return refuse('fenced_outcome_unknown_in_flight')
    if (hasNonTerminalOccurrence(latest.occurrences, job.id)) return refuse('non_terminal_occurrence_in_flight')

    if (candidate.kind === 'retry') {
      const retry = retryCandidate({ job, occurrences: latest.occurrences, nowMs: admittedAt })
      if (retry?.staleRevision) return refuse('retry_stale_schedule_revision')
      if (!retry || retry.exhausted || !retry.due
        || retry.retryOfOccurrenceId !== candidate.retryOfOccurrenceId) return refuse('retry_not_eligible')
    } else {
      const natural = naturalCandidate({
        job, occurrences: latest.occurrences, nowMs: admittedAt,
        atCatchupGraceMs: this.atCatchupGraceMs,
      })
      const expectedNominal = candidate.kind === 'catchup'
        ? candidate.catchUpOfNominalAt
        : candidate.nominalScheduledAt
      if (!natural.due || natural.nominal !== expectedNominal) {
        return refuse(`natural_not_due: ${natural.reason ?? 'conditions changed under the lock'}`)
      }
    }

    const record = buildOccurrenceRecord({
      job,
      kind: candidate.kind,
      nominalScheduledAt: candidate.nominalScheduledAt,
      retryOfOccurrenceId: candidate.retryOfOccurrenceId,
      catchUpOfNominalAt: candidate.catchUpOfNominalAt,
      admittedAt,
      timeoutMs: job.payload.timeoutSeconds
        ? Math.floor(job.payload.timeoutSeconds * 1000)
        : AGENT_TURN_SAFETY_TIMEOUT_MS,
    })
    // C-026 verifies agentId runnable inside the lock; an unrunnable agent is
    // a per-job refusal (receipted as ADMISSION_REJECTED), never a tick-aborting
    // throw — ONE_BAD_JOB != GLOBAL_TICK_FAILURE (C-SH-002).
    try {
      this.invoker.assertRunnable(job.agentId)
    } catch (error) {
      return refuse(`agent_not_runnable: ${String(error?.message ?? error).slice(0, 200)}`)
    }
    latest.occurrences.push(record)
    return { value: { record, deduped: false } }
  })
  if (!value) return null
  this.doc = doc
  if (!value.deduped) {
    await this._evidence({
      ts: admittedAt,
      action: 'occurrence_reserved',
      occurrenceId: value.record.occurrenceId,
      runId: value.record.runId,
      jobId: value.record.jobId,
      kind: value.record.kind,
      nominal: value.record.nominalScheduledAt
        ?? value.record.retryOfOccurrenceId
        ?? value.record.catchUpOfNominalAt,
      scheduleRevision: value.record.scheduleRevision,
      payloadHash: value.record.payloadHash,
      executionDeadlineAtMs: value.record.executionDeadlineAtMs,
    })
  }
  const job = doc.jobs.find((entry) => entry.id === value.record.jobId)
  if (!value.deduped) {
    await this._historyWrite('occurrenceReserved', {
      record: structuredClone(value.record),
      job: job === undefined ? undefined : structuredClone(job),
    })
  }
  return { job, record: structuredClone(value.record), deduped: value.deduped }
}
