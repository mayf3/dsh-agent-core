/**
 * @agent-core/agent-router/src/process-registry-route-gate.js — the
 * route-aware process reuse gate of the ordered route chain
 * (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1 DEC-IMPL-004, closing parent
 * Spec Q-4 inside the CTR-007 "next turn restarts at primary" policy).
 *
 * ROUTE_RECONCILIATION = REUSE_ONLY_IF_ROUTE_IDENTITY_MATCHES:
 *
 *   READY slot, identity matches  -> reuse (zero new generations)
 *   READY slot, mismatch, idle    -> existing controlled shutdown
 *                                     (graceful-then-kill, real-exit awaited,
 *                                     REAP fence semantics), then a fresh
 *                                     generation spawns under the wanted route
 *   READY slot, mismatch, busy    -> NEVER killed — the chain attempt waits
 *                                     (bounded by the executor's single
 *                                     deadline) for its own lifecycle to
 *                                     converge; no cross-turn route stickiness
 *                                     is introduced either way
 *   STARTUP                       -> share the in-flight startup result, then
 *                                     re-evaluate the identity gate
 *   REAP                          -> report 'reaping'; the executor waits
 *   EMPTY                         -> CAS(EMPTY -> STARTUP) with the wanted
 *                                     route's spawn config frozen onto the slot
 *
 * The route of an AgentProcess stays immutable for its lifetime (parent Spec
 * OBS-008 unchanged): a route switch is always a NEW process attempt (new
 * generation), never a re-configure of a live process.
 */

import { randomUUID } from 'node:crypto'

/** CAS(EMPTY -> STARTUP) — synchronous, before any further async work. */
export function installStartupSlot(lifecycleSlots, agentGenerations, agentId) {
  const generation = (agentGenerations.get(agentId) ?? 0) + 1
  agentGenerations.set(agentId, generation)
  let resolveResult
  let rejectResult
  const resultPromise = new Promise((resolvePromise, rejectPromise) => {
    resolveResult = resolvePromise
    rejectResult = rejectPromise
  })
  // Single-caller failures reject this promise with no other awaiter —
  // mark it handled up front (shared awaiters still observe rejections).
  resultPromise.catch(() => {})
  const entry = {
    state: 'STARTUP',
    generation,
    entryId: randomUUID(),
    resultPromise,
    resolveResult,
    rejectResult,
    processRef: null,
    ownershipToken: null,
    startupSettled: false,
    spawnConfig: null,
    routeIdentity: null,
  }
  lifecycleSlots.set(agentId, entry)
  return entry
}

function busyProcess(proc) {
  return proc.turnInFlight === true
    || (Array.isArray(proc.turnQueueEntries) && proc.turnQueueEntries.length > 0)
}

/**
 * Create the route-aware ensureRunning variant bound to one registry's slot
 * machinery. All slot mutations stay inside the registry's identity-CAS
 * discipline; this gate only adds the route-identity comparison and the
 * mismatched-idle controlled shutdown.
 */
export function createRouteGate({
  log, lifecycleSlots, installStartup, bootstrapStartup, assertRunnable, isDisposing,
}) {
  /**
   * Bounded slot resolution: the same slot object may be re-entered only
   * through an actual state TRANSITION (STARTUP -> READY, READY -> REAP …).
   * A process that rejects startup without running its own convergence —
   * settled-STARTUP zombie — or a shutdown that resolves without a slot
   * transition would otherwise spin the re-entry recursion; those fail loud
   * instead. The busy/reaping CONVERGENCE WAITS live in the executor's
   * deadline-bounded retry loop, not here.
   */
  async function resolveSlot(agentId, wanted, seenStates) {
    const slot = lifecycleSlots.get(agentId)
    if (slot !== undefined) {
      const visited = seenStates.get(slot) ?? new Set()
      if (visited.has(slot.state)) {
        throw Object.assign(
          new Error(`agent-router: lifecycle slot for ${agentId} did not converge (state ${slot.state}, generation ${slot.generation ?? 'n/a'}) — route acquisition fails loud`),
          { code: 'AGENT_PROCESS_SLOT_STALLED' },
        )
      }
      visited.add(slot.state)
      seenStates.set(slot, visited)
    }
    if (slot?.state === 'READY') {
      const proc = slot.processRef
      if (proc.exit !== undefined) {
        lifecycleSlots.delete(agentId)
        log.log(`process for ${agentId} exited (${proc.exit?.code ?? 'signal'}); will respawn`)
      } else if (wanted.routeIdentity === undefined || slot.routeIdentity === wanted.routeIdentity) {
        return { status: 'ready', proc }
      } else {
        if (busyProcess(proc)) {
          // Busy mismatched process: never killed, never reused (DEC-IMPL-004).
          return { status: 'busy_mismatch', generation: slot.generation }
        }
        if (typeof proc.shutdown !== 'function') {
          throw Object.assign(
            new Error(`agent-router: mismatched idle process for ${agentId} exposes no controlled shutdown — refusing route switch`),
            { code: 'AGENT_PROCESS_SHUTDOWN_UNAVAILABLE' },
          )
        }
        // Idle mismatch: the EXISTING controlled shutdown path (graceful then
        // one exact SIGKILL, real exit awaited, REAP -> EMPTY via the exit
        // callbacks). Only after its convergence may a new generation spawn.
        log.log(`route mismatch for ${agentId} (generation ${slot.generation}): controlled shutdown before new-generation spawn`)
        await proc.shutdown()
        return resolveSlot(agentId, wanted, seenStates)
      }
    } else if (slot?.state === 'STARTUP') {
      await slot.resultPromise.catch(() => {})
      return resolveSlot(agentId, wanted, seenStates)
    } else if (slot?.state === 'REAP') {
      return { status: 'reaping', generation: slot.generation }
    }
    const entry = installStartup(agentId)
    if (wanted.routeIdentity !== undefined || wanted.processConfig !== undefined) {
      entry.spawnConfig = Object.freeze({
        routeIdentity: wanted.routeIdentity ?? null,
        processConfig: wanted.processConfig ?? null,
      })
    }
    void bootstrapStartup(agentId, entry)
    return entry.resultPromise.then((proc) => ({ status: 'ready', proc }))
  }

  /**
   * Route-aware find-or-start: same lifecycle-entry semantics as
   * ensureRunning, plus the DEC-IMPL-004 identity gate. Rejections carry the
   * unchanged structured startup errors (spawn_failed_without_child family).
   */
  function ensureRunningForRoute(agentId, wanted = {}) {
    if (isDisposing()) {
      return Promise.reject(Object.assign(new Error('agent-router: process registry is disposing'), { code: 'AGENT_PROCESS_DRAINING' }))
    }
    try {
      assertRunnable(agentId)
    } catch (error) {
      return Promise.reject(error)
    }
    return resolveSlot(agentId, wanted, new Map())
  }

  return { ensureRunningForRoute }
}
