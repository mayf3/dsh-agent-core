/**
 * Workflow execution: reconcile, sweep due intents, resolve, write ahead, deliver.
 * WAE V2 owns admission/recovery; SRE V1 requires read-only quiescence before
 * stale re-entry; WEC V1 bounds continuation. Business progress comes only from
 * svc-workflow. Lifecycle cleanup remains Router-owned; UNKNOWN is never replayed.
 * I/O wiring: production-runtime/src/workflow-execution-runtime.js.
 */

import { buildExecutionInstruction } from './instruction.js'
import { createRecoveryOperation } from './recovery.js'
import { STALE_NO_PROGRESS_JUDGMENT, DEFAULT_MAX_ATTEMPTS_PER_VISIT } from './ledger.js'
import { normalizeDueIntent, judgeSettleFromDetail, judgeAttempt, judgeDispatchVersionFromDetail, judgeStaleFromDetail } from './judgment.js'

export const DEFAULT_POLL_INTERVAL_MS = 30_000
export const DEFAULT_MAX_ADMISSIONS_PER_POLL = 25

/** CTR-SRE-002: default stale threshold; production config keeps it above the Router turn deadline. */
export const DEFAULT_STALE_NO_PROGRESS_THRESHOLD_MS = 3_600_000

/** CTR-WEC1-004: fast retry delay for run_ended_no_submission; the ledger owns the attempt cap. */
export const DEFAULT_RETRY_DELAY_MS = 60_000

/** svc-workflow's hard page cap (1..100); a FULL page means "keep sweeping". */
export const DUE_PAGE_LIMIT = 100

/**
 * Injected seams: ledger, keyset due feed, exact Principal resolution, Router
 * delivery/reconciliation/correlation, and target-Agent instance detail reads.
 * Optional escalation is idempotent via the ledger; controlled recovery is
 * authorityRef-gated and never invoked by polling. No lifecycle mutation seam.
 * config: maxAdmissionsPerPoll, staleNoProgressThresholdMs, retryDelayMs.
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
    // Trusted runtime-owned provenance, never model input.
    return Object.freeze({
      kind: 'workflow_execution',
      workflowInstanceId: attempt.workflowInstanceId,
      nodeVisitId: attempt.nodeVisitId,
      attemptId: attempt.attemptId,
    })
  }

  /** CTR-WEC1-005: call svc, then persist the idempotency fact; failed calls retry on a later pass. */
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
        log.log?.(`workflow-execution: owner assistance opened for ${attempt.nodeVisitId} (${reason}; svc case ${result.assistanceCaseId ?? 'n/a'})`)
      }
    } catch (error) {
      log.error?.(`workflow-execution: escalation error for ${attempt.nodeVisitId}: ${error?.message ?? error}`)
    }
  }

  /**
   * CTR-WAE-012/013: resolution may block recoverably, but delivery_started
   * precedes Router invocation and post-invocation failures remain terminal.
   * CTR-SRE-004: unproven quiescence defers before mint, preserving eligibility.
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
        // CTR-SRE-002: best-effort target-Agent dispatch baseline inside the admission lock.
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
    }, hasQuiescentTurn)
    if (!attemptResult.created) {
      if (attemptResult.cause === 'deferred_quiescence') {
        log.warn?.(`workflow-execution: re-entry deferred for ${attemptResult.attempt.nodeVisitId} — execution quiescence unproven (fence stands; C-013); rechecked next sweep`)
        return { action: 'deferred_quiescence', nodeVisitId: rawIntent.nodeVisitId, attemptId: attemptResult.attempt.attemptId }
      }
      if (attemptResult.cause === 'attempt_limit_reached') {
        // CTR-WEC1-004: the fresh locked fence refused a past-limit mint.
        // Escalate once from that exact predecessor and leave.
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

  /** Full reconciliation evidence for a delivered attempt (handle first, then
   *  the exact requestId correlation as the restart-recovery fallback). */
  function queryTurnReconciliation(attempt) {
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
    return result
  }

  function queryTurnState(attempt) {
    return queryTurnReconciliation(attempt)?.state
  }

  // Called under the ledger admission lock, before any generation mint.
  // Settlement may precede registry/fence cleanup. Retain legacy state-only
  // proof and Router's nullable defaults; explicit unknown evidence defers.
  function hasQuiescentTurn(attempt) {
    const result = queryTurnReconciliation(attempt)
    if (result === null || typeof result !== 'object' || Array.isArray(result)
      || !['settled', 'evicted', 'restart_lost', 'never_existed'].includes(result.state)) return false
    const snapshot = result.snapshot
    if (snapshot === undefined) return true
    if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false
    if (snapshot.state !== undefined && snapshot.state !== result.state) return false
    return ['none', 'armed', 'cleared'].includes(snapshot.fenceState ?? 'none')
      && [null, 'settled'].includes(snapshot.recoveryState ?? null)
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

  /** CTR-SRE-002: caller owns the age gate; business evidence comes from the target Agent read. */
  async function judgeStale(attempt) {
    const read = await readInstanceDetail({ agentId: attempt.delivered.agentId, workflowInstanceId: attempt.workflowInstanceId })
    if (!read.ok) {
      return { kind: 'unavailable', reason: `stale_check_unavailable: instance detail read failed (${read.code})` }
    }
    return judgeStaleFromDetail({ body: read.body, nodeVisitId: attempt.nodeVisitId, workflowStateVersionAtDispatch: attempt.workflowStateVersionAtDispatch })
  }

  /** Business-only CAS settlement; Router termination/fences remain untouched (C-013/015/016/017). */
  async function settleStale(attempt) {
    const recorded = await ledger.recordStaleSuperseded({
      nodeVisitId: attempt.nodeVisitId,
      expected: { state: attempt.state, phase: attempt.phase, deliveredAtMs: attempt.delivered.atMs },
      observedWorkflowStateVersion: attempt.workflowStateVersionAtDispatch,
    })
    return recorded.committed
  }

  /** Reconcile ACTIVE attempts; skip resolution_blocked. Only positive business evidence permits stale re-entry. */
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
          // A live-looking stale run requires positive business evidence; never settle on age alone.
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
    // CTR-SRE-002: the terminal run_ended_no_submission class uses the same business probe.
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
    // CTR-WEC1-004: fast continuation uses the retry delay; durable UNKNOWN is excluded.
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

  /** CTR-WEC1-005: escalate once when a stale-settled visit has exhausted its attempt cap. */
  async function maybeEscalateAtLimit(settledAttempt) {
    if ((settledAttempt.generation ?? 1) < (ledger.maxAttemptsPerVisit ?? DEFAULT_MAX_ATTEMPTS_PER_VISIT)) return
    await escalateAttemptLimit({ attempt: settledAttempt, reason: 'ATTEMPTS_EXHAUSTED' })
  }

  /** Reconcile, then sweep due intents; malformed entries fail loudly. stop() drains this work. */
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

  // CTR-WAE-013: explicit control-plane recovery over the same injected seams.
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
    /** CTR-WEC1-006: coalesce kicks with the single-flight poll; a lost kick is harmless. */
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
