/**
 * R21 isolated reliability contracts.
 *
 * These are deliberately pure persistence/decision helpers. The runtime/router
 * integration owns process admission, binding transport, and session driving;
 * this module gives those paths durable facts instead of inferred state.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

async function appendJsonLine(file, event) {
  await mkdir(dirname(file), { recursive: true })
  await appendFile(file, `${JSON.stringify(event)}\n`, 'utf8')
}

async function readEvents(file) {
  try {
    const raw = await readFile(file, 'utf8')
    return raw.split('\n').filter(Boolean).map(line => JSON.parse(line))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

/** Durable admission journal for detecting turns orphaned by process restart. */
export class AdmissionJournal {
  constructor({ file, now = () => new Date().toISOString() }) {
    this.file = file
    this.now = now
  }

  async recordAdmitted(turn) {
    await appendJsonLine(this.file, { type: 'turn.admitted', at: this.now(), ...turn })
  }

  async recordStarted(turn) {
    await appendJsonLine(this.file, { type: 'turn.started', at: this.now(), ...turn })
  }

  async recordCompleted({ turnId, resultDigest = null }) {
    await appendJsonLine(this.file, { type: 'turn.completed', at: this.now(), turnId, resultDigest })
  }

  /** Return admitted/started turns without a completion fact. */
  async interrupted({ staleBefore }) {
    const active = new Map()
    for (const event of await readEvents(this.file)) {
      if (event.type === 'turn.admitted' || event.type === 'turn.started') active.set(event.turnId, event)
      if (event.type === 'turn.completed') active.delete(event.turnId)
    }
    return [...active.values()].filter(event => event.at < staleBefore).map(event => ({
      ...event,
      reason: 'PROCESS_RESTART_INTERRUPTED_TURN',
    }))
  }

  /** Re-drive only journal identities that are still interrupted. */
  async recover({ staleBefore, drive }) {
    const turns = await this.interrupted({ staleBefore })
    const receipts = []
    for (const turn of turns) {
      receipts.push(await drive({ ...turn, recovery: true }))
    }
    return receipts
  }
}

/** Binding registry probe with deduplicated loss alerts. */
export class BindingHealthMonitor {
  constructor({ registry, probe, alert, now = () => new Date().toISOString() }) {
    this.registry = registry
    this.probe = probe
    this.alert = alert
    this.now = now
    this.alerted = new Set()
  }

  async check() {
    const results = []
    for (const binding of this.registry.list()) {
      const key = `${binding.channelConversationId}:${binding.activeAgentId}:${binding.activeSessionId}`
      const healthy = await this.probe(binding)
      const result = { type: healthy ? 'binding.healthy' : 'binding.lost', at: this.now(), binding, healthy }
      results.push(result)
      if (!healthy && !this.alerted.has(key)) {
        this.alerted.add(key)
        await this.alert(result)
      }
      if (healthy) this.alerted.delete(key)
    }
    return results
  }
}

/** Structured, queryable admission refusal ledger. */
export class AdmissionRejectionLedger {
  constructor({ file, now = () => new Date().toISOString() }) {
    this.file = file
    this.now = now
  }

  async record({ requestId, agentId, sessionId = null, fenceId = null, code, detail = null }) {
    if (!requestId || !agentId || !code) throw new TypeError('requestId, agentId and code are required')
    const event = {
      type: 'admission.rejected', at: this.now(), requestId, agentId, sessionId,
      fenceId, code, detail,
    }
    await appendJsonLine(this.file, event)
    return event
  }

  async list() { return readEvents(this.file) }
}

/** Session ingestion receipt that dispatch verification can consume. */
export class SessionInjectionReceiptLog {
  constructor({ file, now = () => new Date().toISOString() }) {
    this.file = file
    this.now = now
  }

  async record({ requestId, messageId, agentId, sessionId, turnId, status, source = 'router' }) {
    if (!requestId || !messageId || !agentId || !sessionId || !status) {
      throw new TypeError('requestId, messageId, agentId, sessionId and status are required')
    }
    const event = {
      type: 'session.injection_receipt', at: this.now(), requestId, messageId,
      agentId, sessionId, turnId: turnId ?? null, status, source,
    }
    await appendJsonLine(this.file, event)
    return event
  }

  async find({ requestId, messageId }) {
    const events = await readEvents(this.file)
    return events.find(event => event.type === 'session.injection_receipt'
      && event.requestId === requestId && event.messageId === messageId) ?? null
  }
}

export const R21_REJECTION_CODES = Object.freeze([
  'FENCE_ACTIVE', 'AGENT_NOT_ADMITTED', 'SESSION_NOT_READY', 'BINDING_NOT_FOUND',
  'PROOF_MISSING', 'PROOF_EXPIRED', 'RUNTIME_UNAVAILABLE',
])
