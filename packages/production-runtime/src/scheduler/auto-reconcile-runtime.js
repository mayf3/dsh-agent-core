/**
 * AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1 CTR-S1/S4 — scheduler fence auto-reconcile
 * runtime mount (accepted spec docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md
 * accepted in base 29d1cd86; D-009 exact Router evidence authority).
 *
 * WIRING/LIFECYCLE ONLY — the policy lives in @agent-core/scheduler
 * (auto-reconcile.js + control.js autoReconcileOccurrences) and the evidence
 * source is the runtime's own exact current Router readback (D-009 durable
 * occurrence authority). This mount:
 *   - is DEFAULT OFF (CTR-S4): it runs only when
 *     AGENT_CORE_FENCE_AUTO_RECONCILE === 'on' in the runtime environment —
 *     enabling is an explicit owner/operator configuration action;
 *   - plans with the scheduler's frozen policy (evaluate/plan, CTR-S2 gates)
 *     and settles through `autoReconcileOccurrences` (same store mutation
 *     path as the operator CLI, machine receipt actor, CTR-S3);
 *   - never runs without an available exact Router evidence seam (fail-closed: no
 *     evidence source ⇒ no settlements, never "no evidence ⇒ failed").
 */

import { createRouterRecoveryEvidenceLookup } from '../../../scheduler/src/auto-reconcile.js'
import { planAutoReconcilePass, autoReconcileOccurrences, AUTO_RECONCILE_DEFAULT_ACTOR_ID } from '../../../scheduler/src/index.js'

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000

/**
 * Stop rejects new/queued work, then drains an admitted commit and its receipt.
 * Evidence and all business-state decisions remain owned by the current policy.
 */
export function mountSchedulerAutoReconcileRuntime({
  store, router, log, enabled, intervalMs, clock = () => Date.now(),
  setIntervalFn = setInterval, clearIntervalFn = clearInterval,
} = {}) {
  const configured = () => enabled === undefined
    ? process.env.AGENT_CORE_FENCE_AUTO_RECONCILE === 'on' : enabled === true
  const requestedPeriod = intervalMs ?? Number(process.env.AGENT_CORE_FENCE_AUTO_RECONCILE_INTERVAL_MS)
  const periodMs = Number.isFinite(requestedPeriod) && requestedPeriod >= 60_000
    ? requestedPeriod : DEFAULT_INTERVAL_MS
  let stopped = false
  let timer = null
  let inFlight = null
  const readEvidence = createRouterRecoveryEvidenceLookup(router, clock)
  // The same lookup is called again inside the existing store mutation lock.
  const evidenceLookup = record => !stopped && configured() && readEvidence
    ? readEvidence(record) : null
  const pass = async () => {
    try {
      // Pure classification only: loadDoc() may migrate legacy stores before
      // evidence admission. C-033 upgrades belong to the Scheduler start path.
      const snapshot = await store._readDocRaw()
      if (stopped || !configured()) return
      if (snapshot.status !== 'v3') return {
        state: 'UNKNOWN', reason: 'store_requires_scheduler_upgrade',
        storeVersion: snapshot.raw?.version ?? 'UNKNOWN',
      }
      const plan = planAutoReconcilePass(snapshot.doc, evidenceLookup, { clock })
      if (plan.targets.length === 0) return
      log?.log?.(`fence-auto-reconcile: settling ${plan.targets.length} occurrence(s) by frozen evidence policy`)
      const value = await autoReconcileOccurrences(
        store, { settlements: plan.targets, actorId: AUTO_RECONCILE_DEFAULT_ACTOR_ID, evidenceLookup, clock },
      )
      const { results, fencesRemaining } = value
      const settled = results.filter((entry) => entry.outcome === 'settled').length
      const receiptFailures = results.filter((entry) => typeof entry.receipt === 'string' && entry.receipt !== 'ok').length
      log?.log?.(`fence-auto-reconcile: settled=${settled} errors=${results.length - settled} receiptFailures=${receiptFailures} fencesRemaining=${fencesRemaining}`)
      if (receiptFailures > 0) log?.error?.(`fence-auto-reconcile: ${receiptFailures} receipt append failure(s); authoritative settlements remain committed`)
      return value
    } catch (error) {
      log?.error?.(`fence-auto-reconcile pass failed (fail-closed, retry next tick): ${error?.message ?? error}`)
      return { state: 'UNKNOWN', reason: 'auto_reconcile_pass_failed' }
    }
  }
  const tick = () => {
    if (stopped) return Promise.reject(Object.assign(new Error('fence-auto-reconcile runtime stopped'), { code: 'AUTO_RECONCILE_STOPPED' }))
    if (!configured() || readEvidence === null) return Promise.resolve()
    if (inFlight) return inFlight
    inFlight = pass().finally(() => { inFlight = null })
    return inFlight
  }
  if (configured()) {
    timer = setIntervalFn(() => { void tick().catch(() => {}) }, periodMs)
    timer?.unref?.()
    log?.log?.(`fence-auto-reconcile: ENABLED — every ${Math.round(periodMs / 1000)}s (evidence-gated, AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1 CTR-S1..S5)`)
  } else log?.log?.('fence-auto-reconcile: DISABLED (AGENT_CORE_FENCE_AUTO_RECONCILE !== "on") — outcome_unknown fences stay on the human disposition path')
  return {
    get enabled() { return !stopped && configured() },
    async stop() {
      stopped = true
      if (timer !== null) clearIntervalFn(timer)
      timer = null
      await inFlight
    },
    tick,
  }
}
