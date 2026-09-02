import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { NOTIFICATION_RESOURCE } from '../../notification-ingress/src/auth.js'
import { resolveProductionLayout } from '../src/paths.js'

export const AGT_ID = 'agt_production-runtime-test'
export const FORUM = { clientId: 'client-forum-abc', clientSecret: 'forum-secret-111' }
export const WORKFLOW = { clientId: 'client-workflow-xyz', clientSecret: 'workflow-secret-222' }
export const basic = (clientId, clientSecret) => 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
export const silentLog = { log() {}, warn() {}, error() {} }
export const okTokenFetch = () => async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) })

export function writeNotificationAuthConfig(layout) {
  mkdirSync(layout.notificationDir, { recursive: true })
  chmodSync(layout.notificationDir, 0o700)
  writeFileSync(layout.notificationAuthConfig, `${JSON.stringify({
    authServiceOrigin: 'https://auth.example.com',
    audience: NOTIFICATION_RESOURCE,
    allowlist: { 'svc-forum': FORUM.clientId, 'svc-workflow': WORKFLOW.clientId },
  }, null, 2)}\n`)
  chmodSync(layout.notificationAuthConfig, 0o600)
}

let pidSeq = 4000

export class FakeProc {
  constructor({ agentId, log }) {
    this.agentId = agentId
    this.pid = ++pidSeq
    this.log = log
    this.home = `/tmp/prt-home-${agentId}`
    this.workspace = `/tmp/prt-ws-${agentId}`
    this.profile = 'fake-profile'
    this.creations = []
    this.exit = undefined
    this.exitResolve = undefined
    this.exitPromise = new Promise((resolve) => { this.exitResolve = resolve })
    this.onRpcRequest = undefined
    this.deliveries = []
    this.turns = []
  }

  spawn() {}

  async ready() { return 1 }

  async deliver(sessionId, text) {
    this.deliveries.push({ sessionId, text })
    return {
      accepted: true, sessionId, messageId: `msg-${this.deliveries.length}`,
      reconciliationHandle: `turn:deliver-${this.deliveries.length}`, evidence: { promptReceipt: 'accepted' },
    }
  }

  async turn(sessionId, text) {
    this.turns.push({ sessionId, text })
    return {
      reply: `TURNED:${text}`, ms: 1, promptMs: 1, messageId: `m${this.turns.length}`,
      reconciliationHandle: `turn:scheduled-${this.turns.length}`, evidence: { terminationEvidence: 'exact_terminal_then_idle' },
    }
  }

  async shutdown() {
    if (this.exit === undefined) {
      this.exit = { code: 0, signal: null }
      this.exitResolve?.(this.exit)
    }
    return this.exit
  }

  kill() {
    this.exit = { code: 9, signal: 'SIGKILL' }
    this.exitResolve?.({ code: 9, signal: 'SIGKILL' })
  }
}

export async function seedRuntime(t, { agents = [[AGT_ID, 'Production Test Agent']] } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'prt-compose-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: agents[0]?.[0] ?? null,
    agents: agents.map(([id, name]) => ({ id, name })),
  })
  return { root, layout }
}
