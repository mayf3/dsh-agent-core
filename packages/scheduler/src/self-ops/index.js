/** Trusted caller-scoped Scheduler V3 status and termination-only reconcile. */

import { createHash } from 'node:crypto'

import { isUnresolvedUnknown, rebuildFences } from '../occurrence-model.js'
import { deriveJobStateSummary } from '../eligibility.js'

const ROUTER_DISPOSITIONS = new Set([
  'terminated_without_outcome', 'pending', 'restart_lost', 'evicted', 'never_existed',
  'late_completed', 'late_failed', 'mismatch', 'conflict', 'unsupported',
])
const ROUTER_TERMINATION_EVIDENCE = new Set([
  'exact_terminal_then_idle', 'exact_queued_removal', 'child_real_exit', 'cancellation_ack',
])

class NoWrite extends Error {
  constructor(result) {
    super('self-ops: no authoritative write')
    this.result = result
  }
}

function encode(parts) {
  return parts.map((part) => `${String(part).length}:${part}`).join('|')
}

function evidenceIdFor(handle, kind) {
  return `ev:${createHash('sha256').update(encode([handle, kind]), 'utf8').digest('hex').slice(0, 16)}`
}

export function deriveSelfReconcileOperationId(callerAgentId, occurrenceId, runId) {
  const digest = createHash('sha256')
    .update(encode(['self-terminate-reconcile', callerAgentId, occurrenceId, runId]), 'utf8')
    .digest('hex').slice(0, 16)
  return `op:${digest}`
}

function opaqueDenied() {
  return { ok: false, error: { code: 'not_found_or_not_owned', detail: 'owned exact run not found' } }
}

function failure(code, detail) {
  return { ok: false, error: { code, detail } }
}

function requestIdFor(record) {
  return record.requestId ?? record.idempotencyKey
}

function classifyRouter(result, record, callerAgentId) {
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

function receipt(record) {
  const settlement = record.terminationSettlement
  return {
    disposition: 'reconciled_terminated_without_outcome',
    operationId: settlement.operationId,
    callerAgentId: settlement.actorId,
    jobId: record.jobId,
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    businessState: settlement.businessStateAtCommit,
    terminationKind: settlement.kind,
    fenceBefore: settlement.fenceBefore,
    fenceAfter: settlement.fenceAfter,
    scheduleDisposition: settlement.scheduleDisposition,
    committedAt: settlement.committedAt,
    evidenceRef: settlement.evidenceId,
  }
}

function visibleOwned(doc, callerAgentId) {
  const owned = new Map(doc.jobs.filter((job) => job.agentId === callerAgentId).map((job) => [job.id, job]))
  const occurrences = doc.occurrences.filter((record) => record.recordSchemaVersion === 3
    && record.ownerAgentId === callerAgentId && owned.has(record.jobId))
  return { owned, occurrences }
}

export function createSelfOpsAccess({
  store,
  resolveCallerCorrelation,
  runtimeStatus = () => ({}),
  clock = () => Date.now(),
  onAuditFailure = () => {},
}) {
  if (!store || typeof resolveCallerCorrelation !== 'function') {
    throw new TypeError('self-ops: store and resolveCallerCorrelation are required')
  }

  async function appendSettlementAudit(value, callerAgentId, coordinates) {
    try {
      const audit = await store.appendRunEvent({
        ts: value.result.committedAt,
        action: 'self_reconcile_termination',
        operationId: value.result.operationId,
        callerAgentId,
        ...coordinates,
        disposition: value.result.disposition,
        evidenceRef: value.result.evidenceRef,
      })
      if (!audit?.ok) onAuditFailure({ operationId: value.result.operationId, ...coordinates })
    } catch {
      onAuditFailure({ operationId: value.result.operationId, ...coordinates })
    }
  }

  async function status(callerAgentId) {
    const doc = await store.loadDoc({ force: true })
    const { owned, occurrences } = visibleOwned(doc, callerAgentId)
    const unknowns = occurrences.filter(isUnresolvedUnknown)
    const rows = []
    for (const record of unknowns.slice().sort((a, b) => b.admittedAt - a.admittedAt)) {
      const classified = classifyRouter(resolveCallerCorrelation({
        occurrenceId: record.occurrenceId,
        runId: record.runId,
        requestId: requestIdFor(record),
      }), record, callerAgentId)
      rows.push({
        jobId: record.jobId,
        occurrenceId: record.occurrenceId,
        runId: record.runId,
        businessState: 'outcome_unknown',
        fenceActive: doc.fences[record.jobId] !== undefined,
        routerDisposition: classified.disposition,
        selfReconcileEligible: isUnresolvedUnknown(record)
          && classified.disposition === 'terminated_without_outcome',
        blockerCode: classified.disposition === 'terminated_without_outcome'
          ? 'safe_reconcile_available'
          : classified.disposition,
      })
    }
    const activeFenceCount = new Set(unknowns.filter(isUnresolvedUnknown).map((record) => record.jobId)).size
    const runtime = runtimeStatus()
    return {
      statusVersion: 1,
      callerAgentId,
      runtime: {
        generationId: String(runtime?.generationId ?? 'unavailable'),
        health: ['healthy', 'degraded', 'unavailable'].includes(runtime?.health)
          ? runtime.health : 'unavailable',
      },
      scheduler: {
        ownedJobCount: owned.size,
        activeFenceCount,
        unresolvedUnknownCount: unknowns.length,
        reconciliationCandidateCount: rows.filter((row) => row.selfReconcileEligible).length,
        blockers: rows.slice(0, 20),
        truncated: rows.length > 20,
      },
    }
  }

  async function reconcileTurn(callerAgentId, { jobId, occurrenceId, runId }) {
    const first = await store.loadDoc({ force: true })
    const job = first.jobs.find((candidate) => candidate.id === jobId)
    const record = first.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)
    if (!job || !record || record.jobId !== jobId || record.runId !== runId
      || job.agentId !== callerAgentId || record.recordSchemaVersion !== 3
      || record.ownerAgentId !== callerAgentId) return opaqueDenied()
    if (record.terminationSettlement !== undefined) {
      return record.terminationSettlement.actorKind === 'self-agent'
        && record.terminationSettlement.actorId === callerAgentId
        ? { ok: true, result: receipt(record) }
        : failure('not_reconcilable', 'run already has a trusted settlement')
    }
    if (!isUnresolvedUnknown(record)) return failure('not_reconcilable', 'run is not an unresolved unknown')

    const preflight = classifyRouter(resolveCallerCorrelation({ occurrenceId, runId, requestId: requestIdFor(record) }), record, callerAgentId)
    if (preflight.disposition !== 'terminated_without_outcome') return routerFailure(preflight.disposition)

    try {
      const { value } = await store.mutateDoc((latest) => {
        const lockedJob = latest.jobs.find((candidate) => candidate.id === jobId)
        const lockedRecord = latest.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)
        if (!lockedJob || !lockedRecord || lockedRecord.jobId !== jobId || lockedRecord.runId !== runId
          || lockedJob.agentId !== callerAgentId || lockedRecord.recordSchemaVersion !== 3
          || lockedRecord.ownerAgentId !== callerAgentId) throw new NoWrite(opaqueDenied())
        if (lockedRecord.terminationSettlement !== undefined) {
          throw new NoWrite(lockedRecord.terminationSettlement.actorKind === 'self-agent'
            && lockedRecord.terminationSettlement.actorId === callerAgentId
            ? { ok: true, result: receipt(lockedRecord) }
            : failure('not_reconcilable', 'run already has a trusted settlement'))
        }
        if (!isUnresolvedUnknown(lockedRecord)) {
          throw new NoWrite(failure('not_reconcilable', 'run is not an unresolved unknown'))
        }
        const classified = classifyRouter(resolveCallerCorrelation({
          occurrenceId, runId, requestId: requestIdFor(lockedRecord),
        }), lockedRecord, callerAgentId)
        if (classified.disposition !== 'terminated_without_outcome') {
          throw new NoWrite(routerFailure(classified.disposition))
        }
        const now = clock()
        const fenceBefore = latest.fences[jobId] !== undefined
        const oneShot = lockedJob.schedule?.kind === 'at'
        const operationId = deriveSelfReconcileOperationId(callerAgentId, occurrenceId, runId)
        const evidenceKind = classified.snapshot.terminationEvidence
        lockedRecord.terminationSettlement = {
          kind: 'terminated_without_outcome',
          businessStateAtCommit: 'outcome_unknown',
          requestId: requestIdFor(lockedRecord),
          evidenceKind,
          evidenceId: evidenceIdFor(classified.handle, evidenceKind),
          actorKind: 'self-agent',
          actorId: callerAgentId,
          actorProvenance: 'trusted-parent-context',
          operationId,
          fenceBefore,
          fenceAfter: false,
          scheduleDisposition: oneShot ? 'one_shot_disabled' : 'recurring_future_natural_only',
          settledAt: now,
          committedAt: now,
        }
        lockedRecord.terminalEvidence = { kind: 'termination-only', detailRef: lockedRecord.terminationSettlement.evidenceId }
        lockedRecord.history.push({ at: now, from: 'outcome_unknown', to: 'outcome_unknown', reason: 'trusted exact termination without business outcome' })
        if (oneShot) lockedJob.enabled = false
        latest.fences = rebuildFences(latest.occurrences)
        lockedRecord.terminationSettlement.fenceAfter = latest.fences[jobId] !== undefined
        if (oneShot) lockedJob.updatedAtMs = now
        lockedJob.state = deriveJobStateSummary(
          lockedJob,
          latest.occurrences.filter((candidate) => candidate.jobId === jobId),
          now,
        )
        return { value: { ok: true, result: receipt(lockedRecord) } }
      })
      await appendSettlementAudit(value, callerAgentId, { jobId, occurrenceId, runId })
      return value
    } catch (error) {
      if (error instanceof NoWrite) return error.result
      if (error?.mutationOutcome === 'committed' && error.committedValue?.ok === true) {
        await appendSettlementAudit(error.committedValue, callerAgentId, { jobId, occurrenceId, runId })
        return error.committedValue
      }
      if (error?.mutationOutcome === 'not_committed'
        && /lock timeout|held by a live or unverifiable owner/.test(error?.message ?? '')) {
        return failure('store_conflict', 'Scheduler authority is busy; no write was committed')
      }
      throw error
    }
  }

  return {
    status,
    reconcileTurn,
    handlers: {
      self_ops: {
        status: async (_args, context) => ({
          ok: true,
          result: await status(context.callerAgentId),
        }),
        reconcile_turn: (args, context) => reconcileTurn(context.callerAgentId, {
          jobId: args.job_id,
          occurrenceId: args.occurrence_id,
          runId: args.run_id,
        }),
      },
    },
  }
}

function routerFailure(disposition) {
  if (['late_completed', 'late_failed'].includes(disposition)) {
    return failure('business_outcome_available', 'trusted business outcome requires the authorized late-outcome path')
  }
  if (['mismatch', 'conflict'].includes(disposition)) {
    return failure('correlation_mismatch', 'exact Router correlation does not match')
  }
  return failure('termination_not_proven', `Router disposition: ${disposition}`)
}
