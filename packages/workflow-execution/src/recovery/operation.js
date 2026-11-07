import { AGENT_ID_RE } from '../attempt-identity.js'
import { judgeSettleFromDetail } from '../judgment.js'
import { createAutomaticRecovery } from './automatic.js'
import { RECOVERY_RULE } from './automatic-ledger.js'
import { detailMatchesActivation } from '../owner-assistance-resume-engine.js'

/** E5 assignee probe: when the svc wire carries the visit's/instance's
 *  assignee principal, return it (lowercased) for the exact comparison;
 *  absent fields are not fabricable evidence — the visit-currency check
 *  plus svc's immutable visit rows carry the invariant. */
function findAssigneeOnDetail(detail) {
  if (detail === null || typeof detail !== 'object') return undefined
  const candidates = [
    detail.current_visit?.assignee_principal_id,
    detail.current_visit?.assigneePrincipalId,
    detail.instance?.owner_principal_id,
    detail.instance?.ownerPrincipalId,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate !== '') return candidate.toLowerCase()
  }
  return undefined
}


/**
 * @param {object} deps
 * @param {object} deps.ledger - ExecutionLedger (mutateWithRecord is the only
 *   ledger surface this module touches: the whole dispatch is one atomic
 *   single-flight mutation).
 * @param {(principalId: string) => Promise<{ok:true, agentId:string}|{ok:false, code:string}>} deps.resolvePrincipalToAgent
 * @param {(req: {requestId:string, agentId:string, message:string, messageOrigin:object}) => Promise<object>} deps.deliverRun
 * @param {({agentId:string, workflowInstanceId:string}) => Promise<{ok:true, body:object}|{ok:false, code:string}>} deps.readInstanceDetail
 * @param {({requestId:string}) => {state:string, handle?:string, messageId?:string, sessionId?:string, reconciliationHandle?:string}} [deps.resolveCallerCorrelation]
 * @param {Function} deps.buildInstruction
 * @param {Function} deps.provenanceFor - (attempt) => frozen sidecar.
 */
export function createRecoveryOperation({
  ledger,
  resolvePrincipalToAgent,
  deliverRun,
  readInstanceDetail,
  resolveCallerCorrelation,
  buildInstruction,
  provenanceFor,
  clock = () => Date.now(),
  config = {},
}) {
  const automaticCalls = new WeakSet()
  const automatic = createAutomaticRecovery({ ledger, clock, config, recover: (args, context) => {
    automaticCalls.add(context)
    return recoverAttempt(args, context)
  } })
  /** Shared FIFO/OwnerLock/fresh-replay recovery. The automatic capability is
   * closure-owned and single-use; public call arguments cannot mint it.
   * E1 requires that capability or explicit authorityRef. Every safety gate
   * precedes recovery_authorized; delivery_started precedes Router invocation.
   * Checkpoint metadata is responsibility only, never business settlement. */
  async function recoverAttempt({ nodeVisitId, authorityRef }, context) {
    const auto = context !== undefined && automaticCalls.has(context)
    if (auto) automaticCalls.delete(context)
    if (!auto && (typeof authorityRef !== 'string' || authorityRef === '')) {
      return { outcome: 'REFUSED_CALL', reason: 'authorityRef is required for every recovery invocation (CTR-WAE-013)' }
    }
    if (auto) authorityRef = RECOVERY_RULE
    try {
      return await ledger.mutateWithRecord(nodeVisitId, async (record, getAttempt) => {
        const attempt = getAttempt()
        if (attempt === undefined) return { outcome: 'NO_OP_NO_ATTEMPT', nodeVisitId }
        if (attempt.state !== 'ACTIVE') return { outcome: 'NO_OP_TERMINAL', nodeVisitId, attemptId: attempt.attemptId }
        if (auto && !automatic.eligible(attempt, context)) return { outcome: 'REFUSED_CALL', reason: 'automatic_trigger_changed_or_disabled', nodeVisitId }
        if (auto) await automatic.checkpoint(record, attempt, context)
        let gateEvidence = { ledger: 'pre_admission_resolution_failure', originalExecution: 'never_started', tools: 'never_dispatched' }
        const audit = () => auto ? automatic.audit(attempt, context, gateEvidence) : undefined
        async function dispatch() {
          // E4 — ledger-side shape + delivery-domain evidence.
          if (attempt.phase !== 'resolution_blocked' || attempt.deliveryStartedAtMs !== undefined || attempt.delivered !== undefined) {
            const evidenceClass = attempt.phase === 'planned'
              ? 'not_pre_admission_blocked'
              : `delivery_domain:${attempt.phase}`
            return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass, nodeVisitId, attemptId: attempt.attemptId }
          }
          // E4 — fresh Router correlation for requestId = attemptId: the only
          // passing answer is exactly never_existed with NO attributable fields.
          // pending/settled/evicted/restart_lost/unreadable all refuse
          // (outcome-unknown is never zero); a never_existed answer carrying a
          // handle/messageId is contradictory evidence and refuses too.
          if (typeof resolveCallerCorrelation !== 'function') {
            return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass: 'router_correlation_unavailable', nodeVisitId, attemptId: attempt.attemptId }
          }
          let correlation
          try {
            correlation = resolveCallerCorrelation({ requestId: attempt.attemptId })
          } catch (error) {
            return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass: 'router_correlation_error', nodeVisitId, attemptId: attempt.attemptId }
          }
          if (correlation?.state !== 'never_existed') {
            return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass: `router_correlation:${correlation?.state ?? 'unavailable'}`, nodeVisitId, attemptId: attempt.attemptId }
          }
          if (correlation.handle !== undefined || correlation.messageId !== undefined
            || correlation.sessionId !== undefined || correlation.reconciliationHandle !== undefined) {
            return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass: 'attributable_delivery_evidence', nodeVisitId, attemptId: attempt.attemptId }
          }
          if (auto && Object.keys(correlation).some(key => key !== 'state')) {
            return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass: 'unverified_router_evidence', nodeVisitId, attemptId: attempt.attemptId }
          }
          gateEvidence = { ...gateEvidence, router: 'fresh_exact_never_existed_without_linkage', requestId: attempt.attemptId }
          // E5 verification pass — a resolution READ first (the read is NOT the
          // execution re-resolution). A verification failure (identity still
          // unrepaired) appends the fresh resolution_blocked fact the accepted
          // CTR-WAE-012 mandates for EVERY resolution-phase failure ("appended
          // when the resolution phase fails"), with NO recovery_authorized
          // precedent (authorization never precedes this path, and
          // resolution_blocked is not a refusal — the 012 refusal-path
          // constraint stays intact). The attempt stays blocked with ZERO Runs:
          // the designed interim behavior while identity is unrepaired.
          const verified = await resolvePrincipalToAgent(attempt.ownerPrincipalId)
          if (!verified.ok) {
            await record.resolutionBlocked(verified.code)
            return { outcome: `STILL_BLOCKED:${verified.code}`, nodeVisitId, attemptId: attempt.attemptId }
          }
          if (auto && (typeof verified.agentId !== 'string' || !AGENT_ID_RE.test(verified.agentId))) {
            return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass: 'resolved_agent_unverified', nodeVisitId, attemptId: attempt.attemptId }
          }
          // E5 — world verification IN THE RESOLVED AGENT'S CONTEXT (the only
          // mechanically decidable view; a poller view cannot see visit
          // currency). Drift or unreadable state ⇒ refused ⇒ terminal — and NO
          // authorization ever precedes a refusal.
          const probe = await readInstanceDetail({ agentId: verified.agentId, workflowInstanceId: attempt.workflowInstanceId })
          if (auto && probe.ok && probe.body?.detail?.instance?.workflow_instance_id !== attempt.workflowInstanceId) {
            return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass: 'instance_identity_unverified', nodeVisitId, attemptId: attempt.attemptId }
          }
          const settle = probe.ok ? judgeSettleFromDetail({ body: probe.body, nodeVisitId }) : undefined
          if (settle === undefined || settle.kind === 'unavailable') {
            const refused = probe.ok ? 'instance_state_unavailable' : `instance_state_unavailable:${probe.code}`
            if (auto) return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass: refused, nodeVisitId, attemptId: attempt.attemptId }
            await record.recoveryRefused(authorityRef, refused, audit())
            return { outcome: 'RECOVERY_REFUSED', refused, nodeVisitId, attemptId: attempt.attemptId }
          }
          if (settle.kind === 'settled') {
            await record.recoveryRefused(authorityRef, settle.reason, audit())
            return { outcome: 'RECOVERY_REFUSED', refused: settle.reason, nodeVisitId, attemptId: attempt.attemptId }
          }
          // E5 — assignee identity: the visit's assignee is immutable on
          // svc-workflow rows, and when the wire carries it we compare it
          // exactly against the attempt's ownerPrincipalId (drift ⇒ refused).
          const assignee = findAssigneeOnDetail(probe.body?.detail)
          if (assignee !== undefined && assignee !== attempt.ownerPrincipalId.toLowerCase()) {
            const refused = `assignee_no_longer_current:${assignee}`
            await record.recoveryRefused(authorityRef, refused, audit())
            return { outcome: 'RECOVERY_REFUSED', refused, nodeVisitId, attemptId: attempt.attemptId }
          }
          if (auto && probe.body?.detail?.instance?.is_terminal === true) {
            await record.recoveryRefused(authorityRef, 'instance_terminal', audit())
            return { outcome: 'RECOVERY_REFUSED', refused: 'instance_terminal', nodeVisitId, attemptId: attempt.attemptId }
          }
          if (auto && !detailMatchesActivation(probe.body, attempt)) {
            return { outcome: 'RECOVERY_INAPPLICABLE', evidenceClass: 'activation_identity_unverified', nodeVisitId, attemptId: attempt.attemptId }
          }
          if (auto && !automatic.enabled()) return { outcome: 'REFUSED_CALL', reason: 'automatic_rule_disabled', nodeVisitId }
          gateEvidence = { ...gateEvidence, world: 'fresh_exact_current_activation', agentId: verified.agentId }
          // E6 — EVERY fresh precondition has now passed (E1–E5): record the
          // governance act, then re-execute resolution FRESH (never the
          // verification read's result — no cache), write-ahead, ONE Run.
          await record.recoveryAuthorized(authorityRef, audit())
          const resolved = await resolvePrincipalToAgent(attempt.ownerPrincipalId)
          if (!resolved.ok) {
            // Identity flapped between verification and execution: the authorized
            // recovery re-blocks the SAME attempt with ZERO Runs (the fresh
            // blocked fact is authorized — it follows its recovery_authorized).
            await record.resolutionBlocked(resolved.code)
            return { outcome: `STILL_BLOCKED:${resolved.code}`, nodeVisitId, attemptId: attempt.attemptId }
          }
          if (auto && (!automatic.enabled() || resolved.agentId !== verified.agentId)) {
            await record.resolutionBlocked('recovery_authority_or_target_changed')
            return { outcome: 'STILL_BLOCKED:recovery_authority_or_target_changed', nodeVisitId, attemptId: attempt.attemptId }
          }
          const requestId = attempt.attemptId
          const message = buildInstruction({
            workflowInstanceId: attempt.workflowInstanceId,
            nodeVisitId: attempt.nodeVisitId,
            dispatchIntentId: attempt.dispatchIntentId,
            attemptId: attempt.attemptId,
          })
          await record.deliveryStarted()
          const delivery = await deliverRun({
            requestId,
            agentId: resolved.agentId,
            message,
            messageOrigin: provenanceFor(attempt),
          })
          if (!delivery.ok) {
            await record.deliveryFailed(`delivery_rejected:${delivery.code}`)
            return { outcome: `DELIVERY_REJECTED:${delivery.code}`, nodeVisitId, attemptId: attempt.attemptId }
          }
          await record.runDelivered({
            agentId: resolved.agentId,
            requestId,
            sessionId: delivery.sessionId,
            reconciliationHandle: delivery.reconciliationHandle,
            messageId: delivery.messageId,
          })
          return {
            outcome: 'RECOVERED_RUN_ADMITTED',
            nodeVisitId,
            attemptId: attempt.attemptId,
            agentId: resolved.agentId,
            sessionId: delivery.sessionId,
          }
        }
        const result = await dispatch()
        if (auto && getAttempt().state === 'ACTIVE' && getAttempt().phase === 'resolution_blocked') {
          await automatic.checkpoint(record, getAttempt(), context, `${result.outcome}${result.evidenceClass ? `:${result.evidenceClass}` : ''}`)
        }
        return result
      })
    } catch (error) {
      // A projection guard fired (e.g. the attempt entered the delivery domain
      // under a concurrent recovery): fail closed without a second delivery.
      return {
        outcome: 'RECOVERY_INAPPLICABLE',
        evidenceClass: 'attempt_changed',
        detail: String(error?.message ?? error).slice(0, 200),
        nodeVisitId,
      }
    }
  }
  return { recoverAttempt, reconcileBlocked: automatic.reconcile }
}
