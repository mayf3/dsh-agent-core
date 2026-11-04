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

import { readFileSync } from 'node:fs'
import { createRouterRecoveryEvidenceLookup } from '../../../scheduler/src/auto-reconcile.js'
import { planAutoReconcilePass, autoReconcileOccurrences, AUTO_RECONCILE_DEFAULT_ACTOR_ID } from '../../../scheduler/src/index.js'

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000

function readJobsDocSnapshot(jobsStoreFile) {
  const doc = JSON.parse(readFileSync(jobsStoreFile, 'utf8'))
  return {
    jobs: Array.isArray(doc?.jobs) ? doc.jobs : [],
    occurrences: Array.isArray(doc?.occurrences) ? doc.occurrences : [],
  }
}

/**
 * Mount the auto-reconcile pass loop. Returns `{ enabled, stop() }`.
 */
export function mountSchedulerAutoReconcileRuntime({ layout, store, router, log, enabled, intervalMs, clock = () => Date.now() } = {}) {
  const envEnabled = process.env.AGENT_CORE_FENCE_AUTO_RECONCILE
  const isEnabled = enabled ?? envEnabled === 'on'
  const periodMs = Number.isFinite(intervalMs) && intervalMs >= 60_000
    ? intervalMs
    : Number(process.env.AGENT_CORE_FENCE_AUTO_RECONCILE_INTERVAL_MS) || DEFAULT_INTERVAL_MS
  if (!isEnabled) {
    log?.log?.('fence-auto-reconcile: DISABLED (AGENT_CORE_FENCE_AUTO_RECONCILE !== "on") — outcome_unknown fences stay on the human disposition path')
    return { enabled: false, stop() {} }
  }
  let running = false
  let timer = null
  const tick = async () => {
    if (running) return
    running = true
    try {
      const evidenceLookup = createRouterRecoveryEvidenceLookup(router, clock)
      if (evidenceLookup === null) return
      const doc = readJobsDocSnapshot(layout.jobsStore)
      const plan = planAutoReconcilePass(doc, evidenceLookup, { clock })
      if (plan.targets.length === 0) return
      log?.log?.(`fence-auto-reconcile: settling ${plan.targets.length} occurrence(s) by frozen evidence policy`)
      const { results, fencesRemaining } = await autoReconcileOccurrences(
        store, { settlements: plan.targets, actorId: AUTO_RECONCILE_DEFAULT_ACTOR_ID, evidenceLookup, clock },
      )
      const settled = results.filter((entry) => entry.outcome === 'settled').length
      const receiptFailures = results.filter((entry) => typeof entry.receipt === 'string' && entry.receipt !== 'ok').length
      log?.log?.(`fence-auto-reconcile: settled=${settled} errors=${results.length - settled} receiptFailures=${receiptFailures} fencesRemaining=${fencesRemaining}`)
    } catch (error) {
      log?.error?.(`fence-auto-reconcile pass failed (fail-closed, retry next tick): ${error?.message ?? error}`)
    } finally {
      running = false
    }
  }
  timer = setInterval(tick, periodMs)
  timer.unref?.()
  log?.log?.(`fence-auto-reconcile: ENABLED — every ${Math.round(periodMs / 1000)}s (evidence-gated, AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1 CTR-S1..S5)`)
  return {
    enabled: true,
    stop() { if (timer !== null) clearInterval(timer); timer = null },
    tick,
  }
}
