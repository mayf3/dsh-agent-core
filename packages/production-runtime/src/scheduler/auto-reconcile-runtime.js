/**
 * AGENT_DELIVERY_RESILIENCE_V1 CTR-S1/S4 — scheduler fence auto-reconcile
 * runtime mount (accepted spec docs/specs/AGENT_DELIVERY_RESILIENCE_V1.md
 * @8cf2c23a; evidence authority mayf3/agent-control#1332).
 *
 * WIRING/LIFECYCLE ONLY — the policy lives in @agent-core/scheduler
 * (auto-reconcile.js + control.js autoReconcileOccurrences) and the evidence
 * source is the runtime's own turn-recovery registry (D-007 durable
 * occurrence authority). This mount:
 *   - is DEFAULT OFF (CTR-S4): it runs only when
 *     AGENT_CORE_FENCE_AUTO_RECONCILE === 'on' in the runtime environment —
 *     enabling is an explicit owner/operator configuration action;
 *   - plans with the scheduler's frozen policy (evaluate/plan, CTR-S2 gates)
 *     and settles through `autoReconcileOccurrences` (same store mutation
 *     path as the operator CLI, machine receipt actor, CTR-S3);
 *   - never runs without a readable turn-recovery store (fail-closed: no
 *     evidence source ⇒ no settlements, never "no evidence ⇒ failed").
 */

import { existsSync, readFileSync } from 'node:fs'
import { readDurableRecoveryStore } from '../../../agent-router/src/reconciliation/durable-file.js'
import { planAutoReconcilePass, autoReconcileOccurrences, AUTO_RECONCILE_DEFAULT_ACTOR_ID } from '../../../scheduler/src/index.js'

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000

/**
 * Build the evidence lookup over the turn-recovery registry file. Returns
 * `null` when the store is absent/unreadable — the caller then fails closed.
 */
export function createTurnRecoveryEvidenceLookup(turnRecoveryStore, log) {
  if (typeof turnRecoveryStore !== 'string' || turnRecoveryStore === '' || !existsSync(turnRecoveryStore)) {
    return null
  }
  let records = null
  try {
    // Single schema authority (same reader the restart drain gate uses):
    // schema violations throw and the pass fails closed for this tick.
    records = readDurableRecoveryStore(turnRecoveryStore).records
  } catch (error) {
    log?.error?.(`fence-auto-reconcile: turn-recovery store unreadable, failing closed: ${error?.message ?? error}`)
    return null
  }
  // Structured correlation index (review R1 G-3): cron turns carry
  // callerCorrelation {occurrenceId, runId, requestId}; native-session turns
  // encode the occurrence id inside the derived session id. Matching is
  // exact-key — never substring — so near-identical ids cannot cross-match.
  const index = new Map()
  for (const record of records.values()) {
    const correlation = record.callerCorrelation
    if (correlation && typeof correlation === 'object' && typeof correlation.occurrenceId === 'string') {
      index.set(correlation.occurrenceId, record)
      continue
    }
    const sessionId = String(record.sessionId ?? '')
    const embedded = sessionId.match(/occ:[0-9a-f]{16}/)
    if (embedded) index.set(embedded[0], record)
  }
  return (schedulerOccurrence) => {
    const occurrenceId = String(schedulerOccurrence?.occurrenceId ?? '')
    const hit = index.get(occurrenceId)
    if (hit === undefined) return null
    return {
      initialSource: hit.record.initialSource ?? null,
      lateOutcome: hit.record.lateOutcome ?? null,
      outcomeEvidence: hit.record.outcomeEvidence ?? null,
      terminationEvidence: hit.record.terminationEvidence ?? null,
    }
  }
}

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
export function mountSchedulerAutoReconcileRuntime({ layout, store, log, enabled, intervalMs } = {}) {
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
      const evidenceLookup = createTurnRecoveryEvidenceLookup(layout.turnRecoveryStore, log)
      if (evidenceLookup === null) return
      const doc = readJobsDocSnapshot(layout.jobsStore)
      const plan = planAutoReconcilePass(doc, evidenceLookup)
      if (plan.targets.length === 0) return
      log?.log?.(`fence-auto-reconcile: settling ${plan.targets.length} occurrence(s) by frozen evidence policy`)
      const { results, fencesRemaining } = await autoReconcileOccurrences(
        store, { settlements: plan.targets, actorId: AUTO_RECONCILE_DEFAULT_ACTOR_ID },
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
  log?.log?.(`fence-auto-reconcile: ENABLED — every ${Math.round(periodMs / 1000)}s (evidence-gated, AGENT_DELIVERY_RESILIENCE_V1 CTR-S1..S5)`)
  return {
    enabled: true,
    stop() { if (timer !== null) clearInterval(timer); timer = null },
    tick,
  }
}
