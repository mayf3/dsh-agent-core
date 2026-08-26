/**
 * @agent-core/agent-router/src/process-registry.js — the per-Agent process
 * registry and its lifecycle slots (AGENT_PROCESS_LIFECYCLE_HARDENING_V2
 * C-006..C-009, extracted from src/index.js in the PR #42 structure
 * refactor — no semantic change; the review F-1 no-child startup wedge
 * discipline and the F-2 apply-boundary cross-check live elsewhere/verbatim).
 *
 * The registry is the read-only READY view of ONE linearizable lifecycle
 * slot per Agent:
 *
 *   EMPTY (absent) | STARTUP { generation, entryId, resultPromise,
 *                             processRef } | READY { ..., ownershipToken }
 *   | REAP { generation, entryId, processRef, ownershipToken,
 *            reapPromise, cause }
 *
 * Every mutation is an identity compare-and-swap on the exact slot object
 * (single JS thread); STARTUP/READY -> REAP is an ATOMIC replace (never
 * delete-then-set: no pre-real-exit EMPTY window could admit a new
 * generation), and REAP -> EMPTY compares generation + entryId +
 * processRef + ownershipToken.
 */

import { randomUUID } from 'node:crypto'

import { redactSensitiveText } from './process/index.js'
import { createParentRpcHandler } from './parent-rpc-relay.js'
import { canonicalRouteIdentity } from './route-chain.js'
import { createRouteGate, installStartupSlot } from './process-registry-route-gate.js'
import { convergeStartedStartup, disposeProcessSlots, startupFailure } from './process-registry-startup.js'

/**
 * Create the per-Agent process registry bound to one router mount.
 * @param {object} deps
 * @param {object} deps.log - structured logger.
 * @param {object} deps.cfg - validated router config (agentProfile).
 * @param {object} deps.workspaceBootstrap - workspace-bootstrap service.
 * @param {object} deps.agentDefinition - Agent Definition service.
 * @param {object} deps.deadlineConfig - resolved four-field deadline config
 *   (CLAUSE-PROC-DEADLINE-CONFIG; static per-Agent overrides).
 * @param {object} deps.reconciliationStore - the Router reconciliation store.
 * @param {function} deps.processFactory - (opts) => proc; default
 *   AgentProcess, injectable in tests.
 * @param {function} deps.resolveProcessConfig - (agentId) => process config.
 * @param {function} deps.provisionHome - (home, workspace, opts) => void;
 *   defaults to provisionAgentHome.
 * @param {function} deps.switchAgent - the unified switch domain operation
 *   (binding-resolution) wired into the per-process parent-RPC relay.
 * @param {function} deps.getBrokerGateway - () => broker gateway service
 *   (ctx.get('brokerGateway'), resolved lazily per request).
 */
export function createProcessRegistry({
  log, cfg, workspaceBootstrap, agentDefinition, deadlineConfig, reconciliationStore,
  processFactory, resolveProcessConfig, provisionHome, switchAgent, getBrokerGateway,
}) {
  /** agentId -> lifecycle slot (one live owner per agent). */
  const lifecycleSlots = new Map()
  /** agentId -> last issued processGeneration (monotonic per Agent). */
  const agentGenerations = new Map()
  /** Bounded stale-callback audit (old generation late error/exit). */
  const staleSlotAudits = []
  let disposing = false

  // DEC-IMPL-004 route-aware reuse gate (ordered route chain Q-4): the
  // route-aware ensureRunning variant the unified chain executor calls.
  const routeGate = createRouteGate({
    log,
    lifecycleSlots,
    installStartup: (agentId) => installStartup(agentId),
    bootstrapStartup,
    assertRunnable,
    isDisposing: () => disposing,
  })

  function auditStaleSlot(detail) {
    staleSlotAudits.push({ detail, observedAtWallMs: Date.now() })
    if (staleSlotAudits.length > 64) staleSlotAudits.shift()
  }

  /** CAS(EMPTY -> STARTUP) — synchronous, before any further async work. */
  function installStartup(agentId) {
    return installStartupSlot(lifecycleSlots, agentGenerations, agentId)
  }

  /**
   * C-008: atomically replace the exact STARTUP|READY entry of THIS process
   * with a same-generation REAP fence (fresh entryId). Returns the fence
   * entry, or null for a stale/foreign callback (bounded audit only — a late
   * old-generation callback may never mutate the slot).
   */
  function casReapSlot(agentId, proc, cause) {
    const slot = lifecycleSlots.get(agentId)
    if (slot === undefined || slot.processRef !== proc
        || (slot.state !== 'STARTUP' && slot.state !== 'READY')) {
      auditStaleSlot(`casReap ignored for agent ${agentId}: slot ${slot?.state ?? 'EMPTY'} does not identity-match the callback's process`)
      return null
    }
    let resolveReap
    const reapPromise = new Promise((resolveReapPromise) => { resolveReap = resolveReapPromise })
    const reapEntry = {
      state: 'REAP',
      generation: slot.generation,
      entryId: randomUUID(),
      processRef: slot.processRef,
      ownershipToken: proc.ownershipToken ?? null,
      reapPromise,
      resolveReap,
      cause,
    }
    lifecycleSlots.set(agentId, reapEntry) // atomic replace — never EMPTY before real exit
    return reapEntry
  }

  /**
   * The ONLY path allowed to reach EMPTY without a REAP fence: a proven
   * no-child spawn failure (processRef exists but proc.ownership === null —
   * no OS process was ever created; C-008/C-009).
   */
  function casStartupEmptySlot(agentId, proc) {
    const slot = lifecycleSlots.get(agentId)
    if (slot === undefined || slot.state !== 'STARTUP' || slot.processRef !== proc) {
      auditStaleSlot(`casStartupEmpty ignored for agent ${agentId}: slot ${slot?.state ?? 'EMPTY'} does not identity-match the no-child process`)
      return false
    }
    if (proc.ownership !== null && proc.ownership !== undefined) {
      auditStaleSlot(`casStartupEmpty refused for agent ${agentId}: a child object exists — the REAP fence path is mandatory`)
      return false
    }
    lifecycleSlots.delete(agentId)
    return true
  }

  /** CAS(exact REAP -> EMPTY): generation + entryId + processRef + ownership. */
  function casEmptySlot(agentId, proc) {
    const slot = lifecycleSlots.get(agentId)
    if (slot === undefined || slot.state !== 'REAP'
        || slot.processRef !== proc
        || slot.generation !== proc.processGeneration
        || slot.ownershipToken !== (proc.ownershipToken ?? null)) {
      auditStaleSlot(`casEmpty ignored for agent ${agentId}: slot ${slot?.state ?? 'EMPTY'} identity mismatch (late old-generation cleanup)`)
      return false
    }
    lifecycleSlots.delete(agentId)
    slot.resolveReap()
    return true
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
  function settleStartupEntry(entry, error) {
    if (entry.startupSettled) return false
    entry.startupSettled = true
    entry.rejectResult(error)
    return true
  }

  function failStartupSlotNoChild(agentId, entry, cause) {
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
  function reapOnExitPromise(agentId, proc) {
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

  /** Find the slot-owned process that is live-tracking one handle. */
  function findOwningProcess(turnExecutionId) {
    for (const slot of lifecycleSlots.values()) {
      const proc = slot.processRef
      if (proc !== null && proc !== undefined
          && typeof proc.executions === 'object' && proc.executions?.has(turnExecutionId)) {
        return proc
      }
    }
    return null
  }

  /**
   * DISABLED_ENFORCEMENT (merge review FIX 1): the Agent Definition config
   * is the ONLY authority for which agents may RUN. Unknown or disabled
   * agents get a structured rejection at the LIFECYCLE ENTRY — NEVER
   * spawned, not even when an existing Binding still points at them.
   * Existing bindings are left untouched (the Binding table keeps the
   * history); this only prevents the disabled agent from being (re)started.
   * The read is a synchronous in-memory lookup (the definition is loaded
   * once at construction) — no config/database I/O on the message hot path.
   * @param {string} agentId
   * @throws {Error} code `AGENT_NOT_FOUND` (unknown) or `AGENT_DISABLED`.
   */
  function assertRunnable(agentId) {
    const defined = agentDefinition.getAgent(agentId) // throws AGENT_NOT_FOUND when unknown
    if (defined.disabled === true) {
      throw Object.assign(new Error(`agent-router: agent ${agentId} is disabled (not runnable)`), { code: 'AGENT_DISABLED' })
    }
  }

  /**
   * Find-or-start the agent's DSH process — the C-006..C-009 lifecycle slot
   * read: READY returns the process, STARTUP shares one generation-bound
   * startup resultPromise, REAP rejects AGENT_PROCESS_REAPING immediately,
   * EMPTY wins exactly one CAS(EMPTY -> STARTUP) before any async work.
   * Only READY processes are ever returned (registry exposes READY only).
   */
  function ensureRunning(agentId) {
    if (disposing) return Promise.reject(Object.assign(new Error('agent-router: process registry is disposing'), { code: 'AGENT_PROCESS_DRAINING' }))
    // B01 / C-007: the EMPTY -> STARTUP linearization point is synchronous
    // and precedes every asynchronous bootstrap step, including workspace
    // seeding. Returning the entry's exact resultPromise (rather than an
    // async wrapper) makes the whole bootstrap a true single flight.
    try {
      assertRunnable(agentId)
    } catch (error) {
      return Promise.reject(error)
    }
    const initial = lifecycleSlots.get(agentId)
    if (initial?.state === 'READY') {
      if (initial.processRef?.exit === undefined) {
        log.log(`reuse process for ${agentId} (pid ${initial.processRef?.pid})`)
        return Promise.resolve(initial.processRef)
      }
      lifecycleSlots.delete(agentId)
      log.log(`process for ${agentId} exited (${initial.processRef.exit?.code ?? 'signal'}); will respawn`)
    } else if (initial?.state === 'STARTUP') {
      return initial.resultPromise
    } else if (initial?.state === 'REAP') {
      return Promise.reject(Object.assign(new Error(`agent-router: agent ${agentId} generation ${initial.generation} is reaping (${initial.cause ?? 'fatal'}) — new startup forbidden until its real exit`), { code: 'AGENT_PROCESS_REAPING' }))
    }
    const entry = installStartup(agentId)
    void bootstrapStartup(agentId, entry)
    return entry.resultPromise
  }

  async function bootstrapStartup(agentId, entry) {
    try {
      entry.startupFailureStage = 'workspaceBootstrap.ensure'
      await workspaceBootstrap.ensure(agentId)
      if (disposing) throw Object.assign(new Error('agent-router: registry disposed during startup'), { code: 'AGENT_PROCESS_DRAINING' })
      await startProcessForSlot(agentId, entry)
    } catch (cause) {
      if (entry.startupSettled) return
      if (entry.processRef === null) {
        failStartupSlotNoChild(agentId, entry, cause)
        return
      }
      convergeStartedStartup({
        agentId, entry, cause, empty: casStartupEmptySlot, reap: casReapSlot,
        settle: settleStartupEntry,
        teardownFailure: fatalCause => auditStaleSlot(`startup fatal convergence failed for ${agentId}: ${redactSensitiveText(String(fatalCause?.message ?? fatalCause)).slice(0, 1024)}`),
      })
    }
  }

  /** Spawn + initialize one generation for an installed STARTUP slot. */
  async function startProcessForSlot(agentId, entry) {
    // F-1 (C-008 no-child discipline): every synchronous pre-spawn
    // preparation step is failure-converged — a throw settles the shared
    // startup promise exactly once and cleans the exact STARTUP slot to
    // EMPTY via identity CAS (no REAP, no shutdown write, no kill; the next
    // ensureRunning retries; stale first-generation cleanups are audit-only).
    let workspace
    let home
    let processConfig
    try {
      entry.startupFailureStage = 'resolveWorkspace'
      // workspace-bootstrap is the single owner of the agentId -> workspace /
      // DSH_HOME mapping (D-002 boundary). The router only decides WHEN to
      // start the agent, not where its home lives — so it calls the service
      // without any root override.
      workspace = workspaceBootstrap.resolveWorkspace(agentId)
      entry.startupFailureStage = 'resolveDshHome'
      home = workspaceBootstrap.resolveDshHome(agentId)
      entry.startupFailureStage = 'resolveProcessConfig'
      // Route-chain spawns freeze the wanted route's process config onto the
      // slot at turn-start snapshot time (parent CTR-007); legacy spawns keep
      // resolving the default route here (process-boundary re-read only).
      processConfig = entry.spawnConfig?.processConfig ?? resolveProcessConfig(agentId) ?? {}
      // DEC-IMPL-004 reuse identity: recorded on the slot so the route gate
      // can compare later attempts against this process's frozen route.
      entry.routeIdentity = entry.spawnConfig?.routeIdentity ?? canonicalRouteIdentity(processConfig)
      // Provision the agent home (settings/credentials/profile/plugin farm)
      // and the workspace directory — idempotent. The provisioning is driven
      // by cfg.agentProfile: whatever profile this router spawns must be
      // fully installed HERE, so a fresh Agent works without any external
      // pre-provisioning (FIX 1).
      entry.startupFailureStage = 'provisionHome'
      provisionHome(home, workspace, {
        profile: cfg.agentProfile,
        ...(processConfig.subscription === undefined ? {} : { subscription: processConfig.subscription }),
      })
    } catch (cause) {
      throw failStartupSlotNoChild(agentId, entry, cause)
    }
    const registryIntegration = {
      casReap: (proc, cause) => casReapSlot(agentId, proc, cause),
      casStartupEmpty: (proc) => casStartupEmptySlot(agentId, proc),
      casEmpty: (proc) => casEmptySlot(agentId, proc),
      verifyReapOwnership: (proc) => {
        const slot = lifecycleSlots.get(agentId)
        return slot?.state === 'REAP'
          && slot.processRef === proc
          && slot.ownershipToken === (proc.ownershipToken ?? null)
      },
    }
    let proc
    try {
      entry.startupFailureStage = 'processFactory'
      proc = processFactory({
        agentId,
        home,
        workspace,
        profile: cfg.agentProfile,
        provider: processConfig.provider,
        model: processConfig.model,
        providerEnv: processConfig.providerEnv,
        omitEnv: processConfig.omitEnv,
        log,
        // The per-agent process must know its own identity: the memory plugin
        // and the switch tool resolve agentId from $DSH_AGENT_ID when set.
        // DSH_PRIMARY_WORKSPACE (AGENT_PRIMARY_WORKSPACE_IMPORT_V1 §4) is the
        // SAME mechanical pass-through: the control plane's already-resolved
        // primary workspace (resolveWorkspace output above — the single path
        // authority). The Router only hands the value to the child process's
        // session-less memory resolution; it never re-derives the path and
        // never branches on it.
        env: { DSH_AGENT_ID: agentId, DSH_PRIMARY_WORKSPACE: workspace },
        // V2 lifecycle wiring: monotonic generation, the static per-Agent
        // resolved deadline config (immutable for this process), the shared
        // Router reconciliation store and the identity-CAS slot integration.
        processGeneration: entry.generation,
        deadlines: deadlineConfig.perAgent(agentId),
        reconciliationStore,
        registryIntegration,
      })
    } catch (cause) {
      throw failStartupSlotNoChild(agentId, entry, cause)
    }
    entry.processRef = proc
    // DSH tool relay: a per-agent process asks the Control Plane to run a
    // Router domain operation (switch) or a trusted Broker capability call
    // (broker). The tool itself owns no policy — it forwards the request;
    // every decision happens in the Router (parent-rpc-relay.js).
    proc.onRpcRequest = createParentRpcHandler({
      agentId,
      log,
      getProc: () => proc,
      getBrokerGateway,
      switchAgent,
    })
    try {
      entry.startupFailureStage = 'spawn'
      proc.spawn()
    } catch (error) {
      // No-child spawn failure: the process already ran its explicit
      // no-child DRAINING/EXITED bookkeeping (spawn_failed_without_child +
      // casStartupEmpty). Settle the shared startup callers exactly once NOW
      // (bounded — never waiting for an OS reap that cannot exist) and run
      // the idempotent router-side identity-CAS backstop for duck-typed
      // process objects that did not perform their own cleanup.
      error.agentId = agentId
      error.processGeneration = entry.generation
      error.startupFailureStage = 'spawn'
      // Bounded redacted evidence for the no-child spawn failure too.
      auditStaleSlot(`pre-spawn startup failure (no child) for agent ${agentId} generation ${entry.generation} [spawn]: ${redactSensitiveText(String(error?.message ?? error)).slice(0, 2048)}`)
      settleStartupEntry(entry, error)
      if (proc.ownership === null || proc.ownership === undefined) {
        casStartupEmptySlot(agentId, proc)
      }
      throw error
    }
    // Legacy/duck-typed reap fallback (idempotent with the integration CAS).
    reapOnExitPromise(agentId, proc)
    try {
      await proc.ready()
    } catch (error) {
      // C-008: startup caller settlement is bounded at failure observation;
      // the generation reap fence + teardown continue process-owned.
      settleStartupEntry(entry, error)
      throw error
    }
    // Startup success is an identity CAS: only the exact STARTUP entry may
    // become READY; a CAS failure means the process must never be exposed.
    if (lifecycleSlots.get(agentId) !== entry) {
      auditStaleSlot(`startup CAS failed for agent ${agentId}: slot moved before READY — fatal teardown of the unexposed process`)
      const casError = Object.assign(new Error(`agent-router: startup slot CAS failed for ${agentId}; process not exposed`), { code: 'AGENT_PROCESS_SLOT_CAS_FAILED' })
      settleStartupEntry(entry, casError)
      if (typeof proc.fatal === 'function') void proc.fatal('registry_cas_failed')
      throw casError
    }
    entry.state = 'READY'
    entry.ownershipToken = proc.ownershipToken ?? null
    entry.startupSettled = true
    entry.resolveResult(proc)
    return proc
  }

  /** Test/ops: READY-only registry snapshot (C-006 projection). */
  function registrySnapshot() {
    return [...lifecycleSlots.entries()]
      .filter(([, slot]) => slot.state === 'READY' && slot.processRef !== null)
      .map(([agentId, slot]) => ({
        agentId,
        pid: slot.processRef.pid,
        alive: slot.processRef.exit === undefined,
        home: slot.processRef.home,
        workspace: slot.processRef.workspace,
        profile: slot.processRef.profile,
        sessions: (slot.processRef.creations ?? []).map(c => ({ ...c })),
      }))
  }

  /** Test/ops: one Agent's lifecycle slot view (EMPTY|STARTUP|READY|REAP). */
  function lifecycleSlotSnapshot(agentId) {
    const slot = lifecycleSlots.get(agentId)
    if (slot === undefined) return { state: 'EMPTY' }
    return {
      state: slot.state,
      generation: slot.generation,
      entryId: slot.entryId,
      ...(slot.routeIdentity === null || slot.routeIdentity === undefined ? {} : { routeIdentity: slot.routeIdentity }),
      ...(slot.cause === undefined ? {} : { cause: slot.cause }),
      ...(slot.state === 'STARTUP' ? { startupSettled: slot.startupSettled === true } : {}),
    }
  }

  /** Test/ops: bounded lifecycle-slot stale-callback audit. */
  function staleSlotAuditsSnapshot() {
    return staleSlotAudits.map(entry => ({ ...entry }))
  }

  /** Plugin teardown: await every owned process's real-exit shutdown. */
  async function dispose() {
    disposing = true
    await disposeProcessSlots(lifecycleSlots, (agentId, slot) => {
      failStartupSlotNoChild(agentId, slot,
        Object.assign(new Error('registry disposed during startup'), { code: 'AGENT_PROCESS_DRAINING' }))
    })
    // Exact child-exit callbacks own REAP -> EMPTY; disposal never clears a live fence.
  }

  return {
    lifecycleSlots,
    ensureRunning,
    ensureRunningForRoute: routeGate.ensureRunningForRoute,
    findOwningProcess,
    registrySnapshot,
    lifecycleSlotSnapshot,
    staleSlotAuditsSnapshot,
    dispose,
  }
}
