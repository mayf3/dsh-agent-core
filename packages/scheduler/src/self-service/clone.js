/**
 * clone_disabled handler (AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4_
 * AMENDMENT1_CLONE_DISABLED, DRAFT / PENDING_ACCEPTANCE) — mechanical split
 * from src/self-service/access.js (file-line ceiling): the body moved
 * verbatim behind a factory that receives the access-layer closures it shares
 * (store, appendAudit, contextOrError). Same-Owner server-side atomic clone
 * into a permanently disabled target: the hidden payload message is copied
 * from the stored source bytes and never crosses the wire in either direction.
 *
 * Frozen judgment order: trusted caller -> argument shape -> source
 * visible+owned (opaque, NO admin bypass — foreign stays access_denied even
 * for a held scheduler.admin proof) -> two-field CAS (stale = zero write) ->
 * elapsed one-shot precisely rejected -> locked re-verify (ownership, CAS)
 * inside cloneDisabledJobOp -> logical-key dedup -> insert -> single audit
 * event (alreadyApplied marker on retries) -> canonical committed readback.
 */

import { cloneDisabledJobOp, assertExpectedRevision } from '../control.js'
import { toPublicJob } from '../job-model.js'
import { parseAbsoluteTimeMs } from '../schedule.js'
import { ownershipGuard } from './critical-job-guard.js'
import {
  SELF_SERVICE_ERROR_CODES,
  err,
  nonEmpty,
  expectedRevisionFromArgs,
  validationFailure,
  mutationFailure,
} from './schema.js'
import { definitionDigest, committedResult } from './projections.js'

export function createCloneDisabledHandler({ store, appendAudit, contextOrError }) {
  return async function clone_disabled(args, context) {
    const caller = contextOrError(context, 'scheduler.clone_disabled')
    if (typeof caller !== 'string') return caller
    const newLogicalKey = nonEmpty(args.new_logical_key)
    if (newLogicalKey === undefined) {
      return err(SELF_SERVICE_ERROR_CODES.INVALID_ARGUMENTS, 'clone_disabled requires new_logical_key (stable caller-provided logical identity)')
    }
    if (args.expected_revision === undefined) {
      return err(SELF_SERVICE_ERROR_CODES.INVALID_ARGUMENTS, 'clone_disabled requires expected_revision {schedule_revision, updated_at_ms} observed before the clone')
    }
    let doc
    try {
      doc = await store.loadDoc({ force: true })
    } catch {
      return err(SELF_SERVICE_ERROR_CODES.INTERNAL_ERROR, 'scheduler store read failed before mutation')
    }
    const source = doc.jobs.find((candidate) => candidate.id === args.job_id)
    if (source === undefined) {
      return err(SELF_SERVICE_ERROR_CODES.JOB_NOT_FOUND, `no visible job with id ${args.job_id}`)
    }
    if (source.agentId !== caller) {
      return err(SELF_SERVICE_ERROR_CODES.ACCESS_DENIED, `no visible job with id ${args.job_id}`)
    }
    const nowMs = Date.now()
    let expectedRevision
    try {
      expectedRevision = expectedRevisionFromArgs(args)
    } catch (error) {
      return validationFailure(error)
    }
    // Frozen order: the two-field CAS outranks every definition rule — a
    // stale observation fails closed (zero write) even when the source is
    // also an elapsed one-shot. The locked re-check inside
    // cloneDisabledJobOp stays authoritative.
    try {
      assertExpectedRevision(source, expectedRevision)
    } catch (error) {
      return mutationFailure(error)
    }
    // An already-elapsed one-shot can never fire again: cloning it would
    // mint a permanently dead definition, so it is rejected precisely
    // instead of silently copied. The stored schedule otherwise passes the
    // UNCHANGED normalizeJob validator (anchor/every/expr bytes preserved).
    if (source.schedule?.kind === 'at') {
      const atMs = parseAbsoluteTimeMs(source.schedule.at)
      if (atMs !== null && atMs <= nowMs) {
        return err(SELF_SERVICE_ERROR_CODES.VALIDATION_ERROR, `clone_disabled: schedule kind "at" cannot be copied at the already-elapsed instant ${source.schedule.at}; create a fresh one-shot instead`)
      }
    }
    let cloned
    let alreadyApplied = false
    try {
      const reconciled = await cloneDisabledJobOp(store, {
        sourceJobId: source.id,
        expectedRevision,
        cloneInput: {
          name: args.new_name ?? source.name,
          agentId: caller,
          logicalKey: newLogicalKey,
          schedule: source.schedule,
          payload: source.payload,
          delivery: source.delivery,
          ...(source.retry !== undefined ? { retry: source.retry } : {}),
          deleteAfterRun: source.deleteAfterRun,
          ...(source.description !== undefined ? { description: source.description } : {}),
        },
      }, {
        nowMs,
        // Lock-verified re-check of the same-owner precondition; clone has
        // no allowAny path, so a mid-call ownership flip fails closed.
        assertSource: ownershipGuard(caller, false),
      })
      cloned = reconciled.job
      alreadyApplied = reconciled.outcome === 'already_applied'
    } catch (error) {
      if (error?.mutationOutcome === 'committed' && error.committedValue !== undefined) {
        const committed = error.committedValue
        cloned = toPublicJob(committed?.job ?? committed)
        alreadyApplied = committed?.alreadyApplied === true
      } else {
        return mutationFailure(error)
      }
    }
    const auditStatus = await appendAudit('clone_disabled', {
      jobId: cloned.id,
      operatorAgentId: caller,
      targetAgentId: cloned.agentId,
      after: definitionDigest(cloned),
      nowMs,
      ...(alreadyApplied ? { alreadyApplied } : {}),
    })
    return { ok: true, result: committedResult(cloned, auditStatus) }
  }
}
