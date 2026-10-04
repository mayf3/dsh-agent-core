/**
 * @agent-core/production-runtime/src/restart-boundary.js — the runtime-side
 * restart-boundary receipt (C11-R3, Product #426 DONE_WHEN A4).
 *
 * Whenever the old process is still observable (the graceful SIGTERM/SIGINT
 * controlled-stop path), the runtime persists an exact receipt of the
 * restart boundary into <root>/control/restart-boundary.jsonl: one
 * `quiesce_begin` line before the drain starts (the previous epoch, the
 * STARTUP/READY/REAP lifecycle slots, every unresolved handle class, the
 * in-flight scheduler occurrences) and one `quiesce_end` line after the
 * existing controlled shutdown settled everything it could. An emergency
 * cutover that kills the process mid-drain therefore still leaves the
 * begin-line evidence at the boundary.
 *
 * The receipt is EVIDENCE ONLY and strictly read-only over the recovery
 * store: the next startup's classification reads the durable
 * TurnReconciliationStore through the accepted startup machinery — never
 * the receipt (no new trust path), and quiescing NEVER stamps
 * `exitObservedAt` or any termination evidence (that fact exists only
 * through the exact child/generation real-exit observation path).
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { readRestartDrainCensus } from './scheduler/restart-drain.js'

/**
 * Collect the runtime's own restart census: the epoch and admission state
 * from the Router's published runtime status, the non-EMPTY lifecycle slots
 * (STARTUP/READY/REAP) from the registry, and the shared durable census
 * (in-flight turn handles + in-flight scheduler occurrences + the
 * already-classified restart-lost set). The durable census is best-effort
 * here — a corrupt store is reported in the receipt, never thrown past the
 * controlled-stop path (startup fails closed on it anyway).
 */
export function collectRuntimeRestartCensus({ turnRecoveryStore, jobsStore, router, agentIds = [] } = {}) {
  let runtimeStatus = {}
  try {
    runtimeStatus = typeof router?.reconciliationRuntimeStatus === 'function'
      ? (router.reconciliationRuntimeStatus() ?? {})
      : {}
  } catch { /* the receipt reports what is observable */ }
  const slots = []
  for (const agentId of agentIds) {
    try {
      // The registry's real slot projection is { state: EMPTY|STARTUP|READY|REAP, ... }.
      const slot = typeof router?.lifecycleSlotSnapshot === 'function' ? router.lifecycleSlotSnapshot(agentId) : null
      if (slot?.state === undefined || slot.state === 'EMPTY') continue
      slots.push({
        agentId,
        slot: slot.state,
        generation: slot.generation ?? null,
        entryId: slot.entryId ?? null,
        cause: slot.cause ?? null,
      })
    } catch (error) {
      slots.push({ agentId, slot: 'unknown', error: String(error?.message ?? error) })
    }
  }
  let census
  try {
    census = readRestartDrainCensus({ turnRecoveryStore, jobsStore })
  } catch (error) {
    census = {
      epoch: null, inflightTurns: [], unresolvedLostTurns: [], inflightOccurrences: [],
      drained: false, censusError: String(error?.message ?? error),
    }
  }
  return {
    epoch: runtimeStatus.generationId ?? census.epoch ?? null,
    routerHealth: runtimeStatus.health ?? null,
    businessAdmission: runtimeStatus.businessAdmission ?? null,
    slots,
    ...census,
  }
}

/**
 * Append one boundary receipt line (JSONL, bounded by the restart count).
 * Throws only on an invalid log path — callers on the stop path wrap this
 * best-effort and downgrade failures to evidence lines.
 */
export function appendRestartBoundaryReceipt({ boundaryLog, entry } = {}) {
  if (typeof boundaryLog !== 'string' || boundaryLog === '') {
    throw new TypeError('restart boundary receipt requires the layout boundary log path')
  }
  mkdirSync(dirname(boundaryLog), { recursive: true })
  appendFileSync(boundaryLog, `${JSON.stringify({ ...entry, ts: Date.now() })}\n`, { encoding: 'utf8' })
}
