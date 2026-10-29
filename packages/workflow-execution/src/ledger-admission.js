import { assertSameAttemptIdentity, attemptIdFor, validateIntentIds } from './attempt-identity.js'
import { buildAttemptPlannedEvent, ledgerAttemptPlanContext, prepareLedgerAttemptPlan } from './ledger-plan.js'
import { ownerResumeEligible, recordDeliveryCompletion } from './owner-assistance-resume-ledger.js'
import { ownerResumePlanIsValid } from './ledger-events.js'
const STALE_NO_PROGRESS_JUDGMENT = 'stale_no_progress'

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
  if (preparePlan !== undefined && typeof preparePlan !== 'function') {
    throw new TypeError('workflow-execution: preparePlan must be a function when provided')
  }
  if (canOwnerResume !== undefined && typeof canOwnerResume !== 'function') {
    throw new TypeError('workflow-execution: canOwnerResume must be a function when provided')
  }
  return ledger.mutate(async () => {
    const existing = io.attempt(nodeVisitId)
    // Classify from Svc while holding the same FIFO/OwnerLock as the mint.
    const policy = await ledger.attemptPolicy({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId })
    if (!policy) return { created: false, attempt: existing, cause: 'pre_plan_unavailable' }
    const ownerResume = existing === undefined ? false
      : await ownerResumeEligible(existing,
        existing.state !== 'ACTIVE' && existing.judgment === STALE_NO_PROGRESS_JUDGMENT, canOwnerResume)
    if (existing !== undefined) {
      const staleReentry = existing.state !== 'ACTIVE' && existing.judgment === STALE_NO_PROGRESS_JUDGMENT
      if (!staleReentry && !ownerResume) {
        return { created: false, attempt: { ...existing }, cause: 'already_attempted' }
      }
      // CTR-SRE-003: reject contradictory identity before any append.
      assertSameAttemptIdentity(existing, { dispatchIntentId, workflowInstanceId, ownerPrincipalId }, nodeVisitId)
      // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-004: the policy limit is
      // enforced INSIDE the fence, so no poller, race or double trigger can
      // mint past it. Refusal is a clean non-created outcome — the engine
      // turns it into the one-time escalation (CTR-WEC1-005).
      const nextGeneration = (existing.generation ?? 1) + 1
      if ((!ownerResume || policy.managed) && nextGeneration > policy.limit) {
        return { created: false, attempt: { ...existing }, cause: 'attempt_limit_reached' }
      }
      if (!ownerResume) {
        let quiescent = false
        try {
          const proof = typeof canReenter === 'function' ? canReenter({ ...existing }) : undefined
          if (proof instanceof Promise) void proof.catch(() => {})
          quiescent = proof === true
        } catch { /* unavailable proof cannot authorize a new execution */ }
        if (!quiescent) return { created: false, attempt: { ...existing }, cause: 'deferred_quiescence' }
      }
    }
    // WORKFLOW_STALE_REENTRY_V1 CTR-SRE-003: a terminal attempt with
    // judgment 'stale_no_progress' is superseded by generation N+1 (the
    // projection guard in ledger-events re-validates identity + generation
    // on both live append and replay). Every other existing attempt keeps
    // the V2 fence semantics byte-for-byte.
    const generation = existing === undefined ? 1 : (existing.generation ?? 1) + 1
    const prepared = await prepareLedgerAttemptPlan(preparePlan,
      ledgerAttemptPlanContext({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId, existing, generation, ownerResume }))
    if (!prepared.ok) return { created: false, attempt: existing === undefined ? undefined : { ...existing }, cause: ownerResume ? 'already_attempted' : 'pre_plan_unavailable' }
    const plan = prepared.plan
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
  })
}

