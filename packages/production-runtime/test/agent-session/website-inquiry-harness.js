import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { createAssistantMessage } from '@deepseek-ai/dsh-llm'
import { createSessionSeam } from '../../../demo-server/src/session-seam.js'
import { WebsiteSourceCustody, forwardWebsiteSessionEvent } from '../../../demo-server/src/website-custody.js'
import { AgentProcess } from '../../../agent-router/src/process/agent-process.js'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation/index.js'
import { createParentRpcHandler } from '../../../agent-router/src/parent-rpc-relay.js'
import { createRouteChainExecutor } from '../../../agent-router/src/route-chain.js'
import { createWebsiteInquiryAdmission } from '../../../agent-router/src/website-inquiry-admission.js'
import { resolveCanonicalTarget } from '../../../session-history/src/locator.js'
import { createWebsiteNative } from '../../src/agent-session/website-inquiry/native.js'
import { InquiryStore } from '../../../product-api/src/website-inquiry/store.js'
import { createInquiryService } from '../../../product-api/src/website-inquiry/service.js'
import { createWebsiteInquiryHandler } from '../../../product-api/src/website-inquiry/http.js'
import { Readable } from 'node:stream'
import { createServer } from 'node:http'

export async function integratedFixture({ deferReplies = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'whi-integrated-'))
  const home = join(root, 'home')
  const workspace = join(root, 'workspace')
  mkdirSync(home)
  mkdirSync(workspace)
  const target = resolveCanonicalTarget({ agentHome: home, workspaceDir: workspace })
  mkdirSync(dirname(target.artifactPath), { recursive: true })
  const header = { type: 'session', version: 0, id: 'main', createdAt: 1, delegationDepth: 0, cwd: workspace }
  writeFileSync(target.artifactPath, JSON.stringify(header) + '\n')
  const workspaceBootstrap = { resolveDshHome: () => home, resolveWorkspace: () => workspace }
  const reconciliation = new TurnReconciliationStore()
  const logs = []
  const log = { log: value => logs.push(value), warn: value => logs.push(value), error: value => logs.push(value) }
  const proc = new AgentProcess({ agentId: 'agt_pilot', home, workspace, profile: '/synthetic-profile', log, reconciliationStore: reconciliation })
  proc.state = 'READY'
  // This synthetic child implements the real website mapping/custody seam below.
  proc.initializeEvidence = { websiteAdmission: { version: 1 } }
  const custody = new WebsiteSourceCustody(home)
  let requestContext
  let sends = 0
  const completions = []
  const sourceReadCounts = { binding: 0, definition: 0, metadata: 0 }
  let seq = 0
  let turn = 0
  const push = (type, data) => {
    const event = { type, seq: seq++, time: Date.now(), data }
    forwardWebsiteSessionEvent(custody, 'main', event, value => proc.onSessionEvent(value))
  }
  const agent = { session: { header, seq: 0 }, followup(message) {
    sends++
    assert.deepEqual(message.source, { kind: 'user' })
    const finish = () => {
      proc.onSessionStatus({ sessionId: 'main', status: 'running' })
      push('agent/inbox/spliced', { inserted: [message] })
      push('turn/start', { turn: ++turn })
      push('user/message', message)
      const reply = createAssistantMessage({ content: [{ type: 'text', text: 'Native synthetic answer 中文' }], source: { kind: 'model', provider: 'synthetic', model: 'synthetic' } })
      push('assistant/message', { turn, message: reply })
      push('turn/end', { turn, reason: { kind: 'completed' } })
      proc.onSessionStatus({ sessionId: 'main', status: 'idle' })
    }
    completions.push(finish)
    if (!deferReplies) setImmediate(() => { const task = completions.shift(); task?.() })
  } }
  const parentRpc = createParentRpcHandler({ agentId: 'agt_pilot', log, getProc: () => proc, getBrokerGateway: () => undefined })
  const services = { loader: { await: async () => {} }, agentLoop: {}, sessionPersistence: { list: async () => [header] }, agents: { resume: async () => ({ agent }) } }
  const seam = createSessionSeam({ conversationSource: null, ctx: { get: name => services[name] }, settings: { cwd: workspace },
    websiteAdmission: async (carrier, message) => {
      custody.register(carrier, message)
      await parentRpc('agent-core/websiteInquiryMap', { websiteAdmission: carrier, messageId: message.id }, { turnExecutionId: requestContext })
    } })
  proc.request = async (method, params) => {
    assert.equal(method, 'session/prompt')
    requestContext = params.turnExecutionId
    return seam.prompt(params.sessionId, params.contentBlocks, params.cwd, params.messageOrigin, params.conversationSource, params.websiteAdmission)
  }
  const chain = createRouteChainExecutor({ log, ensureRunningForRoute: async () => ({ status: 'ready', proc }) })
  const definition = { getAgent: id => { sourceReadCounts.definition++; return { id, disabled: false } } }
  const router = { channelConversationId: (channel, external) => `${channel}:${external}`,
    getBinding: () => { sourceReadCounts.binding++; return { activeAgentId: 'agt_pilot', activeSessionId: 'main' } },
    onTurnReconciled: listener => reconciliation.onTurnReconciled(listener),
    admitWebsiteInquiry: createWebsiteInquiryAdmission({ routeChain: chain, reconciliationStore: reconciliation,
      workspaceBootstrap, definition, store: { queue: Promise.resolve() } }) }
  const native = createWebsiteNative({ router, workspaceBootstrap })
  const metadata = native.metadata
  native.metadata = agentId => { sourceReadCounts.metadata++; return metadata(agentId) }
  const store = new InquiryStore(join(root, 'requests.sqlite'))
  const human = { kind: 'human', principalId: '00000000-0000-4000-8000-000000000001', exp: Math.floor(Date.now() / 1000) + 900 }
  const machine = { kind: 'controller', principalId: '00000000-0000-4000-8000-000000000002', clientId: 'agent-control-website-inquiry-v1' }
  const registry = [{ binding_id: 'synthetic-binding', version: '1', enabled: true, site_project_id: 'synthetic-site', site_owner_id: 'synthetic-owner', issuer: 'auth-service',
    auth_subject: human.principalId, human_principal_id: human.principalId, communication_scope_id: 'synthetic-scope',
    pilot_surface: { channel: 'website', external_id: 'synthetic-pilot', expected_agent_id: 'agt_pilot' },
    allowed_operations: ['bound_resolve', 'preauthorize', 'own_read', 'own_events'], transport_client_id: machine.clientId,
    transport_principal_id: machine.principalId, exact_web_origin: 'https://synthetic.example' }]
  const service = createInquiryService({ enabled: true, registry: () => registry, store, router, definition, native, cursorKey: Buffer.alloc(32, 1) })
  const handler = createWebsiteInquiryHandler({ enabled: true, service, auth: { human: async () => human, controller: async () => machine } })
  async function http(method, url, body) {
    const input = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
    const req = Object.assign(Readable.from(input), { method, url, headers: { 'content-type': 'application/json' } })
    let status, output
    await handler(req, { writeHead(code) { status = code }, end(value) { output = JSON.parse(value) } })
    return { status, output }
  }
  let server
  async function startServer() {
    server = createServer((req, res) => { void handler(req, res) })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${server.address().port}`
  }
  return { root, home, service, human, machine, store, native, registry, router, definition, proc, sourceReadCounts, logs,
    completePending: (index = 0) => completions.splice(index, 1)[0]?.(), http, handler, startServer, sends: () => sends,
    close() { server?.close(); native.dispose(); store.close(); rmSync(root, { recursive: true, force: true }) } }
}
