/** Trusted caller-scoped Scheduler V3 status and termination-only reconcile. */

import { createHash } from 'node:crypto'

import { isUnresolvedUnknown, rebuildFences } from '../occurrence-model.js'
import { computeNextRunAtMsV2, deriveJobStateSummary, previousNaturalSlotMs } from '../eligibility.js'
import { classifyReconciliationEvidence } from '../watchdog/reconciliation.js'
import { filterHealthForPrincipal } from '../watchdog/health.js'

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
  healthProvider,
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
      const epoch = requestIdFor(record)
      const identity = { jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId, epoch }
      const reconciliationObservedAt = clock()
      const exact = (value) => ({ trusted: true, fresh: true, source: 'router-current-readback', ...identity, observedAt: reconciliationObservedAt, ...value })
      const evidence = classified.disposition === 'late_completed' ? { identity, businessOutcome: exact({ status: 'succeeded' }) }
        : classified.disposition === 'late_failed' ? { identity, businessOutcome: exact({ status: 'failed' }) }
          : classified.disposition === 'terminated_without_outcome' ? { identity, termination: exact({ terminated: true }) }
            : classified.disposition === 'pending' ? { identity, live: exact({ live: true }) }
              : { identity }
      const reconciliation = classifyReconciliationEvidence(evidence, { nowMs: reconciliationObservedAt })
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
        reconciliationState: reconciliation.classification ?? 'TERMINATION_ONLY_SETTLEMENT_AVAILABLE',
        reconciliationObservedAt: evidence.businessOutcome?.observedAt ?? evidence.termination?.observedAt ?? evidence.live?.observedAt ?? null,
      })
    }
    const activeFenceCount = new Set(unknowns.filter(isUnresolvedUnknown).map((record) => record.jobId)).size
    const runtime = runtimeStatus()
    const canonicalHealth = typeof healthProvider === 'function'
      ? filterHealthForPrincipal(await healthProvider(), { agentId: callerAgentId, scopes: new Set(['scheduler.read']) })
      : undefined
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
      ...(canonicalHealth ? { health: canonicalHealth } : {}),
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
        // The annotation is the final history entry, so endedAt must move with
        // it ("endedAt must match the final history transition") — the real
        // engine writeback had set endedAt at unknown-classification time.
        lockedRecord.endedAt = now
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

  /**
   * SILENT_DUE_SLOT_LOSS closure: the owning Agent asks "why did this Job not
   * run?" — the answer is always the durable accounting (occurrence, slot
   * accounting event, or an honest NOT_PROVEN with the proven/missing stage
   * bounds), never a bare runs count.
   */
  async function jobDisposition(callerAgentId, { jobId, slot: requestedSlot }) {
    const doc = await store.loadDoc({ force: true })
    const job = doc.jobs.find((candidate) => candidate.id === jobId)
    if (!job || job.agentId !== callerAgentId) return opaqueDenied()
    const now = clock()
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

    let disposition
    if (expectedSlot === null) {
      disposition = {
        slotClassification: 'NO_PAST_SLOT_YET',
        admissionStatus: 'not_attempted',
        occurrenceId: 'NONE',
        invocationStatus: 'none',
        durableReason: 'the schedule has no elapsed slot yet',
        recommendedSafeAction: 'none — the first eligible slot is still in the future',
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
          : { recommendedSafeAction: 'none — the slot is accounted by its occurrence' }),
      }
    } else {
      const events = await store.readRunEvents({ limit: 500 })
      const record = events.filter((event) => event.action === 'slot_accounting'
        && event.jobId === jobId && event.slot === expectedSlot).at(-1)
      if (record !== undefined) {
        disposition = {
          slotClassification: record.classification,
          admissionStatus: record.classification === 'ADMISSION_REJECTED' || record.classification === 'ADMISSION_INTERRUPTED'
            ? 'rejected'
            : 'not_attempted',
          occurrenceId: record.occurrenceId ?? 'NONE',
          invocationStatus: record.occurrenceId ? 'see occurrence' : 'not_invoked',
          durableReason: record.reason,
          ...(record.recoveryClassification ? { recoveryClassification: record.recoveryClassification } : {}),
          recommendedSafeAction: record.classification === 'SKIPPED_POLICY'
            ? 'policy skip — no action; the next eligible slot proceeds normally'
            : record.classification === 'MISSED_BEFORE_OCCURRENCE'
              ? 'no replay without an explicit Owner catch-up policy (NO_FORCED_CATCHUP); verify engine liveness via the W1 watchdog'
              : 'resolve the recorded reason; the next tick re-evaluates the slot naturally',
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
          durableReason: 'no durable accounting record for this slot in the retained evidence window',
          rootCause: 'NOT_PROVEN',
          lastProvenStage: 'SCHEDULE_CALCULATION',
          firstMissingStage: engineAliveInWindow ? 'DUE_SLOT_DETECTION' : 'TICK_OBSERVED',
          recommendedSafeAction: 'check the W1 watchdog alert history for this window; if a fence exists use the trusted reconcile path',
        }
      }
    }
    return {
      jobId,
      expectedSlot,
      ...(expectedSlot !== null ? { expectedSlotIso: new Date(expectedSlot).toISOString() } : {}),
      ...disposition,
      fenceStatus,
      nextRun: nextRun === undefined ? null : nextRun,
    }
  }

  return {
    status,
    reconcileTurn,
    jobDisposition,
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
        job_disposition: async (args, context) => ({
          ok: true,
          result: await jobDisposition(context.callerAgentId, {
            jobId: args.job_id,
            slot: Number.isFinite(args.slot) ? args.slot : undefined,
          }),
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
