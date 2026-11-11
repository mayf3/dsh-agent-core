import { assertSameAttemptIdentity, attemptIdFor, validateIntentIds } from './attempt-identity.js'
import { buildAttemptPlannedEvent, isBoundedCollection, ledgerAttemptPlanContext, prepareLedgerAttemptPlan } from './ledger-plan.js'
import { ownerResumeEligible, recordDeliveryCompletion } from './owner-assistance-resume-ledger.js'
import { ownerResumePlanIsValid } from './ledger-events.js'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const STALE_NO_PROGRESS_JUDGMENT = 'stale_no_progress'

/** Probe work is bounded independently of NEW attempts (CTR-WAE-001b).
 * IDs only defer probes until the current static feed has had an opportunity;
 * they never authorize admission/recovery. Nothing persists across restart.
 * Full keyset discovery remains exhaustive; an incomplete sweep commits no IDs.
 */
export function createAdmissionBudget(maxAdmissions) {
  if (!Number.isSafeInteger(maxAdmissions) || maxAdmissions < 0) {
    throw new TypeError('workflow-execution: maxAdmissionsPerPoll must be a nonnegative safe integer')
  }
  const maxFailures = Math.max(1, maxAdmissions)
  const maxScans = maxFailures * 2
  let visited = new Set()
  return {
    begin() {
      const working = new Set(visited)
      const seen = new Set()
      const stats = { scanned: 0, failed: 0, created: 0, unknown: 0, deferred: 0, rotated: 0 }
      return {
        stats,
        take(nodeVisitId) {
          seen.add(nodeVisitId)
          if (working.has(nodeVisitId)) {
            stats.rotated += 1
            return false
          }
          if (stats.scanned >= maxScans || stats.failed >= maxFailures
            || stats.created >= maxAdmissions || stats.unknown > 0) {
            stats.deferred += 1
            return false
          }
          working.add(nodeVisitId)
          stats.scanned += 1
          return true
        },
        recordCreated: result => { if (result.created) stats.created += 1 },
        recordResult(action) {
          if (['pre_plan_unavailable', 'blocked', 'needs_review'].includes(action)) stats.failed += 1
        },
        recordUnknown() {
          // A throw can follow a durable mint. Stop further probes this sweep;
          // never classify an unreturned ledger outcome as created:false.
          stats.unknown += 1
          stats.failed += 1
        },
        finish() {
          visited = stats.deferred === 0 ? new Set() : new Set([...working].filter(id => seen.has(id)))
        },
      }
    },
  }
}

/**
 * The atomic one-attempt-per-NodeVisit fence. Creates the attempt (and
 * appends attempt_planned) only for a new visit or a terminal stale attempt
 * with positive execution proof. `canReenter` reads the fresh predecessor
 * under OwnerLock and must return synchronous true before any new append.
 *
 * When `complete` is supplied, retain the same cross-process OwnerLock
 * through resolve/delivery and append exactly one completion event before
 * releasing it. Omitting `complete` preserves the ledger-only primitive
 * used by focused lifecycle tests and recovery tooling; stale re-entry
 * still requires the same proof even when no delivery callback is supplied.
 *
 * @returns {Promise<{created:true, attempt:object, completion?:object}
 *   | {created:false, attempt:object, cause:string}>}
 */
export async function beginAttemptIfAbsent(ledger, io, { dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId }, complete, canReenter, preparePlan, canOwnerResume) {
  validateIntentIds({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId })
  if (complete !== undefined && typeof complete !== 'function') {
    throw new TypeError('workflow-execution: admission completion callback must be a function when provided')
  }
  const bounded = isBoundedCollection(preparePlan)
  if (preparePlan !== undefined && typeof preparePlan !== 'function' && !bounded) {
    throw new TypeError('workflow-execution: preparePlan must be a function or bounded collection when provided')
  }
  if (canOwnerResume !== undefined && typeof canOwnerResume !== 'function') {
    throw new TypeError('workflow-execution: canOwnerResume must be a function when provided')
  }
  const intent = { dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId }
  if (bounded) return beginWithCollection(ledger, io, intent, complete, canReenter, preparePlan, canOwnerResume)
  return ledger.mutate(async () => {
    const candidate = await classifyCandidate(ledger, io, intent, canReenter, canOwnerResume)
    if (candidate.refusal) return candidate.refusal
    const { existing, ownerResume, generation } = candidate
    const prepared = await prepareLedgerAttemptPlan(preparePlan, ledgerAttemptPlanContext({ ...intent, existing, generation, ownerResume }))
    if (!prepared.ok) return refuse(existing, ownerResume ? 'already_attempted' : 'pre_plan_unavailable')
    return commitPlan(ledger, io, intent, complete, candidate, prepared.plan)
  })
}

function refuse(existing, cause) {
  return { created: false, attempt: existing === undefined ? undefined : structuredClone(existing), cause }
}

function replayBytes(ledger) {
  return existsSync(ledger.eventsFile) ? readFileSync(ledger.eventsFile) : Buffer.alloc(0)
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

/** The original admission gates remain held, both at capture and commit. */
async function classifyCandidate(ledger, io, { dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId }, canReenter, canOwnerResume) {
  const existing = io.attempt(nodeVisitId)
  // Classify from Svc while holding the same FIFO/OwnerLock as the mint.
  const policy = await ledger.attemptPolicy({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId })
  if (!policy) return { refusal: refuse(existing, 'pre_plan_unavailable') }
  const ownerResume = existing === undefined ? false
    : await ownerResumeEligible(existing,
      existing.state !== 'ACTIVE' && existing.judgment === STALE_NO_PROGRESS_JUDGMENT, canOwnerResume)
  if (existing !== undefined) {
    const staleReentry = existing.state !== 'ACTIVE' && existing.judgment === STALE_NO_PROGRESS_JUDGMENT
    if (!staleReentry && !ownerResume) {
      return { refusal: refuse(existing, 'already_attempted') }
    }
    // CTR-SRE-003: reject contradictory identity before any append.
    assertSameAttemptIdentity(existing, { dispatchIntentId, workflowInstanceId, ownerPrincipalId }, nodeVisitId)
    // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-004: the policy limit is
    // enforced INSIDE the fence, so no poller, race or double trigger can
    // mint past it. Refusal is a clean non-created outcome — the engine
    // turns it into the one-time escalation (CTR-WEC1-005).
    const nextGeneration = (existing.generation ?? 1) + 1
    if ((!ownerResume || policy.managed) && nextGeneration > policy.limit) {
      return { refusal: refuse(existing, 'attempt_limit_reached') }
    }
    if (!ownerResume) {
      let quiescent = false
      try {
        const proof = typeof canReenter === 'function' ? canReenter({ ...existing }) : undefined
        if (proof instanceof Promise) void proof.catch(() => {})
        quiescent = proof === true
      } catch { /* unavailable proof cannot authorize a new execution */ }
      if (!quiescent) return { refusal: refuse(existing, 'deferred_quiescence') }
    }
  }
  // WORKFLOW_STALE_REENTRY_V1 CTR-SRE-003: a terminal attempt with
  // judgment 'stale_no_progress' is superseded by generation N+1 (the
  // projection guard in ledger-events re-validates identity + generation
  // on both live append and replay). Every other existing attempt keeps
  // the V2 fence semantics byte-for-byte.
  const generation = existing === undefined ? 1 : (existing.generation ?? 1) + 1
  return { existing, ownerResume, generation, policy }
}

/** No reservation or append at capture. Each mutate uses the SAME FIFO and
 * OwnerLock with fresh replay; the collection owns neither exclusion surface. */
async function beginWithCollection(ledger, io, intent, complete, canReenter, collection, canOwnerResume) {
  const captured = await ledger.mutate(async () => {
    const candidate = await classifyCandidate(ledger, io, intent, canReenter, canOwnerResume)
    if (candidate.refusal) return candidate
    const context = structuredClone(ledgerAttemptPlanContext({ ...intent, ...candidate }))
    try {
      const reads = await collection.capture(context)
      const bytes = replayBytes(ledger)
      return { context, reads: structuredClone(reads), policy: { ...candidate.policy },
        revision: { bytes: bytes.length, sha256: digest(bytes) } }
    } catch { return { refusal: refuse(candidate.existing, 'pre_plan_unavailable') } }
  })
  if (captured.refusal) return captured.refusal
  const prepared = await prepareLedgerAttemptPlan(
    context => collection.collect(context, structuredClone(captured.reads)), structuredClone(captured.context))
  return ledger.mutate(async () => {
    const existing = io.attempt(intent.nodeVisitId)
    const currentBytes = replayBytes(ledger)
    if (currentBytes.length < captured.revision.bytes
      || digest(currentBytes.subarray(0, captured.revision.bytes)) !== captured.revision.sha256) return refuse(existing, 'pre_plan_unavailable')
    // Compare the complete relevant projection, including consumed permits,
    // delivery/reconciliation facts, generation and phase. Unrelated replay
    // movement is permitted; its appends survive the fresh replay above.
    if (JSON.stringify(existing) !== JSON.stringify(captured.context.existing)) return refuse(existing, 'already_attempted')
    if (!prepared.ok) return refuse(existing, captured.context.retryReason === 'owner_assistance_resolved' ? 'already_attempted' : 'pre_plan_unavailable')
    const candidate = await classifyCandidate(ledger, io, intent, canReenter, canOwnerResume)
    if (candidate.refusal) return candidate.refusal
    if (JSON.stringify(candidate.policy) !== JSON.stringify(captured.policy)
      || candidate.generation !== captured.context.generation
      || (candidate.ownerResume ? 'owner_assistance_resolved' : existing === undefined ? undefined : 'stale_no_progress') !== captured.context.retryReason) {
      return refuse(existing, 'pre_plan_unavailable')
    }
    let valid = false
    try { valid = await collection.validate(structuredClone(captured.context), structuredClone(prepared.plan), structuredClone(captured.reads)) === true } catch { /* no external equality, no append */ }
    if (!valid) return refuse(existing, 'pre_plan_unavailable')
    return commitPlan(ledger, io, intent, complete, candidate, prepared.plan)
  })
}

async function commitPlan(ledger, io, { dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId }, complete, { existing, ownerResume, generation }, plan) {
  const event = buildAttemptPlannedEvent({
    attemptId: attemptIdFor(nodeVisitId, generation), nodeVisitId, dispatchIntentId,
    workflowInstanceId, ownerPrincipalId, generation, existing, ownerResume, plan, atMs: ledger.clock(),
  })
  if (ownerResume && !ownerResumePlanIsValid(existing, event, generation, true)) {
    return { created: false, attempt: { ...existing }, cause: 'owner_resume_proof_unavailable' }
  }
  io.appendEvent(event)
  io.applyEvent(event)
  if (complete === undefined) return { created: true, attempt: { ...io.attempt(nodeVisitId) } }
  // V2 CTR-WAE-013: the completion callback gets a write-ahead seam so it
  // can durably append delivery_started BEFORE invoking router.deliver,
  // inside this same locked mutation. There is no invocation-to-record
  // crash window: any delivery attempt must first leave this trace.
  const completion = await complete({ ...io.attempt(nodeVisitId) }, {
    recordDeliveryStarted: () => { io.recordDeliveryStarted(nodeVisitId) },
  })
  recordDeliveryCompletion({ completion, nodeVisitId,
    recordRunDelivered: (fields) => io.recordRunDelivered(nodeVisitId, fields),
    recordDeliveryFailed: (reason) => io.recordDeliveryFailed(nodeVisitId, reason),
    recordResolutionBlocked: (code) => io.recordResolutionBlocked(nodeVisitId, code),
  })
  return { created: true, attempt: { ...io.attempt(nodeVisitId) }, completion }
}

