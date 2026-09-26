import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply as applyRouter } from '../../src/index.js'
import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { AgentProcess } from '../../src/process/agent-process.js'
import { TurnReconciliationStore } from '../../src/reconciliation-store.js'

const INGRESS = {
  channel: 'p2p', chatId: 'oc_chat', conversationId: 'oc_chat', messageId: 'om_123',
  sender: { openId: 'ou_owner' }, text: 'hello',
  raw: { sender: { sender_id: { open_id: 'ou_owner' } } },
}
const CORRELATION = {
  channelNamespace: 'feishu', channelConversationId: 'feishu:oc_chat',
  feishuConversationId: 'oc_chat', feishuMessageId: 'om_123',
  feishuSenderOpenId: 'ou_owner',
}

function fixture(channelConversationId = 'feishu:oc_chat') {
  const trusted = new WeakMap()
  const calls = []
  let resolutions = 0
  const delivery = createIngressDelivery({
    log: { log() {}, error() {} },
    feishu: { replyTargetFor: () => ({ replyTo: () => ({}) }), reply: async () => {} },
    workspaceBootstrap: { ensureWorkspace: async () => {} },
    store: {},
    reconciliationStore: { assertBusinessAdmissionReady() {}, assertMintCapacity() {} },
    routeChain: { runTurnWithRouteChain: async (_agentId, args) => { calls.push(args); return { reply: 'ok' } } },
    resolveChannelConversation: async () => {
      resolutions += 1
      return {
        channelConversation: { id: channelConversationId },
        binding: { activeAgentId: 'agt_efficiency-agent', activeSessionId: 'main' },
      }
    },
    resolveEffectiveWorkspace: () => ({ workspaceId: null, workspacePath: '/tmp' }),
    registerAuthenticatedIngress: (opts, correlation) => trusted.set(opts, correlation),
  })
  return { delivery, trusted, calls, resolutions: () => resolutions }
}

test('V5 only the private authenticated callback registers exact opts identity', async () => {
  const f = fixture()
  await f.delivery.onIngress(INGRESS)
  assert.equal(f.trusted.get(f.calls[0].opts), undefined)
  await f.delivery.onAuthenticatedFeishuIngress(INGRESS)
  assert.deepEqual(f.trusted.get(f.calls[1].opts), CORRELATION)
  assert.equal(f.trusted.get({ ...f.calls[1].opts }), undefined)
})

test('V5 Router mounts a distinct private Feishu callback; public route cannot grant provenance', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'v5-router-mount-'))
  try {
    let callback
    let service
    const feishu = {
      setCallback(value) { callback = value },
      replyTargetFor: () => ({ replyTo: () => ({}) }), reply: async () => {},
    }
    const definition = {
      listAgents: () => [{ id: 'agt_efficiency-agent' }],
      getDefaultAgent: () => ({ id: 'agt_efficiency-agent' }),
      getAgent: () => ({ id: 'agt_efficiency-agent' }),
      resolveAgentRef: () => ({ id: 'agt_efficiency-agent' }),
    }
    const ctx = {
      get: (key) => ({ feishu, agentDefinition: definition, workspaceBootstrap: {} })[key],
      provide: (_key, value) => { service = value },
      effect: () => {},
    }
    applyRouter(ctx, {
      bindingsStoreFile: join(dir, 'bindings.json'),
      reconciliationStoreFile: join(dir, 'turns.json'),
      defaultAgentId: 'agt_efficiency-agent', defaultSessionId: 'main', agentProfile: 'standard',
    })
    assert.equal(typeof callback, 'function')
    assert.notEqual(callback, service.route)
    const result = await callback({ ...INGRESS, raw: {} })
    assert.ok(result.error, 'the mounted private callback rejects missing raw sender')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('V5 raw OpenID absence, fallback, mismatch and prototype spoof reject before route', async () => {
  for (const input of [
    { ...INGRESS, raw: { sender: { sender_id: { union_id: 'on_owner' } } } },
    { ...INGRESS, raw: { sender: { sender_id: { open_id: 'not-open-id' } } } },
    { ...INGRESS, sender: { openId: 'ou_other' } },
    { ...INGRESS, raw: { sender: { sender_id: Object.create({ open_id: 'ou_owner' }) } } },
    { ...INGRESS, messageId: 'x'.repeat(129) },
    { ...INGRESS, channel: 'mobile' },
  ]) {
    const f = fixture()
    const result = await f.delivery.onAuthenticatedFeishuIngress(input)
    assert.ok(result.error)
    assert.equal(f.calls.length, 0)
    assert.equal(f.resolutions(), 0)
  }
})

test('V5 post-binding correlation cap failure is still pre-turn admission', async () => {
  const f = fixture(`feishu:${'x'.repeat(256)}`)
  const result = await f.delivery.onAuthenticatedFeishuIngress(INGRESS)
  assert.ok(result.error)
  assert.equal(result.failureStage, 'admission')
  assert.equal(f.calls.length, 0)
})

test('V5 AgentProcess mint uses exact opts lookup, not caller ingressContext', async () => {
  const opts = { ingressContext: { feishuSenderOpenId: 'ou_forged' } }
  let mintArgs
  const process = new AgentProcess({
    agentId: 'agt_efficiency-agent', profile: 'standard',
    reconciliationStore: { mintTurnExecution: (args) => { mintArgs = args; throw new Error('stop after mint args') } },
    ingressCorrelationLookup: (candidate) => candidate === opts ? CORRELATION : null,
  })
  process.preAdmissionError = () => null
  process.state = 'READY'
  process.turnInFlight = true // hold the queue briefly to inspect identity
  const pending = process.turn('main', 'hello', opts)
  assert.equal(process.turnQueueEntries[0].opts, opts)
  process.turnInFlight = false
  process.drainTurnQueue()
  await assert.rejects(pending, error => error.status === 'not_admitted')
  assert.deepEqual(mintArgs.ingressCorrelation, CORRELATION)
})

test('V5 durable correlation is write-once and legacy missing field reads null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'v5-ingress-'))
  try {
    const file = join(dir, 'records.json')
    const store = new TurnReconciliationStore({ runtimeEpoch: 'v5-epoch', persistenceFile: file })
    const handle = store.mintTurnExecution({
      agentId: 'agt_efficiency-agent', processGeneration: 1, sessionId: 'main',
      ingressCorrelation: CORRELATION,
    })
    assert.deepEqual(store.getTurnReconciliation(handle).snapshot.ingressCorrelation, CORRELATION)
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).records[0].ingressCorrelation, CORRELATION)
    const restored = new TurnReconciliationStore({ runtimeEpoch: 'new-epoch', persistenceFile: file })
    assert.deepEqual(restored.getTurnReconciliation(handle).snapshot.ingressCorrelation, CORRELATION)
    const legacy = JSON.parse(readFileSync(file, 'utf8'))
    delete legacy.records[0].ingressCorrelation
    writeFileSync(file, JSON.stringify(legacy))
    const oldRestored = new TurnReconciliationStore({ runtimeEpoch: 'third-epoch', persistenceFile: file })
    assert.equal(oldRestored.getTurnReconciliation(handle).snapshot.ingressCorrelation, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('V5 malformed optional correlation rejects before sequence or durable mutation', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'v5-invalid' })
  for (const invalid of [
    { ...CORRELATION, feishuSenderOpenId: 'on_union' },
    { ...CORRELATION, extra: 'untrusted' },
    { ...CORRELATION, feishuMessageId: 'x'.repeat(129) },
    Object.assign(Object.create({ feishuSenderOpenId: 'ou_inherited' }), {
      channelNamespace: 'feishu', channelConversationId: 'cc',
      feishuConversationId: 'oc', feishuMessageId: 'om',
    }),
  ]) {
    assert.throws(() => store.mintTurnExecution({
      agentId: 'agt_efficiency-agent', processGeneration: 1, sessionId: 'main',
      ingressCorrelation: invalid,
    }), TypeError)
    assert.equal(store.records.size, 0)
  }
  assert.match(store.mintTurnExecution({
    agentId: 'agt_efficiency-agent', processGeneration: 1, sessionId: 'main',
  }), /:s1$/, 'rejected correlation never consumed a durable sequence')
})

test('V5 native prompt receipt remains separate from ingress message identity', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'v5-receipt' })
  const handle = store.mintTurnExecution({
    agentId: 'agt_efficiency-agent', processGeneration: 1, sessionId: 'main',
    ingressCorrelation: CORRELATION,
  })
  assert.equal(store.getTurnReconciliation(handle).snapshot.messageId, null)
  store.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'req-1' })
  store.markPromptReceipt(handle, { messageId: 'native-receipt-1' })
  const snapshot = store.getTurnReconciliation(handle).snapshot
  assert.equal(snapshot.ingressCorrelation.feishuMessageId, 'om_123')
  assert.equal(snapshot.messageId, 'native-receipt-1')
})
