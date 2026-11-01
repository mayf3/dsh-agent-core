import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { TurnReconciliationStore } from '../../src/reconciliation/store.js'
import { createRouteChainExecutor } from '../../src/route-chain.js'
import { createProductSurfaceConversation } from '../../src/conversation/surface.js'
import { createWebsiteInquiryAdmission } from '../../src/process/website-inquiry-admission.js'
import { apply as applyRouter } from '../../src/index.js'
import { createDeliveryFailureStore } from '../../src/reconciliation/delivery-failures.js'

const privateText = 'PRIVATE_PROMPT_Bearer_secret-fixture'
const projectionKeys = ['attemptedActions', 'failureStage', 'fencedBy', 'missingEvidence',
  'nextSafeAction', 'partialDelivery', 'processGeneration', 'reconciliationHandle',
  'replyDelivery', 'requestAdmission', 'terminationEvidence'].sort()

function fixture(t, { invalid = false, lateBlock = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'blocked-delivery-alert-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const persistenceFile = join(root, 'recovery.json')
  if (invalid) writeFileSync(persistenceFile, '[]')
  const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'alert-fixture' })
  let routeCalls = 0
  const logs = []
  const log = { log() {}, error: line => logs.push(line) }
  const chain = createRouteChainExecutor({ log, resolveTurnDeadlineMs: () => 1000,
    ensureRunningForRoute: async () => {
      routeCalls += 1
      if (lateBlock) throw Object.assign(new Error(privateText), {
        code: 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED', status: 'not_admitted',
      })
      throw new Error('early rejection must not acquire a process')
    } })
  const ingress = createIngressDelivery({ log, feishu: undefined,
    workspaceBootstrap: { resolveWorkspace: () => '/tmp/alert-workspace' },
    store: {}, reconciliationStore: store, routeChain: chain,
    resolveAgentRef: () => ({ id: 'agt_alert' }),
    resolveChannelConversation: async () => ({ channelConversation: { id: 'mobile:alert' },
      binding: { activeAgentId: 'agt_alert', activeSessionId: 'main' } }),
    resolveEffectiveWorkspace: () => ({ workspaceId: null, workspacePath: '/tmp/alert-workspace' }),
  })
  const binding = { activeAgentId: 'agt_alert', activeSessionId: 'main' }
  const product = createProductSurfaceConversation({ sourceDirectory: root,
    bindingResolution: { getBinding: () => binding }, definition: { getAgent: id => ({ id }) },
    reconciliationStore: store, routeChain: chain })
  const website = createWebsiteInquiryAdmission({ routeChain: chain, reconciliationStore: store,
    definition: { getAgent: id => ({ id }) }, store: { queue: Promise.resolve() },
    workspaceBootstrap: { resolveWorkspace: () => '/tmp/alert-workspace' } })
  return { store, chain, ingress, logs, routeCalls: () => routeCalls,
    route: () => ingress.onIngress({ channel: 'mobile', conversationId: privateText, text: privateText }),
    deliver: () => ingress.deliver({ requestId: privateText, agentId: 'agt_alert', sessionMode: 'main', message: privateText }),
    product: () => product.sendProductSurface({ requestId: privateText, bindingId: 'fixture', agentId: 'agt_alert', message: privateText }),
    website: () => website({ agentId: 'agt_alert', message: privateText, recheck() {}, map() {},
      carrier: { namespace: 'website-human-inquiry-v1', human_principal_id: 'fixture-human',
        communication_scope_id: 'fixture-scope', request_id: 'fixture-request', payload_digest: 'a'.repeat(64),
        site_owner_binding_version: 'fixture-version' } }) }
}

function assertSingleAlert(fx, code, reason, agentId) {
  const snapshot = fx.chain.deliveryFailuresSnapshot()
  assert.deepEqual(snapshot.counts, { transport_death: 0, caller_bound_exceeded: 0,
    child_exit_without_outcome: 0, other: 1 })
  assert.equal(snapshot.alerts, 1, 'a single blocked request alerts synchronously within five minutes')
  assert.equal(snapshot.recent.length, 1)
  assert.deepEqual({ code: snapshot.recent[0].code, reason: snapshot.recent[0].reason,
    agentId: snapshot.recent[0].agentId }, { code, reason, agentId })
  const alerts = fx.logs.filter(line => line.startsWith('delivery-failure-alert '))
  assert.equal(alerts.length, 1)
  const alert = JSON.parse(alerts[0].slice('delivery-failure-alert '.length))
  assert.equal(alert.threshold, 1)
  assert.equal(alert.category, 'other')
  assert.equal(alert.code, code)
  assert.equal(alert.reason, reason)
  assert.ok(alert.windowMs <= 300_000)
  assert.ok(!JSON.stringify(fx.logs).includes(privateText), 'new failure/alert logs omit request content')
}

for (const entry of ['route', 'deliver', 'product', 'website']) {
  test(`R3 ${entry}: one real startup-blocked request enters shared alert feed once`, async t => {
    const fx = fixture(t, { invalid: true })
    const original = readFileSync(fx.store.persistenceFile, 'utf8')
    if (entry === 'route') {
      const result = await fx.route()
      assert.deepEqual(Object.keys(result).sort(), projectionKeys)
      assert.equal(result.requestAdmission, 'not_admitted')
    } else await assert.rejects(fx[entry](), { code: 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED' })
    assert.equal(fx.routeCalls(), 0)
    assertSingleAlert(fx, 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED', 'durable_store_invalid', null)
    assert.equal(readFileSync(fx.store.persistenceFile, 'utf8'), original)
  })

  test(`R3 ${entry}: one real per-agent fence rejection enters shared alert feed once`, async t => {
    const fx = fixture(t)
    const handle = fx.store.mintTurnExecution({ agentId: 'agt_alert', processGeneration: 1, sessionId: 'main' })
    fx.store.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'fixture-request', deadlineAtWallMs: Date.now() + 1000 })
    fx.store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
    const original = readFileSync(fx.store.persistenceFile, 'utf8')
    if (entry === 'route') {
      const result = await fx.route()
      assert.deepEqual(Object.keys(result).sort(), projectionKeys)
      assert.equal(result.fencedBy, handle)
    } else await assert.rejects(fx[entry](), error => {
      assert.equal(error.code, 'AGENT_PROCESS_TURN_FENCED')
      if (entry === 'product') assert.equal(error.proven, 'zero_byte')
      if (entry === 'website') assert.equal(error.reconciliationHandle, null)
      return true
    })
    assert.equal(fx.routeCalls(), 0)
    assertSingleAlert(fx, 'AGENT_PROCESS_TURN_FENCED', 'unresolved_turn_fence', entry === 'website' ? null : 'agt_alert')
    if (entry === 'website') assert.ok(!JSON.stringify(fx.logs).includes('agt_alert'))
    assert.equal(fx.store.getTurnReconciliation(handle).snapshot.fenceState, 'active')
    assert.equal(readFileSync(fx.store.persistenceFile, 'utf8'), original)
  })
}

test('R3 blocked observation accepts only bounded code/reason/agent metadata', () => {
  const logs = []
  const failures = createDeliveryFailureStore({ log: { error: line => logs.push(line) } })
  const error = Object.assign(new Error(privateText), { code: 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED',
    prompt: privateText, answer: privateText })
  failures.blocked(error, { agentId: privateText, reason: privateText, requestId: privateText })
  assert.equal(failures.snapshot().recent[0].agentId, null)
  assert.equal(failures.snapshot().recent[0].reason, 'recovery_startup_blocked')
  assert.equal(failures.snapshot().alerts, 1)
  assert.ok(!JSON.stringify(logs).includes(privateText))
  assert.equal(failures.blocked({ code: privateText }, { agentId: 'agt_alert' }), null)
  assert.equal(failures.snapshot().counts.other, 1)
})

test('R3 a blocked process acquisition already counted by the chain is not counted again by ingress', async t => {
  const fx = fixture(t, { lateBlock: true })
  await fx.route()
  assert.equal(fx.routeCalls(), 1)
  assertSingleAlert(fx, 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED', 'recovery_startup_blocked', 'agt_alert')
})

test('R3 website: late blocked acquisition alerts once without exposing raw Agent identity', async t => {
  const fx = fixture(t, { lateBlock: true })
  await assert.rejects(fx.website(), { code: 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED' })
  assert.equal(fx.routeCalls(), 1)
  assertSingleAlert(fx, 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED', 'recovery_startup_blocked', null)
  assert.ok(!JSON.stringify(fx.logs).includes('agt_alert'))
})

for (const entry of ['product', 'website']) {
  test(`R3 ${entry}: observing rejection preserves its existing raw-fence fallback`, async t => {
    const fx = fixture(t)
    const handle = fx.store.mintTurnExecution({ agentId: 'agt_alert', processGeneration: 1, sessionId: 'main' })
    fx.store.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'fixture-request', deadlineAtWallMs: Date.now() + 1000 })
    fx.store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
    fx.store.admissionBlockerForAgent = () => null
    await assert.rejects(fx[entry](), { code: 'AGENT_PROCESS_TURN_FENCED' })
    assertSingleAlert(fx, 'AGENT_PROCESS_TURN_FENCED', 'unresolved_turn_fence', entry === 'website' ? null : 'agt_alert')
    assert.equal(fx.routeCalls(), 0)
  })
}

test('R3 real router initialization alerts on an invalid startup store before any delivery', t => {
  const root = mkdtempSync(join(tmpdir(), 'blocked-router-initialization-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const persistenceFile = join(root, 'recovery.json')
  writeFileSync(persistenceFile, '[]')
  const startupLogs = []
  t.mock.method(process.stderr, 'write', line => { startupLogs.push(String(line)); return true })
  const definition = { getDefaultAgent: () => ({ id: 'agt_alert' }), listAgents: () => [{ id: 'agt_alert' }] }
  const services = new Map([['workspaceBootstrap', {}], ['agentDefinition', definition]])
  const ctx = { get: key => services.get(key), provide: (key, value) => services.set(key, value), effect: fn => fn() }
  const router = applyRouter(ctx, { bindingsStoreFile: join(root, 'bindings.json'),
    reconciliationStoreFile: persistenceFile, defaultSessionId: 'main', agentProfile: 'agent-core-production',
    processFactory: () => { throw new Error('startup barrier must prevent spawning') } })
  assert.equal(router.reconciliationRuntimeStatus().health, 'blocked')
  assert.equal(router.deliveryFailuresSnapshot().counts.other, 1)
  assert.equal(router.deliveryFailuresSnapshot().alerts, 1)
  assert.equal(router.deliveryFailuresSnapshot().recent[0].reason, 'durable_store_invalid')
  assert.equal(startupLogs.filter(line => line.includes('delivery-failure-alert ')).length, 1)
  assert.equal(readFileSync(persistenceFile, 'utf8'), '[]')
})
