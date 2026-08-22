/**
 * @agent-core/agent-router/src/process/state-machine.js — the AgentProcess
 * lifecycle state machine, deadline primitives and the C-010 result-envelope
 * carriers of AGENT_PROCESS_LIFECYCLE_HARDENING_V2.
 *
 * `stateMachineMethods` compose onto AgentProcess.prototype (agent-process.js);
 * the helper functions are shared by every sibling module (spawn / rpc-channel
 * / turn-execution / event-correlation / evidence-buffer / shutdown).
 */

/** CLAUSE-PROC-LIFECYCLE: the only public lifecycle order. */
export const PROCESS_STATES = Object.freeze(['SPAWNING', 'INITIALIZING', 'READY', 'DRAINING', 'EXITED'])

const LEGAL_PROCESS_TRANSITIONS = new Set([
  'SPAWNING->INITIALIZING',
  'SPAWNING->DRAINING',
  'INITIALIZING->READY',
  'INITIALIZING->DRAINING',
  'READY->DRAINING',
  'DRAINING->EXITED',
])

/** Process-local monotonic clock in ms (C-001: enforcement never reads wall clock). */
export function monotonicNowMs() {
  return Number(process.hrtime.bigint() / 1000000n)
}

/** C-010 result-envelope carrier shared by every prompt-producing path. */
export function envelopeCarrier(status, reconciliationHandle, code, message, extra = {}) {
  const error = new Error(message)
  error.name = 'AgentProcessEnvelopeError'
  error.status = status
  error.envelope = status
  error.reconciliationHandle = reconciliationHandle
  error.code = code
  Object.assign(error, extra)
  return error
}

export function fencedRejection(fenceHandle) {
  return envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_TURN_FENCED',
    `agent ${fenceHandle === undefined ? 'process' : 'process'} has an unresolved outcome_unknown turn; new prompt admission is forbidden until termination is proven`, { fencedBy: fenceHandle ?? null })
}

export function assertPositiveSafeDeadline(field, value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`AgentProcess: deadline ${field} must be a positive safe integer (got ${JSON.stringify(value)}) — validated fail-loud before spawn`)
  }
}

export const stateMachineMethods = {
  transition(next) {
    const from = this.state
    if (from === next && next === 'EXITED') return
    if (!LEGAL_PROCESS_TRANSITIONS.has(`${from}->${next}`)) {
      const error = new Error(`AgentProcess invariant violation: illegal transition ${from} -> ${next} (agent ${this.agentId} generation ${this.processGeneration})`)
      this.auditBounded({ kind: 'invariant_violation', detail: `${from}->${next}` })
      this.log.error?.(error.message)
      if (from !== 'EXITED' && next !== 'EXITED' && !this.fatalInitiated) {
        try { this.fatal('invariant_violation') } catch { /* fatal itself must never mask the invariant */ }
      }
      throw error
    }
    this.state = next
    this.stateHistory.push({ to: next, atWallMs: Date.now() })
    if (this.stateHistory.length > 32) this.stateHistory.shift()
  },
}
