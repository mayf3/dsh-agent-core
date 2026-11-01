/** CTR-S4 wiring only: exact Router evidence, default OFF, drained shutdown. */

import { planAutoReconcilePass } from '../../../scheduler/src/watchdog/auto-reconcile.js'
import { autoReconcileOccurrences } from '../../../scheduler/src/watchdog/auto-reconcile-mutation.js'

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000
const CURRENT_TERMINATION_KINDS = new Set([
  'exact_terminal_then_idle', 'exact_started_then_idle', 'exact_queued_removal', 'child_real_exit', 'cancellation_ack',
])
const nonempty = value => typeof value === 'string' && value !== ''

function coherentSettlement(snapshot) {
  if (!CURRENT_TERMINATION_KINDS.has(snapshot.terminationEvidence)) return false
  const direct = snapshot.outcome ?? null
  const late = snapshot.lateOutcome ?? null
  if (direct !== null && late !== null) return false
  if (late === 'terminated_without_outcome') return snapshot.outcomeEvidence === null
  if (direct === 'completed' || late === 'late_completed') return snapshot.outcomeEvidence === 'exact_turn_end_success'
  if (direct === 'failed' || late === 'late_failed') return snapshot.outcomeEvidence === 'exact_turn_end_failure'
  return false
}

/** Read only the Router's exact index; raw-file/substrings are never evidence. */
export function createTurnRecoveryEvidenceLookup(router, log) {
  return (record) => {
    if (record?.recordSchemaVersion !== 3 || !nonempty(record.ownerAgentId)
      || ![record.occurrenceId, record.runId, record.requestId].every(nonempty)
      || record.runId !== `run:${record.occurrenceId}` || record.requestId !== record.idempotencyKey
      || typeof router?.resolveCallerCorrelation !== 'function'
      || typeof router?.reconciliationRuntimeStatus !== 'function') return null
    try {
      const epoch = router.reconciliationRuntimeStatus()?.generationId
      if (!nonempty(epoch)) return null
      const coordinates = { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId }
      const result = router.resolveCallerCorrelation(coordinates)
      const snapshot = result?.snapshot
      if (result?.state !== 'settled' || snapshot?.state !== 'settled'
        || snapshot.agentId !== record.ownerAgentId || snapshot.runtimeEpoch !== epoch
        || router.reconciliationRuntimeStatus()?.generationId !== epoch) return null
      const correlation = snapshot.callerCorrelation
      if (!correlation || typeof correlation !== 'object' || Array.isArray(correlation)
        || Object.keys(coordinates).some(key => correlation[key] !== coordinates[key])) return null
      const handle = result.handle
      const parts = typeof handle === 'string' ? handle.match(/^turn:([^:]+):a([1-9]\d*):g([1-9]\d*):s([1-9]\d*)$/) : null
      if (!parts || parts[1] !== epoch || snapshot.handle !== handle || snapshot.turnExecutionId !== handle
        || !Number.isSafeInteger(snapshot.processGeneration) || snapshot.processGeneration !== Number(parts[3])
        || !coherentSettlement(snapshot)) return null
      return {
        ...coordinates, agentId: snapshot.agentId, runtimeEpoch: epoch, reconciliationHandle: handle,
        outcome: snapshot.outcome ?? null,
        outcomeEvidence: snapshot.outcomeEvidence, terminationEvidence: snapshot.terminationEvidence,
        lateOutcome: snapshot.lateOutcome ?? null,
      }
    } catch (error) {
      log?.error?.(`fence-auto-reconcile: Router evidence unavailable, failing closed: ${error?.message ?? error}`)
      return null
    }
  }
}

/** stop rejects new work, then drains any already-admitted commit and receipt. */
export function mountSchedulerAutoReconcileRuntime({
  router, store, log, enabled, intervalMs, nowMs = () => Date.now(),
  setIntervalFn = setInterval, clearIntervalFn = clearInterval,
} = {}) {
  const configured = () => enabled === undefined
    ? process.env.AGENT_CORE_FENCE_AUTO_RECONCILE === 'on' : enabled === true
  const requestedPeriod = intervalMs ?? Number(process.env.AGENT_CORE_FENCE_AUTO_RECONCILE_INTERVAL_MS)
  const periodMs = Number.isFinite(requestedPeriod) && requestedPeriod >= 60_000 ? requestedPeriod : DEFAULT_INTERVAL_MS
  let stopped = false
  let timer = null
  let inFlight = null
  const readEvidence = createTurnRecoveryEvidenceLookup(router, log)
  // Re-used by the locked batch replan, so disable/stop also rejects queued work.
  const evidenceLookup = record => !stopped && configured() ? readEvidence(record) : null

  async function pass() {
    try {
      const doc = await store.loadDoc({ force: true })
      if (stopped || !configured()) return
      const plan = planAutoReconcilePass(doc, evidenceLookup)
      if (plan.targets.length === 0) return
      const value = await autoReconcileOccurrences(store, { settlements: plan.targets, evidenceLookup, nowMs: nowMs() })
      if (value.committedAckLost) log?.warn?.('fence-auto-reconcile: committed acknowledgement lost; recovered from authoritative readback')
      for (const result of value.results) {
        if (result.evidenceStatus?.ok === false) {
          log?.error?.(`fence-auto-reconcile: receipt append failed for ${result.occurrenceId}: ${result.evidenceStatus.error ?? 'unknown error'}`)
        }
      }
      const settled = value.results.filter(result => result.outcome === 'settled').length
      log?.log?.(`fence-auto-reconcile: settled=${settled} errors=${value.results.length - settled} fencesRemaining=${value.fencesRemaining}`)
      return value
    } catch (error) {
      log?.error?.(`fence-auto-reconcile pass failed (fail-closed): ${error?.message ?? error}`)
    }
  }

  function tick() {
    if (stopped) return Promise.reject(Object.assign(new Error('fence-auto-reconcile runtime stopped'), { code: 'AUTO_RECONCILE_STOPPED' }))
    if (!configured()) return Promise.resolve()
    if (inFlight) return inFlight
    inFlight = pass().finally(() => { inFlight = null })
    return inFlight
  }
  if (configured()) {
    timer = setIntervalFn(() => { void tick().catch(() => {}) }, periodMs)
    timer?.unref?.()
    log?.log?.(`fence-auto-reconcile: ENABLED — intervalMs=${periodMs}`)
  } else log?.log?.('fence-auto-reconcile: DISABLED (AGENT_CORE_FENCE_AUTO_RECONCILE !== "on")')
  return {
    get enabled() { return !stopped && configured() },
    tick,
    async stop() {
      stopped = true
      if (timer !== null) clearIntervalFn(timer)
      timer = null
      await inFlight
    },
  }
}
