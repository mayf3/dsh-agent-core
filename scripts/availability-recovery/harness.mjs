// Reuses production registry, ingress, AgentProcess and durable store.
// Only provider/provisioning/channel resolution are local, tool-free fixtures.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AgentProcess } from '../../packages/agent-router/src/process.js'
import { createProcessRegistry } from '../../packages/agent-router/src/process-registry.js'
import { createIngressDelivery } from '../../packages/agent-router/src/ingress-delivery.js'
import { TurnReconciliationStore } from '../../packages/agent-router/src/reconciliation-store.js'
export const HR = 'agt_hr-agent'
export const OTHER = 'agt_availability-control'
const fixture = fileURLToPath(new URL('./worker.mjs', import.meta.url))
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
export async function until(check, timeoutMs = 3000) {
  const start = performance.now()
  while (!check()) {
    if (performance.now() - start > timeoutMs) throw new Error('fixture observation deadline exceeded')
    await sleep(5)
  }
}
export function rig(root, epoch = 'availability-epoch') {
  const store = new TurnReconciliationStore({ persistenceFile: join(root, 'recovery.json'), runtimeEpoch: epoch })
  const processes = []
  const log = { log() {}, error() {} }
  const workspaceBootstrap = {
    async ensure(id) { mkdirSync(join(root, id), { recursive: true }) },
    async ensureWorkspace() {},
    resolveWorkspace(id) { return join(root, id) },
    resolveDshHome(id) { return join(root, id) },
  }
  class LocalWorker extends AgentProcess {
    spawn() {
      this.counters.spawnAttempts += 1
      return this.attachChild(spawn(process.execPath, [fixture], {
        cwd: root, env: { PATH: '/usr/bin:/bin', HOME: root, FIXTURE_PROMPT_LOG: join(root, 'fixture-prompts.jsonl') }, stdio: ['pipe', 'pipe', 'pipe'],
      }))
    }
  }
  const registry = createProcessRegistry({
    log, cfg: { agentProfile: 'availability-fixture', productionRoot: root },
    workspaceBootstrap, reconciliationStore: store,
    agentDefinition: { getAgent(id) {
      if (![HR, OTHER].includes(id)) throw new Error('unregistered fixture Agent')
      return { id, disabled: false }
    } },
    deadlineConfig: { perAgent: () => ({ initializeTimeoutMs: 1500, promptReceiptTimeoutMs: 1000, turnTimeoutMs: 350, shutdownGraceMs: 500 }) },
    processFactory(opts) { const p = new LocalWorker(opts); processes.push(p); return p },
    resolveProcessConfig: () => ({ provider: 'availability-fixture', model: 'tool-free' }),
    provisionHome() {}, switchAgent() { throw new Error('not used') },
    getBrokerGateway() { throw new Error('tools forbidden in this fixture') },
  })
  let requests = 0
  const delivery = createIngressDelivery({
    log, feishu: undefined, workspaceBootstrap, store: {}, reconciliationStore: store,
    routeChain: { async runTurnWithRouteChain(id, args) {
      const p = await registry.ensureRunning(id)
      return p.turn(args.sessionId, args.message, args.opts)
    } },
    resolveAgentRef() { throw new Error('not used') },
    resolveAgentById() { throw new Error('not used') },
    async resolveChannelConversation({ externalId }) {
      return { channelConversation: { id: `local:${externalId}` }, binding: { activeAgentId: externalId, activeSessionId: 'main' } }
    },
    resolveEffectiveWorkspace: () => ({ workspaceId: null, workspacePath: root }),
  })
  return {
    store, registry, processes,
    current(id = HR) { return [...processes].reverse().find(p => p.agentId === id) },
    request(text, id = HR) {
      return delivery.onIngress({ channel: 'local', conversationId: id, chatId: id, messageId: `availability-${++requests}`, sender: { openId: 'fixture-owner' }, text })
    },
    abandonPendingTurns: delivery.abandonPendingTurns,
    async close() { await registry.dispose() },
  }
}
if (process.argv[2] === 'crash-controller') {
  const root = process.argv[3]
  const fx = rig(root, 'controller-before-crash')
  void fx.request('STALL controller-crash')
  await until(() => fx.current()?.counters.promptWriteAttempts > 0)
  await sleep(20)
  writeFileSync(join(root, 'owned-worker.json'), JSON.stringify({ pid: fx.current().pid }))
  // Real controller crash: no registry.dispose(), no synthetic exit receipt.
  // Worker fixture exits on pipe EOF, without an external operation or descendant.
  process.exit(77)
}
