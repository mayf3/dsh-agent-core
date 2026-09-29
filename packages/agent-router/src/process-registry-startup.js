import { redactSensitiveText } from './process/index.js'
/** Normalize dependency failures into an extensible startup carrier. */
export async function disposeProcessSlots(lifecycleSlots, failNoChild) {
  const shutdowns = []
  const seen = new Set()
  for (const [agentId, slot] of lifecycleSlots) {
    const proc = slot.processRef
    if (slot.state === 'STARTUP' && proc === null) {
      failNoChild(agentId, slot)
      continue
    }
    if (proc !== null && proc !== undefined && !seen.has(proc) && typeof proc.shutdown === 'function') {
      seen.add(proc)
      shutdowns.push(Promise.resolve().then(() => proc.shutdown()).catch(() => proc.exitPromise)
        .then(() => proc.exitPromise ?? proc.exit))
    }
  }
  await Promise.allSettled(shutdowns)
}

export function convergeStartedStartup({ agentId, entry, cause, empty, reap, settle, teardownFailure }) {
  const error = startupFailure(cause, {
    agentId, generation: entry.generation, stage: entry.startupFailureStage ?? 'startup',
  })
  const proc = entry.processRef
  const hasChild = proc.ownership !== null && proc.ownership !== undefined
  if (hasChild) reap(agentId, proc, 'startup_failure')
  else empty(agentId, proc)
  settle(entry, error)
  try {
    if (hasChild && typeof proc.fatal === 'function') proc.fatal('startup_failure')
    else if (hasChild) void proc.shutdown?.()
  } catch (fatalCause) { teardownFailure(fatalCause) }
}

export function startupFailure(cause, { agentId, generation, stage }) {
  const error = new Error(cause instanceof Error ? cause.message : String(cause))
  error.name = cause instanceof Error ? cause.name : 'Error'
  if (cause?.code !== undefined) error.code = cause.code
  error.agentId = agentId
  error.processGeneration = generation
  error.startupFailureStage = stage
  return error
}

/**
 * C-008 no-child startup failure discipline (review F-1): any synchronous
 * pre-spawn preparation failure (resolveWorkspace / resolveDshHome /
 * resolveProcessConfig / provisionHome / processFactory) must atomically
 * (a) record redacted bounded evidence, (b) reject the shared startup
 * resultPromise EXACTLY ONCE so every current and future waiter settles
 * in bounded time, and (c) clean the exact STARTUP slot to EMPTY through
 * full identity CAS (slot object + state + no processRef/ownershipToken)
 * so the next ensureRunning may retry — never the delete-then-REAP shape,
 * never a shutdown write, never a kill, and a stale first-generation
 * cleanup can never touch a newer generation's slot.
 */
export function settleStartupEntry(entry, error) {
    if (entry.startupSettled) return false
    entry.startupSettled = true
    entry.rejectResult(error)
    return true
  }

export function failNoChildStartup(lifecycleSlots, auditStaleSlot, agentId, entry, cause) {
    // (a) bounded, redacted evidence first.
    const evidence = redactSensitiveText(String(cause?.message ?? cause)).slice(0, 2048)
    auditStaleSlot(`pre-spawn startup failure (no child) for agent ${agentId} generation ${entry.generation}: ${evidence}`)
    const error = startupFailure(cause, {
      agentId, generation: entry.generation, stage: entry.startupFailureStage ?? 'pre-spawn',
    })
    // (c) identity CAS: only THIS exact STARTUP entry with no processRef and
    // no ownership token may reach EMPTY; anything else (a newer generation,
    // REAP, READY) is untouchable — the stale path is audit-only.
    if (lifecycleSlots.get(agentId) === entry
        && entry.state === 'STARTUP'
        && entry.processRef === null
        && entry.ownershipToken === null) {
      lifecycleSlots.delete(agentId)
      entry.state = 'EMPTY'
    } else {
      auditStaleSlot(`pre-spawn cleanup ignored for agent ${agentId} generation ${entry.generation}: slot identity mismatch (stale callback)`)
    }
    // (b) exactly-once bounded reject of the shared startup promise.
    settleStartupEntry(entry, error)
    return error
  }

/**
 * Legacy/duck-typed reap fallback: fires only on real exit observation
 * (exitPromise settles after the AgentProcess settlement order; injected
 * test fakes control their own exitResolve). Idempotent with the
 * integration-driven CAS cleanup of the real class.
 */
export function reapExitedSlot(lifecycleSlots, agentId, proc) {
  void proc.exitPromise?.then(() => {
    const slot = lifecycleSlots.get(agentId)
    if (slot === undefined || slot.processRef !== proc) return
    if (slot.state === 'REAP') {
      lifecycleSlots.delete(agentId)
      slot.resolveReap?.()
      return
    }
    // Observed real exit of a STARTUP/READY entry: same-task
    // DRAINING -> EXITED cleanup is legal (C-009) — the child is gone.
    lifecycleSlots.delete(agentId)
  }).catch(() => {})
}
