/**
 * @agent-core/scheduler — V2 domain control operations (D-007 §12.1 / §12.3,
 * SCHEDULER_TIMEOUT_OUTCOME_V2 C-029/C-032).
 *
 * Control-only: these functions NEVER execute a job. They run on the store's
 * single mutation authority (same lock / re-read-latest / atomic commit as
 * the engine), so the CLI, the resident engine and recovery share one write
 * path with no blind whole-store snapshots.
 *
 * Every op derives projections (state summaries, nextRunAtMs) from the
 * occurrence ledger — never from legacy execution fields (C-030).
 */

import { userInfo } from 'node:os'
import { cloneJob, normalizeJob, toPublicJob } from './job-model.js'
import { parseAtToMs } from './schedule.js'
import { deriveJobStateSummary } from './eligibility.js'
import { applyTransition, findOccurrenceById, isUnresolvedUnknown, rebuildFences } from './occurrence-model.js'

function findJob(jobs, id) {
  const job = jobs.find((j) => j.id === id)
  if (!job) throw new Error(`unknown job id: ${id}`)
  return job
}

/** Refresh one job's derived projection inside a mutation (ledger-derived). */
function refreshProjection(doc, jobId, nowMs) {
  for (const job of doc.jobs) {
    if (jobId !== undefined && job.id !== jobId) continue
    job.state = deriveJobStateSummary(job, doc.occurrences, nowMs)
  }
}

/**
 * Compare-before-write guard (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.1.4):
 * when `expectedRevision` is provided, the op refuses unless the LATEST job
 * still carries exactly this {scheduleRevision, updatedAtMs} — a stale reader
 * can never silently overwrite newer state. Throws STALE_TARGET_CONFLICT
 * BEFORE any write (mutateDoc leaves disk untouched).
 */
export function assertExpectedRevision(current, expectedRevision) {
  if (expectedRevision === undefined) return
  const matches = expectedRevision !== null && typeof expectedRevision === 'object'
    && current.scheduleRevision === expectedRevision.scheduleRevision
    && current.updatedAtMs === expectedRevision.updatedAtMs
  if (!matches) {
    throw Object.assign(
      new Error(
        `stale target state for job ${current.id}: expected `
        + `{scheduleRevision:${expectedRevision?.scheduleRevision}, updatedAtMs:${expectedRevision?.updatedAtMs}}, found `
        + `{scheduleRevision:${current.scheduleRevision}, updatedAtMs:${current.updatedAtMs}}`,
      ),
      { code: 'STALE_TARGET_CONFLICT' },
    )
  }
}

/** Normalized semantic projection fields compared for the logical-key contract (§5.1.2).
 *  Display fields (name/description) and the derived `state` are deliberately
 *  OUTSIDE the projection: name is never an idempotency basis, and a retry that
 *  only renames must NOT write over the committed definition. */
const DESIRED_PROJECTION_KEYS = ['agentId', 'schedule', 'payload', 'delivery', 'retry', 'deleteAfterRun']

function differingProjectionFields(existing, desired) {
  return DESIRED_PROJECTION_KEYS.filter(
    (key) => JSON.stringify(existing[key] ?? null) !== JSON.stringify(desired[key] ?? null),
  )
}

function logicalKeyConflictError(existing, differingFields) {
  return Object.assign(
    new Error(`logical key already bound to job ${existing.id} with a different desired definition`),
    { code: 'LOGICAL_KEY_CONFLICT', existingJobId: existing.id, differingFields },
  )
}

/**
 * Create with the logical-key idempotency contract (§5.1):
 *
 *   new logicalKey                      -> outcome 'created'
 *   existing key + equal projection     -> outcome 'already_applied' (zero semantic write)
 *   existing key + differing projection -> throws LOGICAL_KEY_CONFLICT (fail closed)
 *   keyless input                       -> legacy behavior (fresh uuid, duplicate-id guard)
 *
 * The uniqueness check runs INSIDE mutateDoc (lock + re-read-latest), so a
 * blind retry after a lost response can never produce a duplicate: it
 * converges to already_applied. `enabled` is outside the projection on
 * purpose (create normalizes enabled; a re-run must not re-enable).
 */
export async function createOrReconcileJobOp(store, input, { nowMs = Date.now() } = {}) {
  const job = normalizeJob(input, { nowMs })
  const { value } = await store.mutateDoc((latest) => {
    const existing = job.logicalKey !== undefined
      ? latest.jobs.find((candidate) => candidate.logicalKey === job.logicalKey)
      : undefined
    if (existing !== undefined) {
      const differingFields = differingProjectionFields(existing, job)
      if (differingFields.length === 0) {
        // Zero semantic write: the committed definition stays byte-identical
        // (mutateDoc persists the unchanged array — idempotent, no job mutation).
        return { value: { job: cloneJob(existing), alreadyApplied: true } }
      }
      throw logicalKeyConflictError(existing, differingFields)
    }
    if (latest.jobs.some((candidate) => candidate.id === job.id)) throw new Error(`job id already exists: ${job.id}`)
    const stored = cloneJob(job)
    stored.state = deriveJobStateSummary(stored, latest.occurrences, nowMs)
    latest.jobs.push(stored)
    return { value: { job: stored, alreadyApplied: false } }
  })
  return {
    outcome: value.alreadyApplied ? 'already_applied' : 'created',
    job: toPublicJob(value.job),
  }
}

/** Create a job (validated); projection computed from an empty ledger. */
export async function createJobOp(store, input, opts = {}) {
  const { job } = await createOrReconcileJobOp(store, input, opts)
  return job
}

/** Canonical read-back by logical identity (§5.1.5): exact match, no fuzzy/name inference. */
export async function findJobByLogicalKey(store, logicalKey) {
  if (typeof logicalKey !== 'string' || logicalKey.trim() === '') return undefined
  const doc = await store.loadDoc({ force: true })
  const job = doc.jobs.find((candidate) => candidate.logicalKey === logicalKey.trim())
  return job === undefined ? undefined : toPublicJob(job)
}

/**
 * Update mutable fields. A change to schedule/payload/agentId/retry semantics
 * bumps `scheduleRevision` (D-007 §5.2): existing occurrences stay bound to
 * their creation revision; future occurrences mint in the new space.
 */
export async function updateJobOp(store, id, patch, { nowMs = Date.now(), assertJob, buildPatch, expectedRevision } = {}) {
  const { value } = await store.mutateDoc((latest) => {
    const current = findJob(latest.jobs, id)
    if (typeof assertJob === 'function') assertJob(current)
    assertExpectedRevision(current, expectedRevision)
    const effectivePatch = typeof buildPatch === 'function' ? buildPatch(current, patch) : patch
    if (current.migrationRestoreBlocked === true
      && ((Object.prototype.hasOwnProperty.call(effectivePatch, 'migrationRestoreBlocked')
        && effectivePatch.migrationRestoreBlocked !== true) || effectivePatch.enabled === true)) {
      throw Object.assign(new Error(`job ${id} restore gate is closed`), { code: 'RESTORE_GATE_CLOSED' })
    }
    const merged = { ...current, ...effectivePatch }
    delete merged.scheduleRevision // never taken from the patch
    const normalized = normalizeJob(merged, { nowMs, id: current.id, createdAtMs: current.createdAtMs })
    normalized.updatedAtMs = nowMs
    const semanticChange = JSON.stringify(normalized.schedule) !== JSON.stringify(current.schedule)
      || JSON.stringify(normalized.payload) !== JSON.stringify(current.payload)
      || normalized.agentId !== current.agentId
      || JSON.stringify(normalized.retry ?? null) !== JSON.stringify(current.retry ?? null)
    if (semanticChange) {
      normalized.scheduleRevision = (current.scheduleRevision ?? 1) + 1
      normalized.revisionActivatedAtMs = nowMs
    } else {
      normalized.scheduleRevision = current.scheduleRevision ?? 1
      // Re-enabling starts from the next future slot; occurrences that elapsed
      // while disabled are never replayed.
      normalized.revisionActivatedAtMs = current.enabled === false && normalized.enabled === true
        ? nowMs
        : current.revisionActivatedAtMs ?? current.createdAtMs
    }
    normalized.state = deriveJobStateSummary(normalized, latest.occurrences, nowMs)
    latest.jobs[latest.jobs.indexOf(current)] = normalized
    return { value: normalized }
  })
  return toPublicJob(value)
}

/** enable only restores FUTURE schedule eligibility (D-007 §12.3): it never clears a fence, never replays history. */
export async function enableJobOp(store, id, { nowMs = Date.now(), assertJob, expectedRevision } = {}) {
  const { value } = await store.mutateDoc((latest) => {
    const job = findJob(latest.jobs, id)
    if (typeof assertJob === 'function') assertJob(job)
    assertExpectedRevision(job, expectedRevision)
    if (job.migrationRestoreBlocked === true) {
      throw Object.assign(new Error(`job ${id} restore gate is closed`), { code: 'RESTORE_GATE_CLOSED' })
    }
    job.enabled = true
    job.updatedAtMs = nowMs
    job.revisionActivatedAtMs = nowMs
    refreshProjection(latest, id, nowMs)
    return { value: job }
  })
  return toPublicJob(value)
}

/** disable blocks future occurrence minting; existing occurrence evidence and fences are untouched. */
export async function disableJobOp(store, id, { nowMs = Date.now(), assertJob, expectedRevision } = {}) {
  const { value } = await store.mutateDoc((latest) => {
    const job = findJob(latest.jobs, id)
    if (typeof assertJob === 'function') assertJob(job)
    assertExpectedRevision(job, expectedRevision)
    job.enabled = false
    job.updatedAtMs = nowMs
    job.state = deriveJobStateSummary(job, latest.occurrences, nowMs)
    return { value: job }
  })
  return toPublicJob(value)
}

/** delete removes ONLY the definition — occurrence/run evidence always persists (D-007 §12.3). */
export async function deleteJobOp(store, id, { assertJob, expectedRevision } = {}) {
  await store.mutateDoc((latest) => {
    const job = findJob(latest.jobs, id)
    if (typeof assertJob === 'function') assertJob(job)
    assertExpectedRevision(job, expectedRevision)
    latest.jobs.splice(latest.jobs.indexOf(job), 1)
  })
  return true
}

/** One-shot submission seam: legacy `sessionTarget`/`sessionKey` inputs ignored (C-031). */
export async function submitOneShotOp(store, input, { nowMs = Date.now() } = {}) {
  const atMs = parseAtToMs(input.at, nowMs)
  if (atMs === null) throw new TypeError(`submitOneShot: invalid at: ${input.at}`)
  const job = normalizeJob(
    {
      name: input.name,
      agentId: input.agentId,
      enabled: true,
      schedule: { kind: 'at', at: new Date(atMs).toISOString() },
      payload: {
        kind: 'agentTurn',
        message: input.message,
        timeoutSeconds: input.timeoutSeconds,
        lightContext: input.lightContext,
        model: input.model,
      },
      ...(input.retry ? { retry: input.retry } : {}),
      delivery: input.deliver === true ? { mode: 'announce' } : { mode: 'none', channel: 'last' },
      deleteAfterRun: input.deleteAfterRun ?? true,
    },
    { nowMs },
  )
  const { value } = await store.mutateDoc((latest) => {
    const stored = cloneJob(job)
    stored.state = deriveJobStateSummary(stored, latest.occurrences, nowMs)
    latest.jobs.push(stored)
    return { value: stored }
  })
  return toPublicJob(value)
}

/**
 * C-029 operator reconcileOccurrence — control-only, explicit, audited.
 *
 * Resolves an unresolved outcome_unknown to succeeded|failed with the
 * operator's evidence note; records lateSettlement {basis:'operator-
 * reconcile'}; lifts the job fence when no other unresolved unknown remains.
 * NEVER re-admits, NEVER deletes timeout/unknown history, NEVER generates a
 * retry occurrence.
 *
 * Operator identity comes EXCLUSIVELY from the trusted control context (the
 * effective OS user of the local CLI process / a future authenticated
 * principal). A request body may NEVER self-report operator identity — any
 * `operator` value passed alongside `operatorFromRequest` markers is
 * ignored/rejected.
 */
export async function reconcileOccurrence(store, { occurrenceId, runId, resolvedTo, evidenceNote, nowMs = Date.now() }) {
  if (typeof runId !== 'string' || runId === '') {
    throw new TypeError('reconcileOccurrence: runId is required')
  }
  if (resolvedTo !== 'succeeded' && resolvedTo !== 'failed') {
    throw new TypeError('reconcileOccurrence: resolvedTo must be succeeded|failed')
  }
  if (typeof evidenceNote !== 'string' || !evidenceNote.trim()) {
    throw new TypeError('reconcileOccurrence: evidenceNote is required')
  }
  // Trusted control context: effective OS user, captured here — not from the request body.
  const osUser = userInfo()
  const identity = {
    provenance: 'local-trusted-control-context:effective-os-user',
    username: osUser.username,
    uid: osUser.uid,
    gid: osUser.gid,
  }
  const resolvedAt = nowMs
  const { doc, value } = await store.mutateDoc((latest) => {
    const record = findOccurrenceById(latest.occurrences, occurrenceId)
    if (!record) throw new Error(`unknown occurrence: ${occurrenceId}`)
    if (record.runId !== runId) {
      throw new Error(`runId mismatch: occurrence ${occurrenceId} belongs to ${record.runId}`)
    }
    if (!isUnresolvedUnknown(record)) {
      throw Object.assign(
        new Error(`occurrence ${occurrenceId} is ${record.state}${record.lateSettlement ? ' (already settled)' : ''} — only unresolved outcome_unknown may be reconciled`),
        { code: 'RECONCILE_NOT_UNKNOWN' },
      )
    }
    applyTransition(record, {
      to: resolvedTo,
      at: resolvedAt,
      reason: `operator reconcile: ${evidenceNote.trim()}`,
      endedAt: resolvedAt,
      executionOutcome: resolvedTo,
      lateSettlement: {
        resolvedTo, resolvedAt, basis: 'operator-reconcile',
        evidenceRef: evidenceNote.trim(),
      },
      terminalEvidence: { kind: 'operator-reconcile', detailRef: evidenceNote.trim() },
    })
    latest.fences = rebuildFences(latest.occurrences)
    for (const job of latest.jobs) {
      job.state = deriveJobStateSummary(job, latest.occurrences, resolvedAt)
    }
    // One-shot completion applies on late resolution too (§9.1). Mutate the
    // collection only after rebuilding every Job projection.
    const resolvedJobIndex = latest.jobs.findIndex((job) => job.id === record.jobId)
    const resolvedJob = latest.jobs[resolvedJobIndex]
    if (resolvedTo === 'succeeded' && resolvedJob?.schedule.kind === 'at') {
      if (resolvedJob.deleteAfterRun === true) latest.jobs.splice(resolvedJobIndex, 1)
      else resolvedJob.enabled = false
    }
    return { value: { record, identity, fenceRemaining: latest.fences[record.jobId] !== undefined } }
  })
  const evidenceStatus = await store.appendRunEvent({
    ts: resolvedAt, action: 'late_settlement', occurrenceId, runId: value.record.runId,
    resolvedTo, basis: 'operator-reconcile', note: evidenceNote.trim(), operatorIdentity: value.identity,
    jobId: value.record.jobId, fenceRemaining: value.fenceRemaining,
  })
  return {
    record: structuredClone(value.record),
    identity: value.identity,
    fenceRemaining: value.fenceRemaining,
    evidenceStatus,
  }
}
