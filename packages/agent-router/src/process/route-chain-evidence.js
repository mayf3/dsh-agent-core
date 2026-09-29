/** Exact route-chain deadline and process-owned turn evidence. */
export function chainDeadlineError(agentId) {
  return Object.assign(
    new Error(`agent-router: route chain deadline exhausted before admission (agent ${agentId}) — STOP_CHAIN, no fallback`),
    { code: 'AGENT_ROUTE_CHAIN_DEADLINE_EXCEEDED', envelope: 'chain_deadline_exceeded' },
  )
}

  /** Authoritative post-settlement turn evidence from the published
   * AgentProcess surface (read-only; the store settles before the carrier
   * rejects, so the snapshot is already final here). */
export function authoritativeTurnEvidence(proc, error) {
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

