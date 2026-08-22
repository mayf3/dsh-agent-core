/**
 * @agent-core/agent-router/src/process/shutdown.js — fatal teardown, exact
 * ownership-gated signalling and graceful-then-kill shutdown of the
 * per-agent DSH process client (AGENT_PROCESS_LIFECYCLE_HARDENING_V2
 * C-009, C-020..C-022).
 *
 * `shutdownMethods` compose onto AgentProcess.prototype (agent-process.js).
 * Shutdown resolves only AFTER real exit + pending settlement +
 * reconciliation visibility + exact REAP cleanup; grace expiry escalates to
 * one exact SIGKILL and still awaits the real exit.
 */

import { envelopeCarrier, monotonicNowMs } from './state-machine.js'
import { redactSensitiveText } from './provider-errors.js'

export const shutdownMethods = {
  /**
   * C-009 fatal teardown primitive: CAS exact slot -> REAP FIRST, DRAINING,
   * stop admissions, reject queued, settle pending, authoritative
   * outcome_unknown for unproven executions, immediate-kill exact owned
   * child, await real exit (the exit callback completes the settlement).
   */
  fatal(cause) {
    if (this.state === 'EXITED') return this.exitPromise ?? Promise.resolve(this.exit)
    if (this.fatalInitiated) return this.exitPromise ?? Promise.resolve(this.exit)
    this.fatalInitiated = true
    this.fatalCause = cause
    // First registry mutation: atomic replace of the exact entry with the
    // generation-bound REAP fence (created child only).
    if (this.ownership !== null) {
      this.registryIntegration?.casReap?.(this, cause)
    }
    if (this.state !== 'DRAINING') this.transition('DRAINING')
    this.rejectQueuedTurns('AGENT_PROCESS_DRAINING', `fatal: ${cause}`)
    this.rejectAllPending('AGENT_PROCESS_UNAVAILABLE', { cause })
    for (const execution of [...this.executions.values()]) {
      if (!execution.settled && !execution.unknownMarked) {
        this.markExecutionUnknown(execution, cause)
        if (typeof execution.terminalReject === 'function') {
          execution.terminalReject(envelopeCarrier('outcome_unknown', execution.handle, 'AGENT_PROCESS_UNAVAILABLE',
            `agent ${this.agentId} entered fatal teardown (${cause}) without an outcome proof for this turn`, { source: cause, evidence: execution.evidenceSnapshot() }))
          execution.terminalReject = undefined
        }
      }
    }
    // Fatal policy: immediate kill of the EXACT Router-owned generation.
    this.killOwnedChild('SIGKILL', { cause })
    return this.exitPromise ?? Promise.resolve(this.exit ?? { code: null, signal: null })
  },

  /**
   * C-020: signal only the exact Router-owned child — the lifecycle REAP
   * identity (generation, processRef, ownershipToken, child object AND
   * original pid) must all match. PID equality alone never justifies a kill.
   */
  killOwnedChild(signal = 'SIGKILL', { cause } = {}) {
    if (this.state === 'EXITED' || this.ownership === null) return false
    const ownership = this.ownership
    if (this.child !== ownership.childObject
        || this.child?.pid !== ownership.pid
        || this.ownershipToken !== ownership.token) {
      this.auditBounded({ kind: 'ownership_mismatch', detail: `refusing ${signal} (cause ${cause ?? 'n/a'}): child identity does not match the spawn-time ownership binding` })
      this.log.error?.(`[router] agent ${this.agentId}: ownership mismatch — refusing to ${signal} a non-owned child`)
      return false
    }
    if (this.killSignalSent && signal === 'SIGKILL') return false // exactly one SIGKILL per generation
    if (signal === 'SIGKILL') this.killSignalSent = true
    this.counters.killSignals += 1
    try {
      this.child.kill(signal)
    } catch (cause2) {
      this.auditBounded({ kind: 'kill_failed', detail: redactSensitiveText(String(cause2?.message ?? cause2)) })
    }
    return true
  },

  /** Verify the process still matches a lifecycle REAP ownership binding. */
  verifyOwnership() {
    if (this.ownership === null) return false
    return this.child === this.ownership.childObject
      && this.child?.pid === this.ownership.pid
      && this.ownershipToken === this.ownership.token
  },

  /**
   * Graceful shutdown; resolves with the settled exit evidence only AFTER
   * real exit + pending settlement + reconciliation visibility + exact REAP
   * cleanup (C-020). Concurrent callers share one promise (C-021); grace
   * expiry escalates to one exact SIGKILL and still awaits real exit (C-022).
   */
  async shutdown(timeoutMs) {
    if (this.exit !== undefined) return this.exit
    if (this.shutdownPromise !== undefined) return this.shutdownPromise
    const graceMs = timeoutMs ?? this.deadlines.shutdownGraceMs
    this.shutdownPromise = this.performShutdown(graceMs)
    return this.shutdownPromise
  },

  async performShutdown(graceMs) {
    if (this.exit !== undefined) return this.exit
    if (this.ownership === null || this.child === undefined) {
      // Never-spawned / no-child process: logical DRAINING -> EXITED.
      if (this.state !== 'EXITED') {
        if (this.state !== 'DRAINING') this.transition('DRAINING')
        this.rejectQueuedTurns('AGENT_PROCESS_DRAINING', 'shutdown')
        this.registryIntegration?.casStartupEmpty?.(this)
        this.transition('EXITED')
      }
      return this.exit ?? { code: null, signal: null }
    }
    // Explicit operator/runtime shutdown: graceful-then-kill (C-020/C-022).
    this.registryIntegration?.casReap?.(this, 'shutdown')
    // C-020 ownership gate: when a lifecycle REAP fence exists for this
    // process, its ownership binding (generation + processRef + ownership
    // token) must match BEFORE any graceful write or signal. A mismatch is
    // fail-loud audit + fence retention — never a guessed kill or write.
    if (this.registryIntegration !== null && typeof this.registryIntegration.verifyReapOwnership === 'function'
        && !this.registryIntegration.verifyReapOwnership(this) && this.state !== 'EXITED') {
      this.auditBounded({ kind: 'ownership_mismatch', detail: 'shutdown refused: lifecycle REAP ownership does not match this process' })
      this.log.error?.(`[router] agent ${this.agentId}: shutdown refused — REAP ownership mismatch (kill/write counts stay 0)`)
      throw Object.assign(new Error(`agent-router: shutdown of ${this.agentId} refused — lifecycle REAP ownership mismatch`), { code: 'AGENT_PROCESS_OWNERSHIP_MISMATCH' })
    }
    if (this.state !== 'DRAINING') this.transition('DRAINING')
    this.rejectQueuedTurns('AGENT_PROCESS_DRAINING', 'shutdown')
    // Graceful attempt: ONE shutdown RPC bounded by the grace deadline.
    this.counters.gracefulShutdownWriteAttempts += 1
    await this.request('shutdown', undefined, undefined, {
      deadlineMono: monotonicNowMs() + graceMs,
    }).catch(() => {})
    if (this.exit === undefined) {
      // Grace expiry is ESCALATION, not completion: one exact SIGKILL, then
      // await real exit — never a fake {timeout:true} terminal.
      this.killOwnedChild('SIGKILL', { cause: 'shutdown_grace_expired' })
    }
    await this.exitPromise
    return this.exit
  },

  /** SIGKILL (crash path); resolves with the settled exit. */
  kill9() {
    this.killOwnedChild('SIGKILL', { cause: 'kill9' })
    return this.exitPromise ?? Promise.resolve(this.exit ?? { code: null, signal: null })
  },
}
