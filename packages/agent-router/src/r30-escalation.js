import { appendFile, readFile } from 'node:fs/promises'

export function createFileRecoveryHistoryStore(file) {
  return {
    async load() {
      try { return (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) } catch (error) {
        if (error.code === 'ENOENT') return []
        throw error
      }
    },
    async append(entry) {
      await appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8')
      return entry
    },
  }
}

export class GovernanceEscalationDispatcher {
  constructor({ deps, retries = 3, stateStore = null, now = () => Date.now() }) {
    this.deps = deps
    this.retries = retries
    this.stateStore = stateStore
    this.now = now
  }

  stateKey(event) { return `escalation:${event.agentId}:${event.generation}` }
  state(event) { return this.stateStore?.recoveryFaultSnapshot?.().find(row => row.key === this.stateKey(event)) }
  save(event, value) { return this.stateStore?.upsertRecoveryFault?.(this.stateKey(event), value) }

  async dispatch(event) {
    if (!this.deps?.createGovernanceItem || !this.deps?.resolveOwner || !this.deps?.notify || !this.deps?.deliveryReceipt) {
      return { delivered: false, reason: 'R30_ESCALATION_DEPENDENCIES_UNCONFIGURED' }
    }
    const prior = this.state(event)
    if (prior?.status === 'NOTIFIED') return { delivered: true, ...prior }
    let itemId = prior?.itemId
    let lastError
    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      try {
        if (!itemId) {
          const item = await this.deps.createGovernanceItem({ type: 'AGENT_RECOVERY_ESCALATION', ...event })
          itemId = item.itemId
          this.save(event, { status: 'ESCALATION_CREATED', itemId, attempts: 0, firstSeenAt: prior?.firstSeenAt ?? this.now() })
        }
        const owner = await this.deps.resolveOwner({ agentId: event.agentId, target: event.target })
        const notification = await this.deps.notify({ itemId, owner, event })
        this.save(event, { status: 'NOTIF_PENDING_RETRY', itemId, attempts: (prior?.attempts ?? 0) + attempt, nextRetryAt: this.now() })
        const receipt = await this.deps.deliveryReceipt({ itemId, notificationId: notification.notificationId })
        if (receipt?.delivered !== true) throw Object.assign(new Error('notification delivery receipt not confirmed'), { code: 'ESCALATION_DELIVERY_UNCONFIRMED' })
        const result = { status: 'NOTIFIED', delivered: true, itemId, owner, notificationId: notification.notificationId, receipt }
        this.save(event, result)
        return result
      } catch (error) {
        lastError = error
        this.save(event, { status: 'NOTIF_PENDING_RETRY', itemId, attempts: (prior?.attempts ?? 0) + attempt, nextRetryAt: this.now(), reason: error.code ?? 'ESCALATION_DELIVERY_FAILED' })
      }
    }
    return { delivered: false, status: 'NOTIF_PENDING_RETRY', itemId, reason: lastError?.code ?? 'ESCALATION_DELIVERY_FAILED', attempts: this.retries }
  }
}
