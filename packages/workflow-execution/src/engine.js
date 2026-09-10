/**
 * @agent-core/workflow-execution/src/engine.js — the execution engine
 * (WORKFLOW_AGENT_EXECUTION_V2; whole-authority successor of V1).
 *
 * One thin deterministic loop over the EXISTING seams (nothing here is a
 * second anything):
 *
 *   poll once:
 *     1. reconcile ACTIVE attempts (SETTLED / stays ACTIVE / NEEDS_REVIEW;
 *        RESOLUTION_BLOCKED attempts are exempt — CTR-WAE-011)
 *     2. sweep the due DISPATCH_INTENT feed to exhaustion via keyset
 *        continuation (no page cap; CTR-WAE-001b)
 *     3. per due intent: beginAttemptIfAbsent (the one-attempt fence)
 *        -> resolve canonical assignee (`agent_resolve_principal` authority;
 *           failure lands the recoverable-blocked live phase, CTR-WAE-011)
 *        -> durable delivery_started WRITE-AHEAD record (CTR-WAE-012/013)
 *        -> router.deliver the execution Run with the trusted
 *           `workflow_execution` messageOrigin sidecar
 *        -> record the NodeVisit -> Attempt -> Run linkage
 *
 * plus the ONE controlled recovery operation (CTR-WAE-013 recoverAttempt):
 * explicit, authorityRef-gated, control-plane-only — no retry engine, no
 * timer, no model-facing surface, never invoked by the poller or reconcile.
 *
 * Optimistic + conservative per the goal: re-reading and re-polling are
 * always safe (idempotent reads); DSH never schedules a second attempt for
 * the same NodeVisit; business consistency stays with svc-workflow's state
 * version / idempotency / transaction; an unknown outcome or an unknown
 * external side effect NEVER creates a second execution — it lands in
 * NEEDS_REVIEW for HR/human coordination.
 *
 * All I/O is injected: production wiring lives in
 * production-runtime/src/workflow-execution-runtime.js; tests inject fakes.
 */

import { buildExecutionInstruction } from './instruction.js'
import { normalizeDueIntent, judgeSettleFromDetail, judgeAttempt } from './judgment.js'

export const DEFAULT_POLL_INTERVAL_MS = 30_000
export const DEFAULT_MAX_ADMISSIONS_PER_POLL = 25

/** svc-workflow's hard page cap (1..100); a FULL page means "keep sweeping". */
export const DUE_PAGE_LIMIT = 100

/**
 * @param {object} deps
 * @param {object} deps.ledger - ExecutionLedger.
 * @param {({limit:number, afterNextEligibleAt?:string, afterDispatchIntentId?:string}) =>
 *   Promise<{ok:true, items:unknown[]}|{ok:false, code:string, detail?:string}>} deps.fetchDuePage
 *   - ONE page of the due feed in its stable (nextEligibleAt, dispatchIntentId)
 *     order; a page with fewer items than `limit` means exhaustion. Both-or-
 *     neither cursor propagation is this engine's job (it only ever sends
 *     the exact strings it received).
 * @param {(principalId: string) => Promise<{ok:true, agentId:string}|{ok:false, code:string, detail?:string}>} deps.resolvePrincipalToAgent
 * @param {(req: {requestId:string, agentId:string, message:string, messageOrigin:object}) =>
 *   Promise<{ok:true, sessionId:string, reconciliationHandle?:string, messageId?:string}|{ok:false, code:string, detail?:string}>} deps.deliverRun
 * @param {(handle:string) => {state:string}} deps.getTurnReconciliation - Router reconciliation record state.
 * @param ({requestId:string}) => {state:string, handle?:string}} [deps.resolveCallerCorrelation]
 * @param ({agentId:string, workflowInstanceId:string}) => Promise<{ok:true, body:object}|{ok:false, code:string, detail?:string}>} deps.readInstanceDetail
 * @param {Function} [deps.buildInstruction] - instruction builder (tests).
 * @param {object} [deps.log]
 * @param {Function} [deps.clock]
 * @param {object} [deps.config] - { maxAdmissionsPerPoll }
 */
export function createWorkflowExecutionEngine({
  ledger,
  fetchDuePage,
  resolvePrincipalToAgent,
  deliverRun,
  getTurnReconciliation,
  resolveCallerCorrelation,
  readInstanceDetail,
  buildInstruction = buildExecutionInstruction,
  log = {},
  clock = () => Date.now(),
  config = {},
}) {
  for (const [name, fn] of Object.entries({ ledger, fetchDuePage, resolvePrincipalToAgent, deliverRun, getTurnReconciliation, readInstanceDetail })) {
    if (fn === undefined) throw new TypeError(`workflow-execution: engine dep ${name} is required`)
  }
  const maxAdmissions = config.maxAdmissionsPerPoll ?? DEFAULT_MAX_ADMISSIONS_PER_POLL

  function provenanceFor(attempt) {
    // The trusted control-plane sidecar: runtime-owned workflow execution
    // provenance riding the admission opts — never model input, never the
    // agent's own claim. Exact-allowlisted by the Router and the session seam.
    return Object.freeze({
      kind: 'workflow_execution',
      workflowInstanceId: attempt.workflowInstanceId,
      nodeVisitId: attempt.nodeVisitId,
      attemptId: attempt.attemptId,
    })
  }

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
   * Admit at most one execution Run for one due intent. V2 ordering
   * (CTR-WAE-012/013): resolution failure lands the recoverable-blocked live
   * phase (resolution_blocked — ZERO Runs); on success the durable
   * delivery_started write-ahead record is appended BEFORE router.deliver is
   * invoked (no invocation-to-record crash window); every post-invocation
   * failure class stays terminal NEEDS_REVIEW — never a silent drop, never an
   * automatic second run, never an agent swap.
   */
  async function admitDueIntent(rawIntent) {
    const attemptResult = await ledger.beginAttemptIfAbsent({
      dispatchIntentId: rawIntent.dispatchIntentId,
      nodeVisitId: rawIntent.nodeVisitId,
      workflowInstanceId: rawIntent.workflowInstanceId,
      ownerPrincipalId: rawIntent.ownerPrincipalId,
    }, async (attempt, { recordDeliveryStarted }) => {
      try {
        const resolved = await resolvePrincipalToAgent(rawIntent.ownerPrincipalId)
        if (!resolved.ok) return { kind: 'resolution_blocked', code: resolved.code }
        const requestId = attempt.attemptId
        const message = buildInstruction({
          workflowInstanceId: attempt.workflowInstanceId,
          nodeVisitId: attempt.nodeVisitId,
          dispatchIntentId: attempt.dispatchIntentId,
          attemptId: attempt.attemptId,
        })
        // THE write-ahead fence: durable before ANY router.deliver call, so a
        // crash after the invocation can never look like "never invoked".
        recordDeliveryStarted()
        const delivery = await deliverRun({
          requestId,
          agentId: resolved.agentId,
          message,
          messageOrigin: provenanceFor(attempt),
        })
        if (!delivery.ok) return { kind: 'delivery_failed', reason: `delivery_rejected:${delivery.code}` }
        return {
          kind: 'run_delivered',
          agentId: resolved.agentId,
          requestId,
          sessionId: delivery.sessionId,
          reconciliationHandle: delivery.reconciliationHandle,
          messageId: delivery.messageId,
        }
      } catch (error) {
        return {
          kind: 'delivery_failed',
          reason: `engine_error:${error?.code ?? error?.name ?? 'Error'}:${String(error?.message ?? error).slice(0, 160)}`,
        }
      }
    })
    if (!attemptResult.created) {
      return { action: 'already_attempted', nodeVisitId: rawIntent.nodeVisitId, attemptId: attemptResult.attempt.attemptId }
    }
    const attempt = attemptResult.attempt
    if (attemptResult.completion.kind === 'delivery_failed') {
      return { action: 'needs_review', nodeVisitId: attempt.nodeVisitId, attemptId: attempt.attemptId, reason: attempt.reason }
    }
    if (attemptResult.completion.kind === 'resolution_blocked') {
      return { action: 'blocked', nodeVisitId: attempt.nodeVisitId, attemptId: attempt.attemptId, code: attempt.blockedCode }
    }
    return { action: 'admitted', nodeVisitId: attempt.nodeVisitId, attemptId: attempt.attemptId, agentId: attempt.delivered.agentId, sessionId: attempt.delivered.sessionId }
  }

  /** Turn reconciliation state for a delivered attempt (handle first, then
   *  the exact requestId correlation as the restart-recovery fallback). */
  function queryTurnState(attempt) {
    const delivered = attempt.delivered
    if (delivered === undefined) return undefined
    let result
    if (typeof delivered.reconciliationHandle === 'string') {
      try { result = getTurnReconciliation(delivered.reconciliationHandle) } catch { result = undefined }
    }
    if ((result === undefined || ['evicted', 'restart_lost', 'never_existed'].includes(result?.state))
      && typeof resolveCallerCorrelation === 'function') {
      try {
        const correlated = resolveCallerCorrelation({ requestId: delivered.requestId })
        if (correlated?.state !== undefined && correlated.state !== 'never_existed') result = correlated
      } catch { /* keep the primary answer */ }
    }
    return result?.state
  }

  /** ONE authoritative settle probe: the instance detail read AS THE TARGET
   *  AGENT (its own canonical Principal; see judgment.js invariant). */
  async function probeSettle(attempt) {
    const read = await readInstanceDetail({ agentId: attempt.delivered.agentId, workflowInstanceId: attempt.workflowInstanceId })
    if (!read.ok) {
      return { kind: 'unavailable', reason: `settle_check_unavailable: instance detail read failed (${read.code})` }
    }
    return judgeSettleFromDetail({ body: read.body, nodeVisitId: attempt.nodeVisitId })
  }

  /**
   * Deterministic reconcile over every ACTIVE attempt. Reads are idempotent
   * and repeatable; only a terminal verdict mutates the ledger.
   * V2 CTR-WAE-011 exemption: RESOLUTION_BLOCKED attempts are skipped — they
   * have no Run linkage BY CONSTRUCTION, so the `delivery_unverified` row
   * must never fire on them (it would silently re-create the V1 terminality).
   * @returns {Promise<{examined:number, settled:string[], needsReview:string[], running:number, blocked:number}>}
   */
  async function reconcileOnce() {
    const summary = { examined: 0, settled: [], needsReview: [], running: 0, blocked: 0 }
    // Cross-process failover must not reconcile a cached projection. Refresh
    // under the ledger's existing OwnerLock before enumerating this pass.
    for (const attempt of await ledger.listActiveFresh()) {
      if (attempt.phase === 'resolution_blocked') {
        summary.blocked += 1
        continue
      }
      summary.examined += 1
      try {
        const turnState = queryTurnState(attempt)
        const verdict = judgeAttempt(attempt, { turnState })
        if (verdict.state === 'ACTIVE') {
          summary.running += 1
          continue
        }
        // Terminal turn/lost linkage needs the settle probe; the
        // delivery_unverified verdict does not (there is nothing to probe).
        const settle = turnState !== undefined ? await probeSettle(attempt) : undefined
        const finalVerdict = settle !== undefined ? judgeAttempt(attempt, { turnState, settle }) : verdict
        if (finalVerdict.state === 'ACTIVE') {
          summary.running += 1
          continue
        }
        const recorded = await ledger.recordReconciled({
          nodeVisitId: attempt.nodeVisitId,
          expectedPhase: attempt.phase,
          verdict: finalVerdict.state,
          judgment: finalVerdict.judgment,
          reason: finalVerdict.reason,
        })
        if (!recorded.committed) {
          if (recorded.attempt.state === 'ACTIVE') summary.running += 1
          continue
        }
        if (finalVerdict.state === 'SETTLED') summary.settled.push(attempt.nodeVisitId)
        else summary.needsReview.push(attempt.nodeVisitId)
      } catch (error) {
        log.error?.(`workflow-execution: reconcile error for ${attempt.nodeVisitId}: ${error?.message ?? error}`)
      }
    }
    return summary
  }

  /**
   * One engine pass: reconcile first (older attempts get the head start),
   * then consume the due feed up to the admission bound. Malformed feed
   * records are skipped loudly — never admitted, never silently dropped.
   */
  async function pollOnce() {
    const reconciled = await reconcileOnce()
    const admissions = []
    const skipped = []
    let pages = 0
    let newAttempts = 0
    let boundReached = false
    let boundSkipped = 0
    let cursor
    while (true) {
      const page = await fetchDuePage({
        limit: DUE_PAGE_LIMIT,
        ...(cursor?.afterNextEligibleAt === undefined ? {} : { afterNextEligibleAt: cursor.afterNextEligibleAt }),
        ...(cursor?.afterDispatchIntentId === undefined ? {} : { afterDispatchIntentId: cursor.afterDispatchIntentId }),
      })
      if (!page.ok) {
        return { ok: false, phase: 'list_due_intents', code: page.code, reconciled, admissions, skipped, pages }
      }
      pages += 1
      const items = Array.isArray(page.items) ? page.items : []
      const exhausted = items.length < DUE_PAGE_LIMIT
      for (const raw of items) {
        const normalized = normalizeDueIntent(raw)
        if (!normalized.ok) {
          skipped.push({ reason: normalized.reason })
          log.warn?.(`workflow-execution: skipped malformed due record (${normalized.reason})`)
          continue
        }
        if (newAttempts >= maxAdmissions) {
          boundReached = true
          boundSkipped += 1
          continue
        }
        try {
          const result = await admitDueIntent(normalized.intent)
          admissions.push(result)
          if (result.action !== 'already_attempted') newAttempts += 1
        } catch (error) {
          log.error?.(`workflow-execution: admission error: ${error?.message ?? error}`)
          admissions.push({ action: 'engine_error', error: String(error?.message ?? error) })
          newAttempts += 1
        }
      }
      if (exhausted) break
      const last = items[items.length - 1]
      if (last === null || typeof last !== 'object'
        || typeof last.nextEligibleAt !== 'string' || last.nextEligibleAt === ''
        || typeof last.dispatchIntentId !== 'string' || last.dispatchIntentId === '') {
        log.error?.('workflow-execution: due-feed cursor protocol violation (full page without a well-formed last record) — sweep stopped')
        return { ok: false, phase: 'due_feed_cursor', code: 'cursor_protocol_violation', reconciled, admissions, skipped, pages }
      }
      const nextCursor = {
        afterNextEligibleAt: last.nextEligibleAt,
        afterDispatchIntentId: last.dispatchIntentId,
      }
      if (cursor !== undefined
        && nextCursor.afterNextEligibleAt === cursor.afterNextEligibleAt
        && nextCursor.afterDispatchIntentId === cursor.afterDispatchIntentId) {
        log.error?.('workflow-execution: due-feed cursor did not advance (identical full page repeated) — sweep stopped loud; is the svc-workflow keyset continuation deployed?')
        return { ok: false, phase: 'due_feed_cursor', code: 'cursor_not_advancing', reconciled, admissions, skipped, pages }
      }
      cursor = nextCursor
    }
    if (boundReached) {
      log.warn?.(`workflow-execution: admission bound (${maxAdmissions}) reached; ${boundSkipped} due intents left unadmitted — they stay due and are re-discovered next sweep`)
    }
    return { ok: true, reconciled, admissions, skipped, pages }
  }

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
        // E6 — fresh preconditions all passed; record the governance act
        // FIRST, then re-execute (resolution is always fresh, never cached).
        await record.recoveryAuthorized(authorityRef)
        const resolved = await resolvePrincipalToAgent(attempt.ownerPrincipalId)
        if (!resolved.ok) {
          // The designed interim behavior while identity is unrepaired: the
          // authorized recovery re-blocks the SAME attempt with ZERO Runs.
          await record.resolutionBlocked(resolved.code)
          return { outcome: `STILL_BLOCKED:${resolved.code}`, nodeVisitId, attemptId: attempt.attemptId }
        }
        // E5 — world verification IN THE RESOLVED AGENT'S CONTEXT (the only
        // mechanically decidable view; a poller view cannot see visit
        // currency). Drift or unreadable state ⇒ refused ⇒ terminal.
        const probe = await readInstanceDetail({ agentId: resolved.agentId, workflowInstanceId: attempt.workflowInstanceId })
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
        // E6 — world intact: write-ahead fence, then at most ONE Run.
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

  // ── interval runner (mirrors the scheduler's single-flight tick) ────────
  let timer
  let ticking = false
  async function tick() {
    if (ticking) return
    ticking = true
    try {
      const result = await pollOnce()
      if (!result.ok) {
        log.warn?.(`workflow-execution: poll pass failed at ${result.phase} (${result.code}) — will retry next tick`)
      }
    } catch (error) {
      log.error?.(`workflow-execution: poll tick failed: ${error?.message ?? error}`)
    } finally {
      ticking = false
    }
  }

  return {
    pollOnce,
    reconcileOnce,
    admitDueIntent,
    /** THE ONE controlled recovery operation (CTR-WAE-013; control-plane
     *  only — never a model tool, never timer/poller/reconcile driven). */
    recoverAttempt,
    /** Arm the interval loop (+ one immediate reconcile catch-up). */
    start({ intervalMs = DEFAULT_POLL_INTERVAL_MS, catchup = true } = {}) {
      if (timer !== undefined) return
      if (catchup) void reconcileOnce().catch((error) => log.error?.(`workflow-execution: startup reconcile failed: ${error?.message ?? error}`))
      timer = setInterval(() => { void tick() }, intervalMs)
      timer.unref?.()
      log.log?.(`workflow-execution: poll loop armed (intervalMs=${intervalMs})`)
    },
    stop() {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    },
    snapshot: () => ledger.snapshot(),
  }
}
