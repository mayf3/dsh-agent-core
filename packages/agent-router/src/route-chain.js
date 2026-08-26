/**
 * @agent-core/agent-router/src/route-chain.js — the ONE ordered route-attempt
 * chain executor (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1 CTR-IMPL-002…
 * CTR-IMPL-008; policy authority AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
 * CTR-003…CTR-009 — semantics are referenced, never redefined here).
 *
 * All three process-admission entries run through this single seam:
 *
 *   onIngress               -> runTurnWithRouteChain (sync turn)
 *   deliver (V0 admission)  -> admitWithRouteChain   (async admission)
 *   scheduler invokeAgent   -> runTurnWithRouteChain (sync turn, published
 *                              router surface; the bridge never imports
 *                              executor internals)
 *
 * Per route attempt: route-aware reuse gate (DEC-IMPL-004, registry seam) →
 * (if needed) new-generation spawn → initialize → session create/resume →
 * admission. A hop to the next route happens ONLY when the failed attempt is
 * PROVEN no-admission AND its failure class is inside the closed four-class
 * whitelist (parent CTR-004). Everything else — outcome_unknown, timeouts
 * without termination proof, post-admission failures, unknown classes —
 * STOPs the chain fail-loud with no replay (parent CTR-005).
 *
 * ONE_LOGICAL_TURN (parent CTR-006): exactly one external turn result, one
 * receipt, one delivery — hops only cross proven-no-admission boundaries.
 * Single deadline budget for the whole chain (DEC-IMPL-007): hops consume
 * the entry's one deadline; no per-hop refresh. Explicit model requests run
 * STRICT_CHAIN_MODE — exactly one attempt, zero hops (DEC-IMPL-005; the
 * model string itself stays opaque, no model→route resolution exists).
 *
 * Journal (parent CTR-008 / DEC-IMPL-006): one structured record per attempt
 * plus one final block per turn, on the existing structured log surface with
 * a bounded in-memory ring — no new persistent store. Records carry only
 * route refs, closed enums and counts; raw provider errors, tokens,
 * credentials, Authorization headers, response bodies and prompt bodies are
 * never journaled (redaction boundary unchanged).
 */

import { FAIL_LOUD_PROVIDER_ERRORS } from './process/provider-errors.js'
import { monotonicNowMs } from './process/state-machine.js'

/** Closed four-class hop whitelist (parent CTR-004; additions require a
 * parent-Spec amendment — this layer never invents failure classes). */
export const ROUTE_HOP_FAILURE_CLASSES = Object.freeze({
  SPAWN_FAILED_WITHOUT_CHILD: 'spawn_failed_without_child',
  INITIALIZE_PROVIDER_UNAVAILABLE: 'initialize_provider_unavailable',
  SESSION_CREATE_RESUME_REJECTION: 'session_create_resume_rejection',
  TURNQUEUE_NOT_ADMITTED: 'turnqueue_not_admitted',
})

/** STOP_CHAIN reasons (parent CTR-005 nine-class closed set, mechanically
 * collapsed to the stop families this executor can observe). */
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

const sleep = (ms) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms)
  timer.unref?.()
})

/**
 * DEC-IMPL-004 reuse-gate identity: the five-field canonical form of one
 * resolved route's process config (provider, model, plugin, pluginVersion,
 * canonical providerEnv). Stable pure stringification — providerEnv absent
 * normalizes to an explicit 'ABSENT' marker.
 */
export function canonicalRouteIdentity(processConfig = {}) {
  const subscription = processConfig.subscription
  const providerEnv = processConfig.providerEnv
  return JSON.stringify([
    processConfig.provider ?? null,
    processConfig.model ?? null,
    subscription?.plugin ?? null,
    subscription?.pluginVersion ?? null,
    providerEnv === undefined
      ? 'ABSENT'
      : PROVIDER_ENV_IDENTITY_KEYS.map((key) => [key, providerEnv[key] ?? null]),
  ])
}

/**
 * Classify one attempt failure against the parent CTR-004 whitelist and the
 * CTR-005 stop set. Returns exactly one of: a whitelisted failureClass (hop
 * candidate, admission proven false) or a stopReason (STOP_CHAIN). Envelope
 * semantics are anchored to AGENT_PROCESS_LIFECYCLE_HARDENING_V2 and are
 * never redefined here.
 *
 * @returns {{failureClass:string|null, admissionProven:string, stopReason:string|null}}
 */
export function classifyAttemptFailure(error) {
  if (error?.envelope === 'not_admitted' || error?.status === 'not_admitted') {
    // V2 not_admitted envelope: validation/capacity fail or proven pre-send
    // zero-byte rejection — always pre-admission by construction.
    return {
      failureClass: ROUTE_HOP_FAILURE_CLASSES.TURNQUEUE_NOT_ADMITTED,
      admissionProven: 'proven_no_admission',
      stopReason: null,
    }
  }
  if (error?.envelope === 'outcome_unknown' || error?.status === 'outcome_unknown') {
    return { failureClass: null, admissionProven: 'unproven', stopReason: ROUTE_STOP_REASONS.OUTCOME_UNKNOWN }
  }
  if (error?.code === 'AGENT_PROCESS_SPAWN_FAILED' || PRE_CHILD_STARTUP_STAGES.has(error?.startupFailureStage)) {
    return {
      failureClass: ROUTE_HOP_FAILURE_CLASSES.SPAWN_FAILED_WITHOUT_CHILD,
      admissionProven: 'proven_no_admission',
      stopReason: null,
    }
  }
  if (FAIL_LOUD_PROVIDER_ERRORS.has(error?.code)) {
    // Initialize-phase fail-loud provider errors (provider_unavailable,
    // credential_missing, oauth_expired_or_revoked, quota, model_unavailable):
    // the process never reached READY, so no prompt admission ever existed.
    return {
      failureClass: ROUTE_HOP_FAILURE_CLASSES.INITIALIZE_PROVIDER_UNAVAILABLE,
      admissionProven: 'proven_no_admission',
      stopReason: null,
    }
  }
  if (error?.code === 'AGENT_PROCESS_INITIALIZE_TIMEOUT') {
    // Not in the closed whitelist; timeout without proven termination.
    return {
      failureClass: null,
      admissionProven: 'unproven',
      stopReason: ROUTE_STOP_REASONS.TIMEOUT_WITHOUT_PROVEN_TERMINATION,
    }
  }
  if (error?.envelope === 'failed' || error?.status === 'failed') {
    if (error?.evidence?.promptReceipt === 'accepted') {
      // Admission after the receipt watermark: parent CTR-005(3)/(7).
      return { failureClass: null, admissionProven: 'admitted', stopReason: ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE }
    }
    // Structured, machine-classifiable rejection at the session/prompt
    // boundary before any receipt (e.g. session create/resume rejection,
    // workspace mismatch): parent CTR-004 class 3.
    return {
      failureClass: ROUTE_HOP_FAILURE_CLASSES.SESSION_CREATE_RESUME_REJECTION,
      admissionProven: 'proven_no_admission',
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
 * Create the unified chain executor.
 * @param {object} deps
 * @param {object} deps.log - structured logger (journal evidence surface).
 * @param {function} deps.ensureRunningForRoute - registry route-aware gate:
 *   (agentId, {routeIdentity, processConfig}) -> Promise<{status:'ready',proc}
 *   | {status:'busy_mismatch'} | {status:'reaping'}>.
 * @param {function} [deps.resolveRouteChain] - (agentId) => immutable chain
 *   snapshot {chainId, routes:[{routeRef,identity,processConfig}]}; absent =>
 *   length-1 legacy passthrough (no route gate, byte-equivalent to today).
 * @param {function} [deps.resolveTurnDeadlineMs] - (agentId) => the single
 *   per-turn deadline budget (Router deadline config).
 * @param {number} [deps.journalMaxEntries] - bounded ring size (default 256).
 */
export function createRouteChainExecutor({
  log, ensureRunningForRoute, resolveRouteChain, resolveTurnDeadlineMs, journalMaxEntries = 256,
}) {
  if (typeof ensureRunningForRoute !== 'function') {
    throw new TypeError('agent-router: route chain executor requires ensureRunningForRoute')
  }
  const journal = []

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

  /** Bounded convergence wait: busy-mismatched or reaping slots retry inside
   *  the single deadline budget (busy processes are never killed). */
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
      // attempts (journal keeps the turn-level final block truthful).
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

    for (let attemptIndex = 0; attemptIndex < routes.length; attemptIndex += 1) {
      const route = routes[attemptIndex]
      const label = routeLabel(route)
      try {
        const proc = await acquire(agentId, route, deadlineMono)
        if (mode === 'turn') notifyDispatchOnce()
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
        return { ...result, pid: proc.pid, routeRef: route.routeRef ?? null, routeChainId: chainId }
      } catch (error) {
        const verdict = classifyAttemptFailure(error)
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
          if (error instanceof Error && error.routeChain === undefined) {
            error.routeChain = Object.freeze({
              routeChainId: chainId, totalRouteAttempts: attemptIndex + 1,
              finalOutcome, failureClass: verdict.failureClass,
            })
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
    /** Test/ops: bounded journal ring snapshot (structured evidence). */
    journalSnapshot() {
      return journal.map((entry) => ({ ...entry }))
    },
  }
}
