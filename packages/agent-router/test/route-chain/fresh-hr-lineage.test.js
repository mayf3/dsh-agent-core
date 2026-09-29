import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { BindingStore } from '../../src/binding-store.js'
import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { turnExecutionMethods } from '../../src/process/turn-execution.js'
import { createProcessRegistry } from '../../src/process-registry.js'

const AGENT = 'agt_hr-agent'
const NEW_SESSION = 'hr-fresh-20260929-6d3b45a0'
const SHA = (digit) => digit.repeat(64)

function oldUnknown(store, agentId = AGENT, ingressCorrelation = null) {
  const handle = store.mintTurnExecution({ agentId, processGeneration: 1,
    sessionId: 'main', ingressCorrelation })
  store.markAdmitted(handle, {
    eventWatermarkSeq: 0,
    promptRequestId: 'old-do-not-replay',
    deadlineAtWallMs: Date.now() + 30_000,
  })
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  return handle
}

function trustedCut(handle, overrides = {}) {
  return {
    version: 1,
    operationId: 'hr-fresh-lineage-cut-20260929-0d8235e7',
    agentId: AGENT,
    oldHandle: handle,
    oldRuntimeEpoch: 'old-runtime',
    oldProcessGeneration: 1,
    oldSessionId: 'main',
    issuanceFloor: 1,
    newRuntimeEpoch: 'new-runtime',
    newSessionId: NEW_SESSION,
    cutCommittedAtMs: Date.now(),
    oldWorkerIsolationReceiptSha256: SHA('a'),
    schedulerDisabledReceiptSha256: SHA('b'),
    rootReceiptSha256: SHA('c'),
    ...overrides,
  }
}

function withRestartedOldUnknown(check) {
  const dir = mkdtempSync(join(tmpdir(), 'hr-fresh-lineage-'))
  try {
    const persistenceFile = join(dir, 'reconciliation.json')
    const first = new TurnReconciliationStore({ runtimeEpoch: 'old-runtime', persistenceFile })
    const oldHandle = oldUnknown(first)
    const restarted = new TurnReconciliationStore({ runtimeEpoch: 'new-runtime', persistenceFile })
    assert.equal(restarted.startupBlockedReason, null)
    return check(restarted, oldHandle)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('fresh HR lineage admits only a new session after a trusted exact cut; old UNKNOWN and old session stay fenced', () => {
  withRestartedOldUnknown((restarted, oldHandle) => {
  const before = structuredClone(restarted.records.get(oldHandle))
  assert.equal(restarted.admissionFenceForAgent(AGENT, { sessionId: NEW_SESSION })?.handle, oldHandle)

  const cut = trustedCut(oldHandle)
  restarted.activateTrustedFreshHrLineage(cut)
  assert.equal(restarted.admissionFenceForAgent(AGENT, { sessionId: NEW_SESSION })?.handle,
    oldHandle, 'Binding/child mount is not yet an open business route')
  assert.throws(() => restarted.issueFreshHrAdmissionToken(AGENT, { sessionId: NEW_SESSION }))
  const startupToken = restarted.issueFreshHrStartupToken(cut)
  assert.equal(restarted.spawnFenceForAgent(AGENT, startupToken), null,
    'the private one-child startup may pass the old fence')
  assert.equal(restarted.promptFenceForAgent(AGENT, NEW_SESSION, startupToken)?.handle,
    oldHandle, 'a startup token cannot write a prompt')
  assert.throws(() => restarted.completeTrustedFreshHrMount(cut, {
    processGeneration: cut.issuanceFloor, childPid: 1234,
    acknowledgementSha256: SHA('d'),
  }))
  restarted.completeTrustedFreshHrMount(cut, { processGeneration: 2, childPid: 1234,
    acknowledgementSha256: SHA('d') })
  assert.equal(restarted.activeFenceForAgent(AGENT)?.handle, oldHandle, 'historical fence remains active')
  assert.deepEqual(restarted.records.get(oldHandle), before, 'old UNKNOWN record is untouched')
  assert.equal(restarted.admissionFenceForAgent(AGENT, { sessionId: 'main' })?.handle, oldHandle)
  assert.equal(restarted.admissionFenceForAgent(AGENT, { sessionId: NEW_SESSION }), null)
  assert.equal(restarted.spawnFenceForAgent(AGENT)?.handle, oldHandle, 'public route without a private token stays fenced')
  const token = restarted.issueFreshHrAdmissionToken(AGENT, { sessionId: NEW_SESSION })
  assert.equal(restarted.spawnFenceForAgent(AGENT, token), null)
  assert.equal(restarted.promptFenceForAgent(AGENT, NEW_SESSION, token), null)
  assert.equal(restarted.promptFenceForAgent(AGENT, 'main', token)?.handle, oldHandle)
  assert.equal(restarted.promptFenceForAgent(AGENT, NEW_SESSION, {} )?.handle, oldHandle)
  assert.equal(restarted.admissionFenceForAgent('agt_other-agent', { sessionId: 'main' }), null)
  })
})

test('fresh HR lineage requires exact old subject and verified bridge receipt fields', () => {
  withRestartedOldUnknown((restarted, oldHandle) => {
  for (const bad of [
    { oldHandle: 'wrong' },
    { oldRuntimeEpoch: 'wrong' },
    { oldProcessGeneration: 2 },
    { newSessionId: 'main' },
    { schedulerDisabledReceiptSha256: '' },
    { oldWorkerIsolationReceiptSha256: '' },
    { rootReceiptSha256: '' },
  ]) {
    assert.throws(() => restarted.activateTrustedFreshHrLineage(trustedCut(oldHandle, bad)))
    assert.equal(restarted.admissionFenceForAgent(AGENT, { sessionId: NEW_SESSION })?.handle, oldHandle)
  }
  })
})

test('a new unknown under the fresh lineage fences it again; an old mapped request cannot be re-admitted', () => {
  withRestartedOldUnknown((restarted, oldHandle) => {
  const cut = trustedCut(oldHandle)
  restarted.activateTrustedFreshHrLineage(cut)
  restarted.completeTrustedFreshHrMount(cut, { processGeneration: 2, childPid: 1234,
    acknowledgementSha256: SHA('d') })
  assert.equal(restarted.admissionFenceForAgent(AGENT, {
    sessionId: 'fresh-old', freshMappingCreatedAt: cut.cutCommittedAtMs - 1,
    freshMappingLineageOperationId: cut.operationId,
  })?.handle, oldHandle)
  assert.equal(restarted.admissionFenceForAgent(AGENT, {
    sessionId: 'fresh-new', freshMappingCreatedAt: cut.cutCommittedAtMs + 1,
    freshMappingLineageOperationId: cut.operationId,
  }), null)
  const mappedToken = restarted.issueFreshHrAdmissionToken(AGENT, {
    sessionId: 'fresh-new', freshMappingCreatedAt: cut.cutCommittedAtMs + 1,
    freshMappingLineageOperationId: cut.operationId,
  })
  assert.equal(restarted.promptFenceForAgent(AGENT, 'fresh-new', mappedToken), null)
  assert.throws(() => restarted.issueFreshHrAdmissionToken(AGENT, {
    sessionId: 'fresh-old', freshMappingCreatedAt: cut.cutCommittedAtMs - 1,
    freshMappingLineageOperationId: cut.operationId,
  }))
  const newHandle = restarted.mintTurnExecution({ agentId: AGENT, processGeneration: 2, sessionId: NEW_SESSION })
  restarted.markAdmitted(newHandle, { eventWatermarkSeq: 0, promptRequestId: 'new-canary', deadlineAtWallMs: Date.now() + 30_000 })
  restarted.markOutcomeUnknown(newHandle, { source: 'turn_deadline_exceeded' })
  assert.equal(restarted.admissionFenceForAgent(AGENT, { sessionId: NEW_SESSION })?.handle, newHandle)
  assert.equal(restarted.spawnFenceForAgent(AGENT, mappedToken)?.handle, newHandle)
  assert.equal(restarted.activeFenceForAgent(AGENT)?.handle, oldHandle)
  })
})

test('only authenticated Feishu with the durable exact Binding reaches the new lineage', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hr-fresh-ingress-'))
  try {
    const bindingStore = new BindingStore({ storeFile: join(dir, 'bindings.json') })
    await bindingStore.set({ channelConversationId: 'feishu:oc_hr', activeAgentId: AGENT,
      activeSessionId: 'old-session', workspace: null })
    const first = new TurnReconciliationStore({ runtimeEpoch: 'old-runtime',
      persistenceFile: join(dir, 'reconciliation.json') })
    const handle = oldUnknown(first, AGENT, {
      channelNamespace: 'feishu', channelConversationId: 'feishu:oc_hr',
      feishuConversationId: 'oc_hr', feishuMessageId: 'om_old_request',
      feishuSenderOpenId: 'ou_owner',
    })
    const store = new TurnReconciliationStore({ runtimeEpoch: 'new-runtime',
      persistenceFile: join(dir, 'reconciliation.json') })
    const cut = trustedCut(handle)
    let executions = 0
    const delivery = createIngressDelivery({
      log: { log() {}, error() {} }, workspaceBootstrap: { async ensureWorkspace() {} },
      store: bindingStore, reconciliationStore: store,
      routeChain: { async runTurnWithRouteChain(agentId, input) {
        executions += 1
        assert.equal(agentId, AGENT)
        assert.equal(input.sessionId, NEW_SESSION)
        assert.equal(store.promptFenceForAgent(agentId, input.sessionId,
          input.opts.lineageAdmissionToken), null)
        return { reply: 'HR fresh canary' }
      } },
      resolveAgentRef() { throw new Error('not used') },
      resolveAgentById() { throw new Error('not used') },
      async resolveChannelConversation() {
        return { channelConversation: { id: 'feishu:oc_hr' },
          binding: bindingStore.get('feishu:oc_hr') }
      },
      resolveEffectiveWorkspace() { return { workspaceId: null, workspacePath: dir } },
      registerAuthenticatedIngress() {},
    })
    const ingress = { channel: 'p2p', chatId: 'oc_hr', conversationId: 'oc_hr',
      messageId: 'om_new_canary', sender: { openId: 'ou_owner' },
      timestamp: cut.cutCommittedAtMs + 1_000,
      raw: { sender: { sender_id: { open_id: 'ou_owner' } },
        message: { message_id: 'om_new_canary',
          create_time: String(cut.cutCommittedAtMs + 1_000) } },
      text: 'new harmless canary' }
    store.activateTrustedFreshHrLineage(cut)
    const before = await delivery.onAuthenticatedFeishuIngress(ingress)
    assert.equal(before.fencedBy, handle, JSON.stringify(before))
    await bindingStore.commitFreshHrBindingCut({ ...cut,
      oldSessionId: 'old-session' })
    store.completeTrustedFreshHrMount(cut, { processGeneration: 2, childPid: 1234,
      acknowledgementSha256: SHA('d') })
    const publicRoute = await delivery.onIngress(ingress)
    assert.equal(publicRoute.fencedBy, handle)
    const oldRetry = { ...ingress, messageId: 'om_old_request',
      timestamp: cut.cutCommittedAtMs - 1_000,
      raw: { ...ingress.raw, message: { message_id: 'om_old_request',
        create_time: String(cut.cutCommittedAtMs - 1_000) } } }
    const rejectedRetry = await delivery.onAuthenticatedFeishuIngress(oldRetry)
    assert.equal(rejectedRetry.fencedBy, handle)
    const oldIdWithFreshTimestamp = { ...oldRetry, timestamp: ingress.timestamp,
      raw: { ...oldRetry.raw, message: { ...oldRetry.raw.message,
        create_time: String(ingress.timestamp) } } }
    assert.equal((await delivery.onAuthenticatedFeishuIngress(oldIdWithFreshTimestamp)).fencedBy,
      handle, 'the durable old message ID stays rejected even with a later timestamp')
    assert.equal(executions, 0, 'old pre-cut message cannot reach a new prompt')
    const allowed = await delivery.onAuthenticatedFeishuIngress(ingress)
    assert.equal(allowed.reply, 'HR fresh canary')
    assert.equal(executions, 1)
    assert.equal(store.activeFenceForAgent(AGENT)?.handle, handle)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('final process prompt gate rejects old or public direct HR calls before a prompt byte', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hr-fresh-final-prompt-'))
  try {
    const persistenceFile = join(dir, 'reconciliation.json')
    const oldStore = new TurnReconciliationStore({ runtimeEpoch: 'old-runtime', persistenceFile })
    const oldHandle = oldUnknown(oldStore)
    const store = new TurnReconciliationStore({ runtimeEpoch: 'new-runtime', persistenceFile })
    store.activateTrustedFreshHrLineage(trustedCut(oldHandle))
    store.completeTrustedFreshHrMount(trustedCut(oldHandle), {
      processGeneration: 2, childPid: 1234, acknowledgementSha256: SHA('d'),
    })
    const token = store.issueFreshHrAdmissionToken(AGENT, { sessionId: NEW_SESSION })
    let writes = 0
    const proc = {
      agentId: AGENT, store, fixedAdminQualification: null,
      activeUnknownFences: new Map(), state: 'READY',
      request: async () => { writes += 1; return { messageId: 'new-receipt' } },
      replayExecutionFromWatermark() {},
    }
    const denied = turnExecutionMethods.preAdmissionError.call(proc,
      'turn', NEW_SESSION, 'new harmless canary', 20, {})
    assert.equal(denied.fencedBy, oldHandle)
    assert.equal(turnExecutionMethods.preAdmissionError.call(proc,
      'turn', NEW_SESSION, 'new harmless canary', 20,
      { lineageAdmissionToken: token }), null)
    const execution = { handle: 'test-new-handle', promptReceiptDeadlineMono: 1,
      turnDeadlineMono: 2, promptRequestId: 'new-request' }
    await assert.rejects(turnExecutionMethods.promptWrite.call(proc,
      execution, NEW_SESSION, 'new harmless canary', {}), error => error.fencedBy === oldHandle)
    assert.equal(writes, 0)
    const originalMarkAttempt = store.markPromptWriteAttempted
    const originalMarkReceipt = store.markPromptReceipt
    store.markPromptWriteAttempted = () => {}
    store.markPromptReceipt = () => {}
    try {
      await turnExecutionMethods.promptWrite.call(proc, execution, NEW_SESSION,
        'new harmless canary', { lineageAdmissionToken: token })
    } finally {
      store.markPromptWriteAttempted = originalMarkAttempt
      store.markPromptReceipt = originalMarkReceipt
    }
    assert.equal(writes, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a later Runtime mount cannot replay the first cut epoch or reopen old HR', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hr-fresh-remount-'))
  try {
    const persistenceFile = join(dir, 'reconciliation.json')
    const old = new TurnReconciliationStore({ runtimeEpoch: 'old-runtime', persistenceFile })
    const handle = oldUnknown(old)
    const firstMount = new TurnReconciliationStore({ runtimeEpoch: 'new-runtime', persistenceFile })
    firstMount.activateTrustedFreshHrLineage(trustedCut(handle))
    const laterMount = new TurnReconciliationStore({ runtimeEpoch: 'later-runtime', persistenceFile })
    assert.throws(() => laterMount.activateTrustedFreshHrLineage(trustedCut(handle)),
      /exact cut binding invalid/)
    assert.equal(laterMount.activeFenceForAgent(AGENT)?.handle, handle)
    assert.equal(laterMount.spawnFenceForAgent(AGENT)?.handle, handle)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('private post-cut startup allocates a real READY child above the durable floor without a prompt', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hr-fresh-child-'))
  try {
    const persistenceFile = join(dir, 'reconciliation.json')
    const old = new TurnReconciliationStore({ runtimeEpoch: 'old-runtime', persistenceFile })
    const handle = oldUnknown(old)
    const store = new TurnReconciliationStore({ runtimeEpoch: 'new-runtime', persistenceFile })
    const cut = trustedCut(handle)
    store.activateTrustedFreshHrLineage(cut)
    let spawns = 0
    let prompts = 0
    const registry = createProcessRegistry({
      log: { log() {}, error() {} }, cfg: { agentProfile: 'test' },
      workspaceBootstrap: { async ensure() {}, resolveWorkspace: () => dir,
        resolveDshHome: () => join(dir, 'home') },
      agentDefinition: { getAgent: () => ({ id: AGENT, disabled: false }) },
      deadlineConfig: { perAgent: () => ({}) }, reconciliationStore: store,
      processFactory: ({ agentId, processGeneration }) => ({
        agentId, processGeneration, state: 'SPAWNING', exit: undefined,
        spawn() {
          spawns += 1
          this.child = { pid: 2222 }
          this.pid = 2222
          this.ownership = { childObject: this.child, pid: this.pid }
          this.state = 'READY'
        },
        async ready() {},
        promptWrite() { prompts += 1 },
      }),
      resolveProcessConfig: () => ({}), provisionHome() {},
      switchAgent() {}, getBrokerGateway() {},
    })
    await assert.rejects(registry.ensureRunning(AGENT))
    const token = store.issueFreshHrStartupToken(cut)
    const proc = await registry.ensureRunning(AGENT, token)
    assert.equal(proc.state, 'READY')
    assert.equal(proc.processGeneration, cut.issuanceFloor + 1)
    assert.equal(proc.pid, 2222)
    assert.equal(spawns, 1)
    assert.equal(prompts, 0)
    assert.equal(store.admissionFenceForAgent(AGENT, { sessionId: NEW_SESSION })?.handle,
      handle, 'no public HR ingress before ACK publication')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
