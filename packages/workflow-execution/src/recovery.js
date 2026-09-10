/**
 * @agent-core/workflow-execution/src/recovery.js — THE ONE controlled
 * recovery operation (WORKFLOW_AGENT_EXECUTION_V2 CTR-WAE-013). Split out of
 * engine.js for the structure guardrails; pure orchestration over injected
 * seams — no retry engine, no timer, no model-facing surface.
 *
 * FROZEN ORDERING (CTR-WAE-012/013): the recovery_authorized append happens
 * ONLY after EVERY fresh precondition passes (E1–E5) and strictly before the
 * execution re-resolution — it NEVER precedes a refusal. The E5 world
 * verification uses a resolution READ (zero appends, zero side effects): a
 * verification failure (identity still unrepaired) leaves the attempt exactly
 * as it was — STILL_BLOCKED, zero ledger facts — never an unauthorized
 * blocked fact, never an authorization on a refusal path.
 */

import { judgeSettleFromDetail } from './judgment.js'

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
}) {
  /**
   * THE ONE controlled recovery operation (V2 CTR-WAE-013): explicit,
   * authorityRef-gated, control-plane-only continuation of a provably
   * pre-admission blocked attempt. NO retry engine lives here — no timer, no
   * queue, no watcher, no poller/reconcile invocation, no model-facing
   * surface; between explicit authorized calls a blocked attempt simply
   * waits (loudly visible in reconcile summary.blocked).
   *
   * The WHOLE entry-state dispatch runs atomically under the ledger's FIFO
   * chain + cross-process OwnerLock with a fresh replay (mutateWithRecord):
   * concurrent callers serialize completely — the loser observes the post-
   * first-caller state and no-ops/refuses, and at most one Run can ever be
   * prepared. The `record` seam appends pre-checked events inside the locked
   * mutation, so an E-check can never be split from its append.
   *
   * Entry-state dispatch (frozen; first match wins):
   *   E1 no/empty authorityRef → refuse the call, zero ledger effect.
   *   E2 no attempt for the nodeVisitId → NO_OP_NO_ATTEMPT.
   *   E3 attempt terminal → NO_OP_TERMINAL, zero appends (the V1 terminal
   *      append-refusal is preserved; a replayed recovery can never
   *      un-terminal or re-append).
   *   E4 delivery-domain evidence — any delivery_started / run_delivered /
   *      delivery_failed / reconciled phase in the ledger, a Router
   *      correlation answer other than exactly "no record ever existed", a
   *      correlation result carrying ANY attributable handle/messageId fields
   *      (contradictory evidence refuses — never reconciled into success),
   *      the correlation probe unavailable/erroring, or a non-eligible shape
   *      (planned-only) → RECOVERY_INAPPLICABLE:<class>, zero appends — the
   *      UNCHANGED V1 machinery owns the attempt. One-directional: it may
   *      only refuse, never override the ledger. (Completeness: the
   *      write-ahead fence makes any real delivery leave a durable
   *      delivery_started trace BEFORE the invocation, so attributable
   *      Router/session linkage cannot exist without the ledger evidence the
   *      E4 gate already refuses on; the correlation query is the
   *      requestId-keyed attributable surface the Router store exposes.)
   *   E6 eligible-shaped → recovery_authorized FIRST (the governance act,
   *      authorityRef on record) → fresh re-resolution, never cached:
   *      fail ⇒ fresh resolution_blocked (AFTER its authorization — the
   *      auditable interim behavior while identity is unrepaired), STILL_
   *      BLOCKED, ZERO side effects → world intact ⇒ delivery_started ⇒ ONE
   *      Run (same attemptId, requestId = attemptId, unchanged sidecar) ⇒
   *      RECOVERED_RUN_ADMITTED | DELIVERY_REJECTED (terminal, V1 class).
   *   E5 world drift discovered on the probe — instance gone/unreadable,
   *      visit no longer current, or the visit's assignee no longer the
   *      attempt's ownerPrincipalId ⇒ recovery_refused appended ⇒ terminal
   *      NEEDS_REVIEW (the human path is correct; no fallback).
   */
  async function recoverAttempt({ nodeVisitId, authorityRef }) {
    if (typeof authorityRef !== 'string' || authorityRef === '') {
      return { outcome: 'REFUSED_CALL', reason: 'authorityRef is required for every recovery invocation (CTR-WAE-013)' }
    }
    try {
      return await ledger.mutateWithRecord(nodeVisitId, async (record, getAttempt) => {
        const attempt = getAttempt()
        if (attempt === undefined) return { outcome: 'NO_OP_NO_ATTEMPT', nodeVisitId }
        if (attempt.state !== 'ACTIVE') return { outcome: 'NO_OP_TERMINAL', nodeVisitId, attemptId: attempt.attemptId }
        // E4 — ledger-side shape + delivery-domain evidence.
        if (attempt.phase !== 'resolution_blocked') {
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
        // E5 — world verification IN THE RESOLVED AGENT'S CONTEXT (the only
        // mechanically decidable view; a poller view cannot see visit
        // currency). Drift or unreadable state ⇒ refused ⇒ terminal — and NO
        // authorization ever precedes a refusal.
        const probe = await readInstanceDetail({ agentId: verified.agentId, workflowInstanceId: attempt.workflowInstanceId })
        const settle = probe.ok ? judgeSettleFromDetail({ body: probe.body, nodeVisitId }) : undefined
        if (settle === undefined || settle.kind === 'unavailable') {
          const refused = probe.ok ? 'instance_state_unavailable' : `instance_state_unavailable:${probe.code}`
          await record.recoveryRefused(authorityRef, refused)
          return { outcome: 'RECOVERY_REFUSED', refused, nodeVisitId, attemptId: attempt.attemptId }
        }
        if (settle.kind === 'settled') {
          await record.recoveryRefused(authorityRef, settle.reason)
          return { outcome: 'RECOVERY_REFUSED', refused: settle.reason, nodeVisitId, attemptId: attempt.attemptId }
        }
        // E5 — assignee identity: the visit's assignee is immutable on
        // svc-workflow rows, and when the wire carries it we compare it
        // exactly against the attempt's ownerPrincipalId (drift ⇒ refused).
        const assignee = findAssigneeOnDetail(probe.body?.detail)
        if (assignee !== undefined && assignee !== attempt.ownerPrincipalId.toLowerCase()) {
          const refused = `assignee_no_longer_current:${assignee}`
          await record.recoveryRefused(authorityRef, refused)
          return { outcome: 'RECOVERY_REFUSED', refused, nodeVisitId, attemptId: attempt.attemptId }
        }
        // E6 — EVERY fresh precondition has now passed (E1–E5): record the
        // governance act, then re-execute resolution FRESH (never the
        // verification read's result — no cache), write-ahead, ONE Run.
        await record.recoveryAuthorized(authorityRef)
        const resolved = await resolvePrincipalToAgent(attempt.ownerPrincipalId)
        if (!resolved.ok) {
          // Identity flapped between verification and execution: the authorized
          // recovery re-blocks the SAME attempt with ZERO Runs (the fresh
          // blocked fact is authorized — it follows its recovery_authorized).
          await record.resolutionBlocked(resolved.code)
          return { outcome: `STILL_BLOCKED:${resolved.code}`, nodeVisitId, attemptId: attempt.attemptId }
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
    return {
      recoverAttempt,
    }
  }
