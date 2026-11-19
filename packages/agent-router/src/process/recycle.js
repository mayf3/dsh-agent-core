/**
 * @agent-core/agent-router/src/process/recycle.js — AGENT_PROCESS_RECYCLE_V1
 * (#703): bound the memory a long-lived READY child accumulates (the child
 * keeps append-only per-session history in RAM for its whole lifetime —
 * see dsh-agent-core#705) by RETIRING idle READY generations once they have
 * settled >= maxTurns turns or lived >= maxAgeMs, whichever first.
 *
 * Recycling introduces NO new lifecycle state: it reuses the existing
 * graceful shutdown path (shutdown.js performShutdown → C-020 settlement →
 * REAP → EMPTY), and the next ensureRunning demand naturally spawns a fresh
 * generation. The sweep is the ONLY writer of `retireRequested`; the reuse
 * gate treats a retire-requested READY generation as non-reusable and waits
 * (bounded) for the shutdown to settle instead of failing the caller's turn.
 */

export const DEFAULT_RECYCLE_CONFIG = Object.freeze({
  enabled: true,
  maxTurns: 20, // settled turns per generation before retirement
  maxAgeMs: 24 * 60 * 60 * 1000, // generation wall-age before retirement
  sweepIntervalMs: 5 * 60 * 1000, // registry sweep cadence (mount-owned timer)
  waitBudgetMs: 10 * 1000, // reuse-gate bound while a generation retires
})

function assertPositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`agent-router recycle: ${label} must be a positive safe integer, got ${value}`)
  }
  return value
}

/**
 * Environment surface (fail-loud on invalid values — same philosophy as the
 * CLAUSE-PROC-DEADLINE-CONFIG validation). `DSH_AGENT_RECYCLE=off` is the
 * kill-switch; every threshold is individually overridable.
 */
export function parseRecycleConfig(env = {}) {
  const raw = {
    enabled: env.DSH_AGENT_RECYCLE !== 'off',
    maxTurns: env.DSH_AGENT_RECYCLE_MAX_TURNS !== undefined
      ? Number.parseInt(env.DSH_AGENT_RECYCLE_MAX_TURNS, 10)
      : DEFAULT_RECYCLE_CONFIG.maxTurns,
    maxAgeMs: env.DSH_AGENT_RECYCLE_MAX_AGE_MS !== undefined
      ? Number.parseInt(env.DSH_AGENT_RECYCLE_MAX_AGE_MS, 10)
      : DEFAULT_RECYCLE_CONFIG.maxAgeMs,
    sweepIntervalMs: env.DSH_AGENT_RECYCLE_SWEEP_MS !== undefined
      ? Number.parseInt(env.DSH_AGENT_RECYCLE_SWEEP_MS, 10)
      : DEFAULT_RECYCLE_CONFIG.sweepIntervalMs,
    waitBudgetMs: env.DSH_AGENT_RECYCLE_WAIT_BUDGET_MS !== undefined
      ? Number.parseInt(env.DSH_AGENT_RECYCLE_WAIT_BUDGET_MS, 10)
      : DEFAULT_RECYCLE_CONFIG.waitBudgetMs,
  }
  return Object.freeze({
    enabled: raw.enabled,
    maxTurns: assertPositiveSafeInteger(raw.maxTurns, 'DSH_AGENT_RECYCLE_MAX_TURNS'),
    maxAgeMs: assertPositiveSafeInteger(raw.maxAgeMs, 'DSH_AGENT_RECYCLE_MAX_AGE_MS'),
    sweepIntervalMs: assertPositiveSafeInteger(raw.sweepIntervalMs, 'DSH_AGENT_RECYCLE_SWEEP_MS'),
    waitBudgetMs: assertPositiveSafeInteger(raw.waitBudgetMs, 'DSH_AGENT_RECYCLE_WAIT_BUDGET_MS'),
  })
}

/**
 * Pure eligibility verdict for one READY process. "Idle" is the composite
 * in-flight view (turn queue + tracked executions + unknown fences): every
 * one of those surfaces is cleared synchronously at terminal settlement, so
 * a process observed idle here stays idle until the sweep's synchronous
 * retire-mark + shutdown() freeze (single JS thread — no await between the
 * check and the DRAINING transition inside performShutdown).
 */
export function recycleEligibility(proc, { maxTurns, maxAgeMs } = {}, nowMs = Date.now()) {
  if (proc === null || proc === undefined || typeof proc !== 'object') {
    return { eligible: false, reason: 'no process' }
  }
  if (proc.state !== 'READY') return { eligible: false, reason: `state ${proc.state}` }
  if (proc.exit !== undefined) return { eligible: false, reason: 'already exited' }
  if (proc.retireRequested === true) return { eligible: false, reason: 'already retiring' }
  if (proc.turnInFlight === true) return { eligible: false, reason: 'turn in flight' }
  if ((proc.turnQueueEntries?.length ?? 0) !== 0) return { eligible: false, reason: 'queued turns' }
  if ((proc.executions?.size ?? 0) !== 0) return { eligible: false, reason: 'tracked executions' }
  if ((proc.activeUnknownFences?.size ?? 0) !== 0) return { eligible: false, reason: 'unknown fences' }
  const settledTurns = proc.recycleState?.settledTurns ?? 0
  const ageMs = nowMs - (proc.recycleState?.spawnedAtWallMs ?? nowMs)
  if (Number.isSafeInteger(maxTurns) && settledTurns >= maxTurns) {
    return { eligible: true, reason: `settled turns ${settledTurns} >= ${maxTurns}` }
  }
  if (Number.isSafeInteger(maxAgeMs) && ageMs >= maxAgeMs) {
    return { eligible: true, reason: `age ${ageMs}ms >= ${maxAgeMs}ms` }
  }
  return { eligible: false, reason: `under thresholds (turns ${settledTurns}, age ${ageMs}ms)` }
}
