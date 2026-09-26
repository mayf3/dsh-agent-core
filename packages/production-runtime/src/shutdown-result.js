/**
 * T67 r2 (DAY_DSH_SCOUT_QUEUE_RECONCILIATION_20260920_V1) — truthful
 * shutdown result surface. A failed runtime.stop() must never be reported
 * as 'stopped cleanly'/exit 0: the evidence kind and the process exit code
 * both reflect the stop failure (fail-closed truth). Dependency-free so the
 * result contract is testable in isolation.
 */
export function shutdownResultFor(stopError) {
  if (stopError) {
    return { evidenceKind: 'stop_failed', exitCode: 1, summary: 'exited with stop failure' }
  }
  return { evidenceKind: 'stopped', exitCode: 0, summary: 'stopped cleanly' }
}

/**
 * Apply the truthful shutdown result to the runtime surfaces: evidence line,
 * summary log, process exit. Kept beside shutdownResultFor so the entry
 * closure stays a single call and the whole result contract stays testable
 * in isolation (r2 review blocker closure: the entry closure must not
 * reference an indirectly re-exported name).
 */
export function applyShutdownResult({ writeEvidence, log, processLike, signal, stopError }) {
  const result = shutdownResultFor(stopError)
  writeEvidence({ kind: result.evidenceKind, pid: processLike.pid, signal })
  log.log(result.summary)
  processLike.exit(result.exitCode)
  return result
}
