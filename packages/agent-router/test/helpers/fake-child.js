/**
 * Deterministic fault-injection harness for AGENT_PROCESS_LIFECYCLE_
 * HARDENING_V2 (packages/agent-router/src/process.js).
 *
 * Drives the REAL AgentProcess class with a controllable fake OS child
 * attached through the production wiring path (`attachChild`): stdin writes
 * are captured (with sync-throw / callback-error injection points), stdout
 * notifications are emitted through the real `onStdout` parser, and
 * child error/exit plus stdin error/close are triggered on demand. Fully
 * deterministic — no wall-clock sleeps beyond explicit awaits.
 *
 * `counts()` returns the §10.3 S/W/K/R counters (spawnAttempts /
 * promptWriteAttempts / rpcResponseWriteAttempts / gracefulShutdownWrite-
 * Attempts / killSignals / replayAdmissions) plus responseWrite records.
 */

import { AgentProcess } from '../../src/process.js'
import { TurnReconciliationStore } from '../../src/reconciliation-store.js'

/** Fast deadline fixture (ms) — every test can override per field. */
export const FX_DEADLINES = Object.freeze({
  initializeTimeoutMs: 600,
  promptReceiptTimeoutMs: 250,
  turnTimeoutMs: 900,
  shutdownGraceMs: 200,
})

export function makeFakeChild({ pid = 4242 } = {}) {
  const child = {
    pid,
    killSignals: [],
    writes: [],
    handlers: {},
    stdin: {
      handlers: {},
      syncThrowNext: undefined,
      callbackErrorNext: undefined,
      holdCallbacks: false,
      on(event, fn) { this.handlers[event] = fn },
      write(line, callback) {
        child.writes.push(JSON.parse(line))
        if (this.syncThrowNext !== undefined) {
          const error = this.syncThrowNext
          this.syncThrowNext = undefined
          throw error
        }
        if (typeof callback === 'function') {
          if (this.callbackErrorNext !== undefined) {
            const error = this.callbackErrorNext
            this.callbackErrorNext = undefined
            queueMicrotask(() => callback(error))
            return true
          }
          if (!this.holdCallbacks) queueMicrotask(() => callback(null))
        }
        return true
      },
    },
    stdout: { handler: null, on(event, fn) { if (event === 'data') this.handler = fn } },
    stderr: { handler: null, on(event, fn) { if (event === 'data') this.handler = fn } },
    once(event, fn) { this.handlers[event] = fn },
    kill(signal) { this.killSignals.push(signal) },
  }
  return child
}

export function makeFx({ deadlines, generation, integration, ...ctorOpts } = {}) {
  const store = new TurnReconciliationStore()
  const child = makeFakeChild()
  const slotOps = []
  const registryIntegration = {
    casReap(proc, cause) {
      slotOps.push({ op: 'casReap', generation: proc.processGeneration, cause, ownershipToken: proc.ownershipToken ?? null })
      if (integration?.casReap) integration.casReap(proc, cause)
      return { fence: true }
    },
    casStartupEmpty(proc) {
      slotOps.push({ op: 'casStartupEmpty', generation: proc.processGeneration, processRefNone: proc.ownership === null })
      if (integration?.casStartupEmpty) integration.casStartupEmpty(proc)
      return true
    },
    casEmpty(proc) {
      slotOps.push({ op: 'casEmpty', generation: proc.processGeneration, ownershipToken: proc.ownershipToken ?? null })
      if (integration?.casEmpty) integration.casEmpty(proc)
      return true
    },
    verifyReapOwnership: (proc) => (integration?.verifyReapOwnership ? integration.verifyReapOwnership(proc) : true),
  }
  const proc = new AgentProcess({
    agentId: 'agt_fx',
    home: '/tmp/fx-home',
    workspace: '/tmp/fx-ws',
    profile: 'fx-profile',
    log: { log() {}, error() {} },
    ...(Object.keys(ctorOpts).length === 0 ? {} : ctorOpts),
    processGeneration: generation ?? 1,
    deadlines: { ...FX_DEADLINES, ...(deadlines ?? {}) },
    reconciliationStore: store,
    registryIntegration,
  })
  proc.attachChild(child)
  // The harness attach IS one successful spawn attempt of the fake child.
  proc.counters.spawnAttempts += 1

  const tick = () => new Promise((resolve) => setImmediate(resolve))
  const fx = {
    proc,
    child,
    store,
    slotOps,
    writes: child.writes,
    tick,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    counts: () => ({ ...proc.counters }),
    /** §10.3 evidence snapshot of pending count + fence. */
    pendingSize: () => proc.pending.size,
    fence: () => (proc.activeUnknownFence === null ? false : proc.activeUnknownFence.handle),
    emit(message) { child.stdout.handler(`${JSON.stringify(message)}\n`) },
    emitEvent(sessionId, event) { fx.emit({ method: 'session.event', params: { sessionId, event } }) },
    emitStatus(sessionId, status) { fx.emit({ method: 'session.status', params: { sessionId, status } }) },
    respondTo(method, result) {
      const write = [...child.writes].reverse().find(candidate => candidate.method === method)
      if (write === undefined) throw new Error(`fx: no ${method} request to respond to`)
      fx.emit({ id: write.id, result })
      return write
    },
    async readyNow({ providers } = {}) {
      const pendingReady = proc.ready()
      await tick()
      fx.respondTo('initialize', { registeredProviders: providers ?? [proc.provider] })
      await pendingReady
      return proc
    },
    completeTurn(sessionId, messageId, replyText, { turn = 1 } = {}) {
      fx.emitEvent(sessionId, { type: 'agent/inbox/spliced', data: { inserted: [{ id: messageId }] } })
      fx.emitEvent(sessionId, { type: 'turn/start', data: { turn } })
      fx.emitEvent(sessionId, { type: 'user/message', data: { id: messageId } })
      fx.emitEvent(sessionId, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: replyText }] } } })
      fx.emitEvent(sessionId, { type: 'turn/end', data: { turn, reason: { kind: 'completed' } } })
      fx.emitStatus(sessionId, 'idle')
    },
    childExit(code = 0, signal = null) { child.handlers.exit?.(code, signal) },
    childError(error) { child.handlers.error?.(error) },
    stdinError(error) { child.stdin.handlers.error?.(error) },
    stdinClose() { child.stdin.handlers.close?.() },
  }
  return fx
}
