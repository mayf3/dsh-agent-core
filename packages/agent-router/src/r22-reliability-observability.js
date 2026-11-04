/** R22 isolated observability contracts for the real agent-router process model. */

export function snapshotAgentProcessHealth({ registrySnapshot, lifecycleSlotSnapshot, agentIds, reconciliationStore = null }) {
  return agentIds.map(agentId => {
    const process = registrySnapshot.find(row => row.agentId === agentId)
    const slot = lifecycleSlotSnapshot(agentId)
    const unresolved = reconciliationStore?.unresolvedRecoveryRecords?.().filter(record => record.agentId === agentId) ?? []
    const restartLost = process === undefined && slot.state === 'EMPTY' && unresolved.length === 1
    const state = process === undefined
      ? (restartLost ? 'AGENT_PROCESS_RESTART_LOST' : (slot.state === 'REAP' && slot.cause ? 'AGENT_PROCESS_EXITED' : slot.state))
      : (process.alive ? 'READY_ALIVE' : 'AGENT_PROCESS_EXITED')
    return {
      type: 'agent.process.health',
      agentId,
      state,
      generation: restartLost ? unresolved[0].processGeneration ?? slot.generation ?? null : slot.generation ?? null,
      pid: process?.pid ?? null,
      alive: process?.alive === true,
      cause: restartLost ? 'RESTART_LOST_FENCE' : slot.cause ?? null,
    }
  })
}

export class ProcessHealthWatch {
  constructor({ snapshot, alert, recover = null, now = () => new Date().toISOString(), faultStore = null }) {
    this.snapshot = snapshot
    this.faultStore = faultStore
    this.alert = alert
    this.recover = recover
    this.now = now
    this.previous = new Map()
    this.openFaults = new Map((faultStore?.recoveryFaultSnapshot?.() ?? []).map(entry => [entry.key, { ...entry }]))
  }

  async check() {
    const observations = this.snapshot().map(observation => ({ ...observation, at: this.now() }))
    for (const observation of observations) {
      const previous = this.previous.get(observation.agentId)
      const key = `${observation.agentId}:${observation.generation ?? 'unknown'}`
      if (observation.state === 'AGENT_PROCESS_EXITED' || observation.state === 'AGENT_PROCESS_RESTART_LOST') {
        const fault = this.openFaults.get(key) ?? { firstSeenAt: observation.at, attempts: 0 }
        fault.lastSeenAt = observation.at
        fault.attempts += 1
        this.openFaults.set(key, fault)
        this.faultStore?.upsertRecoveryFault(key, fault)
        if (previous !== observation.state) await this.alert({ type: 'agent.process.exited', ...observation, fault })
        if (this.recover) await this.recover({ agentId: observation.agentId, reason: observation.state === 'AGENT_PROCESS_RESTART_LOST' ? 'AGENT_PROCESS_RESTART_LOST' : 'AGENT_PROCESS_EXITED', generation: observation.generation, fault })
      } else {
        for (const openKey of this.openFaults.keys()) {
          if (openKey.startsWith(`${observation.agentId}:`)) {
            this.openFaults.delete(openKey)
            this.faultStore?.deleteRecoveryFault(openKey)
          }
        }
      }
      this.previous.set(observation.agentId, observation.state)
    }
    return observations
  }

  openFaultsSnapshot() { return [...this.openFaults.entries()].map(([key, value]) => ({ key, ...value })) }
}

export const ADMISSION_REJECTION_CODES = Object.freeze([
  'FENCE_ACTIVE', 'AGENT_NOT_ADMITTED', 'SESSION_NOT_READY', 'BINDING_NOT_FOUND',
  'PROOF_MISSING', 'PROOF_EXPIRED', 'RUNTIME_UNAVAILABLE',
])

export function structureAdmissionRejection({ requestId, agentId, sessionId = null, fenceId = null, code, detail = null, at = new Date().toISOString() }) {
  if (!requestId || !agentId || !ADMISSION_REJECTION_CODES.includes(code)) {
    throw new TypeError('requestId, agentId and a stable rejection code are required')
  }
  return { type: 'admission.rejected', requestId, agentId, sessionId, fenceId, code, detail, at }
}

export function sessionInjectionReceipt({ requestId, messageId, agentId, sessionId, turnId = null, status, at = new Date().toISOString() }) {
  if (!requestId || !messageId || !agentId || !sessionId || !['INJECTED', 'REJECTED', 'UNKNOWN'].includes(status)) {
    throw new TypeError('requestId, messageId, agentId, sessionId and a valid status are required')
  }
  return { type: 'session.injection_receipt', requestId, messageId, agentId, sessionId, turnId, status, at }
}
