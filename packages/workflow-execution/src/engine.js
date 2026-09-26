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
 * WORKFLOW_STALE_REENTRY_V1 (the ONE scoped successor exception): reconcile
 * additionally settles a delivered attempt as `stale_no_progress` when the
 * positive business evidence chain holds (threshold age + visit still
 * current + instance version unchanged since dispatch + instance active) —
 * a BUSINESS-layer eligibility restoration only. The due sweep then admits
 * the generation N+1 attempt through the same fence, gated by CTR-SRE-004
 * execution-layer quiescence: no re-delivery while the superseded attempt's
 * reconciliation record is still an active unknown (fence stands; C-013/
 * 015/016 discipline is reused, never bypassed). Progress is defined by svc
 * business facts only; nothing renews the stale clock; unknown outcomes
 * never re-run on a timeout alone.
 *
 * Optimistic + conservative per the goal: re-reading and re-polling are
 * always safe (idempotent reads); business consistency stays with
 * svc-workflow's state version / idempotency / transaction; an unknown
 * outcome without positive business evidence NEVER creates a second
 * execution.
 *
 * All I/O is injected: production wiring lives in
 * production-runtime/src/workflow-execution-runtime.js; tests inject fakes.
 */

import { buildExecutionInstruction } from './instruction.js'
import { createRecoveryOperation } from './recovery.js'
import { STALE_NO_PROGRESS_JUDGMENT, DEFAULT_MAX_ATTEMPTS_PER_VISIT } from './ledger.js'
import { normalizeDueIntent, judgeSettleFromDetail, judgeAttempt, judgeDispatchVersionFromDetail, judgeStaleFromDetail } from './judgment.js'

export const DEFAULT_POLL_INTERVAL_MS = 30_000
export const DEFAULT_MAX_ADMISSIONS_PER_POLL = 25

/**
 * WORKFLOW_STALE_REENTRY_V1 CTR-SRE-002: the default stale-acceptance
 * threshold. Configurable via config.staleNoProgressThresholdMs (wiring:
 * env DSH_WORKFLOW_STALE_NO_PROGRESS_MS); the wiring keeps it above the
 * router's turn deadline so `outcome_unknown` is always already marked
 * before any stale evaluation fires.
 */
export const DEFAULT_STALE_NO_PROGRESS_THRESHOLD_MS = 3_600_000

/**
 * WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-004: the policy-driven
 * continuation defaults — the per-visit attempt limit lives on the LEDGER
 * (the fence enforces it); the retry delay gates the run_ended_no_submission
 * fast re-entry class. outcome_unknown never enters it.
 */
export const DEFAULT_RETRY_DELAY_MS = 60_000

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
 *   - WORKFLOW_STALE_REENTRY_V1 r2: the r1 `resolveStaleTurn` router seam was
 *     REMOVED per independent review (a workflow scheduler may never
 *     force-settle an unresolved turn or release its unknown fence —
 *     AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-013/015/016/017 stand untouched).
 *     Generation N+1 delivery instead defers to the existing termination
 *     authorities: it is admitted only when the superseded attempt's
 *     reconciliation record is provably no longer an active unknown
 *     (CTR-SRE-004 quiescence gate — a READ-ONLY check over the existing
 *     getTurnReconciliation / resolveCallerCorrelation seams).
 * @param {({workflowInstanceId:string, nodeVisitId:string, attemptCount:number, lastAttemptId:string, dispatchIntentId:string, reason:string}) =>
 *   Promise<{ok:true, escalated?:boolean, assistanceCaseId?:string}|{ok:false, code:string, detail?:string}>} [deps.escalateAttemptLimit]
 *   - WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-005: the ONE escalation seam
 *     (svc-workflow system execution-escalation ingress). Called at most
 *     once per visit in EFFECT — the ledger escalation fact is the
 *     idempotency marker; a failed call is retried on a later pass.
 * @param {Function} [deps.buildInstruction] - instruction builder (tests).
 * @param {object} [deps.log]
 * @param {Function} [deps.clock]
 * @param {object} [deps.config] - { maxAdmissionsPerPoll, staleNoProgressThresholdMs, retryDelayMs }
 */
export function createWorkflowExecutionEngine({
  ledger,
  fetchDuePage,
  resolvePrincipalToAgent,
  deliverRun,
  getTurnReconciliation,
  resolveCallerCorrelation,
  readInstanceDetail,
  escalateAttemptLimit: escalateAttemptLimitDep,
  buildInstruction = buildExecutionInstruction,
  log = {},
  clock = () => Date.now(),
  config = {},
}) {
  for (const [name, fn] of Object.entries({ ledger, fetchDuePage, resolvePrincipalToAgent, deliverRun, getTurnReconciliation, readInstanceDetail })) {
    if (fn === undefined) throw new TypeError(`workflow-execution: engine dep ${name} is required`)
  }
  const maxAdmissions = config.maxAdmissionsPerPoll ?? DEFAULT_MAX_ADMISSIONS_PER_POLL
  const staleNoProgressThresholdMs = config.staleNoProgressThresholdMs ?? DEFAULT_STALE_NO_PROGRESS_THRESHOLD_MS
  if (!Number.isInteger(staleNoProgressThresholdMs) || staleNoProgressThresholdMs < 1) {
    throw new TypeError(`workflow-execution: config.staleNoProgressThresholdMs must be a positive integer (got ${JSON.stringify(config.staleNoProgressThresholdMs)})`)
  }
  const retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 1) {
    throw new TypeError(`workflow-execution: config.retryDelayMs must be a positive integer (got ${JSON.stringify(config.retryDelayMs)})`)
  }

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
   * CTR-WEC1-005: the ONE attempt-limit escalation per visit. Calls the
   * injected svc seam first; only a successful call records the ledger
   * escalation fact (the idempotency marker — a failed call retries on a
   * later pass; svc replays an already-open case as escalated:false).
   * Never throws into admission/reconcile paths.
   */
  async function escalateAttemptLimit({ attempt, reason }) {
    if (typeof escalateAttemptLimitDep !== 'function') return
    const payload = {
      workflowInstanceId: attempt.workflowInstanceId,
      nodeVisitId: attempt.nodeVisitId,
      attemptCount: attempt.dispatchCount ?? attempt.generation ?? 1,
      lastAttemptId: attempt.attemptId,
      dispatchIntentId: attempt.dispatchIntentId,
      reason,
    }
    try {
      const result = await escalateAttemptLimitDep(payload)
      if (!result?.ok) {
        log.warn?.(`workflow-execution: escalation call failed for ${attempt.nodeVisitId} (${result?.code ?? 'unknown'}) — retried on a later pass`)
        return
      }
      const recorded = await ledger.recordEscalationRequested({
        nodeVisitId: attempt.nodeVisitId,
        reason,
        attemptCount: payload.attemptCount,
        lastAttemptId: payload.lastAttemptId,
        dispatchIntentId: payload.dispatchIntentId,
      })
      if (recorded.committed) {
        log.log?.(`workflow-execution: attempt limit escalated for ${attempt.nodeVisitId} (${reason}; svc case ${result.assistanceCaseId ?? 'n/a'})`)
      }
    } catch (error) {
      log.error?.(`workflow-execution: escalation error for ${attempt.nodeVisitId}: ${error?.message ?? error}`)
    }
  }

  /**
   * Admit at most one execution Run for one due intent. V2 ordering
   * (CTR-WAE-012/013): resolution failure lands the recoverable-blocked live
   * phase (resolution_blocked — ZERO Runs); on success the durable
   * delivery_started write-ahead record is appended BEFORE router.deliver is
   * invoked (no invocation-to-record crash window); every post-invocation
   * failure class stays terminal NEEDS_REVIEW — never a silent drop, never an
   * automatic second run, never an agent swap.
   *
   * CTR-SRE-004 (r2, the quiescence gate): a generation N+1 re-plan is
   * admitted ONLY when the superseded attempt's execution is provably no
   * longer an active unknown — the read-only turn-state lookup must not
   * answer `pending` (C-013: SAME_AGENTPROCESS_NEW_TURN_ADMISSION=FORBIDDEN
   * while unresolved; C-015/C-016: only exact termination evidence ends an
   * unknown). Still-pending ⇒ defer WITHOUT minting anything: the visit keeps
   * its restored re-entry eligibility and the sweep re-checks next poll.
   */
  async function admitDueIntent(rawIntent) {
    const previous = ledger.get(rawIntent.nodeVisitId)
    if (previous !== undefined && previous.state !== 'ACTIVE' && previous.judgment === STALE_NO_PROGRESS_JUDGMENT) {
      const turnState = queryTurnState(previous)
      if (turnState === 'pending') {
        log.warn?.(`workflow-execution: re-entry deferred for ${previous.nodeVisitId} — superseded execution still unresolved (fence stands; C-013); rechecked next sweep`)
        return { action: 'deferred_quiescence', nodeVisitId: rawIntent.nodeVisitId, attemptId: previous.attemptId }
      }
      // CTR-WEC1-004: the fence now refuses generation N+1 past the attempt
      // limit — turn the refusal into the one-time escalation.
      if ((previous.generation ?? 1) >= (ledger.maxAttemptsPerVisit ?? DEFAULT_MAX_ATTEMPTS_PER_VISIT)) {
        if (previous.escalation === undefined) {
          await escalateAttemptLimit({ attempt: previous, reason: 'ATTEMPTS_EXHAUSTED' })
        }
        return { action: 'attempt_limit_reached', nodeVisitId: rawIntent.nodeVisitId, attemptId: previous.attemptId }
      }
    }
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
        // CTR-SRE-002: ONE instance-detail read AS THE TARGET AGENT to record
        // the dispatch-time business baseline. Best-effort: a failed probe
        // leaves the field absent and that attempt is never stale-eligible.
        // The probe reuses the settle-probe seam and runs inside the same
        // locked admission mutation as the delivery itself (the same
        // discipline that already spans router.deliver).
        let workflowStateVersionAtDispatch
        try {
          const read = await readInstanceDetail({ agentId: resolved.agentId, workflowInstanceId: attempt.workflowInstanceId })
          if (read.ok) {
            const judged = judgeDispatchVersionFromDetail({ body: read.body })
            if (judged.ok) workflowStateVersionAtDispatch = judged.version
            else log.warn?.(`workflow-execution: dispatch version probe unusable for ${attempt.nodeVisitId}: ${judged.reason}`)
          } else {
            log.warn?.(`workflow-execution: dispatch version probe failed for ${attempt.nodeVisitId}: ${read.code}`)
          }
        } catch (error) {
          log.warn?.(`workflow-execution: dispatch version probe errored for ${attempt.nodeVisitId}: ${error?.message ?? error}`)
        }
        return {
          kind: 'run_delivered',
          agentId: resolved.agentId,
          requestId,
          sessionId: delivery.sessionId,
          reconciliationHandle: delivery.reconciliationHandle,
          messageId: delivery.messageId,
          ...(workflowStateVersionAtDispatch === undefined ? {} : { workflowStateVersionAtDispatch }),
        }
      } catch (error) {
        return {
          kind: 'delivery_failed',
          reason: `engine_error:${error?.code ?? error?.name ?? 'Error'}:${String(error?.message ?? error).slice(0, 160)}`,
        }
      }
    })
    if (!attemptResult.created) {
      if (attemptResult.cause === 'attempt_limit_reached') {
        // CTR-WEC1-004: the fence refused a past-limit mint (the engine-side
        // pre-check missed it — e.g. a concurrent settle landed between the
        // pre-check and the locked fence). Backstop: escalate once and leave.
        if (attemptResult.attempt.escalation === undefined) {
          await escalateAttemptLimit({ attempt: attemptResult.attempt, reason: 'ATTEMPTS_EXHAUSTED' })
        }
        return { action: 'attempt_limit_reached', nodeVisitId: rawIntent.nodeVisitId, attemptId: attemptResult.attempt.attemptId }
      }
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
   * WORKFLOW_STALE_REENTRY_V1 CTR-SRE-002: evaluate the stale predicate for
   * one delivered attempt that has exceeded the threshold. Pure evidence
   * chain: the age gate is caller-owned; the probe is the instance detail
   * read AS THE TARGET AGENT; any unavailable answer is never stale.
   */
  async function judgeStale(attempt) {
    const read = await readInstanceDetail({ agentId: attempt.delivered.agentId, workflowInstanceId: attempt.workflowInstanceId })
    if (!read.ok) {
      return { kind: 'unavailable', reason: `stale_check_unavailable: instance detail read failed (${read.code})` }
    }
    return judgeStaleFromDetail({ body: read.body, nodeVisitId: attempt.nodeVisitId, workflowStateVersionAtDispatch: attempt.workflowStateVersionAtDispatch })
  }

  /**
   * Commit ONE stale settlement (CAS-guarded). BUSINESS layer only: this
   * restores the visit's re-entry eligibility in the ledger and touches
   * NOTHING in the execution layer — the abandoned turn's reconciliation
   * record and its unknown fence (if any) stay exactly under the existing
   * termination authorities (AGENT_PROCESS_LIFECYCLE_HARDENING_V2
   * C-013/015/016/017); the delivery-time quiescence gate (CTR-SRE-004)
   * decides when a generation N+1 may actually be dispatched.
   * Returns true when THIS caller won the settlement.
   */
  async function settleStale(attempt) {
    const recorded = await ledger.recordStaleSuperseded({
      nodeVisitId: attempt.nodeVisitId,
      expected: { state: attempt.state, phase: attempt.phase, deliveredAtMs: attempt.delivered.atMs },
      observedWorkflowStateVersion: attempt.workflowStateVersionAtDispatch,
    })
    return recorded.committed
  }

  /**
   * Deterministic reconcile over every ACTIVE attempt. Reads are idempotent
   * and repeatable; only a terminal verdict mutates the ledger.
   * V2 CTR-WAE-011 exemption: RESOLUTION_BLOCKED attempts are skipped — they
   * have no Run linkage BY CONSTRUCTION, so the `delivery_unverified` row
   * must never fire on them (it would silently re-create the V1 terminality).
   * V1 CTR-SRE-002/005: delivered attempts past the stale threshold with
   * positive business evidence (visit current + version unchanged + instance
   * active) settle stale and hand the visit back to the due sweep.
   * @returns {Promise<{examined:number, settled:string[], needsReview:string[], running:number, blocked:number, staleReentry:string[]}>}
   */
  async function reconcileOnce() {
    const summary = { examined: 0, settled: [], needsReview: [], running: 0, blocked: 0, staleReentry: [] }
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
          // The run looks alive, but a delivered run past the stale threshold
          // with version-unchanged evidence is the hung-run zombie class:
          // settle stale (its own reconciliation record stays pending
          // forever — nothing else will ever terminalize it). The probe
          // judgment GATES the settlement: progressed/unavailable never
          // settle here.
          if (attempt.phase === 'run_delivered'
            && clock() - attempt.delivered.atMs >= staleNoProgressThresholdMs) {
            const stale = await judgeStale(attempt)
            if (stale.kind === 'stale_confirmed' && await settleStale(attempt)) {
              summary.staleReentry.push(attempt.nodeVisitId)
              await maybeEscalateAtLimit(attempt)
              continue
            }
          }
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
    // CTR-SRE-002 second pass: terminal NEEDS_REVIEW attempts with delivered
    // evidence (run_ended_no_submission / run_outcome_unknown / …). The
    // review existed to answer "did the business commit?" — past the stale
    // threshold, the probe's positive NO (visit still current, version
    // unchanged) supersedes it. ACTIVE candidates from this enumeration were
    // already evaluated in the loop above; only the terminal class remains.
    for (const attempt of await ledger.listStaleCandidatesFresh(staleNoProgressThresholdMs)) {
      if (attempt.state !== 'NEEDS_REVIEW') continue
      try {
        const stale = await judgeStale(attempt)
        if (stale.kind !== 'stale_confirmed') continue
        if (await settleStale(attempt)) {
          summary.staleReentry.push(attempt.nodeVisitId)
          await maybeEscalateAtLimit(attempt)
        }
      } catch (error) {
        log.error?.(`workflow-execution: stale re-entry check error for ${attempt.nodeVisitId}: ${error?.message ?? error}`)
      }
    }
    // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-004: the run_ended_no_submission
    // fast continuation class — the SAME positive business evidence (stale
    // probe) after the retry DELAY (default 60s) instead of the 1h stale
    // clock. run_outcome_unknown never appears in this enumeration; the
    // quiescence gate still fences any re-delivery (CTR-SRE-004 untouched).
    for (const attempt of await ledger.listRunEndedCandidatesFresh(retryDelayMs)) {
      try {
        const stale = await judgeStale(attempt)
        if (stale.kind !== 'stale_confirmed') continue
        if (await settleStale(attempt)) {
          summary.staleReentry.push(attempt.nodeVisitId)
          await maybeEscalateAtLimit(attempt)
        }
      } catch (error) {
        log.error?.(`workflow-execution: run-ended continuation check error for ${attempt.nodeVisitId}: ${error?.message ?? error}`)
      }
    }
    return summary
  }

  /**
   * CTR-WEC1-005: after a stale settlement lands on a visit whose settled
   * generation has already reached the attempt limit, there is no meaningful
   * next generation — escalate once (the ledger fact makes this idempotent;
   * the fence backstop in admitDueIntent covers any race window).
   */
  async function maybeEscalateAtLimit(settledAttempt) {
    if ((settledAttempt.generation ?? 1) < (ledger.maxAttemptsPerVisit ?? DEFAULT_MAX_ATTEMPTS_PER_VISIT)) return
    await escalateAttemptLimit({ attempt: settledAttempt, reason: 'ATTEMPTS_EXHAUSTED' })
  }

  /**
   * One engine pass: reconcile first (older attempts get the head start),
   * then consume the due feed up to the admission bound. Malformed feed
   * records are skipped loudly — never admitted, never silently dropped.
   * Tracked as the engine's in-flight work so stop() can drain it.
   */
  function pollOnce() {
    const running = _pollOnceImpl()
    inflight = running
    return running.finally(() => { if (inflight === running) inflight = null })
  }
  async function _pollOnceImpl() {
    const reconciled = await reconcileOnce()
    const admissions = []
    const skipped = []
    let pages = 0
    let newAttempts = 0
    let boundReached = false
    let boundSkipped = 0
    let cursor
    let drainedEarly = false
    while (true) {
      if (stopped) {
        drainedEarly = true
        break
      }
      const page = await fetchDuePage({
        limit: DUE_PAGE_LIMIT,
        ...(cursor?.afterNextEligibleAt === undefined ? {} : { afterNextEligibleAt: cursor.afterNextEligibleAt }),
        ...(cursor?.afterDispatchIntentId === undefined ? {} : { afterDispatchIntentId: cursor.afterDispatchIntentId }),
      })
      if (!page.ok) {
        return { ok: false, phase: 'list_due_intents', code: page.code, reconciled, admissions, skipped, pages, drainedEarly }
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
          if (result.action !== 'already_attempted' && result.action !== 'deferred_quiescence') newAttempts += 1
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
  let stopped = false
  let inflight = null
  let startupReconcile = null
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
  function trackedTick() {
    // T42 r2: a busy tick starts NO work — the previous poll still owns the
    // drain. Return the active drain promise instead of letting this no-op
    // tick clobber (and instantly clear) the attribution: pre-r2, inflight
    // was overwritten with the busy no-op promise, stop() saw nothing
    // running, and the real poll continued unsupervised past shutdown.
    if (ticking) return inflight ?? Promise.resolve()
    const running = tick()
    inflight = running
    return running.finally(() => { if (inflight === running) inflight = null })
  }

  // THE ONE controlled recovery operation (CTR-WAE-013; control-plane only —
  // never a model tool, never timer/poller/reconcile driven). Lives in
  // recovery.js; wired here over the SAME injected seams as admission.
  const { recoverAttempt } = createRecoveryOperation({
    ledger,
    resolvePrincipalToAgent,
    deliverRun,
    readInstanceDetail,
    resolveCallerCorrelation,
    buildInstruction,
    provenanceFor,
  })

  return {
    pollOnce,
    reconcileOnce,
    admitDueIntent,
    recoverAttempt,
    /**
     * WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-006: push-first kick. ONE
     * coalesced poll trigger — a poll already in flight or armed coalesces
     * (kicks never stack, never bypass the single-flight tick). The poll
     * loop remains the correctness path; a lost kick is invisible.
     */
    kick() {
      if (ticking || inflight !== null) return { ok: true, coalesced: true }
      void trackedTick()
      return { ok: true, kicked: true }
    },
    /** Arm the interval loop (+ one immediate reconcile catch-up). */
    start({ intervalMs = DEFAULT_POLL_INTERVAL_MS, catchup = true } = {}) {
      if (timer !== undefined) return
      if (catchup) {
        // T42 r2: the startup reconcile is drain-owned like any poll pass —
        // tracked so stop() awaits it (pre-r2 it was void fire-and-forget
        // outside drain ownership).
        startupReconcile = reconcileOnce().catch((error) => log.error?.(`workflow-execution: startup reconcile failed: ${error?.message ?? error}`))
        startupReconcile.finally(() => { startupReconcile = null })
      }
      timer = setInterval(() => { void trackedTick() }, intervalMs)
      timer.unref?.()
      log.log?.(`workflow-execution: poll loop armed (intervalMs=${intervalMs})`)
    },
    stop() {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
      stopped = true
      // Bounded drain (CTR — DSH_SHUTDOWN_CONTRACT; r2 per T42): await every
      // outstanding engine operation — the active poll pass AND the startup
      // reconcile (previously void fire-and-forget outside drain ownership).
      // Without either this resolves immediately. Callers that await stop()
      // get a truthful "nothing is still running" result.
      const draining = [inflight, startupReconcile].filter(Boolean)
      if (draining.length) return Promise.all(draining.map((p) => p.catch(() => {})))
      return Promise.resolve()
    },
    snapshot: () => ledger.snapshot(),
  }
}
