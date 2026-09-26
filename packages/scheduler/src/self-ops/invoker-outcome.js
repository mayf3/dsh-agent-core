/**
 * @agent-core/scheduler — invoker-outcome authority: the bridge outcome →
 * durable classification (C-004) and the trusted exact-termination settlement
 * (SCHEDULER_TERMINAL_PROOF_AND_UNKNOWN_CONTAINMENT_V1; Owner P1 ruling
 * 2026-09-16: BUSINESS_OUTCOME_PROOF != TERMINATION_PROOF).
 *
 * The bridge stamps `evidence:{terminationEvidence, source:
 * 'router_disposition_readback'}` ONLY when the router's published
 * resolveCallerCorrelation surface settled the exact run
 * `terminated_without_outcome` with a trusted terminationEvidence kind —
 * the same authority the self-ops reconcile path consumes. Such a proof can
 * release the fence through the C-039 terminationSettlement written here; it
 * can NEVER upgrade the business outcome to succeeded/failed.
 */

import { findOccurrenceById, rebuildFences } from '../occurrence-model.js'
import { deriveJobStateSummary } from '../eligibility.js'
import { deriveSelfReconcileOperationId, evidenceIdFor } from './index.js'

/** Invoker timeout outcome text (C-001 classification vocabulary). */
export const TIMEOUT_ERROR_TEXT = 'cron: job execution timed out'

/** C-015 trusted termination-evidence vocabulary (single scheduler source). */
export const TRUSTED_TERMINATION_EVIDENCE = new Set([
  'exact_terminal_then_idle',
  'exact_queued_removal',
  'child_real_exit',
  'cancellation_ack',
  'restart_quiescence_proven',
])

export const hasTerminationProof = (outcome) => TRUSTED_TERMINATION_EVIDENCE.has(
  outcome?.terminationEvidence ?? outcome?.evidence?.terminationEvidence,
)

/** The trusted EXACT termination proof carried by an invoker outcome, if any. */
export function trustedTerminationProof(outcome) {
  const evidence = outcome?.evidence
  if (evidence?.source !== 'router_disposition_readback') return null
  if (!TRUSTED_TERMINATION_EVIDENCE.has(evidence?.terminationEvidence)) return null
  return {
    evidenceKind: evidence.terminationEvidence,
    handle: typeof outcome.reconciliationHandle === 'string' && outcome.reconciliationHandle !== ''
      ? outcome.reconciliationHandle
      : null,
  }
}

/**
 * Classify one bridge outcome into the durable occurrence classification.
 * Bridge-carried Router closed-union envelopes are authoritative for the
 * exact run and outrank the premature dispatch-time start evidence:
 *   not_admitted -> deterministic pre-start rejection (UNKNOWN CONTAINMENT:
 *     an Agent/session fence rejection of one shift must never reproduce as
 *     a second outcome_unknown on a neighbouring Job);
 *   failed -> the Router's settled terminal failure — no error-code whitelist.
 * A readback-stamped outcome_unknown keeps its termination proof ONLY as
 * termination (never business) evidence — the state stays outcome_unknown.
 * Everything else keeps the fail-closed outcome_unknown default (C-001).
 */
export function classifyOccurrenceOutcome(record, outcome) {
  if (outcome.status === 'ok') {
    return {
      state: 'succeeded',
      executionOutcome: 'succeeded',
      reason: 'invoker returned terminal success',
      summary: outcome.summary,
    }
  }
  if (outcome.__timedOut || outcome.status === 'outcome_unknown') {
    return {
      state: 'outcome_unknown',
      reason: outcome.__timedOut
        ? `execution deadline exceeded without termination proof: ${outcome.error ?? TIMEOUT_ERROR_TEXT}`
        : `invoker reported outcome_unknown: ${outcome.error ?? ''}`,
    }
  }
  const started = record.__started === true || outcome.started === true
  if (outcome.routerEnvelope === 'not_admitted' || outcome.routerEnvelope === 'failed') {
    const reason = outcome.error ?? `router ${outcome.routerEnvelope} settlement`
    return {
      state: 'failed',
      executionOutcome: 'failed',
      reason,
      terminalEvidence: {
        kind: outcome.routerEnvelope === 'not_admitted' || outcome.started === false
          ? 'pre-start-rejection' : 'turn-terminal',
        detailRef: reason,
      },
    }
  }
  const provenFailure = (!started && outcome.started === false) || hasTerminationProof(outcome)
  if (!provenFailure) {
    return {
      state: 'outcome_unknown',
      reason: `invoker failure lacks exact-turn termination proof: ${outcome.error ?? 'invoke failed'}`,
    }
  }
  return {
    state: 'failed',
    executionOutcome: 'failed',
    reason: outcome.error ?? 'invoke failed',
    terminalEvidence: {
      kind: started ? 'turn-terminal' : 'pre-start-rejection',
      detailRef: outcome.error ?? 'invoke failed',
    },
  }
}

/**
 * Convenience entry for the two engine hooks (live post-writeback and the
 * late watcher): no-op (false) unless the outcome carries a trusted proof.
 */
export async function applyTrustedTermination(record, outcome) {
  const proof = trustedTerminationProof(outcome)
  if (!proof) return false
  await applyTerminationSettlement.call(this, record, proof)
  return true
}

/**
 * C-039 termination-only settlement driven by the engine's trusted router
 * disposition readback. The business state STAYS outcome_unknown; the
 * settlement releases the fence through the existing V3 authority — same
 * schema, operationId/evidenceId formulas and actor identity derivation as
 * the self-ops reconcile path (actor = the occurrence's ownerAgentId, never
 * caller-supplied), so a later self-ops reconcile_turn replays the same
 * receipt zero-write (C-045) and NO automatic retry exists (retryCandidate
 * requires a failed terminal).
 *
 * Settle-once: first valid settlement wins. The locked mutation reports
 * whether THIS call committed; the `termination_settlement` evidence line is
 * appended only for a real commit — race losers, already-settled records,
 * missing fence and ownership mismatches stay silent (no fabricated
 * evidence; authoritative store unchanged).
 */
export async function applyTerminationSettlement(record, proof) {
  const now = this.nowMs()
  let committed = false
  try {
    const { doc, value } = await this.store.mutateDoc((latest) => {
      const current = findOccurrenceById(latest.occurrences, record.occurrenceId)
      if (!current || current.runId !== record.runId
        || current.state !== 'outcome_unknown'
        || current.terminationSettlement !== undefined
        || current.lateSettlement !== undefined) return {}
      const job = latest.jobs.find((entry) => entry.id === current.jobId)
      if (!job || job.agentId !== current.ownerAgentId) return {}
      const fenceBefore = latest.fences[current.jobId] !== undefined
      if (!fenceBefore) return {}
      const oneShot = job.schedule?.kind === 'at'
      current.terminationSettlement = {
        kind: 'terminated_without_outcome',
        businessStateAtCommit: 'outcome_unknown',
        requestId: current.requestId ?? current.idempotencyKey,
        evidenceKind: proof.evidenceKind,
        evidenceId: evidenceIdFor(proof.handle ?? current.occurrenceId, proof.evidenceKind),
        actorKind: 'self-agent',
        actorId: current.ownerAgentId,
        actorProvenance: 'engine-trusted-readback',
        operationId: deriveSelfReconcileOperationId(current.ownerAgentId, current.occurrenceId, current.runId),
        fenceBefore,
        fenceAfter: false,
        scheduleDisposition: oneShot ? 'one_shot_disabled' : 'recurring_future_natural_only',
        settledAt: now,
        committedAt: now,
      }
      current.terminalEvidence = { kind: 'termination-only', detailRef: current.terminationSettlement.evidenceId }
      // The annotation is the final history entry, so endedAt must move with
      // it (validateOccurrenceRecord: endedAt must match the final transition).
      current.history.push({ at: now, from: 'outcome_unknown', to: 'outcome_unknown', reason: 'trusted exact termination without business outcome' })
      current.endedAt = now
      if (oneShot) {
        job.enabled = false
        job.updatedAtMs = now
      }
      latest.fences = rebuildFences(latest.occurrences)
      current.terminationSettlement.fenceAfter = latest.fences[current.jobId] !== undefined
      job.state = deriveJobStateSummary(job, latest.occurrences.filter((entry) => entry.jobId === job.id), now)
      return { value: { committed: true } }
    })
    this.doc = doc
    committed = value?.committed === true
    if (committed) {
      await this._evidence({
        ts: now,
        action: 'termination_settlement',
        occurrenceId: record.occurrenceId,
        runId: record.runId,
        basis: 'engine-trusted-readback',
        evidenceKind: proof.evidenceKind,
        kind: 'terminated_without_outcome',
      })
    }
  } catch (error) {
    this.log.error(`termination settlement failed for ${record.occurrenceId}: ${error?.message ?? error}`)
  }
  return committed
}
