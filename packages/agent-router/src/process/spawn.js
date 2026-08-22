/**
 * @agent-core/agent-router/src/process/spawn.js — child spawn, ownership
 * binding and the child exit settlement order of the per-agent DSH process
 * client (AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-003, C-009, C-017
 * precedence, C-020).
 *
 * `spawnMethods` compose onto AgentProcess.prototype (agent-process.js).
 * onChildExit runs the C-020 mandatory order synchronously: evidence ->
 * reject pending -> freeze+snapshot parser evidence -> unknown visible ->
 * precedence settlement -> store visible -> release matcher -> REAP->EMPTY
 * -> EXITED -> THEN resolve exitPromise.
 */

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { cliBin } from '../../../agent-provisioning/src/index.js'
import { agentEnv, childSpawnConfig } from './env.js'
import { envelopeCarrier } from './state-machine.js'
import { redactSensitiveText } from './provider-errors.js'

export const spawnMethods = {
  /** Spawn the dsh CLI child. Does not wait for readiness. */
  spawn() {
    this.counters.spawnAttempts += 1
    let spawnConfig
    try {
      spawnConfig = childSpawnConfig(this.log)
    } catch (cause) {
      this.handleSpawnFailureWithoutChild(cause)
      throw cause
    }
    const program = spawnConfig.argv[0]
    const args = [...spawnConfig.argv.slice(1), cliBin(), '--profile', this.profile]
    // Direct setuid is only legal from root or the same uid; anything else
    // (e.g. a 505 parent without the root-bootstrapped helper) must fail
    // LOUD rather than silently run the child at the parent's identity.
    if (spawnConfig.spawnUid !== undefined && spawnConfig.spawnUid !== process.getuid?.() && process.getuid?.() !== 0) {
      const cause = new Error(
        `agent-router: cannot drop child to uid ${spawnConfig.spawnUid} from uid ${process.getuid()} without DSH_AGENT_SPAWN_HELPER`,
      )
      this.handleSpawnFailureWithoutChild(cause)
      throw cause
    }
    let child
    try {
      child = spawn(program, args, {
        cwd: this.workspace,
        env: agentEnv(this.home, this.env, this.omitEnv, this.providerEnv),
        stdio: ['pipe', 'pipe', 'pipe'],
        ...(spawnConfig.spawnUid === undefined ? {} : { uid: spawnConfig.spawnUid, gid: spawnConfig.spawnGid }),
      })
    } catch (cause) {
      this.handleSpawnFailureWithoutChild(cause)
      throw cause
    }
    return this.attachChild(child)
  },

  /**
   * Bind one created child object to this process instance — the single
   * wiring path shared by the real spawn() and deterministic fault-injection
   * harnesses (they construct a controllable child object and attach it).
   */
  attachChild(child) {
    this.child = child
    this.pid = child.pid
    // C-020: unforgeable in-memory ownership token bound to
    // { agentId, processGeneration, childObjectIdentity, pid } at spawn
    // success; every signal/kill must re-match all of them.
    this.ownership = { childObject: child, pid: child.pid, token: randomUUID() }
    this.ownershipToken = this.ownership.token
    this.exitPromise = new Promise((resolveExit) => {
      this.exitResolve = resolveExit
    })
    child.once('error', (error) => this.onChildError(error))
    child.once('exit', (code, signal) => this.onChildExit(code, signal))
    child.stdin.on('error', (error) => this.onStdinBroken(error))
    child.stdin.on('close', () => this.onStdinBroken(new Error('agent-router: stdin pipe closed')))
    child.stderr.on('data', (chunk) => this.onStderr(chunk))
    child.stdout.on('data', (chunk) => this.onStdout(String(chunk)))
    return this
  },

  /**
   * C-009 explicit no-child fatal branch: spawn failed before any OS process
   * existed (sync throw, or async spawn 'error' with no pid). DRAINING
   * bookkeeping, recorded `spawn_failed_without_child` evidence, STARTUP->EMPTY
   * — no REAP, no kill, no exit await.
   */
  handleSpawnFailureWithoutChild(cause) {
    if (this.state === 'EXITED') return
    if (this.state !== 'DRAINING') this.transition('DRAINING')
    this.spawnFailure = { kind: 'spawn_failed_without_child', error: redactSensitiveText(String(cause?.message ?? cause)), atWallMs: Date.now() }
    this.exit = { code: null, signal: null, spawnFailedWithoutChild: true }
    this.rejectQueuedTurns('AGENT_PROCESS_UNAVAILABLE', 'spawn_failed_without_child')
    this.rejectAllPending('AGENT_PROCESS_UNAVAILABLE', { cause: 'spawn_failed_without_child', detail: this.spawnFailure.error })
    this.registryIntegration?.casStartupEmpty?.(this)
    this.transition('EXITED')
    this.exitResolve?.(this.exit)
  },

  onChildError(error) {
    if (this.state === 'EXITED') {
      this.auditBounded({ kind: 'stale_callback', detail: `child error after EXITED: ${redactSensitiveText(String(error?.message ?? error))}` })
      return
    }
    // No pid => no OS process was ever created: the no-child terminal
    // evidence `spawn_failed_without_child` (EXITED definition (a)).
    if (this.pid === undefined && this.exit === undefined) {
      this.handleSpawnFailureWithoutChild(error)
      return
    }
    // Created-child stream/process error: C-003 — reject pending with
    // AGENT_PROCESS_UNAVAILABLE (never masquerade as a real exit) and enter
    // the C-009 fatal teardown. The real exit callback completes the order.
    this.auditBounded({ kind: 'child_error', detail: redactSensitiveText(String(error?.message ?? error)) })
    this.fatal('child_error')
  },

  /**
   * Child real exit — the C-020 mandatory order, synchronously:
   * evidence -> reject pending -> freeze+snapshot parser evidence ->
   * unknown visible -> precedence settlement -> store visible -> release
   * matcher -> REAP->EMPTY -> EXITED -> THEN resolve exitPromise.
   */
  onChildExit(code, signal) {
    if (this.state === 'EXITED') {
      this.auditBounded({ kind: 'stale_callback', detail: `late exit after EXITED (code=${code}, signal=${signal}) — bounded audit only` })
      return
    }
    // 1. atomically mark exact child exit evidence
    this.exit = { code, signal }
    if (this.state === 'SPAWNING' || this.state === 'INITIALIZING' || this.state === 'READY') {
      this.registryIntegration?.casReap?.(this, 'child_exit')
    }
    if (this.state !== 'DRAINING') this.transition('DRAINING')
    // 2. immediately settle/reject every pending RPC; pending.size = 0
    this.rejectAllPending('AGENT_PROCESS_EXITED', { code, signal })
    // 3. freeze input; snapshot parser evidence already received pre-exit
    this.inputFrozen = true
    const exitExecutions = [...this.executions.values()]
    // B09: parser intake is now frozen. Replay every bounded fact received
    // before the freeze so Promise-continuation timing cannot lose an exact
    // receipt/terminal outcome to child_real_exit precedence.
    for (const execution of exitExecutions) this.replayExecutionFromWatermark(execution)
    for (const execution of exitExecutions) {
      if (execution.settled) continue
      // 4. active execution without outcome proof: outcome_unknown visible FIRST
      if (!execution.settled && !execution.unknownMarked) {
        this.markExecutionUnknown(execution, 'child_exit_without_parsed_outcome')
        if (!execution.settled && typeof execution.terminalReject === 'function') {
          execution.terminalReject(envelopeCarrier('outcome_unknown', execution.handle, 'AGENT_PROCESS_CHILD_EXITED',
            `agent ${this.agentId} (generation ${this.processGeneration}) exited (code=${code}, signal=${signal}) without an exact parsed outcome for this turn`, { evidence: execution.evidenceSnapshot() }))
          execution.terminalReject = undefined
        }
      }
      // 5. C-017 precedence: parsed exact outcome (received before the exit
      //    callback) wins over child_real_exit.
      if (execution.terminalEvent !== null) {
        const failed = execution.terminalReason?.kind === 'error'
        this.store.settleLate(execution.handle, {
          lateOutcome: failed ? 'late_failed' : 'late_completed',
          outcomeEvidence: failed ? 'exact_turn_end_failure' : 'exact_turn_end_success',
          terminationEvidence: 'child_real_exit',
          finalAssistantOutput: execution.hasOutput() ? execution.outputSnapshot() : undefined,
        })
      } else {
        this.store.settleLate(execution.handle, {
          lateOutcome: 'terminated_without_outcome',
          terminationEvidence: 'child_real_exit',
          finalAssistantOutput: execution.hasOutput() ? execution.outputSnapshot() : undefined,
        })
      }
      this.releaseFence(execution.handle)
      this.finishExecution(execution)
    }
    // 6. authoritative reconciliation records are visible (in-memory store)
    // 7. local matcher/output copies released (finishExecution above)
    // 8. CAS exact REAP entry -> EMPTY
    this.registryIntegration?.casEmpty?.(this)
    // 9. EXITED
    this.transition('EXITED')
    // exitPromise resolves LAST — never before settlement/reconciliation.
    this.exitResolve?.(this.exit)
  },
}
