/**
 * @agent-core/workflow-execution/src/engine.js — the execution engine
 * (WORKFLOW_AGENT_EXECUTION_V1).
 *
 * One thin deterministic loop over the EXISTING seams (nothing here is a
 * second anything):
 *
 *   poll once:
 *     1. reconcile ACTIVE attempts (SETTLED / stays ACTIVE / NEEDS_REVIEW)
 *     2. sweep the due DISPATCH_INTENT feed to exhaustion via keyset
 *        continuation (no page cap; CTR-WAE-001b)
 *     3. per due intent: beginAttemptIfAbsent (the one-attempt fence)
 *        -> resolve canonical assignee (`agent_resolve_principal` authority)
 *        -> router.deliver the execution Run with the trusted
 *           `workflow_execution` messageOrigin sidecar
 *        -> record the NodeVisit -> Attempt -> Run linkage
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

  /**
   * Admit at most one execution Run for one due intent. Every terminal
   * failure after the attempt fence lands as NEEDS_REVIEW (delivery_failed) —
   * never a silent drop, never an automatic second run, never an agent swap.
   */
  async function admitDueIntent(rawIntent) {
    const attemptResult = await ledger.beginAttemptIfAbsent({
      dispatchIntentId: rawIntent.dispatchIntentId,
      nodeVisitId: rawIntent.nodeVisitId,
      workflowInstanceId: rawIntent.workflowInstanceId,
      ownerPrincipalId: rawIntent.ownerPrincipalId,
    }, async (attempt) => {
      try {
        const resolved = await resolvePrincipalToAgent(rawIntent.ownerPrincipalId)
        if (!resolved.ok) return { kind: 'delivery_failed', reason: `resolve_failed:${resolved.code}` }
        const requestId = attempt.attemptId
        const message = buildInstruction({
          workflowInstanceId: attempt.workflowInstanceId,
          nodeVisitId: attempt.nodeVisitId,
          dispatchIntentId: attempt.dispatchIntentId,
          attemptId: attempt.attemptId,
        })
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
   * @returns {Promise<{examined:number, settled:string[], needsReview:string[], running:number}>}
   */
  async function reconcileOnce() {
    const summary = { examined: 0, settled: [], needsReview: [], running: 0 }
    for (const attempt of ledger.listActive()) {
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
