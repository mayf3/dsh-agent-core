/**
 * @agent-core/agent-router/src/route-chain.js — the ONE ordered route-attempt
 * chain executor (IMPL V2 CTR-I2-005..015; policy Parent V2 POL-V2-004..012
 * — referenced, never redefined). Entries: onIngress -> runTurnWithRouteChain,
 * Delivery V0 deliver -> admitWithRouteChain, scheduler invokeAgent -> the
 * published router surface. Hop only on (a) proven no-admission inside the
 * closed four-class whitelist or (b) the exact
 * provider_quota_rejected_before_generation class with the COMPLETE
 * POL-V2-006 terminal zero-generation evidence; everything else STOPs
 * fail-loud, no replay. CTR-I2-008 precedence: unsafe/unknown evidence first
 * (flags or captured output), exact terminal quota second (structured quota
 * signal + the authoritative turnExecutionSnapshot bundle or a controlled
 * carrier's explicit proofs), provider taxonomy/message LAST and never
 * alone; a turn/session-phase quota carrier is never initialize/unadmitted,
 * the bare initialize-origin quota keeps the V1 class-2 hop. ONE_LOGICAL_
 * TURN, one hop-consuming deadline, strict = one attempt zero hops. The
 * CTR-I2-015 canary seam lives in route-chain-canary.js (default-off,
 * one-shot, exact-binding; fixture errors + consume-rename seam imported
 * here). Journal: fixed per-attempt/per-turn records, bounded ring, route
 * refs/enums/counts only — never raw errors/tokens/credentials/bodies.
 */

import { resolve } from 'node:path'
import { FAIL_LOUD_PROVIDER_ERRORS } from './process/provider-errors.js'
import { monotonicNowMs } from './process/state-machine.js'
import {
  canaryOutcomeUnknownFixtureError, canaryQuotaFixtureError, createCanarySeam,
} from './route-chain-canary.js'

// Re-exported through this manifest-listed module (single import surface).
export { CANARY_DESCRIPTOR_FILENAME, CANARY_DESCRIPTOR_MODES } from './route-chain-canary.js'

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms).unref?.() })

/** Closed hop whitelist (POL-V2-004 + the independent POL-V2-006 class;
 * the quota class is NOT initialize and never no-admission). */
export const ROUTE_HOP_FAILURE_CLASSES = Object.freeze({
  SPAWN_FAILED_WITHOUT_CHILD: 'spawn_failed_without_child',
  INITIALIZE_PROVIDER_UNAVAILABLE: 'initialize_provider_unavailable',
  SESSION_CREATE_RESUME_REJECTION: 'session_create_resume_rejection',
  TURNQUEUE_NOT_ADMITTED: 'turnqueue_not_admitted',
  PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION: 'provider_quota_rejected_before_generation',
})

/** Closed admissionProven vocabulary (CTR-I2-010 quota marker included). */
export const ROUTE_ADMISSION_PROVEN = Object.freeze({
  PROVEN_NO_ADMISSION: 'proven_no_admission',
  PROVIDER_REQUEST_SENT_GENERATION_NOT_STARTED: 'provider_request_sent_generation_not_started',
})

/** STOP_CHAIN reasons (POL-V2-005 closed set, executor-observable). */
export const ROUTE_STOP_REASONS = Object.freeze({
  OUTCOME_UNKNOWN: 'outcome_unknown',
  TIMEOUT_WITHOUT_PROVEN_TERMINATION: 'timeout_without_proven_termination',
  ADMISSION_ESTABLISHED: 'admission_established',
  POST_ADMISSION_FAILURE: 'post_admission_failure',
  UNKNOWN_FAILURE_CLASS: 'unknown_failure_class',
})

/** Registry startup stages proven to precede any child existence. */
const PRE_CHILD_STARTUP_STAGES = new Set([
  'workspaceBootstrap.ensure', 'resolveWorkspace', 'resolveDshHome',
  'resolveProcessConfig', 'provisionHome', 'processFactory', 'spawn',
])

const PROVIDER_ENV_IDENTITY_KEYS = Object.freeze([
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'NODE_USE_ENV_PROXY',
])

/** CTR-I2-008 precedence 1 flags: any `true` STOPs before quota evidence is
 * considered. Router-constructed carriers only (the controlled fixture);
 * raw provider payloads never cross the provider-error boundary. */
const UNSAFE_EVIDENCE_FLAGS = Object.freeze([
  'partialOutput', 'assistantContent', 'toolCall', 'toolStarted',
  'externalSideEffect', 'transportTimeout', 'outcomeUnknown',
])

/** POL-V2-006 bullet 1: the structured quota-exhausted code or a structured
 * HTTP 429 — message text NEVER qualifies. */
function structuredQuotaSignal(error) {
  return error?.code === 'account_quota_exhausted'
    || error?.httpStatus === 429
    || error?.evidence?.httpStatus === 429
}

/** POL-V2-005: deadline/timeout artifacts without proven termination. */
function transportTimeoutEvidence(error) {
  if (error?.evidence?.transportTimeout === true) return true
  if (error?.code === 'AGENT_PROCESS_RPC_DEADLINE') return true
  if (error?.code === 'AGENT_PROCESS_INITIALIZE_TIMEOUT') return true
  if (error?.code === 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN') return true
  const source = error?.source
  return typeof source === 'string' && /timeout/u.test(source) === true
    || source === 'turn_deadline_exceeded' || source === 'caller_wait_exceeded'
}

/**
 * POL-V2-006 bundle — every predicate PROVEN by one of two closed,
 * Router-trusted sources (never inferred from absence): the authoritative
 * reconciliation snapshot (real 429s) or a controlled carrier's explicit
 * proof fields (the CTR-I2-015 fixture).
 */
function terminalQuotaEvidenceProven(error, turnEvidence) {
  const evidence = error?.evidence
  if (evidence !== null && typeof evidence === 'object') {
    if (UNSAFE_EVIDENCE_FLAGS.some((flag) => evidence[flag] === true)) return false
  }
  if (turnEvidence !== null && typeof turnEvidence === 'object') {
    return turnEvidence.promptReceipt === 'accepted'
      && turnEvidence.reconciledOutcome === 'failed'
      && turnEvidence.outcomeEvidence === 'exact_turn_end_failure'
      && turnEvidence.terminationProven === true
      && turnEvidence.terminationEvidence === 'exact_terminal_then_idle'
      && turnEvidence.finalAssistantOutputAvailable === false
      && (evidence?.promptReceipt === undefined || evidence.promptReceipt === 'accepted')
  }
  if (evidence === null || typeof evidence !== 'object') return false
  return evidence.promptReceipt === 'accepted'
    && evidence.terminationProven === true
    && evidence.outputTokens === 0
    && evidence.partialOutput === false
    && evidence.assistantContent === false
    && evidence.toolCall === false
    && evidence.toolStarted === false
    && evidence.externalSideEffect === false
    && evidence.outcomeUnknown === false
    && evidence.transportTimeout === false
}

/** Reuse identity, with ABSENT normalization; CTR-I2-003 composes this. */
export function canonicalRouteIdentity(processConfig = {}) {
  const subscription = processConfig.subscription
  const providerEnv = processConfig.providerEnv
  return JSON.stringify([
    processConfig.provider ?? null,
    processConfig.model ?? null,
    subscription?.plugin ?? null,
    subscription?.pluginVersion ?? null,
    subscription?.credentialFile === undefined ? 'ABSENT' : resolve(subscription.credentialFile),
    providerEnv === undefined
      ? 'ABSENT'
      : PROVIDER_ENV_IDENTITY_KEYS.map((key) => [key, providerEnv[key] ?? null]),
  ])
}

/**
 * Classify one attempt failure under the CTR-I2-008 precedence; returns a
 * whitelisted failureClass (hop candidate) or a stopReason (STOP_CHAIN).
 * `turnEvidence` = the executor-fetched authoritative post-settlement
 * turnExecutionSnapshot of the failed execution.
 */
export function classifyAttemptFailure(error, turnEvidence) {
  if (error?.envelope === 'not_admitted' || error?.status === 'not_admitted') {
    // Validation/capacity fail or proven pre-send zero-byte rejection.
    return {
      failureClass: ROUTE_HOP_FAILURE_CLASSES.TURNQUEUE_NOT_ADMITTED,
      admissionProven: ROUTE_ADMISSION_PROVEN.PROVEN_NO_ADMISSION,
      stopReason: null,
    }
  }
  if (error?.envelope === 'outcome_unknown' || error?.status === 'outcome_unknown') {
    return { failureClass: null, admissionProven: 'unproven', stopReason: ROUTE_STOP_REASONS.OUTCOME_UNKNOWN }
  }
  const evidence = error?.evidence
  const receiptAccepted = evidence?.promptReceipt === 'accepted'
    || turnEvidence?.promptReceipt === 'accepted'
  // Precedence 1 — unsafe/unknown evidence always wins.
  const unsafeFlagged = UNSAFE_EVIDENCE_FLAGS.some((flag) => evidence?.[flag] === true)
  const outputCaptured = turnEvidence?.finalAssistantOutputAvailable === true
  if (unsafeFlagged || outputCaptured) {
    return receiptAccepted
      ? { failureClass: null, admissionProven: 'admitted', stopReason: ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE }
      : { failureClass: null, admissionProven: 'unproven', stopReason: ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS }
  }
  if (transportTimeoutEvidence(error)) {
    return {
      failureClass: null,
      admissionProven: 'unproven',
      stopReason: ROUTE_STOP_REASONS.TIMEOUT_WITHOUT_PROVEN_TERMINATION,
    }
  }
  // Precedence 2 — the exact terminal pre-generation quota class, on
  // turn/session-phase structured failures only.
  if (error?.envelope === 'failed' && structuredQuotaSignal(error)) {
    if (terminalQuotaEvidenceProven(error, turnEvidence)) {
      return {
        failureClass: ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION,
        admissionProven: ROUTE_ADMISSION_PROVEN.PROVIDER_REQUEST_SENT_GENERATION_NOT_STARTED,
        stopReason: null,
      }
    }
    // Ambiguous quota evidence: STOP fail-closed — never relabeled
    // initialize/no-admission, never the session-rejection class.
    return { failureClass: null, admissionProven: 'unproven', stopReason: ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS }
  }
  if (error?.code === 'AGENT_PROCESS_SPAWN_FAILED' || PRE_CHILD_STARTUP_STAGES.has(error?.startupFailureStage)) {
    return {
      failureClass: ROUTE_HOP_FAILURE_CLASSES.SPAWN_FAILED_WITHOUT_CHILD,
      admissionProven: ROUTE_ADMISSION_PROVEN.PROVEN_NO_ADMISSION,
      stopReason: null,
    }
  }
  // Initialize-phase fail-loud provider errors — bare carriers from ready()
  // (never READY, no prompt attempt): V1 class-2 lifecycle evidence.
  if (evidence === undefined && error?.envelope === undefined && error?.status === undefined
      && FAIL_LOUD_PROVIDER_ERRORS.has(error?.code)) {
    return {
      failureClass: ROUTE_HOP_FAILURE_CLASSES.INITIALIZE_PROVIDER_UNAVAILABLE,
      admissionProven: ROUTE_ADMISSION_PROVEN.PROVEN_NO_ADMISSION,
      stopReason: null,
    }
  }
  if (error?.code === 'AGENT_PROCESS_INITIALIZE_TIMEOUT') {
    return {
      failureClass: null,
      admissionProven: 'unproven',
      stopReason: ROUTE_STOP_REASONS.TIMEOUT_WITHOUT_PROVEN_TERMINATION,
    }
  }
  if (error?.envelope === 'failed' || error?.status === 'failed') {
    if (receiptAccepted) {
      // Admission after the receipt watermark: POL-V2-005.
      return { failureClass: null, admissionProven: 'admitted', stopReason: ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE }
    }
    // Structured terminal rejection at the session/prompt boundary before
    // any receipt: POL-V2-004 class 3.
    return {
      failureClass: ROUTE_HOP_FAILURE_CLASSES.SESSION_CREATE_RESUME_REJECTION,
      admissionProven: ROUTE_ADMISSION_PROVEN.PROVEN_NO_ADMISSION,
      stopReason: null,
    }
  }
  return { failureClass: null, admissionProven: 'unproven', stopReason: ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS }
}


function routeLabel(route) {
  return route?.routeRef ?? (route?.provider !== undefined ? `global:${route.provider}/${route.model}` : 'global')
}

function chainDeadlineError(agentId) {
  return Object.assign(
    new Error(`agent-router: route chain deadline exhausted before admission (agent ${agentId}) — STOP_CHAIN, no fallback`),
    { code: 'AGENT_ROUTE_CHAIN_DEADLINE_EXCEEDED', envelope: 'chain_deadline_exceeded' },
  )
}

/**
 * Create the unified chain executor. `log` = structured journal surface;
 * `ensureRunningForRoute` = registry route gate; `resolveRouteChain` =
 * (agentId) => immutable snapshot (absent => length-1 legacy passthrough,
 * byte-equivalent today); `resolveTurnDeadlineMs` = the single per-turn
 * budget; `canaryRuntimeRoot` = the CTR-I2-015 runtime root (absent =>
 * seam disabled); `journalMaxEntries` = bounded ring size.
 */
export function createRouteChainExecutor({
  log, ensureRunningForRoute, resolveRouteChain, resolveTurnDeadlineMs,
  canaryRuntimeRoot, journalMaxEntries = 256,
}) {
  if (typeof ensureRunningForRoute !== 'function') {
    throw new TypeError('agent-router: route chain executor requires ensureRunningForRoute')
  }
  const journal = []
  const canarySeam = typeof canaryRuntimeRoot === 'string' && canaryRuntimeRoot !== ''
    ? createCanarySeam({ runtimeRoot: canaryRuntimeRoot, log })
    : null
  const pendingObservers = new Map() // pending canary observers by nonce

  function record(entry) {
    journal.push(entry)
    if (journal.length > journalMaxEntries) journal.shift()
    log.log?.(`route-chain ${JSON.stringify(entry)}`)
  }

  function defaultSnapshot(agentId) {
    return Object.freeze({
      agentId,
      override: false,
      chainId: 'single-route',
      routes: Object.freeze([Object.freeze({ routeRef: null, identity: undefined, processConfig: undefined })]),
    })
  }

  /** Authoritative post-settlement turn evidence from the published
   * AgentProcess surface (read-only; the store settles before the carrier
   * rejects, so the snapshot is already final here). */
  function authoritativeTurnEvidence(proc, error) {
    const handle = error?.reconciliationHandle
    if (typeof handle !== 'string' || handle === '' || typeof proc?.turnExecutionSnapshot !== 'function') {
      return undefined
    }
    try {
      return proc.turnExecutionSnapshot(handle)
    } catch {
      return undefined
    }
  }

  /** Bounded convergence wait: busy-mismatched or reaping slots retry inside
   * the single deadline budget (busy processes are never killed). */
  async function acquire(agentId, route, deadlineMono) {
    for (;;) {
      const outcome = await ensureRunningForRoute(agentId, {
        routeIdentity: route.identity,
        processConfig: route.processConfig,
      })
      if (outcome.status === 'ready') return outcome.proc
      if (monotonicNowMs() >= deadlineMono) throw chainDeadlineError(agentId)
      await sleep(50)
    }
  }

  async function executeChain(mode, agentId, { sessionId, message, opts, deadlineMs, strictReason }) {
    let snapshot
    try {
      snapshot = (typeof resolveRouteChain === 'function' ? resolveRouteChain(agentId) : undefined)
        ?? defaultSnapshot(agentId)
    } catch (cause) {
      // Config invalid at the process-boundary snapshot: fail loud with zero
      // attempts (the final block keeps the turn-level journal truthful).
      record({
        kind: 'route_chain_final', tsWallMs: Date.now(), agentId,
        routeChainId: 'invalid', primaryRoute: 'NONE', finalRoute: 'NONE',
        finalOutcome: 'stop:unknown_failure_class', totalRouteAttempts: 0,
        fallbackActivated: false, fallbackRoute: null, configInvalid: true,
      })
      throw cause
    }
    const strict = strictReason !== undefined
    const routes = strict ? [snapshot.routes[0]] : snapshot.routes
    const chainId = strict ? `${snapshot.chainId}#strict` : snapshot.chainId
    const deadlineMono = monotonicNowMs() + Math.max(1, deadlineMs ?? resolveTurnDeadlineMs?.(agentId) ?? 300_000)
    const primaryRoute = routeLabel(snapshot.routes[0])
    let dispatchNotified = false
    const notifyDispatchOnce = () => {
      if (dispatchNotified) return
      dispatchNotified = true
      try {
        opts?.onDispatch?.()
      } catch { /* caller evidence callback must never break the turn */ }
    }
    let fallbackRouteUsed = null
    let fallbackActivated = false

    // CTR-I2-015: consume the descriptor at every logical-turn entry, before
    // any acquire; binding needs authenticated feishu ingress metadata.
    let canary = null
    if (canarySeam !== null) {
      const bound = await canarySeam.bind({
        agentId,
        primaryRouteRef: snapshot.routes[0]?.routeRef ?? null,
        channel: opts?.ingressContext?.channelNamespace,
        senderOpenId: opts?.ingressContext?.feishuSenderOpenId,
        message,
      })
      if (bound.status === 'injected') canary = bound.descriptor
    }
    const observer = canary === null ? null : {
      nonce: canary.nonce,
      mode: canary.mode,
      providerDispatchCount: 0,
      modelCallStartCount: 0,
      providerRetryCount: 0,
      onStartCount: 0,
      onDispatchCount: 0,
      transcriptCount: 0,
      injectionConsumeCount: 1,
    }
    const settleObserver = (terminalOutcome) => {
      if (observer === null) return
      observer.transcriptCount = 1
      observer.onStartCount = observer.providerDispatchCount > 0 ? 1 : 0
      observer.onDispatchCount = dispatchNotified ? 1 : 0
      pendingObservers.set(observer.nonce, { ...observer, terminalOutcome })
      // Non-surface durable audit line — never a route-journal record.
      log.log?.(`route-chain-canary-observer ${JSON.stringify({ ...observer, terminalOutcome })}`)
    }

    for (let attemptIndex = 0; attemptIndex < routes.length; attemptIndex += 1) {
      const route = routes[attemptIndex]
      const label = routeLabel(route)
      const canaryFixtureAttempt = canary !== null && attemptIndex === 0
      let proc
      try {
        if (canaryFixtureAttempt && canary.mode === 'outcome_unknown') {
          // Pre-acquire STOP carrier (CANARY-C): zero acquire, zero new
          // generation, zero dispatch.
          throw canaryOutcomeUnknownFixtureError(canary)
        }
        proc = await acquire(agentId, route, deadlineMono)
        if (mode === 'turn') {
          notifyDispatchOnce()
          if (observer !== null) observer.providerDispatchCount += 1
        }
        if (canaryFixtureAttempt && canary.mode === 'provider_quota_rejected_before_generation') {
          // Acquire/dispatch boundary crossed; the fixture now returns the
          // fixed terminal 429 BEFORE any generation — no network call.
          throw canaryQuotaFixtureError(canary)
        }
        if (observer !== null) observer.modelCallStartCount += 1
        const remainingMs = Math.max(1, deadlineMono - monotonicNowMs())
        const result = mode === 'turn'
          ? await proc.turn(sessionId, message, opts, remainingMs)
          : await proc.deliver(sessionId, message, opts)
        record({
          kind: 'route_attempt', tsWallMs: Date.now(), routeChainId: chainId, agentId,
          attemptIndex, route: label, primaryRoute,
          failureClass: 'NONE', admissionProven: 'admitted', attemptOutcome: 'success',
          ...(strict ? { strictReason } : {}),
        })
        record({
          kind: 'route_chain_final', tsWallMs: Date.now(), routeChainId: chainId, agentId,
          primaryRoute, finalRoute: label, finalOutcome: 'SUCCESS',
          totalRouteAttempts: attemptIndex + 1, fallbackActivated, fallbackRoute: fallbackRouteUsed,
          ...(strict ? { strictReason } : {}),
        })
        settleObserver('success')
        return {
          ...result, pid: proc.pid, routeRef: route.routeRef ?? null, routeChainId: chainId,
          ...(canary === null ? {} : { canaryNonce: canary.nonce }),
        }
      } catch (error) {
        // The authoritative snapshot bundle backs the real turn-phase quota
        // carrier; fixture carriers carry explicit proofs.
        const turnEvidence = authoritativeTurnEvidence(proc, error)
        const verdict = classifyAttemptFailure(error, turnEvidence)
        const nextRouteExists = attemptIndex + 1 < routes.length
        const budgetRemains = monotonicNowMs() < deadlineMono
        const hopAllowed = verdict.failureClass !== null && nextRouteExists && budgetRemains
        record({
          kind: 'route_attempt', tsWallMs: Date.now(), routeChainId: chainId, agentId,
          attemptIndex, route: label, primaryRoute,
          failureClass: verdict.failureClass ?? 'NONE',
          admissionProven: verdict.admissionProven,
          attemptOutcome: verdict.failureClass !== null
            ? (hopAllowed ? `fallback:${verdict.failureClass}` : verdict.failureClass)
            : `stop:${verdict.stopReason}`,
          ...(strict ? { strictReason } : {}),
        })
        if (!hopAllowed) {
          const finalOutcome = verdict.failureClass !== null && !budgetRemains
            ? `stop:${ROUTE_STOP_REASONS.TIMEOUT_WITHOUT_PROVEN_TERMINATION}`
            : verdict.failureClass !== null
              ? verdict.failureClass
              : `stop:${verdict.stopReason}`
          record({
            kind: 'route_chain_final', tsWallMs: Date.now(), routeChainId: chainId, agentId,
            primaryRoute, finalRoute: 'NONE', finalOutcome,
            totalRouteAttempts: attemptIndex + 1, fallbackActivated, fallbackRoute: fallbackRouteUsed,
            ...(strict ? { strictReason } : {}),
          })
          settleObserver(finalOutcome)
          if (error instanceof Error && error.routeChain === undefined) {
            error.routeChain = Object.freeze({
              routeChainId: chainId, totalRouteAttempts: attemptIndex + 1,
              finalOutcome, failureClass: verdict.failureClass,
              ...(canary === null ? {} : { canaryNonce: canary.nonce }),
            })
          }
          if (error instanceof Error && canary !== null && error.canaryNonce === undefined) {
            error.canaryNonce = canary.nonce
          }
          throw error
        }
        fallbackActivated = true
        fallbackRouteUsed = routeLabel(routes[attemptIndex + 1])
      }
    }
    // Unreachable: the loop returns on success and rethrows on the last hop.
    throw new Error('agent-router: route chain executor fell through its route list')
  }

  return {
    /** Sync-turn variant (onIngress + scheduler invokeAgent). */
    runTurnWithRouteChain(agentId, args) {
      return executeChain('turn', agentId, args)
    },
    /** Async-admission variant (Delivery V0 `deliver` + notification ingress). */
    admitWithRouteChain(agentId, args) {
      return executeChain('deliver', agentId, args)
    },
    /**
     * CTR-I2-015 external-delivery lifecycle point: the ingress layer calls
     * this after sending the turn's (success or failure) reply; one bounded
     * structured line per delivery attempt, duplicates stay visible.
     */
    noteCanaryExternalDelivery(nonce) {
      if (typeof nonce !== 'string' || nonce === '') return
      const pending = pendingObservers.get(nonce)
      if (pending === undefined) return
      pending.externalDeliveryCount = (pending.externalDeliveryCount ?? 0) + 1
      log.log?.(`route-chain-canary-delivery ${JSON.stringify({ nonce, externalDeliveryCount: pending.externalDeliveryCount })}`)
      if (pending.externalDeliveryCount >= 1) pendingObservers.delete(nonce)
    },
    /** Test/ops: bounded journal ring snapshot (structured evidence). */
    journalSnapshot() {
      return journal.map((entry) => ({ ...entry }))
    },
  }
}
