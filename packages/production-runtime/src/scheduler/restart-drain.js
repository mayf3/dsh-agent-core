/**
 * @agent-core/production-runtime/src/scheduler/restart-drain.js — the
 * planned-restart drain gate (C11-R3, Product #426 DONE_WHEN A1–A3).
 *
 * The recurring failure mode: a Router/Scheduler turn is in flight, a PLANNED
 * production restart bootouts the runtime, live generation ownership dies
 * with the old epoch, and the durable state becomes restart-lost
 * `outcome_unknown` — an avoidable loss the fail-closed admission then keeps
 * fenced. The gate makes the restart discipline explicit, on the EXISTING
 * deployment path, with NO new watcher/scheduler/database/state machine:
 *
 *   1. CENSUS  — one authoritative read of the durable turn-recovery store
 *      (admitted in-flight Router turn handles + runtimeEpoch/generation —
 *      the same bytes the next startup classifies) and the scheduler jobs
 *      store (admitted/running occurrences bound to those turns).
 *   2. DRAIN   — a bounded window (default 60s, poll 2s) during which the
 *      runtime's OWN shutdown/reap/settlement paths resolve the in-flight
 *      work; the gate merely re-reads the census. It never signals, kills,
 *      prompts or settles anything itself.
 *   3. REFUSE  — if identifiable execution remains undrained at window
 *      expiry, the ordinary restart fails closed BEFORE the runtime is
 *      stopped (no plist mutation, no bootout). An explicit emergency
 *      acceptance (`acceptUndrainedRestart`, the A4 escape hatch — same
 *      philosophy as the admin abandonment's acceptUnprovenTerminationRisk)
 *      proceeds ONLY with a restart-boundary receipt naming the previous
 *      epoch and the unresolved handles.
 *
 * Census-unavailable (unreadable/corrupt store) refuses fail-closed:
 * quiescence cannot be proven. Already-classified restart-lost records
 * (`recoveryState === 'blocked'`, no identifiable live execution) do NOT
 * block a restart — the startup convergence matrix owns them. The gate is
 * ARMED only when both census paths are provided; callers that pass none
 * (legacy callers, selftest fixtures) keep the exact previous behavior.
 */

import { existsSync, readFileSync } from 'node:fs'
import { readDurableRecoveryStore } from '../../../agent-router/src/reconciliation/durable-file.js'

/** Bounded drain window (ms) before an ordinary restart refuses. */
export const DEFAULT_RESTART_DRAIN_WINDOW_MS = 60_000
/** Census re-read cadence inside the drain window. */
export const DEFAULT_RESTART_DRAIN_POLL_MS = 2_000

const atomicsSleep = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, ms))
}

function readTurnRecoveryCensus(file) {
  if (typeof file !== 'string' || file === '' || !existsSync(file)) {
    return { present: false, epoch: null, inflightTurns: [], unresolvedLostTurns: [] }
  }
  // readDurableRecoveryStore is the single schema authority: any schema
  // violation throws and the gate fails closed (census unavailable).
  const validated = readDurableRecoveryStore(file)
  // The current epoch is the store's own top-level marker (the runtime
  // persists it on every mutation); records of OTHER epochs are previous
  // epochs by definition and never count as drainable in-flight work.
  const rawEpoch = JSON.parse(readFileSync(file, 'utf8')).runtimeEpoch
  const epoch = typeof rawEpoch === 'string' && rawEpoch !== '' ? rawEpoch : null
  const inflightTurns = []
  const unresolvedLostTurns = []
  for (const record of validated.records.values()) {
    if (record.state === 'settled') continue
    const entry = {
      handle: record.handle,
      agentId: record.agentId,
      processGeneration: record.processGeneration ?? null,
      runtimeEpoch: record.runtimeEpoch ?? null,
      recoveryState: record.recoveryState ?? null,
      promptWriteAttempted: record.promptWriteAttempted === true,
      exitObservedAt: record.exitObservedAt ?? null,
    }
    if (entry.recoveryState === 'blocked' || entry.runtimeEpoch !== epoch) unresolvedLostTurns.push(entry)
    else inflightTurns.push(entry)
  }
  return { present: true, epoch, inflightTurns, unresolvedLostTurns }
}

function readSchedulerInflightOccurrences(file) {
  if (typeof file !== 'string' || file === '' || !existsSync(file)) {
    return { present: false, inflightOccurrences: [] }
  }
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  const occurrences = Array.isArray(doc?.occurrences) ? doc.occurrences : []
  const inflightOccurrences = occurrences
    .filter((record) => record?.state === 'admitted' || record?.state === 'running')
    .map((record) => ({
      occurrenceId: String(record.occurrenceId ?? ''),
      jobId: String(record.jobId ?? ''),
      runId: String(record.runId ?? ''),
      state: record.state,
    }))
  return { present: true, inflightOccurrences }
}

/**
 * One authoritative restart-drain census over both durable stores.
 * Reads ONLY; never writes. Throws (fail-closed) when either present store
 * cannot be parsed/validated — quiescence must be provable, not assumed.
 */
export function readRestartDrainCensus({ turnRecoveryStore, jobsStore } = {}) {
  const turns = readTurnRecoveryCensus(turnRecoveryStore)
  const jobs = readSchedulerInflightOccurrences(jobsStore)
  return {
    epoch: turns.epoch,
    inflightTurns: turns.inflightTurns,
    unresolvedLostTurns: turns.unresolvedLostTurns,
    inflightOccurrences: jobs.inflightOccurrences,
    drained: turns.inflightTurns.length === 0 && jobs.inflightOccurrences.length === 0,
  }
}

/**
 * The bounded drain gate. Returns `null` when unarmed ( EITHER census path
 * missing — a partial census would silently pretend to prove quiescence, so
 * the gate arms only over BOTH stores, exactly as the production deployment
 * context passes them; legacy callers keep the exact previous restart
 * behavior); otherwise
 * `{ outcome: 'quiescent' | 'drained_within_window' | 'emergency_proceed',
 *    census, drain? }`, or throws fail-closed with
 * `code: 'RESTART_DRAIN_UNDRAINED' | 'RESTART_DRAIN_CENSUS_UNAVAILABLE'`
 * and the last census attached. Fully synchronous (deployment scripts are
 * sync); the poll sleep is injectable for deterministic tests.
 */
export function enforceRestartDrainGate({
  turnRecoveryStore, jobsStore, windowMs, pollMs, acceptUndrained = false, sleep,
} = {}) {
  if (turnRecoveryStore === undefined || jobsStore === undefined) return null
  const window = Number.isInteger(windowMs) && windowMs > 0 ? windowMs : DEFAULT_RESTART_DRAIN_WINDOW_MS
  const poll = Number.isInteger(pollMs) && pollMs > 0 ? pollMs : DEFAULT_RESTART_DRAIN_POLL_MS
  const sleepFn = typeof sleep === 'function' ? sleep : atomicsSleep
  const startedAt = Date.now()
  const takeCensus = () => {
    try {
      return readRestartDrainCensus({ turnRecoveryStore, jobsStore })
    } catch (cause) {
      throw Object.assign(
        new Error(`runtime restart drain gate cannot take its census (${cause instanceof Error ? cause.message : String(cause)}) — quiescence cannot be proven, restart fails closed`),
        { code: 'RESTART_DRAIN_CENSUS_UNAVAILABLE', cause },
      )
    }
  }
  let census = takeCensus()
  let polls = 0
  while (!census.drained) {
    if (acceptUndrained === true) {
      return { outcome: 'emergency_proceed', census }
    }
    const remaining = startedAt + window - Date.now()
    if (remaining <= 0) {
      throw Object.assign(
        new Error(`runtime restart refused: ${census.inflightTurns.length} in-flight Router turn(s) and `
          + `${census.inflightOccurrences.length} in-flight scheduler occurrence(s) remained undrained within the `
          + `bounded ${window}ms window — ordinary restart fails closed BEFORE stopping the runtime `
          + '(Product #426 A3: a planned restart must never create restart-lost outcome_unknown); '
          + 'an emergency restart must set acceptUndrainedRestart explicitly and will be receipted'),
        { code: 'RESTART_DRAIN_UNDRAINED', census },
      )
    }
    sleepFn(Math.min(poll, remaining))
    polls += 1
    census = takeCensus()
  }
  return {
    outcome: polls === 0 ? 'quiescent' : 'drained_within_window',
    census,
    drain: { windowMs: window, pollMs: poll, polls, waitedMs: Date.now() - startedAt },
  }
}
