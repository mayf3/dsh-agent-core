/** R28 safe auto-recovery and recurrence escalation contracts. */

export class RecoveryRecurrenceMonitor {
  constructor({ thresholdMs = 5 * 60 * 1000, escalate, now = () => Date.now() }) {
    this.thresholdMs = thresholdMs
    this.escalate = escalate
    this.now = now
    this.failures = new Map()
    this.escalated = new Set()
  }

  async observe({ agentId, generation, reason, occurredAt = this.now() }) {
    const key = `${agentId}:${generation}`
    const prior = this.failures.get(key)
    const fault = prior ?? { firstSeenAt: occurredAt, count: 0 }
    fault.count += 1
    fault.lastSeenAt = occurredAt
    this.failures.set(key, fault)
    const ageMs = occurredAt - fault.firstSeenAt
    if (ageMs >= this.thresholdMs && !this.escalated.has(key)) {
      this.escalated.add(key)
      await this.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason, count: fault.count, firstSeenAt: fault.firstSeenAt, ageMs })
    }
    return { agentId, generation, count: fault.count, ageMs, escalated: this.escalated.has(key) }
  }
}

export function createSafeRecoveryCallback({ registrySnapshot, lifecycleSlotSnapshot, recover, escalate }) {
  return async ({ agentId, reason, generation }) => {
    const slot = lifecycleSlotSnapshot(agentId)
    const live = registrySnapshot().some(row => row.agentId === agentId && row.alive === true)
    const safe = !live && slot.state === 'EMPTY' && slot.generation === undefined
    if (!safe) {
      await escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason, outcome: 'unsafe_auto_recovery' })
      return { outcome: 'escalated', reason: 'unsafe_auto_recovery' }
    }
    try {
      const result = await recover({ agentId, generation })
      return { outcome: 'recovered', result }
    } catch (error) {
      await escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason, outcome: 'recovery_failed', errorCode: error.code ?? 'RECOVERY_FAILED' })
      return { outcome: 'escalated', reason: 'recovery_failed', errorCode: error.code ?? 'RECOVERY_FAILED' }
    }
  }
}
