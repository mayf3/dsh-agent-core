/**
 * @agent-core/agent-router/src/process/agent-process.js — one owned DSH
 * agent process (AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-001..C-022 core).
 *
 * `turn()` is the business entry: prompt a session, wait for the receipt +
 * whole-agent idle, return the last assistant text. `exit` settles only
 * after the full child-exit settlement order (C-020) completed.
 *
 * Result envelope carriers (C-010 closed union): `completed` resolves (a
 * superset of the historical `{reply, ms, promptMs, messageId}` shape);
 * `failed`, `not_admitted` and `outcome_unknown` are carried as STRUCTURED
 * Error throws that expose `.status`, `.reconciliationHandle` and
 * `.evidence` — `outcome_unknown` never degrades to a bare string, and the
 * throw shape preserves the unmodifiable external callers' (scheduler
 * bridge / product entries) catch semantics.
 *
 * Module split (structure refactor, semantics unchanged): the constructor
 * and readiness loop live here; spawn/ownership, the RPC channel, event
 * correlation, turn execution, the bounded evidence surfaces, the lifecycle
 * state machine and the shutdown model live in sibling modules and compose
 * onto this single class prototype below — one class, one state machine,
 * one ownership model. Zero DSH imports: only node builtins + the shared
 * provisioning package + the Router reconciliation store.
 */

import { TurnReconciliationStore } from '../reconciliation/index.js'
import { assertPositiveSafeDeadline, monotonicNowMs, stateMachineMethods } from './state-machine.js'
import { FAIL_LOUD_PROVIDER_ERRORS, sanitizeProviderError } from './provider-errors.js'
import { evidenceBufferMethods } from './evidence-buffer.js'
import { rpcChannelMethods } from './rpc-channel.js'
import { eventCorrelationMethods } from './event-correlation.js'
import { turnExecutionMethods } from './turn-execution.js'
import { spawnMethods } from './spawn.js'
import { shutdownMethods } from './shutdown.js'

const sleep = (ms) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms)
  timer.unref?.()
})

export class AgentProcess {
  constructor({
    agentId, home, workspace, profile, provider, model, providerEnv = {}, omitEnv = [],
    log = console, env = {},
    processGeneration = 1,
    deadlines,
    reconciliationStore,
    registryIntegration = null,
  }) {
    if (typeof profile !== 'string' || profile === '') {
      throw new TypeError('AgentProcess: profile is required (no default — the caller owns the composition choice)')
    }
    this.agentId = agentId
    this.home = home
    this.workspace = workspace
    this.profile = profile
    // Immutable for this process lifetime. Production composition resolves a
    // per-Agent override before construction; every create/resume in this
    // process therefore inherits the same initialize route. Non-production
    // callers retain the historical global-env/default behavior.
    this.provider = provider ?? process.env.DSH_AGENT_PROVIDER ?? 'opencode-go'
    this.model = model ?? process.env.DSH_AGENT_MODEL ?? 'deepseek-v4-flash'
    this.providerEnv = Object.freeze({ ...providerEnv })
    this.omitEnv = [...omitEnv]
    this.log = log
    this.env = env // extra env for the child (e.g. DSH_AGENT_ID)

    // --- V2 lifecycle -----------------------------------------------------
    this.processGeneration = processGeneration
    // Four-field deadline config (CLAUSE-PROC-DEADLINE-CONFIG). Validated
    // fail-loud at construction — before any spawn.
    this.deadlines = Object.freeze({
      initializeTimeoutMs: 90000,
      promptReceiptTimeoutMs: 30000,
      turnTimeoutMs: 300000,
      shutdownGraceMs: 30000,
      ...(deadlines ?? {}),
    })
    for (const field of Object.keys(this.deadlines)) {
      assertPositiveSafeDeadline(field, this.deadlines[field])
    }
    this.store = reconciliationStore ?? new TurnReconciliationStore()
    this.registryIntegration = registryIntegration

    this.state = 'SPAWNING'
    this.stateHistory = [{ to: 'SPAWNING', atWallMs: Date.now() }]

    this.pid = undefined
    this.exit = undefined // { code, signal } once real exit observed
    this.exitPromise = undefined
    this.exitResolve = undefined
    this.child = undefined
    this.ownership = null // { childObject, pid, token } once a child was created
    this.ownershipToken = undefined
    this.spawnFailure = null
    this.fatalInitiated = false
    this.fatalCause = null
    this.inputFrozen = false
    this.killSignalSent = false
    this.shutdownPromise = undefined
    this.initializeEvidence = undefined
    this.initializeElapsedMs = undefined

    // --- bounded evidence surfaces ---------------------------------------
    this.eventSeq = 0
    this.eventLog = new Map() // seq -> { params, bytes } (insertion-ordered ring, O(1) eviction)
    this.eventLogBytes = 0
    this.eventsDroppedCount = 0
    this.stderr = ''
    this.stderrDroppedBytes = 0
    this.creations = []
    this.creationsDroppedCount = 0
    this.creationsDroppedBytes = 0
    this.status = {} // sessionId -> last agent status
    this.buf = '' // stdout partial frame (capped; overflow = fatal)

    // --- RPC pending table (C-001..C-004) --------------------------------
    this.pending = new Map()
    this.seq = 0
    this.latePromptTombstones = new Map() // request id -> execution (bounded, C-012)
    this.lateTombstonesDropped = 0

    // --- turn admission (C-013) ------------------------------------------
    /** ChannelConversation of the in-flight turn (switch tool relay target). */
    this.activeBindingContext = undefined
    this.turnQueueEntries = []
    this.turnInFlight = false
    this.queuedPromptBytes = 0
    /** live tracked executions: handle -> TurnExecution */
    this.executions = new Map()
    this.activeUnknownFence = null // { handle, sessionId } while unresolved unknown
    /** Router-installed hook: async (method, params, deadlineCtx) => result. */
    this.onRpcRequest = undefined

    // --- fault-injection oracles (exact counters; §10.3) -----------------
    this.counters = {
      spawnAttempts: 0,
      promptWriteAttempts: 0,
      rpcResponseWriteAttempts: 0,
      gracefulShutdownWriteAttempts: 0,
      killSignals: 0,
      replayAdmissions: 0, // structurally 0: no replay path exists
    }
    this.boundedAudit = [] // last 64 invariant/ownership/stale-callback notes
  }

  /** Historical observability view of the bounded event ring. */
  get events() {
    return [...this.eventLog.values()].map(entry => entry.params)
  }

  // ------------------------------------------------------------- readiness

  /** spawn → initialize (retries bounded by ONE total deadline; C-001). */
  async ready(timeoutMs) {
    if (this.state === 'READY') return this.initializeElapsedMs ?? 0
    const budgetMs = timeoutMs ?? this.deadlines.initializeTimeoutMs
    if (this.state === 'SPAWNING') this.transition('INITIALIZING')
    // Deadline starts at the INITIALIZING transition, before the first
    // initialize write; retries never reset it.
    const initDeadlineMono = monotonicNowMs() + budgetMs
    const startedWall = Date.now()
    for (;;) {
      if (this.exit !== undefined) {
        throw this.spawnFailure !== null
          ? Object.assign(new Error(`spawn failed without child for agent ${this.agentId}: ${this.spawnFailure.error}`), { code: 'AGENT_PROCESS_SPAWN_FAILED' })
          : Object.assign(new Error(`initialize failed for agent ${this.agentId}: child exited (${this.exit.code ?? 'signal'})`), { code: 'AGENT_PROCESS_EXITED' })
      }
      if (monotonicNowMs() >= initDeadlineMono) {
        void this.fatal('initialize_timeout')
        throw Object.assign(new Error(`initialize timeout for agent ${this.agentId}`), { code: 'AGENT_PROCESS_INITIALIZE_TIMEOUT' })
      }
      try {
        const initialized = await this.request('initialize', {
          cwd: this.workspace,
          provider: this.provider,
          model: this.model,
          maxTokens: Number.parseInt(process.env.DSH_AGENT_MAX_TOKENS ?? '8192', 10),
        }, undefined, { deadlineMono: initDeadlineMono })
        if (Array.isArray(initialized?.registeredProviders)
            && !initialized.registeredProviders.includes(this.provider)) {
          if (monotonicNowMs() >= initDeadlineMono) {
            void this.fatal('initialize_timeout')
            throw sanitizeProviderError({
              code: 'provider_unavailable',
              message: `provider ${this.provider} did not register before initialize timeout`,
            }, { agentId: this.agentId, provider: this.provider, model: this.model })
          }
          await sleep(300)
          continue
        }
        this.initializeEvidence = initialized
        this.initializeElapsedMs = Date.now() - startedWall
        this.transition('READY')
        this.log.log?.(`[router] agent ${this.agentId} ready pid=${this.pid} (${this.initializeElapsedMs}ms)`)
        return this.initializeElapsedMs
      } catch (error) {
        if (error?.code === 'AGENT_PROCESS_UNAVAILABLE' || error?.code === 'AGENT_PROCESS_EXITED'
            || error?.code === 'AGENT_PROCESS_INPUT_FROZEN' || error?.code === 'AGENT_PROCESS_PENDING_CAP') {
          // Process-level failure: fatal teardown is already running — the
          // startup caller rejects NOW (bounded), not after the OS reap.
          throw this.spawnFailure !== null
            ? Object.assign(new Error(`spawn failed without child for agent ${this.agentId}: ${this.spawnFailure.error}`), { code: 'AGENT_PROCESS_SPAWN_FAILED' })
            : error
        }
        if (FAIL_LOUD_PROVIDER_ERRORS.has(error?.code)) {
          void this.fatal('initialize_failed')
          throw error
        }
        if (monotonicNowMs() >= initDeadlineMono) {
          void this.fatal('initialize_timeout')
          throw Object.assign(new Error(`initialize timeout for agent ${this.agentId}`), { code: 'AGENT_PROCESS_INITIALIZE_TIMEOUT' })
        }
        await sleep(300)
      }
    }
  }

  // ------------------------------------------------------ turn admission

  /**
   * One owned turn: prompt `sessionId` with `text`, wait for the receipt then
   * the whole-agent idle. Serialized through the bounded per-process turn
   * queue (C-013: one active turn per AgentProcess); the fourth legacy
   * argument is the CALLER wait bound — distinct from the configured
   * `turnTimeoutMs` turn deadline; whichever expires first without
   * termination proof yields `outcome_unknown`.
   * @returns {Promise<{status:'completed', reconciliationHandle, reply, ms,
   *   promptMs, messageId, evidence}>} — failures/not-admitted/unknown are
   *   structured throws carrying the same envelope fields.
   */
  turn(sessionId, text, opts = {}, callerWaitTimeoutMs) {
    return this.enqueuePromptExecution('turn', sessionId, text, opts, callerWaitTimeoutMs)
  }

  /**
   * ADMISSION SEAM (Agent Router Delivery V0): accept one message into a
   * session's inbox WITHOUT waiting for the model turn. Resolves on the
   * demo-server receipt (`session/prompt` response). Not serialized through
   * the turn queue (deliveries never wait for a turn), but the SAME fence at
   * the unified prompt write boundary applies (C-013), and the execution is
   * tracked in the background to its terminal/unknown fence (C-010).
   */
  deliver(sessionId, text, opts = {}, timeoutMs) {
    return this.enqueuePromptExecution('deliver', sessionId, text, opts, timeoutMs)
  }

  // ------------------------------------------------------- scheduler seam

  /**
   * §13.1 minimal owned snapshot per turnExecutionId — the Scheduler
   * termination seam (no Scheduler policy). Absence semantics delegate to
   * the Router reconciliation store.
   */
  turnExecutionSnapshot(turnExecutionId) {
    const record = this.store.getTurnReconciliation(turnExecutionId)
    if (record.state === 'restart_lost' || record.state === 'never_existed' || record.state === 'evicted') {
      return { turnExecutionId, state: record.state }
    }
    const snapshot = record.snapshot
    const execution = this.executions.get(turnExecutionId)
    return {
      turnExecutionId,
      agentId: this.agentId,
      processGeneration: this.processGeneration,
      callerCorrelation: snapshot.callerCorrelation ?? null,
      phase: execution?.phase ?? (snapshot.state === 'settled' ? 'terminal' : 'outcome_unknown'),
      promptReceipt: execution?.promptReceipt ?? (snapshot.messageId !== null && snapshot.messageId !== undefined ? 'accepted' : 'unknown'),
      initialOutcome: snapshot.initialOutcome,
      reconciledOutcome: snapshot.lateOutcome ?? snapshot.outcome ?? null,
      outcomeEvidence: snapshot.outcomeEvidence,
      cancelRequested: snapshot.cancelRequested === true,
      cancelRequestedAtWallMs: snapshot.cancelRequestedAtWallMs ?? null,
      terminationProven: snapshot.terminationEvidence !== null && snapshot.terminationEvidence !== undefined,
      terminationEvidence: snapshot.terminationEvidence ?? null,
      reconciliationHandle: turnExecutionId,
      finalAssistantOutputAvailable: snapshot.finalAssistantOutput !== null && snapshot.finalAssistantOutput !== undefined,
      finalAssistantOutputTruncated: snapshot.finalAssistantOutput?.truncated === true,
      updatedAtWallMs: snapshot.settledAtWallMs ?? snapshot.createdAtWallMs,
    }
  }
}

// One prototype, one state machine: the sibling modules compose their method
// groups onto this single class (structure refactor — no behavior change).
Object.assign(AgentProcess.prototype,
  stateMachineMethods,
  evidenceBufferMethods,
  rpcChannelMethods,
  eventCorrelationMethods,
  turnExecutionMethods,
  spawnMethods,
  shutdownMethods)
