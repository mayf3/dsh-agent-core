/** CTR-S4: machine policy settlements through the existing single store writer. */
import { createHash } from 'node:crypto'
import { applyTransition, canonicalJSON, isUnresolvedUnknown, rebuildFences } from '../occurrence-model.js'
import { deriveJobStateSummary } from '../eligibility.js'
import { AUTO_RECONCILE_DEFAULT_ACTOR_ID, AUTO_RECONCILE_MAX_SETTLEMENTS, planAutoReconcilePass } from './auto-reconcile.js'

class NoWrite extends Error {
  constructor(value) { super('auto-reconcile: zero authoritative write'); this.value = value }
}

function digest(value) {
  return createHash('sha256').update(canonicalJSON(value), 'utf8').digest('hex').slice(0, 16)
}

function operationId(target) {
  return `op:${digest(['scheduler-policy-auto-reconcile', target.occurrenceId, target.runId, target.requestId])}`
}

function receipt(record) {
  return structuredClone({ occurrenceId: record.occurrenceId, runId: record.runId,
    jobId: record.jobId, ...record.lateSettlement })
}

function settle(record, target, nowMs) {
  const terminationOnly = target.policyReason === 'child_exit_without_outcome'
  const evidenceRef = `ev:${digest(target.evidence)}`
  const settlement = {
    resolvedTo: target.resolvedTo, resolvedAt: nowMs, basis: 'policy-auto-reconcile', evidenceRef,
    businessStateAtCommit: terminationOnly ? 'outcome_unknown' : target.resolvedTo,
    policyReason: target.policyReason,
    policyAuthority: 'D-009:CTR-S2-termination-only',
    actorKind: 'machine', actorId: AUTO_RECONCILE_DEFAULT_ACTOR_ID, actorProvenance: 'scheduler-policy',
    operationId: operationId(target), requestId: target.requestId, ownerAgentId: target.ownerAgentId,
    runtimeEpoch: target.evidence.runtimeEpoch, reconciliationHandle: target.evidence.reconciliationHandle,
    evidenceKind: target.evidence.outcomeEvidence || target.evidence.terminationEvidence,
    ...(terminationOnly ? { scheduleDisposition: 'recurring_future_natural_only' } : {}),
  }
  applyTransition(record, {
    to: target.resolvedTo, at: nowMs, endedAt: nowMs,
    reason: `scheduler policy: ${target.policyReason}; business=${settlement.businessStateAtCommit}`,
    ...(terminationOnly ? {} : { executionOutcome: target.resolvedTo }),
    lateSettlement: settlement,
    terminalEvidence: { kind: terminationOnly ? 'termination-only' : 'late-settlement', detailRef: evidenceRef },
  })
  return receipt(record)
}

/** The lookup is trusted runtime context, never a request-body evidence source.
 * Replanning is synchronous inside mutateDoc: latest identity, definition,
 * eligibility and Router readback must equal the original bounded target.
 */
export async function autoReconcileOccurrences(store, { settlements, evidenceLookup, nowMs = Date.now() } = {}) {
  if (!Array.isArray(settlements) || settlements.length === 0) return { results: [], fencesRemaining: null, committedAckLost: false }
  let value
  let committedAckLost = false
  try {
    ({ value } = await store.mutateDoc(latest => {
      const results = []
      let changed = false
      for (const [index, target] of settlements.entries()) {
        const record = latest.occurrences.find(candidate => candidate.occurrenceId === target?.occurrenceId)
        const base = { occurrenceId: target?.occurrenceId ?? null }
        const identityMatches = record && ['runId', 'requestId', 'jobId', 'ownerAgentId', 'scheduleRevision', 'payloadHash']
          .every(key => record[key] === target[key])
        if (identityMatches && record.lateSettlement?.basis === 'policy-auto-reconcile'
          && record.lateSettlement.operationId === operationId(target)) {
          results.push({ ...base, outcome: 'already_settled', receipt: receipt(record) })
          continue
        }
        let planned
        if (identityMatches && index < AUTO_RECONCILE_MAX_SETTLEMENTS && isUnresolvedUnknown(record)) {
          planned = planAutoReconcilePass({ jobs: latest.jobs, occurrences: [record] }, evidenceLookup).targets[0]
        }
        if (!planned || canonicalJSON(planned) !== canonicalJSON(target)) {
          results.push({ ...base, outcome: 'skipped', reason: 'identity_definition_or_evidence_drift' })
          continue
        }
        const canonicalReceipt = settle(record, planned, nowMs)
        changed = true
        results.push({ ...base, outcome: 'settled', resolvedTo: record.state, jobId: record.jobId, receipt: canonicalReceipt })
      }
      if (changed) {
        latest.fences = rebuildFences(latest.occurrences)
        for (const job of latest.jobs) job.state = deriveJobStateSummary(job, latest.occurrences, nowMs)
      }
      const result = { results, fencesRemaining: Object.keys(latest.fences).length }
      if (!changed) throw new NoWrite(result)
      return { value: result }
    }))
  } catch (error) {
    if (error instanceof NoWrite) value = error.value
    else if (error?.mutationOutcome === 'committed' && error.committedValue) {
      value = error.committedValue
      committedAckLost = true
    } else throw error
  }
  for (const result of value.results) {
    if (result.outcome === 'already_settled') {
      // The settlement proves authority committed, not that a separate audit
      // append succeeded. Recheck the retained log; missing/rotated is UNKNOWN.
      try {
        const events = await store.readRunEvents({ limit: null })
        const found = events.some(event => event.basis === 'policy-auto-reconcile'
          && canonicalJSON(event.receipt) === canonicalJSON(result.receipt))
        result.evidenceStatus = found ? { ok: true, alreadyApplied: true }
          : { ok: false, status: 'unknown', alreadyApplied: true, error: 'prior audit append is not present in retained evidence' }
      } catch (error) {
        result.evidenceStatus = { ok: false, status: 'unknown', alreadyApplied: true, error: String(error?.message ?? error) }
      }
      continue
    }
    if (result.outcome !== 'settled') continue
    try {
      const audit = await store.appendRunEvent({
        ts: result.receipt.resolvedAt, action: 'late_settlement', basis: 'policy-auto-reconcile',
        occurrenceId: result.occurrenceId, runId: result.receipt.runId, jobId: result.jobId,
        receipt: result.receipt, fenceRemaining: value.fencesRemaining,
      })
      result.evidenceStatus = audit?.ok === true ? audit : { ok: false, error: audit?.error ?? 'audit append did not acknowledge success' }
    } catch (error) {
      result.evidenceStatus = { ok: false, error: String(error?.message ?? error) }
    }
  }
  return { ...value, identity: { actorId: AUTO_RECONCILE_DEFAULT_ACTOR_ID, provenance: 'scheduler-policy' }, committedAckLost }
}
