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
  constructor({ deps, retries = 3 }) {
    this.deps = deps
    this.retries = retries
  }

  async dispatch(event) {
    if (!this.deps?.createGovernanceItem || !this.deps?.resolveOwner || !this.deps?.notify || !this.deps?.deliveryReceipt) {
      return { delivered: false, reason: 'R30_ESCALATION_DEPENDENCIES_UNCONFIGURED' }
    }
    let lastError
    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      try {
        const item = await this.deps.createGovernanceItem({ type: 'AGENT_RECOVERY_ESCALATION', ...event })
        const owner = await this.deps.resolveOwner({ agentId: event.agentId, target: event.target })
        const notification = await this.deps.notify({ itemId: item.itemId, owner, event })
        const receipt = await this.deps.deliveryReceipt({ itemId: item.itemId, notificationId: notification.notificationId })
        if (receipt?.delivered !== true) throw Object.assign(new Error('notification delivery receipt not confirmed'), { code: 'ESCALATION_DELIVERY_UNCONFIRMED' })
        return { delivered: true, itemId: item.itemId, owner, notificationId: notification.notificationId, receipt }
      } catch (error) { lastError = error }
    }
    return { delivered: false, reason: lastError?.code ?? 'ESCALATION_DELIVERY_FAILED', attempts: this.retries }
  }
}
